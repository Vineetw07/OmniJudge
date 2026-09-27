# Scope: Phase 2 — T1 Core

## Architecture
- Framework: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui.
- Database: SQLite via Prisma client singleton (`src/lib/prisma.ts`).
- Auth: Cookie session (`src/lib/auth.ts`) reading `Cookie: session=<token>`.
- Port: 8080 (`next dev -p 8080`).
- T1 Core Requirements:
  - Public Project Gallery at `GET /projects` (`src/app/projects/page.tsx`) — public, no auth, displays seeded projects ("Glass Signal", "Small Meadow", "Deep Compass").
  - Submission Close Enforcement at `POST /api/projects` (`src/app/api/projects/route.ts`) — validates Zod body, requires authenticated participant session, checks event `submissionsClose` against `Date.now()`, returns 409 or 403 when event is closed.
  - Login Page and API Route at `GET /login` (`src/app/login/page.tsx`) and `POST /api/auth/login` (`src/app/api/auth/login/route.ts`) — accepts email, finds user in DB, retrieves token from Session table, sets `session` cookie, returns 401 on unknown email.
  - Configuration file `.dogfood.toml` at repo root with `[portal]`, `[tiers]`, `[auth]`, `[routes]` matching `Hack_docs/example.dogfood.toml` and seeded session tokens, with `peer_scores` containing the actual DB `userId` of `judge_a`.
  - Ledger & Commit: Mark Phase 2 items in `PROGRESS.md`, commit with "[PROGRESS] Phase 2: T1 gallery, submit close, login, .dogfood.toml — Phase 3 T2 judging next".

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Public Project Gallery | Server component at `src/app/projects/page.tsx` rendering seeded project titles | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Submission Close Check | API route `POST /api/projects` rejecting submissions when closed (409/403) with Zod & auth check | M2 | ORIGINAL_REQUEST §R2 |
| 3 | Login Page & API | `GET /login` and `POST /api/auth/login` setting cookie session for user | M3 | ORIGINAL_REQUEST §R3 |
| 4 | .dogfood.toml Config | `.dogfood.toml` with seeded tokens, routes, and judge_a user ID | M4 | ORIGINAL_REQUEST §R4 |
| 5 | T1 Acceptance & Commit | Verify T1 with `run.py`, typecheck, build, update `PROGRESS.md`, git commit | M4 | ORIGINAL_REQUEST §R5 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 0 | Survey & Orientation | Comprehensive orientation, inspecting current git, files, spec, and run.py | none | IN_PROGRESS |
| 1 | Public Gallery (R1) | `src/app/projects/page.tsx` | M0 | PLANNED |
| 2 | Submission Close (R2) | `src/app/api/projects/route.ts` | M0 | PLANNED |
| 3 | Login Flow (R3) | `src/app/login/page.tsx`, `src/app/api/auth/login/route.ts` | M0 | PLANNED |
| 4 | .dogfood.toml & T1 Verification (R4, R5) | `.dogfood.toml`, typecheck, build, run.py T1 checks, PROGRESS.md, commit | M1, M2, M3 | PLANNED |

## Interface Contracts
### Public Gallery (`GET /projects`)
- Endpoint: `/projects`
- Auth: None (public 200 OK)
- Response: HTML containing project titles ("Glass Signal", "Small Meadow", "Deep Compass")
- Query: `prisma.project.findMany({ take: 40, include: { team: true, track: true } })`

### Submission API (`POST /api/projects`)
- Endpoint: `/api/projects`
- Auth: `getSession(req)` must return user with `role === 'participant'` (or non-null participant). If unauthenticated -> 401.
- Event status: Query `prisma.event.findFirst()`. If `event.submissionsClose < new Date()` -> return 409 (or 403).
- Schema: Zod schema with `title` (min 1), `summary` (min 1), `repoUrl` (url optional/string), `trackId` (string).

### Login API (`POST /api/auth/login`)
- Endpoint: `/api/auth/login`
- Body: `{ email: string }`
- Logic: Find user by email. If not found -> 401. Find active session for user from `Session` table.
- Set-Cookie: `session=<token>; Path=/; HttpOnly; SameSite=Lax`

### .dogfood.toml
- `peer_scores = "/api/judge/scores?judge=<judge_a_user_id>"`
- Judge A email in `seed.ts`: check seed.ts for exact email (e.g. `judge_a@dogfood.dev` or from fixtures) and user id.
