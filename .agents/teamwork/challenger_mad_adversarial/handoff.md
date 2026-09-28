# Comprehensive Adversarial Review & Empirical Verification Report: MAD Normalization & Test Suite Execution (R4)

**Reviewer**: MAD & Adversarial Verifier (Archetype: EMPIRICAL CHALLENGER / Roles: critic, specialist)  
**Target Milestone**: Phase 3 (T2 Judging) Review  
**Repository**: `d:\TP\Hackathon\DogFood`  
**Date**: 2026-09-27  
**Verdict**: **APPROVE**  

---

## Challenge Summary

- **Overall Risk Assessment**: **LOW**
- **Critical Invariants Verified**:
  1. Even-length array median calculation correctly implements `(sorted[mid - 1] + sorted[mid]) / 2`.
  2. Zero-variance guard returns `[0, 0, ..., 0]` without NaN, null, or division-by-zero crashes.
  3. Modified Z-Score formula `0.6745 * (s - median) / mad` correctly implemented and scale-consistent.
  4. Multi-judge aggregation in `normaliseAllJudges` correctly groups by judge, preserves exact project ID sets, and maps normalized scores back to original project IDs.
  5. `/api/export.csv` enforces strict RBAC (organizer/admin only, 401 for anon, 403 for judges/participants), uses `normaliseAllJudges`, formats line 1 with commas, and emits zero NaN or undefined values.
  6. All automated test suites (`test_phase3_adversarial.py`, `test_phase3_challenger2_full.py`, `Hack_docs/run.py`) execute sequentially with 100% pass rates.

---

## 1. Observation

Direct code inspections and empirical executions yielded the following verbatim observations:

### 1.1 `src/lib/normalization.ts` (Lines 30–58: `normaliseJudgeScores`)
```typescript
30: export function normaliseJudgeScores(scores: number[]): number[] {
31:   if (scores.length === 0) return [];
32: 
33:   const sorted = [...scores].sort((a, b) => a - b);
34:   const mid = Math.floor(sorted.length / 2);
35: 
36:   // Median: middle value for odd-length, average of two middles for even-length
37:   const median =
38:     sorted.length % 2 !== 0
39:       ? sorted[mid]
40:       : (sorted[mid - 1] + sorted[mid]) / 2;
41: 
42:   const deviations = scores.map((s) => Math.abs(s - median));
43:   const sortedDevs = [...deviations].sort((a, b) => a - b);
44: 
45:   // MAD: median of absolute deviations
46:   const mad =
47:     sortedDevs.length % 2 !== 0
48:       ? sortedDevs[mid]
49:       : (sortedDevs[mid - 1] + sortedDevs[mid]) / 2;
50: 
51:   // Zero-variance guard: judge gave every project the same score.
52:   // Return neutral zeros — no signal, no crash.
53:   if (mad === 0) {
54:     return scores.map(() => 0);
55:   }
56: 
57:   return scores.map((s) => (0.6745 * (s - median)) / mad);
58: }
```
- **Line 31**: Handles empty input array immediately by returning `[]`.
- **Lines 37–40**: For even `sorted.length`, computes `(sorted[mid - 1] + sorted[mid]) / 2`. For odd length, selects `sorted[mid]`.
- **Lines 46–49**: Computes MAD using identical median logic on `sortedDevs`.
- **Lines 53–55**: Explicit zero-variance guard: when `mad === 0`, returns `scores.map(() => 0)`. Never divides by zero; never emits `NaN`.
- **Line 57**: Formula evaluates `(0.6745 * (s - median)) / mad` preserving original input ordering.

### 1.2 `src/lib/normalization.ts` (Lines 66–82: `normaliseAllJudges`)
```typescript
66: export function normaliseAllJudges(
67:   judgeScores: Map<string, Map<string, number>>
68: ): Map<string, Map<string, number>> {
69:   const result = new Map<string, Map<string, number>>();
70: 
71:   Array.from(judgeScores.entries()).forEach(([judgeId, projectMap]) => {
72:     const projectIds = Array.from(projectMap.keys());
73:     const rawScores = projectIds.map((pid) => projectMap.get(pid)!);
74:     const normalised = normaliseJudgeScores(rawScores);
75: 
76:     const normMap = new Map<string, number>();
77:     projectIds.forEach((pid, i) => normMap.set(pid, normalised[i]));
78:     result.set(judgeId, normMap);
79:   });
80: 
81:   return result;
82: }
```
- Groups scores by `judgeId`.
- Preserves 1:1 index alignment: `projectIds` array keys directly match `rawScores` array entries, and `normalised[i]` is stored under `projectIds[i]`.
- Output is a `Map<string, Map<string, number>>` with identical outer and inner keys.

