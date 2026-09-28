# DOGFOOD 2026 Judging & Score Normalization Specification

> **Comprehensive mathematical formulation, derivation, edge-case mitigation, and export specifications for the DOGFOOD 2026 evaluation engine.**

---

## 1. Problem Formulation: The Pathology of Raw Hackathon Scores

In multi-track hackathons evaluated by distributed panels of volunteer judges, raw numerical scores are notoriously unreliable due to systematic reviewer bias:

1. **Hawks vs. Doves (Calibration Skew):** A strict judge ("hawk") may award a top score of 3.5/5.0 to an exceptional project, while a lenient judge ("dove") might hand out 5.0/5.0 to mediocre submissions. A project assigned two hawks will lose to an inferior project assigned two doves if raw scores are averaged.
2. **Variance Compression (Discrimination Failure):** Some judges score every project within a narrow band (e.g. 4.0 to 4.5), while others utilize the full 1.0 to 5.0 scale.
3. **Incomplete Block Designs:** Judges cannot evaluate all projects; they only score a subset within their assigned track. Cross-judge variance cannot be balanced out naturally by large-sample law of averages.

To solve this, DOGFOOD 2026 implements **Modified Z-Score Normalization** using the **Median Absolute Deviation (MAD)**.

---

## 2. Mathematical Foundation: Modified Z-Score via MAD

### 2.1 Why Not Standard Z-Score?
The classical standard score (Z-score) is defined as:
$$z_i = \frac{x_i - \bar{x}}{s}$$
where $\bar{x} = \frac{1}{N} \sum x_i$ is the sample mean and $s = \sqrt{\frac{1}{N-1} \sum (x_i - \bar{x})^2}$ is the sample standard deviation.

Standard Z-Score exhibits two fatal flaws in hackathons:
1. **Outlier Sensitivity:** Both the mean $\bar{x}$ and standard deviation $s$ have an asymptotic breakdown point of $0\%$. A single anomalous score drastically skews the baseline.
2. **Zero-Variance Division-by-Zero:** If a judge awards identical scores to all projects, the sample variance $s = 0$. Computing $z_i$ results in $\frac{0}{0} = \text{NaN}$, crashing unhardened leaderboards and CSV export pipelines.

### 2.2 The Modified Z-Score Formula
To provide high breakdown point (50%) robustness against outliers and eliminate variance distortion, DOGFOOD 2026 uses the Boris Iglewicz and David Hoaglin formulation:

$$\text{modified\_z}_i = \frac{0.6745 \cdot (x_i - \tilde{x})}{\text{MAD}}$$

Where:
- $x_i$ is the raw composite score awarded to project $i$ by the judge.
- $\tilde{x} = \text{median}(X)$ is the median score awarded by that specific judge across all their evaluated projects.
- $\text{MAD}$ is the **Median Absolute Deviation**, defined as:
  $$\text{MAD} = \text{median}\left( |x_i - \tilde{x}| \right)$$

### 2.3 Mathematical Derivation of the Constant $0.6745$
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

## 3. Deliberate Zero-Variance Fixture Torture Test (`jdg_30`)

### The Trap in `fixtures.json`
The official DOGFOOD evaluation dataset (`Hack_docs/fixtures.json`) includes an adversarial test case:
- **Judge ID:** `jdg_30`
- **Judge Name:** Rafa Okonkwo
- **Behavior:** Awarded identical scores of `3.0` across every evaluated project.

### Mathematical Outcome
1. Raw scores: $X = [3.0, 3.0, 3.0, ...]$
2. Median: $\tilde{x} = 3.0$
3. Deviations: $|x_i - \tilde{x}| = [0.0, 0.0, 0.0, ...]$
4. $\text{MAD} = \text{median}([0.0, 0.0, 0.0, ...]) = 0.0$

In an unhardened system:
$$\text{modified\_z}_i = \frac{0.6745 \cdot (3.0 - 3.0)}{0.0} = \frac{0}{0} = \text{NaN}$$

When sorting or serializing to CSV, `NaN` propagates through calculations, resulting in empty leaderboards, corrupt CSV rows, or uncaught server exceptions.

### Our Solution (`src/lib/normalization.ts`)
```typescript
// Zero-variance guard: judge gave every project the same score.
// Return neutral zeros — no signal, no crash.
if (mad === 0) {
  return scores.map(() => 0);
}

return scores.map((s) => (0.6745 * (s - median)) / mad);
```
**Domain Rationale:** A judge who awards identical scores provides **zero discriminating information** between projects. Setting their modified Z-scores to `0.0` reflects neutral baseline performance, contributing $0$ deviation to the projects' normalized composite, completely eliminating `NaN` and divide-by-zero crashes.

---

## 4. End-to-End Scoring & Ranking Pipeline

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
    Handle MAD == 0 -> 0.0
                │
                ▼
  [ Stage 4: Cross-Judge Aggregation ]
    Avg Normalized Score = (1 / K) Σ (modified_z_j) for all judges j scoring project
    Avg Raw Score        = (1 / K) Σ (RawScore_j)
                │
                ▼
  [ Stage 5: Deterministic Ranking ]
    1. Primary Sort:   Normalized Score DESC
    2. Secondary Sort: Raw Score DESC
    3. Tertiary Sort:  Project ID ASC
                │
                ▼
  [ Stage 6: RFC 4180 CSV Streaming ]
```

---

## 5. CSV Export Specification (RFC 4180 Compliance)

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

### Escaping Rules (RFC 4180)
If any field contains a comma (`,`), double-quote (`"`), carriage return (`\r`), or newline (`\n`), the field is wrapped in double quotes and existing double quotes are doubled (`""`):
```typescript
function escapeCsvField(value: string | number): string {
  const str = String(value);
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
Content-Disposition: attachment; filename="dogfood_scores.csv"
Cache-Control: no-store, max-age=0
```
Attempts by judges, participants, or anonymous visitors to request `/api/export.csv` are rejected with `403 Forbidden` or `401 Unauthorized`.
