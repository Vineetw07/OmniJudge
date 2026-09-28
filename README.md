# OmniJudge Hackathon Portal

> **A self-hostable, zero-dependency hackathon portal built for offline resilience, strict cryptographic role isolation, and bias-resistant judging.**
> Verified 7/7 on official DOGFOOD acceptance checker (`T1` + `T2`).

---

## ⚡ 90-Second Judge Overview

| Key Dimension | Architecture & Implementation |
| :--- | :--- |
| **Claimed Tiers** | **T1** (Public Gallery & Deadline Engine) + **T2** (Role-Isolated Judging & Normalised CSV Export) + **T3** (Community Voting, Ballot Randomization & Anti-Abuse Integrity) |
| **Stack** | Next.js 14 (App Router, Server Components), Prisma ORM, SQLite (`better-sqlite3`), Tailwind CSS, shadcn/ui, Framer Motion |
| **Acceptance Status** | **7 / 7 PASS** (`python Hack_docs/run.py .dogfood.toml` verified green) |
| **Zero-Network Ready** | Fully self-contained. Runs in `--network none` container after initial build. No external DB or SaaS calls. |
| **RBAC Isolation** | **Backend-enforced parameter guards** in Route Handlers. Peer score snooping returns `403 Forbidden` at HTTP level. Self-vote defense blocks team members from voting their own submission. |
| **Judging Algorithm** | **Modified Z-Score via Median Absolute Deviation (MAD)** with zero-variance mathematical safeguards. |
| **Community Integrity** | Fisher-Yates per-session ballot randomization, sealed results (vote counts hidden until organizer unseals), XSS-sanitized comments, in-memory rate limiting, and full `AuditLog` trail. |

---

## 🚀 Quickstart

### Option A: Docker (Recommended for Evaluation)

The container automatically applies migrations, seeds deterministic fixtures, and starts the server on port `8080`:

```bash
# 1. Build and run container
docker compose up --build

# 2. Open portal
# Web UI:    http://localhost:8080
# Gallery:   http://localhost:8080/projects
# Login:     http://localhost:8080/login
```

To run the automated acceptance checker against the container:
```bash
python Hack_docs/run.py .dogfood.toml
```

### Option B: Local CLI (Node.js 20+)

```powershell
# 1. Install dependencies
npm install

# 2. Run migrations and seed database with fixtures
npx prisma migrate dev --name init
npm run seed

# 3. Start production server on port 8080
npm run build
npm start

# Or start development server on port 8080
npm run dev
```

---

## 🔑 Test Accounts & Evaluation Credentials

The database is pre-seeded with deterministic accounts mapping directly to `.dogfood.toml`:

| Role | Email | Session Cookie Token | Target Route & Access Scope |
| :--- | :--- | :--- | :--- |
| **Organizer** | `organizer@dogfood.dev` | `org_seed_token_2026` | `/dashboard` — Event KPIs, judge progress table, leaderboard, `/api/export.csv` |
| **Judge Alpha** | `judge_a@dogfood.dev` | `jdg_a_seed_token_2026` | `/judge` — Track assignments, scoring forms, reads own scores via `/api/judge/scores` |
| **Judge Beta** | `judge_b@dogfood.dev` | `jdg_b_seed_token_2026` | `/judge` — Peer isolation test. Blocked from Judge Alpha scores (`403 Forbidden`) |
| **Participant** | `participant@dogfood.dev` | `prt_seed_token_2026` | `/projects` — Public project gallery, submission APIs. Blocked from judge APIs (`403`) |

