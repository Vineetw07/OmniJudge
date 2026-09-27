# Dispatch Log

## 2026-09-27T09:36:57Z
You are the Project Orchestrator for Phase 3 (T2 Judging) of the DOGFOOD 2026 hackathon portal.

Your working directory is:
d:\TP\Hackathon\DogFood\.agents\teamwork\orchestrator_phase3

The project root is:
d:\TP\Hackathon\DogFood

The authoritative user requirements are recorded in:
d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md (see the latest entry dated 2026-09-27T09:35:47Z).

Key Mission Requirements:
1. R1. Judge Scores API with Strict RBAC Isolation (GET /api/judge/scores):
   - Returns 200 with the judge's own submitted scores when accessed by authenticated judge (e.g. judge_a).
   - Critical RBAC Boundary: Returns 403 Forbidden when a judge requests peer scores via query parameter (e.g. ?judge=user_jdg_a_01 accessed by judge_b). This must be strictly validated server-side against the authenticated session user ID to prevent data leakage.
   - Returns 401 Unauthorized or 403 Forbidden when accessed by a participant or unauthenticated user.
2. R2. Score Submission & Audit Logging (POST /api/judge/scores):
   - Accepts rubric-based scores from authenticated judges for assigned projects.
   - Validates payload with Zod (project ID, criterion scores within rubric min/max ranges, optional comments).
   - Saves scores and records an immutable log in the AuditLog table (action: "score_submitted", userId, payload).
   - Rejects submissions from non-judges or judges attempting to score unassigned tracks/projects if assignments are restricted.
3. R3. Organizer CSV Export with MAD Normalization (GET /api/export.csv):
   - Strictly restricted to organizer/admin sessions (returns 403 for judges, participants, anonymous visitors).
   - Returns 200 with Content-Type: text/csv; charset=utf-8 and valid CSV payload.
   - First line MUST contain a comma (valid CSV header, e.g. project_id,project_title,track,raw_score,normalized_score,rank).
   - Implements cross-judge normalization using Median Absolute Deviation (MAD) via src/lib/normalization.ts to neutralize judge bias while gracefully handling zero-variance judges (e.g. jdg_30, Rafa Okonkwo) without divide-by-zero errors.
4. R4. Judging and Progress Portal UI:
   - /judge: Responsive interface for judges to view assigned projects, select rubric criteria, enter comments, and submit scores.
   - /dashboard: Organizer dashboard showing real-time judging progress (total projects, scored projects, pending reviews, judge completion status).
5. R5. Session Continuity & Progress Ledger:
   - Adhere to PowerShell 5.1 syntax (use `;` rather than `&&`).
   - Update d:\TP\Hackathon\DogFood\PROGRESS.md with completed T2 deliverables and current checker state.
   - Create git commit with commit message prefix `[PROGRESS] Phase 3: ...`.

Acceptance Criteria:
- Running `python Hack_docs/run.py .dogfood.toml` results in all 7 checks passing:
  * T1 gallery is public (PASS)
  * T1 project from fixtures shown (PASS)
  * T1 closed event refuses submissions (PASS)
  * T2 judge sees own scores (PASS)
  * T2 judge cannot see peer scores (PASS)
  * T2 participant blocked (PASS)
  * T2 csv export works (PASS)
  Checker summary must print: `claimed T1 T2, verified T1 T2`.
- `npm run typecheck` completes with 0 errors.
- Peer score probe via curl/urllib (`/api/judge/scores?judge=user_jdg_a_01` with `judge_b` session cookie) returns 403 HTTP status code directly from server route handler.
- `/api/export.csv` returns 403 when requested by non-organizers.
- AuditLog entries are created upon score submissions.
- PROGRESS.md reflects Phase 3 completion and git commit is created.

## 2026-09-27T09:41:41Z
CRITICAL DIRECTIVE FROM USER & BUILD PLAN (dogfood_build_plan.md):
Ensure strict adherence across all subagents (explorers, workers, reviewers, challengers, auditor):
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
