# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Use English as default language

## Commands

```bash
npm run dev          # Start dev server (Vite HMR)
npm run build        # tsc -b && vite build
npm run lint         # ESLint
npm run preview      # Preview production build
npm run generate-api # Regenerate src/api/generated.ts from backend OpenAPI spec (requires backend running on :3000)
```

TypeScript check without building: `npx tsc --noEmit`

## Environment

Copy `.env.example` → `.env`. Only one variable: `VITE_API_BASE_URL` (defaults to `http://localhost:3000`).

## Architecture

### API layer (`src/api/`)

- **`generated.ts`** — Auto-generated TypeScript types from the backend's OpenAPI spec. Never edit manually; regenerate with `npm run generate-api`.
- **`client.ts`** — `openapi-fetch` instance with middleware that:
  - Attaches `Authorization: Bearer` with auto-refresh 30 s before expiry
  - Supports dual token storage: `localStorage` (remember-me) vs `sessionStorage` (session-only)
  - Injects `X-Currency` header from Zustand store on every request
  - Redirects to `/login` on 401 responses

### Feature modules (`src/features/`)

Each feature (`auth`, `transactions`, `wallets`, `invoices`, `contacts`, `tags`) follows the same structure:

```
features/{feature}/
├── hooks/          # React Query hooks (one hook per operation)
│   └── index.ts   # Barrel export
├── components/     # Feature-scoped UI components
│   └── index.ts
└── index.ts        # Re-exports everything: export * from "./hooks"; export * from "./components"
```

**Hook patterns:**

- List queries use `useInfiniteQuery` with page size 20; query key is `["{resource}", filters]`
- Single-item queries use `useQuery` with key `["{resource}", id]`
- Mutations call `queryClient.invalidateQueries` on success to refetch relevant keys
- All hooks call `apiClient.GET/POST/PUT/PATCH/DELETE` with typed paths from `generated.ts`

### Pages (`src/pages/`)

Thin page components that compose feature hooks and components. All data-fetching, mutations, and state live here or in feature hooks — pages don't contain inline `fetch` calls.

### Routing (`src/router/index.tsx`)

React Router v7 `createBrowserRouter`. Public routes: `/login`, `/forgot-password`, `/reset-password`. All other routes are wrapped in a `ProtectedRoute` (checks token in storage) and rendered inside `AppLayout`.

### State management (`src/store/`)

Single Zustand store: `useCurrencyStore` — persisted to `localStorage` as `currency-store`. Tracks the active currency and available currencies; the API client reads it for the `X-Currency` header.

### Utilities (`src/lib/`)

- `cn(...classes)` — `clsx` + `tailwind-merge`
- `formatCurrency(value, currency)` — `Intl.NumberFormat`
- `formatDate(date)` — `date-fns` formatted as `dd/MM/yyyy`

Path alias: `@/` → `src/`

## Soft-delete / restore pattern

Resources (wallets, contacts, invoices, transactions) support soft-delete. List hooks accept `deleted?: boolean`; passing `true` fetches only deleted items. Each feature has a `useRestore*` hook that calls the backend's restore endpoint and invalidates the relevant query key. The UI exposes a toggle button per list page to switch between active and deleted views.
