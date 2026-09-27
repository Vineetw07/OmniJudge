# Handoff Report: Explorer M1.3 (Platform Execution Constraints & Verification Steps)

**Date**: 2026-09-27  
**Author**: Explorer M1.3 (Platform & Execution Discipline)  
**Target Milestone**: Milestone 1 (Foundation Scaffold & Dependencies)  
**Parent Orchestrator**: `d13cfa1c-1a99-4f0b-be8e-29a865a627fb`  

---

## 1. Observation

Direct observations obtained through live execution in the Windows PowerShell 5.1 environment on this host (`Node v22.19.0`, `npm 11.12.1`, `Windows x64`):

1. **Current Directory State in `d:\TP\Hackathon\DogFood`**:
   - `Claude_chats.txt` (13,808 bytes)
   - `Hack_docs/` (`context.txt`, `example.dogfood.toml`, `fixtures.json`, `run.py`, `spec.md`)
   - `PROGRESS.md` (3,827 bytes)
   - `dogfood_build_plan.md` (41,539 bytes)
   - `.agents/` directory containing agent teamwork metadata
   - Files `package.json`, `components.json`, `tailwind.config.ts`, `postcss.config.mjs`, and `tsconfig.json` do not exist yet (`Test-Path` returned `False` for all).
   - Git repository is not yet initialized (`git status` returned `fatal: not a git repository`).

2. **PowerShell 5.1 Command Chaining and Parsing**:
   - Chaining with `&&` fails immediately at parse time with:
     ```
     ParserError: The token '&&' is not a valid statement separator in this version.
     ```
   - Chaining with `;` executes sequentially, but does NOT stop on errors.
   - Quoting external arguments: External CLI invocations like `node -e "..."` strip nested double and single quotes in PowerShell 5.1, resulting in `SyntaxError` unless piped via PowerShell here-strings (`@' ... '@ | node`).

3. **`create-next-app` Directory Conflict Rule (`isFolderEmpty`)**:
   - Inspection of `create-next-app@14.2.35` source code revealed:
     ```javascript
     function isFolderEmpty(t,r){
       const i=[".DS_Store",".git",".gitattributes",".gitignore",".gitlab-ci.yml",".hg",".hgcheck",".hgignore",".idea",".npmignore",".travis.yml","LICENSE","Thumbs.db","docs","mkdocs.yml","npm-debug.log","yarn-debug.log","yarn-error.log","yarnrc.yml",".yarn"];
       const a=E().readdirSync(t).filter((t=>!i.includes(t)&&!/\.iml$/.test(t)));
       if(a.length>0){ ... process.exit(1); }
     }
     ```
   - When tested in a non-empty directory containing `PROGRESS.md`, `npx create-next-app@14 . ...` failed immediately with exit code 1:
     ```
     The directory cna-existing contains files that could conflict:
       PROGRESS.md
     Either try using a new directory name, or remove the files listed above.
     ```
   - The whitelist includes `docs`, but does NOT include `Hack_docs`, `PROGRESS.md`, `dogfood_build_plan.md`, `Claude_chats.txt`, or `.agents`. Therefore, running `create-next-app` directly targeting `.` will fail immediately with exit code 1.

4. **Package Deprecation of `shadcn-ui`**:
   - Executing `npx shadcn-ui@latest init --yes` exited with code 0 without creating `components.json` or installing files:
     ```
     The 'shadcn-ui' package is deprecated. Please use the 'shadcn' package instead:
       npx shadcn@latest init --yes
     For more information, visit: https://ui.shadcn.com/docs/cli
     ```
   - `npx shadcn@latest` is the active CLI package.
   - When `components.json` already exists, `npx shadcn@latest init` prompts:
     `? A components.json file already exists. Would you like to overwrite it? » (y/N)`
     and hangs waiting for input even with `-y`, unless `-f` / `--force` is supplied.

5. **`shadcn@latest` Font Injection Bug with Next.js 14**:
   - Running `npx shadcn@latest init -d -y` in Next.js 14 modified `src/app/layout.tsx` by injecting:
     ```typescript
     import { Geist } from "next/font/google";
     const geist = Geist({subsets:['latin'],variable:'--font-sans'});
     ```
   - In Next.js 14.2.35, `next/font/google` does NOT export `Geist` (`TS2305: Module '"next/font/google"' has no exported member 'Geist'`), causing `npx tsc --noEmit` to fail with exit code 1.
   - Sanitizing `src/app/layout.tsx` to remove the `Geist` font import and using local fonts or standard classes allows `npx tsc --noEmit` to pass with 0 errors.

6. **All 15 Required shadcn/ui Components Supported**:
   - `npx shadcn@latest add button card badge input label textarea select table dialog sheet tabs avatar progress separator dropdown-menu -y` created 14 files and skipped `button.tsx` (already created by init), populating all 15 required components in `src/components/ui/`.

---

## 2. Logic Chain

