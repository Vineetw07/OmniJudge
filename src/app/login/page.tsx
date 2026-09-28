'use client';

import * as React from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ArrowLeft, KeyRound, AlertCircle, Sparkles } from 'lucide-react';

interface TestAccount {
  role: string;
  email: string;
  desc: string;
  baseClass: string;
  activeClass: string;
}

const TEST_ACCOUNTS: TestAccount[] = [
  {
    role: 'Organizer',
    email: 'organizer@dogfood.dev',
    desc: 'Admin & export controls',
    baseClass: 'border-amber-500/30 hover:border-amber-500/60',
    activeClass:
      'border-amber-500 bg-amber-500/10 shadow-[0_0_16px_rgba(245,158,11,0.25)] text-amber-400 ring-1 ring-amber-500/40',
  },
  {
    role: 'Judge Alpha',
    email: 'judge_a@dogfood.dev',
    desc: 'Scoring & evaluations',
    baseClass: 'border-cyan-500/30 hover:border-cyan-500/60',
    activeClass:
      'border-cyan-500 bg-cyan-500/10 shadow-[0_0_16px_rgba(6,182,212,0.25)] text-cyan-400 ring-1 ring-cyan-500/40',
  },
  {
    role: 'Judge Beta',
    email: 'judge_b@dogfood.dev',
    desc: 'Peer isolation evaluation',
    baseClass: 'border-indigo-500/30 hover:border-indigo-500/60',
    activeClass:
      'border-indigo-500 bg-indigo-500/10 shadow-[0_0_16px_rgba(99,102,241,0.25)] text-indigo-400 ring-1 ring-indigo-500/40',
  },
  {
    role: 'Participant',
    email: 'participant@dogfood.dev',
    desc: 'Project submissions',
    baseClass: 'border-emerald-500/30 hover:border-emerald-500/60',
    activeClass:
      'border-emerald-500 bg-emerald-500/10 shadow-[0_0_16px_rgba(16,185,129,0.25)] text-emerald-400 ring-1 ring-emerald-500/40',
  },
];

export default function LoginPage() {
  const [email, setEmail] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Please enter an email address.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Hard navigation ensures browser and Server Components reload with new session cookie
      const role = data.user?.role?.toLowerCase();
      if (role === 'judge') {
        window.location.href = '/judge';
      } else if (role === 'organizer' || role === 'admin') {
        window.location.href = '/dashboard';
      } else {
        window.location.href = '/projects';
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#07090e] min-h-screen text-slate-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Ambient cyan/indigo bloom radial gradient */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[640px] h-[500px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-500/15 via-indigo-500/10 to-transparent blur-3xl rounded-full"
      />

      <div className="backdrop-blur-md bg-white/[0.03] border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)] rounded-2xl p-6 sm:p-8 max-w-md w-full relative z-10">
        {/* Back-to-gallery button at the top of the card */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/[0.06]">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-cyan-400 transition-colors group"
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Gallery</span>
          </Link>
          <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Sparkles className="size-2.5" />
            <span>Dogfood Portal</span>
          </span>
        </div>

        {/* Card Header */}
        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex items-center justify-center size-12 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.15)] mb-1">
            <KeyRound className="size-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">DOGFOOD 2026</h1>
          <p className="text-xs text-slate-400">Sign in to access your hackathon portal</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
              <AlertCircle className="size-4 shrink-0 mt-0.5 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs font-medium text-slate-300">
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
              required
              className="h-10 text-sm focus-visible:ring-2 focus-visible:ring-cyan-500/40 focus-visible:border-cyan-500/50 bg-white/[0.03] border-white/[0.1] text-white placeholder:text-slate-500"
            />
          </div>

          {/* Test Account Quick-Select Grid (2x2) */}
          <div className="pt-2">
            <div className="text-xs font-medium text-slate-400 mb-2.5 flex items-center justify-between">
              <span>Quick-select test accounts:</span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400 border border-white/[0.08]">
                Seeded Roles
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {TEST_ACCOUNTS.map((acc) => {
                const isSelected = email.trim().toLowerCase() === acc.email.toLowerCase();
                return (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => setEmail(acc.email)}
                    data-selected={isSelected ? 'true' : undefined}
                    className={`text-left p-2.5 rounded-xl border transition-all duration-200 flex flex-col gap-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 ${
                      isSelected
                        ? acc.activeClass
                        : `${acc.baseClass} bg-white/[0.02] text-slate-300 hover:text-white`
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-semibold text-xs leading-tight">{acc.role}</span>
                      {isSelected && (
                        <span className="inline-block size-1.5 rounded-full bg-current shadow-[0_0_6px_currentColor]" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono truncate w-full">
                      {acc.email}
                    </span>
                    <span className="text-[10px] text-slate-500 line-clamp-1 leading-snug">
                      {acc.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold shadow-[0_0_20px_rgba(56,189,248,0.25)] transition-all cursor-pointer"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
