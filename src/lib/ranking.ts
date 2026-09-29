import { prisma } from '@/lib/prisma';
import { normaliseAllJudges } from '@/lib/normalization';

export interface RankedProject {
  rank: number;
  trackRank: number;
  projectId: string;
  title: string;
  trackName: string;
  rawScore: number;
  normalizedScore: number;
  reviewCount: number;
}

export interface LeaderboardEntry {
  rank: number;
  trackRank?: number;
  projectId: string;
  title: string;
  trackName: string;
  normalizedScore: number;
  reviewCount: number;
}

/**
 * Computes rubric-weighted composite scores, applies MAD normalization
 * per judge (handling zero-variance judges cleanly), calculates average
 * normalized and raw scores per project, and ranks projects deterministically.
 *
 * Sort order:
 * 1. Evaluated projects (reviewCount > 0) strictly outrank unreviewed (reviewCount === 0).
 * 2. Descending by normalized score (with 1e-9 epsilon tolerance).
 * 3. Break ties by raw score (with 1e-9 epsilon tolerance).
 * 4. Break remaining ties by project ID ASC for determinism.
 */
export async function computeRankedProjects(): Promise<RankedProject[]> {
  // 1. Gather all required datasets
  const [projects, criteria, scores] = await Promise.all([
    prisma.project.findMany({
      include: { track: true },
      orderBy: { id: 'asc' },
    }),
    prisma.rubricCriterion.findMany(),
    prisma.score.findMany(),
  ]);

  // 2. Build criterion weight map
  const criteriaWeights = new Map<string, number>(
    criteria.map((c) => [c.id, c.weight])
  );

  // 3. Group criterion scores by (judgeId -> projectId -> criterion scores)
  // To compute weighted average score per judge-project evaluation
  const judgeProjectScores = new Map<
    string,
    Map<string, { weightedSum: number; weightTotal: number }>
  >();

  for (const score of scores) {
    const weight = criteriaWeights.get(score.criterionId) ?? 1.0;

    let projectMap = judgeProjectScores.get(score.judgeId);
    if (!projectMap) {
      projectMap = new Map();
      judgeProjectScores.set(score.judgeId, projectMap);
    }

    let stats = projectMap.get(score.projectId);
    if (!stats) {
      stats = { weightedSum: 0, weightTotal: 0 };
      projectMap.set(score.projectId, stats);
    }

    stats.weightedSum += score.value * weight;
    stats.weightTotal += weight;
  }

  // 4. Convert weighted totals to composite raw scores: Map<judgeId, Map<projectId, rawScore>>
  const judgeRawMap = new Map<string, Map<string, number>>();

  judgeProjectScores.forEach((projectMap, judgeId) => {
    const rawScores = new Map<string, number>();
    projectMap.forEach((stats, projectId) => {
      const composite =
        stats.weightTotal > 0 ? stats.weightedSum / stats.weightTotal : 0;
      rawScores.set(projectId, composite);
    });
    judgeRawMap.set(judgeId, rawScores);
  });

  // 5. Apply MAD Normalization across all judges
  // Zero-variance judges (MAD=0) return neutral 0s instead of crashing with NaN
  const judgeNormMap = normaliseAllJudges(judgeRawMap);

  // 6. Aggregate cross-judge scores per project
  interface ProjectResult {
    id: string;
    title: string;
    trackName: string;
    rawScore: number;
    normalizedScore: number;
    reviewCount: number;
  }

  const projectResults: ProjectResult[] = projects.map((project) => {
    const rawScoresForProject: number[] = [];
    const normScoresForProject: number[] = [];

    judgeRawMap.forEach((pMap, judgeId) => {
      if (pMap.has(project.id)) {
        rawScoresForProject.push(pMap.get(project.id)!);
        const norm = judgeNormMap.get(judgeId)?.get(project.id);
        if (norm !== undefined) {
          normScoresForProject.push(norm);
        }
      }
    });

    const count = rawScoresForProject.length;
    const normCount = normScoresForProject.length;
    const avgRaw =
      count > 0
        ? rawScoresForProject.reduce((acc, v) => acc + v, 0) / count
        : 0;
    const avgNorm =
      normCount > 0
        ? normScoresForProject.reduce((acc, v) => acc + v, 0) / normCount
        : 0;

    return {
      id: project.id,
      title: project.title,
      trackName: project.track?.name || 'General',
      rawScore: avgRaw,
      normalizedScore: avgNorm,
      reviewCount: count,
    };
  });

  // 7. Sort & Rank:
  // Evaluated projects (reviewCount > 0) strictly outrank unreviewed projects (reviewCount === 0).
  // Descending by normalized score (with epsilon tolerance for floating-point precision).
  // Break ties by raw score, then project ID ASC for determinism.
  projectResults.sort((a, b) => {
    const aHasReviews = a.reviewCount > 0;
    const bHasReviews = b.reviewCount > 0;
    if (aHasReviews !== bHasReviews) {
      return aHasReviews ? -1 : 1;
    }
    if (Math.abs(b.normalizedScore - a.normalizedScore) > 1e-9) {
      return b.normalizedScore - a.normalizedScore;
    }
    if (Math.abs(b.rawScore - a.rawScore) > 1e-9) {
      return b.rawScore - a.rawScore;
    }
    return a.id.localeCompare(b.id);
  });

  const trackCounters = new Map<string, number>();
  return projectResults.map((p, index) => {
    const trackRank = (trackCounters.get(p.trackName) || 0) + 1;
    trackCounters.set(p.trackName, trackRank);
    return {
      rank: index + 1,
      trackRank,
      projectId: p.id,
      title: p.title,
      trackName: p.trackName,
      rawScore: p.rawScore,
      normalizedScore: p.normalizedScore,
      reviewCount: p.reviewCount,
    };
  });
}
