# Handoff Report — Phase 3 (T2 Judging) Normalization, AuditLog & UI Exploration

**Agent**: Survey Explorer 3  
**Working Directory**: `d:\TP\Hackathon\DogFood\.agents\teamwork\explorer_survey_3`  
**Target Milestone**: Phase 3 — T2 Judging Architecture, APIs, Normalization & UI  
**Target Recipient**: Phase 3 Orchestrator (`11b8f726-9a5b-4133-ab58-3e8b73870dcf`)

---

## 1. Observation

### 1.1 Normalization Implementation (`src/lib/normalization.ts`)
- **Exported Functions** (lines 30, 66):
  1. `export function normaliseJudgeScores(scores: number[]): number[]` (line 30)
  2. `export function normaliseAllJudges(judgeScores: Map<string, Map<string, number>>): Map<string, Map<string, number>>` (line 66)
- **Mathematical Formula** (lines 14–18, 57):
  - Constant: $0.6745 \approx \Phi^{-1}(0.75)$ (normal distribution consistency factor).
  - Modified Z-Score: $\text{modified\_z}_i = 0.6745 \times \frac{x_i - \text{median}}{MAD}$.
- **Zero-Variance Guard** (lines 51–56):
  ```typescript
  // Zero-variance guard: judge gave every project the same score.
  // Return neutral zeros — no signal, no crash.
  if (mad === 0) {
    return scores.map(() => 0);
  }
  ```
- **Verification of Edge Cases**:
  - `normaliseJudgeScores([])` $\to$ `[]`
  - `normaliseJudgeScores([5])` $\to$ `[0]`
  - `normaliseJudgeScores([3, 3, 3, 3])` $\to$ `[0, 0, 0, 0]`
  - `normaliseJudgeScores([1, 2, 3, 4, 5])` $\to$ `[-1.349, -0.6745, 0, 0.6745, 1.349]`
- **Seeded Dataset Reality**:
  - In `fixtures.json`, judges with zero variance include `jdg_07` (scores: `[12, 12, 12]`), `jdg_01` (scores: `[6]`), `jdg_23` (scores: `[10]`). All result in $MAD = 0$ and return zeroes.
  - Across all 30 seeded judges, applying `normaliseAllJudges()` produced exactly 30 normalized judge maps with zero NaN values or runtime crashes.

### 1.2 AuditLog Schema & Score Submission Precedents
- **Schema Definition in `prisma/schema.prisma`** (lines 119–127):
  ```prisma
  model AuditLog {
    id        String   @id @default(cuid())
    userId    String
    action    String   // e.g. "score_submitted"
    payload   String   @default("{}")
    createdAt DateTime @default(now())

    user User @relation(fields: [userId], references: [id])
  }
  ```
- **Existing Precedent in `src/app/api/projects/route.ts`** (lines 150–156):
  ```typescript
  await prisma.auditLog.create({
    data: {
      userId: session.id,
      action: 'PROJECT_SUBMIT',
      payload: JSON.stringify({ projectId, title: data.title }),
    },
  });
  ```
- **Constraint Observation in `prisma/schema.prisma`** (lines 105–117):
  - Model `Score` does **not** have a compound unique constraint on `@@unique([judgeId, projectId, criterionId])`.
  - In `src/lib/seed.ts` (lines 187–197), score upserting requires finding existing records via `prisma.score.findFirst({ where: { judgeId, projectId, criterionId } })` before deciding to update or create.

### 1.3 CSV Export Structure & Acceptance Invariants
- **Acceptance Checker Rule in `Hack_docs/run.py`** (lines 174–186):
  ```python
  c = Check("T2", "csv export works")
  status, body = request(url("csv_export"), header=auth.get("organizer"))
  first_line = body.splitlines()[0] if body.splitlines() else ""
  c.ok = status == 200 and "," in first_line
  ```
- **Route Mapping in `.dogfood.toml`** (line 19):
  `csv_export = "/api/export.csv"`
