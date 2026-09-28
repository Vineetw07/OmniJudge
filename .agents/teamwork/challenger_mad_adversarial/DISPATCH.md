## 2026-09-27T10:27:22Z

You are the MAD & Adversarial Verifier for the DOGFOOD 2026 Hackathon Portal comprehensive adversarial review.
Your working directory is: d:\TP\Hackathon\DogFood\.agents\teamwork\challenger_mad_adversarial
You MUST read:
- d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md (especially header ## 2026-09-27T10:24:12Z)
- d:\TP\Hackathon\DogFood\src\lib\normalization.ts
- d:\TP\Hackathon\DogFood\src\app\api\export.csv\route.ts
- d:\TP\Hackathon\DogFood\tests\test_phase3_adversarial.py
- d:\TP\Hackathon\DogFood\tests\test_phase3_challenger2_full.py
- d:\TP\Hackathon\DogFood\Hack_docs\run.py
- d:\TP\Hackathon\DogFood\.dogfood.toml

Your mission is R4: MAD Normalization Correctness & Adversarial Test Execution:
1. Mathematical verification of `src/lib/normalization.ts`:
   - Verify `normaliseJudgeScores()`:
     * Even-length array median calculation: MUST use the average of the two middle values `(sorted[mid-1] + sorted[mid]) / 2`, not just `sorted[mid]`.
     * Zero-variance guard: when all scores are identical (e.g. `[3, 3, 3, 3]`), MAD is 0; must return `[0, 0, 0, 0]`, NEVER NaN, null, or divide-by-zero error.
     * Normal case: `0.6745 * (s - median) / mad`.
   - Verify `normaliseAllJudges()`:
     * Does it correctly group scores by judge?
     * Does it correctly map normalized scores back to the exact project IDs?
     * Verify project IDs match input mapping for each judge.
   - Verify `src/app/api/export.csv/route.ts`:
     * Does it call `normaliseAllJudges()`?
     * Are raw and normalized scores correctly calculated and formatted?
     * Can any NaN or undefined appear in the CSV output?
2. Empirical testing and test suite execution:
   - Run automated test scripts using PowerShell 5.1 syntax (sequential commands with `;`):
     * Test MAD functions directly using node -e or a dedicated script.
     * Run existing test suites: `python tests/test_phase3_adversarial.py; python tests/test_phase3_challenger2_full.py; python Hack_docs/run.py .dogfood.toml`.
   - Report exact pass/fail counts, execution outputs, and any regressions.
3. Write your empirical report and verdict (APPROVE or REQUEST_CHANGES) in:
   - `d:\TP\Hackathon\DogFood\.agents\teamwork\challenger_mad_adversarial\handoff.md`
4. Send a message to parent when complete.
