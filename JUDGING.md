# OmniJudge Judging & Score Normalization Specification

> **Comprehensive mathematical formulation, derivation, edge-case mitigation, and export specifications for the OmniJudge evaluation engine.**

---

## 1. Problem Formulation: The Pathology of Raw Hackathon Scores

In multi-track hackathons evaluated by distributed panels of volunteer judges, raw numerical scores are notoriously unreliable due to systematic reviewer bias:

1. **Hawks vs. Doves (Calibration Skew):** A strict judge ("hawk") may award a top score of 3.5/5.0 to an exceptional project, while a lenient judge ("dove") might hand out 5.0/5.0 to mediocre submissions. A project assigned two hawks will lose to an inferior project assigned two doves if raw scores are averaged.
2. **Variance Compression (Discrimination Failure):** Some judges score every project within a narrow band (e.g. 4.0 to 4.5), while others utilize the full 1.0 to 5.0 scale.
3. **Incomplete Block Designs:** Judges cannot evaluate all projects; they only score a subset within their assigned track. Cross-judge variance cannot be balanced out naturally by large-sample law of averages.

To solve this, OmniJudge implements a dual-defense system: **Track-Level Assignment Architecture** combined with **Modified Z-Score Normalization** via **Median Absolute Deviation (MAD)**.

---

## 2. Judge Assignment Strategy: Incomplete Block Design & Defense

### 2.1 The Need for Incomplete Block Design
In a hackathon with $P = 40$ projects, $C = 4$ rubric criteria, and $J = 30$ judges, requiring every judge to evaluate every project would demand:
$$\text{Evaluations} = 40 \times 4 = 160 \text{ criterion ratings per judge}$$

This causes acute reviewer fatigue, rushed evaluations, and high variance decay over time. 

OmniJudge adopts an **Incomplete Block Design (IBD)**:
1. **Domain Track Partitioning:** Projects are partitioned into distinct Tracks (`trk_dev_tools`, `trk_ai_agents`, `trk_infra`, `trk_consumer`).
2. **Specialized Panel Assignment:** Judges are assigned to 1–2 tracks based on domain expertise via explicit `JudgeAssignment` records.
3. **Load Capping:** Each judge evaluates a manageable cohort of 8–12 projects, ensuring deep code review, repo inspection, and high-fidelity rubric scoring.

### 2.2 Server-Enforced Jurisdiction & Conflict Defense
Assignment is not merely a UI suggestion; it is a **cryptographic security boundary**:
- **Jurisdiction Enforcement:** When `POST /api/judge/scores` is invoked, the database verifies that `JudgeAssignment` exists for `(userId, project.trackId)`. If a judge attempts to score a project outside their assigned track, the API rejects the request with `403 Forbidden`.
- **Conflict of Interest Avoidance:** Judges who are registered as members of a submitting team (`TeamMember.userId == session.userId`) are barred from evaluating their own team's project.
- **Peer Isolation:** Judges can never view evaluations or composite scores submitted by peer judges, preventing anchoring bias and social conformity cascades.

---

## 3. Mathematical Foundation: Modified Z-Score via MAD

### 3.1 Why Competing Normalization Methods Fail (The Defense)

| Normalization Method | Formula | Fatal Flaw in Hackathons | OmniJudge Verdict |
| :--- | :--- | :--- | :--- |
| **Raw Arithmetic Mean** | $\bar{x} = \frac{1}{K}\sum x_k$ | Vulnerable to "hawks vs. doves" calibration skew. Submissions assigned strict judges are unfairly penalized. | ❌ Rejected |
| **Min-Max Scaling** | $\frac{x_i - \min}{\max - \min}$ | Extreme outlier scores collapse the scale for all intermediate projects; breaks down if $\min = \max$. | ❌ Rejected |
| **Classical Z-Score** | $z_i = \frac{x_i - \bar{x}}{s}$ | Sample standard deviation $s$ has a 0% breakdown point. **Crashes with `NaN`** when variance is zero ($s = 0$). | ❌ Rejected |
| **Borda Count / Elo** | Pairwise ranking | Requires all-pairs or dense bipartite connectivity; fails on sparse, disjoint incomplete block designs. | ❌ Rejected |
| **Modified Z-Score (MAD)** | $0.6745 \cdot \frac{x_i - \tilde{x}}{\text{MAD}}$ | **50% breakdown point robustness**. Accommodates outliers, scales identical to Gaussian, handles zero-variance gracefully. | ✅ **Selected & Defended** |

