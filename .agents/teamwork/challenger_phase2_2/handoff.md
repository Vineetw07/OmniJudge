# Adversarial Verification & Edge-Case Challenge Report (Phase 2)

**Agent**: `challenger_phase2_2`  
**Date**: 2026-09-27  
**Verdict**: **APPROVE with Findings**  

---

## 1. Observation

### 1.1 Acceptance Checker (`run.py`) Execution
Command executed:
```powershell
python d:\TP\Hackathon\DogFood\Hack_docs\run.py d:\TP\Hackathon\DogFood\.dogfood.toml
```
Verbatim stdout output:
```text
DOGFOOD 2026 acceptance report
portal: http://localhost:8080
claimed: T1 T2
fixtures: d:\TP\Hackathon\DogFood\Hack_docs\fixtures.json

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
All T1 checks pass:
- `T1 gallery is public`: PASS
- `T1 project from fixtures shown`: PASS
- `T1 closed event refuses submissions`: PASS

### 1.2 TypeScript Compiler & Build Verification
Command executed:
```powershell
npm run typecheck
```
Output:
```text
> dogfood@0.1.0 typecheck
> tsc --noEmit
```
Exited with return code `0`. Zero type errors detected.

### 1.3 Empirical Adversarial Test Suite Execution
A dedicated automated test harness (`d:\TP\Hackathon\DogFood\tests\test_phase2_adversarial.py`) containing 43 adversarial edge cases was executed directly against `http://localhost:8080`.

Command executed:
```powershell
python d:\TP\Hackathon\DogFood\tests\test_phase2_adversarial.py
```
Summary output:
```text
================================================================================
SUMMARY: Total: 43 | Passed: 43 | Failed: 0
================================================================================
```

### 1.4 Detailed Route-by-Route Observations

#### A. `GET /projects` (Public Project Gallery)
- **Public unauthenticated access**: Direct GET without Cookie or Authorization headers returned HTTP `200 OK` with header `content-type: text/html; charset=utf-8`.
- **Seeded fixture project titles presence**: The rendered HTML body contains the exact fixture titles:
  - `"Glass Signal"` (found verbatim at line 93 in CardTitle)
  - `"Small Meadow"` (found verbatim in CardTitle)
  - `"Deep Compass"` (found verbatim in CardTitle)
  - Total projects rendered: 40 (`Showing 40 projects`).
- **Case preservation**: Exact casing is maintained (`Glass Signal`, `Small Meadow`, `Deep Compass`).
- **Cookie handling**:
  - Request with valid participant cookie returned `200 OK`.
  - Request with corrupted/SQLi cookie (`session=' OR '1'='1; bad_cookie=###`) returned `200 OK` without error or 500 crash.
- **Query parameter fuzzing**:
  - Request with `?q=<script>alert(1)</script>&page=-1&foo=bar` returned `200 OK` safely.
- **Unbounded query prevention**:
  - In `src/app/projects/page.tsx`, lines 18-25:
    ```typescript
    const projects = await prisma.project.findMany({
      take: 40,
      orderBy: { id: 'asc' },
      include: { team: true, track: true },
    });
    ```
    Guarantees bounded query execution (`take: 40`).

#### B. `POST /api/projects` (Submission Endpoint & Deadline Enforcement)
- **Unauthenticated POST**:
  - Request: `POST /api/projects` without Cookie header.
  - Response: HTTP `401 Unauthorized`, body: `{"error":"Unauthorized: Valid session required"}`.
- **Invalid session token**:
  - Request: `Cookie: session=fake_invalid_token_999`.
  - Response: HTTP `401 Unauthorized`, body: `{"error":"Unauthorized: Valid session required"}`.
- **Empty session cookie value**:
  - Request: `Cookie: session=`.
  - Response: HTTP `401 Unauthorized`, body: `{"error":"Unauthorized: Valid session required"}`.
- **Role isolation (Judge A / Judge B)**:
  - Request: `Cookie: session=jdg_a_seed_token_2026`.
  - Response: HTTP `403 Forbidden`, body: `{"error":"Forbidden: Only participants or organizers may submit projects"}`.
  - Request: `Cookie: session=jdg_b_seed_token_2026`.
  - Response: HTTP `403 Forbidden`, body: `{"error":"Forbidden: Only participants or organizers may submit projects"}`.
- **Guard clause ordering**:
  - Unauthenticated with broken JSON: HTTP `401 Unauthorized` (auth checked before JSON parsing).
  - Judge with broken JSON: HTTP `403 Forbidden` (role checked before JSON parsing).
- **Malformed JSON payload (as participant)**:
  - Request: `POST /api/projects` with body `{title: broken json`.
  - Response: HTTP `400 Bad Request`, body: `{"error":"Invalid JSON payload"}`.
