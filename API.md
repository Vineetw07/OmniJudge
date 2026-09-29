# OmniJudge — REST API Specification

> **DOGFOOD 2026 Bonus Challenge:** API-First Design  
> Complete technical specification of all OmniJudge HTTP endpoints, authentication protocols, payload schemas, security invariants, and status codes.

---

## 1. System Architecture & Authentication Model

OmniJudge provides a zero-dependency, headless RESTful API. Every state mutation is ACID transactional (`prisma.$transaction`) and produces an immutable entry in the `AuditLog` table.

### 1.1 Session Management
OmniJudge uses stateful, database-backed HTTP-only cookie sessions:
```http
Cookie: session=<session_token>
```
* **Cookie Attributes:** `HttpOnly`, `Path=/`, `SameSite=Lax`, `Max-Age=2592000` (30 days).
* **Token Resolution:** The `getSession(req)` utility inspects the `Cookie` header, looks up the session in SQLite, and resolves the user ID, name, email, and role.
* **Unauthenticated Requests:** Protected endpoints immediately terminate with `401 Unauthorized` before reaching business logic.
* **Role Guards:** Unauthorized roles receive `403 Forbidden`.

### 1.2 Global HTTP Status Code Contract
| Status | Semantic Meaning in OmniJudge |
| :--- | :--- |
| `200 OK` | Query succeeded or update was applied |
| `400 Bad Request` | Malformed JSON body or Zod schema validation failure |
| `401 Unauthorized` | Missing, expired, or invalid session cookie |
| `403 Forbidden` | Authenticated session lacks necessary role or track jurisdiction (or IDOR / self-vote attempt) |
| `404 Not Found` | Target Project, Track, or Rubric Criterion does not exist |
| `409 Conflict` | Submission window has closed (`submissionsClose` in past) |
| `429 Too Many Requests` | Rate limit threshold exceeded (e.g. 10s comment cooldown) |
| `500 Internal Server Error` | Uncaught database or internal runtime failure |

---

## 2. Authentication Endpoints

### 2.1 `POST /api/auth/login`
Authenticates a user via email, retrieves or creates a durable session, and sets the `session` cookie.

* **Access:** Public (Unauthenticated)
* **Request Headers:** `Content-Type: application/json`
* **Request Body:**
```json
{
  "email": "organizer@dogfood.dev"
}
```
* **Validation:** Email must be valid RFC 5322 format.
* **cURL Example:**
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"organizer@dogfood.dev"}'
```
* **Response (`200 OK`):**
```json
{
  "success": true,
  "user": {
    "id": "usr_org_01",
    "email": "organizer@dogfood.dev",
    "name": "Jane Organizer",
    "role": "organizer"
  }
}
```
* **Set-Cookie Header:** `session=<fresh_random_uuid>; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
* **Errors:**
  * `400 Bad Request`: `{ "error": "Valid email address is required" }`
  * `401 Unauthorized`: `{ "error": "Invalid credentials" }`

---

### 2.2 `POST /api/auth/logout` & `GET /api/auth/logout`
Terminates the active session by deleting the session row from the database and expiring the `session` cookie.

* **Access:** Public / Authenticated
* **Behavior:**
  * `POST`: Deletes session from SQLite DB, sets `session` cookie max-age to 0 and returns JSON:
    ```json
    { "success": true, "message": "Logged out successfully" }
    ```
    * **cURL Example:**
    ```bash
    curl -X POST http://localhost:8080/api/auth/logout
    ```
  * `GET`: Deletes session from DB, clears `session` cookie and issues a `302 Redirect` to `/login`.
    * **cURL Example:**
    ```bash
    curl -X GET http://localhost:8080/api/auth/logout
    ```

---

## 3. Projects & Submissions API (T1)

### 3.1 `GET /api/projects`
Retrieves hackathon project submissions with track and team relations.