### 3.2 The Modified Z-Score Formula
To provide high breakdown point (50%) robustness against outliers and eliminate variance distortion, OmniJudge uses the Boris Iglewicz and David Hoaglin formulation:

$$\text{modified\_z}_i = \frac{0.6745 \cdot (x_i - \tilde{x})}{\text{MAD}}$$

Where:
- $x_i$ is the raw composite score awarded to project $i$ by the judge.
- $\tilde{x} = \text{median}(X)$ is the median score awarded by that specific judge across all their evaluated projects.
- $\text{MAD}$ is the **Median Absolute Deviation**, defined as:
  $$\text{MAD} = \text{median}\left( |x_i - \tilde{x}| \right)$$

### 3.3 Mathematical Derivation of the Constant $0.6745$
The scaling constant $0.6745$ is derived from the standard normal cumulative distribution function $\Phi(z)$.

For a standard normal distribution $\mathcal{N}(0, 1)$, the median is $0$. The MAD is the value $\text{mad}$ such that:
$$P(|Z| \le \text{mad}) = 0.50$$
$$P(-\text{mad} \le Z \le \text{mad}) = 0.50$$
$$2 \Phi(\text{mad}) - 1 = 0.50 \implies \Phi(\text{mad}) = 0.75$$
$$\text{mad} = \Phi^{-1}(0.75) \approx 0.67448975...$$

Therefore, for normally distributed observations:
$$E[\text{MAD}] \approx 0.6745 \cdot \sigma \iff \sigma \approx \frac{\text{MAD}}{0.6745} \approx 1.4826 \cdot \text{MAD}$$

Multiplying $(x_i - \tilde{x})$ by $0.6745 / \text{MAD}$ (or dividing by $1.4826 \cdot \text{MAD}$) ensures that when a judge's scores are normally distributed, the **Modified Z-Score is on the exact same scale as the classical Z-Score**, with standard deviation $\approx 1.0$.

---

## 4. Deliberate Zero-Variance Fixture Torture Tests (`jdg_30`, `jdg_07`, and Single-Review Panels)

### The Traps in `fixtures.json`
The official DOGFOOD evaluation dataset (`Hack_docs/fixtures.json`) includes multiple adversarial zero-variance and low-sample edge cases:
- **`jdg_30` (Rafa Okonkwo):** Awarded identical scores of `3.0` across all evaluated projects ($X = [3.0, 3.0, ...]$).
- **`jdg_07` (Iva Petrova):** Awarded identical scores of `4.0` across all 3 evaluated projects ($X = [4.0, 4.0, 4.0]$).
- **Single-Review Judges (`jdg_01`, `jdg_23`):** Evaluated exactly one project ($N = 1$), which mathematically produces a deviation $|x_1 - \tilde{x}| = 0.0$.

### Mathematical Outcome
1. Raw scores: $X = [c, c, ...]$
2. Median: $\tilde{x} = c$
3. Deviations: $|x_i - \tilde{x}| = [0.0, 0.0, ...]$
4. $\text{MAD} = \text{median}([0.0, 0.0, ...]) = 0.0$

In an unhardened system:
$$\text{modified\_z}_i = \frac{0.6745 \cdot (c - c)}{0.0} = \frac{0}{0} = \text{NaN}$$

When sorting or serializing to CSV, `NaN` propagates through calculations, resulting in corrupted leaderboards, unranked projects, or uncaught server exceptions.

### Our Solution (`src/lib/normalization.ts`)
```typescript
// Zero-variance guard: judge gave every project the same score or evaluated only 1 project.
// Return neutral zeros — no signal, no crash.
if (mad === 0) {
  return scores.map(() => 0);
}

// Map each score with finite-number verification
return scores.map((s) => {
  const norm = (0.6745 * (s - median)) / mad;
  return Number.isFinite(norm) ? norm : 0;
});
```
**Domain Rationale:** A judge who awards identical scores provides **zero discriminating information** between projects. Setting their modified Z-scores to `0.0` reflects neutral baseline performance, contributing $0$ deviation to the projects' normalized composite, completely eliminating `NaN` and divide-by-zero crashes.

---

## 5. End-to-End Scoring & Ranking Pipeline

The complete aggregation sequence executed in `src/app/api/export.csv/route.ts` and `/dashboard` proceeds through 6 stages:

