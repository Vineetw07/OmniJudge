# Handoff Report: Phase 6 Milestone 1 (M1) — Seed & Fixtures Specialist

**Agent:** Explorer 2 (`explorer_p6_m1_2`)  
**Role:** Seed & Fixtures Specialist  
**Working Directory:** `d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_p6_m1_2`  
**Date/Time:** 2026-09-28T12:38:00Z  

---

## 1. Observation

### 1.1 Direct Inspection of `src/lib/seed.ts`
Inspection of `src/lib/seed.ts` (264 lines) reveals how the database is populated from `Hack_docs/fixtures.json`:

1. **Fixture Loading (Lines 53–68):**
   - Resolves `Hack_docs/fixtures.json` from candidate paths (`process.cwd()/Hack_docs/fixtures.json`, `process.cwd()/fixtures.json`, `__dirname/../../Hack_docs/fixtures.json`).
   - Reads synchronously and parses JSON.

2. **Event Seeding (Lines 73–84):**
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
   - Event ID: `evt_01` ("Sample Hack 2026").
   - `submissionsClose`: `2026-03-01T18:00:00Z` (already in the past; enforces T1 closed-event submission rejection).
   - **Crucial finding:** The existing seed script does NOT touch `votingOpen` or `resultsPublic`.

3. **Tracks Seeding (Lines 90–95):**
   - 8 tracks from fixtures: `trk_01` ("Developer tools") through `trk_08` ("Open hardware").
   - Upserted with `where: { id: track.id }`.

4. **Teams Seeding (Lines 100–106):**
   - 40 teams from fixtures: `tm_01` ("NorthKiln") through `tm_40` ("EchoRidge").
   - Upserted with `where: { id: team.id }`.
   - **Crucial finding:** `fixtures.teams` contains `members: string[]` (email strings), but `src/lib/seed.ts` does NOT populate `TeamMember` records for these emails or for test users.

5. **Projects Seeding (Lines 112–132):**
   - 40 projects from fixtures: `prj_01` ("Glass Signal") through `prj_40` ("Velvet Circuit").
   - Linked to `teamId: project.team`, `trackId: project.track`, `eventId: fixtures.event.id`.
   - `isDraft: false`, `submittedAt: new Date(project.submitted_at)`.
   - Upserted with `where: { id: project.id }`.

6. **Judges Seeding (Lines 137–160):**
   - 30 judges from fixtures (`jdg_01` Tomas Varga through `jdg_30` Rafa Okonkwo).
   - Created as `User`: `role: 'judge'`, `email: judge.email`, `name: judge.name`, `id: judge.id`.
   - `JudgeAssignment` records: checked with `prisma.judgeAssignment.findFirst({ where: { userId: judge.id, trackId } })` and created if not present.

7. **Rubric Criteria Seeding (Lines 166–177):**
   - 4 default criteria: `functionality` (weight: 1.5), `quality` (weight: 1.0), `creativity` (weight: 1.0), `presentation` (weight: 0.5).
   - Checked with `prisma.rubricCriterion.findFirst({ where: { name: crit.name } })`; updated if present, created if absent.

8. **Scores Seeding (Lines 182–207):**
   - Upserts all score items from `fixtures.scores` for each criterion.
   - Checked with `prisma.score.findFirst({ where: { judgeId, projectId, criterionId } })`.

9. **Deterministic Test Users & Sessions (Lines 211–246):**
   ```typescript
   const TEST_USERS = [
     { id: 'user_org_01', email: 'organizer@dogfood.dev', name: 'Organizer', role: 'organizer', token: 'org_seed_token_2026' },
     { id: 'user_jdg_a_01', email: 'judge_a@dogfood.dev', name: 'Judge Alpha', role: 'judge', token: 'jdg_a_seed_token_2026' },
     { id: 'user_jdg_b_01', email: 'judge_b@dogfood.dev', name: 'Judge Beta', role: 'judge', token: 'jdg_b_seed_token_2026' },
     { id: 'user_prt_01', email: 'participant@dogfood.dev', name: 'Participant', role: 'participant', token: 'prt_seed_token_2026' },
   ] as const;
   ```
   - Upserts each user in `User` table where `id: u.id`.
   - Upserts each session in `Session` table where `id: u.token`, setting `userId: u.id` and `expiresAt` (1 year from seed execution).
   - Assigns `user_jdg_a_01` to `trk_01` and `user_jdg_b_01` to `trk_02` via `JudgeAssignment`.

