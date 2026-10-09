FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/discord/package.json packages/discord/
COPY packages/db/package.json packages/db/
COPY apps/dashboard/package.json apps/dashboard/
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/apps/dashboard/node_modules ./apps/dashboard/node_modules
COPY . .
ARG NEXT_PUBLIC_DISCORD_CLIENT_ID
ARG NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_DISCORD_CLIENT_ID=$NEXT_PUBLIC_DISCORD_CLIENT_ID
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
RUN pnpm --filter @maia/discord build && pnpm --filter @maia/db build && pnpm --filter @maia/dashboard build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
ENV PORT=3000
COPY --from=build /app ./
EXPOSE 3000
CMD ["sh", "-c", "pnpm --filter @maia/db migrate && pnpm --filter @maia/dashboard start"]
