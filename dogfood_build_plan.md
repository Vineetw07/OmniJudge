# DOGFOOD 2026 — Agent Build Plan

> **This document is the single source of truth for every AI agent working on this project.**
> Read it fully before writing a single line of code. Do not deviate from the decisions recorded here.

---

## 🔄 Session Continuity & Resilience Protocol

> [!CAUTION]
> **This section is the FIRST thing any new agent must read and execute**, regardless of model (Claude, Gemini, or other) or whether the session is fresh or resumed after account switching. Do not skip it.

The user switches AI accounts when quota is exhausted. This means **agent sessions can be terminated mid-task at any time** with no warning. The project must be resilient to this. The following protocol ensures any incoming agent — on any model — can resume within 2 minutes without losing work or re-doing completed tasks.

---

### 📋 Step 0 — Incoming Agent Orientation (Run Every Time, No Exceptions)

When a new agent session starts (fresh account, model switch, or continuation), execute these commands **before touching any code**:

**1. Read the progress ledger:**
```powershell
Get-Content "d:\TP\Hackathon\DogFood\PROGRESS.md"
```
This tells you: current phase, last completed task, next unchecked task, and any known blockers.

**2. Check git state:**
```powershell
git -C "d:\TP\Hackathon\DogFood" log --oneline -10
git -C "d:\TP\Hackathon\DogFood" status
```
This tells you: what was last committed, what files are staged/unstaged, whether there is uncommitted work.

**3. Check if Docker is running and what state it's in:**
```powershell
docker ps
```
If the container is running, the project is partially built. Note the container name.

**4. Check the acceptance checker state (if Docker is running):**
```powershell
python "d:\TP\Hackathon\DogFood\Hack_docs\run.py" "d:\TP\Hackathon\DogFood\.dogfood.toml"
```
This tells you exactly which of the 7 checks pass and which still need work.

**5. Read any open TODO comments in progress:**
```powershell
Select-String -Path "d:\TP\Hackathon\DogFood\src\*" -Pattern "TODO|FIXME|RESUME_HERE" -Recurse
```

After running these 5 commands, the agent has full situational awareness and can resume the next unchecked task from `PROGRESS.md`.

---

### 📁 PROGRESS.md — The Live State Ledger

A file at `d:\TP\Hackathon\DogFood\PROGRESS.md` is the **single persistent state record** across all agent sessions. It must be updated **at the end of every completed task**, immediately before committing.

**Format:**
```markdown
# DOGFOOD 2026 — Live Progress Ledger

Last updated: <ISO timestamp>
Current phase: Phase X — <name>
Last completed task: <exact task description from plan>
Next task: <exact task description from plan>
Known blockers: <none | description>
Checker state: <T1 PASS T2 PARTIAL | all 7 PASS | not yet run>
Docker state: <not built | built but not seeded | running and seeded>

## Phase Completion Status

### Phase 1 — Foundation
- [x] package.json — all dependencies installed
- [x] prisma/schema.prisma — written
- [ ] src/lib/seed.ts — TODO
...

### Phase 2 — T1 Core
- [ ] Not started
...
```

> [!IMPORTANT]
> **Every agent must update `PROGRESS.md` and commit it** before ending their session — even mid-phase. If the agent is terminated unexpectedly (quota hit), the last committed `PROGRESS.md` becomes the resume point for the next agent. The git commit message must include `[PROGRESS]` so it's findable: `git commit -m "[PROGRESS] Phase 1: schema and prisma complete, seed.ts next"`.

---

### 🔁 Model-Switch Compatibility Rules

These rules make the plan work regardless of which AI model is running:

| Rule | Reason |
|---|---|
| **All decisions are in this document** | A new model doesn't ask the user to re-make decisions already recorded here |
| **All commands use PowerShell 5.1 syntax** (`;` not `&&`) | Works on Windows regardless of which model generates the command |
| **No model-specific tool calls assumed** | The plan only uses file I/O, terminal commands, and standard HTTP — all models can do these |
| **PROGRESS.md is the resume point** | No model needs to read the conversation history — only this file and git log |
| **Checklist format `[ ]`/`[x]`** | Any model can parse and update this format reliably |
| **Code snippets in this doc are complete** | No model needs to "remember" a prior conversation to understand the intent |

---

### ⚡ Quick-Resume Checklist for Incoming Agents

Copy-paste this into your first response when starting after an account switch:

```
I am resuming the DOGFOOD 2026 build after an account switch.

Reading orientation state:
1. PROGRESS.md — current phase and next task
2. git log — last committed state
3. docker ps — container state
4. run.py — checker pass/fail state

I will NOT re-ask questions already decided in the plan document.
I will NOT re-do tasks already marked [x] in PROGRESS.md.
I will pick up from the next [ ] task in the current phase.
```

---

### 🚨 Mid-Task Termination Recovery

