# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npm test && npm run build

# Explicit one-shot schema tool; never run automatically on app startup.
FROM deps AS schema
COPY prisma ./prisma
USER node
ENTRYPOINT ["./node_modules/.bin/prisma"]
CMD ["db", "push"]

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
RUN mkdir -p /app/data /app/public/draft-visuals && chown -R node:node /app/data /app/public/draft-visuals
USER node
EXPOSE 3000
CMD ["node", "server.js"]
