# Implementation Handoff Report: Phase 2 (T1 Core)

**Agent:** worker_phase2  
**Date:** 2026-09-27  
**Working Directory:** `d:\TP\Hackathon\DogFood\.agents\teamwork\worker_phase2`  
**Milestone:** Phase 2 — T1 Core (DOGFOOD 2026)

---

## 1. Observation

### 1.1 Files Created Under Exclusive Write Ownership
1. **`src/app/projects/page.tsx`** (Server Component, 172 lines):
   - `export const dynamic = 'force-dynamic';`
   - Public access (no auth checks or redirects, always HTTP 200).
   - Queries `prisma.project.findMany({ take: 40, orderBy: { id: 'asc' }, include: { team: true, track: true } })`.
   - Renders project titles prominently in HTML cards so that `"Glass Signal"`, `"Small Meadow"`, and `"Deep Compass"` appear as plain text strings in the server-rendered HTML.
   - Styled with Tailwind CSS, shadcn/ui Card components (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`), `Badge`, `Button`, and `lucide-react` icons.

2. **`src/app/api/projects/route.ts`** (API Route Handler, 160 lines):
   - `export const dynamic = 'force-dynamic';`
   - Exports `POST(req: NextRequest)` and `GET()` handlers.
   - Authenticates session using `getSession(req)`. Returns HTTP 401 (`{ error: 'Unauthorized: Valid session required' }`) when unauthenticated.
   - Validates role (`participant`, `organizer`, or `admin`). Returns HTTP 403 if unauthorized.
   - Validates payload with Zod schema (`title: z.string().min(1)`, `summary: z.string().min(1)`, optional fields). Returns HTTP 400 on malformed body or validation failure.
   - Queries `prisma.event.findFirst()`, compares `new Date(event.submissionsClose).getTime() < Date.now()`.
   - Returns HTTP 409 Conflict (`{ error: 'Submissions are closed for this event', submissionsClose: ... }`) when the deadline has passed.
   - Seeded event deadline is `2026-03-01T18:00:00.000Z` (in the past), so submissions are strictly refused with HTTP 409.

3. **`src/app/login/page.tsx`** (Client Component, 155 lines):
   - Interactive login form with email input, loading state, error alert banner, and return navigation.
   - Includes 4 quick-select buttons for seeded test accounts:
     - Organizer (`organizer@dogfood.dev`)
     - Judge A (`judge_a@dogfood.dev`)
     - Judge B (`judge_b@dogfood.dev`)
     - Participant (`participant@dogfood.dev`)
   - Performs `fetch('/api/auth/login', { method: 'POST', ... })` and on success navigates via `window.location.href = '/projects'`.

4. **`src/app/api/auth/login/route.ts`** (API Route Handler, 96 lines):
   - `export const dynamic = 'force-dynamic';`
   - Exports `POST(req: NextRequest)`.
   - Validates email format via Zod (`z.string().email().trim().toLowerCase()`).
   - Looks up user in `prisma.user.findUnique({ where: { email } })`. Returns HTTP 401 (`{ error: 'User with this email not found' }`) if user does not exist.
   - Retrieves active session (`prisma.session.findFirst({ where: { userId: user.id, expiresAt: { gt: new Date() } } })`) or generates a new UUID token in `prisma.session` with 30 days validity.
   - Dispatches `Set-Cookie: session=<token>; Path=/; HttpOnly; SameSite=lax; Max-Age=2592000` via `response.cookies.set()`.

5. **`.dogfood.toml`** (Repository root config, 17 lines):
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
   Uses actual database `userId` for Judge A: `user_jdg_a_01`.

---

### 1.2 Verification Tool Outputs

1. **TypeScript Typecheck (`npm run typecheck`)**:
   ```
   > dogfood@0.1.0 typecheck
   > tsc --noEmit
   [Exit code 0, 0 errors]
   ```

2. **Next.js Production Build (`npm run build`)**:
   ```
   Route (app)                              Size     First Load JS
   ┌ ○ /                                    5.35 kB        92.6 kB
   ├ ○ /_not-found                          873 B          88.1 kB
   ├ ƒ /api/auth/login                      0 B                0 B
   ├ ƒ /api/projects                        0 B                0 B
   ├ ○ /login                               17.3 kB         117 kB
   └ ƒ /projects                            196 B           100 kB
   + First Load JS shared by all            87.3 kB
     ├ chunks/117-62334802f2b9ec08.js       31.7 kB
     ├ chunks/fd9d1056-ebaa042f8a0e6807.js  53.6 kB
     └ other shared chunks (total)          1.89 kB

   ○  (Static)   prerendered as static content
   ƒ  (Dynamic)  server-rendered on demand
   [Exit code 0]
   ```

3. **ESLint (`npm run lint`)**:
   ```
   ✔ No ESLint warnings or errors
   [Exit code 0]
   ```

4. **Acceptance Checker Execution (`python Hack_docs/run.py .dogfood.toml`)**:
   ```
   DOGFOOD 2026 acceptance report
   portal: http://localhost:8080
   claimed: T1 T2
   fixtures: D:\TP\Hackathon\DogFood\Hack_docs\fixtures.json

   T1  gallery is public ................. PASS
   T1  project from fixtures shown ....... PASS
   T1  closed event refuses submissions .. PASS
   T2  judge sees own scores ............. FAIL
          GET http://localhost:8080/api/judge/scores
          sent as judge_a
          got 404, wanted 200
   T2  judge cannot see peer scores ...... FAIL
          GET http://localhost:8080/api/judge/scores?judge=user_jdg_a_01
          sent as judge_b; this is the url that returns judge_a's scores
          got 404, wanted 401 or 403
   T2  participant blocked ............... FAIL
          GET http://localhost:8080/api/judge/scores
          sent as participant
          got 404, wanted 401 or 403
   T2  csv export works .................. FAIL
          GET http://localhost:8080/api/export.csv
          sent as organizer
          got 404, wanted 200

   claimed T1 T2, verified T1
   note: claimed but not verified: T2
   ```

5. **Direct Login Endpoint Verification**:
   - `POST /api/auth/login` with `{"email": "participant@dogfood.dev"}`:
     - Returned HTTP 200
     - Header: `Set-Cookie: session=prt_seed_token_2026; Path=/; Expires=Tue, 27 Oct 2026 08:44:54 GMT; Max-Age=2592000; HttpOnly; SameSite=lax`
     - Body: `{"success":true,"user":{"id":"user_prt_01","email":"participant@dogfood.dev","name":"Participant","role":"participant"}}`
   - `POST /api/auth/login` with `{"email": "nonexistent@dogfood.dev"}`:
     - Returned HTTP 401
     - Body: `{"error":"User with this email not found"}`

6. **Direct Submission Rejection Verification**:
   - `POST /api/projects` with `Cookie: session=prt_seed_token_2026` and `{"title": "dogfood-late-submission-probe", "summary": "probe"}`:
     - Returned HTTP 409
     - Body: `{"error":"Submissions are closed for this event","submissionsClose":"2026-03-01T18:00:00.000Z","serverTime":"2026-09-27T08:44:45.734Z"}`

---

## 2. Logic Chain

1. **R1 Public Gallery:**
   - Observation 1.1 shows `src/app/projects/page.tsx` was implemented as a server component using `export const dynamic = 'force-dynamic'`.
   - The component queries `prisma.project.findMany` with `take: 40, orderBy: { id: 'asc' }`.
   - In SQLite, the first three projects are `prj_01` ("Glass Signal"), `prj_02` ("Small Meadow"), and `prj_03` ("Deep Compass").
   - By rendering them as direct text in `CardTitle`, the HTTP response body contains the plain text substrings required by `Hack_docs/run.py` lines 112–126.
   - Observation 1.2 (item 4) shows `T1 gallery is public` and `T1 project from fixtures shown` both report `PASS`.

2. **R2 Submission Close Check:**
   - Observation 1.1 shows `src/app/api/projects/route.ts` implements a `POST` handler with session authentication (`getSession(req)`), Zod validation, and deadline checking.
   - Since `event.submissionsClose` in `fixtures.json` was March 1, 2026, the current server time is past the deadline.
   - When a participant sends a submission probe, the server detects `closeTime < now` and returns HTTP 409.
   - `Hack_docs/run.py` lines 128–141 expects `400 <= status < 500`. HTTP 409 is within this range.
   - Observation 1.2 (item 4) confirms `T1 closed event refuses submissions` reports `PASS`.

3. **R3 Login Page & API:**
   - Observation 1.1 shows `src/app/login/page.tsx` and `src/app/api/auth/login/route.ts` implement email-based login without external providers.
   - Observation 1.2 (item 5) confirms that sending `participant@dogfood.dev` sets `Cookie: session=prt_seed_token_2026`, and unknown emails return 401.

4. **R4 Configuration Contract (`.dogfood.toml`):**
   - Observation 1.1 shows `.dogfood.toml` created with exact seeded tokens and `peer_scores = "/api/judge/scores?judge=user_jdg_a_01"`.
   - `Hack_docs/run.py` successfully loaded the file, executed all checks against the live server on port 8080, and verified `T1`.

---

## 3. Caveats

1. **T2 Claims in `.dogfood.toml`:**
   `.dogfood.toml` claims `["T1", "T2"]` per the prompt specification. Because Phase 3 (T2 Judging) is scheduled for the next milestone, `run.py` reports `note: claimed but not verified: T2` alongside `verified T1`. This is completely expected until Phase 3 implements `/api/judge/scores` and `/api/export.csv`.
2. **PowerShell 5.1 Cookie Header Handling:**
   When testing via PowerShell 5.1 CLI, `Invoke-WebRequest -Headers @{ Cookie = ... }` strips the raw cookie header unless configured through `New-Object Microsoft.PowerShell.Commands.WebRequestSession`. Testing with Python's standard `urllib` or browsers behaves normally.

---

## 4. Conclusion

Phase 2 (T1 Core) of DOGFOOD 2026 is fully implemented, strictly adheres to all architectural constraints and exclusive write boundaries, has zero TypeScript and ESLint errors, builds cleanly, and passes 100% of the T1 acceptance criteria in `Hack_docs/run.py`.

---

## 5. Verification Method

To independently reproduce and verify this milestone:

1. **Verify Compilation and Types:**
   ```powershell
   npm run typecheck
   npm run lint
   npm run build
   ```
   *Expected:* All three commands exit with code 0 without errors or warnings.

2. **Run Server:**
   ```powershell
   npm run start
   ```
   *Server listens on `http://localhost:8080`.*

3. **Run Acceptance Checker:**
   ```powershell
   python Hack_docs/run.py .dogfood.toml
   ```
   *Expected output:*
   ```
   T1  gallery is public ................. PASS
   T1  project from fixtures shown ....... PASS
   T1  closed event refuses submissions .. PASS
   ```

4. **Invalidation Conditions:**
   - Any modification that causes `GET /projects` to redirect to `/login` or require cookies.
   - Any modification that causes `POST /api/projects` to return 200/201 when submissions are closed.
   - Changing `peer_scores` in `.dogfood.toml` to anything other than `user_jdg_a_01`.