If an agent is terminated mid-file (e.g., halfway through writing `seed.ts`):

1. **Check `git status`** — if the file is unstaged, it may be partially written
2. **Check the file itself** — look for `// RESUME_HERE` comments the previous agent may have left
3. **Do NOT start the file from scratch** — read what's there first, then continue from the break point
4. **If the file is corrupt or incomplete past a safe point** — delete it and re-write from scratch using the spec in this document (all schemas and code patterns are here)

> [!NOTE]
> Agents should add `// RESUME_HERE — <brief description of what comes next>` at any natural break point when they anticipate their session may be cut off (e.g., after a long file write, before starting a complex section). This gives the next agent a clear pickup marker.

---



## 🎯 Goal

Build a **self-hostable submission and judging platform for hackathons** that wins the DOGFOOD 2026 hackathon.

The winning strategy is: **correctness + integrity over breadth**.
- 65% of the score comes from T1+T2 tier correctness (40%) and Judging Integrity (25%).
- Adoptability (one-command Docker) is 20%.
- Code Quality is only 15%.
- Bonuses do NOT change score — they break ties only.

> [!IMPORTANT]
> The acceptance checker (`run.py`) makes exactly **7 HTTP requests**. All 7 must return the right status codes. This is the primary objective. Everything else is secondary.

---

## ⏰ Timeline & Freeze Deadline

| Event | Time |
|---|---|
| Kickoff | Fri 25 Sep 2026, 18:00 UTC |
| **Code Freeze** | **Mon 28 Sep 2026, 18:00 UTC** |
| Judging Window | 28 Sep – 8 Oct 2026 |
| Write-Up Quest Closes | Sun 5 Oct 2026, 18:00 UTC |

> [!CAUTION]
> The **last 4 hours before freeze are reserved for freeze rehearsal only** — fresh clone, `docker compose up`, run `run.py`, record video. **No new features in that window.**

---

## 📁 Hack_docs Reference Files

