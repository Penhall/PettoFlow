import { getServiceRoleClient } from './supabase.ts'

export const CURRENT_ONBOARDING_VERSION = '2026.05'
export const DEFAULT_INITIALIZATION_MODE = 'guided_seeded'

type SupabaseClient = ReturnType<typeof getServiceRoleClient>

type EnsureOnboardingStateInput = {
  sb?: SupabaseClient
  tenantId: string
  userId: string
}

type OnboardingEventInput = {
  sb?: SupabaseClient
  tenantId: string
  userId?: string | null
  eventName: string
  eventPayload?: Record<string, unknown>
}

type SeedTenantOnboardingDataInput = {
  sb?: SupabaseClient
  tenantId: string
  userId: string
  tenantName: string
  seedBatchId: string
}

function getClient(sb?: SupabaseClient) {
  return sb ?? getServiceRoleClient()
}

function buildDefaultTourState() {
  return {
    status: 'not_started',
    last_step: null,
  }
}

function buildDefaultChecklistState() {
  return {
    initialization_mode: DEFAULT_INITIALIZATION_MODE,
    items: {},
  }
}

function buildDefaultTutorialState() {
  return {
    opened: [],
    completed: [],
  }
}

async function hasSeedRows(client: SupabaseClient, tenantId: string, tableName: string) {
  const { count, error } = await client
    .from(tableName)
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('origin_type', 'onboarding_seed')

  if (error) throw error
  return (count ?? 0) > 0
}

export function buildSeedMetadata(originType: string, seedBatchId: string) {
  return {
    origin_type: originType,
    origin_version: CURRENT_ONBOARDING_VERSION,
    seed_batch_id: seedBatchId,
    created_by_system: true,
  }
}

