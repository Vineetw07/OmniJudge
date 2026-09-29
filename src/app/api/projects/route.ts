import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const SubmissionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  summary: z.string().min(1, 'Summary is required'),
  repoUrl: z.string().url().optional().or(z.literal('')),
  trackId: z.string().optional(),
  teamId: z.string().optional(),
  eventId: z.string().optional(),
  isDraft: z.boolean().optional(),
});

/**
 * GET /api/projects
 * Public API to list projects
 */
export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { id: 'asc' },
    include: {
      track: true,
      team: true,
    },
  });

  return NextResponse.json({ projects });
}

/**
 * POST /api/projects
 * Handles project submissions. Checks participant authentication and deadline.
 */
export async function POST(req: NextRequest) {
  // 1. Authenticate user via session
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized: Valid session required' },
      { status: 401 }
    );
  }

  // Check role authorization (participant, organizer, admin)
  if (session.role !== 'participant' && session.role !== 'organizer' && session.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: Only participants or organizers may submit projects' },
      { status: 403 }
    );
  }

  // 2. Parse & validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload' },
      { status: 400 }
    );
  }

  const parseResult = SubmissionSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const data = parseResult.data;

  // 3. Look up Event & Check Deadline
  const event = data.eventId
    ? await prisma.event.findUnique({ where: { id: data.eventId } })
    : await prisma.event.findFirst();

  if (!event) {
    return NextResponse.json(
      { error: 'Active hackathon event not found' },
      { status: 404 }
    );
  }

  const now = Date.now();
  const closeTime = new Date(event.submissionsClose).getTime();

  if (closeTime < now) {
    return NextResponse.json(
      {
        error: 'Submissions are closed for this event',
        submissionsClose: event.submissionsClose.toISOString(),
        serverTime: new Date(now).toISOString(),
      },
      { status: 409 }
    );
  }

  // 4. If submission window is open, persist project
  let teamId = data.teamId;
  if (!teamId) {
    const membership = await prisma.teamMember.findUnique({
      where: { userId: session.id },
    });
    teamId = membership?.teamId;
  }

  if (!teamId) {
    const newTeam = await prisma.team.create({
      data: {
        id: `tm_${Date.now()}`,
        name: `${session.name}'s Team`,
        members: {
          create: { userId: session.id },
        },
      },
    });
    teamId = newTeam.id;
  }

  let trackId = data.trackId;
  if (!trackId) {
    const defaultTrack = await prisma.track.findFirst({
      where: { eventId: event.id },
    });
    trackId = defaultTrack?.id || 'trk_01';
  }

  const projectId = `prj_${Date.now()}`;
  const project = await prisma.project.create({
    data: {
      id: projectId,
      title: data.title,
      summary: data.summary,
      repoUrl: data.repoUrl || '',
      teamId,
      trackId,
      eventId: event.id,
      submittedAt: new Date(),
      isDraft: data.isDraft ?? false,
    },
  });

  // Log to AuditLog
  await prisma.auditLog.create({
    data: {
      userId: session.id,
      action: 'PROJECT_SUBMIT',
      payload: JSON.stringify({ projectId, title: data.title }),
    },
  });

  return NextResponse.json({ success: true, project }, { status: 201 });
}
