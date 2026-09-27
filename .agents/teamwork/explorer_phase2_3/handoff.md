# Phase 2 Technical Implementation Blueprint (R1, R2, R3)

**Author:** explorer_phase2_3  
**Target Audience:** Implementer agents & Orchestrator  
**Date:** 2026-09-27  
**Scope:** R1 (Public Gallery), R2 (Submission Close API), R3 (Login UI & API)

---

## 1. Observation

### 1.1 Acceptance Checker (`Hack_docs/run.py`)
In `Hack_docs/run.py` lines 91–141, the T1 checks are defined as follows:
```python
# T1 Gallery Check (Lines 102-126)
c = Check("T1", "gallery is public")
status, body = request(url("gallery"))
c.ok = status == 200
gallery_body = body

c = Check("T1", "project from fixtures shown")
titles = fixture_titles(fixture) # returns first 3 project titles from fixtures.json
haystack = gallery_body.lower()
c.ok = any(t.lower() in haystack for t in titles)

# T1 Submission Close Check (Lines 128-141)
c = Check("T1", "closed event refuses submissions")
status, _ = request(
    url("submit"),
    header=auth.get("participant"),
    method="POST",
    body={"title": "dogfood-late-submission-probe", "summary": "probe"},
)
c.ok = 400 <= status < 500
```
- `fixture_titles` (`run.py` lines 190–192) inspects `fixture['projects'][:3]`, which are:
  1. `"Glass Signal"` (`prj_01`)
  2. `"Small Meadow"` (`prj_02`)
  3. `"Deep Compass"` (`prj_03`)
- `request(url("gallery"))` does not send any `Authorization` or `Cookie` header. The route MUST return `200` with the project titles in raw HTML.

### 1.2 Fixture Data & Database State
- Database inspection executed via `npx tsx` confirmed:
  - `projects`: 41 records loaded from `Hack_docs/fixtures.json`.
  - `prj_01`: `title = "Glass Signal"`, `teamId = "tm_01"`, `trackId = "trk_04"`.
  - `prj_02`: `title = "Small Meadow"`, `teamId = "tm_02"`, `trackId = "trk_03"`.
  - `prj_03`: `title = "Deep Compass"`, `teamId = "tm_03"`, `trackId = "trk_03"`.
  - `events`: 1 record (`evt_01`), `submissionsClose = "2026-03-01T18:00:00.000Z"`.
  - `sessions`: 4 deterministic tokens exist in the database:
    - `org_seed_token_2026` (`user_org_01`, `organizer@dogfood.dev`)
    - `jdg_a_seed_token_2026` (`user_jdg_a_01`, `judge_a@dogfood.dev`)
    - `jdg_b_seed_token_2026` (`user_jdg_b_01`, `judge_b@dogfood.dev`)
    - `prt_seed_token_2026` (`user_prt_01`, `participant@dogfood.dev`)
  - All test sessions have `expiresAt` set to 1 year in the future (`2027-09-27T08:21:28.613Z`).

### 1.3 Available UI Component Library & Architecture
- `src/components/ui/` contains:
  - `card.tsx`: exports `Card`, `CardHeader`, `CardFooter`, `CardTitle`, `CardAction`, `CardDescription`, `CardContent`.
  - `button.tsx`: exports `Button`, `buttonVariants` (uses `@base-ui/react/button`).
  - `badge.tsx`: exports `Badge`, `badgeVariants` (uses `@base-ui/react/use-render`).
  - `input.tsx`: exports `Input` (uses `@base-ui/react/input`).
  - `label.tsx`: exports `Label` (client component).
- `src/lib/utils.ts` re-exports `cn` from `"cn"` (`export { cn } from "cn"`).
- `src/lib/prisma.ts` exports singleton `prisma: PrismaClient`.
- `src/lib/auth.ts` exports `getSession(req: NextRequest): Promise<SessionUser | null>` with fallback parser `extractSessionFromCookieHeader` handling direct `Cookie: session=<token>` strings.

---

## 2. Logic Chain

