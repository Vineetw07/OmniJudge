'use client';

import React, { useState, useMemo } from 'react';
import { Search, ExternalLink, Users, Sparkles, FolderGit2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Prisma } from '@prisma/client';

export type EmbedProject = Prisma.ProjectGetPayload<{
  include: { team: true; track: true };
}>;

interface EmbedProjectsClientProps {
  initialProjects: EmbedProject[];
}

const FILTER_TRACKS = [
  'All Tracks',
  'Developer Tools',
  'AI Agents',
  'Infrastructure',
  'Consumer',
] as const;

type FilterTrack = (typeof FILTER_TRACKS)[number];

function matchesTrack(trackName: string | undefined, filter: FilterTrack): boolean {
  if (filter === 'All Tracks') return true;
  if (!trackName) return false;
  const t = trackName.toLowerCase();
  switch (filter) {
    case 'Developer Tools':
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

function getTrackBadgeStyle(trackName?: string) {
  const t = (trackName || '').toLowerCase();
  if (t.includes('dev') || t.includes('tool')) {
    return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
  }
  if (t.includes('data') || t.includes('ai') || t.includes('agent') || t.includes('analytic')) {
    return 'border-purple-500/30 bg-purple-500/10 text-purple-300';
  }
  if (t.includes('security') || t.includes('hardware') || t.includes('infra')) {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  }
  return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
}

export function EmbedProjectsClient({ initialProjects }: EmbedProjectsClientProps) {
  const [search, setSearch] = useState('');
  const [selectedTrack, setSelectedTrack] = useState<FilterTrack>('All Tracks');

  const filteredProjects = useMemo(() => {
    return initialProjects.filter((project) => {
      const matchTrack = matchesTrack(project.track?.name, selectedTrack);
      if (!matchTrack) return false;

      if (!search.trim()) return true;
      const query = search.toLowerCase();
      const matchTitle = project.title.toLowerCase().includes(query);
      const matchSummary = project.summary.toLowerCase().includes(query);
      const matchTeam = project.team?.name.toLowerCase().includes(query) ?? false;
      const matchTrackName = project.track?.name.toLowerCase().includes(query) ?? false;

      return matchTitle || matchSummary || matchTeam || matchTrackName;
    });
  }, [initialProjects, search, selectedTrack]);

  return (
    <div className="w-full min-h-screen bg-[#07090e] text-slate-100 p-4 sm:p-6 flex flex-col font-sans">
      {/* Top Header / Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs font-mono uppercase tracking-wider mb-1.5">
            <Sparkles className="size-3" />
            <span>Live Showcase</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Project Gallery
            <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
              {filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'}
            </span>
          </h2>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, summary, track..."
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Track Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 no-scrollbar">
        {FILTER_TRACKS.map((track) => {
          const isSelected = selectedTrack === track;
          return (
            <button
              key={track}
              onClick={() => setSelectedTrack(track)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 border ${
                isSelected
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-[0_0_12px_rgba(56,189,248,0.25)]'
                  : 'bg-white/[0.03] text-slate-400 border-white/[0.08] hover:bg-white/[0.07] hover:text-slate-200'
              }`}
            >
              {track}
            </button>
          );
        })}
      </div>

      {/* Project Cards Grid */}
      {filteredProjects.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01]">
          <FolderGit2 className="size-10 text-slate-500 mb-3" />
          <p className="text-base font-medium text-slate-300">No matching projects found</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            Try adjusting your search terms or selecting &quot;All Tracks&quot; to see all submissions.
          </p>
          {(search || selectedTrack !== 'All Tracks') && (
            <button
              onClick={() => {
                setSearch('');
                setSelectedTrack('All Tracks');
              }}
              className="mt-4 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-slate-200 font-medium transition-colors"
            >
              Reset filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 flex-1">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="group flex flex-col justify-between rounded-2xl p-5 backdrop-blur-md bg-white/[0.025] hover:bg-white/[0.045] border border-white/[0.08] hover:border-cyan-500/40 shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:shadow-[0_8px_30px_rgba(56,189,248,0.1)] transition-all duration-200"
            >
              <div>
                {/* Header: Track Badge */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <Badge
                    variant="outline"
                    className={`text-[11px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-md ${getTrackBadgeStyle(
                      project.track?.name
                    )}`}
                  >
                    {project.track?.name || 'General Track'}
                  </Badge>
                  <span className="text-[10px] font-mono text-slate-500">{project.id}</span>
                </div>

                {/* Title */}
                <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-1 mb-1.5">
                  {project.title}
                </h3>

                {/* Team */}
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
                  <Users className="size-3.5 text-slate-500" />
                  <span className="line-clamp-1">{project.team?.name || 'Independent Team'}</span>
                </div>

                {/* Summary */}
                <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 mb-4">
                  {project.summary}
                </p>
              </div>

              {/* Footer: Repo Link */}
              <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                {project.repoUrl ? (
                  <a
                    href={project.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors group/link"
                  >
                    <FolderGit2 className="size-3.5 text-cyan-400/80 group-hover/link:text-cyan-300" />
                    <span>View Repository</span>
                    <ExternalLink className="size-3 text-cyan-400/60 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                  </a>
                ) : (
                  <span className="text-xs text-slate-600">No public repository</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Embed Subtitle / Footer */}
      <div className="mt-8 pt-4 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
        <span>OmniJudge Embeddable Gallery Widget</span>
        <a
          href="/projects"
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400/70 hover:text-cyan-300 transition-colors inline-flex items-center gap-1"
        >
          <span>Open Full Portal</span>
          <ExternalLink className="size-2.5" />
        </a>
      </div>
    </div>
  );
}