* **Access:** Public (No authentication required)
* **Query Parameters:** None (returns up to 40 submissions ordered by `id ASC`)
* **cURL Example:**
```bash
curl -X GET http://localhost:8080/api/projects
```
* **Response (`200 OK`):**
```json
{
  "projects": [
    {
      "id": "prj_01",
      "teamId": "tm_01",
      "trackId": "trk_01",
      "eventId": "evt_01",
      "title": "Glass Signal",
      "summary": "Real-time acoustic analysis for distributed networks.",
      "repoUrl": "https://example.org/repo/glass-signal",
      "submittedAt": "2026-02-28T22:14:00.000Z",
      "isDraft": false,
      "track": { "id": "trk_01", "name": "Developer Tools" },
      "team": { "id": "tm_01", "name": "Nightshift" }
    }
  ]
}
```

---

### 3.2 `POST /api/projects`
Handles new project submissions. Strictly enforces the event deadline.

* **Access:** Participant, Organizer, Admin
* **Request Headers:** `Cookie: session=<token>`, `Content-Type: application/json`
* **Request Body:**
```json
{
  "title": "Autonomous Cache",
  "summary": "Self-healing distributed in-memory key-value engine.",
  "repoUrl": "https://github.com/example/cache",
  "trackId": "trk_01",
  "teamId": "tm_02",
  "isDraft": false
}
```
* **cURL Example:**
```bash
curl -X POST http://localhost:8080/api/projects \
  -H "Cookie: session=org_seed_token_2026" \
  -H "Content-Type: application/json" \
  -d '{"title":"Autonomous Cache","summary":"Self-healing distributed in-memory key-value engine.","repoUrl":"https://github.com/example/cache","trackId":"trk_01","teamId":"tm_02","isDraft":false}'
```
* **Deadline Enforcement Invariant:**
  * Compares current server timestamp with database `Event.submissionsClose`.
  * If `now > submissionsClose`, immediately returns **`409 Conflict`**:
    ```json
    {
      "error": "Submissions are closed for this event",
      "submissionsClose": "2026-03-01T18:00:00.000Z",
      "serverTime": "2026-09-28T14:45:00.000Z"
    }
    ```
* **Errors:**
  * `401 Unauthorized`: Missing or invalid session.
  * `403 Forbidden`: Calling user has role `visitor` or `judge`.
  * `400 Bad Request`: Missing required title/summary fields.
  * `404 Not Found`: Event record does not exist.

---

## 4. Judging & Evaluation API (T2)

### 4.1 `GET /api/judge/scores`
Fetches rubric score evaluations with strict perimeter role isolation.

* **Access:** Judge, Organizer, Admin
* **Query Parameters:**
  * `judge` *(optional, string)*: Specific judge ID to query.
* **Perimeter Security Invariants:**
  * `401 Unauthorized`: Unauthenticated request.
  * `403 Forbidden`: Called by `participant` or `visitor`.
  * `403 Forbidden` **(IDOR Defense):** When called by a `judge`, if `?judge=<target_id>` does not match `session.userId`, the request is rejected immediately without hitting the database.
  * `200 OK`: When a judge queries their own scores, or when an organizer/admin queries any judge.
* **cURL Example:**
```bash
curl -X GET "http://localhost:8080/api/judge/scores?judge=user_jdg_a_01" \
  -H "Cookie: session=jdg_a_seed_token_2026"
```
* **Response (`200 OK`):**
```json
{
  "scores": [
    {
      "id": "scr_01",
      "judgeId": "user_jdg_a_01",
      "projectId": "prj_01",
      "criterionId": "crit_01",
      "value": 4.5,
      "comment": "Exceptional architecture and clean UI.",
      "submittedAt": "2026-09-28T12:00:00.000Z",
      "project": {
        "id": "prj_01",
        "title": "Glass Signal",
        "trackId": "trk_01",
        "track": { "id": "trk_01", "name": "Developer Tools" }
      },
      "criterion": {
        "id": "crit_01",
        "name": "functionality",
        "weight": 1.5,
        "maxScore": 5
      }
    }
  ]
}
```

---

### 4.2 `POST /api/judge/scores`
Submits or updates multi-criterion rubric evaluations for an assigned project within an ACID transaction.

