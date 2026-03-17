-- =============================================================================
-- PettoFlow — Módulo Financeiro
-- Executar no Supabase SQL Editor
-- =============================================================================

-- 1. TABELAS

CREATE TABLE public.accounts (
  id              BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('checking','savings','credit','cash')),
  opening_balance INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.payees (
  id                BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name              TEXT NOT NULL,
  learn_categories  BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.category_groups (
  id         BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name       TEXT NOT NULL,
  is_income  BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE public.fin_categories (
  id         BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name       TEXT NOT NULL,
  group_id   BIGINT REFERENCES public.category_groups(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  hidden     BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE public.transactions (
  id           BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  account_id   BIGINT NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  amount       INTEGER NOT NULL,
  date         DATE NOT NULL,
  payee_id     BIGINT REFERENCES public.payees(id) ON DELETE SET NULL,
  category_id  BIGINT REFERENCES public.fin_categories(id) ON DELETE SET NULL,
  notes        TEXT,
  related_to   JSONB NOT NULL DEFAULT '[]',
  cleared      BOOLEAN NOT NULL DEFAULT false,
  needs_review BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.fin_rules (
  id          BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name        TEXT NOT NULL,
  conditions  JSONB NOT NULL DEFAULT '[]',
  actions     JSONB NOT NULL DEFAULT '[]',
  priority    INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ÍNDICES

CREATE INDEX idx_transactions_account_date ON public.transactions (account_id, date DESC);
CREATE INDEX idx_transactions_category     ON public.transactions (category_id);
CREATE INDEX idx_transactions_needs_review ON public.transactions (needs_review) WHERE needs_review = true;
CREATE INDEX idx_transactions_related_to   ON public.transactions USING GIN (related_to);

-- 3. RLS

ALTER TABLE public.accounts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_rules       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public accounts"        ON public.accounts        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public payees"          ON public.payees          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public category_groups" ON public.category_groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public fin_categories"  ON public.fin_categories  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public transactions"    ON public.transactions    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public fin_rules"       ON public.fin_rules       FOR ALL USING (true) WITH CHECK (true);

-- 4. SEED DATA

INSERT INTO public.category_groups (name, is_income, sort_order) VALUES
  ('Moradia',     false, 1),
  ('Alimentação', false, 2),
  ('Transporte',  false, 3),
  ('Saúde',       false, 4),
  ('Lazer',       false, 5),
  ('Receitas',    true,  6);

INSERT INTO public.fin_categories (name, group_id, sort_order)
SELECT 'Aluguel',           id, 1 FROM public.category_groups WHERE name = 'Moradia'    UNION ALL
SELECT 'Condomínio',        id, 2 FROM public.category_groups WHERE name = 'Moradia'    UNION ALL
SELECT 'Supermercado',      id, 1 FROM public.category_groups WHERE name = 'Alimentação' UNION ALL
SELECT 'Restaurante',       id, 2 FROM public.category_groups WHERE name = 'Alimentação' UNION ALL
SELECT 'Combustível',       id, 1 FROM public.category_groups WHERE name = 'Transporte'  UNION ALL
SELECT 'Transporte Público',id, 2 FROM public.category_groups WHERE name = 'Transporte'  UNION ALL
SELECT 'Consulta',          id, 1 FROM public.category_groups WHERE name = 'Saúde'       UNION ALL
SELECT 'Farmácia',          id, 2 FROM public.category_groups WHERE name = 'Saúde'       UNION ALL
SELECT 'Salário',           id, 1 FROM public.category_groups WHERE name = 'Receitas'    UNION ALL
SELECT 'Serviços',          id, 2 FROM public.category_groups WHERE name = 'Receitas';
