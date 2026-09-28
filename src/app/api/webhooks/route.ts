import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { dispatchWebhookEvent } from '@/lib/webhooks';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized: Session required' }, { status: 401 });
  }

  // RBAC: Only organizers and admins can inspect or configure webhooks
  if (session.role !== 'organizer' && session.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: Webhook configuration is restricted to organizers' },
      { status: 403 }
    );
  }

  const subscriptions = await prisma.webhookSubscription.findMany({
    orderBy: { createdAt: 'desc' },
  });

  // Mask secrets before sending over wire
  const sanitized = subscriptions.map((sub) => ({
    id: sub.id,
    url: sub.url,
    events: sub.events,
    isActive: sub.isActive,
    createdAt: sub.createdAt.toISOString(),
    maskedSecret:
      sub.secret.length > 4
        ? `${sub.secret.slice(0, 3)}••••••••${sub.secret.slice(-2)}`
        : '••••••••',
  }));

  return NextResponse.json({
    success: true,
    subscriptions: sanitized,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized: Session required' }, { status: 401 });
  }

  if (session.role !== 'organizer' && session.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: Webhook registration is restricted to organizers' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();

    // Check if this is a test ping request
    if (body.action === 'test' || body.test === true) {
      const subscriptionId = body.id || body.subscriptionId;
      let targetUrl = body.url;

      if (subscriptionId) {
        const sub = await prisma.webhookSubscription.findUnique({
          where: { id: subscriptionId },
        });
        if (sub) targetUrl = sub.url;
      }

      const result = await dispatchWebhookEvent(
        'webhook.test',
        {
          message: 'OmniJudge test ping event',
          triggeredBy: session.email,
          targetUrl,
          timestamp: new Date().toISOString(),
        },
        subscriptionId ? { targetSubscriptionId: subscriptionId } : undefined
      );

      return NextResponse.json({
        success: true,
        message: 'Test ping dispatched',
        result,
      });
    }

    // Standard Registration
    const { url, secret, events } = body;

    if (!url || typeof url !== 'string' || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      return NextResponse.json(
        { error: 'Bad Request: "url" must be a valid HTTP or HTTPS endpoint' },
        { status: 400 }
      );
    }

    if (!secret || typeof secret !== 'string' || secret.trim().length < 6) {
      return NextResponse.json(
        { error: 'Bad Request: "secret" must be a string with at least 6 characters' },
        { status: 400 }
      );
    }

    let eventString = 'score.submitted,vote.cast,results.unsealed';
    if (Array.isArray(events)) {
      eventString = events.join(',');
    } else if (typeof events === 'string' && events.trim().length > 0) {
      eventString = events.trim();
    }

    const newSub = await prisma.webhookSubscription.create({
      data: {
        url: url.trim(),
        secret: secret.trim(),
        events: eventString,
        isActive: true,
      },
    });

    // Write to immutable AuditLog
    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: 'WEBHOOK_REGISTERED',
        payload: JSON.stringify({
          subscriptionId: newSub.id,
          url: newSub.url,
          events: newSub.events,
        }),
      },
    });

    return NextResponse.json(
      {
        success: true,
        subscription: {
          id: newSub.id,
          url: newSub.url,
          events: newSub.events,
          isActive: newSub.isActive,
          createdAt: newSub.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: `Internal Server Error: ${err instanceof Error ? err.message : 'Unknown'}` },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized: Session required' }, { status: 401 });
  }

  if (session.role !== 'organizer' && session.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: Webhook deletion is restricted to organizers' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');

    if (!id) {
      const body = await req.json().catch(() => ({}));
      id = body.id;
    }

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'Bad Request: Webhook subscription "id" is required' },
        { status: 400 }
      );
    }

    const existing = await prisma.webhookSubscription.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Not Found: Webhook subscription does not exist' },
        { status: 404 }
      );
    }

    await prisma.webhookSubscription.delete({
      where: { id },
    });

    // Write to AuditLog
    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: 'WEBHOOK_DELETED',
        payload: JSON.stringify({
          subscriptionId: id,
          url: existing.url,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Webhook subscription ${id} successfully removed`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Internal Server Error: ${err instanceof Error ? err.message : 'Unknown'}` },
      { status: 500 }
    );
  }
}
