import { PrismaClient } from '@prisma/client';

/**
 * Prisma client singleton — safe for Next.js HMR hot-reload.
 * In development, attaches to globalThis to survive module cache invalidation.
 * In production, creates a fresh instance per process.
 */
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