All agents must be aware of these canonical files in `d:\TP\Hackathon\DogFood\Hack_docs\`:

| File | Purpose |
|---|---|
| [`spec.md`](file:///d:/TP/Hackathon/DogFood/Hack_docs/spec.md) | Full hackathon spec — the law. Read before anything. |
| [`run.py`](file:///d:/TP/Hackathon/DogFood/Hack_docs/run.py) | The acceptance checker. 7 checks. Must all pass. |
| [`fixtures.json`](file:///d:/TP/Hackathon/DogFood/Hack_docs/fixtures.json) | The shared dataset all teams load. 40 projects, 30 judges, 8 tracks. Contains deliberate edge cases. |
| [`example.dogfood.toml`](file:///d:/TP/Hackathon/DogFood/Hack_docs/example.dogfood.toml) | The config file format the checker reads from repo root. |
| [`context.txt`](file:///d:/TP/Hackathon/DogFood/Hack_docs/context.txt) | Full context including prizes, rules, timeline, and run.py source. |

---

## ⚙️ Agreed Stack

| Layer | Technology |
|---|---|
| Framework | **Next.js 14 (App Router)** + TypeScript |
| Database | **SQLite** (single file, zero external container) |
| ORM | **Prisma** |
| Styling | **Tailwind CSS** + **shadcn/ui** |
| Auth | **Hand-rolled cookie sessions** — random token → `Session` table → `Cookie: session=<token>` header |
| Container | **Single Docker container** — `FROM node:20-alpine` |
| License | **MIT** |
| Repo | **Public GitHub** |

> [!IMPORTANT]
> **No Auth0, Supabase, Clerk, NextAuth OAuth flows, or any external auth provider.** Auth must work with `--network none` (offline). The checker never logs in — it only attaches the session cookie you print at startup.

> [!IMPORTANT]
> **SQLite only** — no PostgreSQL container. This keeps `docker compose up` as a single container with zero race conditions. Prisma makes swapping to Postgres a one-line change later, which is worth documenting in `ARCHITECTURE.md`.

---

## 🧠 Agent Role Assignments Per Phase

Each phase has a **designated agent persona**. When an agent starts a phase, it must adopt the corresponding role mindset — this shapes decision-making, code quality bar, and what gets prioritised.

| Phase | Agent Role | Mindset Summary |
|---|---|---|
| **Phase 1** | **Principal Infrastructure Engineer** — 20+ yrs, specialised in DevOps, containerisation, DB architecture, project bootstrapping | "Nothing matters until the container starts cleanly. Schema first, seed second, Docker third. Features are someone else's problem today." |
| **Phase 2** | **Senior Full-Stack Engineer** — 15+ yrs, expert in Next.js App Router, TypeScript, and backend API design | "Every route must be the simplest thing that satisfies the acceptance check. No gold-plating. Gallery is HTML, deadline is a DB timestamp comparison." |
| **Phase 3** | **Staff Security Engineer + Backend Architect** — 20+ yrs, specialised in RBAC, API security, and data integrity | "Role isolation is not a feature, it is a contract. Every endpoint touching judge data validates session identity server-side before touching the DB. UI is irrelevant — curl is the real test." |
| **Phase 4** | **Senior Technical Writer + QA Engineer** — 15+ yrs, expert in developer documentation, API spec, and systematic test verification | "A tired judge verifies our claims in 90 seconds. JUDGING.md reads like a peer-reviewed paper section. Run the checker after every change that could affect behaviour." |
| **Phase 5** | **Senior UI/UX Engineer** — 12+ yrs, expert in React design systems, Framer Motion, Tailwind CSS, accessible component architecture | "Make it look intentional, not impressive. Every interactive element has a spring. Every list has an entrance. No static interfaces. But the clock stops at freeze — no new logic." |
| **Phase 6** | **Full-Stack Product Engineer (Anti-Abuse)** — 15+ yrs, expert in community features, rate limiting, and voting system integrity | "Community voting is a minefield. Rate limits first, randomisation second, results-hidden third. If T1/T2 stability is at risk, stop immediately." |

> [!IMPORTANT]
> Regardless of phase, **every agent** must re-read [`spec.md`](file:///d:/TP/Hackathon/DogFood/Hack_docs/spec.md) and [`run.py`](file:///d:/TP/Hackathon/DogFood/Hack_docs/run.py) before making any structural change. The checker is the ground truth.

---

## 🗂️ Project Root

```
d:\TP\Hackathon\DogFood\
├── src/                          # All application code
│   ├── app/                      # Next.js App Router
│   │   ├── (public)/             # Public routes (gallery)
│   │   ├── (auth)/               # Login/register
│   │   ├── dashboard/            # Organizer dashboard
│   │   ├── judge/                # Judge portal
│   │   └── api/                  # API routes
│   │       ├── judge/
│   │       │   └── scores/       # GET /api/judge/scores
│   │       ├── export.csv/       # GET /api/export.csv
│   │       └── projects/
│   │           └── new/          # POST /api/projects/new (submit)
│   ├── lib/
│   │   ├── auth.ts               # Session read/verify helpers
│   │   ├── prisma.ts             # Prisma client singleton
│   │   ├── normalization.ts      # Modified z-score (MAD) implementation
│   │   └── seed.ts               # Seed from fixtures.json
│   └── components/               # Shared UI components
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── tests/                        # Test suite
├── docs/                         # Project documentation
│   ├── prd.md
│   ├── trd.md
│   ├── implementation_plan.md
│   ├── bugs.md
│   └── testing.md
├── Hack_docs/                    # Reference only — DO NOT MODIFY
├── .dogfood.toml                 # Generated after seed prints session tokens
├── acceptance-report.txt         # Output of: python3 run.py .dogfood.toml
├── docker-compose.yml
├── Dockerfile
├── README.md
├── ARCHITECTURE.md
├── DATA-MODEL.md
├── JUDGING.md
├── LICENSE                       # MIT
└── package.json
```

---

## 🏗️ Phase Plan

### Phase 1 — Foundation (Target: ~10 hours)

> 🎭 **Agent Role:** Act as a **Principal Infrastructure Engineer with 20+ years of experience** in DevOps, containerisation, monorepo bootstrapping, and database architecture. Your decisions here determine whether the entire project can even run. Be paranoid about reproducibility. Optimise for "works on the judge's machine with the network off", not for elegance.

**Goal:** Scaffold the entire project, install ALL dependencies upfront, configure Prisma schema, write the seed script, implement auth, and get Docker running. Zero features yet. Just a clean container that starts, seeds, and prints session tokens.

---

#### ⚠️ Manual Prerequisites — Do These BEFORE Running Any Agent

> [!CAUTION]
> The following tools must be installed on the host machine **manually by the user** before the agent can build. The agent cannot install these for you.

| Tool | Version | How to Verify | Install Link |
|---|---|---|---|
| **Node.js** | v20 LTS or higher | `node --version` → `v20.x.x` | https://nodejs.org/en/download |
| **Docker Desktop** | Latest stable | `docker --version` + Docker Desktop running | https://www.docker.com/products/docker-desktop |
| **Python 3** | 3.8+ (for `run.py`) | `python --version` or `python3 --version` | https://www.python.org/downloads |
| **Git** | Any recent | `git --version` | Pre-installed or https://git-scm.com |
| **GitHub account** | — | Logged in at github.com | Create repo manually, copy remote URL |

> [!NOTE]
> On Windows, use `python` (not `python3`) in PowerShell unless you have the `python3` alias set. The acceptance checker runs as `python run.py .dogfood.toml`.

**Manual steps before agent starts Phase 1:**
1. Create a **public GitHub repository** (e.g., `dogfood-2026`) — note the remote URL
2. Confirm Docker Desktop is running (check system tray icon)
3. Confirm `node --version` shows v20+
4. Tell the agent the GitHub remote URL so it can set `git remote add origin <url>`

---

#### 📦 Full Dependency Manifest — Install Everything Upfront

Phase 1 installs **all dependencies the entire project will ever need** (across all 6 phases). This prevents later phases from being blocked by missing packages.

**Next.js project scaffold:**
```powershell
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git
```

**Production dependencies (all phases):**
```powershell
npm install prisma @prisma/client zod framer-motion lucide-react class-variance-authority clsx tailwind-merge
```

**shadcn/ui setup (run after above):**
```powershell
npx shadcn-ui@latest init
```
> When prompted: Style → `Default`, Base color → `Slate`, CSS variables → `Yes`

**shadcn/ui components needed (install all at once):**
```powershell
npx shadcn-ui@latest add button card badge input label textarea select table dialog sheet tabs avatar progress separator dropdown-menu
```

**Dev dependencies:**
```powershell
npm install -D @types/node tsx better-sqlite3 @types/better-sqlite3
```

**Complete `package.json` scripts to add:**
```json
{
  "scripts": {
    "dev": "next dev -p 8080",
    "build": "next build",
    "start": "next start -p 8080",
    "seed": "npx tsx src/lib/seed.ts",
    "db:migrate": "npx prisma migrate dev",
    "db:push": "npx prisma db push",
    "db:studio": "npx prisma studio",
    "typecheck": "tsc --noEmit"
  }
}
```

**Prisma init:**
```powershell
npx prisma init --datasource-provider sqlite
```

**After schema is written, generate client:**
```powershell
npx prisma generate
npx prisma migrate dev --name init
```

> [!NOTE]
> `framer-motion` is installed now even though it's used in Phase 5. Installing it in Phase 1 means Phase 5 agents never hit a missing-module error mid-sprint.

---

#### ✅ Phase 1 Deliverables

- [ ] `package.json` — all dependencies installed, scripts configured
- [ ] `prisma/schema.prisma` — full data model (see Data Model section below)
- [ ] `src/lib/seed.ts` — loads `Hack_docs/fixtures.json`, upserts all records, creates 4 seeded users with **deterministic session tokens** printed to stdout
- [ ] `src/lib/auth.ts` — `getSession(req)` helper that reads `Cookie: session=<token>` and returns typed `SessionUser | null`
- [ ] `src/lib/prisma.ts` — Prisma singleton (safe for Next.js HMR hot-reload)
- [ ] `src/lib/normalization.ts` — MAD normalisation function (see Normalisation section)
- [ ] `Dockerfile` — multi-stage, `node:20-alpine`, builds Next.js, runs on port 8080
- [ ] `docker-compose.yml` — single service, mounts `/data` volume for SQLite file
- [ ] `entrypoint.sh` — runs `prisma migrate deploy`, then seed, then `next start`
- [ ] `.env` + `.env.example` — `DATABASE_URL=file:./prisma/dogfood.db` for local dev
- [ ] `.gitignore` — node_modules, .env, prisma/\*.db, .next
- [ ] GitHub remote set: `git remote add origin <url>`
- [ ] Initial commit pushed to GitHub

**Startup log must print in this exact format** (the user will copy these into `.dogfood.toml`):
```
seeded. test logins:
  organizer    Cookie: session=org_<TOKEN>
  judge_a      Cookie: session=jdg_a_<TOKEN>
  judge_b      Cookie: session=jdg_b_<TOKEN>
  participant  Cookie: session=prt_<TOKEN>
