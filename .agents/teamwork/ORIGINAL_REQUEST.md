# Original User Request

## 2026-09-27T06:33:19Z

Build Phase 1 (Foundation) of DOGFOOD 2026, a self-hostable hackathon submission and judging platform. This phase scaffolds the entire Next.js 14 project, installs all dependencies upfront, writes the Prisma schema, seed script, auth helpers, MAD normalisation utility, and Docker configuration — producing a running container that seeds from `fixtures.json` and prints 4 session tokens to stdout.

Working directory: `d:\TP\Hackathon\DogFood`
Integrity mode: development

---

## Context & Reference Files (READ THESE FIRST)

All agents must read these files before writing any code:

- **Build plan (source of truth):** `C:\Users\ASUS\.gemini\antigravity\brain\7c871d10-288a-40a1-9a0f-03c7759d4999\dogfood_build_plan.md`
- **Live progress ledger:** `d:\TP\Hackathon\DogFood\PROGRESS.md`
- **Hackathon spec:** `d:\TP\Hackathon\DogFood\Hack_docs\spec.md`
- **Acceptance checker (run.py):** `d:\TP\Hackathon\DogFood\Hack_docs\run.py`
- **Shared fixture data:** `d:\TP\Hackathon\DogFood\Hack_docs\fixtures.json`
- **Example TOML config:** `d:\TP\Hackathon\DogFood\Hack_docs\example.dogfood.toml`
- **Backend rules:** `C:\Users\ASUS\.gemini\backend-rules.md`
- **Frontend rules:** `C:\Users\ASUS\.gemini\frontend-rules.md`

---

## Agent Persona

Act as a **Principal Infrastructure Engineer with 20+ years of experience** in DevOps, containerisation, monorepo bootstrapping, and database architecture. Your decisions here determine whether the entire project can even run. Be paranoid about reproducibility. Optimise for "works on the judge's machine with the network off", not for elegance.

---

## Platform Constraints (Non-Negotiable)

- **OS:** Windows 10/11, PowerShell 5.1
- **Shell syntax:** Use `;` NOT `&&` between commands. Never use `rm -rf` (use `Remove-Item -Recurse -Force`). Never use `touch` (use `New-Item -ItemType File -Force`).
- **Non-interactive flags:** Always pass `-y`, `--yes`, `--no-input` to CLI commands
- **Node.js version:** v22.19.0 is confirmed installed
- **Port:** Application must run on **port 8080** (not 3000)
- **Network:** Must work fully offline (`docker compose up` with no internet). No external auth, no cloud DB, no hosted APIs.

---

## Requirements

### R1. Project Scaffold & Full Dependency Installation

Scaffold a Next.js 14 (App Router) + TypeScript project at `d:\TP\Hackathon\DogFood` and install **all dependencies the entire 6-phase project will ever need** — upfront, in this phase. No later phase should need to `npm install` anything new.

IMPORTANT: The directory already contains: `Hack_docs/` folder, `PROGRESS.md`, and `Claude_chats.txt`. Do NOT delete these. Run `create-next-app` with the `.` target — it will scaffold into the existing directory.

Run in sequence (PowerShell 5.1, separate commands):
```
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git --yes
```
Then:
```
npm install prisma @prisma/client zod framer-motion lucide-react class-variance-authority clsx tailwind-merge
```
Then:
```
npx shadcn-ui@latest init --yes
```
Then:
```
npx shadcn-ui@latest add button card badge input label textarea select table dialog sheet tabs avatar progress separator dropdown-menu --yes
```
Then:
```
npm install -D tsx better-sqlite3 @types/better-sqlite3 @types/node
```
Then:
```
npx prisma init --datasource-provider sqlite
```

The `package.json` must contain these exact scripts:
```json
{
  "dev": "next dev -p 8080",
  "build": "next build",
  "start": "next start -p 8080",
  "seed": "npx tsx src/lib/seed.ts",
  "db:migrate": "npx prisma migrate dev",
  "db:push": "npx prisma db push",
  "typecheck": "tsc --noEmit"
}
```

### R2. Prisma Schema (SQLite)

Write `prisma/schema.prisma` with the following models. Use `sqlite` provider. The `DATABASE_URL` env var must be `file:/data/dogfood.db` in Docker and `file:./prisma/dogfood.db` locally.

Required models with exact field names:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  role      String
  createdAt DateTime @default(now())
  sessions         Session[]
  teamMember       TeamMember?
  judgeAssignments JudgeAssignment[]
  scores           Score[]
  auditLogs        AuditLog[]
}

model Session {
  id        String   @id
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())
  expiresAt DateTime
}

model Event {
  id               String   @id
  name             String
  submissionsClose DateTime
  createdAt        DateTime @default(now())
  tracks   Track[]
  projects Project[]
}

model Track {
  id      String @id
  name    String
  eventId String
  event   Event  @relation(fields: [eventId], references: [id])
  projects         Project[]
  judgeAssignments JudgeAssignment[]
}

model Team {
  id       String       @id
  name     String
  members  TeamMember[]
  projects Project[]
}

model TeamMember {
  id     String @id @default(cuid())
  userId String @unique
  teamId String
  user   User   @relation(fields: [userId], references: [id])
  team   Team   @relation(fields: [teamId], references: [id])
}

model Project {
  id          String   @id
  teamId      String
  trackId     String
  eventId     String
  title       String
  summary     String
  repoUrl     String
  submittedAt DateTime
  isDraft     Boolean  @default(false)
  team   Team    @relation(fields: [teamId], references: [id])
  track  Track   @relation(fields: [trackId], references: [id])
  event  Event   @relation(fields: [eventId], references: [id])
  scores Score[]
}

model RubricCriterion {
  id       String  @id @default(cuid())
  name     String
  weight   Float   @default(1.0)
  maxScore Int     @default(5)
  scores   Score[]
}

model JudgeAssignment {
  id      String @id @default(cuid())
  userId  String
  trackId String
  user    User   @relation(fields: [userId], references: [id])
  track   Track  @relation(fields: [trackId], references: [id])
}

