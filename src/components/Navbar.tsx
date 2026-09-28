'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const NAV_ITEMS = [
  { href: '/projects', label: 'Projects' },
  { href: '/judge', label: 'Judge' },
  { href: '/dashboard', label: 'Dashboard' },
];

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/[0.04] border-b border-white/[0.06] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand & Monospace Badge */}
        <div className="flex items-center gap-3">
          <Link href="/projects" className="flex items-center gap-2 group">
            <span className="text-lg font-bold tracking-tight text-white group-hover:text-cyan-400 transition-colors">
              DOGFOOD 2026
            </span>
          </Link>
          <Badge
            variant="outline"
            className="font-mono text-[10px] tracking-wider uppercase px-2 py-0.5 rounded border-white/10 bg-white/5 text-cyan-300"
          >
            PORTAL
          </Badge>
        </div>

        {/* Center: Navigation Links */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/' && pathname?.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  isActive
                    ? 'text-cyan-400 bg-white/[0.08] border border-cyan-500/30 shadow-[0_0_12px_rgba(56,189,248,0.2)]'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right: GitHub Icon Link & Sign In */}
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/Vineetw07/dogfood-portal"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub Repository"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] border border-transparent hover:border-white/10 transition-colors"
          >
            <GithubIcon />
          </a>
          <Link href="/login">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 px-3 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white hover:border-cyan-500/30 transition-all"
            >
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
