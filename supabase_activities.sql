-- Create activities table
CREATE TABLE IF NOT EXISTS public.activities (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('meeting', 'call', 'email', 'whatsapp', 'note', 'task')),
    body JSONB,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    created_by TEXT,
    related_to JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Restrict access to service_role only; frontend should go through trusted functions.
DO $$
BEGIN
  DROP POLICY IF EXISTS "Enable read access for all users" ON public.activities;
  DROP POLICY IF EXISTS "Enable insert access for all users" ON public.activities;
  DROP POLICY IF EXISTS "Enable update access for all users" ON public.activities;
  DROP POLICY IF EXISTS "Enable delete access for all users" ON public.activities;
  DROP POLICY IF EXISTS "service role full access" ON public.activities;

  CREATE POLICY "service role full access"
    ON public.activities
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
END $$;
