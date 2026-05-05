# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:14-bullseye-slim AS builder

WORKDIR /workspace

# Install build-time system deps (node-sass / node-gyp need python2, make, g++)
RUN apt-get update && apt-get install -y \
    python2 \
    make \
    g++ \
    && ln -sf /usr/bin/python2 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

# Copy lockfile + manifest first for better layer caching
COPY package.json package-lock.json ./

# Install all deps (including devDependencies needed for the build)
RUN npm ci

# Copy the rest of the source
COPY . .

# Build static assets → dist/
RUN npm run build


# ── Stage 2: Runner ───────────────────────────────────────────────────────────
FROM node:14-bullseye-slim AS runner

WORKDIR /workspace

# Install only production system deps (none needed here, but kept for parity)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built static files from builder
COPY --from=builder /workspace/dist ./dist

# Copy backend source
COPY src/backend ./src/backend

EXPOSE 80

CMD ["node", "src/backend/index.js"]