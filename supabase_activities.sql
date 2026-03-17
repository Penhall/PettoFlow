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

-- Create policies (public access, consistent with other tables)
CREATE POLICY "Enable read access for all users" ON public.activities FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.activities FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.activities FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.activities FOR DELETE USING (true);
