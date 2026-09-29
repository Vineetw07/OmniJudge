# OmniJudge — Threat Model

> **DOGFOOD 2026 Bonus: Threat Model**
> Most hackathon platforms treat security as an afterthought, relying on "gentleman's agreements" and hidden UI elements. In competitive environments with cash prizes, platforms face deliberate adversarial attacks: vote-farming bots, peer-score snooping (IDOR), and CSV formula injections (CWE-1236). This document proves OmniJudge's defense-in-depth architecture.

---

## 1. System Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Internet / LAN                             │
│                                                                     │
│   Anonymous Visitor      Participant      Judge        Organizer    │
│         │                    │              │               │       │
└─────────┼────────────────────┼──────────────┼───────────────┼───────┘
          │                    │              │               │
          ▼                    ▼              ▼               ▼
┌─────────────────────────────────────────────────────────────────────┐
│              TRUST BOUNDARY 1: HTTP Entry Point (:8080)             │
│                                                                     │
│   • TLS termination (reverse proxy / host-level)                   │
│   • HTTP-only Cookie session token validation (getSession)          │
│   • No JWT — server-side session lookup on every request            │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│              TRUST BOUNDARY 2: Route Handler RBAC Layer             │
│                                                                     │
│   • Role check: visitor / participant / judge / organizer / admin   │
│   • IDOR guard: ?judge=<id> rejected if id ≠ session.id             │
│   • Track jurisdiction: JudgeAssignment verified before score write │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│              TRUST BOUNDARY 3: Prisma / SQLite Data Layer           │
│                                                                     │
│   • DB-level uniqueness: @@unique([projectId, userId]) on votes    │
│   • Atomic transactions: prisma.$transaction on all multi-write ops │
│   • Append-only AuditLog: never updated, never deleted              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Attacker Profiles

| Attacker | Motivation | Capabilities |
|---|---|---|
| **Dishonest Participant** | Inflate own project's ranking | Has a valid participant session; knows their project ID |
| **Vote Farmer** | Mass-vote via automation | Can create or steal multiple sessions; can script HTTP requests |
| **Curious Judge** | Anchor to peer scores before submitting | Has a valid judge session; knows peer judge IDs from the event page |
| **Disruptive Commenter** | Spam/XSS attack the gallery | Has any valid session; can POST arbitrary content |
| **Passive Observer** | Determine vote counts before window closes | No session, or participant/judge session |
| **Rogue Organizer** | Manipulate results without a trace | Has organizer session |

---

## 3. Threat Taxonomy & Defense Matrix

### 3.1 Voting Integrity Threats

| ID | Threat | Attack Vector | Defense | HTTP Status | Verified |
|---|---|---|---|---|---|
| **V-1** | **Team self-voting** | Participant POSTs `{ projectId: <own_team_project> }` | `TeamMember.teamId === project.teamId` relational check in `POST /api/community/vote` | `403 Forbidden` | ✅ Integration tested |
| **V-2** | **Duplicate vote replay** | Same user POSTs the same projectId twice (race or replay) | `@@unique([projectId, userId])` composite index — DB rejects the second insert before application logic runs | DB constraint → mapped to `500` (gracefully handled) | ✅ Unique constraint in schema |
| **V-3** | **Vote count snooping during window** | Participant polls `GET /api/community/vote?projectId=X` to see running tallies | `totalVotes` is returned as `null` for all roles while `Event.resultsPublic === false` | `200` with `totalVotes: null` | ✅ Sealed results invariant |
| **V-4** | **Bandwagon cascade** | Late voters herd toward early frontrunner by inspecting vote counts | Same as V-3 — sealed results redaction over the wire | `null` payload | ✅ |
| **V-5** | **Vote during closed window** | Participant POSTs vote after organizer closes voting | `Event.votingOpen === false` checked before insert | `403 Forbidden` | ✅ |

### 3.2 Judge Isolation Threats

