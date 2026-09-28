# Handoff Report: Phase 6 Milestone 1 (M1) — API & Baseline Integration Analysis

**Agent:** Explorer 3 (`explorer_p6_m1_3`)  
**Role:** API & Baseline Integrator  
**Working Directory:** `d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_p6_m1_3`  
**Date/Time:** 2026-09-28T12:35:00Z  

---

## 1. Observation

### 1.1 Baseline Acceptance Checker (`Hack_docs/run.py`)
Direct inspection of `Hack_docs/run.py` reveals the exact validation mechanics for T1 and T2:

- **Configuration & Route Resolution:**
  - Reads `.dogfood.toml` at lines 49–54 (`load_config`), reading `portal.base_url`, `auth`, `routes`, and `tiers.claimed`.
  - Searches for `fixtures.json` in candidate paths (lines 195–211).
  - Tiers defined in `TIERS = ["T1", "T2", "T3", "T4"]` (line 56).
  - `request(url, header, method, body)` (lines 60–76) issues HTTP requests using Python `urllib.request` with 10s timeout, splitting custom headers (e.g., `Cookie: session=...`).

- **T1 Checks (Lines 102–141):**
  1. `T1 gallery is public` (lines 102–110):
     - Issues `GET` to `url("gallery")` (`http://localhost:8080/projects`) with **no auth header**.
     - Assertion: `status == 200`.
  2. `T1 project from fixtures shown` (lines 112–126):
     - Extracts top 3 project titles from `fixtures.json` (`fixture_titles(fixture, n=3)` -> `"Glass Signal"`, `"Small Meadow"`, `"Deep Compass"`).
     - Assertion: `any(t.lower() in haystack for t in titles)` against `gallery_body.lower()`.
     - Invariant: The initial HTML response from `/projects` MUST contain at least one of these strings.
  3. `T1 closed event refuses submissions` (lines 128–141):
     - Issues `POST` to `url("submit")` (`/api/projects`) with `header=auth.get("participant")` (`Cookie: session=prt_seed_token_2026`) and JSON body `{"title": "dogfood-late-submission-probe", "summary": "probe"}`.
     - Assertion: `400 <= status < 500` (expects 403 or 409).

- **T2 Checks (Lines 144–186):**
  4. `T2 judge sees own scores` (lines 144–151):
     - Issues `GET` to `url("judge_scores")` (`/api/judge/scores`) with `header=auth.get("judge_a")`.
     - Assertion: `status == 200`.
  5. `T2 judge cannot see peer scores` (lines 153–164):
     - Issues `GET` to `peer_scores` (`/api/judge/scores?judge=user_jdg_a_01`) with `header=auth.get("judge_b")`.
     - Assertion: `status in (401, 403)`.
  6. `T2 participant blocked` (lines 165–173):
     - Issues `GET` to `url("judge_scores")` (`/api/judge/scores`) with `header=auth.get("participant")`.
     - Assertion: `status in (401, 403)`.
  7. `T2 csv export works` (lines 174–186):
     - Issues `GET` to `url("csv_export")` (`/api/export.csv`) with `header=auth.get("organizer")`.
     - Assertion: `status == 200 and "," in first_line`.

- **Current Verification State:**
  - Command: `python Hack_docs/run.py .dogfood.toml` executed against running portal on port 8080.
  - Output:
    ```
    DOGFOOD 2026 acceptance report
    portal: http://localhost:8080
    claimed: T1 T2
    fixtures: D:\TP\Hackathon\DogFood\Hack_docs\fixtures.json

    T1  gallery is public ................. PASS
    T1  project from fixtures shown ....... PASS
    T1  closed event refuses submissions .. PASS
    T2  judge sees own scores ............. PASS
    T2  judge cannot see peer scores ...... PASS
    T2  participant blocked ............... PASS
    T2  csv export works .................. PASS

    claimed T1 T2, verified T1 T2
    ```
  - Exit code: `0`. All 7/7 checks green.

---

### 1.2 Existing Route Architecture & Model Dependencies

Inspected all existing API route handlers and server pages:

