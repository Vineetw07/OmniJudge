## 2026-09-28T10:57:25Z
Your identity: Worker M2 (Public Project Gallery Polish — Milestone 2 R2)
Working directory: d:\TP\Hackathon\DogFood\.agents\teamwork\worker_m2\
Project Root: d:\TP\Hackathon\DogFood

MANDATORY: Read d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md (specifically section ## 2026-09-28T10:45:46Z) before starting work. Do NOT summarize or filter it — pass the path as-is.
Also read C:\Users\ASUS\.gemini\frontend-rules.md for UI standards.
Also read the detailed blueprint in d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_survey_1\handoff.md (specifically Section 3.5 and 3.6).

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write Ownership (You own these files exclusively):
- src/app/projects/page.tsx
- src/app/projects/projects-client.tsx

CRITICAL INVARIANT (DO NOT BREAK):
`src/app/projects/page.tsx` MUST remain an async Server Component that queries Prisma directly:
`const projects = await prisma.project.findMany({ take: 40, orderBy: { id: 'asc' }, include: { team: true, track: true } });`
Do NOT convert this page into a client-only fetch! The initial HTML body must render the fixture project titles ("Glass Signal", "Small Meadow", "Deep Compass") during SSR so that the automated acceptance checker (`python Hack_docs/run.py .dogfood.toml`) passes.

Instructions:
1. Update `src/app/projects/page.tsx`:
   - Keep as async Server Component.
   - Remove the old redundant local header (now provided globally by layout Navbar).
   - Render Hero banner with glowing pill badge (`✦ DOGFOOD 2026 PORTAL`), title "Project Gallery", and description.
   - Render `<ProjectsClient initialProjects={projects} />`.
2. Create `src/app/projects/projects-client.tsx`:
   - 'use client' directive.
   - Search input with dark glass styling, magnifying glass icon, clear button.
   - Track filter strip with buttons: `All`, `Dev Tools`, `AI Agents`, `Infrastructure`, `Consumer`.
   - Implement intelligent track matching helper function to map the 5 buttons to the 8 fixture tracks.
   - Counter showing "Showing X of Y projects".
   - Empty state when search/filter has 0 results with reset button.
   - Grid of glass project cards:
     - Classes: `bg-[var(--glass-bg)] border border-[var(--glass-border)] backdrop-blur-md rounded-2xl p-6 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(56,189,248,0.12)] hover:border-cyan-500/30 group`
     - Track badge with category-specific colors.
     - Project ID badge in monospace.
     - Project title with hover color transition.
     - Team name with Users icon.
     - Summary with line-clamp-3.
     - Source Repository button with ExternalLink icon.
     - Submitted date and status badge (Submitted / Draft).
3. Verification:
   - Run `npm run typecheck`
   - Run `npm run lint`
   - Ensure zero errors.
4. Atomic Git Commit (PowerShell 5.1 syntax):
   `git add src/app/projects/page.tsx src/app/projects/projects-client.tsx ; git commit -m "[Phase5-R2] Glass project gallery, ProjectsClient island, search + track filter"`
5. Write your report to `d:\TP\Hackathon\DogFood\.agents\teamwork\worker_m2\handoff.md` and send a completion message back.
