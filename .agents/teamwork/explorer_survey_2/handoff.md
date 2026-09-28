# Handoff Report: Survey of Role-Aware Login & Judge Scoring Workspace (R3 & R4)

**Agent Identity:** Survey Explorer 2 (`explorer_survey_2`)  
**Working Directory:** `d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_survey_2\`  
**Target Focus Areas:**
- **R3:** Role-Aware Login Polish (`src/app/login/page.tsx`)
- **R4:** Judge Scoring Workspace Polish (`src/app/judge/page.tsx` & `src/app/judge/judge-portal-client.tsx`)

---

## 1. Observation

### 1.1 R3: Role-Aware Login Current Implementation (`src/app/login/page.tsx`)

1. **Client Boundary & Dependencies:**
   - `src/app/login/page.tsx:1`: Explicit `'use client';` directive.
   - Imports shadcn primitives (`Card`, `Input`, `Label`, `Button`, `Badge`) and Lucide icons (`ArrowLeft`, `KeyRound`, `AlertCircle`).

2. **Test Accounts Array (`src/app/login/page.tsx:12-17`):**
   ```typescript
   const TEST_ACCOUNTS = [
     { role: 'Organizer', email: 'organizer@dogfood.dev', desc: 'Admin & export controls' },
     { role: 'Judge A', email: 'judge_a@dogfood.dev', desc: 'Scoring & peer evaluations' },
     { role: 'Judge B', email: 'judge_b@dogfood.dev', desc: 'Peer isolation evaluation' },
     { role: 'Participant', email: 'participant@dogfood.dev', desc: 'Project submissions' },
   ];
   ```
   *Note:* The roles currently display `Judge A` and `Judge B`. In `src/lib/seed.ts:21,28`, they are seeded as `Judge Alpha` (`judge_a@dogfood.dev`) and `Judge Beta` (`judge_b@dogfood.dev`).

3. **Auth State & Form Handling (`src/app/login/page.tsx:20-65`):**
   - State variables:
     ```typescript
     const [email, setEmail] = React.useState('');
     const [loading, setLoading] = React.useState(false);
     const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
     ```
   - `handleSubmit` submits a POST request to `/api/auth/login`:
     ```typescript
     const res = await fetch('/api/auth/login', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ email: email.trim() }),
     });
     ```
   - On response failure (`!res.ok`), extracts `data.error || 'Authentication failed'` into `errorMessage`.
   - On response success, uses hard window navigation (`window.location.href`) to ensure cookies reload in Server Components:
     ```typescript
     const role = data.user?.role?.toLowerCase();
     if (role === 'judge') {
       window.location.href = '/judge';
     } else if (role === 'organizer' || role === 'admin') {
       window.location.href = '/dashboard';
     } else {
       window.location.href = '/projects';
     }
     ```

4. **DOM Layout & Styling (`src/app/login/page.tsx:68-150`):**
   - Wrapper: `min-h-screen flex flex-col justify-center items-center bg-muted/20 px-4 py-12` (plain neutral/light surface, lacking the Midnight Obsidian aesthetic).
   - Container: Standard opaque `<Card className="border shadow-sm bg-card">`.
   - Input: Default `<Input id="email" ... />` without cyan glow focus states.
   - Quick-select buttons: Plain `border bg-background hover:bg-muted/60` buttons lacking role-specific luminous border accents and active glow indicators.

---

### 1.2 R4: Judge Scoring Workspace Current Implementation (`src/app/judge/page.tsx` & `src/app/judge/judge-portal-client.tsx`)

1. **Server Component & Access Control (`src/app/judge/page.tsx:18-54`):**
   - Session lookup: `const session = await getServerSession();`
   - Unauthenticated check: `if (!session) redirect('/login');`
   - Role guard: If `session.role !== 'judge' && session.role !== 'organizer' && session.role !== 'admin'`, renders "Access Restricted" card.

2. **Server-to-Client Prop Passing (`src/app/judge/page.tsx:56-141`):**
   - `assignedTracks`: Queried from `prisma.judgeAssignment` for `userId: session.id`.
   - `projects`: Queried from `prisma.project` filtered by assigned track IDs for judges, or all tracks for organizers.
   - `criteria`: Queried from `prisma.rubricCriterion`, ordered by `weight: 'desc'`.
   - `initialScores`: Queried from `prisma.score` where `judgeId: session.id`.
   - All models are cleanly mapped to plain serializable JSON objects (string IDs, numbers, ISO dates):
     ```typescript
     <JudgePortalClient
       user={{ id: session.id, name: session.name, email: session.email, role: session.role }}
       assignedTracks={assignedTracks}
       projects={serializableProjects}
       criteria={serializableCriteria}
       initialScores={serializableScores}
     />
     ```

3. **Client Component State & Logic (`src/app/judge/judge-portal-client.tsx:77-130`):**
   - `scoresMap`: `Map<string, Map<string, number>>` (maps `projectId` → `criterionId` → `score`).
   - `commentsMap`: `Map<string, string>` (maps `projectId` → `comment`).
   - `selectedProjectId`: string tracking currently selected project (defaults to first project `projects[0].id`).
   - `currentScores`: `{ [criterionId: string]: number }` synced via `useEffect` whenever `selectedProjectId` changes (defaults to previously submitted score or 3).
   - `currentComment`: synced via `useEffect` to previously submitted comment or `''`.

4. **Composite Score Calculation (`src/app/judge/judge-portal-client.tsx:134-147`):**
   ```typescript
   const compositeScore = React.useMemo(() => {
     let weightedSum = 0;
     let totalWeight = 0;
     for (const crit of criteria) {
       const val = currentScores[crit.id];
       if (typeof val === 'number') {
         weightedSum += val * crit.weight;
         totalWeight += crit.weight;
       }
     }
     return totalWeight > 0 ? (weightedSum / totalWeight).toFixed(2) : '0.00';
   }, [currentScores, criteria]);
   ```
   *Note:* The current formula yields a 0.00–5.00 score. The spec asks for a large display (e.g., `87.4 / 100` or raw composite with percentage).

5. **Submission Handler & API Boundary (`src/app/judge/judge-portal-client.tsx:164-222`):**
   - Submits payload to `POST /api/judge/scores`:
     ```typescript
     const payloadScores = criteria.map((crit) => ({
       criterionId: crit.id,
       value: currentScores[crit.id] ?? 0,
     }));
     const res = await fetch('/api/judge/scores', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         projectId: selectedProject.id,
         scores: payloadScores,
         comment: currentComment.trim(),
       }),
     });
     ```
   - On success: updates `scoresMap` and `commentsMap`, displays success alert, and toggles project status in the queue from "Pending" to "Scored".

6. **Layout Architecture (`src/app/judge/judge-portal-client.tsx:309-550`):**
   - Grid layout: `grid grid-cols-1 lg:grid-cols-12 gap-6 items-start`.
   - Left column: `lg:col-span-5` (41.7% width).
   - Right column: `lg:col-span-7` (58.3% width).
   - Rubric criteria input: Discrete buttons for numbers `0, 1, 2, 3, 4, 5` rather than interactive sliders.

---

## 2. Logic Chain

### 2.1 Logic Chain for R3: Role-Aware Login Polish

1. **Preserving Functional Invariants:**
   - *Observation:* `handleSubmit` performs vital session persistence via `/api/auth/login` and hard navigation (`window.location.href`) depending on user role.
   - *Deduction:* Any visual refactoring must preserve the exact `handleSubmit` function, input bindings (`value={email}`, `onChange`), and redirection branching. No client-side React router navigation (`router.push`) should replace `window.location.href` because Server Components require a clean browser request to receive fresh cookie state.

2. **Obsidian Canvas & Radial Mesh:**
   - *Observation:* The current wrapper `bg-muted/20` clashes with the Midnight Obsidian Glass theme (`#07090e`).
   - *Deduction:* Replacing the wrapper with `bg-[#07090e] text-slate-100 min-h-screen relative overflow-hidden` and inserting an ambient radial mesh bloom (`radial-gradient(ellipse 80% 50% at 50% -10%, rgba(56,189,248,0.12), transparent)`) establishes the required high-end dark glass foundation without breaking layout or scrolling.