model Score {
  id          String   @id @default(cuid())
  judgeId     String
  projectId   String
  criterionId String
  value       Float
  comment     String   @default("")
  submittedAt DateTime @default(now())
  judge     User            @relation(fields: [judgeId], references: [id])
  project   Project         @relation(fields: [projectId], references: [id])
  criterion RubricCriterion @relation(fields: [criterionId], references: [id])
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  action    String
  payload   String   @default("{}")
  createdAt DateTime @default(now())
  user User @relation(fields: [userId], references: [id])
}
```

After writing schema, run:
```
npx prisma generate
```
Then:
```
npx prisma migrate dev --name init --skip-seed
```

### R3. Seed Script (`src/lib/seed.ts`)

Write a seed script that:

1. Reads `Hack_docs/fixtures.json` relative to the project root (`process.cwd()` or `path.join(__dirname, '../../Hack_docs/fixtures.json')`)
2. Upserts the single Event, all Tracks (8), all Teams (40), all Projects (40) using fixture IDs as primary keys
3. Upserts all 30 judges as Users with `role = 'judge'` — email from fixture, name from fixture, id from fixture id field. Creates JudgeAssignment records for each judge+track pair in their `tracks` array.
4. Creates 4 default RubricCriteria via upsert (find-or-create by name): `functionality` (weight: 1.5), `quality` (weight: 1.0), `creativity` (weight: 1.0), `presentation` (weight: 0.5)
5. Upserts all scores from fixtures. For each score entry, match the criterion by name (e.g., `"functionality"` maps to the `functionality` criterion). If a score entry has multiple criteria keys, insert one Score row per criterion.
6. Creates exactly **4 test users** with **deterministic, hardcoded session tokens** (same every run — not random):

```typescript
const TEST_USERS = [
  { id: 'user_org_01', email: 'organizer@dogfood.dev', name: 'Organizer', role: 'organizer', token: 'org_seed_token_2026' },
  { id: 'user_jdg_a_01', email: 'judge_a@dogfood.dev', name: 'Judge Alpha', role: 'judge', token: 'jdg_a_seed_token_2026' },
  { id: 'user_jdg_b_01', email: 'judge_b@dogfood.dev', name: 'Judge Beta', role: 'judge', token: 'jdg_b_seed_token_2026' },
  { id: 'user_prt_01', email: 'participant@dogfood.dev', name: 'Participant', role: 'participant', token: 'prt_seed_token_2026' },
];
```

Session `expiresAt` = 365 days from seed time.

Assign judge_a to track `trk_01` and judge_b to track `trk_02` as their JudgeAssignment records.

7. Prints to stdout **exactly**:
```
seeded. test logins:
  organizer    Cookie: session=org_seed_token_2026
  judge_a      Cookie: session=jdg_a_seed_token_2026
  judge_b      Cookie: session=jdg_b_seed_token_2026
  participant  Cookie: session=prt_seed_token_2026
```

The script must be idempotent — running twice produces no duplicates (use `upsert` everywhere).

### R4. Auth, Prisma Singleton & Normalisation Utilities

**`src/lib/prisma.ts`** — Prisma client singleton safe for Next.js HMR:
```typescript
import { PrismaClient } from '@prisma/client';
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

**`src/lib/auth.ts`** — Must export:
- `SessionUser` type: `{ id: string; email: string; name: string; role: 'visitor' | 'participant' | 'judge' | 'organizer' | 'admin'; judgeId?: string }`
- `async function getSession(req: NextRequest): Promise<SessionUser | null>` — reads `Cookie` header for `session=<token>`, queries Session table joined with User, checks `session.expiresAt > new Date()`, returns null if missing/expired. If user role is `judge`, populates `judgeId` with `user.id`.

**`src/lib/normalization.ts`** — Modified z-score using MAD:
```typescript
/**
 * Modified Z-Score normalisation per judge.
 * Uses Median Absolute Deviation (MAD) instead of std-dev.
 * IMPORTANT: The fixtures.json deliberately includes a judge (jdg_30, Rafa Okonkwo)
 * who gave EVERY project the same score. Standard z-score would divide by zero (std=0).
 * MAD also equals 0 in this case. We return 0 for all scores when MAD=0,
 * treating the judge as providing no discriminating signal.
 * Formula when MAD > 0: modified_z = 0.6745 * (x - median) / MAD
 */
export function normaliseJudgeScores(scores: number[]): number[] {
  if (scores.length === 0) return [];
  const sorted = [...scores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const deviations = scores.map(s => Math.abs(s - median));
  const sortedDevs = [...deviations].sort((a, b) => a - b);
  const mad = sortedDevs.length % 2 !== 0 ? sortedDevs[mid] : (sortedDevs[mid - 1] + sortedDevs[mid]) / 2;
  if (mad === 0) return scores.map(() => 0);
  return scores.map(s => (0.6745 * (s - median)) / mad);
}
```

### R5. Docker Configuration

**`Dockerfile`** — Multi-stage build, node:20-alpine:
```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_URL=file:/data/dogfood.db
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/Hack_docs/fixtures.json ./Hack_docs/fixtures.json
COPY --from=builder /app/src/lib/seed.ts ./src/lib/seed.ts
RUN apk add --no-cache nodejs npm
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
EXPOSE 8080
CMD ["./entrypoint.sh"]
```

IMPORTANT: Add `output: 'standalone'` to `next.config.js`/`next.config.ts` for the standalone build to work.

**`entrypoint.sh`**:
```sh
#!/bin/sh
set -e
echo "Running database migrations..."
npx prisma migrate deploy
echo "Seeding database..."
npx tsx src/lib/seed.ts
echo "Starting portal on port 8080..."
exec node server.js
```

**`docker-compose.yml`**:
```yaml
version: '3.8'
services:
  portal:
    build: .
    ports:
      - "8080:8080"
    volumes:
      - dogfood_data:/data
    environment:
      - DATABASE_URL=file:/data/dogfood.db
      - NODE_ENV=production
    restart: unless-stopped
volumes:
  dogfood_data:
```

### R6. Supporting Config Files

- **`.env`**: `DATABASE_URL="file:./prisma/dogfood.db"`
- **`.env.example`**: `DATABASE_URL="file:./prisma/dogfood.db"`
- **`.gitignore`**: Ensure these are ignored: `node_modules`, `.next`, `.env`, `prisma/*.db`, `prisma/*.db-journal`, `prisma/*.db-wal`. Keep `.env.example` tracked.
- **`LICENSE`**: Full MIT license text, year 2026, name "DOGFOOD 2026 Contributors"

### R7. Progress Ledger Update

After all tasks above are complete and verified:

