# Phase 3 (T2 Judging) Codebase & Database Schema Survey Report

**Agent**: Survey Explorer 1 (`explorer_survey_1`)  
**Role**: Codebase & Database Schema Explorer  
**Date**: 2026-09-27T09:45:00Z  
**Target Milestone**: Phase 3 — T2 Judging  

---

## 1. Observation

### 1.1 Authentication & Session Resolution (`src/lib/auth.ts`)
- **File location**: `d:\TP\Hackathon\DogFood\src\lib\auth.ts` (74 lines).
- **SessionUser type** (lines 8–14):
  ```typescript
  export type SessionUser = {
    id: string;
    email: string;
    name: string;
    role: 'visitor' | 'participant' | 'judge' | 'organizer' | 'admin';
    judgeId?: string;
  };
  ```
- **Session retrieval logic** (lines 24–48):
  - `getSession(req: NextRequest): Promise<SessionUser | null>`
  - First attempts `req.cookies.get('session')?.value` (line 26–27).
  - Robust fallback: calls `extractSessionFromCookieHeader(cookieHeader)` (line 27 & lines 54–58), matching regex `/(?:^|;\s*)session=([^;]+)/`. This handles raw `Cookie: session=<token>` headers sent directly by python's `urllib.request` in `run.py` or curl.
  - Queries database: `prisma.session.findUnique({ where: { id: token }, include: { user: true } })` (lines 31–34).
  - **Expiry validation**: Line 37 directly checks:
    ```typescript
    if (session.expiresAt < new Date()) return null;
    ```
    Expiry is strictly enforced against server timestamp.
  - **User role & judgeId**: Line 39 casts `session.user.role as SessionUser['role']`. Line 46 conditionally sets `judgeId: role === 'judge' ? session.user.id : undefined`.
  - **Role guard helpers** (lines 63–73): `isOrganizer(user)`, `isJudge(user)`, `isParticipant(user)`.
- **Limitation**: `getSession(req)` strictly expects `NextRequest`. Server Component pages (`page.tsx`) in Next.js App Router do not have `NextRequest` in their props and cannot invoke this function directly without a helper reading `cookies()` from `next/headers`.

### 1.2 Seed Script & Prisma Singleton (`src/lib/seed.ts` & `src/lib/prisma.ts`)
- **`src/lib/prisma.ts`** (19 lines): Exports `prisma` singleton attached to `globalThis` in development to survive HMR module reload.
- **`src/lib/seed.ts`** (264 lines):
  - **4 Deterministic Test Users** (lines 10–39):
    1. Organizer: id `'user_org_01'`, email `'organizer@dogfood.dev'`, name `'Organizer'`, role `'organizer'`, token `'org_seed_token_2026'`
    2. Judge Alpha: id `'user_jdg_a_01'`, email `'judge_a@dogfood.dev'`, name `'Judge Alpha'`, role `'judge'`, token `'jdg_a_seed_token_2026'`, assigned track `'trk_01'` (lines 230–237)
    3. Judge Beta: id `'user_jdg_b_01'`, email `'judge_b@dogfood.dev'`, name `'Judge Beta'`, role `'judge'`, token `'jdg_b_seed_token_2026'`, assigned track `'trk_02'` (lines 239–246)
    4. Participant: id `'user_prt_01'`, email `'participant@dogfood.dev'`, name `'Participant'`, role `'participant'`, token `'prt_seed_token_2026'`
  - **Session expiry**: Hardcoded to 1 year in the future (`expiresAt.setFullYear(expiresAt.getFullYear() + 1)`, lines 212–213).
  - **Fixtures Seeding**:
    - Event: `evt_01` ("Sample Hack 2026"), `submissionsClose = "2026-03-01T18:00:00Z"` (already in past).
    - Tracks: 8 tracks (`trk_01` to `trk_08`).
    - Teams: 40 teams (`tm_01` to `tm_40`).
    - Projects: 41 projects (`prj_01` to `prj_41`).
    - Judges: 30 fixture judges (`jdg_01` to `jdg_30`), each seeded with role `'judge'` and `JudgeAssignment` records per track in `judge.tracks`.
    - Rubric Criteria (lines 42–47):
      - `functionality`: weight 1.5, maxScore 5
      - `quality`: weight 1.0, maxScore 5
      - `creativity`: weight 1.0, maxScore 5
      - `presentation`: weight 0.5, maxScore 5
    - Scores: 252 score records seeded from `fixtures.scores` for judges `jdg_01`..`jdg_30`.
    - **Current Live DB State**:
      - `users count`: 34 (30 fixture judges + 4 test accounts)
      - `projects count`: 41
      - `scores count`: 252
      - `judge_a scores count`: 0 (Judge Alpha has not submitted any scores yet)
      - `rubric criteria`: 4 rows
      - `audit logs count`: 0

