## 2026-09-28T13:14:13Z
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

You are Worker 5 (Organizer Governance Specialist) for Phase 6 Milestone 5 (M5: Organizer Governance in Dashboard) on OmniJudge hackathon portal.
Your working directory is: d:\TP\Hackathon\DogFood\.agents\teamwork\worker_p6_m5
Project root: d:\TP\Hackathon\DogFood

Read:
- d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md (under ## 2026-09-28T12:29:24Z)
- d:\TP\Hackathon\DogFood\.agents\teamwork\orchestrator_phase6\SCOPE.md
- d:\TP\Hackathon\DogFood\src\app\dashboard\page.tsx
- d:\TP\Hackathon\DogFood\src\app\dashboard\dashboard-client.tsx
- Existing API: `src/app/api/community/settings/route.ts`

Exclusive Write Ownership:
- `src/app/dashboard/page.tsx`
- `src/app/dashboard/dashboard-client.tsx`
- `PROGRESS.md`

Tasks:
1. In `src/app/dashboard/page.tsx` (Server Component):
   - Query Prisma for community statistics:
     * Total community votes: `await prisma.communityVote.count()`
     * Unique community voters count: `await prisma.communityVote.groupBy({ by: ['userId'] }).then(r => r.length)`
     * Top 5 community favorites: `await prisma.project.findMany({ select: { id: true, title: true, track: { select: { name: true } }, _count: { select: { communityVotes: true } } }, orderBy: { communityVotes: { _count: 'desc' } }, take: 5 })`
     * Voting lifecycle state from Event: `await prisma.event.findFirst({ select: { votingOpen: true, resultsPublic: true } })`
   - Pass these props cleanly into `<DashboardClient />`.
2. In `src/app/dashboard/dashboard-client.tsx`:
   - Design and render a "Community Voting Governance" card in the Organizer Control Tower matching the Midnight Obsidian Glass theme (`bg-[var(--glass-bg)] border-[var(--glass-border)] backdrop-blur-md rounded-2xl`):
     * Stat cards / metrics: Total Votes Cast, Unique Voters, Top Favorite.
     * Top 5 Community Favorites table with medals (🥇🥈🥉, #4, #5), project title, track, and vote count.
     * Toggle Controls:
       - Toggle switch for organizer to Seal / Unseal public community results (`resultsPublic`).
       - Toggle switch for organizer to Open / Close community voting (`votingOpen`).
       - Connect toggles to `POST /api/community/settings` with optimistic UI update and feedback.
     * Audit Log Filtering:
       - In the Audit Trail section, add filter tabs or pill selectors: `All Events`, `Judging Only`, `Community Voting`.
       - When `Community Voting` is selected, filter audit logs to show actions matching `COMMUNITY_VOTE_CAST`, `COMMUNITY_VOTE_RETRACTED`, `COMMUNITY_SETTINGS_UPDATED`, and `COMMENT_POSTED`.
3. Verification Triad & Acceptance Suite:
   - Run `npm run typecheck` (must be 0 errors).
   - Run `npm run lint` (must be 0 errors).
   - Run `npm run build` (successful production build).
   - Run `python Hack_docs/run.py .dogfood.toml` (must be 7/7 PASS green baseline).
   - Create a test script to verify that toggling settings via `/api/community/settings` updates the database and reflects in the dashboard.
4. Checkpoint & Git Commit:
   - Update `PROGRESS.md`: mark Phase 6 M5 completed, ready for M6.
   - Commit: `git add src/app/dashboard PROGRESS.md; git commit -m "[Phase 6] M5: community voting governance card, seal/unseal toggle, and audit filter in dashboard"`.
5. Write detailed handoff report in `d:\TP\Hackathon\DogFood\.agents\teamwork\worker_p6_m5\handoff.md` and send message back to parent orchestrator.