* **Access:** Judge assigned to the project track, Organizer, Admin
* **Request Body:**
```json
{
  "projectId": "prj_01",
  "scores": [
    { "criterionId": "crit_func", "value": 4.5 },
    { "criterionId": "crit_qual", "value": 4.0 },
    { "criterionId": "crit_crea", "value": 5.0 },
    { "criterionId": "crit_pres", "value": 3.5 }
  ],
  "comment": "Robust error handling and well-derived MAD mathematical model."
}
```
* **Enforcements & Guard Rails:**
  * **Jurisdiction Guard (`403 Forbidden`):** For judges, queries `JudgeAssignment` for `(userId, project.trackId)`. If not assigned to that track, rejects with `403`.
  * **Conflict of Interest (COI) Guard (`403 Forbidden`):** For judges, queries `TeamMember` for `(userId, project.teamId)`. If the judge is an affiliated member of the team submitting the project, rejects with `403 Forbidden`.
  * **Existence Guard (`404 Not Found`):** Project must exist in database.
  * **Criterion Integrity (`400 Bad Request`):** All `criterionId` values must exist and scores must be within `0 <= value <= 5`.
* **Atomic Transaction Execution:**
  * Upserts every `Score` record.
  * Appends `action: "score_submitted"` to `AuditLog` containing project ID, track ID, and serialized score payload.
* **cURL Example:**
```bash
curl -X POST http://localhost:8080/api/judge/scores \
  -H "Cookie: session=jdg_a_seed_token_2026" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"prj_01","scores":[{"criterionId":"crit_func","value":4.5}],"comment":"Good"}'
```
* **Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Scores submitted successfully"
}
```

---

## 5. Community Voting & Feedback API (T3)

### 5.1 `GET /api/community/vote`
Queries vote state with a strict **Sealed Results Invariant** to eliminate bandwagon bias.

* **Access:** Public or Authenticated
* **Query Parameters:**
  * `projectId` *(optional, string)*: Specific project ID to inspect.
* **Behavior:**
  * **Without `projectId`:** Returns `{ userVotes: string[], votingOpen: boolean, resultsPublic: boolean }` listing all project IDs upvoted by the caller.
  * **With `projectId`:** Returns vote state for that submission:
    ```json
    {
      "hasVoted": true,
      "totalVotes": null,
      "votingOpen": true,
      "resultsPublic": false
    }
    ```
* **cURL Example:**
```bash
curl -X GET "http://localhost:8080/api/community/vote?projectId=prj_01" \
  -H "Cookie: session=prt_seed_token_2026"
```
* **Sealed Results Invariant:**
  * While `Event.resultsPublic === false`, `totalVotes` is returned as **`null`** for all non-organizer callers. Vote counts are never leaked over the wire during active voting.
* **Errors:**
  * `404 Not Found`: Project ID does not exist.

---

### 5.2 `POST /api/community/vote`
Toggles an upvote on a project submission (vote if unvoted, retract if already voted).

* **Access:** Authenticated Users (`participant`, `judge`, `organizer`, `admin`)
* **Request Body:**
```json
{
  "projectId": "prj_02"
}
```
* **Defensive Controls:**
  * `401 Unauthorized`: Anonymous caller.
  * `403 Forbidden`: `Event.votingOpen === false`.
  * `403 Forbidden` **(Self-Vote Defense):** Compares `TeamMember(session.userId).teamId === project.teamId`. Team members are blocked from upvoting their own team's submissions.
  * **Database-Level Idempotency:** Guarded by `@@unique([projectId, userId])` on `CommunityVote`.
* **Atomic Side Effects:**
  * If already voted: Deletes `CommunityVote` and logs `COMMUNITY_VOTE_RETRACTED` to `AuditLog`.
  * If not voted: Inserts `CommunityVote` and logs `COMMUNITY_VOTE_CAST` to `AuditLog`.
* **cURL Example:**
```bash
curl -X POST http://localhost:8080/api/community/vote \
  -H "Cookie: session=prt_seed_token_2026" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"prj_02"}'