1. **R1 Public Gallery (`src/app/projects/page.tsx`):**
   - Must be a Next.js Server Component so that HTML containing project titles is rendered server-side and sent directly in the initial HTTP response.
   - Must NOT use `getSession` to block unauthenticated visitors; it must always return HTTP 200.
   - Query must use `prisma.project.findMany({ take: 40, include: { track: true, team: true }, orderBy: { id: 'asc' } })`.
   - By ordering by `id: 'asc'`, `prj_01` ("Glass Signal"), `prj_02` ("Small Meadow"), and `prj_03` ("Deep Compass") will always be in the first 3 items rendered, guaranteeing that `run.py`'s case-insensitive substring match finds them in `gallery_body.lower()`.
   - Must specify `export const dynamic = 'force-dynamic'` to prevent Next.js from attempting static prerendering at `npm run build` during Docker builds where the SQLite DB is empty prior to container startup migrations.

2. **R2 Submission Close API (`src/app/api/projects/route.ts`):**
   - The route must handle `POST` requests.
   - First, authentication must be checked: calling `await getSession(req)`. If null, returns HTTP 401 (`{ error: 'Unauthorized' }`). If not a participant/organizer/admin, returns HTTP 403 (`{ error: 'Forbidden' }`).
   - Second, request body must be parsed safely. Zod schema must require `title` and `summary`, but make `repoUrl`, `trackId`, `teamId`, and `isDraft` optional because `run.py` tests with `{"title": "dogfood-late-submission-probe", "summary": "probe"}`.
   - Third, deadline enforcement: Query `prisma.event.findFirst()`. Compare `new Date(event.submissionsClose).getTime() < Date.now()`.
   - Since `event.submissionsClose` in fixtures is March 1, 2026, and current time is past that, it will evaluate to true.
   - Returning HTTP `409` (Conflict) satisfies `400 <= status < 500`.

3. **R3 Login UI & API (`src/app/login/page.tsx` & `src/app/api/auth/login/route.ts`):**
   - `POST /api/auth/login` accepts `{ email: string }`, validates via Zod.
   - Finds user in `prisma.user.findUnique({ where: { email } })`. If not found, returns HTTP 401.
   - Queries `prisma.session.findFirst` for an unexpired session for that user. If none exists, creates a fresh session token (`crypto.randomUUID()`) expiring in 30 days.
   - Issues a `Set-Cookie: session=<token>; Path=/; HttpOnly; SameSite=Lax` header via `NextResponse.cookies.set()`.
   - `src/app/login/page.tsx` provides an interactive form with email input, error alert banner, loading state, and 4 quick-fill buttons for test users (`organizer@dogfood.dev`, `judge_a@dogfood.dev`, `judge_b@dogfood.dev`, `participant@dogfood.dev`).
   - On submission success, it performs `window.location.href = '/projects'` to reload cookies across the application.

---

## 3. Caveats

1. **Docker Build Time SQLite Access:**
   In Next.js 14, pages that call Prisma directly will fail during `next build` if SQLite database tables are missing unless `export const dynamic = 'force-dynamic'` is explicitly defined on the page / route handler.
2. **Zod Schema vs Probe Body:**
   The acceptance checker sends only `{"title": "...", "summary": "..."}`. Any Zod schema that marks `repoUrl` or `trackId` as required will trigger a 400 validation error instead of reaching the 409 deadline check. Both 400 and 409 satisfy `400 <= status < 500`, but making optional fields optional is cleaner and adheres to the spec's requirement that deadline check rejects with 409/403.
3. **Cookie Attributes in Dev vs Prod:**
   In Docker / local HTTP, `secure: true` in cookies would prevent browsers from persisting cookies over plain HTTP (`http://localhost:8080`). Therefore, `secure: process.env.NODE_ENV === 'production' && process.env.FORCE_COOKIE_SECURE === 'true'` (or `secure: false` for localhost) should be used.

---

## 4. Conclusion & Complete Blueprints

### 4.1 Blueprint: `src/app/projects/page.tsx`

