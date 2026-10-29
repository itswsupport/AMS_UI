# AMS UI — multi-stage build. Same shape as the TMS UI image (deps -> builder -> runner on
# node:20-alpine), with one real difference: next.config.mjs sets `output: "standalone"`, so
# the runner ships only .next/standalone (server.js plus the node_modules it traced) and runs
# `node server.js` instead of the full node_modules and `npm start`. Much smaller image.

FROM node:20-alpine AS deps
WORKDIR /app

# libc6-compat: some prebuilt native modules (e.g. the SWC binary) expect glibc symbols.
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund

# ---------------------------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Every value below is consumed by `npm run build`: NEXT_PUBLIC_* are inlined into the
# client bundle, and BACKEND_URL is frozen into the rewrite in .next/routes-manifest.json.
# None of them can be changed later with `docker run -e` — a new value is a rebuild.

# Where the browser sends API calls. Relative and same-origin on purpose: the rewrite in
# next.config.mjs proxies /api/* to the backend, so the browser only ever talks to this
# container and the backend port never has to be open. Matches the default in
# src/config/api.js.
ARG NEXT_PUBLIC_API_BASE_URL=/api
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

# The Spring backend as seen from INSIDE this container: container name + the port inside
# that container (Asset-Tracking-System sets no server.port, so Spring's default 8080).
# The backend has no context path, so the rewrite strips /api:
#   browser /api/device/list/  ->  http://ams-backend:8080/device/list/
# Never "localhost" — inside this container that is the Next server itself.
ARG BACKEND_URL=http://ams-backend:8080
ENV BACKEND_URL=${BACKEND_URL}

# The app serves from the root (next.config.mjs has no basePath). Leave empty unless
# basePath is added there too — the two must match.
ARG NEXT_PUBLIC_BASE_PATH=
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}

# DEMO LOGINS OFF. src/lib/mockAuth.js turns the demo accounts (admin/admin, user/user...)
# ON whenever this is anything other than the exact string "false", and .env.local — the
# only file that sets it — is never in the build context. Defaulting to "false" here is
# what stops a live image from accepting admin/admin.
ARG NEXT_PUBLIC_MOCK_AUTH=false
ENV NEXT_PUBLIC_MOCK_AUTH=${NEXT_PUBLIC_MOCK_AUTH}

# "local" = the app's own /Login page; "portal" = handed off from the REPL portal, which
# also needs the two portal URLs below.
ARG NEXT_PUBLIC_LOGIN_MODE=local
ENV NEXT_PUBLIC_LOGIN_MODE=${NEXT_PUBLIC_LOGIN_MODE}
ARG NEXT_PUBLIC_PORTAL_ENTRY_URL=
ENV NEXT_PUBLIC_PORTAL_ENTRY_URL=${NEXT_PUBLIC_PORTAL_ENTRY_URL}
ARG NEXT_PUBLIC_PORTAL_DASHBOARD_URL=
ENV NEXT_PUBLIC_PORTAL_DASHBOARD_URL=${NEXT_PUBLIC_PORTAL_DASHBOARD_URL}

RUN npm run build

# ---------------------------------------------------------------------------------------
FROM node:20-alpine AS runner

LABEL maintainer="ruchatest4@gmail.com"
LABEL description="AMS UI Application"
LABEL version="1.0"

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# The standalone server, then the two folders it does not copy for itself: the static
# chunks and public/ (logo, user manual). Owned by nextjs because the server writes
# .next/cache at runtime.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# No BACKEND_URL here: the proxy destination is already frozen into the build above.

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# /Login/ with the trailing slash: next.config.mjs sets trailingSlash: true, so /Login is a
# 308 and only /Login/ answers 200. busybox wget, which alpine already carries.
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget --spider -q http://localhost:3000/Login/ || exit 1

CMD ["node", "server.js"]
