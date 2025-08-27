# syntax=docker/dockerfile:1.7

# --- Builder stage ---
FROM node:24-alpine AS builder
WORKDIR /app

# Copy all files first
COPY . .

# Install dependencies and build
RUN npm install && npm run build

# --- Runner stage ---
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
  PORT=3000 \
  HOSTNAME=0.0.0.0

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
  adduser -S nextjs -u 1001

# Copy necessary files from builder
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create .next directory if it doesn't exist
RUN mkdir -p .next && chown nextjs:nodejs .next

# Switch to non-root user
USER nextjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