- **Schema validation failures (as participant)**:
  - Missing `title`: HTTP `400 Bad Request`, body: `{"error":"Validation failed","details":{"_errors":[],"title":{"_errors":["Title is required"]}}}`.
  - Empty string `title`: HTTP `400 Bad Request`, body: `{"error":"Validation failed","details":{"_errors":[],"title":{"_errors":["Title is required"]}}}`.
  - Missing `summary`: HTTP `400 Bad Request`, body: `{"error":"Validation failed","details":{"_errors":[],"summary":{"_errors":["Summary is required"]}}}`.
  - Invalid `repoUrl` (`"not-a-valid-url"`): HTTP `400 Bad Request`, body: `{"error":"Validation failed", ...}`.
- **Event deadline enforcement (Closed Event probe)**:
  - Request: Participant submitting valid body `{"title":"Adversarial Edge Project","summary":"Valid summary description"}`.
  - Response: HTTP `409 Conflict`, body:
    ```json
    {
      "error": "Submissions are closed for this event",
      "submissionsClose": "2026-03-01T18:00:00.000Z",
      "serverTime": "2026-09-27T08:49:46.289Z"
    }
    ```
  - Organizer submitting valid body also receives HTTP `409 Conflict`.
- **Non-existent eventId**:
  - Request: `eventId: "non_existent_event_99999"`.
  - Response: HTTP `404 Not Found`, body: `{"error":"Active hackathon event not found"}`.
- **Method constraints on API route**:
  - `PUT /api/projects` -> HTTP `405 Method Not Allowed`.
  - `DELETE /api/projects` -> HTTP `405 Method Not Allowed`.
  - `GET /api/projects` -> HTTP `200 OK` (returns public JSON list of projects).

#### C. `POST /api/auth/login` (Authentication Endpoint)
- **Malformed JSON**:
  - Request: body `{email: broken`.
  - Response: HTTP `400 Bad Request`, body: `{"error":"Invalid JSON payload"}`.
- **Missing or empty payload**:
  - Body `{}` or `{"username":"participant"}`: HTTP `400 Bad Request`, body: `{"error":"Valid email address is required"}`.
- **Invalid email formats**:
  - `"notanemail"`, `"user@"`, `"@domain.com"`, `"user name@domain.com"`, `"user@domain..com"`, `""`, `"   "`.
  - All return HTTP `400 Bad Request`, body: `{"error":"Valid email address is required"}`.
- **SQL injection strings**:
  - Email payload `"' OR '1'='1"` returns HTTP `400 Bad Request`.
- **Unknown email**:
  - Email `"nobody_exists_in_db_12345@dogfood.dev"` returns HTTP `401 Unauthorized`, body: `{"error":"User with this email not found"}`.
- **Valid test accounts login**:
  - `organizer@dogfood.dev` -> HTTP `200 OK`, `Set-Cookie: session=org_seed_token_2026; Path=/; Expires=...; Max-Age=2592000; HttpOnly; SameSite=lax`.
  - `judge_a@dogfood.dev` -> HTTP `200 OK`, `Set-Cookie: session=jdg_a_seed_token_2026; Path=/; Expires=...; Max-Age=2592000; HttpOnly; SameSite=lax`.
  - `judge_b@dogfood.dev` -> HTTP `200 OK`, `Set-Cookie: session=jdg_b_seed_token_2026; Path=/; Expires=...; Max-Age=2592000; HttpOnly; SameSite=lax`.
  - `participant@dogfood.dev` -> HTTP `200 OK`, `Set-Cookie: session=prt_seed_token_2026; Path=/; Expires=...; Max-Age=2592000; HttpOnly; SameSite=lax`.
- **Dynamic session creation**:
  - Seeded fixture judge `tomas.varga@example.org` (who has no pre-seeded session row) logged in successfully: HTTP `200 OK`, new dynamic UUID session generated and persisted in SQLite DB, returned in `Set-Cookie`.
- **Case insensitivity**:
  - `PARTICIPANT@DOGFOOD.DEV` -> HTTP `200 OK`, returns user `user_prt_01` with `participant@dogfood.dev`.
- **End-to-End session roundtrip**:
  - Session cookie obtained via `POST /api/auth/login` for `participant@dogfood.dev` was immediately reused on `POST /api/projects`. Returned HTTP `409 Conflict` (authenticated successfully, blocked by closed deadline), verifying that cookies issued by login authenticate requests.
  - Session cookie obtained for `judge_a@dogfood.dev` was reused on `POST /api/projects`. Returned HTTP `403 Forbidden` (role isolation strictly enforced).
- **Disallowed HTTP methods**:
  - `GET /api/auth/login` -> HTTP `405 Method Not Allowed`.

---

## 2. Logic Chain

