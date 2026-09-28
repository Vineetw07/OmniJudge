# DOGFOOD 2026 Data Model & Entity Specifications

> **Complete reference documentation for the 14 Prisma database models, entity-relationship constraints, fixture mapping rules, and transactional audit architecture.**

---

## 1. Relational Architecture & Entity-Relationship Model

To make the database design immediately intuitive for evaluating judges, OmniJudge's 14 Prisma models are organized into **4 decoupled functional domains**:

```
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │                       OMNIJUDGE DOMAIN CLUSTERS                              │
 └──────────────────────────────────────────────────────────────────────────────┘
          │                                              │
          ▼                                              ▼
 ┌───────────────────────────┐                  ┌───────────────────────────┐
 │ 1. Identity & Teams       │                  │ 2. Event & Projects       │
 │ • User (Roles & Auth)     │                  │ • Event (Deadlines/State) │
 │ • Session (HTTP Cookies)  │                  │ • Track (Category Scopes) │
 │ • Team & TeamMember       │                  │ • Project (Submissions)   │
 └─────────────┬─────────────┘                  └─────────────┬─────────────┘
               │                                              │
               ├──────────────────────┬───────────────────────┤
               │                      │                       │
               ▼                      ▼                       ▼
 ┌───────────────────────────┐ ┌───────────────────────────┐ ┌───────────────────────────┐
 │ 3. Judging Engine (T2)    │ │ 4. Community Track (T3)   │ │ 5. Extensibility (T4)     │
 │ • JudgeAssignment (Tracks)│ │ • CommunityVote (Upvotes) │ │ • WebhookSubscription    │
 │ • RubricCriterion (Weights│ │ • Comment (Feedback)      │ │   (HMAC Event Stream)   │
 │ • Score (Atomic Reviews)  │ │ • AuditLog (Forensics)    │ │                           │
 └───────────────────────────┘ └───────────────────────────┘ └───────────────────────────┘
```

---

### 1.1 Complete Entity-Relationship Diagram (Mermaid ERD)

