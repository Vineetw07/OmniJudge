# Dispatch: Worker M1 Iteration 2 (Audit Remediation: Tailwind v3 & Globals CSS Fix)

You are Worker M1 (Iteration 2) for Milestone 1 of Phase 1 (Foundation) in DOGFOOD 2026.
Your working directory is: d:\TP\Hackathon\DogFood\.agents\teamwork\worker_m1_it2
Parent Orchestrator directory: d:\TP\Hackathon\DogFood\.agents\teamwork\orchestrator_phase1

## Scope & Authoritative References
- MANDATORY: Read ORIGINAL_REQUEST.md at: `d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md`
- SCOPE.md: `d:\TP\Hackathon\DogFood\.agents\teamwork\orchestrator_phase1\SCOPE.md`

## Full Forensic Audit Evidence (Non-Negotiable Remediation Requirement)
Read the full auditor evidence report at:
`d:\TP\Hackathon\DogFood\.agents\teamwork\auditor_m1\handoff.md`
Root failure: `npm run build` failed with exit code 1 due to `The border-border class does not exist` in `src/app/globals.css`.

## Explorer Handoff Reports & Ready-to-Use Artifacts
Read the three Explorer handoffs:
1. `d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_m1_it2_1\handoff.md` (and `proposed_tailwind.config.ts`, `proposed_globals.css`)
2. `d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_m1_it2_2\handoff.md` (and `proposed_globals.css`, `proposed_tailwind.config.ts`, `fix_tailwind_and_globals.patch`)
3. `d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_m1_it2_3\handoff.md` (verification protocol and secondary `@apply outline-ring/50` pitfall)

## Write Ownership
You have exclusive write ownership over:
- `d:\TP\Hackathon\DogFood\tailwind.config.ts`
- `d:\TP\Hackathon\DogFood\src\app\globals.css`
DO NOT touch or delete: `Hack_docs/`, `PROGRESS.md`, `Claude_chats.txt`, `dogfood_build_plan.md`, or `.agents/`.

## Mandatory Implementation Tasks
1. Update `src/app/globals.css`:
   - Remove lines 1-2 (`@import "tw-animate-css";`, `@import "shadcn/tailwind.css";`).
   - Define all CSS variables in `:root` and `.dark` (including `--destructive-foreground`, radius sub-scale `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, and `--card-spacing`).
   - Replace `* { @apply border-border outline-ring/50; }` with `* { @apply border-border; }`.
   (You can use the exact formulation from `explorer_m1_it2_2\proposed_globals.css` or `explorer_m1_it2_1\proposed_globals.css`).
2. Update `tailwind.config.ts`:
   - Configure `darkMode: ["class"]`.
   - Extend `theme.extend.colors` with all 14 semantic tokens: `border`, `input`, `ring`, `background`, `foreground`, `primary`, `secondary`, `destructive`, `muted`, `accent`, `popover`, `card`, `sidebar`, `chart`.
   - Define `borderRadius`: `lg`, `md`, `sm`.
   - Define `keyframes` and `animation` for accordion.
   - Register custom data variants plugin for `@base-ui/react`.
   (You can use the exact formulation from `explorer_m1_it2_2\proposed_tailwind.config.ts`).
3. Run full verification:
   - `npm run build` -> MUST exit with code 0 and generate `.next/standalone`.
   - `npm run typecheck` -> MUST exit with code 0 (0 errors).
   - `npm run lint` -> MUST exit with code 0.
   - `npx prisma validate` -> MUST exit with code 0.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write your handoff report to `d:\TP\Hackathon\DogFood\.agents\teamwork\worker_m1_it2\handoff.md` and notify parent when done. Update `progress.md` with your heartbeat.

## 2026-09-27T07:48:32Z
You are Worker M1 (Iteration 2) for Milestone 1 in DOGFOOD 2026.
Your working directory is: d:\TP\Hackathon\DogFood\.agents\teamwork\worker_m1_it2
Read DISPATCH.md in your working directory.
MANDATORY: Read ORIGINAL_REQUEST.md at d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md.
MANDATORY AUDIT REMEDIATION: Read auditor handoff at d:\TP\Hackathon\DogFood\.agents\teamwork\auditor_m1\handoff.md.
Read Explorer handoffs and ready-to-use artifacts:
- d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_m1_it2_1\proposed_tailwind.config.ts and proposed_globals.css
- d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_m1_it2_2\proposed_tailwind.config.ts and proposed_globals.css
- d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_m1_it2_3\handoff.md

Tasks:
1. Update d:\TP\Hackathon\DogFood\src\app\globals.css and d:\TP\Hackathon\DogFood\tailwind.config.ts per the explorer specifications to resolve the border-border PostCSS error and configure standard Tailwind v3 tokens.
2. Run npm run build and verify it exits with code 0.
3. Run npm run typecheck (tsc --noEmit) and npm run lint and verify exit code 0.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write your handoff report to d:\TP\Hackathon\DogFood\.agents\teamwork\worker_m1_it2\handoff.md and notify parent when done. Update progress.md with your heartbeat.