```

**Verification:** `docker compose up` on a clean machine, no internet, container starts without errors, seeds, prints tokens.



---

### Phase 2 — T1 Core (Target: ~5 hours)

> 🎭 **Agent Role:** Act as a **Senior Full-Stack Engineer with 15+ years of experience** in Next.js App Router, TypeScript, and REST API design. Your primary obligation is the acceptance checker — build only what makes those 3 T1 checks go green. Resist the urge to add UI flourishes or extra features until T1 is fully verified.

**Goal:** Pass all 3 T1 checker checks.

**Checker checks for T1:**
```
T1  gallery is public ................. GET /projects — no auth — expect 200
T1  project from fixtures shown ....... body must contain title of fixture project
T1  closed event refuses submissions .. POST /projects/new as participant — expect 4xx
```

**Deliverables:**
- [ ] `GET /projects` — public gallery page, server-rendered, shows all seeded projects. **Must not require auth.**
- [ ] Gallery shows project titles from `fixtures.json` (first 3 checked: "Glass Signal", "Small Meadow", "Deep Compass")
- [ ] `POST /api/projects/new` (or equivalent submit route) — reads `event.submissions_close` from DB, compares to `Date.now()`, returns `409` or `403` if closed. The fixture's close date is `2026-03-01T18:00:00Z` — already in the past.
- [ ] Login page (not tested by checker but needed for judge/organizer workflows)
- [ ] Full role model: `visitor | participant | judge | organizer | admin`
- [ ] Event creation UI for organizer
- [ ] Team formation via invite link
- [ ] Project submission (draft + edit until deadline)

> [!WARNING]
> The **gallery must be an HTML response** (not a JSON API). The checker looks for fixture project titles as plain text **in the response body** (`any(t.lower() in haystack for t in titles)`). If you return JSON, this check FAILS.

> [!WARNING]
> The **submission close check** must use the database event's `submissions_close` timestamp — **not a hardcoded date**. Seed from `fixtures.json`'s `event.submissions_close = "2026-03-01T18:00:00Z"`.

---

### Phase 3 — T2 Judging (Target: ~8 hours)

> 🎭 **Agent Role:** Act as a **Staff Security Engineer + Backend Architect with 20+ years of experience** in RBAC systems, API security, audit trails, and data integrity. You treat every route as a potential attack surface. You never trust that UI-level hiding is enough — curl is your test harness, not the browser.

**Goal:** Pass all 4 T2 checker checks. This is the most critical phase.

**Checker checks for T2:**
```
T2  judge sees own scores ............. GET /api/judge/scores as judge_a — expect 200
T2  judge cannot see peer scores ...... GET /api/judge/scores?judge=judge_a as judge_b — expect 401 or 403
T2  participant blocked ............... GET /api/judge/scores as participant — expect 401 or 403
T2  csv export works .................. GET /api/export.csv as organizer — expect 200 with CSV body (first line must contain a comma)
```

**Deliverables:**
- [ ] `GET /api/judge/scores` — returns judge's OWN scores when called with a valid judge session. Returns 200.
- [ ] **THE CRITICAL CHECK:** `GET /api/judge/scores?judge=judge_a` called with `judge_b`'s session must return **401 or 403 from the backend**. **This check MUST live in the API route, not in the UI.** One `if` statement:
  ```typescript
  // In GET /api/judge/scores/route.ts
  const session = await getSession(request);
  if (!session) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (session.role !== 'judge' && session.role !== 'organizer') {
    return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const requestedJudgeId = searchParams.get('judge');
  if (requestedJudgeId && requestedJudgeId !== session.judgeId) {
    // judge_b trying to access judge_a's scores
    return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  ```
- [ ] Participant calling `/api/judge/scores` returns 401 or 403.
- [ ] `GET /api/export.csv` as organizer returns 200 with a CSV response. First line MUST contain a comma.
- [ ] Judge assignment and invitation UI (organizer assigns judges to tracks)
- [ ] Weighted scoring rubric configurable by organizer
- [ ] Scoring form for judges (submit scores per criterion per project)
- [ ] Organizer live progress dashboard (how many projects scored vs. pending)
- [ ] Cross-judge normalisation applied on CSV export (see Normalisation section)
- [ ] Audit trail table: every score submission logged with `judge_id`, `project_id`, `timestamp`, `action`

> [!CAUTION]
> **The most common disqualification** in DOGFOOD is a beautiful UI that hides judge A's scores from judge B in the template, but the API endpoint returns the data anyway. A `curl` command with `judge_b`'s session cookie hitting the judge A URL must get a 403. Test this manually before claiming T2.

---

### Phase 4 — Docs + Checker Green (Target: ~4 hours)

> 🎭 **Agent Role:** Act as a **Senior Technical Writer + QA Engineer with 15+ years of experience** in developer documentation, API specification, and acceptance testing. You write documentation a tired judge can skim in 90 seconds. You run the checker after every change. You do not claim a check passes until you have seen the `PASS` line printed.

**Goal:** All 7 checks pass. All required documents written.

**Deliverables:**
- [ ] Run `python3 Hack_docs/run.py .dogfood.toml` — all 7 lines show PASS
- [ ] Save output: `python3 Hack_docs/run.py .dogfood.toml > acceptance-report.txt`
- [ ] `.dogfood.toml` at repo root, with correct session tokens from seed output
- [ ] `README.md` — what it does, how to run, honest limitations
- [ ] `ARCHITECTURE.md` — system design, why SQLite, why single container, Prisma migration path
- [ ] `DATA-MODEL.md` — schema with ER diagram, import/export paths from/to `fixtures.json`
- [ ] `JUDGING.md` — full normalization writeup (see Normalization section below)
- [ ] `LICENSE` — MIT text

---

### Phase 5 — UI Polish + Freeze Rehearsal (Target: ~4 hours)

> 🎭 **Agent Role:** Act as a **Senior UI/UX Engineer with 12+ years of experience** in React design systems, Framer Motion animation, Tailwind CSS, and accessible component architecture. You make interfaces look intentional, not impressive. You cap UI time ruthlessly — the freeze rehearsal is non-negotiable and the most important part of this phase.

**Goal:** Make the portal look intentional. Then stop touching code.

> [!IMPORTANT]
> **Before starting UI polish**, pause and ask the user to provide a design reference / mockup. Do NOT proceed with UI work without their input.

**Deliverables:**
- [ ] Gallery looks clean and professional with Tailwind + shadcn/ui
- [ ] Judge scoring form is clear and usable
- [ ] Organizer dashboard shows progress legibly
- [ ] Framer Motion entrance animations on page views (see Frontend Rules)
- [ ] Mobile-responsive (no horizontal scroll blowout)
- [ ] **FREEZE REHEARSAL:**
  1. Pull repo fresh into an empty temp folder
  2. Kill network: `--network none` equivalent
  3. `docker compose up` — watch it seed and serve without touching anything
  4. Run `python3 Hack_docs/run.py .dogfood.toml` — must be all PASS
  5. Re-record demo video if anything changed
  6. Confirm repo is public on GitHub
  7. Confirm `.dogfood.toml` claims match `acceptance-report.txt`

---

### Phase 6 — T3 Community Voting (If Buffer Remains)

> 🎭 **Agent Role:** Act as a **Full-Stack Product Engineer with 15+ years of experience** specialised in community features, anti-abuse systems, and voting integrity. You build defensively — rate limits and duplicate detection come before UI. Your first question before writing any code is: "does this break T1 or T2?" If yes, stop.

**Goal:** Only if Phase 5 is done with ≥6 hours before freeze.

**T3 requirements:**
- Community voting (email-gated or authenticated)
- Project comments
- Results hidden during voting window
- Randomised project ordering on ballots
- Anti-abuse: rate limiting, duplicate detection, audit trail

> [!WARNING]
> Do NOT attempt T3 if it risks breaking T1 or T2. A broken T4 scores below a clean T2.

---

## 📐 Data Model

```prisma
// prisma/schema.prisma

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
  role      String   // "visitor" | "participant" | "judge" | "organizer" | "admin"
  createdAt DateTime @default(now())

  sessions  Session[]
  team      TeamMember?
  judgeAssignments JudgeAssignment[]
  scores    Score[]
  auditLogs AuditLog[]
}

model Session {
  id        String   @id // the random token
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
  id      String @id
  name    String

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
  id          String    @id
  teamId      String
  trackId     String
  eventId     String
  title       String
  summary     String
  repoUrl     String
  submittedAt DateTime
  isDraft     Boolean   @default(false)

  team   Team   @relation(fields: [teamId], references: [id])
  track  Track  @relation(fields: [trackId], references: [id])
  event  Event  @relation(fields: [eventId], references: [id])
  scores Score[]
}

model RubricCriterion {
  id      String @id @default(cuid())
  name    String  // "functionality", "quality", etc.
  weight  Float   @default(1.0)
  maxScore Int    @default(5)

  scores  Score[]
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
  action    String   // "score_submitted" | "score_updated" | "judge_assigned" etc.
  payload   String   // JSON string
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
}
```

> [!NOTE]
> The `Score` model uses per-criterion rows (not a single JSON blob). This makes normalization computations cleaner and the CSV export trivial.

---

## 🔑 Auth Design

**Session model:** Random hex token stored in the `Session` table. Sent as `Cookie: session=<token>`.

**getSession helper:**
```typescript
// src/lib/auth.ts
import { prisma } from './prisma';
import { NextRequest } from 'next/server';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: 'visitor' | 'participant' | 'judge' | 'organizer' | 'admin';
  judgeId?: string; // populated if role === 'judge'
};

