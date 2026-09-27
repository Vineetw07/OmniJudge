# Scope: Phase 1 — Foundation

## Architecture
- Framework: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- UI Library: shadcn/ui (14 canonical components)
- Database & ORM: SQLite + Prisma
- Authentication: Cookie-based session tokens (`Session` table lookup)
- Mathematical Utility: MAD-based modified Z-score normalisation
- Containerization: Single-service multi-stage Docker container (node:20-alpine) with persistent volume for SQLite DB
- Port: 8080 (not 3000)

## Code Layout
- `package.json`, `tsconfig.json`, `next.config.js` / `next.config.mjs`
- `prisma/schema.prisma`, `prisma/migrations/`
- `src/lib/prisma.ts` — Prisma client singleton
- `src/lib/auth.ts` — getSession helper & SessionUser type
- `src/lib/normalization.ts` — normaliseJudgeScores using MAD
- `src/lib/seed.ts` — Idempotent fixture loader & test session printer
- `Dockerfile`, `docker-compose.yml`, `entrypoint.sh`
- `.env`, `.env.example`, `.gitignore`, `LICENSE`
- `PROGRESS.md`

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Next.js 14 Scaffold | create-next-app with TypeScript, Tailwind, App Router, src dir, alias @/* | M1 | R1 |
| 2 | Production Dependencies | prisma, @prisma/client, zod, framer-motion, lucide-react, cva, clsx, tailwind-merge | M1 | R1 |
| 3 | shadcn/ui Components | button, card, badge, input, label, textarea, select, table, dialog, sheet, tabs, avatar, progress, separator, dropdown-menu | M1 | R1 |
| 4 | Dev Dependencies & Scripts | tsx, better-sqlite3, @types/better-sqlite3, @types/node; dev/build/start/seed/db:migrate/db:push/typecheck scripts | M1 | R1 |
| 5 | Supporting Config Files | .env, .env.example, .gitignore, LICENSE (MIT 2026) | M1 | R6 |
| 6 | Prisma Data Model | 11 models (User, Session, Event, Track, Team, TeamMember, Project, RubricCriterion, JudgeAssignment, Score, AuditLog) | M2 | R2 |
| 7 | Prisma Client & Migration | npx prisma generate, npx prisma migrate dev --name init --skip-seed | M2 | R2 |
| 8 | Prisma Singleton | src/lib/prisma.ts safe for Next.js HMR | M3 | R4 |
| 9 | Session Auth Helper | src/lib/auth.ts with SessionUser and getSession(req) | M3 | R4 |
| 10 | MAD Normalisation | src/lib/normalization.ts with normaliseJudgeScores handling zero-variance judge | M3 | R4 |
| 11 | Fixtures Seed Script | src/lib/seed.ts loading fixtures.json, upserting all records, 4 test users, deterministic tokens output | M3 | R3 |
| 12 | Docker Configuration | Dockerfile (multi-stage node:20-alpine, standalone), entrypoint.sh, docker-compose.yml | M4 | R5 |
| 13 | Standalone Build Output | output: 'standalone' in next.config | M4 | R5 |
| 14 | Acceptance Verification & Ledger | Acceptance criteria verification, PROGRESS.md update, git commit | M5 | R7 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Scaffold & Dependencies | Next.js 14 scaffold, all npm dependencies, shadcn/ui components, package.json scripts, .env, .gitignore, LICENSE | none | PLANNED |
| M2 | Prisma Schema & Migration | prisma/schema.prisma with 11 models, prisma generate, prisma migrate dev init | M1 | PLANNED |
| M3 | Utilities & Seed Script | prisma.ts, auth.ts, normalization.ts, seed.ts, test seed execution & token verification | M2 | PLANNED |
| M4 | Docker & Standalone Setup | next.config standalone, Dockerfile, entrypoint.sh, docker-compose.yml, docker smoke test | M3 | PLANNED |
| M5 | Acceptance Verification & Commit | Full verification of all acceptance criteria, PROGRESS.md update, git commit | M4 | PLANNED |

## Interface Contracts
### Auth Helper (`src/lib/auth.ts`)
- `type SessionUser = { id: string; email: string; name: string; role: 'visitor' | 'participant' | 'judge' | 'organizer' | 'admin'; judgeId?: string }`
- `function getSession(req: NextRequest): Promise<SessionUser | null>`
- Reads `Cookie` header for `session=<token>`, joins User, checks expiresAt > now. Populates `judgeId` if role === 'judge'.

### MAD Normalisation (`src/lib/normalization.ts`)
- `function normaliseJudgeScores(scores: number[]): number[]`
- If scores length == 0 return []
- If MAD == 0 return scores.map(() => 0)
- Formula: 0.6745 * (s - median) / MAD

### Seed Script Output (`src/lib/seed.ts`)
- Output exact 4-line block:
```
seeded. test logins:
  organizer    Cookie: session=org_seed_token_2026
  judge_a      Cookie: session=jdg_a_seed_token_2026
  judge_b      Cookie: session=jdg_b_seed_token_2026
  participant  Cookie: session=prt_seed_token_2026
```
