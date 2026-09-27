import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function testPostCSSTokens() {
  console.log('--- Adversarial Test: PostCSS Token Resolution ---');
  let failures = 0;

  // 1. Test globals.css direct compilation through PostCSS
  const globalsCssPath = path.join(rootDir, 'src', 'app', 'globals.css');
  const globalsCss = fs.readFileSync(globalsCssPath, 'utf8');

  try {
    const result = await postcss([tailwindcss()]).process(globalsCss, {
      from: globalsCssPath,
    });
    console.log('[PASS] globals.css compiled successfully with PostCSS + Tailwind');
    
    // Verify that the generated CSS contains :root and .dark variables
    const css = result.css;
    const requiredVars = [
      '--background', '--foreground', '--card', '--card-foreground',
      '--popover', '--popover-foreground', '--primary', '--primary-foreground',
      '--secondary', '--secondary-foreground', '--muted', '--muted-foreground',
      '--accent', '--accent-foreground', '--destructive', '--destructive-foreground',
      '--border', '--input', '--ring', '--radius'
    ];

    for (const v of requiredVars) {
      if (!css.includes(v)) {
        console.error(`[FAIL] Compiled CSS missing variable: ${v}`);
        failures++;
      }
    }
    console.log(`[PASS] Verified ${requiredVars.length} core CSS variables exist in compiled globals.css`);
  } catch (err) {
    console.error('[FAIL] globals.css compilation failed:', err);
    failures++;
  }

  // 2. Test @apply resolution for all semantic tokens
  const testApplyCss = `
    @tailwind components;
    @tailwind utilities;

    .test-border { @apply border-border; }
    .test-bg { @apply bg-background text-foreground; }
    .test-card { @apply bg-card text-card-foreground; }
    .test-popover { @apply bg-popover text-popover-foreground; }
    .test-primary { @apply bg-primary text-primary-foreground; }
    .test-secondary { @apply bg-secondary text-secondary-foreground; }
    .test-muted { @apply bg-muted text-muted-foreground; }
    .test-accent { @apply bg-accent text-accent-foreground; }
    .test-destructive { @apply bg-destructive text-destructive-foreground; }
    .test-input { @apply border-input; }
    .test-ring { @apply ring-ring; }
    .test-sidebar { @apply bg-sidebar text-sidebar-foreground; }
    .test-chart { @apply bg-chart-1 bg-chart-2 bg-chart-3 bg-chart-4 bg-chart-5; }
    .test-radius { @apply rounded-sm rounded-md rounded-lg; }
    .test-animation { @apply animate-accordion-down animate-accordion-up; }
  `;

  try {
    const result = await postcss([tailwindcss()]).process(testApplyCss, {
      from: path.join(rootDir, 'tests', 'test_apply.css'),
    });
    console.log('[PASS] All 15 @apply rules with semantic tokens resolved without error');
    
    // Check that CSS custom properties are referenced in the generated rules
    const css = result.css;
    if (!css.includes('var(--border)')) {
      console.error('[FAIL] border-border did not resolve to var(--border)');
      failures++;
    }
    if (!css.includes('var(--background)')) {
      console.error('[FAIL] bg-background did not resolve to var(--background)');
      failures++;
    }
    if (!css.includes('var(--primary)')) {
      console.error('[FAIL] bg-primary did not resolve to var(--primary)');
      failures++;
    }
    if (!css.includes('var(--destructive)')) {
      console.error('[FAIL] bg-destructive did not resolve to var(--destructive)');
      failures++;
    }
    console.log('[PASS] Verified semantic token CSS variable references in generated rules');
  } catch (err) {
    console.error('[FAIL] @apply resolution failed:', err);
    failures++;
  }

  // 3. Test Base UI data variant resolution
  const testVariantsCss = `
    @tailwind utilities;

    .test-open { @apply data-open:opacity-100; }
    .test-closed { @apply data-closed:opacity-0; }
    .test-checked { @apply data-checked:bg-primary; }
    .test-disabled { @apply data-disabled:pointer-events-none; }
  `;

  try {
    const result = await postcss([tailwindcss()]).process(testVariantsCss, {
      from: path.join(rootDir, 'tests', 'test_variants.css'),
    });
    console.log('[PASS] Custom Base UI data variants resolved successfully without PostCSS error');
  } catch (err) {
    console.error('[FAIL] Data variants resolution failed:', err);
    failures++;
  }

  if (failures > 0) {
    console.error(`\nFAILED with ${failures} error(s)`);
    process.exit(1);
  } else {
    console.log('\nALL POSTCSS & TOKEN RESOLUTION TESTS PASSED');
    process.exit(0);
  }
}

testPostCSSTokens();
