import { NextRequest, NextResponse } from 'next/server'

export interface ReminderRecipient {
  email:        string
  recipientName: string
  owesTo:       string        // name of creditor
  amount:       string        // formatted e.g. "₹4,949"
  expenseCount: number
  topExpenses:  { title: string; yourShare: string }[]
}

export interface ReminderPayload {
  groupId:     string
  groupName:   string
  coverColor:  string
  sentBy:      string        // organizer display name
  tripEndDate?: string       // formatted date string
  recipients:  ReminderRecipient[]
}

interface ScriptResult {
  email:   string
  success: boolean
  error?:  string
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const scriptUrl    = process.env.APPS_SCRIPT_MAILER_URL
  const scriptSecret = process.env.APPS_SCRIPT_SECRET ?? ''

  if (!scriptUrl) {
    console.warn('[remind] APPS_SCRIPT_MAILER_URL not set — skipping reminder emails')
    return NextResponse.json({ skipped: true, reason: 'mailer not configured' }, { status: 200 })
  }

  let payload: ReminderPayload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { groupId, groupName, coverColor, sentBy, tripEndDate, recipients } = payload

  if (!groupId || !groupName || !sentBy || !Array.isArray(recipients) || recipients.length === 0) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const results: ScriptResult[] = await Promise.all(
    recipients.map(async (r): Promise<ScriptResult> => {
      try {
        const res = await fetch(scriptUrl, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            secret:        scriptSecret,
            type:          'reminder',
            to:            r.email,
            recipientName: r.recipientName,
            owesTo:        r.owesTo,
            amount:        r.amount,
            groupName,
            groupId,
            sentBy,
            coverColor:    coverColor ?? '#7C6BF8',
            tripEndDate:   tripEndDate ?? null,
            expenseCount:  r.expenseCount,
            topExpenses:   r.topExpenses,
          }),
          signal: AbortSignal.timeout(10_000),
        })

        const text = await res.text()
        let parsed: { status: number; message: string } | null = null
        try { parsed = JSON.parse(text) } catch { /* non-JSON */ }

        if (!res.ok || (parsed && parsed.status !== 200)) {
          const msg = parsed?.message ?? `HTTP ${res.status}`
          console.error(`[remind] ${r.email} failed: ${msg}`)
          return { email: r.email, success: false, error: msg }
        }

        return { email: r.email, success: true }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[remind] ${r.email} threw: ${msg}`)
        return { email: r.email, success: false, error: msg }
      }
    })
  )

  const failed = results.filter((r) => !r.success)
  const status = failed.length === 0 ? 200 : 207

  return NextResponse.json({ results }, { status })
}
