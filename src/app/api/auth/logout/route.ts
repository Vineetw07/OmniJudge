import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function extractSessionToken(req: NextRequest): string | null {
  const sessionCookie = req.cookies.get('session');
  if (sessionCookie?.value) return sessionCookie.value;
  const cookieHeader = req.headers.get('cookie') ?? '';
  const match = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
  return match ? match[1].trim() : null;
}

const SEED_TOKENS = new Set([
  'org_seed_token_2026',
  'jdg_a_seed_token_2026',
  'jdg_b_seed_token_2026',
  'prt_seed_token_2026',
]);

export async function POST(req: NextRequest) {
  const token = extractSessionToken(req);
  if (token && !SEED_TOKENS.has(token)) {
    await prisma.session.deleteMany({
      where: { id: token },
    });
  }

  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  response.cookies.set('session', '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}

export async function GET(req: NextRequest) {
  const token = extractSessionToken(req);
  if (token && !SEED_TOKENS.has(token)) {
    await prisma.session.deleteMany({
      where: { id: token },
    });
  }

  const url = new URL('/login', req.url);
  const response = NextResponse.redirect(url);
  response.cookies.set('session', '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}
