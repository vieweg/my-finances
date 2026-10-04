# Controle Caixa

A self-hosted personal cash flow tracker: wallets, transactions with full version history, tags, contacts, contracts and invoices, with multi-currency support.

This repository holds both halves of the app:

| Folder | What | Stack |
| --- | --- | --- |
| [`backend/`](backend/) | REST API | Node.js, Express 5, TypeScript, TypeORM, MySQL 8, JWT |
| [`frontend/`](frontend/) | Single-page app | React 19, Vite, TanStack Query, Zustand, Tailwind CSS, Recharts |

## Run with Docker

The quickest way to self-host: you only need Docker.

```bash
docker compose up -d
```

Open <http://localhost:8080> and log in as `admin` with the password `please_change_me`, then change it right away.

This starts MySQL, the API and the web app. Database migrations run each time the API starts, and the JWT secrets are generated on first start. The database, the secrets and the daily backups live in Docker volumes (`db-data` and `api-data`), so they survive `docker compose down` but are removed by `docker compose down -v`.

Everything works with the defaults. To change the port, database password, time zone or email settings, copy [`.env.example`](.env.example) to `.env` and edit it. If you serve the app over HTTPS behind your own reverse proxy, set `APP_URL` to the public URL and `COOKIE_SECURE=true`.

To update, pull the latest code and run `docker compose up -d --build`.

## Development setup

Prerequisites: Node.js 20+ and a MySQL 8 database.

```bash
# 1. API
cd backend
cp .env.example .env      # fill in DB credentials and JWT secrets
npm install
npm run typeorm migration:run -- -d src/database/index.ts
npm run dev               # http://localhost:3000, docs at /api/docs

# 2. Web app (in another terminal)
cd frontend
cp .env.example .env      # VITE_API_BASE_URL=http://localhost:3000
npm install
npm run dev               # http://localhost:5173
```

The first migration creates an `admin` user with the password `please_change_me`. Log in and change it right away.

See [backend/readme.md](backend/readme.md) and [frontend/README.md](frontend/README.md) for configuration, testing and deployment details.

## Contributing

Issues and pull requests are welcome. Please run the test suites before opening a PR:

```bash
cd backend && npm test        # needs a MySQL test database configured in .env.test
cd frontend && npm run test:run && npm run lint
```

## License

[MIT](LICENSE)