```
* **Response (`200 OK`):**
```json
{
  "success": true,
  "hasVoted": true,
  "message": "Vote cast"
}
```

---

### 5.3 `GET /api/community/comments`
Retrieves public feedback comments for a project submission.

* **Access:** Public
* **Query Parameters:**
  * `projectId` *(required, string)*
* **cURL Example:**
```bash
curl -X GET "http://localhost:8080/api/community/comments?projectId=prj_02"
```
* **Response (`200 OK`):**
```json
{
  "success": true,
  "comments": [
    {
      "id": "cm_01",
      "projectId": "prj_02",
      "userId": "user_prt_01",
      "authorName": "Ada Lovelace",
      "authorRole": "participant",
      "content": "Impressive error handling on edge cases!",
      "createdAt": "2026-09-28T14:32:00.000Z"
    }
  ]
}
```

---

### 5.4 `POST /api/community/comments`
Posts qualitative, constructive feedback on a project.

* **Access:** Authenticated Users
* **Request Body:**
```json
{
  "projectId": "prj_02",
  "content": "Great documentation and clean API contracts."
}
```
* **Sanitization & Defense:**
  * **XSS Defense:** Regex HTML stripper (`content.replace(/<[^>]*>/g, '').trim()`) removes all markup before persistence.
  * **Length Clamp (`400 Bad Request`):** Sanitized length must satisfy `1 <= length <= 500`.
  * **Sliding-Window Rate Limit (`429 Too Many Requests`):** Database check enforces a minimum 10-second interval between comments per user.
* **Side Effects:** Inserts `Comment` and records `COMMENT_POSTED` in `AuditLog`.
* **cURL Example:**
```bash
curl -X POST http://localhost:8080/api/community/comments \
  -H "Cookie: session=prt_seed_token_2026" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"prj_02","content":"Great documentation and clean API contracts."}'
```
* **Response (`200 OK`):**
```json
{
  "success": true,
  "comment": {
    "id": "cm_02",
    "projectId": "prj_02",
    "userId": "usr_01",
    "authorName": "Ada Lovelace",
    "content": "Great documentation and clean API contracts."
  }
}
```

---

## 6. Community Governance API

### 6.1 `GET /api/community/settings`
Reads current event voting lifecycle parameters.

* **Access:** Public / Authenticated
* **cURL Example:**
```bash
curl -X GET http://localhost:8080/api/community/settings
```
* **Response (`200 OK`):**
```json
{
  "success": true,
  "votingOpen": true,
  "resultsPublic": false
}
```

---

### 6.2 `POST /api/community/settings`
Updates event voting flags (seal/unseal results, open/close voting window).

* **Access:** Organizer, Admin only (`403 Forbidden` for judges/participants)
* **Request Body:**
```json
{
  "votingOpen": true,
  "resultsPublic": true
}
```
* **Side Effects:** Updates `Event` and appends `COMMUNITY_SETTINGS_UPDATED` to `AuditLog`.
* **cURL Example:**
```bash
curl -X POST http://localhost:8080/api/community/settings \
  -H "Cookie: session=org_seed_token_2026" \
  -H "Content-Type: application/json" \
  -d '{"votingOpen":true,"resultsPublic":true}'
```
* **Response (`200 OK`):**
```json
{
  "success": true,
  "votingOpen": true,
  "resultsPublic": true
}
```

---

## 7. Results Export API (T2)

### 7.1 `GET /api/export.csv`
Computes rubric-weighted composite scores, applies per-judge MAD normalization, and streams an RFC 4180 compliant CSV.

* **Access:** Organizer, Admin only (`403 Forbidden` for participants/judges, `401 Unauthorized` for anonymous)
* **cURL Example:**
```bash
curl -X GET http://localhost:8080/api/export.csv \
  -H "Cookie: session=org_seed_token_2026"
