# PHASE_36A_READ_PATH_RESILIENCE_CONVERGENCE

## 1. Executive summary

Phase 36A introduced explicit read-result semantics for the highest-risk read paths without replacing the app's existing React/Supabase architecture. Reads now have a shared contract for success, empty, stale, interrupted, unauthorized, failed, and retrying states. The convergence is strongest in workspace bootstrap, tenant loading, finance list reads, activities, onboarding, Telegram config, command history, and client interaction history.

This is a material improvement, but it is not a full read-path rewrite. Some admin read surfaces still use older local loading/error state patterns. They now benefit from shared normalized error copy in several places, but they do not all expose full stale/interrupted semantics yet.

## 2. Previous read-path weaknesses

- Several list hooks logged failures with `console.error` and left the UI with stale or empty arrays that looked fresh.
- Empty lists could mean "no records", "request failed", "tenant missing", or "request was interrupted".
- Retry behavior existed in orchestration and lazy loading, but not as a consistent read contract for feature data.
- Onboarding and finance reads could degrade without visible trust-state language.
- Client interaction logs and finance transactions could collapse failed reads into empty states.

## 3. Read-result semantic redesign

Added `src/lib/readResult.js` with explicit states:

- `success`
- `empty`
- `stale`
- `interrupted`
- `unauthorized`
- `failed`
- `retrying`
- `loading`

The contract shape is:

```js
{ ok, data, error, state, stale }
```

Errors are normalized into safe user messages while preserving raw provider details in `error.diagnostics`.

## 4. Failure-state convergence

Converted console-only read failures in these paths:

- workspace bootstrap and scoped team/client refreshes
- tenant list loading and refresh
- activities
- finance: accounts, payees, categories, rules, receivables, transactions, activity templates
- onboarding state load
- Telegram config load
- command history load
- client interaction history load

Failed reads no longer silently become empty data in those paths. Previously committed data is preserved and marked stale where available.

## 5. Retry normalization

`runReadWithRetry()` provides bounded retry behavior with a default single retry, explicit `retrying` state, and telemetry. It does not retry unauthorized, missing-tenant, or interrupted reads.

Onboarding load intentionally uses zero retries to preserve existing onboarding fallback behavior and avoid overlay retry churn during first render. That is a deliberate exception.

## 6. Stale-read governance

Stale data is now represented as stale instead of fresh success. Finance and workspace bootstrap show degraded-state wording when previous data is being preserved after a failed refresh. Tenant and mounted-runtime cancellation semantics remain intact; stale tenant-switch responses are still prevented from committing across active-tenant changes.

## 7. Read telemetry additions

Added lightweight bounded counters and events for:

- read failures
- read retries
- stale reads
- interrupted reads
- unauthorized reads

Telemetry is recorded through `traceReadLifecycle()` and remains bounded by the existing diagnostic event buffer.

## 8. UX resilience improvements

Added shared read wording for loading, retrying, failed, stale, interrupted, unauthorized, and empty states. Finance, command history, Telegram config, workspace bootstrap, and client history now distinguish failed/stale read states from true empty states.

## 9. Tests added

Added `src/lib/readResult.test.js` covering:

- unauthorized read classification
- retry exhaustion
- stale-data preservation
- interrupted reads
- stale reads that are not fresh success
- retrying state distinct from loading

Existing mounted-runtime Playwright tests also continue to cover tenant-switch interruption and stale team/client refresh protection.

## 10. Remaining resilience gaps

- Admin dashboard, audit, plans, billing, and tenant detail pages still use page-local loading/error patterns and do not expose the full read-result contract everywhere.
- Some mutation-adjacent reads triggered after writes still rely on the parent hook refresh semantics rather than their own explicit read result.
- Supabase Edge Function response parsing still has duplicated `parseResponse` helpers. Error display is safer at the UI boundary, but transport parsing is not fully centralized.

## 11. Remaining degraded-state risks

- Finance now surfaces aggregate degradation, but it does not identify every individual failed sub-resource inline.
- Calendar reads inherit state from underlying finance/activity hooks, but the calendar surface itself does not yet present a consolidated degraded-read banner.
- Admin surfaces can still show generic failed panels instead of stale-preserving data when a refresh fails after data was already loaded.

## 12. Validation results

- `npm run lint`: passed.
- `npm test`: passed, 55 files / 242 tests.
- `npm run build`: passed.
- `npm run test:visual`: passed, 231 Playwright tests.

Known validation noise:

- Vitest still prints existing Vite `esbuild` deprecation warnings.
- The intentional `useAuth` outside-provider test still prints the expected React error stack.
- Playwright prints repeated `NO_COLOR` / `FORCE_COLOR` environment warnings.

## 13. Production-readiness reassessment

Production readiness improved for user trust in core operational reads. The app is now better at saying whether data is fresh, stale, failed, unauthorized, retrying, or genuinely empty.

The system is not fully converged across every read surface yet. The remaining work is mostly breadth: admin pages, calendar-level aggregation, and centralized response parsing. The core architecture remains stable and the mounted-runtime guarantees held through the full visual/runtime suite.
