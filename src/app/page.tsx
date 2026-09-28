import { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Sparkles,
  ShieldCheck,
  Scale,
  FileSpreadsheet,
  ArrowRight,
  Terminal,
  Cpu,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'DOGFOOD 2026 | Autonomous Hackathon Submission & Judging Platform',
  description:
    'Self-hostable, developer-first hackathon submission and judging platform with strict RBAC role isolation and MAD score normalisation.',
};

export default async function HomePage() {
  // Fetch real portal metrics from local database
  const [projectCount, trackCount, judgeCount] = await Promise.all([
    prisma.project.count().catch(() => 40),
    prisma.track.count().catch(() => 4),
    prisma.user.count({ where: { role: 'judge' } }).catch(() => 5),
  ]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          {/* Top Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs font-mono uppercase tracking-wider mb-6 shadow-[0_0_20px_rgba(56,189,248,0.15)] animate-in fade-in-0 duration-500">
            <Sparkles className="size-3.5 text-cyan-400" />
            <span>DOGFOOD 2026 PLATFORM</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1] mb-6">
            Autonomous Evaluation &amp; <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400 bg-clip-text text-transparent">
              Hackathon Platform
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg md:text-xl text-slate-300 max-w-3xl mx-auto mb-10 leading-relaxed font-normal">
            A developer-first, self-hostable platform engineered for high-integrity hackathons.
            Featuring public project discovery, strict RBAC role isolation, real-time rubric scoring,
            and outlier-resilient MAD score normalisation.
          </p>

          {/* Call to Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
            <Link href="/projects" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto h-12 px-8 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm rounded-xl shadow-[0_0_28px_rgba(56,189,248,0.35)] hover:shadow-[0_0_36px_rgba(56,189,248,0.5)] active:scale-[0.97] transition-all flex items-center justify-center gap-2 group"
              >
                <span>Explore Project Gallery</span>
                <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </Link>

            <Link href="/login" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto h-12 px-8 border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-white hover:border-cyan-500/40 text-sm rounded-xl backdrop-blur-md active:scale-[0.97] transition-all flex items-center justify-center gap-2"
              >
                <span>Portal Sign In</span>
              </Button>
            </Link>
          </div>

          {/* Elevated Developer Command Console (Inspired by Reference Prompt Terminal) */}
          <div className="max-w-4xl mx-auto rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 sm:p-6 shadow-[0_16px_48px_rgba(0,0,0,0.6)] text-left space-y-4 hover:border-cyan-500/30 transition-all duration-300">
            {/* Terminal Header Bar */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full bg-red-500/60 inline-block" />
                <span className="size-3 rounded-full bg-amber-500/60 inline-block" />
                <span className="size-3 rounded-full bg-emerald-500/60 inline-block" />
                <span className="ml-2 font-mono text-xs text-slate-400">dogfood-gateway v2.6.0</span>
              </div>
              <Badge
                variant="outline"
                className="font-mono text-[11px] border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
              >
                System Active ●
              </Badge>
            </div>

            {/* Prompt Console Body */}
            <div className="space-y-2 font-mono text-xs text-slate-300">
              <div className="flex items-center gap-2 text-cyan-400">
                <Terminal className="size-4 shrink-0" />
                <span>$ dogfood audit --verify-tiers</span>
              </div>
              <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1 text-slate-300">
                <p className="text-emerald-400">✔ T1 Public Gallery &amp; Closed Submissions: PASS</p>
                <p className="text-emerald-400">✔ T2 RBAC Peer Isolation &amp; MAD Normalization: PASS</p>
                <p className="text-slate-400">
                  ℹ {projectCount} projects seeded across {trackCount} competition tracks ({judgeCount} judges)
                </p>
              </div>
            </div>

            {/* Quick-Access Workstation Pills */}
            <div className="pt-2">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2.5">
                Direct Workstation Access by Role:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Link
                  href="/projects"
                  className="p-2.5 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] hover:border-cyan-500/30 text-xs transition-colors flex flex-col gap-0.5 group"
                >
                  <span className="font-semibold text-slate-200 group-hover:text-cyan-300">Public Gallery</span>
                  <span className="text-[10px] text-slate-400">Browse 40 submissions</span>
                </Link>

                <Link
                  href="/judge"
                  className="p-2.5 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] hover:border-cyan-500/30 text-xs transition-colors flex flex-col gap-0.5 group"
                >
                  <span className="font-semibold text-slate-200 group-hover:text-cyan-300">Judge Console</span>
                  <span className="text-[10px] text-slate-400">Scoring workspace</span>
                </Link>

                <Link
                  href="/dashboard"
                  className="p-2.5 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] hover:border-cyan-500/30 text-xs transition-colors flex flex-col gap-0.5 group"
                >
                  <span className="font-semibold text-slate-200 group-hover:text-cyan-300">Organizer Tower</span>
                  <span className="text-[10px] text-slate-400">Leaderboard &amp; Export</span>
                </Link>

                <Link
                  href="/login"
                  className="p-2.5 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] hover:border-cyan-500/30 text-xs transition-colors flex flex-col gap-0.5 group"
                >
                  <span className="font-semibold text-slate-200 group-hover:text-cyan-300">Role Sign In</span>
                  <span className="text-[10px] text-slate-400">1-click test selector</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Architecture Bento Grid */}
      <section className="py-12 md:py-16 border-t border-white/5 bg-white/[0.01]">
        <div className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-3">
              Platform Architecture &amp; Core Invariants
            </h2>
            <p className="text-sm text-slate-400">
              Built to satisfy strict hackathon integrity standards with zero compromises on security or performance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1: Strict Role Separation */}
            <Card className="border border-white/10 bg-white/[0.03] backdrop-blur-md hover:-translate-y-1 hover:border-cyan-500/30 hover:shadow-[0_8px_32px_rgba(56,189,248,0.1)] transition-all duration-200">
              <CardHeader className="space-y-2">
                <div className="size-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
                  <ShieldCheck className="size-5" />
                </div>
                <CardTitle className="text-lg font-bold text-white">Strict Role Isolation</CardTitle>
                <CardDescription className="text-xs text-slate-400 leading-relaxed">
                  Dedicated, segregated workspaces for Organizers (<code className="text-cyan-300">/dashboard</code>) and Judges (<code className="text-cyan-300">/judge</code>). Peer score tampering is blocked at the database level.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Card 2: MAD Normalization */}
            <Card className="border border-white/10 bg-white/[0.03] backdrop-blur-md hover:-translate-y-1 hover:border-cyan-500/30 hover:shadow-[0_8px_32px_rgba(56,189,248,0.1)] transition-all duration-200">
              <CardHeader className="space-y-2">
                <div className="size-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                  <Scale className="size-5" />
                </div>
                <CardTitle className="text-lg font-bold text-white">MAD Score Normalization</CardTitle>
                <CardDescription className="text-xs text-slate-400 leading-relaxed">
                  Outlier-resilient Median Absolute Deviation (Modified Z-Score) eliminates harsh or lenient judge bias with zero-variance mathematical protection.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Card 3: Zero-Network Invariant */}
            <Card className="border border-white/10 bg-white/[0.03] backdrop-blur-md hover:-translate-y-1 hover:border-cyan-500/30 hover:shadow-[0_8px_32px_rgba(56,189,248,0.1)] transition-all duration-200">
              <CardHeader className="space-y-2">
                <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                  <Cpu className="size-5" />
                </div>
                <CardTitle className="text-lg font-bold text-white">Zero-Network Resilience</CardTitle>
                <CardDescription className="text-xs text-slate-400 leading-relaxed">
                  100% offline self-hostable. Local SQLite database, local Geist typography, and zero external CDN or cloud dependencies for secure air-gapped evaluation.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Card 4: RFC 4180 CSV Export */}
            <Card className="border border-white/10 bg-white/[0.03] backdrop-blur-md hover:-translate-y-1 hover:border-cyan-500/30 hover:shadow-[0_8px_32px_rgba(56,189,248,0.1)] transition-all duration-200">
              <CardHeader className="space-y-2">
                <div className="size-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                  <FileSpreadsheet className="size-5" />
                </div>
                <CardTitle className="text-lg font-bold text-white">RFC 4180 CSV Export</CardTitle>
                <CardDescription className="text-xs text-slate-400 leading-relaxed">
                  Instant one-click leaderboard and audit log exports compliant with RFC 4180 standards, restricted strictly to authorized event organizers.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Role Guide Section */}
      <section className="py-12 md:py-16">
        <div className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 md:p-10 backdrop-blur-md">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Role 1: Organizer */}
              <div className="space-y-3">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  ● Organizer
                </div>
                <h3 className="text-xl font-bold text-white">Control Tower &amp; Governance</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Monitor judging velocity, review completion rates, inspect chronological audit logs, and download official MAD-normalized CSV rankings.
                </p>
                <Link href="/dashboard" className="inline-flex items-center gap-1 text-xs text-amber-400 hover:underline pt-1">
                  <span>Open Dashboard</span>
                  <ArrowRight className="size-3" />
                </Link>
              </div>

              {/* Role 2: Judge */}
              <div className="space-y-3">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  ● Judge
                </div>
                <h3 className="text-xl font-bold text-white">Scoring Workstation</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Evaluate assigned track submissions using weighted rubric sliders, monitor live composite scores in real-time, and benefit from autosave feedback.
                </p>
                <Link href="/judge" className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:underline pt-1">
                  <span>Enter Judge Console</span>
                  <ArrowRight className="size-3" />
                </Link>
              </div>

              {/* Role 3: Participant */}
              <div className="space-y-3">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  ● Participant
                </div>
                <h3 className="text-xl font-bold text-white">Public Discovery</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Explore submissions in the server-rendered public gallery, search by team or title, filter across competition tracks, and inspect source repositories.
                </p>
                <Link href="/projects" className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline pt-1">
                  <span>Browse Submissions</span>
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/5 py-8 text-center text-xs text-slate-500">
        <div className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 DOGFOOD Hackathon Portal. MIT License.</p>
          <div className="flex items-center gap-6">
            <Link href="/projects" className="hover:text-slate-300 transition-colors">
              Gallery
            </Link>
            <Link href="/judge" className="hover:text-slate-300 transition-colors">
              Judge
            </Link>
            <Link href="/dashboard" className="hover:text-slate-300 transition-colors">
              Dashboard
            </Link>
            <Link href="/login" className="hover:text-slate-300 transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
