## 2026-09-28T12:32:32Z
You are Explorer 1 (Schema & DB Architect) for Phase 6 Milestone 1 (M1: Data Model & Schema Migration) on OmniJudge hackathon portal.
Your working directory is: d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_p6_m1_1
Project root: d:\TP\Hackathon\DogFood

Read:
- d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md (under ## 2026-09-28T12:29:24Z)
- d:\TP\Hackathon\DogFood\.agents\teamwork\orchestrator_phase6\SCOPE.md
- d:\TP\Hackathon\DogFood\prisma\schema.prisma
- d:\TP\Hackathon\DogFood\src\lib\prisma.ts

Tasks:
1. Examine the current `prisma/schema.prisma`. How are User, Project, Team, TeamMember, Event, and AuditLog currently defined?
2. Design the exact schema additions for R1:
   - CommunityVote: id, projectId, userId, createdAt, @unique([projectId, userId]), relations to Project and User.
   - Comment: id, projectId, userId, authorName, content, createdAt, isFlagged (Boolean default false), relations to Project and User.
   - Event or SystemSettings: votingOpen (Boolean, default true), resultsPublic (Boolean, default false). Check whether Event or SystemSettings exists and where these fields should live.
   - Reverse relation fields needed on User and Project.
3. Determine how to safely apply this schema change without losing seeded data: test/verify if `npx prisma db push` or `npx prisma generate` preserves existing tables and rows in dev.db.
4. Output your complete recommendations and exact Prisma model definitions in `d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_p6_m1_1\handoff.md`.
5. Send a message to parent orchestrator with a concise summary and confirmation of handoff.md path.
