# ==============================================================================
# One Night Ultimate Werewolf - Docker Build
# ==============================================================================
# Multi-stage build for optimal image size
# Stage 1: Build TypeScript
# Stage 2: Production runtime
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production
# ------------------------------------------------------------------------------
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S onuw && \
    adduser -S onuw -u 1001

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Copy client files
COPY client.html ./

# Set ownership
RUN chown -R onuw:onuw /app

# Switch to non-root user
USER onuw

# Expose WebSocket port
EXPOSE 8080

# Environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "const http = require('http'); http.get('http://localhost:8080', (r) => process.exit(r.statusCode === 426 ? 0 : 1)).on('error', () => process.exit(1))"

# Start server
CMD ["node", "dist/server.js"]
