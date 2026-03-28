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
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'receivables' AND policyname = 'public access'
  ) THEN
    CREATE POLICY "public access" ON receivables FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

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
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'activity_templates' AND policyname = 'public access'
  ) THEN
    CREATE POLICY "public access" ON activity_templates FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 4. Task archiving + completion tracking
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- ============================================================
-- 2026-03-24 Calendar Integration Migration
-- Run in Supabase SQL editor
-- ============================================================

-- 1. tasks: add optional due_date (prazo de entrega)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ NULL;

-- 2. receivables: task_id becomes nullable (receivable can come from activity)
ALTER TABLE receivables ALTER COLUMN task_id DROP NOT NULL;

-- 3. receivables: add activity_id FK (UUID to match activities.id)
ALTER TABLE receivables ADD COLUMN IF NOT EXISTS activity_id UUID REFERENCES activities(id) NULL;

-- 4. receivables: add due_date for calendar display
ALTER TABLE receivables ADD COLUMN IF NOT EXISTS due_date DATE NULL;

-- 5. receivables: at least one source must be set
-- Note: ADD CONSTRAINT IF NOT EXISTS is not supported in PostgreSQL < 17
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'receivables_source_check'
  ) THEN
    ALTER TABLE receivables ADD CONSTRAINT receivables_source_check
      CHECK (task_id IS NOT NULL OR activity_id IS NOT NULL);
  END IF;
END $$;
