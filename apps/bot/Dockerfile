FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/discord/package.json packages/discord/
COPY packages/db/package.json packages/db/
COPY packages/plugins/package.json packages/plugins/
COPY packages/moderation/package.json packages/moderation/
COPY apps/bot/package.json apps/bot/
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/discord/node_modules ./packages/discord/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/plugins/node_modules ./packages/plugins/node_modules
COPY --from=deps /app/packages/moderation/node_modules ./packages/moderation/node_modules
COPY --from=deps /app/apps/bot/node_modules ./apps/bot/node_modules
COPY . .
RUN pnpm --filter @maia/discord build && pnpm --filter @maia/db build && pnpm --filter @maia/moderation build && pnpm --filter @maia/plugins build && pnpm --filter @maia/bot build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN mkdir -p /app/plugins
COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/discord ./packages/discord
COPY --from=build /app/packages/db ./packages/db
COPY --from=build /app/packages/plugins ./packages/plugins
COPY --from=build /app/packages/moderation ./packages/moderation
COPY --from=build /app/apps/bot ./apps/bot
CMD ["sh", "-c", "pnpm --filter @maia/db migrate && pnpm --filter @maia/bot start"]