```mermaid
erDiagram
    %% ----------------------------------------------------
    %% CLUSTER 1: IDENTITY, SESSIONS & TEAM FORMATION
    %% ----------------------------------------------------
    User ||--o{ Session : "authenticates via (1:N)"
    User ||--o| TeamMember : "belongs to (1:1)"
    Team ||--|{ TeamMember : "comprises (1:N)"
    User ||--o{ AuditLog : "generates forensic log (1:N)"

    %% ----------------------------------------------------
    %% CLUSTER 2: EVENT HIERARCHY & PROJECT SUBMISSIONS
    %% ----------------------------------------------------
    Event ||--|{ Track : "partitions into (1:N)"
    Event ||--o{ Project : "hosts (1:N)"
    Track ||--o{ Project : "classifies (1:N)"
    Team ||--o{ Project : "submits (1:N)"

    %% ----------------------------------------------------
    %% CLUSTER 3: TIER 2 JUDGING & SCORING PIPELINE
    %% ----------------------------------------------------
    User ||--o{ JudgeAssignment : "assigned to evaluate (1:N)"
    Track ||--o{ JudgeAssignment : "scoped by (1:N)"
    User ||--o{ Score : "submits rubric score (1:N)"
    Project ||--o{ Score : "evaluated by (1:N)"
    RubricCriterion ||--o{ Score : "weighed against (1:N)"

    %% ----------------------------------------------------
    %% CLUSTER 4: TIER 3 COMMUNITY ENGAGEMENT & FEEDBACK
    %% ----------------------------------------------------
    User ||--o{ CommunityVote : "casts upvote (1:N)"
    Project ||--o{ CommunityVote : "receives upvote (1:N)"
    User ||--o{ Comment : "authors feedback (1:N)"
    Project ||--o{ Comment : "receives comment (1:N)"

    %% ----------------------------------------------------
    %% ENTITY DEFINITIONS & CORE ATTRIBUTES
    %% ----------------------------------------------------
    User {
        string id PK "cuid()"
        string email UK "RFC 5322"
        string name "Full Name"
        string role "visitor|participant|judge|organizer|admin"
        datetime createdAt
    }

    Session {
        string id PK "Deterministic token or UUID"
        string userId FK "-> User.id"
        datetime expiresAt "30-day forward expiry"
    }

    Event {
        string id PK "evt_..."
        string name "Event Title"
        datetime submissionsClose "Hard cutoff"
        boolean votingOpen "T3 Community toggle"
        boolean resultsPublic "T3 Sealed results toggle"
    }

    Track {
        string id PK "trk_..."
        string name "Track Title"
        string eventId FK "-> Event.id"
    }

    Team {
        string id PK "tm_..."
        string name "Team Name"
    }

    TeamMember {
        string id PK "cuid()"
        string userId FK "-> User.id (Unique 1-1)"
        string teamId FK "-> Team.id"
    }

    Project {
        string id PK "prj_..."
        string teamId FK "-> Team.id"
        string trackId FK "-> Track.id"
        string eventId FK "-> Event.id"
        string title "Project Title"
        string summary "Pitch summary"
        string repoUrl "Repository link"
        datetime submittedAt "Submission timestamp"
        boolean isDraft "Draft flag"
    }

    RubricCriterion {
        string id PK "cuid()"
        string name "e.g. Functionality, Quality"
        float weight "Rubric multiplier (default 1.0)"
        int maxScore "Scale ceiling (default 5)"
    }

    JudgeAssignment {
        string id PK "cuid()"
        string userId FK "-> User.id (Judge)"
        string trackId FK "-> Track.id (Assigned track)"
    }

    Score {
        string id PK "cuid()"
        string judgeId FK "-> User.id"
        string projectId FK "-> Project.id"
        string criterionId FK "-> RubricCriterion.id"
        float value "Raw rubric score (0.0 - 5.0)"
        string comment "Qualitative judge feedback"
        datetime submittedAt "ACID timestamp"
    }

    CommunityVote {
        string id PK "cuid()"
        string projectId FK "-> Project.id"
        string userId FK "-> User.id"
        datetime createdAt
    }

    Comment {
        string id PK "cuid()"
        string projectId FK "-> Project.id"
        string userId FK "-> User.id"
        string authorName "Sanitized author"
        string content "HTML-stripped (max 500 chars)"
        boolean isFlagged "Moderation flag"
        datetime createdAt
    }

    AuditLog {
        string id PK "cuid()"
        string userId FK "-> User.id"
        string action "e.g. score_submitted, vote_cast"
        string payload "JSON audit delta"
        datetime createdAt
    }

    WebhookSubscription {
        string id PK "cuid()"
        string url "Target HTTP endpoint"
        string secret "HMAC-SHA256 secret"
        string events "score.submitted,vote.cast,..."
        boolean isActive "Active toggle"
        datetime createdAt
    }
```

---

### 1.2 Domain Cluster & Relational Summary

| Cluster | Models | Key Relational Guarantees & Constraints |
| :--- | :--- | :--- |
| **1. Identity & Auth** | `User`, `Session`, `Team`, `TeamMember` | `TeamMember.userId` is `@unique` (enforces strict 1-user-per-team rule, enabling relational Conflict of Interest and self-vote defense). |
| **2. Event & Submissions** | `Event`, `Track`, `Project` | Hierarchical foreign keys bind projects to exact event and track instances; submission deadlines checked before insert. |
| **3. Tier 2 Judging** | `JudgeAssignment`, `RubricCriterion`, `Score` | Judges can only score projects within assigned tracks (`JudgeAssignment`); rubric scores are weighted by `RubricCriterion.weight`. |
| **4. Tier 3 Community** | `CommunityVote`, `Comment`, `AuditLog` | `CommunityVote` enforces `@@unique([projectId, userId])` to prevent double-voting; `Comment` enforces HTML sanitization & rate limits; `AuditLog` is append-only. |
| **5. Tier 4 Extensibility** | `WebhookSubscription` | Standalone integration model storing subscribed HTTP endpoints and pre-shared HMAC-SHA256 signing secrets. |

---

## 2. Comprehensive Model Catalog (All 13 Prisma Entities)

