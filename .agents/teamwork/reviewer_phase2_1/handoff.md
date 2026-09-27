# Review & Adversarial Challenge Report: Phase 2 (T1 Core)

**Reviewer:** reviewer_phase2_1 (Roles: reviewer, critic)  
**Date:** 2026-09-27  
**Working Directory:** `d:\TP\Hackathon\DogFood\.agents\teamwork\reviewer_phase2_1`  
**Milestone:** Phase 2 — T1 Core  
**Final Verdict:** **APPROVE**  
**Integrity Status:** **PASS — Zero integrity violations detected**  
**Adversarial Risk Assessment:** **LOW**

---

## 1. Observation

### 1.1 Integrity & Anti-Cheating Verification
Each deliverable was inspected for potential integrity violations:
- **Hardcoded test outputs / expected strings in source code:**
  - `src/app/projects/page.tsx` queries SQLite via `prisma.project.findMany({ take: 40, orderBy: { id: 'asc' }, include: { team: true, track: true } })` and renders `{project.title}` dynamically. No fixture titles ("Glass Signal", "Small Meadow", "Deep Compass") are hardcoded in source text.
  - `src/app/api/projects/route.ts` evaluates event deadline via `new Date(event.submissionsClose).getTime() < Date.now()` against the real database record. No test probe names (`"dogfood-late-submission-probe"`) or simulated 409 responses are hardcoded.
  - `src/app/api/auth/login/route.ts` looks up users in `prisma.user` and verifies or creates sessions in `prisma.session`. No mock user tables or test token bypasses exist.
- **Facade implementations:**
  - Real database queries and transactions are used across all endpoints.
  - POST `/api/projects` contains the complete persistence pipeline (team assignment/creation, track default, project creation, and audit logging) if the submission window were open.
- **Shortcuts / Task bypasses:**
  - None. Standard Next.js App Router, Zod validation, Prisma ORM, and HTTP cookie sessions are fully implemented.

### 1.2 Static Verification & Build Results
1. **TypeScript Typecheck (`npm run typecheck`):**
   - Command: `npm run typecheck` (`tsc --noEmit`)
   - Result: Exit code 0, 0 errors.
2. **ESLint (`npm run lint`):**
   - Command: `npm run lint` (`next lint`)
   - Result: Exit code 0, `✔ No ESLint warnings or errors`.
3. **Next.js Production Build (`npm run build`):**
   - Command: `npm run build` (`next build`)
   - Result: Exit code 0. Compiled successfully.
   - Route mapping:
     - `/` (Static)
     - `/_not-found` (Static)
     - `/api/auth/login` (Dynamic)
     - `/api/projects` (Dynamic)
     - `/login` (Static)
     - `/projects` (Dynamic)

### 1.3 Live System & Acceptance Checker Results
1. **Acceptance Checker (`python Hack_docs/run.py .dogfood.toml`):**
   - `T1  gallery is public ................. PASS` (HTTP 200, unauthenticated)
   - `T1  project from fixtures shown ....... PASS` (Fixture title "Glass Signal" present in HTML)
   - `T1  closed event refuses submissions .. PASS` (HTTP 409 Conflict returned to participant)
   - Summary: `claimed T1 T2, verified T1` (`T2` pending Phase 3 milestone).
