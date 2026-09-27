const postcss = require('postcss');
const tailwindcss = require('tailwindcss');
const fs = require('fs');
const path = require('path');

async function testGlobalsWithImports() {
  const globalsCss = fs.readFileSync('src/app/globals.css', 'utf8');
  console.log('Original globals.css length:', globalsCss.length);

  // Let's test with the updated config but keeping the imports
  const config = {
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
      },
    },
    plugins: [],
  };

  // Replace outline-ring/50 with border-border only in globalsCss
  const modifiedCss1 = globalsCss.replace('@apply border-border outline-ring/50;', '@apply border-border;');
  try {
    const res1 = await postcss([tailwindcss(config)]).process(modifiedCss1, { from: 'src/app/globals.css' });
    console.log('Test with imports + @apply border-border: SUCCESS! output length:', res1.css.length);
  } catch (err) {
    console.error('Test with imports + @apply border-border: FAILED:', err.message);
  }

  // What about without the 2 imports?
  const modifiedCss2 = modifiedCss1
    .replace('@import "tw-animate-css";\n', '')
    .replace('@import "shadcn/tailwind.css";\n', '');
  try {
    const res2 = await postcss([tailwindcss(config)]).process(modifiedCss2, { from: 'src/app/globals.css' });
    console.log('Test WITHOUT imports: SUCCESS! output length:', res2.css.length);
  } catch (err) {
    console.error('Test WITHOUT imports: FAILED:', err.message);
  }
}

testGlobalsWithImports();
