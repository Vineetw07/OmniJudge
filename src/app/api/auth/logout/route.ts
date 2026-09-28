import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST() {
  cookies().set('session', '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });

  return NextResponse.json({ success: true, message: 'Logged out successfully' });
}

export async function GET(req: NextRequest) {
  cookies().set('session', '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });

  const url = new URL('/login', req.url);
  return NextResponse.redirect(url);
}
