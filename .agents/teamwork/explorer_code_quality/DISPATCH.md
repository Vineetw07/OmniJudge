## 2026-09-27T10:27:22Z
You are the Code Quality Auditor for the DOGFOOD 2026 Hackathon Portal comprehensive adversarial review.
Your working directory is: d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_code_quality
You MUST read:
- d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md (especially header ## 2026-09-27T10:24:12Z)
- d:\TP\Hackathon\DogFood\PROGRESS.md
- d:\TP\Hackathon\DogFood\Hack_docs\spec.md
- All source files in d:\TP\Hackathon\DogFood\src\ and d:\TP\Hackathon\DogFood\prisma\

Your mission is R1: Code Quality Audit:
1. TypeScript correctness:
   - Check every source file for empty catch blocks, @ts-ignore, // eslint-disable, unsafe type assertions (`as any`, `as unknown as X`), unhandled promises, and implicit anys.
2. Logic inspection in API routes:
   - Specifically audit `src/app/api/judge/scores/route.ts` (GET & POST)
   - Audit `src/app/api/export.csv/route.ts`
   - Audit `src/app/api/projects/route.ts`
   - Audit `src/app/api/auth/login/route.ts`
   - Audit `src/lib/auth.ts`, `src/lib/prisma.ts`, `src/lib/normalization.ts`
3. Optional chaining check:
   - Inspect all uses of `?.` optional chaining. Verify whether any `?.` is suppressing what should be a hard error, unhandled null/undefined state, or missing error boundary.
4. Verify build and typecheck status:
   - Run typecheck inspection (`npm run typecheck` using PowerShell syntax) to confirm clean compilation.
5. Record your exhaustive findings in:
   - `d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_code_quality\analysis.md`
   - `d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_code_quality\handoff.md`
6. Send a message to parent when complete with a summary of findings.