export async function getSession(req: NextRequest): Promise<SessionUser | null> {
  const cookie = req.cookies.get('session');
  if (!cookie) return null;

  const session = await prisma.session.findUnique({
    where: { id: cookie.value },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) return null;

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role as SessionUser['role'],
    judgeId: session.user.role === 'judge' ? session.user.id : undefined,
  };
}
```

**Seeded session tokens** must be deterministic strings (not random) so they can be hardcoded into `.dogfood.toml` before running. Use a fixed prefix + random suffix generated once and committed.

---

## 📊 Normalisation — Modified Z-Score (MAD)

> [!IMPORTANT]
> The `fixtures.json` **deliberately includes a judge (jdg_30, Rafa Okonkwo) who gave every project the same score**. A standard z-score divides by standard deviation — which is **0 for that judge** → divide-by-zero → crash or NaN. This is a designed torture case. Our normalisation MUST handle it gracefully.

**Method: Modified Z-Score using Median Absolute Deviation (MAD)**

```typescript
// src/lib/normalization.ts

/**
 * Modified Z-Score normalisation per judge.
 *
 * For a judge who gave every project the same score (std = 0, MAD = 0),
 * we treat their scores as neutral (normalised value = 0) rather than
 * crashing with divide-by-zero. This is a deliberate fixture edge case.
 *
 * Formula: modified_z = 0.6745 * (x - median) / MAD
 * When MAD = 0: scores are constant → normalised = 0 for all projects.
 */