1. Update `d:\TP\Hackathon\DogFood\PROGRESS.md` — mark all Phase 1 tasks `[x]`, set header to:
   - `Current phase: Phase 2 — T1 Core`
   - `Next task: GET /projects public gallery page (server-rendered HTML, no auth required)`
   - `Checker state: not yet run (.dogfood.toml not yet created)`
   - `Docker state: built and seeded — runs on port 8080`

2. Commit:
```
git -C "d:\TP\Hackathon\DogFood" add .
git -C "d:\TP\Hackathon\DogFood" commit -m "[PROGRESS] Phase 1 complete: scaffold, schema, seed, auth, Docker ready"
```

---

## Acceptance Criteria

### Project Structure
- [ ] `d:\TP\Hackathon\DogFood\src\` directory exists with `app\` and `lib\` subdirectories
- [ ] `d:\TP\Hackathon\DogFood\prisma\schema.prisma` exists and contains all 11 models
- [ ] `npx tsc --noEmit` runs with zero TypeScript errors
- [ ] `npx prisma validate` runs with zero errors
- [ ] `Hack_docs\` folder, `PROGRESS.md`, and `Claude_chats.txt` are still present (not deleted)

### Dependency Installation
- [ ] `node_modules` exists with `framer-motion`, `prisma`, `zod`, `lucide-react` all present
- [ ] `npx prisma generate` runs without errors
- [ ] A migration file exists in `prisma\migrations\` after `prisma migrate dev --name init`

### Seed Script
- [ ] `npx tsx src\lib\seed.ts` completes without errors
- [ ] After seed, SQLite DB contains exactly 40 projects, 30 judge users from fixtures, 8 tracks, 1 event
- [ ] Stdout contains exactly the 4-line token block with the deterministic token strings
- [ ] Running seed a second time does not throw errors or create duplicate records

### Auth & Utilities
- [ ] `src\lib\auth.ts` exports `getSession` function and `SessionUser` type
- [ ] `src\lib\normalization.ts` — `normaliseJudgeScores([3,3,3,3])` returns `[0, 0, 0, 0]` (not NaN, not error)
- [ ] `src\lib\prisma.ts` exports `prisma` singleton

### Docker
- [ ] `docker compose build` completes without errors
- [ ] `docker compose up` starts, runs migrations, runs seed (prints 4 token lines), and serves on port 8080
- [ ] `curl http://localhost:8080` (or PowerShell `Invoke-WebRequest`) returns HTTP 200
- [ ] `docker compose down` then `docker compose up` again — seed runs without duplicating data

### Config Files
- [ ] `.env` exists with `DATABASE_URL` set
- [ ] `.env.example` exists and is committed to git
- [ ] `.gitignore` excludes `node_modules`, `.next`, `.env`, `prisma/*.db`
- [ ] `LICENSE` file contains MIT text

### Progress Ledger
- [ ] `PROGRESS.md` shows all Phase 1 tasks as `[x]`
- [ ] `PROGRESS.md` header shows `Current phase: Phase 2`
- [ ] At least one `[PROGRESS]` commit in git log

---

## Verification Commands

Run these to verify acceptance criteria (PowerShell 5.1):

```powershell
# TypeScript check
npx tsc --noEmit

# Prisma schema validation
npx prisma validate

# Seed idempotency test (run twice, count should be 40 both times)
npx tsx src\lib\seed.ts
npx tsx src\lib\seed.ts

# MAD zero-variance test
node -e "const {normaliseJudgeScores} = require('./src/lib/normalization'); const r = normaliseJudgeScores([3,3,3,3]); console.log(JSON.stringify(r)); if(r.some(isNaN)) throw new Error('MAD returned NaN!')"

# Docker smoke test
docker compose build
docker compose up -d
Start-Sleep -Seconds 15
Invoke-WebRequest -Uri 'http://localhost:8080' -UseBasicParsing | Select-Object StatusCode
docker compose logs portal | Select-String 'Cookie:'

## 2026-09-27T08:33:16Z

Build **Phase 2 — T1 Core** of DOGFOOD 2026, a self-hostable hackathon submission and judging platform. Phase 1 (Next.js 14 App Router, Prisma SQLite schema with 11 models, auth helpers, seed, normalization, Docker config) is fully committed. Phase 2 must pass the 3 T1 acceptance checks.

Working directory: `d:\TP\Hackathon\DogFood`
Integrity mode: development

---

## Context & Constraints

- **Stack (locked):** Next.js 14 App Router + TypeScript, SQLite + Prisma, Tailwind CSS + shadcn/ui, hand-rolled cookie sessions
- **OS:** Windows 10, PowerShell 5.1 — use `;` not `&&`, never `rm -rf` (use `Remove-Item -Recurse -Force`)
- **Port:** 8080 (`next dev -p 8080`)
- **Code freeze:** Mon 28 Sep 2026 18:00 UTC — urgency is high
- **Global rules:**
  - `PROGRESS.md` at repo root is the live state ledger — read it first, update + commit after every task
  - Commit message format: `git commit -m "[PROGRESS] Phase 2: <what done>, <what next>"`
  - Full build plan at: `C:\Users\ASUS\.gemini\antigravity\brain\7c871d10-288a-40a1-9a0f-03c7759d4999\dogfood_build_plan.md`
  - Spec at: `d:\TP\Hackathon\DogFood\Hack_docs\spec.md`
  - Checker: `d:\TP\Hackathon\DogFood\Hack_docs\run.py`
  - Fixtures: `d:\TP\Hackathon\DogFood\Hack_docs\fixtures.json`

---

## Requirements

### R1. Public project gallery at `GET /projects`

Implement a Next.js App Router server component at `src/app/projects/page.tsx` that:
- Returns HTTP 200 with **no auth required** (no redirect, no 401/403)
- Renders the project titles from the seeded fixture data as visible HTML text in the response body — the checker looks for "Glass Signal", "Small Meadow", or "Deep Compass" (first 3 fixture project titles) as plain text strings in the HTML
- Uses Prisma to query seeded projects (`take: 40` max, never unbounded `findMany()`)
- Styled with Tailwind + shadcn/ui Card components

### R2. Submission close check at `POST /api/projects` (or `/api/projects/new`)

Implement an API route that:
- Reads the event's `submissionsClose` timestamp from the DB (seeded from `fixtures.json` event `submissions_close = "2026-03-01T18:00:00Z"` — already in the past)
- Compares to `Date.now()` server-side
- Returns **409 or 403** when event is closed (the fixture event is already closed, so every POST must be refused)
- Validates the request body with Zod (`title` + `summary` minimum)
- Requires a valid participant session cookie — returns 401 if unauthenticated
- Must match the `submit` route registered in `.dogfood.toml`

### R3. Login page at `GET /login` + `POST /api/auth/login`

Implement a login page and API endpoint that:
- Accepts `email` in the POST body
- Looks up the user by email in the DB
- Sets `Cookie: session=<token>` on success (token from the `Session` table)
- Returns 401 on unknown email
- Does NOT use any external auth provider — hand-rolled only, works offline

### R4. `.dogfood.toml` at repo root

Write `.dogfood.toml` using the **exact session tokens already seeded** (printed by `npm run seed`):
```
organizer    Cookie: session=org_seed_token_2026
judge_a      Cookie: session=jdg_a_seed_token_2026
judge_b      Cookie: session=jdg_b_seed_token_2026
participant  Cookie: session=prt_seed_token_2026
```

The file must follow the format from `Hack_docs/example.dogfood.toml`:
```toml
[portal]
base_url = "http://localhost:8080"

