# DOGFOOD 2026 — Live Progress Ledger

> **For agents:** Read this file FIRST before touching any code. Update it and commit after EVERY completed task.
> Commit message format: `git commit -m "[PROGRESS] Phase X: <what was done>, <what is next>"`

---

Last updated: 2026-09-27T15:22:00+05:30
Current phase: Phase 4 — Docs + Checker Green
Last completed task: Phase 3 (T2 Judging) complete: judge scores API with RBAC isolation, transactional submission with AuditLog, MAD CSV export, judge portal UI, organizer dashboard UI
Next task: Phase 4 documentation and QA hardening
Known blockers: Docker not yet tested end-to-end (docker CLI not in PATH at time of Phase 1 — may need PATH fix or Docker Desktop CLI plugin install)
Checker state: T1 PASS, T2 PASS (claimed T1 T2, verified T1 T2)
Docker state: Dockerfile + docker-compose.yml written, not yet built/tested

---

## 🧭 Agent Orientation Commands (Run on Every Session Start)

```powershell
# 1. Read this file
Get-Content "d:\TP\Hackathon\DogFood\PROGRESS.md"

# 2. Check git state
git -C "d:\TP\Hackathon\DogFood" log --oneline -10
git -C "d:\TP\Hackathon\DogFood" status

# 3. Check Docker
docker ps

# 4. Run acceptance checker (only if .dogfood.toml exists)
python "d:\TP\Hackathon\DogFood\Hack_docs\run.py" "d:\TP\Hackathon\DogFood\.dogfood.toml"

# 5. Scan for resume markers
Select-String -Path "d:\TP\Hackathon\DogFood\src\*" -Pattern "RESUME_HERE|TODO|FIXME" -Recurse
```

---

## Phase Completion Status

### Phase 1 — Foundation (Principal Infrastructure Engineer)
- [x] Next.js 14 project scaffolded (`create-next-app@14`)
- [x] All production npm packages installed (prisma, zod, framer-motion, lucide-react, clsx, tailwind-merge, class-variance-authority)
- [x] shadcn/ui initialised and all 15 components installed
- [x] Dev dependencies installed (tsx, better-sqlite3)
- [x] `package.json` scripts configured (dev, build, start, seed, db:migrate, typecheck)
- [x] `prisma/schema.prisma` written (11 models: User, Session, Event, Track, Team, TeamMember, Project, RubricCriterion, JudgeAssignment, Score, AuditLog)
- [x] `npx prisma generate` run successfully
- [x] `npx prisma migrate dev --name init` run successfully (migration file created)
- [x] `src/lib/prisma.ts` — Prisma singleton written
- [x] `src/lib/auth.ts` — getSession() helper written (with raw cookie header fallback for checker)
- [x] `src/lib/seed.ts` — fixtures loader + deterministic session token printer written
- [x] `src/lib/normalization.ts` — MAD normalisation function written and tested
- [x] `.env` + `.env.example` created
- [x] `.gitignore` configured
- [x] `Dockerfile` written (multi-stage, node:20-alpine, port 8080)
- [x] `docker-compose.yml` written (single service, /data volume)
- [x] `entrypoint.sh` written (migrate → seed → start)
- [x] `npm run seed` tested — prints 4 deterministic tokens, idempotent (run twice, no duplicates)
- [x] `npm run typecheck` — 0 errors
- [x] MAD zero-variance test — `normaliseJudgeScores([3,3,3,3])` = `[0,0,0,0]` ✅
- [x] Initial git commit pushed
- [ ] `docker compose up` end-to-end test (run in terminal to verify container startup)
- [x] GitHub remote added and pushed: `git@github.com:Vineetw07/dogfood-portal.git` (branch: `master`)

### Phase 2 — T1 Core (Senior Full-Stack Engineer)
- [x] `GET /projects` public gallery page — server-rendered HTML, NO auth required, returns 200
- [x] Gallery body contains fixture project titles ("Glass Signal", "Small Meadow", "Deep Compass")
- [x] `POST /api/projects` (or `/api/submissions`) — returns 4xx when event `submissionsClose` is in the past
- [x] Login page at `/login` — accepts email, sets `Cookie: session=<token>` from DB
- [x] Full role model enforced server-side
- [x] `.dogfood.toml` written at repo root with session tokens

