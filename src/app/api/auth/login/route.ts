import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
});

/**
 * POST /api/auth/login
 * Validates email, finds user in DB, retrieves or creates active session, and sets cookie.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload' },
      { status: 400 }
    );
  }

  const parseResult = LoginSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Valid email address is required' },
      { status: 400 }
    );
  }

  const { email } = parseResult.data;

  // 1. Look up user by email
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return NextResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  }

  // 2. Always issue a fresh, cryptographically secure session token (never reuse seeded tokens)
  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days session validity

  const session = await prisma.session.create({
    data: {
      id: token,
      userId: user.id,
      expiresAt,
    },
  });

  // 3. Immutable audit trail on login
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'user_login',
      payload: JSON.stringify({
        email: user.email,
        role: user.role,
        timestamp: new Date().toISOString(),
      }),
    },
  });

  // 3. Build response with Set-Cookie header
  const response = NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });

  response.cookies.set({
    name: 'session',
    value: session.id,
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: false, // Ensure cookies are preserved over standard HTTP on port 8080
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  return response;
}
