// supabase/functions/telegram-webhook/parser/nlp.ts
import { isAllowed } from './allowlist.ts'

interface ParsedCommand {
  action: string
  params: Record<string, unknown>
}

const SYSTEM_PROMPT = `Você é um assistente que converte mensagens em português para ações estruturadas do PettoFlow (app de gestão de tarefas, atividades e finanças).

Responda APENAS com JSON no formato: {"action": "...", "params": {...}}
Nunca explique, nunca adicione texto além do JSON.

Ações disponíveis:
- tasks.create: params: {title: string}
- tasks.list: params: {}
- tasks.complete: params: {num: number} (somente se número explícito na mensagem)
- activities.log: params: {type: "note"|"meeting"|"call", text: string}
- finance.record: params: {direction: "in"|"out", description: string, amount: number}
- finance.balance: params: {}
- finance.list: params: {}

Se não entender a intenção, responda: {"action": "unknown", "params": {}}`

export async function parseWithLLM(
  message: string,
  apiKey: string,
  provider: string
): Promise<ParsedCommand | null> {
  try {
    const url = provider === 'openai'
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://api.anthropic.com/v1/messages'

    let body: string
    let headers: Record<string, string>

    if (provider === 'openai') {
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      }
      body = JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: message },
        ],
        max_tokens: 200,
      })
    } else {
      // Anthropic (padrão)
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      }
      body = JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: message }],
      })
    }

    const res = await fetch(url, { method: 'POST', headers, body })
    if (!res.ok) return null

    const data = await res.json()
    const text = provider === 'openai'
      ? data.choices?.[0]?.message?.content
      : data.content?.[0]?.text

    if (!text) return null

    const parsed = JSON.parse(text.trim()) as ParsedCommand
    if (!isAllowed(parsed.action)) return null
    return parsed
  } catch {
    return null
  }
}
