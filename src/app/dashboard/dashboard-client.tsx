'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  BarChart3,
  Users,
  Download,
  CheckCircle2,
  Trophy,
  History,
  Layers,
  ShieldCheck,
} from 'lucide-react';

export interface DashboardKPIs {
  totalProjects: number;
  scoredProjects: number;
  totalReviews: number;
  totalJudges: number;
  completedJudges: number;
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

  const scoringCoveragePercent =
    kpis.totalProjects > 0
      ? Math.round((kpis.scoredProjects / kpis.totalProjects) * 100)
      : 0;

  const judgeCompletionRate =
    kpis.totalJudges > 0
      ? Math.round((kpis.completedJudges / kpis.totalJudges) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight">DOGFOOD 2026</span>
            </Link>
            <Badge variant="default" className="text-xs font-normal bg-primary text-primary-foreground">
              Organizer Tower
            </Badge>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="hidden sm:flex flex-col text-right">
              <span className="font-semibold text-foreground">{user.name}</span>
              <span className="text-muted-foreground">{user.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/judge">
                <Button variant="outline" size="sm">
                  Judge View
                </Button>
              </Link>
              <Link href="/projects">
                <Button variant="outline" size="sm">
                  Gallery
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        {/* Title & Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-primary font-medium text-xs mb-1">
              <ShieldCheck className="size-4" />
              <span>Event Administration & Scoring Analytics</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">Organizer Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Live judging progress, MAD-normalized leaderboard, and immutable audit logs.
            </p>
          </div>

          {/* CSV Export CTA Button */}
          <div className="flex items-center gap-2">
            <a href="/api/export.csv" download="dogfood_scores.csv">
              <Button className="flex items-center gap-2 shadow-sm font-semibold">
                <Download className="size-4" />
                <span>Export Results (CSV)</span>
              </Button>
            </a>
          </div>
        </div>

        {/* 4 KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border shadow-sm bg-card hover:border-primary/20 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Projects
              </CardTitle>
              <Layers className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold font-mono">{kpis.totalProjects}</div>
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {kpis.scoredProjects}
                </span>{' '}
                scored ({scoringCoveragePercent}% coverage)
              </p>
            </CardContent>
          </Card>

          <Card className="border shadow-sm bg-card hover:border-primary/20 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Scored Projects
              </CardTitle>
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold font-mono">
                {kpis.scoredProjects} / {kpis.totalProjects}
              </div>
              <Progress value={scoringCoveragePercent} className="h-1.5 mt-2" />
            </CardContent>
          </Card>

          <Card className="border shadow-sm bg-card hover:border-primary/20 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Evaluations
              </CardTitle>
              <BarChart3 className="size-4 text-primary" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold font-mono">{kpis.totalReviews}</div>
              <p className="text-xs text-muted-foreground">Across all rubric criteria</p>
            </CardContent>
          </Card>

          <Card className="border shadow-sm bg-card hover:border-primary/20 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Judge Completion
              </CardTitle>
              <Users className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold font-mono">
                {kpis.completedJudges} / {kpis.totalJudges}
              </div>
              <Progress value={judgeCompletionRate} className="h-1.5 mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Tabbed View: Leaderboard vs Judge Progress vs Audit Trail */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
            <TabsList className="grid grid-cols-3 w-full sm:w-[420px]">
              <TabsTrigger value="leaderboard" className="flex items-center gap-1.5 text-xs">
                <Trophy className="size-3.5" />
                <span>Leaderboard</span>
              </TabsTrigger>
              <TabsTrigger value="judges" className="flex items-center gap-1.5 text-xs">
                <Users className="size-3.5" />
                <span>Judge Progress</span>
              </TabsTrigger>
              <TabsTrigger value="audit" className="flex items-center gap-1.5 text-xs">
                <History className="size-3.5" />
                <span>Audit Trail</span>
              </TabsTrigger>
            </TabsList>

            {activeTab === 'leaderboard' && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Filter projects or tracks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-60"
                />
              </div>
            )}
          </div>

          {/* TAB 1: MAD Leaderboard */}
          <TabsContent value="leaderboard" className="space-y-4 m-0">
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">
                      Ranked Project Leaderboard
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Ranked by MAD-normalized Modified Z-Score to neutralize harsh vs lenient judge biases. Ties broken by raw composite score.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {filteredLeaderboard.length} Projects
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 border-y text-muted-foreground font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4 w-16 text-center">Rank</th>
                        <th className="py-3 px-4">Project</th>
                        <th className="py-3 px-4">Track</th>
                        <th className="py-3 px-4">Team</th>
                        <th className="py-3 px-4 text-center">Reviews</th>
                        <th className="py-3 px-4 text-right">Raw Mean</th>
                        <th className="py-3 px-4 text-right font-bold text-primary">
                          MAD Normalized
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredLeaderboard.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex items-center justify-center size-6 rounded-full font-bold text-[11px] ${
                                item.rank === 1
                                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40'
                                  : item.rank === 2
                                  ? 'bg-slate-300/40 text-slate-700 dark:text-slate-200 border border-slate-400/40'
                                  : item.rank === 3
                                  ? 'bg-amber-700/20 text-amber-900 dark:text-amber-500 border border-amber-700/40'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {item.rank}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-foreground">
                            <div>{item.title}</div>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {item.id}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="text-[10px] font-normal">
                              {item.trackName}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {item.teamName}
                          </td>
                          <td className="py-3 px-4 text-center font-mono">
                            {item.reviewCount}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                            {item.rawScore.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-primary">
                            {item.normalizedScore > 0 ? '+' : ''}
                            {item.normalizedScore.toFixed(4)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: Judge Progress */}
          <TabsContent value="judges" className="space-y-4 m-0">
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">
                  Judge Assignment & Progress Status
                </CardTitle>
                <CardDescription className="text-xs">
                  Monitor completion status and review throughput across appointed judges.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 border-y text-muted-foreground font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Judge</th>
                        <th className="py-3 px-4">Assigned Tracks</th>
                        <th className="py-3 px-4 text-center">Progress</th>
                        <th className="py-3 px-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {judgeProgress.map((judge) => {
                        const pct =
                          judge.assignedCount > 0
                            ? Math.round((judge.scoredCount / judge.assignedCount) * 100)
                            : 0;

                        return (
                          <tr
                            key={judge.id}
                            className="hover:bg-muted/30 transition-colors"
                          >
                            <td className="py-3 px-4">
                              <div className="font-semibold text-foreground">
                                {judge.name}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {judge.email}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-wrap gap-1">
                                {judge.assignedTracks.map((t) => (
                                  <Badge
                                    key={t}
                                    variant="outline"
                                    className="text-[10px] py-0 font-normal"
                                  >
                                    {t}
                                  </Badge>
                                ))}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center min-w-[140px]">
                              <div className="flex items-center gap-2 justify-center">
                                <Progress value={pct} className="h-1.5 w-20" />
                                <span className="font-mono text-[11px] text-muted-foreground">
                                  {judge.scoredCount} / {judge.assignedCount}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              {judge.status === 'Completed' ? (
                                <Badge
                                  variant="default"
                                  className="bg-emerald-600 hover:bg-emerald-600 text-[10px]"
                                >
                                  Complete
                                </Badge>
                              ) : judge.status === 'In Progress' ? (
                                <Badge
                                  variant="outline"
                                  className="text-amber-600 border-amber-300 dark:border-amber-700 text-[10px]"
                                >
                                  In Progress
                                </Badge>
                              ) : (
                                <Badge
                                  variant="secondary"
                                  className="text-muted-foreground text-[10px]"
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: Audit Trail */}
          <TabsContent value="audit" className="space-y-4 m-0">
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">
                  Immutable Audit Log
                </CardTitle>
                <CardDescription className="text-xs">
                  Cryptographically trackable activity ledger recording all score submissions and critical lifecycle mutations.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-0">
                {recentAuditLogs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-xs">
                    No audit records registered yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/50 border-y text-muted-foreground font-semibold uppercase tracking-wider">
                        <tr>
                          <th className="py-3 px-4">Timestamp</th>
                          <th className="py-3 px-4">Actor</th>
                          <th className="py-3 px-4">Action</th>
                          <th className="py-3 px-4">Payload Summary</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border font-mono">
                        {recentAuditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-muted/30">
                            <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleString()}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-semibold text-foreground font-sans">
                                {log.userName}
                              </span>
                              <Badge
                                variant="outline"
                                className="ml-2 text-[9px] uppercase py-0"
                              >
                                {log.userRole}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <Badge
                                variant={
                                  log.action === 'score_submitted'
                                    ? 'default'
                                    : 'secondary'
                                }
                                className="text-[10px]"
                              >
                                {log.action}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-muted-foreground max-w-xs truncate">
                              {log.payloadSummary}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