1. `src/app/projects/page.tsx` (Gallery):
   - Lines 13–20:
     ```typescript
     const projects = await prisma.project.findMany({
       take: 40,
       orderBy: { id: 'asc' },
       include: {
         team: true,
         track: true,
       },
     });
     ```
   - Passes `projects` to `ProjectsClient` (`src/app/projects/projects-client.tsx`).
   - Server Component SSR guarantees that fixture project titles are baked into the raw HTML.

2. `src/app/api/projects/route.ts` (Submissions & Project List):
   - Lines 23–32: `GET` queries `prisma.project.findMany` with `include: { track: true, team: true }`.
   - Lines 41–55: `POST` validates session via `getSession(req)`.
   - Lines 79–102: Queries `prisma.event.findFirst()` and checks `event.submissionsClose < now` -> returns `409` Conflict.
   - Lines 107–110: Looks up team membership using:
     ```typescript
     const membership = await prisma.teamMember.findUnique({
       where: { userId: session.id },
     });
     ```
   - Line 150: Creates `prisma.auditLog.create(...)`.

3. `src/app/api/judge/scores/route.ts` (RBAC Score Isolation):
   - Lines 34–52: `GET` checks `session.role !== 'judge' && session.role !== 'organizer' && session.role !== 'admin'` -> `403`.
   - Lines 58–64: `if (targetJudge && targetJudge !== session.id) return 403;` (peer protection).
   - Lines 67–88: Queries `prisma.score.findMany({ where: { judgeId: session.id }, ... })`.
   - Lines 134–273: `POST` atomic transaction (`prisma.$transaction`) upserting scores and logging `action: 'score_submitted'` to `AuditLog`.

4. `src/app/api/export.csv/route.ts` (Organizer CSV Export):
   - Lines 34–39: `if (session.role !== 'organizer' && session.role !== 'admin') return 403;`.
   - Lines 43–49: `Promise.all([prisma.project.findMany({ include: { track: true }, orderBy: { id: 'asc' } }), prisma.rubricCriterion.findMany(), prisma.score.findMany()])`.
   - Lines 97–177: Computes MAD normalization (`normaliseAllJudges`), formats CSV with header containing commas.

5. `src/app/api/auth/login/route.ts` & `src/app/api/auth/logout/route.ts`:
   - Validates email via `prisma.user.findUnique({ where: { email } })`.
   - Queries/creates `prisma.session`. Sets HTTP cookie `session=<token>`.

6. `src/lib/seed.ts` (Seed Script):
   - Lines 73–84:
     ```typescript
     await prisma.event.upsert({
       where: { id: fixtures.event.id },
       update: {
         name: fixtures.event.name,
         submissionsClose: new Date(fixtures.event.submissions_close),
       },
       create: {
         id: fixtures.event.id,
         name: fixtures.event.name,
         submissionsClose: new Date(fixtures.event.submissions_close),
       },
     });
     ```
   - Upserts `Event`, `Track`, `Team`, `Project`, `User`, `RubricCriterion`, `Score`, and deterministic test sessions.

---

### 1.3 Authentication & Session Model (`src/lib/auth.ts`)

- **Session Validation Mechanism (`getSession` lines 25–49):**
  1. Extracts cookie value using Next.js `req.cookies.get('session')?.value`.
  2. Falls back to parsing `req.headers.get('cookie')` via regex `/(?:^|;\s*)session=([^;]+)/` for clients sending raw headers (e.g. Python urllib in `run.py`).
  3. Returns `null` if token is missing.
  4. Queries Prisma:
     ```typescript
     const session = await prisma.session.findUnique({
       where: { id: token },
       include: { user: true },
     });
     ```
  5. Validates session existence and expiration:
     ```typescript
     if (!session) return null;
     if (session.expiresAt < new Date()) return null;
     ```
  6. Returns a typed `SessionUser`:
     ```typescript
     export type SessionUser = {
       id: string;
       email: string;
       name: string;
       role: 'visitor' | 'participant' | 'judge' | 'organizer' | 'admin';
       judgeId?: string;
     };
     ```