```
* **Response Headers:**
```http
HTTP/1.1 200 OK
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="omnijudge_scores.csv"
Cache-Control: no-store, max-age=0
```
* **Algorithm Pipeline:**
  1. Computes rubric-weighted scores per judge-project pair:
     $$\text{Composite} = \frac{\sum (\text{score}_c \cdot \text{weight}_c)}{\sum \text{weight}_c}$$
  2. Applies Modified Z-Score per judge using Median Absolute Deviation:
     $$\text{modified\_z}_i = \frac{0.6745 \cdot (x_i - \tilde{x})}{\text{MAD}}$$
  3. **Zero-Variance & Finite Guard:** If $\text{MAD} < 10^{-9}$ (e.g. `jdg_30`, single-review judges, or 1-ULP floating-point drift), outputs `0.0` instead of crashing with `NaN` or blowing up with $10^{15}$ division artifacts. All scores pass `Number.isFinite` validation.
  4. Averages normalized scores across valid normalized values (`/ normScores.length`) and raw scores across all reviews (`/ reviewCount`).
  5. **Deterministic Multi-Key Sort:**
     - **Status Invariant:** Evaluated projects (`reviewCount > 0`) strictly outrank unreviewed projects (`reviewCount === 0`).
     - **Normalized Score DESC:** Floating-point comparison with epsilon tolerance ($\epsilon = 10^{-9}$).
     - **Raw Score DESC:** Tie-breaker with epsilon tolerance ($\epsilon = 10^{-9}$).
     - **Project ID ASC:** Deterministic lexicographical tie-break.
  6. Emits UTF-8 BOM (`\uFEFF`), RFC 4180, and CWE-1236 sanitized CSV (neutralizing `=+\-@\t\r` formula triggers) with comma-verified header row, and logs action `csv_exported` to `AuditLog`.
* **Output Format:**
```csv
project_id,project_title,track,raw_score,normalized_score,review_count,rank
prj_01,"Glass Signal","Developer Tools",4.25,1.1420,3,1
prj_04,"Deep Compass","Developer Tools",3.80,0.4852,2,2
```

---

## 8. Leaderboard API

### 8.1 `GET /api/leaderboard`
Returns the MAD-normalized public leaderboard, sanitized of per-judge scores and all PII. Enforces the **Sealed-Results Invariant**: while `Event.resultsPublic === false`, this endpoint is locked to organizer/admin callers only.

* **Access:** Any authenticated session (`401 Unauthorized` for anonymous). `403 Forbidden` for non-organizer roles while `Event.resultsPublic === false`.
* **Query Parameters:** None.
* **Access Rules:**
  * `401 Unauthorized`: No valid `session` cookie present.
  * `403 Forbidden` **(Sealed-Results Invariant):** `Event.resultsPublic === false` AND caller role is **not** `organizer` or `admin`. Results are sealed until the organizer explicitly unlocks them via `POST /api/community/settings`.
  * `200 OK`: `Event.resultsPublic === true`, OR caller is `organizer`/`admin` (they bypass the sealed-results gate to verify rankings before public release).
* **Sealed-Results Invariant Explanation:** When the organizer has not yet made results public (`resultsPublic = false`), exposing the leaderboard to judges or participants would create bandwagon bias and ranking manipulation incentives before all reviews are complete. Organizers can inspect live rankings at any time without triggering the gate.
* **cURL Example (Organizer bypasses sealed gate):**
```bash
curl -s -H "Cookie: session=org_seed_token_2026" \
  "http://localhost:8080/api/leaderboard"
