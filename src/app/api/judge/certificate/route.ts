import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import {
  CanonicalJudgePayload,
  createCertificateToken,
  signJudgePayload,
  verifyCertificateToken,
} from '@/lib/certificates';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized: Session required' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const requestedJudgeId = searchParams.get('judgeId') || session.id;

  // RBAC & IDOR Enforcement:
  // Judges can only generate certificates for themselves
  // Organizers / Admins can generate for any judge
  // Participants/Visitors are blocked (403)
  if (session.role === 'judge') {
    if (requestedJudgeId !== session.id) {
      return NextResponse.json(
        { error: 'Forbidden: Judges cannot inspect peer certificate records' },
        { status: 403 }
      );
    }
  } else if (session.role !== 'organizer' && session.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient privileges to generate judge certificates' },
      { status: 403 }
    );
  }

  // Fetch target judge
  const judge = await prisma.user.findUnique({
    where: { id: requestedJudgeId },
    select: { id: true, name: true, role: true },
  });

  if (!judge || (judge.role !== 'judge' && judge.role !== 'admin' && judge.role !== 'organizer')) {
    return NextResponse.json(
      { error: 'Not Found: Designated judge account does not exist' },
      { status: 404 }
    );
  }

  // Fetch assigned tracks
  const assignments = await prisma.judgeAssignment.findMany({
    where: { userId: judge.id },
    include: { track: true },
  });

  const trackNames = assignments.map((a) => a.track.name);

  // Fetch count of unique projects evaluated
  const evaluatedProjects = await prisma.score.findMany({
    where: { judgeId: judge.id },
    select: { projectId: true },
    distinct: ['projectId'],
  });

  // Fetch event name
  const event = await prisma.event.findFirst({
    select: { name: true },
  });

  const canonicalPayload: CanonicalJudgePayload = {
    judgeId: judge.id,
    judgeName: judge.name,
    tracks: trackNames.length > 0 ? trackNames : ['General'],
    reviewsCompleted: evaluatedProjects.length,
    event: event?.name || 'Sample Hack 2026',
    issuedAt: new Date().toISOString(),
  };

  const signature = signJudgePayload(canonicalPayload);
  const token = createCertificateToken(canonicalPayload);

  return NextResponse.json({
    success: true,
    payload: canonicalPayload,
    signature,
    token,
    verificationUrl: `/verify?record=${token}`,
  });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> | null = null;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: 'Bad Request: Malformed JSON body' },
      { status: 400 }
    );
  }

  try {
    let token = body?.token || body?.record;

    // If caller posted the raw certificate envelope directly as JSON
    if (!token && body?.payload && body?.signature) {
      token = JSON.stringify(body);
    }

    if (!token || (typeof token !== 'string' && typeof token !== 'object')) {
      return NextResponse.json(
        { error: 'Bad Request: "token" or "record" string is required for verification' },
        { status: 400 }
      );
    }

    const tokenStr = typeof token === 'string' ? token : JSON.stringify(token);
    const result = verifyCertificateToken(tokenStr);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: `Internal Server Error: ${err instanceof Error ? err.message : 'Unknown'}` },
      { status: 500 }
    );
  }
}
