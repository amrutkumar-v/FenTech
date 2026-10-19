# Finance Management System

A production-quality, offline-first React PWA for private finance management (two authorized users: operator + admin). Built for a small business with two authorized users. All monetary amounts are decimal string-based, frontend never invents interest/penalty formulas, outstanding is the sum of recorded ledger allocations only, and offline operations use stable client-side opIds with idempotent sync.

## Key features

- **Offline-first**: IndexedDB outbox (Dexie), connectivity detection, automatic retry, idempotent sync with server by opId. Pending records are labeled "not yet confirmed by the server".
- **Money arithmetic**: decimal.js end-to-end (no JS floats). Values treated as decimal strings. Display-only rounding.
- **Role permissions**: operator/admin matrix (SRS §2, SEC-002). Only admin reaches users, sync, backup, audit.
- **Two authorized users**: `operator@demo.local` / `demo1234` (operator), `admin@demo.local` / `demo1234` (admin).
- **PWA**: installable, offline shell, Vite PWA with SW.
- **Design system**: Tailwind CSS v4, light/dark via `.dark` class, print styles.
- **Type-safe contracts**: typed API (`ApiClient`), MockAdapter (default) + HttpAdapter.
- **UX**: Toasts, modals/confirmations, skeletons, responsive tables, photo inputs.

## Quick start

```bash
npm install --legacy-peer-deps
npm run dev:mock  # runs against in-memory/mock backend persisted in localStorage
```

- `VITE_API_MODE=mock` (default in `dev:mock`) — demo fixtures marked "Demo —" 
- `VITE_API_MODE=http VITE_API_BASE_URL=http://localhost:8080` for real backend (HTTP adapter)
- Mock banner shows in UI.

## Scripts

| Script | What |
| --- | --- |
| `dev` | Vite dev |
| `dev:mock` | Dev with mock backend |
| `build` | `tsc -b && vite build` |
| `lint` | oxlint |
| `test` | Vitest run (RTL + jsdom) |
| `typecheck` | `tsc -b --pretty` |
| `preview` | Preview production build |

## Structure

- `src/api/` — contracts, mock adapter, http adapter, provider
- `src/domain/` — types, permissions
- `src/features/` — auth, customers, accounts, collateral, payments, receipts, transactions, collections, cashbook, reports, settings
- `src/lib/` — money, dates, ids, format, image
- `src/offline/` — Dexie DB, sync provider, useOfflineAction
- `src/ui/` — design system primitives

## Tests

25 tests covering money arithmetic, permissions matrix, outstanding derivation, periods, allocation helpers. Run `npm test`.

## Implementation notes

- No interest/penalty formulas in frontend (INT-006). Outstanding = sum of recorded ledger allocations. Server provides settlement preview when formulas exist (OD-001).
- Manual allocation per receipt (PAY-005).
- One account per customer per finance type (BR-003) — duplicate check with explicit ack.
- Collateral photos required for Gold/Papers/Property/Other(collateral-backed), never Free Hand (COL-001).
- Reversals are new linked entries, never deletes. Reasons required where applicable.
- Cash vs digital separated; cashbook tracks opening/counts/expected closing (CASH-*).
- Reports only use recorded data (RPT-012). Tables never invented totals.
- Mock DB key: `fms.mockdb.v1`. Icons generated with PIL 12.
- Lint: **oxlint** (not eslint).

## Important constraints

- `@hookform/resolvers@6` may have optional `effect@^4` peer; use `--legacy-peer-deps` if installing fresh.
- PowerShell shell (no bash heredocs) — scripts written to files then run.
- Path alias `@ -> src` in vite.config.ts and tsconfig.app.json.

## Documentation

- `docs/SRS-TRACEABILITY.md` — trace every requirement to screen/component/test
- `docs/API.md` — backend contract summary (fields, endpoints, rules)
- `docs/IMPLEMENTATION-REPORT.md` — build details, decisions, open items, verification

> Mock data is for demonstration only — "Demo —" fixtures. Not real financial data.
