# Comprehensive Code Quality & Adversarial Security Audit (R1)
**Project:** DOGFOOD 2026 Hackathon Portal  
**Target Directory:** `d:\TP\Hackathon\DogFood`  
**Auditor Archetype:** Explorer (Code Quality Auditor)  
**Date:** 2026-09-27  

---

## Executive Summary

An exhaustive adversarial static analysis and runtime audit of the DOGFOOD 2026 codebase was conducted across all source files in `src/`, `prisma/`, and `tests/`. The audit evaluated TypeScript correctness, logic and RBAC isolation in API routes, optional chaining safety, mathematical normalization invariants, database schema constraints, and compilation health.

**Core Findings Verdict:**
1. **Compilation & Typecheck Health:** Clean pass. `npm run typecheck` exits with code 0 (zero errors); `npm run lint` reports zero ESLint warnings or errors; `npm run build` succeeds across all 9 App Router routes.
2. **Acceptance & Adversarial Test Coverage:** 100% verification across official acceptance suite (`Hack_docs/run.py` - 7/7 PASS), Phase 3 adversarial suite (47/47 PASS), Challenger 2 suite (35/35 PASS), and mathematical MAD unit tests (100% PASS).
3. **RBAC Isolation Invariant:** Strict server-side enforcement. `GET /api/judge/scores?judge=user_jdg_a_01` returns HTTP 403 Forbidden when accessed by `judge_b` prior to any database access. Participant and unauthenticated requests are strictly blocked with 403 and 401 respectively.
4. **Identified Code Quality Defects & Observations:**
   - **Empty Catch Block:** `src/app/dashboard/page.tsx:240` contains an empty catch block (`catch { // Keep raw string if not JSON }`).
   - **Hardcoded Fallback Entity ID:** `src/app/api/projects/route.ts:131` falls back to `'trk_01'` via `defaultTrack?.id || 'trk_01'` if no track is found, violating the rule against hardcoded IDs that should originate from the database.
   - **Missing Compound Unique Constraint in Schema:** `prisma/schema.prisma` lacks `@@unique([judgeId, projectId, criterionId])` on the `Score` model, leaving score upserts reliant on application-level `findFirst` checks rather than database-level uniqueness.
   - **Unbranded Root Route:** `src/app/page.tsx` retains default Next.js boilerplate rather than redirecting to `/projects` or displaying a hackathon hero page.
   - **Sub-Epsilon Floating Point Tie-Breaking:** In `src/app/api/export.csv/route.ts`, normalized scores are sorted using unrounded IEEE 754 floats before formatting with `.toFixed(4)`, occasionally causing raw score tie-break inversions for values that round to the same 4th decimal place.

---

## 1. TypeScript Correctness & Anti-Pattern Audit

### 1.1 Suppression Comments (`@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `eslint-disable`)
- **Query:** Searched across all files in `src/` for `@ts-` and `eslint-disable`.
- **Result:** **0 matches found.**
- **Observation:** No TypeScript errors are suppressed, and no linter rules are disabled anywhere in application code.

### 1.2 Unsafe Type Assertions (`as any`, `as unknown as X`)
- **Query:** Searched across all files in `src/` for `as any` and `as unknown`.
- **Result:**
  - `as any`: **0 occurrences** in `src/`.
  - `as unknown`: **1 occurrence** in `src/lib/prisma.ts:8`:
    ```typescript
    const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
    ```
    *Assessment:* Standard Next.js singleton pattern explicitly prescribed in Phase 1 specification; fully safe.
  - Safe cast in `src/lib/auth.ts:40`: `const role = session.user.role as SessionUser['role'];`.
  - Cast in `src/lib/seed.ts:201`: `value: value as number`.
- **Observation:** Zero occurrences of arbitrary `any` casting in application logic.

### 1.3 Catch Blocks Inspection
Every catch block across `src/` was inspected:

