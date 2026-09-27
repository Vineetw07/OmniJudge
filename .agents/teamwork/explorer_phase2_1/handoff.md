# Handoff Report: T1 Checks Analysis & Orientation Protocol

## 1. Observation

### 1.1 Orientation Protocol Execution
- **PROGRESS.md Status**:
  `Get-Content "d:\TP\Hackathon\DogFood\PROGRESS.md"` confirms:
  - Phase 1 Foundation is fully complete (`[x]` for all 20 Phase 1 tasks).
  - Current phase: `Phase 2 — T1 Core (NOT STARTED)`.
  - Next task: `GET /projects public gallery page (server-rendered HTML, no auth required, shows all seeded project titles)`.
  - Blockers: Docker CLI path issue during Phase 1; GitHub remote pending.
- **Git State**:
  - `git log --oneline -10` outputs:
    - `2261de4 [FIX] Remove unused better-sqlite3 native build dependency and add .dockerignore`
    - `b41abd4 [PROGRESS] Phase 1 complete: schema, seed, auth, normalization, Docker written — Phase 2 T1 Core next`
    - `0e43906 [PROGRESS] Phase 1 complete: scaffold, schema, seed, auth, Docker, normalization — all verified`
  - `git status`: Branch `master` up to date with `origin/master`. Working tree clean apart from `.agents/teamwork/` metadata.
- **Source Code Tree (`src`)**:
  - `Get-ChildItem "d:\TP\Hackathon\DogFood\src" -Recurse -Name` confirms existing structure:
    - `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `app/fonts/`, `app/favicon.ico`
    - `components/ui/` with 15 shadcn components (avatar, badge, button, card, dialog, dropdown-menu, input, label, progress, select, separator, sheet, table, tabs, textarea)
    - `lib/auth.ts`, `lib/normalization.ts`, `lib/prisma.ts`, `lib/seed.ts`, `lib/utils.ts`
    - Neither `app/projects/page.tsx` nor `app/api/projects/route.ts` exists yet.
- **Database & Fixture Verification**:
  - `python -c "import sqlite3; con = sqlite3.connect('prisma/prisma/dogfood.db'); ..."`:
    - `Project count: 41`
    - First 3 project titles in DB: `[('Glass Signal',), ('Small Meadow',), ('Deep Compass',)]`
    - Event: `[('evt_01', 'Sample Hack 2026', 1772388000000)]` (1772388000000 ms corresponds to `2026-03-01T18:00:00.000Z`).
  - `npx tsx -e "import { prisma } from './src/lib/prisma'; ..."` confirms:
    - `prisma.project.count()` returns 41.
    - Test users and sessions present:
      - Organizer: ID `user_org_01`, Token `org_seed_token_2026`
      - Judge Alpha: ID `user_jdg_a_01`, Token `jdg_a_seed_token_2026`, track `trk_01`
      - Judge Beta: ID `user_jdg_b_01`, Token `jdg_b_seed_token_2026`, track `trk_02`
      - Participant: ID `user_prt_01`, Token `prt_seed_token_2026`

---

### 1.2 Verbatim Code in `Hack_docs/run.py` (T1 Suite & Helpers)

#### HTTP Request Engine (`Hack_docs/run.py:60-76`)
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

#### T1 Check 1: Gallery Public (`Hack_docs/run.py:102-110`)
```python
    c = Check("T1", "gallery is public")
    status, body = request(url("gallery"))
    c.ok = status == 200
    if not c.ok:
        c.note(f"GET {url('gallery')}")
        c.note("no auth header")
        c.note(f"got {status or 'no response'}, wanted 200")
    gallery_body = body
    checks.append(c)
```

#### T1 Check 2: Fixture Projects Shown (`Hack_docs/run.py:112-127`)
```python
    c = Check("T1", "project from fixtures shown")
    titles = fixture_titles(fixture)
    haystack = gallery_body.lower()
    c.ok = any(t.lower() in haystack for t in titles)
    if not c.ok:
        c.note(f"GET {url('gallery')}")
        if titles:
            c.note("looked for any of these fixture project titles: "
                   + ", ".join(repr(t) for t in titles))
            c.note("none of them appeared in the response body")
            c.note("if your gallery paginates, make sure page one is what "
                   "this route returns")
        else:
            c.note("no fixture file was loaded, so there was nothing to look for")
    checks.append(c)
```

#### Fixture Title Extraction (`Hack_docs/run.py:190-192`)
```python
def fixture_titles(fixture, n=3):
    projects = (fixture or {}).get("projects") or []
    return [p.get("title", "") for p in projects[:n] if p.get("title")]
