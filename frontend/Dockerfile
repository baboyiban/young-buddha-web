# syntax=docker/dockerfile:1.7

# --- Builder ---
FROM node:24-bullseye AS deps
WORKDIR /app
COPY package.json package-lock.json* bun.lock* pnpm-lock.yaml* yarn.lock* ./
RUN npm ci || npm i

FROM deps AS builder
WORKDIR /app
COPY . .
# BACKEND_ORIGIN is used by next.config.js during build for rewrites
ARG BACKEND_ORIGIN=http://backend:8080
ENV BACKEND_ORIGIN=${BACKEND_ORIGIN}
## Ensure public directory exists so COPY in runner doesn't fail when absent in repo
RUN mkdir -p public
RUN npm run build

# --- Runner ---
FROM node:24-bullseye-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

# Use Next.js standalone output for smaller image if available
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
