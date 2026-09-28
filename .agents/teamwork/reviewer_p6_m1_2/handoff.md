# Phase 6 Milestone 1 (M1) Review & Adversarial Challenge Report

**Reviewer:** Reviewer 2 (`reviewer_p6_m1_2`)  
**Roles:** reviewer, critic  
**Target Milestone:** Phase 6 M1 (Data Model & Schema Migration)  
**Target Agent:** Worker 1 (`worker_p6_m1`)  
**Commit Inspected:** `e983a0a [Phase 6] M1: schema migration for CommunityVote, Comment, and voting lifecycle flags`  
**Verdict:** **APPROVE**  
**Integrity Finding:** NO INTEGRITY VIOLATION DETECTED  

---

## 1. Observation

### 1.1 Seed Idempotency & Deterministic Tokens
- Executed `npm run seed` twice consecutively:
  - First run:
    ```
    > omnijudge@0.1.0 seed
    > npx tsx src/lib/seed.ts

    seeded. test logins:
      organizer    Cookie: session=org_seed_token_2026
      judge_a      Cookie: session=jdg_a_seed_token_2026
      judge_b      Cookie: session=jdg_b_seed_token_2026
      participant  Cookie: session=prt_seed_token_2026
    ```
  - Second run:
    Exit code 0, identical token output printed, zero errors or duplicate key conflicts.
- Verified against `.dogfood.toml` (lines 9–12):
  - `organizer   = "Cookie: session=org_seed_token_2026"` -> Matches exactly.
  - `judge_a     = "Cookie: session=jdg_a_seed_token_2026"` -> Matches exactly.
  - `judge_b     = "Cookie: session=jdg_b_seed_token_2026"` -> Matches exactly.
  - `participant = "Cookie: session=prt_seed_token_2026"` -> Matches exactly.

### 1.2 Baseline Acceptance Compatibility (7/7 Checks)
- Executed `python Hack_docs/run.py .dogfood.toml`:
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
  Exit code 0, 7/7 checks PASS. Zero baseline regressions.

### 1.3 TeamMember Mapping for `user_prt_01`
- Inspected database record via Prisma Client & SQLite query:
  ```json
  {
    "id": "user_prt_01",
    "email": "participant@dogfood.dev",
    "role": "participant",
    "teamMember": {
      "id": "cmul8m9fn000110tpdhj6skgq",
      "userId": "user_prt_01",
      "teamId": "tm_01",
      "team": {
        "id": "tm_01",
        "name": "NorthKiln",
        "projects": [
          {
            "id": "prj_01",
            "teamId": "tm_01",
            "title": "Glass Signal"
          }
        ]
      }
    }
  }
  ```
- `user_prt_01` is mapped to `teamId = "tm_01"`. Team `tm_01` owns `prj_01` ("Glass Signal").

### 1.4 Database Preservation & Counts
- Queried SQLite database table counts directly:
  - `User`: 34 records (30 fixture judges + 4 test users: organizer, judge_a, judge_b, participant).
  - `Project`: 41 records (40 fixture projects + 1 test submission from earlier phases).
  - `Score`: 293 fixture scores.
  - `Team`: 40 fixture teams.
  - `TeamMember`: 1 record (`user_prt_01` -> `tm_01`).
  - `Event`: 1 record (`id: "evt_01"`, `votingOpen: true`, `resultsPublic: false`).
  - `CommunityVote`: 0 records (clean state for M2/M3).
  - `Comment`: 0 records (clean state for M2/M4).

### 1.5 Adversarial Constraint Stress-Test
- Tested creating a `CommunityVote` on `prj_02` by `user_prt_01`: succeeded.
- Tested immediately attempting a duplicate vote on `prj_02` by `user_prt_01`: rejected by database engine with Prisma error code `P2002` (Unique constraint failed on the fields: (`projectId`, `userId`)).
- Tested creating a `Comment`: succeeded with foreign key relations verified.
- Cleaned up test artifacts; final table count restored to 0 votes, 0 comments.

### 1.6 Verification Triad
- `npm run typecheck`: Exit code 0 (zero errors).
- `npm run lint`: Exit code 0 (zero warnings, zero errors).

