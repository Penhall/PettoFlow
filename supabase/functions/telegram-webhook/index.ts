// supabase/functions/telegram-webhook/index.ts
import { getSupabaseClient } from '../_shared/supabase.ts'
import { sendMessage } from '../_shared/telegram.ts'
import { decrypt } from '../_shared/crypto.ts'
import { validateRequest } from './middleware/auth.ts'
import { parseSlash } from './parser/slash.ts'
import { parseWithLLM } from './parser/nlp.ts'
import { isAllowed } from './parser/allowlist.ts'
import { createTask, listTasks, completeTask, setPriority } from './actions/tasks.ts'
import { logActivity, listActivities } from './actions/activities.ts'
import { recordTransaction, getBalance, listTransactions } from './actions/finance.ts'
import {
  requestConfirmation,
  getPendingConfirmation,
  clearPendingConfirmation,
} from './utils/confirm.ts'

const HELP_TEXT = `🤖 <b>Comandos disponíveis:</b>

<b>Tarefas:</b>
/tarefa [título] — cria tarefa
/tarefas — lista pendentes
/ok [n] — conclui tarefa #n
/prioridade [n] [alta|média|baixa]

<b>Atividades:</b>
/nota [texto] — registra nota
/reuniao [texto] — agenda reunião
/ligacao [para quem] — registra ligação
/atividades — lista recentes

<b>Finanças:</b>
/pagar [desc] [valor] — registra saída
/recebi [desc] [valor] — registra entrada
/saldo — saldo das contas
/extrato — últimas transações

Você também pode escrever em linguagem natural!`

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const sb = getSupabaseClient()
  const encryptionKey = Deno.env.get('ENCRYPTION_KEY')!

  // Carregar config do bot
  const { data: configRow } = await sb
    .from('bot_configs')
    .select('*')
    .limit(1)
    .single()

  if (!configRow) {
    return new Response('Bot not configured', { status: 503 })
  }

  // Descriptografar campos sensíveis
  const webhookSecret = await decrypt(configRow.webhook_secret, encryptionKey)
  const botToken = await decrypt(configRow.telegram_bot_token, encryptionKey)

  const config = {
    webhook_secret: webhookSecret,
    allowed_telegram_ids: configRow.allowed_telegram_ids as string[],
    is_active: configRow.is_active as boolean,
  }

  // Validar segurança (3 camadas)
  const auth = await validateRequest(req, config)

  if (!auth.valid) {
    if (auth.paused) {
      const body = auth.body as { message?: { chat?: { id: number } } }
      const chatId = body?.message?.chat?.id
      if (chatId) {
        await sendMessage(botToken, chatId, '⏸️ Bot pausado. Reative nas Configurações do PettoFlow.')
      }
    }
    return new Response('', { status: auth.status ?? 200 })
  }

  const body = auth.body as {
    message?: {
      chat?: { id: number }
      from?: { id: number }
      text?: string
    }
  }

  const chatId = String(body?.message?.chat?.id ?? '')
  const fromId = String(body?.message?.from?.id ?? '')
  const text = (body?.message?.text ?? '').trim()

  if (!chatId || !text) return new Response('OK', { status: 200 })

  let responseText: string

  try {
    // Verificar se há confirmação pendente e o usuário respondeu SIM/NÃO
    const upperText = text.toUpperCase()
    if (upperText === 'SIM' || upperText === 'NÃO' || upperText === 'NAO') {
      const pending = await getPendingConfirmation(sb, chatId)
      if (pending) {
        await clearPendingConfirmation(sb, chatId)
        if (upperText === 'SIM') {
          const p = pending.action_payload as { direction: 'in' | 'out'; description: string; amount: number }
          responseText = await recordTransaction(sb, p.direction, p.description, p.amount)
        } else {
          responseText = '❌ Transação cancelada.'
        }
        await sendMessage(botToken, chatId, responseText)
        return new Response('OK', { status: 200 })
      }
    }

    // Parse do comando
    let parsed = parseSlash(text)

    if (!parsed && configRow.llm_api_key) {
      const llmKey = await decrypt(configRow.llm_api_key, encryptionKey)
      parsed = await parseWithLLM(text, llmKey, configRow.llm_provider ?? 'anthropic')
    }

    if (!parsed || !isAllowed(parsed.action)) {
      responseText = '🤔 Não entendi. Tente /ajuda para ver os comandos disponíveis.'
      await sendMessage(botToken, chatId, responseText)
      return new Response('OK', { status: 200 })
    }

    const { action, params } = parsed

    switch (action) {
      case 'tasks.create':
        responseText = await createTask(sb, params.title as string)
        break
      case 'tasks.list':
        responseText = await listTasks(sb, chatId)
        break
      case 'tasks.complete':
        responseText = await completeTask(sb, chatId, params.num as number)
        break
      case 'tasks.setPriority':
        responseText = await setPriority(sb, chatId, params.num as number, params.priority as string)
        break
      case 'activities.log':
        responseText = await logActivity(sb, params.type as string, params.text as string)
        break
      case 'activities.list':
        responseText = await listActivities(sb)
        break
      case 'finance.record': {
        const amount = params.amount as number
        const threshold = configRow.confirmation_threshold as number ?? 500
        if (amount > threshold) {
          const dirLabel = params.direction === 'out' ? 'saída' : 'entrada'
          responseText = await requestConfirmation(
            sb,
            chatId,
            'finance.record',
            params as Record<string, unknown>,
            `Confirmar ${dirLabel} de R$ ${amount.toFixed(2).replace('.', ',')} em "${params.description}"?`
          )
        } else {
          responseText = await recordTransaction(
            sb,
            params.direction as 'in' | 'out',
            params.description as string,
            amount
          )
        }
        break
      }
      case 'finance.balance':
        responseText = await getBalance(sb)
        break
      case 'finance.list':
        responseText = await listTransactions(sb)
        break
      case 'bot.start':
        if (!config.allowed_telegram_ids.includes(fromId)) {
          const newIds = [...config.allowed_telegram_ids, fromId]
          await sb.from('bot_configs').update({ allowed_telegram_ids: newIds }).eq('id', configRow.id)
        }
        responseText = `👋 Olá! Sou o bot do PettoFlow.\nSeu ID Telegram é: <code>${fromId}</code>\n\n${HELP_TEXT}`
        break
      case 'bot.help':
        responseText = HELP_TEXT
        break
      case 'bot.status':
        responseText = '✅ Bot ativo e conectado ao PettoFlow.'
        break
      default:
        responseText = '🤔 Não entendi. Tente /ajuda.'
    }
  } catch (err) {
    console.error('Error processing message:', err)
    responseText = '⚠️ Algo deu errado. Tente novamente em instantes.'
  }

  await sendMessage(botToken, chatId, responseText)
  return new Response('OK', { status: 200 })
})
