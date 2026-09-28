## 2026-09-28T13:23:17Z

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

You are Worker 6 (Specification, Integrity Documentation & Final QA Specialist) for Phase 6 Milestone 6 (M6: Specification & Integrity Documentation & Final Verification) on OmniJudge hackathon portal.
Your working directory is: d:\TP\Hackathon\DogFood\.agents\teamwork\worker_p6_m6
Project root: d:\TP\Hackathon\DogFood

Read:
- d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md (under ## 2026-09-28T12:29:24Z)
- d:\TP\Hackathon\DogFood\.agents\teamwork\orchestrator_phase6\SCOPE.md
- d:\TP\Hackathon\DogFood\PROGRESS.md
- d:\TP\Hackathon\DogFood\.agents\teamwork\worker_p6_m1\handoff.md
- d:\TP\Hackathon\DogFood\.agents\teamwork\worker_p6_m2\handoff.md
- d:\TP\Hackathon\DogFood\.agents\teamwork\worker_p6_m3_m4\handoff.md
- d:\TP\Hackathon\DogFood\.agents\teamwork\worker_p6_m5\handoff.md

Exclusive Write Ownership:
- `COMMUNITY_INTEGRITY.md` (at repository root `d:\TP\Hackathon\DogFood\COMMUNITY_INTEGRITY.md`)
- `PROGRESS.md`

Tasks:
1. Write `COMMUNITY_INTEGRITY.md` at repository root:
   - Comprehensive, publication-grade documentation covering:
     * 1. Architecture Overview: Tier 3 (T3) Community Voting and Feedback system within OmniJudge.
     * 2. Sybil Resistance & Duplicate Prevention: Composite unique database constraint `@unique([projectId, userId])` on `CommunityVote`, session authentication via HTTP-only cookies, atomic upsert / toggle vote semantics.
     * 3. Self-Voting Defense: Relational integrity check querying `TeamMember` and verifying `teamMember.teamId === project.teamId`, returning HTTP 403 Forbidden ("Team members cannot vote for their own submission").
     * 4. Presentation Bias Mitigation: Fisher-Yates per-session ballot order randomization neutralizing "first-card presentation bias", with `sessionStorage` stability and user-selectable sorting controls.
     * 5. Results-Hidden Threat Model: In-depth analysis of bandwagon effects, social cascading, and early-mover voting bias. Server-side redaction returning `totalVotes: null` to non-organizers while `resultsPublic === false`, and organizer unseal controls.
     * 6. Project Feedback & Discussion Integrity: HTML tag stripping sanitization, 500-character boundary limits, 10-second sliding-window per-user rate limit (429 Too Many Requests), author role badges, and immutable `AuditLog` records.
     * 7. Audit Trail & Transparency: Monospace terminal audit stream tracking `COMMUNITY_VOTE_CAST`, `COMMUNITY_VOTE_RETRACTED`, `COMMUNITY_SETTINGS_UPDATED`, and `COMMENT_POSTED`.
     * 8. Operational Runbook & Verification: Commands to run typecheck, lint, integration tests, and official acceptance suite.
2. Full End-to-End Verification Triad & Acceptance Suite:
   - Run `npm run typecheck` (must be 0 errors).
   - Run `npm run lint` (must be 0 errors/warnings).
   - Run `npm run build` (successful production build).
   - Verify server on port 8080 is healthy and responsive (restart if needed).
   - Run `python Hack_docs/run.py .dogfood.toml` (must be 7/7 PASS `claimed T1 T2, verified T1 T2`).
   - Run raw SSR HTML check on `http://localhost:8080/projects` confirming fixture project titles are present in the initial HTML body.
3. Update `PROGRESS.md`:
   - Mark Phase 6 checklist 100% complete (all Phase 6 items `[x]`).
   - Update header:
     `Current phase: Phase 6 Complete (T1 + T2 + T3 Community Voting & Anti-Abuse Integrity)`
     `Last completed task: Phase 6 Final Verification & Integrity Docs (7/7 PASS green)`
     `Next task: Project Complete / Submission`
   - Add new row to `Checker History` table with timestamp and `T1 PASS, T2 PASS (7/7)`.
   - Add session log entry in `Session Log`.
4. Git Commit:
   - Create atomic commit:
     `git add COMMUNITY_INTEGRITY.md PROGRESS.md; git commit -m "[Phase 6] M6: specification & integrity documentation (COMMUNITY_INTEGRITY.md) and final verification"`
5. Write detailed handoff report in `d:\TP\Hackathon\DogFood\.agents\teamwork\worker_p6_m6\handoff.md` and send message back to parent orchestrator.
