# Handoff Report: Milestone 1 — Dependencies & Configuration Specifications

## 1. Observation

Direct observations from authoritative project sources:

1. **`ORIGINAL_REQUEST.md` (lines 46–88, 366–372)**:
   - Line 54: `npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git --yes`
   - Line 58: `npm install prisma @prisma/client zod framer-motion lucide-react class-variance-authority clsx tailwind-merge`
   - Line 62: `npx shadcn-ui@latest init --yes`
   - Line 66: `npx shadcn-ui@latest add button card badge input label textarea select table dialog sheet tabs avatar progress separator dropdown-menu --yes`
   - Line 70: `npm install -D tsx better-sqlite3 @types/better-sqlite3 @types/node`
   - Line 74: `npx prisma init --datasource-provider sqlite`
   - Lines 78–88:
     ```json
     {
       "dev": "next dev -p 8080",
       "build": "next build",
       "start": "next start -p 8080",
       "seed": "npx tsx src/lib/seed.ts",
       "db:migrate": "npx prisma migrate dev",
       "db:push": "npx prisma db push",
       "typecheck": "tsc --noEmit"
     }
     ```
   - Lines 368–372:
     - `.env`: `DATABASE_URL="file:./prisma/dogfood.db"`
     - `.env.example`: `DATABASE_URL="file:./prisma/dogfood.db"`
     - `.gitignore`: `node_modules`, `.next`, `.env`, `prisma/*.db`, `prisma/*.db-journal`, `prisma/*.db-wal`. Keep `.env.example` tracked.
     - `LICENSE`: Full MIT license text, year 2026, name "DOGFOOD 2026 Contributors".
   - Line 334: `output: 'standalone'` in `next.config.js`/`next.config.ts`.

2. **`SCOPE.md` (lines 26–30, 44)**:
   - Line 27: Production Dependencies: `prisma`, `@prisma/client`, `zod`, `framer-motion`, `lucide-react`, `cva`, `clsx`, `tailwind-merge`
   - Line 28: shadcn/ui Components: `button`, `card`, `badge`, `input`, `label`, `textarea`, `select`, `table`, `dialog`, `sheet`, `tabs`, `avatar`, `progress`, `separator`, `dropdown-menu`
   - Line 29: Dev Dependencies & Scripts: `tsx`, `better-sqlite3`, `@types/better-sqlite3`, `@types/node`; `dev`, `build`, `start`, `seed`, `db:migrate`, `db:push`, `typecheck`
   - Line 30: Supporting Config Files: `.env`, `.env.example`, `.gitignore`, `LICENSE (MIT 2026)`

3. **`dogfood_build_plan.md` (lines 308–352)**:
   - Identical scaffolding sequence, production and dev dependencies, and scripts.
   - Styles for shadcn/ui init: Style `Default`, Base color `Slate`, CSS variables `Yes`.

4. **Repository State & Platform Constraints**:
   - Target root: `d:\TP\Hackathon\DogFood`
   - Pre-existing files: `Hack_docs/`, `PROGRESS.md`, `Claude_chats.txt`, `dogfood_build_plan.md`, `.agents/`
   - Host Node.js version: `v22.19.0`
   - Container target: `node:20-alpine` (multi-stage build)
   - Host OS & Shell: Windows 10/11 x64, Windows PowerShell 5.1 (semicolons `;` only, no `&&` or `||`)

---

## 2. Logic Chain

1. **Scaffold & Directory Constraints**:
   - `d:\TP\Hackathon\DogFood` already contains existing folders (`Hack_docs/`, `.agents/`) and markdown files (`PROGRESS.md`, `Claude_chats.txt`).
   - Running `create-next-app@14 .` must target `.` with non-interactive flags (`--yes`) and preserve existing files without overwriting or deleting `Hack_docs/` or `PROGRESS.md`.
2. **Package Naming Discrepancies Resolved**:
   - In npm, `class-variance-authority` is the canonical package name; `cva` is its widely used abbreviation. Installing `class-variance-authority` provides the `cva` helper required by shadcn/ui.
   - For dev dependencies, `better-sqlite3` is a native C++ binding module. In environments lacking C++ build tools or running newer Node versions (e.g. Node 22), native compilation risks failure unless prebuilts exist. Note that Prisma client uses its own Rust engine (`query-engine`), so the core runtime relies on `@prisma/client` and `prisma`.
