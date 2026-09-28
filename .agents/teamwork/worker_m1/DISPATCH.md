## 2026-09-28T10:53:33Z
Your identity: Worker M1 (Global Design System — Midnight Obsidian Glass & Glass Navbar)
Working directory: d:\TP\Hackathon\DogFood\.agents\teamwork\worker_m1\
Project Root: d:\TP\Hackathon\DogFood

MANDATORY: Read d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md (specifically section ## 2026-09-28T10:45:46Z) before starting work. Do NOT summarize or filter it — pass the path as-is.
Also read C:\Users\ASUS\.gemini\frontend-rules.md for UI guidelines.
Also read the detailed Explorer blueprint in d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_survey_1\handoff.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write Ownership (You own these files exclusively):
- src/app/globals.css
- src/app/layout.tsx
- src/components/Navbar.tsx
- src/components/PageTransition.tsx

Instructions:
1. Update `src/app/globals.css`:
   - Set obsidian values for `:root` and `.dark` (`--background: #07090e`, `--card: #0a0d14`).
   - Add glass tokens:
     --glass-bg: rgba(255, 255, 255, 0.04);
     --glass-border: rgba(255, 255, 255, 0.08);
     --glass-border-accent: rgba(56, 189, 248, 0.3);
2. Create `src/components/Navbar.tsx`:
   - Must be a client component ('use client').
   - Contains:
     - Left: DOGFOOD 2026 link + "PORTAL" monospace badge.
     - Center: nav links for /projects, /judge, /dashboard with active state detection via usePathname().
     - Right: GitHub icon link (https://github.com/Vineetw07/dogfood-portal) + Sign In button linking to /login.
     - CRITICAL: lucide-react does NOT export Github. You MUST use an inline SVG for Github (see blueprint in explorer_survey_1/handoff.md).
3. Create `src/components/PageTransition.tsx`:
   - Must be a client component ('use client').
   - Uses Framer Motion `<motion.div>` with `useReducedMotion()`.
   - Animates opacity 0, y 10 -> opacity 1, y 0 with duration 0.35, ease: "easeOut".
4. Update `src/app/layout.tsx`:
   - Add `className="dark"` to `<html>`.
   - Add the ambient cyan/indigo bloom background div:
     `radial-gradient(ellipse 80% 50% at 50% -10%, rgba(56, 189, 248, 0.12), transparent)`
     with aria-hidden="true", pointer-events-none, -z-10.
   - Mount `<Navbar />`.
   - Wrap `{children}` in `<PageTransition>`.
   - Ensure local fonts (Geist Sans, Geist Mono) remain untouched.
5. Verification:
   - Run `npm run typecheck`
   - Run `npm run lint`
   - Ensure zero errors.
6. Atomic Git Commit (using PowerShell 5.1 syntax):
   `git add src/app/globals.css src/app/layout.tsx src/components/Navbar.tsx src/components/PageTransition.tsx ; git commit -m "[Phase5-R1] Midnight Obsidian global design system, glass navbar, Framer Motion page entrance"`
7. Write your handoff report to `d:\TP\Hackathon\DogFood\.agents\teamwork\worker_m1\handoff.md` and send a message back.
