## 2026-09-28T12:57:44Z
You are Reviewer 1 for Phase 6 Milestone 2 (M2: Anti-Abuse Protected API Endpoints).
Your working directory is: d:\TP\Hackathon\DogFood\.agents\teamwork\reviewer_p6_m2_1
Project root: d:\TP\Hackathon\DogFood

Read:
- d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md (under ## 2026-09-28T12:29:24Z)
- d:\TP\Hackathon\DogFood\.agents\teamwork\orchestrator_phase6\SCOPE.md
- d:\TP\Hackathon\DogFood\.agents\teamwork\worker_p6_m2\handoff.md
- d:\TP\Hackathon\DogFood\src\app\api\community\vote\route.ts
- d:\TP\Hackathon\DogFood\src\app\api\community\comments\route.ts

Tasks:
1. Examine route handlers for:
   - Proper session authentication using `getSession(req)`.
   - Self-vote defense: TeamMember teamId comparison with project.teamId returning 403 Forbidden.
   - Sealed results invariant: `totalVotes: null` strictly returned when results are not public and user is not organizer/admin.
   - Comment sanitization (HTML tag removal, length limits).
2. Verification commands:
   - `npm run typecheck`
   - `npm run lint`
   - `npx tsx tests/test_p6_m2_integration.ts`
3. Deliver a verdict (APPROVE or REQUEST_CHANGES) with detailed technical justification in `d:\TP\Hackathon\DogFood\.agents\teamwork\reviewer_p6_m2_1\handoff.md`.
4. Send a message to parent orchestrator with your verdict.