- **RBAC Requirement from `Hack_docs/spec.md` and `dogfood_build_plan.md`**:
  - `GET /api/export.csv` must return `200 OK` for `organizer` / `admin`.
  - Non-organizers (`judge_a`, `judge_b`, `participant`, anonymous visitor) must receive `403 Forbidden` (`401 Unauthorized` if unauthenticated).

### 1.4 UI Requirements for `/judge` and `/dashboard`
- **Spec Directives in `Hack_docs/spec.md` & `dogfood_build_plan.md`**:
  - `/judge`:
    - Role isolation: Accessible to authenticated judges only (non-judges redirected or 403).
    - Track filtering: Judges only see projects assigned to their tracks (`JudgeAssignment`).
    - Rubric form: Dynamic rubric criteria (`RubricCriterion` table) with weights and max scores, score input (0 to 5), qualitative comment field, submission action.
    - Isolation boundary: Judges see only their own prior scores, never scores of other judges.
  - `/dashboard`:
    - Restricted to `organizer` / `admin`.
    - Live judging progress metrics: Total Projects, Scored Projects, Total Reviews, Active Judges / Judge Completion Rate.
    - Judge Completion Status table: Judge name, assigned tracks, total assigned, completed, pending.
    - Leaderboard preview: Ranked projects displaying Raw Score and MAD Normalized Score.
    - Export CSV CTA button: direct link to `/api/export.csv`.
    - Audit Trail table: Recent `AuditLog` records.

---

## 2. Logic Chain

### 2.1 Multi-Judge Multi-Rubric Score Aggregation & Ranking Math
1. **Rubric Weighting per Project Evaluation**:
   - Each project $p$ scored by judge $j$ has individual criterion scores $v_{j, p, c}$ for criteria $c \in C$ with weights $w_c$ (from `RubricCriterion`: functionality=1.5, quality=1.0, creativity=1.0, presentation=0.5; $\sum w_c = 4.0$).
   - The judge's composite raw score for project $p$ is the weighted mean:
     $$S(j, p) = \frac{\sum_{c \in C} w_c \cdot v_{j, p, c}}{\sum_{c \in C} w_c}$$
2. **Judge Normalization via MAD**:
   - For each judge $j$, gather their evaluated project scores $\{ S(j, p) \mid p \in P_j \}$.
   - Pass the score vector into `normaliseJudgeScores(scores)` (or matrix into `normaliseAllJudges()`).
   - If a judge gave identical scores to all their projects, or only reviewed 1 project, $MAD = 0$ and the function returns $0$ for all their projects.
   - If $MAD > 0$, each raw score $S(j, p)$ is converted into modified z-score:
     $$Z(j, p) = 0.6745 \times \frac{S(j, p) - \text{median}(S_j)}{MAD(S_j)}$$
3. **Cross-Judge Project Aggregation**:
   - For each project $p$ evaluated by judge set $J_p = \{ j \mid \text{judge } j \text{ scored project } p \}$:
     - Average Raw Score:
       $$\text{RawScore}(p) = \begin{cases} \frac{1}{|J_p|} \sum_{j \in J_p} S(j, p) & \text{if } |J_p| > 0 \\ 0 & \text{otherwise} \end{cases}$$
     - Average Normalized Score:
       $$\text{NormalizedScore}(p) = \begin{cases} \frac{1}{|J_p|} \sum_{j \in J_p} Z(j, p) & \text{if } |J_p| > 0 \\ 0 & \text{otherwise} \end{cases}$$
4. **Ranking Algorithm**:
   - Order all projects descending by $\text{NormalizedScore}(p)$.
   - Break ties by $\text{RawScore}(p)$ descending, then by `project.id` ascending.
   - Assign integer rank $1 \dots N$.

### 2.2 AuditLog Data Contract & Invariants
1. **Model Requirement**:
   - Target table: `AuditLog` (`id`, `userId`, `action`, `payload`, `createdAt`).
