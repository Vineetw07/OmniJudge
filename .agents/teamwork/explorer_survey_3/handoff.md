# Handoff Report: Survey Explorer 3 (Organizer Control Tower & Freeze Rehearsal)

**Working Directory**: `d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_survey_3\`  
**Target Areas**: 
- **R5**: Organizer Control Tower Polish (`src/app/dashboard/page.tsx`, `src/app/dashboard/dashboard-client.tsx`, `/api/export.csv`)
- **R6**: Freeze Rehearsal & Baseline Quality (`package.json`, `.dogfood.toml`, `Hack_docs/run.py`, typecheck, lint, build)

---

## 1. Observation

### 1.1 R5 Organizer Control Tower Implementation

#### A. KPI Data & Computation (`src/app/dashboard/page.tsx`)
- Lines 54–79: Parallel Prisma queries fetch `projects` (40), `criteria` (4), `scores` (160), `judges` (30 with `judgeAssignments` and `scores`), and `auditLogs` (15 latest).
- Lines 255–261: Current KPI object definition:
  ```typescript
  const kpis = {
    totalProjects: projects.length,
    scoredProjects: scoredProjectIds.size,
    totalReviews: scores.length,
    totalJudges: judges.length,
    completedJudges: completedJudgesCount,
  };
  ```
- Lines 101–109 of `src/app/dashboard/dashboard-client.tsx`:
  - `scoringCoveragePercent` is calculated as `Math.round((kpis.scoredProjects / kpis.totalProjects) * 100)`.
  - `judgeCompletionRate` is calculated as `Math.round((kpis.completedJudges / kpis.totalJudges) * 100)`.
- Lines 173–234 of `src/app/dashboard/dashboard-client.tsx`:
  Current 4 stat cards render:
  1. "Total Projects": `{kpis.totalProjects}`, subtext "{kpis.scoredProjects} scored ({scoringCoveragePercent}% coverage)" with icon `<Layers />`.
  2. "Scored Projects": `{kpis.scoredProjects} / {kpis.totalProjects}` with a `<Progress />` bar and `<CheckCircle2 />`.
  3. "Total Evaluations": `{kpis.totalReviews}` with `<BarChart3 />`.
  4. "Judge Completion": `{kpis.completedJudges} / {kpis.totalJudges}` with `<Progress />` bar and `<Users />`.
- **Contrast with Spec Requirement (R5)**:
  Spec explicitly requests:
  > "4 KPI stat cards: Total Submissions, Active Judges, Evaluation Progress %, Remaining Reviews — each an illuminated glass card with a large number, label, and a colored lucide icon."

#### B. Leaderboard Calculation & Presentation
- Lines 81–183 of `src/app/dashboard/page.tsx`:
  - Weights applied to scores per criterion (`score.value * weight`).
  - Composite raw scores computed per judge per project (`weightedSum / weightTotal`).
  - `normaliseAllJudges(judgeRawMap)` is invoked, calling Modified Z-Score with MAD from `src/lib/normalization.ts`.
  - Normalized scores aggregated across judges (`avgNorm`), raw scores aggregated (`avgRaw`).
  - Sorted descending by `normalizedScore`, tiebroken by `rawScore`, then `id`.
  - Exactly identical calculation to `src/app/api/export.csv/route.ts` (lines 51–152).
- Lines 309–322 of `src/app/dashboard/dashboard-client.tsx`:
  - Rank rendered as a colored circle containing the numeric rank (`{item.rank}`):
    ```tsx
    <span className={`inline-flex items-center justify-center size-6 rounded-full font-bold text-[11px] ${
      item.rank === 1 ? 'bg-amber-500/20 text-amber-700...' : ...
    }`}>
      {item.rank}
    </span>
    ```
  - Line 346: Normalized score formatted as `{item.normalizedScore.toFixed(4)}`.
- **Contrast with Spec Requirement (R5)**:
  Spec explicitly requests:
  > "glass table with rank badge (🥇🥈🥉 for top 3, numeric thereafter), project title, track, MAD-normalized score formatted to 2 decimal places, and number of reviews."

#### C. CSV Export CTA Button
- Lines 162–169 of `src/app/dashboard/dashboard-client.tsx`:
  ```tsx
  <a href="/api/export.csv" download="dogfood_scores.csv">
    <Button className="flex items-center gap-2 shadow-sm font-semibold">
      <Download className="size-4" />
      <span>Export Results (CSV)</span>
    </Button>
  </a>
  ```
- **Contrast with Spec Requirement (R5)**:
  Spec explicitly requests:
  > "prominent '⬇ Export CSV (RFC 4180)' download button that links to `/api/export.csv` (anchor `download` attribute)."

#### D. Judge Progress Table
- Lines 380–446 of `src/app/dashboard/dashboard-client.tsx`:
  - Renders judge name, email, assigned tracks, progress bar with `scoredCount / assignedCount`.
  - Status badges use:
    - Completed: `<Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600 text-[10px]">Complete</Badge>`
    - In Progress: `<Badge variant="outline" className="text-amber-600 border-amber-300 dark:border-amber-700 text-[10px]">In Progress</Badge>`
    - Not Started: `<Badge variant="secondary" className="text-muted-foreground text-[10px]">Not Started</Badge>`
