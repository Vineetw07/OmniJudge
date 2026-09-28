# Scope: Phase 6 — Tier 3 (T3) Community Voting, Project Comments & Anti-Abuse Integrity

## Architecture
- **Data Layer**: Prisma ORM with SQLite database. Extended with CommunityVote, Comment, and Event voting lifecycle flags.
- **API Boundary**: Next.js 14 App Router route handlers (`/api/community/vote`, `/api/community/comments`, `/api/community/settings`).
  - Strict session authentication via `getSession(req)`.
  - Self-voting prevention via `TeamMember` query.
  - Rate limiting & duplicate prevention via atomic database operations.
  - Sealed results invariant: non-organizers receive `totalVotes: null` when `resultsPublic === false`.
  - Immutable audit trail via `AuditLog` records.
- **Frontend Layer**:
  - `/projects`: Server Component queries Prisma for fixture projects; `ProjectsClient` island provides session-randomized ballots (Fisher-Yates) and glass voting controls with optimistic updates.
  - Comment stream drawer/modal on project cards with role badges and sanitized submissions.
  - `/dashboard`: Organizer Control Tower card with community KPIs, seal/unseal toggle, and audit trail filter.
- **Documentation & Invariants**:
  - `COMMUNITY_INTEGRITY.md`: Sybil resistance, duplicate defense, self-voting blocks, presentation bias mitigation, results-hidden threat model.
  - Baseline invariant: `python Hack_docs/run.py .dogfood.toml` (7/7 PASS) preserved across all steps.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Prisma Schema Migration | CommunityVote, Comment, Event.votingOpen, Event.resultsPublic | M1 | R1 |
| 2 | POST /api/community/vote | Authenticated voting, self-vote defense, toggle vote, audit logging | M2 | R2.1 |
| 3 | GET /api/community/vote | Return hasVoted and totalVotes (redacted to null if resultsPublic false) | M2 | R2.2 |
| 4 | GET & POST /api/community/comments | Sanitized input (<=500 chars), rate limit, audit logging | M2 | R2.3 |
| 5 | Ballot Randomization UX | Fisher-Yates per-session order, emerald glow upvote, sealed results badge | M3 | R3 |
| 6 | Comment Stream & Drawer | Collapsible obsidian drawer, author badges (Participant/Judge/Visitor), timestamps | M4 | R4 |
| 7 | Organizer Governance Card | Community stats (total votes, unique voters, top 5), seal toggle, audit filter | M5 | R5 |
| 8 | COMMUNITY_INTEGRITY.md | Integrity documentation & threat model | M6 | R6 |
| 9 | Verification Triad & Checker | Typecheck, lint, build, 7/7 run.py PASS, atomic git commits | M1-M6 | Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Data Model & Schema | Add models to schema.prisma, run prisma db push / generate without data loss | None | DONE |
| 2 | M2: Anti-Abuse APIs | Implement /api/community/vote and /api/community/comments with guards | M1 | DONE |
| 3 | M3: Ballot Randomization & Voting UX | Update /projects and projects-client.tsx with shuffle & upvoting | M2 | DONE |
| 4 | M4: Project Comments Drawer | Add collapsible comments drawer with role badges and posting | M2 | DONE |
| 5 | M5: Dashboard Governance | Add community voting card, stats, seal/unseal toggle in /dashboard | M2 | DONE |
| 6 | M6: Spec Docs & Full E2E Verification | Write COMMUNITY_INTEGRITY.md, run triad, verify 7/7 checker, git commit | M1-M5 | DONE |

## Interface Contracts
### Vote API
- `POST /api/community/vote`: Body `{ projectId: string }`
  - Headers: `Cookie: session=...`
  - Response: `{ success: boolean, hasVoted: boolean, message?: string }`
  - Status 200 on success, 401 unauthenticated, 403 on self-vote, 400 on invalid input, 404 on project not found.
- `GET /api/community/vote?projectId=<id>`:
  - Response: `{ hasVoted: boolean, totalVotes: number | null, votingOpen: boolean, resultsPublic: boolean }`

### Comments API
- `POST /api/community/comments`: Body `{ projectId: string, content: string }`
  - Response: `{ success: boolean, comment: Comment }`
- `GET /api/community/comments?projectId=<id>`:
  - Response: `{ comments: Array<{ id, authorName, content, createdAt, authorRole }> }`
