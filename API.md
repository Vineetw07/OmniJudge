# OmniJudge — REST API Specification

> **DOGFOOD 2026 Bonus Challenge:** API-First Design
> Complete specification of all OmniJudge endpoints, authentication mechanisms, parameters, JSON payload contracts, and error responses.

---

## 1. Overview & Authentication Model

OmniJudge exposes a uniform RESTful HTTP interface. All write actions are transactional (`prisma.$transaction`) and appended to an immutable `AuditLog`.

### Authentication
Sessions are managed via HTTP-Only cookies or explicit `Cookie` request headers:
```http
Cookie: session=<session_token>
```
* **Unauthenticated access** to protected routes returns `401 Unauthorized`.
* **Unauthorized roles** attempting access return `403 Forbidden`.

### Global Response Codes
| Status | Meaning |
|---|---|
| `200 OK` | Request succeeded |
| `400 Bad Request` | Malformed JSON or Zod schema validation error |
| `401 Unauthorized` | Missing, expired, or invalid session token |
| `403 Forbidden` | Authenticated, but role or jurisdiction check failed |
| `404 Not Found` | Target entity (Project, Track, Criterion) does not exist |
| `429 Too Many Requests` | Rate limit window exceeded |
| `500 Internal Server Error` | Unhandled server exception |

---

## 2. Public & Project Gallery API

### `GET /projects`
* **Access:** Public (No authentication required)
* **Description:** Returns the server-rendered HTML project gallery with fixture submissions, search/filter controls, and community voting interfaces.

### `POST /api/projects`
* **Access:** Participant (`role: "participant"`)
* **Description:** Submits a new hackathon project entry.
* **Invariant:** Refuses submission with `403 Forbidden` if `Event.submissionsClose` has passed (seeded past date).

---

## 3. Judging & Evaluation API

### `GET /api/judge/scores`
* **Access:** Judge, Organizer, Admin
* **Query Parameters:**
  * `judge` *(optional, string)*: Target Judge ID to inspect.
* **RBAC & Isolation Invariants:**
  * When called by a `judge`:
    * If `?judge=<peer_id>` is passed and does not match `session.userId`, the request is **strictly rejected with `403 Forbidden`**.
    * If omitted or matching `session.userId`, returns exclusively this judge's score records.
  * When called by an `organizer` or `admin`:
    * Can view all scores across all judges or filter by `?judge=<id>`.
* **Response (`200 OK`):**
```json
{
  "scores": [
    {
      "id": "cm...01",
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

### `POST /api/judge/scores`
* **Access:** Judge assigned to project track, Organizer, Admin
* **Description:** Submits or updates rubric scores for a given project within an ACID transaction.
* **Payload:**
```json
{
  "projectId": "prj_01",
  "scores": [
    { "criterionId": "crit_01", "value": 4.5 },
    { "criterionId": "crit_02", "value": 4.0 },
    { "criterionId": "crit_03", "value": 5.0 },
    { "criterionId": "crit_04", "value": 3.5 }
  ],
  "comment": "Solid zero-variance defense implementation."
}
```
* **Enforcements:**
  * `403 Forbidden`: If `JudgeAssignment` does not link the judge to `project.trackId`.
  * `400 Bad Request`: If any `criterionId` is invalid or score exceeds `maxScore`.
* **Side Effects:**
  * Upserts `Score` records.
  * Writes an immutable audit entry (`action: "score_submitted"`).

---

## 4. Community Voting & Feedback API (T3)

### `GET /api/community/vote`
* **Access:** Public or Authenticated
* **Query Parameters:**
  * `projectId` *(optional, string)*: Project ID to check vote status.
* **Sealed Results Invariant:**
  * If `Event.resultsPublic === false`, `totalVotes` is returned as `null` for all non-organizer callers.
* **Response (`200 OK`):**
```json
{
  "hasVoted": true,
  "totalVotes": null,
  "votingOpen": true,
  "resultsPublic": false
}
```

### `POST /api/community/vote`
* **Access:** Authenticated Users (`participant`, `judge`, `organizer`, `admin`)
* **Description:** Toggles an upvote on a project submission.
* **Payload:**
```json
{
  "projectId": "prj_02"
}
```
* **Defensive Controls:**
  * `401 Unauthorized`: Anonymous caller.
  * `403 Forbidden`: If `Event.votingOpen === false`.
  * `403 Forbidden`: **Self-Vote Defense** — If voter belongs to the submitting team (`TeamMember.teamId === Project.teamId`).
  * `@@unique([projectId, userId])`: Database constraint guarantees idempotent vote toggle (delete if exists, insert if absent).
* **Response (`200 OK`):**
```json
{
  "success": true,
  "hasVoted": true,
  "message": "Vote cast"
}
```

### `GET /api/community/comments`
* **Access:** Public
* **Query Parameters:**
  * `projectId` *(required, string)*
* **Response (`200 OK`):**
```json
{
  "success": true,
  "comments": [
    {
      "id": "cm01...",
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

### `POST /api/community/comments`
* **Access:** Authenticated
* **Payload:**
```json
{
  "projectId": "prj_02",
  "content": "Great documentation and clean API contracts."
}
```
* **Defensive Controls:**
  * Regex HTML tag stripping (`content.replace(/<[^>]*>/g, '').trim()`) prevents stored XSS.
  * Content bounded between 1 and 500 characters.
  * 10-second per-user sliding window rate limit returns `429 Too Many Requests`.

---

## 5. Organizer Governance & Export API

### `POST /api/community/settings`
* **Access:** Organizer, Admin only (`403` otherwise)
* **Payload:**
```json
{
  "votingOpen": true,
  "resultsPublic": false
}
```
* **Side Effects:** Updates event state and records `COMMUNITY_SETTINGS_UPDATED` in `AuditLog`.

### `GET /api/export.csv`
* **Access:** Organizer, Admin only (`403` for participants/judges)
* **Description:** Streams RFC 4180 compliant CSV of all submissions, computed MAD Modified Z-Scores, raw scores, and deterministic ranks.
* **Headers:**
```http
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="omnijudge_scores.csv"
Cache-Control: no-store, max-age=0
```
* **Sample CSV Output:**
```csv
project_id,project_title,track,raw_score,normalized_score,rank
prj_01,"Glass Signal","Developer Tools",4.25,1.1420,1
prj_04,"Deep Compass","Developer Tools",3.80,0.4852,2
```
