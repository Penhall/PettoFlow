# UI Skills Installation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Instalar três skills UI/UX no Claude Code local via git clone e criar `.impeccable.md` com Design Brief do PettoFlow.

**Architecture:** Clone direto dos repos GitHub originais em `~/.claude/skills/`, substituindo versões existentes onde necessário. Nenhuma dependência de npm/npx — apenas git e criação de arquivo.

**Tech Stack:** Git, Bash, React 18 + Vite + CSS custom properties (para contexto do Design Brief)

---

### Task 1: Instalar `impeccable` (pbakaus/impeccable)

**Files:**
- Remove: `~/.claude/skills/impeccable/` (versão atual)
- Create: `~/.claude/skills/impeccable/` (clone do repo original)

- [ ] **Step 1: Remover versão atual**

```bash
rm -rf ~/.claude/skills/impeccable
```

Expected: sem output (sucesso silencioso)

- [ ] **Step 2: Clonar repo original**

```bash
git clone https://github.com/pbakaus/impeccable ~/.claude/skills/impeccable
```

Expected: output do git clone terminando com `done.`

- [ ] **Step 3: Verificar instalação**

```bash
ls ~/.claude/skills/impeccable/
```

Expected: arquivos do repo presentes (ex: `SKILL.md` ou `README.md`)

- [ ] **Step 4: Commit do design doc**

```bash
cd E:/PROJETOS/PettoFlow
git add docs/superpowers/
git commit -m "docs: add UI skills installation spec and plan"
```

---

### Task 2: Instalar `taste-skill` (Leonxlnx/taste-skill)

**Files:**
- Create: `~/.claude/skills/taste-skill/` (novo, não existia)

- [ ] **Step 1: Clonar repo**

```bash
git clone https://github.com/Leonxlnx/taste-skill ~/.claude/skills/taste-skill
```

Expected: output do git clone terminando com `done.`

- [ ] **Step 2: Verificar instalação**

```bash
ls ~/.claude/skills/taste-skill/
```

Expected: arquivos do repo presentes

- [ ] **Step 3: Confirmar que skills existentes não foram afetadas**

```bash
ls ~/.claude/skills/ | grep taste
```

Expected: listar `taste-skill`, `design-taste-frontend`, `gpt-taste`, `stitch-design-taste` — todos presentes

---

### Task 3: Instalar `emilkowalski/skill`

**Files:**
- Create: `~/.claude/skills/emilkowalski-skill/` (coexiste com `emil-design-eng` atual)

- [ ] **Step 1: Clonar repo**

```bash
git clone https://github.com/emilkowalski/skill ~/.claude/skills/emilkowalski-skill
```

Expected: output do git clone terminando com `done.`

- [ ] **Step 2: Verificar instalação**

```bash
ls ~/.claude/skills/emilkowalski-skill/
```

Expected: arquivos do repo presentes

- [ ] **Step 3: Confirmar coexistência com emil-design-eng**

```bash
ls ~/.claude/skills/ | grep emil
```

Expected: `emil-design-eng` e `emilkowalski-skill` — ambos presentes

---

### Task 4: Criar `.impeccable.md` no PettoFlow

**Files:**
- Create: `E:/PROJETOS/PettoFlow/.impeccable.md`

- [ ] **Step 1: Criar arquivo com Design Brief completo**

```markdown
# PettoFlow — Design Brief (Impeccable)

## Stack Frontend
- React 18 + Vite, JSX puro (sem TypeScript)
- Inline styles + CSS custom properties para theming dinâmico
- Sem Tailwind, sem CSS Modules, sem shadcn/ui, sem bibliotecas de componente externas
- UI inteiramente em PT-BR
- Framer Motion para animações (sutis, proporcionais)

## Design Tokens (CSS Custom Properties)

### Tema Padrão: Architectural Ledger
```css
--bg-main: #F4F4F0        /* Parchment */
--bg-sidebar: #F9F9F8
--text-main: #111110       /* Ink Black */
--text-secondary: #6B6B65
--card-bg: #FFFFFF
--border-color: #111110    /* 1px solid black — regra global */
--primary: #111110
--primary-light: #E5E5E0
--success: #05CD99
--warning: #FFB547
--danger: #D9381E          /* Terracotta Red */
--font-sans: 'Space Grotesk', sans-serif
--font-serif: 'Instrument Serif', serif
--radius-*: 0px            /* Sem arredondamento — intencional */
--shadow-lg: 12px 12px 0px 0px var(--text-main)  /* Hard shadow */
--shadow-hover: 4px 4px 0px 0px var(--text-main)
```

## Design Direction
- **Personalidade:** Limpo, profissional, calmo, moderno, funcional
- **Público-alvo:** Autônomos e pequenas equipes (gestão de negócios)
- **Estética:** Arquitetural, editorial — contraste alto, bordas nítidas, tipografia clara
- **Movimento:** Sutil e proposital — sem animações decorativas
- **Densidade:** Média-alta — muita informação visível sem parecer sobrecarregado

## Componentes Existentes
- Kanban board com drag-and-drop (@dnd-kit)
- Calendário mensal/semanal/lista (FullCalendar)
- Editor rich text (Tiptap)
- Sidebar de navegação colapsável
- Telegram bot admin panel

## Regras Invioláveis
1. Usar sempre CSS custom properties existentes — criar novo token só se necessário e documentar
2. Inline styles para variações de componente, não classes CSS globais novas
3. Manter toda UI em PT-BR — labels, placeholders, erros, tooltips
4. border-radius: 0 no tema padrão — é intencional, não "corrigir"
5. Hard shadows (offset sólido) ao invés de box-shadow difuso
6. Hierarquia via peso tipográfico e espaçamento — não via cor de fundo
```

- [ ] **Step 2: Verificar que o arquivo foi criado**

```bash
head -5 E:/PROJETOS/PettoFlow/.impeccable.md
```

Expected: primeiras linhas do Design Brief visíveis

- [ ] **Step 3: Commit**

```bash
cd E:/PROJETOS/PettoFlow
git add .impeccable.md
git commit -m "docs: add impeccable design brief for PettoFlow"
```

---

### Task 5: Verificação Final

- [ ] **Step 1: Listar todas as skills instaladas**

```bash
ls ~/.claude/skills/
```

Expected: incluir `impeccable`, `taste-skill`, `emilkowalski-skill` entre as listadas

- [ ] **Step 2: Verificar que nenhuma skill existente foi removida acidentalmente**

```bash
ls ~/.claude/skills/ | sort
```

Expected: lista completa incluindo `adapt`, `animate`, `audit`, `bolder`, `clarify`, `colorize`, `critique`, `delight`, `design-taste-frontend`, `distill`, `emil-design-eng`, `emilkowalski-skill`, `full-output-enforcement`, `gpt-taste`, `high-end-visual-design`, `impeccable`, `layout`, `napkin`, `optimize`, `overdrive`, `polish`, `quieter`, `redesign-existing-projects`, `shape`, `stitch-design-taste`, `taste-skill`, `typeset`

- [ ] **Step 3: Reiniciar Claude Code para reconhecer as novas skills**

Feche e reabra o Claude Code (ou inicie nova sessão). Na próxima sessão, `taste-skill` e `emilkowalski-skill` devem aparecer na lista de skills disponíveis.