2. **Direct Adversarial Probes:**
   - `GET /projects` (no auth header): Returned HTTP 200. SSR HTML verified to contain `"Glass Signal"`.
   - `POST /api/projects` (no session cookie): Returned HTTP 401 Unauthorized (`{"error":"Unauthorized: Valid session required"}`).
   - `POST /api/projects` (with judge session cookie): Returned HTTP 403 Forbidden (`{"error":"Forbidden: Only participants or organizers may submit projects"}`).
   - `POST /api/projects` (with participant session cookie, past event deadline): Returned HTTP 409 Conflict (`{"error":"Submissions are closed for this event", ...}`).
   - `POST /api/projects` (malformed JSON payload `{malformed_json`): Returned HTTP 400 Bad Request (`{"error":"Invalid JSON payload"}`).
   - `POST /api/projects` (empty title `{"title":"","summary":"valid"}`): Returned HTTP 400 Bad Request with Zod schema validation errors.
   - `POST /api/projects` (bogus session token `session=bogus_token_123`): Returned HTTP 401 Unauthorized.
   - `POST /api/auth/login` (seeded participant `participant@dogfood.dev`): Returned HTTP 200 with `Set-Cookie: session=prt_seed_token_2026; Path=/; Expires=Tue, 27 Oct 2026 08:49:11 GMT; Max-Age=2592000; HttpOnly; SameSite=lax`.
   - `POST /api/auth/login` (fixture judge with no prior session `tomas.varga@example.org`): Returned HTTP 200 with new dynamically generated UUID session token in SQLite DB and `Set-Cookie`. Subsequent call to `/api/projects` using this new cookie correctly enforced judge role permissions (HTTP 403).
   - `POST /api/auth/login` (unregistered email `unknown@dogfood.dev`): Returned HTTP 401 Unauthorized (`{"error":"User with this email not found"}`).
   - `POST /api/auth/login` (malformed email `not-an-email`): Returned HTTP 400 Bad Request (`{"error":"Valid email address is required"}`).

---

## 2. Logic Chain

1. **R1: Public Gallery (`/projects`):**
   - Observation 1.1 and 1.3 confirm that `src/app/projects/page.tsx` is an async Server Component with `dynamic = 'force-dynamic'`, requiring zero authentication cookies.
   - It performs a bounded database read (`take: 40, orderBy: { id: 'asc' }`), fetching fixture projects (`prj_01` = "Glass Signal", `prj_02` = "Small Meadow", `prj_03` = "Deep Compass").
   - Titles are rendered directly into server-generated HTML text within `<CardTitle>`, allowing plain text discovery by `Hack_docs/run.py` without requiring client JavaScript execution.
   - Conclusion: R1 criteria fully met.

2. **R2: Submission Close Enforcement (`/api/projects`):**
   - Observation 1.1 and 1.3 confirm that `POST /api/projects` enforces session validation (returning 401 for anonymous/invalid sessions), role validation (returning 403 for judges), and payload schema parsing via Zod.
   - It inspects the database record for `event.submissionsClose` (`2026-03-01T18:00:00.000Z`).
   - Comparing this timestamp against current server time (`now > closeTime`) triggers an HTTP 409 Conflict rejection with full ISO diagnostic timestamps.
   - This satisfies both the spec's requirement for 409/403 and the acceptance checker's check (`400 <= status < 500`).
   - Conclusion: R2 criteria fully met.

3. **R3: Hand-Rolled Offline Authentication (`/login` & `/api/auth/login`):**
   - Observation 1.1 and 1.3 confirm that authentication relies entirely on local SQLite tables (`User` and `Session`), operating without external OAuth or internet dependencies.
   - Pre-seeded users preserve their deterministic tokens (e.g. `prt_seed_token_2026`), while new logins dynamically create cryptographic UUIDv4 sessions in the database.
   - Cookies are dispatched with `HttpOnly`, `Path=/`, `SameSite=lax`, and `secure: false` (necessary for HTTP on port 8080).
   - Conclusion: R3 criteria fully met.

4. **R4: Configuration Contract (`.dogfood.toml`):**
   - `.dogfood.toml` mirrors the spec structure.
   - Tokens for `organizer`, `judge_a`, `judge_b`, and `participant` match those printed during database seed.
   - `peer_scores` is mapped to `/api/judge/scores?judge=user_jdg_a_01`, which corresponds to the exact database `userId` of `judge_a` seeded in SQLite.
   - Conclusion: R4 criteria fully met.

---

## 3. Findings & Adversarial Challenges

### 3.1 Quality Review Findings

#### [Minor] Finding 1: Unverified `teamId` in Project Submission (Potential IDOR if Submissions Open)
- **Location:** `src/app/api/projects/route.ts:105-111`
- **Issue:** If `data.teamId` is supplied in the request body, the route assigns `teamId = data.teamId` without validating that the authenticated `session.id` is actually a member of that team.
- **Impact:** Submissions are currently closed (returning 409 before reaching this block), so this does not affect Phase 2. However, if an organizer re-opens submissions or if open submissions are tested in later phases, an authenticated participant could submit a project claiming membership in another team.
- **Suggestion:** Add an ownership check before accepting an explicit `teamId`:
  ```typescript
  if (data.teamId) {
    const isMember = await prisma.teamMember.findFirst({
      where: { userId: session.id, teamId: data.teamId },
    });
    if (!isMember) return NextResponse.json({ error: 'You are not a member of this team' }, { status: 403 });
  }
  ```

