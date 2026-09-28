import crypto from 'crypto';

export interface CanonicalJudgePayload {
  event: string;
  issuedAt: string;
  judgeId: string;
  judgeName: string;
  reviewsCompleted: number;
  tracks: string[];
}

export interface CertificateEnvelope {
  payload: CanonicalJudgePayload;
  signature: string;
}

export interface VerificationResult {
  isValid: boolean;
  payload: CanonicalJudgePayload | null;
  signature: string | null;
  error?: string;
}

const DEFAULT_SECRET = process.env.SESSION_SECRET || 'omnijudge_secret_2026';

/**
 * Serializes payload into canonical JSON with sorted keys to guarantee deterministic signature verification.
 */
export function toCanonicalJson(payload: CanonicalJudgePayload): string {
  return JSON.stringify({
    event: payload.event,
    issuedAt: payload.issuedAt,
    judgeId: payload.judgeId,
    judgeName: payload.judgeName,
    reviewsCompleted: payload.reviewsCompleted,
    tracks: [...payload.tracks].sort(),
  });
}

/**
 * Computes HMAC-SHA256 signature for canonical judge evaluation payload.
 */
export function signJudgePayload(
  payload: CanonicalJudgePayload,
  secret = DEFAULT_SECRET
): string {
  const canonical = toCanonicalJson(payload);
  return crypto.createHmac('sha256', secret).update(canonical).digest('hex');
}

/**
 * Creates URL-safe Base64 token containing the payload and signature.
 */
export function createCertificateToken(
  payload: CanonicalJudgePayload,
  secret = DEFAULT_SECRET
): string {
  const signature = signJudgePayload(payload, secret);
  const envelope: CertificateEnvelope = { payload, signature };
  return Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64url');
}

/**
 * Verifies URL-safe Base64 certificate token with timing-safe HMAC equality check.
 * Supports URL-safe base64 tokens, full URLs with ?record=, and raw JSON envelopes.
 */
export function verifyCertificateToken(
  token: string,
  secret = DEFAULT_SECRET
): VerificationResult {
  try {
    let cleanToken = (token || '').trim();

    // 1. Extract record param if a full or partial URL was provided
    if (cleanToken.includes('record=')) {
      const match = cleanToken.match(/[?&]record=([^&#\s]+)/);
      if (match) {
        cleanToken = decodeURIComponent(match[1]);
      }
    }

    // 2. Detect bare 64-char hex signature without payload
    if (/^[0-9a-fA-F]{64}$/.test(cleanToken)) {
      return {
        isValid: false,
        payload: null,
        signature: cleanToken.toLowerCase(),
        error:
          'A signature alone cannot be verified without its evaluation payload. Please paste the full certificate token or verification URL.',
      };
    }

    // 3. Decode base64url or parse raw JSON
    let raw = '';
    if (cleanToken.startsWith('{') && cleanToken.endsWith('}')) {
      raw = cleanToken;
    } else {
      raw = Buffer.from(cleanToken, 'base64url').toString('utf8');
    }

    const parsed = JSON.parse(raw) as Partial<CertificateEnvelope>;

    if (!parsed || !parsed.payload || !parsed.signature) {
      return {
        isValid: false,
        payload: null,
        signature: null,
        error: 'Malformed certificate envelope structure: missing payload or signature',
      };
    }

    const { payload, signature } = parsed;

    // Validate required fields
    if (
      typeof payload.judgeId !== 'string' ||
      typeof payload.judgeName !== 'string' ||
      !Array.isArray(payload.tracks) ||
      typeof payload.reviewsCompleted !== 'number' ||
      !Number.isFinite(payload.reviewsCompleted) ||
      payload.reviewsCompleted < 0 ||
      typeof payload.event !== 'string' ||
      typeof payload.issuedAt !== 'string'
    ) {
      return {
        isValid: false,
        payload: null,
        signature: typeof signature === 'string' ? signature : null,
        error: 'Payload schema violation: missing or invalid judge credential fields',
      };
    }

    const expectedSignature = signJudgePayload(payload, secret);

    const sigBuf = Buffer.from(signature, 'hex');
    const expectedBuf = Buffer.from(expectedSignature, 'hex');

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return {
        isValid: false,
        payload,
        signature,
        error: 'Cryptographic signature mismatch. Record may have been tampered with.',
      };
    }

    return {
      isValid: true,
      payload,
      signature,
    };
  } catch (err) {
    return {
      isValid: false,
      payload: null,
      signature: null,
      error: `Failed to decode or parse certificate token: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}
