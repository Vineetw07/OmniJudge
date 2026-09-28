## 2026-09-27T10:27:22Z
You are the Acceptance & Schema Auditor for the DOGFOOD 2026 Hackathon Portal comprehensive adversarial review.
Your working directory is: d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_checker_schema
You MUST read:
- d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md (especially header ## 2026-09-27T10:24:12Z)
- d:\TP\Hackathon\DogFood\Hack_docs\spec.md
- d:\TP\Hackathon\DogFood\Hack_docs\run.py
- d:\TP\Hackathon\DogFood\Hack_docs\fixtures.json
- d:\TP\Hackathon\DogFood\.dogfood.toml
- d:\TP\Hackathon\DogFood\prisma\schema.prisma
- d:\TP\Hackathon\DogFood\src\lib\seed.ts

Your mission is R2 (Acceptance Checker Alignment) and R5 (Schema & Seed Integrity):
1. Acceptance Checker Alignment (R2):
   - Cross-reference all 7 checks in `Hack_docs/run.py` against the actual implementation:
     * Check 1: `T1 gallery is public` -> verify `GET /projects` requires no auth and returns 200.
     * Check 2: `T1 project from fixtures shown` -> verify `GET /projects` renders fixture project titles ("Glass Signal", "Small Meadow", or "Deep Compass") in HTML.
     * Check 3: `T1 closed event refuses submissions` -> verify `POST /api/projects` compares request time against `event.submissionsClose` queried from SQLite DB (not hardcoded), and returns 409 or 403.
     * Check 4: `T2 judge sees own scores` -> verify `GET /api/judge/scores` returns 200 with the judge's own scores.
     * Check 5 (T2 critical): `T2 judge cannot see peer scores` -> verify `GET /api/judge/scores?judge=user_jdg_a_01` called with judge_b's session cookie returns 403 at the API route layer directly.
     * Check 6: `T2 participant blocked` -> verify participant cookie gets 403 on `/api/judge/scores`.
     * Check 7: `T2 csv export works` -> verify `/api/export.csv` returns 200 and the first line contains a comma.
   - Verify `.dogfood.toml`: check all routes match Next.js App Router paths (`/projects`, `/api/projects`, `/api/judge/scores`, `/api/export.csv`) and `peer_scores` query param uses the exact seeded user ID for judge_a (`user_jdg_a_01`).
2. Schema & Seed Integrity (R5):
   - Verify all 11 Prisma models in `prisma/schema.prisma` against spec (`User`, `Session`, `Event`, `Track`, `Team`, `TeamMember`, `Project`, `RubricCriterion`, `JudgeAssignment`, `Score`, `AuditLog`) with all relations and fields.
   - Verify `src/lib/seed.ts`:
     * Seeds 4 deterministic test users and tokens (`org_seed_token_2026`, `jdg_a_seed_token_2026`, `jdg_b_seed_token_2026`, `prt_seed_token_2026`).
     * Expiry set to 365 days in future.
     * Event `submissionsClose` seeded to `"2026-03-01T18:00:00Z"` (in the past).
     * Seed idempotency (upserts used everywhere, multiple runs produce no duplicates).
3. Record findings in:
   - `d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_checker_schema\analysis.md`
   - `d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_checker_schema\handoff.md`
4. Send a message to parent when complete with your summary.
