# Forensic Integrity Audit Report

## 1. Observation

### O1. Acceptance Checker and Fixtures Tampering Verification
- **Command**: `git log --stat -- Hack_docs/`
- **Output**:
  ```
  commit 0e43906251fe671864fbd555261ec2b9437a8037
  Author: Vineeetw07 <Vineetrw@gmail.com>
  Date:   Sun Sep 27 13:51:46 2026 +0530

      [PROGRESS] Phase 1 complete: scaffold, schema, seed, auth, Docker, normalization — all verified

   Hack_docs/context.txt          |  755 ++++++++++++++
   Hack_docs/example.dogfood.toml |   31 +
   Hack_docs/fixtures.json        | 2258 ++++++++++++++++++++++++++++++++++++++++
   Hack_docs/run.py               |  268 +++++
   Hack_docs/spec.md              |  333 ++++++
   5 files changed, 3645 insertions(+)
  ```
- **Command**: `git diff 0e43906..HEAD -- Hack_docs/` and `git diff HEAD -- Hack_docs/`
- **Output**: Empty (0 lines modified, 0 files touched).
- **Finding**: Acceptance checker `Hack_docs/run.py` and fixture dataset `Hack_docs/fixtures.json` are completely unmodified since their initial commit. No test cheating or assertion weakening occurred.

### O2. Absence of Hardcoded Test Strings in Source Code
- **Search**: Case-insensitive recursive search across `src/` for fixture titles ("Glass Signal", "Small Meadow", "Deep Compass") and probe strings ("dogfood-late-submission-probe", "judge cannot see peer scores", "gallery is public").
- **Output**: `0 results found` across all files in `src/`.
- **Finding**: Fixture project titles are NOT hardcoded in templates or API routes. They exist exclusively within `prisma/dogfood.db` (seeded via `src/lib/seed.ts` from `fixtures.json`).

### O3. Dynamic Database Querying in `GET /projects`
- **File**: `src/app/projects/page.tsx:18-25`
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
- **Runtime Verification**:
  - Direct DB probe: `[{"id":"prj_01","title":"Glass Signal"},{"id":"prj_02","title":"Small Meadow"},{"id":"prj_03","title":"Deep Compass"}...]` (40 projects total).
  - HTTP `GET http://localhost:8080/projects` returns HTTP 200, length 355,116 bytes, dynamically rendering card elements for each project queried from SQLite.

### O4. Dynamic Deadline Enforcement in `POST /api/projects`
- **File**: `src/app/api/projects/route.ts:79-102`
  ```typescript
  const event = data.eventId
    ? await prisma.event.findUnique({ where: { id: data.eventId } })
    : await prisma.event.findFirst();

  if (!event) {
    return NextResponse.json(
      { error: 'Active hackathon event not found' },
      { status: 404 }
    );
  }

  const now = Date.now();
  const closeTime = new Date(event.submissionsClose).getTime();

  if (closeTime < now) {
    return NextResponse.json(
      {
        error: 'Submissions are closed for this event',
        submissionsClose: event.submissionsClose.toISOString(),
        serverTime: new Date(now).toISOString(),
      },
      { status: 409 }
    );
  }
  ```
- **Runtime HTTP Verification**:
  - `POST /api/projects` without session -> `401 Unauthorized` (`{"error":"Unauthorized: Valid session required"}`).
  - `POST /api/projects` with participant session (`Cookie: session=prt_seed_token_2026`) -> `409 Conflict`.
  - Body returned: `{"error":"Submissions are closed for this event","submissionsClose":"2026-03-01T18:00:00.000Z","serverTime":"2026-09-27T10:30:04.967Z"}`.
  - The date `"2026-03-01T18:00:00.000Z"` is directly retrieved from the SQLite `Event` table.

