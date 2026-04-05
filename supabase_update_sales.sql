-- Create interaction_logs table
CREATE TABLE IF NOT EXISTS public.interaction_logs (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    client_id BIGINT REFERENCES public.clients(id) ON DELETE CASCADE,
    task_id BIGINT REFERENCES public.tasks(id) ON DELETE SET NULL,
    member_id BIGINT REFERENCES public.team(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('Ligação', 'Email', 'Reunião', 'WhatsApp', 'Outro')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.interaction_logs ENABLE ROW LEVEL SECURITY;

-- Restrict access to service_role only; frontend should go through trusted functions.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.interaction_logs;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.interaction_logs;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.interaction_logs;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.interaction_logs;
DROP POLICY IF EXISTS "service role full access" ON public.interaction_logs;

CREATE POLICY "service role full access"
  ON public.interaction_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
