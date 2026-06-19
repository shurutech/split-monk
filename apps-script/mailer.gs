// SplitMonk Mailer — Google Apps Script
// Deploy as Web App: Execute as Me, Anyone can access
// Paste this entire file into the Apps Script editor.

var APP_URL_DEFAULT = 'https://splitmonk.in'; // fallback if not passed in payload

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

    // ── Route by type ─────────────────────────────────────────────────────────
    if (payload.type === 'reminder') {
      return handleReminder(payload);
    }
    return handleInvite(payload);

  } catch (err) {
    Logger.log('SplitMonk mailer error: ' + err.toString());
    return jsonResponse(500, 'Internal error: ' + err.message);
  }
}

// ── Invite handler (existing flow) ────────────────────────────────────────────

function handleInvite(payload) {
  var to          = payload.to;
  var groupName   = payload.groupName;
  var groupId     = payload.groupId;
  var invitedBy   = payload.invitedBy;
  var coverColor  = payload.coverColor  || '#7C6BF8';
  var startDate   = payload.startDate   || null;
  var endDate     = payload.endDate     || null;
  var memberNames = payload.memberNames || [];
  var appUrl      = payload.appUrl      || APP_URL_DEFAULT;

  if (!to || !groupName || !groupId || !invitedBy) {
    return jsonResponse(400, 'Missing required fields: to, groupName, groupId, invitedBy');
  }
  if (typeof to !== 'string' || !to.includes('@')) {
    return jsonResponse(400, 'Invalid recipient email');
  }

  var groupUrl = appUrl + '/groups/' + groupId;
  var subject  = invitedBy + ' added you to "' + groupName + '" on SplitMonk';
  var htmlBody = buildInviteHtml(to, groupName, groupId, groupUrl, invitedBy, coverColor, startDate, endDate, memberNames);
  var textBody = buildInviteText(groupName, groupUrl, invitedBy, memberNames);

  MailApp.sendEmail({ to: to, subject: subject, body: textBody, htmlBody: htmlBody, name: 'SplitMonk' });
  return jsonResponse(200, 'sent');
}

// ── Reminder handler (settlement nudge) ───────────────────────────────────────

function handleReminder(payload) {
  var to            = payload.to;
  var recipientName = payload.recipientName;
  var owesTo        = payload.owesTo;
  var amount        = payload.amount;
  var groupName     = payload.groupName;
  var groupId       = payload.groupId;
  var sentBy        = payload.sentBy;
  var coverColor    = payload.coverColor    || '#7C6BF8';
  var tripEndDate   = payload.tripEndDate   || null;
  var expenseCount  = payload.expenseCount  || 0;
  var topExpenses   = payload.topExpenses   || [];
  var appUrl        = payload.appUrl        || APP_URL_DEFAULT;

  if (!to || !recipientName || !owesTo || !amount || !groupName || !groupId || !sentBy) {
    return jsonResponse(400, 'Missing required reminder fields');
  }
  if (typeof to !== 'string' || !to.includes('@')) {
    return jsonResponse(400, 'Invalid recipient email');
  }

  var groupUrl = appUrl + '/groups/' + groupId;
  var subject  = '💸 You owe ' + owesTo + ' ' + amount + ' — ' + groupName;
  var htmlBody = buildReminderHtml(to, recipientName, owesTo, amount, groupName, groupUrl, sentBy, coverColor, tripEndDate, expenseCount, topExpenses);
  var textBody = buildReminderText(recipientName, owesTo, amount, groupName, groupUrl, sentBy, topExpenses);

  MailApp.sendEmail({ to: to, subject: subject, body: textBody, htmlBody: htmlBody, name: 'SplitMonk' });
  return jsonResponse(200, 'sent');
}

// ── Reminder email template ───────────────────────────────────────────────────