1. **Premise 1 (Spec & Acceptance Compliance)**:
   - Acceptance criteria require `GET /projects` to return 200 without auth, rendering fixture project titles; `POST /api/projects` to reject unauthenticated requests with 401, reject non-participants with 403, reject malformed payloads with 400, and reject closed event submissions with 409; `POST /api/auth/login` to validate emails, reject unknown users with 401, and issue session cookies with 200.
2. **Premise 2 (Empirical Verification of Behavior)**:
   - In Section 1.1, the official `run.py` checker confirmed all three T1 checks pass without warnings or failures.
   - In Section 1.4, every required boundary condition and status code was directly triggered via raw HTTP requests and asserted against real response codes and JSON bodies.
3. **Premise 3 (Security & Boundary Robustness)**:
   - Authentication guards precede request body parsing, protecting against Denial-of-Service via large unauthenticated payloads.
   - SQL injection strings in cookies and JSON fields are neutralized by Prisma query parameterization and Zod parsing.
   - Session tokens are deterministic for seeded test accounts and dynamically UUID-generated for unseeded accounts, with appropriate `HttpOnly` and `SameSite=lax` cookie attributes.
4. **Premise 4 (Defect Identification & Isolation)**:
   - In `src/app/api/auth/login/route.ts` line 9, the Zod definition `z.string().email().trim().toLowerCase()` executes `.email()` before `.trim()`. This causes any direct API request with leading or trailing whitespace to fail with `400 Bad Request`.
   - On the web client (`src/app/login/page.tsx` line 38), the React form calls `email.trim()` before dispatching the fetch call, preventing browser users from encountering this defect.
   - Because this does not break the official acceptance checker, nor does it violate the core contract when valid emails are supplied, this finding does not warrant rejecting Phase 2, but must be reported as a defect to be addressed.
5. **Conclusion**:
   - The Phase 2 implementation satisfies all functional, security, and acceptance requirements. The verdict is **APPROVE with Findings**.

---

## 3. Caveats

1. **Zod Trimming Pipeline Defect in `POST /api/auth/login`**:
   - `src/app/api/auth/login/route.ts` line 9 specifies `z.string().email('Invalid email address').trim().toLowerCase()`.
   - Zod applies transformations and validations in left-to-right order. Because `.email()` executes prior to `.trim()`, an email like `"  participant@dogfood.dev  "` is rejected by `.email()` as an invalid email string.
   - **Recommended Fix for Worker**: Change line 9 to:
     ```typescript
     email: z.string().trim().email('Invalid email address').toLowerCase(),
     ```
2. **Page Route Verb Handling on `/projects`**:
   - Next.js App Router Page components (`page.tsx`) respond to any HTTP verb with the rendered page. Therefore, `POST /projects` or `PUT /projects` returns HTTP 200 with HTML rather than 405. The API route (`POST /api/projects`) properly enforces HTTP methods with 405.
3. **Scope Boundary**:
   - Routes under `/api/judge/*` and `/api/export.csv` (T2 / Phase 3) were not verified as part of this review, as they belong to Phase 3.

---

## 4. Conclusion

**Verdict: APPROVE with Findings**

The Phase 2 routes (`GET /projects`, `POST /api/projects`, `POST /api/auth/login`) are fully operational, performant, and pass all acceptance and adversarial criteria:
- `GET /projects`: Public, no auth required, exact fixture titles present, bounded DB query (`take: 40`).
- `POST /api/projects`: Strict guard clause ordering (401 unauthenticated -> 403 judge role -> 400 malformed JSON -> 400 schema validation -> 409 closed event deadline).
- `POST /api/auth/login`: Offline authentication, 400 on invalid format, 401 on unknown email, 200 with valid `Set-Cookie` returning deterministic seeded tokens for test users and dynamic tokens for fixture users.

---

## 5. Verification Method

To independently reproduce the entire test suite and verify all claims:

1. **Run the Official Acceptance Checker**:
   ```powershell
   python d:\TP\Hackathon\DogFood\Hack_docs\run.py d:\TP\Hackathon\DogFood\.dogfood.toml
   ```
   *Expected output*: `T1 gallery is public PASS`, `T1 project from fixtures shown PASS`, `T1 closed event refuses submissions PASS`.

2. **Run the Empirical Adversarial Suite (43 Tests)**:
   ```powershell
   python d:\TP\Hackathon\DogFood\tests\test_phase2_adversarial.py
   ```
   *Expected output*: `SUMMARY: Total: 43 | Passed: 43 | Failed: 0`.

3. **Verify Zod Whitespace Defect Reproduction**:
   ```powershell
   node -e "fetch('http://localhost:8080/api/auth/login', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email: ' participant@dogfood.dev '})}).then(async r => console.log('Status:', r.status, 'Body:', await r.json()))"
   ```
   *Expected output*: `Status: 400 Body: { error: 'Valid email address is required' }`.
