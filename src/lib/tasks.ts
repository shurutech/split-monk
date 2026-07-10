export interface NotifyPayload {
  type:       string
  groupId:    string
  groupName:  string
  actorUid:   string
  targetUids: string[]
  title:      string
  body:       string
  url:        string
}

// Enqueue a push notification via Cloud Tasks → /api/notify
// delaySecs: small delay allows batching rapid consecutive actions
export async function enqueueNotification(payload: NotifyPayload, delaySecs = 5): Promise<void> {
  // No-op in local dev or if Cloud Tasks not configured
  if (!process.env.CLOUD_TASKS_QUEUE || !process.env.GOOGLE_CLOUD_PROJECT) return
  // Nothing to send
  if (payload.targetUids.length === 0) return

  try {
    const { CloudTasksClient } = await import('@google-cloud/tasks')
    const client = new CloudTasksClient()
    const parent = client.queuePath(
      process.env.GOOGLE_CLOUD_PROJECT,
      process.env.CLOUD_TASKS_LOCATION!,
      process.env.CLOUD_TASKS_QUEUE,
    )

    const body = Buffer.from(JSON.stringify({
      secret: process.env.NOTIFY_INTERNAL_SECRET,
      ...payload,
    })).toString('base64')

    const scheduleSeconds = Math.floor(Date.now() / 1000) + delaySecs

    await client.createTask({
      parent,
      task: {
        httpRequest: {
          httpMethod: 'POST' as const,
          url: `${process.env.NEXT_PUBLIC_APP_URL}/api/notify`,
          headers: { 'Content-Type': 'application/json' },
          body,
        },
        scheduleTime: { seconds: scheduleSeconds },
      },
    })
  } catch (err) {
    // Never let notification failure surface to the user
    console.error('[tasks] enqueueNotification failed:', err)
  }
}