### Phase 3 — T2 Judging (Staff Security Engineer + Backend Architect)
- [x] Server Component session helper: `getServerSession()` in `src/lib/auth.ts`
- [x] `GET /api/judge/scores` — returns 200 with own scores for authenticated judge
- [x] Strict RBAC isolation — `GET /api/judge/scores?judge=user_jdg_a_01` returns 403 Forbidden when accessed by judge_b
- [x] Non-judge blocking — `GET /api/judge/scores` returns 403 for participant and 401 for anonymous
- [x] `POST /api/judge/scores` — rubric scores with Zod validation, track assignment check, atomic upserts & AuditLog creation
- [x] `GET /api/export.csv` — restricted to organizer (403 for judges/participants), MAD normalization with zero-variance protection, valid CSV
- [x] `/judge` — responsive judge scoring portal with track filtering, rubric inputs & real-time composite score
- [x] `/dashboard` — organizer control tower with KPI cards, judge progress table, MAD-normalized leaderboard & audit trail
- [x] Acceptance checker: `python Hack_docs/run.py .dogfood.toml` all 7 checks PASS (claimed T1 T2, verified T1 T2)

### Phase 4 — Docs + Checker Green (Senior Technical Writer + QA Engineer)
- [ ] Not started

### Phase 5 — UI Polish + Freeze Rehearsal (Senior UI/UX Engineer)
- [ ] Not started

### Phase 6 — T3 Community Voting (Full-Stack Product Engineer) [IF TIME PERMITS]
- [ ] Not started

---

## Session Tokens (copy into .dogfood.toml)

```
organizer    Cookie: session=org_seed_token_2026
judge_a      Cookie: session=jdg_a_seed_token_2026
judge_b      Cookie: session=jdg_b_seed_token_2026
participant  Cookie: session=prt_seed_token_2026
```

---

## Checker History

| Timestamp | T1 gallery | T1 fixture | T1 closed sub | T2 own scores | T2 peer blocked | T2 participant blocked | T2 csv | Overall |
|---|---|---|---|---|---|---|---|---|
| 2026-09-27T14:24:00+05:30 | PASS | PASS | PASS | — | — | — | — | T1 PASS |
| 2026-09-27T15:22:00+05:30 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | T1 PASS, T2 PASS |

---

## Known Issues / Blockers

1. **Docker CLI not in PATH during Phase 1** — `docker` command not found in PowerShell at time of verification. Docker Desktop is installed and open. Fix: restart PowerShell after Docker Desktop starts, or add Docker CLI to PATH manually. Docker files are correct — just needs CLI access to test.
2. ~~**GitHub remote not set**~~ — **RESOLVED**: Remote is `git@github.com:Vineetw07/dogfood-portal.git` (already set and pushed).

---

## Session Log

| Timestamp | Model | Account | Action | Result |
|---|---|---|---|---|
| 2026-09-27T11:51:00+05:30 | Claude Sonnet | Account 1 | Created plan document + PROGRESS.md | Plan approved |
| 2026-09-27T12:03:00+05:30 | Gemini | Account 1 | Launched teamwork Phase 1 agent | Scaffold + Tailwind fix completed |
| 2026-09-27T13:45:00+05:30 | Gemini | Account 2 | Resumed — wrote schema, lib files, Docker, ran seed + typecheck | Phase 1 complete |
| 2026-09-27T14:24:00+05:30 | Gemini | Account 2 | Phase 2 complete: gallery, submission close enforcement, login flow, .dogfood.toml | T1 PASS |
| 2026-09-27T15:22:00+05:30 | Gemini | Principal Worker | Phase 3 complete: judge scores API, strict RBAC, MAD normalization, CSV export, judge & dashboard UI | T1 PASS, T2 PASS |

---

> **Update rule:** After completing any `[ ]` task above, change it to `[x]`, update the header fields, and commit with `[PROGRESS]` prefix.
