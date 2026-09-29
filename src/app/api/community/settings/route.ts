import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { dispatchWebhookEvent } from '@/lib/webhooks';

export const dynamic = 'force-dynamic';

const SettingsSchema = z
  .object({
    resultsPublic: z.boolean().optional(),
    votingOpen: z.boolean().optional(),
    submissionsOpen: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.resultsPublic !== undefined ||
      data.votingOpen !== undefined ||
      data.submissionsOpen !== undefined,
    {
      message:
        'At least one setting (resultsPublic, votingOpen, or submissionsOpen) must be provided',
    }
  );

/**
 * GET /api/community/settings
 * Returns the current votingOpen, resultsPublic, and submissionsOpen lifecycle flags.
 */
export async function GET() {
  try {
    const event = await prisma.event.findFirst();
    const isSubmissionsOpen = event
      ? new Date(event.submissionsClose).getTime() > Date.now()
      : false;

    return NextResponse.json({
      success: true,
      votingOpen: event?.votingOpen ?? true,
      resultsPublic: event?.resultsPublic ?? false,
      submissionsOpen: isSubmissionsOpen,
      submissionsClose: event?.submissionsClose ? event.submissionsClose.toISOString() : null,
    });
  } catch (error) {
    console.error('Error in GET /api/community/settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/community/settings
 *
 * Organizer/admin only endpoint to toggle voting lifecycle and sealed results flags.
 * Logs COMMUNITY_SETTINGS_UPDATED to AuditLog.
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

    // 2. Authorize role: organizer or admin only
    if (session.role !== 'organizer' && session.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Organizer or admin access required' },
        { status: 403 }
      );
    }

    // 3. Parse & validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request body' },
        { status: 400 }
      );
    }

    const parseResult = SettingsSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    // 4. Find the active event
    const event = await prisma.event.findFirst();
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // 5. Update event flags
    const updateData: {
      resultsPublic?: boolean;
      votingOpen?: boolean;
      submissionsClose?: Date;
    } = {};
    if (typeof parseResult.data.resultsPublic === 'boolean') {
      updateData.resultsPublic = parseResult.data.resultsPublic;
    }
    if (typeof parseResult.data.votingOpen === 'boolean') {
      updateData.votingOpen = parseResult.data.votingOpen;
    }
    if (typeof parseResult.data.submissionsOpen === 'boolean') {
      // If true, extend submissionsClose to 7 days from now so submissions can be accepted.
      // If false, set submissionsClose to 1 second in the past to immediately lock submissions.
      updateData.submissionsClose = parseResult.data.submissionsOpen
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() - 1000);
    }

    const updatedEvent = await prisma.event.update({
      where: { id: event.id },
      data: updateData,
    });

    // 6. Append audit log
    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: 'COMMUNITY_SETTINGS_UPDATED',
        payload: JSON.stringify(updateData),
      },
    });

    if (updatedEvent.resultsPublic) {
      dispatchWebhookEvent('results.unsealed', {
        resultsPublic: updatedEvent.resultsPublic,
        votingOpen: updatedEvent.votingOpen,
        unsealedBy: session.email,
        timestamp: new Date().toISOString(),
      }).catch(() => {});
    }

    const isSubmissionsOpen =
      new Date(updatedEvent.submissionsClose).getTime() > Date.now();

    return NextResponse.json({
      success: true,
      votingOpen: updatedEvent.votingOpen,
      resultsPublic: updatedEvent.resultsPublic,
      submissionsOpen: isSubmissionsOpen,
      submissionsClose: updatedEvent.submissionsClose.toISOString(),
    });
  } catch (error) {
    console.error('Error in POST /api/community/settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
