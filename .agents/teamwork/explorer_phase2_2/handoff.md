# Investigation Handoff Report: Auth Helpers, Database State, Login Requirements & .dogfood.toml Specifications

**Agent:** explorer_phase2_2  
**Date:** 2026-09-27  
**Working Directory:** `d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_phase2_2`  
**Target:** Implementation of Phase 2 (T1 Core) Auth, Gallery, Submissions, and Config

---

## 1. Observation

### 1.1 Session Model and Existing Auth Helper (`src/lib/auth.ts`)
- **File:** `d:\TP\Hackathon\DogFood\src\lib\auth.ts`
- **Lines 8–14:**
  ```typescript
  export type SessionUser = {
    id: string;
    email: string;
    name: string;
    role: 'visitor' | 'participant' | 'judge' | 'organizer' | 'admin';
    judgeId?: string;
  };
  ```
- **Lines 24–48 (`getSession`):**
  - Cookie name: `'session'` read from `req.cookies.get('session')` (line 26) with fallback to raw `req.headers.get('cookie')` parsed with regex `/(?:^|;\s*)session=([^;]+)/` (lines 54–58).
  - Database Query: `prisma.session.findUnique({ where: { id: token }, include: { user: true } })` (lines 31–34).
  - Expiration Validation: `if (session.expiresAt < new Date()) return null;` (line 37).
  - Judge ID attribution: `judgeId: role === 'judge' ? session.user.id : undefined` (line 46).
  - Helper functions exported (lines 63–73): `isOrganizer(user)`, `isJudge(user)`, `isParticipant(user)`.

### 1.2 Database Schema for Sessions & Users (`prisma/schema.prisma`)
- **File:** `d:\TP\Hackathon\DogFood\prisma\schema.prisma`
- **Lines 13–25 (`User`):**
  ```prisma
  model User {
    id        String   @id @default(cuid())
    email     String   @unique
    name      String
    role      String   // "visitor" | "participant" | "judge" | "organizer" | "admin"
    createdAt DateTime @default(now())
    sessions         Session[]
    teamMember       TeamMember?
    judgeAssignments JudgeAssignment[]
    scores           Score[]
    auditLogs        AuditLog[]
  }
  ```
- **Lines 27–33 (`Session`):**
  ```prisma
  model Session {
    id        String   @id // the token itself is the primary key
    userId    String
    user      User     @relation(fields: [userId], references: [id])
    createdAt DateTime @default(now())
    expiresAt DateTime
  }
  ```

### 1.3 Database State and Seed Records (`src/lib/seed.ts` & SQLite DB)
- **Direct Database Query Output (`prisma/dogfood.db` via tsx / Prisma Client):**
  - Model counts:
    - `User`: 34 (30 fixture judges + 4 test users)
    - `Session`: 4
    - `Event`: 1 (`evt_01`, name: "Sample Hack 2026", `submissionsClose`: 2026-03-01T18:00:00.000Z)
    - `Track`: 8 (`trk_01` to `trk_08`)
    - `Team`: 40
    - `Project`: 41 (titles include `prj_01`: "Glass Signal", `prj_02`: "Small Meadow", `prj_03`: "Deep Compass")
    - `RubricCriterion`: 4 (`functionality`, `quality`, `creativity`, `presentation`)
    - `JudgeAssignment`: 41 (39 fixture judge assignments + 2 test judge assignments)
    - `Score`: 252
  - Exact Test User and Session Records:
    ```json
    [
      {
        "id": "user_org_01",
        "email": "organizer@dogfood.dev",
        "name": "Organizer",
        "role": "organizer",
        "token": "org_seed_token_2026",
        "expiresAt": "2027-09-27T08:21:28.613Z"
      },
      {
        "id": "user_jdg_a_01",
        "email": "judge_a@dogfood.dev",
        "name": "Judge Alpha",
        "role": "judge",
        "token": "jdg_a_seed_token_2026",
        "expiresAt": "2027-09-27T08:21:28.613Z",
        "trackAssignment": "trk_01"
      },
      {
        "id": "user_jdg_b_01",
        "email": "judge_b@dogfood.dev",
        "name": "Judge Beta",
        "role": "judge",
        "token": "jdg_b_seed_token_2026",
        "expiresAt": "2027-09-27T08:21:28.613Z",
        "trackAssignment": "trk_02"
      },
      {
        "id": "user_prt_01",
        "email": "participant@dogfood.dev",
        "name": "Participant",
        "role": "participant",
        "token": "prt_seed_token_2026",
        "expiresAt": "2027-09-27T08:21:28.613Z"
      }
    ]
    ```

### 1.4 Judge A Identity Resolution
- In `d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md` line 547:
  `"IMPORTANT: peer_scores must use the actual DB userId of the judge_a user (from prisma.user.findUnique({ where: { email: 'jdg_a@example.com' } })). The checker visits this URL as judge_b expecting a 403. Read src/lib/seed.ts to find the exact email used for judge_a."`