### 1.3 Database Models & Schema Constraints (`prisma/schema.prisma`)
The schema contains 11 models:
1. `User`: `id` (String @id @default(cuid())), `email` (String @unique), `name` (String), `role` (String), `createdAt` (DateTime @default(now())). Relations: `sessions`, `teamMember`, `judgeAssignments`, `scores`, `auditLogs`.
2. `Session`: `id` (String @id - token itself), `userId` (String), `user` (User), `createdAt` (DateTime @default(now())), `expiresAt` (DateTime).
3. `Event`: `id` (String @id), `name` (String), `submissionsClose` (DateTime), `createdAt` (DateTime @default(now())). Relations: `tracks`, `projects`.
4. `Track`: `id` (String @id), `name` (String), `eventId` (String), `event` (Event). Relations: `projects`, `judgeAssignments`.
5. `Team`: `id` (String @id), `name` (String). Relations: `members`, `projects`.
6. `TeamMember`: `id` (String @id @default(cuid())), `userId` (String @unique), `teamId` (String). Relations: `user`, `team`.
7. `Project`: `id` (String @id), `teamId` (String), `trackId` (String), `eventId` (String), `title` (String), `summary` (String), `repoUrl` (String), `submittedAt` (DateTime), `isDraft` (Boolean @default(false)). Relations: `team`, `track`, `event`, `scores`.
8. `RubricCriterion`: `id` (String @id @default(cuid())), `name` (String), `weight` (Float @default(1.0)), `maxScore` (Int @default(5)). Relations: `scores`.
9. `JudgeAssignment`: `id` (String @id @default(cuid())), `userId` (String), `trackId` (String). Relations: `user`, `track`.  
   *Constraint Note*: No `@unique([userId, trackId])` composite constraint exists in the schema.
10. `Score`: `id` (String @id @default(cuid())), `judgeId` (String), `projectId` (String), `criterionId` (String), `value` (Float), `comment` (String @default("")), `submittedAt` (DateTime @default(now())). Relations: `judge` (User), `project` (Project), `criterion` (RubricCriterion).  
   *Constraint Note*: No `@unique([judgeId, projectId, criterionId])` composite constraint exists in the schema. Multiple rows could be created for the same criterion if not prevented at the application level.
11. `AuditLog`: `id` (String @id @default(cuid())), `userId` (String), `action` (String), `payload` (String @default("{}")), `createdAt` (DateTime @default(now())). Relation: `user` (User).

### 1.4 Existing App Routes & Missing Phase 3 Endpoints
Inspection of `src/app` via filesystem and build output:
- **Existing Routes**:
  - `src/app/api/auth/login/route.ts` (`POST /api/auth/login`): Validates email, looks up user, returns/creates session token, sets `session` cookie.
  - `src/app/api/projects/route.ts` (`GET /api/projects`, `POST /api/projects`): Returns public list of projects (max 40); rejects late submissions when `event.submissionsClose < Date.now()`.
  - `src/app/login/page.tsx`: Interactive sign-in page with quick-select seeded credentials.
  - `src/app/projects/page.tsx`: Public gallery server component rendering cards with project titles.
  - `src/app/page.tsx`: Default Next.js starter page.