---

## 2. Logic Chain

1. **Deterministic Idempotency**:
   - *Observation (1.1)*: `src/lib/seed.ts` uses `prisma.teamMember.upsert` on `userId: 'user_prt_01'` and `prisma.event.upsert` with lifecycle flags in `create`.
   - *Logic*: Repeated executions do not throw duplicate key violations and do not mutate existing project or session data.
2. **Acceptance Test Invariance**:
   - *Observation (1.2)*: `python Hack_docs/run.py .dogfood.toml` passed 7/7 checks against the running server on port 8080.
   - *Logic*: Schema additions (`CommunityVote`, `Comment`, `Event.votingOpen`, `Event.resultsPublic`) are purely additive and do not alter existing route behavior for `/projects`, `/api/projects`, `/api/judge/scores`, or `/api/export.csv`.
3. **M2 Self-Vote Defense Grounding**:
   - *Observation (1.3)*: `user_prt_01` is linked to `tm_01`, which submitted `prj_01`.
   - *Logic*: When M2 implements `POST /api/community/vote`, checking `teamMember.teamId === project.teamId` will deterministically reject a vote on `prj_01` with `403 Forbidden`, while allowing votes on all other 40 projects (`prj_02` through `prj_40`).
4. **Data Integrity & Non-Destruction**:
   - *Observation (1.4)*: Database backup `dogfood.db.bak` exists, and current table counts for users (34), projects (41), and scores (293) match the pre-migration baseline.
   - *Logic*: Schema synchronization via `prisma db push` completed without dropping existing tables or data loss.
5. **No Integrity Violations**:
   - *Observation (1.1, 1.5)*: Code changes contain genuine database models, indexes, cascades, and constraints. No hardcoded results, mocked responses, or test bypasses exist.
   - *Logic*: The implementation complies with all integrity rules.

---

## 3. Caveats

1. **Active SQLite Database File Location**:
   Due to Next.js / Prisma resolution relative to `prisma/schema.prisma`, `DATABASE_URL="file:./prisma/dogfood.db"` targets `prisma/prisma/dogfood.db` rather than `prisma/dogfood.db` (which is a 0-byte placeholder). Both worker and tests operate on `prisma/prisma/dogfood.db`.
2. **Unassigned Participants in M2**:
   While `user_prt_01` is assigned to `tm_01`, generic participants or visitors in future sessions might have `teamMember === null`. M2 must ensure `user.teamMember?.teamId` null-checks do not throw runtime exceptions.
3. **Event Flag Persistence**:
   In `src/lib/seed.ts`, `votingOpen` and `resultsPublic` are set in `create` but omitted from `update`. This ensures organizer changes made in M5 persist across re-seedings, but means resetting flags to default requires explicit DB update or database re-creation.

---

## 4. Conclusion

- **Verdict**: **APPROVE**
- Phase 6 Milestone 1 (M1: Data Model & Schema Migration) has satisfied all requirements, acceptance criteria, and integrity constraints.
- Seed script is idempotent, tokens match `.dogfood.toml`, all 7 acceptance checks pass green, and `user_prt_01` is deterministically mapped to `tm_01`.
- Proceed immediately to Milestone 2 (M2: Anti-Abuse Protected APIs).

---

## 5. Verification Method

To independently reproduce the review findings:

```powershell
# 1. Run seed and check tokens
npm run seed

# 2. Verify 7/7 baseline acceptance checks
python Hack_docs/run.py .dogfood.toml

# 3. Verify user_prt_01 -> tm_01 relation in SQLite
python -c "import sqlite3; conn = sqlite3.connect('prisma/prisma/dogfood.db'); cur = conn.cursor(); print(cur.execute('SELECT tm.userId, tm.teamId, p.id, p.title FROM TeamMember tm JOIN Project p ON tm.teamId = p.teamId WHERE tm.userId = ?', ('user_prt_01',)).fetchall())"
# Expected output: [('user_prt_01', 'tm_01', 'prj_01', 'Glass Signal')]

# 4. Verify TypeScript and ESLint
npm run typecheck
npm run lint
```