| File | Line | Implementation | Audit Verdict |
|---|---|---|---|
| `src/app/api/projects/route.ts` | 61 | `try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 }); }` | **PASS**: Returns HTTP 400. |
| `src/app/api/auth/login/route.ts` | 20 | `try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 }); }` | **PASS**: Returns HTTP 400. |
| `src/app/api/judge/scores/route.ts` | 157 | `try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 }); }` | **PASS**: Returns HTTP 400. |
| `src/app/login/page.tsx` | 49 | `catch (err: unknown) { if (err instanceof Error) setErrorMessage(err.message); else setErrorMessage(...); }` | **PASS**: Handled and displayed to user. |
| `src/app/judge/judge-portal-client.tsx` | 214 | `catch (err: unknown) { setStatusMessage({ type: 'error', text: ... }); }` | **PASS**: Handled and displayed to user. |
| `src/lib/seed.ts` | 259 | `.catch((e) => { console.error('Seed failed:', e); process.exit(1); })` | **PASS**: Logged and process terminated with exit code 1. |
| `src/app/dashboard/page.tsx` | 240 | `try { const parsed = JSON.parse(log.payload); ... } catch { // Keep raw string if not JSON }` | **DEFECT (Minor)**: Empty catch block. Does not re-throw or log error. |

### 1.4 Unhandled Promises & Async Safety
- All asynchronous calls (`prisma.*`, `req.json()`, `fetch()`, `crypto`) are strictly awaited.
- `Promise.all` is used cleanly in `src/app/dashboard/page.tsx` (line 54) and `src/app/api/export.csv/route.ts` (line 42).
- `prisma.$transaction` in `src/app/api/judge/scores/route.ts` (lines 220–267) is properly awaited and encapsulates score upserts and audit log recording atomically.

---

## 2. API Routes & Core Libraries Logic Audit

### 2.1 `src/app/api/judge/scores/route.ts`
#### GET Method:
- **Authentication Guard (Lines 34–40):**
  ```typescript
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized: Valid session required' }, { status: 401 });
  }
  ```
  Returns 401 Unauthorized for unauthenticated requests.
- **Role Isolation Guard (Lines 43–52):**
  ```typescript
  if (session.role !== 'judge' && session.role !== 'organizer' && session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Only judges and organizers can access judging scores' }, { status: 403 });
  }
  ```
  Participants and visitors are blocked with 403 Forbidden before any database query is issued.
- **Judge Peer Isolation (Lines 57–64):**
  ```typescript
  if (session.role === 'judge') {
    if (targetJudge && targetJudge !== session.id) {
      return NextResponse.json({ error: 'Forbidden: Cannot view peer judge scores' }, { status: 403 });
    }
    const scores = await prisma.score.findMany({ where: { judgeId: session.id }, ... });
    return NextResponse.json({ scores });
  }
  ```
  - Directly compares `targetJudge` with `session.id`.
  - When `judge_b` passes `?judge=user_jdg_a_01`, `targetJudge !== session.id` triggers 403 Forbidden.
  - If `targetJudge` is omitted or equal to `session.id`, returns only `session.id`'s scores.
  - If `targetJudge === ""` (empty string), `targetJudge && ...` is falsy, querying only `session.id`'s scores.
- **Organizer Path (Lines 93–126):**
  - Allows filtering by `judgeId: targetJudge` or viewing all scores.

#### POST Method:
- Authenticates session (401) and checks role (403 for non-judge/non-organizer).
- Validates payload with Zod `SubmitScoresSchema.strict()`:
  - `projectId`: non-empty string.
  - `scores`: array of `{ criterionId, value: 0..5 }`, min 1 item. Extraneous keys rejected.
  - `comment`: max 2000 chars.
- Validates project exists (404 Not Found if missing).
- **Track Assignment RBAC Check (Lines 188–204):**
  - Confirms judge is assigned to `project.trackId`. Returns 403 Forbidden if not assigned.
- Validates all `criterionIds` exist in `rubricCriterion` table (400 if invalid).
- Executes atomic transaction:
  - Iterates over criteria, performing `findFirst` and then `update` or `create`.
  - Writes immutable `AuditLog` entry with `action: 'score_submitted'`.

### 2.2 `src/app/api/export.csv/route.ts`
- **Access Control (Lines 25–39):**
  - Unauthenticated returns 401.
  - Non-organizers (judges, participants, visitors) return 403 Forbidden before any DB access.
