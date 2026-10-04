# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start with nodemon (watches src/**/*.ts)
npm run build        # Compile TypeScript to dist/
npm start            # Run compiled production build

# Testing
npm test             # Run all tests once (uses .env.test DB)
npm run test:watch   # Watch mode
npm run test:coverage

# Single test file
npx jest tests/transactions.module.test.ts

# Database migrations
npm run typeorm migration:generate -- -n MigrationName
npm run typeorm migration:run
npm run typeorm migration:revert
```

## Architecture

**Express + TypeScript + TypeORM + MySQL** REST API for personal cash flow tracking.

Entry point: `src/server.ts` → `src/app.ts` (route mounting) → `src/database/index.ts` (TypeORM DataSource, synchronize: true).

### Module structure

Every feature lives under `src/modules/<name>/` and follows this pattern:

```
models/          TypeORM entities
repositories/    Data access (extends Repository)
services/        One class per use case (Create, Update, List, Delete, Restore)
controllers/     HTTP handlers — validate input, call service, return response
routes/          Express Router
middlewares/     Module-specific validation (Joi schemas)
dtos/            TypeScript interfaces for input/output shapes
```

Modules: `users`, `sessions`, `setup` (first-access account creation), `transactions`, `tags`, `wallets`, `contacts`, `invoices`.

### Request lifecycle

`routes` → `authenticated` middleware (injects `req.userId`) → optional `currencyFilter` (reads `X-Currency` header) → module middleware (Joi validation) → `controller` → `service` → `repository`.

Global error handling: `src/middlewares/errorHandler.ts` catches `AppError` instances (from `src/errors/`) and unknown errors, returning structured `{ message }` responses.

### Key patterns

- **Transaction versioning**: edits create a new row with an incremented `version` and an `originalId` pointing to the first version; the previous row is soft-deleted. A restore endpoint reverts to any prior version.
- **Soft deletes**: most entities use `@DeleteDateColumn() deletedAt` — TypeORM filters these out automatically.
- **Auth**: JWT Bearer tokens. `src/middlewares/authenticated.ts` verifies the token and sets `req.userId`.
- **Swagger**: `src/swagger/` auto-generates OpenAPI spec from Joi schemas via `joi-to-swagger`; served at `/api/docs`.

### Testing

Tests are integration tests — they hit a real MySQL database defined in `.env.test`. Jest global setup (`tests/global/globalSetup.ts`) runs the migrations and seeds the admin user the tests log in with; `tests/global/setupTests.ts` initialises and tears down the DataSource per test file. Test files live in `tests/*.test.ts` and use supertest against the Express app.
