## 2026-09-27T15:14:00Z
You are the Principal Worker for Phase 3 (T2 Judging) of the DOGFOOD 2026 hackathon portal.
Your working directory is: d:\TP\Hackathon\DogFood\.agents\teamwork\worker_phase3
Your parent is the Phase 3 Orchestrator (Conversation ID: 11b8f726-9a5b-4133-ab58-3e8b73870dcf).

You MUST read d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md thoroughly before starting.
Also review:
- `d:\TP\Hackathon\DogFood\.agents\teamwork\orchestrator_phase3\PROJECT.md`
- `d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_survey_1\handoff.md`
- `d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_survey_2\handoff.md`
- `d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_survey_3\handoff.md`
- Backend rules: `C:\Users\ASUS\.gemini\backend-rules.md`
- Frontend rules: `C:\Users\ASUS\.gemini\frontend-rules.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

FILE WRITE OWNERSHIP:
You have exclusive write access to:
- `src/lib/auth.ts`
- `src/app/api/judge/scores/route.ts`
- `src/app/api/export.csv/route.ts`
- `src/app/judge/page.tsx` (and any client components in `src/app/judge/`)
- `src/app/dashboard/page.tsx` (and any components in `src/app/dashboard/`)
- `PROGRESS.md`

TASKS:
1. `src/lib/auth.ts`:
   - Add `getServerSession()` helper that reads the `session` cookie via `cookies()` from `next/headers`, queries `prisma.session.findUnique({ where: { id: token }, include: { user: true } })`, validates expiration (`session.expiresAt < new Date()`), and returns `SessionUser | null`.

2. `src/app/api/judge/scores/route.ts`:
   - `GET /api/judge/scores`:
     - Authenticate via `getSession(req)`. If not authenticated -> 401 Unauthorized.
     - If `user.role === 'participant'` (or visitor) -> 403 Forbidden.
     - Extract `const targetJudge = req.nextUrl.searchParams.get('judge')`.
     - Strict RBAC Boundary: If `user.role === 'judge'`:
       * If `targetJudge && targetJudge !== user.id`: return 403 Forbidden (`{ error: "Forbidden: Cannot view peer judge scores" }`).
       * Query only this judge's scores: `where: { judgeId: user.id }`.
       * Return 200 with `{ scores: [...] }`.
     - If `user.role === 'organizer' || user.role === 'admin'`:
       * If `targetJudge`: query where `judgeId: targetJudge`.
       * Else query all scores. Return 200.
   - `POST /api/judge/scores`:
     - Authenticate via `getSession(req)`. If not authenticated -> 401. If `user.role !== 'judge' && user.role !== 'organizer' && user.role !== 'admin'` -> 403.
     - Validate body using Zod schema (projectId, scores array with criterionId & value (0 to 5), optional comment).
     - Check track assignment: verify judge is assigned to project's track (`prisma.judgeAssignment.findFirst({ where: { userId: user.id, trackId: project.trackId } })`).
     - In `prisma.$transaction`:
       * Upsert score rows for each criterion (findFirst then update or create, as Score lacks composite unique constraint).
       * Insert AuditLog entry: `action: "score_submitted"`, `userId: user.id`, `payload: JSON.stringify({ projectId, trackId, scores, comment, submittedAt })`.
     - Return 200/201 JSON.

3. `src/app/api/export.csv/route.ts`:
   - `GET /api/export.csv`:
     - Authenticate via `getSession(req)`.
     - If not authenticated -> 401.
     - If `user.role !== 'organizer' && user.role !== 'admin'` -> 403 Forbidden.
     - Gather all projects, rubric criteria, tracks, and scores.
     - Calculate raw composite scores per judge and project using criterion weights.
     - Apply MAD normalization from `src/lib/normalization.ts` (`normaliseAllJudges` or `normaliseJudgeScores`), handling zero-variance judges cleanly.
     - Compute project average raw and normalized scores.
     - Sort descending by normalized score, break ties by raw score. Assign rank 1..N.
     - Return CSV with Content-Type `text/csv; charset=utf-8`. Line 1 MUST contain comma: `project_id,project_title,track,raw_score,normalized_score,rank`.

4. UI Pages:
   - `src/app/judge/page.tsx`: Responsive judge scoring portal. Server Component checking `getServerSession()`. Lists assigned projects by track, rubric criteria forms with score inputs/buttons, comments textarea, status badges (Scored vs Pending), and submission to `POST /api/judge/scores`.
   - `src/app/dashboard/page.tsx`: Organizer dashboard. Server Component checking `getServerSession()`. Displays KPI cards (Total Projects, Scored Projects, Total Reviews, Judge Completion Rate), Judge Progress table, Project Leaderboard with MAD scores, button linking to `/api/export.csv`, and recent AuditLog entries.

5. VERIFICATION:
   - Run `npm run typecheck` (MUST be 0 errors).
   - Ensure the Next.js dev server is running on port 8080 (check or start in background via run_command with IsDaemon=true if needed).
   - Run `python Hack_docs/run.py .dogfood.toml`. ALL 7 checks MUST pass:
     * T1 gallery is public (PASS)
     * T1 project from fixtures shown (PASS)
     * T1 closed event refuses submissions (PASS)
     * T2 judge sees own scores (PASS)
     * T2 judge cannot see peer scores (PASS)
     * T2 participant blocked (PASS)
     * T2 csv export works (PASS)
   Checker summary must print: `claimed T1 T2, verified T1 T2`.
   - Test peer score probe directly: `GET http://localhost:8080/api/judge/scores?judge=user_jdg_a_01` with `Cookie: session=jdg_b_seed_token_2026` returns 403.
   - Test `/api/export.csv` with non-organizer returns 403.
   - Check that `AuditLog` table has entries.
   - Update `PROGRESS.md` marking Phase 3 deliverables `[x]` and updating checker state to `T1 PASS, T2 PASS (claimed T1 T2, verified T1 T2)`.
