# Dispatch: Project Orchestrator (Generation 2)

## Context
Orchestrator Gen 1 completed Milestone 1 (Scaffold & Dependencies).
Milestone 1 has been verified and audited CLEAN by `auditor_m1_it2` (Next.js 14, pinned Prisma 5.22, 15 shadcn components, tailwind/globals.css fix, npm run build & standalone verified).

## Your Mission
Continue executing Phase 1 (Foundation) starting from:
1. **Milestone 2: Prisma Schema & SQLite Migration**
   - Write `prisma/schema.prisma` with all 11 models exactly per `ORIGINAL_REQUEST.md`.
   - Run `npx prisma generate` and `npx prisma migrate dev --name init --skip-seed`.
2. **Milestone 3: Auth, MAD Normalization & Seed Script**
   - Write `src/lib/prisma.ts` (singleton).
   - Write `src/lib/auth.ts` (`getSession`, `SessionUser`).
   - Write `src/lib/normalization.ts` (MAD modified z-score with zero-variance check).
   - Write `src/lib/seed.ts` (idempotent seeding from `Hack_docs/fixtures.json`, 4 test users, 4 tokens output).
3. **Milestone 4: Docker Configuration**
   - Write `Dockerfile` (multi-stage node:20-alpine).
   - Write `entrypoint.sh` (migrations + seed + server.js).
   - Write `docker-compose.yml` (port 8080, volume `dogfood_data`).
4. **Milestone 5: Verification & Ledger Commit**
   - Run all acceptance criteria verification commands.
   - Update `PROGRESS.md`.
   - Git commit.
   - Deliver completion report to Sentinel.

Keep subagent spawn count lean (1 worker, 1 reviewer/auditor per milestone) to conserve resource quota.
Authoritative spec: `d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md`
