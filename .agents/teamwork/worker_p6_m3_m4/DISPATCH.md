## 2026-09-28T13:03:03Z

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

You are Worker 3 (UI & Community Interaction Specialist) for Phase 6 Milestones 3 & 4 (M3: Ballot Randomization & Voting UX, M4: Project Comments & Feedback Drawer) on OmniJudge hackathon portal.
Your working directory is: d:\TP\Hackathon\DogFood\.agents\teamwork\worker_p6_m3_m4
Project root: d:\TP\Hackathon\DogFood

Read:
- d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md (under ## 2026-09-28T12:29:24Z)
- d:\TP\Hackathon\DogFood\.agents\teamwork\orchestrator_phase6\SCOPE.md
- d:\TP\Hackathon\DogFood\src\app\projects\page.tsx
- d:\TP\Hackathon\DogFood\src\app\projects\projects-client.tsx
- Existing APIs: `src/app/api/community/vote/route.ts` and `src/app/api/community/comments/route.ts`

Exclusive Write Ownership:
- `src/app/projects/projects-client.tsx`
- `src/app/projects/page.tsx`
- `src/components/` (any new comment drawer component or modal)
- `PROGRESS.md`

Critical Invariant:
- `/projects` (`src/app/projects/page.tsx`) MUST remain an async Server Component querying Prisma and rendering fixture project titles ("Glass Signal", "Small Meadow", "Deep Compass") directly in the initial HTML body. DO NOT convert to client-only fetch!

Tasks:
1. Ballot Randomization & Ordering (R3):
   - In `ProjectsClient`, implement per-session display order randomization (Fisher-Yates shuffle with session-stable seed or sessionStorage) to eliminate presentation bias.
   - When the user first visits, randomize project cards order. If the user selects a sort order (e.g., "Default Randomized", "Track", "Title A-Z"), honor it.
2. Glass Voting Controls (R3):
   - Add upvote button on each project card:
     * When voted: luminous emerald glow (`border-emerald-500/50 bg-emerald-500/10 text-emerald-400`).
     * When not voted: subtle obsidian glass (`border-white/10 bg-white/[0.04] text-slate-300 hover:border-emerald-500/30 hover:text-emerald-300`).
   - Wire optimistic UI updates: clicking toggles local state, sends `POST /api/community/vote`, rolls back and displays message on error (e.g. self-vote error "Team members cannot vote for their own submission").
   - Display Results Hidden Shield Badge:
     `🔒 Results sealed until voting window closes`
     If `resultsPublic` is true or user is organizer/admin, show total vote count instead.
3. Project Feedback & Comments Drawer (R4):
   - Add an interactive comment button / link on each card displaying comment count (or speech bubble icon).
   - Clicking opens a collapsible comment drawer (or modal dialog) styled in Midnight Obsidian (`bg-[#0a0d14]/95 border-white/[0.08] backdrop-blur-xl`).
   - Fetch comments via `GET /api/community/comments?projectId=<id>` and allow posting via `POST /api/community/comments`.
   - Post comment form: text area, character counter (max 500 chars), submit button, optimistic append.
   - Display author role badge (`Participant` in emerald/cyan, `Judge` in amber/indigo, `Visitor` in slate, `Organizer` in purple) and relative timestamp (`just now`, `X min ago`).
   - Handle rate limiting gracefully (display toast/error if 429 returned).
4. Triad & Acceptance Verification:
   - Run `npm run typecheck` (must be 0 errors).
   - Run `npm run lint` (must be 0 errors).
   - Run `npm run build` (successful production build).
   - Run `python Hack_docs/run.py .dogfood.toml` (must be 7/7 PASS green baseline).
   - Verify SSR HTML check: curl/urllib `http://localhost:8080/projects` contains fixture titles in initial response.
5. Checkpoint & Git Commit:
   - Update `PROGRESS.md`: mark M3 and M4 completed, ready for M5.
   - Commit: `git add src/app/projects src/components PROGRESS.md; git commit -m "[Phase 6] M3+M4: ballot randomization, emerald voting controls, sealed badge, and obsidian comment drawer"`.
6. Write handoff report in `d:\TP\Hackathon\DogFood\.agents\teamwork\worker_p6_m3_m4\handoff.md` and send message back to parent orchestrator.
