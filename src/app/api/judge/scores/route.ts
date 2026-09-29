import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { dispatchWebhookEvent } from '@/lib/webhooks';

export const dynamic = 'force-dynamic';

const ScoreItemSchema = z
  .object({
    criterionId: z.string().min(1, 'criterionId is required'),
    value: z.number().min(0, 'Score cannot be negative'),
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
 * Allows authenticated judges to submit complete rubric scores for projects in assigned tracks.
 * Blocks organizers from scoring, guards against unsubmitted drafts, validates dynamic maxScores,
 * uses atomic upserts to prevent race duplicates, and logs before/after diffs in the audit trail.
 */
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized: Valid session required' },
      { status: 401 }
    );
  }

  // Strict RBAC: Only assigned judges may submit scores (organizers and participants are barred)
  if (session.role !== 'judge') {
    return NextResponse.json(
      { error: 'Forbidden: Only judges may submit scores' },
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

  // Guard against scoring unsubmitted drafts
  if (project.isDraft) {
    return NextResponse.json(
      { error: 'Cannot score an unsubmitted draft project' },
      { status: 400 }
    );
  }

  // Check judge track assignment
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

  // Conflict of Interest (COI) Defense: Bar judges from evaluating their own team's project
  const isTeamMember = await prisma.teamMember.findFirst({
    where: {
      userId: session.id,
      teamId: project.teamId,
    },
  });

  if (isTeamMember) {
    return NextResponse.json(
      {
        error: 'Forbidden: Conflict of interest — judges cannot evaluate their own team project',
      },
      { status: 403 }
    );
  }

  // Fetch all active rubric criteria
  const allCriteria = await prisma.rubricCriterion.findMany();
  const allCriteriaMap = new Map(allCriteria.map((c) => [c.id, c]));

  // Verify all submitted criterion IDs exist
  const submittedIds = new Set(data.scores.map((s) => s.criterionId));
  for (const cid of Array.from(submittedIds)) {
    if (!allCriteriaMap.has(cid)) {
      return NextResponse.json(
        { error: `One or more criterion IDs are invalid: ${cid}` },
        { status: 400 }
      );
    }
  }

  // Enforce complete rubric submission (all criteria must be evaluated)
  if (data.scores.length !== allCriteria.length || submittedIds.size !== allCriteria.length) {
    return NextResponse.json(
      {
        error: `Validation failed: Complete rubric required. Submitted ${data.scores.length} of ${allCriteria.length} criteria.`,
      },
      { status: 400 }
    );
  }

  // Validate dynamic maxScore per criterion
  for (const item of data.scores) {
    const crit = allCriteriaMap.get(item.criterionId)!;
    if (item.value > crit.maxScore) {
      return NextResponse.json(
        {
          error: `Validation failed: Score for criterion '${crit.name}' exceeds maximum allowed (${crit.maxScore})`,
        },
        { status: 400 }
      );
    }
  }

  // Capture existing scores for verifiable audit diff
  const previousScores = await prisma.score.findMany({
    where: {
      judgeId: session.id,
      projectId: data.projectId,
    },
  });
  const prevMap = new Map(previousScores.map((s) => [s.criterionId, s.value]));

  // Atomic transaction: upsert scores & record immutable audit log with diffs
  await prisma.$transaction(async (tx) => {
    for (const item of data.scores) {
      await tx.score.upsert({
        where: {
          judgeId_projectId_criterionId: {
            judgeId: session.id,
            projectId: data.projectId,
            criterionId: item.criterionId,
          },
        },
        update: {
          value: item.value,
          comment: data.comment || '',
          submittedAt: new Date(),
        },
        create: {
          judgeId: session.id,
          projectId: data.projectId,
          criterionId: item.criterionId,
          value: item.value,
          comment: data.comment || '',
          submittedAt: new Date(),
        },
      });
    }

    const scoreDiffs = data.scores.map((item) => ({
      criterionId: item.criterionId,
      previousValue: prevMap.get(item.criterionId) ?? null,
      newValue: item.value,
    }));

    // Immutable audit trail with before/after state
    await tx.auditLog.create({
      data: {
        userId: session.id,
        action: 'score_submitted',
        payload: JSON.stringify({
          projectId: data.projectId,
          trackId: project.trackId,
          scores: scoreDiffs,
          comment: data.comment || '',
          submittedAt: new Date().toISOString(),
        }),
      },
    });
  });

  // Asynchronously dispatch webhook event (non-blocking)
  dispatchWebhookEvent('score.submitted', {
    judgeId: session.id,
    projectId: data.projectId,
    trackId: project.trackId,
    scoresCount: data.scores.length,
    timestamp: new Date().toISOString(),
  }).catch((err) => {
    console.error('Failed to dispatch score.submitted webhook:', err);
  });

  return NextResponse.json(
    { success: true, message: 'Scores submitted successfully' },
    { status: 200 }
  );
}