- **Contrast with Spec Requirement (R5)**:
  Spec explicitly requests:
  > "glass table showing each judge's name, assigned tracks, scored/total projects, and a color-coded status badge (Completed=green, In Progress=amber, Not Started=slate)."
  The current styling uses plain table background rather than Midnight Obsidian Glass styling (`bg-[var(--glass-bg)] border-[var(--glass-border)] backdrop-blur-md`).

#### E. Audit Trail Feed
- Lines 455–522 of `src/app/dashboard/dashboard-client.tsx`:
  - Currently structured as a standard HTML `<table>` with columns `Timestamp`, `Actor`, `Action`, `Payload Summary`.
- **Contrast with Spec Requirement (R5)**:
  Spec explicitly requests:
  > "chronological list of the last 15 audit entries with timestamp, action, user, and payload summary. Style as a terminal-like log feed."

---

### 1.2 R6 Freeze Rehearsal & Baseline Quality

#### A. Scripts in `package.json`
- Verified exact scripts in `package.json`:
  ```json
  "scripts": {
    "dev": "next dev -p 8080",
    "build": "next build",
    "start": "next start -p 8080",
    "seed": "npx tsx src/lib/seed.ts",
    "db:migrate": "npx prisma migrate dev",
    "db:push": "npx prisma db push",
    "typecheck": "tsc --noEmit",
    "lint": "next lint"
  }
  ```
  All required scripts are present and conformant.

#### B. Configuration in `.dogfood.toml`
- Verified `.dogfood.toml`:
  ```toml
  [portal]
  base_url = "http://localhost:8080"

  [tiers]
  claimed = ["T1", "T2"]
  pitch = "Self-hostable hackathon submission and judging platform with backend-enforced role isolation and MAD-based score normalisation."

  [auth]
  organizer   = "Cookie: session=org_seed_token_2026"
  judge_a     = "Cookie: session=jdg_a_seed_token_2026"
  judge_b     = "Cookie: session=jdg_b_seed_token_2026"
  participant = "Cookie: session=prt_seed_token_2026"

  [routes]
  gallery      = "/projects"
  submit       = "/api/projects"
  judge_scores = "/api/judge/scores"
  peer_scores  = "/api/judge/scores?judge=user_jdg_a_01"
  csv_export   = "/api/export.csv"
  ```

#### C. Static Analysis & Build Verification Commands
Direct execution commands executed during investigation:
1. `npm run typecheck`
   - Command: `tsc --noEmit`
   - Result: Exit Code 0, zero errors.
2. `npm run lint`
   - Command: `next lint`
   - Result: Exit Code 0, `✔ No ESLint warnings or errors`.
