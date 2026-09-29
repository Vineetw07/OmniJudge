'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  ExternalLink,
  Users,
  Calendar,
  X,
  ChevronUp,
  MessageSquare,
  Shuffle,
  Shield,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  LogIn,
  Code2,
  Copy,
  Check,
  Trophy,
  Medal,
  Award,
  Lock,
  LayoutGrid,
  RefreshCw,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { ProjectCommentsDrawer } from '@/components/ProjectCommentsDrawer';
import {
  ProjectSubmissionModal,
  type TrackOption,
} from '@/components/ProjectSubmissionModal';
import type { LeaderboardEntry } from '@/lib/ranking';

export type ProjectWithRelations = Prisma.ProjectGetPayload<{
  include: { team: true; track: true };
}>;

interface ProjectsClientProps {
  initialProjects: ProjectWithRelations[];
  initialUserVotedIds?: string[];
  initialVotingOpen?: boolean;
  initialResultsPublic?: boolean;
  initialSubmissionsOpen?: boolean;
  submissionsClose?: string | null;
  tracks?: TrackOption[];
  initialVoteCounts?: Record<string, number> | null;
  initialCommentCounts?: Record<string, number>;
  initialLeaderboard?: LeaderboardEntry[] | null;
  isOrganizerOrAdmin?: boolean;
  currentUserId?: string | null;
  currentUserRole?: string | null;
}

const FILTER_TRACKS = [
  'All',
  'Dev Tools',
  'AI Agents',
  'Infrastructure',
  'Consumer',
] as const;

type FilterTrack = (typeof FILTER_TRACKS)[number];
type SortOption = 'random' | 'title-asc' | 'title-desc' | 'track' | 'comments';

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
      return (
        t.includes('data') ||
        t.includes('ai') ||
        t.includes('agent') ||
        t.includes('analytic')
      );
    case 'Infrastructure':
      return (
        t.includes('security') ||
        t.includes('hardware') ||
        t.includes('infra')
      );
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

/**
 * Fisher-Yates shuffle algorithm to randomize project order without bias
 */
function fisherYatesShuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function ProjectsClient({
  initialProjects,
  initialUserVotedIds = [],
  initialVotingOpen = true,
  initialResultsPublic = false,
  initialSubmissionsOpen = false,
  submissionsClose = null,
  tracks = [],
  initialVoteCounts = null,
  initialCommentCounts = {},
  initialLeaderboard = null,
  isOrganizerOrAdmin = false,
  currentUserId = null,
  currentUserRole = null,
}: ProjectsClientProps) {
  const [projectsList, setProjectsList] = useState<ProjectWithRelations[]>(initialProjects);
  const [submissionsOpen] = useState<boolean>(initialSubmissionsOpen);
  const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'gallery' | 'rankings'>('gallery');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(initialLeaderboard);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState<boolean>(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [rankingTrack, setRankingTrack] = useState<string>('All');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrack, setSelectedTrack] = useState<FilterTrack>('All');
  const [sortOrder, setSortOrder] = useState<SortOption>('random');

  // Per-session ballot randomization state (Fisher-Yates)
  const [sessionBallotOrder, setSessionBallotOrder] = useState<string[] | null>(null);

  // Voting state
  const [votedProjectIds, setVotedProjectIds] = useState<Set<string>>(
    () => new Set(initialUserVotedIds)
  );
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>(
    initialVoteCounts || {}
  );
  const [votingInProgress, setVotingInProgress] = useState<string | null>(null);
  const [votingOpen] = useState<boolean>(initialVotingOpen);
  const [resultsPublic] = useState<boolean>(initialResultsPublic);

  // Comments state
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>(
    initialCommentCounts
  );
  const [activeCommentProject, setActiveCommentProject] =
    useState<ProjectWithRelations | null>(null);

  // Embed Modal state
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);

  // Toast / notification banner state
  const [notification, setNotification] = useState<{
    id: string;
    type: 'success' | 'error' | 'info';
    message: string;
    showLoginLink?: boolean;
  } | null>(null);

  // Fetch leaderboard client-side
  const fetchLeaderboard = useCallback(async () => {
    setLoadingLeaderboard(true);
    setLeaderboardError(null);
    try {
      const res = await fetch('/api/leaderboard');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setLeaderboard(data.leaderboard);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load leaderboard';
      setLeaderboardError(msg);
    } finally {
      setLoadingLeaderboard(false);
    }
  }, []);

  // Auto-dismiss notification after 4 seconds
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      setNotification(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [notification]);

  // Load or generate session-stable Fisher-Yates ballot order on client mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('omnijudge_ballot_order');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessionBallotOrder(parsed);
          return;
        }
      }
    } catch {
      // sessionStorage unavailable
    }

    const shuffled = fisherYatesShuffle(projectsList.map((p) => p.id));
    try {
      sessionStorage.setItem('omnijudge_ballot_order', JSON.stringify(shuffled));
    } catch {
      // sessionStorage unavailable
    }
    setSessionBallotOrder(shuffled);
  }, [projectsList]);

  // Reshuffle ballot action (re-generates Fisher-Yates order)
  const handleReshuffle = useCallback(() => {
    const shuffled = fisherYatesShuffle(projectsList.map((p) => p.id));
    try {
      sessionStorage.setItem('omnijudge_ballot_order', JSON.stringify(shuffled));
    } catch {
      // sessionStorage unavailable
    }
    setSessionBallotOrder(shuffled);
    setSortOrder('random');
    setNotification({
      id: `reshuffle_${Date.now()}`,
      type: 'info',
      message: 'Ballot randomized. Display order shuffled to neutralize bias.',
    });
  }, [projectsList]);

  // Handler for project submission callback
  const handleProjectSubmitted = useCallback((newProject: ProjectWithRelations) => {
    setProjectsList((prev) => [newProject, ...prev]);
    setNotification({
      id: `submit_${Date.now()}`,
      type: 'success',
      message: `Project "${newProject.title}" has been successfully submitted to the gallery!`,
    });
  }, []);

  // Stable drawer handlers to prevent re-render cascades
  const handleCommentCountChange = useCallback((projId: string, newCount: number) => {
    setCommentCounts((prev) => {
      if (prev[projId] === newCount) return prev;
      return {
        ...prev,
        [projId]: newCount,
      };
    });
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setActiveCommentProject(null);
  }, []);

  // Optimistic voting handler with rollback and error messaging
  const handleVote = async (projectId: string, projectTitle: string) => {
    if (votingInProgress === projectId) return;

    if (!votingOpen) {
      setNotification({
        id: `closed_${Date.now()}`,
        type: 'error',
        message: 'Community voting is currently closed.',
      });
      return;
    }

    const wasVoted = votedProjectIds.has(projectId);
    const nextVoted = !wasVoted;

    // 1. Optimistic UI update
    setVotingInProgress(projectId);
    setVotedProjectIds((prev) => {
      const next = new Set(prev);
      if (nextVoted) next.add(projectId);
      else next.delete(projectId);
      return next;
    });

    if (resultsPublic || isOrganizerOrAdmin) {
      setVoteCounts((prev) => ({
        ...prev,
        [projectId]: Math.max(0, (prev[projectId] || 0) + (nextVoted ? 1 : -1)),
      }));
    }

    try {
      const res = await fetch('/api/community/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Rollback optimistic update
        setVotedProjectIds((prev) => {
          const next = new Set(prev);
          if (wasVoted) next.add(projectId);
          else next.delete(projectId);
          return next;
        });

        if (resultsPublic || isOrganizerOrAdmin) {
          setVoteCounts((prev) => ({
            ...prev,
            [projectId]: Math.max(0, (prev[projectId] || 0) + (wasVoted ? 0 : nextVoted ? -1 : 1)),
          }));
        }

        if (res.status === 401) {
          setNotification({
            id: `unauth_${Date.now()}`,
            type: 'error',
            message: 'Please sign in to cast your community vote.',
            showLoginLink: true,
          });
        } else if (res.status === 403) {
          setNotification({
            id: `forbidden_${Date.now()}`,
            type: 'error',
            message: data.error || 'Team members cannot vote for their own submission.',
          });
        } else {
          setNotification({
            id: `err_${Date.now()}`,
            type: 'error',
            message: data.error || 'Failed to submit vote. Please try again.',
          });
        }
        return;
      }

      // Success
      setNotification({
        id: `vote_ok_${Date.now()}`,
        type: 'success',
        message: data.hasVoted
          ? `Vote recorded for "${projectTitle}".`
          : `Vote retracted for "${projectTitle}".`,
      });
    } catch {
      // Rollback on network failure
      setVotedProjectIds((prev) => {
        const next = new Set(prev);
        if (wasVoted) next.add(projectId);
        else next.delete(projectId);
        return next;
      });

      if (resultsPublic || isOrganizerOrAdmin) {
        setVoteCounts((prev) => ({
          ...prev,
          [projectId]: Math.max(0, (prev[projectId] || 0) + (wasVoted ? 0 : nextVoted ? -1 : 1)),
        }));
      }

      setNotification({
        id: `net_err_${Date.now()}`,
        type: 'error',
        message: 'Network error while submitting vote. Please try again.',
      });
    } finally {
      setVotingInProgress(null);
    }
  };

  // Filter projects by search and track
  const filteredProjects = useMemo(() => {
    return projectsList.filter((p) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        q === '' ||
        p.title.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q) ||
        (p.track?.name && p.track.name.toLowerCase().includes(q));

      const matchesTrk = matchesTrack(p.track?.name, selectedTrack);
      return matchesSearch && matchesTrk;
    });
  }, [projectsList, searchQuery, selectedTrack]);

  // Sort projects: randomized ballot (default) or user-selected ordering
  const sortedProjects = useMemo(() => {
    const list = [...filteredProjects];
    switch (sortOrder) {
      case 'random': {
        if (!sessionBallotOrder || sessionBallotOrder.length === 0) {
          return list;
        }
        const orderMap = new Map<string, number>();
        sessionBallotOrder.forEach((id, idx) => orderMap.set(id, idx));
        return list.sort((a, b) => {
          const posA = orderMap.get(a.id) ?? 9999;
          const posB = orderMap.get(b.id) ?? 9999;
          return posA - posB;
        });
      }
      case 'title-asc':
        return list.sort((a, b) => a.title.localeCompare(b.title));
      case 'title-desc':
        return list.sort((a, b) => b.title.localeCompare(a.title));
      case 'track':
        return list.sort((a, b) => (a.track?.name || '').localeCompare(b.track?.name || ''));
      case 'comments':
        return list.sort(
          (a, b) => (commentCounts[b.id] || 0) - (commentCounts[a.id] || 0)
        );
      default:
        return list;
    }
  }, [filteredProjects, sortOrder, sessionBallotOrder, commentCounts]);

  // Dynamic track options for judge rankings derived from event tracks, projects, and leaderboard
  const rankingTrackOptions = useMemo(() => {
    const set = new Set<string>();
    if (tracks && tracks.length > 0) {
      tracks.forEach((t) => {
        if (t.name) set.add(t.name);
      });
    }
    if (leaderboard) {
      leaderboard.forEach((item) => {
        if (item.trackName) set.add(item.trackName);
      });
    }
    projectsList.forEach((p) => {
      if (p.track?.name) set.add(p.track.name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tracks, leaderboard, projectsList]);

  // Rankings filtered by track with trackRank recalculated
  const displayedRankings = useMemo(() => {
    if (!leaderboard) return [];
    if (rankingTrack === 'All') {
      return leaderboard.map((item) => ({
        ...item,
        effectiveRank: item.rank,
        isTrackView: false,
      }));
    }
    const trackLower = rankingTrack.toLowerCase();
    const trackItems = leaderboard.filter(
      (item) => (item.trackName || '').toLowerCase() === trackLower
    );
    return trackItems.map((item, index) => ({
      ...item,
      effectiveRank: index + 1,
      isTrackView: true,
    }));
  }, [leaderboard, rankingTrack]);

  const showTotalVoteCounts = resultsPublic || isOrganizerOrAdmin;

  return (
    <div className="space-y-8">
      {/* Toast Notification Banner */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md w-full animate-in fade-in-0 duration-200">
          <div
            className={`p-4 rounded-xl border backdrop-blur-xl shadow-2xl flex items-start justify-between gap-3 ${
              notification.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                : notification.type === 'error'
                ? 'bg-red-950/90 border-red-500/40 text-red-200'
                : 'bg-cyan-950/90 border-cyan-500/40 text-cyan-200'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {notification.type === 'success' ? (
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : notification.type === 'error' ? (
                <AlertCircle className="size-4 text-red-400 shrink-0 mt-0.5" />
              ) : (
                <Sparkles className="size-4 text-cyan-400 shrink-0 mt-0.5" />
              )}
              <div className="text-xs leading-relaxed">
                <span>{notification.message}</span>
                {notification.showLoginLink && (
                  <div className="mt-2">
                    <Link
                      href="/login"
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors"
                    >
                      <LogIn className="size-3.5" /> Sign In Now
                    </Link>
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="text-white/60 hover:text-white transition-colors p-1"
              aria-label="Dismiss notification"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* View Switcher: Project Gallery vs Official Judge Rankings */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('gallery')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'gallery'
                ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(56,189,248,0.2)]'
                : 'bg-white/[0.03] border border-white/[0.06] text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
            }`}
          >
            <LayoutGrid className="size-4" />
            <span>Project Gallery</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('rankings');
              if ((resultsPublic || isOrganizerOrAdmin) && !leaderboard && !loadingLeaderboard) {
                fetchLeaderboard();
              }
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'rankings'
                ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                : 'bg-white/[0.03] border border-white/[0.06] text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
            }`}
          >
            <Trophy className="size-4 text-amber-400" />
            <span>Judge Rankings</span>
            {resultsPublic ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Live
              </span>
            ) : isOrganizerOrAdmin ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Preview
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/10 text-slate-400">
                Sealed
              </span>
            )}
          </button>
        </div>

        {/* Results Status Badge */}
        <div className="flex items-center gap-2">
          {!showTotalVoteCounts ? (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-slate-300 font-medium">
              <Shield className="size-3.5 text-cyan-400" />
              <span>🔒 Results sealed until voting window closes</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 font-medium">
              <Sparkles className="size-3.5" />
              <span>
                {resultsPublic ? '🔓 Community results public' : '👁️ Organizer Unsealed View'}
              </span>
            </div>
          )}
        </div>
      </div>

      {activeTab === 'gallery' ? (
        <>
          {/* Controls Container */}
          <div className="flex flex-col gap-4">
        {/* Top Row: Search Input + Submit Project Action Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
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

          {/* Submit Project Button & Portal Status Pill */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsSubmissionModalOpen(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 hover:brightness-110 shadow-[0_0_20px_rgba(56,189,248,0.3)] transition-all cursor-pointer"
            >
              <Plus className="size-4 text-slate-950 stroke-[2.5]" />
              <span>Submit Project</span>
              <span
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                  submissionsOpen
                    ? 'bg-slate-950/20 text-slate-950'
                    : 'bg-rose-950/30 text-rose-950'
                }`}
              >
                {submissionsOpen ? 'OPEN' : 'LOCKED'}
              </span>
            </button>
          </div>
        </div>

        {/* Second Row: Track Filter Strip + Ordering Controls */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 flex-wrap">
          {/* Track Filters */}
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

          {/* Sort & Randomization Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-white/[0.03] border border-white/[0.06] px-3 py-1.5 rounded-lg">
              <span className="text-slate-500">Sort:</span>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOption)}
                className="bg-transparent text-white focus:outline-none cursor-pointer font-medium text-xs pr-1"
                aria-label="Sort projects"
              >
                <option value="random" className="bg-[#0a0d14] text-white">
                  🎲 Default Randomized
                </option>
                <option value="title-asc" className="bg-[#0a0d14] text-white">
                  Title (A → Z)
                </option>
                <option value="title-desc" className="bg-[#0a0d14] text-white">
                  Title (Z → A)
                </option>
                <option value="track" className="bg-[#0a0d14] text-white">
                  Track
                </option>
                <option value="comments" className="bg-[#0a0d14] text-white">
                  Most Discussed
                </option>
              </select>
            </div>

            {sortOrder === 'random' && (
              <button
                type="button"
                onClick={handleReshuffle}
                title="Reshuffle ballot display order"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.03] border border-white/[0.08] text-slate-300 hover:text-cyan-300 hover:border-cyan-500/30 hover:bg-white/[0.06] transition-all"
              >
                <Shuffle className="size-3.5 text-cyan-400" />
                <span>Reshuffle</span>
              </button>
            )}

            <div className="text-xs text-slate-400 bg-white/[0.03] border border-white/[0.06] px-3 py-1.5 rounded-lg">
              Showing <span className="font-semibold text-white">{sortedProjects.length}</span> of{' '}
              {projectsList.length}
            </div>

            <button
              type="button"
              onClick={() => setShowEmbedModal(true)}
              title="Get embeddable gallery widget snippet"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 hover:text-cyan-200 transition-all shadow-[0_0_12px_rgba(56,189,248,0.15)]"
            >
              <Code2 className="size-3.5 text-cyan-400" />
              <span>Embed Gallery</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Glass Project Cards */}
      {sortedProjects.length === 0 ? (
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
          {sortedProjects.map((project) => {
            const isVoted = votedProjectIds.has(project.id);
            const count = voteCounts[project.id] ?? 0;
            const commentsCount = commentCounts[project.id] || 0;

            return (
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

                {/* Footer Controls & Actions */}
                <div className="pt-4 border-t border-white/[0.06] space-y-3.5">
                  {/* Repo Link and Metadata */}
                  <div className="flex items-center justify-between gap-2">
                    {project.repoUrl ? (
                      <a
                        href={project.repoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-white/10 bg-white/5 text-slate-200 hover:text-white hover:bg-white/10 hover:border-cyan-500/40 transition-all"
                      >
                        <ExternalLink className="size-3.5 text-cyan-400" />
                        <span>Source Repo</span>
                      </a>
                    ) : (
                      <div />
                    )}

                    <div className="flex items-center gap-2 text-xs text-slate-400">
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

                  {/* Results Sealed Shield Badge / Vote Count Display */}
                  <div>
                    {!showTotalVoteCounts ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.02] border border-white/[0.06] text-[11px] text-slate-400 font-mono">
                        <Shield className="size-3 text-cyan-400/70" />
                        <span>🔒 Results sealed until voting window closes</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-300 font-semibold">
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="size-3 text-emerald-400" />
                          <span>Community Votes</span>
                        </span>
                        <span className="font-mono text-emerald-400 text-sm">
                          {count}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Interactive Action Controls: Emerald Upvote + Obsidian Feedback Drawer Button */}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    {/* Upvote Button with Luminous Emerald Glow */}
                    <button
                      type="button"
                      onClick={() => handleVote(project.id, project.title)}
                      disabled={votingInProgress === project.id}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        isVoted
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:bg-emerald-500/20'
                          : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-emerald-500/30 hover:text-emerald-300 hover:bg-emerald-500/[0.05]'
                      }`}
                      aria-label={isVoted ? `Retract vote for ${project.title}` : `Upvote ${project.title}`}
                    >
                      <ChevronUp
                        className={`size-4 transition-transform ${
                          isVoted ? 'text-emerald-400 -translate-y-0.5' : 'text-slate-400'
                        }`}
                      />
                      <span>{isVoted ? 'Upvoted' : 'Upvote'}</span>
                      {showTotalVoteCounts && (
                        <span
                          className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-mono ${
                            isVoted
                              ? 'bg-emerald-500/30 text-emerald-200'
                              : 'bg-white/10 text-slate-300'
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>

                    {/* Feedback Drawer Trigger Button */}
                    <button
                      type="button"
                      onClick={() => setActiveCommentProject(project)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-500/30 hover:text-cyan-300 hover:bg-cyan-500/[0.05] transition-all"
                      aria-label={`Open feedback drawer for ${project.title}`}
                    >
                      <MessageSquare className="size-3.5 text-cyan-400" />
                      <span>Feedback</span>
                      <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/10 text-slate-300">
                        {commentsCount}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
      ) : (
        /* Judge Rankings View */
        <div className="space-y-6">
          {!resultsPublic && !isOrganizerOrAdmin ? (
            /* Sealed Placeholder for unauthorized / visitor view */
            <div className="text-center py-20 border border-white/[0.08] rounded-2xl bg-[var(--glass-bg)] backdrop-blur-md px-6 max-w-xl mx-auto my-6">
              <div className="size-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-4 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                <Lock className="size-7" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Rankings Currently Sealed</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                🔒 Rankings sealed until results are published by the organizer
              </p>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] text-xs text-slate-400 font-mono">
                Official MAD-normalized scores will unlock once results are unsealed.
              </div>
            </div>
          ) : (
            /* Authorized / Unsealed View */
            <div className="space-y-6">
              {!resultsPublic && isOrganizerOrAdmin && (
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium">
                  <div className="flex items-center gap-2">
                    <Shield className="size-4 shrink-0 text-amber-400" />
                    <span>🔒 Rankings sealed until results are published by the organizer (Organizer Unsealed View)</span>
                  </div>
                  <button
                    type="button"
                    onClick={fetchLeaderboard}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 transition-colors"
                  >
                    <RefreshCw className={`size-3 ${loadingLeaderboard ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              )}

              {loadingLeaderboard && !leaderboard ? (
                <div className="text-center py-24 border border-white/[0.08] rounded-2xl bg-[var(--glass-bg)] backdrop-blur-md">
                  <Sparkles className="size-7 text-amber-400 animate-spin mx-auto mb-3" />
                  <p className="text-slate-300 font-medium text-sm">Computing MAD-normalized judge ranking...</p>
                  <p className="text-slate-500 text-xs mt-1">Aggregating cross-judge evaluations</p>
                </div>
              ) : leaderboardError && !leaderboard ? (
                <div className="text-center py-16 border border-red-500/30 rounded-2xl bg-red-950/20 backdrop-blur-md px-6 max-w-lg mx-auto">
                  <AlertCircle className="size-8 text-red-400 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-white mb-1">Failed to load leaderboard</h3>
                  <p className="text-red-300 text-xs mb-4">{leaderboardError}</p>
                  <button
                    type="button"
                    onClick={fetchLeaderboard}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : leaderboard && leaderboard.length === 0 ? (
                <div className="text-center py-20 border border-white/[0.08] rounded-2xl bg-[var(--glass-bg)] backdrop-blur-md">
                  <h3 className="text-lg font-semibold text-white">No projects evaluated yet</h3>
                  <p className="text-slate-400 mt-1 text-sm">
                    Judge evaluations have not yet been recorded.
                  </p>
                </div>
              ) : leaderboard ? (
                <div className="space-y-5">
                  {/* Leaderboard Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                        <Trophy className="size-5 sm:size-6 text-amber-400" />
                        <span>
                          {rankingTrack === 'All'
                            ? 'Official Judge Ranking Leaderboard'
                            : `${rankingTrack} Standings`}
                        </span>
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-400 mt-1">
                        {rankingTrack === 'All'
                          ? 'Overall Standings (Grand Champion View) • Ranked via Modified Z-Score (MAD method) normalized across all judge evaluations.'
                          : `Per-Track Standings (Category Winners View) • Re-indexed 1st, 2nd, 3rd within the ${rankingTrack} track with normalized scores.`}
                      </p>
                    </div>
                    <div className="text-xs text-slate-400 font-mono bg-white/[0.03] border border-white/[0.06] px-3 py-1.5 rounded-lg self-start sm:self-auto">
                      Showing <span className="font-semibold text-white">{displayedRankings.length}</span> {rankingTrack === 'All' ? 'ranked submissions' : `in ${rankingTrack}`}
                    </div>
                  </div>

                  {/* Dual Leaderboard Track Filter Strip */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block font-medium">
                      Leaderboard View
                    </span>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10">
                      <button
                        type="button"
                        onClick={() => setRankingTrack('All')}
                        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                          rankingTrack === 'All'
                            ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                            : 'bg-white/[0.03] border border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
                        }`}
                      >
                        <Trophy className="size-3.5 text-amber-400" />
                        <span>All Tracks (Overall)</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-white/10 text-slate-300">
                          {leaderboard.length}
                        </span>
                      </button>

                      {rankingTrackOptions.map((t) => {
                        const count = leaderboard.filter(
                          (i) => (i.trackName || '').toLowerCase() === t.toLowerCase()
                        ).length;
                        const isSelected = rankingTrack.toLowerCase() === t.toLowerCase();
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setRankingTrack(t)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 shadow-[0_0_15px_rgba(56,189,248,0.25)]'
                                : 'bg-white/[0.03] border border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
                            }`}
                          >
                            <span>{t}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                                isSelected ? 'bg-cyan-500/30 text-cyan-200' : 'bg-white/10 text-slate-400'
                              }`}
                            >
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Category Winners Podium Cards (when viewing a specific track) */}
                  {rankingTrack !== 'All' && displayedRankings.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1"
                    >
                      {displayedRankings.slice(0, 3).map((podiumItem, pIdx) => {
                        const pRank = pIdx + 1;
                        const isP1 = pRank === 1;
                        const isP2 = pRank === 2;
                        return (
                          <div
                            key={podiumItem.projectId}
                            className={`p-4 rounded-xl border backdrop-blur-md relative overflow-hidden flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
                              isP1
                                ? 'bg-gradient-to-b from-amber-500/[0.14] to-amber-500/[0.02] border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                                : isP2
                                ? 'bg-gradient-to-b from-slate-300/[0.12] to-slate-300/[0.02] border-slate-300/40 shadow-[0_0_20px_rgba(203,213,225,0.1)]'
                                : 'bg-gradient-to-b from-amber-700/[0.12] to-amber-700/[0.02] border-amber-600/40 shadow-[0_0_20px_rgba(217,119,6,0.1)]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white">
                                {isP1 ? (
                                  <>
                                    <Trophy className="size-4 text-amber-400" />
                                    <span className="text-amber-300">1st Place • Track Champion</span>
                                  </>
                                ) : isP2 ? (
                                  <>
                                    <Medal className="size-4 text-slate-300" />
                                    <span className="text-slate-200">2nd Place • Runner-Up</span>
                                  </>
                                ) : (
                                  <>
                                    <Award className="size-4 text-amber-500" />
                                    <span className="text-amber-300">3rd Place</span>
                                  </>
                                )}
                              </span>
                              <span className="text-xs font-mono font-bold text-cyan-300">
                                {podiumItem.normalizedScore.toFixed(2)} pts
                              </span>
                            </div>
                            <div className="font-bold text-sm text-white truncate mb-1">
                              {podiumItem.title}
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mt-2 pt-2 border-t border-white/5">
                              <span className="text-cyan-400">Overall #{podiumItem.rank}</span>
                              <span>{podiumItem.reviewCount} {podiumItem.reviewCount === 1 ? 'review' : 'reviews'}</span>
                            </div>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}

                  {/* Empty state if track has 0 items */}
                  {displayedRankings.length === 0 ? (
                    <div className="text-center py-16 border border-white/[0.08] rounded-2xl bg-[var(--glass-bg)] backdrop-blur-md">
                      <Award className="size-8 text-slate-500 mx-auto mb-2 opacity-50" />
                      <h3 className="text-base font-semibold text-white">No ranked submissions in {rankingTrack}</h3>
                      <p className="text-slate-400 mt-1 text-xs">
                        No projects in this track have received judge evaluations yet.
                      </p>
                      <button
                        type="button"
                        onClick={() => setRankingTrack('All')}
                        className="mt-4 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer"
                      >
                        View All Tracks (Overall)
                      </button>
                    </div>
                  ) : (
                    /* Leaderboard Ranked List */
                    <div className="space-y-3">
                      {displayedRankings.map((item, index) => {
                        const isGold = item.effectiveRank === 1;
                        const isSilver = item.effectiveRank === 2;
                        const isBronze = item.effectiveRank === 3;

                        return (
                          <motion.div
                            key={item.projectId}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                              duration: 0.25,
                              delay: Math.min(index * 0.03, 0.4),
                              ease: [0.16, 1, 0.3, 1],
                            }}
                            className={`p-4 sm:p-5 rounded-2xl border backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-200 hover:-translate-y-0.5 ${
                              isGold
                                ? 'bg-gradient-to-r from-amber-500/[0.14] via-amber-500/[0.04] to-transparent border-amber-500/40 shadow-[0_4px_24px_rgba(245,158,11,0.15)]'
                                : isSilver
                                ? 'bg-gradient-to-r from-slate-300/[0.12] via-slate-300/[0.03] to-transparent border-slate-300/40 shadow-[0_4px_24px_rgba(203,213,225,0.1)]'
                                : isBronze
                                ? 'bg-gradient-to-r from-amber-700/[0.12] via-amber-700/[0.03] to-transparent border-amber-600/40 shadow-[0_4px_24px_rgba(217,119,6,0.1)]'
                                : 'bg-[var(--glass-bg)] border-[var(--glass-border)] hover:border-cyan-500/30'
                            }`}
                          >
                            {/* Left: Rank Badge + Title + ID + Track */}
                            <div className="flex items-center gap-3.5 min-w-0">
                              {/* Rank Badge */}
                              <div className="shrink-0">
                                {isGold ? (
                                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-amber-500/50 bg-amber-500/20 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                                    <Trophy className="size-3.5 text-amber-400" />
                                    <span>#1</span>
                                  </div>
                                ) : isSilver ? (
                                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-slate-300/50 bg-slate-300/20 text-slate-200 shadow-[0_0_15px_rgba(203,213,225,0.25)]">
                                    <Medal className="size-3.5 text-slate-300" />
                                    <span>#2</span>
                                  </div>
                                ) : isBronze ? (
                                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-amber-600/50 bg-amber-700/20 text-amber-300 shadow-[0_0_15px_rgba(217,119,6,0.25)]">
                                    <Award className="size-3.5 text-amber-500" />
                                    <span>#3</span>
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center justify-center w-11 py-1.5 rounded-full text-xs font-semibold font-mono border border-white/10 bg-white/5 text-slate-400">
                                    #{item.effectiveRank}
                                  </div>
                                )}
                              </div>

                              {/* Project Details */}
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="text-base font-bold text-white truncate hover:text-cyan-300 transition-colors">
                                    {item.title}
                                  </h3>
                                  <span className="text-[11px] text-slate-500 font-mono">
                                    {item.projectId}
                                  </span>
                                  {item.isTrackView && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                                      Overall #{item.rank}
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${getTrackBadgeStyle(
                                      item.trackName
                                    )}`}
                                  >
                                    {item.trackName}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Right: Scores & Review Count */}
                            <div className="flex items-center gap-6 self-end md:self-center shrink-0">
                              {/* Review Count */}
                              <div className="text-right">
                                <span className="text-[11px] text-slate-400 block font-medium">Evaluations</span>
                                <span className="text-xs font-semibold text-slate-200 font-mono">
                                  {item.reviewCount} {item.reviewCount === 1 ? 'review' : 'reviews'}
                                </span>
                              </div>

                              {/* Normalized Score Badge */}
                              <div className="text-right min-w-[90px]">
                                <span className="text-[11px] text-slate-400 block font-medium">Norm Score</span>
                                <div className="inline-flex items-center gap-1 font-mono text-base font-bold text-cyan-300">
                                  <span>{item.normalizedScore.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Project Comments & Feedback Drawer */}
      <ProjectCommentsDrawer
        isOpen={!!activeCommentProject}
        project={activeCommentProject}
        onClose={handleCloseDrawer}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        onCommentCountChange={handleCommentCountChange}
      />

      {/* Embed Gallery Modal */}
      {showEmbedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in-0 duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d1117] p-6 shadow-2xl relative text-left">
            <button
              onClick={() => setShowEmbedModal(false)}
              className="absolute right-4 top-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close dialog"
            >
              <X className="size-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-2">
              <div className="size-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(56,189,248,0.2)]">
                <Code2 className="size-4.5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Embed Project Gallery</h3>
                <span className="text-[11px] text-cyan-400 font-mono">T4 STRETCH CAPABILITY</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Embed a distraction-free, responsive gallery widget onto your hackathon landing page, partner portal, or blog. The widget is iframe-optimized with live search and track filtering.
            </p>

            <div className="space-y-3">
              <label className="text-xs font-mono text-slate-300 block">
                HTML Embed Code:
              </label>
              <div className="relative">
                <pre className="p-3.5 rounded-xl bg-black/70 border border-white/10 font-mono text-xs text-cyan-300 overflow-x-auto whitespace-pre-wrap break-all select-all">
                  {`<iframe src="http://localhost:8080/embed/projects" width="100%" height="700px" frameborder="0"></iframe>`}
                </pre>
              </div>

              <div className="flex items-center justify-between pt-2">
                <a
                  href="/embed/projects"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <ExternalLink className="size-3.5" />
                  <span>Preview Live Widget</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      '<iframe src="http://localhost:8080/embed/projects" width="100%" height="700px" frameborder="0"></iframe>'
                    );
                    setEmbedCopied(true);
                    setTimeout(() => setEmbedCopied(false), 2000);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(56,189,248,0.3)] transition-all"
                >
                  {embedCopied ? (
                    <>
                      <Check className="size-3.5" />
                      <span>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      <span>Copy Embed Code</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Project Submission Modal for Participants */}
      <ProjectSubmissionModal
        isOpen={isSubmissionModalOpen}
        onClose={() => setIsSubmissionModalOpen(false)}
        submissionsOpen={submissionsOpen}
        submissionsClose={submissionsClose}
        tracks={tracks}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        onProjectSubmitted={handleProjectSubmitted}
      />
    </div>
  );
}
