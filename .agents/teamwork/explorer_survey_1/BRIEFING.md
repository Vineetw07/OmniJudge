# BRIEFING — 2026-09-27T09:43:00Z

## Mission
Investigate existing source code and database schema for Phase 3 (T2 Judging) of DOGFOOD 2026: auth, seed/prisma, schema.prisma, existing routes, and identify gaps/helper utilities.

## 🔒 My Identity
- Archetype: explorer
- Roles: Codebase & Database Schema Explorer
- Working directory: d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_survey_1
- Original parent: 11b8f726-9a5b-4133-ab58-3e8b73870dcf
- Milestone: Phase 3 (T2 Judging)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Touch only explorer_survey_1 directory for agent files
- Evidence chain completeness: exact file paths and line numbers
- 5-component handoff report

## Current Parent
- Conversation ID: 11b8f726-9a5b-4133-ab58-3e8b73870dcf
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `src/lib/auth.ts`: Authentication, session resolution, expiry validation, role guards
  - `src/lib/seed.ts` & `src/lib/prisma.ts`: Seed users, test tokens, fixture projects, criteria, scores
  - `prisma/schema.prisma`: All 11 models, types, relations, defaults, constraints
  - `src/app/**`: Existing routes (`/api/auth/login`, `/api/projects`, `/login`, `/projects`, `/`)
  - `Hack_docs/run.py` & `.dogfood.toml`: T2 acceptance test mechanics
  - Database verification: 34 users, 41 projects, 252 scores, 4 rubric criteria, 0 audit logs
- **Key findings**:
  - `src/lib/auth.ts` has `getSession(req: NextRequest)` with cookie regex fallback, expiry check, returns role and judgeId. Missing Server Component session reader (`getServerSession` via `cookies()`).
  - `prisma/schema.prisma`: Models exist, but `Score` lacks composite unique constraint on `[judgeId, projectId, criterionId]`, requiring application-level upsert handling. `JudgeAssignment` has no composite unique constraint on `[userId, trackId]`.
  - Phase 3 routes (`/api/judge/scores`, `/api/export.csv`) and pages (`/judge`, `/dashboard`) do not exist yet.
  - `run.py` T2 tests: `judge sees own scores` (GET /api/judge/scores with judge_a), `judge cannot see peer scores` (GET /api/judge/scores?judge=user_jdg_a_01 with judge_b -> 403), `participant blocked` (GET /api/judge/scores with participant -> 403), `csv export works` (GET /api/export.csv with organizer -> 200, comma in first line).
- **Unexplored areas**: None within the survey scope.

## Key Decisions Made
- Confirmed full readiness for Phase 3 architecture and implementation
- Identified need for `getServerSession` helper for Server Component pages
- Documented composite upsert requirement for `Score`

## Artifact Index
- DISPATCH.md — Dispatch log
- progress.md — Heartbeat progress log
- handoff.md — Final handoff report
