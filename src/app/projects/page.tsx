import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth';
import { computeRankedProjects, LeaderboardEntry } from '@/lib/ranking';
import { ProjectsClient } from './projects-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Project Gallery | OmniJudge',
  description: 'Explore submissions and projects participating in OmniJudge.',
};

export default async function ProjectsPage() {
  const [projects, session, event, tracks] = await Promise.all([
    prisma.project.findMany({
      take: 40,
      orderBy: { id: 'asc' },
      include: {
        team: true,
        track: true,
      },
    }),
    getServerSession(),
    prisma.event.findFirst({
      select: {
        votingOpen: true,
        resultsPublic: true,
        submissionsClose: true,
      },
    }),
    prisma.track.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  const votingOpen = event?.votingOpen ?? true;
  const resultsPublic = event?.resultsPublic ?? false;
  const submissionsOpen = event
    ? new Date(event.submissionsClose).getTime() > Date.now()
    : false;
  const isOrganizerOrAdmin = session?.role === 'organizer' || session?.role === 'admin';

  // Get user's voted project IDs if authenticated
  let userVotedIds: string[] = [];
  if (session) {
    const votes = await prisma.communityVote.findMany({
      where: { userId: session.id },
      select: { projectId: true },
    });
    userVotedIds = votes.map((v) => v.projectId);
  }

  // Get comment counts per project (unflagged comments)
  const commentCountsRaw = await prisma.comment.groupBy({
    by: ['projectId'],
    where: { isFlagged: false },
    _count: { id: true },
  });
  const commentCounts: Record<string, number> = {};
  for (const c of commentCountsRaw) {
    commentCounts[c.projectId] = c._count.id;
  }

  // If resultsPublic or organizer/admin, get vote counts per project
  let voteCounts: Record<string, number> | null = null;
  if (resultsPublic || isOrganizerOrAdmin) {
    const voteCountsRaw = await prisma.communityVote.groupBy({
      by: ['projectId'],
      _count: { id: true },
    });
    voteCounts = {};
    for (const v of voteCountsRaw) {
      voteCounts[v.projectId] = v._count.id;
    }
  }

  // Compute initial leaderboard if results are public or user is organizer/admin
  let initialLeaderboard: LeaderboardEntry[] | null = null;
  if (resultsPublic || isOrganizerOrAdmin) {
    const ranked = await computeRankedProjects();
    initialLeaderboard = ranked.map((p) => ({
      rank: p.rank,
      trackRank: p.trackRank,
      projectId: p.projectId,
      title: p.title,
      trackName: p.trackName,
      normalizedScore: Number(p.normalizedScore.toFixed(4)),
      reviewCount: p.reviewCount,
    }));
  }

  return (
    <main className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      {/* Hero Banner with glowing pill badge */}
      <div className="text-center md:text-left mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs font-medium tracking-wide mb-4 shadow-[0_0_15px_rgba(56,189,248,0.2)]">
          <span>✦ OMNIJUDGE PORTAL</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-3">
          Project Gallery
        </h1>
        <p className="text-slate-400 text-base sm:text-lg max-w-2xl leading-relaxed">
          Discover all projects submitted to OmniJudge. Explore innovative work across every track.
        </p>
      </div>

      {/* Client island for search, track filtering, randomized ballot, voting, comments, submissions, and judge rankings */}
      <ProjectsClient
        initialProjects={projects}
        initialUserVotedIds={userVotedIds}
        initialVotingOpen={votingOpen}
        initialResultsPublic={resultsPublic}
        initialSubmissionsOpen={submissionsOpen}
        submissionsClose={event?.submissionsClose.toISOString() ?? null}
        tracks={tracks}
        initialVoteCounts={voteCounts}
        initialCommentCounts={commentCounts}
        initialLeaderboard={initialLeaderboard}
        isOrganizerOrAdmin={isOrganizerOrAdmin}
        currentUserId={session?.id ?? null}
        currentUserRole={session?.role ?? null}
      />
    </main>
  );
}
