# BRIEFING — 2026-09-27T08:38:40Z

## Mission
Investigate database state, seeded data, auth helpers, login requirements, and .dogfood.toml specifications.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_phase2_2
- Original parent: 186d10b4-86b5-46d2-b95c-554f456fd6cf
- Milestone: phase2_investigation

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Inspect database state, seeded data, auth helpers, login requirements, and .dogfood.toml specifications
- Output handoff report to .agents/teamwork/explorer_phase2_2/handoff.md adhering to 5-component protocol

## Current Parent
- Conversation ID: 186d10b4-86b5-46d2-b95c-554f456fd6cf
- Updated: 2026-09-27T08:38:40Z

## Investigation State
- **Explored paths**:
  - `src/lib/auth.ts`: Reviewed `SessionUser`, `getSession`, role guards
  - `src/lib/seed.ts`: Identified seed logic and `TEST_USERS`
  - `prisma/schema.prisma`: Examined models `User`, `Session`, `Event`, `Project`, etc.
  - `Hack_docs/fixtures.json`: Reviewed 41 projects, tracks, 30 fixture judges
  - `Hack_docs/example.dogfood.toml` & `Hack_docs/run.py`: Analyzed check logic for T1/T2
  - SQLite DB `prisma/dogfood.db`: Executed direct queries on users, sessions, events, projects
- **Key findings**:
  - Exact Judge A credentials: email `judge_a@dogfood.dev`, user ID `user_jdg_a_01`, session token `jdg_a_seed_token_2026`
  - Exact Judge B credentials: email `judge_b@dogfood.dev`, user ID `user_jdg_b_01`, session token `jdg_b_seed_token_2026`
  - Exact Organizer credentials: email `organizer@dogfood.dev`, user ID `user_org_01`, token `org_seed_token_2026`
  - Exact Participant credentials: email `participant@dogfood.dev`, user ID `user_prt_01`, token `prt_seed_token_2026`
  - `getSession()` in `auth.ts` extracts `session` cookie or raw header, queries `prisma.session` by ID (token) and validates expiration
  - `POST /api/auth/login` must validate email via Zod, query DB by email, return 401 on unknown email, retrieve/create session token, set `session` cookie
  - `.dogfood.toml` exact structure defined with `peer_scores = "/api/judge/scores?judge=user_jdg_a_01"` and claimed tiers explained
- **Unexplored areas**: None for this investigation phase.

## Key Decisions Made
- Documented both `claimed = ["T1"]` (to avoid unverified T2 note during Phase 2) and `claimed = ["T1", "T2"]`
- Completed investigation and authored `handoff.md`

## Artifact Index
- handoff.md — Complete 5-component handoff report
- progress.md — Step tracking and liveness heartbeat
- DISPATCH.md — Initial dispatch log