```

#### T1 Check 3: Closed Event Refuses Submissions (`Hack_docs/run.py:128-141`)
```python
    c = Check("T1", "closed event refuses submissions")
    status, _ = request(
        url("submit"),
        header=auth.get("participant"),
        method="POST",
        body={"title": "dogfood-late-submission-probe", "summary": "probe"},
    )
    c.ok = 400 <= status < 500
    if not c.ok:
        c.note(f"POST {url('submit')}")
        c.note("sent as participant; the fixture event closed "
               f"{(fixture or {}).get('event', {}).get('submissions_close', 'in the past')}")
        c.note(f"got {status or 'no response'}, wanted 4xx")
    checks.append(c)
```

#### Config Parser (`Hack_docs/run.py:23-46`)
```python
def parse_toml(text):
    data, section = {}, None
    for raw in text.splitlines():
        line = raw.split("#")[0].strip()
        if not line:
            continue
        head = re.fullmatch(r"\[([A-Za-z0-9_.]+)\]", line)
        if head:
            section = data.setdefault(head.group(1), {})
            continue
        key, sep, value = line.partition("=")
        if not sep or section is None:
            continue
        key, value = key.strip(), value.strip()
        if value.startswith("["):
            items = re.findall(r'"([^"]*)"', value)
            section[key] = items
        else:
            section[key] = value.strip().strip('"').strip("'")
    return data
```

---

## 2. Logic Chain

### 2.1 Gallery Public Check Logic
1. **Endpoint Resolution**: Computed as `base_url + routes.gallery` (e.g. `http://localhost:8080/projects`).
2. **Request Attributes**:
   - HTTP Method: `GET`.
   - Headers: None (`header=None`). No cookies, authorization, or custom headers are transmitted.
   - Body: None.
3. **Validation Rule**: `status == 200`.
   - Any redirect (301, 302, 307, 308) fails because `status` will not equal 200 (redirects without follow or leading to a login challenge will report 3xx or 401).
   - Any auth challenge (401, 403) fails.
   - The response text is stored in `gallery_body` and must not be empty.

### 2.2 Gallery Project Name Check Logic
1. **Extraction Source**: `fixture_titles(fixture, n=3)` inspects `fixtures.json` key `projects` slice `[:3]`.
   - First 3 titles in `Hack_docs/fixtures.json`:
     1. `"Glass Signal"`
     2. `"Small Meadow"`
     3. `"Deep Compass"`
2. **Matching Mechanism**:
   - Converts the stored `gallery_body` to lowercase: `haystack = gallery_body.lower()`.
   - Performs a substring search: `any(t.lower() in haystack for t in titles)`.
   - The test passes if `"glass signal"`, `"small meadow"`, OR `"deep compass"` appears as a verbatim substring anywhere in the HTML response.
3. **Server-Rendering Implication**:
   - `urllib.request` performs a raw HTTP socket read without executing client JavaScript or hydration.
   - Therefore, the project titles must be included in the server-rendered HTML payload generated by Next.js Server Components. A client-side `useEffect` fetch will fail this check because the initial HTML will lack the project titles.

### 2.3 Closed Event Submission Refusal Check Logic
1. **Endpoint Resolution**: Computed as `base_url + routes.submit` (e.g. `http://localhost:8080/api/projects`).
2. **Request Attributes**:
   - HTTP Method: `POST`.
   - Headers:
     - `auth.get("participant")` -> parsed via `header.partition(":")` to `Cookie: session=prt_seed_token_2026`.
     - `Content-Type: application/json` (automatically attached when `body is not None`).
   - Request Body: `{"title": "dogfood-late-submission-probe", "summary": "probe"}` (JSON stringified).
3. **Validation Rule**:
   - `400 <= status < 500`.
   - The check passes on any HTTP 4xx client error status code (e.g., 400, 403, 409, 422).
4. **Domain Rule**:
   - `Event.submissionsClose` in fixtures is `2026-03-01T18:00:00Z` (timestamp `1772388000000`).
   - The current server timestamp is strictly greater than `submissionsClose`.
   - The submission API route must compare `event.submissionsClose < new Date()`.
   - If closed, it must immediately refuse the submission with HTTP `409 Conflict` (or `403 Forbidden`).
   - Returning `200`, `201`, `3xx`, or `500` will fail the check.

### 2.4 Configuration Expectations from `.dogfood.toml`
1. **File Location**: Root of repository (`d:\TP\Hackathon\DogFood\.dogfood.toml`).
2. **Parser Constraints**:
   - Handled by `parse_toml(text)` (fallback regex) or `tomllib`.
   - Supports sections `[section]`, string key-values `key = "value"`, and list of strings `key = ["a", "b"]`.
   - Keys must not have trailing inline comments on the same line if using the custom parser without `#` separation.
