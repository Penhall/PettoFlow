# NexusCRM Design System Rules

## Purpose

These rules freeze the premium NexusCRM UI system after the rollout.

They exist to:

- prevent visual drift
- protect operational density
- keep motion calm and enterprise-grade
- ensure all new UI stays inside the same product language

These rules apply to:

- shell
- shared primitives
- premium page surfaces
- operational tables, lists, timelines, drawers, and modals

## Authority Order

When UI decisions conflict, follow this order:

1. Design tokens in [src/index.css](/E:/PROJETOS/PettoFlow/src/index.css)
2. Shared primitives in `src/components/shared/`
3. Shell patterns in `src/components/shell/`
4. Page-level patterns already established in premium surfaces
5. Local component styling only when the first four cannot express the requirement

## Spacing Authority

- Use the established spacing rhythm: `4, 8, 12, 16, 24, 32, 48, 64`
- Prefer existing container and surface padding before creating local spacing systems
- Dense operational surfaces should default to the tighter half of the scale
- Do not hardcode ad hoc layout spacing inside JSX

## Typography Hierarchy

- Serif is reserved for display identity: page titles and selected empty-state headings
- Sans is the operational default for controls, rows, filters, and data surfaces
- Mono is reserved for values, IDs, and financial precision where needed
- Do not introduce local font stacks for one-off screens

## Motion Rules

- Use shared motion tokens from [src/lib/motionTokens.js](/E:/PROJETOS/PettoFlow/src/lib/motionTokens.js)
- Standard interaction timing: `120ms-220ms`
- Overlay and drawer ceiling: `240ms`
- Allowed motion properties: `opacity`, `translateY`, and subtle scale near `1`
- Do not add local spring or bounce systems for product UI

## Radius Scale

- Use system radii already established in shared surfaces
- Chips and small controls: compact rounded pills or 14px-class radii
- Cards and contained surfaces: medium/large system radii
- Do not invent one-off radius values inside component markup

## Surface Usage

- Group content with spacing, tone, and depth before reaching for borders
- Borders are supportive, never structural
- Use `SurfaceCard`, `MetricCard`, `PageHeader`, `PageTabs`, and `PageActionBar` before custom page chrome
- Avoid boxed admin-panel framing and nested-card stacks unless hierarchy requires it

## Hover And Focus

- Hover states should be subtle: mild lift, tonal shift, or border refinement
- Focus visibility is required for keyboard access
- Do not create isolated hover languages for individual pages

## Table And Data Surface Rules

- Optimize for scan speed and operational clarity
- Keep row height compact but readable
- Prefer soft separators over heavy grid lines
- Inline actions should appear in a consistent trailing zone
- Empty rows and loading states must preserve table rhythm
- Sticky or anchored headers should be used when they improve scanning, not decoratively

## Modal And Sidebar Rules

- Drawers and modals use the shared overlay and contained-surface language
- Avoid inline structural styling for layout, padding, and framing
- Contextual actions belong inside the shared action button system
- Heavy secondary workflows should open in drawers or modals only when context matters

## Responsive Rules

- Reuse shared breakpoints already encoded in the system
- Mobile should preserve density discipline, not become oversized
- Collapse tabular headers when needed, but keep operational clarity through row grouping
- Do not add isolated breakpoint logic without confirming the system does not already cover it

## Empty State Rules

- Every empty state must explain:
  - what this area does
  - why it is empty
  - what should happen next
- Tone must remain calm, premium, and trustworthy
- No mascots, gamification, or playful filler

## Action Hierarchy

- One primary action per surface when possible
- Secondary actions stay visually quieter
- Global topbar actions must remain constrained
- Contextual actions belong in page action bars, rows, drawers, or modals, not duplicated everywhere

## Enforcement Rules

Disallow in governed premium surfaces:

- hardcoded structural spacing in JSX
- arbitrary inline shadows
- local transition timing literals
- isolated hover systems
- duplicated structural breakpoints without system need
- custom radius values in markup
- inline structural styles

Allowed exception:

- CSS custom properties injected inline for data-driven visuals, such as progress widths

## Visual Regression Safety

- Critical premium surfaces must keep screenshot baselines
- Desktop, tablet, and mobile snapshots are the default expectation
- Snapshot coverage should focus on real operational states, not empty demos only

## Governance Scope

The first enforced scope is:

- `src/components/shell/`
- `src/components/shared/`
- `src/components/Dashboard/`
- `src/components/Team/`
- `src/components/Clients/`
- `src/components/Calendar/`
- `src/components/Settings/SettingsView.jsx`
- `src/App.jsx`

Other legacy sub-areas should migrate into this governance boundary over time.
