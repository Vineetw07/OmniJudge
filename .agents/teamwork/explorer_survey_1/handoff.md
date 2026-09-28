# Handoff Report: Global Design System & Public Project Gallery Survey

**Explorer**: Survey Explorer 1 (Global Design System & Project Gallery)  
**Milestone**: Phase 5 (Midnight Obsidian Glass UI Polish & Freeze Rehearsal)  
**Date**: 2026-09-28T10:55:00Z  
**Target Files**:
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/components/Navbar.tsx` (New Component)
- `src/components/PageTransition.tsx` (New Component)
- `src/app/projects/page.tsx`
- `src/app/projects/projects-client.tsx` (New Component)

---

## 1. Observation

### 1.1 `src/app/globals.css` (Current State)
- **Lines 66–105**: `:root` defines light theme palette using OKLCH (`--background: oklch(1 0 0);`, `--card: oklch(1 0 0);`, etc.). Pure white background is active by default.
- **Lines 106–145**: `.dark` defines dark mode OKLCH tokens, but the root theme defaults to light if `dark` class is missing from `<html>`.
- **Missing tokens**: Glass tokens (`--glass-bg`, `--glass-border`, `--glass-border-accent`, `--glass-glow`) do not exist.
- **Lines 149–151**: `body { @apply bg-background text-foreground; }` and `html { @apply font-sans; }`.

### 1.2 `src/app/layout.tsx` (Current State)
- **Lines 27–33**:
  ```tsx
  export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          {children}
        </body>
      </html>
    );
  }
  ```
- **Class omission**: `<html lang="en">` does NOT have class `dark`.
- **Zero layout chrome**: There is no navbar, no ambient top glow, and no Framer Motion page entrance animation.
- **Font isolation**: Fonts are imported strictly via `localFont` (`GeistVF.woff` and `GeistMonoVF.woff` in `src/app/fonts/`), adhering 100% to the Zero-Network Invariant.

### 1.3 `lucide-react` Icon Inspection (Critical Discovery)
- A runtime inspection of the installed `lucide-react` package (v1.48.0) revealed:
  ```powershell
  node -e "const lucide = require('lucide-react'); console.log('Github:', !!lucide.Github);"
  # Output: Github: false
  ```
- `lucide-react` does NOT export a `Github` component. Attempting `import { Github } from 'lucide-react'` will trigger a fatal Next.js compilation / build error (`export 'Github' was not found in 'lucide-react'`).
- Available related icons include `GitBranch`, `GitFork`, `GitCommit`, `Code2`, etc.
- To provide an authentic, pixel-perfect GitHub mark without third-party dependencies, an inline SVG conforming to Feather/Lucide conventions must be used.

### 1.4 `src/app/projects/page.tsx` (Current State & Invariant)
- **Lines 16–25**:
  ```tsx
  export default async function ProjectsPage() {
    const projects = await prisma.project.findMany({
      take: 40,
      orderBy: { id: 'asc' },
      include: { team: true, track: true },
    });
  ```
- **Lines 30–48**: The page currently renders a local, non-interactive `<header>` (`<span className="text-xl font-bold tracking-tight">DOGFOOD 2026</span>`, "Public Gallery" badge, "Sign In" button). This becomes redundant once `Navbar.tsx` is placed globally in `layout.tsx`.
- **Lines 77–141**: Projects are rendered directly as plain cards with static borders and basic hover states.
- **No client interactivity**: No search bar or track filter strip currently exists.

### 1.5 `Hack_docs/run.py` & Fixture Invariant
- **Lines 102–126** in `Hack_docs/run.py`:
  ```python
  c = Check("T1", "gallery is public")
  status, body = request(url("gallery"))
  c.ok = status == 200
  ...
  c = Check("T1", "project from fixtures shown")
  titles = fixture_titles(fixture)
  haystack = gallery_body.lower()
  c.ok = any(t.lower() in haystack for t in titles)
  ```
- `request(url("gallery"))` makes an unauthenticated HTTP GET to `/projects`. It does NOT execute JavaScript.
- `fixture_titles` retrieves the first 3 project titles from `Hack_docs/fixtures.json`:
  1. `prj_01`: "Glass Signal"
  2. `prj_02`: "Small Meadow"
  3. `prj_03`: "Deep Compass"
- If `/projects` is converted to a client-side fetch (`useEffect` + `fetch('/api/...')`), the raw HTML body will lack these title strings and Check 2 will immediately FAIL.
- In Next.js App Router, when an async Server Component renders a Client Component (`<ProjectsClient initialProjects={projects} />`), React renders the Client Component's default initial JSX tree during SSR into the initial HTML response. Because initial search is empty and initial track is 'All', all 40 project cards are present in the server-rendered HTML.

### 1.6 Database Tracks vs Filter Buttons
- `Hack_docs/fixtures.json` (lines 7–39) seeds 8 tracks:
  1. `trk_01`: Developer tools (5 projects)
  2. `trk_02`: Data and analytics (5 projects)
  3. `trk_03`: Accessibility (5 projects)
  4. `trk_04`: Security (5 projects)
  5. `trk_05`: Climate (5 projects)
  6. `trk_06`: Health (5 projects)
  7. `trk_07`: Education (5 projects)
  8. `trk_08`: Open hardware (5 projects)
- The user prompt specifies track buttons: `All`, `Dev Tools`, `AI Agents`, `Infrastructure`, `Consumer`.
- A direct mapping layer is necessary in `ProjectsClient` so clicking these category buttons filters seeded projects intelligently rather than returning empty lists.

---

## 2. Logic Chain

1. **Theme Consistency**: Because the entire portal is moving to Midnight Obsidian Glass, setting `--background: #07090e` and `--card: #0a0d14` directly in `:root` (and keeping `.dark` synchronized) ensures all base shadcn components (`Card`, `Input`, `Dialog`, `DropdownMenu`) automatically adopt obsidian surfaces without requiring ad-hoc class overrides. Adding `className="dark"` to `<html>` guarantees dark-mode utility classes (`dark:...`) resolve properly.
2. **Ambient Glow Separation**: Placing the ambient bloom (`radial-gradient(ellipse 80% 50% at 50% -10%, rgba(56,189,248,0.12), transparent)`) in `src/app/layout.tsx` as an `aria-hidden="true"` fixed layer behind content (`pointer-events-none -z-10`) provides consistent viewport lighting across all pages without z-index conflicts or interfering with pointer events.
3. **SSR-Safe Navigation**: Next.js App Router allows Server Component layouts to import Client Components. By extracting `Navbar` to `src/components/Navbar.tsx` with `'use client'`, it can use the `usePathname()` hook from `next/navigation` to detect the active route (e.g., `/projects`, `/judge`, `/dashboard`) and apply luminous active states without forcing `layout.tsx` to become a Client Component.
4. **Framer Motion Integration**: To satisfy R1 and `frontend-rules.md` (Pillar 14 - Fluid Motion), wrapping `{children}` in a Client Component `PageTransition` (`<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }}>`) provides a smooth page entrance. Including `useReducedMotion()` from `framer-motion` ensures accessibility compliance for users with vestibular sensitivities.
5. **Preserving T1 Acceptance Check**: `src/app/projects/page.tsx` must execute `await prisma.project.findMany(...)` server-side and pass the data to `ProjectsClient`. Because initial state defaults to `searchQuery = ""` and `selectedTrack = "All"`, Next.js SSR renders the complete list of 40 projects directly into the initial HTML payload. This guarantees that `run.py` finds "Glass Signal", "Small Meadow", and "Deep Compass" on the first request.
6. **Robust Client Island Filtering**: By isolating search and track filtering inside `src/app/projects/projects-client.tsx`, filtering operates entirely in client memory with zero roundtrips to the database or network, providing instant 60fps responsiveness.

---

## 3. Implementation Specifications & Blueprints

### 3.1 `src/app/globals.css` Specification
Update `:root` and `.dark` blocks and declare glass tokens:

```css
@layer base {
  :root {
    /* Obsidian Canvas & Surfaces */
    --background: #07090e;
    --foreground: #f8fafc;
    --card: #0a0d14;
    --card-foreground: #f8fafc;
    --popover: #0a0d14;
    --popover-foreground: #f8fafc;
    
    /* Brand Accents (Cyan / Electric Sky) */
    --primary: #38bdf8;
    --primary-foreground: #07090e;
    --secondary: #131722;
    --secondary-foreground: #f8fafc;
    --muted: #131722;
    --muted-foreground: #94a3b8;
    --accent: #1e293b;
    --accent-foreground: #f8fafc;
    --destructive: #ef4444;
    --destructive-foreground: #ffffff;
    
    /* Borders & Inputs */
    --border: rgba(255, 255, 255, 0.08);
    --input: rgba(255, 255, 255, 0.12);
    --ring: rgba(56, 189, 248, 0.4);
    --radius: 0.75rem;

    /* Glass Tokens */
    --glass-bg: rgba(255, 255, 255, 0.04);
    --glass-border: rgba(255, 255, 255, 0.08);
    --glass-border-accent: rgba(56, 189, 248, 0.3);
  }

  .dark {
    --background: #07090e;
    --foreground: #f8fafc;
    --card: #0a0d14;
    --card-foreground: #f8fafc;
    --popover: #0a0d14;
    --popover-foreground: #f8fafc;
    --primary: #38bdf8;
    --primary-foreground: #07090e;
    --secondary: #131722;
    --secondary-foreground: #f8fafc;
    --muted: #131722;
    --muted-foreground: #94a3b8;
    --accent: #1e293b;
    --accent-foreground: #f8fafc;
    --destructive: #ef4444;
    --destructive-foreground: #ffffff;
    --border: rgba(255, 255, 255, 0.08);
    --input: rgba(255, 255, 255, 0.12);
    --ring: rgba(56, 189, 248, 0.4);
    --glass-bg: rgba(255, 255, 255, 0.04);
    --glass-border: rgba(255, 255, 255, 0.08);
    --glass-border-accent: rgba(56, 189, 248, 0.3);
  }
}
```

Optional utility classes in `globals.css`:
```css
@layer utilities {
  .glass-card {
    background-color: var(--glass-bg);
    border: 1px solid var(--glass-border);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
}
```

---

### 3.2 `src/app/layout.tsx` Blueprint
```tsx
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { PageTransition } from "@/components/PageTransition";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "DOGFOOD 2026",
  description: "Hackathon submission and judging platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background text-foreground flex flex-col relative`}
      >
        {/* Ambient Top Cyan/Indigo Glow */}
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none -z-10 overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(56, 189, 248, 0.12), transparent)",
          }}
        />

        {/* Global Floating Glass Navbar */}
        <Navbar />

        {/* Page Entrance Animated Container */}
        <PageTransition>
          {children}
        </PageTransition>
      </body>
    </html>
  );
}
```

---

### 3.3 `src/components/Navbar.tsx` Blueprint
```tsx
'use client';

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
```

---

### 3.4 `src/components/PageTransition.tsx` Blueprint
```tsx
'use client';

