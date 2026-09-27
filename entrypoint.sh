#!/bin/sh
set -e

echo "=== DOGFOOD 2026 Portal Starting ==="

echo "[1/3] Running database migrations..."
npx prisma migrate deploy

echo "[2/3] Seeding database from fixtures..."
tsx src/lib/seed.ts

echo "[3/3] Starting Next.js on port 8080..."
exec node server.js