- **CSV Output Compliance (Lines 155–177):**
  - Header: `project_id,project_title,track,raw_score,normalized_score,rank`.
  - Line 1 contains commas, meeting `run.py` Check 7 requirements.
  - Correct MIME type: `Content-Type: text/csv; charset=utf-8`.
  - Proper CSV field escaping (`escapeCsvField` for commas, quotes, line breaks).
- **Score Normalization Workflow:**
  - Evaluates weighted composite score per judge-project review: `stats.weightedSum / stats.weightTotal`.
  - Applies `normaliseAllJudges(judgeRawMap)`.
  - Aggregates average raw score and average normalized score per project.
  - Ranks 1..N. Zero NaN or undefined values present.

### 2.3 `src/app/api/projects/route.ts`
- **Access Control (Lines 40–55):**
  - Unauthenticated returns 401.
  - Judges and visitors return 403.
- **Deadline Enforcement (Lines 79–102):**
  - Reads `event.submissionsClose` from SQLite database.
  - Compares `new Date(event.submissionsClose).getTime() < Date.now()`.
  - Because fixture date is `2026-03-01T18:00:00Z` (past), returns 409 Conflict with timestamp details.
- **Track ID Fallback Defect (Lines 130–132):**
  ```typescript
  const defaultTrack = await prisma.track.findFirst({ where: { eventId: event.id } });
  trackId = defaultTrack?.id || 'trk_01';
  ```
  *Defect:* If `defaultTrack` is not found, it silently falls back to `'trk_01'`. If `'trk_01'` is not present in the database, this triggers a foreign key constraint violation.

### 2.4 `src/app/api/auth/login/route.ts`
- **Zod Schema:** `z.string().trim().toLowerCase().email('Invalid email address')`.
  - Trimming runs before email validation.
- User lookup: Returns 401 if user email is not found in database.
- Session cookie configuration:
  - `httpOnly: true`, `path: '/'`, `sameSite: 'lax'`, `secure: false`.
  - Allows session cookie persistence over plain HTTP on port 8080.

### 2.5 `src/lib/auth.ts`, `src/lib/prisma.ts`, `src/lib/normalization.ts`
- **`src/lib/auth.ts`:**
  - Implements both `getSession(req: NextRequest)` and `getServerSession()`.
  - Fallback regex parser `extractSessionFromCookieHeader` handles bare `Cookie: session=<token>` headers sent by python `urllib`.
  - `judgeId` populated when `role === 'judge'`.
- **`src/lib/prisma.ts`:**
  - Singleton implementation attached to `globalThis` in development.
- **`src/lib/normalization.ts`:**
  - Correct median calculation for odd (`sorted[mid]`) and even (`(sorted[mid-1] + sorted[mid]) / 2`) lengths.
  - Zero-variance handling: `if (mad === 0) return scores.map(() => 0);`. Eliminates divide-by-zero crashes.
  - Output maps project IDs and matrix structure consistently.

---

## 3. Optional Chaining (`?.`) Safety Audit

A complete scan identified 23 occurrences of `?.`. Every instance was audited:

| Category | Locations | Purpose | Risk Assessment |
|---|---|---|---|
| **Cookie Parsing** | `src/lib/auth.ts:28, 57` | `sessionCookie?.value`, `cookieStore.get('session')?.value` | **Safe**: Standard handling of optional cookie tokens. |
| **Role Guard Helpers** | `src/lib/auth.ts:94, 98, 102` | `user?.role === ...` | **Safe**: Guard clauses taking `SessionUser \| null`. |
| **Relation Fallbacks** | `src/app/projects/page.tsx:86, 97`, `src/app/judge/page.tsx:108, 109`, `src/app/dashboard/page.tsx:160, 161`, `src/app/api/export.csv/route.ts:136` | `project.track?.name \|\| 'General'`, `project.team?.name \|\| 'Independent'` | **Safe**: Defensive presentation formatting for nullable relations. |
| **Map Lookups** | `src/app/dashboard/page.tsx:136`, `src/app/api/export.csv/route.ts:116`, `src/app/judge/judge-portal-client.tsx:122, 151` | `judgeNormMap.get(judgeId)?.get(project.id)`, `scoresMap.get(projectId)?.size` | **Safe**: Safe nested map navigation. |
| **JSON Payload Parsing** | `src/app/dashboard/page.tsx:235` | `parsed.scores?.length \|\| 0` | **Safe**: Audits arbitrary JSON payloads safely. |
| **Audit User Presentation** | `src/app/dashboard/page.tsx:247-249` | `log.user?.name \|\| log.userId` | **Safe**: Fallback to raw user ID if relation not populated. |
| **Entity Lookup Fallback** | `src/app/api/projects/route.ts:110` | `teamId = membership?.teamId;` | **Safe**: If null, creates new team for user. |
| **Entity Lookup Fallback** | `src/app/api/projects/route.ts:131` | `trackId = defaultTrack?.id \|\| 'trk_01';` | **DEFECT**: Silently masks missing track and falls back to hardcoded string `'trk_01'`. |

