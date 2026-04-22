// supabase/functions/telegram-webhook/parser/slash.ts

interface ParsedCommand {
  action: string
  params: Record<string, unknown>
}

function normalizeCommand(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function extractAmount(tokens: string[]): { amount: number; descTokens: string[] } | null {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const normalized = tokens[i].replace(',', '.')
    const num = parseFloat(normalized)
    if (!isNaN(num) && num > 0) {
      return { amount: num, descTokens: tokens.slice(0, i) }
    }
  }
  return null
}

const PRIORITY_MAP: Record<string, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
}

export function parseSlash(text: string): ParsedCommand | null {
  if (!text.startsWith('/')) return null

  const [rawCmd, ...rest] = text.slice(1).split(/\s+/)
  const cmd = normalizeCommand(rawCmd)
  const args = rest.join(' ').trim()

  switch (cmd) {
    case 'tarefa':
      if (!args) return null
      return { action: 'tasks.create', params: { title: args } }

    case 'tarefas':
      return { action: 'tasks.list', params: {} }

    case 'ok': {
      const num = parseInt(rest[0], 10)
      if (isNaN(num)) return null
      return { action: 'tasks.complete', params: { num } }
    }

    case 'prioridade': {
      const num = parseInt(rest[0], 10)
      const priorityKey = normalizeCommand(rest[1] ?? '')
      const priority = PRIORITY_MAP[priorityKey]
      if (isNaN(num) || !priority) return null
      return { action: 'tasks.setPriority', params: { num, priority } }
    }

    case 'nota':
      if (!args) return null
      return { action: 'activities.log', params: { type: 'note', text: args } }

    case 'reuniao':
      return { action: 'activities.log', params: { type: 'meeting', text: args } }

    case 'ligacao':
      return { action: 'activities.log', params: { type: 'call', text: args } }

    case 'atividades':
      return { action: 'activities.list', params: {} }

    case 'pagar': {
      const extracted = extractAmount(rest)
      if (!extracted) return null
      return {
        action: 'finance.record',
        params: {
          direction: 'out',
          description: extracted.descTokens.join(' '),
          amount: extracted.amount,
        },
      }
    }

    case 'recebi': {
      const extracted = extractAmount(rest)
      if (!extracted) return null
      return {
        action: 'finance.record',
        params: {
          direction: 'in',
          description: extracted.descTokens.join(' '),
          amount: extracted.amount,
        },
      }
    }

    case 'saldo':
      return { action: 'finance.balance', params: {} }

    case 'extrato':
      return { action: 'finance.list', params: {} }

    case 'start':
      return { action: 'bot.start', params: {} }

    case 'ajuda':
      return { action: 'bot.help', params: {} }

    case 'status':
      return { action: 'bot.status', params: {} }

    default:
      return null
  }
}
