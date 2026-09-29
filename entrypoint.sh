#!/bin/sh
set -e

echo "=== DOGFOOD 2026 Portal Starting ==="

# Ensure data directory exists for SQLite database
mkdir -p /data

echo "[1/3] Synchronizing database schema..."
npx prisma db push --accept-data-loss --skip-generate

echo "[2/3] Seeding database from fixtures..."
npx tsx src/lib/seed.ts

echo "[3/3] Starting Next.js on port 8080..."
exec node server.js