### 1.3 `src/app/api/export.csv/route.ts` (RBAC & MAD Usage)
- **Lines 25–39**: Strict authentication & RBAC check:
  ```typescript
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized: Valid session required' }, { status: 401 });
  }
  if (session.role !== 'organizer' && session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Organizer or Admin role required' }, { status: 403 });
  }
  ```
  Returns `401` for anonymous and bad tokens; returns `403` for judges and participants.
- **Line 97**: Calls `normaliseAllJudges(judgeRawMap)` across all judges.
- **Lines 109–141**: Aggregates average raw and normalized scores per project across all judges who reviewed each project.
- **Line 155**: Defines header `'project_id,project_title,track,raw_score,normalized_score,rank'` (contains 5 commas, valid RFC 4180 header).
- **Lines 162–163**: Formats `p.rawScore.toFixed(2)` and `p.normalizedScore.toFixed(4)`.
- **Lines 170–177**: Returns `NextResponse` with `Content-Type: text/csv; charset=utf-8`.

### 1.4 Empirical Test Execution Observations
1. **`npx tsx tests/test_mad_mathematical.ts`**:
   - Exit code: `0`
   - Output: 18/18 checks PASSED (empty array, single element, even-length, odd-length, zero-variance `[3, 3, 3, 3]`, all zeros `[0, 0, 0]`, majority identical `[2, 2, 2, 5]`, unsorted preservation, decimal scores, multi-judge key and value mapping).
2. **`npm run typecheck`**:
   - Exit code: `0`
   - Output: `tsc --noEmit` completed with zero TypeScript diagnostic errors.
3. **`python tests/test_phase3_adversarial.py`**:
   - Exit code: `0`
   - Output: `TOTAL: 47 | PASSED: 47 | FAILED: 0`. Verdict: APPROVE.
4. **`python tests/test_phase3_challenger2_full.py`**:
   - Exit code: `0`
   - Output: `CHALLENGER 2 SUITE SUMMARY: 35 PASSED, 0 FAILED`. Verdict: APPROVE.
5. **`python Hack_docs/run.py .dogfood.toml`**:
   - Exit code: `0`
   - Output:
     ```
     T1  gallery is public ................. PASS
     T1  project from fixtures shown ....... PASS
     T1  closed event refuses submissions .. PASS
     T2  judge sees own scores ............. PASS
     T2  judge cannot see peer scores ...... PASS
     T2  participant blocked ............... PASS
     T2  csv export works .................. PASS

     claimed T1 T2, verified T1 T2
     ```
6. **Direct Live CSV Audit (`http://localhost:8080/api/export.csv`)**:
   - Total CSV lines: 42 (1 header line + 41 project rows).
   - Line 1 header: `project_id,project_title,track,raw_score,normalized_score,rank`.
   - Projects in DB: 41. Rows in CSV: 41.
   - Forbidden tokens (`nan`, `undefined`, `null`, `none`, `inf`): 0 occurrences across all 41 rows.
   - Ranks: strictly monotonic integer sequence 1 through 41 without gaps or duplicates.

---

## 2. Logic Chain

1. **Even-length median correctness**:
   - In `normaliseJudgeScores`, array length $N$ has integer division index `mid = Math.floor(N / 2)`.
   - For even $N$, elements are 0-indexed from $0$ to $N-1$. The two center values are at indices `mid - 1` and `mid`.
   - Observation 1.1 lines 38–40 and lines 47–49 compute `(sorted[mid - 1] + sorted[mid]) / 2`.
   - For `[1, 2, 3, 4]`, $N=4$, `mid=2`, middle elements are `sorted[1]=2` and `sorted[2]=3`, yielding median $2.5$. Deviations are `[1.5, 0.5, 0.5, 1.5]`, sorted deviations `[0.5, 0.5, 1.5, 1.5]`, middle elements `sortedDevs[1]=0.5` and `sortedDevs[2]=1.5`, yielding MAD $1.0$.
   - Tested empirically in `tests/test_mad_mathematical.ts` and passed.