10. **Stdout Token Block (Lines 251–255):**
    ```
    seeded. test logins:
      organizer    Cookie: session=org_seed_token_2026
      judge_a      Cookie: session=jdg_a_seed_token_2026
      judge_b      Cookie: session=jdg_b_seed_token_2026
      participant  Cookie: session=prt_seed_token_2026
    ```

### 1.2 Baseline Verification Execution
- Executed `npm run seed`:
  - Completed with exit code `0`.
  - Output printed exact 4-line deterministic token block.
- Executed `python Hack_docs/run.py .dogfood.toml`:
  - Result: 7/7 PASS (T1 PASS, T2 PASS).
  - Output: `claimed T1 T2, verified T1 T2`.

### 1.3 Database Storage Mechanics
- `prisma/schema.prisma` specifies `url = env("DATABASE_URL")`.
- `.env` defines `DATABASE_URL="file:./prisma/dogfood.db"`.
- SQLite resolves `./prisma/dogfood.db` relative to `prisma/schema.prisma`, placing the active database file at `d:\TP\Hackathon\DogFood\prisma\prisma\dogfood.db` (192,512 bytes).

---

## 2. Logic Chain

### 2.1 Analysis of Seed Entities & State
From Observation 1.1:
- The database is seeded with:
  - 1 Event (`evt_01`)
  - 8 Tracks (`trk_01`–`trk_08`)
  - 40 Teams (`tm_01`–`tm_40`)
  - 40 Projects (`prj_01`–`prj_40`)
  - 30 Judge Users (`jdg_01`–`jdg_30`)
  - 4 Test Users (`user_org_01`, `user_jdg_a_01`, `user_jdg_b_01`, `user_prt_01`)
  - 4 Sessions with deterministic tokens matching `.dogfood.toml`
  - 4 Rubric Criteria and all fixture scores
- The seed script is completely self-contained and loads from `Hack_docs/fixtures.json`.

### 2.2 Event Model Lifecycle Fields (`votingOpen` & `resultsPublic`)
From Observation 1.1 (Item 2) and Phase 6 R1 requirements:
- The schema will introduce on `Event`:
  - `votingOpen Boolean @default(true)`
  - `resultsPublic Boolean @default(false)`
- **Behavior with Prisma Defaults:**
  - Because both fields define `@default(...)` in `schema.prisma`, Prisma marks them as optional in TypeScript input types (`EventCreateInput` and `EventUpdateInput`).
  - During schema migration (`npx prisma db push`), existing rows in SQLite (`evt_01`) receive `votingOpen = 1` (true) and `resultsPublic = 0` (false).
  - If `src/lib/seed.ts` is executed without edits, it compiles and runs with zero TypeScript errors.
- **Recommended Seed Script Update:**
  - In `src/lib/seed.ts` under `prisma.event.upsert`:
    ```typescript
    create: {
      id: fixtures.event.id,
      name: fixtures.event.name,
      submissionsClose: new Date(fixtures.event.submissions_close),
      votingOpen: true,
      resultsPublic: false,
    },
    ```
  - **In `update: { ... }`**: Do **NOT** force `votingOpen: true, resultsPublic: false`.
    - **Rationale:** If an organizer tests toggling `resultsPublic` to unseal community votes or `votingOpen` to close voting, re-running `npm run seed` (or restarting Docker via `entrypoint.sh` which executes `seed.ts`) should NOT overwrite and discard the organizer's active runtime settings.

