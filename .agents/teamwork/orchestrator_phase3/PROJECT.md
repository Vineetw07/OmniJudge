# Project: DOGFOOD 2026 — Phase 3 (T2 Judging)

## Architecture
- **Framework**: Next.js 14 App Router + TypeScript + Tailwind CSS / shadcn/ui.
- **Database & ORM**: SQLite (`prisma/dogfood.db`) via Prisma Client (`src/lib/prisma.ts`).
- **Auth Layer**: Custom session token validation against `Session` & `User` models in SQLite (`src/lib/auth.ts`). Strict server-side RBAC.
- **Data Flow**:
  - `GET /api/judge/scores`: Validates session. Blocks non-judges (403/401). If `?judge=...` != `session.id`, returns 403 Forbidden. Returns judge's own submitted scores.
  - `POST /api/judge/scores`: Authenticated judges submit rubric scores for assigned projects. Zod validation + Prisma transaction + AuditLog creation.
  - `GET /api/export.csv`: Restricted to `organizer`/`admin`. Computes MAD score normalization via `src/lib/normalization.ts` across all judges and projects. Streams valid CSV with comma in first line.
  - `/judge`: Server component portal for judges to view assigned projects, enter scores across rubric criteria, and submit.
  - `/dashboard`: Organizer command tower showing real-time judging progress, KPI cards, judge completion table, ranked leaderboard, and audit logs.

## Code Layout
- `src/lib/auth.ts`: Authentication utilities (`getSession`, `getServerSession`, role guards).
- `src/lib/normalization.ts`: MAD score normalization functions (`normaliseJudgeScores`, `normaliseAllJudges`).
- `src/lib/prisma.ts`: Prisma database client singleton.
- `src/app/api/judge/scores/route.ts`: Judge scoring API endpoint (`GET` & `POST`).
- `src/app/api/export.csv/route.ts`: Organizer CSV export API endpoint (`GET`).
- `src/app/judge/page.tsx`: Judge scoring and project review interface.
- `src/app/dashboard/page.tsx`: Organizer dashboard and analytics console.
- `PROGRESS.md`: Project ledger and phase tracker.

## Feature Inventory
| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|--------|
| 1 | Server Component Auth Helper | `getServerSession()` in `src/lib/auth.ts` using `cookies()` | M1 | Survey | DONE |
| 2 | Judge Scores GET API | `GET /api/judge/scores` returns 200 with own scores for authenticated judge | M1 | ORIGINAL_REQUEST R1 | DONE |
| 3 | Strict RBAC Peer Isolation | `GET /api/judge/scores?judge=user_jdg_a_01` returns 403 when accessed by judge_b | M1 | ORIGINAL_REQUEST R1 | DONE |
| 4 | Non-Judge Scores Blocking | `GET /api/judge/scores` returns 403 for participant and 401 for unauthenticated | M1 | ORIGINAL_REQUEST R1 | DONE |
| 5 | Judge Score Submission POST API | `POST /api/judge/scores` accepts rubric-based scores with Zod validation | M1 | ORIGINAL_REQUEST R2 | DONE |
| 6 | Track Assignment Enforcement | Verify judge is assigned to project's track before saving scores | M1 | ORIGINAL_REQUEST R2 | DONE |
| 7 | Immutable Audit Logging | Creates `AuditLog` entry (`action: "score_submitted"`) inside Prisma transaction | M1 | ORIGINAL_REQUEST R2 | DONE |
| 8 | Organizer CSV Export Access Control | `GET /api/export.csv` returns 403 for judges, participants, and anonymous | M2 | ORIGINAL_REQUEST R3 | DONE |
| 9 | MAD Score Normalization in CSV | Computes normalized scores using `src/lib/normalization.ts` with zero-variance protection | M2 | ORIGINAL_REQUEST R3 | DONE |
| 10 | CSV Header & Formatting | Valid CSV with comma in line 1 and UTF-8 charset | M2 | ORIGINAL_REQUEST R3 | DONE |
| 11 | Judge Portal UI | `/judge` responsive interface for assigned projects and rubric scoring | M3 | ORIGINAL_REQUEST R4 | DONE |
| 12 | Organizer Dashboard UI | `/dashboard` progress metrics, judge status table, and leaderboard preview | M3 | ORIGINAL_REQUEST R4 | DONE |
| 13 | Acceptance Suite Verification | `python Hack_docs/run.py .dogfood.toml` all 7 checks PASS (claimed T1 T2, verified T1 T2) | M4 | ORIGINAL_REQUEST Acceptance | DONE |
| 14 | Zero Type Errors | `npm run typecheck` exits with 0 errors | M4 | ORIGINAL_REQUEST Acceptance | DONE |
| 15 | Progress Ledger & Git Commit | Update `PROGRESS.md` with T2 deliverables and commit `[PROGRESS] Phase 3: ...` | M4 | ORIGINAL_REQUEST R5 | DONE |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Judge Scores API & RBAC Isolation | `src/lib/auth.ts`, `src/app/api/judge/scores/route.ts` | None | DONE |
| 2 | M2: Organizer CSV Export with MAD | `src/app/api/export.csv/route.ts` | M1 | DONE |
| 3 | M3: Judging Portal & Dashboard UI | `src/app/judge/page.tsx`, `src/app/dashboard/page.tsx` | M1, M2 | DONE |
| 4 | M4: Acceptance, Ledger & Git Commit | `Hack_docs/run.py`, `PROGRESS.md`, git commit | M1, M2, M3 | DONE |

## Interface Contracts
### Auth Helper Contract (`src/lib/auth.ts`)
```typescript
export async function getServerSession(): Promise<SessionUser | null>;
```
Reads session token from `cookies()` in `next/headers` and queries Prisma session.

### Judge Scores API Contract (`/api/judge/scores`)
- `GET /api/judge/scores`:
  - Query params: `?judge=<optional_userId>`
  - Headers: `Cookie: session=<token>`
  - Returns 200 JSON `{ scores: [...] }` if requesting own scores or organizer.
  - Returns 403 Forbidden if judge requests peer scores (`judge && judge !== session.id`).
  - Returns 403 Forbidden if participant.
  - Returns 401 Unauthorized if unauthenticated.
- `POST /api/judge/scores`:
  - Headers: `Cookie: session=<token>`
  - Body: `{ projectId: string, scores: Array<{ criterionId: string, value: number }>, comment?: string }`
  - Validates Zod schema.
  - Verifies judge track assignment.
  - Upserts score records in Prisma transaction.
  - Creates `AuditLog` row with `action: "score_submitted"`.

### CSV Export Contract (`/api/export.csv`)
- `GET /api/export.csv`:
  - Headers: `Cookie: session=<token>`
  - Returns 403 Forbidden if not organizer/admin. Returns 401 if unauthenticated.
  - Returns 200 with `Content-Type: text/csv; charset=utf-8`.
  - Header: `project_id,project_title,track,raw_score,normalized_score,rank`
