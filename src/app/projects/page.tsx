import { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Users, Calendar, Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Project Gallery | DOGFOOD 2026',
  description: 'Explore submissions and projects participating in DOGFOOD 2026.',
};

export default async function ProjectsPage() {
  // Query up to 40 projects ordered by ID ascending to guarantee fixture projects appear prominently
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
      {/* Navigation Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight">DOGFOOD 2026</span>
            </Link>
            <Badge variant="outline" className="text-xs font-normal">
              Public Gallery
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="outline" size="sm">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero & Intro */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-primary font-medium text-sm mb-1">
              <Sparkles className="size-4" />
              <span>Hackathon Submissions</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Project Gallery</h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base max-w-2xl">
              Discover all projects submitted to DOGFOOD 2026. Explore innovative work across every track.
            </p>
          </div>
          <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg border w-fit">
            Showing <span className="font-semibold text-foreground">{projects.length}</span> projects
          </div>
        </div>

        {/* Gallery Grid */}
        {projects.length === 0 ? (
          <div className="text-center py-20 border rounded-2xl bg-card shadow-sm">
            <h3 className="text-lg font-semibold text-foreground">No projects found</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Check back soon as participants submit their projects.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="flex flex-col justify-between border transition-all duration-200 hover:shadow-md hover:border-primary/20"
              >
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary" className="font-normal text-xs">
                      {project.track?.name || 'General Track'}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">
                      {project.id}
                    </span>
                  </div>
                  <CardTitle className="text-xl font-bold leading-snug text-foreground">
                    {project.title}
                  </CardTitle>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="size-3.5" />
                    <span>{project.team?.name || 'Independent Team'}</span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 flex-1">
                  <CardDescription className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                    {project.summary}
                  </CardDescription>

                  {project.repoUrl && (
                    <div className="pt-1">
                      <a
                        href={project.repoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                      >
                        <ExternalLink className="size-3.5" />
                        <span>Source Repository</span>
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
                  <Badge
                    variant={project.isDraft ? 'outline' : 'default'}
                    className="text-[10px] uppercase font-semibold px-2 py-0.5"
                  >
                    {project.isDraft ? 'Draft' : 'Submitted'}
                  </Badge>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
