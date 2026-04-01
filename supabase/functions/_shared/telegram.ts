// supabase/functions/_shared/telegram.ts

export async function sendMessage(
  botToken: string,
  chatId: string | number,
  text: string
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
}

export async function registerWebhook(
  botToken: string,
  webhookUrl: string,
  secretToken: string
): Promise<{ ok: boolean; description?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl, secret_token: secretToken }),
  })
  return res.json()
}

export async function deleteWebhook(botToken: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, {
    method: 'POST',
  })
}