function buildReminderHtml(to, recipientName, owesTo, amount, groupName, groupUrl, sentBy, coverColor, tripEndDate, expenseCount, topExpenses) {
  var tripLine = tripEndDate
    ? '<p style="margin:0 0 20px;color:#8E8E9A;font-size:13px;">Trip ended ' + tripEndDate + '</p>'
    : '';

  var expensesHtml = '';
  if (topExpenses.length > 0) {
    expensesHtml += '<p style="margin:20px 0 8px;color:#8E8E9A;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Here\'s what you owe for</p>';
    expensesHtml += '<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #2A2A32;border-radius:8px;overflow:hidden;">';
    for (var i = 0; i < topExpenses.length; i++) {
      var exp = topExpenses[i];
      var bg  = i % 2 === 0 ? '#0D0D0F' : '#111113';
      expensesHtml += '<tr style="background:' + bg + ';">'
        + '<td style="padding:10px 14px;">'
        + '<p style="margin:0;color:#F2F2F7;font-size:13px;">' + escHtml(exp.title) + '</p>'
        + (exp.paidBy ? '<p style="margin:2px 0 0;color:#8E8E9A;font-size:11px;">paid by ' + escHtml(exp.paidBy) + '</p>' : '')
        + '</td>'
        + '<td style="padding:10px 14px;color:#F87171;font-size:13px;font-family:monospace;text-align:right;white-space:nowrap;vertical-align:top;">' + escHtml(exp.yourShare) + '</td>'
        + '</tr>';
    }
    if (expenseCount > topExpenses.length) {
      expensesHtml += '<tr style="background:#0A0A0B;">'
        + '<td colspan="2" style="padding:8px 14px;color:#8E8E9A;font-size:11px;">+ ' + (expenseCount - topExpenses.length) + ' more expense(s)</td>'
        + '</tr>';
    }
    expensesHtml += '</table>';
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

    + '<div style="width:40px;height:4px;background:#F87171;border-radius:4px;margin-bottom:24px;"></div>'

    + '<p style="margin:0 0 4px;color:#8E8E9A;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Settlement reminder</p>'
    + '<h1 style="margin:0 0 6px;color:#F2F2F7;font-size:24px;font-weight:700;line-height:1.2;">' + escHtml(groupName) + '</h1>'

    + tripLine

    + '<p style="margin:0 0 6px;color:#8E8E9A;font-size:14px;">Hey <strong style="color:#F2F2F7;">' + escHtml(recipientName) + '</strong>,</p>'
    + '<p style="margin:0 0 20px;color:#8E8E9A;font-size:14px;line-height:1.6;">'
    + 'The trip is done but the tab\'s still open. You owe <strong style="color:#F2F2F7;">' + escHtml(owesTo) + '</strong>:'
    + '</p>'

    // Big amount
    + '<div style="background:#1A1A1F;border:1px solid rgba(248,113,113,0.25);border-radius:8px;padding:20px;text-align:center;margin-bottom:20px;">'
    + '<p style="margin:0 0 4px;color:#8E8E9A;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">You owe</p>'
    + '<p style="margin:0;color:#F87171;font-size:32px;font-weight:700;font-family:monospace;">' + escHtml(amount) + '</p>'
    + '<p style="margin:4px 0 0;color:#8E8E9A;font-size:13px;">to ' + escHtml(owesTo) + '</p>'
    + '</div>'

    + expensesHtml

    // CTA
    + '<div style="margin-top:28px;text-align:center;">'
    + '<a href="' + groupUrl + '" style="display:inline-block;background:' + coverColor + ';color:#fff;font-size:14px;font-weight:600;'
    + 'text-decoration:none;padding:12px 32px;border-radius:8px;">View & Settle →</a>'
    + '</div>'

    + '<p style="margin:20px 0 0;color:#4A4A56;font-size:12px;text-align:center;">'
    + 'Reminder sent by ' + escHtml(sentBy) + ' · SplitMonk'
    + '</p>'

    + '</td></tr>'

    // Footer
    + '<tr><td style="padding-top:20px;text-align:center;">'
    + '<p style="margin:0;color:#4A4A56;font-size:11px;">SplitMonk · Split bills. Stay friends.</p>'
    + '</td></tr>'

    + '</table>'
    + '</td></tr></table>'
    + '</body></html>';
}

function buildReminderText(recipientName, owesTo, amount, groupName, groupUrl, sentBy, topExpenses) {
  var lines = [
    'Hey ' + recipientName + ',',
    '',
    'The ' + groupName + ' trip is done but the tab\'s still open.',
    '',
    'You owe ' + owesTo + ': ' + amount,
    '',
  ];
  if (topExpenses.length > 0) {
    lines.push('Here\'s what you owe for:');
    topExpenses.forEach(function(exp) {
      var line = '  • ' + exp.title + ': ' + exp.yourShare;
      if (exp.paidBy) line += ' (paid by ' + exp.paidBy + ')';
      lines.push(line);
    });
    lines.push('');
  }
  lines.push('View & settle: ' + groupUrl);
  lines.push('');
  lines.push('— ' + sentBy + ' via SplitMonk');
  return lines.join('\n');
}

// ── Invite email template (existing) ─────────────────────────────────────────

function buildInviteHtml(to, groupName, groupId, groupUrl, invitedBy, coverColor, startDate, endDate, memberNames) {
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

    + '<tr><td style="padding-bottom:28px;text-align:center;">'
    + '<span style="font-size:22px;font-weight:700;color:#F2F2F7;letter-spacing:-0.5px;">Split<span style="color:' + coverColor + ';">Monk</span></span>'
    + '</td></tr>'

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

    + '<tr><td style="padding-top:20px;text-align:center;">'
    + '<p style="margin:0;color:#4A4A56;font-size:11px;">SplitMonk · Split bills. Stay friends.</p>'
    + '</td></tr>'

    + '</table>'
    + '</td></tr></table>'
    + '</body></html>';
}

function buildInviteText(groupName, groupUrl, invitedBy, memberNames) {
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
