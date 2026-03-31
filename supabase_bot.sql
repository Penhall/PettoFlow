-- supabase_bot.sql
-- Execute no Supabase Dashboard → SQL Editor

-- Tabela de configuração do bot (single-row para v1)
CREATE TABLE IF NOT EXISTS bot_configs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_bot_token     TEXT NOT NULL,
  webhook_secret         TEXT NOT NULL,
  allowed_telegram_ids   TEXT[] DEFAULT '{}',
  is_active              BOOLEAN DEFAULT true,
  confirmation_threshold NUMERIC DEFAULT 500.00,
  llm_api_key            TEXT,
  llm_provider           TEXT DEFAULT 'anthropic',
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);

-- Tabela de confirmações pendentes (transações grandes + contexto de listagem)
CREATE TABLE IF NOT EXISTS bot_pending_confirmations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id        TEXT NOT NULL,
  action_type    TEXT NOT NULL,
  action_payload JSONB NOT NULL,
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Index para busca rápida por chat_id
CREATE INDEX IF NOT EXISTS idx_bot_pending_chat_id ON bot_pending_confirmations(chat_id);

-- RLS: apenas service_role acessa (Edge Functions usam service_role key)
ALTER TABLE bot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_pending_confirmations ENABLE ROW LEVEL SECURITY;

-- Sem políticas públicas — acesso apenas via service_role (Edge Functions)
-- O Settings page acessa via bot-config Edge Function, não diretamente.
