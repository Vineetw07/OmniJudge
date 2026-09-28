import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth';
import { JudgePortalClient } from './judge-portal-client';
import { Button } from '@/components/ui/button';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Judge Scoring Portal | OmniJudge',
  description: 'Submit rubric-based scores and evaluations for assigned projects.',
};

export default async function JudgePage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/login');
  }

  // Strict role check: The judging console is exclusively reserved for appointed judges
  if (session.role !== 'judge') {
    const isOrg = session.role === 'organizer' || session.role === 'admin';
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#07090e] text-slate-100 p-4 relative overflow-hidden">
        {/* Ambient amber glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[450px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/10 via-amber-500/5 to-transparent blur-3xl rounded-full"
        />

        <div className="backdrop-blur-md bg-white/[0.03] border border-amber-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)] rounded-2xl max-w-md w-full p-6 sm:p-8 relative z-10 text-center space-y-5">
          <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-[0_0_24px_rgba(245,158,11,0.2)] mx-auto">
            <ShieldAlert className="size-7" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
              Role Separation Enforced
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Judge Workspace Locked</h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your account (<span className="text-slate-200 font-mono">{session.email}</span>) is signed in with role{' '}
              <span className="text-amber-400 font-semibold uppercase">{session.role}</span>.
            </p>
            <p className="text-xs text-slate-400 leading-relaxed pt-1">
              {isOrg
                ? 'The Scoring Console is reserved exclusively for appointed judges to evaluate assigned tracks. As an organizer, your workstation is the Organizer Control Tower.'
                : 'The Scoring Console is strictly restricted to appointed hackathon judges.'}
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
            {isOrg && (
              <Link href="/dashboard" className="w-full sm:w-auto">
                <Button
                  size="sm"
                  className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs shadow-[0_0_20px_rgba(56,189,248,0.3)] transition-all"
                >
                  Go to Dashboard
                </Button>
              </Link>
            )}
            <Link href="/projects" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto flex items-center justify-center gap-2 border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] hover:text-white hover:border-white/20 transition-colors text-xs"
              >
                <ArrowLeft className="size-3.5" />
                <span>Return to Gallery</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 1. Fetch Judge Assignments
  const assignments = await prisma.judgeAssignment.findMany({
    where: { userId: session.id },
    include: { track: true },
  });

  const assignedTracks = assignments.map((a) => ({
    id: a.track.id,
    name: a.track.name,
  }));

  let projectsWhere: { trackId?: { in: string[] } } = {};

  // For judges with assigned tracks, filter projects by those tracks
  const trackIds = assignedTracks.map((t) => t.id);
  if (trackIds.length > 0) {
    projectsWhere = { trackId: { in: trackIds } };
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