import { motion, useReducedMotion } from 'framer-motion';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex-1 flex flex-col w-full"
    >
      {children}
    </motion.div>
  );
}
```

---

### 3.5 `src/app/projects/page.tsx` (Server Component) Blueprint
```tsx
import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { ProjectsClient } from './projects-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Project Gallery | DOGFOOD 2026',
  description: 'Explore submissions and projects participating in DOGFOOD 2026.',
};

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    take: 40,
    orderBy: { id: 'asc' },
    include: {
      team: true,
      track: true,
    },
  });

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      {/* Hero Banner with glowing pill badge */}
      <div className="text-center md:text-left mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs font-medium tracking-wide mb-4 shadow-[0_0_15px_rgba(56,189,248,0.2)]">
          <span>✦ DOGFOOD 2026 PORTAL</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-3">
          Project Gallery
        </h1>
        <p className="text-slate-400 text-base sm:text-lg max-w-2xl leading-relaxed">
          Discover all projects submitted to DOGFOOD 2026. Explore innovative work across every track.
        </p>
      </div>

      {/* Client island for search, track filtering and glass cards */}
      <ProjectsClient initialProjects={projects} />
    </main>
  );
}
```

---

### 3.6 `src/app/projects/projects-client.tsx` (Client Island) Blueprint
```tsx
'use client';