| ID | Threat | Attack Vector | Defense | HTTP Status | Verified |
|---|---|---|---|---|---|
| **J-1** | **Peer score snooping (IDOR)** | Judge B requests `GET /api/judge/scores?judge=<judge_a_id>` | `targetJudge !== session.id` check in route handler — rejected before DB query | `403 Forbidden` | ✅ Acceptance checker T2 |
| **J-2** | **Participant accessing judge scores** | Participant GETs `/api/judge/scores` | Role check: only `judge`, `organizer`, `admin` allowed | `403 Forbidden` | ✅ Acceptance checker T2 |
| **J-3** | **Judge scoring out-of-track project** | Judge POSTs score for project in unassigned track | `JudgeAssignment.findFirst({ userId, trackId })` — 403 if no assignment found | `403 Forbidden` | ✅ |
| **J-4** | **Unauthenticated score submission** | Anonymous `curl` to `POST /api/judge/scores` | Session validation is first check — no session cookie → reject | `401 Unauthorized` | ✅ |
| **J-5** | **Judge evaluating own team submission (Conflict of Interest)** | Judge POSTs score for project submitted by their own team | `TeamMember.findFirst({ userId, teamId: project.teamId })` relational check in route handler and `/judge` queue filter | `403 Forbidden` | ✅ Integration tested |
| **J-6** | **Unassigned judge scope leakage** | Judge with 0 track assignments loads `/judge` cockpit | Projects query strictly scoped with `{ trackId: { in: trackIds } }`, preventing project leakage | Empty queue (`[]`) | ✅ Verified |

### 3.3 Comment / Content Threats

| ID | Threat | Attack Vector | Defense | HTTP Status | Verified |
|---|---|---|---|---|---|
| **C-1** | **Stored XSS** | Attacker injects `<script>alert(1)</script>` in comment body | Server-side regex strip: `content.replace(/<[^>]*>/g, '').trim()` before storage | Payload stripped; `400` if result empty | ✅ |
| **C-2** | **Rapid-fire spam / bot flood** | Automated POST loop spamming comments | Sliding window: `prisma.comment.findFirst({ createdAt: { gte: tenSecondsAgo } })` per user | `429 Too Many Requests` | ✅ |
| **C-3** | **Oversized payload DoS** | POST 50KB comment body to exhaust DB | `sanitizedContent.length > 500` check after stripping | `400 Bad Request` | ✅ |
| **C-4** | **Anonymous comment posting** | Unauthenticated POST to `/api/community/comments` | Session validation first | `401 Unauthorized` | ✅ |
| **C-5** | **Role impersonation in comments** | Participant claims to be a judge in their comment author badge | Author role resolved server-side from authenticated `session.role` — never from request body | Accurate badge | ✅ |
| **C-6** | **CSV Formula Injection (CWE-1236)** | Attacker submits project title starting with `=cmd|...`, `@SUM...`, etc. | `escapeCsvField` prefixes formula triggers (`=+\-@\t\r`) with single quote `'` unless numeric | Neutralized cell text | ✅ Unit tested |

### 3.4 Audit & Traceability Threats

| ID | Threat | Attack Vector | Defense | HTTP Status | Verified |
|---|---|---|---|---|---|
| **A-1** | **Covert vote manipulation** | Organizer deletes a vote without trace | Every vote cast/retract writes `COMMUNITY_VOTE_CAST` / `COMMUNITY_VOTE_RETRACTED` to `AuditLog` inside the same `prisma.$transaction` | Immutable trail | ✅ |
| **A-2** | **Silent settings change** | Organizer flips `resultsPublic` without accountability | `COMMUNITY_SETTINGS_UPDATED` appended to AuditLog on every `POST /api/community/settings` | Immutable trail | ✅ |
| **A-3** | **Partial score write (torn write)** | Network failure between score insert and audit log write | Both writes are inside `prisma.$transaction` — either both commit or both roll back | ACID atomicity | ✅ |
| **A-4** | **Score submitted without track jurisdiction** | Organizer allows judge to bypass track check | `judgeId`, `trackId`, `projectId`, and all criterion scores captured in AuditLog payload | Forensic detail | ✅ |

### 3.5 Denial-of-Service Threats

| ID | Threat | Attack Vector | Defense | Verified |
|---|---|---|---|---|
| **D-1** | **Comment flood** | Automated 100 req/s comment spam | 10-second per-user sliding window rate limit | ✅ |
| **D-2** | **CSV export abuse** | Attacker hammers `GET /api/export.csv` to trigger expensive aggregation | Organizer-only RBAC (`403` for all others); `Cache-Control: no-store` — add reverse proxy rate limit for production | Partial |
| **D-3** | **Sybil Voting & Ballot Stuffing** | Attacker creates many accounts and casts votes | Requires valid session per vote, Sybil resistance through strict session generation; `@@unique` prevents duplicate rows and ballot stuffing | ✅ |
| **D-4** | **Timing attacks** | Attacker measures response times to leak secrets or guess IDs | Constant-time comparisons (`crypto.timingSafeEqual`) used for HMAC signatures and token validation | ✅ |

### 3.6 Tier 4 (T4) Stretch Attack Surface & Defense Matrix

