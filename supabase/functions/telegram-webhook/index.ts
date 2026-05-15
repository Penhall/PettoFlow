// supabase/functions/telegram-webhook/index.ts
import { getSupabaseClient } from '../_shared/supabase.ts'
import { sendMessage, escapeHtml } from '../_shared/telegram.ts'
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
import { transcribeVoice } from './utils/voice.ts'
import { executeActions } from './utils/actions.ts'
import { resolveBotConfigFromWebhookSecret } from './utils/config.ts'
import { traceTelegram } from './utils/telemetry.ts'

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
  const requestSecret = req.headers.get('x-telegram-bot-api-secret-token') ?? ''
  const configRow = await resolveBotConfigFromWebhookSecret(sb, requestSecret, encryptionKey)

  if (!configRow) {
    traceTelegram('tenant_resolution_rejected', { reason: 'secret_not_found' })
    return new Response('', { status: 401 })
  }

  const webhookSecret = await decrypt(configRow.webhook_secret, encryptionKey)
  const botToken = await decrypt(configRow.telegram_bot_token, encryptionKey)
  const tenantId = configRow.tenant_id

  const config = {
    webhook_secret: webhookSecret,
    allowed_telegram_ids: configRow.allowed_telegram_ids as string[],
    is_active: configRow.is_active as boolean,
  }

  const auth = await validateRequest(req, config)

  if (!auth.valid) {
    traceTelegram('authorization_rejected', {
      tenantId,
      reason: auth.paused ? 'paused' : auth.status === 401 ? 'secret_mismatch' : 'allowlist',
    })
    if (auth.paused) {
      const body = auth.body as { message?: { chat?: { id: number } } }
      const chatId = body?.message?.chat?.id
      if (chatId) {
        await sendMessage(botToken, chatId, '⏸️ Bot pausado. Reative nas Configurações do NexusCRM.')
      }
    }
    return new Response('', { status: auth.status ?? 200 })
  }

  const body = auth.body as {
    message?: {
      chat?: { id: number }
      from?: { id: number }
      text?: string
      voice?: { file_id: string }
    }
  }

  const chatId = String(body?.message?.chat?.id ?? '')
  const fromId = String(body?.message?.from?.id ?? '')
  const rawText = (body?.message?.text ?? '').trim()
  const voiceFileId = body?.message?.voice?.file_id

  let text = rawText

  console.log('[webhook] message received', { tenantId, chatId, hasText: Boolean(rawText), hasVoice: Boolean(voiceFileId) })

  if (!rawText && voiceFileId) {
    console.log('[webhook] voice message detected, attempting transcription')
    if (configRow.llm_api_key && configRow.llm_provider === 'google') {
      const llmKey = await decrypt(configRow.llm_api_key, encryptionKey)
      let transcript: string | null = null
      try {
        transcript = await transcribeVoice(botToken, voiceFileId, llmKey)
      } catch (voiceErr) {
        traceTelegram('voice_transcription_failed', { tenantId, chatId, fromId, error: voiceErr })
        if (chatId) await sendMessage(botToken, chatId, '🎤 Não consegui transcrever o áudio. Tente novamente ou use texto.')
        return new Response('OK', { status: 200 })
      }
      if (transcript) {
        text = transcript
        await sendMessage(botToken, chatId, `🎤 Ouvi: "<i>${escapeHtml(transcript)}</i>"`)
      } else {
        if (chatId) await sendMessage(botToken, chatId, '🎤 Não consegui transcrever o áudio. Tente falar mais claramente ou use texto.')
        return new Response('OK', { status: 200 })
      }
    } else {
      if (chatId) await sendMessage(botToken, chatId, '🎤 Mensagens de voz requerem a API do Google Gemini. Configure nas Configurações do NexusCRM.')
      return new Response('OK', { status: 200 })
    }
  }

  if (!chatId || !text) return new Response('OK', { status: 200 })

  const { data: botCommands } = await sb
    .from('bot_commands')
    .select('trigger, type, actions, is_active')
    .eq('tenant_id', tenantId)
    .eq('bot_config_id', configRow.id)

  const activeCommands = (botCommands ?? []).filter((c: { is_active: boolean }) => c.is_active)
  const disabledBuiltins = (botCommands ?? []).filter(
    (c: { type: string; is_active: boolean }) => c.type === 'builtin' && !c.is_active
  )

  const matchedCustom = activeCommands.find(
    (c: { type: string; trigger: string }) =>
      c.type !== 'builtin' && (text === c.trigger || text.startsWith(c.trigger + ' '))
  )
  if (matchedCustom) {
    try {
      const actions = Array.isArray(matchedCustom.actions) ? matchedCustom.actions : []
      const result = await executeActions(sb, tenantId, chatId, actions)
      await sendMessage(botToken, chatId, result || '✅ Concluído.')
    } catch (err) {
      traceTelegram('command_failure', { tenantId, chatId, fromId, action: matchedCustom.trigger, error: err })
      await sendMessage(botToken, chatId, '⚠️ Erro ao executar comando. Tente novamente.')
    }
    return new Response('OK', { status: 200 })
  }

  for (const cmd of disabledBuiltins) {
    if (text === cmd.trigger || text.startsWith(cmd.trigger + ' ')) {
      return new Response('OK', { status: 200 })
    }
  }

  let responseText: string

  try {
    const upperText = text.toUpperCase()
    if (upperText === 'SIM' || upperText === 'NÃO' || upperText === 'NAO') {
      const pending = await getPendingConfirmation(sb, tenantId, chatId)
      if (pending) {
        await clearPendingConfirmation(sb, tenantId, chatId)
        if (upperText === 'SIM') {
          const p = pending.action_payload as { direction: 'in' | 'out'; description: string; amount: number }
          responseText = await recordTransaction(sb, tenantId, p.direction, p.description, p.amount)
        } else {
          traceTelegram('confirmation_cancelled', { tenantId, chatId, fromId, action: pending.action_type })
          responseText = '❌ Transação cancelada.'
        }
        await sendMessage(botToken, chatId, responseText)
        return new Response('OK', { status: 200 })
      }
      traceTelegram('stale_confirmation_attempt', { tenantId, chatId, fromId })
    }

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
        responseText = await createTask(sb, tenantId, params.title as string)
        break
      case 'tasks.list':
        responseText = await listTasks(sb, tenantId, chatId)
        break
      case 'tasks.complete':
        responseText = await completeTask(sb, tenantId, chatId, params.num as number)
        break
      case 'tasks.setPriority':
        responseText = await setPriority(sb, tenantId, chatId, params.num as number, params.priority as string)
        break
      case 'activities.log':
        responseText = await logActivity(sb, tenantId, params.type as string, params.text as string)
        break
      case 'activities.list':
        responseText = await listActivities(sb, tenantId)
        break
      case 'finance.record': {
        const amount = params.amount as number
        const threshold = configRow.confirmation_threshold as number ?? 500
        if (amount > threshold) {
          const dirLabel = params.direction === 'out' ? 'saída' : 'entrada'
          responseText = await requestConfirmation(
            sb,
            tenantId,
            chatId,
            'finance.record',
            params as Record<string, unknown>,
            `Confirmar ${dirLabel} de R$ ${amount.toFixed(2).replace('.', ',')} em "${escapeHtml(String(params.description ?? ''))}"?`
          )
        } else {
          responseText = await recordTransaction(
            sb,
            tenantId,
            params.direction as 'in' | 'out',
            params.description as string,
            amount
          )
        }
        break
      }
      case 'finance.balance':
        responseText = await getBalance(sb, tenantId)
        break
      case 'finance.list':
        responseText = await listTransactions(sb, tenantId)
        break
      case 'bot.start':
        const currentIds = config.allowed_telegram_ids ?? []
        if (!currentIds.includes(fromId)) {
          const newIds = [...currentIds, fromId]
          await sb
            .from('bot_configs')
            .update({ allowed_telegram_ids: newIds })
            .eq('tenant_id', tenantId)
            .eq('id', configRow.id)
          traceTelegram('telegram_user_authorized', { tenantId, chatId, fromId })
        }
        responseText = `👋 Olá! Sou o bot do NexusCRM.\nSeu ID Telegram é: <code>${fromId}</code>\n\n${HELP_TEXT}`
        break
      case 'bot.help':
        responseText = HELP_TEXT
        break
      case 'bot.status':
        responseText = '✅ Bot ativo e conectado ao NexusCRM.'
        break
      default:
        responseText = '🤔 Não entendi. Tente /ajuda.'
    }
  } catch (err) {
    traceTelegram('command_failure', { tenantId, chatId, fromId, error: err })
    responseText = '⚠️ Algo deu errado. Tente novamente em instantes.'
  }

  await sendMessage(botToken, chatId, responseText)
  return new Response('OK', { status: 200 })
})