2. **Payload Design for `action: "score_submitted"`**:
   - Must be JSON-serialized into the `payload` string field.
   - Recommended payload structure:
     ```json
     {
       "projectId": "prj_01",
       "trackId": "trk_01",
       "scores": [
         { "criterionId": "crit_func", "criterionName": "functionality", "value": 4.5, "weight": 1.5 },
         { "criterionId": "crit_qual", "criterionName": "quality", "value": 4.0, "weight": 1.0 },
         { "criterionId": "crit_creat", "criterionName": "creativity", "value": 3.5, "weight": 1.0 },
         { "criterionId": "crit_pres", "criterionName": "presentation", "value": 5.0, "weight": 0.5 }
       ],
       "rawCompositeScore": 4.125,
       "comment": "Well documented and clean implementation.",
       "submittedAt": "2026-09-27T15:00:00.000Z"
     }
     ```
3. **Atomicity**:
   - In `POST /api/judge/scores`, the database operation must be wrapped in `prisma.$transaction`: all `Score` record creations/updates and the `AuditLog` creation must succeed or roll back together.

### 2.3 CSV Export Specification
1. **Endpoint**: `src/app/api/export.csv/route.ts` matching `.dogfood.toml` (`/api/export.csv`).
2. **Headers & MIME**:
   - `Content-Type: text/csv; charset=utf-8`
   - `Content-Disposition: attachment; filename="dogfood_scores.csv"`
   - `Cache-Control: no-store, max-age=0`
3. **Format & Line Endings**:
   - Line endings: Standard CRLF (`\r\n`) or LF (`\n`). RFC 4180 standard `\r\n` recommended.
   - First line: Header line containing comma:
     `project_id,project_title,track,raw_score,normalized_score,rank`
   - Escaping: Any project title containing commas, quotes, or newlines must be double-quote escaped according to RFC 4180 (`"${title.replace(/"/g, '""')}"`).
4. **Access Control**:
   - Verify `session` via `getSession(req)`.
   - If `!session`, return `401 Unauthorized`.
   - If `session.role !== 'organizer' && session.role !== 'admin'`, return `403 Forbidden`.

### 2.4 UI Layout & Control Hierarchy
1. **`/judge` (Judge Scoring Console)**:
   - **Access**: Server component redirects unauthenticated to `/login`, returns 403 card for non-judges.
   - **Header**: Shows current judge name, email, and list of assigned tracks (e.g., "Assigned Tracks: Developer tools, Security").
   - **Project Selection**: List / tab view of projects in the judge's assigned tracks. Each card displays:
     - Title, team name, track badge, repository link.
     - Review status badge: "Scored" (green) or "Pending" (amber/outline).
   - **Scoring Workspace**:
     - Form rendering all criteria from `RubricCriterion`.
     - Controls: Number inputs or rating buttons (0 to 5, step 0.5/1).
     - Textarea: Feedback / comment field.
     - Action button: "Submit Evaluation" / "Update Score" (submits to `POST /api/judge/scores`).
     - Previous score display: Populates form with existing score values if previously submitted by this judge.
2. **`/dashboard` (Organizer Control Tower)**:
   - **Access**: Only accessible to organizers/admins.
   - **KPI Metric Cards**:
     1. Total Projects (e.g. 40)
     2. Scored Projects & Coverage percentage (e.g. 38 / 40, 95%)
     3. Total Evaluations Completed (e.g. 252)
     4. Judges Completed vs Active (e.g. 26 / 30)
   - **Action Bar**: "Export CSV" button linked to `/api/export.csv`.
   - **Judge Progress Table**:
     - Columns: Judge Name, Assigned Tracks, Assigned Count, Completed Count, Remaining Count, Status Badge (`Complete` | `In Progress` | `Not Started`).
   - **Results / Leaderboard Preview Table**:
     - Columns: Rank, Project Title, Track, Judge Reviews Count, Raw Mean Score, MAD Normalized Score.
   - **Live Audit Trail**:
     - Recent entries from `AuditLog` (Timestamp, User Email/Role, Action `score_submitted`, Target Project).