3. `npm run build`
   - Command: `next build`
   - Result: Exit Code 0, `✓ Compiled successfully`, all 9 routes generated (`○ Static` and `ƒ Dynamic`), standalone output confirmed.
4. Acceptance Checker (`python Hack_docs/run.py .dogfood.toml`):
   - Started server via `npm run start` (port 8080).
   - Executed: `python Hack_docs/run.py .dogfood.toml`.
   - Output:
     ```
     DOGFOOD 2026 acceptance report
     portal: http://localhost:8080
     claimed: T1 T2
     fixtures: D:\TP\Hackathon\DogFood\Hack_docs\fixtures.json

     T1  gallery is public ................. PASS
     T1  project from fixtures shown ....... PASS
     T1  closed event refuses submissions .. PASS
     T2  judge sees own scores ............. PASS
     T2  judge cannot see peer scores ...... PASS
     T2  participant blocked ............... PASS
     T2  csv export works .................. PASS

     claimed T1 T2, verified T1 T2
     ```
   - Stopped server daemon cleanly.

---

## 2. Logic Chain

1. **R5 Control Tower Alignment**:
   - *Observation*: The spec defines 4 specific KPI cards: "Total Submissions", "Active Judges", "Evaluation Progress %", and "Remaining Reviews".
   - *Reasoning*:
     - "Total Submissions" maps to `kpis.totalProjects` (40).
     - "Active Judges" can be derived from judges who have submitted evaluations or are assigned (`judges.filter(j => j.scores.length > 0).length` out of total judges).
     - "Evaluation Progress %" should represent completion progress of required reviews: `Math.round((completedReviews / totalAssignedReviews) * 100)` or percentage of projects scored.
     - "Remaining Reviews" represents pending reviews across all judge assignments: `Math.max(0, totalAssignedReviews - completedReviews)`.
     - Passing these four clean figures directly via `kpis` in `src/app/dashboard/page.tsx` and displaying them in `dashboard-client.tsx` satisfies the prompt without modifying database schema.
   - *Observation*: Leaderboard formatting requires `🥇🥈🥉 for top 3, numeric thereafter` and `.toFixed(2)` for MAD normalized score.
   - *Reasoning*:
     - In `dashboard-client.tsx`, line 346 currently outputs `.toFixed(4)`. Switching to `.toFixed(2)` guarantees adherence to the spec.
     - Replacing the numeric badges at lines 310–321 with emoji medals `🥇`, `🥈`, `🥉` for ranks 1, 2, and 3, and `#${item.rank}` for ranks ≥ 4 creates the exact visual hierarchy requested.
   - *Observation*: CSV button label requires `⬇ Export CSV (RFC 4180)` and links to `/api/export.csv` with `download`.
   - *Reasoning*:
     - Updating the button text and adding glowing glass styling delivers the prominent call-to-action requested.
   - *Observation*: Audit trail requires "terminal-like log feed" instead of standard HTML table.
   - *Reasoning*:
     - Converting the table into a terminal window container with top title bar (colored status dots `🔴 🟡 🟢`, `bash - audit.log`) and monospace log rows (`[TIMESTAMP] [ROLE:ACTOR] ACTION -> payload`) elevates adoption aesthetics and strictly satisfies R5.

2. **R6 Freeze Rehearsal Invariants & Guardrails**:
   - *Observation*: `Hack_docs/run.py` tests `GET /projects` for fixture titles in the initial HTML body without authentication.
   - *Reasoning*:
     - Any UI modifications to `src/app/projects/page.tsx` must keep the page an async Server Component where Prisma data is fetched and rendered server-side.
     - If client interactivity (filtering/search) is extracted to a client island `src/app/projects/projects-client.tsx`, the Server Component must still pass the full initial fixture data down so that SSR HTML contains the strings "Glass Signal", "Small Meadow", or "Deep Compass".
   - *Observation*: `Hack_docs/run.py` tests RBAC security directly against API endpoints (`/api/judge/scores?judge=user_jdg_a_01` and `/api/export.csv`).
   - *Reasoning*:
     - All API routes in `src/app/api/` must remain completely untouched during UI polishing.
   - *Observation*: Server must be running on port 8080 when running `Hack_docs/run.py`.
   - *Reasoning*:
     - The freeze rehearsal script should ensure `npm run build` succeeds, launch `npm run start` in daemon mode, run `python Hack_docs/run.py .dogfood.toml`, verify 7/7 PASS, and then kill the process.

