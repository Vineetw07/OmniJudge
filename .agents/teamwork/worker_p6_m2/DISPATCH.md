## 2026-09-28T12:50:52Z

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

You are Worker 2 for Phase 6 Milestone 2 (M2: Anti-Abuse Protected API Endpoints) on OmniJudge hackathon portal.
Your working directory is: d:\TP\Hackathon\DogFood\.agents\teamwork\worker_p6_m2
Project root: d:\TP\Hackathon\DogFood

Read:
- d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md (under ## 2026-09-28T12:29:24Z)
- d:\TP\Hackathon\DogFood\.agents\teamwork\orchestrator_phase6\SCOPE.md
- d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_p6_m1_3\handoff.md (detailed API design)
- d:\TP\Hackathon\DogFood\src\lib\auth.ts
- d:\TP\Hackathon\DogFood\src\lib\prisma.ts

Exclusive Write Ownership:
- `src/app/api/community/vote/route.ts`
- `src/app/api/community/comments/route.ts`
- `src/app/api/community/settings/route.ts` (or toggle route if needed for organizer settings)
- `PROGRESS.md`

Tasks:
1. Implement `POST /api/community/vote`:
   - Authenticate session using `getSession(req)`. Return 401 if null.
   - Body parsing: `{ projectId: string }`. Return 400 if invalid/missing.
   - Check voting lifecycle: Query `prisma.event.findFirst()`. If `event?.votingOpen === false`, return 403 Forbidden ("Community voting is currently closed").
   - Find project: `prisma.project.findUnique({ where: { id: projectId } })`. Return 404 if not found.
   - Self-Vote Defense: Query `prisma.teamMember.findUnique({ where: { userId: session.id } })`. If `teamMember && teamMember.teamId === project.teamId`, return 403 Forbidden ("Team members cannot vote for their own submission").
   - Duplicate / Toggle Defense: Query existing vote `prisma.communityVote.findUnique({ where: { projectId_userId: { projectId, userId: session.id } } })`.
     * If exists: delete vote, log `COMMUNITY_VOTE_RETRACTED` to `AuditLog` (`action: "COMMUNITY_VOTE_RETRACTED"`, `userId: session.id`, `payload: JSON.stringify({ projectId })`), return `{ success: true, hasVoted: false, message: "Vote retracted" }`.
     * If not exists: create vote, log `COMMUNITY_VOTE_CAST` to `AuditLog` (`action: "COMMUNITY_VOTE_CAST"`, `userId: session.id`, `payload: JSON.stringify({ projectId })`), return `{ success: true, hasVoted: true, message: "Vote cast" }`.
2. Implement `GET /api/community/vote`:
   - URL query parameter: `?projectId=<id>`.
   - Query session via `getSession(req)`.
   - If session exists and `projectId` provided, check if user has voted: `prisma.communityVote.findUnique({ where: { projectId_userId: { projectId, userId: session.id } } })` -> `hasVoted: !!existingVote`.
   - Query `prisma.event.findFirst()`.
   - Sealed Results Invariant:
     * If `event?.resultsPublic === true` OR `session?.role === 'organizer'` OR `session?.role === 'admin'`:
       Count total votes: `await prisma.communityVote.count({ where: { projectId } })` -> `totalVotes: count`.
     * Else: `totalVotes: null` (strictly null for non-organizers while resultsPublic is false to prevent client-side inspection leakage).
   - Return `{ hasVoted, totalVotes, votingOpen: event?.votingOpen ?? true, resultsPublic: event?.resultsPublic ?? false }`.
   - Also allow query without `projectId` (e.g. for organizer dashboard list or user votes set) if useful.
3. Implement `POST /api/community/comments`:
   - Authenticate session using `getSession(req)`. Return 401 if null.
   - Body parsing: `{ projectId: string, content: string }`.
   - Content sanitization: strip HTML tags (`content.replace(/<[^>]*>/g, '').trim()`), validate length `<= 500` characters. Return 400 if empty or over 500 chars.
   - Rate limiting: Check if user submitted a comment within the last 10 seconds:
     `prisma.comment.findFirst({ where: { userId: session.id, createdAt: { gte: new Date(Date.now() - 10000) } } })`. If found, return 429 Too Many Requests ("Rate limit exceeded. Please wait a few seconds before commenting again.").
   - Create comment: `prisma.comment.create({ data: { projectId, userId: session.id, authorName: session.name || session.email, content: sanitizedContent } })`.
   - Append to AuditLog: `prisma.auditLog.create({ data: { userId: session.id, action: "COMMENT_POSTED", payload: JSON.stringify({ projectId, commentId: comment.id }) } })`.
   - Return `{ success: true, comment }`.
4. Implement `GET /api/community/comments`:
   - URL query parameter: `?projectId=<id>`.
   - Query comments: `prisma.comment.findMany({ where: { projectId, isFlagged: false }, orderBy: { createdAt: 'desc' }, include: { user: { select: { role: true, name: true } } } })`.
   - Map to clean payload including authorRole (`user.role`), authorName, content, createdAt.
   - Return `{ success: true, comments }`.
5. Implement `POST /api/community/settings` (or organizer toggle handler):
   - Organizer/admin only (return 403 otherwise).
   - Allows toggling `resultsPublic` (boolean) and `votingOpen` (boolean) on `Event`.
   - Logs `COMMUNITY_SETTINGS_UPDATED` to `AuditLog`.
6. Testing & Triad Verification:
   - Create and run an integration test script verifying:
     * Unauthenticated request to vote POST returns 401.
     * Participant voting on own project (`user_prt_01` on `prj_01` which belongs to `tm_01`) returns 403 Forbidden with exact message.
     * Participant voting on peer project (`prj_02`) returns 200 and `{ hasVoted: true }`.
     * Toggling vote on `prj_02` returns 200 and `{ hasVoted: false }`.
     * `AuditLog` records created for `COMMUNITY_VOTE_CAST` and `COMMUNITY_VOTE_RETRACTED`.
     * Sealed results check: `GET /api/community/vote?projectId=prj_02` as participant returns `totalVotes: null`. As organizer returns numeric `totalVotes`.
     * Comment posting sanitizes HTML tags (`<script>` removed), rejects >500 chars, rate limits duplicate posting within 10s (429), and creates `COMMENT_POSTED` audit log.
   - Clean up test votes/comments after test execution.
   - Run `npm run typecheck` (0 errors).
   - Run `npm run lint` (0 errors).
   - Run `npm run build` (success).
   - Run `python Hack_docs/run.py .dogfood.toml` (7/7 PASS green baseline).
7. Checkpoint & Git Commit:
   - Update `PROGRESS.md`: mark Phase 6 M2 completed, ready for M3.
   - Commit: `git add src/app/api/community PROGRESS.md; git commit -m "[Phase 6] M2: anti-abuse community voting and comment APIs with self-vote blocks, sealed results, and rate limiting"`.
8. Write detailed handoff report in `d:\TP\Hackathon\DogFood\.agents\teamwork\worker_p6_m2\handoff.md` and send message back to parent orchestrator.
