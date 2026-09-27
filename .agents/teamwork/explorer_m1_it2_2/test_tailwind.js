const postcss = require('postcss');
const tailwindcss = require('tailwindcss');

async function testConfig(config, css) {
  try {
    const result = await postcss([tailwindcss(config)]).process(css, { from: undefined });
    console.log('SUCCESS! Output length:', result.css.length);
    // Find border-border or outline-ring in output
    const lines = result.css.split('\n').filter(l => l.includes('border') || l.includes('outline') || l.includes('ring'));
    console.log('Sample output lines:', lines.slice(0, 10));
    return true;
  } catch (err) {
    console.error('FAILED:', err.message);
    return false;
  }
}

async function run() {
  const css = `
    @tailwind base;
    @tailwind components;
    @tailwind utilities;

    @layer base {
      * {
        @apply border-border outline-ring/50;
      }
    }
  `;

  console.log('--- Test 1: colors with var(--border) ---');
  await testConfig({
    content: [{ raw: '<div class="border-border bg-primary text-primary-foreground outline-ring/50"></div>' }],
    theme: {
      extend: {
        colors: {
          border: 'var(--border)',
          ring: 'var(--ring)',
          primary: {
            DEFAULT: 'var(--primary)',
            foreground: 'var(--primary-foreground)',
          }
        }
      }
    }
  }, css);

  console.log('--- Test 2: What about with @import "shadcn/tailwind.css" and @import "tw-animate-css"? ---');
  const cssWithImports = `
    @import "tw-animate-css";
    @import "shadcn/tailwind.css";
    @tailwind base;
    @tailwind components;
    @tailwind utilities;
    * {
      @apply border-border outline-ring/50;
    }
  `;
  await testConfig({
    content: [{ raw: '<div class="border-border"></div>' }],
    theme: {
      extend: {
        colors: {
          border: 'var(--border)',
          ring: 'var(--ring)'
        }
      }
    }
  }, cssWithImports);
}

run();
