import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth';
import { JudgePortalClient } from './judge-portal-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Judge Scoring Portal | DOGFOOD 2026',
  description: 'Submit rubric-based scores and evaluations for assigned projects.',
};

export default async function JudgePage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/login');
  }

  // Strict role check
  if (
    session.role !== 'judge' &&
    session.role !== 'organizer' &&
    session.role !== 'admin'
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
        <Card className="max-w-md w-full border shadow-sm">
          <CardHeader className="text-center space-y-2">
            <div className="inline-flex items-center justify-center size-12 rounded-xl bg-destructive/10 text-destructive mx-auto">
              <ShieldAlert className="size-6" />
            </div>
            <CardTitle className="text-xl font-bold">Access Restricted</CardTitle>
            <CardDescription className="text-xs">
              Your account ({session.email}) has role &ldquo;{session.role}&rdquo;. The judging console is strictly reserved for appointed judges and hackathon organizers.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pt-2">
            <Link href="/projects">
              <Button variant="outline" size="sm" className="flex items-center gap-1.5">
                <ArrowLeft className="size-3.5" />
                <span>Return to Gallery</span>
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 1. Fetch Judge Assignments
  const assignments = await prisma.judgeAssignment.findMany({
    where: { userId: session.id },
    include: { track: true },
  });

  let assignedTracks = assignments.map((a) => ({
    id: a.track.id,
    name: a.track.name,
  }));

  let projectsWhere: { trackId?: { in: string[] } } = {};

  // For judges with assigned tracks, filter projects by those tracks
  if (session.role === 'judge') {
    const trackIds = assignedTracks.map((t) => t.id);
    projectsWhere = { trackId: { in: trackIds } };
  } else {
    // Organizers/admins have access to all tracks if no specific assignment
    if (assignedTracks.length === 0) {
      const allTracks = await prisma.track.findMany();
      assignedTracks = allTracks.map((t) => ({ id: t.id, name: t.name }));
    }
  }

  // 2. Fetch Projects in Scope
  const projects = await prisma.project.findMany({
    where: projectsWhere,
    include: {
      team: true,
      track: true,
    },
    orderBy: { id: 'asc' },
  });

  // 3. Fetch Rubric Criteria
  const criteria = await prisma.rubricCriterion.findMany({
    orderBy: { weight: 'desc' },
  });

  // 4. Fetch Existing Scores Submitted by this Judge
  const existingScores = await prisma.score.findMany({
    where: { judgeId: session.id },
  });

  // Prepare serializable objects for Client Component
  const serializableProjects = projects.map((p) => ({
    id: p.id,
    title: p.title,
    summary: p.summary,
    repoUrl: p.repoUrl,
    trackId: p.trackId,
    trackName: p.track?.name || 'General',
    teamName: p.team?.name || 'Independent Team',
    submittedAt: p.submittedAt.toISOString(),
  }));

  const serializableCriteria = criteria.map((c) => ({
    id: c.id,
    name: c.name,
    weight: c.weight,
    maxScore: c.maxScore,
  }));

  const serializableScores = existingScores.map((s) => ({
    id: s.id,
    projectId: s.projectId,
    criterionId: s.criterionId,
    value: s.value,
    comment: s.comment,
  }));

  return (
    <JudgePortalClient
      user={{
        id: session.id,
        name: session.name,
        email: session.email,
        role: session.role,
      }}
      assignedTracks={assignedTracks}
      projects={serializableProjects}
      criteria={serializableCriteria}
      initialScores={serializableScores}
    />
  );
}