2. **Zero-variance resilience**:
   - When all scores from a judge are equal (e.g. Rafa Okonkwo / `jdg_30`, or fixture judge `jdg_07` with `[4.0, 4.0, 4.0]`), all deviations from the median are $0.0$, making MAD $= 0.0$.
   - In standard Z-score or unprotected algorithms, dividing by standard deviation or MAD produces `0 / 0 = NaN`.
   - Observation 1.1 line 53 checks `if (mad === 0)` and returns `scores.map(() => 0)`.
   - Tested empirically with identical scores `[3, 3, 3, 3]`, all zeros `[0, 0, 0]`, and majority identical `[2, 2, 2, 5]`. In all cases, `0` was returned without division by zero or NaN.

3. **Scale consistency**:
   - The multiplier $0.6745 \approx \Phi^{-1}(0.75)$ standardizes MAD to approximate standard deviation for normal distributions.
   - Formula `(0.6745 * (s - median)) / mad` correctly centers scores around $0$ with dispersion proportional to distance from the median.
   - Tested empirically with symmetric input `[1, 3, 5]`: yields `[-0.6745, 0.0, 0.6745]`.

4. **Multi-judge aggregation integrity**:
   - Observation 1.2 lines 71–79 iterates over entries of `judgeScores` (`Map<judgeId, Map<projectId, rawScore>>`).
   - Line 72 extracts `projectIds = Array.from(projectMap.keys())`.
   - Line 73 maps `rawScores` in exact key order.
   - Line 77 maps `projectIds[i] -> normalised[i]`.
   - Verified that project IDs are not lost, altered, or permuted across judge evaluations.

5. **CSV Export Integrity & RBAC**:
   - Observation 1.3 lines 25–39 verifies session before querying database.
   - Non-organizers receive 401/403 before any score data is accessed or streamed.
   - Aggregation iterates through all projects from the database; projects with reviews compute averages, while unreviewed projects default safely to `0`.
   - Formatting applies `toFixed(2)` and `toFixed(4)` on finite numbers, guaranteeing that neither `NaN` nor `undefined` can be serialized.
   - Header contains commas satisfying `Hack_docs/run.py` Check 7 (`csv export works`).

6. **Automated Suite Alignment**:
   - Both adversarial test suites and the official acceptance runner pass completely without modification or regressions.

---

## 3. Adversarial Challenges & Stress Testing

### Challenge 1 (Edge Case): Majority Identical Scores
- **Assumption Challenged**: MAD is only zero when *all* scores are identical.
- **Attack Scenario**: A judge scores 4 projects with scores `[2, 2, 2, 5]`. Median is $2$, deviations are `[0, 0, 0, 3]`. Sorted deviations are `[0, 0, 0, 3]`. Median of deviations (MAD) is $(0 + 0) / 2 = 0$.
- **Blast Radius**: If zero-variance check only tested `s_max === s_min` rather than `mad === 0`, this case would divide by zero and produce `NaN` or `Infinity` for score $5$.
- **Mitigation & Finding**: The implementation guards `if (mad === 0)` directly (Line 53 of `normalization.ts`), neutralizing the entire array to `[0, 0, 0, 0]` safely without crashing. Confirmed in `tests/test_mad_mathematical.ts` and `tests/test_phase3_challenger2_full.py`.

### Challenge 2 (Edge Case): Single-Score Judge
- **Assumption Challenged**: Judges always evaluate multiple projects.
- **Attack Scenario**: A judge evaluates exactly 1 project (`scores = [5.0]`).
- **Blast Radius**: `mid = 0`, `deviations = [0]`, `mad = 0`. Without guard, `0 / 0 = NaN`.
- **Mitigation & Finding**: `mad === 0` guard activates and returns `[0]`. Confirmed in unit test Section 1.

### Challenge 3 (Security): CSV Export Exfiltration
- **Assumption Challenged**: CSV export might leak preliminary or unnormalized results to judges or participants.
- **Attack Scenario**: Judge or participant requests `GET /api/export.csv` with valid session cookie.
- **Blast Radius**: Unauthorized access to hackathon leaderboard and peer scores.
- **Mitigation & Finding**: Both roles return HTTP 403 Forbidden at the API route layer before database query execution. Probes P4_01, P4_02, P4_03 in `test_phase3_adversarial.py` confirmed 403 responses.