- **Role Helpers:**
  - `isOrganizer(user: SessionUser | null): boolean`
  - `isJudge(user: SessionUser | null): boolean`
  - `isParticipant(user: SessionUser | null): boolean`

- **Team Membership in Schema:**
  - Model `TeamMember` has `userId String @unique` and `teamId String`.
  - A user can only belong to one team.
  - To check if a user is a member of the team submitting a project:
    ```typescript
    const member = await prisma.teamMember.findUnique({
      where: { userId: session.id },
      select: { teamId: true },
    });
    // Check against project.teamId
    if (member && member.teamId === project.teamId) {
      // Self-voting attempt!
    }
    ```

---

## 2. Logic Chain

1. **Relation Opt-In Invariant:**
   - In Prisma ORM, relations (e.g., `User.communityVotes`, `Project.comments`) are never returned unless explicitly specified in `include` or `select`.
   - Existing queries in `/projects`, `/api/projects`, `/api/judge/scores`, `/api/export.csv`, `/dashboard`, and `/judge` do not use wildcard relation includes.
   - Therefore, adding `communityVotes CommunityVote[]` and `comments Comment[]` to `User` and `Project` will NOT alter the runtime payload or database query performance of any existing T1/T2 route.

2. **Event Field Defaults Invariant:**
   - In SQLite, adding columns with `@default(...)` can be executed non-destructively via `ALTER TABLE ... ADD COLUMN ...` without table recreation.
   - In `schema.prisma`, defining:
     ```prisma
     votingOpen    Boolean  @default(true)
     resultsPublic Boolean  @default(false)
     ```
     guarantees that:
     a) Existing rows in the `Event` table are automatically populated with default values (`true` and `false`).
     b) `src/lib/seed.ts` does not specify `votingOpen` or `resultsPublic` in `prisma.event.upsert`. Because these fields have `@default(...)`, TypeScript and Prisma will allow upserts without error, preserving seed idempotency.
     c) `src/app/api/projects/route.ts` reads `event.submissionsClose`, which remains intact.

3. **Database Migration Safety (`npx prisma db push`):**
   - In SQLite with Prisma, adding new models (`CommunityVote`, `Comment`) generates `CREATE TABLE` statements.
   - Adding defaulted columns to `Event` generates `ALTER TABLE` statements.
   - `prisma db push` performs these non-destructive migrations without dropping existing fixture tables or records (Project, Track, Team, User, Score, Session).
   - Thus, seeded fixture tokens and projects remain intact for `run.py`.

4. **Community Endpoint Authentication & Anti-Abuse Flow:**
   - Community endpoints (`/api/community/vote` and `/api/community/comments`) should call `const session = await getSession(req)`.
   - If `!session`, return `401 Unauthorized`.
   - For vote submission on `projectId`:
     1. Retrieve project: `const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, teamId: true } })`. If not found, return `404`.
     2. Query voter's team: `const membership = await prisma.teamMember.findUnique({ where: { userId: session.id }, select: { teamId: true } })`.
     3. **Self-Vote Check:** `if (membership && membership.teamId === project.teamId) return NextResponse.json({ error: 'Team members cannot vote for their own submission' }, { status: 403 })`.
     4. **Duplicate / Toggle Voting:** Query existing vote: `const existingVote = await prisma.communityVote.findUnique({ where: { projectId_userId: { projectId, userId: session.id } } })`.
        - If exists: `await prisma.communityVote.delete(...)` (retract vote), log `COMMUNITY_VOTE_RETRACTED` to `AuditLog`, return `{ hasVoted: false }`.
        - If not: `await prisma.communityVote.create(...)` (cast vote), log `COMMUNITY_VOTE_CAST` to `AuditLog`, return `{ hasVoted: true }`.
     5. **Sealed Results Invariant:**
        - On `GET /api/community/vote?projectId=<id>`:
        - Check `event.resultsPublic`. If `!event.resultsPublic` and `session.role !== 'organizer' && session.role !== 'admin'`, return `totalVotes: null` to prevent client-side inspection leakage.

