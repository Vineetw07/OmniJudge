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

function getRedirectUrl(req: NextRequest): URL {
  const forwardedHost = req.headers.get('x-forwarded-host');
  const hostHeader = req.headers.get('host');
  const forwardedProto = req.headers.get('x-forwarded-proto');

  let host = forwardedHost || hostHeader || '';
  if (host.includes('0.0.0.0')) {
    host = host.replace(/0\.0\.0\.0/g, 'localhost');
  }

  const proto = forwardedProto || (host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https');

  if (host) {
    try {
      return new URL(`${proto}://${host}/login`);
    } catch {
      // fallback to req.url parsing
    }
  }

  const url = new URL('/login', req.url);
  if (url.hostname === '0.0.0.0') {
    url.hostname = 'localhost';
  }
  return url;
}

export async function GET(req: NextRequest) {
  const token = extractSessionToken(req);
  if (token && !SEED_TOKENS.has(token)) {
    await prisma.session.deleteMany({
      where: { id: token },
    });
  }

  const url = getRedirectUrl(req);
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