### 2.1 `User`
Represents an authenticated actor or pre-seeded persona within the hackathon portal.
- **Fields:**
  - `id`: `String` (Primary Key, `@default(cuid())`).
  - `email`: `String` (Unique constraint `@unique`).
  - `name`: `String` (Display name).
  - `role`: `String` (`"visitor"` | `"participant"` | `"judge"` | `"organizer"` | `"admin"`).
  - `createdAt`: `DateTime` (`@default(now())`).
- **Relations:**
  - `sessions`: `Session[]` (One-to-many).
  - `teamMember`: `TeamMember?` (One-to-one optional).
  - `judgeAssignments`: `JudgeAssignment[]` (One-to-many).
  - `scores`: `Score[]` (One-to-many).
  - `auditLogs`: `AuditLog[]` (One-to-many).

### 2.2 `Session`
Stores active login sessions and deterministic tokens matching `.dogfood.toml`.
- **Fields:**
  - `id`: `String` (Primary Key, holds token string, e.g. `"org_seed_token_2026"`).
  - `userId`: `String` (Foreign key to `User.id`).
  - `createdAt`: `DateTime` (`@default(now())`).
  - `expiresAt`: `DateTime` (Expiration timestamp; expired sessions reject with `401`).
- **Relations:**
  - `user`: `User` (Belongs to User).

### 2.3 `Event`
Defines the hackathon lifecycle, track scopes, and submission cutoffs.
- **Fields:**
  - `id`: `String` (Primary Key, e.g. `"evt_dogfood_2026"`).
  - `name`: `String` (Event title).
  - `submissionsClose`: `DateTime` (Enforces hard deadline in `POST /api/projects`).
  - `createdAt`: `DateTime` (`@default(now())`).
- **Relations:**
  - `tracks`: `Track[]` (One-to-many).
  - `projects`: `Project[]` (One-to-many).

### 2.4 `Track`
Domain track under an event (e.g. Developer Tools, AI Agents, Infrastructure).
- **Fields:**
  - `id`: `String` (Primary Key, e.g. `"trk_dev_tools"`).
  - `name`: `String` (Track title).
  - `eventId`: `String` (Foreign key to `Event.id`).
- **Relations:**
  - `event`: `Event` (Belongs to Event).
  - `projects`: `Project[]` (One-to-many).
  - `judgeAssignments`: `JudgeAssignment[]` (One-to-many).

### 2.5 `Team`
Groups participants submitting a project.
- **Fields:**
  - `id`: `String` (Primary Key, e.g. `"team_alpha"`).
  - `name`: `String` (Team name).
- **Relations:**
  - `members`: `TeamMember[]` (One-to-many).
  - `projects`: `Project[]` (One-to-many).

### 2.6 `TeamMember`
Join entity binding a `User` to a `Team`.
- **Fields:**
  - `id`: `String` (Primary Key, `@default(cuid())`).
  - `userId`: `String` (Foreign key to `User.id`, `@unique` constraint enforces 1 team per user).
  - `teamId`: `String` (Foreign key to `Team.id`).
- **Relations:**
  - `user`: `User` (Belongs to User).
  - `team`: `Team` (Belongs to Team).

### 2.7 `Project`
The core submission entity rendered in the public gallery and evaluated by judges.
- **Fields:**
  - `id`: `String` (Primary Key, e.g. `"proj_01"`).
  - `teamId`: `String` (Foreign key to `Team.id`).
  - `trackId`: `String` (Foreign key to `Track.id`).
  - `eventId`: `String` (Foreign key to `Event.id`).
  - `title`: `String` (Project title, checked by acceptance test for `"Glass Signal"`, etc.).
  - `summary`: `String` (Short pitch or description).
  - `repoUrl`: `String` (Git repository link).
  - `submittedAt`: `DateTime` (Timestamp of project submission).
  - `isDraft`: `Boolean` (`@default(false)`).
- **Relations:**
  - `team`: `Team` (Belongs to Team).
  - `track`: `Track` (Belongs to Track).
  - `event`: `Event` (Belongs to Event).
  - `scores`: `Score[]` (One-to-many).

### 2.8 `RubricCriterion`
Weighted scoring criteria created by organizers.
- **Fields:**
  - `id`: `String` (Primary Key, `@default(cuid())`).
  - `name`: `String` (Criterion name, e.g. `"functionality"`, `"quality"`).
  - `weight`: `Float` (`@default(1.0)`).
  - `maxScore`: `Int` (`@default(5)`).
