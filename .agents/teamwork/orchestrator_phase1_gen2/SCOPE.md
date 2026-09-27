# Scope: Phase 1 (Foundation) — Gen 2

## Architecture
- Framework: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui.
- Database: SQLite with Prisma ORM 5.22.0. Database URL: `file:./prisma/dogfood.db` locally, `file:/data/dogfood.db` in Docker.
- Auth: Cookie-based session authentication (`session=<token>`). Hardcoded test tokens for offline testing.
- Math/Scoring: Modified Z-Score normalisation per judge using Median Absolute Deviation (MAD), with zero-variance protection.
- Containerization: Multi-stage Dockerfile (node:20-alpine), entrypoint.sh (migrate deploy + seed + node server.js), docker-compose.yml exposing port 8080.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Next.js 14 Scaffold & Dependencies | App Router, TS, Tailwind, pinned Prisma, 15 shadcn components | M1 (DONE) | ORIGINAL_REQUEST §R1 |
| 2 | Prisma Schema & SQLite Migration | 11 models with exact field names, relations, initial migration | M2 | ORIGINAL_REQUEST §R2 |
| 3 | Prisma Singleton | Safe for Next.js HMR in `src/lib/prisma.ts` | M3 | ORIGINAL_REQUEST §R4 |
| 4 | Auth Session Helpers | `getSession` and `SessionUser` in `src/lib/auth.ts` | M3 | ORIGINAL_REQUEST §R4 |
| 5 | MAD Normalisation | `normaliseJudgeScores` with zero-variance check in `src/lib/normalization.ts` | M3 | ORIGINAL_REQUEST §R4 |
| 6 | Seed Script | Idempotent seed from `fixtures.json`, 4 test users, deterministic output in `src/lib/seed.ts` | M3 | ORIGINAL_REQUEST §R3 |
| 7 | Docker Containerization | Multi-stage Dockerfile, entrypoint.sh, docker-compose.yml on port 8080 | M4 | ORIGINAL_REQUEST §R5 |
| 8 | Config Files & Verification | `.env`, `.env.example`, `.gitignore`, `LICENSE` | M4/M5 | ORIGINAL_REQUEST §R6 |
| 9 | Verification & Progress Commit | Full verification triad, acceptance checks, PROGRESS.md update, git commit | M5 | ORIGINAL_REQUEST §R7 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Scaffold & Dependencies | Next.js 14, pinned deps, shadcn, standalone build | none | DONE |
| 2 | Prisma Schema & Migration | 11 models in `prisma/schema.prisma`, `npx prisma generate`, `npx prisma migrate dev --name init --skip-seed` | M1 | IN_PROGRESS |
| 3 | Auth, Normalization & Seed | `src/lib/prisma.ts`, `src/lib/auth.ts`, `src/lib/normalization.ts`, `src/lib/seed.ts` | M2 | PLANNED |
| 4 | Docker Containerization | `Dockerfile`, `entrypoint.sh`, `docker-compose.yml`, `.env`, `.env.example`, `.gitignore`, `LICENSE` | M3 | PLANNED |
| 5 | Acceptance Verification & Commit | Acceptance checks, `PROGRESS.md`, git commit, report to Sentinel | M4 | PLANNED |

## Interface Contracts
### Database ↔ Application
- Models: `User`, `Session`, `Event`, `Track`, `Team`, `TeamMember`, `Project`, `RubricCriterion`, `JudgeAssignment`, `Score`, `AuditLog`.
- SQLite Provider: `env("DATABASE_URL")`.

### Auth Contract (`src/lib/auth.ts`)
- `export type SessionUser = { id: string; email: string; name: string; role: 'visitor' | 'participant' | 'judge' | 'organizer' | 'admin'; judgeId?: string }`
- `export async function getSession(req: NextRequest): Promise<SessionUser | null>`

### Normalization Contract (`src/lib/normalization.ts`)
- `export function normaliseJudgeScores(scores: number[]): number[]`
- If MAD === 0, returns `scores.map(() => 0)` (zero-variance).

### Seed Contract (`src/lib/seed.ts`)
- Reads `Hack_docs/fixtures.json`.
- Outputs exact 4-line deterministic token block.
- Idempotent upserts.