---

## 4. Database Schema & Data Integrity Audit

### 4.1 Schema Verification (`prisma/schema.prisma`)
All 11 required models are defined with exact field names and types:
`User`, `Session`, `Event`, `Track`, `Team`, `TeamMember`, `Project`, `RubricCriterion`, `JudgeAssignment`, `Score`, `AuditLog`.

### 4.2 Data Integrity Gap
- The `Score` model is defined as:
  ```prisma
  model Score {
    id          String   @id @default(cuid())
    judgeId     String
    projectId   String
    criterionId String
    value       Float
    comment     String   @default("")
    submittedAt DateTime @default(now())
    ...
  }
  ```
- **Finding:** There is no database-level unique constraint on `[judgeId, projectId, criterionId]`.
- **Impact:** In `POST /api/judge/scores`, the application performs `findFirst` followed by `update` or `create`. Under high-concurrency race conditions, duplicate scores for the same criterion could be inserted. Adding `@@unique([judgeId, projectId, criterionId])` ensures ACID-level uniqueness at the SQLite layer.

---

## 5. Verification Matrix & Test Execution Summary

| Verification Target | Command | Result | Notes |
|---|---|---|---|
| **TypeScript Typecheck** | `npm run typecheck` | **PASS (0 errors)** | Full compilation typecheck cleanly passes. |
| **Next.js Linter** | `npm run lint` | **PASS (0 errors)** | Zero warnings or ESLint rule violations. |
| **Next.js Production Build** | `npm run build` | **PASS** | Standalone production bundle generated for all 9 routes. |
| **Official Acceptance Suite** | `python Hack_docs/run.py .dogfood.toml` | **PASS (7/7)** | Verified T1 and T2 tiers completely pass. |
| **Phase 3 Adversarial Probes** | `python tests/test_phase3_adversarial.py` | **PASS (47/47)** | 47 boundary probes (RBAC, SQLi, bad cookies, payload tampering). |
| **Phase 3 Challenger Suite** | `python tests/test_phase3_challenger2_full.py` | **PASS (35/35)** | Mathematical and security challenger checks. |
| **MAD Mathematical Invariants** | `npx tsx tests/test_mad_mathematical.ts` | **PASS (100%)** | Zero-variance, odd/even median, order preservation. |

---

## 6. Recommendations & Remediation Plan

1. **Fix Empty Catch in Dashboard (`src/app/dashboard/page.tsx:240`):**
   Explicitly log or handle invalid JSON payload string:
   ```typescript
   } catch (err) {
     // Retain raw string payload if JSON parsing fails
   }
   ```
2. **Remove Hardcoded Entity ID in Projects API (`src/app/api/projects/route.ts:131`):**
   Replace `'trk_01'` fallback with an explicit validation error:
   ```typescript
   if (!defaultTrack) {
     return NextResponse.json({ error: 'No active tracks found for event' }, { status: 400 });
   }
   trackId = defaultTrack.id;
   ```
3. **Database Constraint Hardening (`prisma/schema.prisma`):**
   Add compound unique index to `Score`:
   ```prisma
   @@unique([judgeId, projectId, criterionId])
   ```
4. **Branded Root Route (`src/app/page.tsx`):**
   Replace create-next-app boilerplate with a redirect to `/projects` or a dedicated landing page for DOGFOOD 2026.