---

## 3. Caveats

1. **Prisma Schema Defaults:**
   - The new `Event` fields (`votingOpen`, `resultsPublic`) **MUST** have `@default(...)` annotations. Omitting `@default` would cause `src/lib/seed.ts` to fail TypeScript compilation and runtime database constraint checks.
2. **`.dogfood.toml` Configuration Invariant:**
   - Do NOT modify `.dogfood.toml`'s `claimed = ["T1", "T2"]` until Milestone 6. Overclaiming tiers without formal checks in `run.py` triggers `claimed but not verified` warnings in `run.py`.
3. **SSR Invariant on `/projects`:**
   - During M3 (Ballot Randomization & Voting UX), `src/app/projects/page.tsx` must remain an async Server Component that passes initial projects from Prisma to `ProjectsClient`. `run.py` relies on `urllib.request` inspecting raw HTML text; converting to purely client-side fetch would break T1 check 2.
4. **Cascade Deletions in SQLite:**
   - Relations in existing schema do not specify `onDelete: Cascade`. To maintain consistency and avoid Prisma referential actions schema validation errors, standard relation definitions matching existing models (`@relation(fields: [...], references: [...])`) should be used.

---

## 4. Conclusion

1. **Zero Breaking Impact Confirmed:** Adding `CommunityVote`, `Comment`, and defaulted `Event` fields will have zero breaking impact on any of the 7 acceptance checks in `Hack_docs/run.py`.
2. **Deterministic Seed Intact:** `seed.ts` will continue to run idempotently without requiring changes.
3. **Authentication & RBAC Readily Available:** `src/lib/auth.ts` (`getSession`) and `prisma.teamMember` provide everything required to authenticate community endpoints, enforce self-voting prevention, and isolate results.

### Concrete Schema Specification for Milestone 1:

```prisma
// Append to User model:
model User {
  // ... existing fields ...
  communityVotes   CommunityVote[]
  comments         Comment[]
}

// Append to Project model:
model Project {
  // ... existing fields ...
  communityVotes   CommunityVote[]
  comments         Comment[]
}

// Extend Event model:
model Event {
  id               String   @id
  name             String
  submissionsClose DateTime
  createdAt        DateTime @default(now())
  votingOpen       Boolean  @default(true)
  resultsPublic    Boolean  @default(false)

  tracks   Track[]
  projects Project[]
}

// Add CommunityVote model:
model CommunityVote {
  id        String   @id @default(cuid())
  projectId String
  userId    String
  createdAt DateTime @default(now())

  project   Project  @relation(fields: [projectId], references: [id])
  user      User     @relation(fields: [userId], references: [id])

  @@unique([projectId, userId])
}

// Add Comment model:
model Comment {
  id         String   @id @default(cuid())
  projectId  String
  userId     String
  authorName String
  content    String
  createdAt  DateTime @default(now())
  isFlagged  Boolean  @default(false)

  project    Project  @relation(fields: [projectId], references: [id])
  user       User     @relation(fields: [userId], references: [id])
}
```

---

## 5. Verification Method

To independently verify this analysis:

1. **Verify Baseline Acceptance Checker:**
   ```powershell
   python d:\TP\Hackathon\DogFood\Hack_docs\run.py d:\TP\Hackathon\DogFood\.dogfood.toml
   ```
   *Expected:* Output ends with `claimed T1 T2, verified T1 T2` and all 7 checks `PASS`.

2. **Verify TypeScript & Linting Baseline:**
   ```powershell
   npm run typecheck
   npm run lint
   ```
   *Expected:* 0 errors.

3. **Verify Schema Migration Simulation:**
   After applying the schema additions:
   ```powershell
   npx prisma validate
   npx prisma db push
   python d:\TP\Hackathon\DogFood\Hack_docs\run.py d:\TP\Hackathon\DogFood\.dogfood.toml
   ```
   *Invalidation Conditions:*
   - If `run.py` fails on any T1/T2 check.
   - If `npx prisma db push` warns about data loss or column drop.
   - If `npm run typecheck` produces any type error.
