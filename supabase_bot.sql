-- supabase_bot.sql
-- Execute no Supabase Dashboard → SQL Editor

-- Tabela de configuração do bot (single-row para v1)
CREATE TABLE IF NOT EXISTS public.bot_configs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_bot_token     TEXT NOT NULL,
  webhook_secret         TEXT NOT NULL,
  allowed_telegram_ids   TEXT[] DEFAULT '{}',
  is_active              BOOLEAN DEFAULT true,
  confirmation_threshold NUMERIC(10,2) DEFAULT 500.00,
  llm_api_key            TEXT,
  llm_provider           TEXT DEFAULT 'anthropic',
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);

-- Colunas criptografadas com AES-256-GCM via crypto.ts — nunca armazenar em plaintext
COMMENT ON COLUMN public.bot_configs.telegram_bot_token IS 'AES-256-GCM encrypted — use crypto.ts encrypt/decrypt; never store plaintext';
COMMENT ON COLUMN public.bot_configs.webhook_secret      IS 'AES-256-GCM encrypted — use crypto.ts encrypt/decrypt; never store plaintext';
COMMENT ON COLUMN public.bot_configs.llm_api_key         IS 'AES-256-GCM encrypted — use crypto.ts encrypt/decrypt; never store plaintext';

-- Garante single-row: apenas uma configuração de bot por vez (v1)
CREATE UNIQUE INDEX IF NOT EXISTS bot_configs_single_row ON public.bot_configs ((true));

-- Auto-atualiza updated_at em qualquer UPDATE
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bot_configs_updated_at ON public.bot_configs;
CREATE TRIGGER bot_configs_updated_at
  BEFORE UPDATE ON public.bot_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Tabela de confirmações pendentes (transações grandes + contexto de listagem)
CREATE TABLE IF NOT EXISTS public.bot_pending_confirmations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id        TEXT NOT NULL,
  action_type    TEXT NOT NULL,
  action_payload JSONB NOT NULL,
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Index para busca rápida por chat_id (apenas linhas não expiradas)
CREATE INDEX IF NOT EXISTS idx_bot_pending_chat_id ON public.bot_pending_confirmations(chat_id);
CREATE INDEX IF NOT EXISTS idx_bot_pending_active ON public.bot_pending_confirmations(chat_id)
  WHERE expires_at > now();

-- Index para cleanup de linhas expiradas
CREATE INDEX IF NOT EXISTS idx_bot_pending_expires ON public.bot_pending_confirmations(expires_at);

-- RLS: apenas service_role acessa (Edge Functions usam service_role key)
ALTER TABLE public.bot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_pending_confirmations ENABLE ROW LEVEL SECURITY;

-- Sem políticas públicas — acesso apenas via service_role (Edge Functions)
-- IMPORTANTE: A Edge Function deve deletar linhas expiradas no início de cada request
-- usando: DELETE FROM bot_pending_confirmations WHERE expires_at < now()