[tiers]
claimed = ["T1", "T2"]
pitch = "Self-hostable hackathon submission and judging platform with backend-enforced role isolation and MAD-based score normalisation."

[auth]
organizer   = "Cookie: session=org_seed_token_2026"
judge_a     = "Cookie: session=jdg_a_seed_token_2026"
judge_b     = "Cookie: session=jdg_b_seed_token_2026"
participant = "Cookie: session=prt_seed_token_2026"

[routes]
gallery      = "/projects"
submit       = "/api/projects"
judge_scores = "/api/judge/scores"
peer_scores  = "/api/judge/scores?judge=<judge_a_user_id>"
csv_export   = "/api/export.csv"
```

> IMPORTANT: `peer_scores` must use the actual DB `userId` of the judge_a user (from `prisma.user.findUnique({ where: { email: 'jdg_a@example.com' } })`). The checker visits this URL as judge_b expecting a 403. Read `src/lib/seed.ts` to find the exact email used for judge_a.

### R5. Update `PROGRESS.md` and commit

After all tasks are done:
- Mark all Phase 2 checkboxes `[x]`
- Update `Last completed task`, `Next task`, and header fields
- Commit: `git commit -m "[PROGRESS] Phase 2: T1 gallery, submit close, login, .dogfood.toml — Phase 3 T2 judging next"`

---

## Acceptance Criteria

### T1 Gallery Check
- [ ] `GET http://localhost:8080/projects` with NO auth header returns HTTP 200
- [ ] The HTML response body contains the text "Glass Signal" OR "Small Meadow" OR "Deep Compass" (case-insensitive substring match)
- [ ] Verified by: `python d:\TP\Hackathon\DogFood\Hack_docs\run.py d:\TP\Hackathon\DogFood\.dogfood.toml` shows `T1  gallery is public .... PASS` and `T1  project from fixtures shown .... PASS`

### T1 Submission Close Check
- [ ] `POST http://localhost:8080/api/projects` as participant (with `Cookie: session=prt_seed_token_2026`) returns a 4xx status code
- [ ] Verified by: checker shows `T1  closed event refuses submissions .... PASS`

### TypeScript
- [ ] `npm run typecheck` exits with code 0 (zero type errors)

### Build
- [ ] `npm run build` succeeds (no build errors)

### PROGRESS.md
- [ ] All Phase 2 `[ ]` tasks are toggled to `[x]`
- [ ] A `[PROGRESS]` commit is made

---

## Agent Orientation Protocol (MUST run first)

Before writing any code, execute these orientation commands in order:

```powershell
Get-Content "d:\TP\Hackathon\DogFood\PROGRESS.md"
git -C "d:\TP\Hackathon\DogFood" log --oneline -10
git -C "d:\TP\Hackathon\DogFood" status
Get-ChildItem "d:\TP\Hackathon\DogFood\src" -Recurse -Name
```

Then read:
1. `d:\TP\Hackathon\DogFood\Hack_docs\spec.md` — the law
2. `d:\TP\Hackathon\DogFood\Hack_docs\run.py` — lines 91–141 (T1 checks) to understand exact check logic
3. `d:\TP\Hackathon\DogFood\src\lib\auth.ts` — existing `getSession()` helper
4. `d:\TP\Hackathon\DogFood\src\lib\seed.ts` — to confirm seeded tokens and fixture loading