---

## 3. Caveats

- **No Caveats Regarding Data Flow**: The existing calculation in `src/app/dashboard/page.tsx` and `src/app/api/export.csv/route.ts` is 100% mathematically aligned and verified.
- **Header Placement**: The current `dashboard-client.tsx` has its own sticky header (`<header className="...">`). When R1 implements the global floating glass navbar in `src/app/layout.tsx`, having duplicate navigation bars may look redundant. The dashboard header should be adjusted to be a dashboard sub-header / control bar rather than a duplicate top navbar.
- **Framer Motion SSR**: When adding entrance animations (`motion.div`) in client components, ensure `'use client'` is declared at the top of the file to prevent Server Component runtime exceptions.

---

## 4. Conclusion & Concrete Recommendations for Implementer

### R5 Implementation Checklist for `src/app/dashboard/`:

1. **In `src/app/dashboard/page.tsx`**:
   - Compute the exact 4 KPIs:
     ```typescript
     let totalAssignedReviews = 0;
     let completedReviews = 0;
     let activeJudgesCount = 0;

     for (const j of judges) {
       let assignedCount = 0;
       for (const tid of j.judgeAssignments.map((a) => a.trackId)) {
         assignedCount += trackProjectCountMap.get(tid) || 0;
       }
       const scoredProjectSet = new Set(j.scores.map((s) => s.projectId));
       const scoredCount = scoredProjectSet.size;
       totalAssignedReviews += assignedCount;
       completedReviews += scoredCount;
       if (scoredCount > 0) activeJudgesCount++;
     }

     const evaluationProgressPercent =
       totalAssignedReviews > 0
         ? Math.round((completedReviews / totalAssignedReviews) * 100)
         : 0;
     const remainingReviews = Math.max(0, totalAssignedReviews - completedReviews);

     const kpis = {
       totalSubmissions: projects.length,
       activeJudges: activeJudgesCount,
       totalJudges: judges.length,
       evaluationProgressPercent,
       remainingReviews,
       totalReviews: scores.length,
     };
     ```

