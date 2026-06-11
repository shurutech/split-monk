// SplitMonk Mailer — Google Apps Script
// Deploy as Web App: Execute as Me, Anyone can access
// Paste this entire file into the Apps Script editor.

var APP_URL = 'https://splitmonk.vercel.app'; // update if custom domain

// Set this to any random string, then add the same value as
// APPS_SCRIPT_SECRET in your .env.local and Vercel env vars.
// Leave empty ('') to disable the check during local testing.
var SECRET = PropertiesService.getScriptProperties().getProperty('SPLITMONK_SECRET') || '';

function doPost(e) {
  try {
    // ── Parse & validate payload ──────────────────────────────────────────────
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse(400, 'Missing request body');
    }

    var payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (_) {
      return jsonResponse(400, 'Invalid JSON');
    }

    // ── Secret check — reject requests without the correct token ─────────────
    if (SECRET && payload.secret !== SECRET) {
      return jsonResponse(401, 'Unauthorized');
    }

    var to          = payload.to;
    var groupName   = payload.groupName;
    var groupId     = payload.groupId;
    var invitedBy   = payload.invitedBy;
    var coverColor  = payload.coverColor  || '#7C6BF8';
    var startDate   = payload.startDate   || null;
    var endDate     = payload.endDate     || null;
    var memberNames = payload.memberNames || [];

    if (!to || !groupName || !groupId || !invitedBy) {
      return jsonResponse(400, 'Missing required fields: to, groupName, groupId, invitedBy');
    }

    // Basic email sanity check
    if (typeof to !== 'string' || !to.includes('@')) {
      return jsonResponse(400, 'Invalid recipient email');
    }

    var groupUrl = APP_URL + '/groups/' + groupId;

    // ── Build email ───────────────────────────────────────────────────────────
    var subject  = invitedBy + ' added you to "' + groupName + '" on SplitMonk';
    var htmlBody = buildHtml(to, groupName, groupId, groupUrl, invitedBy, coverColor, startDate, endDate, memberNames);
    var textBody = buildText(groupName, groupUrl, invitedBy, memberNames);

    MailApp.sendEmail({
      to:       to,
      subject:  subject,
      body:     textBody,
      htmlBody: htmlBody,
      name:     'SplitMonk',
    });

    return jsonResponse(200, 'sent');

  } catch (err) {
    // Log for Apps Script execution logs
    Logger.log('SplitMonk mailer error: ' + err.toString());
    return jsonResponse(500, 'Internal error: ' + err.message);
  }
}

// ── HTML email template ───────────────────────────────────────────────────────

function buildHtml(to, groupName, groupId, groupUrl, invitedBy, coverColor, startDate, endDate, memberNames) {
  var recipientFirst = to.split('@')[0];
  var dateStr = '';
  if (startDate) {
    dateStr = '<p style="margin:0 0 6px;color:#8E8E9A;font-size:13px;">📅 '
      + startDate + (endDate ? ' → ' + endDate : '') + '</p>';
  }

  var membersHtml = '';
  if (memberNames.length > 0) {
    membersHtml = '<p style="margin:16px 0 6px;color:#8E8E9A;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Also on this trip</p>'
      + '<p style="margin:0;color:#F2F2F7;font-size:13px;">' + memberNames.join(' · ') + '</p>';
  }

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
    + '<body style="margin:0;padding:0;background:#0A0A0B;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;">'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0B;padding:40px 16px;">'
    + '<tr><td align="center">'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">'

    // Header
    + '<tr><td style="padding-bottom:28px;text-align:center;">'
    + '<span style="font-size:22px;font-weight:700;color:#F2F2F7;letter-spacing:-0.5px;">Split<span style="color:' + coverColor + ';">Monk</span></span>'
    + '</td></tr>'

    // Card
    + '<tr><td style="background:#111113;border:1px solid #2A2A32;border-radius:12px;padding:32px;">'

    + '<div style="width:40px;height:4px;background:' + coverColor + ';border-radius:4px;margin-bottom:24px;"></div>'

    + '<p style="margin:0 0 4px;color:#8E8E9A;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">You\'ve been added to</p>'
    + '<h1 style="margin:0 0 16px;color:#F2F2F7;font-size:24px;font-weight:700;line-height:1.2;">' + escHtml(groupName) + '</h1>'

    + dateStr

    + '<p style="margin:0 0 24px;color:#8E8E9A;font-size:14px;line-height:1.6;">'
    + '<strong style="color:#F2F2F7;">' + escHtml(invitedBy) + '</strong> added you to this trip on SplitMonk. '
    + 'Sign in to see expenses, balances, and settle up.'
    + '</p>'

    + membersHtml

    + '<div style="margin-top:28px;text-align:center;">'
    + '<a href="' + groupUrl + '" style="display:inline-block;background:' + coverColor + ';color:#fff;font-size:14px;font-weight:600;'
    + 'text-decoration:none;padding:12px 32px;border-radius:8px;">Open Trip →</a>'
    + '</div>'

    + '</td></tr>'

    // Footer
    + '<tr><td style="padding-top:20px;text-align:center;">'
    + '<p style="margin:0;color:#4A4A56;font-size:11px;">SplitMonk · Split bills. Stay friends.</p>'
    + '</td></tr>'

    + '</table>'
    + '</td></tr></table>'
    + '</body></html>';
}

function buildText(groupName, groupUrl, invitedBy, memberNames) {
  var lines = [
    'You\'ve been added to "' + groupName + '" on SplitMonk.',
    '',
    invitedBy + ' added you to this trip.',
    '',
  ];
  if (memberNames.length > 0) {
    lines.push('Also on this trip: ' + memberNames.join(', '));
    lines.push('');
  }
  lines.push('Open trip: ' + groupUrl);
  return lines.join('\n');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function jsonResponse(status, message) {
  var body = JSON.stringify({ status: status, message: message });
  return ContentService
    .createTextOutput(body)
    .setMimeType(ContentService.MimeType.JSON);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