Do NOT re-do any task already marked `[x]` in `PROGRESS.md`. Pick up from the first `[ ]` in Phase 2.
```

## 2026-09-27T09:35:47Z

Implement Phase 3 (T2 Judging) for the DOGFOOD 2026 hackathon portal, enforcing strict server-side role-based access control (RBAC), MAD score normalization, and full verification against the acceptance test suite.

Working directory: d:\TP\Hackathon\DogFood
Integrity mode: development

## Requirements

### R1. Judge Scores API with Strict RBAC Isolation (`GET /api/judge/scores`)
- Returns 200 with the judge's own submitted scores when accessed by an authenticated judge (e.g., `judge_a`).
- **Critical RBAC Boundary:** Returns 403 Forbidden when a judge requests peer scores via query parameter (e.g. `?judge=user_jdg_a_01` accessed by `judge_b`). This must be strictly validated server-side against the authenticated session user ID to prevent data leakage.
- Returns 401 Unauthorized or 403 Forbidden when accessed by a participant or unauthenticated user.

### R2. Score Submission & Audit Logging (`POST /api/judge/scores`)
- Accepts rubric-based scores from authenticated judges for assigned projects.
- Validates payload with Zod (project ID, criterion scores within rubric min/max ranges, optional comments).
- Saves scores and records an immutable log in the `AuditLog` table (`action: "score_submitted"`, `userId`, `payload`).
- Rejects submissions from non-judges or judges attempting to score unassigned tracks/projects if assignments are restricted.

### R3. Organizer CSV Export with MAD Normalization (`GET /api/export.csv`)
- Strictly restricted to organizer/admin sessions (returns 403 for judges, participants, and anonymous visitors).
- Returns 200 with `Content-Type: text/csv; charset=utf-8` and a valid CSV payload.
- First line MUST contain a comma (valid CSV header, e.g. `project_id,project_title,track,raw_score,normalized_score,rank`).
- Implements cross-judge normalization using Median Absolute Deviation (MAD) via `src/lib/normalization.ts` to neutralize judge bias while gracefully handling zero-variance judges (e.g. `jdg_30`, Rafa Okonkwo) without divide-by-zero errors.

### R4. Judging and Progress Portal UI
- `/judge`: Responsive interface for judges to view assigned projects, select rubric criteria, enter comments, and submit scores.
- `/dashboard`: Organizer dashboard showing real-time judging progress (total projects, scored projects, pending reviews, judge completion status).

### R5. Session Continuity & Progress Ledger
- Adhere to PowerShell 5.1 syntax (use `;` rather than `&&`).
- Update `d:\TP\Hackathon\DogFood\PROGRESS.md` with completed T2 deliverables and current checker state.
- Create git commit with commit message prefix `[PROGRESS] Phase 3: ...`.

## Acceptance Criteria

### Automated Acceptance Suite
- [ ] Running `python Hack_docs/run.py .dogfood.toml` results in all 7 checks passing:
  - T1 gallery is public (PASS)
  - T1 project from fixtures shown (PASS)
  - T1 closed event refuses submissions (PASS)
  - T2 judge sees own scores (PASS)
  - T2 judge cannot see peer scores (PASS)
  - T2 participant blocked (PASS)
  - T2 csv export works (PASS)
- [ ] Final checker summary prints: `claimed T1 T2, verified T1 T2` with no unverified tiers.

### Code Quality & Security Invariants
- [ ] `npm run typecheck` completes with 0 errors.
- [ ] Peer score probe via curl/urllib (`/api/judge/scores?judge=user_jdg_a_01` with `judge_b` session cookie) returns 403 HTTP status code directly from server route handler.
- [ ] `/api/export.csv` returns 403 when requested by non-organizers.
- [ ] `AuditLog` entries are created upon score submissions.
- [ ] `PROGRESS.md` reflects Phase 3 completion and git commit is created.

## 2026-09-27T09:41:27Z

CRITICAL DIRECTIVE FROM USER & BUILD PLAN (dogfood_build_plan.md):
Ensure strict adherence to the build plan requirements:
1. Staff Security Engineer + Backend Architect role: Role isolation must be enforced strictly server-side in the API routes. Never rely on frontend filtering.
2. `GET /api/judge/scores`:
   - Returns 200 for judge's own scores (judge_a).
   - Returns 403 when judge_b requests peer scores via `?judge=user_jdg_a_01` (THE CRITICAL CHECK: server-side check comparing session.id / session.judgeId with requested judge param).
   - Returns 401 or 403 when participant accesses it.
3. `POST /api/judge/scores`:
   - Zod input validation, Prisma transactions, and immutable audit logging in AuditLog table (`action: "score_submitted"`, userId, payload).
4. `GET /api/export.csv`:
   - Organizer only (returns 403 for judges, participants, anonymous).
   - Returns 200 with CSV payload; line 1 MUST contain a comma.
   - Calculates cross-judge scoring using MAD normalization from `src/lib/normalization.ts` (handles zero-variance judge like Rafa Okonkwo / jdg_30 where MAD=0 without divide-by-zero).
5. PowerShell 5.1 syntax compatibility: ALWAYS use `;` or separate commands. NEVER use `&&` or `||`.
6. Update `PROGRESS.md` with completed T2 deliverables and commit with `[PROGRESS] Phase 3: ...`.
7. Acceptance verification: All 7 checks (T1 + T2) must be PASS when running `python Hack_docs/run.py .dogfood.toml`.

## 2026-09-27T10:05:21Z

Resume and complete Phase 3 (T2 Judging) for the DOGFOOD 2026 hackathon portal following an account switch.

Working directory: d:\TP\Hackathon\DogFood
Integrity mode: development

## Requirements

### R1. Complete Adversarial Verification & Gate Synthesis
- Phase 3 implementation is already written in `src/app/api/judge/scores`, `src/app/api/export.csv`, `src/app/judge`, `src/app/dashboard`, and `src/lib/auth.ts`.
- Run and verify all suites:
  * `python tests/test_phase3_adversarial.py` (47 probes)
  * `python tests/test_phase3_challenger2_full.py` (35 probes)
  * `python Hack_docs/run.py .dogfood.toml` (All 7 checks: T1 + T2)
  * `npm run typecheck` (0 errors)

### R2. Ledger & Git Commit
- Update `d:\TP\Hackathon\DogFood\PROGRESS.md`:
  * Mark all Phase 3 tasks as `[x]`.
  * Update current phase to Phase 4.
  * Update checker history table with verified T1 + T2 PASS status.
  * Record session log entry.
- Create git commit with message:
  `git commit -m "[PROGRESS] Phase 3: T2 judging, RBAC isolation, MAD normalization, judge and dashboard UI — Phase 4 Docs next"`

## Acceptance Criteria

### Automated Acceptance Suite
- [ ] Running `python Hack_docs/run.py .dogfood.toml` results in all 7 checks passing:
  - T1 gallery is public (PASS)
  - T1 project from fixtures shown (PASS)
  - T1 closed event refuses submissions (PASS)
  - T2 judge sees own scores (PASS)
  - T2 judge cannot see peer scores (PASS)
  - T2 participant blocked (PASS)
  - T2 csv export works (PASS)
- [ ] Final checker summary prints: `claimed T1 T2, verified T1 T2`.
- [ ] `npm run typecheck` exits with 0 errors.
- [ ] `PROGRESS.md` updated and committed to git.

## 2026-09-27T10:24:12Z

A comprehensive, adversarial self-review of the DOGFOOD 2026 hackathon portal — a self-hostable Next.js 14 + SQLite hackathon submission and judging platform — covering all work completed in Phases 1 through 3.

Working directory: d:\TP\Hackathon\DogFood
Integrity mode: development

## Context

The DOGFOOD 2026 portal is a hackathon judging platform built for the DOGFOOD 2026 competition, scored on:
- **T1 (40%):** Public gallery, fixture project display, closed-submission enforcement
- **T2 (25%):** Backend RBAC isolation for judging scores, MAD-normalized CSV export
- **Adoptability (20%):** Single Docker container, one-command startup
- **Code Quality (15%):** Schema integrity, TypeScript correctness, no runtime errors

**Phases completed (claimed in PROGRESS.md):**
- **Phase 1 — Foundation:** Next.js 14 scaffold, Prisma + SQLite schema (11 models), seed script, auth helpers, MAD normalization, Dockerfile, docker-compose.yml, entrypoint.sh
- **Phase 2 — T1 Core:** Public gallery (`/projects`), submission deadline enforcement (`POST /api/projects`), login page, `.dogfood.toml`
- **Phase 3 — T2 Judging:** Judge scores API with strict RBAC (`GET/POST /api/judge/scores`), MAD-normalized CSV export (`GET /api/export.csv`), judge portal UI (`/judge`), organizer dashboard (`/dashboard`), AuditLog trail

**Checker state (last run):** All 7 checks PASS (T1 ✅, T2 ✅)

## Key Files to Review

- `d:\TP\Hackathon\DogFood\dogfood_build_plan.md` — full spec and phase requirements
- `d:\TP\Hackathon\DogFood\PROGRESS.md` — live progress ledger
- `d:\TP\Hackathon\DogFood\Hack_docs\spec.md` — official hackathon spec (ground truth)
- `d:\TP\Hackathon\DogFood\Hack_docs\run.py` — acceptance checker (7 checks)
- `d:\TP\Hackathon\DogFood\prisma\schema.prisma` — data model
- `d:\TP\Hackathon\DogFood\src\lib\auth.ts` — session helpers
- `d:\TP\Hackathon\DogFood\src\lib\normalization.ts` — MAD normalization
- `d:\TP\Hackathon\DogFood\src\lib\seed.ts` — seed script
- `d:\TP\Hackathon\DogFood\src\app\api\judge\scores\route.ts` — RBAC boundary (T2 critical)
- `d:\TP\Hackathon\DogFood\src\app\api\export.csv\route.ts` — CSV export with MAD normalization
- `d:\TP\Hackathon\DogFood\src\app\api\projects\route.ts` — submission deadline enforcement
- `d:\TP\Hackathon\DogFood\src\app\projects\page.tsx` — public gallery page
- `d:\TP\Hackathon\DogFood\.dogfood.toml` — acceptance checker config
- `d:\TP\Hackathon\DogFood\tests\test_phase3_adversarial.py` — 35-test adversarial suite
- `d:\TP\Hackathon\DogFood\tests\test_phase2_adversarial.py` — Phase 2 test suite

## Requirements

### R1. Code Quality Audit

Read all source files in `src/` and `prisma/` and audit them against the spec (`dogfood_build_plan.md` and `Hack_docs/spec.md`). Identify:
- TypeScript correctness issues (empty catch blocks, `@ts-ignore`, unsafe type assertions)
- Logic bugs in RBAC enforcement (the `?judge=` param isolation is the critical check — verify the exact code path)
- MAD normalization correctness — verify even-length median, zero-variance handling, and the `normaliseAllJudges` aggregation logic
- Any `?.` optional chaining used to suppress what should be a hard error

### R2. Acceptance Checker Alignment

Cross-reference every check in `Hack_docs/run.py` against the actual implementation:
- Check 5 (T2 critical): `GET /api/judge/scores?judge=judge_a` as `judge_b` → must return 403 from the **API route**, not the UI
- Check 7: CSV first line must contain a comma — verify the header string in `export.csv/route.ts`
- Check 3: Submission close logic uses `event.submissionsClose` from DB (not hardcoded)
- Identify any gap between what `run.py` checks and what the code actually implements

### R3. Security & RBAC Audit

Audit every API route for security gaps:
- Could a judge bypass the `?judge=` check by any other mechanism?
- Does the participant block on `GET /api/judge/scores` happen before or after DB queries?
- Is the CSV export truly organizer-only at the API layer, or only in the UI?
- Does the AuditLog capture every score mutation (create + update paths)?
- Are there any routes without authentication guards?

### R4. MAD Normalization Correctness

Formally verify `normaliseJudgeScores()` and `normaliseAllJudges()`:
- Correct median formula for even-length arrays (uses both middle values, not just floor index)
- Zero-variance guard returns `[0, 0, ...]` rather than NaN
- The `normaliseAllJudges` output has the same set of project IDs as the input for each judge
- Verify the `export.csv` route uses `normaliseAllJudges` and not the per-judge function directly

### R5. Schema & Seed Integrity

Verify the Prisma schema and seed against fixtures.json expectations:
- Are all 11 models present and correctly related?
- Does the seed script create the 4 deterministic session tokens correctly?
- Are session expiry dates far enough in the future?
- Is the `submissionsClose` seeded to `2026-03-01T18:00:00Z` (already past) as required?

## Acceptance Criteria

### Code Quality
- [ ] No `@ts-ignore`, `// eslint-disable`, empty catch blocks, or `?.` used to suppress crashes
- [ ] Every catch block either returns a proper error response or re-throws
- [ ] No hardcoded dates or IDs that should come from the database

