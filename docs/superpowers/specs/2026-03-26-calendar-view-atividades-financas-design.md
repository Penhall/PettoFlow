# Design: Visualização de Calendário para Atividades e Finanças

**Data:** 2026-03-26
**Branch:** feature/calendar-integration
**Status:** Aprovado

---

## Objetivo

Adicionar a visualização de Calendário (já implementada na área global e em Minhas Tarefas) às áreas de **Atividades** e **Finanças**, seguindo o mesmo padrão do tab "📅 Calendário" de Minhas Tarefas como referência.

---

## Contexto

### Padrão de referência (Minhas Tarefas)
O tab de Calendário em Minhas Tarefas usa:
```jsx
<CalendarView filterTypes={['task']} />
```
Sem props adicionais — comportamento padrão do `CalendarView` (clique em data vazia abre `ActivityForm`).

### Tipos de eventos por área

| Área | filterTypes | Cor dos eventos |
|------|------------|-----------------|
| Atividades | `['activity']` | Roxo `#8b5cf6` (campo `scheduled_at`) |
| Finanças | `['receivable', 'transaction']` | Amarelo `#f59e0b` (receivable `due_date`) + Verde `#10b981` / Vermelho `#ef4444` (transaction `date`) |

---

## Arquitetura

### Arquivos modificados (4 total, 0 novos)

| Arquivo | Mudança |
|---------|---------|
| `src/components/Calendar/CalendarView.jsx` | +2 props opcionais: `onEmptyDateClick`, `contextArea` |
| `src/components/Calendar/EventDetailPanel.jsx` | +1 prop `contextArea` + helper `isActionVisible` |
| `src/components/Activities/ActivitiesView.jsx` | +1 tab "📅 Calendário" |
| `src/components/Finance/FinanceView.jsx` | +1 tab "📅 Calendário" + estado `transactionFormDate` |

---

## Mudanças detalhadas

### 1. `CalendarView.jsx` — novos props opcionais

```jsx
// Props adicionados (ambos opcionais com fallback para comportamento atual):
// onEmptyDateClick?: (dateStr: string) => void
// contextArea?: 'global' | 'tarefas' | 'atividades' | 'financas'

const handleDateClick = (info) => {
  if (onEmptyDateClick) {
    onEmptyDateClick(info.dateStr);       // override do chamador
  } else {
    openActivityForm({ scheduled_at: info.dateStr });  // padrão preservado
  }
};

// Passar contextArea para o painel:
<EventDetailPanel contextArea={contextArea} ... />
```

**Compatibilidade:** Ambos os props são opcionais. Todo código existente que usa `CalendarView` continua funcionando sem mudanças.

### 2. `EventDetailPanel.jsx` — ações por contexto

Ações atuais por tipo de evento:

| Tipo | Ações |
|------|-------|
| `task` | Editar, Arquivar |
| `activity` | Editar, Marcar feito |
| `receivable` | Faturar, Follow-up, Criar Tarefa |
| `transaction` | Editar, Ver extrato |

As ações são botões JSX condicionais por `type` — não há string identifiers. A supressão usa o prop `contextArea` diretamente nos blocos de renderização.

Supressões por contexto (baseado na leitura do código atual):

**`contextArea="financas"`:**
- No bloco `receivable`: ocultar botão "Follow-up" (abre `ActivityForm` — contexto errado) e botão "Criar Tarefa" (ação de Tarefas)
- No bloco `transaction`: ocultar botão "Criar Tarefa" e botão "Criar Atividade" (ações de outros módulos)

**`contextArea="atividades"`:** nenhuma supressão — ações de `activity` (Editar, Criar Transação, Criar A Receber, Concluir) são todas relevantes no contexto de Atividades.

**`contextArea` ausente / `'global'` / `'tarefas'`:** sem mudança — todas as ações visíveis.

Implementação via prop inline:
```jsx
{/* No bloco receivable — exemplo */}
{contextArea !== 'financas' && (
  <button className="action-btn" onClick={...}>
    <Phone size={14} /> Follow-up
  </button>
)}
{contextArea !== 'financas' && (
  <button className="action-btn" onClick={...}>
    <Plus size={14} /> Criar Tarefa
  </button>
)}
```

### 3. `ActivitiesView.jsx` — novo tab

Estrutura de tabs: `Timeline | Modelos` → `Timeline | Modelos | 📅 Calendário`

```jsx
{activeTab === 'calendario' && (
  <CalendarView
    filterTypes={['activity']}
    contextArea="atividades"
    // onEmptyDateClick omitido → padrão abre ActivityForm com scheduled_at ✓
  />
)}
```

### 4. `FinanceView.jsx` — novo tab

Estrutura de tabs: `Extrato | Contas | Regras | A Receber` → `Extrato | Contas | Regras | A Receber | 📅 Calendário`

```jsx
// Novo estado local:
const [transactionFormDate, setTransactionFormDate] = useState(null);

{activeTab === 'calendario' && (
  <CalendarView
    filterTypes={['receivable', 'transaction']}
    contextArea="financas"
    onEmptyDateClick={(dateStr) => {
      setSelectedTransaction(null);
      setTransactionFormDate(dateStr);
      setShowTransactionForm(true);
    }}
  />
)}

// TransactionForm: passar transactionFormDate como prop de data inicial
// (verificar nome exato do prop durante implementação)
```

---

## Edge Cases

1. **`contextArea` ausente** → comportamento 100% preservado em todos os usos existentes
2. **`onEmptyDateClick` ausente** → fallback para `ActivityForm` (comportamento atual)
3. **`TransactionForm` sem prop de data** → se não existir `initialDate` ou equivalente, adicionar prop simples durante implementação
4. **`filterTypes={['receivable', 'transaction']}` sem dados** → `useCalendarEvents` já suporta arrays de tipos, sem mudança no hook

---

## Testes

1. **Unit: `isActionVisible`** — dado `contextArea='financas'`, confirmar que `'create-task'` e `'followup'` retornam `false`; dado `contextArea='atividades'` ou `undefined`, tudo retorna `true`
2. **Unit: `CalendarView` com `onEmptyDateClick`** — confirmar que o callback é chamado com o `dateStr` correto ao clicar em data vazia
3. **Smoke visual** — abrir novos tabs e verificar que eventos aparecem com cores corretas (roxo para atividades; amarelo, verde, vermelho para finanças)

---

## O que NÃO muda

- Sem mudanças no banco de dados
- Sem mudanças em hooks (`useCalendarEvents`, `useActivities`, `useTransactions`, `useReceivables`)
- Sem novos arquivos
- Tab global "📅 Calendário" inalterado
- Tab "📅 Calendário" em Minhas Tarefas inalterado
- `CalendarFilters.jsx` inalterado (os chips de filtro já respeitam `filterTypes`)
