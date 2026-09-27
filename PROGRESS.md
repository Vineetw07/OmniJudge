# DOGFOOD 2026 — Live Progress Ledger

> **For agents:** Read this file FIRST before touching any code. Update it and commit after EVERY completed task.
> Commit message format: `git commit -m "[PROGRESS] Phase X: <what was done>, <what is next>"`

---

Last updated: 2026-09-27T11:51:00+05:30
Current phase: **Phase 1 — Foundation** (NOT STARTED)
Last completed task: —
Next task: Scaffold Next.js 14 project with `create-next-app@14`
Known blockers: Waiting for user to confirm GitHub repo URL and verify Node.js v20+ is installed
Checker state: not yet run (Docker not built)
Docker state: not built

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
- [ ] Next.js 14 project scaffolded (`create-next-app@14`)
- [ ] All production npm packages installed (prisma, zod, framer-motion, lucide-react, clsx, tailwind-merge, class-variance-authority)
- [ ] shadcn/ui initialised and all components installed
- [ ] Dev dependencies installed (tsx, better-sqlite3)
- [ ] `package.json` scripts configured (dev, build, start, seed, db:migrate, typecheck)
- [ ] `prisma/schema.prisma` written (full data model)
- [ ] `npx prisma generate` run successfully
- [ ] `npx prisma migrate dev --name init` run successfully
- [ ] `src/lib/prisma.ts` — Prisma singleton written
- [ ] `src/lib/auth.ts` — getSession() helper written
- [ ] `src/lib/seed.ts` — fixtures loader + session token printer written
- [ ] `src/lib/normalization.ts` — MAD normalisation function written
- [ ] `.env` + `.env.example` created
- [ ] `.gitignore` configured
- [ ] `Dockerfile` written (multi-stage, node:20-alpine, port 8080)
- [ ] `docker-compose.yml` written (single service, /data volume)
- [ ] `entrypoint.sh` written (migrate → seed → start)
- [ ] `docker compose up` tested — container starts, seeds, prints session tokens
- [ ] GitHub remote added + initial commit pushed

### Phase 2 — T1 Core (Senior Full-Stack Engineer)
- [ ] Not started

### Phase 3 — T2 Judging (Staff Security Engineer + Backend Architect)
- [ ] Not started

### Phase 4 — Docs + Checker Green (Senior Technical Writer + QA Engineer)
- [ ] Not started

### Phase 5 — UI Polish + Freeze Rehearsal (Senior UI/UX Engineer)
- [ ] Not started

### Phase 6 — T3 Community Voting (Full-Stack Product Engineer) [IF TIME PERMITS]
- [ ] Not started

---

## Checker History

| Timestamp | T1 gallery public | T1 fixture shown | T1 closed submission | T2 judge own scores | T2 peer blocked | T2 participant blocked | T2 csv export | Overall |
|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | not run |

---

## Known Issues / Blockers

_None yet._

---

## Session Log

| Timestamp | Model | Account | Action | Result |
|---|---|---|---|---|
| 2026-09-27T11:51:00+05:30 | Claude Sonnet | Account 1 | Created plan document + PROGRESS.md | Plan approved |

---

> **Update rule:** After completing any `[ ]` task above, change it to `[x]`, update the header fields (Last updated, Last completed task, Next task), and run:
> ```powershell
> git -C "d:\TP\Hackathon\DogFood" add PROGRESS.md
> git -C "d:\TP\Hackathon\DogFood" commit -m "[PROGRESS] Phase X: <completed task>, next: <next task>"
> ```
