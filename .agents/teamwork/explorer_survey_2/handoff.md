# Acceptance Checker & RBAC Boundary Investigation Report (Phase 3 T2 Judging)

## 1. Observation

### 1.1 Acceptance Checker Suite (`Hack_docs/run.py`)
Investigation of `d:\TP\Hackathon\DogFood\Hack_docs\run.py` reveals the execution flow and exact mechanics of each acceptance test:

#### Network & Request Engine (`run.py:60-76`)
```python
def request(url, header=None, method="GET", body=None):
    """Return (status, text). Never raises on an HTTP error status."""
    req = urllib.request.Request(url, method=method)
    if header:
        name, _, value = header.partition(":")
        req.add_header(name.strip(), value.strip())
    if body is not None:
        req.data = json.dumps(body).encode()
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except Exception as e:
        return 0, f"{type(e).__name__}: {e}"
```
- Timeout: `TIMEOUT = 10` seconds (`run.py:57`).
- Single Header: Only ONE header can be attached via `header.partition(":")`.
- Error Handling: `urllib.error.HTTPError` is caught and returns `(e.code, body)`. Uncaught network/connection errors return `(0, error_message)`.
- Body Decoding: Responses are decoded as UTF-8 with replacement: `resp.read().decode("utf-8", "replace")`.

#### Detailed Check Mechanics (`run.py:91-187`)

1. **`check_t1_gallery` ("gallery is public", lines 102-110)**:
   ```python
   c = Check("T1", "gallery is public")
   status, body = request(url("gallery"))
   c.ok = status == 200
   gallery_body = body
   ```
   - Target URL: `base + routes.get("gallery", "")` (`http://localhost:8080/projects`).
   - Method: `GET`.
   - Headers: None (`header=None`).
   - Expected Status: `status == 200`.
   - Side Effect: Stores HTML response in `gallery_body` for subsequent test.

2. **`check_t1_fixtures` ("project from fixtures shown", lines 112-126)**:
   ```python
   c = Check("T1", "project from fixtures shown")
   titles = fixture_titles(fixture)
   haystack = gallery_body.lower()
   c.ok = any(t.lower() in haystack for t in titles)
   ```
   - No HTTP Request: Directly inspects `gallery_body` obtained during `check_t1_gallery`.
   - Fixture Titles: `fixture_titles(fixture, n=3)` (lines 190-192) extracts first 3 titles from `Hack_docs/fixtures.json`: `"Glass Signal"`, `"Small Meadow"`, `"Deep Compass"`.
   - Match Condition: Case-insensitive substring search in `gallery_body.lower()`. At least one title must be present in the raw HTML.

3. **`check_t1_closed` ("closed event refuses submissions", lines 128-141)**:
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
   - Target URL: `base + routes.get("submit", "")` (`http://localhost:8080/api/projects`).
   - Method: `POST`.
   - Headers: `Cookie: session=prt_seed_token_2026` and `Content-Type: application/json`.
   - Payload: `{"title": "dogfood-late-submission-probe", "summary": "probe"}`.
   - Expected Status: `400 <= status < 500` (any 4xx status code; our implementation returns `409 Conflict`).

4. **`check_t2_own_scores` ("judge sees own scores", lines 144-151)**:
   ```python
   c = Check("T2", "judge sees own scores")
   status, _ = request(url("judge_scores"), header=auth.get("judge_a"))
   c.ok = status == 200
   ```
   - Target URL: `base + routes.get("judge_scores", "")` (`http://localhost:8080/api/judge/scores`).
   - Method: `GET`.
   - Headers: `Cookie: session=jdg_a_seed_token_2026`.
   - Expected Status: `status == 200`.
   - Response Parsing: Response body is ignored (`_`) in `run.py`.

5. **`check_t2_peer_scores` ("judge cannot see peer scores", lines 153-163)**:
   ```python
   c = Check("T2", "judge cannot see peer scores")
   probe = base + routes.get("peer_scores", routes.get("judge_scores", ""))
   status, _ = request(probe, header=auth.get("judge_b"))
   c.ok = status in (401, 403)
   ```
   - Target URL: `base + routes.get("peer_scores", ...)` (`http://localhost:8080/api/judge/scores?judge=user_jdg_a_01`).
   - Method: `GET`.
   - Headers: `Cookie: session=jdg_b_seed_token_2026` (Judge Beta).
   - Expected Status: `status in (401, 403)` (403 Forbidden is required for authenticated peer isolation).

