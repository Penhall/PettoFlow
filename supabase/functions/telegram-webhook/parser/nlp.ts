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
    let url: string
    let body: string
    let headers: Record<string, string>

    if (provider === 'openai') {
      url = 'https://api.openai.com/v1/chat/completions'
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
    } else if (provider === 'google') {
      url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
      headers = { 'Content-Type': 'application/json' }
      body = JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: message }] }],
        generationConfig: { maxOutputTokens: 200, temperature: 0 },
      })
    } else {
      // Anthropic (padrão)
      url = 'https://api.anthropic.com/v1/messages'
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
    let text: string | undefined
    if (provider === 'openai') {
      text = data.choices?.[0]?.message?.content
    } else if (provider === 'google') {
      text = data.candidates?.[0]?.content?.parts?.[0]?.text
    } else {
      text = data.content?.[0]?.text
    }

    if (!text) return null

    // Gemini às vezes envolve o JSON em blocos markdown ```json ... ```
    let jsonText = text.trim()
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim()
    }

    const parsed = JSON.parse(jsonText) as ParsedCommand
    if (!isAllowed(parsed.action)) return null
    return parsed
  } catch {
    return null
  }
}
