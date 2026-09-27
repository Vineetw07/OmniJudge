# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma client
RUN npx prisma generate
# Build Next.js (produces .next/standalone)
RUN npm run build

# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV DATABASE_URL=file:/data/dogfood.db
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Copy standalone build output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma schema and engine files for migrations and seeds
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/Hack_docs/fixtures.json ./Hack_docs/fixtures.json
COPY --from=builder /app/src/lib/seed.ts ./src/lib/seed.ts
COPY --from=builder /app/node_modules ./node_modules

COPY entrypoint.sh ./entrypoint.sh
RUN sed -i 's/\r$//' ./entrypoint.sh && chmod +x ./entrypoint.sh

EXPOSE 8080
CMD ["./entrypoint.sh"]