6. **`check_t2_participant` ("participant blocked", lines 165-172)**:
   ```python
   c = Check("T2", "participant blocked")
   status, _ = request(url("judge_scores"), header=auth.get("participant"))
   c.ok = status in (401, 403)
   ```
   - Target URL: `base + routes.get("judge_scores", "")` (`http://localhost:8080/api/judge/scores`).
   - Method: `GET`.
   - Headers: `Cookie: session=prt_seed_token_2026` (Participant).
   - Expected Status: `status in (401, 403)` (403 Forbidden for non-judge).

7. **`check_t2_csv` ("csv export works", lines 174-185)**:
   ```python
   c = Check("T2", "csv export works")
   status, body = request(url("csv_export"), header=auth.get("organizer"))
   first_line = body.splitlines()[0] if body.splitlines() else ""
   c.ok = status == 200 and "," in first_line
   ```
   - Target URL: `base + routes.get("csv_export", "")` (`http://localhost:8080/api/export.csv`).
   - Method: `GET`.
   - Headers: `Cookie: session=org_seed_token_2026` (Organizer).
   - Expected Status: `status == 200`.
   - Content Validation: `body.splitlines()[0]` must contain at least one comma `,`.
   - Content-Type: `run.py` does not inspect the `Content-Type` header, but project spec R3 requires `Content-Type: text/csv; charset=utf-8`.

#### Verification & Tier Gating (`run.py:245-254`)
```python
verified = [t for t in TIERS
            if any(c.tier == t for c in checks)
            and all(c.ok for c in checks if c.tier == t)]
# a tier only counts if every tier below it also passed
solid = []
for t in TIERS:
    if t in verified:
        solid.append(t)
    else:
        break
```
- Cascading Tier Gate: T2 is ONLY marked verified if all T1 checks pass AND all T2 checks pass. A single failure in T1 drops verified output to "verified nothing".

---

### 1.2 Configuration (`d:\TP\Hackathon\DogFood\.dogfood.toml`)
Inspection of `.dogfood.toml`:
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

### 1.3 Database & Seed Identity Verification
Verification of `src/lib/seed.ts` (lines 10-39) and direct SQLite DB query via Prisma:
- `TEST_USERS[1]`:
  - `id`: `'user_jdg_a_01'`
  - `email`: `'judge_a@dogfood.dev'`
  - `name`: `'Judge Alpha'`
  - `role`: `'judge'`
  - `token`: `'jdg_a_seed_token_2026'`
- Direct DB query confirmed:
  `prisma.user.findUnique({ where: { email: 'judge_a@dogfood.dev' } })` returned:
  ```json
  {
    "id": "user_jdg_a_01",
    "email": "judge_a@dogfood.dev",
    "name": "Judge Alpha",
    "role": "judge"
  }
  ```
- Result: The route `peer_scores = "/api/judge/scores?judge=user_jdg_a_01"` EXACTLY matches judge_a's actual DB user ID.

---

## 2. Logic Chain

1. **RBAC Boundary Architecture**:
   - `check_t2_own_scores` accesses `/api/judge/scores` using `judge_a` credentials. The handler must authenticate the user via session cookie `session=jdg_a_seed_token_2026`, verify `role === 'judge'`, and return 200 with the judge's assigned projects and submitted scores.
   - `check_t2_peer_scores` probes `/api/judge/scores?judge=user_jdg_a_01` using `judge_b` credentials (`session=jdg_b_seed_token_2026`).
   - The handler at `/api/judge/scores` must inspect `req.nextUrl.searchParams.get('judge')`.
   - If `requestedJudgeId` is present and does not equal `sessionUser.id`, it MUST immediately return HTTP `403 Forbidden`.
   - Even if `judge_b` is an authenticated judge, cross-judge score inspection is prohibited to prevent score anchoring / bias leakage.
   - If `sessionUser.role !== 'judge'`, it must return `403 Forbidden` (`check_t2_participant`).
   - If no valid session exists, return `401 Unauthorized`.

2. **CSV Export Endpoint Requirements**:
   - `check_t2_csv` accesses `/api/export.csv` with `organizer` credentials (`session=org_seed_token_2026`).
   - The handler must verify `sessionUser.role === 'organizer' || sessionUser.role === 'admin'`. Non-organizers (participants, judges, visitors) must be rejected with `403 Forbidden`.
   - The response must have HTTP 200 status.
   - `run.py` splits the response body by line and checks `"," in first_line`.
   - The response must NOT have leading blank lines or comments on line 1.
   - Line 1 must be a valid CSV header row containing commas, e.g.:
     `project_id,project_title,track,raw_score,normalized_score,rank`
   - Spec requirement R3 requires header `Content-Type: text/csv; charset=utf-8`.
   - Normalization must use MAD (`normaliseJudgeScores` from `src/lib/normalization.ts`) to handle zero-variance judges (e.g. `jdg_30`, Rafa Okonkwo) without divide-by-zero errors.

