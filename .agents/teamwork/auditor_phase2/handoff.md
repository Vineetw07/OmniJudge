# Forensic Audit Report — Phase 2 (T1 Core)

**Work Product**: Phase 2 implementation (`src/app/projects/page.tsx`, `src/app/api/projects/route.ts`, `src/app/api/auth/login/route.ts`, `src/app/login/page.tsx`, `.dogfood.toml`)  
**Profile**: General Project (Development Mode enforcement per `ORIGINAL_REQUEST.md`)  
**Verdict**: **CLEAN**

---

### Phase Results

| Forensic Check | Status | Verification Summary |
|---|:---:|---|
| **1. No Hardcoded Test Deceptions** | **PASS** | Grep search confirmed zero occurrences of `dogfood-late-submission-probe` or probe identifiers in `src/`. `fixtures.json` project titles ("Glass Signal", "Small Meadow", "Deep Compass") do not appear anywhere in code files. |
| **2. Dynamic Database Gallery (`/projects`)** | **PASS** | `src/app/projects/page.tsx` executes `prisma.project.findMany({ take: 40, ... })` and maps over results. "Glass Signal" is rendered dynamically from the SQLite database. |
| **3. Genuine Submissions Deadline Logic (`/api/projects`)** | **PASS** | `src/app/api/projects/route.ts` reads `event.submissionsClose` from SQLite via Prisma, calculates `closeTime < Date.now()`, and returns 409 only when past deadline. Full persistence and audit logging exist if deadline is open. |
| **4. Authentic DB Authentication (`/api/auth/login`)** | **PASS** | `src/app/api/auth/login/route.ts` verifies user existence via `prisma.user.findUnique({ where: { email } })` and queries/creates sessions in the Prisma `Session` table. |
| **5. Authentic Config & Tokens (`.dogfood.toml`)** | **PASS** | Tokens (`org_seed_token_2026`, `jdg_a_seed_token_2026`, etc.) and `peer_scores` route param (`user_jdg_a_01`) exactly match seeded database records in SQLite. |
| **6. No Diagnostic Bypasses or Stubs** | **PASS** | Zero `@ts-ignore`, `@ts-expect-error`, or `eslint-disable` annotations found across the codebase. Zero stubbed functions or empty catch blocks. |
| **7. Typecheck & Production Build** | **PASS** | `npm run typecheck` exited with code 0. `npm run build` compiled all routes cleanly with code 0. |
| **8. Acceptance Checker (run.py)** | **PASS** | Executing `python Hack_docs/run.py .dogfood.toml` passed all 3 T1 acceptance checks (`gallery is public`, `project from fixtures shown`, `closed event refuses submissions`). |

---

## 1. Observation

### Observation 1.1: Static Analysis & No Hardcoded Deceptions
- **Target string search for `dogfood-late-submission-probe`**:
  ```
  File: d:\TP\Hackathon\DogFood\Hack_docs\run.py (Line 133)
  File: d:\TP\Hackathon\DogFood\Hack_docs\context.txt (Line 577)
  ```
  Zero occurrences in `src/`.
- **Target string search for `Glass Signal`**:
  Found only in `Hack_docs/fixtures.json` (line 630), `dogfood_build_plan.md`, `PROGRESS.md`, and test file `tests/test_phase2_adversarial.py`. Zero occurrences in `src/app/projects/page.tsx` or any `src/` file.
- **Search for diagnostic bypasses (`@ts-ignore`, `@ts-expect-error`, `eslint-disable`)**:
  Zero matches found across `d:\TP\Hackathon\DogFood\src`.

### Observation 1.2: Code Inspection of `src/app/projects/page.tsx`
- Lines 18–25:
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
- Lines 78–140:
  Maps over `projects` rendering `{project.title}`, `{project.summary}`, `{project.track?.name}`, `{project.team?.name}`, and repository link using shadcn Card, Badge, and Button primitives. Bounded by `take: 40`.

### Observation 1.3: Code Inspection of `src/app/api/projects/route.ts`
- Lines 40–55: Validates session via `getSession(req)` and validates roles (`participant`, `organizer`, `admin`).
- Lines 58–74: Validates payload with Zod `SubmissionSchema`.
- Lines 79–102:
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
- Lines 104–157: Fully implements genuine database insertion into `prisma.project.create(...)` and `prisma.auditLog.create(...)` if the event is open.

### Observation 1.4: Code Inspection of `src/app/api/auth/login/route.ts`
- Lines 38–47:
  ```typescript
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return NextResponse.json(
      { error: 'User with this email not found' },
      { status: 401 }
    );
  }
  ```
- Lines 50–70: Queries existing active session via `prisma.session.findFirst({ where: { userId: user.id, expiresAt: { gt: new Date() } } })` or creates a new session in SQLite with a 30-day expiry.
- Lines 83–91: Sets `session` cookie with `httpOnly: true, sameSite: 'lax', maxAge: 2592000`.

