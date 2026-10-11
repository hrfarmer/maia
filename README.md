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

See [`.env.example`](.env.example). The **dashboard** needs `DISCORD_TOKEN` (server-side only) for Discord REST moderation and the external API. Production dashboard should use:

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
2. **Bot** tab: create a bot, copy the token → `DISCORD_TOKEN`. Enable privileged intents **Server Members Intent** (member search, role views, moderation via REST), **Message Content Intent** (message APIs and future message events), and keep **Guilds** enabled. The bot also requests **Guild Messages** and **Guild Message Reactions** (non-privileged gateway intents).
3. **OAuth2** tab:
   - Redirect URIs:
     - `http://localhost:3000/api/auth/callback/discord`
     - `https://maia.aychar.dev/api/auth/callback/discord`
   - Scopes for dashboard login: `identify`, `guilds` (Auth.js requests `identify guilds`).
4. **OAuth2 URL Generator** (for your own testing): scopes `bot`, `applications.commands`; bot permissions integer **1099914357830** (View Channel, Send Messages, Read Message History, Add Reactions, Manage Messages, Manage Roles, Kick Members, Ban Members, Moderate Members, Manage Nicknames — computed from `PermissionFlagsBits` in `@maia/discord`). The dashboard **Add Maia** link uses the same value.
5. Copy **Application ID** → `DISCORD_CLIENT_ID` and `NEXT_PUBLIC_DISCORD_CLIENT_ID`.
6. Copy **Client Secret** → `DISCORD_CLIENT_SECRET`.
7. After deploy, run `pnpm bot:deploy-commands` once so slash commands (`/hello`, `/role`, `/member`) are registered globally (or set `DISCORD_DEV_GUILD_ID` for a test server).

## External HTTP API

Authenticated REST endpoints live on the **dashboard** origin (same host as the UI). They call Discord with the bot token server-side and write audit log entries like dashboard actions.

### Authentication

Create a per-server API key on the server detail page (**API keys** tab). Each key is scoped to exactly one guild. The raw token is shown **once** on creation (`maia_…`).

Send it on every request:

```http
Authorization: Bearer maia_xxxxxxxx
```

Invalid, revoked, or wrong-guild keys return `401` / `403` JSON `{ "error": "…" }`. Basic rate limiting applies (`429` with `Retry-After`).

Optional env: `MAIA_API_KEY_PEPPER` (defaults to `AUTH_SECRET`) for hashing stored keys.

### Base URL

Production: `https://maia.aychar.dev/api/v1/guilds/{guildId}`

Local: `http://localhost:3000/api/v1/guilds/{guildId}`

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/roles` | List guild roles |
| `POST` | `/roles` | Create role (`{ "name": "…", "color": "#5865F2", "hoist": false, "mentionable": false }`) |
| `GET` | `/members/{userId}/roles` | List a member's role IDs |
| `PUT` | `/members/{userId}/roles` | Set member roles (`{ "roleIds": ["…"] }`) |
| `PUT` | `/members/{userId}/roles/{roleId}` | Add role (idempotent if already present) |
| `DELETE` | `/members/{userId}/roles/{roleId}` | Remove role (idempotent if absent) |
| `POST` | `/members/{userId}/kick` | Kick (`{ "reason": "optional" }`) |
| `POST` | `/members/{userId}/ban` | Ban (`{ "reason": "optional" }`) |
| `DELETE` | `/bans/{userId}` | Unban (idempotent if not banned) |
| `POST` | `/members/{userId}/timeout` | Timeout (`{ "minutes": 10, "reason": "optional" }`) |
| `DELETE` | `/members/{userId}/timeout` | Remove timeout |
| `PATCH` | `/members/{userId}/nickname` | `{ "nickname": "new" }` or `{ "nickname": null }` to clear |
| `GET` | `/channels` | List plain-text channels Maia can view |
| `POST` | `/channels/{channelId}/messages` | Send plain text (`{ "content": "…", "replyToMessageId": "optional" }`) |

### Examples

List roles:

```bash
curl -sS -H "Authorization: Bearer $MAIA_API_KEY" \
  "https://maia.aychar.dev/api/v1/guilds/$GUILD_ID/roles"
```

Create a role:

```bash
curl -sS -X POST -H "Authorization: Bearer $MAIA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Helper","color":"#5865F2","hoist":false,"mentionable":true}' \
  "https://maia.aychar.dev/api/v1/guilds/$GUILD_ID/roles"
```

Add a role:

```bash
curl -sS -X PUT -H "Authorization: Bearer $MAIA_API_KEY" \
  "https://maia.aychar.dev/api/v1/guilds/$GUILD_ID/members/$USER_ID/roles/$ROLE_ID"
```

Set all roles:

```bash
curl -sS -X PUT -H "Authorization: Bearer $MAIA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"roleIds":["111","222"]}' \
  "https://maia.aychar.dev/api/v1/guilds/$GUILD_ID/members/$USER_ID/roles"
```

Timeout for 30 minutes:

```bash
curl -sS -X POST -H "Authorization: Bearer $MAIA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"minutes":30,"reason":"spam"}' \
  "https://maia.aychar.dev/api/v1/guilds/$GUILD_ID/members/$USER_ID/timeout"
```

Send a message (optional reply):

```bash
curl -sS -X POST -H "Authorization: Bearer $MAIA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content":"Hello from Maia","replyToMessageId":"123456789012345678"}' \
  "https://maia.aychar.dev/api/v1/guilds/$GUILD_ID/channels/$CHANNEL_ID/messages"
```

### Slash commands

- `/role add|remove|create|delete|edit` — manage roles (invoker needs **Manage Roles**; Maia respects role hierarchy).
- `/member kick|ban|unban|timeout|untimeout|nickname` — member actions with matching Discord permissions.

All commands, dashboard actions, and API calls are recorded in the per-server **Audit log** tab.

### Optional local helpers

Set `MAIA_ENABLE_DEV_HELPERS=1` to expose `POST /api/dev/session` (fake session for UI work) and fixture guild data when using the dev access token. **Do not enable in production.**

Run `pnpm screenshots` (requires Playwright) to regenerate marketing screenshots locally.

## Project layout

```
apps/bot          Discord bot
apps/dashboard    Next.js dashboard
packages/db       Shared schema and migrations
packages/discord  Permission helpers and invite bitfield
```

## License

Private — hrfarmer/maia