### O5. Strict Server-Side RBAC Isolation in `GET /api/judge/scores`
- **File**: `src/app/api/judge/scores/route.ts:34-64`
  ```typescript
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized: Valid session required' }, { status: 401 });
  }

  if (session.role !== 'judge' && session.role !== 'organizer' && session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Only judges and organizers can access judging scores' }, { status: 403 });
  }

  const targetJudge = req.nextUrl.searchParams.get('judge');

  if (session.role === 'judge') {
    if (targetJudge && targetJudge !== session.id) {
      return NextResponse.json({ error: 'Forbidden: Cannot view peer judge scores' }, { status: 403 });
    }
    const scores = await prisma.score.findMany({
      where: { judgeId: session.id },
      ...
    });
    return NextResponse.json({ scores });
  }
  ```
- **Runtime HTTP Probes**:
  - Anonymous -> `401 Unauthorized` (PASS)
  - Invalid session token -> `401 Unauthorized` (PASS)
  - Participant (`session=prt_seed_token_2026`) -> `403 Forbidden` (PASS)
  - Judge Alpha (`session=jdg_a_seed_token_2026`) own scores -> `200 OK` (PASS)
  - Judge Alpha querying `?judge=user_jdg_a_01` -> `200 OK` (PASS)
  - Judge Beta (`session=jdg_b_seed_token_2026`) peer probe `?judge=user_jdg_a_01` -> `403 Forbidden` (PASS)
  - Organizer (`session=org_seed_token_2026`) querying `?judge=user_jdg_a_01` -> `200 OK` (PASS)

### O6. Genuine Mathematical Normalization in `/api/export.csv`
- **File**: `src/lib/normalization.ts:30-58`
  - Correct median calculation supporting odd and even length arrays.
  - Median Absolute Deviation: `mad = sortedDevs.length % 2 !== 0 ? sortedDevs[mid] : (sortedDevs[mid - 1] + sortedDevs[mid]) / 2`.
  - Zero-variance guard: `if (mad === 0) return scores.map(() => 0)`.
  - Modified Z-Score: `0.6745 * (s - median) / mad`.
- **File**: `src/app/api/export.csv/route.ts:25-98`
  - Restricts endpoint strictly to organizer / admin (returns 401 for anonymous, 403 for participant, 403 for judge).
  - Fetches all projects, rubric criteria, and scores via Prisma.
  - Computes composite weighted scores per judge/project evaluation.
  - Calls `normaliseAllJudges()`.
  - Sorts and ranks projects by normalized score descending.
  - Outputs CSV with line 1 header `project_id,project_title,track,raw_score,normalized_score,rank`.
- **Runtime HTTP Verification**:
  - Anonymous -> `401`
  - Participant -> `403`
  - Judge Alpha -> `403`
  - Organizer -> `200 OK`, `Content-Type: text/csv; charset=utf-8`, 42 lines (1 header + 40 projects + trailing newline).
  - Zero occurrences of `NaN`, `null`, `undefined`, or `Infinity`.
  - Zero-variance judges in DB (e.g. `jdg_01`, `jdg_07`, `jdg_13`, `jdg_23`, `jdg_30`) cleanly contribute neutral 0.0 without divide-by-zero.

### O7. Pre-populated Artifacts and Logs
- **Command**: `Get-ChildItem -Path . -Exclude "node_modules",".next",".git" -Recurse -File | Where-Object { $_.FullName -notmatch '\\(node_modules|\.next|\.git)\\' -and ($_.Name -like "*.log" -or $_.Name -like "*result*" -or $_.Name -like "*output*" -or $_.Name -eq "acceptance-report.txt") }`
- **Output**: 0 files found.
- **Finding**: No pre-populated logs, results, or attestation artifacts exist in the repository.

### O8. Empirical Test Execution
1. `Hack_docs/run.py .dogfood.toml`:
   - All 7 checks PASS:
     - `T1  gallery is public ................. PASS`
     - `T1  project from fixtures shown ....... PASS`
     - `T1  closed event refuses submissions .. PASS`
     - `T2  judge sees own scores ............. PASS`
     - `T2  judge cannot see peer scores ...... PASS`
     - `T2  participant blocked ............... PASS`
     - `T2  csv export works .................. PASS`
     - Summary: `claimed T1 T2, verified T1 T2`