> **Interactive Login:** Visit [`/login`](http://localhost:8080/login) and use the **1-click quick-select demo buttons** to instantly log in as any test role. The portal automatically redirects based on role:
> - Judge $\rightarrow$ [`/judge`](http://localhost:8080/judge)
> - Organizer / Admin $\rightarrow$ [`/dashboard`](http://localhost:8080/dashboard)
> - Participant / Visitor $\rightarrow$ [`/projects`](http://localhost:8080/projects)

---

## 📋 Verified Routes & API Capabilities

All endpoints adhere strictly to HTTP standards, status codes, and security policies:

| Route | Method | Auth / Role | Description & Verified Behavior |
| :--- | :--- | :--- | :--- |
| `/projects` | `GET` | **Public** (No Auth) | Server-rendered HTML gallery displaying all 40 fixture projects (including `"Glass Signal"`, `"Small Meadow"`, `"Deep Compass"`). |
| `/api/projects` | `POST` | Participant / Public | Submission handler checking database `event.submissionsClose`. Rejects with `409 Conflict` (event closed `2026-03-01T18:00:00Z`). |
| `/api/judge/scores` | `GET` | Judge (`judge_a`) | Returns JSON array of authenticated judge's own scores (`200 OK`). Anonymous requests receive `401 Unauthorized`. |
| `/api/judge/scores?judge=user_jdg_a_01` | `GET` | Judge (`judge_b`) | **RBAC Boundary Test:** Attempt by Judge B to inspect Judge A's scores is rejected with `403 Forbidden` at the route handler level. |
| `/api/judge/scores` | `GET` | Participant | Participant attempt to query judging scores is rejected with `403 Forbidden`. |
| `/api/judge/scores` | `POST` | Judge | Atomic, transactional rubric score submission. Upserts `Score` records and creates immutable `AuditLog` entry in one transaction. |
| `/api/export.csv` | `GET` | Organizer | Computes MAD-normalized scores across all criteria and tracks. Emits RFC 4180 compliant CSV (verified header comma). Rejected for judges/participants (`403`). |
| `/dashboard` | `GET` | Organizer | Live control tower: aggregate scoring progress, criteria distribution, track breakdown, real-time MAD leaderboard, audit log stream, **Community Voting Governance card** (total votes, unique voters, top 5 favorites, seal/unseal toggle). |
| `/judge` | `GET` | Judge | Scoring cockpit: assigned track selector, criteria slider inputs, composite calculation, instant score autosave. |
| `/api/community/vote` | `GET` | Any Auth | Returns `{ hasVoted, totalVotes }`. `totalVotes` is `null` for non-organizers while results are sealed (prevents bandwagon leakage). |
| `/api/community/vote` | `POST` | Any Auth | Toggles community upvote. Enforces self-vote block (`403` for team members), atomic upsert, and `COMMUNITY_VOTE_CAST` / `COMMUNITY_VOTE_RETRACTED` audit logging. |
| `/api/community/comments` | `GET` | Public | Fetches comments for a project with author role badges and timestamps. |
| `/api/community/comments` | `POST` | Any Auth | Posts a comment. Strips HTML, enforces 500-char limit, applies in-memory rate limiting, logs `COMMENT_POSTED` to `AuditLog`. |
| `/api/community/settings` | `GET` / `POST` | Organizer | Reads and toggles `Event.resultsPublic` and `Event.votingOpen` lifecycle flags. Non-organizers receive `403`. |

---

## 🛡️ Security & RBAC Boundary Architecture

A critical failure mode in hackathon portals is relying on front-end UI conditional rendering to hide unauthorized data. OmniJudge enforces strict, zero-trust security boundaries:

```
[ Incoming HTTP Request ]
           │
           ▼
[ src/lib/auth.ts: getSession() ]  ──► Validates Cookie session token against SQLite DB
           │
           ▼
[ Route Handler Parameter Guard ]
  ├─ session is null               ──► 401 Unauthorized
  ├─ session.role !== 'judge'      ──► 403 Forbidden
  └─ queryParam.judge !== ownId    ──► 403 Forbidden  (Prevents IDOR peer snooping)
           │
           ▼
[ Execute Scoped Prisma Query ]    ──► Queries ONLY WHERE judgeId == session.user.id
```

- **IDOR Protection:** The `?judge=<id>` query parameter is compared against the cryptographically resolved `session.userId`. Any discrepancy immediately terminates execution with `403 Forbidden`.
- **Role Isolation:** Participants cannot call judge endpoints or export routes; judges cannot access organizer exports or peer judge scores.

---

## 🧮 Judging Normalization (Modified Z-Score via MAD)

To counteract judge bias (hawks vs. doves, grade inflation, compression), OmniJudge implements **Modified Z-Score Normalization** based on the **Median Absolute Deviation (MAD)**:

$$\text{MAD} = \text{median}\left(|x_i - \text{median}(X)|\right)$$

$$\text{Modified Z} = \frac{0.6745 \cdot (x_i - \text{median}(X))}{\text{MAD}}$$

### Zero-Variance Fixture Protection
In fixture dataset `fixtures.json`, judge `jdg_30` (Rafa Okonkwo) gave identical scores across projects, causing $\text{MAD} = 0$. Standard normalization algorithms crash with division-by-zero or emit `NaN`. 

Our implementation (`src/lib/normalization.ts`) explicitly tests for $\text{MAD} == 0$ (or $< 10^{-9}$), safely defaulting the modified Z-score to `0.0`. This ensures deterministic leaderboard calculation and pristine CSV export.

---

## ⚖️ Honest Limitations & Design Trade-Offs

1. **SQLite Single-Writer Concurrency:**
   - *Why chosen:* Guarantees zero-network operation, zero-dependency deployment, and total isolation during evaluation without spinning up external database containers.
   - *Trade-off:* High write volume is serialized by SQLite write locks (`WAL` mode recommended in high-concurrency production).
   - *Production path:* Fully abstracted via Prisma ORM. Switching to PostgreSQL requires changing one line in `prisma/schema.prisma` (`provider = "postgresql"`). See [ARCHITECTURE.md](ARCHITECTURE.md) for details.

2. **Deterministic Seed Tokens:**
   - *Why chosen:* Mandated by the automated acceptance test suite (`Hack_docs/run.py` and `.dogfood.toml`).
   - *Production path:* Replace static seed session IDs with cryptographically random UUIDv4 or encrypted JWT tokens upon email magic link authentication.

---

## 📚 Technical Documentation Directory
 
- 📐 **[ARCHITECTURE.md](./ARCHITECTURE.md):** Deep-dive into Next.js App Router, offline resilience, RBAC parameter guards, and PostgreSQL migration guide.
- 🗄️ **[DATA-MODEL.md](./DATA-MODEL.md):** Detailed breakdown of all 13 Prisma models (including `CommunityVote` and `Comment`), Mermaid ER diagrams, fixture import mapping, and CSV/JSON export pathways.
- 📊 **[JUDGING.md](./JUDGING.md):** Judge assignment strategy (incomplete block design), scoring mathematics, Modified Z-Score (MAD) normalization, zero-variance defense, and RFC 4180 CSV export specifications.
- 🛡️ **[COMMUNITY_INTEGRITY.md](./COMMUNITY_INTEGRITY.md):** Complete T3 integrity specification — Sybil resistance, duplicate prevention, self-vote blocks, presentation bias mitigation, and the sealed-results threat model.
- 🔒 **[THREAT-MODEL.md](./THREAT-MODEL.md):** System trust boundaries, attacker profiles, threat taxonomy (V/J/C/A/D matrices), and security invariant summary.
- 🔌 **[API.md](./API.md):** Complete REST API specification with endpoints, request/response contracts, and error handling for API-first integration.
- 📄 **[acceptance-report.txt](./acceptance-report.txt):** Raw terminal output of the 7/7 passing acceptance test run (tier by tier).
- ⚖️ **[LICENSE](./LICENSE):** Standard MIT License.