import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Search, ExternalLink, Users, Calendar, X } from 'lucide-react';
import type { Prisma } from '@prisma/client';

type ProjectWithRelations = Prisma.ProjectGetPayload<{
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

type FilterTrack = typeof FILTER_TRACKS[number];

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
      return t.includes('health') || t.includes('education') || t.includes('accessibility') || t.includes('climate');
    default:
      return t.includes(filter.toLowerCase());
  }
}

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
                      {new Date(project.submittedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
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
```

---

## 4. Caveats

1. **Port 8080 Process**: The development server was confirmed not actively running during this investigation. Before running `python Hack_docs/run.py .dogfood.toml`, the implementer or test runner must start `npm run start` (or `npm run dev`) on port 8080.
2. **Track Categorization Alignment**: Fixture tracks are categorized into 8 domains (`Developer tools`, `Data and analytics`, `Accessibility`, `Security`, `Climate`, `Health`, `Education`, `Open hardware`). The filter logic in `ProjectsClient` maps the 4 prompt-requested categories (`Dev Tools`, `AI Agents`, `Infrastructure`, `Consumer`) to these 8 domains. If future events introduce arbitrary track names, `matchesTrack` will fallback to case-insensitive substring matching.
3. **No External CDNs**: Ensure no worker attempts to import fonts from Google Fonts or external CDN stylesheets. All fonts must remain bound to `next/font/local` in `layout.tsx`.
4. **Header De-duplication**: The old `<header>` inside `src/app/projects/page.tsx` must be removed so that the page does not render two navigation headers.

---

## 5. Conclusion

1. **R1 Global Design System Architecture**:
   - `src/app/globals.css` can be updated cleanly to redefine `--background: #07090e`, `--card: #0a0d14`, and introduce `--glass-bg`, `--glass-border`, `--glass-border-accent`.
   - `src/app/layout.tsx` must add `className="dark"` to `<html>`, introduce the ambient top glow `<div aria-hidden>`, mount the client `<Navbar />`, and wrap `{children}` in client `<PageTransition />`.
   - `Navbar.tsx` MUST use an inline SVG for the GitHub icon because `lucide-react` does not export `Github`.
2. **R2 Public Project Gallery Architecture**:
   - `src/app/projects/page.tsx` strictly retains its async Server Component identity and Prisma query (`take: 40, orderBy: { id: 'asc' }`).
   - `ProjectsClient` encapsulates stateful search, track category filtering, glass cards with hover lift, and track badges.
   - Initial SSR renders all 40 projects directly in the HTML, fully safeguarding acceptance checks in `Hack_docs/run.py`.

---

## 6. Verification Method

To independently verify these findings and implementations:

1. **TypeScript Compilation**:
   ```powershell
   npm run typecheck
   ```
   Must exit with code 0 (no missing exports like `Github` or type errors on Prisma models).

2. **Linter Check**:
   ```powershell
   npm run lint
   ```
   Must pass with 0 warnings/errors.

3. **Next.js Production Build**:
   ```powershell
   npm run build
   ```
   Confirm `/projects` builds as a Server Component (marked with `λ` or `○` server/static symbol), and all client components compile without SSR boundary errors.

4. **SSR Fixture Title Verification**:
   Start production server:
   ```powershell
   npm run start
   ```
   Probe `/projects` raw HTML directly via PowerShell (simulating `run.py` without JS):
   ```powershell
   $html = (Invoke-WebRequest -Uri "http://localhost:8080/projects" -UseBasicParsing).Content
   $html -match "Glass Signal"
   $html -match "Small Meadow"
   $html -match "Deep Compass"
   ```
   All three assertions must return `True`.

5. **Automated Acceptance Suite**:
   ```powershell
   python Hack_docs/run.py .dogfood.toml
   ```
   Must report `T1  gallery is public .... PASS` and `T1  project from fixtures shown .... PASS` as part of the 7/7 PASS suite.