- **Relations:**
  - `scores`: `Score[]` (One-to-many).

### 2.9 `JudgeAssignment`
Explicit assignment of a judge to evaluate projects in a specific `Track`.
- **Fields:**
  - `id`: `String` (Primary Key, `@default(cuid())`).
  - `userId`: `String` (Foreign key to `User.id`).
  - `trackId`: `String` (Foreign key to `Track.id`).
- **Relations:**
  - `user`: `User` (Belongs to User).
  - `track`: `Track` (Belongs to Track).

### 2.10 `Score`
An individual numerical evaluation given by a judge on a specific project criterion.
- **Fields:**
  - `id`: `String` (Primary Key, `@default(cuid())`).
  - `judgeId`: `String` (Foreign key to `User.id`).
  - `projectId`: `String` (Foreign key to `Project.id`).
  - `criterionId`: `String` (Foreign key to `RubricCriterion.id`).
  - `value`: `Float` (Numerical score between 0.0 and 5.0).
  - `comment`: `String` (`@default("")`).
  - `submittedAt`: `DateTime` (`@default(now())`).
- **Relations:**
  - `judge`: `User` (Belongs to User).
  - `project`: `Project` (Belongs to Project).
  - `criterion`: `RubricCriterion` (Belongs to RubricCriterion).

### 2.11 `AuditLog`
Append-only tamper-evident security audit ledger.
- **Fields:**
  - `id`: `String` (Primary Key, `@default(cuid())`).
  - `userId`: `String` (Foreign key to `User.id`).
  - `action`: `String` (e.g. `"SUBMIT_SCORE"`, `"LOGIN"`).
  - `payload`: `String` (`@default("{}")`, JSON serialized metadata).
  - `createdAt`: `DateTime` (`@default(now())`).
- **Relations:**
  - `user`: `User` (Belongs to User).

---

## 2.12 `CommunityVote` *(Phase 6 — T3)*
Records a single community upvote from an authenticated user on a specific project.
- **Fields:**
  - `id`: `String` (Primary Key, `@default(cuid())`).
  - `projectId`: `String` (FK → `Project.id`).
  - `userId`: `String` (FK → `User.id`).
  - `createdAt`: `DateTime` (`@default(now())`).
- **Constraints:**
  - `@@unique([projectId, userId])` — **Database-level duplicate prevention.** A user can cast at most one upvote per project. Attempting a second insert is caught at the Prisma layer before a 409 is returned.
- **Anti-abuse invariants enforced at API layer (`POST /api/community/vote`):**
  - Self-vote check against `TeamMember`: if the voter's `teamId === project.teamId`, the request is rejected with `403 Forbidden`.
  - Toggling: if a `CommunityVote` already exists for `(projectId, userId)`, it is deleted (unvote); otherwise it is created (vote).
  - Each change appends `COMMUNITY_VOTE_CAST` or `COMMUNITY_VOTE_RETRACTED` to `AuditLog`.

### 2.13 `Comment` *(Phase 6 — T3)*
A community-authored text comment on a project submission.
- **Fields:**
  - `id`: `String` (Primary Key, `@default(cuid())`).
  - `projectId`: `String` (FK → `Project.id`).
  - `userId`: `String` (FK → `User.id`).
  - `authorName`: `String` (Display name at time of posting).
  - `content`: `String` (Sanitized plain text, max 500 chars, HTML stripped server-side).
  - `createdAt`: `DateTime` (`@default(now())`).
  - `isFlagged`: `Boolean` (`@default(false)`) — reserved for organizer moderation.
- **API safeguards (`POST /api/community/comments`):**
  - All HTML tags are stripped via regex before storage (XSS prevention).
  - Length is clamped to 500 characters.
  - In-memory rate limiting (one request per 10 seconds per userId) prevents rapid-fire spam.
  - Each successful post appends `COMMENT_POSTED` to `AuditLog`.

### 2.14 `Event` — Voting Lifecycle Fields *(Phase 6 — T3)*
Two fields were added to the existing `Event` model to power community voting state:
- `votingOpen`: `Boolean` (`@default(false)`) — controlled by organizer via `PATCH /api/community/settings`.
- `resultsPublic`: `Boolean` (`@default(false)`) — when `false`, `GET /api/community/vote` returns `totalVotes: null` for all non-organizer roles, eliminating bandwagon bias and social cascading during the voting window.

