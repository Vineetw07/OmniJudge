# Comprehensive Adversarial Audit: Acceptance Checker Alignment (R2) & Schema/Seed Integrity (R5)

**Date**: 2026-09-27  
**Auditor**: Acceptance & Schema Auditor (`explorer_checker_schema`)  
**Targets**:
- R2: Acceptance Checker Alignment (`Hack_docs/run.py`, `.dogfood.toml`, API & Page routes)
- R5: Schema & Seed Integrity (`prisma/schema.prisma`, `src/lib/seed.ts`, `Hack_docs/fixtures.json`)

---

## 1. Executive Summary

| Audit Domain | Scope | Status | Verdict |
| :--- | :--- | :--- | :--- |
| **R2: Acceptance Checker** | 7 checks in `run.py` & `.dogfood.toml` route mappings | Verified 100% | **PASS (7/7 Checks)** |
| **R2: RBAC Route Isolation** | `GET /api/judge/scores?judge=user_jdg_a_01` under judge_b | Verified 100% | **PASS (Direct 403 API layer)** |
| **R2: Closed Event Guard** | `POST /api/projects` deadline comparison from SQLite | Verified 100% | **PASS (409 Conflict from DB query)** |
| **R2: CSV Export** | `GET /api/export.csv` with header comma & MAD norm | Verified 100% | **PASS (Valid header & MAD math)** |
| **R5: Prisma Schema** | 11 models matching spec specification | Verified 100% | **PASS (All models, fields, relations)** |
| **R5: Seed Determinism** | 4 deterministic users & tokens, 1y expiry, closed date | Verified 100% | **PASS (Exact tokens, dates, idempotency)** |

---

## 2. R2: Acceptance Checker Alignment (Deep Dive)

The acceptance suite `Hack_docs/run.py` tests 7 core invariants against the portal configured in `.dogfood.toml`.

### 2.1 Configuration File Audit (`.dogfood.toml`)
Inspected file: `d:\TP\Hackathon\DogFood\.dogfood.toml` (lines 1–20)
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
peer_scores  = "/api/judge/scores?judge=user_jdg_a_01"
csv_export   = "/api/export.csv"
```
**Verification Findings**:
1. `routes.gallery` (`/projects`) maps directly to `src/app/projects/page.tsx`.
2. `routes.submit` (`/api/projects`) maps directly to `src/app/api/projects/route.ts`.
3. `routes.judge_scores` (`/api/judge/scores`) maps directly to `src/app/api/judge/scores/route.ts`.
4. `routes.peer_scores` (`/api/judge/scores?judge=user_jdg_a_01`):
   - The query parameter `judge=user_jdg_a_01` matches the exact seeded ID of Judge Alpha (`user_jdg_a_01` defined in `src/lib/seed.ts:19`).
5. `routes.csv_export` (`/api/export.csv`) maps directly to `src/app/api/export.csv/route.ts`.
6. Auth tokens in `[auth]` match the seeded tokens in `src/lib/seed.ts:10-39` byte-for-byte.

---

### 2.2 Cross-Reference: All 7 Checker Invariants

#### Check 1: `T1 gallery is public`
- **Checker Code (`Hack_docs/run.py:102-110`)**:
  ```python
  c = Check("T1", "gallery is public")
  status, body = request(url("gallery"))
  c.ok = status == 200
  ```
- **Implementation (`src/app/projects/page.tsx:16-146`)**:
  - React Server Component. No auth guards, session extraction, or redirect redirects.
  - Queries SQLite DB: `prisma.project.findMany({ take: 40, orderBy: { id: 'asc' }, include: { team: true, track: true } })`.
  - HTTP Status: Returns HTTP 200 unconditionally.
- **Empirical Execution**: `GET http://localhost:8080/projects` returns 200 OK.

#### Check 2: `T1 project from fixtures shown`
- **Checker Code (`Hack_docs/run.py:112-126`)**:
  ```python
  c = Check("T1", "project from fixtures shown")
  titles = fixture_titles(fixture) # ["Glass Signal", "Small Meadow", "Deep Compass"]
  haystack = gallery_body.lower()
  c.ok = any(t.lower() in haystack for t in titles)
  ```
- **Implementation (`src/app/projects/page.tsx:93-95`)**:
  - Renders `<CardTitle className="text-xl font-bold leading-snug text-foreground">{project.title}</CardTitle>`.
  - With `orderBy: { id: 'asc' }` and `take: 40`, `prj_01` ("Glass Signal"), `prj_02` ("Small Meadow"), and `prj_03` ("Deep Compass") appear on page one.
