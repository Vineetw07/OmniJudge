# Dispatch: Worker M1 (Foundation Scaffold & Full Dependencies)

You are Worker 1 for Milestone 1 of Phase 1 (Foundation) in DOGFOOD 2026.
Your working directory is: d:\TP\Hackathon\DogFood\.agents\teamwork\worker_m1
Parent Orchestrator directory: d:\TP\Hackathon\DogFood\.agents\teamwork\orchestrator_phase1

## Scope & Authoritative References
- MANDATORY: Read ORIGINAL_REQUEST.md at: `d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md`
- Build plan: `C:\Users\ASUS\.gemini\antigravity\brain\7c871d10-288a-40a1-9a0f-03c7759d4999\dogfood_build_plan.md`
- PROGRESS.md: `d:\TP\Hackathon\DogFood\PROGRESS.md`
- SCOPE.md: `d:\TP\Hackathon\DogFood\.agents\teamwork\orchestrator_phase1\SCOPE.md`

## Explorer Handoff Reports to Review First:
- `d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_m1_1\handoff.md` (Scaffold & file safety)
- `d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_m1_2\handoff.md` (Spec mining for packages, components, scripts)
- `d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_m1_3\handoff.md` (Platform constraints, font fix, verification suite)

## Write Ownership
You have exclusive write ownership over:
- `package.json`, `package-lock.json`
- `tsconfig.json`, `next.config.mjs` (or `next.config.js`)
- `tailwind.config.ts`, `postcss.config.mjs`, `components.json`
- `src/` directory (app/, lib/, components/)
- `.env`, `.env.example`, `.gitignore`, `LICENSE`
- `prisma/` (initial prisma init)
DO NOT touch or delete: `Hack_docs/`, `PROGRESS.md`, `Claude_chats.txt`, `dogfood_build_plan.md`, or `.agents/`.

## Key Execution Rules (from Explorers)
1. Do NOT run `create-next-app` directly into `.`. Scaffold into a clean temp staging folder (e.g., `$env:TEMP\cna-stage`), then copy generated files into `d:\TP\Hackathon\DogFood` to preserve existing files.
2. Initialize git repository if not yet initialized (`git init`).
3. Install production dependencies: `prisma @prisma/client zod framer-motion lucide-react class-variance-authority clsx tailwind-merge`.
4. Install dev dependencies: `tsx better-sqlite3 @types/better-sqlite3 @types/node`.
5. Use `npx shadcn@latest init --defaults --yes` (NOT `shadcn-ui`).
6. CRITICAL FIX: `shadcn init` injects `import { Geist } from "next/font/google"` into `src/app/layout.tsx`. Next.js 14 does NOT have `Geist` in `next/font/google`. Sanitize `src/app/layout.tsx` so `tsc --noEmit` compiles cleanly.
7. Install all 15 shadcn components: `button card badge input label textarea select table dialog sheet tabs avatar progress separator dropdown-menu`.
8. Run `npx prisma init --datasource-provider sqlite`.
9. Set exact `package.json` scripts:
   - `dev`: `next dev -p 8080`
   - `build`: `next build`
   - `start`: `next start -p 8080`
   - `seed`: `npx tsx src/lib/seed.ts`
   - `db:migrate`: `npx prisma migrate dev`
   - `db:push`: `npx prisma db push`
   - `typecheck`: `tsc --noEmit`
10. Configure `output: 'standalone'` in `next.config.mjs`.
11. Write `.env` (`DATABASE_URL="file:./prisma/dogfood.db"`), `.env.example` (`DATABASE_URL="file:./prisma/dogfood.db"`), `.gitignore` (ignore `node_modules`, `.next`, `.env`, `prisma/*.db*`, with `!.env.example`), and `LICENSE` (MIT 2026 DOGFOOD 2026 Contributors).
12. Run verification: `npm run typecheck` (`tsc --noEmit`) and verify all components exist.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Delivery
Write `d:\TP\Hackathon\DogFood\.agents\teamwork\worker_m1\handoff.md` with:
- Summary of actions taken and files modified/created
- Terminal command output and exit codes
- Build / typecheck verification output
## 2026-09-27T06:47:41Z
Received user request to implement Milestone 1:
1. Scaffold Next.js 14 safely using staging directory to preserve existing files (Hack_docs, PROGRESS.md, Claude_chats.txt, etc.).
2. Initialize git (git init) if not initialized.
3. Install production & dev dependencies.
4. Setup shadcn UI (npx shadcn@latest init --defaults --yes) and add all 15 UI components.
5. Sanitize src/app/layout.tsx to remove incompatible Geist font from next/font/google so Next.js 14 tsc --noEmit compiles cleanly.
6. Initialize Prisma (npx prisma init --datasource-provider sqlite).
7. Configure package.json scripts (dev, build, start, seed, db:migrate, db:push, typecheck) and next.config.mjs (output: 'standalone').
8. Create .env, .env.example, .gitignore, and LICENSE (MIT 2026 DOGFOOD 2026 Contributors).
9. Run typecheck (npm run typecheck) and verify cleanly.

## 2026-09-27T07:00:50Z
Parent heartbeat check:
Context: Milestone 1 Implementation (Next.js 14 scaffold & dependencies)
Content: Heartbeat check: please provide a brief update on your current step and whether create-next-app / npm install has completed in staging.
Action: Reply with your current status and progress.
