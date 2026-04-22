# Design: Instalação de Skills UI/UX no PettoFlow

**Data:** 2026-04-20  
**Branch:** feat/telegram-bot  
**Status:** Aprovado

---

## Objetivo

Instalar três skills de UI/UX no Claude Code local (`~/.claude/skills/`) a partir dos repos GitHub originais, garantindo as versões dos autores especificados. Criar `.impeccable.md` no PettoFlow com Design Brief completo para guiar futuras iterações de UI.

---

## Skills a Instalar

| Skill | Repo | Destino |
|---|---|---|
| Impeccable | `pbakaus/impeccable` | `~/.claude/skills/impeccable` (substituir) |
| Taste-Skill | `Leonxlnx/taste-skill` | `~/.claude/skills/taste-skill` (novo) |
| Emil Kowalski | `emilkowalski/skill` | `~/.claude/skills/emilkowalski-skill` (coexiste com `emil-design-eng`) |

---

## Método de Instalação

**Opção escolhida: Clone manual via `git clone`**

- 100% silencioso, sem prompts ou confirmações
- Skills versionadas como repos git (atualizáveis com `git pull`)
- Substituição das versões existentes de `impeccable` pelo repo original do autor
- `emilkowalski/skill` instalado como `emilkowalski-skill` para coexistir com `emil-design-eng` atual

```bash
rm -rf ~/.claude/skills/impeccable
git clone https://github.com/pbakaus/impeccable ~/.claude/skills/impeccable

git clone https://github.com/Leonxlnx/taste-skill ~/.claude/skills/taste-skill

git clone https://github.com/emilkowalski/skill ~/.claude/skills/emilkowalski-skill
```

---

## Design Brief — PettoFlow (`.impeccable.md`)

### Stack Frontend
- React 18 + Vite, JSX puro (sem TypeScript)
- Inline styles + CSS custom properties para theming
- Sem Tailwind, sem CSS Modules, sem shadcn/ui
- UI inteiramente em PT-BR
- Framer Motion para animações

### Tokens de Design Existentes
```css
/* Tema padrão: Architectural Ledger */
--bg-main: #F4F4F0        /* Parchment */
--bg-sidebar: #F9F9F8
--text-main: #111110       /* Ink Black */
--text-secondary: #6B6B65
--card-bg: #FFFFFF
--border-color: #111110    /* 1px solid black */
--primary: #111110
--primary-light: #E5E5E0
--success: #05CD99
--warning: #FFB547
--danger: #D9381E          /* Terracotta Red */
--font-sans: 'Space Grotesk', sans-serif
--font-serif: 'Instrument Serif', serif
--radius-*: 0px            /* Sem arredondamento */
--shadow-lg: 12px 12px 0px 0px var(--text-main)  /* Hard shadow */
```

### Componentes Existentes
- Kanban board com drag-and-drop (`@dnd-kit`)
- Calendário mensal/semanal/lista (`FullCalendar`)
- Editor rich text (`Tiptap`)
- Sidebar de navegação
- Telegram bot admin panel

### Design Direction
- **Personalidade:** Limpo, profissional, calmo, moderno, funcional
- **Público:** Autônomos e pequenas equipes (gestão de negócios)
- **Estética:** Arquitetural, editorial — contraste alto com bordas nítidas, tipografia clara
- **Movimento:** Sutil, proposital — sem animações decorativas
- **Densidade:** Média-alta — muita informação visível sem parecer sobrecarregado

### Restrições Obrigatórias
1. Usar apenas CSS custom properties existentes — não criar novos tokens sem necessidade
2. Inline styles para variações de componente, não classes CSS globais
3. Manter UI em PT-BR — labels, placeholders, mensagens de erro
4. Sem bibliotecas de componente externas (sem Radix, sem MUI, sem Chakra)
5. Respeitar `border-radius: 0` do tema padrão — é intencional

---

## Critérios de Sucesso

1. Três repos clonados com sucesso em `~/.claude/skills/`
2. Claude Code reconhece as novas skills na próxima sessão
3. `.impeccable.md` presente na raiz do PettoFlow com brief completo
4. Nenhuma skill existente foi quebrada (verificar `design-taste-frontend`, `gpt-taste`, `stitch-design-taste`)