3. **Glass Container & Focus States:**
   - *Observation:* The standard `<Card>` is opaque and lacks depth.
   - *Deduction:* Applying `backdrop-blur-md bg-white/[0.03] border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)] rounded-2xl` satisfies the glass container requirement.
   - *Observation:* The email `<Input>` needs electric cyan focus rings.
   - *Deduction:* Applying `focus-visible:ring-2 focus-visible:ring-cyan-500/40 focus-visible:border-cyan-500/50 bg-white/[0.03] border-white/[0.1]` ensures immediate visual feedback while complying with Section 14 of `frontend-rules.md`.

4. **Role Selector Chips with Luminous Borders:**
   - *Observation:* Quick-select chips currently use identical, non-distinct styling.
   - *Deduction:* Map each role to its specific accent palette:
     - **Organizer:** Amber (`border-amber-500/30 hover:border-amber-500/60`, active `border-amber-500 bg-amber-500/10 shadow-[0_0_16px_rgba(245,158,11,0.25)] text-amber-400 ring-1 ring-amber-500/40`)
     - **Judge Alpha:** Cyan (`border-cyan-500/30 hover:border-cyan-500/60`, active `border-cyan-500 bg-cyan-500/10 shadow-[0_0_16px_rgba(6,182,212,0.25)] text-cyan-400 ring-1 ring-cyan-500/40`)
     - **Judge Beta:** Indigo (`border-indigo-500/30 hover:border-indigo-500/60`, active `border-indigo-500 bg-indigo-500/10 shadow-[0_0_16px_rgba(99,102,241,0.25)] text-indigo-400 ring-1 ring-indigo-500/40`)
     - **Participant:** Emerald (`border-emerald-500/30 hover:border-emerald-500/60`, active `border-emerald-500 bg-emerald-500/10 shadow-[0_0_16px_rgba(16,185,129,0.25)] text-emerald-400 ring-1 ring-emerald-500/40`)
   - Add `data-selected={email.trim().toLowerCase() === acc.email.toLowerCase()}` to dynamically display the active glow when the account is chosen or typed.

