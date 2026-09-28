import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const VoteBodySchema = z
  .object({
    projectId: z.string().min(1, 'projectId is required'),
  })
  .strict();

/**
 * GET /api/community/vote
 *
 * Query params: ?projectId=<id>
 * - Returns user's hasVoted state for the specified project (or array of voted projects if no projectId).
 * - Sealed Results Invariant: totalVotes is strictly null for non-organizers / non-admins
 *   while event.resultsPublic is false.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    const projectId = req.nextUrl.searchParams.get('projectId');
    const event = await prisma.event.findFirst();

    const votingOpen = event?.votingOpen ?? true;
    const resultsPublic = event?.resultsPublic ?? false;
    const isOrganizerOrAdmin = session?.role === 'organizer' || session?.role === 'admin';

    // If no specific projectId is requested, return summary / user voted list
    if (!projectId) {
      let userVotes: string[] = [];
      if (session) {
        const votes = await prisma.communityVote.findMany({
          where: { userId: session.id },
          select: { projectId: true },
        });
        userVotes = votes.map((v) => v.projectId);
      }

      return NextResponse.json({
        userVotes,
        votingOpen,
        resultsPublic,
      });
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check if current user has voted on this project
    let hasVoted = false;
    if (session) {
      const existingVote = await prisma.communityVote.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId: session.id,
          },
        },
      });
      hasVoted = !!existingVote;
    }

    // Sealed Results Invariant: strictly null for non-organizers when results are sealed
    let totalVotes: number | null = null;
    if (resultsPublic || isOrganizerOrAdmin) {
      totalVotes = await prisma.communityVote.count({
        where: { projectId },
      });
    }

    return NextResponse.json({
      hasVoted,
      totalVotes,
      votingOpen,
      resultsPublic,
    });
  } catch (error) {
    console.error('Error in GET /api/community/vote:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/community/vote
 *
 * Body: { projectId: string }
 *
 * Enforces:
 * 1. Authentication (401)
 * 2. Voting window lifecycle (403 if closed)
 * 3. Project existence (404)
 * 4. Self-vote defense: team members cannot vote for their own project (403)
 * 5. Vote toggle: cast if not voted, retract if already voted
 * 6. AuditLog append (COMMUNITY_VOTE_CAST / COMMUNITY_VOTE_RETRACTED)
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate session
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized: Valid session required' },
        { status: 401 }
      );
    }

    // 2. Parse & validate body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request body' },
        { status: 400 }
      );
    }

    const parseResult = VoteBodySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { projectId } = parseResult.data;

    // 3. Check voting lifecycle
    const event = await prisma.event.findFirst();
    if (event && event.votingOpen === false) {
      return NextResponse.json(
        { error: 'Community voting is currently closed' },
        { status: 403 }
      );
    }

    // 4. Find project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, teamId: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // 5. Self-Vote Defense: Query user's team membership
    const teamMember = await prisma.teamMember.findUnique({
      where: { userId: session.id },
      select: { teamId: true },
    });

    if (teamMember && teamMember.teamId === project.teamId) {
      return NextResponse.json(
        { error: 'Team members cannot vote for their own submission' },
        { status: 403 }
      );
    }

    // 6. Duplicate / Toggle Defense
    const existingVote = await prisma.communityVote.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: session.id,
        },
      },
    });

    if (existingVote) {
      // Retract vote
      await prisma.$transaction([
        prisma.communityVote.delete({
          where: { id: existingVote.id },
        }),
        prisma.auditLog.create({
          data: {
            userId: session.id,
            action: 'COMMUNITY_VOTE_RETRACTED',
            payload: JSON.stringify({ projectId }),
          },
        }),
      ]);

      return NextResponse.json({
        success: true,
        hasVoted: false,
        message: 'Vote retracted',
      });
    } else {
      // Cast vote
      await prisma.$transaction([
        prisma.communityVote.create({
          data: {
            projectId,
            userId: session.id,
          },
        }),
        prisma.auditLog.create({
          data: {
            userId: session.id,
            action: 'COMMUNITY_VOTE_CAST',
            payload: JSON.stringify({ projectId }),
          },
        }),
      ]);

      return NextResponse.json({
        success: true,
        hasVoted: true,
        message: 'Vote cast',
      });
    }
  } catch (error) {
    console.error('Error in POST /api/community/vote:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
