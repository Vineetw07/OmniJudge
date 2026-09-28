import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { normaliseAllJudges } from '@/lib/normalization';

export const dynamic = 'force-dynamic';

function escapeCsvField(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * GET /api/export.csv
 *
 * Strictly restricted to Organizer and Admin roles.
 * Computes rubric-weighted composite scores, applies MAD normalization
 * per judge (handling zero-variance judges cleanly), calculates average
 * normalized and raw scores per project, ranks projects, and streams CSV.
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized: Valid session required' },
      { status: 401 }
    );
  }

  // RBAC Guard: Organizers and Admins only
  if (session.role !== 'organizer' && session.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: Organizer or Admin role required' },
      { status: 403 }
    );
  }

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
    const avgRaw =
      count > 0
        ? rawScoresForProject.reduce((acc, v) => acc + v, 0) / count
        : 0;
    const avgNorm =
      count > 0
        ? normScoresForProject.reduce((acc, v) => acc + v, 0) / count
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

  // 7. Sort & Rank: Descending by normalized score, break ties by raw score, then project ID
  projectResults.sort((a, b) => {
    if (b.normalizedScore !== a.normalizedScore) {
      return b.normalizedScore - a.normalizedScore;
    }
    if (b.rawScore !== a.rawScore) {
      return b.rawScore - a.rawScore;
    }
    return a.id.localeCompare(b.id);
  });

  // 8. Generate CSV content (Line 1 MUST contain comma)
  const header = 'project_id,project_title,track,raw_score,normalized_score,rank';
  const rows = projectResults.map((p, index) => {
    const rank = index + 1;
    return [
      escapeCsvField(p.id),
      escapeCsvField(p.title),
      escapeCsvField(p.trackName),
      p.rawScore.toFixed(2),
      p.normalizedScore.toFixed(4),
      rank,
    ].join(',');
  });

  const csvContent = [header, ...rows].join('\r\n');

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="omnijudge_scores.csv"',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
