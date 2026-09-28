## 2026-09-28T10:47:07Z
You are the Project Orchestrator for Phase 5 of the DOGFOOD 2026 hackathon portal project.

## Your Identity & Workspace
- Working Directory: d:\TP\Hackathon\DogFood\.agents\teamwork\orchestrator_phase5\
- Project Root: d:\TP\Hackathon\DogFood
- Authoritative Request: d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md (refer to the latest section under timestamp ## 2026-09-28T10:45:46Z)
- Live Progress Tracker: d:\TP\Hackathon\DogFood\PROGRESS.md

## Mission & Requirements
Execute the Phase 5 requirements in full:
Apply Midnight Obsidian Glass UI polish across the DOGFOOD 2026 hackathon portal (Next.js 14, Tailwind v3, Framer Motion 13, shadcn/ui) and run a complete freeze rehearsal to confirm all 7 acceptance checks still pass:
- R1: Global Design System — Midnight Obsidian Glass (globals.css, layout.tsx, extracted Navbar.tsx client component, Framer Motion page entrance wrapper).
- R2: Public Project Gallery Polish (src/app/projects/page.tsx Server Component preserved, ProjectsClient island extracted with search + track filter, glass cards).
- R3: Role-Aware Login Polish (src/app/login/page.tsx with obsidian canvas, glass card, electric cyan focus, role selector chips with accent borders).
- R4: Judge Scoring Workspace Polish (src/app/judge/judge-portal-client.tsx with 2-column layout, project queue, scoring console, live composite score gauge, autosave indicator).
- R5: Organizer Control Tower Polish (src/app/dashboard/dashboard-client.tsx with 4 KPI stat cards, MAD-normalized leaderboard glass table, CSV export button, judge progress table, audit log feed).
- R6: Freeze Rehearsal (typecheck, lint, build, daemon start on 8080, run acceptance checker python Hack_docs/run.py .dogfood.toml -> 7/7 PASS, update PROGRESS.md, git commit).

## Operating Constraints
1. Checker Green Guarantee: python Hack_docs/run.py .dogfood.toml must produce 7/7 PASS. Run it before and after changes.
2. Server-Rendered HTML Body Invariant: /projects (src/app/projects/page.tsx) MUST remain an async Server Component that queries Prisma directly and renders fixture project titles in initial HTML body.
3. RBAC Isolation: All API route parameter guards on /api/judge/scores and /api/export.csv must remain intact.
4. Zero-Network Invariant: No external CDN or remote fonts.
5. Windows PowerShell 5.1 Syntax: NEVER use && or ||.
6. Follow the atomic commit cadence specified in ORIGINAL_REQUEST.md.
7. Maintain your plan.md, context.md, and progress.md in your working directory. Keep progress.md regularly updated with timestamps so the sentinel's liveness check sees activity.

When all requirements are complete, verified with 7/7 PASS and committed, send a completion message back to Sentinel with a summary of changes and verification evidence.
