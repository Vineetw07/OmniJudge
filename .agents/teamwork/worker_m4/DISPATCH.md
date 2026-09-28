## 2026-09-28T11:06:55Z
Your identity: Worker M4 (Judge Scoring Workspace Polish — Milestone 4 R4)
Working directory: d:\TP\Hackathon\DogFood\.agents\teamwork\worker_m4\
Project Root: d:\TP\Hackathon\DogFood

MANDATORY: Read d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md (specifically section ## 2026-09-28T10:45:46Z) before starting work. Do NOT summarize or filter it — pass the path as-is.
Also read C:\Users\ASUS\.gemini\frontend-rules.md for UI standards.
Also read the detailed Explorer blueprint in d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_survey_2\handoff.md (specifically Section 4.2).

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write Ownership (You own these files exclusively):
- src/app/judge/page.tsx
- src/app/judge/judge-portal-client.tsx

CRITICAL INVARIANTS (DO NOT BREAK):
1. Preserve the exact `POST /api/judge/scores` fetch call and payload schema `{ projectId, scores: [{ criterionId, value }], comment }`.
2. Do NOT install new npm packages. For sliders, use native HTML5 `<input type="range">` with custom Tailwind styles and quick-select buttons.
3. Preserve server-side auth checking and prop serialization in `page.tsx`.

Instructions:
1. In `src/app/judge/page.tsx`:
   - Polish the "Access Restricted" screen with obsidian glass styling (`bg-[#07090e]`, glass card, amber warning accent) matching the global theme.
   - Maintain the database queries, role verification, and clean JSON prop serialization for `JudgePortalClient`.
2. In `src/app/judge/judge-portal-client.tsx`:
   - Implement the 2-column ergonomic layout:
     - Left column (project queue, ~35% width, `lg:col-span-4`, `sticky top-20` with vertical scroll containment).
     - Right column (scoring console, ~65% width, `lg:col-span-8`).
     - On mobile screens: stack vertically cleanly.
   - Project queue sidebar:
     - Glass container with `backdrop-blur-md bg-white/[0.03] border border-white/[0.08] rounded-2xl`.
     - Search input + filter tabs (All, Pending, Scored).
     - High-contrast luminous status chips (`Scored` in cyan / `Pending` in slate).
     - Selected project item gets prominent cyan ring / glow.
   - Scoring console:
     - Glass card styled like a developer terminal workstation with a dark header bar (`bg-black/40 border-b border-white/[0.08]`), `⬢ SCORING CONSOLE` monospace title, project track pill, project ID, and external repo button.
     - Live composite score gauge: prominent display showing both raw composite (`4.37 / 5.00`) and scaled score (`87.4 / 100`) with a glowing gradient progress bar updating in real-time as sliders move.
     - Rubric criteria sliders: native HTML5 `<input type="range" min={0} max={crit.maxScore} step={0.5}>` with Tailwind `accent-cyan-400`, live numeric readout next to each slider label, and compact quick-step buttons (`0, 1, 2, 3, 4, 5`) below each slider.
     - Autosave / Save indicator: show dynamic save state indicator (`Unsaved changes` in amber / `Saving evaluation...` in cyan spinner / `✓ Saved to database` in emerald) fading in/out after POST succeeds.
     - Comment textarea with dark glass styling and electric cyan focus ring.
     - Submit button with luminous cyan styling.
3. Verification:
   - Run `npm run typecheck`
   - Run `npm run lint`
   - Ensure zero errors.
4. Atomic Git Commit (PowerShell 5.1 syntax):
   `git add src/app/judge/page.tsx src/app/judge/judge-portal-client.tsx ; git commit -m "[Phase5-R4] Judge two-column workstation, live composite score, autosave indicator"`
5. Write your report to `d:\TP\Hackathon\DogFood\.agents\teamwork\worker_m4\handoff.md` and send a completion message back.
