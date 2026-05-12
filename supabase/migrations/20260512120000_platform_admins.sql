-- Migration: platform_admins
-- Cria a tabela de administradores da plataforma e as RPCs necessárias.

-- 1. Tabela de administradores
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'admin'
             CHECK (role IN ('admin', 'support', 'tester', 'agent')),
  label      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE  public.platform_admins IS 'Administradores/operadores da plataforma SaaS';
COMMENT ON COLUMN public.platform_admins.role IS 'admin=master, support=tickets, tester=QA, agent=automatizado';

-- 2. RLS
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admins_select" ON public.platform_admins
  FOR SELECT USING (
    auth.uid() = user_id OR public.is_current_user_platform_admin()
  );

CREATE POLICY "platform_admins_insert" ON public.platform_admins
  FOR INSERT WITH CHECK (public.is_current_user_platform_admin());

CREATE POLICY "platform_admins_delete" ON public.platform_admins
  FOR DELETE USING (public.is_current_user_platform_admin());

-- 3. RPC: verifica se o usuário atual é platform_admin
CREATE OR REPLACE FUNCTION public.is_current_user_platform_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()
  );
END;
$$;

-- 4. RPC: verifica se a tabela está vazia (para o auto-claim do master)
CREATE OR REPLACE FUNCTION public.is_platform_admins_table_empty()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT count(*) = 0 FROM public.platform_admins);
END;
$$;

COMMENT ON FUNCTION public.is_platform_admins_table_empty IS 'Usado pelo frontend para mostrar banner de claim do primeiro admin';