2. **In `src/app/dashboard/dashboard-client.tsx`**:
   - Update `DashboardKPIs` interface:
     ```typescript
     export interface DashboardKPIs {
       totalSubmissions: number;
       activeJudges: number;
       totalJudges: number;
       evaluationProgressPercent: number;
       remainingReviews: number;
       totalReviews: number;
     }
     ```
   - **4 KPI Stat Cards** (Glass tokens + glowing icons):
     - Card 1: **Total Submissions** (`kpis.totalSubmissions`), subtext "Projects across all tracks", Icon: `Layers` (Cyan).
     - Card 2: **Active Judges** (`kpis.activeJudges` / `kpis.totalJudges`), subtext "Evaluating submissions", Icon: `Users` (Indigo).
     - Card 3: **Evaluation Progress** (`${kpis.evaluationProgressPercent}%`), subtext "Total completion rate", Icon: `TrendingUp` or `CheckCircle2` (Emerald).
     - Card 4: **Remaining Reviews** (`kpis.remainingReviews`), subtext "Pending judge reviews", Icon: `Clock` or `AlertCircle` (Amber).
   - **Glass Leaderboard**:
     - Glass card styling: `bg-[var(--glass-bg)] border-[var(--glass-border)] backdrop-blur-md rounded-2xl`.
     - Rank medals:
       ```tsx
       {item.rank === 1 ? (
         <span className="text-xl">🥇</span>
       ) : item.rank === 2 ? (
         <span className="text-xl">🥈</span>
       ) : item.rank === 3 ? (
         <span className="text-xl">🥉</span>
       ) : (
         <span className="font-mono text-xs text-muted-foreground font-semibold">#{item.rank}</span>
       )}
       ```
     - Score formatting: `{(item.normalizedScore > 0 ? '+' : '') + item.normalizedScore.toFixed(2)}`.
     - CSV export button:
       ```tsx
       <a href="/api/export.csv" download="dogfood_scores.csv">
         <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold gap-2 shadow-[0_0_20px_rgba(56,189,248,0.25)] border border-cyan-400/30">
           <Download className="size-4" />
           <span>⬇ Export CSV (RFC 4180)</span>
         </Button>
       </a>
       ```
   - **Judge Progress Table**:
     - Status badges:
       - Completed: `bg-emerald-500/15 text-emerald-400 border border-emerald-500/30`
       - In Progress: `bg-amber-500/15 text-amber-400 border border-amber-500/30`
       - Not Started: `bg-slate-500/15 text-slate-400 border border-slate-500/30`
   - **Terminal-Style Audit Log Feed**:
     - Container: `rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md overflow-hidden font-mono text-xs`
     - Window header: Red/Yellow/Green dots + title `dogfood-audit-daemon.log — stdout (last 15 events)`.
     - Stream lines with prompt `>`:
       ```tsx
       <div key={log.id} className="p-3 border-b border-white/5 hover:bg-white/[0.02] flex items-center justify-between gap-4">
         <div className="flex items-center gap-3">
           <span className="text-cyan-400/80">{new Date(log.createdAt).toLocaleTimeString()}</span>
           <span className="text-indigo-400 font-semibold">[{log.userRole.toUpperCase()}: {log.userName}]</span>
           <span className="text-emerald-400 font-bold">{log.action}</span>
           <span className="text-slate-300 font-sans text-xs">{log.payloadSummary}</span>
         </div>
         <span className="text-[10px] text-muted-foreground whitespace-nowrap">{new Date(log.createdAt).toLocaleDateString()}</span>
       </div>
       ```

---

## 5. Verification Method

To independently verify the implementation and complete R6 freeze rehearsal:

1. **Compilation and Static Verification**:
   ```powershell
   npm run typecheck
   npm run lint
   npm run build
   ```
   *Expected outcome*: Exit code 0 on all three commands; no TypeScript errors, no ESLint warnings, successful production Next.js build.

2. **Acceptance Test Suite Verification**:
   ```powershell
   # 1. Start production server daemon on port 8080
   npm run start
   
   # 2. Run official acceptance checker
   python Hack_docs\run.py .dogfood.toml
   ```
   *Expected outcome*: All 7 checks PASS (`claimed T1 T2, verified T1 T2`):
   - T1 gallery is public: PASS
   - T1 project from fixtures shown: PASS
   - T1 closed event refuses submissions: PASS
   - T2 judge sees own scores: PASS
   - T2 judge cannot see peer scores: PASS
   - T2 participant blocked: PASS
   - T2 csv export works: PASS

3. **CSV Export Header Verification**:
   ```powershell
   curl -s -H "Cookie: session=org_seed_token_2026" http://localhost:8080/api/export.csv | Select-Object -First 5
   ```
   *Expected outcome*: First line is `project_id,project_title,track,raw_score,normalized_score,rank`.

4. **Visual UI Inspection**:
   - Access `http://localhost:8080/dashboard` with cookie `session=org_seed_token_2026`.
   - Verify 4 KPI glass cards (Total Submissions, Active Judges, Evaluation Progress %, Remaining Reviews).
   - Verify 🥇🥈🥉 medals in top 3 leaderboard ranks and `.toFixed(2)` score formatting.
   - Verify "⬇ Export CSV (RFC 4180)" download button.
   - Verify terminal-style audit log feed.
