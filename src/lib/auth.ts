import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from './prisma';

/**
 * Typed session user returned from getSession().
 * judgeId is populated only when role === 'judge' and equals user.id.
 */
export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: 'visitor' | 'participant' | 'judge' | 'organizer' | 'admin';
  judgeId?: string;
};

/**
 * Reads the `Cookie: session=<token>` header from the incoming request,
 * looks up the Session table, validates expiry, and returns a typed SessionUser.
 * Returns null if the cookie is missing, the session doesn't exist, or has expired.
 *
 * IMPORTANT: This must be called server-side only (API routes, Server Components).
 * Never call this in client components.
 */
export async function getSession(req: NextRequest): Promise<SessionUser | null> {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const sessionCookie = req.cookies.get('session');
  const token = sessionCookie?.value ?? extractSessionFromCookieHeader(cookieHeader);

  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { id: token },
    include: { user: true },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) return null;

  const role = session.user.role as SessionUser['role'];

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role,
    judgeId: role === 'judge' ? session.user.id : undefined,
  };
}

/**
 * Server Component authentication helper using `cookies()` from `next/headers`.
 * Safe for use directly in React Server Components (`page.tsx`, `layout.tsx`).
 */
export async function getServerSession(): Promise<SessionUser | null> {
  const cookieStore = cookies();
  const token = cookieStore.get('session')?.value;

  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { id: token },
    include: { user: true },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) return null;

  const role = session.user.role as SessionUser['role'];

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role,
    judgeId: role === 'judge' ? session.user.id : undefined,
  };
}

/**
 * Fallback: extract session token from raw Cookie header string.
 * Handles checkers that send `Cookie: session=<token>` directly as a header.
 */
function extractSessionFromCookieHeader(cookieHeader: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
  return match ? match[1].trim() : null;
}

/**
 * Role guard helpers — use these in API routes for clean guard clauses.
 */
export function isOrganizer(user: SessionUser | null): boolean {
  return user?.role === 'organizer' || user?.role === 'admin';
}

export function isJudge(user: SessionUser | null): boolean {
  return user?.role === 'judge';
}

export function isParticipant(user: SessionUser | null): boolean {
  return user?.role === 'participant';
}