```tsx
import { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Users, Calendar, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Project Gallery | DOGFOOD 2026',
  description: 'Explore submissions and projects participating in DOGFOOD 2026.',
};

export default async function ProjectsPage() {
  // Query up to 40 projects ordered by ID to guarantee fixture projects appear first
  const projects = await prisma.project.findMany({
    take: 40,
    orderBy: { id: 'asc' },
    include: {
      team: true,
      track: true,
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Navigation Bar */}
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-tight">DOGFOOD 2026</span>
            <Badge variant="outline" className="text-xs">Public Gallery</Badge>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="outline" size="sm">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight">Project Gallery</h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Browse submitted projects across all tracks. Showing {projects.length} submissions.
          </p>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-16 border rounded-xl bg-card">
            <p className="text-muted-foreground">No projects submitted yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card key={project.id} className="flex flex-col justify-between border transition-all hover:shadow-sm">
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary" className="font-normal text-xs">
                      {project.track?.name || 'General Track'}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">
                      {project.id}
                    </span>
                  </div>
                  <CardTitle className="text-xl font-semibold leading-tight text-foreground">
                    {project.title}
                  </CardTitle>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="size-3.5" />
                    <span>{project.team?.name || 'Independent Team'}</span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 flex-1">
                  <CardDescription className="text-sm text-muted-foreground line-clamp-3">
                    {project.summary}
                  </CardDescription>

                  {project.repoUrl && (
                    <div className="pt-2">
                      <a
                        href={project.repoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="size-3.5" />
                        <span>Repository</span>
                      </a>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="flex items-center justify-between border-t pt-3 pb-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="size-3.5" />
                    <span>
                      {new Date(project.submittedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <span className="text-[11px] uppercase tracking-wider font-medium text-emerald-600 dark:text-emerald-400">
                    {project.isDraft ? 'Draft' : 'Submitted'}
                  </span>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
```

---

### 4.2 Blueprint: `src/app/api/projects/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const SubmissionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  summary: z.string().min(1, 'Summary is required'),
  repoUrl: z.string().url().optional().or(z.literal('')),
  trackId: z.string().optional(),
  teamId: z.string().optional(),
  eventId: z.string().optional(),
  isDraft: z.boolean().optional(),
});

/**
 * GET /api/projects
 * Public API to list projects (max 40)
 */
export async function GET() {
  const projects = await prisma.project.findMany({
    take: 40,
    orderBy: { id: 'asc' },
    include: {
      track: true,
      team: true,
    },
  });

  return NextResponse.json({ projects });
}

/**
 * POST /api/projects
 * Handles project submissions. Checks participant authentication and deadline.
 */
