// supabase/functions/telegram-webhook/middleware/auth.test.ts
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { validateRequest } from './auth.ts'

const MOCK_CONFIG = {
  webhook_secret: 'test-secret',
  allowed_telegram_ids: ['123456'],
  is_active: true,
}

Deno.test('rejects request with wrong secret', async () => {
  const req = new Request('http://localhost', {
    method: 'POST',
    headers: { 'x-telegram-bot-api-secret-token': 'wrong' },
    body: JSON.stringify({ message: { from: { id: 123456 }, text: '/ajuda' } }),
  })
  const result = await validateRequest(req, MOCK_CONFIG)
  assertEquals(result.valid, false)
  assertEquals(result.status, 401)
})

Deno.test('rejects unauthorized telegram user', async () => {
  const req = new Request('http://localhost', {
    method: 'POST',
    headers: { 'x-telegram-bot-api-secret-token': 'test-secret' },
    body: JSON.stringify({ message: { from: { id: 999999 }, text: '/ajuda' } }),
  })
  const result = await validateRequest(req, MOCK_CONFIG)
  assertEquals(result.valid, false)
  assertEquals(result.status, 200) // silêncio para não revelar o bot
})

Deno.test('rejects when bot is paused', async () => {
  const pausedConfig = { ...MOCK_CONFIG, is_active: false }
  const req = new Request('http://localhost', {
    method: 'POST',
    headers: { 'x-telegram-bot-api-secret-token': 'test-secret' },
    body: JSON.stringify({ message: { from: { id: 123456 }, text: '/ajuda' } }),
  })
  const result = await validateRequest(req, pausedConfig)
  assertEquals(result.valid, false)
  assertEquals(result.paused, true)
})

Deno.test('accepts valid request', async () => {
  const req = new Request('http://localhost', {
    method: 'POST',
    headers: { 'x-telegram-bot-api-secret-token': 'test-secret' },
    body: JSON.stringify({ message: { from: { id: 123456 }, chat: { id: 123456 }, text: '/ajuda' } }),
  })
  const result = await validateRequest(req, MOCK_CONFIG)
  assertEquals(result.valid, true)
})