export function normaliseJudgeScores(scores: number[]): number[] {
  const sorted = [...scores].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const deviations = scores.map((s) => Math.abs(s - median));
  const mad = [...deviations].sort((a, b) => a - b)[Math.floor(deviations.length / 2)];

  if (mad === 0) {
    // All scores are identical — judge provides no discriminating signal.
    // Return zeros (neutral) rather than undefined/NaN.
    return scores.map(() => 0);
  }

  return scores.map((s) => (0.6745 * (s - median)) / mad);
}
```

**Document in `JUDGING.md`:**
- State the method and its formula
- Call out the zero-variance judge in `fixtures.json` by name (Rafa Okonkwo / jdg_30)
- Explain why MAD is chosen over standard deviation (robust to outliers, handles zero-variance case)
- Show the math worked through the edge case

---

## 📋 The 7 Checker Checks — Complete Reference

This is extracted from [`run.py`](file:///d:/TP/Hackathon/DogFood/Hack_docs/run.py). Memorise these.

```
Check 1 (T1):  GET  {gallery}           no auth          → 200
Check 2 (T1):  GET  {gallery}           no auth          → body contains fixture project title
Check 3 (T1):  POST {submit}            as participant   → 4xx (event is closed)
Check 4 (T2):  GET  {judge_scores}      as judge_a       → 200
Check 5 (T2):  GET  {peer_scores}       as judge_b       → 401 or 403   ← THE CRITICAL ONE
Check 6 (T2):  GET  {judge_scores}      as participant   → 401 or 403
Check 7 (T2):  GET  {csv_export}        as organizer     → 200 with CSV (first line has comma)
```

**`.dogfood.toml` routes mapping:**
```toml
[portal]
base_url = "http://localhost:8080"

