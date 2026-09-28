## 2026-09-28T11:12:05Z

Your identity: Worker M5 (Organizer Control Tower Polish — Milestone 5 R5)
Working directory: d:\TP\Hackathon\DogFood\.agents\teamwork\worker_m5\
Project Root: d:\TP\Hackathon\DogFood

MANDATORY: Read d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md (specifically section ## 2026-09-28T10:45:46Z) before starting work. Do NOT summarize or filter it — pass the path as-is.
Also read C:\Users\ASUS\.gemini\frontend-rules.md for UI standards.
Also read the detailed Explorer blueprint in d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_survey_3\handoff.md (specifically Section 4).

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write Ownership (You own these files exclusively):
- src/app/dashboard/page.tsx
- src/app/dashboard/dashboard-client.tsx

CRITICAL INVARIANTS (DO NOT BREAK):
1. Preserve organizer/admin session guard in `page.tsx`.
2. Preserve exact MAD normalization math (`normaliseAllJudges`).
3. Ensure `/api/export.csv` API route is untouched.
4. No external CDNs or remote fonts.

Instructions:
1. In `src/app/dashboard/page.tsx`:
   - Compute the exact 4 KPIs matching the spec:
     - `totalSubmissions`: `projects.length`
     - `activeJudges`: count of judges with scores submitted
     - `evaluationProgressPercent`: percentage of completed reviews over total assigned reviews
     - `remainingReviews`: total assigned reviews minus completed reviews
   - Pass these clean fields in `kpis` to `DashboardClient`.
   - Polish any "Access Restricted" screen with obsidian glass styling if needed.
2. In `src/app/dashboard/dashboard-client.tsx`:
   - Adjust the header bar so it functions as a dashboard title/control bar (remove duplicate global navigation links since `Navbar.tsx` is now in `layout.tsx`).
   - 4 KPI stat cards (illuminated glass cards with large numbers, labels, colored Lucide icons):
     - Total Submissions (`kpis.totalSubmissions`), subtext "Projects across all tracks", Icon: `Layers` (Cyan).
     - Active Judges (`kpis.activeJudges` / `kpis.totalJudges`), subtext "Evaluating submissions", Icon: `Users` (Indigo).
     - Evaluation Progress (`${kpis.evaluationProgressPercent}%`), subtext "Total completion rate", Icon: `TrendingUp` or `CheckCircle2` (Emerald).
     - Remaining Reviews (`kpis.remainingReviews`), subtext "Pending judge reviews", Icon: `Clock` or `AlertCircle` (Amber).
   - MAD-Normalized Leaderboard:
     - Glass card styling (`bg-[var(--glass-bg)] border-[var(--glass-border)] backdrop-blur-md rounded-2xl`).
     - Rank medals: 🥇 for rank 1, 🥈 for rank 2, 🥉 for rank 3, and `#${item.rank}` for numeric rank thereafter.
     - MAD normalized score formatted to 2 decimal places: `item.normalizedScore.toFixed(2)`.
     - Prominent "⬇ Export CSV (RFC 4180)" download button linking to `/api/export.csv` with `download="dogfood_scores.csv"` attribute:
       `<a href="/api/export.csv" download="dogfood_scores.csv"><Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold gap-2 shadow-[0_0_20px_rgba(56,189,248,0.25)] border border-cyan-400/30"><Download className="size-4" /><span>⬇ Export CSV (RFC 4180)</span></Button></a>`
   - Judge Progress table:
     - Glass table showing each judge's name, assigned tracks, scored/total projects.
     - Color-coded status badges: Completed=green (`bg-emerald-500/15 text-emerald-400 border border-emerald-500/30`), In Progress=amber (`bg-amber-500/15 text-amber-400 border border-amber-500/30`), Not Started=slate (`bg-slate-500/15 text-slate-400 border border-slate-500/30`).
   - Audit Trail feed:
     - Chronological list of the last 15 audit entries with timestamp, action, user, and payload summary.
     - Styled as a dark terminal-like log feed container:
       `rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md overflow-hidden font-mono text-xs`
       with window top title bar (colored window dots `🔴 🟡 🟢`, `bash - audit.log`) and monospace log rows.
3. Verification:
   - Run `npm run typecheck`
   - Run `npm run lint`
   - Run `npm run build`
   - Ensure zero errors.
4. Atomic Git Commit (PowerShell 5.1 syntax):
   `git add src/app/dashboard/page.tsx src/app/dashboard/dashboard-client.tsx ; git commit -m "[Phase5-R5] Organizer control tower KPIs, glass leaderboard, audit trail"`
5. Write your report to `d:\TP\Hackathon\DogFood\.agents\teamwork\worker_m5\handoff.md` and send a completion message back.
