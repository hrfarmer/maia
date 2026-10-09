# Maia

Discord bot and web dashboard for managing Maia across your servers.

## Stack

- **Bot** — [discord.js](https://discord.js.org/) (`apps/bot`)
- **Dashboard** — [Next.js](https://nextjs.org/) + [Auth.js](https://authjs.dev/) (`apps/dashboard`)
- **Database** — PostgreSQL + [Drizzle ORM](https://orm.drizzle.team/) (`packages/db`)

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) 9+
- PostgreSQL 16+ (local or Docker)

## Local development

### 1. Clone and install

```bash
pnpm install
```

### 2. Environment

Copy the example env file and fill in values from the [Discord Developer Portal](#discord-developer-portal):

```bash
cp .env.example .env
```

For local dashboard OAuth, set at minimum:

- `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` / `DISCORD_TOKEN`
- `NEXT_PUBLIC_DISCORD_CLIENT_ID` (same as `DISCORD_CLIENT_ID`)
- `AUTH_SECRET` (e.g. `openssl rand -base64 32`)
- `AUTH_URL=http://localhost:3000`
- `NEXT_PUBLIC_BASE_URL=http://localhost:3000`
- `DATABASE_URL=postgresql://maia:maia@localhost:5432/maia`

You can load env vars into both apps with a root `.env` and `dotenv` (bot) / Next.js (dashboard reads process env at build/runtime).

### 3. Database

Start Postgres (example with Docker):

```bash
docker run --name maia-postgres -e POSTGRES_USER=maia -e POSTGRES_PASSWORD=maia -e POSTGRES_DB=maia -p 5432:5432 -d postgres:16-alpine
```

Run migrations:

```bash
export $(grep -v '^#' .env | xargs) && pnpm db:migrate
```

### 4. Register slash commands

Global registration (can take up to an hour to propagate):

```bash
export $(grep -v '^#' .env | xargs) && pnpm bot:deploy-commands
```

For instant updates during development, set `DISCORD_DEV_GUILD_ID` to your test server ID and run the same command.

### 5. Run the bot and dashboard

In separate terminals (with env vars exported):

```bash
pnpm bot:dev
pnpm dashboard:dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with Discord, and use **Add Maia** on a server you manage.

## Scripts

| Command | Description |
|--------|-------------|
| `pnpm build` | Build db, bot, and dashboard |
| `pnpm typecheck` | Typecheck all packages |
| `pnpm db:migrate` | Apply Drizzle migrations |
| `pnpm bot:deploy-commands` | Register slash commands (global or dev guild) |
| `pnpm bot:dev` | Run bot with hot reload |
| `pnpm dashboard:dev` | Run dashboard on port 3000 |

## Docker / Coolify

This repo includes `docker-compose.yml` and per-app Dockerfiles under `apps/bot` and `apps/dashboard`.

### Services

1. **postgres** — database
2. **dashboard** — Next.js app (port 3000, health check at `/api/health`)
3. **bot** — long-running worker

Both app containers run `pnpm --filter @maia/db migrate` before starting.

### Coolify setup

Create **three** resources (or one Compose stack):

| Service | Domain / type | Notes |
|--------|----------------|-------|
| Dashboard | `https://maia.aychar.dev` | HTTP service, health path `/api/health` |
| Bot | Worker / background | No public URL; restart policy `unless-stopped` |
| Postgres | Managed database or Compose service | Connection string → `DATABASE_URL` |

**Dashboard build args** (if your build pipeline supports them):

- `NEXT_PUBLIC_DISCORD_CLIENT_ID`
- `NEXT_PUBLIC_BASE_URL=https://maia.aychar.dev`

**Environment variables** (dashboard + bot + shared):

See [`.env.example`](.env.example). Production dashboard should use:

- `AUTH_URL=https://maia.aychar.dev`
- `NEXT_PUBLIC_BASE_URL=https://maia.aychar.dev`

After deploy, run command registration once (from your machine or a one-off Coolify task):

```bash
pnpm bot:deploy-commands
```

### Compose (local smoke test)

```bash
cp .env.example .env
# fill in Discord values
docker compose up --build
```

## Discord Developer Portal

1. Create an application at [Discord Developer Portal](https://discord.com/developers/applications).
2. **Bot** tab: create a bot, copy the token → `DISCORD_TOKEN`. Enable **Server Members Intent** only if you add member features later; for v1 you only need the default **Guilds** intent (no privileged intents required).
3. **OAuth2** tab:
   - Redirect URIs:
     - `http://localhost:3000/api/auth/callback/discord`
     - `https://maia.aychar.dev/api/auth/callback/discord`
   - Scopes for dashboard login: `identify`, `guilds` (Auth.js requests `identify guilds`).
4. **OAuth2 URL Generator** (for your own testing): scopes `bot`, `applications.commands`; bot permissions at minimum **Send Messages** (slash replies).
5. Copy **Application ID** → `DISCORD_CLIENT_ID` and `NEXT_PUBLIC_DISCORD_CLIENT_ID`.
6. Copy **Client Secret** → `DISCORD_CLIENT_SECRET`.
7. After deploy, run `pnpm bot:deploy-commands` once so `/hello` is registered globally (or set `DISCORD_DEV_GUILD_ID` for a test server).

### Optional local helpers

Set `MAIA_ENABLE_DEV_HELPERS=1` to expose `POST /api/dev/session` (fake session for UI work) and fixture guild data when using the dev access token. **Do not enable in production.**

Run `pnpm screenshots` (requires Playwright) to regenerate marketing screenshots locally.

## Project layout

```
apps/bot          Discord bot
apps/dashboard    Next.js dashboard
packages/db       Shared schema and migrations
```

## License

Private — hrfarmer/maia
