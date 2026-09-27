# BRIEFING — 2026-09-27T08:46:00Z

## Mission
Implement Phase 2 (T1 Core) of DOGFOOD 2026: public gallery at GET /projects, submission close check at POST /api/projects, login at GET /login & POST /api/auth/login, and .dogfood.toml configuration. Pass all T1 acceptance checks cleanly.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: d:\TP\Hackathon\DogFood\.agents\teamwork\worker_phase2
- Original parent: 186d10b4-86b5-46d2-b95c-554f456fd6cf
- Milestone: Phase 2 (T1 Core)

## 🔒 Key Constraints
- Exclusive write ownership:
  - src/app/projects/page.tsx
  - src/app/api/projects/route.ts
  - src/app/login/page.tsx
  - src/app/api/auth/login/route.ts
  - .dogfood.toml
- Do NOT touch other files unless strictly necessary.
- MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. No hardcoded test results, facade implementations, or circumventing tasks.
- Windows PowerShell 5.1 syntax: sequential commands with `;`, never `&&` or `||`.
- Port 8080 for application.
- Must verify via npm run typecheck and npm run build.
- Must pass T1 checks in Hack_docs/run.py.

## Current Parent
- Conversation ID: 186d10b4-86b5-46d2-b95c-554f456fd6cf
- Updated: not yet

## Task Summary
- **What to build**:
  1. `src/app/projects/page.tsx`: Server Component, public gallery, queries `prisma.project.findMany({ take: 40, orderBy: { id: 'asc' }, include: { team: true, track: true } })`, renders titles prominently ("Glass Signal", "Small Meadow", "Deep Compass").
  2. `src/app/api/projects/route.ts`: POST endpoint, authenticates with `getSession(req)`, validates with Zod, checks `event.submissionsClose < new Date()`, returns 409 Conflict.
  3. `src/app/login/page.tsx` & `src/app/api/auth/login/route.ts`: Hand-rolled auth login, email lookup, session token persistence & cookie setting.
  4. `.dogfood.toml`: Config with base_url, claimed T1/T2, seeded tokens, and routes including judge_a user ID.
- **Success criteria**:
  - `npm run typecheck` passes with 0 errors. (VERIFIED)
  - `npm run build` succeeds cleanly. (VERIFIED)
  - `python Hack_docs/run.py .dogfood.toml` passes all 3 T1 checks. (VERIFIED)
- **Interface contracts**: `Hack_docs/spec.md`, `Hack_docs/run.py`
- **Code layout**: Next.js 14 App Router in `src/app/`

## Key Decisions Made
- Used Next.js Server Component with `export const dynamic = 'force-dynamic'` for `/projects` to ensure server-rendered HTML for `run.py` without auth requirement.
- Ordered projects by `id: 'asc'` to ensure first fixture projects (`prj_01` Glass Signal, `prj_02` Small Meadow, `prj_03` Deep Compass) are always included in top 40.
- For `POST /api/projects`, authenticate participant/organizer/admin via `getSession(req)`, reject with 401 if missing session, 403 if invalid role, validate payload, and reject with 409 when `event.submissionsClose < new Date()`.
- For `POST /api/auth/login`, find user by email (case-insensitive/trimmed), return 401 if not found, find or create valid session in `prisma.session`, and set `session` cookie with `httpOnly: true, path: '/', sameSite: 'lax', secure: false, maxAge: 30 * 24 * 60 * 60`.
- Created `.dogfood.toml` specifying `user_jdg_a_01` as judge_a's actual DB userId in `peer_scores`.

## Artifact Index
- `src/app/projects/page.tsx` — Public project gallery
- `src/app/api/projects/route.ts` — Project submission & deadline check API
- `src/app/login/page.tsx` — Login interface
- `src/app/api/auth/login/route.ts` — Authentication login API endpoint
- `.dogfood.toml` — Platform contract & checker configuration

## Change Tracker
- **Files modified**:
  - `src/app/projects/page.tsx`: Created server component for public gallery with shadcn/ui Card grid and fixture project titles
  - `src/app/api/projects/route.ts`: Created submission endpoint with participant session auth, Zod validation, and deadline enforcement
  - `src/app/login/page.tsx`: Created client login page with demo account shortcuts and error handling
  - `src/app/api/auth/login/route.ts`: Created login API with database email lookup, session generation, and cookie dispatch
  - `.dogfood.toml`: Created portal configuration with seeded credentials and routes
- **Build status**: Pass (npm run typecheck, npm run lint, and npm run build all exit 0)
- **Pending issues**: None

## Quality Status
- **Build/test result**: PASS. All 3 T1 acceptance checks pass cleanly in `Hack_docs/run.py`.
- **Lint status**: 0 errors, 0 warnings.
- **Tests added/modified**: Verified via end-to-end HTTP requests and `Hack_docs/run.py`.

## Loaded Skills
- None requested specifically in dispatch