#### [Minor] Finding 2: Millisecond-Level ID Collision Risk under Concurrency
- **Location:** `src/app/api/projects/route.ts:116, 134`
- **Issue:** Team and Project IDs are generated using `'tm_' + Date.now()` and `'prj_' + Date.now()`.
- **Impact:** If two concurrent requests arrive within the same millisecond, SQLite will reject the second insertion with a unique constraint violation on primary key `id`.
- **Suggestion:** Replace `Date.now()` with `crypto.randomUUID()` (e.g. `prj_${crypto.randomUUID().slice(0, 12)}`).

#### [Minor] Finding 3: `PROGRESS.md` Checklist Synchronization
- **Location:** `PROGRESS.md:67-74`
- **Issue:** Phase 2 checkboxes in `PROGRESS.md` remain marked `[ ]`.
- **Impact:** Code and tests are 100% complete and passing, but the ledger requires updating prior to final phase commit.
- **Suggestion:** Toggle Phase 2 checkboxes to `[x]` and commit with message `[PROGRESS] Phase 2: T1 gallery, submit close, login, .dogfood.toml — Phase 3 T2 judging next`.

### 3.2 Adversarial Challenge Assessment
- **Overall Risk:** **LOW**
- **Challenge 1 (Deadline Tampering):** Can a participant bypass the 409 rejection by omitting `eventId` or sending an arbitrary event ID?
  - *Result:* Passed. If `eventId` is omitted, the route defaults to `prisma.event.findFirst()`, which retrieves the closed fixture event. If an invalid `eventId` is sent, it returns 404. Neither path allows creating a project after the deadline.
- **Challenge 2 (Session Hijacking / CSRF):** Does cookie authentication expose the system to CSRF or XSS?
  - *Result:* Passed. Cookies are configured with `HttpOnly: true` (immune to `document.cookie` theft) and `SameSite: 'lax'` (prevents cross-origin POST attacks).
- **Challenge 3 (SSR Hydration / Caching):** Can Next.js cache stale gallery state or static 404s?
  - *Result:* Passed. `export const dynamic = 'force-dynamic'` is explicitly defined on `src/app/projects/page.tsx` and all API routes, preventing static cache freezing.

---

## 4. Caveats

1. **Docker Environment Verification:**
   - Docker CLI was verified in Phase 1; container-level execution of `docker compose up` was not re-tested in Phase 2 because native port 8080 execution already validated the full server runtime.
2. **Phase 3 Route Stubs:**
   - `.dogfood.toml` claims `["T1", "T2"]` per the prompt specification. As expected, `Hack_docs/run.py` reports T2 checks as `FAIL (got 404)` because the T2 endpoints (`/api/judge/scores` and `/api/export.csv`) are scheduled for Phase 3. T1 checks are 100% PASS.

---

## 5. Conclusion & Verdict

**Verdict:** **APPROVE**

All code changes implemented in Phase 2 strictly satisfy the technical specifications, Next.js App Router conventions, TypeScript strictness, and acceptance criteria in `Hack_docs/run.py`. There are zero integrity violations, zero simulated test stubs, and all database interactions are genuine.

---

## 6. Verification Method

To independently verify the deliverables:

```powershell
# 1. Typecheck and linting
npm run typecheck
npm run lint

# 2. Build verification
npm run build

# 3. Acceptance checker
python Hack_docs/run.py .dogfood.toml

# 4. Independent endpoint probe
node -e "
const http = require('http');
function get(p) { return new Promise(r => http.get('http://localhost:8080' + p, res => { let d=''; res.on('data', c => d+=c); res.on('end', () => r({ s: res.statusCode, b: d })); })); }
async function verify() {
  const p = await get('/projects');
  console.log('Gallery OK:', p.s === 200 && p.b.includes('Glass Signal'));
}
verify();
"
```