### RBAC Correctness
- [ ] `GET /api/judge/scores?judge=<peer_id>` returns 403 at the API layer (not just UI-hidden) when called by a different judge
- [ ] Anonymous request to any auth-required route returns 401 (not 403 or 200)
- [ ] Participant request to judge endpoints returns 403 (not 401 or 200)
- [ ] CSV export route blocks judges and participants at the API layer before any DB query

### MAD Normalization
- [ ] `normaliseJudgeScores([3, 3, 3, 3])` returns `[0, 0, 0, 0]` (zero-variance guard)
- [ ] Even-length array median is computed correctly (average of two middle values)
- [ ] The `normaliseAllJudges` output has the same set of project IDs as the input for each judge
- [ ] No NaN or undefined can appear in the CSV output

### Checker Alignment
- [ ] All 7 checks in `run.py` are demonstrably satisfied by the code, mapped one-to-one
- [ ] `.dogfood.toml` routes match actual Next.js route file paths
- [ ] `peer_scores = "/api/judge/scores?judge=user_jdg_a_01"` — the user ID in the TOML matches the seeded user ID

### Schema Completeness
- [ ] All 11 models from the spec are in `schema.prisma` with correct relations
- [ ] `AuditLog` captures both score create and update paths (upsert audit trail)

## 2026-09-28T10:45:46Z

Apply Midnight Obsidian Glass UI polish across the DOGFOOD 2026 hackathon portal (Next.js 14, Tailwind v3, Framer Motion 13, shadcn/ui) and run a complete freeze rehearsal to confirm all 7 acceptance checks still pass.

