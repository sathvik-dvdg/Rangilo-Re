# Production image: the Next.js standalone server (next.config.mjs `output: 'standalone'`).
#
# NEXT_PUBLIC_* values are inlined into the browser bundle and the Content-Security-Policy
# at build time, so the image is built once per environment with that environment's public
# values as build arguments. Server secrets (CLERK_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY,
# VAPID_PRIVATE_KEY) are never build arguments: pass them to the container at run time.
#
#   docker build -t garbaconnect --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_... \
#     --build-arg NEXT_PUBLIC_SUPABASE_URL=https://... --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... .
#   docker run -p 3000:3000 --env-file <server env file> garbaconnect

# ---- Stage 1: install and build ----
FROM node:20-alpine AS builder
# Next's SWC compiler needs glibc compatibility on Alpine.
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

# Source only, by name. There is no .dockerignore yet, and `COPY . .` would also bring in
# the host's node_modules and .next, and any .env file holding real secrets.
COPY next.config.mjs next-env.d.ts tsconfig.json tailwind.config.ts postcss.config.mjs middleware.ts .eslintrc.json ./
COPY app ./app
COPY components ./components
COPY hooks ./hooks
COPY lib ./lib
COPY store ./store
COPY public ./public

ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
ARG NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
ARG NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
ARG NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
    NEXT_PUBLIC_CLERK_SIGN_IN_URL=$NEXT_PUBLIC_CLERK_SIGN_IN_URL \
    NEXT_PUBLIC_CLERK_SIGN_UP_URL=$NEXT_PUBLIC_CLERK_SIGN_UP_URL \
    NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=$NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL \
    NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=$NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN npm run build

# ---- Stage 2: run ----
FROM node:20-alpine AS runner
WORKDIR /app
# HOSTNAME: Docker sets it to the container id, which would stop the server listening on all interfaces.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

# The standalone server, its static assets, and public/ (service worker, videos, icons):
# Next does not copy the last two into .next/standalone itself.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
