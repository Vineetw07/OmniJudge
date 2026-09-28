/**
 * Cross-judge score normalisation using Modified Z-Score (MAD method).
 *
 * WHY NOT STANDARD Z-SCORE:
 * The fixtures.json deliberately includes a judge (jdg_30, Rafa Okonkwo) who gave
 * every single project the same score. Standard z-score divides by standard deviation,
 * which equals 0 for this judge → divide-by-zero → NaN crash.
 *
 * WHY MAD (Median Absolute Deviation):
 * MAD is robust to outliers and handles the zero-variance case explicitly.
 * When MAD = 0 (all scores identical), we return 0 for every project —
 * treating the judge as providing no discriminating signal, rather than crashing.
 *
 * FORMULA (when MAD > 0):
 *   modified_z_i = 0.6745 × (x_i − median) / MAD
 *
 * The constant 0.6745 makes the modified z-score consistent with the standard
 * z-score for normally distributed data (0.6745 ≈ Φ⁻¹(0.75)).
 */

/**
 * Normalise a single judge's scores using Modified Z-Score (MAD).
 * Input: raw scores array (one value per project this judge scored).
 * Output: normalised scores in the same order.
 *
 * @example
 * normaliseJudgeScores([3, 4, 5, 3, 4]) // → array of modified z-scores
 * normaliseJudgeScores([3, 3, 3, 3])    // → [0, 0, 0, 0]  (zero-variance judge)
 */
export function normaliseJudgeScores(scores: number[]): number[] {
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

  // Zero-variance guard: judge gave every project the same score.
  // Return neutral zeros — no signal, no crash.
  if (mad === 0) {
    return scores.map(() => 0);
  }

  return scores.map((s) => (0.6745 * (s - median)) / mad);
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
