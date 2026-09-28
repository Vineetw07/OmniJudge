import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { EmbedProjectsClient } from './embed-projects-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Project Gallery (Embed) | OmniJudge',
  description: 'Embeddable, distraction-free hackathon project gallery widget for event portals.',
};

export default async function EmbedProjectsPage() {
  const projects = await prisma.project.findMany({
    take: 100,
    orderBy: { id: 'asc' },
    include: {
      team: true,
      track: true,
    },
  });

  return <EmbedProjectsClient initialProjects={projects} />;
}
