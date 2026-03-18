-- src/supabase_migrations_2026.sql
-- Run this in Supabase SQL editor

-- 1. Receivables: tracks sales tasks awaiting payment
CREATE TABLE IF NOT EXISTS receivables (
  id                BIGSERIAL PRIMARY KEY,
  task_id           BIGINT REFERENCES tasks(id) ON DELETE CASCADE,
  amount            INTEGER NOT NULL,               -- in cents
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'invoiced')),
  target_account_id BIGINT REFERENCES accounts(id),
  transaction_id    BIGINT REFERENCES transactions(id),
  invoiced_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE receivables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access" ON receivables FOR ALL USING (true) WITH CHECK (true);

-- 2. Account categories
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'extras';

-- 3. Activity templates
CREATE TABLE IF NOT EXISTS activity_templates (
  id                   BIGSERIAL PRIMARY KEY,
  name                 TEXT NOT NULL,
  type                 TEXT,
  default_notes        TEXT,
  default_assigned_to  TEXT,
  tags                 TEXT[] DEFAULT '{}',
  created_at           TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE activity_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access" ON activity_templates FOR ALL USING (true) WITH CHECK (true);

-- 4. Task archiving + completion tracking
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