### 2.3 Idempotency & Deterministic Token Preservation
From Observation 1.1 (Items 9 & 10) and Verification 1.2:
- The session tokens (`org_seed_token_2026`, `jdg_a_seed_token_2026`, `jdg_b_seed_token_2026`, `prt_seed_token_2026`) serve as the primary key `id` of the `Session` model.
- `src/lib/seed.ts` uses `prisma.session.upsert({ where: { id: u.token }, update: { expiresAt }, create: { id: u.token, userId: u.id, expiresAt } })`.
- Running `npm run seed` multiple times only extends `expiresAt` by 1 year. The tokens never change.
- `src/lib/seed.ts` contains zero destructive queries (`prisma.$executeRawUnsafe("DROP ...")` or `deleteMany()`).
- All 8 entities use either `upsert` or `findFirst` checks before creation.
- Therefore, executing `npm run seed` before or after schema migration remains 100% idempotent and preserves deterministic tokens.

### 2.4 Fixture Adjustments & Anti-Abuse Testing Gap
From Observation 1.1 (Item 4) and Phase 6 R2.1 requirements:
- **Phase 6 R2.1 Anti-Abuse Self-Vote Defense:**
  - The voting endpoint checks:
    ```typescript
    const membership = await prisma.teamMember.findUnique({
      where: { userId: session.id },
    });
    if (membership && membership.teamId === project.teamId) {
      return NextResponse.json(
        { error: 'Team members cannot vote for their own submission' },
        { status: 403 }
      );
    }
    ```
- **The Gap:**
  - Currently in `src/lib/seed.ts`, `user_prt_01` (`participant@dogfood.dev`) is NOT assigned to any team in `TeamMember`.
  - In `fixtures.projects[0]`, `prj_01` ("Glass Signal") belongs to `tm_01` ("NorthKiln").
  - If `user_prt_01` has no `TeamMember` record, `membership` evaluates to `null`. As a result, `user_prt_01` could vote for `prj_01`, and the self-vote defense could not be deterministically verified without first creating manual DB state.
- **The Solution:**
  - In `src/lib/seed.ts`, link `user_prt_01` to `tm_01` via `TeamMember`:
    ```typescript
    await prisma.teamMember.upsert({
      where: { userId: 'user_prt_01' },
      update: { teamId: 'tm_01' },
      create: { userId: 'user_prt_01', teamId: 'tm_01' },
    });
    ```
  - This provides an immediate, deterministic test fixture:
    - `participant` voting on `prj_01` -> **403 Forbidden** (Self-vote blocked).
    - `participant` voting on `prj_02` -> **200 OK** (Vote accepted).
  - Side-effect analysis: In `src/app/api/projects/route.ts`, submission deadline checks occur before team membership lookup (and the event is closed), so linking `user_prt_01` to `tm_01` causes zero regression for existing T1/T2 acceptance checks.

### 2.5 Fixtures for `CommunityVote` and `Comment`
From Phase 6 R2, R3, R4, R5 requirements:
- **Should `seed.ts` pre-seed test votes or comments?**
  - **Votes:** **KEEP CLEAN (0 pre-seeded votes)**.
    - Pre-seeding votes from `user_prt_01` or other test accounts would cause them to start in a "voted" state, breaking tests that assert clean vote toggling from `hasVoted: false` to `true`.
    - Starting with 0 community votes ensures the organizer governance dashboard starts at a known, pristine state (`Total Votes: 0`, `Unique Voters: 0`) and tests can accurately assert exact vote increments.
  - **Comments:** **KEEP CLEAN BY DEFAULT (0 pre-seeded comments)**.
    - The Comment drawer UI should render an elegant obsidian empty state (`"No community comments yet. Be the first to leave feedback!"`).
    - API tests and E2E probes can post comments dynamically to verify sanitization, character limits (<= 500 chars), author role tagging, and audit logging.

---

## 3. Caveats

1. **Docker Container Reboots (`entrypoint.sh`):**
   - `entrypoint.sh` runs `npx tsx src/lib/seed.ts` every time the container boots. Because `seed.ts` is idempotent and does not drop tables or overwrite organizer toggles in `update`, user votes and comments created at runtime persist safely in the SQLite volume (`/data/dogfood.db`).