3. **Acceptance Suite Execution Invariants**:
   - All tests run against `base_url` (`http://localhost:8080`).
   - `run.py` sends only one HTTP header per request (the `Cookie` string). No `Authorization: Bearer` headers are used.
   - The server must run on port 8080.
   - Because `check_t1_fixtures` analyzes raw HTML from `check_t1_gallery`, server-side rendering is strictly mandatory.

---

## 3. Caveats

1. **Server Liveness Dependency**:
   When testing `run.py`, the Next.js server (`next dev -p 8080` or `next start -p 8080`) must be actively listening on port 8080. If the server is offline, requests hang for 10 seconds per check (70 seconds total) before failing with `got no response`.
2. **`run.py` Loose vs Spec Strictness**:
   `run.py` does not parse the JSON structure of `/api/judge/scores` or verify the `Content-Type` header of `/api/export.csv`. However, project specifications (R1, R2, R3 in `ORIGINAL_REQUEST.md`) require strict Zod validation, AuditLog insertion, and RFC-compliant CSV headers with UTF-8 encoding. Implementations must follow the stricter specification.
3. **Empty Database / Re-seeding**:
   If the database is reset without running `npm run seed`, `user_jdg_a_01` and the test tokens will not exist, causing 401 failures on all authenticated checks.

---

## 4. Conclusion

1. **Checker Suitability**: `Hack_docs/run.py` is a zero-dependency standard-library script that enforces 3 T1 checks and 4 T2 checks sequentially. All checks rely exclusively on single `Cookie` headers and status code comparisons, except the CSV export which validates a comma on line 1.
2. **Config Alignment**: `.dogfood.toml` is correctly configured:
   - `peer_scores = "/api/judge/scores?judge=user_jdg_a_01"` exactly matches `judge_a`'s seeded DB user ID (`user_jdg_a_01`).
   - Deterministic test session tokens match DB seed entries.
3. **Implementation Blueprint for Phase 3**:
   - Implement `src/app/api/judge/scores/route.ts`:
     - `GET`: Authenticate session. Reject non-judges with 403. Check `?judge=` query param; if present and `!== session.id`, return 403. Otherwise return judge's scores (200).
     - `POST`: Authenticate judge. Validate score payload with Zod. Verify track assignment. Upsert score. Record `AuditLog` entry. Return 201/200.
   - Implement `src/app/api/export.csv/route.ts`:
     - `GET`: Authenticate session. Reject non-organizers with 403. Query all projects, tracks, rubric criteria, and scores. Apply MAD normalization via `src/lib/normalization.ts`. Return CSV with header on line 1 and `Content-Type: text/csv; charset=utf-8` (200).

---

## 5. Verification Method

To independently verify the acceptance checker and configuration:

1. **Verify Database IDs**:
   ```powershell
   node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); async function check() { const u = await prisma.user.findUnique({ where: { email: 'judge_a@dogfood.dev' } }); console.log(u); await prisma.\`$disconnect(); } check();"
   ```
   *Expected Output*: `{ id: 'user_jdg_a_01', email: 'judge_a@dogfood.dev', role: 'judge', ... }`

2. **Verify .dogfood.toml Query Parameter**:
   Inspect `.dogfood.toml` line 18:
   `peer_scores = "/api/judge/scores?judge=user_jdg_a_01"`

3. **Verify Full Checker Run (when server is running on port 8080)**:
   ```powershell
   python Hack_docs\run.py .dogfood.toml
   ```
   *Expected Output upon Phase 3 completion*:
   ```
   DOGFOOD 2026 acceptance report
   portal: http://localhost:8080
   claimed: T1 T2
   fixtures: ...\fixtures.json

   T1  gallery is public ................. PASS
   T1  project from fixtures shown ....... PASS
   T1  closed event refuses submissions .. PASS
   T2  judge sees own scores ............. PASS
   T2  judge cannot see peer scores ...... PASS
   T2  participant blocked ............... PASS
   T2  csv export works .................. PASS

   claimed T1 T2, verified T1 T2
   ```
4. **Invalidation Condition**:
   If `peer_scores` in `.dogfood.toml` uses an ID other than `user_jdg_a_01`, or if `/api/judge/scores` fails to return 403 on mismatched judge query params, `check_t2_peer_scores` will fail.
