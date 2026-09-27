## 2026-09-27T08:34:12Z

You are the Project Orchestrator for Phase 2 — T1 Core of DOGFOOD 2026.

Your working directory is:
d:\TP\Hackathon\DogFood\.agents\teamwork\orchestrator_phase2

The project root is:
d:\TP\Hackathon\DogFood

Read the authoritative user request in:
d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md (specifically the latest section ## 2026-09-27T08:33:16Z)

Follow the Agent Orientation Protocol first:
1. Get-Content "d:\TP\Hackathon\DogFood\PROGRESS.md"
2. git -C "d:\TP\Hackathon\DogFood" log --oneline -10
3. git -C "d:\TP\Hackathon\DogFood" status
4. Get-ChildItem "d:\TP\Hackathon\DogFood\src" -Recurse -Name
5. Read Hack_docs\spec.md
6. Read Hack_docs\run.py lines 91–141 (T1 checks)
7. Read src\lib\auth.ts
8. Read src\lib\seed.ts

Requirements:
- R1: Public project gallery at GET /projects (src/app/projects/page.tsx)
- R2: Submission close check at POST /api/projects
- R3: Login page at GET /login and POST /api/auth/login
- R4: .dogfood.toml at repo root with seeded tokens and actual DB userId for judge_a in peer_scores
- R5: Update PROGRESS.md and git commit with message "[PROGRESS] Phase 2: T1 gallery, submit close, login, .dogfood.toml — Phase 3 T2 judging next"

Acceptance Criteria:
- T1 Gallery Check passes with `python Hack_docs\run.py .dogfood.toml` (start dev server on port 8080 if needed to verify)
- T1 Submission Close Check passes
- `npm run typecheck` passes with 0 errors
- `npm run build` succeeds
- All Phase 2 checkboxes in PROGRESS.md toggled to [x]
- Commit made

Important:
- Continuously update your progress.md in your working directory (`d:\TP\Hackathon\DogFood\.agents\teamwork\orchestrator_phase2\progress.md`).
- Ensure all subagent working directories are created under `.agents/teamwork/<agent_dir>/`.
- When all criteria are met and verified, send a message to Sentinel declaring project completion.