### 2.15 `WebhookSubscription` *(Tier 4 — Stretch Surface)*
Stores registered webhook endpoints for external notification dispatch:
- **Fields:**
  - `id`: `String` (Primary Key, `@default(cuid())`).
  - `url`: `String` (Target HTTP endpoint for POST payload delivery).
  - `secret`: `String` (Random hex string used to compute HMAC-SHA256 signature headers).
  - `events`: `String` (Comma-separated event topics, e.g. `"score.submitted,vote.cast,results.unsealed"`).
  - `isActive`: `Boolean` (`@default(true)`).
  - `createdAt`: `DateTime` (`@default(now())`).
- **Security & Integrity:**
  - Managed exclusively by `organizer` role via `GET`, `POST`, and `DELETE` at `/api/webhooks`.
  - Secret is masked (`whsec_****...`) upon retrieval to prevent secret leakage.
  - Non-blocking asynchronous dispatch with 4-second timeout.

---

## 3. Fixture Ingestion & Mapping (`fixtures.json`)

The seed pipeline (`src/lib/seed.ts`) parses `Hack_docs/fixtures.json` and loads it into the database with idempotent upsert operations:

| JSON Key in `fixtures.json` | Target Prisma Model | Field Transformations & Ingestion Logic |
| :--- | :--- | :--- |
| `event` | `Event` | `id` $\rightarrow$ `id`<br>`name` $\rightarrow$ `name`<br>`submissions_close` $\rightarrow$ `submissionsClose` (`new Date(...)`) |
| `tracks[]` | `Track` | `id` $\rightarrow$ `id`<br>`name` $\rightarrow$ `name`<br>`eventId` bound to `event.id` |
| `teams[]` | `Team` | `id` $\rightarrow$ `id`<br>`name` $\rightarrow$ `name` |
| `projects[]` | `Project` | `id` $\rightarrow$ `id`<br>`title` $\rightarrow$ `title` (e.g. "Glass Signal")<br>`summary` $\rightarrow$ `summary`<br>`repo_url` $\rightarrow$ `repoUrl`<br>`track_id` $\rightarrow$ `trackId`<br>`team_id` $\rightarrow$ `teamId`<br>`submitted_at` $\rightarrow$ `submittedAt` |
| `judges[]` | `User` + `JudgeAssignment` | Created as `role: "judge"`. Each entry in `assigned_tracks[]` generates a `JudgeAssignment` record. |
| Hardcoded Test Suite | `User` + `Session` | Injects deterministic tokens for `organizer`, `judge_a`, `judge_b`, and `participant` with 30-day forward expiry. |

---

## 4. Transactional Score Submission & Audit Architecture

When a judge scores a project via `POST /api/judge/scores`:
```typescript
await prisma.$transaction(async (tx) => {
  // 1. Verify judge jurisdiction on project's track
  const assignment = await tx.judgeAssignment.findFirst({
    where: { userId: session.id, trackId: project.trackId },
  });
  if (!assignment) throw new Error('Not assigned to track');

  // 2. Conflict of interest defense: ensure judge is not a member of submitting team
  const isTeamMember = await tx.teamMember.findFirst({
    where: { userId: session.id, teamId: project.teamId },
  });
  if (isTeamMember) throw new Error('Conflict of interest');

  // 3. Atomic upsert of all rubric criteria
  for (const s of scores) {
    await tx.score.upsert({
      where: { /* judgeId_projectId_criterionId */ },
      create: { judgeId: session.id, projectId, criterionId: s.criterionId, value: s.value },
      update: { value: s.value, submittedAt: new Date() }
    });
  }

  // 4. Record immutable audit record
  await tx.auditLog.create({
    data: {
      userId: session.id,
      action: 'score_submitted',
      payload: JSON.stringify({ projectId, scores, comment }),
    }
  });
});
```
This guarantees ACID atomicity: an evaluation either fully persists with its accompanying audit trail, or fails completely without corrupting aggregate statistics.

---

## 5. Data Export Paths & Schema Transformations