3. **Component Count Resolution**:
   - The dispatch and specification describe "All 14 shadcn-ui components" but enumerate 15 distinct items: `button`, `card`, `badge`, `input`, `label`, `textarea`, `select`, `table`, `dialog`, `sheet`, `tabs`, `avatar`, `progress`, `separator`, and `dropdown-menu`.
   - The CLI command `npx shadcn-ui@latest add button card badge input label textarea select table dialog sheet tabs avatar progress separator dropdown-menu --yes` installs all 15 components. All 15 must be treated as mandatory.
4. **Configuration & Scripts Alignment**:
   - Port 8080 is an absolute system constraint for both development and production (`dev`: `next dev -p 8080`, `start`: `next start -p 8080`).
   - SQLite requires ignoring database files in `.gitignore` (`prisma/*.db`, `*.db-journal`, `*.db-wal`) while ensuring `.env.example` remains tracked.
   - MIT License must specify copyright year `2026` and holder `DOGFOOD 2026 Contributors`.
   - `next.config.js` / `next.config.mjs` must specify `output: 'standalone'` to generate `.next/standalone` for Docker.

---

## 3. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Framework | Next.js 14 Scaffold | Next.js 14 App Router project with TypeScript and Tailwind CSS | `npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git --yes` | Scaffolded `src/app`, `package.json`, `tsconfig.json`, `tailwind.config.ts` | Non-zero exit code if directory has conflicting files | `ORIGINAL_REQUEST.md:54` |
| 2 | Production Dep | `prisma` | Database schema engine and CLI tools (`^5.22.0`) | `npm install prisma` | `node_modules/prisma`, `package.json` | Missing Node permissions or network error | `ORIGINAL_REQUEST.md:58` |
| 3 | Production Dep | `@prisma/client` | Type-safe runtime ORM client (`^5.22.0`) | `npm install @prisma/client` | `node_modules/@prisma/client` | Version mismatch with `prisma` CLI triggers warning | `ORIGINAL_REQUEST.md:58` |
| 4 | Production Dep | `zod` | TypeScript-first schema declaration and validation (`^3.23.8`) | `npm install zod` | `node_modules/zod` | Throws `ZodError` on schema parse mismatch | `ORIGINAL_REQUEST.md:58` |
| 5 | Production Dep | `framer-motion` | Motion and animation library for React (`^11.11.11`) | `npm install framer-motion` | `node_modules/framer-motion` | Build error if React version < 18 | `ORIGINAL_REQUEST.md:58` |
| 6 | Production Dep | `lucide-react` | Clean React icon components (`^0.454.0`) | `npm install lucide-react` | `node_modules/lucide-react` | Module not found if package omitted | `ORIGINAL_REQUEST.md:58` |
| 7 | Production Dep | `class-variance-authority` | Component variant utility (`^0.7.0`) | `npm install class-variance-authority` | `node_modules/class-variance-authority` | None | `ORIGINAL_REQUEST.md:58` |
| 8 | Production Dep | `clsx` | Utility for constructing className strings (`^2.1.1`) | `npm install clsx` | `node_modules/clsx` | None | `ORIGINAL_REQUEST.md:58` |
| 9 | Production Dep | `tailwind-merge` | Merge Tailwind utility classes without conflict (`^2.5.4`) | `npm install tailwind-merge` | `node_modules/tailwind-merge` | None | `ORIGINAL_REQUEST.md:58` |
| 10 | Dev Dep | `tsx` | TypeScript Execute CLI for running scripts directly (`^4.19.2`) | `npm install -D tsx` | `node_modules/tsx`, `package.json` | Syntax error in script exits with non-zero code | `ORIGINAL_REQUEST.md:70` |
| 11 | Dev Dep | `better-sqlite3` | C++ native SQLite driver (`^11.5.0`) | `npm install -D better-sqlite3` | `node_modules/better-sqlite3` | Node-gyp compilation failure if build tools missing | `ORIGINAL_REQUEST.md:70` |
| 12 | Dev Dep | `@types/better-sqlite3` | TypeScript type declarations (`^7.6.12`) | `npm install -D @types/better-sqlite3` | `node_modules/@types/better-sqlite3` | None | `ORIGINAL_REQUEST.md:70` |
| 13 | Dev Dep | `@types/node` | TypeScript definitions for Node.js (`^20.17.0`) | `npm install -D @types/node` | `node_modules/@types/node` | Type mismatches if major versions drift | `ORIGINAL_REQUEST.md:70` |
| 14 | UI Component | `button` | Accessible button with variants (default, destructive, outline, secondary, ghost, link) | `npx shadcn-ui@latest add button --yes` | `src/components/ui/button.tsx` | Fails if `components.json` missing | `ORIGINAL_REQUEST.md:66` |
| 15 | UI Component | `card` | Container component with CardHeader, CardTitle, CardDescription, CardContent, CardFooter | `npx shadcn-ui@latest add card --yes` | `src/components/ui/card.tsx` | Fails if `components.json` missing | `ORIGINAL_REQUEST.md:66` |
| 16 | UI Component | `badge` | Status badge with variants (default, secondary, destructive, outline) | `npx shadcn-ui@latest add badge --yes` | `src/components/ui/badge.tsx` | Fails if `components.json` missing | `ORIGINAL_REQUEST.md:66` |
| 17 | UI Component | `input` | Accessible input element with theme styles | `npx shadcn-ui@latest add input --yes` | `src/components/ui/input.tsx` | Fails if `components.json` missing | `ORIGINAL_REQUEST.md:66` |
| 18 | UI Component | `label` | Accessible label built on Radix Label primitive | `npx shadcn-ui@latest add label --yes` | `src/components/ui/label.tsx` | Installs `@radix-ui/react-label` | `ORIGINAL_REQUEST.md:66` |
| 19 | UI Component | `textarea` | Accessible multiline text input | `npx shadcn-ui@latest add textarea --yes` | `src/components/ui/textarea.tsx` | Fails if `components.json` missing | `ORIGINAL_REQUEST.md:66` |
| 20 | UI Component | `select` | Dropdown select built on Radix Select primitive | `npx shadcn-ui@latest add select --yes` | `src/components/ui/select.tsx` | Installs `@radix-ui/react-select` | `ORIGINAL_REQUEST.md:66` |
| 21 | UI Component | `table` | Tabular data display with header, body, row, cell | `npx shadcn-ui@latest add table --yes` | `src/components/ui/table.tsx` | Fails if `components.json` missing | `ORIGINAL_REQUEST.md:66` |
| 22 | UI Component | `dialog` | Accessible modal dialog with overlay, close, header, footer | `npx shadcn-ui@latest add dialog --yes` | `src/components/ui/dialog.tsx` | Installs `@radix-ui/react-dialog` | `ORIGINAL_REQUEST.md:66` |
| 23 | UI Component | `sheet` | Slide-out drawer built on Radix Dialog (sides: top, bottom, left, right) | `npx shadcn-ui@latest add sheet --yes` | `src/components/ui/sheet.tsx` | Installs `@radix-ui/react-dialog` | `ORIGINAL_REQUEST.md:66` |
| 24 | UI Component | `tabs` | Accessible tabbed navigation and content panes | `npx shadcn-ui@latest add tabs --yes` | `src/components/ui/tabs.tsx` | Installs `@radix-ui/react-tabs` | `ORIGINAL_REQUEST.md:66` |
| 25 | UI Component | `avatar` | User profile avatar with fallback text | `npx shadcn-ui@latest add avatar --yes` | `src/components/ui/avatar.tsx` | Installs `@radix-ui/react-avatar` | `ORIGINAL_REQUEST.md:66` |
| 26 | UI Component | `progress` | Progress bar indicator built on Radix Progress | `npx shadcn-ui@latest add progress --yes` | `src/components/ui/progress.tsx` | Installs `@radix-ui/react-progress` | `ORIGINAL_REQUEST.md:66` |
| 27 | UI Component | `separator` | Horizontal or vertical visual divider | `npx shadcn-ui@latest add separator --yes` | `src/components/ui/separator.tsx` | Installs `@radix-ui/react-separator` | `ORIGINAL_REQUEST.md:66` |
| 28 | UI Component | `dropdown-menu` | Menu with actions, shortcuts, submenus, radio/checkbox items | `npx shadcn-ui@latest add dropdown-menu --yes` | `src/components/ui/dropdown-menu.tsx` | Installs `@radix-ui/react-dropdown-menu` | `ORIGINAL_REQUEST.md:66` |
| 29 | Script | `dev` | Runs Next.js development server on port 8080 | `npm run dev` (`next dev -p 8080`) | Listens at `http://localhost:8080` with HMR | Port conflict if 8080 occupied | `ORIGINAL_REQUEST.md:80` |
| 30 | Script | `build` | Builds production Next.js standalone bundle | `npm run build` (`next build`) | `.next/standalone`, `.next/static` | Non-zero exit on type or lint error | `ORIGINAL_REQUEST.md:81` |
| 31 | Script | `start` | Starts production Next.js server on port 8080 | `npm run start` (`next start -p 8080`) | Serves production portal on port 8080 | Fails if `.next` build missing | `ORIGINAL_REQUEST.md:82` |
| 32 | Script | `seed` | Executes fixture database seed script | `npm run seed` (`npx tsx src/lib/seed.ts`) | Populates SQLite DB and prints 4 session tokens | Non-zero exit if DB or fixtures unreachable | `ORIGINAL_REQUEST.md:83` |
| 33 | Script | `db:migrate` | Runs Prisma development migrations | `npm run db:migrate` (`npx prisma migrate dev`) | Creates and applies SQL migration in `prisma/migrations` | Non-zero exit on migration drift or lock | `ORIGINAL_REQUEST.md:84` |
| 34 | Script | `db:push` | Pushes Prisma schema directly to DB without migration files | `npm run db:push` (`npx prisma db push`) | Synchronizes SQLite schema | Non-zero exit on data-loss warning without force | `ORIGINAL_REQUEST.md:85` |
| 35 | Script | `typecheck` | Runs TypeScript compiler type verification without output | `npm run typecheck` (`tsc --noEmit`) | Prints type diagnostics, exit code 0 on pass | Non-zero exit code if type errors exist | `ORIGINAL_REQUEST.md:86` |
| 36 | Config File | `.env` | Local development environment configuration | Text file at `./.env` | `DATABASE_URL="file:./prisma/dogfood.db"` | Prisma errors if path invalid | `ORIGINAL_REQUEST.md:368` |
| 37 | Config File | `.env.example` | Version-controlled environment template | Text file at `./.env.example` | `DATABASE_URL="file:./prisma/dogfood.db"` | None | `ORIGINAL_REQUEST.md:369` |
| 38 | Config File | `.gitignore` | Prevents secrets, node_modules, and SQLite DBs from git | Text file at `./.gitignore` | Ignores `node_modules`, `.next`, `.env`, `prisma/*.db*` | Leaks secrets if `.env` omitted | `ORIGINAL_REQUEST.md:370` |
| 39 | Config File | `LICENSE` | MIT License legal document | Text file at `./LICENSE` | Copyright (c) 2026 DOGFOOD 2026 Contributors | Hackathon DQ if license missing | `ORIGINAL_REQUEST.md:371` |
| 40 | Config File | `next.config.js` | Next.js configuration with standalone output | Text file at `./next.config.js` or `next.config.mjs` | `output: 'standalone'` | Standalone build missing if omitted | `ORIGINAL_REQUEST.md:334` |
| 41 | Config File | `components.json` | shadcn-ui configuration file | Generated via `shadcn-ui init` | Path mappings for components and utils | Missing components CLI errors | `dogfood_build_plan.md:319` |

