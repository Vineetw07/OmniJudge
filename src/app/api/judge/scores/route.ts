import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ScoreItemSchema = z
  .object({
    criterionId: z.string().min(1, 'criterionId is required'),
    value: z.number().min(0).max(5),
  })
  .strict();

const SubmitScoresSchema = z
  .object({
    projectId: z.string().min(1, 'projectId is required'),
    scores: z.array(ScoreItemSchema).min(1, 'At least one criterion score is required'),
    comment: z.string().max(2000).optional().default(''),
  })
  .strict();

/**
 * GET /api/judge/scores
 *
 * RBAC Boundary Invariant:
 * - 401: Unauthenticated
 * - 403: Participants and non-judging roles
 * - 403: When a judge requests peer judge scores (?judge=<peer_judge_id>)
 * - 200: When a judge views their own scores
 * - 200: When an organizer or admin views all scores or queries a specific judge
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized: Valid session required' },
      { status: 401 }
    );
  }

  // Participants, visitors, or unknown roles cannot inspect judging scores
  if (
    session.role !== 'judge' &&
    session.role !== 'organizer' &&
    session.role !== 'admin'
  ) {
    return NextResponse.json(
      { error: 'Forbidden: Only judges and organizers can access judging scores' },
      { status: 403 }
    );
  }

  const targetJudge = req.nextUrl.searchParams.get('judge');

  // Strict RBAC Isolation for Judges
  if (session.role === 'judge') {
    // If requesting another judge's scores, forbid strictly
    if (targetJudge && targetJudge !== session.id) {
      return NextResponse.json(
        { error: 'Forbidden: Cannot view peer judge scores' },
        { status: 403 }
      );
    }

    // Query exclusively this judge's scores
    const scores = await prisma.score.findMany({
      where: { judgeId: session.id },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            trackId: true,
            track: { select: { id: true, name: true } },
          },
        },
        criterion: {
          select: {
            id: true,
            name: true,
            weight: true,
            maxScore: true,
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    return NextResponse.json({ scores });
  }

  // Organizer / Admin path
  const whereClause = targetJudge ? { judgeId: targetJudge } : {};
  const scores = await prisma.score.findMany({
    where: whereClause,
    include: {
      judge: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      project: {
        select: {
          id: true,
          title: true,
          trackId: true,
          track: { select: { id: true, name: true } },
        },
      },
      criterion: {
        select: {
          id: true,
          name: true,
          weight: true,
          maxScore: true,
        },
      },
    },
    orderBy: { submittedAt: 'desc' },
  });

  return NextResponse.json({ scores });
}

/**
 * POST /api/judge/scores
 *
 * Allows authenticated judges to submit rubric scores for projects in assigned tracks.
 * Uses atomic transaction for score upserts and immutable audit logging.
 */
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized: Valid session required' },
      { status: 401 }
    );
  }

  if (
    session.role !== 'judge' &&
    session.role !== 'organizer' &&
    session.role !== 'admin'
  ) {
    return NextResponse.json(
      { error: 'Forbidden: Only judges and organizers may submit scores' },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload' },
      { status: 400 }
    );
  }

  const parsed = SubmitScoresSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.format() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Check project existence
  const project = await prisma.project.findUnique({
    where: { id: data.projectId },
    include: { track: true },
  });

  if (!project) {
    return NextResponse.json(
      { error: 'Project not found' },
      { status: 404 }
    );
  }

  // Check judge track assignment if user is a judge
  if (session.role === 'judge') {
    const assignment = await prisma.judgeAssignment.findFirst({
      where: {
        userId: session.id,
        trackId: project.trackId,
      },
    });

    if (!assignment) {
      return NextResponse.json(
        {
          error: `Forbidden: Judge is not assigned to track '${project.track?.name || project.trackId}'`,
        },
        { status: 403 }
      );
    }
  }

  // Verify all criterion IDs exist before running transaction
  const criterionIds = data.scores.map((s) => s.criterionId);
  const foundCriteria = await prisma.rubricCriterion.findMany({
    where: { id: { in: criterionIds } },
  });

  if (foundCriteria.length !== criterionIds.length) {
    return NextResponse.json(
      { error: 'One or more criterion IDs are invalid' },
      { status: 400 }
    );
  }

  // Atomic transaction: upsert scores & record audit log
  await prisma.$transaction(async (tx) => {
    for (const item of data.scores) {
      const existing = await tx.score.findFirst({
        where: {
          judgeId: session.id,
          projectId: data.projectId,
          criterionId: item.criterionId,
        },
      });

      if (existing) {
        await tx.score.update({
          where: { id: existing.id },
          data: {
            value: item.value,
            comment: data.comment || '',
            submittedAt: new Date(),
          },
        });
      } else {
        await tx.score.create({
          data: {
            judgeId: session.id,
            projectId: data.projectId,
            criterionId: item.criterionId,
            value: item.value,
            comment: data.comment || '',
            submittedAt: new Date(),
          },
        });
      }
    }

    // Immutable audit trail
    await tx.auditLog.create({
      data: {
        userId: session.id,
        action: 'score_submitted',
        payload: JSON.stringify({
          projectId: data.projectId,
          trackId: project.trackId,
          scores: data.scores,
          comment: data.comment || '',
          submittedAt: new Date().toISOString(),
        }),
      },
    });
  });

  return NextResponse.json(
    { success: true, message: 'Scores submitted successfully' },
    { status: 200 }
  );
}
