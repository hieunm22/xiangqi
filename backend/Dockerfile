# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# COPY package.json yarn.lock ./
COPY package.json ./
# RUN yarn install --frozen-lockfile
RUN yarn install

COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

RUN yarn prisma generate && yarn build
RUN npx prisma generate

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production

# Copy compiled output and Prisma client
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/node_modules/@prisma/adapter-pg ./node_modules/@prisma/adapter-pg

EXPOSE 8000

CMD ["node", "dist/server.js"]