3. **Required Table Schema**:
   - `[portal]`:
     - `base_url = "http://localhost:8080"`
   - `[tiers]`:
     - `claimed = ["T1"]` (or `["T1", "T2"]` depending on current milestone claim)
     - `pitch = "Self-hostable hackathon submission and judging platform..."`
   - `[auth]`:
     - `organizer   = "Cookie: session=org_seed_token_2026"`
     - `judge_a     = "Cookie: session=jdg_a_seed_token_2026"`
     - `judge_b     = "Cookie: session=jdg_b_seed_token_2026"`
     - `participant = "Cookie: session=prt_seed_token_2026"`
   - `[routes]`:
     - `gallery      = "/projects"` (Must have leading `/` because `url(key)` concatenates `base + routes.get(key)`)
     - `submit       = "/api/projects"` (Must have leading `/`)
     - `judge_scores = "/api/judge/scores"`
     - `peer_scores  = "/api/judge/scores?judge=user_jdg_a_01"`
     - `csv_export   = "/api/export.csv"`

---

## 3. Caveats
1. **Pagination**:
   - If the gallery page implements pagination, page 1 must include at least one of the first 3 fixture projects (`Glass Signal`, `Small Meadow`, `Deep Compass`). For Phase 2, querying `prisma.project.findMany({ take: 40 })` in default insertion order guarantees all 3 appear on the gallery page.
2. **Trailing Slashes on Routes**:
   - In `run.py`, `base = cfg["portal"]["base_url"].rstrip("/")`, and `url(key)` is `base + routes.get(key, "")`. If any route in `.dogfood.toml` lacks a leading slash (e.g. `gallery = "projects"`), the URL resolves to `http://localhost:8080projects`, causing a 404 failure.
3. **Claimed Tiers Discipline**:
   - `run.py` verifies tiers hierarchically: `solid` only includes a tier if all tiers before it also passed. If `claimed` includes `"T2"`, but T2 endpoints return 404 (not yet implemented in Phase 2), `run.py` outputs `note: claimed but not verified: T2`. Setting `claimed = ["T1"]` during Phase 2 testing gives a completely clean report (`claimed T1, verified T1`).
4. **Session Token Expiration**:
   - Seeded sessions are set to expire 1 year from seed date (`2027-09-27T08:21:28.613Z`), so active tokens will remain valid throughout local testing.

---

## 4. Conclusion
The requirements for passing T1 acceptance checks in `Hack_docs/run.py` are completely mapped:
1. **Public Gallery (`GET /projects`)**: Next.js Server Component at `src/app/projects/page.tsx` querying `prisma.project.findMany({ take: 40 })`, returning HTTP 200 without auth, rendering titles including "Glass Signal", "Small Meadow", and "Deep Compass" as plain text in the HTML.
2. **Submission Rejection (`POST /api/projects`)**: Next.js API Route at `src/app/api/projects/route.ts` requiring participant session, querying `prisma.event.findFirst()`, detecting `event.submissionsClose < new Date()`, and returning HTTP `409 Conflict` (or `403 Forbidden`).
3. **Configuration (`.dogfood.toml`)**: Repository root TOML file specifying `base_url`, `claimed = ["T1"]`, four deterministic `Cookie: session=...` tokens from `src/lib/seed.ts`, and exact routes with leading slashes (`/projects`, `/api/projects`).

---

## 5. Verification Method

### 5.1 Verification Commands (PowerShell 5.1)
```powershell
# 1. Typecheck the repository
npm run typecheck

# 2. Start the dev server in the background or separate shell
npm run dev

# 3. Create .dogfood.toml with T1 claims and run the acceptance checker
python "d:\TP\Hackathon\DogFood\Hack_docs\run.py" "d:\TP\Hackathon\DogFood\.dogfood.toml"
```

### 5.2 Direct HTTP Checks
```powershell
# Gallery Public Check
$resp = Invoke-WebRequest -Uri "http://localhost:8080/projects" -UseBasicParsing
$resp.StatusCode # Must equal 200
$resp.Content -match "Glass Signal|Small Meadow|Deep Compass" # Must return True

# Closed Event Submission Refusal Check
$headers = @{ "Cookie" = "session=prt_seed_token_2026" }
$body = '{"title":"dogfood-late-submission-probe","summary":"probe"}'
try {
    Invoke-RestMethod -Uri "http://localhost:8080/api/projects" -Method Post -Headers $headers -ContentType "application/json" -Body $body
} catch {
    $_.Exception.Response.StatusCode.value__ # Must be in range 400..499 (e.g. 409 or 403)
}
```

### 5.3 Invalidation Conditions
- `GET /projects` returns HTTP 302/307 redirecting to `/login` or returns 401/403.
- `GET /projects` returns client-rendered DOM where project titles are absent from raw HTML.
- `POST /api/projects` accepts the submission or returns HTTP 200/201.
- `POST /api/projects` fails with HTTP 500 (Internal Server Error) due to uncaught exception.
- `.dogfood.toml` routes omit leading `/`.
