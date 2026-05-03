# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the Vite React app. Use `src/components/` for UI, `src/hooks/` for data and state hooks, `src/lib/` for Supabase and domain helpers, and `src/context/` for shared providers. Entry points are `src/main.jsx` and `src/App.jsx`.

`supabase/functions/` contains Edge Functions and shared server utilities in `_shared/`. SQL migrations live in `supabase/migrations/`. `docs/` stores plans and design notes. `dist/` is the build output and should not be edited manually. `server/database.sqlite` is a local artifact, not the primary data model.

## Build, Test, and Development Commands
Use npm for Node workflows because this repo commits `package-lock.json`. Git usage is standard and is not restricted by the repository itself.

- `npm run dev` starts the Vite development server.
- `npm run build` creates the production bundle in `dist/`.
- `npm run preview` serves the built app locally.
- `npm run lint` runs ESLint on `.js` and `.jsx` files and fails on warnings.
- `npm test` runs Vitest once for frontend/unit tests.
- `npm run test:watch` runs Vitest in watch mode.
- `npm run test:deno` runs Deno tests for `supabase/functions/telegram-webhook`.

## Coding Style & Naming Conventions
Follow the existing style: ES modules, 2-space indentation, and single quotes. React components use PascalCase file names such as `FinanceView.jsx`; hooks use `useX.js`; utility modules use camelCase names such as `workspaceCore.js`.

Keep related tests beside the code when practical, using `*.test.js`, `*.test.jsx`, or `*.test.ts`. Run `npm run lint` before opening a PR.

## Testing Guidelines
Frontend tests use Vitest with Testing Library and `src/test-setup.js`. Supabase webhook tests use Deno's built-in runner. There is no enforced coverage threshold in the repo today, so add tests for changed behavior, especially parsing, auth middleware, finance rules, and calendar flows.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commit prefixes like `feat(...)`, `fix(...)`, `docs:`, and focused merge summaries. Keep commits small and descriptive, for example `feat(bot-admin): auto-read config secret`.

PRs should explain user-visible impact, list validation steps, link the relevant issue or plan, and include screenshots for UI changes. Note any required env vars or migration files explicitly.

## Security & Configuration Tips
Never hardcode secrets in source. Keep frontend variables in `.env` with `VITE_` prefixes, and keep server-only secrets in Supabase function environment settings. Review SQL migrations and function auth checks together when changing workspace or Telegram access.