---

## 4. Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | `npx create-next-app@14` | Target directory `.` has pre-existing files (`Hack_docs`, `PROGRESS.md`, etc.) | CLI prompts for directory overwrite or conflicts unless passed `--yes`. Existing files must not be deleted or corrupted. |
| 2 | `better-sqlite3` installation | Node v22.19.0 on Windows without C++ build tools installed | Node-gyp can fail if no prebuilt binary matches Node 22 ABI. If npm install fails, builder should verify `--ignore-scripts` or ensure prebuilt binaries are resolved, or note that Prisma SQLite does not depend on better-sqlite3. |
| 3 | shadcn Component List | 14 components stated in prose vs 15 items in parenthesized list | The parenthesized list explicitly specifies 15 components: `button, card, badge, input, label, textarea, select, table, dialog, sheet, tabs, avatar, progress, separator, dropdown-menu`. All 15 must be installed. |
| 4 | `package.json` Port Binding | Running `next dev` or `next start` without `-p 8080` flag | Defaults to port 3000, violating hackathon requirement (acceptance checker runs on port 8080). Must strictly include `-p 8080`. |
| 5 | `next.config.js` Standalone Build | Omitting `output: 'standalone'` | Docker multi-stage build will fail at `COPY --from=builder /app/.next/standalone ./` because `.next/standalone` will not exist. |
| 6 | `.gitignore` tracking rule | Ignoring `.env*` with wildcard | Wildcard `.env*` would unintentionally ignore `.env.example`. Must explicitly use `!.env.example` to ensure `.env.example` is committed. |
| 7 | SQLite Lock & Wal files | SQLite creates `.db-journal`, `.db-wal`, and `.db-shm` files during operation | If `.gitignore` only includes `*.db`, SQLite WAL files might get committed. Must ignore `prisma/*.db*` or specifically `*.db-journal`, `*.db-wal`, `*.db-shm`. |
| 8 | Shell Syntax Compatibility | Using `&&` in scripts or multi-command chains in PowerShell 5.1 | Causes `ParserError: The token '&&' is not a valid statement separator in this version`. Commands must use `;` or be executed sequentially. |

