# Handoff Report: Explorer M1.1 — Scaffold & Dependencies

**Milestone**: M1 (Phase 1 Foundation — Project Scaffold, Full Dependencies, and Configuration)  
**Author**: Explorer M1.1  
**Target Recipient**: Parent Orchestrator (`orchestrator_phase1`) / Implementer M1  
**Date**: 2026-09-27T06:45:00Z  

---

## 1. Observation

### 1.1 Existing Workspace Inventory
Inspection of `d:\TP\Hackathon\DogFood` confirms the following pre-existing files and directories:
- `d:\TP\Hackathon\DogFood\Hack_docs\` (Directory containing 5 files):
  - `context.txt` (29,080 bytes)
  - `example.dogfood.toml` (1,082 bytes)
  - `fixtures.json` (46,687 bytes)
  - `run.py` (8,855 bytes)
  - `spec.md` (14,861 bytes)
- `d:\TP\Hackathon\DogFood\PROGRESS.md` (3,827 bytes, 107 lines)
- `d:\TP\Hackathon\DogFood\Claude_chats.txt` (13,808 bytes)
- `d:\TP\Hackathon\DogFood\dogfood_build_plan.md` (41,539 bytes)
- `d:\TP\Hackathon\DogFood\.agents\` (Directory containing agent metadata)

Mandate check: Per `ORIGINAL_REQUEST.md` line 50:
> "IMPORTANT: The directory already contains: `Hack_docs/` folder, `PROGRESS.md`, and `Claude_chats.txt`. Do NOT delete these. Run `create-next-app` with the `.` target — it will scaffold into the existing directory."

### 1.2 System Environment State
Direct execution of environment probes yielded:
- Command: `node -v` -> Output: `v22.19.0`
- Command: `npm -v` -> Output: `11.12.1`
- Command: `git status` -> Output:
  ```
  fatal: not a git repository (or any of the parent directories): .git
  ```
  Exit code: `1`

### 1.3 `create-next-app@14` Conflict Behavior in Existing Directory
When testing `create-next-app@14` with a non-empty directory in an isolated temporary location (`$env:TEMP\cna_test_dir` containing `dummy.txt`):
- Command executed:
  ```powershell
  npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git --yes
  ```
- Output observed:
  ```
  npm warn exec The following package was not found and will be installed: create-next-app@14.2.35
  The directory cna_test_dir contains files that could conflict:

    dummy.txt

  Either try using a new directory name, or remove the files listed above.
  ```
- Exit code: `1` (Immediate abort; no files created or overwritten).

Investigation of `create-next-app` source (`packages/create-next-app/helpers/is-folder-empty.ts`) confirmed that the CLI runs `isFolderEmpty(root, name)`. It only whitelists an explicit set of files (`.git`, `.gitignore`, `LICENSE`, `docs`, etc.). Any unrecognized file or directory (`Hack_docs`, `PROGRESS.md`, `Claude_chats.txt`, `dogfood_build_plan.md`, `.agents`) triggers an immediate conflict abort. Furthermore, `create-next-app@14` does not support a `--force` or `--overwrite` flag.

### 1.4 shadcn CLI Tooling & Radix UI Dependencies
- `shadcn-ui` npm package is formally deprecated in favor of `shadcn`.
- The CLI command for headless initialization without interactive prompts is:
  ```powershell
  npx shadcn@latest init --defaults --yes
  ```
- Adding the required 15 components:
  ```powershell
  npx shadcn@latest add button card badge input label textarea select table dialog sheet tabs avatar progress separator dropdown-menu --yes
  ```
  This command installs required Radix UI dependencies (`@radix-ui/react-slot`, `@radix-ui/react-label`, `@radix-ui/react-select`, `@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `@radix-ui/react-avatar`, `@radix-ui/react-progress`, `@radix-ui/react-separator`, `@radix-ui/react-dropdown-menu`) and places components in `src/components/ui/`.

### 1.5 Package Scripts and Configuration Requirements
Per `ORIGINAL_REQUEST.md` (lines 77-88, 334, 368-372):
- `package.json` scripts:
  ```json
  "scripts": {
    "dev": "next dev -p 8080",
    "build": "next build",
    "start": "next start -p 8080",
    "seed": "npx tsx src/lib/seed.ts",
    "db:migrate": "npx prisma migrate dev",
    "db:push": "npx prisma db push",
    "typecheck": "tsc --noEmit"
  }
  ```
- `next.config.mjs`: Must include `output: 'standalone'` so that `.next/standalone` is generated for Docker multi-stage build.
- `.env`: `DATABASE_URL="file:./prisma/dogfood.db"`
- `.env.example`: `DATABASE_URL="file:./prisma/dogfood.db"`
- `.gitignore`: Must explicitly ignore `node_modules`, `.next`, `.env`, `prisma/*.db`, `prisma/*.db-journal`, `prisma/*.db-wal`, while ensuring `.env.example` is tracked.
- `LICENSE`: Full MIT license text, year 2026, name "DOGFOOD 2026 Contributors".

---

## 2. Logic Chain