### Observation 1.5: Config & Database Integrity (`.dogfood.toml`)
- `.dogfood.toml`:
  ```toml
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
- Database inspection confirmed `user_jdg_a_01` exists in `User` with role `judge` and email `judge_a@dogfood.dev`. All four session tokens exist in the `Session` table mapped to their respective user IDs.

### Observation 1.6: Build & Test Outputs
- `npm run typecheck` output: Exited with code 0. Zero errors.
- `npm run build` output: Exited with code 0. Production build generated all routes (`/projects`, `/login`, `/api/projects`, `/api/auth/login`).
- `python Hack_docs/run.py .dogfood.toml` output:
  ```
  DOGFOOD 2026 acceptance report
  portal: http://localhost:8080
  claimed: T1 T2
  fixtures: D:\TP\Hackathon\DogFood\Hack_docs\fixtures.json

  T1  gallery is public ................. PASS
  T1  project from fixtures shown ....... PASS
  T1  closed event refuses submissions .. PASS
  ```
- Independent Node.js HTTP runtime verification:
  ```
  GET /projects: 200 HTML length: 355117
  Contains Glass Signal: true
  Contains Small Meadow: true
  Contains Deep Compass: true
  POST /api/projects status: 409 Body: {"error":"Submissions are closed for this event","submissionsClose":"2026-03-01T18:00:00.000Z","serverTime":"2026-09-27T08:50:24.230Z"}
  POST /api/auth/login status: 200 Body: {"success":true,"user":{"id":"user_jdg_a_01","email":"judge_a@dogfood.dev","name":"Judge Alpha","role":"judge"}}
  Set-Cookie header: session=jdg_a_seed_token_2026; Path=/; Expires=Tue, 27 Oct 2026 08:50:24 GMT; Max-Age=2592000; HttpOnly; SameSite=lax
  ```

---

## 2. Logic Chain

1. **Step 1 (Source Grounding)**: Inspection of `src/app/projects/page.tsx` and `src/app/api/projects/route.ts` proved that no expected test responses, strings, or probe identifiers were hardcoded.
2. **Step 2 (Data Flow Trace)**: The projects rendered at `GET /projects` originate directly from the database query `prisma.project.findMany(...)`, which reads seeded fixture records from SQLite (`prisma/dogfood.db`).
3. **Step 3 (Behavioral Authenticity)**: The deadline check in `POST /api/projects` compares the real `event.submissionsClose` stored in the database with `Date.now()`. It is not a constant 409 response; it contains full write paths and Zod parsing.
4. **Step 4 (Auth Authenticity)**: `POST /api/auth/login` looks up the user in the SQLite `User` table and sets cookies linked to rows in the `Session` table.
5. **Step 5 (Empirical Verification)**: Both `run.py` and independent HTTP queries confirm that the live running application behaves exactly as specified, returning 200 for gallery with fixture project titles, 409 for late submissions, and 200 + valid cookie for login.
6. **Step 6 (Code Quality & Hygiene)**: No compiler errors, no diagnostic suppression directives (`@ts-ignore`, etc.), and clean Next.js production builds.

---

## 3. Caveats

- **Scope boundaries**: This audit strictly evaluated Phase 2 (T1 Core: public gallery, submission deadline check, login, `.dogfood.toml`). Future tiers (T2 judging, score normalization, CSV export) are part of subsequent phases and are currently expected to return 404 (as observed in `run.py`).
- **No caveats** regarding the authenticity or integrity of Phase 2 deliverables.

---

## 4. Conclusion

The Phase 2 deliverables have been independently audited with zero trust and verified empirically. There are no facade implementations, no hardcoded test outputs, no diagnostic bypasses, and all database interactions are genuine.

**Verdict: CLEAN**

---

## 5. Verification Method

To reproduce and independently verify this audit:

1. **Static code search**:
   ```powershell
   Select-String -Path "src\**\*.ts","src\**\*.tsx" -Pattern "dogfood-late-submission-probe","Glass Signal","@ts-ignore","eslint-disable"
   ```
   *Expected: No matches.*

2. **TypeScript validation & Production Build**:
   ```powershell
   npm run typecheck
   npm run build
   ```
   *Expected: Both commands complete with exit code 0.*

3. **Acceptance Checker**:
   ```powershell
   python Hack_docs/run.py .dogfood.toml
   ```
   *Expected: All 3 T1 checks report `PASS`.*

4. **Independent HTTP Probes**:
   ```powershell
   # 1. Gallery check
   (Invoke-WebRequest -Uri "http://localhost:8080/projects" -UseBasicParsing).Content -match "Glass Signal"
   # 2. Submission rejection check
   try { Invoke-RestMethod -Uri "http://localhost:8080/api/projects" -Method POST -Headers @{ Cookie = "session=prt_seed_token_2026" } -Body '{"title":"t","summary":"s"}' -ContentType "application/json" } catch { $_.Exception.Response.StatusCode.value__ }
   ```
   *Expected: Returns `True` and `409` respectively.*
