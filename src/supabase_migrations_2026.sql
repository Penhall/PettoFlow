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
  DROP POLICY IF EXISTS "public access" ON receivables;
  DROP POLICY IF EXISTS "service role full access" ON receivables;
  CREATE POLICY "service role full access"
    ON receivables
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
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
  DROP POLICY IF EXISTS "public access" ON activity_templates;
  DROP POLICY IF EXISTS "service role full access" ON activity_templates;
  CREATE POLICY "service role full access"
    ON activity_templates
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
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

-- 3. receivables: add activity_id FK aligned to the real type of activities.id
DO $$
DECLARE
  activities_id_type TEXT;
  activity_id_type TEXT;
  has_non_null_values BOOLEAN;
  fk_name TEXT;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
    INTO activities_id_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname = 'activities'
     AND a.attname = 'id'
     AND a.attnum > 0
     AND NOT a.attisdropped;

  IF activities_id_type IS NULL THEN
    RAISE EXCEPTION 'public.activities.id not found';
  END IF;

  SELECT format_type(a.atttypid, a.atttypmod)
    INTO activity_id_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname = 'receivables'
     AND a.attname = 'activity_id'
     AND a.attnum > 0
     AND NOT a.attisdropped;

  IF activity_id_type IS NULL THEN
    EXECUTE format(
      'ALTER TABLE receivables ADD COLUMN activity_id %s REFERENCES activities(id) NULL',
      activities_id_type
    );
  ELSIF activity_id_type <> activities_id_type THEN
    SELECT EXISTS (SELECT 1 FROM public.receivables WHERE activity_id IS NOT NULL)
      INTO has_non_null_values;

    IF has_non_null_values THEN
      RAISE EXCEPTION 'receivables.activity_id has existing values with type %, expected %; migrate data manually before converting',
        activity_id_type,
        activities_id_type;
    END IF;

    FOR fk_name IN
      SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
       WHERE tc.table_schema = 'public'
         AND tc.table_name = 'receivables'
         AND tc.constraint_type = 'FOREIGN KEY'
         AND kcu.column_name = 'activity_id'
    LOOP
      EXECUTE format('ALTER TABLE public.receivables DROP CONSTRAINT %I', fk_name);
    END LOOP;

    ALTER TABLE receivables DROP COLUMN activity_id;
    EXECUTE format(
      'ALTER TABLE receivables ADD COLUMN activity_id %s REFERENCES activities(id) NULL',
      activities_id_type
    );
  END IF;
END $$;

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