- **Empirical Execution**: Substring search finds "Glass Signal" in response body. Result: `PASS`.

#### Check 3: `T1 closed event refuses submissions`
- **Checker Code (`Hack_docs/run.py:128-142`)**:
  ```python
  c = Check("T1", "closed event refuses submissions")
  status, _ = request(
      url("submit"),
      header=auth.get("participant"),
      method="POST",
      body={"title": "dogfood-late-submission-probe", "summary": "probe"},
  )
  c.ok = 400 <= status < 500
  ```
- **Implementation (`src/app/api/projects/route.ts:78-102`)**:
  - Reads active event from database:
    ```typescript
    const event = data.eventId
      ? await prisma.event.findUnique({ where: { id: data.eventId } })
      : await prisma.event.findFirst();
    ```
  - Compares against `Date.now()` server-side:
    ```typescript
    const now = Date.now();
    const closeTime = new Date(event.submissionsClose).getTime();
    if (closeTime < now) {
      return NextResponse.json(
        { error: 'Submissions are closed for this event', submissionsClose: event.submissionsClose.toISOString(), serverTime: new Date(now).toISOString() },
        { status: 409 }
      );
    }
    ```
  - **Dynamic DB Confirmation**: The deadline is dynamically queried from the SQLite `Event` table (`submissionsClose = 2026-03-01T18:00:00Z`), NOT hardcoded.
  - Returns HTTP 409 Conflict (satisfies `400 <= status < 500`).
- **Empirical Execution**: Participant POST returns 409 Conflict. Result: `PASS`.

#### Check 4: `T2 judge sees own scores`
- **Checker Code (`Hack_docs/run.py:144-151`)**:
  ```python
  c = Check("T2", "judge sees own scores")
  status, _ = request(url("judge_scores"), header=auth.get("judge_a"))
  c.ok = status == 200
  ```
- **Implementation (`src/app/api/judge/scores/route.ts:57-91`)**:
  - Authenticates `judge_a` via session token `jdg_a_seed_token_2026`.
  - `session.role === 'judge'`, `session.id === 'user_jdg_a_01'`.
  - No query param provided; queries `prisma.score.findMany({ where: { judgeId: session.id }, ... })`.
  - Returns HTTP 200 with `{ scores: [...] }`.
- **Empirical Execution**: Judge Alpha request returns 200 OK with scores JSON. Result: `PASS`.

#### Check 5 (T2 Critical): `T2 judge cannot see peer scores`
- **Checker Code (`Hack_docs/run.py:153-164`)**:
  ```python
  c = Check("T2", "judge cannot see peer scores")
  probe = base + routes.get("peer_scores", routes.get("judge_scores", ""))
  status, _ = request(probe, header=auth.get("judge_b"))
  c.ok = status in (401, 403)
  ```
- **Implementation (`src/app/api/judge/scores/route.ts:57-64`)**:
  - Endpoint evaluates query parameter `judge`:
    ```typescript
    const targetJudge = req.nextUrl.searchParams.get('judge');
    if (session.role === 'judge') {
      if (targetJudge && targetJudge !== session.id) {
        return NextResponse.json(
          { error: 'Forbidden: Cannot view peer judge scores' },
          { status: 403 }
        );
      }
    ...
    ```
  - Direct API route guard: When `session.id === 'user_jdg_b_01'` and `targetJudge === 'user_jdg_a_01'`, condition `targetJudge !== session.id` is TRUE.
  - Returns HTTP 403 Forbidden immediately before any score database query is made.
- **Empirical Execution**: `GET /api/judge/scores?judge=user_jdg_a_01` as `judge_b` returns HTTP 403 Forbidden. Result: `PASS`.

#### Check 6: `T2 participant blocked`
- **Checker Code (`Hack_docs/run.py:166-173`)**:
  ```python
  c = Check("T2", "participant blocked")
  status, _ = request(url("judge_scores"), header=auth.get("participant"))
  c.ok = status in (401, 403)
  ```
- **Implementation (`src/app/api/judge/scores/route.ts:42-52`)**:
  ```typescript
  if (
    session.role !== 'judge' &&
    session.role !== 'organizer' &&
    session.role !== 'admin'
  ) {
    return NextResponse.json(
      { error: 'Forbidden: Only judges and organizers can access judging scores' },
      { status: 403 }
    );
  }
  ```
  - For `session.role === 'participant'`, access is denied immediately with 403 Forbidden before DB query.
