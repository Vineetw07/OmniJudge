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
