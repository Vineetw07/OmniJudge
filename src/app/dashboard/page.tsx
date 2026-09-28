import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth';
import { normaliseAllJudges } from '@/lib/normalization';
import {
  DashboardClient,
  DashboardKPIs,
  CommunityGovernanceData,
} from './dashboard-client';
import { Button } from '@/components/ui/button';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Organizer Dashboard | OmniJudge',
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
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] backdrop-blur-md p-6 shadow-2xl space-y-6 text-center">
          <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-destructive/15 text-destructive border border-destructive/25 mx-auto">
            <ShieldAlert className="size-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">Access Restricted</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your account (<span className="text-foreground font-mono">{session.email}</span>) has role &ldquo;<span className="text-primary font-medium">{session.role}</span>&rdquo;. The organizer control tower and export functions are restricted strictly to Hackathon Administrators and Organizers.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
            {session.role === 'judge' && (
              <Link href="/judge" className="w-full sm:w-auto">
                <Button
                  size="sm"
                  className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs shadow-[0_0_20px_rgba(56,189,248,0.3)] transition-all"
                >
                  Go to Judge Workspace
                </Button>
              </Link>
            )}
            <Link href="/projects" className="w-full sm:w-auto">
              <Button variant="outline" size="sm" className="w-full sm:w-auto flex items-center justify-center gap-2 border-white/10 hover:bg-white/5 text-xs">
                <ArrowLeft className="size-4" />
                <span>Return to Gallery</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Fetch all primary collections in parallel
  const [
    projects,
    criteria,
    scores,
    judges,
    auditLogs,
    totalCommunityVotes,
    uniqueCommunityVoters,
    topCommunityFavorites,
    eventState,
  ] = await Promise.all([
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
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    }),
    prisma.communityVote.count(),
    prisma.communityVote.groupBy({ by: ['userId'] }).then((r) => r.length),
    prisma.project.findMany({
      select: {
        id: true,
        title: true,
        track: { select: { name: true } },
        _count: { select: { communityVotes: true } },
      },
      orderBy: { communityVotes: { _count: 'desc' } },
      take: 5,
    }),
    prisma.event.findFirst({
      select: { votingOpen: true, resultsPublic: true },
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
      teamName: project.team?.name || 'Independent',
      rawScore: avgRaw,
      normalizedScore: avgNorm,
      reviewCount: count,
    };
  });

  // Sort & Rank: Evaluated projects (reviewCount > 0) strictly outrank unreviewed projects.
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

  const leaderboard = projectResults.map((p, idx) => ({
    ...p,
    rank: idx + 1,
  }));

  // 6. Compute Judge Progress & Exact 4 KPIs
  const trackProjectCountMap = new Map<string, number>();
  for (const p of projects) {
    trackProjectCountMap.set(
      p.trackId,
      (trackProjectCountMap.get(p.trackId) || 0) + 1
    );
  }

  let totalAssignedReviews = 0;
  let completedReviews = 0;
  let activeJudgesCount = 0;

  const judgeProgress = judges.map((j) => {
    const assignedTracks = j.judgeAssignments.map((a) => a.track.name);
    const assignedTrackIds = Array.from(new Set(j.judgeAssignments.map((a) => a.trackId)));

    // Sum total projects in assigned tracks
    let assignedCount = 0;
    for (const tid of assignedTrackIds) {
      assignedCount += trackProjectCountMap.get(tid) || 0;
    }

    // Number of distinct projects scored by this judge
    const scoredProjectSet = new Set(j.scores.map((s) => s.projectId));
    const scoredCount = scoredProjectSet.size;

    totalAssignedReviews += assignedCount;
    completedReviews += scoredCount;
    if (scoredCount > 0) {
      activeJudgesCount++;
    }

    let status: 'Completed' | 'In Progress' | 'Not Started' = 'Not Started';
    if (assignedCount > 0 && scoredCount >= assignedCount) {
      status = 'Completed';
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
      if (parsed.projectId && parsed.scores) {
        payloadSummary = `Project: ${parsed.projectId}, Scores: ${
          parsed.scores?.length || 0
        } criteria`;
      } else if (parsed.projectTitle) {
        payloadSummary = `Vote for "${parsed.projectTitle}" (${parsed.projectId})`;
      } else if (parsed.length !== undefined || parsed.contentLength !== undefined) {
        payloadSummary = `Comment on ${parsed.projectId} (${parsed.length || parsed.contentLength} chars)`;
      } else if (parsed.resultsPublic !== undefined || parsed.votingOpen !== undefined) {
        const parts = [];
        if (parsed.votingOpen !== undefined) parts.push(`votingOpen: ${parsed.votingOpen}`);
        if (parsed.resultsPublic !== undefined) parts.push(`resultsPublic: ${parsed.resultsPublic}`);
        payloadSummary = `Settings: ${parts.join(', ')}`;
      } else if (parsed.title) {
        payloadSummary = `Title: ${parsed.title}`;
      } else if (parsed.projectId) {
        payloadSummary = `Project: ${parsed.projectId}`;
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

  const evaluationProgressPercent =
    totalAssignedReviews > 0
      ? Math.round((completedReviews / totalAssignedReviews) * 100)
      : 0;
  const remainingReviews = Math.max(0, totalAssignedReviews - completedReviews);

  const kpis: DashboardKPIs = {
    totalSubmissions: projects.length,
    activeJudges: activeJudgesCount,
    totalJudges: judges.length,
    evaluationProgressPercent,
    remainingReviews,
    totalReviews: scores.length,
  };

  const communityGovernance: CommunityGovernanceData = {
    totalVotes: totalCommunityVotes,
    uniqueVoters: uniqueCommunityVoters,
    votingOpen: eventState?.votingOpen ?? true,
    resultsPublic: eventState?.resultsPublic ?? false,
    topFavorites: topCommunityFavorites.map((p) => ({
      id: p.id,
      title: p.title,
      trackName: p.track?.name || 'General',
      voteCount: p._count.communityVotes,
    })),
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
      communityGovernance={communityGovernance}
      judgeProgress={judgeProgress}
      leaderboard={leaderboard}
      recentAuditLogs={recentAuditLogs}
    />
  );
}
