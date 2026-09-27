# Dispatch: Worker M2 — Prisma Schema & SQLite Migration

## Working Directory
`d:\TP\Hackathon\DogFood\.agents\teamwork\worker_m2`

## Authoritative Reference
- `d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md` (MUST read before starting)
- Project directory: `d:\TP\Hackathon\DogFood`

## Objective
Implement Milestone 2:
1. Write `prisma/schema.prisma` in `d:\TP\Hackathon\DogFood\prisma\schema.prisma` with all 11 required models exactly as specified in `ORIGINAL_REQUEST.md § R2`:
   - `User`
   - `Session`
   - `Event`
   - `Track`
   - `Team`
   - `TeamMember`
   - `Project`
   - `RubricCriterion`
   - `JudgeAssignment`
   - `Score`
   - `AuditLog`
   Ensure provider is `sqlite` and url is `env("DATABASE_URL")`.
2. Generate Prisma client:
   `npx prisma generate`
3. Create and execute the initial SQLite migration:
   `npx prisma migrate dev --name init --skip-seed`
   (Note: Use Windows PowerShell 5.1 syntax).
4. Verify schema validity:
   `npx prisma validate`
5. Verify that the migration folder was created under `prisma/migrations/` and SQLite database was created (or initialized). Also run `npm run typecheck` (`npx tsc --noEmit`) to ensure clean compilation.

## File Ownership
- Sole write ownership of:
  - `prisma/schema.prisma`
  - `prisma/migrations/*`
  - `prisma/dogfood.db` (created by migration)
  - `src/` files should NOT be modified unless necessary for Prisma imports.
- Do NOT delete or modify `Hack_docs/`, `PROGRESS.md`, or `Claude_chats.txt`.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Completion Criteria
1. `prisma/schema.prisma` exists and contains all 11 models with all fields and relations exactly as defined in R2.
2. `npx prisma validate` exits 0.
3. `npx prisma migrate dev --name init --skip-seed` executes successfully and creates migration in `prisma/migrations/`.
4. `npm run typecheck` passes with 0 errors.
5. Write your handoff report to `d:\TP\Hackathon\DogFood\.agents\teamwork\worker_m2\handoff.md` and send a message back to the orchestrator.

## 2026-09-27T08:22:35Z
You are worker_m2, assigned to implement Milestone 2 (Prisma Schema & SQLite Migration) for DOGFOOD 2026.

Your working directory is:
d:\TP\Hackathon\DogFood\.agents\teamwork\worker_m2

You MUST read the authoritative user request at:
d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md
And your detailed dispatch instructions at:
d:\TP\Hackathon\DogFood\.agents\teamwork\worker_m2\DISPATCH.md

Scope & Tasks:
1. Write `prisma/schema.prisma` with all 11 models exactly per `ORIGINAL_REQUEST.md § R2`: User, Session, Event, Track, Team, TeamMember, Project, RubricCriterion, JudgeAssignment, Score, AuditLog.
2. Run `npx prisma generate` in `d:\TP\Hackathon\DogFood`.
3. Run `npx prisma migrate dev --name init --skip-seed` in `d:\TP\Hackathon\DogFood`.
4. Run `npx prisma validate` and `npm run typecheck`.
5. Verify that `prisma/migrations/` has the new migration file and that the SQLite DB is created without errors.
6. Write your detailed handoff report to `d:\TP\Hackathon\DogFood\.agents\teamwork\worker_m2\handoff.md`.
7. Send a message to the orchestrator with your results.
