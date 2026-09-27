const fs = require('fs');
const path = require('path');
const root = 'd:/TP/Hackathon/DogFood';
const results = [];
function test(name, fn) {
  try {
    const res = fn();
    results.push({ check: name, status: res === true ? 'PASS' : 'FAIL', details: res === true ? 'OK' : String(res) });
  } catch (err) {
    results.push({ check: name, status: 'FAIL', details: err.message });
  }
}
test('Preserved directory: Hack_docs', () => fs.existsSync(path.join(root, 'Hack_docs', 'fixtures.json')));
test('Preserved file: PROGRESS.md', () => fs.existsSync(path.join(root, 'PROGRESS.md')));
test('Preserved file: Claude_chats.txt', () => fs.existsSync(path.join(root, 'Claude_chats.txt')));
test('Directory src/app exists', () => fs.existsSync(path.join(root, 'src', 'app')));
test('Directory src/lib exists', () => fs.existsSync(path.join(root, 'src', 'lib')));
test('File exists: package.json', () => fs.existsSync(path.join(root, 'package.json')));
test('File exists: components.json', () => fs.existsSync(path.join(root, 'components.json')));
test('File exists: tailwind.config.ts', () => fs.existsSync(path.join(root, 'tailwind.config.ts')));
test('File exists: postcss.config.mjs', () => fs.existsSync(path.join(root, 'postcss.config.mjs')));
test('File exists: tsconfig.json', () => fs.existsSync(path.join(root, 'tsconfig.json')));
test('File exists: .env', () => fs.existsSync(path.join(root, '.env')));
test('File exists: .env.example', () => fs.existsSync(path.join(root, '.env.example')));
test('File exists: .gitignore', () => fs.existsSync(path.join(root, '.gitignore')));
test('File exists: LICENSE', () => fs.existsSync(path.join(root, 'LICENSE')));
test('Next.js is version 14.x', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  return pkg.dependencies?.next?.includes('14') ? true : 'Not 14.x';
});
test('All production packages resolvable', () => {
  ['prisma', '@prisma/client', 'zod', 'framer-motion', 'lucide-react', 'class-variance-authority', 'clsx', 'tailwind-merge'].forEach(p => require.resolve(p, { paths: [root] }));
  return true;
});
test('All dev packages resolvable', () => {
  ['tsx', 'better-sqlite3', '@types/better-sqlite3', '@types/node'].forEach(p => {
    require.resolve(p.startsWith('@types/') ? `${p}/package.json` : p, { paths: [root] });
  });
  return true;
});
['button','card','badge','input','label','textarea','select','table','dialog','sheet','tabs','avatar','progress','separator','dropdown-menu'].forEach(comp => {
  test(`shadcn UI component: ${comp}.tsx exists`, () => fs.existsSync(path.join(root, 'src', 'components', 'ui', `${comp}.tsx`)));
});
test('shadcn utils helper: src/lib/utils.ts exists', () => fs.existsSync(path.join(root, 'src', 'lib', 'utils.ts')));
test('package.json scripts match specification', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const s = pkg.scripts || {};
  const required = {
    "dev": "next dev -p 8080", "build": "next build", "start": "next start -p 8080",
    "seed": "npx tsx src/lib/seed.ts", "db:migrate": "npx prisma migrate dev",
    "db:push": "npx prisma db push", "typecheck": "tsc --noEmit"
  };
  for (const [k, v] of Object.entries(required)) {
    if (s[k] !== v) return `Script mismatch for '${k}'`;
  }
  return true;
});
test('tsconfig.json has @/* alias configured', () => {
  const ts = JSON.parse(fs.readFileSync(path.join(root, 'tsconfig.json'), 'utf8'));
  return !!ts.compilerOptions?.paths?.['@/*'];
});
console.table(results);
const allPass = results.every(r => r.status === 'PASS');
console.log(`\nOVERALL: ${allPass ? 'ALL CHECKS PASSED (Milestone 1 Ready)' : 'CHECKS FAILED'}`);
process.exit(allPass ? 0 : 1);