- Direct inspection of `src/lib/seed.ts` (lines 19–24) and database query confirms:
  - Exact email: `judge_a@dogfood.dev` (not `jdg_a@example.com`)
  - Exact user ID: `user_jdg_a_01`
  - Exact session token: `jdg_a_seed_token_2026`

### 1.5 Checker (`Hack_docs/run.py`) Execution Expectations
- **Config parser:** Standard library only, parses `[portal]`, `[tiers]`, `[auth]`, and `[routes]`.
- **T1 checks executed by `run.py`:**
  1. `GET {base_url}{routes['gallery']}` with no auth header must return `200`.
  2. The response body must contain at least one fixture title from `fixture_titles` (`"glass signal"`, `"small meadow"`, `"deep compass"`).
  3. `POST {base_url}{routes['submit']}` sent with `auth['participant']` header (`Cookie: session=prt_seed_token_2026`) and JSON body `{"title": "dogfood-late-submission-probe", "summary": "probe"}` must return HTTP status `400 <= status < 500` (e.g. `409` or `403`).
- **T2 peer check in `run.py` (lines 154–164):**
  - Visits `probe = base + routes.get("peer_scores", ...)` using header `auth['judge_b']` (`Cookie: session=jdg_b_seed_token_2026`).
  - Expects status `401` or `403`.

---

## 2. Logic Chain

1. **Session Handling & Cookie Interoperability:**
   - `src/lib/auth.ts` extracts the session token either from the standard Next.js cookie jar (`req.cookies.get('session')`) or by scanning `req.headers.get('cookie')` with regex.
   - Because the acceptance checker `Hack_docs/run.py` attaches headers formatted as `Cookie: session=<token>`, this dual extraction ensures full compatibility with both browser clients and CLI checker requests.
   - In `schema.prisma`, `Session.id` is the session token string. The lookup `prisma.session.findUnique({ where: { id: token }, include: { user: true } })` is a single indexed primary key query.

2. **Login Implementation (`POST /api/auth/login`):**
   - R3 requires accepting `email` in the JSON request body, querying the user in the SQLite DB, and setting `Cookie: session=<token>`.
   - If the user does not exist in the database, return HTTP `401` (`{ "error": "User not found" }`).
   - If the user exists:
     - Check for an existing unexpired session (`prisma.session.findFirst({ where: { userId: user.id, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } })`).
     - For test users (`judge_a`, `organizer`, etc.), their deterministic token (e.g. `jdg_a_seed_token_2026`) is retrieved and reused.
     - For any other seeded user (e.g. fixture judges `jdg_01` to `jdg_30`) who do not yet have an active session row, generate a new UUID token (`crypto.randomUUID()`) with `expiresAt: new Date(Date.now() + 30 * 86400000)` and persist it into `prisma.session`.
     - Attach the cookie to `NextResponse` using `response.cookies.set({ name: 'session', value: token, httpOnly: true, path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 30 * 86400000 })`.

3. **Submissions Route (`POST /api/projects`):**
   - The route must authenticate the caller via `getSession(req)`. If absent or not participant/organizer, return `401`.
   - Validate body with Zod (`title` and `summary` strings).
   - Query event: `const event = await prisma.event.findFirst()`.
   - Check `event.submissionsClose < new Date()`. In our database, `submissionsClose` is `2026-03-01T18:00:00.000Z`, which is strictly in the past.
   - Return HTTP `409` (Conflict) or `403` (Forbidden) when closed. This satisfies `run.py` line 135 (`400 <= status < 500`).

4. **Public Gallery Route (`GET /projects`):**
   - Must be a Next.js Server Component at `src/app/projects/page.tsx`.
   - No authentication guards; returns HTTP `200`.
   - Queries `prisma.project.findMany({ take: 40, include: { team: true, track: true }, orderBy: { id: 'asc' } })`.
   - Renders project titles clearly in the HTML stream (e.g., in `<h3>` cards) so that `"Glass Signal"`, `"Small Meadow"`, and `"Deep Compass"` appear as verbatim plain text in the raw HTML response.

5. **Exact `.dogfood.toml` Configuration:**
   - The route `peer_scores` requires the actual judge A user ID.
   - We observed `user_jdg_a_01` in the database.
   - Therefore, `peer_scores = "/api/judge/scores?judge=user_jdg_a_01"`.

---

## 3. Caveats

1. **Phase 2 vs. Phase 3 Claimed Tiers:**
   - In `Hack_docs/example.dogfood.toml`, `claimed = ["T1", "T2"]` is shown.
   - However, Phase 2 implements only T1 Core (`/projects`, `/api/projects`, `/login`).
   - If `claimed = ["T1", "T2"]` is configured before Phase 3 is implemented, `run.py` will report:
     `note: claimed but not verified: T2` (because `/api/judge/scores` and `/api/export.csv` will return 404).
   - Setting `claimed = ["T1"]` during Phase 2 testing yields `claimed T1, verified T1` with zero failures. Once Phase 3 is implemented, update to `claimed = ["T1", "T2"]`.