- **Missing Routes / Pages Required for Phase 3**:
  - `src/app/api/judge/scores/route.ts` — **MISSING** (Handles `GET` and `POST /api/judge/scores`).
  - `src/app/api/export.csv/route.ts` — **MISSING** (Handles `GET /api/export.csv`).
  - `src/app/judge/page.tsx` — **MISSING** (Judge scoring and assigned project review portal).
  - `src/app/dashboard/page.tsx` — **MISSING** (Organizer real-time judging progress dashboard).

### 1.5 Acceptance Checker & Normalization Utility
- **Acceptance Suite (`Hack_docs/run.py` lines 143–187)**:
  - `judge sees own scores`: `GET /api/judge/scores` with `judge_a` cookie -> expects HTTP 200.
  - `judge cannot see peer scores`: `GET /api/judge/scores?judge=user_jdg_a_01` with `judge_b` cookie -> expects HTTP 401 or 403.
  - `participant blocked`: `GET /api/judge/scores` with `participant` cookie -> expects HTTP 401 or 403.
  - `csv export works`: `GET /api/export.csv` with `organizer` cookie -> expects HTTP 200 and comma `,` in first line of response.
- **Normalization Utility (`src/lib/normalization.ts`)**:
  - `normaliseJudgeScores(scores: number[]): number[]`: Implements Modified Z-Score using MAD (`0.6745 * (s - median) / mad`). Handles zero-variance judges (e.g. `jdg_30` Rafa Okonkwo with `mad === 0`) by returning neutral `0`s instead of crashing with `NaN`.
  - `normaliseAllJudges(judgeScores: Map<string, Map<string, number>>)`: Ready to transform judge-project score matrices.

---

## 2. Logic Chain

1. **RBAC Isolation Enforcement in `GET /api/judge/scores`**:
   - Observation 1.1 shows `getSession(req)` extracts `SessionUser`, including `role` and `id`.
   - Observation 1.5 shows `run.py` tests peer score access by calling `GET /api/judge/scores?judge=user_jdg_a_01` as `judge_b`.
   - Therefore, the route handler must extract `const requestedJudgeId = req.nextUrl.searchParams.get('judge')`.
   - If `session.role !== 'judge' && session.role !== 'organizer' && session.role !== 'admin'`, return 403 Forbidden (blocking participants and unauthenticated users with 401).
   - If `session.role === 'judge'` and `requestedJudgeId && requestedJudgeId !== session.id`, return 403 Forbidden directly from the handler.
   - If `session.role === 'judge'` without `judge` param or matching `session.id`, query and return only scores where `judgeId: session.id`. Even if 0 scores exist (as shown in Observation 1.2), returning `[]` with status 200 satisfies `judge sees own scores`.

2. **Score Persistence & Deduplication in `POST /api/judge/scores`**:
   - Observation 1.3 shows `Score` model lacks a unique constraint on `(judgeId, projectId, criterionId)`.
   - If a judge re-evaluates a project, a naive `prisma.score.create()` would create duplicate records and corrupt normalization averages.
   - Therefore, the handler must either:
     a) Use a transaction that finds existing score records for `(judgeId, projectId, criterionId)` and updates them, or deletes previous scores for that `(judgeId, projectId)` before inserting new ones.
     b) Enforce track assignment: verify `JudgeAssignment` exists for `userId == session.id` and `trackId == project.trackId`.
   - In addition, an entry must be created in `AuditLog` (`action: "score_submitted"`, `userId: session.id`, `payload: JSON.stringify(...)`).

3. **CSV Export & MAD Integration in `GET /api/export.csv`**:
   - Observation 1.5 shows `export.csv` is checked with `organizer` credentials and requires valid CSV with a comma in line 1.
   - Observation 1.1 and role checks dictate that any non-organizer (`judge`, `participant`, `visitor`) must receive HTTP 403 Forbidden.
   - For valid organizer sessions: query all projects, scores, criteria, and tracks.
   - Construct raw judge score matrices, invoke `normaliseAllJudges` or `normaliseJudgeScores`, compute average raw and normalized scores per project, sort by normalized score descending, and output CSV formatted text with header:
     `project_id,project_title,track,raw_score,normalized_score,rank`.