export async function POST(req: NextRequest) {
  // 1. Authenticate user via session
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized: Valid session required' },
      { status: 401 }
    );
  }

  // Check role authorization (participant, organizer, admin)
  if (session.role !== 'participant' && session.role !== 'organizer' && session.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: Only participants or organizers may submit projects' },
      { status: 403 }
    );
  }

  // 2. Parse & validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload' },
      { status: 400 }
    );
  }

  const parseResult = SubmissionSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const data = parseResult.data;

  // 3. Look up Event & Check Deadline
  const event = data.eventId
    ? await prisma.event.findUnique({ where: { id: data.eventId } })
    : await prisma.event.findFirst();

  if (!event) {
    return NextResponse.json(
      { error: 'Active hackathon event not found' },
      { status: 404 }
    );
  }

  const now = Date.now();
  const closeTime = new Date(event.submissionsClose).getTime();

  if (closeTime < now) {
    return NextResponse.json(
      {
        error: 'Submissions are closed for this event',
        submissionsClose: event.submissionsClose.toISOString(),
        serverTime: new Date(now).toISOString(),
      },
      { status: 409 }
    );
  }

  // 4. If submission window is open, persist project
  // Resolve or default team
  let teamId = data.teamId;
  if (!teamId) {
    const membership = await prisma.teamMember.findUnique({
      where: { userId: session.id },
    });
    teamId = membership?.teamId;
  }

  if (!teamId) {
    const newTeam = await prisma.team.create({
      data: {
        id: `tm_${Date.now()}`,
        name: `${session.name}'s Team`,
        members: {
          create: { userId: session.id },
        },
      },
    });
    teamId = newTeam.id;
  }

  // Resolve or default track
  let trackId = data.trackId;
  if (!trackId) {
    const defaultTrack = await prisma.track.findFirst({
      where: { eventId: event.id },
    });
    trackId = defaultTrack?.id || 'trk_01';
  }

  const projectId = `prj_${Date.now()}`;
  const project = await prisma.project.create({
    data: {
      id: projectId,
      title: data.title,
      summary: data.summary,
      repoUrl: data.repoUrl || '',
      teamId,
      trackId,
      eventId: event.id,
      submittedAt: new Date(),
      isDraft: data.isDraft ?? false,
    },
  });

  // Log to AuditLog
  await prisma.auditLog.create({
    data: {
      userId: session.id,
      action: 'PROJECT_SUBMIT',
      payload: JSON.stringify({ projectId, title: data.title }),
    },
  });

  return NextResponse.json({ success: true, project }, { status: 201 });
}
```

---

### 4.3 Blueprint: `src/app/login/page.tsx`

```tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const DEMO_ACCOUNTS = [
  { role: 'Organizer', email: 'organizer@dogfood.dev', badgeVariant: 'default' as const },
  { role: 'Judge A', email: 'judge_a@dogfood.dev', badgeVariant: 'secondary' as const },
  { role: 'Judge B', email: 'judge_b@dogfood.dev', badgeVariant: 'secondary' as const },
  { role: 'Participant', email: 'participant@dogfood.dev', badgeVariant: 'outline' as const },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Please enter an email address.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Hard navigation ensures server components pick up session cookie immediately
      window.location.href = '/projects';
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">DOGFOOD 2026</h1>
          <p className="text-sm text-muted-foreground">Self-hostable hackathon platform</p>
        </div>

        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Sign In</CardTitle>
            <CardDescription>
              Enter your registered email address to access your portal.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {errorMessage && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
                  {errorMessage}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                  required
                />
              </div>

              {/* Quick Select Test Users */}
              <div className="pt-2">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Quick select seeded test accounts:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {DEMO_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => setEmail(acc.email)}
                      className="text-left p-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors text-xs flex flex-col gap-1"
                    >
                      <span className="font-semibold text-foreground">{acc.role}</span>
                      <span className="text-[11px] text-muted-foreground truncate">{acc.email}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 pt-2">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>

              <Link
                href="/projects"
                className="text-xs text-center text-muted-foreground hover:text-foreground hover:underline"
              >
                Back to Public Gallery
              </Link>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
```

---

### 4.4 Blueprint: `src/app/api/auth/login/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const LoginSchema = z.object({
  email: z.string().email('Invalid email address').trim().toLowerCase(),
});

/**
 * POST /api/auth/login
 * Validates email, finds user, creates or retrieves active session token, sets cookie.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parseResult = LoginSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid email address' },
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
      { error: 'User with this email not found' },
      { status: 401 }
    );
  }

  // 2. Find active session or create new one
  let session = await prisma.session.findFirst({
    where: {
      userId: user.id,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!session) {
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    session = await prisma.session.create({
      data: {
        id: token,
        userId: user.id,
        expiresAt,
      },
    });
  }

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
    secure: false, // Allows testing on http://localhost:8080 without SSL
    maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
  });

  return response;
}
```

---

## 5. Verification Method

To verify that these blueprints succeed against both the compiler and the acceptance suite:

1. **TypeScript Typecheck:**
   ```powershell
   npm run typecheck
   ```
   Must exit with code 0 without any `@ts-ignore` or implicit `any`.

2. **Next.js Production Build:**
   ```powershell
   npm run build
   ```
   Must compile both server components and API routes cleanly into the `.next` directory.

3. **Acceptance Checker (`run.py`):**
   Ensure `.dogfood.toml` exists at repo root:
   ```toml
   [portal]
   base_url = "http://localhost:8080"

   [tiers]
   claimed = ["T1", "T2"]
   pitch = "Self-hostable hackathon submission and judging platform with backend-enforced role isolation and MAD-based score normalisation."

   [auth]
   organizer   = "Cookie: session=org_seed_token_2026"
   judge_a     = "Cookie: session=jdg_a_seed_token_2026"
   judge_b     = "Cookie: session=jdg_b_seed_token_2026"
   participant = "Cookie: session=prt_seed_token_2026"

   [routes]
   gallery      = "/projects"
   submit       = "/api/projects"
   judge_scores = "/api/judge/scores"
   peer_scores  = "/api/judge/scores?judge=user_jdg_a_01"
   csv_export   = "/api/export.csv"
   ```
   Start the application on port 8080:
   ```powershell
   npm run dev
   ```
   Execute the acceptance checker:
   ```powershell
   python Hack_docs\run.py .dogfood.toml
   ```
   Expected T1 output:
   ```
   T1  gallery is public ........................ PASS
   T1  project from fixtures shown .............. PASS
   T1  closed event refuses submissions ......... PASS
   ```
4. **Invalidation Conditions:**
   - If `GET /projects` redirects to `/login` or requires auth, check 1 fails.
   - If project titles are only rendered client-side or wrapped in dynamic JSON fetches, check 2 fails.
   - If `POST /api/projects` returns 200/201 when `event.submissionsClose < Date.now()`, check 3 fails.