1. **PowerShell 5.1 Execution Discipline**:
   - *Premise*: PowerShell 5.1 is the host shell. Any command containing `&&` terminates immediately with a fatal `ParserError`.
   - *Premise*: Using `;` without exit status checks causes subsequent commands to run even if preceding commands fail, risking corrupted state.
   - *Inference*: To ensure safe command execution, the implementer must either run commands as discrete tool steps or use the PowerShell 5.1 pattern:
     `cmd1; if ($LASTEXITCODE -ne 0) { throw "Step failed with exit code $LASTEXITCODE" }; cmd2`
   - *Inference*: Any CLI tool that prompts must be given non-interactive flags (`-y`, `--yes`, `-f`, `-Force`).

2. **Scaffolding Strategy Given `isFolderEmpty` Constraint**:
   - *Premise*: `ORIGINAL_REQUEST.md` mandates that `Hack_docs/`, `PROGRESS.md`, and `Claude_chats.txt` must NOT be deleted.
   - *Premise*: `create-next-app`'s `isFolderEmpty` checks all root directory entries against a hardcoded whitelist that excludes `Hack_docs`, `PROGRESS.md`, `dogfood_build_plan.md`, `Claude_chats.txt`, and `.agents`.
   - *Premise*: If any non-whitelisted file or directory is detected in the target directory, `create-next-app` prints an error and aborts with `process.exit(1)`.
   - *Inference*: Running `npx create-next-app@14 . ...` directly in `d:\TP\Hackathon\DogFood` will abort with exit code 1.
   - *Solution*: The implementer should run `create-next-app@14` into a clean temporary staging directory (e.g., `$env:TEMP\cna-stage`), then copy the scaffolded files (`src/`, `package.json`, `package-lock.json`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`, `next.config.mjs`, `node_modules`, `.eslintrc.json`) into `d:\TP\Hackathon\DogFood`. This preserves all pre-existing files with zero conflict risk.

3. **shadcn/ui CLI Invariant**:
   - *Premise*: Running `npx shadcn-ui@latest init` prints a deprecation banner and exits without installing.
   - *Inference*: The CLI command must be `npx shadcn@latest init` and `npx shadcn@latest add`.
   - *Premise*: `shadcn init` injects `Geist` from `next/font/google` into `src/app/layout.tsx`, breaking TypeScript compilation under Next.js 14.
   - *Inference*: The implementer must sanitize `src/app/layout.tsx` immediately after `shadcn init` to remove `Geist` from `next/font/google`.

4. **Configuration Files Alignment**:
   - *`components.json`*: Must define `style: "default"` (or `"base-nova"`), `rsc: true`, `tsx: true`, `tailwind.config: "tailwind.config.ts"`, `tailwind.css: "src/app/globals.css"`, `aliases: { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui" }`.
   - *`tailwind.config.ts`*: Must include content glob patterns for `./src/pages/**/*.{js,ts,jsx,tsx,mdx}`, `./src/components/**/*.{js,ts,jsx,tsx,mdx}`, `./src/app/**/*.{js,ts,jsx,tsx,mdx}`, and extend theme colors for CSS variables.
   - *`postcss.config.mjs`*: Must export `{ plugins: { tailwindcss: {}, autoprefixer: {} } }`.
   - *`tsconfig.json`*: Must include `"paths": { "@/*": ["./src/*"] }`, `"strict": true`, `"noEmit": true`.

---

## 3. Caveats

1. **Host Network Requirement for Package Installation**:
   - During Milestone 1 bootstrapping, npm downloads packages from the public npm registry. An active internet connection is assumed for the initial `create-next-app` and `npm install` steps on the host machine. Docker offline operation is tested in Milestone 4.
2. **`framer-motion` Version Compatibility**:
   - `framer-motion` is installed in Milestone 1 for use in later phases. Under React 18 / Next.js 14, standard `framer-motion` installs without peer-dependency conflicts.
3. **`better-sqlite3` Native Build**:
   - `better-sqlite3` is a C++ native module. On Windows, prebuilt binaries are fetched via `node-gyp` / prebuild-install. If prebuilt binary download fails, `tsx` with Prisma sqlite is the primary execution path.

---

## 4. Conclusion

1. **PowerShell 5.1 Discipline**: Never emit `&&` or `||`. Use discrete command steps or `; if ($LASTEXITCODE -ne 0) { throw ... }`. Pass `-y` and `-f` flags to all CLI tools. Avoid unescaped nested quotes in `node -e`; use `@' ... '@ | node`.
2. **Scaffold Protocol**: Do NOT run `npx create-next-app@14 .` directly inside `d:\TP\Hackathon\DogFood` because existing files (`Hack_docs`, `PROGRESS.md`, `dogfood_build_plan.md`, `Claude_chats.txt`, `.agents`) trigger `create-next-app`'s conflict detector and abort. Use staging directory copy.
3. **shadcn Command & Font Fix**: Use `npx shadcn@latest` (not `shadcn-ui`). Immediately patch `src/app/layout.tsx` to remove `import { Geist } from "next/font/google"` so `npx tsc --noEmit` compiles cleanly.
4. **All 15 shadcn components** (`button`, `card`, `badge`, `input`, `label`, `textarea`, `select`, `table`, `dialog`, `sheet`, `tabs`, `avatar`, `progress`, `separator`, `dropdown-menu`) install cleanly via `npx shadcn@latest add ... -y`.

---

## 5. Verification Method

To independently verify Milestone 1 completion, run the following automated verification suite in Windows PowerShell 5.1 from `d:\TP\Hackathon\DogFood`:

### Verification Suite Command (PowerShell 5.1):
```powershell
@'
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const results = [];

function test(name, fn) {
  try {
    const res = fn();
    results.push({ check: name, status: res === true ? 'PASS' : 'FAIL', details: res === true ? 'OK' : String(res) });
  } catch (err) {
    results.push({ check: name, status: 'FAIL', details: err.message });
  }
}

// 1. Core directories and preserved files
test('Preserved directory: Hack_docs', () => fs.existsSync(path.join(root, 'Hack_docs', 'fixtures.json')));
test('Preserved file: PROGRESS.md', () => fs.existsSync(path.join(root, 'PROGRESS.md')));
test('Preserved file: Claude_chats.txt', () => fs.existsSync(path.join(root, 'Claude_chats.txt')));
test('Directory src/app exists', () => fs.existsSync(path.join(root, 'src', 'app')));
test('Directory src/lib exists', () => fs.existsSync(path.join(root, 'src', 'lib')));

// 2. Configuration files existence
test('File exists: package.json', () => fs.existsSync(path.join(root, 'package.json')));
test('File exists: components.json', () => fs.existsSync(path.join(root, 'components.json')));
test('File exists: tailwind.config.ts', () => fs.existsSync(path.join(root, 'tailwind.config.ts')));
test('File exists: postcss.config.mjs', () => fs.existsSync(path.join(root, 'postcss.config.mjs')));
test('File exists: tsconfig.json', () => fs.existsSync(path.join(root, 'tsconfig.json')));
test('File exists: .env', () => fs.existsSync(path.join(root, '.env')));
test('File exists: .env.example', () => fs.existsSync(path.join(root, '.env.example')));
test('File exists: .gitignore', () => fs.existsSync(path.join(root, '.gitignore')));
test('File exists: LICENSE', () => fs.existsSync(path.join(root, 'LICENSE')));

// 3. Package and version assertions
test('Next.js is version 14.x', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const v = pkg.dependencies?.next;
  return v && v.includes('14') ? true : `Expected 14.x, got ${v}`;
});

test('All production packages resolvable', () => {
  const prods = ['prisma', '@prisma/client', 'zod', 'framer-motion', 'lucide-react', 'class-variance-authority', 'clsx', 'tailwind-merge'];
  prods.forEach(p => require.resolve(p, { paths: [root] }));
  return true;
});

test('All dev packages resolvable', () => {
  const devs = ['tsx', 'better-sqlite3', '@types/better-sqlite3', '@types/node'];
  devs.forEach(p => require.resolve(p, { paths: [root] }));
  return true;
});

// 4. All 15 shadcn components exist in src/components/ui/
const components = ['button','card','badge','input','label','textarea','select','table','dialog','sheet','tabs','avatar','progress','separator','dropdown-menu'];
components.forEach(comp => {
  test(`shadcn UI component: ${comp}.tsx exists`, () => {
    return fs.existsSync(path.join(root, 'src', 'components', 'ui', `${comp}.tsx`)) || `Missing ${comp}.tsx`;
  });
});
test('shadcn utils helper: src/lib/utils.ts exists', () => fs.existsSync(path.join(root, 'src', 'lib', 'utils.ts')));

// 5. Exact package.json scripts
test('package.json scripts match specification', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const s = pkg.scripts || {};
  const required = {
    "dev": "next dev -p 8080",
    "build": "next build",
    "start": "next start -p 8080",
    "seed": "npx tsx src/lib/seed.ts",
    "db:migrate": "npx prisma migrate dev",
    "db:push": "npx prisma db push",
    "typecheck": "tsc --noEmit"
  };
  for (const [k, v] of Object.entries(required)) {
    if (s[k] !== v) return `Script mismatch for '${k}': expected '${v}', got '${s[k]}'`;
  }
  return true;
});

// 6. tsconfig alias verification
test('tsconfig.json has @/* alias configured', () => {
  const ts = JSON.parse(fs.readFileSync(path.join(root, 'tsconfig.json'), 'utf8'));
  return !!ts.compilerOptions?.paths?.['@/*'] || 'Missing @/* in compilerOptions.paths';
});

console.table(results);
const allPass = results.every(r => r.status === 'PASS');
console.log(`\nOVERALL: ${allPass ? 'ALL CHECKS PASSED (Milestone 1 Ready)' : 'CHECKS FAILED'}`);
process.exit(allPass ? 0 : 1);
'@ | node
```

### TypeScript Verification Command:
```powershell
npx tsc --noEmit
```
**Passing criteria**: Zero errors and exit code 0.
