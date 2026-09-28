import crypto from 'crypto';
import { prisma } from './prisma';

export const SUPPORTED_WEBHOOK_EVENTS = [
  'score.submitted',
  'vote.cast',
  'results.unsealed',
  'webhook.test',
] as const;

export type WebhookEventName = (typeof SUPPORTED_WEBHOOK_EVENTS)[number];

export interface WebhookDeliveryEnvelope<T = unknown> {
  id: string;
  event: WebhookEventName;
  timestamp: string;
  data: T;
}

/**
 * Computes HMAC-SHA256 signature for the webhook payload.
 */
export function signWebhookPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export interface DispatchWebhookOptions {
  targetSubscriptionId?: string;
}

/**
 * Dispatches an event payload asynchronously to all active matching webhook subscriptions.
 * Enforces non-blocking execution so main transactions never fail if an external webhook endpoint is slow or offline.
 */
export async function dispatchWebhookEvent<T = unknown>(
  event: WebhookEventName,
  data: T,
  options?: DispatchWebhookOptions
): Promise<{ dispatchedCount: number; errors: string[] }> {
  const errors: string[] = [];
  let dispatchedCount = 0;

  try {
    const subscriptions = await prisma.webhookSubscription.findMany({
      where: { isActive: true },
    });

    const matching = subscriptions.filter((sub) => {
      if (options?.targetSubscriptionId) {
        return sub.id === options.targetSubscriptionId;
      }
      if (event === 'webhook.test') {
        return true;
      }
      const subEvents = sub.events.split(',').map((e) => e.trim().toLowerCase());
      return subEvents.includes('*') || subEvents.includes(event.toLowerCase());
    });

    if (matching.length === 0) {
      return { dispatchedCount: 0, errors: [] };
    }

    const deliveryPayload: WebhookDeliveryEnvelope<T> = {
      id: `dlv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    const serialized = JSON.stringify(deliveryPayload);

    // Asynchronously dispatch to all subscribers
    const dispatchPromises = matching.map(async (sub) => {
      try {
        const signature = signWebhookPayload(serialized, sub.secret);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const res = await fetch(sub.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-OmniJudge-Signature': signature,
            'X-OmniJudge-Signature-256': signature,
            'X-OmniJudge-Event': event,
            'X-OmniJudge-Delivery': deliveryPayload.id,
            'User-Agent': 'OmniJudge-Webhook-Engine/1.0',
          },
          body: serialized,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        dispatchedCount++;

        return { url: sub.url, status: res.status, ok: res.ok };
      } catch (subErr) {
        const msg = `Webhook failed for ${sub.url}: ${subErr instanceof Error ? subErr.message : 'Unknown error'}`;
        errors.push(msg);
        return { url: sub.url, error: msg };
      }
    });

    await Promise.allSettled(dispatchPromises);
  } catch (err) {
    errors.push(
      `Webhook dispatch engine error: ${err instanceof Error ? err.message : 'Unknown'}`
    );
  }

  return { dispatchedCount, errors };
}
