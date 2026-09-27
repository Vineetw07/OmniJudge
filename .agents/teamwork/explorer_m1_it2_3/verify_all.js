const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = process.cwd();
const results = [];

function check(name, fn) {
  try {
    const res = fn();
    if (res === true) {
      results.push({ check: name, status: 'PASS', details: 'OK' });
    } else {
      results.push({ check: name, status: 'FAIL', details: String(res) });
    }
  } catch (err) {
    results.push({ check: name, status: 'FAIL', details: err.message });
  }
}

console.log('====================================================');
console.log('DOGFOOD 2026 - Milestone 1 Forensic Verification Suite');
console.log('====================================================\n');

// 1. Pre-existing file integrity
const preExistingFiles = [
  'Hack_docs/context.txt',
  'Hack_docs/example.dogfood.toml',
  'Hack_docs/fixtures.json',
  'Hack_docs/run.py',
  'Hack_docs/spec.md',
  'PROGRESS.md',
  'Claude_chats.txt'
];

preExistingFiles.forEach(relPath => {
  check(`Pre-existing file: ${relPath}`, () => {
    const fullPath = path.join(root, relPath);
    if (!fs.existsSync(fullPath)) return 'File missing';
    const stat = fs.statSync(fullPath);
    if (stat.size === 0) return 'File empty';
    return true;
  });
});

// 2. Scaffold structure & config files
const requiredConfigs = [
  'package.json',
  'tsconfig.json',
  'next.config.mjs',
  'components.json',
  'tailwind.config.ts',
  'postcss.config.mjs',
  '.env',
  '.env.example',
  '.gitignore',
  'LICENSE',
  'prisma/schema.prisma'
];

requiredConfigs.forEach(relPath => {
  check(`Config file exists: ${relPath}`, () => fs.existsSync(path.join(root, relPath)));
});

// 3. package.json scripts
check('package.json scripts conform to spec', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const required = {
    "dev": "next dev -p 8080",
    "build": "next build",
    "start": "next start -p 8080",
    "seed": "npx tsx src/lib/seed.ts",
    "db:migrate": "npx prisma migrate dev",
    "db:push": "npx prisma db push",
    "typecheck": "tsc --noEmit",
    "lint": "next lint"
  };
  for (const [k, v] of Object.entries(required)) {
    if (pkg.scripts?.[k] !== v) return `Mismatch on script '${k}': expected '${v}', got '${pkg.scripts?.[k]}'`;
  }
  return true;
});

// 4. Standalone output in next.config
check('next.config.mjs has output: "standalone"', () => {
  const content = fs.readFileSync(path.join(root, 'next.config.mjs'), 'utf8');
  return content.includes('standalone') ? true : 'standalone not configured';
});

// 5. 15 shadcn UI components exist
const uiComponents = [
  'avatar', 'badge', 'button', 'card', 'dialog',
  'dropdown-menu', 'input', 'label', 'progress', 'select',
  'separator', 'sheet', 'table', 'tabs', 'textarea'
];

uiComponents.forEach(comp => {
  check(`UI Component: ${comp}.tsx exists`, () => {
    return fs.existsSync(path.join(root, 'src', 'components', 'ui', `${comp}.tsx`));
  });
});

// 6. Inspect globals.css for v4 incompatibility and bad @apply
check('src/app/globals.css does not contain broken @apply or v4 imports', () => {
  const content = fs.readFileSync(path.join(root, 'src', 'app', 'globals.css'), 'utf8');
  if (content.includes('@import "shadcn/tailwind.css"') || content.includes("@import 'shadcn/tailwind.css'")) {
    return 'Contains Tailwind v4 import: @import "shadcn/tailwind.css"';
  }
  if (content.includes('@apply border-border outline-ring/50;')) {
    return 'Contains broken directive: @apply border-border outline-ring/50;';
  }
  return true;
});

// 7. Inspect tailwind.config.ts for required color tokens
check('tailwind.config.ts defines shadcn theme tokens', () => {
  const content = fs.readFileSync(path.join(root, 'tailwind.config.ts'), 'utf8');
  const requiredTokens = ['border', 'input', 'ring', 'background', 'foreground', 'primary', 'secondary', 'destructive', 'muted', 'accent', 'popover', 'card'];
  for (const token of requiredTokens) {
    if (!content.includes(token)) return `Missing token '${token}' in tailwind.config.ts`;
  }
  return true;
});

// Print interim results table
console.table(results);

const currentPass = results.every(r => r.status === 'PASS');
console.log(`\nStatic checks status: ${currentPass ? 'ALL PASS' : 'FAILURES DETECTED (Remediation Required)'}`);