4. **Server Component Authentication Gap**:
   - Observation 1.1 shows `getSession(req: NextRequest)` requires a `NextRequest` instance.
   - In Next.js App Router, Server Components in `page.tsx` (like `/judge` and `/dashboard`) do not receive `NextRequest`.
   - Therefore, a companion helper `getServerSession()` using `cookies()` from `next/headers` is required to allow Server Components to inspect the logged-in user and redirect to `/login` if unauthenticated.

---

## 3. Caveats

1. **No SQLite Composite Unique Index**:
   Because `schema.prisma` was frozen and migrated in Phase 1, altering the schema now to add `@unique([judgeId, projectId, criterionId])` would require another Prisma migration (`prisma migrate dev`). To avoid risking migration drift or Docker seed issues, deduplication and upsert handling should be implemented cleanly in application code within `POST /api/judge/scores`.
2. **Submissions Closed State**:
   The event `evt_01` seeded in fixtures has `submissionsClose: "2026-03-01T18:00:00Z"`, which is in the past. This correctly enforces the T1 closed check. However, for judging (T2), projects are already submitted and seeded (41 projects), so scoring can proceed without modifying the submission window.
3. **Judge Assignment Enforcement**:
   `fixtures.json` assigned tracks to fixture judges (`jdg_01`..`jdg_30`). `seed.ts` assigned `judge_a` to `trk_01` and `judge_b` to `trk_02`. In `POST /api/judge/scores`, checking whether a judge is assigned to the project's track is required by spec R2, but organizer override or track assignment flexibility should be handled gracefully.

---

## 4. Conclusion

The codebase foundation is in an excellent, clean state. Typechecking and Next.js production builds compile with zero errors. All database models, seeded test accounts, deterministic tokens, and MAD normalization logic are in place and verified against the live SQLite database.

To achieve green status on all Phase 3 (T2 Judging) acceptance checks, the implementation team must implement:
1. `src/lib/auth.ts`: Add `getServerSession()` helper utilizing `cookies()` from `next/headers` for App Router Server Components.
2. `src/app/api/judge/scores/route.ts`:
   - `GET`: Implement strict RBAC (401 unauthenticated, 403 participant, 403 if `judge !== session.id`, 200 with own scores for judge).
   - `POST`: Validate payload with Zod, verify judge track assignment, upsert score rows per criterion, create immutable `AuditLog` entry.
3. `src/app/api/export.csv/route.ts`:
   - `GET`: Restrict to `organizer`/`admin` (403 for others). Aggregate scores, apply MAD normalization via `src/lib/normalization.ts`, calculate ranks, and return CSV with header `project_id,project_title,track,raw_score,normalized_score,rank`.
4. `src/app/judge/page.tsx`:
   - Server Component UI for judges to browse assigned projects, enter criterion scores, and submit reviews.
5. `src/app/dashboard/page.tsx`:
   - Server Component UI for organizers displaying aggregate progress metrics, judge completion rates, and quick link to `/api/export.csv`.

---

## 5. Verification Method

To independently verify these findings:

1. **Verify TypeScript compilation and Next.js build**:
   ```powershell
   npm run typecheck
   npm run build
   ```
   Both must exit with status code 0.

2. **Inspect existing routes**:
   ```powershell
   Get-ChildItem -Path "d:\TP\Hackathon\DogFood\src\app" -Recurse -File | Select-Object FullName
   ```
   Confirms missing `/api/judge/scores`, `/api/export.csv`, `/judge`, and `/dashboard`.

3. **Verify SQLite Database counts and test accounts**:
   Run via tsx or prisma studio to confirm 34 users, 41 projects, 252 scores, 4 rubric criteria, and 0 judge_a scores.

4. **Verify Acceptance Runner Expectations**:
   Inspect lines 143–187 of `Hack_docs/run.py` to confirm the 4 exact T2 assertions (`judge sees own scores`, `judge cannot see peer scores`, `participant blocked`, `csv export works`).
