/**
 * Cross-judge score normalisation using Modified Z-Score (MAD method).
 *
 * WHY NOT STANDARD Z-SCORE:
 * The fixtures.json deliberately includes a zero-variance judge (jdg_07, Iva Petrova)
 * who gave every single project the exact same composite score (12.0), as well as
 * single-review panels (jdg_01, jdg_23). Standard z-score divides by sample standard deviation,
 * which equals 0 for these judges → divide-by-zero → NaN crash.
 *
 * WHY MAD (Median Absolute Deviation):
 * MAD is robust to outliers and handles the zero-variance case explicitly.
 * When MAD < 1e-9 (all scores identical or within IEEE-754 floating-point 1-ULP tolerance),
 * we return 0 for every project — treating the judge as providing no discriminating signal,
 * rather than crashing or exploding with pseudo-deviations.
 *
 * FORMULA (when MAD >= 1e-9):
 *   modified_z_i = 0.6745 × (x_i − median) / scale
 *
 * The constant 0.6745 makes the modified z-score consistent with the standard
 * z-score for normally distributed data (0.6745 ≈ Φ⁻¹(0.75)).
 */

export const EPSILON = 1e-9;

export interface NormaliseOptions {
  shrink?: boolean;
  minSpread?: number;
}

/**
 * Normalise a single judge's scores using Modified Z-Score (MAD).
 * Input: raw scores array (one value per project this judge scored).
 * Output: normalised scores in the same order.
 *
 * @example
 * normaliseJudgeScores([3, 4, 5, 3, 4]) // → array of modified z-scores
 * normaliseJudgeScores([3, 3, 3, 3])    // → [0, 0, 0, 0]  (zero-variance judge)
 */
export function normaliseJudgeScores(
  scores: number[],
  options?: NormaliseOptions
): number[] {
  if (scores.length === 0) return [];
  if (!scores.every((s) => typeof s === 'number' && Number.isFinite(s))) {
    return scores.map(() => 0);
  }

  const sorted = [...scores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  // Median: middle value for odd-length, average of two middles for even-length
  const median =
    sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;

  const deviations = scores.map((s) => Math.abs(s - median));
  const sortedDevs = [...deviations].sort((a, b) => a - b);

  // MAD: median of absolute deviations
  const mad =
    sortedDevs.length % 2 !== 0
      ? sortedDevs[mid]
      : (sortedDevs[mid - 1] + sortedDevs[mid]) / 2;

  // Zero-variance & floating-point precision guard:
  // Handles identical scores, single review panels, and IEEE-754 1-ULP composite differences.
  // When MAD < EPSILON, return neutral zeros — no signal, no crash, no 10^15 z-score blowup.
  if (mad < EPSILON) {
    return scores.map(() => 0);
  }

  const minSpread = options?.minSpread;
  const scale = minSpread !== undefined ? Math.max(mad, minSpread / 0.6745) : mad;
  const shrink = options?.shrink ? scores.length / (scores.length + 3) : 1;

  return scores.map((s) => (shrink * 0.6745 * (s - median)) / scale);
}

/**
 * Apply per-judge normalisation across a score matrix.
 *
 * @param judgeScores - Map of judgeId → { projectId → raw score }
 * @returns Map of judgeId → { projectId → normalised score }
 */
export function normaliseAllJudges(
  judgeScores: Map<string, Map<string, number>>
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();

  Array.from(judgeScores.entries()).forEach(([judgeId, projectMap]) => {
    const projectIds = Array.from(projectMap.keys());
    const rawScores = projectIds.map((pid) => projectMap.get(pid)!);
    const normalised = normaliseJudgeScores(rawScores);

    const normMap = new Map<string, number>();
    projectIds.forEach((pid, i) => normMap.set(pid, normalised[i]));
    result.set(judgeId, normMap);
  });

  return result;
}
