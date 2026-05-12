Implement the auto-claim flow for the first platform admin in the PettoFlow/NexusCRM project.

## Current State

- `platform_admins` table exists with columns: id (PK UUID), user_id (UUID nullable), email (text), role (text default "admin"), active (boolean default true), created_at, updated_at
- RPC `is_current_user_platform_admin()` returns boolean — already called in AuthContext to set `isPlatformAdmin`
- AuthContext (`src/context/AuthContext.jsx`): exposes `isPlatformAdmin`, calls `supabase.rpc('is_current_user_platform_admin')` on mount
- AdminRoute (`src/admin/AdminRoute.jsx`): checks `isPlatformAdmin`, if false shows "Acesso administrativo negado"
- AdminPanel (`src/admin/AdminPanel.jsx`): full dashboard with metrics, tenants, users, audit, billing tables
- admin-core Edge Function (`supabase/functions/admin-core/index.ts`): has endpoints for GET me, users, overview with requirePlatformAdmin middleware
- adminClient.js (`src/lib/adminClient.js`): `adminFetch(path)` helper with JWT, exports fetchAdminTenants, etc.
- adminApi.js (`src/lib/adminApi.js`): contains fetchAdminProfile, fetchAdminOverview, listAdminUsers
- SidebarRail (`src/components/shell/SidebarRail.jsx`): shows admin section when `isPlatformAdmin` is true

## What to Implement (4 files)

### 1. `supabase/functions/admin-core/claim-master.ts` (NEW)

Edge Function that creates the first platform admin. Must:
- Accept POST only
- Get the authenticated user from JWT via requireAuthenticatedUser
- Check if platform_admins table is empty using service_role client
- If table is NOT empty, return 409 "Já existe um administrador na plataforma"
- If empty, insert into platform_admins: user_id from auth, email from auth, role = 'admin', active = true
  - Use the service_role client from '../_shared/supabase.ts'
  - Generate id with crypto.randomUUID()
- Return 200 with { success: true, admin: { id, email, role } }
- Include CORS preflight handling (OPTIONS) and request ID logging

Use the same patterns from admin-core/index.ts (import cors.ts, auth.ts, supabase.ts, observability.ts).

### 2. `src/components/admin/ClaimMasterBanner.jsx` (NEW)

Component shown when user is logged in but not an admin, and platform_admins is empty:
- On mount, call supabase.rpc('is_platform_admins_table_empty')
- If false, render nothing
- If true, show a styled banner with title "Bem-vindo ao Gestão SaaS", description, and "Reivindicar como Master" button
- On claim click, call adminFetch('/claim-master', { method: 'POST' })
- On success, call onClaimed() prop

Style: use the same CSS variable patterns (--card-bg, --border-color, --primary, --bg-color, --text-primary, --text-secondary).

### 3. Modify `src/admin/AdminRoute.jsx`

Replace the simple "if (!isPlatformAdmin) return AuthLayout" with:
- If user is admin, render AdminPanel
- If user is NOT admin, check if table is empty -> show ClaimMasterBanner or AuthLayout denial
- Import ClaimMasterBanner and supabase
- Use refreshSession from useAuth to re-check after claim

### 4. Add to `src/lib/adminApi.js`

Add export: `export async function claimMaster() { return adminFetch('/claim-master', { method: 'POST' }) }`

## IMPORTANT RULES
- Follow existing code patterns exactly (ES modules, 2-space indentation, single quotes)
- Do NOT change any existing functionality in AdminPanel, SidebarRail, or AuthContext
- Use the same CSS variable names as the existing code
- The claim-master endpoint must be a SEPARATE file with its own Deno.serve handler
