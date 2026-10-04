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

Everything works with the defaults. To change the port, database password, time zone or email settings, copy [`.env.example`](.env.example) to `.env` and edit it. Set `DB_PASSWORD` before the first start: the database reads it only when it is created.

To update, pull the latest code and run `docker compose up -d --build`.

## Host it on your own domain

To make the app reachable at, for example, `https://cash.example.com`, run the Docker setup above on a server and put a reverse proxy in front of it to handle HTTPS.

1. **Get a server and a domain.** Any Linux machine with Docker and ports 80 and 443 open will do. Create a DNS `A` record pointing your domain at the server's IP address.

2. **Configure the app.** Clone this repository on the server, copy `.env.example` to `.env` and set:

   ```env
   APP_PORT=127.0.0.1:8080          # only reachable through the reverse proxy
   APP_URL=https://cash.example.com
   COOKIE_SECURE=true
   TRUST_PROXY=2                    # your reverse proxy + the bundled one
   DB_PASSWORD=<a long random password>
   ```

   Then start it with `docker compose up -d`.

3. **Add HTTPS with a reverse proxy.** [Caddy](https://caddyserver.com/docs/install) is the simplest option, because it gets and renews TLS certificates by itself. Put this in `/etc/caddy/Caddyfile` and reload Caddy:

   ```caddyfile
   cash.example.com {
       reverse_proxy 127.0.0.1:8080
   }
   ```

   If you already run nginx, use a `server` block for your domain with `proxy_pass http://127.0.0.1:8080;`, forward the `Host`, `X-Forwarded-For` and `X-Forwarded-Proto` headers, and get a certificate with [Certbot](https://certbot.eff.org/).

4. **Log in and change the admin password** at `https://cash.example.com`.

Keep `APP_PORT` bound to `127.0.0.1` whenever `TRUST_PROXY=2`. If the app port were open to the internet, clients could bypass the proxy and fake their IP address to get around the login rate limit.

**Password reset emails** are sent through [Brevo](https://www.brevo.com/). Fill in the `BREVO_*` settings in `.env` to enable them. Without them, everything else works, but a forgotten password can't be reset by email.

**Back up your data.** The app keeps a daily backup of each user's data in the `api-data` volume, which can be restored from the app itself. These backups live on the same server, so also copy a full database dump somewhere else regularly:

```bash
docker compose exec -T db sh -c 'mysqldump -u controle_caixa -p"$MYSQL_PASSWORD" controle_caixa' > controle-caixa.sql
```

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
