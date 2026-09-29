import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { computeRankedProjects } from '@/lib/ranking';

export const dynamic = 'force-dynamic';

/**
 * GET /api/leaderboard
 *
 * Public Judge Ranking Leaderboard:
 * - 401 Unauthorized if no valid session
 * - 403 Forbidden if resultsPublic is false AND caller is NOT organizer/admin
 * - 200 OK if resultsPublic is true OR caller is organizer/admin
 *
 * Returns sanitized MAD-normalized ranking without per-judge scores or PII.
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized: Valid session required' },
      { status: 401 }
    );
  }

  const event = await prisma.event.findFirst({
    select: { resultsPublic: true },
  });
  const resultsPublic = event?.resultsPublic ?? false;
  const isOrganizerOrAdmin = session.role === 'organizer' || session.role === 'admin';

  if (!resultsPublic && !isOrganizerOrAdmin) {
    return NextResponse.json(
      { error: 'Results are not yet public' },
      { status: 403 }
    );
  }

  const rankedProjects = await computeRankedProjects();

  const leaderboard = rankedProjects.map((p) => ({
    rank: p.rank,
    trackRank: p.trackRank,
    projectId: p.projectId,
    title: p.title,
    trackName: p.trackName,
    normalizedScore: Number(p.normalizedScore.toFixed(4)),
    reviewCount: p.reviewCount,
  }));

  return NextResponse.json({
    resultsPublic,
    leaderboard,
  });
}
