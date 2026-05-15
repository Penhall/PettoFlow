# Adequação para Testes — Free Plan sem Stripe

Diretório: /root/PettoFlow

Objetivo: Novo tenant já nasce com plano "Free", BillingPage mostra status de testes em vez de Stripe.

## Contexto
- `create_tenant_with_owner` RPC cria tenant + membership, mas NÃO cria subscription
- Planos existem na tabela `public.plans` (inclusive 'free')
- `isStripeConfigured()` em `_shared/stripe.ts` retorna false se STRIPE_SECRET_KEY não setada
- BillingPage.jsx usa `stripeConfigured` do overview para decidir se mostra checkout buttons
- Admin-core já permite trocar plano manualmente com `updateTenantPlan` (provider='internal')

## 1. supabase/functions/tenant-core/index.ts — Auto-assinar Free ao criar tenant

No handler `POST /tenants` (linha ~187), APÓS criar o tenant e antes de criar settings, adicionar:

Buscar o plano Free:
```typescript
const { data: freePlan } = await serviceSb
  .from('plans')
  .select('id, slug')
  .eq('slug', 'free')
  .eq('active', true)
  .maybeSingle()

if (freePlan) {
  const { error: subError } = await serviceSb
    .from('subscriptions')
    .upsert({
      tenant_id: tenant.id,
      plan_id: freePlan.id,
      status: 'active',
      provider: 'internal',
    }, { onConflict: 'tenant_id' })

  if (subError) {
    console.error(`[tenant-core] Falha ao criar subscription Free para tenant ${tenant.id}:`, subError.message)
  }
}
```

Colocar entre a criação do tenant e a criação das settings (antes da linha 227 onde cria `defaultSettings`).

## 2. src/components/billing/BillingPage.jsx — Estado "Free Testing"

Modificar para detectar quando Stripe não está configurado e mostrar mensagem de testes.

Mudanças:

2.1. Importar `Shield` de lucide-react (já importa CreditCard, ExternalLink, RefreshCw — adicionar Shield na mesma linha)

2.2. No JSX, substituir a seção de planos (que mostra os botões de checkout) por um banner de "Período de testes" quando `!stripeConfigured`:

Após a seção de "Faturamento do espaço de trabalho" e ANTES do map de planos, adicionar:

```jsx
{!stripeConfigured && (
  <div style={{
    padding: 18,
    borderRadius: 16,
    border: '1px solid color-mix(in srgb, var(--success, #16a34a) 35%, transparent)',
    background: 'color-mix(in srgb, var(--success, #16a34a) 8%, transparent)',
    display: 'grid',
    gap: 12,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Shield size={20} color="var(--success, #16a34a)" />
      <strong style={{ fontSize: 15 }}>Período de testes — sem custo</strong>
    </div>
    <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
      O faturamento será ativado em breve. Durante os testes, todos os recursos estão disponíveis sem limitações.
      {subscription?.plan?.name ? ` Seu plano atual é ${subscription.plan.name}.` : ''}
    </p>
  </div>
)}
```

2.3. Quando `!stripeConfigured`, pular o map de planos (que mostra botões de checkout). Envolver o map existente em:

```jsx
{stripeConfigured && plans.length > 0 && (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
    {plans.map((plan) => ( ... ))}
  </div>
)}
```

2.4. O restante (informações de plano atual, capacidade, subscription details) continua aparecendo normalmente.

## Regras
- 2 espaços de indentação
- Não quebrar funcionalidades existentes
- Manter estilo consistente
