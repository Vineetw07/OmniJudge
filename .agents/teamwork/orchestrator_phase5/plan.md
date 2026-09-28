# Project: DOGFOOD 2026 Phase 5 UI Polish & Freeze Rehearsal

## Architecture
- Theme: Midnight Obsidian Glass
- Canvas: Deep obsidian background `#07090e` / `#0a0d14`
- Ambient Glow: Radial cyan/indigo bloom at top-center (`radial-gradient(ellipse 80% 50% at 50% -10%, rgba(56,189,248,0.12), transparent)`)
- Glass Surface Tokens:
  - `--glass-bg: rgba(255,255,255,0.04)`
  - `--glass-border: rgba(255,255,255,0.08)`
  - `--glass-border-accent: rgba(56,189,248,0.3)`
- Navigation: Global floating glass navbar extracted as client component (`src/components/Navbar.tsx`) with active link detection via `usePathname()`.
- Animations: Framer Motion page entrance (`src/components/PageTransition.tsx`).
- Project Gallery: SSR Server Component preserved (`src/app/projects/page.tsx`), Client Island (`src/app/projects/projects-client.tsx`) for instant search + track filtering.
- Login: Obsidian canvas, glass container, electric cyan focus ring, 2x2 luminous role chips.
- Judge Workspace: 2-column layout (~35% queue, ~65% console), terminal header `⬢ SCORING CONSOLE`, live dual composite score gauge, autosave indicator, native range sliders with zero new deps.
- Organizer Dashboard: 4 KPI stat cards, glass leaderboard with 🥇🥈🥉 medals, RFC 4180 CSV export button, judge progress table with luminous status badges, terminal-like audit log feed.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Global Obsidian Theme & Glass Tokens | Obsidian vars in :root/.dark, glass tokens | M1 | ORIGINAL_REQUEST R1 |
| 2 | Ambient Top Glow | Fixed radial gradient mesh behind viewport | M1 | ORIGINAL_REQUEST R1 |
| 3 | Floating Glass Navbar | Sticky glass navbar with logo, links, github SVG, signin | M1 | ORIGINAL_REQUEST R1 |
| 4 | Framer Motion Page Entrance | Client component motion.div with opacity/y entrance | M1 | ORIGINAL_REQUEST R1 |
| 5 | Public Gallery Hero Banner | Glowing pill badge + title/subtitle | M2 | ORIGINAL_REQUEST R2 |
| 6 | Gallery Search & Track Filter Strip | Client island with search and track buttons (All, Dev Tools, AI Agents, Infrastructure, Consumer) | M2 | ORIGINAL_REQUEST R2 |
| 7 | Glass Project Cards | Hover lift, track badge, repo button, SSR preserved | M2 | ORIGINAL_REQUEST R2 |
| 8 | Role-Aware Login Canvas & Glass Card | Obsidian canvas, glass card, electric cyan focus ring | M3 | ORIGINAL_REQUEST R3 |
| 9 | Luminous Role Selector Chips | 2x2 grid with role colors (amber, cyan, indigo, emerald) + active state | M3 | ORIGINAL_REQUEST R3 |
| 10 | Preserved Auth Flow & Hard Redirects | window.location.href role redirect preserved | M3 | ORIGINAL_REQUEST R3 |
| 11 | Judge 2-Column Ergonomic Layout | ~35% left queue with scroll, ~65% right console | M4 | ORIGINAL_REQUEST R4 |
| 12 | Judge Scoring Terminal Console | ⬢ SCORING CONSOLE header, project details | M4 | ORIGINAL_REQUEST R4 |
| 13 | Rubric Range Sliders & Live Gauge | Range sliders + live dual composite score gauge | M4 | ORIGINAL_REQUEST R4 |
| 14 | Autosave / Save Indicator | Dynamic dirty/saving/saved indicator | M4 | ORIGINAL_REQUEST R4 |
| 15 | Dashboard 4 KPI Stat Cards | Total Submissions, Active Judges, Eval Progress %, Remaining Reviews | M5 | ORIGINAL_REQUEST R5 |
| 16 | Glass Leaderboard Table | 🥇🥈🥉 medals, .toFixed(2) MAD scores, RFC 4180 CSV button | M5 | ORIGINAL_REQUEST R5 |
| 17 | Judge Progress Glass Table | Color-coded status badges (Completed, In Progress, Not Started) | M5 | ORIGINAL_REQUEST R5 |
| 18 | Terminal-Style Audit Trail Feed | Dark monospace log feed of last 15 events | M5 | ORIGINAL_REQUEST R5 |
| 19 | Freeze Rehearsal & E2E Verification | typecheck, lint, build, daemon 8080, run.py 7/7 PASS | M6 | ORIGINAL_REQUEST R6 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Global Design System (R1) | globals.css, layout.tsx, Navbar.tsx, PageTransition.tsx | Survey Complete | DONE (`4c5c5a2`) |
| 2 | Public Project Gallery (R2) | projects/page.tsx, projects-client.tsx | M1 | DONE (`cea4d2a`) |
| 3 | Role-Aware Login Polish (R3) | login/page.tsx | M1 | DONE (`c5258da`) |
| 4 | Judge Scoring Workspace (R4) | judge/page.tsx, judge-portal-client.tsx | M1 | DONE (`e3a1a06`) |
| 5 | Organizer Control Tower (R5) | dashboard/page.tsx, dashboard-client.tsx | M1 | DONE (`7519923`) |
| 6 | Freeze Rehearsal (R6) | typecheck, lint, build, daemon 8080, run.py 7/7 PASS, PROGRESS.md, final commit | M1-M5 | DONE (`2f52b8b`) |

## Code Layout & Write Boundaries
- **Milestone 1 Worker**:
  - `src/app/globals.css`
  - `src/app/layout.tsx`
  - `src/components/Navbar.tsx`
  - `src/components/PageTransition.tsx`
- **Milestone 2 Worker**:
  - `src/app/projects/page.tsx`
  - `src/app/projects/projects-client.tsx`
- **Milestone 3 Worker**:
  - `src/app/login/page.tsx`
- **Milestone 4 Worker**:
  - `src/app/judge/page.tsx`
  - `src/app/judge/judge-portal-client.tsx`
- **Milestone 5 Worker**:
  - `src/app/dashboard/page.tsx`
  - `src/app/dashboard/dashboard-client.tsx`
- **Milestone 6 Worker**:
  - `PROGRESS.md`
  - Verification execution & git commits
