## 2026-09-28T12:38:07Z

You are Worker 1 for Phase 6 Milestone 1 (M1: Data Model & Schema Migration) on OmniJudge hackathon portal.
Your working directory is: d:\TP\Hackathon\DogFood\.agents\teamwork\worker_p6_m1
Project root: d:\TP\Hackathon\DogFood

Read:
- d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md (under ## 2026-09-28T12:29:24Z)
- d:\TP\Hackathon\DogFood\.agents\teamwork\orchestrator_phase6\SCOPE.md
- d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_p6_m1_1\handoff.md (detailed schema & migration runbook)
- d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_p6_m1_2\handoff.md (seed idempotency & TeamMember link)
- d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_p6_m1_3\handoff.md (API baseline & invariants)

Exclusive Write Ownership:
- `prisma/schema.prisma`
- `src/lib/seed.ts`
- `PROGRESS.md`

Tasks:
1. Safety backup: Create a copy of `prisma/prisma/dogfood.db` to `prisma/prisma/dogfood.db.bak`.
2. Update `prisma/schema.prisma` with:
   - `CommunityVote` model (id, projectId, userId, createdAt, @@unique([projectId, userId]), indexes on projectId and userId, onDelete: Cascade to Project and User).
   - `Comment` model (id, projectId, userId, authorName, content, createdAt, isFlagged Boolean default false, indexes on projectId and userId, onDelete: Cascade to Project and User).
   - `Event` model extended with:
     votingOpen Boolean @default(true)
     resultsPublic Boolean @default(false)
   - `User` model extended with:
     communityVotes CommunityVote[]
     comments Comment[]
   - `Project` model extended with:
     communityVotes CommunityVote[]
     comments Comment[]
3. Execute database migration safely without dropping seeded data:
   - Run `npx prisma validate`
   - Run `npx prisma db push`
   - Run `npx prisma generate`
4. Update `src/lib/seed.ts`:
   - In `Event.upsert`, include `votingOpen: true, resultsPublic: false` in create block (keep out of update block).
   - Ensure `user_prt_01` has a `TeamMember` record linked to `tm_01` (Team for `prj_01`) so self-voting defense in M2 can be tested deterministically.
   - Run `npm run seed` to verify deterministic tokens and fixture counts are preserved.
5. Verification:
   - Run `npx tsx -e "import { prisma } from './src/lib/prisma'; async function v() { const u = await prisma.user.count(); const p = await prisma.project.count(); const s = await prisma.score.count(); const e = await prisma.event.findFirst(); const cv = await prisma.communityVote.count(); const c = await prisma.comment.count(); console.log({ users: u, projects: p, scores: s, event: e, communityVotes: cv, comments: c }); } v().then(() => prisma.\$disconnect());"`
   - Run `npm run typecheck` (must be 0 errors)
   - Run `npm run lint` (must be 0 errors)
   - Run `python Hack_docs/run.py .dogfood.toml` (must be 7/7 PASS green baseline)
6. Checkpoint & Commit:
   - Update `PROGRESS.md`: mark Phase 6 M1 in progress or completed, update "Current phase: Phase 6 - M1 completed -> Ready for M2".
   - Commit: `git add prisma/schema.prisma src/lib/seed.ts PROGRESS.md; git commit -m "[Phase 6] M1: schema migration for CommunityVote, Comment, and voting lifecycle flags"`
7. Write a detailed handoff report to `d:\TP\Hackathon\DogFood\.agents\teamwork\worker_p6_m1\handoff.md` and send a message back to parent orchestrator.