1. **Premise 1 (Safety Constraint)**: The workspace `d:\TP\Hackathon\DogFood` contains existing files (`Hack_docs`, `PROGRESS.md`, `Claude_chats.txt`, `dogfood_build_plan.md`, `.agents`) that must not be deleted or corrupted (Obs 1.1).
2. **Premise 2 (CLI Limitation)**: Running `create-next-app@14 .` directly in `d:\TP\Hackathon\DogFood` will detect these non-whitelisted items and fail immediately with exit code 1 (Obs 1.3).
3. **Deduction 1 (Safe Scaffold Pattern)**: To satisfy both Premise 1 and Premise 2 without deleting files, the scaffold must be generated in an empty temporary directory (e.g. `$env:TEMP\dogfood_scaffold`), and then its generated files must be copied into `d:\TP\Hackathon\DogFood` using PowerShell `Copy-Item -Recurse -Force`. This preserves all pre-existing files while instantiating a clean Next.js 14 template.
4. **Premise 3 (Dependency Ecosystem)**: Node 22.19.0 is installed (Obs 1.2). Modern npm tools require non-deprecated packages (`shadcn` rather than deprecated `shadcn-ui`, Obs 1.4). `better-sqlite3` supplies prebuilt binaries for Node 22 on Windows x64.
5. **Deduction 2 (Deterministic Execution Sequence)**:
   - Step A: Scaffold Next.js 14 in `$env:TEMP\dogfood_scaffold` via `npx create-next-app@14 ... --no-git`.
   - Step B: Copy scaffolded files into `d:\TP\Hackathon\DogFood` and clean up `$env:TEMP\dogfood_scaffold`.
   - Step C: Install production dependencies (`prisma @prisma/client zod framer-motion lucide-react class-variance-authority clsx tailwind-merge`).
   - Step D: Initialize shadcn via `npx shadcn@latest init --defaults --yes` and add the 15 UI components.
   - Step E: Install dev dependencies (`tsx better-sqlite3 @types/better-sqlite3 @types/node`).
   - Step F: Initialize Prisma (`npx prisma init --datasource-provider sqlite`).
   - Step G: Configure `package.json` scripts, set `output: 'standalone'` in `next.config.mjs`, create `.env`, `.env.example`, `.gitignore`, `LICENSE`.
   - Step H: Initialize git repo (`git init`) because git was absent (Obs 1.2).

---

## 3. Caveats

1. **PowerShell 5.1 Command Separators**: Never chain with `&&` or `||`. Run commands sequentially using `;` or as distinct command invocations.
2. **Interactive Prompts**: Ensure `-y`, `--yes`, and `--defaults` flags are passed so commands never hang waiting for stdin in non-interactive CI/agent runs.
3. **`components.json` Configuration**: `shadcn init --defaults --yes` automatically detects the `@/*` alias and `src/` directory if `tsconfig.json` has `paths: { "@/*": ["./src/*"] }`. The implementer must verify `components.json` points to `src/app/globals.css` and `src/components`.
4. **Git Repository Status**: Because `git status` showed `fatal: not a git repository`, `git init` must be executed before Phase 1 completion commits.

---

## 4. Conclusion

The Next.js 14 scaffold cannot be run directly via `create-next-app@14 .` inside `d:\TP\Hackathon\DogFood` due to existing file conflict checks in `create-next-app`. 

The definitive, non-destructive path forward is:
1. Initialize Next.js 14 in an empty temp directory and copy files into `d:\TP\Hackathon\DogFood`.
2. Install the specified production and dev dependencies.
3. Initialize shadcn UI with `--defaults --yes` and add all 15 required components.
4. Run `npx prisma init --datasource-provider sqlite`.
5. Update `package.json` scripts, `next.config.mjs` (`output: 'standalone'`), `.env`, `.env.example`, `.gitignore`, and `LICENSE`.
6. Initialize `git` (`git init`).

---

## 5. Verification Method

To independently verify Milestone 1 after implementation:

```powershell
# 1. Verify existing critical files are untouched
Test-Path "d:\TP\Hackathon\DogFood\Hack_docs\fixtures.json"
Test-Path "d:\TP\Hackathon\DogFood\PROGRESS.md"
Test-Path "d:\TP\Hackathon\DogFood\Claude_chats.txt"
Test-Path "d:\TP\Hackathon\DogFood\dogfood_build_plan.md"

# 2. Verify project structure and scaffold files
Test-Path "d:\TP\Hackathon\DogFood\src\app\layout.tsx"
Test-Path "d:\TP\Hackathon\DogFood\src\components\ui\button.tsx"
Test-Path "d:\TP\Hackathon\DogFood\package.json"
Test-Path "d:\TP\Hackathon\DogFood\next.config.mjs"

# 3. Verify TypeScript compiles without errors
cd "d:\TP\Hackathon\DogFood"
npm run typecheck

# 4. Verify package.json scripts contain all required commands
node -e "const pkg = require('./package.json'); const req = ['dev','build','start','seed','db:migrate','db:push','typecheck']; const missing = req.filter(s => !pkg.scripts[s]); if(missing.length) throw new Error('Missing scripts: ' + missing.join(', ')); console.log('All package.json scripts present and correct');"

# 5. Verify next.config standalone output
Get-Content "next.config.mjs" | Select-String "standalone"
```

**Invalidation Conditions**:
- If `Hack_docs/`, `PROGRESS.md`, or `Claude_chats.txt` are deleted, modified, or moved without restoration.
- If `npx create-next-app@14 .` aborts with conflict errors.
- If `npm run typecheck` produces any compilation errors.