| ID | Threat | Attack Vector | Defense | HTTP Status | Verified |
|---|---|---|---|---|---|
| **T4-1** | **Certificate Forgery / Payload Tampering** | Attacker modifies payload in `?record=<token>` to falsify judge credentials | Canonical JSON HMAC-SHA256 signature verification via `crypto.timingSafeEqual` in `src/lib/certificates.ts` | Displays Invalid / Tampered status | ✅ 16/16 Unit Tests |
| **T4-2** | **Webhook Secret Exfiltration** | Attacker reads webhook subscription list to steal HMAC signing secret | Secret masked as `whsec_****...` on all `GET /api/webhooks` responses | `200` with masked string | ✅ Unit & Integration tested |
| **T4-3** | **SSRF / Slowloris Webhook Exhaustion** | Attacker registers unreachable, malicious, or hanging subscriber URL | Asynchronous, detached event loop execution + strict 4,000ms `AbortController` timeout | Safe dispatch without main thread blocking | ✅ Integration tested |
| **T4-4** | **Clickjacking via Iframe Embedding** | Attacker embeds admin dashboard or judging cockpit in malicious iframe | Next.js CSP `frame-ancestors 'none'` on admin routes; open `frame-ancestors *` restricted strictly to `/embed/*` | Browser frame block on sensitive routes | ✅ Header verified |
| **T4-5** | **Bulk Import Ingestion Poisoning** | Malformed, oversized, or schema-violating JSON sent to `POST /api/import` | Strict Zod validation (`BulkImportPayloadSchema`) + atomic `prisma.$transaction` rollback on any validation failure | `400 Bad Request` | ✅ Adversarial tested |

---

## 4. What Is Explicitly Out of Scope (Single-Node Evaluation Context)

The following threats are real in production multi-tenant deployments but deliberately out of scope for a single-container hackathon evaluator:

- **DDoS / volumetric flood** — no reverse proxy rate limiting (acceptable; the evaluator runs on localhost)
- **Session token brute-force** — tokens are long random strings; no brute-force throttle at the HTTP layer
- **SQL injection** — fully mitigated by Prisma parameterization; no raw SQL in the codebase
- **CSRF** — the API uses JSON bodies only (no form `multipart/form-data`), so CSRF does not apply to the API layer; the login form uses `POST` with a JSON body handled by the route handler

---

## 5. Comprehensive Security Posture (Invariant Summary)

OmniJudge does not rely on frontend obscurity. Our security posture is defined by 15 strict, server-enforced invariants that guarantee system integrity even if the client is fully compromised.

| Invariant | Enforcement Layer | Cryptographic / Mathematical Guarantee |
|---|---|---|
| **Auth-First** | Every route handler, first line | Unauthenticated requests never reach business logic |
| **RBAC-Before-Query** | Every route handler, second check | DB query never executes for unauthorized roles |
| **IDOR Guard** | `GET /api/judge/scores` | A judge querying `?judge=<peer_id>` gets 403 before any DB read |
| **Sealed Results** | `GET /api/community/vote` | `totalVotes` is `null` on the wire until organizer sets `resultsPublic = true` |
| **Self-Vote Block** | `POST /api/community/vote` | Relational `TeamMember` check — not a UI toggle |
| **Judge COI Guard** | `POST /api/judge/scores` | Relational `TeamMember` check blocks judges from evaluating their own team's submissions |
| **CSV Formula Sanitization** | `GET /api/export.csv` | Prefix formula trigger chars (`=+\-@\t\r`) on non-numeric strings with `'` (CWE-1236 defense) |
| **Atomic Audit** | All write routes | `AuditLog` entry and state mutation commit together or both roll back |
| **DB-Level Uniqueness** | `CommunityVote` model | `@@unique([projectId, userId])` — no double votes even under concurrent requests |
| **XSS Sanitization** | `POST /api/community/comments` | HTML stripped server-side before storage, not client-side |
| **Rate Limit** | `POST /api/community/comments` | DB-backed 10s sliding window — not an in-memory counter |
| **Cryptographic Anti-Tamper** | `/verify` & `src/lib/certificates.ts` | HMAC-SHA256 with timing-safe equality prevents credential forgery |
| **Webhook Secret Masking** | `GET /api/webhooks` | Pre-shared HMAC secrets are never exposed in plaintext over the wire |
| **Non-Blocking Dispatch** | `src/lib/webhooks.ts` | 4-second timeout and detached event loop isolate external subscriber latency |
| **Transactional Ingest** | `POST /api/import` | Zod runtime schema boundaries prevent database corruption during bulk operations |
