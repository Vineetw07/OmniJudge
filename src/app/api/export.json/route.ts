import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { normaliseAllJudges } from '@/lib/normalization';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized: Session required' }, { status: 401 });
  }

  // RBAC: Only organizers and admins can execute bulk JSON exports
  if (session.role !== 'organizer' && session.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: Bulk data export is restricted to organizers' },
      { status: 403 }
    );
  }

  try {
    const [
      event,
      tracks,
      teams,
      projects,
      criteria,
      scores,
      comments,
      communityVoteCounts,
      recentAuditLogs,
      webhooks,
    ] = await Promise.all([
      prisma.event.findFirst(),
      prisma.track.findMany({ orderBy: { id: 'asc' } }),
      prisma.team.findMany({
        include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
        orderBy: { id: 'asc' },
      }),
      prisma.project.findMany({
        include: { track: true, team: true },
        orderBy: { id: 'asc' },
      }),
      prisma.rubricCriterion.findMany({ orderBy: { weight: 'desc' } }),
      prisma.score.findMany({ orderBy: { submittedAt: 'asc' } }),
      prisma.comment.findMany({
        where: { isFlagged: false },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.communityVote.groupBy({
        by: ['projectId'],
        _count: { id: true },
      }),
      prisma.auditLog.findMany({
        take: 100,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, role: true } } },
      }),
      prisma.webhookSubscription.findMany({
        select: { id: true, url: true, events: true, isActive: true, createdAt: true },
      }),
    ]);

    // 1. Build criterion weight map
    const criteriaWeights = new Map<string, number>(
      criteria.map((c) => [c.id, c.weight])
    );

    // 2. Group criterion scores by (judgeId -> projectId -> stats)
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
        const composite = stats.weightTotal > 0 ? stats.weightedSum / stats.weightTotal : 0;
        rawScores.set(projectId, composite);
      });
      judgeRawMap.set(judgeId, rawScores);
    });

    // 4. Normalise with MAD Method
    const judgeNormMap = normaliseAllJudges(judgeRawMap);

    // 5. Aggregate project scores & rank
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
      const normCount = normScoresForProject.length;
      const avgRaw = count > 0 ? rawScoresForProject.reduce((acc, v) => acc + v, 0) / count : 0;
      const avgNorm = normCount > 0 ? normScoresForProject.reduce((acc, v) => acc + v, 0) / normCount : 0;

      return {
        id: project.id,
        title: project.title,
        trackName: project.track?.name || 'General',
        teamName: project.team?.name || 'Independent',
        rawScore: Number(avgRaw.toFixed(4)),
        normalizedScore: Number(avgNorm.toFixed(4)),
        reviewCount: count,
      };
    });

    projectResults.sort((a, b) => {
      const aHasReviews = a.reviewCount > 0;
      const bHasReviews = b.reviewCount > 0;
      if (aHasReviews !== bHasReviews) return aHasReviews ? -1 : 1;
      if (Math.abs(b.normalizedScore - a.normalizedScore) > 1e-9) {
        return b.normalizedScore - a.normalizedScore;
      }
      if (Math.abs(b.rawScore - a.rawScore) > 1e-9) {
        return b.rawScore - a.rawScore;
      }
      return a.id.localeCompare(b.id);
    });

    const normalizedLeaderboard = projectResults.map((item, index) => ({
      rank: index + 1,
      ...item,
    }));

    const voteCountMap: Record<string, number> = {};
    for (const v of communityVoteCounts) {
      voteCountMap[v.projectId] = v._count.id;
    }

    const exportPayload = {
      exportVersion: '1.0.0',
      system: 'OmniJudge Hackathon Platform',
      exportedAt: new Date().toISOString(),
      exportedBy: {
        id: session.id,
        name: session.name,
        email: session.email,
        role: session.role,
      },
      event: event
        ? {
            id: event.id,
            name: event.name,
            submissionsClose: event.submissionsClose.toISOString(),
            votingOpen: event.votingOpen,
            resultsPublic: event.resultsPublic,
          }
        : null,
      summary: {
        totalTracks: tracks.length,
        totalTeams: teams.length,
        totalProjects: projects.length,
        totalCriteria: criteria.length,
        totalScores: scores.length,
        totalComments: comments.length,
        totalCommunityVotes: communityVoteCounts.reduce((acc, c) => acc + c._count.id, 0),
      },
      tracks,
      rubricCriteria: criteria,
      teams: teams.map((t) => ({
        id: t.id,
        name: t.name,
        members: t.members.map((m) => ({
          userId: m.userId,
          name: m.user.name,
          email: m.user.email,
        })),
      })),
      projects: projects.map((p) => ({
        id: p.id,
        title: p.title,
        summary: p.summary,
        repoUrl: p.repoUrl,
        trackId: p.trackId,
        trackName: p.track?.name,
        teamId: p.teamId,
        teamName: p.team?.name,
        submittedAt: p.submittedAt.toISOString(),
        communityVotes: voteCountMap[p.id] || 0,
      })),
      scores: scores.map((s) => ({
        id: s.id,
        judgeId: s.judgeId,
        projectId: s.projectId,
        criterionId: s.criterionId,
        value: s.value,
        comment: s.comment,
        submittedAt: s.submittedAt.toISOString(),
      })),
      normalizedLeaderboard,
      comments: comments.map((c) => ({
        id: c.id,
        projectId: c.projectId,
        authorName: c.authorName,
        content: c.content,
        createdAt: c.createdAt.toISOString(),
      })),
      webhooks,
      recentAuditLogs: recentAuditLogs.map((l) => ({
        id: l.id,
        action: l.action,
        user: l.user,
        payload: l.payload,
        createdAt: l.createdAt.toISOString(),
      })),
    };

    const jsonString = JSON.stringify(exportPayload, null, 2);

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="omnijudge_full_export.json"',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Internal Server Error: ${err instanceof Error ? err.message : 'Unknown'}` },
      { status: 500 }
    );
  }
}