```
* **Response (`200 OK`):**
```json
{
  "resultsPublic": false,
  "leaderboard": [
    {
      "rank": 1,
      "trackRank": 1,
      "projectId": "prj_01",
      "title": "Glass Signal",
      "trackName": "Developer Tools & Infrastructure",
      "normalizedScore": 1.1420,
      "reviewCount": 3
    },
    {
      "rank": 2,
      "trackRank": 2,
      "projectId": "prj_04",
      "title": "Deep Compass",
      "trackName": "Developer Tools & Infrastructure",
      "normalizedScore": 0.4852,
      "reviewCount": 2
    },
    {
      "rank": 3,
      "trackRank": 1,
      "projectId": "prj_12",
      "title": "Small Meadow",
      "trackName": "AI & Machine Learning",
      "normalizedScore": 0.0000,
      "reviewCount": 1
    }
  ]
}
```
* **Sanitized Output Contract:** The response intentionally omits per-judge `Score` rows, `judgeId` fields, and all personal identifiers. Only the following fields are returned per entry: `rank` (global normalized rank), `trackRank` (standing within the project's assigned track), `projectId`, `title`, `trackName`, `normalizedScore` (4 decimal places), `reviewCount`.
* **Dual Leaderboard Architecture:**
  * **Overall Standings (Grand Champion View):** Global rank (`rank`) sorted strictly by review status (reviewed > unreviewed), descending normalized MAD score, raw score, and project ID ASC.
  * **Per-Track Standings (Category Winners View):** Track rank (`trackRank`) deterministically calculated per track category, enabling views to showcase category winners with 1st, 2nd, and 3rd place podium highlights alongside global context.
* **Errors:**
  * `401 Unauthorized`: `{ "error": "Unauthorized: Valid session required" }`
  * `403 Forbidden`: `{ "error": "Results are not yet public" }`

---

## 9. Tier 4 Stretch Surface & Developer Platform APIs

### 9.1 Signed Judge Certificates API

#### `GET /api/judge/certificate`
Generates a canonical, HMAC-SHA256 signed evaluation credential for the authenticated judge.

* **Access:** Judge role only (`401 Unauthorized` for anonymous, `403 Forbidden` for participants).
* **Query Parameters:**
  * `judge` (optional): Must match authenticated user ID (prevent IDOR).
* **cURL Example:**
```bash
curl -X GET http://localhost:8080/api/judge/certificate \
  -H "Cookie: session=jdg_a_seed_token_2026"
```
* **Response (`200 OK`):**
```json
{
  "success": true,
  "certificate": {
    "version": "1.0",
    "issuedAt": "2026-09-28T16:30:00.000Z",
    "event": "DOGFOOD Hackathon 2026",
    "judgeId": "usr_jdg_a_01",
    "judgeName": "Dr. Aris Thorne",
    "tracks": ["Developer Tools & Infrastructure"],
    "assignedProjects": 20,
    "reviewsCompleted": 18,
    "completionRate": 90,
    "signature": "d9f8c3746a... (64-char hex HMAC-SHA256)"
  },
  "verificationToken": "eyJ2ZXJzaW9uIjoiMS4w... (URL-safe Base64)",
  "verificationUrl": "/verify?record=eyJ2ZXJzaW9u..."
}
```

#### `POST /api/judge/certificate`
Cryptographically verifies an evaluation certificate token.

* **Access:** Public (No authentication required)
* **Request Body:**
```json
{
  "token": "eyJ2ZXJzaW9uIjoiMS4w..."
}
```
* **cURL Example:**
```bash
curl -X POST http://localhost:8080/api/judge/certificate \
  -H "Content-Type: application/json" \
  -d '{"token":"eyJ2ZXJzaW9uIjoiMS4w..."}'
```
* **Response (`200 OK`):**
```json
{
  "valid": true,
  "payload": {
    "version": "1.0",
    "event": "DOGFOOD Hackathon 2026",
    "judgeId": "usr_jdg_a_01",
    "judgeName": "Dr. Aris Thorne",
    "tracks": ["Developer Tools & Infrastructure"],
    "assignedProjects": 20,
    "reviewsCompleted": 18,
    "completionRate": 90,
    "signature": "d9f8c3746a..."
  }
}
```
* **Verification Failure (`200 OK`):**
```json
{
  "valid": false,
  "error": "Cryptographic signature mismatch. Record has been altered or tampered with."
}
```

---

### 9.2 Real-Time Webhooks Engine

#### `GET /api/webhooks`
Lists all active webhook subscriptions with masked secrets.

* **Access:** Organizer, Admin only (`403 Forbidden` for others)
* **cURL Example:**
```bash
curl -X GET http://localhost:8080/api/webhooks \
  -H "Cookie: session=org_seed_token_2026"
