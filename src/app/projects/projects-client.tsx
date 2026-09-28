'use client';

import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Search, ExternalLink, Users, Calendar, X } from 'lucide-react';
import type { Prisma } from '@prisma/client';

export type ProjectWithRelations = Prisma.ProjectGetPayload<{
  include: { team: true; track: true };
}>;

interface ProjectsClientProps {
  initialProjects: ProjectWithRelations[];
}

const FILTER_TRACKS = [
  'All',
  'Dev Tools',
  'AI Agents',
  'Infrastructure',
  'Consumer',
] as const;

type FilterTrack = (typeof FILTER_TRACKS)[number];

/**
 * Intelligent category matching between prompt track buttons and DB fixture tracks
 */
function matchesTrack(trackName: string | undefined, filter: FilterTrack): boolean {
  if (filter === 'All') return true;
  if (!trackName) return false;
  const t = trackName.toLowerCase();
  switch (filter) {
    case 'Dev Tools':
      return t.includes('dev') || t.includes('tool');
    case 'AI Agents':
      return t.includes('data') || t.includes('ai') || t.includes('agent') || t.includes('analytic');
    case 'Infrastructure':
      return t.includes('security') || t.includes('hardware') || t.includes('infra');
    case 'Consumer':
      return (
        t.includes('health') ||
        t.includes('education') ||
        t.includes('accessibility') ||
        t.includes('climate') ||
        t.includes('consumer')
      );
    default:
      return true;
  }
}

/**
 * Category-specific styling for track badge
 */
function getTrackBadgeStyle(trackName?: string) {
  const t = (trackName || '').toLowerCase();
  if (t.includes('dev') || t.includes('tool')) {
    return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
  }
  if (t.includes('data') || t.includes('ai') || t.includes('analytic')) {
    return 'border-purple-500/30 bg-purple-500/10 text-purple-300';
  }
  if (t.includes('security') || t.includes('hardware') || t.includes('infra')) {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  }
  return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
}

export function ProjectsClient({ initialProjects }: ProjectsClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrack, setSelectedTrack] = useState<FilterTrack>('All');

  const filteredProjects = useMemo(() => {
    return initialProjects.filter((p) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        q === '' ||
        p.title.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q) ||
        (p.track?.name && p.track.name.toLowerCase().includes(q));

      const matchesTrk = matchesTrack(p.track?.name, selectedTrack);
      return matchesSearch && matchesTrk;
    });
  }, [initialProjects, searchQuery, selectedTrack]);

  return (
    <div className="space-y-8">
      {/* Controls Container */}
      <div className="flex flex-col gap-4">
        {/* Search Input */}
        <div className="relative max-w-xl w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects by title, summary, or track..."
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/20 backdrop-blur-md transition-all"
            aria-label="Search projects"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Track Filter Strip */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
            {FILTER_TRACKS.map((track) => {
              const isSelected = selectedTrack === track;
              return (
                <button
                  key={track}
                  type="button"
                  onClick={() => setSelectedTrack(track)}
                  aria-pressed={isSelected}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 shadow-[0_0_12px_rgba(56,189,248,0.2)]'
                      : 'bg-white/[0.03] border border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
                  }`}
                >
                  {track}
                </button>
              );
            })}
          </div>

          <div className="text-xs text-slate-400 bg-white/[0.03] border border-white/[0.06] px-3 py-1.5 rounded-lg">
            Showing <span className="font-semibold text-white">{filteredProjects.length}</span> of {initialProjects.length} projects
          </div>
        </div>
      </div>

      {/* Grid of Glass Project Cards */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-20 border border-white/[0.08] rounded-2xl bg-[var(--glass-bg)] backdrop-blur-md">
          <h3 className="text-lg font-semibold text-white">No matching projects found</h3>
          <p className="text-slate-400 mt-1 text-sm">
            Try adjusting your search query or track filter.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedTrack('All');
            }}
            className="mt-4 px-4 py-2 rounded-lg text-xs font-medium bg-white/10 text-white hover:bg-white/15 transition-colors"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="bg-[var(--glass-bg)] border border-[var(--glass-border)] backdrop-blur-md rounded-2xl p-6 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(56,189,248,0.12)] hover:border-cyan-500/30 group"
            >
              <div>
                {/* Header: Track Badge & ID */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getTrackBadgeStyle(
                      project.track?.name
                    )}`}
                  >
                    {project.track?.name || 'General Track'}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    {project.id}
                  </span>
                </div>

                {/* Project Title */}
                <h3 className="text-xl font-bold leading-snug text-white group-hover:text-cyan-300 transition-colors mb-2">
                  {project.title}
                </h3>

                {/* Team */}
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-4">
                  <Users className="size-3.5 text-slate-500" />
                  <span>{project.team?.name || 'Independent Team'}</span>
                </div>

                {/* Summary */}
                <p className="text-sm text-slate-400 leading-relaxed line-clamp-3 mb-4">
                  {project.summary}
                </p>
              </div>

              {/* Footer: Repo Link, Date, Status */}
              <div className="pt-4 border-t border-white/[0.06] space-y-3">
                {project.repoUrl && (
                  <div>
                    <a
                      href={project.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-white/10 bg-white/5 text-slate-200 hover:text-white hover:bg-white/10 hover:border-cyan-500/40 transition-all"
                    >
                      <ExternalLink className="size-3.5 text-cyan-400" />
                      <span>Source Repository</span>
                    </a>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-1">
                    <Calendar className="size-3.5 text-slate-500" />
                    <span>
                      {new Date(project.submittedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        timeZone: 'UTC',
                      })}
                    </span>
                  </div>
                  <Badge
                    variant={project.isDraft ? 'outline' : 'secondary'}
                    className={`text-[10px] uppercase font-semibold px-2 py-0.5 ${
                      project.isDraft
                        ? 'border-slate-600 text-slate-400'
                        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    }`}
                  >
                    {project.isDraft ? 'Draft' : 'Submitted'}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
