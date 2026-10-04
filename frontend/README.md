# Controle Caixa — Frontend

A personal finance management SPA built with React and TypeScript, backed by a REST API.

## Stack

| Layer | Technology |
| --- | --- |
| Framework | React 19 + TypeScript 6 |
| Build | Vite 8 |
| Routing | React Router v7 |
| Server state | TanStack Query v5 |
| Client state | Zustand v5 |
| API client | openapi-fetch (typed against backend OpenAPI spec) |
| Styling | Tailwind CSS v4 |
| UI primitives | Base UI |
| Charts | Recharts |
| Date handling | date-fns |
| Testing | Vitest + React Testing Library + MSW |

## Features

- **Wallets** — manage multiple wallets; view per-wallet transaction history
- **Transactions** — create, filter, and inspect income/expense transactions with tags and contacts
- **Invoices** — track invoices with status badges and payment recording
- **Contacts** — manage payees/payers linked to transactions and invoices
- **Tags** — categorize transactions with custom tags
- **Multi-currency** — switch active currency via a persistent Zustand store; injected as `X-Currency` on every API request
- **Authentication** — token-based login with remember-me (localStorage) vs session-only (sessionStorage), auto-refresh 30 s before expiry, and password reset flow
- **Soft delete / restore** — all resources support soft-delete with a toggle to view deleted items and restore them

## Development

### Prerequisites

- Node.js (see `.nvmrc` for the exact version)
- Backend running on `http://localhost:3000`

### Setup

```bash
cp .env.example .env
npm install
npm run dev
```

The dev server starts with Vite HMR. Open `http://localhost:5173`.

### Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:3000` | Backend API base URL |

### Regenerating API types

When the backend OpenAPI schema changes, regenerate the TypeScript types (requires the backend to be running):

```bash
npm run generate-api
```

This overwrites `src/api/generated.ts` — never edit that file manually.

## Testing

```bash
npm test          # watch mode
npm run test:run  # single run (CI)
```

Tests use Vitest with React Testing Library and MSW for API mocking.

## Build

```bash
npm run build     # type-check + Vite production build → dist/
npm run preview   # serve the dist/ build locally
```

## Linting

```bash
npm run lint
```

## Deployment

The build outputs a static SPA to `dist/`. Serve it with any static file host (nginx, Vercel, Netlify, S3 + CloudFront, etc.). Configure the host to redirect all paths to `index.html` to support client-side routing.

Set `VITE_API_BASE_URL` to your production API endpoint at build time:

```bash
VITE_API_BASE_URL=https://api.example.com npm run build
```

## Project structure

```text
src/
├── api/            # openapi-fetch client + auto-generated types
├── components/     # shared/layout/UI components
├── features/       # feature modules (auth, wallets, transactions, invoices, contacts, tags)
│   └── {feature}/
│       ├── hooks/      # React Query hooks
│       └── components/ # feature-scoped components
├── pages/          # thin page components that compose feature hooks/components
├── router/         # createBrowserRouter config
├── store/          # Zustand stores
├── lib/            # utility functions (cn, formatCurrency, formatDate)
└── test/           # MSW server, test setup, render utils
```

Path alias: `@/` → `src/`
