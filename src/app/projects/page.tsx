import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { ProjectsClient } from './projects-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Project Gallery | OmniJudge',
  description: 'Explore submissions and projects participating in OmniJudge.',
};

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    take: 40,
    orderBy: { id: 'asc' },
    include: {
      team: true,
      track: true,
    },
  });

  return (
    <main className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      {/* Hero Banner with glowing pill badge */}
      <div className="text-center md:text-left mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs font-medium tracking-wide mb-4 shadow-[0_0_15px_rgba(56,189,248,0.2)]">
          <span>✦ OMNIJUDGE PORTAL</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-3">
          Project Gallery
        </h1>
        <p className="text-slate-400 text-base sm:text-lg max-w-2xl leading-relaxed">
          Discover all projects submitted to OmniJudge. Explore innovative work across every track.
        </p>
      </div>

      {/* Client island for search, track filtering and glass cards */}
      <ProjectsClient initialProjects={projects} />
    </main>
  );
}
