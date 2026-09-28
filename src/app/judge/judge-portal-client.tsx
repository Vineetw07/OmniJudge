'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Users,
  Award,
  AlertCircle,
  FileCheck,
  Send,
  Layers,
  Sparkles,
  Search,
  X,
  Loader2,
  Code2,
} from 'lucide-react';

export interface ProjectItem {
  id: string;
  title: string;
  summary: string;
  repoUrl: string;
  trackId: string;
  trackName: string;
  teamName: string;
  submittedAt: string;
}

export interface RubricCriterionItem {
  id: string;
  name: string;
  weight: number;
  maxScore: number;
}

export interface ExistingScoreItem {
  id: string;
  projectId: string;
  criterionId: string;
  value: number;
  comment: string;
}

export interface JudgePortalClientProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  assignedTracks: { id: string; name: string }[];
  projects: ProjectItem[];
  criteria: RubricCriterionItem[];
  initialScores: ExistingScoreItem[];
}

export function JudgePortalClient({
  user,
  assignedTracks,
  projects,
  criteria,
  initialScores,
}: JudgePortalClientProps) {
  // Score mapping: projectId -> criterionId -> score value
  const [scoresMap, setScoresMap] = React.useState<Map<string, Map<string, number>>>(() => {
    const map = new Map<string, Map<string, number>>();
    for (const s of initialScores) {
      if (!map.has(s.projectId)) {
        map.set(s.projectId, new Map());
      }
      map.get(s.projectId)!.set(s.criterionId, s.value);
    }
    return map;
  });

  // Comments mapping: projectId -> comment
  const [commentsMap, setCommentsMap] = React.useState<Map<string, string>>(() => {
    const map = new Map<string, string>();
    for (const s of initialScores) {
      if (s.comment && !map.has(s.projectId)) {
        map.set(s.projectId, s.comment);
      }
    }
    return map;
  });

  // Currently selected project for evaluation
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>(() => {
    return projects.length > 0 ? projects[0].id : '';
  });

  // Search & Filter state for left sidebar
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'pending' | 'scored'>('all');

  // Form state for current project
  const [currentScores, setCurrentScores] = React.useState<{ [criterionId: string]: number }>({});
  const [currentComment, setCurrentComment] = React.useState<string>('');
  const [submitting, setSubmitting] = React.useState(false);
  const [justSaved, setJustSaved] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Sync form inputs when selected project changes
  React.useEffect(() => {
    if (!selectedProjectId) return;

    const existingProjectScores = scoresMap.get(selectedProjectId);
    const initialFormScores: { [criterionId: string]: number } = {};

    for (const crit of criteria) {
      const val = existingProjectScores?.get(crit.id);
      initialFormScores[crit.id] = val !== undefined ? val : 3; // Default to neutral 3/5
    }

    setCurrentScores(initialFormScores);
    setCurrentComment(commentsMap.get(selectedProjectId) || '');
    setStatusMessage(null);
    setJustSaved(false);
  }, [selectedProjectId, scoresMap, commentsMap, criteria]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // Check if project is scored
  const isProjectScored = React.useCallback(
    (projectId: string) => {
      return scoresMap.has(projectId) && (scoresMap.get(projectId)?.size || 0) > 0;
    },
    [scoresMap]
  );

  const scoredCount = React.useMemo(() => {
    return projects.filter((p) => isProjectScored(p.id)).length;
  }, [projects, isProjectScored]);

  const progressPercent = projects.length > 0 ? Math.round((scoredCount / projects.length) * 100) : 0;

  // Calculate live composite score for current project
  const { rawDisplay, scaledDisplay, percentWidth } = React.useMemo(() => {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const crit of criteria) {
      const val = currentScores[crit.id];
      if (typeof val === 'number') {
        weightedSum += val * crit.weight;
        totalWeight += crit.weight;
      }
    }

    const raw = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const rawDisp = raw.toFixed(2);
    // Scaled to 100 points: (raw / 5.0) * 100
    const scaledDisp = ((raw / 5) * 100).toFixed(1);
    const pct = Math.min(100, Math.max(0, (raw / 5) * 100));

    return {
      rawScore: raw,
      rawDisplay: rawDisp,
      scaledDisplay: scaledDisp,
      percentWidth: pct,
    };
  }, [currentScores, criteria]);

  // Dirty-state detection comparing against saved records
  const isDirty = React.useMemo(() => {
    if (!selectedProjectId) return false;
    const savedProjectScores = scoresMap.get(selectedProjectId);
    const savedComment = commentsMap.get(selectedProjectId) || '';

    // If never scored yet:
    if (!savedProjectScores || savedProjectScores.size === 0) {
      if (currentComment.trim().length > 0) return true;
      for (const crit of criteria) {
        if (currentScores[crit.id] !== undefined && currentScores[crit.id] !== 3) {
          return true;
        }
      }
      return false;
    }

    // If already scored, compare with saved values
    if (currentComment.trim() !== savedComment.trim()) return true;

    for (const crit of criteria) {
      const currentVal = currentScores[crit.id];
      const savedVal = savedProjectScores.get(crit.id);
      if (savedVal === undefined) {
        if (currentVal !== undefined) return true;
      } else if (currentVal !== savedVal) {
        return true;
      }
    }

    return false;
  }, [selectedProjectId, currentScores, currentComment, scoresMap, commentsMap, criteria]);

  // Filter projects by search and status
  const filteredProjects = React.useMemo(() => {
    return projects.filter((project) => {
      const scored = isProjectScored(project.id);
      if (statusFilter === 'pending' && scored) return false;
      if (statusFilter === 'scored' && !scored) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = project.title.toLowerCase().includes(q);
        const matchTeam = project.teamName.toLowerCase().includes(q);
        const matchTrack = project.trackName.toLowerCase().includes(q);
        const matchId = project.id.toLowerCase().includes(q);
        if (!matchTitle && !matchTeam && !matchTrack && !matchId) return false;
      }

      return true;
    });
  }, [projects, statusFilter, searchQuery, isProjectScored]);

  const handleScoreChange = (criterionId: string, value: number) => {
    setJustSaved(false);
    setCurrentScores((prev) => ({
      ...prev,
      [criterionId]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    setSubmitting(true);
    setStatusMessage(null);

    try {
      const payloadScores = criteria.map((crit) => ({
        criterionId: crit.id,
        value: currentScores[crit.id] ?? 0,
      }));

      const res = await fetch('/api/judge/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject.id,
          scores: payloadScores,
          comment: currentComment.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit score');
      }

      // Update local state maps upon successful submission
      setScoresMap((prev) => {
        const next = new Map(prev);
        const projMap = new Map<string, number>();
        for (const item of payloadScores) {
          projMap.set(item.criterionId, item.value);
        }
        next.set(selectedProject.id, projMap);
        return next;
      });

      setCommentsMap((prev) => {
        const next = new Map(prev);
        next.set(selectedProject.id, currentComment.trim());
        return next;
      });

      setJustSaved(true);
      setStatusMessage({
        type: 'success',
        text: `Scores for "${selectedProject.title}" saved successfully!`,
      });

      // Clear the temporary just-saved glow after 4 seconds
      setTimeout(() => {
        setJustSaved(false);
      }, 4000);
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen text-slate-100 flex flex-col">
      <main className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        {/* Banner / Track Info */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 rounded-2xl backdrop-blur-md bg-white/[0.03] border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                <Award className="size-3.5" />
                <span>Judge Scoring Workstation</span>
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Active as <span className="text-white font-semibold">{user.name}</span> ({user.email})
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Assigned Project Reviews
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Evaluate submissions according to the official weighted rubric. Your evaluations remain cryptographically isolated.
            </p>

            {/* Assigned Tracks Badge Bar */}
            <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
              <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                <Layers className="size-3.5 text-cyan-400" /> Assigned Tracks:
              </span>
              {assignedTracks.map((t) => (
                <Badge
                  key={t.id}
                  variant="outline"
                  className="font-mono text-[11px] bg-white/[0.04] text-slate-300 border-white/[0.08] hover:border-cyan-500/30"
                >
                  {t.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* Progress Pill / Evaluation Counter */}
          <div className="bg-black/40 border border-white/[0.08] p-4 rounded-xl flex items-center gap-5 min-w-[220px] self-start md:self-auto">
            <div className="space-y-1.5 flex-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">Reviews Done</span>
                <span className="text-white font-bold">{scoredCount} / {projects.length}</span>
              </div>
              <div className="w-full bg-white/[0.06] rounded-full h-2 overflow-hidden border border-white/[0.05]">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-2 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(6,182,212,0.4)]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-extrabold font-mono text-cyan-400">{progressPercent}%</span>
            </div>
          </div>
        </div>

        {/* 2-Column Judging Workspace */}
        {projects.length === 0 ? (
          <div className="text-center py-20 border border-white/[0.08] rounded-2xl backdrop-blur-md bg-white/[0.03] shadow-sm space-y-3">
            <Layers className="size-10 text-slate-500 mx-auto" />
            <h3 className="text-lg font-semibold text-white">No assigned projects</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              You are currently not assigned to any tracks with submitted projects.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Project Queue Sidebar (~35% width, lg:col-span-4) */}
            <div className="lg:col-span-4 lg:sticky lg:top-20 space-y-3">
              <div className="backdrop-blur-md bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 sm:p-5 flex flex-col max-h-[calc(100vh-140px)] shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-3">
                  <div className="flex items-center gap-2">
                    <Code2 className="size-4 text-cyan-400" />
                    <span className="text-xs font-mono uppercase tracking-wider font-semibold text-slate-300">
                      Project Queue
                    </span>
                  </div>
                  <span className="font-mono text-xs text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                    {projects.length} Total
                  </span>
                </div>

                {/* Search Input */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Search by title, team, track..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-8 pr-7 text-xs bg-white/[0.03] border-white/[0.08] text-white placeholder:text-slate-500 rounded-xl focus-visible:ring-1 focus-visible:ring-cyan-500/40"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs p-0.5"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 p-1 bg-black/40 rounded-xl border border-white/[0.06] mb-3">
                  {(['all', 'pending', 'scored'] as const).map((tab) => {
                    const isActive = statusFilter === tab;
                    const count =
                      tab === 'all'
                        ? projects.length
                        : tab === 'pending'
                        ? projects.length - scoredCount
                        : scoredCount;

                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setStatusFilter(tab)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-1.5 rounded-lg text-xs font-medium transition-all ${
                          isActive
                            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
                        }`}
                      >
                        <span className="capitalize">{tab}</span>
                        <span
                          className={`text-[10px] font-mono px-1 rounded-full ${
                            isActive
                              ? 'bg-cyan-400/20 text-cyan-200'
                              : 'bg-white/[0.06] text-slate-400'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Project Items List with Vertical Scroll Containment */}
                <div className="overflow-y-auto pr-1 space-y-2 flex-1 min-h-0">
                  {filteredProjects.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500">
                      No projects match your filter.
                    </div>
                  ) : (
                    filteredProjects.map((project) => {
                      const scored = isProjectScored(project.id);
                      const isSelected = project.id === selectedProjectId;

                      return (
                        <motion.div
                          key={project.id}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => setSelectedProjectId(project.id)}
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/40 text-white'
                              : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.06] hover:border-white/10 text-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <span
                              className={`font-semibold text-xs sm:text-sm line-clamp-1 ${
                                isSelected ? 'text-cyan-200' : 'text-slate-200'
                              }`}
                            >
                              {project.title}
                            </span>
                            {scored ? (
                              <span className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shrink-0">
                                <CheckCircle2 className="size-2.5" />
                                <span>Scored</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/60 shrink-0">
                                <Clock className="size-2.5" />
                                <span>Pending</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span className="truncate max-w-[130px]">{project.teamName}</span>
                            <Badge
                              variant="outline"
                              className="text-[10px] font-mono py-0 px-1.5 bg-white/[0.03] border-white/[0.08] text-slate-400"
                            >
                              {project.trackName}
                            </Badge>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Scoring Console Workstation (~65% width, lg:col-span-8) */}
            {selectedProject ? (
              <div className="lg:col-span-8">
                <div className="backdrop-blur-md bg-white/[0.03] border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden">
                  {/* Terminal Header Bar */}
                  <div className="bg-black/40 border-b border-white/[0.08] px-5 py-3.5 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs uppercase tracking-wider text-cyan-400 font-bold flex items-center gap-1.5">
                        <span className="text-cyan-400 text-sm">⬢</span> SCORING CONSOLE
                      </span>
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px] bg-indigo-500/10 text-indigo-300 border-indigo-500/30 py-0.5 px-2"
                      >
                        {selectedProject.trackName}
                      </Badge>
                      <span className="font-mono text-[11px] text-slate-400 bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.08]">
                        {selectedProject.id}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Autosave / Save indicator in workstation header */}
                      <div className="flex items-center gap-1.5">
                        <AnimatePresence mode="wait">
                          {submitting ? (
                            <motion.span
                              key="saving"
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="inline-flex items-center gap-1.5 text-xs text-cyan-400 font-mono bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded-full"
                            >
                              <Loader2 className="size-3 animate-spin text-cyan-400" />
                              <span>Saving evaluation...</span>
                            </motion.span>
                          ) : justSaved ? (
                            <motion.span
                              key="saved"
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                            >
                              <CheckCircle2 className="size-3 text-emerald-400" />
                              <span>✓ Saved to database</span>
                            </motion.span>
                          ) : isDirty ? (
                            <motion.span
                              key="unsaved"
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-mono bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full"
                            >
                              <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                              <span>Unsaved changes</span>
                            </motion.span>
                          ) : isProjectScored(selectedProject.id) ? (
                            <motion.span
                              key="synced"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="inline-flex items-center gap-1.5 text-xs text-emerald-400/80 font-mono bg-emerald-500/5 border border-emerald-500/10 px-2.5 py-1 rounded-full"
                            >
                              <CheckCircle2 className="size-3 text-emerald-400/70" />
                              <span>✓ Saved to database</span>
                            </motion.span>
                          ) : (
                            <motion.span
                              key="ready"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-mono bg-white/[0.02] border border-white/[0.05] px-2.5 py-1 rounded-full"
                            >
                              <span>Ready for evaluation</span>
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>

                      {selectedProject.repoUrl && (
                        <a
                          href={selectedProject.repoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-300 hover:text-cyan-300 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-cyan-500/40 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          <ExternalLink className="size-3.5 text-cyan-400" />
                          <span>Repo</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Project Info Header */}
                  <div className="p-6 space-y-4 border-b border-white/[0.06]">
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight text-white">
                        {selectedProject.title}
                      </h2>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                        <Users className="size-3.5 text-cyan-400" />
                        <span>{selectedProject.teamName}</span>
                      </div>
                    </div>

                    <div className="bg-black/30 border border-white/[0.06] rounded-xl p-3.5 text-xs text-slate-300 leading-relaxed">
                      {selectedProject.summary}
                    </div>
                  </div>

                  {/* Evaluation Form */}
                  <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Live Composite Score Gauge */}
                    <div className="p-5 rounded-xl bg-gradient-to-br from-cyan-950/20 via-black/40 to-indigo-950/20 border border-cyan-500/20 shadow-[0_0_24px_rgba(6,182,212,0.08)] space-y-3">
                      <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                        <div className="flex items-center gap-2 text-cyan-300 font-mono font-medium">
                          <Sparkles className="size-3.5 text-cyan-400" />
                          <span className="uppercase tracking-wider">Live Composite Score Gauge</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-400 font-mono">Raw Composite:</span>
                          <span className="font-mono text-xs font-bold text-slate-200 bg-white/[0.06] border border-white/[0.1] px-2 py-0.5 rounded">
                            {rawDisplay} / 5.00
                          </span>
                        </div>
                      </div>

                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400 font-mono tracking-tight">
                            {scaledDisplay}
                          </span>
                          <span className="text-sm sm:text-base font-mono text-slate-400 ml-1.5">/ 100</span>
                        </div>
                        <span className="text-xs font-mono text-cyan-400/80">
                          {Number(scaledDisplay) >= 80
                            ? 'Excellent'
                            : Number(scaledDisplay) >= 60
                            ? 'Strong'
                            : Number(scaledDisplay) >= 40
                            ? 'Average'
                            : 'Needs Work'}
                        </span>
                      </div>

                      {/* Glowing Gradient Progress Bar */}
                      <div className="w-full bg-black/50 rounded-full h-3 p-0.5 border border-white/[0.08] overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-cyan-500 via-sky-400 to-indigo-500 h-full rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(56,189,248,0.5)]"
                          style={{ width: `${percentWidth}%` }}
                        />
                      </div>
                    </div>

                    {/* Rubric Criteria Sliders */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                        <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
                          Rubric Evaluation Criteria
                        </span>
                        <span className="text-xs font-mono text-slate-500">
                          Weight / Rating (0.0 to 5.0)
                        </span>
                      </div>

                      {criteria.map((crit) => {
                        const val = currentScores[crit.id] ?? 3;

                        return (
                          <div
                            key={crit.id}
                            className="p-4 rounded-xl border border-white/[0.08] bg-black/25 hover:border-white/[0.15] space-y-3 transition-colors"
                          >
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-slate-200 capitalize">
                                  {crit.name}
                                </span>
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] font-mono bg-white/[0.05] text-slate-400 border border-white/[0.08] py-0 px-1.5"
                                >
                                  {crit.weight}x weight
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-sm font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded shadow-[0_0_10px_rgba(6,182,212,0.15)]">
                                  {val.toFixed(1)}
                                </span>
                                <span className="font-mono text-xs text-slate-500">
                                  / {crit.maxScore}.0
                                </span>
                              </div>
                            </div>

                            {/* Native HTML5 range slider */}
                            <div className="space-y-1">
                              <input
                                type="range"
                                min={0}
                                max={crit.maxScore}
                                step={0.5}
                                value={val}
                                onChange={(e) => handleScoreChange(crit.id, parseFloat(e.target.value))}
                                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                              />
                            </div>

                            {/* Quick-step integer buttons */}
                            <div className="flex items-center gap-1.5 pt-0.5">
                              <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mr-1">
                                Quick:
                              </span>
                              {Array.from({ length: crit.maxScore + 1 }, (_, i) => i).map((num) => (
                                <button
                                  key={num}
                                  type="button"
                                  onClick={() => handleScoreChange(crit.id, num)}
                                  className={`flex-1 py-1 text-xs font-mono font-medium rounded-md border transition-all ${
                                    val === num
                                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 ring-1 ring-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                                      : 'bg-white/[0.03] text-slate-400 border-white/[0.08] hover:bg-white/[0.08] hover:text-white hover:border-white/20'
                                  }`}
                                >
                                  {num}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Qualitative Comments */}
                    <div className="space-y-2">
                      <Label htmlFor="comment" className="text-xs font-medium text-slate-300 flex items-center justify-between">
                        <span>Judges Feedback & Comments</span>
                        <span className="text-slate-500 text-[10px] font-mono">Optional</span>
                      </Label>
                      <Textarea
                        id="comment"
                        placeholder="Provide constructive evaluation feedback, architectural notes, or standout features..."
                        value={currentComment}
                        onChange={(e) => {
                          setJustSaved(false);
                          setCurrentComment(e.target.value);
                        }}
                        rows={3}
                        className="text-xs resize-none bg-white/[0.03] border-white/[0.08] text-slate-200 placeholder:text-slate-500 rounded-xl focus-visible:ring-2 focus-visible:ring-cyan-500/40 focus-visible:border-cyan-500/50"
                      />
                    </div>

                    {/* Status Notification */}
                    <AnimatePresence>
                      {statusMessage && (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          className={`p-3 text-xs rounded-xl flex items-start gap-2 border ${
                            statusMessage.type === 'success'
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                              : 'bg-red-500/10 text-red-400 border-red-500/30'
                          }`}
                        >
                          {statusMessage.type === 'success' ? (
                            <FileCheck className="size-4 shrink-0 mt-0.5 text-emerald-400" />
                          ) : (
                            <AlertCircle className="size-4 shrink-0 mt-0.5 text-red-400" />
                          )}
                          <span>{statusMessage.text}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Footer with Submit Button */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4 border-t border-white/[0.08]">
                      <div className="text-xs text-slate-400 flex items-center gap-2">
                        {isProjectScored(selectedProject.id) ? (
                          <>
                            <CheckCircle2 className="size-3.5 text-cyan-400 shrink-0" />
                            <span>Previously evaluated — submit to update records</span>
                          </>
                        ) : (
                          <>
                            <Clock className="size-3.5 text-slate-500 shrink-0" />
                            <span>Pending evaluation — submit to record score</span>
                          </>
                        )}
                      </div>

                      <Button
                        type="submit"
                        disabled={submitting}
                        className="w-full sm:w-auto px-5 py-2.5 h-auto bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-semibold shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] border border-cyan-400/30 transition-all rounded-xl active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="size-4 animate-spin text-slate-950" />
                            <span>Saving Evaluation...</span>
                          </>
                        ) : (
                          <>
                            <Send className="size-4 text-slate-950" />
                            <span>
                              {isProjectScored(selectedProject.id)
                                ? 'Update Evaluation'
                                : 'Submit Evaluation'}
                            </span>
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <div className="lg:col-span-8 p-12 text-center border border-white/[0.08] rounded-2xl backdrop-blur-md bg-white/[0.03]">
                <p className="text-sm text-slate-400">Select a project from the queue to start evaluating.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
