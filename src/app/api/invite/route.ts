import { NextRequest, NextResponse } from 'next/server'
import { ALLOWED_DOMAIN } from '@/constants'

export interface InvitePayload {
  groupId:     string
  groupName:   string
  coverColor:  string
  invitedBy:   string        // display name of the person who created the group
  pendingEmails: string[]    // emails to invite
  memberNames: string[]      // display names of resolved members (for "also on this trip")
  startDate?:  string        // ISO date string, optional
  endDate?:    string
}

interface ScriptResult {
  email:   string
  success: boolean
  error?:  string
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Guard: env var must be set ──────────────────────────────────────────────
  const scriptUrl = process.env.APPS_SCRIPT_MAILER_URL
  if (!scriptUrl) {
    console.warn('[invite] APPS_SCRIPT_MAILER_URL not set — skipping email invites')
    return NextResponse.json({ skipped: true, reason: 'mailer not configured' }, { status: 200 })
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let payload: InvitePayload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { groupId, groupName, coverColor, invitedBy, pendingEmails, memberNames, startDate, endDate } = payload

  if (!groupId || !groupName || !invitedBy || !Array.isArray(pendingEmails)) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Nothing to send
  if (pendingEmails.length === 0) {
    return NextResponse.json({ results: [] }, { status: 200 })
  }

  // ── Domain guard — never send outside @shurutech.com ───────────────────────
  const validEmails = pendingEmails.filter(
    (e) => typeof e === 'string' && e.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)
  )

  if (validEmails.length === 0) {
    return NextResponse.json({ error: 'No valid @' + ALLOWED_DOMAIN + ' emails' }, { status: 400 })
  }

  // ── Fan out — one POST per email, all in parallel ───────────────────────────
  const results: ScriptResult[] = await Promise.all(
    validEmails.map(async (email): Promise<ScriptResult> => {
      try {
        const res = await fetch(scriptUrl, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to:          email,
            groupName,
            groupId,
            invitedBy,
            coverColor:  coverColor  ?? '#7C6BF8',
            startDate:   startDate   ?? null,
            endDate:     endDate     ?? null,
            memberNames: memberNames ?? [],
          }),
          // Apps Script can be slow on cold start — give it 10s
          signal: AbortSignal.timeout(10_000),
        })

        const text = await res.text()

        // Apps Script always returns 200; we check our JSON status field
        let parsed: { status: number; message: string } | null = null
        try { parsed = JSON.parse(text) } catch { /* non-JSON response */ }

        if (!res.ok || (parsed && parsed.status !== 200)) {
          const msg = parsed?.message ?? `HTTP ${res.status}`
          console.error(`[invite] ${email} failed: ${msg}`)
          return { email, success: false, error: msg }
        }

        return { email, success: true }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[invite] ${email} threw: ${msg}`)
        return { email, success: false, error: msg }
      }
    })
  )

  const failed  = results.filter((r) => !r.success)
  const status  = failed.length === 0 ? 200 : 207  // 207 = partial success

  return NextResponse.json({ results }, { status })
}