---

### 2.2 Logic Chain for R4: Judge Scoring Workspace Polish

1. **Ergonomic 2-Column Ratio Adjustment:**
   - *Observation:* The current column split is `lg:col-span-5` (41.7%) and `lg:col-span-7` (58.3%). The spec requests ~35% for project queue and ~65% for scoring console.
   - *Deduction:* In a 12-column grid, `lg:col-span-4` (33.3%) and `lg:col-span-8` (66.7%) achieves the ~35%/~65% split. Adding `sticky top-20` and `max-h-[calc(100vh-220px)] overflow-y-auto` to the left sidebar allows judges to scroll through all 40 projects without losing sight of the console.

2. **Project Queue Sidebar Polish:**
   - *Observation:* In a 40-project hackathon, navigating unorganized cards can cause fatigue.
   - *Deduction:* Add a search input and status tabs (`All`, `Pending`, `Scored`) at the top of the queue sidebar.
   - *Observation:* Status chips currently use basic badge styles.
   - *Deduction:* Enhance with high-contrast luminous chips:
     - `Scored`: Cyan badge (`bg-cyan-500/10 text-cyan-400 border border-cyan-500/30`)
     - `Pending`: Slate badge (`bg-slate-800 text-slate-400 border border-slate-700`)
     - Selected item highlight: `bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/40`.

3. **Scoring Console Workstation & Live Score Gauge:**
   - *Observation:* The scoring console currently renders standard card headers.
   - *Deduction:* Restructure as a developer terminal workstation with a dark header bar (`bg-black/40 border-b border-white/[0.08]`), `⬢ SCORING CONSOLE` monospace title, status indicator, track pill, project ID badge, and external repo button.
   - *Observation:* Live composite score is currently rendered as `compositeScore / 5.00`.
   - *Deduction:* Calculate and render a dual-readout score gauge:
     - Raw weighted average: `compositeScore / 5.00`
     - Scaled percentage gauge: `(Number(compositeScore) / 5 * 100).toFixed(1) / 100` (e.g. `87.4 / 100`) with an animated glowing gradient bar (`from-cyan-500 to-indigo-500`).

4. **Rubric Criteria Sliders:**
   - *Observation:* Criteria currently use button arrays (`0..5`). `src/components/ui/slider.tsx` is not installed, and `@radix-ui/react-slider` is not in `package.json`. No new npm packages can be installed.
   - *Deduction:* Use native HTML5 range sliders (`<input type="range" min={0} max={crit.maxScore} step={0.5} value={val} ... />`) enhanced with custom Tailwind classes (`accent-cyan-400 bg-slate-800 h-2 rounded-lg cursor-pointer focus:ring-2 focus:ring-cyan-500/40`). Retain compact quick-pick buttons (`0, 1, 2, 3, 4, 5`) below the slider for maximum input velocity.

5. **Autosave / Save Indicator & API Integrity:**
   - *Observation:* Judges need confidence that their evaluations are persisted.
   - *Deduction:* Add a dirty-state detector comparing `currentScores` and `currentComment` against `scoresMap` and `commentsMap`:
     - If dirty: `● Unsaved changes` (amber warning)
     - If saving: `Saving evaluation...` (cyan spinner)
     - If clean: `✓ Saved to database` (emerald confirmation)
   - *Observation:* The backend expects an exact payload schema validated by `SubmitScoresSchema`.
   - *Deduction:* The `POST /api/judge/scores` call must strictly maintain its JSON structure:
     `{ projectId: string, scores: [{ criterionId: string, value: number }], comment: string }`.