Working directory: d:\TP\Hackathon\DogFood
Integrity mode: development

---

## Critical Quality Invariants (MUST NOT BREAK)

1. **Checker Green Guarantee:** `python Hack_docs/run.py .dogfood.toml` must produce 7/7 PASS (T1 + T2). Run it before and after every significant change.
2. **Server-Rendered HTML Body:** `/projects` (src/app/projects/page.tsx) is an async Server Component that queries Prisma and renders fixture project titles ("Glass Signal", "Small Meadow", "Deep Compass") directly in the initial HTML body. This MUST remain an async Server Component. Do NOT convert it to a client-only fetch.
3. **RBAC Isolation:** All API security parameter guards on `/api/judge/scores` and `/api/export.csv` must remain exactly as-is — no deletions, no weakening.
4. **Zero-Network Invariant:** No external CDN requests or remote font imports. Fonts are already loaded locally via `next/font/local` from `src/app/fonts/`. All styles must remain Tailwind or inline CSS only.
5. **No `&&` in PowerShell:** All shell commands must use PowerShell 5.1 syntax (separate statements or `;`).

---

## Tech Stack Baseline

- **Framework:** Next.js 14.2.35 (App Router, TypeScript)
- **Styles:** Tailwind CSS v3.4.1
- **Animations:** Framer Motion 13.4.4 (already installed)
- **Components:** shadcn/ui (Card, Badge, Button, Input, Label, Slider all available in `src/components/ui/`)
- **Icons:** lucide-react 1.48.0
- **Fonts:** Geist Sans + Geist Mono loaded locally via `next/font/local`
- **DB:** Prisma 5.22 + SQLite (seeded with fixture data)

---

## Requirements

### R1. Global Design System — Midnight Obsidian Glass

Update `src/app/globals.css` and `src/app/layout.tsx` to establish the Midnight Obsidian Glass aesthetic:

- **Body/canvas:** deep obsidian background `#07090e` / `#0a0d14` (set CSS vars `--background` and `--card` in the `:root` block to these dark values; add class `dark` to `<html>`). Override the current light-mode `:root` to use the dark palette throughout.
- **Ambient glow:** add a fixed, non-interactive radial/conic gradient mesh as a pseudo-element or `<div aria-hidden>` behind all content — a soft cyan/indigo bloom at the top-center of the viewport (`radial-gradient(ellipse 80% 50% at 50% -10%, rgba(56,189,248,0.12), transparent)`).
- **Glass surface tokens:** add Tailwind-compatible CSS custom properties: `--glass-bg: rgba(255,255,255,0.04)`, `--glass-border: rgba(255,255,255,0.08)`, `--glass-border-accent: rgba(56,189,248,0.3)`.
- **Floating glass navbar:** replace the plain `<body>{children}</body>` wrapper with a layout that includes a sticky glass navbar (`backdrop-blur-md bg-white/[0.04] border-b border-white/[0.06]`) containing:
  - Left: "DOGFOOD 2026" logo text + "PORTAL" monospace badge
  - Center nav links: `/projects`, `/judge`, `/dashboard` (Next.js `<Link>`)
  - Right: GitHub icon link (hardcode to `https://github.com/Vineetw07/dogfood-portal`) + Sign In link to `/login`
  - The navbar must be a **Client Component** (for active link detection via `usePathname`) wrapped in a Server Component layout. Use `'use client'` on a `Navbar` component extracted to `src/components/Navbar.tsx`.
- **Page entrance animation:** Wrap the `{children}` in `layout.tsx` with a Framer Motion `<motion.div>` that animates `opacity: 0, y: 10` → `opacity: 1, y: 0` with `duration: 0.35, ease: "easeOut"`. This wrapper must be a Client Component.

### R2. Public Project Gallery Polish (`src/app/projects/page.tsx`)

This is an async Server Component — preserve that. Add purely visual enhancements:

- **Hero banner:** glowing pill badge (`✦ DOGFOOD 2026 PORTAL`) above a large headline "Project Gallery" + subtitle, with the ambient glow behind it.
- **Track filter strip (client island):** extract a `ProjectsClient` component (`src/app/projects/projects-client.tsx` — `'use client'`) that receives the full projects array and handles client-side filtering by track. Track buttons: `All`, `Dev Tools`, `AI Agents`, `Infrastructure`, `Consumer`. The server page passes `projects` array to this client component.
- **Glass project cards:** replace the existing plain `<Card>` styling with glass cards: `bg-[var(--glass-bg)] border-[var(--glass-border)] backdrop-blur-md` with hover state `hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(56,189,248,0.12)] hover:border-cyan-500/30`. Add track-specific color badges and a repo link button.
- **Search input:** add a `<input>` with dark glass styling above the track strip, wired to a state variable that filters project titles client-side.
- **INVARIANT:** `prisma.project.findMany(...)` query stays in the Server Component. All filtering is purely client-side from the full dataset already fetched server-side.

### R3. Role-Aware Login Polish (`src/app/login/page.tsx`)

Visual polish only — preserve all auth logic and role-based redirect exactly as-is:

- **Background:** full obsidian canvas matching global theme.
- **Glass login container:** wrap the card in `backdrop-blur-md bg-[var(--glass-bg)] border-[var(--glass-border)]` rounded-2xl.
- **Electric cyan focus rings:** `focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40` on the email input.
- **Role selector chips:** redesign the test account quick-select grid — each chip gets a role-specific luminous border color: Organizer=amber, Judge Alpha=cyan, Judge Beta=indigo, Participant=emerald. Use `data-selected` state to show an active glow.
- **Preserved logic:** `handleSubmit`, role redirect (`judge` → `/judge`, `organizer`/`admin` → `/dashboard`, else → `/projects`), error display — all unchanged.

### R4. Judge Scoring Workspace Polish (`src/app/judge/judge-portal-client.tsx`)

The judge page server component passes props to `JudgePortalClient` — polish that client file:

- **Two-column ergonomic layout:** left column (project queue, ~35% width) + right column (scoring console, ~65%). On mobile: stack vertically.
- **Project queue:** glass sidebar card showing all assigned projects, each with a status chip (`Scored` in cyan / `Pending` in slate). Clicking a project selects it into the right panel.
- **Scoring console:** glass card styled like a developer terminal prompt — dark header bar with "⬢ SCORING CONSOLE", project title, track badge.
- **Rubric sliders:** use the existing shadcn Slider component (or `<input type="range">`) for each criterion. Show live numeric readout next to each slider label.
- **Live composite score gauge:** a large numeric display (e.g. `87.4 / 100`) that updates in real-time as sliders move. Style it prominently at the top of the console.
- **Autosave indicator:** show a small indicator (e.g. "✓ Saved" fading in after POST succeeds, or a spinner while saving). Preserve the existing `fetch('/api/judge/scores', { method: 'POST', ... })` call exactly.