export async function ensureTenantOnboardingState({
  sb,
  tenantId,
  userId,
}: EnsureOnboardingStateInput) {
  const client = getClient(sb)
  const payload = {
    tenant_id: tenantId,
    user_id: userId,
    current_onboarding_version: CURRENT_ONBOARDING_VERSION,
    completed_onboarding_version: null,
    last_seen_onboarding_version: CURRENT_ONBOARDING_VERSION,
    experience_level: 'new',
    tour_state: buildDefaultTourState(),
    checklist_state: buildDefaultChecklistState(),
    tutorial_state: buildDefaultTutorialState(),
    dismiss_state: {},
  }

  const { data, error } = await client
    .from('tenant_onboarding_state')
    .upsert([payload], { onConflict: 'tenant_id,user_id' })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function recordOnboardingEvent({
  sb,
  tenantId,
  userId = null,
  eventName,
  eventPayload = {},
}: OnboardingEventInput) {
  const client = getClient(sb)
  const { data, error } = await client
    .from('tenant_onboarding_events')
    .insert([{
      tenant_id: tenantId,
      user_id: userId,
      event_name: eventName,
      event_payload: eventPayload,
    }])
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function seedTenantOnboardingData({
  sb,
  tenantId,
  userId,
  tenantName,
  seedBatchId,
}: SeedTenantOnboardingDataInput) {
  const client = getClient(sb)

  const { data: existingSeed, error: existingSeedError } = await client
    .from('tenant_settings')
    .select('id, value')
    .eq('tenant_id', tenantId)
    .eq('key', 'onboarding_seed_profile')
    .maybeSingle()

  if (existingSeedError) throw existingSeedError
  if (existingSeed) {
    return {
      status: 'already_seeded',
      seedProfile: existingSeed.value,
    }
  }

  const now = new Date()
  const dueSoon = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString()
  const dueLater = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString()
  const scheduledAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
  const ownerLabel = 'Equipe PettoFlow'
  const seedOrigin = buildSeedMetadata('onboarding_seed', seedBatchId)

  if (!(await hasSeedRows(client, tenantId, 'kanban_columns'))) {
    const { error } = await client
      .from('kanban_columns')
      .upsert([
        { tenant_id: tenantId, name: 'A Fazer', order_index: 1, ...seedOrigin },
        { tenant_id: tenantId, name: 'Em Progresso', order_index: 2, ...seedOrigin },
        { tenant_id: tenantId, name: 'Concluido', order_index: 3, ...seedOrigin },
      ], { onConflict: 'tenant_id,name' })

    if (error) throw error
  }

  if (!(await hasSeedRows(client, tenantId, 'clients'))) {
    const { error } = await client
      .from('clients')
      .insert([
        {
          tenant_id: tenantId,
          name: 'PettoFlow SaaS',
          industry: 'Software',
          projects: 1,
          revenue: 'Assinatura ativa',
          status: 'Ativo',
          email: 'sucesso@pettoflow.test',
          phone: '(11) 4000-2026',
          company_size: 'Equipe dedicada',
          ...seedOrigin,
        },
        {
          tenant_id: tenantId,
          name: 'Gerencia de Conta PettoFlow',
          industry: 'Sucesso do cliente',
          projects: 1,
          revenue: 'Acompanhamento inicial',
          status: 'Ativo',
          email: 'gerente.conta@pettoflow.test',
          phone: '(11) 4000-2027',
          company_size: 'Contato de apoio',
          ...seedOrigin,
        },
        {
          tenant_id: tenantId,
          name: 'Equipe de Ajuda PettoFlow',
          industry: 'Suporte',
          projects: 1,
          revenue: 'Base de apoio',
          status: 'Ativo',
          email: 'ajuda@pettoflow.test',
          phone: '(11) 4000-2028',
          company_size: 'Canal de atendimento',
          ...seedOrigin,
        },
      ])

    if (error) throw error
  }

  const { data: seededClients, error: seededClientsError } = await client
    .from('clients')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('origin_type', 'onboarding_seed')
    .order('id', { ascending: true })

  if (seededClientsError) throw seededClientsError

  const primaryClient = seededClients?.[0] ?? null
  const supportClient = seededClients?.[2] ?? null

  if (!(await hasSeedRows(client, tenantId, 'tasks'))) {
    const { error } = await client
      .from('tasks')
      .insert([
        {
          tenant_id: tenantId,
          title: 'Revisar o espaco de trabalho',
          status: 'A Fazer',
          priority: 'Alta',
          owner: ownerLabel,
          progress: 0,
          client_id: primaryClient?.id ?? null,
          category: 'Operacional',
          due_date: dueSoon,
          created_at: now.toISOString(),
          deal_value: 0,
          tags: ['Onboarding'],
          ...seedOrigin,
        },
        {
          tenant_id: tenantId,
          title: 'Cadastrar o primeiro cliente real',
          status: 'A Fazer',
          priority: 'Alta',
          owner: ownerLabel,
          progress: 0,
          client_id: supportClient?.id ?? null,
          category: 'Operacional',
          due_date: dueLater,
          created_at: now.toISOString(),
          deal_value: 0,
          tags: ['Ativacao'],
          ...seedOrigin,
        },
        {
          tenant_id: tenantId,
          title: 'Abrir a central de tutoriais',
          status: 'Em Progresso',
          priority: 'Media',
          owner: ownerLabel,
          progress: 35,
          client_id: primaryClient?.id ?? null,
          category: 'Operacional',
          due_date: dueLater,
          created_at: now.toISOString(),
          deal_value: 0,
          tags: ['Ajuda'],
          ...seedOrigin,
        },
      ])

    if (error) throw error
  }

  if (!(await hasSeedRows(client, tenantId, 'accounts'))) {
    const { error } = await client
      .from('accounts')
      .insert([{
        tenant_id: tenantId,
        name: 'Conta Principal',
        type: 'checking',
        category: 'principal',
        opening_balance: 0,
        is_active: true,
        ...seedOrigin,
      }])

    if (error) throw error
  }

  const { data: seededAccounts, error: seededAccountsError } = await client
    .from('accounts')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('origin_type', 'onboarding_seed')
    .order('id', { ascending: true })

  if (seededAccountsError) throw seededAccountsError

  const principalAccount = seededAccounts?.[0] ?? null

  if (!(await hasSeedRows(client, tenantId, 'activities'))) {
    const { error } = await client
      .from('activities')
      .insert([{
        tenant_id: tenantId,
        title: 'Boas-vindas ao onboarding do PettoFlow',
        type: 'note',
        status: 'pending',
        created_by: ownerLabel,
        scheduled_at: scheduledAt,
        related_to: primaryClient
          ? [{ type: 'client', id: primaryClient.id, label: primaryClient.name }]
          : [],
        ...seedOrigin,
      }])

    if (error) throw error
  }

  if (!(await hasSeedRows(client, tenantId, 'transactions'))) {
    const { error } = await client
      .from('transactions')
      .insert([{
        tenant_id: tenantId,
        account_id: principalAccount?.id ?? null,
        amount: -9900,
        date: now.toISOString().slice(0, 10),
        notes: 'Assinatura recorrente do PettoFlow',
        cleared: false,
        needs_review: false,
        related_to: primaryClient
          ? [{ type: 'client', id: primaryClient.id, label: primaryClient.name }]
          : [],
        ...seedOrigin,
      }])

    if (error) throw error
  }

  const seedProfile = {
    mode: DEFAULT_INITIALIZATION_MODE,
    current_onboarding_version: CURRENT_ONBOARDING_VERSION,
    seed_batch_id: seedBatchId,
    seeded_at: now.toISOString(),
    created_by_system: true,
    created_by_user_id: userId,
    tenant_name: tenantName,
    counts: {
      columns: 3,
      clients: 3,
      tasks: 3,
      accounts: 1,
      activities: 1,
      transactions: 1,
    },
  }

  const { error: profileError } = await client
    .from('tenant_settings')
    .upsert([{
      tenant_id: tenantId,
      key: 'onboarding_seed_profile',
      value: seedProfile,
    }], { onConflict: 'tenant_id,key' })

  if (profileError) throw profileError

  return {
    status: 'seeded',
    seedProfile,
  }
}