---

## 3. Caveats

1. **Slider Dependency Invariant:**
   - *No new dependencies:* Radix UI slider is not installed in `package.json`. The implementer must NOT run `npm install @radix-ui/react-slider`. The native `<input type="range">` with Tailwind accent and glass styling provides 100% offline, zero-dependency compatibility and meets all spec requirements.

2. **Hard Navigation Requirement:**
   - *No Next.js `router.push`:* In `src/app/login/page.tsx`, `window.location.href` must be retained. Client-side Next.js route transitions can fail to re-trigger Server Component auth guards immediately because server session cookies are read at request inception.

3. **Offline Environment:**
   - *No Google Fonts or CDNs:* All fonts (`GeistSans`, `GeistMono`) are bundled locally. All icons must come from `lucide-react`.

---

## 4. Conclusion & Recommended Action Plan

### 4.1 R3: Action Plan for `src/app/login/page.tsx`
1. Update `TEST_ACCOUNTS` roles to `Organizer`, `Judge Alpha`, `Judge Beta`, `Participant`.
2. Wrap page in obsidian canvas (`bg-[#07090e]`) with radial ambient mesh.
3. Replace Card container with glass wrapper (`backdrop-blur-md bg-white/[0.03] border-white/[0.08] rounded-2xl`).
4. Apply electric cyan focus ring to email input (`focus-visible:ring-cyan-500/40 focus-visible:border-cyan-500/50`).
5. Redesign test account chips into luminous 2x2 grid with `data-selected` and role-specific colors (amber, cyan, indigo, emerald).
6. Preserve `handleSubmit`, POST call, error banner, and `window.location.href` redirects.

### 4.2 R4: Action Plan for `src/app/judge/`
1. In `src/app/judge/page.tsx`, polish the "Access Restricted" screen with obsidian glass styling while maintaining the existing server query and prop serialization.
2. In `src/app/judge/judge-portal-client.tsx`, update grid to ~35% (`lg:col-span-4`) left queue and ~65% (`lg:col-span-8`) right console, stacking vertically on mobile.
3. Implement glass sidebar for project queue with search/filter tabs, `sticky top-20`, scroll containment, and cyan/slate status chips.
4. Redesign scoring console with terminal header `⬢ SCORING CONSOLE`, track badge, project summary, and live dual-readout composite score gauge (`87.4 / 100` and `4.37 / 5.00`).
5. Replace discrete buttons with interactive range sliders (`<input type="range">`) with live numeric score readouts and quick-step buttons.
6. Add real-time save state indicator (`Unsaved changes` / `Saving...` / `Saved to database`).
7. Keep POST `/api/judge/scores` payload and server RBAC validation completely intact.

---

## 5. Verification Method

To independently verify the implementation after applying changes:

1. **Static Analysis & Type Checking:**
   ```powershell
   npm run typecheck
   npm run lint
   ```
   *Expected result:* 0 errors, 0 warnings.

2. **Automated Acceptance Suite:**
   ```powershell
   # Ensure server is running on port 8080:
   npm run build; npm run start
   # Run acceptance checker:
   python Hack_docs/run.py .dogfood.toml
   ```
   *Expected result:* All 7 checks PASS (T1 + T2):
   - `T1 gallery is public .... PASS`
   - `T1 project from fixtures shown .... PASS`
   - `T1 closed event refuses submissions .... PASS`
   - `T2 judge sees own scores .... PASS`
   - `T2 judge cannot see peer scores .... PASS`
   - `T2 participant blocked .... PASS`
   - `T2 csv export works .... PASS`

3. **Phase 3 Adversarial Security Suite:**
   ```powershell
   python tests/test_phase3_adversarial.py
   ```
   *Expected result:* All 47 probes pass, verifying RBAC isolation and POST score integrity.

4. **Visual Inspection:**
   - Navigate to `http://localhost:8080/login`: Verify obsidian canvas, ambient glow, glass card, electric cyan focus ring, and luminous role selector chips.
   - Click "Judge Alpha" chip: Verify active cyan glow and that email field updates to `judge_a@dogfood.dev`.
   - Click "Sign In": Verify redirect to `http://localhost:8080/judge`.
   - On `/judge`: Verify 2-column layout (~35% queue, ~65% console), terminal header `⬢ SCORING CONSOLE`, live score gauge recalculating on slider move, and save indicator updating on submit.
