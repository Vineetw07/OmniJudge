const postcss = require('postcss');
const tailwindcss = require('tailwindcss');

async function testApply(css, config) {
  try {
    const res = await postcss([tailwindcss(config)]).process(css, { from: undefined });
    return { ok: true, css: res.css };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function main() {
  const baseConfig = {
    content: [
      "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
      "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
      "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
      extend: {
        colors: {
          border: "var(--border)",
          input: "var(--input)",
          ring: "var(--ring)",
          background: "var(--background)",
          foreground: "var(--foreground)",
          primary: {
            DEFAULT: "var(--primary)",
            foreground: "var(--primary-foreground)",
          },
          secondary: {
            DEFAULT: "var(--secondary)",
            foreground: "var(--secondary-foreground)",
          },
          destructive: {
            DEFAULT: "var(--destructive)",
            foreground: "var(--destructive-foreground)",
          },
          muted: {
            DEFAULT: "var(--muted)",
            foreground: "var(--muted-foreground)",
          },
          accent: {
            DEFAULT: "var(--accent)",
            foreground: "var(--accent-foreground)",
          },
          popover: {
            DEFAULT: "var(--popover)",
            foreground: "var(--popover-foreground)",
          },
          card: {
            DEFAULT: "var(--card)",
            foreground: "var(--card-foreground)",
          },
        },
        borderRadius: {
          lg: "var(--radius)",
          md: "calc(var(--radius) - 2px)",
          sm: "calc(var(--radius) - 4px)",
        },
      },
    },
    plugins: [],
  };

  // Test 1: @apply border-border only
  const css1 = `
    @tailwind base;
    @tailwind components;
    @tailwind utilities;
    @layer base {
      * {
        @apply border-border;
      }
      body {
        @apply bg-background text-foreground;
      }
    }
  `;
  const res1 = await testApply(css1, baseConfig);
  console.log('Test 1 (@apply border-border):', res1.ok ? 'PASS' : 'FAIL: ' + res1.error);

  // Test 2: @apply border-border outline-ring/50
  const css2 = `
    @tailwind base;
    @tailwind components;
    @tailwind utilities;
    @layer base {
      * {
        @apply border-border outline-ring/50;
      }
    }
  `;
  const res2 = await testApply(css2, baseConfig);
  console.log('Test 2 (@apply border-border outline-ring/50):', res2.ok ? 'PASS' : 'FAIL: ' + res2.error);

  // Test 3: * { border-color: var(--border); } (pure CSS, no @apply)
  const css3 = `
    @tailwind base;
    @tailwind components;
    @tailwind utilities;
    @layer base {
      * {
        border-color: var(--border);
      }
      body {
        @apply bg-background text-foreground;
      }
    }
  `;
  const res3 = await testApply(css3, baseConfig);
  console.log('Test 3 (* { border-color: var(--border); }):', res3.ok ? 'PASS' : 'FAIL: ' + res3.error);

  // Test 4: Can Tailwind resolve ring-ring/50 when ring is var(--ring)?
  // Let's test classes in JSX content
  const configWithHtml = {
    ...baseConfig,
    content: [
      { raw: '<div class="border-border bg-card text-card-foreground bg-primary text-primary-foreground focus-visible:ring-ring/50"></div>' }
    ]
  };
  const css4 = `
    @tailwind utilities;
  `;
  const res4 = await testApply(css4, configWithHtml);
  console.log('Test 4 (Tailwind generating utilities):', res4.ok ? 'PASS' : 'FAIL: ' + res4.error);
  if (res4.ok) {
    console.log('Generated utilities for border-border, bg-card, bg-primary:');
    res4.css.split('\n').filter(l => l.includes('border') || l.includes('card') || l.includes('primary')).slice(0, 10).forEach(l => console.log('  ', l));
  }
}

main();