DOGFOOD 2026 provides structured export pathways translating relational models into standardized deliverables:

### 5.1 RFC 4180 CSV Export Pipeline (`GET /api/export.csv`)
Restricted strictly to the `organizer` role. It joins `Project`, `Track`, `Score`, and `RubricCriterion`, transforms them through the normalization engine, and serializes to CSV:

```
[ Relational Database (Prisma) ]
  ├─ Project (id, title)
  ├─ Track (name)
  ├─ RubricCriterion (id, weight)
  └─ Score (judgeId, projectId, criterionId, value)
                 │
                 ▼
[ Transformation & Normalization Pipeline ]
  1. Rubric Weighting:  Composite_Raw = Σ (Value_c × Weight_c) / Σ Weight_c
  2. MAD Normalization: Modified_Z = 0.6745 × (Composite_Raw - Median) / MAD
  3. Cross-Judge Mean:  Project_Avg_Raw = Mean(Composite_Raw)
                        Project_Avg_Norm = Mean(Modified_Z)
  4. Ranking Sort:      Status Invariant (reviewed outranks unreviewed),
                        then NormalizedScore DESC (ε = 1e-9 tolerance),
                        then RawScore DESC, then ID ASC
                 │
                 ▼
[ RFC 4180 & CWE-1236 CSV Output Stream ]
  MIME: text/csv; charset=utf-8
  Content-Disposition: attachment; filename="omnijudge_scores.csv"
```

#### CSV Column Mapping Schema
| CSV Column Name | Source Prisma Model / Field | Transformation / Serialization Rule |
| :--- | :--- | :--- |
| `project_id` | `Project.id` | RFC 4180 quoted string escape with CWE-1236 sanitization |
| `project_title` | `Project.title` | RFC 4180 quoted string escape with CWE-1236 sanitization |
| `track` | `Track.name` (via `Project.trackId`) | Defaults to `'General'` if unassigned; quoted with CWE-1236 sanitization |
| `raw_score` | Derived from `Score.value` | Weighted arithmetic mean, fixed to 2 decimals (`.toFixed(2)`) |
| `normalized_score` | Derived via `normaliseAllJudges()` | Cross-judge average Modified Z-score, fixed to 4 decimals (`.toFixed(4)`) |
| `rank` | Computed ordinal rank | 1-based sequential integer ($1, 2, 3, ...$) |

### 5.2 JSON Real-Time Analytics Export (`GET /dashboard`)
Used by organizer Server Components to stream live data:
- **Judge Completion Rates:** Aggregates `Score.count` grouped by `judgeId` against `Project.count` for assigned tracks.
- **Audit Stream:** Chronological feed of `AuditLog` rows sorted by `createdAt DESC`.
- **Live Leaderboard:** Real-time normalized ranking updating with each submitted evaluation.

### 5.3 Full Platform JSON Backup Export (`GET /api/export.json`) *(Tier 4 — Stretch Surface)*
Restricted strictly to the `organizer` role. Provides a self-contained, lossless JSON backup:
- **Payload Schema:**
  - `exportedAt`: ISO 8601 UTC timestamp.
  - `event`: Event metadata (`id`, `name`, `submissionsClose`).
  - `tracks`: Complete list of tracks and assignments.
  - `teams`: All registered teams and member lists.
  - `rubricCriteria`: Defined criteria, weights, and max scores.
  - `projects`: Submissions with track and team IDs.
  - `leaderboard`: Full MAD-normalized ranking identical to the CSV export engine.
  - `scores`: Raw evaluations per judge, project, and criterion.
- **Use Cases:** Platform-to-platform migration, external Discord/Slack bot integration, long-term archival.

### 5.4 Bulk Fixture Import & Ingestion Pipeline (`POST /api/import`) *(Tier 4 — Stretch Surface)*
Restricted strictly to the `organizer` role. Supports transactional bulk updates:
- **Validation:** Strict runtime parsing via Zod (`BulkImportPayloadSchema`).
- **Idempotent Upsert:** Employs `prisma.$transaction` to upsert tracks, teams, projects, and criteria without dropping existing audit trails or foreign key constraints.
- **Interoperability:** Accepts both official `Hack_docs/fixtures.json` structure and platform JSON exports from `/api/export.json`.