2. **Fixture Project Count:**
   - `fixtures.json` actually contains 41 projects (`prj_01` through `prj_41`), despite some spec text referencing "40 projects".
   - `take: 40` in `findMany()` will safely return the first 40 projects (including `prj_01` to `prj_03` which contain the required title strings).
3. **Session Expiry Timezone Handling:**
   - SQLite stores timestamps without explicit timezone offsets in some drivers. Prisma handles this by casting to UTC `Date`. All comparisons must use standard JS `new Date()` vs. `session.expiresAt`.

---

## 4. Conclusion

### Exact Specifications for Phase 2 Implementation

#### 1. `.dogfood.toml` (Place at `d:\TP\Hackathon\DogFood\.dogfood.toml`)
```toml
[portal]
base_url = "http://localhost:8080"

[tiers]
claimed = ["T1"]
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
*(Note: To claim T2 early for preview, change `claimed = ["T1", "T2"]`).*

#### 2. Auth Login API (`src/app/api/auth/login/route.ts`)
- **Method:** `POST`
- **Body Schema:**
  ```typescript
  import { z } from 'zod';
  const loginSchema = z.object({
    email: z.string().email(),
  });
  ```
- **Behavior:**
  - Parse body with Zod; return 400 if invalid.
  - `const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })`.
  - If `!user`: return `NextResponse.json({ error: 'User not found' }, { status: 401 })`.
  - Check existing valid session:
    ```typescript
    let session = await prisma.session.findFirst({
      where: { userId: user.id, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!session) {
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      session = await prisma.session.create({
        data: { id: token, userId: user.id, expiresAt },
      });
    }
    ```
  - Set cookie:
    ```typescript
    const res = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
    res.cookies.set({
      name: 'session',
      value: session.id,
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60,
    });
    return res;
    ```

#### 3. Submissions API (`src/app/api/projects/route.ts`)
- **Method:** `POST`
- **Behavior:**
  - `const user = await getSession(req);`
  - If `!user || user.role !== 'participant'`: return `NextResponse.json({ error: 'Unauthorized' }, { status: 401 })`.
  - Body validation with Zod: `{ title: z.string().min(1), summary: z.string().min(1) }`.
  - Query event: `const event = await prisma.event.findFirst();`
  - Check close: `if (event && event.submissionsClose < new Date()) return NextResponse.json({ error: 'Submissions are closed' }, { status: 409 });`

#### 4. Public Gallery Page (`src/app/projects/page.tsx`)
- Server Component.
- Fetches `prisma.project.findMany({ take: 40, include: { team: true, track: true }, orderBy: { id: 'asc' } })`.
- Displays cards containing `project.title`, `project.summary`, and track name.
- Renders HTML directly containing `"Glass Signal"`, `"Small Meadow"`, and `"Deep Compass"`.

---

## 5. Verification Method

To verify these findings and the future implementation independently:

1. **Verify Database Test Users & Sessions:**
   ```powershell
   npx tsx -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); async function m() { const u = await p.user.findMany({ where: { email: { contains: 'dogfood.dev' } }, include: { sessions: true } }); console.log(JSON.stringify(u, null, 2)); } m();"
   ```
   *Expected:* Outputs 4 test users with tokens `org_seed_token_2026`, `jdg_a_seed_token_2026`, `jdg_b_seed_token_2026`, `prt_seed_token_2026`.

2. **Verify Auth Helper Functionality:**
   ```powershell
   npx tsx -e "import { NextRequest } from 'next/server'; import { getSession } from './src/lib/auth'; async function test() { const req = new NextRequest('http://localhost:8080', { headers: { cookie: 'session=jdg_a_seed_token_2026' } }); console.log(await getSession(req)); } test();"
   ```
   *Expected:* Returns `{ id: 'user_jdg_a_01', email: 'judge_a@dogfood.dev', name: 'Judge Alpha', role: 'judge', judgeId: 'user_jdg_a_01' }`.

3. **Verify Fixture Project Titles Resolution:**
   ```powershell
   python -c "import sys; sys.path.insert(0, 'Hack_docs'); import run; f, p = run.load_fixture(None, '.dogfood.toml'); print('Titles:', run.fixture_titles(f))"
   ```
   *Expected:* `['Glass Signal', 'Small Meadow', 'Deep Compass']`.

4. **Verify Checker against Running Server:**
   ```powershell
   python Hack_docs/run.py .dogfood.toml
   ```
   *Expected (when dev server is active on 8080):*
   - `T1  gallery is public .... PASS`
   - `T1  project from fixtures shown .... PASS`
   - `T1  closed event refuses submissions .... PASS`
