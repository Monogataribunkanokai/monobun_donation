# Monobun Donation System - Production Dockerfile

# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile --production=false

# Copy source code
COPY . .

# Build frontend (if needed)
# RUN bun build ./public/admin/app.tsx --outdir=./dist/admin
# RUN bun build ./public/donate/app.tsx --outdir=./dist/donate

# Production stage
FROM oven/bun:1-slim AS production

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 bunjs

# Copy package files and install production dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# Copy source code
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public
COPY --from=builder /app/db ./db

# Set ownership
RUN chown -R bunjs:nodejs /app

# Switch to non-root user
USER bunjs

# Environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start server
CMD ["bun", "run", "src/index.ts"]