[tiers]
claimed = ["T1", "T2"]
pitch   = "Self-hostable hackathon submission and judging platform with backend-enforced role isolation and MAD-based score normalisation."

[auth]
organizer   = "Cookie: session=org_<TOKEN>"
judge_a     = "Cookie: session=jdg_a_<TOKEN>"
judge_b     = "Cookie: session=jdg_b_<TOKEN>"
participant = "Cookie: session=prt_<TOKEN>"

[routes]
gallery      = "/projects"
submit       = "/api/projects"
judge_scores = "/api/judge/scores"
peer_scores  = "/api/judge/scores?judge=<judge_a_id>"
csv_export   = "/api/export.csv"
```

---

## 📦 Docker Setup

**`Dockerfile`:**
```dockerfile
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci --production=false

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV DATABASE_URL=file:/data/dogfood.db
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY Hack_docs/fixtures.json ./fixtures.json
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
EXPOSE 8080
CMD ["./entrypoint.sh"]
```

**`entrypoint.sh`:**
```sh
#!/bin/sh
set -e
npx prisma migrate deploy
node src/lib/seed.js   # prints session tokens
exec node server.js
```

**`docker-compose.yml`:**
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

> [!IMPORTANT]
> No second container (no PostgreSQL service). This is intentional — SQLite, single volume, zero race conditions.

---

## 📄 Required Submission Documents

| File | Contents |
|---|---|
| `README.md` | What it does, one-command startup, how to run checker, honest limitations section |
| `ARCHITECTURE.md` | System design diagram, why Next.js App Router, why SQLite, session auth design, Prisma migration path to Postgres |
| `DATA-MODEL.md` | Prisma schema, ER diagram (mermaid), how `fixtures.json` maps to schema, CSV export format |
| `JUDGING.md` | Assignment strategy, scoring rubric, MAD normalisation proof with the zero-variance judge edge case, audit trail description |
| `LICENSE` | MIT text |
| `.dogfood.toml` | Filled in with real session tokens after seed |
| `acceptance-report.txt` | Output of `python3 Hack_docs/run.py .dogfood.toml` — all 7 PASS |

> [!NOTE]
> Commit `acceptance-report.txt` even if it has FAILs. An honest FAIL is better than a missing file.

---

## 🌐 Global Rules Agents Must Follow

### PowerShell 5.1 (Windows)
- Use `;` not `&&` between commands
- Never use `rm -rf` → use `Remove-Item -Recurse -Force`
- Never use `touch` → use `New-Item -ItemType File -Path "<file>" -Force`
- Always pass `-y`, `--yes`, `--no-input` to non-interactive CLI commands

### Backend Rules ([`backend-rules.md`](file:///C:/Users/ASUS/.gemini/backend-rules.md))
- **Parse at boundaries:** All HTTP body/query inputs validated with Zod schemas before reaching service logic
- **Uniform error envelopes:** `{ error: { code, message } }` — never leak stack traces
- **Transactional integrity:** Multi-row writes in Prisma transactions
- **Layered architecture:** API routes are thin (< 25 lines), business logic in `src/lib/` services
- **Security by default:** Timing-safe session token comparison; no `Access-Control-Allow-Origin: *` on credentialed routes
- **Bounded pagination:** Gallery uses `take: 40` max — never unbounded `findMany()`
- **Structured logs:** Use `console.log(JSON.stringify({...}))` pattern; never log session tokens

### Frontend Rules ([`frontend-rules.md`](file:///C:/Users/ASUS/.gemini/frontend-rules.md))
- **No raw hex/pixel values:** Use Tailwind semantic classes
- **8pt spacing scale:** `gap-2` (8px), `gap-4` (16px), `p-4`, `p-6`, `p-8`
- **`'use client'` on leaves only:** Keep data fetching in Server Components
- **Exhaustive states:** Every data component handles Loading, Error, Empty, Success
- **Framer Motion on page views:** `initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}`
- **Accessible markup:** `<button>` not `<div onClick>`, proper `aria-*` attributes
- **Feature co-location:** Keep component + its hooks + types in same directory
- **SSR-safe:** Guard `window`/`localStorage` inside `useEffect`

### General Agent Discipline
- **Grep before creating:** Never create a utility that already exists in `src/lib/`
- **No TODO stubs:** Every function must be complete — no `// TODO: implement`
- **No `@ts-ignore` or `eslint-disable`:** Fix the root cause
- **No optional chaining to suppress nulls:** Fix the upstream data path
- **Verify with the checker:** After every meaningful backend change, mentally trace all 7 checks

