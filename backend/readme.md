# Controle Caixa Node

A REST API for personal cash flow tracking — manage transactions, wallets, contacts, and invoices with multi-currency support.

## Stack

| Layer | Technology |
| --- | --- |
| Runtime | Node.js >= 18.x |
| Language | TypeScript |
| Framework | Express 5 |
| ORM | TypeORM 0.3 |
| Database | MySQL 8 |
| Auth | JWT (access + refresh tokens) |
| Validation | Joi |
| Email | Brevo (Sendinblue) |
| API Docs | Swagger UI / OpenAPI 3.0 |
| Testing | Jest + Supertest (integration) |

## Features

- **Transactions** — income/expense entries with soft-delete and full version history; any prior version can be restored
- **Wallets** — bank accounts, cash, and investment wallets with balance snapshots over time
- **Tags** — user-scoped labels for transaction categorisation
- **Contacts** — customers and service providers linked to invoices
- **Invoices** — payables and receivables tied to contacts
- **Multi-currency** — currency conversion via `X-Currency` request header
- **Auth** — JWT access/refresh token flow with password-reset email
- **API docs** — Swagger UI at `/api/docs`; machine-readable spec at `/api/docs/openapi.json`

## Project structure

```text
src/
  app.ts              Route mounting and global middleware
  server.ts           Entry point
  database/           TypeORM DataSource
  middlewares/        Global: auth, currencyFilter, errorHandler
  errors/             AppError classes
  swagger/            OpenAPI spec generation
  modules/
    users/
    sessions/
    transactions/
    tags/
    wallets/
    contacts/
    invoices/
```

Each module follows the same internal layout:
`routes → controller → service → repository`, with `middlewares/` (Joi) and `dtos/` alongside.

## Environment variables

Copy `.env.example` to `.env` and fill in the values:

```env
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

DB_HOST=localhost
DB_PORT=3306
DB_USER=
DB_PASSWORD=
DB_NAME=

JWT_SECRET=
JWT_EXPIRATION=15m
JWT_SECRET_REFRESH=
JWT_EXPIRATION_REFRESH=7d
JWT_RESET_SECRET=

BREVO_API_KEY=
BREVO_FROM_NAME=
BREVO_FROM_EMAIL=
```

## Development

```bash
npm install
npm run dev          # ts-node + nodemon, watches src/**/*.ts
```

The server restarts automatically on any TypeScript change.

## Build & production

```bash
npm run build        # tsc → dist/
npm start            # node dist/server.js
```

## Database migrations

TypeORM is configured with `synchronize: true` in development, so schema changes apply automatically. For production use migrations:

```bash
npm run typeorm migration:generate -- -n MigrationName
npm run typeorm migration:run
npm run typeorm migration:revert
```

## Testing

Tests are integration tests that run against a real MySQL database.

1. Copy `.env.example` to `.env.test` and point it at a separate test database.
2. Ensure the test database exists.

```bash
npm test                                          # run all tests once
npm run test:watch                                # watch mode
npm run test:coverage                             # with coverage report

npx jest tests/transactions.module.test.ts        # single file
```

Jest global setup (`tests/global/setupTests.ts`) initialises the DataSource and seeds an admin user before the suite runs, then tears it all down afterwards.

## API endpoints

| Method | Path | Description | Auth |
| --- | --- | --- | --- |
| POST | `/api/sessions` | Login | — |
| DELETE | `/api/sessions` | Logout | ✓ |
| POST | `/api/users` | Register | — |
| GET/PUT/DELETE | `/api/users/:id` | User CRUD | ✓ |
| GET/POST | `/api/transactions` | List / create transactions | ✓ |
| GET/PUT/DELETE | `/api/transactions/:id` | Transaction detail | ✓ |
| POST | `/api/transactions/:id/restore` | Restore a prior version | ✓ |
| GET/POST | `/api/tags` | List / create tags | ✓ |
| GET/POST | `/api/wallets` | List / create wallets | ✓ |
| GET/POST | `/api/contacts` | List / create contacts | ✓ |
| GET/POST | `/api/invoices` | List / create invoices | ✓ |
| GET | `/api/docs` | Swagger UI | — |
| GET | `/api/docs/openapi.json` | OpenAPI 3.0 spec | — |

All authenticated routes require `Authorization: Bearer <access_token>`.  
Currency conversion is triggered by the `X-Currency` request header.

## License

MIT
