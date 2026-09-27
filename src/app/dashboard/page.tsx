import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth';
import { normaliseAllJudges } from '@/lib/normalization';
import { DashboardClient } from './dashboard-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Organizer Dashboard | DOGFOOD 2026',
  description: 'Hackathon administration console, judging progress metrics, and MAD-normalized leaderboard.',
};

export default async function DashboardPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/login');
  }

  // Strict RBAC: Organizer and Admin only
  if (session.role !== 'organizer' && session.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
        <Card className="max-w-md w-full border shadow-sm">
          <CardHeader className="text-center space-y-2">
            <div className="inline-flex items-center justify-center size-12 rounded-xl bg-destructive/10 text-destructive mx-auto">
              <ShieldAlert className="size-6" />
            </div>
            <CardTitle className="text-xl font-bold">Access Forbidden</CardTitle>
            <CardDescription className="text-xs">
              Your account ({session.email}) has role &ldquo;{session.role}&rdquo;. The organizer dashboard and export functions are restricted strictly to Hackathon Administrators and Organizers.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pt-2">
            <Link href="/projects">
              <Button variant="outline" size="sm" className="flex items-center gap-1.5">
                <ArrowLeft className="size-3.5" />
                <span>Return to Gallery</span>
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch all primary collections in parallel
  const [projects, criteria, scores, judges, auditLogs] = await Promise.all([
    prisma.project.findMany({
      include: {
        track: true,
        team: true,
      },
      orderBy: { id: 'asc' },
    }),
    prisma.rubricCriterion.findMany(),
    prisma.score.findMany(),
    prisma.user.findMany({
      where: { role: 'judge' },
      include: {
        judgeAssignments: {
          include: { track: true },
        },
        scores: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.auditLog.findMany({
      take: 15,
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    }),
  ]);

  // 1. Map Criteria Weights
  const criteriaWeights = new Map<string, number>(
    criteria.map((c) => [c.id, c.weight])
  );

  // 2. Group raw scores by (judgeId -> projectId)
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

  // 3. Compute Composite Raw Scores Map
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

  // 4. Normalise with MAD Method
  const judgeNormMap = normaliseAllJudges(judgeRawMap);

  // 5. Aggregate project scores & rank
  const scoredProjectIds = new Set<string>();

  const projectResults = projects.map((project) => {
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
    if (count > 0) {
      scoredProjectIds.add(project.id);
    }

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
      teamName: project.team?.name || 'Independent',
      rawScore: avgRaw,
      normalizedScore: avgNorm,
      reviewCount: count,
    };
  });

  // Sort descending by normalized score, break ties by raw score, then project ID
  projectResults.sort((a, b) => {
    if (b.normalizedScore !== a.normalizedScore) {
      return b.normalizedScore - a.normalizedScore;
    }
    if (b.rawScore !== a.rawScore) {
      return b.rawScore - a.rawScore;
    }
    return a.id.localeCompare(b.id);
  });

  const leaderboard = projectResults.map((p, idx) => ({
    ...p,
    rank: idx + 1,
  }));

  // 6. Compute Judge Progress
  const trackProjectCountMap = new Map<string, number>();
  for (const p of projects) {
    trackProjectCountMap.set(
      p.trackId,
      (trackProjectCountMap.get(p.trackId) || 0) + 1
    );
  }

  let completedJudgesCount = 0;

  const judgeProgress = judges.map((j) => {
    const assignedTracks = j.judgeAssignments.map((a) => a.track.name);
    const assignedTrackIds = j.judgeAssignments.map((a) => a.trackId);

    // Sum total projects in assigned tracks
    let assignedCount = 0;
    for (const tid of assignedTrackIds) {
      assignedCount += trackProjectCountMap.get(tid) || 0;
    }

    // Number of distinct projects scored by this judge
    const scoredProjectSet = new Set(j.scores.map((s) => s.projectId));
    const scoredCount = scoredProjectSet.size;

    let status: 'Completed' | 'In Progress' | 'Not Started' = 'Not Started';
    if (assignedCount > 0 && scoredCount >= assignedCount) {
      status = 'Completed';
      completedJudgesCount++;
    } else if (scoredCount > 0) {
      status = 'In Progress';
    }

    return {
      id: j.id,
      name: j.name,
      email: j.email,
      assignedTracks,
      assignedCount,
      scoredCount,
      status,
    };
  });

  // 7. Format Audit Logs
  const recentAuditLogs = auditLogs.map((log) => {
    let payloadSummary = log.payload;
    try {
      const parsed = JSON.parse(log.payload);
      if (parsed.projectId) {
        payloadSummary = `Project: ${parsed.projectId}, Scores: ${
          parsed.scores?.length || 0
        } criteria`;
      } else if (parsed.title) {
        payloadSummary = `Title: ${parsed.title}`;
      }
    } catch {
      // Keep raw string if not JSON
    }

    return {
      id: log.id,
      action: log.action,
      userName: log.user?.name || log.userId,
      userEmail: log.user?.email || '',
      userRole: log.user?.role || 'user',
      createdAt: log.createdAt.toISOString(),
      payloadSummary,
    };
  });

  const kpis = {
    totalProjects: projects.length,
    scoredProjects: scoredProjectIds.size,
    totalReviews: scores.length,
    totalJudges: judges.length,
    completedJudges: completedJudgesCount,
  };

  return (
    <DashboardClient
      user={{
        id: session.id,
        name: session.name,
        email: session.email,
        role: session.role,
      }}
      kpis={kpis}
      judgeProgress={judgeProgress}
      leaderboard={leaderboard}
      recentAuditLogs={recentAuditLogs}
    />
  );
}
