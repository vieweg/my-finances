# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This is a **public, open source** repository containing two independent npm projects:

- `backend/` — Express + TypeScript + TypeORM + MySQL REST API. See [backend/CLAUDE.md](backend/CLAUDE.md).
- `frontend/` — React + Vite SPA that consumes the API. See [frontend/CLAUDE.md](frontend/CLAUDE.md).

There is no root `package.json`; run npm commands inside the relevant folder. The frontend's API types are generated from the backend's OpenAPI spec (`cd frontend && npm run generate-api` with the backend running), so a backend API change usually means regenerating them in the same commit.

There is no CI: before committing, run the backend tests (they need a MySQL test database, see `backend/CLAUDE.md`) and the frontend's `npm run lint && npm run test:run && npm run build`.

## Never commit

Because the repo is public: no `.env` files, database dumps (`*.sql`, `*.sql.gz`), `backups/`, real personal or financial data, real email addresses, hostnames or credentials. Use `example.com` addresses and faker data in seeds and tests.