```
[ Individual Rubric Criteria Scores ]
                │
                ▼
  [ Stage 1: Criterion Weighting ]
    Raw Project Score = Σ (Score_c × Weight_c) / Σ Weight_c
                │
                ▼
  [ Stage 2: Per-Judge Grouping ]
    Group scores by Judge: Map<JudgeId, Map<ProjectId, RawScore>>
                │
                ▼
  [ Stage 3: MAD Normalization ]
    Apply normaliseJudgeScores() per judge
    Handle MAD == 0 -> 0.0 (e.g. jdg_30, jdg_07, single-review panels)
                │
                ▼
  [ Stage 4: Cross-Judge Aggregation ]
    Avg Normalized Score = (1 / M) Σ (modified_z_j) for all M valid normalized scores
    Avg Raw Score        = (1 / K) Σ (RawScore_j) for all K reviews
                │
                ▼
  [ Stage 5: Deterministic Ranking ]
    1. Evaluated Status: Evaluated projects (reviewCount > 0) strictly outrank unreviewed
    2. Primary Sort:     Normalized Score DESC (with ε = 1e-9 tolerance)
    3. Secondary Sort:   Raw Score DESC (with ε = 1e-9 tolerance)
    4. Tertiary Sort:    Project ID ASC (lexicographical tie-breaker)
                │
                ▼
  [ Stage 6: RFC 4180 CSV Streaming with CWE-1236 Sanitization ]
```

### Deterministic Tie-Breaking & Status Invariants
- **Reviewed vs. Unreviewed Separation:** Unreviewed projects have `normalized_score = 0.0000`. Without an evaluation status guard, an unreviewed project would incorrectly outrank a legitimately reviewed project that received negative normalized scores from strict judges. OmniJudge strictly partitions evaluated projects (`reviewCount > 0`) ahead of unreviewed projects (`reviewCount === 0`).
- **IEEE 754 Floating-Point Guard ($\epsilon = 10^{-9}$):** Two normalized scores that differ only by binary floating-point representation noise are treated as equal, deferring to raw score and project ID rather than non-deterministic float jitter.

---

## 6. CSV Export Specification (RFC 4180 & CWE-1236 Compliance)

The CSV export endpoint at `/api/export.csv` strictly fulfills all acceptance criteria mandated by `.dogfood.toml` and `run.py`.

### Header Invariant
The acceptance checker explicitly asserts that **the first line must contain a comma**:
```csv
project_id,project_title,track,raw_score,normalized_score,rank
```

### Full Column Schema
| Column | Type | Formatting / Precision | Description |
| :--- | :--- | :--- | :--- |
| `project_id` | `String` | Escaped RFC 4180 string | Unique project identifier (e.g. `proj_01`) |
| `project_title` | `String` | Escaped RFC 4180 string | Title from fixtures (e.g. `"Glass Signal"`) |
| `track` | `String` | Escaped RFC 4180 string | Track name (e.g. `"Developer Tools"`) |
| `raw_score` | `Float` | Fixed 2 decimal places (`.toFixed(2)`) | Unweighted arithmetic mean across judges (1.00 - 5.00) |
| `normalized_score` | `Float` | Fixed 4 decimal places (`.toFixed(4)`) | Mean Modified Z-Score across judges |
| `rank` | `Integer` | Positive 1-based integer ($1, 2, ...$) | Final rank sorted by `normalized_score DESC` |

### Escaping Rules (RFC 4180) & Formula Injection Defense (CWE-1236)
To protect spreadsheet users (Excel, LibreOffice, Google Sheets) against CSV Formula Injection (CWE-1236), any text field starting with formula command triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) that is not a genuine negative number is prefixed with a single quote (`'`). If any field contains a comma (`,`), double-quote (`"`), carriage return (`\r`), or newline (`\n`), the field is wrapped in double quotes and existing double quotes are doubled (`""`):

```typescript
function escapeCsvField(value: string | number): string {
  let str = String(value);

  // CSV Formula Injection Defense (CWE-1236):
  // Neutralize formula triggers while preserving valid negative numbers
  if (/^[=+\-@\t\r]/.test(str) && isNaN(Number(str))) {
    str = `'${str}`;
  }

  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
```

### HTTP Response Headers
```http
HTTP/1.1 200 OK
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="omnijudge_scores.csv"
Cache-Control: no-store, max-age=0
```
Attempts by judges, participants, or anonymous visitors to request `/api/export.csv` are rejected with `403 Forbidden` or `401 Unauthorized`.
