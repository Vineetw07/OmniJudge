## 2026-09-27T10:25:49Z

You are the Project Orchestrator leading a comprehensive, adversarial self-review of the DOGFOOD 2026 hackathon portal (covering all work completed in Phases 1 through 3).

Your working directory is:
d:\TP\Hackathon\DogFood\.agents\teamwork\orchestrator_review

The authoritative user request is recorded in:
d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md under header ## 2026-09-27T10:24:12Z.

Your core mission:
Perform an exhaustive, adversarial self-review covering all requirements:
1. R1: Code Quality Audit
   - Inspect all source files in src/ and prisma/
   - Verify TypeScript correctness (no empty catches, no @ts-ignore, no unsafe type assertions, no unhandled promises)
   - Audit RBAC enforcement in API routes (specifically GET /api/judge/scores with ?judge= parameter isolation)
   - Audit MAD normalization implementation (even-length median, zero-variance guard, normaliseAllJudges aggregation)
   - Check for improper optional chaining ?. suppressing hard errors or bugs

2. R2: Acceptance Checker Alignment
   - Cross-reference all 7 checks in Hack_docs/run.py against actual implementation
   - Check 5 (T2 critical): GET /api/judge/scores?judge=judge_a as judge_b -> verify 403 returned at API layer
   - Check 7: CSV export first line contains comma
   - Check 3: Submission close logic uses event.submissionsClose from DB
   - Verify .dogfood.toml alignment with Next.js route paths and seeded user IDs

3. R3: Security & RBAC Audit
   - Check API route authentication guards (anonymous -> 401, participant -> 403)
   - Ensure CSV export (/api/export.csv) is strictly organizer-only at API layer before DB query
   - Ensure AuditLog records every score mutation (both create and update paths)
   - Check for parameter tampering, privilege escalation, or unauthorized data exposure

4. R4: MAD Normalization Correctness
   - Formally verify normaliseJudgeScores() and normaliseAllJudges()
   - Test even-length array median calculation (average of middle two values)
   - Test zero-variance guard returns zeroes, not NaN or division by zero
   - Verify project IDs match input mapping in normaliseAllJudges
   - Verify /api/export.csv calls normaliseAllJudges

5. R5: Schema & Seed Integrity
   - Verify 11 Prisma models and relations against spec
   - Verify deterministic session tokens and expiry dates
   - Verify event submissionsClose is set in the past as required

Dispatch specialist subagents (explorers/reviewers/challengers/workers) as needed.
Adhere strictly to PowerShell 5.1 syntax (use ; or separate commands, NEVER && or ||).
Maintain progress.md and BRIEFING.md in your working directory.
When complete, synthesize the full adversarial self-review report and report completion.