2. `tests/test_phase3_adversarial.py`: 47 passed, 0 failed.
3. `tests/test_phase3_challenger2_full.py`: 35 passed, 0 failed.
4. `npm run typecheck`: 0 errors.
5. `npm run lint`: 0 warnings, 0 errors.

---

## 2. Logic Chain

1. **Integrity Mode Assessment**:
   `ORIGINAL_REQUEST.md` (lines 8, 465, 606, 680, 721) explicitly specifies `Integrity mode: development`. Under development mode, the prohibited patterns are hardcoded test results, facade/dummy implementations, and fabricated verification outputs.

2. **Checker Immutability**:
   Git history confirms `Hack_docs/` was created in the initial commit `0e43906` and has `git diff == 0`. Therefore, tests are judging against genuine upstream acceptance criteria without weakening.

3. **Absence of Hardcoded Results**:
   Static analysis of all code in `src/` revealed 0 occurrences of fixture project names, test probe strings, or fake returns. All strings tested by the checker originate from the SQLite database seeded via `Hack_docs/fixtures.json`.

4. **Dynamic Backend Enforcement**:
   - `GET /projects` executes `prisma.project.findMany({ take: 40 })`.
   - `POST /api/projects` queries `prisma.event.findFirst()` and dynamically evaluates `submissionsClose` against `Date.now()`.
   - `GET /api/judge/scores` verifies session token authenticity against the `Session` table, and enforces `targetJudge !== session.id` returning HTTP 403 on peer inspection.
   - `GET /api/export.csv` executes multi-table aggregation, applies MAD Modified Z-score calculation dynamically across all judge scores, and handles zero-variance judges without crashing.

5. **Empirical Proof**:
   Running the test suites against the live service produces 100% passing results across official acceptance checks (7/7) and adversarial suites (82 probes total).

Therefore, every deliverable is authentically implemented and adheres strictly to integrity requirements.

---

## 3. Caveats

- **Active Network Listener**: The live tests were executed against the running dev server on `http://localhost:8080`.
- **Development Integrity Mode**: In accordance with `ORIGINAL_REQUEST.md`, external libraries (`prisma`, `zod`, `shadcn-ui`, `lucide-react`) are utilized as permitted under Development mode.
- No other caveats.

---

## 4. Conclusion & Binary Verdict

### Forensic Audit Report
- **Work Product**: DOGFOOD 2026 Hackathon Portal (Phases 1-3 Deliverables)
- **Profile**: General Project
- **Mode**: Development
- **Verdict**: **CLEAN**

All five prohibited patterns were evaluated and found absent:
1. Hardcoded test results: **CLEAN** (0 occurrences in source code)
2. Facade implementations: **CLEAN** (All endpoints perform authentic DB queries and algorithms)
3. Fabricated verification outputs: **CLEAN** (0 pre-populated logs or reports)
4. Self-certifying tests: **CLEAN** (`run.py` is an independent black-box HTTP checker)
5. Execution delegation: **CLEAN** (Core domain logic built from scratch)

---

## 5. Verification Method

To independently verify this report:
```powershell
# 1. Verify Hack_docs is untouched
git diff 0e43906..HEAD -- Hack_docs/

# 2. Verify no fixture project titles exist in src/
grep -rn "Glass Signal" src/

# 3. Verify TypeScript and ESLint
npm run typecheck
npm run lint

# 4. Verify official acceptance suite
python Hack_docs/run.py .dogfood.toml

# 5. Verify comprehensive adversarial test suites
python tests/test_phase3_adversarial.py
python tests/test_phase3_challenger2_full.py
```
Invalidation condition: If any command above fails, or if `git diff` reveals modifications in `Hack_docs/`, the verdict is invalidated.