```
* **Response (`200 OK`):**
```json
{
  "success": true,
  "subscriptions": [
    {
      "id": "wh_01",
      "url": "https://external.service/webhook",
      "events": ["score.submitted", "vote.cast", "results.unsealed"],
      "isActive": true,
      "createdAt": "2026-09-28T16:00:00.000Z",
      "secret": "whsec_****a3b8"
    }
  ]
}
```

#### `POST /api/webhooks`
Creates a new webhook subscription or sends a test ping.

* **Access:** Organizer, Admin only
* **Request Body (Registration):**
```json
{
  "url": "https://external.service/webhook",
  "secret": "super_secret_webhook_key_32bytes",
  "events": ["score.submitted", "vote.cast", "results.unsealed"]
}
```
* **Request Body (Test Ping):**
```json
{
  "action": "test",
  "subscriptionId": "wh_01"
}
```
* **cURL Example:**
```bash
curl -X POST http://localhost:8080/api/webhooks \
  -H "Cookie: session=org_seed_token_2026" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://external.service/webhook","secret":"super_secret_webhook_key_32bytes","events":["score.submitted"]}'
```
* **Payload Dispatched to Target:**
  * Headers: `Content-Type: application/json`, `X-OmniJudge-Signature-256: <hmac_hex>`, `X-OmniJudge-Event: <event_name>`
  * Delivery: Non-blocking asynchronous dispatch with 4,000ms timeout.

#### `DELETE /api/webhooks`
Deletes an active webhook subscription.

* **Access:** Organizer, Admin only
* **Query Parameters:** `id=<subscription_id>`
* **cURL Example:**
```bash
curl -X DELETE "http://localhost:8080/api/webhooks?id=wh_01" \
  -H "Cookie: session=org_seed_token_2026"
```

---

### 9.3 Full State JSON Export

#### `GET /api/export.json`
Exports complete event state including projects, teams, tracks, criteria, and calculated MAD-normalized standings.

* **Access:** Organizer, Admin only (`403 Forbidden` for others)
* **cURL Example:**
```bash
curl -X GET http://localhost:8080/api/export.json \
  -H "Cookie: session=org_seed_token_2026"
```
* **Response Headers:** `Content-Type: application/json; charset=utf-8`, `Content-Disposition: attachment; filename="omnijudge_export.json"`
* **Response Body (`200 OK`):**
```json
{
  "version": "1.0",
  "exportedAt": "2026-09-28T16:30:00.000Z",
  "event": { "id": "evt_01", "name": "DOGFOOD Hackathon 2026", ... },
  "tracks": [ ... ],
  "rubricCriteria": [ ... ],
  "teams": [ ... ],
  "projects": [ ... ],
  "leaderboard": [
    {
      "rank": 1,
      "projectId": "prj_01",
      "title": "Glass Signal",
      "track": "Developer Tools",
      "rawScore": 4.25,
      "normalizedScore": 1.142,
      "reviewCount": 3
    }
  ]
}
```

---

### 9.4 Bulk Data Import

#### `POST /api/import`
Transactionally imports or updates tracks, teams, and projects.

* **Access:** Organizer, Admin only (`403 Forbidden` for others)
* **Request Body:**
```json
{
  "tracks": [
    { "id": "trk_99", "name": "Quantum Computing", "description": "Next-gen algorithms" }
  ],
  "teams": [
    { "id": "tm_99", "name": "Q-Bits", "affiliation": "MIT" }
  ],
  "projects": [
    { "id": "prj_99", "teamId": "tm_99", "trackId": "trk_99", "title": "QuantumSim", "summary": "Full state quantum simulator" }
  ]
}
```
* **cURL Example:**
```bash
curl -X POST http://localhost:8080/api/import \
  -H "Cookie: session=org_seed_token_2026" \
  -H "Content-Type: application/json" \
  -d '{"tracks":[],"teams":[],"projects":[]}'
```
* **Response (`200 OK`):**
```json
{
  "success": true,
  "imported": {
    "tracks": 1,
    "teams": 1,
    "projects": 1
  }
}
```

---

### 9.5 OpenAPI 3.1 Specification

#### `GET /api/openapi.json`
Retrieves machine-readable OpenAPI 3.1.0 schema for the entire platform.

* **Access:** Public (No authentication required)
* **cURL Example:**
```bash
curl -X GET http://localhost:8080/api/openapi.json
```
* **Response (`200 OK`):** Valid OpenAPI 3.1.0 JSON covering 13 endpoints, security schemes (`sessionAuth`), component schemas, and parameters.

