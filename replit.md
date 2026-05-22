# WealthOS

Personal finance dashboard for tracking income, expenses, savings, goals, investments, assets, and net worth. KES-first, single-user, dark premium fintech UI.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000 / workflows use 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite, wouter, @tanstack/react-query, recharts, framer-motion, shadcn/ui

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all endpoints)
- `lib/api-zod/src/generated/` — Zod schemas generated from spec
- `lib/api-client-react/src/generated/` — React Query hooks generated from spec
- `lib/db/src/schema/` — Drizzle schema files (one per entity)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/wealthos/src/pages/` — All 10 page components
- `artifacts/wealthos/src/components/Layout.tsx` — Sidebar + mobile nav

## Architecture decisions

- Contract-first: OpenAPI spec defines the API; Zod schemas + React Query hooks are generated, not handwritten
- `createdAt` from Drizzle returns as `Date` objects — all parse functions call `.toISOString()` before passing to Zod
- Dark mode forced on in App.tsx `useEffect` (adds `.dark` class to `<html>`)
- Dashboard aggregates computed on-the-fly from transactions/savings/assets/liabilities — no pre-computed report storage needed for real-time accuracy
- Net worth history uses a simulated trend from current snapshot (no historical snapshots stored yet)

## Product

10-page personal finance OS:
1. **Dashboard** — KPI cards, cashflow chart, spending breakdown, insights, health score
2. **Transactions** — CRUD with filters (type, month, category, search)
3. **Analytics** — 5 charts (cashflow, savings rate, category bars, spending pie, income pie)
4. **Budget** — Monthly budgets with real-time spent vs limit tracking
5. **Goals & Savings** — Progress rings, priority badges, update flow
6. **Assets & Liabilities** — Side-by-side with ratio bar, tabs
7. **Net Worth** — Area chart history, category breakdown
8. **Investments** — Portfolio with P&L per investment, allocation pie
9. **Reports** — 6-month rolling reports with health score detail view
10. **Settings** — Currency, emergency fund target, USD conversion rate

## User preferences

- KES (Kenyan Shilling) as default currency
- Dark premium fintech theme always on
- No authentication required (single-user app)

## Gotchas

- Drizzle `timestamp` columns return `Date` objects — always serialize with `.toISOString()` in parse helpers before Zod validation
- Run `pnpm --filter @workspace/api-spec run codegen` after any OpenAPI spec changes before writing frontend code
- The API server builds with esbuild before starting — code changes require workflow restart

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
