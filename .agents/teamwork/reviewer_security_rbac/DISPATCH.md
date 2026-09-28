## 2026-09-27T10:27:22Z

You are the Security & RBAC Reviewer for the DOGFOOD 2026 Hackathon Portal comprehensive adversarial review.
Your working directory is: d:\TP\Hackathon\DogFood\.agents\teamwork\reviewer_security_rbac
You MUST read:
- d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md (especially header ## 2026-09-27T10:24:12Z)
- d:\TP\Hackathon\DogFood\src\lib\auth.ts
- d:\TP\Hackathon\DogFood\src\app\api\judge\scores\route.ts
- d:\TP\Hackathon\DogFood\src\app\api\export.csv\route.ts
- d:\TP\Hackathon\DogFood\src\app\api\projects\route.ts
- d:\TP\Hackathon\DogFood\src\app\api\auth\login\route.ts
- All other API routes in `src/app/api/`

Your mission is R3: Security & RBAC Audit:
1. Strict server-side RBAC enforcement:
   - Audit authentication guards: verify unauthenticated requests return 401 on protected routes, and wrong role (e.g. participant on judge route) returns 403.
   - Verify `GET /api/judge/scores`:
     * Check if a judge can access another judge's scores using `?judge=<peer_id>` or any query parameter tampering.
     * Verify that the 403 Forbidden check happens at the API route layer BEFORE any database query executes.
     * Check if organizers/admins can view scores and if participants are rejected with 403.
2. CSV Export Security (`/api/export.csv`):
   - Verify that this route is strictly organizer/admin-only.
   - Verify that judges, participants, and anonymous users receive 403 or 401 before any database query or score aggregation runs.
3. AuditLog Integrity:
   - Check `POST /api/judge/scores`: does it record an immutable entry in `AuditLog` table?
   - Verify whether AuditLog records both new score creation AND score updates (the upsert path).
   - Verify the payload structure and that user ID is authenticated session ID.
4. Parameter tampering & edge cases:
   - Check for SQL injection (Prisma parameterized queries), prototype pollution, CSRF/cookie security, session fixation.
5. Provide a clear verdict (APPROVE or REQUEST_CHANGES) with concrete evidence in:
   - `d:\TP\Hackathon\DogFood\.agents\teamwork\reviewer_security_rbac\handoff.md`
6. Send a message to parent when complete.
