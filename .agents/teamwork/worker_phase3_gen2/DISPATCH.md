# Dispatch Instructions for Worker Phase 3 Gen 2

## 2026-09-27T10:09:00Z

Working directory: d:\TP\Hackathon\DogFood\.agents\teamwork\worker_phase3_gen2
Project root: d:\TP\Hackathon\DogFood

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Context:
You are the release and verification worker for Phase 3 (T2 Judging) of the DOGFOOD 2026 hackathon portal.
Read:
- `d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md`
- `d:\TP\Hackathon\DogFood\PROGRESS.md`
- `d:\TP\Hackathon\DogFood\.dogfood.toml`

Tasks to execute in sequence:
1. Ensure the Next.js server on port 8080 is accessible (or start it in background if not running, or verify it is responding).
2. Execute and verify all required test and check suites:
   * `python tests/test_phase3_adversarial.py` (47 probes must pass)
   * `python tests/test_phase3_challenger2_full.py` (35 probes must pass)
   * `python Hack_docs/run.py .dogfood.toml` (All 7 checks: T1 + T2 must show PASS, claiming T1 T2 and verifying T1 T2)
   * `npm run typecheck` (0 errors)
3. Update `d:\TP\Hackathon\DogFood\PROGRESS.md`:
   * Ensure all Phase 3 tasks are marked `[x]`.
   * Ensure current phase is `Phase 4 — Docs + Checker Green`.
   * Update checker history table with verified T1 + T2 PASS status if needed.
   * Add a new session log entry for Orchestrator Gen 2 & Worker Gen 2 confirming the adversarial and acceptance verification pass.
4. Git commit:
   * Run `git status` and stage relevant files (`PROGRESS.md`, `tests/`, etc.).
   * Create git commit with exact message:
     `git commit -m "[PROGRESS] Phase 3: T2 judging, RBAC isolation, MAD normalization, judge and dashboard UI — Phase 4 Docs next"`
5. Write your handoff report to `d:\TP\Hackathon\DogFood\.agents\teamwork\worker_phase3_gen2\handoff.md` with:
   - Full command outputs and results.
   - Git commit hash and status.
   - Any notes on verification.
   Then send a message back to the orchestrator.
