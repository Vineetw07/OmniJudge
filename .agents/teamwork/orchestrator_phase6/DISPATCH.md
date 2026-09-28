## 2026-09-28T12:31:13Z

You are the Project Orchestrator for Phase 6: Tier 3 (T3) Community Voting, Project Comments & Anti-Abuse Integrity on the OmniJudge hackathon portal.

Working directory: d:\TP\Hackathon\DogFood\.agents\teamwork\orchestrator_phase6
Project root: d:\TP\Hackathon\DogFood
Integrity mode: development

Please read:
- d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md (Phase 6 request under ## 2026-09-28T12:29:24Z)
- d:\TP\Hackathon\DogFood\PROGRESS.md
- d:\TP\Hackathon\DogFood\Hack_docs\spec.md
- d:\TP\Hackathon\DogFood\Hack_docs\run.py
- d:\TP\Hackathon\DogFood\.dogfood.toml

## Core Mission & Requirements
Deliver a tamper-proof, privacy-preserving community evaluation engine featuring randomized ballots, results-hidden windows, self-voting prevention, and audit-logged project discussions wrapped in the Midnight Obsidian Glass design system.

### R1. Data Model & Schema Migration (prisma/schema.prisma)
Extend Prisma schema with defensive community primitives:
- CommunityVote: id, projectId, userId, createdAt, with @unique([projectId, userId]) to guarantee database-level duplicate prevention; relations to Project and User.
- Comment: id, projectId, userId, authorName, content, createdAt, isFlagged (Boolean, default false); relations to Project and User.
- Event or SystemSettings: Add fields for voting lifecycle:
  - votingOpen (Boolean or comparison against votingCloseAt).
  - resultsPublic (Boolean, default false: results strictly redacted while voting is open).
- Apply migration via `npx prisma db push` or `npx prisma generate` without dropping seeded fixtures.

### R2. Anti-Abuse Protected API Endpoints
1. `POST /api/community/vote`:
   - Require authenticated session cookie.
   - Self-Vote Defense: Query TeamMember. If TeamMember.teamId === project.teamId, reject with 403 Forbidden ("Team members cannot vote for their own submission").
   - Duplicate Defense: Atomic upsert or unique check. Toggling vote (vote / unvote) allowed.
   - Audit Trail: Log action COMMUNITY_VOTE_CAST or COMMUNITY_VOTE_RETRACTED to AuditLog.
2. `GET /api/community/vote?projectId=<id>`:
   - Returns `{ hasVoted: boolean, totalVotes: number | null }`.
   - Sealed Results Invariant: totalVotes MUST be null for non-organizers while resultsPublic === false (prevent client-side inspection leakage).
3. `GET /api/community/comments?projectId=<id>` & `POST /api/community/comments`:
   - Sanitize content (strip HTML tags / trim length to <= 500 chars).
   - Basic rate limiting (prevent rapid-fire spamming).
   - Append to AuditLog (COMMENT_POSTED).

### R3. Ballot Randomization & Voting UX (/projects & Modal)
- Order Randomization: When viewing community voting ballot, randomize project display order per user session (Fisher-Yates or seeded shuffle) to neutralize "first-card presentation bias".
- Glass Voting Controls:
  - Upvote button on project cards with luminous emerald glow when active (`border-emerald-500/50 bg-emerald-500/10 text-emerald-400`).
  - Optimistic UI updates with autosave feedback.
  - Results Hidden Shield Badge: Display `🔒 Results sealed until voting window closes` in UI to demonstrate fairness to participants.

### R4. Project Feedback & Comment Stream
- Interactive collapsible comment drawer or modal on project cards.
- Clean Midnight Obsidian styling (`bg-white/[0.03] border-white/[0.08]`).
- Display author badge (`Participant`, `Judge`, `Visitor`) and relative timestamp.

### R5. Organizer Governance in Dashboard (/dashboard)
- Add a Community Voting Governance card in Organizer Control Tower:
  - Total community votes cast, unique voters count, and top 5 community favorites.
  - Toggle switch for organizer to seal / unseal public community results.
  - Audit log filtering for community voting actions.

### R6. Specification & Integrity Documentation
- Create `COMMUNITY_INTEGRITY.md` at repository root detailing:
  - Sybil resistance strategy, duplicate prevention, self-voting blocks, and presentation bias mitigation.
  - Results-hidden threat model (preventing bandwagon effects / social cascading).

## 🔄 Multi-Account Quota Switch & Resumption Invariant
1. Milestone Checkpointing: After finishing each milestone (M1 through M6), immediately update PROGRESS.md with completed items and commit to git (`git commit -m "[Phase 6] M<X>: <details>"`).
2. Explicit Resume State: Maintain current milestone status in PROGRESS.md ("Current phase: Phase 6 - M<X>") so an agent starting in a new account can run `Get-Content PROGRESS.md` and resume without re-doing or breaking previous work.
3. Continuous Green Baseline: Before and after any milestone edit, run `python Hack_docs/run.py .dogfood.toml` to ensure 7/7 PASS is preserved.

## Acceptance Criteria & Constraints
- `python Hack_docs/run.py .dogfood.toml` MUST remain 7/7 PASS (T1 + T2).
- Do NOT alter `.dogfood.toml`'s `claimed = ["T1", "T2"]` without verifying to avoid overclaim penalties.
- `/projects` (`src/app/projects/page.tsx`) MUST remain an async Server Component querying Prisma and rendering fixture project titles directly in the initial HTML body.
- 100% offline self-containment: local SQLite, local Geist typography, zero external CDN imports, remote font requests, or cloud APIs.
- Deterministic seed integrity preserved (no mutations to existing seed credentials organizer@dogfood.dev, judge_a@dogfood.dev, etc., or tokens in .dogfood.toml).
- Windows PowerShell 5.1 syntax compatibility: never use `&&` or `||`; run commands sequentially or use `$LASTEXITCODE` checks; pass non-interactive flags (`-y`, `-Force`).
- Verification Triad: `npm run typecheck`, `npm run lint`, `npm run build` must all pass cleanly (0 errors).
- Background daemon on port 8080 restarted and responsive.
- Atomic commit created after each milestone and at final completion.
