import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const CreateCommentSchema = z
  .object({
    projectId: z.string().min(1, 'projectId is required'),
    content: z.string().min(1, 'content is required'),
  })
  .strict();

/**
 * GET /api/community/comments
 *
 * Query params: ?projectId=<id>
 * Returns unflagged comments ordered by createdAt desc with author metadata.
 */
export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId query parameter is required' },
        { status: 400 }
      );
    }

    const comments = await prisma.comment.findMany({
      where: {
        projectId,
        isFlagged: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            role: true,
            name: true,
          },
        },
      },
    });

    const mappedComments = comments.map((c) => ({
      id: c.id,
      projectId: c.projectId,
      userId: c.userId,
      authorName: c.authorName,
      authorRole: c.user?.role ?? 'visitor',
      content: c.content,
      createdAt: c.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      comments: mappedComments,
    });
  } catch (error) {
    console.error('Error in GET /api/community/comments:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/community/comments
 *
 * Body: { projectId: string, content: string }
 *
 * Enforces:
 * 1. Authentication (401)
 * 2. Body validation & project existence (400, 404)
 * 3. HTML tag stripping & 500-character max length (400)
 * 4. 10-second per-user rate limiting (429)
 * 5. Comment creation & AuditLog append (COMMENT_POSTED)
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

    const parseResult = CreateCommentSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { projectId, content } = parseResult.data;

    // 3. Find project
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

    // 4. Content sanitization: strip HTML tags & validate length <= 500
    const sanitizedContent = content.replace(/<[^>]*>/g, '').trim();
    if (sanitizedContent.length === 0 || sanitizedContent.length > 500) {
      return NextResponse.json(
        { error: 'Comment must be between 1 and 500 characters' },
        { status: 400 }
      );
    }

    // 5. Rate limiting: 1 comment per 10 seconds per user
    const tenSecondsAgo = new Date(Date.now() - 10000);
    const recentComment = await prisma.comment.findFirst({
      where: {
        userId: session.id,
        createdAt: {
          gte: tenSecondsAgo,
        },
      },
    });

    if (recentComment) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait a few seconds before commenting again.' },
        { status: 429 }
      );
    }

    // 6. Create comment and log to AuditLog
    const authorName = session.name || session.email;
    const comment = await prisma.comment.create({
      data: {
        projectId,
        userId: session.id,
        authorName,
        content: sanitizedContent,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: 'COMMENT_POSTED',
        payload: JSON.stringify({ projectId, commentId: comment.id }),
      },
    });

    return NextResponse.json({
      success: true,
      comment,
    });
  } catch (error) {
    console.error('Error in POST /api/community/comments:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