---

## 3. Caveats
- **Score Model Unique Key**: As observed, `prisma/schema.prisma` does not have a unique index on `(judgeId, projectId, criterionId)`. The API route cannot use `prisma.score.upsert({ where: { judgeId_projectId_criterionId } })`. It must query existing scores via `findFirst` or execute an explicit delete/insert transaction per submission.
- **Fixture Project Criteria Mismatch**: In `fixtures.json`, criteria keys include `functionality`, `quality`, and `innovation`. In `seed.ts`, the default criteria seeded in DB are `functionality` (1.5), `quality` (1.0), `creativity` (1.0), and `presentation` (0.5). `seed.ts` gracefully ignored unknown criteria during seeding, leaving 252 valid scores in SQLite. When computing rankings, dynamic query from `prisma.rubricCriterion.findMany()` must be used to ensure matching with current DB criteria.
- **Unscored Projects**: Projects that have received 0 reviews will have 0 raw score and 0 normalized score. They should be ranked at the end with ranks assigned deterministically by project ID.

---

## 4. Conclusion
1. **Normalization**: `src/lib/normalization.ts` is fully implemented and tested. It handles zero-variance judges (such as `jdg_07` and `jdg_30`) robustly by returning `0` modified z-scores when $MAD = 0$.
2. **Aggregation Pipeline**: Multi-judge, multi-criteria aggregation should follow a 3-step pipeline: (1) calculate criterion-weighted composite score per judge-project pair, (2) run `normaliseAllJudges` across each judge's project score array, (3) average normalized scores across judges for each project to produce the final leaderboard.
3. **AuditLog**: Must be recorded inside `POST /api/judge/scores` using `action: "score_submitted"`, `userId: session.id`, and `payload: JSON.stringify({ projectId, scores, comment, submittedAt })`.
4. **CSV Export**: `GET /api/export.csv` must return `Content-Type: text/csv; charset=utf-8`, header line starting with commas (`project_id,project_title,track,raw_score,normalized_score,rank`), and strictly enforce 403 on non-organizer requests.
5. **UI Pages**: `/judge` and `/dashboard` have clear requirements that can be built using existing shadcn components (`Card`, `Badge`, `Button`, `Table`, `Tabs`, `Input`, `Textarea`, `Progress`) with Framer Motion transitions.

---

## 5. Verification Method

To independently verify these findings on the live workspace:

1. **Verify Normalization Math & Zero-Variance Handling**:
   ```powershell
   npx tsx -e "import { normaliseJudgeScores } from './src/lib/normalization'; console.log('Zero variance:', normaliseJudgeScores([3,3,3,3])); console.log('Single element:', normaliseJudgeScores([5]));"
   ```
   *Expected output*: `Zero variance: [ 0, 0, 0, 0 ]` and `Single element: [ 0 ]` (no NaN).

2. **Verify Full Dataset Ranking Simulation**:
   ```powershell
   npx tsx -e "import { prisma } from './src/lib/prisma'; import { normaliseAllJudges } from './src/lib/normalization'; async function main() { const scores = await prisma.score.findMany(); console.log('Total scores:', scores.length); } main();"
   ```
   *Expected output*: `Total scores: 252`.

3. **Verify Acceptance Criteria for T2 in `Hack_docs/run.py`**:
   Inspect lines 144–186 in `d:\TP\Hackathon\DogFood\Hack_docs\run.py`.
   - `judge sees own scores`: GET `/api/judge/scores` with `Cookie: session=jdg_a_seed_token_2026` returns 200.
   - `judge cannot see peer scores`: GET `/api/judge/scores?judge=user_jdg_a_01` with `Cookie: session=jdg_b_seed_token_2026` returns 403.
   - `participant blocked`: GET `/api/judge/scores` with `Cookie: session=prt_seed_token_2026` returns 401 or 403.
   - `csv export works`: GET `/api/export.csv` with `Cookie: session=org_seed_token_2026` returns 200 and first line contains `,`.