---

## 5. Caveats

1. **Host Environment Native Addons**: Node.js `v22.19.0` is installed on the host. `better-sqlite3` requires precompiled binaries for Node 22 ABI; if not available, node-gyp will attempt C++ compilation.
2. **`cva` vs `class-variance-authority`**: `cva` is imported as `import { cva } from "class-variance-authority"`. In npm, the package name is `class-variance-authority`.
3. **Execution Mode**: Per Spec Miner protocol, this report documents the authoritative specifications. No modifications to production code or packages have been made by this agent.

---

## 6. Conclusion

Milestone 1 specifications are completely and unambiguously defined:

1. **Exact Package Manifest**:
   - Production (8): `prisma`, `@prisma/client`, `zod`, `framer-motion`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`
   - Dev (4+): `tsx`, `better-sqlite3`, `@types/better-sqlite3`, `@types/node`, plus Next.js/Tailwind scaffold packages (`typescript`, `tailwindcss`, `postcss`, `autoprefixer`, `eslint`, `eslint-config-next`)
2. **All 15 Required shadcn/ui Components**:
   - `button`, `card`, `badge`, `input`, `label`, `textarea`, `select`, `table`, `dialog`, `sheet`, `tabs`, `avatar`, `progress`, `separator`, `dropdown-menu`
3. **Exact `package.json` Scripts**:
   ```json
   {
     "dev": "next dev -p 8080",
     "build": "next build",
     "start": "next start -p 8080",
     "seed": "npx tsx src/lib/seed.ts",
     "db:migrate": "npx prisma migrate dev",
     "db:push": "npx prisma db push",
     "typecheck": "tsc --noEmit"
   }
   ```
4. **Exact Supporting Configurations**:
   - `.env`: `DATABASE_URL="file:./prisma/dogfood.db"`
   - `.env.example`: `DATABASE_URL="file:./prisma/dogfood.db"`
   - `.gitignore`: Excludes `node_modules`, `.next`, `.env`, `prisma/*.db*`, with `!.env.example`
   - `LICENSE`: Standard MIT license with copyright `Copyright (c) 2026 DOGFOOD 2026 Contributors`
   - `next.config.js`: Contains `output: 'standalone'`

---

## 7. Verification Method

Once Milestone 1 is implemented by the builder agent, verify independently with these steps:

1. **Verify Packages in `package.json`**:
   - Inspect `d:\TP\Hackathon\DogFood\package.json`.
   - Check that all 8 production packages and 4 dev packages are listed under `dependencies` and `devDependencies`.
2. **Verify shadcn Components in `src/components/ui/`**:
   - Verify existence of all 15 files:
     `button.tsx`, `card.tsx`, `badge.tsx`, `input.tsx`, `label.tsx`, `textarea.tsx`, `select.tsx`, `table.tsx`, `dialog.tsx`, `sheet.tsx`, `tabs.tsx`, `avatar.tsx`, `progress.tsx`, `separator.tsx`, `dropdown-menu.tsx`.
3. **Verify Configuration Files**:
   - `.env`: Check `DATABASE_URL="file:./prisma/dogfood.db"`
   - `.env.example`: Check `DATABASE_URL="file:./prisma/dogfood.db"`
   - `.gitignore`: Check `node_modules`, `.next`, `.env`, `prisma/*.db` are present.
   - `LICENSE`: Check `2026` and `DOGFOOD 2026 Contributors`.
   - `next.config.js`: Check `output: 'standalone'`.
4. **Verify TypeScript & Scripts**:
   - Run `npm run typecheck` (`tsc --noEmit`) to verify zero type errors.