---

## 🔄 Account Switching Protocol

The user may switch AI model accounts mid-build when quota is exhausted. When a new agent session starts after a switch:

1. **Read this document first** — it is the canonical state of all decisions
2. **Check `docs/implementation_plan.md`** for the current phase checklist and which tasks are marked complete `[x]`
3. **Run `git log --oneline -10`** to see the last committed state
4. **Run `python3 Hack_docs/run.py .dogfood.toml`** (if Docker is running) to see current checker state
5. **Do NOT re-ask questions already answered** — all decisions are locked in this document
6. **Continue from the next unchecked `[ ]` task** in the current phase

> [!IMPORTANT]
> Update `docs/implementation_plan.md` with `[x]` checkboxes after completing each task so the next agent session can resume without confusion.

---

## 🏆 Winning Criteria Summary

| Score Axis | Weight | How We Win |
|---|---|---|
| Tier Completion & Correctness | 40% | All 7 checker checks PASS, claim only T1+T2 honestly |
| Judging Integrity | 25% | Backend-enforced role isolation (not UI-only), MAD normalisation documented, audit trail |
| Adoptability & Operability | 20% | `docker compose up` works offline, seeds, README a stranger can follow in 90 seconds |
| Code Quality & Innovation | 15% | Clean TypeScript, Zod schemas, Prisma, idiomatic Next.js App Router |
| **Bonus: Threat Model** | tie-breaker | Written defence against Sybil votes, ballot stuffing, collusion — do AFTER T1+T2 are solid |

---

## ✅ Pre-Submission Checklist

Before the freeze deadline, verify every item:

- [ ] `docker compose up` works on a fresh clone with `--network none`, twice in a row
- [ ] All 7 checker checks show PASS in `acceptance-report.txt`
- [ ] `acceptance-report.txt` is committed to repo root
- [ ] `.dogfood.toml` at repo root with correct claimed tiers and real session tokens
- [ ] `GET /api/judge/scores?judge=<judge_a_id>` as `judge_b` returns **403 from the API** (test with curl)
- [ ] `POST /api/projects` (or submit route) as participant returns **4xx** when event is closed
- [ ] `GET /projects` returns **200 with no auth**, and contains at least one fixture project title in the HTML
- [ ] `GET /api/export.csv` as organizer returns **200 with a comma in the first CSV line**
- [ ] `JUDGING.md` explains the zero-variance judge (MAD normalisation) in narrative prose
- [ ] `README.md` has honest "Known Limitations" section (no overselling)
- [ ] Repo is **public** on GitHub
- [ ] OSI `LICENSE` (MIT) file present at repo root
- [ ] 5-minute demo video recorded showing: create event → submit project → judge scores → organizer exports CSV
- [ ] `.dogfood.toml` `claimed` array matches what `acceptance-report.txt` says `verified`

---

*Last updated: 2026-09-27. Generated from alignment session with the user.*