### Stress Test Results Matrix

| Scenario / Probe | Input / Description | Expected Behavior | Actual Behavior | Status |
|:---|:---|:---|:---|:---:|
| **ST-01: Even Length** | `[1, 2, 3, 4]` | Median = 2.5, MAD = 1.0 | `[-1.01175, -0.33725, 0.33725, 1.01175]` | **PASS** |
| **ST-02: Odd Length** | `[1, 3, 5]` | Median = 3.0, MAD = 2.0 | `[-0.6745, 0.0, 0.6745]` | **PASS** |
| **ST-03: Zero Variance** | `[3, 3, 3, 3]` | MAD = 0, no divide-by-zero | `[0, 0, 0, 0]` | **PASS** |
| **ST-04: Single Score** | `[5]` | MAD = 0, neutral score | `[0]` | **PASS** |
| **ST-05: Empty Array** | `[]` | Length 0 array | `[]` | **PASS** |
| **ST-06: Majority Identical**| `[2, 2, 2, 5]` | MAD = 0 guard triggers | `[0, 0, 0, 0]` | **PASS** |
| **ST-07: Unsorted Order** | `[4, 1, 3, 2]` | Preserves input index positions | `[1.01175, -1.01175, 0.33725, -0.33725]` | **PASS** |
| **ST-08: Decimal Inputs** | `[2.5, 3.5, 4.0, 4.5]` | Correct floating point calculation | Scaled accurately | **PASS** |
| **ST-09: Multi-Judge Map** | 3 judges, disparate project counts | Exact project ID preservation | Keys & values 100% matched | **PASS** |
| **ST-10: CSV Auth Guard** | Judge/Participant `GET /api/export.csv` | 403 Forbidden | 403 Forbidden | **PASS** |
| **ST-11: CSV Anon Guard** | Unauthenticated `GET /api/export.csv` | 401 Unauthorized | 401 Unauthorized | **PASS** |
| **ST-12: CSV Sanitization** | Organizer `GET /api/export.csv` | No NaN/undefined, valid RFC 4180 | 41 projects, 0 NaNs, ranks 1..41 | **PASS** |

---

## 4. Caveats

- **Floating-point rounding tie-breakers**: In CSV export, normalized scores are formatted to 4 decimal places (`toFixed(4)`). In edge cases where two projects have identical normalized scores rounded to 4 decimals, secondary sort relies on raw scores (`toFixed(2)`), and tertiary sort on project ID. This behavior is deterministic and mathematically sound.
- **Scope Limit**: Performance under extreme scale (> 100,000 projects) was not benchmarked, as the platform is designed and scoped for hackathons with dozens to hundreds of submissions.

---

## 5. Conclusion

The implementation of Modified Z-Score (MAD) normalization in `src/lib/normalization.ts` and its application in `src/app/api/export.csv/route.ts` is **fully verified, mathematically robust, and resilient against all adversarial edge cases**.

1. Even-length medians correctly average the two central elements.
2. The zero-variance guard strictly prevents `NaN` and divide-by-zero crashes.
3. Multi-judge aggregation maintains exact project ID mapping.
4. The CSV export route strictly blocks non-organizers and emits RFC 4180-compliant data with zero `NaN` or `undefined` values.
5. All automated test suites (47 adversarial probes, 35 challenger checks, and all 7 acceptance checks) pass with zero errors.

**Verdict: APPROVE**

---

## 6. Verification Method

To independently verify all findings in this report, run the following commands sequentially from the project root in PowerShell 5.1:

```powershell
# 1. Typecheck verification
npm run typecheck

# 2. TypeScript MAD mathematical invariant unit tests
npx tsx tests/test_mad_mathematical.ts

# 3. Phase 3 comprehensive adversarial suite (47 probes)
python tests/test_phase3_adversarial.py

# 4. Phase 3 challenger 2 ground truth and stress suite (35 checks)
python tests/test_phase3_challenger2_full.py

# 5. Official DOGFOOD 2026 acceptance runner (T1 + T2 checks)
python Hack_docs/run.py .dogfood.toml
```

**Invalidation Conditions**:
- Any probe failure in `test_phase3_adversarial.py` or `test_phase3_challenger2_full.py`.
- Any output of `NaN`, `undefined`, or `null` in `/api/export.csv`.
- Any non-zero exit code in `Hack_docs/run.py .dogfood.toml`.
