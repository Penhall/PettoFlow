-- Phase 35A: make Telegram operational state explicitly tenant-scoped.

alter table if exists public.bot_configs
  add column if not exists webhook_secret_sha256 text;

create unique index if not exists bot_configs_webhook_secret_sha256_uidx
  on public.bot_configs (webhook_secret_sha256)
  where webhook_secret_sha256 is not null;

create unique index if not exists bot_commands_tenant_config_trigger_uidx
  on public.bot_commands (tenant_id, bot_config_id, trigger);

do $$
begin
  if to_regclass('public.bot_pending_confirmations') is null then
    return;
  end if;

  alter table public.bot_pending_confirmations
    add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

  -- Existing pending rows were chat-scoped and cannot be proven tenant-safe.
  delete from public.bot_pending_confirmations
   where tenant_id is null;

  alter table public.bot_pending_confirmations
    alter column tenant_id set not null;

  create index if not exists bot_pending_confirmations_tenant_chat_idx
    on public.bot_pending_confirmations (tenant_id, chat_id);

  create unique index if not exists bot_pending_confirmations_tenant_chat_action_uidx
    on public.bot_pending_confirmations (tenant_id, chat_id, action_type);

  alter table public.bot_pending_confirmations enable row level security;

  drop policy if exists "service role full access" on public.bot_pending_confirmations;
  create policy "service role full access"
    on public.bot_pending_confirmations
    to service_role
    using (true)
    with check (true);
end $$;