- **Empirical Execution**: Participant session gets 403 Forbidden. Result: `PASS`.

#### Check 7: `T2 csv export works`
- **Checker Code (`Hack_docs/run.py:175-186`)**:
  ```python
  c = Check("T2", "csv export works")
  status, body = request(url("csv_export"), header=auth.get("organizer"))
  first_line = body.splitlines()[0] if body.splitlines() else ""
  c.ok = status == 200 and "," in first_line
  ```
- **Implementation (`src/app/api/export.csv/route.ts:34-40, 155, 170-177`)**:
  - Role Guard: Organizers and Admins only.
  - Header: `const header = 'project_id,project_title,track,raw_score,normalized_score,rank';`.
  - Body: Header + CSV rows joined by `\r\n`.
  - Headers: `Content-Type: text/csv; charset=utf-8`.
  - First line has 5 commas, satisfying `"," in first_line`.
- **Empirical Execution**: Organizer request returns 200 OK, valid CSV, header contains commas. Result: `PASS`.

---

## 3. R5: Schema & Seed Integrity (Deep Dive)

### 3.1 Prisma Schema Verification (`prisma/schema.prisma`)
The data model contains all 11 models required by the DOGFOOD 2026 specification (`Hack_docs/spec.md` & build plan).

| Model | Primary Key | Key Fields | Foreign Keys / Relations | Verified |
| :--- | :--- | :--- | :--- | :--- |
| **`User`** | `id` String @id @default(cuid()) | `email` (unique), `name`, `role`, `createdAt` | `sessions` (1:N), `teamMember` (1:1), `judgeAssignments` (1:N), `scores` (1:N), `auditLogs` (1:N) | YES |
| **`Session`** | `id` String @id | `userId`, `createdAt`, `expiresAt` | `user` (N:1 -> User.id) | YES |
| **`Event`** | `id` String @id | `name`, `submissionsClose`, `createdAt` | `tracks` (1:N), `projects` (1:N) | YES |
| **`Track`** | `id` String @id | `name`, `eventId` | `event` (N:1 -> Event.id), `projects` (1:N), `judgeAssignments` (1:N) | YES |
| **`Team`** | `id` String @id | `name` | `members` (1:N TeamMember), `projects` (1:N Project) | YES |
| **`TeamMember`** | `id` String @id @default(cuid()) | `userId` (unique), `teamId` | `user` (1:1 -> User.id), `team` (N:1 -> Team.id) | YES |
| **`Project`** | `id` String @id | `title`, `summary`, `repoUrl`, `submittedAt`, `isDraft` | `team` (N:1), `track` (N:1), `event` (N:1), `scores` (1:N) | YES |
| **`RubricCriterion`** | `id` String @id @default(cuid()) | `name`, `weight` (Float), `maxScore` (Int) | `scores` (1:N Score) | YES |
| **`JudgeAssignment`** | `id` String @id @default(cuid()) | `userId`, `trackId` | `user` (N:1 -> User.id), `track` (N:1 -> Track.id) | YES |
| **`Score`** | `id` String @id @default(cuid()) | `judgeId`, `projectId`, `criterionId`, `value`, `comment`, `submittedAt` | `judge` (N:1 -> User.id), `project` (N:1 -> Project.id), `criterion` (N:1 -> RubricCriterion.id) | YES |
| **`AuditLog`** | `id` String @id @default(cuid()) | `userId`, `action`, `payload`, `createdAt` | `user` (N:1 -> User.id) | YES |

- **Schema Validation**: `npx prisma validate` exited with code 0 ("The schema at prisma\schema.prisma is valid 🚀").

---

### 3.2 Seed Script Verification (`src/lib/seed.ts`)

#### 1. Deterministic Test Users and Session Tokens
`src/lib/seed.ts:10-39` configures the exact deterministic accounts:
```typescript
const TEST_USERS = [
  { id: 'user_org_01', email: 'organizer@dogfood.dev', name: 'Organizer', role: 'organizer', token: 'org_seed_token_2026' },
  { id: 'user_jdg_a_01', email: 'judge_a@dogfood.dev', name: 'Judge Alpha', role: 'judge', token: 'jdg_a_seed_token_2026' },
  { id: 'user_jdg_b_01', email: 'judge_b@dogfood.dev', name: 'Judge Beta', role: 'judge', token: 'jdg_b_seed_token_2026' },
  { id: 'user_prt_01', email: 'participant@dogfood.dev', name: 'Participant', role: 'participant', token: 'prt_seed_token_2026' },
] as const;
```
- Exactly 4 deterministic accounts.
- Seeded session IDs are identical to the tokens: `id: u.token`.
- Tested stdout output from `npm run seed`:
  ```
  seeded. test logins:
    organizer    Cookie: session=org_seed_token_2026
    judge_a      Cookie: session=jdg_a_seed_token_2026
    judge_b      Cookie: session=jdg_b_seed_token_2026
    participant  Cookie: session=prt_seed_token_2026
  ```