2. **Schema Default vs Seed Values:**
   - Always define `@default(true)` for `votingOpen` and `@default(false)` for `resultsPublic` in `prisma/schema.prisma`. Do not rely solely on `seed.ts` to supply defaults, because rows created through alternative paths (or during migrations) need valid schema-level defaults.
3. **Database File Resolution:**
   - Prisma CLI commands (`prisma db push`, `prisma generate`) and Next.js server runtime both resolve `file:./prisma/dogfood.db` relative to `prisma/`, targeting `prisma/prisma/dogfood.db`. Ensure any direct sqlite3 inspection targets this exact path.

---

## 4. Conclusion

1. **Database Baseline:** The seed script reliably populates 1 Event (`evt_01`), 8 Tracks, 40 Teams, 40 Projects, 30 Judges, 4 Rubric Criteria, fixture scores, and 4 Test Users with deterministic session tokens.
2. **Event Model Fields:** `Event` must be extended with `votingOpen Boolean @default(true)` and `resultsPublic Boolean @default(false)`. In `seed.ts`, include these in the `create` block of `prisma.event.upsert`, but omit them from `update` to preserve runtime organizer toggles.
3. **Idempotency & Tokens:** `npm run seed` is completely idempotent, preserves deterministic tokens, and retains all existing records without data loss.
4. **Participant Team Linkage:** Recommend adding an idempotent upsert in `src/lib/seed.ts` linking `user_prt_01` to `tm_01`. This guarantees deterministic, immediate testability for the Self-Vote Defense check (`POST /api/community/vote` on `prj_01` returning `403 Forbidden`).
5. **Fixture Cleanliness:** Keep `CommunityVote` and `Comment` clean in `seed.ts` (0 pre-seeded rows). Rely on UI empty states and dedicated API test suites to verify voting and comment interactions.

### Exact Proposed Changes for `src/lib/seed.ts`

```typescript
// --- In prisma.event.upsert (Lines 73-84) ---
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
    votingOpen: true,
    resultsPublic: false,
  },
});

// --- In Section 8: Test users + sessions (after line 227) ---
// Assign participant to tm_01 for deterministic self-vote defense testing
const prtMembership = await prisma.teamMember.findUnique({
  where: { userId: 'user_prt_01' },
});
if (!prtMembership) {
  await prisma.teamMember.create({
    data: { userId: 'user_prt_01', teamId: 'tm_01' },
  });
}
```

---

## 5. Verification Method

To independently verify all findings and test seed idempotency after M1 schema migration:

```powershell
# 1. Typecheck the project
npm run typecheck

# 2. Run seed script and check output
npm run seed

# Expected output:
# seeded. test logins:
#   organizer    Cookie: session=org_seed_token_2026
#   judge_a      Cookie: session=jdg_a_seed_token_2026
#   judge_b      Cookie: session=jdg_b_seed_token_2026
#   participant  Cookie: session=prt_seed_token_2026

# 3. Verify seed idempotency by running a second time
npm run seed

# 4. Verify baseline acceptance suite (MUST produce 7/7 PASS)
python Hack_docs/run.py .dogfood.toml

# 5. Verify database records via node/prisma script
node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); async function check() { const e = await prisma.event.findFirst(); const p = await prisma.project.count(); const tm = await prisma.teamMember.findUnique({ where: { userId: 'user_prt_01' } }); console.log({ eventId: e?.id, votingOpen: e?.votingOpen, resultsPublic: e?.resultsPublic, projectCount: p, prtTeam: tm?.teamId }); } check().finally(() => prisma.\$disconnect());"
```

### Invalidation Conditions
- Any changes that alter session token strings (`org_seed_token_2026`, etc.) in `.dogfood.toml` or DB.
- Any seed changes that drop tables or wipe `CommunityVote` / `Comment` data.
- Any change causing `python Hack_docs/run.py .dogfood.toml` to fail any of the 7 checks.
