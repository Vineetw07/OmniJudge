## 2026-09-28T11:02:12Z

Your identity: Worker M3 (Role-Aware Login Polish — Milestone 3 R3)
Working directory: d:\TP\Hackathon\DogFood\.agents\teamwork\worker_m3\
Project Root: d:\TP\Hackathon\DogFood

MANDATORY: Read d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md (specifically section ## 2026-09-28T10:45:46Z) before starting work. Do NOT summarize or filter it — pass the path as-is.
Also read C:\Users\ASUS\.gemini\frontend-rules.md for UI standards.
Also read the detailed Explorer blueprint in d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_survey_2\handoff.md (specifically Section 4.1).

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write Ownership (You own this file exclusively):
- src/app/login/page.tsx

CRITICAL INVARIANTS (DO NOT BREAK):
1. Preserve `handleSubmit`, POST to `/api/auth/login`, and error handling exactly.
2. Preserve `window.location.href` role-based redirects (`judge` -> `/judge`, `organizer`/`admin` -> `/dashboard`, else -> `/projects`). DO NOT replace with `router.push` because Server Components need a clean browser reload to receive cookie state!
3. Do NOT import external CDNs or remote fonts.

Instructions:
1. Update `src/app/login/page.tsx`:
   - Keep `'use client'`.
   - Update `TEST_ACCOUNTS` roles to:
     - `Organizer` (`organizer@dogfood.dev`, desc: 'Admin & export controls')
     - `Judge Alpha` (`judge_a@dogfood.dev`, desc: 'Scoring & evaluations')
     - `Judge Beta` (`judge_b@dogfood.dev`, desc: 'Peer isolation evaluation')
     - `Participant` (`participant@dogfood.dev`, desc: 'Project submissions')
   - Wrap the page in an obsidian canvas (`bg-[#07090e] min-h-screen text-slate-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden`).
   - Add ambient cyan/indigo bloom radial gradient `<div aria-hidden>` behind the card.
   - Wrap the login container in a glass card: `backdrop-blur-md bg-white/[0.03] border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)] rounded-2xl p-6 sm:p-8 max-w-md w-full`.
   - Apply electric cyan focus ring styling to the email input:
     `focus-visible:ring-2 focus-visible:ring-cyan-500/40 focus-visible:border-cyan-500/50 bg-white/[0.03] border-white/[0.1] text-white placeholder:text-slate-500`
   - Redesign the test account quick-select grid (2x2 grid):
     - Each chip gets a role-specific luminous accent border and active glow when selected (`email.trim().toLowerCase() === acc.email.toLowerCase()`):
       - Organizer: amber (`border-amber-500/30 hover:border-amber-500/60`, active `border-amber-500 bg-amber-500/10 shadow-[0_0_16px_rgba(245,158,11,0.25)] text-amber-400 ring-1 ring-amber-500/40`)
       - Judge Alpha: cyan (`border-cyan-500/30 hover:border-cyan-500/60`, active `border-cyan-500 bg-cyan-500/10 shadow-[0_0_16px_rgba(6,182,212,0.25)] text-cyan-400 ring-1 ring-cyan-500/40`)
       - Judge Beta: indigo (`border-indigo-500/30 hover:border-indigo-500/60`, active `border-indigo-500 bg-indigo-500/10 shadow-[0_0_16px_rgba(99,102,241,0.25)] text-indigo-400 ring-1 ring-indigo-500/40`)
       - Participant: emerald (`border-emerald-500/30 hover:border-emerald-500/60`, active `border-emerald-500 bg-emerald-500/10 shadow-[0_0_16px_rgba(16,185,129,0.25)] text-emerald-400 ring-1 ring-emerald-500/40`)
     - Include `data-selected` attribute on each chip.
   - Add back-to-gallery button at the top of the card or card header.
   - Maintain sign-in button with luminous cyan styling (`bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold shadow-[0_0_20px_rgba(56,189,248,0.25)]`).
2. Verification:
   - Run `npm run typecheck`
   - Run `npm run lint`
   - Ensure zero errors.
3. Atomic Git Commit (PowerShell 5.1 syntax):
   `git add src/app/login/page.tsx ; git commit -m "[Phase5-R3] Glass login, electric focus rings, role chip accents"`
4. Write your report to `d:\TP\Hackathon\DogFood\.agents\teamwork\worker_m3\handoff.md` and send a completion message back.