#### 2. Expiry Window
`src/lib/seed.ts:212-214`:
```typescript
const expiresAt = new Date();
expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year from now
```
- Sets session expiration to 365 days into the future.

#### 3. Closed Event Timestamp
`src/lib/seed.ts:77, 82`:
```typescript
submissionsClose: new Date(fixtures.event.submissions_close), // "2026-03-01T18:00:00Z"
```
- The seeded date `2026-03-01T18:00:00Z` is in the past relative to the present date, guaranteeing `Date.now() > event.submissionsClose`.

#### 4. Seed Idempotency
- **Event**: `prisma.event.upsert` on `id`.
- **Tracks**: `prisma.track.upsert` on `id`.
- **Teams**: `prisma.team.upsert` on `id`.
- **Projects**: `prisma.project.upsert` on `id`.
- **Judges**: `prisma.user.upsert` on `id`.
- **JudgeAssignments**: `prisma.judgeAssignment.findFirst` guard before create.
- **RubricCriterion**: `prisma.rubricCriterion.findFirst` guard with update/create.
- **Scores**: `prisma.score.findFirst` guard on `(judgeId, projectId, criterionId)` before create.
- **Test Users / Sessions**: `prisma.user.upsert` and `prisma.session.upsert`.
- **Test Assignments**: `findFirst` guard for `user_jdg_a_01` (track `trk_01`) and `user_jdg_b_01` (track `trk_02`).

**Empirical Verification**:
Executed `npm run seed` twice consecutively in shell. Both executions succeeded with code 0 without any schema constraint violations, unique key collisions, or duplicate records.

---

## 4. Empirical Test Results Summary

1. `python Hack_docs/run.py .dogfood.toml`:
   - All 7 checks PASS.
   - Output summary: `claimed T1 T2, verified T1 T2`.
2. `python tests/test_phase3_adversarial.py`:
   - 47/47 Probes PASS (including strict peer score isolation, participant blocks, CSV export RBAC, negative/malformed score validations).
3. `python tests/test_phase3_challenger2_full.py`:
   - 35/35 Probes PASS (including independent mathematical ground truth verification for MAD normalization, zero-variance judge protections, and strict 1..N rankings).
4. `npm run typecheck`:
   - 0 TypeScript errors.
5. `npx prisma validate`:
   - Schema valid, 0 errors.
6. `npm run seed` idempotency:
   - 2 consecutive runs completed with 0 errors.

---

## 5. Potential Boundary Questions Analyzed

| Invariant / Edge Case | Analysis | Risk Level |
| :--- | :--- | :--- |
| **Can judge_b bypass RBAC via alternative query param?** | `GET /api/judge/scores` extracts `judge = req.nextUrl.searchParams.get('judge')`. If `session.role === 'judge'`, any `targetJudge` differing from `session.id` returns 403. If omitted, queries only `where: { judgeId: session.id }`. No bypass possible. | **None** |
| **Does participant block on `/api/judge/scores` query DB before blocking?** | `src/app/api/judge/scores/route.ts:43-52` checks `session.role` and returns 403 immediately. Zero DB queries executed for scores. | **None** |
| **Can non-organizers access CSV export?** | `src/app/api/export.csv/route.ts:34-39` checks `session.role !== 'organizer' && session.role !== 'admin'` and returns 403. Verified in tests P4_01, P4_02, P4_03. | **None** |
| **Is submission close check using hardcoded timestamp?** | `src/app/api/projects/route.ts:79-93` loads `event.submissionsClose` directly from the SQLite database via Prisma. | **None** |
| **Do fixture project titles appear on page one?** | `src/app/projects/page.tsx:18` loads 40 projects ordered by `id: 'asc'`. `prj_01` ("Glass Signal"), `prj_02` ("Small Meadow"), `prj_03` ("Deep Compass") appear in the initial rendered HTML. | **None** |
