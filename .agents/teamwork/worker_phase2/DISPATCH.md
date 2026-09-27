## 2026-09-27T08:40:00Z
You are worker_phase2, a Worker agent.
Your working directory is: d:\TP\Hackathon\DogFood\.agents\teamwork\worker_phase2
Project root: d:\TP\Hackathon\DogFood

Objective:
Implement Phase 2 (T1 Core) of DOGFOOD 2026:
- R1: Public project gallery at GET /projects (src/app/projects/page.tsx)
- R2: Submission close check at POST /api/projects (src/app/api/projects/route.ts)
- R3: Login page at GET /login (src/app/login/page.tsx) & POST /api/auth/login (src/app/api/auth/login/route.ts)
- R4: .dogfood.toml at repo root with seeded tokens and actual DB userId for judge_a in peer_scores

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Exclusive Write Ownership:
You have exclusive write ownership over:
- src/app/projects/page.tsx
- src/app/api/projects/route.ts
- src/app/login/page.tsx
- src/app/api/auth/login/route.ts
- .dogfood.toml
Do NOT touch other files unless strictly necessary.

Reference Files (READ THESE FIRST):
1. d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md (mandatory - read the latest section ## 2026-09-27T08:33:16Z)
2. d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_phase2_3\handoff.md (detailed code blueprints for all 4 routes)
3. d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_phase2_2\handoff.md (auth, DB schema, tokens, judge_a userId)
4. d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_phase2_1\handoff.md (T1 check logic in Hack_docs/run.py)

Technical Instructions:
1. Implement `src/app/projects/page.tsx`:
   - Next.js Server Component, public access (no auth, returns 200).
   - `export const dynamic = 'force-dynamic';`
   - Queries `prisma.project.findMany({ take: 40, orderBy: { id: 'asc' }, include: { team: true, track: true } })`.
   - Renders project titles prominently in HTML so "Glass Signal", "Small Meadow", "Deep Compass" appear in plain text.
   - Beautifully styled using Tailwind CSS and shadcn/ui Card components.
2. Implement `src/app/api/projects/route.ts`:
   - POST handler, `export const dynamic = 'force-dynamic';`
   - Authenticates participant session with `getSession(req)`. Returns 401 if unauthenticated, 403 if not participant/organizer/admin.
   - Body validation with Zod (`title` and `summary` required, other fields optional).
   - Queries `prisma.event.findFirst()`, compares `event.submissionsClose < new Date()`.
   - Returns 409 Conflict when event is closed (fixture deadline was March 1, 2026).
3. Implement `src/app/login/page.tsx` & `src/app/api/auth/login/route.ts`:
   - `src/app/login/page.tsx`: Clean UI with email input, error display, quick buttons for demo users.
   - `src/app/api/auth/login/route.ts`: POST handler. Validates email with Zod. Finds user in DB (returns 401 if not found). Reuses active session or generates UUID session in `prisma.session`. Sets `session` cookie with `httpOnly: true, path: '/', sameSite: 'lax', secure: false, maxAge: 30 * 24 * 60 * 60`.
4. Create `.dogfood.toml` at repo root:
   - Use exact format from `Hack_docs/example.dogfood.toml`:
     [portal] base_url = "http://localhost:8080"
     [tiers] claimed = ["T1", "T2"]
     [auth] organizer, judge_a, judge_b, participant with exact seeded tokens
     [routes] gallery = "/projects", submit = "/api/projects", judge_scores = "/api/judge/scores", peer_scores = "/api/judge/scores?judge=user_jdg_a_01", csv_export = "/api/export.csv"
5. Mandatory Verification:
   - Run `npm run typecheck` — MUST exit with 0 errors.
   - Run `npm run build` — MUST build successfully.
   - Verify T1 acceptance checks: start dev server or run `python Hack_docs\run.py .dogfood.toml`.
6. Write your comprehensive handoff report to:
   `d:\TP\Hackathon\DogFood\.agents\teamwork\worker_phase2\handoff.md`
   Follow Handoff Protocol: Observation, Logic Chain, Caveats, Conclusion, Verification Method. Include exact command outputs.
7. Send a message to your parent orchestrator (conversation ID: 186d10b4-86b5-46d2-b95c-554f456fd6cf) when done.
