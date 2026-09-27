const fs = require('fs');
const path = require('path');

const uiDir = path.join(process.cwd(), 'src', 'components', 'ui');
const files = fs.readdirSync(uiDir);

console.log('UI Component files found:', files.length);

const classRegex = /className={?cn\(([\s\S]*?)\)}?|cva\(([\s\S]*?)\)/g;
const stringRegex = /(["'`])((?:\\.|[^\\])*?)\1/g;

const allClasses = new Set();
const fileClasses = {};

files.forEach(file => {
  const content = fs.readFileSync(path.join(uiDir, file), 'utf8');
  fileClasses[file] = new Set();
  
  let match;
  while ((match = classRegex.exec(content)) !== null) {
    const block = match[1] || match[2] || '';
    let strMatch;
    while ((strMatch = stringRegex.exec(block)) !== null) {
      const str = strMatch[2];
      str.split(/\s+/).forEach(cls => {
        const clean = cls.trim();
        if (clean && !clean.includes('${') && !clean.includes('var(')) {
          allClasses.add(clean);
          fileClasses[file].add(clean);
        }
      });
    }
  }
});

console.log('\nTotal unique classes found:', allClasses.size);

// Check color-related classes
const colorTokens = new Set();
allClasses.forEach(cls => {
  const m = cls.match(/(?:bg|text|border|ring|outline|fill|stroke)-([a-z0-9-]+)(?:\/[0-9]+)?/);
  if (m) {
    colorTokens.add(m[1]);
  }
});

console.log('\nColor tokens extracted from UI components:');
console.log(Array.from(colorTokens).sort());

// Check for any potential Tailwind v4 only syntax
console.log('\nNotable or complex utility patterns:');
allClasses.forEach(cls => {
  if (cls.includes('@') || cls.includes(':') && (cls.includes('data-') || cls.includes('aria-') || cls.includes('has-') || cls.includes('in-') || cls.includes('group-') || cls.includes('['))) {
    // just sample a few
  }
});

// Let's test if Tailwind v3 can generate CSS for all extracted classes
const tailwindcss = require('tailwindcss');
const postcss = require('postcss');

const tailwindConfig = {
  content: [{ raw: Array.from(allClasses).join(' ') }],
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

postcss([tailwindcss(tailwindConfig)]).process('@tailwind utilities;', { from: undefined })
  .then(res => {
    console.log('\nTailwind generation for all UI classes: SUCCESS! CSS size:', res.css.length);
  })
  .catch(err => {
    console.error('\nTailwind generation for all UI classes: FAILED:', err.message);
  });
