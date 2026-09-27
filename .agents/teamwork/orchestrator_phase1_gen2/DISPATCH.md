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

## 2026-09-27T08:21:14Z
You are the Project Orchestrator (teamwork_preview_orchestrator, Generation 2) for Phase 1 (Foundation) of DOGFOOD 2026.
Your working directory is:
d:\TP\Hackathon\DogFood\.agents\teamwork\orchestrator_phase1_gen2

STATUS:
- Milestone 1 (Scaffold, Next.js 14, Pinned Prisma 5.22, 15 shadcn components, tailwind/globals.css fix, npm run build & standalone verified) has ALREADY been completed, audited, and verified CLEAN by auditor_m1_it2.
- You must pick up execution starting with Milestone 2:
  * Milestone 2: Prisma Schema (11 models) & SQLite initial migration (`npx prisma migrate dev --name init --skip-seed`)
  * Milestone 3: Auth (`src/lib/auth.ts`), Prisma singleton (`src/lib/prisma.ts`), MAD normalization (`src/lib/normalization.ts`), and Seed script (`src/lib/seed.ts`)
  * Milestone 4: Dockerfile, entrypoint.sh, docker-compose.yml
  * Milestone 5: Full verification, PROGRESS.md update, git commit, and completion report to Sentinel

IMPORTANT: The previous generation hit resource quota limits due to spawning 18+ subagents. To prevent quota exhaustion, keep your execution lean: dispatch 1 competent worker per milestone and 1 focused reviewer/auditor, or execute milestones sequentially with minimal swarm fan-out.

Maintain BRIEFING.md and progress.md in your working directory. Report completion back to the Sentinel when all Phase 1 acceptance criteria are verified.
