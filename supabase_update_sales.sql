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

-- Create policies (assuming public access for now as per previous tables)
CREATE POLICY "Enable read access for all users" ON public.interaction_logs FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.interaction_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.interaction_logs FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.interaction_logs FOR DELETE USING (true);
