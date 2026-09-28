'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Layers,
  Users,
  TrendingUp,
  Clock,
  Download,
  Trophy,
  History,
  ShieldCheck,
  Search,
} from 'lucide-react';

export interface DashboardKPIs {
  totalSubmissions: number;
  activeJudges: number;
  totalJudges: number;
  evaluationProgressPercent: number;
  remainingReviews: number;
  totalReviews: number;
}

export interface JudgeProgressItem {
  id: string;
  name: string;
  email: string;
  assignedTracks: string[];
  assignedCount: number;
  scoredCount: number;
  status: 'Completed' | 'In Progress' | 'Not Started';
}

export interface LeaderboardItem {
  rank: number;
  id: string;
  title: string;
  trackName: string;
  teamName: string;
  reviewCount: number;
  rawScore: number;
  normalizedScore: number;
}

export interface AuditLogItem {
  id: string;
  action: string;
  userName: string;
  userEmail: string;
  userRole: string;
  createdAt: string;
  payloadSummary: string;
}

export interface DashboardClientProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  kpis: DashboardKPIs;
  judgeProgress: JudgeProgressItem[];
  leaderboard: LeaderboardItem[];
  recentAuditLogs: AuditLogItem[];
}

export function DashboardClient({
  user,
  kpis,
  judgeProgress,
  leaderboard,
  recentAuditLogs,
}: DashboardClientProps) {
  const [activeTab, setActiveTab] = React.useState('leaderboard');
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredLeaderboard = React.useMemo(() => {
    if (!searchQuery.trim()) return leaderboard;
    const q = searchQuery.toLowerCase();
    return leaderboard.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.trackName.toLowerCase().includes(q) ||
        p.teamName.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
    );
  }, [leaderboard, searchQuery]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Control Bar / Top Status Banner */}
      <div className="border-b border-white/[0.06] bg-black/20 backdrop-blur-md sticky top-16 z-20">
        <div className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
              <ShieldCheck className="size-3.5" />
              <span>Organizer Control Tower</span>
            </div>
            <span className="text-xs text-muted-foreground hidden sm:inline">•</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Real-time Judging Telemetry
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-muted-foreground font-mono text-[11px]">LIVE METRICS</span>
            </div>
            <div className="h-4 w-[1px] bg-white/10 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-2 text-muted-foreground">
              <span className="font-semibold text-foreground">{user.name}</span>
              <Badge
                variant="outline"
                className="text-[10px] uppercase font-mono py-0 text-cyan-400 border-cyan-500/30 bg-cyan-500/5"
              >
                {user.role}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <main className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        {/* Title & Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              Organizer Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Live judging progress, MAD-normalized leaderboard, and immutable audit logs.
            </p>
          </div>

          {/* Prominent CSV Export CTA Button */}
          <div className="flex items-center gap-2">
            <a href="/api/export.csv" download="omnijudge_scores.csv">
              <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold gap-2 shadow-[0_0_20px_rgba(56,189,248,0.25)] border border-cyan-400/30">
                <Download className="size-4" />
                <span>⬇ Export CSV (RFC 4180)</span>
              </Button>
            </a>
          </div>
        </div>

        {/* 4 KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total Submissions */}
          <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-md p-5 hover:border-cyan-500/30 hover:shadow-[0_8px_32px_rgba(56,189,248,0.08)] transition-all duration-200 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Submissions
              </span>
              <div className="size-9 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 flex items-center justify-center shadow-[0_0_12px_rgba(56,189,248,0.15)]">
                <Layers className="size-4" />
              </div>
            </div>
            <div className="mt-4 space-y-1">
              <div className="text-3xl font-extrabold font-mono tracking-tight text-foreground">
                {kpis.totalSubmissions}
              </div>
              <p className="text-xs text-muted-foreground">
                Projects across all tracks
              </p>
            </div>
          </div>

          {/* 2. Active Judges */}
          <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-md p-5 hover:border-indigo-500/30 hover:shadow-[0_8px_32px_rgba(129,140,248,0.08)] transition-all duration-200 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Active Judges
              </span>
              <div className="size-9 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 flex items-center justify-center shadow-[0_0_12px_rgba(129,140,248,0.15)]">
                <Users className="size-4" />
              </div>
            </div>
            <div className="mt-4 space-y-1">
              <div className="text-3xl font-extrabold font-mono tracking-tight text-foreground">
                {kpis.activeJudges}{' '}
                <span className="text-base font-normal text-muted-foreground">
                  / {kpis.totalJudges}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Evaluating submissions
              </p>
            </div>
          </div>

          {/* 3. Evaluation Progress */}
          <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-md p-5 hover:border-emerald-500/30 hover:shadow-[0_8px_32px_rgba(52,211,153,0.08)] transition-all duration-200 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Evaluation Progress
              </span>
              <div className="size-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 flex items-center justify-center shadow-[0_0_12px_rgba(52,211,153,0.15)]">
                <TrendingUp className="size-4" />
              </div>
            </div>
            <div className="mt-4 space-y-1">
              <div className="text-3xl font-extrabold font-mono tracking-tight text-emerald-400">
                {kpis.evaluationProgressPercent}%
              </div>
              <Progress value={kpis.evaluationProgressPercent} className="h-1.5 mt-2 bg-white/10" />
              <p className="text-xs text-muted-foreground pt-1">
                Total completion rate
              </p>
            </div>
          </div>

          {/* 4. Remaining Reviews */}
          <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-md p-5 hover:border-amber-500/30 hover:shadow-[0_8px_32px_rgba(245,158,11,0.08)] transition-all duration-200 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Remaining Reviews
              </span>
              <div className="size-9 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/25 flex items-center justify-center shadow-[0_0_12px_rgba(245,158,11,0.15)]">
                <Clock className="size-4" />
              </div>
            </div>
            <div className="mt-4 space-y-1">
              <div className="text-3xl font-extrabold font-mono tracking-tight text-amber-400">
                {kpis.remainingReviews}
              </div>
              <p className="text-xs text-muted-foreground">
                Pending judge reviews
              </p>
            </div>
          </div>
        </div>

        {/* Tabbed View: Leaderboard vs Judge Progress vs Audit Trail */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <TabsList className="bg-white/5 border border-white/10 p-1 rounded-xl grid grid-cols-3 w-full sm:w-[440px]">
              <TabsTrigger
                value="leaderboard"
                className="flex items-center gap-1.5 text-xs rounded-lg data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300 data-[state=active]:border-cyan-500/30 data-[state=active]:shadow-sm transition-all"
              >
                <Trophy className="size-3.5" />
                <span>Leaderboard</span>
              </TabsTrigger>
              <TabsTrigger
                value="judges"
                className="flex items-center gap-1.5 text-xs rounded-lg data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300 data-[state=active]:border-cyan-500/30 data-[state=active]:shadow-sm transition-all"
              >
                <Users className="size-3.5" />
                <span>Judge Progress</span>
              </TabsTrigger>
              <TabsTrigger
                value="audit"
                className="flex items-center gap-1.5 text-xs rounded-lg data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300 data-[state=active]:border-cyan-500/30 data-[state=active]:shadow-sm transition-all"
              >
                <History className="size-3.5" />
                <span>Audit Trail</span>
              </TabsTrigger>
            </TabsList>

            {activeTab === 'leaderboard' && (
              <div className="relative">
                <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter projects, tracks, or teams..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-white/10 bg-white/5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500/50 w-full sm:w-64 transition-all"
                />
              </div>
            )}
          </div>

          {/* TAB 1: MAD Leaderboard */}
          <TabsContent value="leaderboard" className="space-y-4 m-0">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-md overflow-hidden shadow-xl"
            >
              <div className="p-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Ranked Project Leaderboard
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ranked by MAD-normalized Modified Z-Score to neutralize harsh vs lenient judge biases. Ties broken by raw composite score.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs bg-white/5 border-white/10 text-cyan-400 font-mono">
                    {filteredLeaderboard.length} Projects
                  </Badge>
                  <a href="/api/export.csv" download="omnijudge_scores.csv">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 gap-1.5"
                    >
                      <Download className="size-3.5" />
                      <span>Export CSV</span>
                    </Button>
                  </a>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-white/[0.02] border-b border-white/10 text-muted-foreground font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4 w-16 text-center">Rank</th>
                      <th className="py-3.5 px-4">Project</th>
                      <th className="py-3.5 px-4">Track</th>
                      <th className="py-3.5 px-4">Team</th>
                      <th className="py-3.5 px-4 text-center">Reviews</th>
                      <th className="py-3.5 px-4 text-right">Raw Mean</th>
                      <th className="py-3.5 px-4 text-right font-bold text-cyan-400">
                        MAD Normalized
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredLeaderboard.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-muted-foreground font-mono text-xs">
                          No matching projects found.
                        </td>
                      </tr>
                    ) : (
                      filteredLeaderboard.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="py-3.5 px-4 text-center">
                            {item.rank === 1 ? (
                              <span className="text-xl inline-block leading-none" title="Rank 1">
                                🥇
                              </span>
                            ) : item.rank === 2 ? (
                              <span className="text-xl inline-block leading-none" title="Rank 2">
                                🥈
                              </span>
                            ) : item.rank === 3 ? (
                              <span className="text-xl inline-block leading-none" title="Rank 3">
                                🥉
                              </span>
                            ) : (
                              <span className="font-mono text-xs text-muted-foreground font-semibold">
                                #{item.rank}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-foreground">
                            <div>{item.title}</div>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {item.id}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <Badge
                              variant="outline"
                              className="text-[10px] font-normal bg-white/5 border-white/10 text-slate-300"
                            >
                              {item.trackName}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 text-muted-foreground">
                            {item.teamName}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono">
                            {item.reviewCount}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-muted-foreground">
                            {item.rawScore.toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-cyan-400">
                            {item.normalizedScore > 0 ? '+' : ''}
                            {item.normalizedScore.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </TabsContent>

          {/* TAB 2: Judge Progress */}
          <TabsContent value="judges" className="space-y-4 m-0">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-md overflow-hidden shadow-xl"
            >
              <div className="p-5 border-b border-white/10">
                <h2 className="text-base font-semibold text-foreground">
                  Judge Assignment & Progress Status
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Monitor completion status and review throughput across appointed judges.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-white/[0.02] border-b border-white/10 text-muted-foreground font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Judge</th>
                      <th className="py-3.5 px-4">Assigned Tracks</th>
                      <th className="py-3.5 px-4 text-center">Reviews Progress</th>
                      <th className="py-3.5 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {judgeProgress.map((judge) => {
                      const pct =
                        judge.assignedCount > 0
                          ? Math.round((judge.scoredCount / judge.assignedCount) * 100)
                          : 0;

                      return (
                        <tr
                          key={judge.id}
                          className="hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-foreground">
                              {judge.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {judge.email}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1">
                              {judge.assignedTracks.map((t) => (
                                <Badge
                                  key={t}
                                  variant="outline"
                                  className="text-[10px] py-0 font-normal bg-white/5 border-white/10 text-slate-300"
                                >
                                  {t}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center min-w-[160px]">
                            <div className="flex items-center gap-2.5 justify-center">
                              <Progress value={pct} className="h-1.5 w-24 bg-white/10" />
                              <span className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                                {judge.scoredCount} / {judge.assignedCount} ({pct}%)
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {judge.status === 'Completed' ? (
                              <Badge
                                variant="outline"
                                className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-medium"
                              >
                                Completed
                              </Badge>
                            ) : judge.status === 'In Progress' ? (
                              <Badge
                                variant="outline"
                                className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-medium"
                              >
                                In Progress
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-slate-500/15 text-slate-400 border border-slate-500/30 text-[10px] font-medium"
                              >
                                Not Started
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </TabsContent>

          {/* TAB 3: Audit Trail Feed */}
          <TabsContent value="audit" className="space-y-4 m-0">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md overflow-hidden font-mono text-xs shadow-2xl"
            >
              {/* Terminal Title Bar */}
              <div className="px-4 py-3 bg-white/[0.03] border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs select-none">🔴 🟡 🟢</span>
                  <span className="text-muted-foreground font-mono text-xs font-semibold">
                    bash - audit.log
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                  <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>STREAM ACTIVE ({recentAuditLogs.length} ENTRIES)</span>
                </div>
              </div>

              {/* Monospace Log Rows */}
              <div className="divide-y divide-white/5">
                {recentAuditLogs.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground font-mono text-xs">
                    &gt; [SYSTEM] No audit records logged. Buffer idle.
                  </div>
                ) : (
                  recentAuditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 hover:bg-white/[0.02] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4"
                    >
                      <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                        <span className="text-cyan-400 font-bold select-none">&gt;</span>
                        <span className="text-muted-foreground whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </span>
                        <span className="text-indigo-400 font-semibold whitespace-nowrap">
                          [{log.userRole.toUpperCase()}: {log.userName}]
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 whitespace-nowrap">
                          {log.action}
                        </span>
                        <span className="text-slate-300 font-sans text-xs break-all">
                          {log.payloadSummary}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground/70 whitespace-nowrap self-end md:self-auto font-mono">
                        {new Date(log.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