### R5. Organizer Control Tower Polish (`src/app/dashboard/dashboard-client.tsx`)

The dashboard server component passes props to `DashboardClient` — polish that client file:

- **4 KPI stat cards:** Total Submissions, Active Judges, Evaluation Progress %, Remaining Reviews — each an illuminated glass card with a large number, label, and a colored lucide icon.
- **MAD-Normalized Leaderboard:** glass table with rank badge (🥇🥈🥉 for top 3, numeric thereafter), project title, track, MAD-normalized score formatted to 2 decimal places, and number of reviews. Add a prominent "⬇ Export CSV (RFC 4180)" download button that links to `/api/export.csv` (anchor `download` attribute).
- **Judge progress table:** glass table showing each judge's name, assigned tracks, scored/total projects, and a color-coded status badge (Completed=green, In Progress=amber, Not Started=slate).
- **Audit trail:** chronological list of the last 15 audit entries with timestamp, action, user, and payload summary. Style as a terminal-like log feed.

### R6. Freeze Rehearsal

After all UI changes:

1. Run `npm run typecheck` → must exit 0 errors.
2. Run `npm run lint` → must exit 0 errors.
3. Run `npm run build` → must complete successfully.
4. Start the server: `npm run start` (background/daemon mode on port 8080).
5. Run `python Hack_docs/run.py .dogfood.toml` → must produce 7/7 PASS.
6. Update `PROGRESS.md`: mark all Phase 5 tasks `[x]`, add a row to the Checker History table with timestamp and "T1 PASS, T2 PASS (7/7)".
7. Commit: `git commit -m "[PROGRESS] Phase 5: complete Midnight Obsidian UI polish, Framer Motion animations, and freeze rehearsal"`

---

## Continuity & Resumption Protocol

**This task may be interrupted mid-execution if the model quota is exhausted. A new agent session will be started to continue. When resuming:**

1. **Read `PROGRESS.md` first** — it is the source of truth for what has been completed. Each R1–R6 sub-task will be marked `[x]` as soon as it is verified complete.
2. **Read the current state of every file you are about to edit** before touching it — do not assume it matches the original description above.
3. **Run `npm run typecheck` and `python Hack_docs/run.py .dogfood.toml`** before making any new changes to confirm the current baseline is still green.
4. **Pick up from the first incomplete `[ ]` item** in the Phase 5 checklist in `PROGRESS.md` and continue sequentially through R1 → R6.
5. **Commit atomically after each requirement** (R1 through R6) so a crash after that point loses no work.

**Atomic commit cadence (commit immediately after verifying each step):**
- After R1: `git commit -m "[Phase5-R1] Midnight Obsidian global design system, glass navbar, Framer Motion page entrance"`
- After R2: `git commit -m "[Phase5-R2] Glass project gallery, ProjectsClient island, search + track filter"`
- After R3: `git commit -m "[Phase5-R3] Glass login, electric focus rings, role chip accents"`
- After R4: `git commit -m "[Phase5-R4] Judge two-column workstation, live composite score, autosave indicator"`
- After R5: `git commit -m "[Phase5-R5] Organizer control tower KPIs, glass leaderboard, audit trail"`
- After R6: `git commit -m "[PROGRESS] Phase 5: complete Midnight Obsidian UI polish, Framer Motion animations, and freeze rehearsal"`

**Update `PROGRESS.md` Phase 5 checklist** — expand `### Phase 5` with sub-tasks for R1–R6 as `- [ ]` items and tick them `[x]` immediately after each is verified. This is the checkpoint file a resumed session will read.

---

## Acceptance Criteria

### Visual Design
- [ ] All pages render on an obsidian `#07090e` background — no white or light-gray canvas visible anywhere.
- [ ] A cyan/indigo ambient radial glow is visible at the top of at least the gallery and login pages.
- [ ] The floating glass navbar is present on every page (layout level), uses `backdrop-blur-md`, and shows the DOGFOOD 2026 logo + nav links.
- [ ] Project gallery cards have `backdrop-blur-md` glass styling and a `hover:-translate-y-1` lift on hover.
- [ ] Login page chip selectors have role-specific accent borders (amber/cyan/indigo/emerald).
- [ ] Judge scoring page shows a two-column layout with live composite score updating as sliders move.
- [ ] Dashboard shows 4 KPI stat cards + glass leaderboard table + Export CSV button.

### Code Quality
- [ ] `npm run typecheck` exits with 0 TypeScript errors.
- [ ] `npm run lint` exits with 0 ESLint errors.
- [ ] `npm run build` completes without errors.

### Acceptance Checker
- [ ] `python Hack_docs/run.py .dogfood.toml` reports 7/7 PASS (T1 + T2) after all changes.
- [ ] The initial HTML body of `/projects` still contains the fixture titles "Glass Signal", "Small Meadow", "Deep Compass" (SSR invariant — no client-only fetch).

### Commit
- [ ] `PROGRESS.md` Phase 5 tasks all marked `[x]`.
- [ ] Git commit with message `[PROGRESS] Phase 5: complete Midnight Obsidian UI polish, Framer Motion animations, and freeze rehearsal` exists.

---

## Verification Resources

- Acceptance checker: `python Hack_docs/run.py .dogfood.toml` (at repo root `d:\TP\Hackathon\DogFood`)
- Session tokens (in `.dogfood.toml`):
  - organizer: `Cookie: session=org_seed_token_2026`
  - judge_a: `Cookie: session=jdg_a_seed_token_2026`
  - judge_b: `Cookie: session=jdg_b_seed_token_2026`
  - participant: `Cookie: session=prt_seed_token_2026`
- TypeScript check: `npm run typecheck`
- Lint: `npm run lint`
- Build: `npm run build`
- Start server: `npm run start` (port 8080, non-blocking daemon)

*Expecting this to run as a full team build — 5 pages being restyled, a new Navbar component, and a complete freeze rehearsal with acceptance checker.*
