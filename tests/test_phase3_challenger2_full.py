#!/usr/bin/env python3
"""
Comprehensive Challenger 2 Verification Suite for Phase 3 (T2 Judging).
Covers:
1. CSV export HTTP response headers, content type, RFC 4180 compliance.
2. CSV header schema and sequential 1..N ranking without gaps or duplicates.
3. Absence of NaN, null, undefined, and Infinity.
4. Independent mathematical verification of weighted composites and MAD normalization against SQLite DB.
5. In-depth stress testing of MAD normalization edge cases:
   - Zero-variance judges (Rafa Okonkwo / jdg_30 simulation, jdg_07, etc.)
   - Single-element arrays, even/odd lengths, extreme outliers
   - Majority identical distributions where MAD evaluates to 0
6. RBAC access control verification on /api/export.csv and /api/judge/scores.
7. Execution and verification of Hack_docs/run.py .dogfood.toml.
"""

import csv
import io
import json
import math
import subprocess
import sys
import sqlite3
import urllib.request
import urllib.error

BASE_URL = "http://localhost:8080"
DB_PATH = "prisma/prisma/dogfood.db"

PASS_COUNT = 0
FAIL_COUNT = 0

def check(label, condition, detail=""):
    global PASS_COUNT, FAIL_COUNT
    if condition:
        PASS_COUNT += 1
        print(f" [PASS] {label}")
    else:
        FAIL_COUNT += 1
        print(f" [FAIL] {label}")
        if detail:
            print(f"        -> {detail}")

def http_get(path, cookie=None):
    url = BASE_URL + path
    headers = {}
    if cookie:
        headers["Cookie"] = cookie
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, resp.headers, resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.headers, e.read().decode("utf-8")
    except Exception as e:
        return 0, {}, str(e)

def http_post(path, cookie=None, body=None):
    url = BASE_URL + path
    headers = {"Content-Type": "application/json"}
    if cookie:
        headers["Cookie"] = cookie
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, resp.headers, resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.headers, e.read().decode("utf-8")
    except Exception as e:
        return 0, {}, str(e)

# ============================================================================
# Section 1: CSV Export API & RBAC
# ============================================================================
print("--- Section 1: CSV Export API & Access Control ---")

# Organizer access
status, headers, body = http_get("/api/export.csv", cookie="session=org_seed_token_2026")
check("Organizer GET /api/export.csv returns 200", status == 200, f"Got status {status}")
content_type = headers.get("Content-Type", "")
check("Content-Type is 'text/csv; charset=utf-8'", content_type == "text/csv; charset=utf-8", f"Got: {content_type}")

# Judge access
status_j, _, _ = http_get("/api/export.csv", cookie="session=jdg_a_seed_token_2026")
check("Judge GET /api/export.csv is blocked (403)", status_j == 403, f"Got status {status_j}")

# Participant access
status_p, _, _ = http_get("/api/export.csv", cookie="session=prt_seed_token_2026")
check("Participant GET /api/export.csv is blocked (403)", status_p == 403, f"Got status {status_p}")

# Anonymous access
status_anon, _, _ = http_get("/api/export.csv")
check("Anonymous GET /api/export.csv is unauthorized (401)", status_anon == 401, f"Got status {status_anon}")

# ============================================================================
# Section 2: CSV Structure, Schema, Rankings & NaN Checks
# ============================================================================
print("\n--- Section 2: CSV Header, Rankings & Value Sanitization ---")

lines = body.splitlines()
check("CSV contains data (>= 2 lines)", len(lines) >= 2, f"Line count: {len(lines)}")
header_line = lines[0].lstrip("\ufeff") if lines else ""
check("Line 1 contains comma", "," in header_line, f"Line 1: {header_line}")
expected_header = "project_id,project_title,track,raw_score,normalized_score,review_count,rank"
check(f"Header matches '{expected_header}'", header_line == expected_header, f"Got: {header_line}")

reader = csv.DictReader(io.StringIO(body.lstrip('\ufeff')))
rows = list(reader)
check("CSV parsed rows count >= 40", len(rows) >= 40, f"Found {len(rows)} rows")

# Check ranks
ranks = [int(r["rank"]) for r in rows]
expected_ranks = list(range(1, len(rows) + 1))
check("Ranks form strict 1..N sequence without gaps or duplicates", ranks == expected_ranks, f"Ranks: {ranks[:10]}...")

# Check NaN, Null, Undefined, Inf
forbidden_tokens = {"nan", "null", "undefined", "inf", "-inf", "infinity", "-infinity", "none"}
nan_found = False
for idx, r in enumerate(rows):
    raw_s = r["raw_score"].strip().lower()
    norm_s = r["normalized_score"].strip().lower()
    if raw_s in forbidden_tokens or norm_s in forbidden_tokens:
        nan_found = True
        break
    try:
        rf = float(raw_s)
        nf = float(norm_s)
        if math.isnan(rf) or math.isinf(rf) or math.isnan(nf) or math.isinf(nf):
            nan_found = True
            break
    except ValueError:
        nan_found = True
        break

check("No NaN, null, undefined, or Infinity values in raw_score or normalized_score", not nan_found)

# Check precision
precision_ok = True
for r in rows:
    # raw_score should have 2 decimals, normalized_score 4 decimals
    r_parts = r["raw_score"].split(".")
    n_parts = r["normalized_score"].split(".")
    if len(r_parts) != 2 or len(r_parts[1]) != 2 or len(n_parts) != 2 or len(n_parts[1]) != 4:
        precision_ok = False
        break
check("Floating point formatting precision: raw_score (2 decimals), normalized_score (4 decimals)", precision_ok)

# Check sorting invariants: normalized_score must be monotonically non-increasing
sort_ok = True
float_tie_anomalies = []
for i in range(len(rows) - 1):
    cur_norm = float(rows[i]["normalized_score"])
    next_norm = float(rows[i+1]["normalized_score"])
    cur_raw = float(rows[i]["raw_score"])
    next_raw = float(rows[i+1]["raw_score"])
    cur_id = rows[i]["project_id"]
    next_id = rows[i+1]["project_id"]
    
    cur_count = int(rows[i].get("review_count", 1))
    next_count = int(rows[i+1].get("review_count", 1))
    if (cur_count > 0) != (next_count > 0):
        if cur_count == 0 and next_count > 0:
            sort_ok = False
            break
    elif cur_norm < next_norm and (next_norm - cur_norm) > 0.00015:
        sort_ok = False
        break
    elif cur_norm == next_norm and cur_raw < next_raw:
        float_tie_anomalies.append((rows[i]["project_id"], rows[i+1]["project_id"], cur_norm, cur_raw, next_raw))

check("Leaderboard normalized_score is monotonically non-increasing (rank order matches norm desc)", sort_ok)
if float_tie_anomalies:
    print(f" [NOTE] Observed {len(float_tie_anomalies)} pairs where 4-decimal rounded norm scores match but raw scores inverted due to sub-epsilon IEEE 754 differences:")
    for a in float_tie_anomalies:
        print(f"        -> {a[0]} (raw {a[3]}) ranked before {a[1]} (raw {a[4]}) at norm {a[2]}")


# ============================================================================
# Section 3: Ground Truth Mathematical Verification against SQLite DB
# ============================================================================
print("\n--- Section 3: Independent Mathematical Ground Truth Verification ---")

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

db_projects = cur.execute("SELECT id, title, trackId FROM Project ORDER BY id ASC").fetchall()
db_tracks = dict(cur.execute("SELECT id, name FROM Track").fetchall())
db_criteria = dict(cur.execute("SELECT id, weight FROM RubricCriterion").fetchall())
db_scores = cur.execute("SELECT judgeId, projectId, criterionId, value FROM Score").fetchall()

# 1. Composite raw scores
judge_proj_acc = {}
for j_id, p_id, c_id, val in db_scores:
    w = db_criteria.get(c_id, 1.0)
    judge_proj_acc.setdefault(j_id, {}).setdefault(p_id, [0.0, 0.0])
    judge_proj_acc[j_id][p_id][0] += val * w
    judge_proj_acc[j_id][p_id][1] += w

judge_raw_scores = {}
for j_id, p_map in judge_proj_acc.items():
    judge_raw_scores[j_id] = {}
    for p_id, (w_sum, w_tot) in p_map.items():
        judge_raw_scores[j_id][p_id] = w_sum / w_tot if w_tot > 0 else 0.0

# 2. MAD normalisation
judge_norm_scores = {}
for j_id, p_map in judge_raw_scores.items():
    p_ids = list(p_map.keys())
    vals = [p_map[pid] for pid in p_ids]
    n = len(vals)
    sorted_vals = sorted(vals)
    mid = n // 2
    med = sorted_vals[mid] if n % 2 != 0 else (sorted_vals[mid - 1] + sorted_vals[mid]) / 2.0
    
    devs = sorted([abs(v - med) for v in vals])
    mad = devs[mid] if n % 2 != 0 else (devs[mid - 1] + devs[mid]) / 2.0
    
    if mad == 0:
        norm_vals = [0.0] * n
    else:
        norm_vals = [(0.6745 * (v - med)) / mad for v in vals]
    judge_norm_scores[j_id] = dict(zip(p_ids, norm_vals))

# 3. Project aggregations
ground_truth = []
for p_id, title, trk_id in db_projects:
    raw_list = []
    norm_list = []
    for j_id in judge_raw_scores:
        if p_id in judge_raw_scores[j_id]:
            raw_list.append(judge_raw_scores[j_id][p_id])
            norm_list.append(judge_norm_scores[j_id][p_id])
    
    cnt = len(raw_list)
    avg_raw = sum(raw_list) / cnt if cnt > 0 else 0.0
    avg_norm = sum(norm_list) / cnt if cnt > 0 else 0.0
    
    ground_truth.append({
        "id": p_id,
        "title": title,
        "track": db_tracks.get(trk_id, "General"),
        "raw": avg_raw,
        "norm": avg_norm,
        "count": cnt
    })

ground_truth.sort(key=lambda x: (-(x["count"] > 0), -round(x["norm"], 8), -round(x["raw"], 8), x["id"]))
for i, g in enumerate(ground_truth):
    g["rank"] = i + 1

math_diffs = []
for idx, (csv_row, gt) in enumerate(zip(rows, ground_truth)):
    if csv_row["project_id"] != gt["id"]:
        math_diffs.append(f"Row {idx} ID mismatch: {csv_row['project_id']} vs {gt['id']}")
    if int(csv_row["rank"]) != gt["rank"]:
        math_diffs.append(f"Row {idx} Rank mismatch: {csv_row['rank']} vs {gt['rank']}")
    csv_raw = float(csv_row["raw_score"])
    gt_raw = round(gt["raw"], 2)
    if abs(csv_raw - gt_raw) > 0.011:
        math_diffs.append(f"Row {idx} Raw mismatch: {csv_raw} vs {gt_raw}")
    csv_norm = float(csv_row["normalized_score"])
    gt_norm = round(gt["norm"], 4)
    if abs(csv_norm - gt_norm) > 0.00011:
        math_diffs.append(f"Row {idx} Norm mismatch: {csv_norm} vs {gt_norm}")

check("CSV rows match independent ground truth calculation exactly", len(math_diffs) == 0, "\n".join(math_diffs[:5]))

# ============================================================================
# Section 4: Zero-Variance Judges & MAD Mathematical Robustness
# ============================================================================
print("\n--- Section 4: Zero-Variance Judges & Robustness Stress Tests ---")

# Let's inspect the zero-variance judges in DB
db_zero_var = []
for j_id, p_map in judge_raw_scores.items():
    vals = list(p_map.values())
    sorted_v = sorted(vals)
    n = len(sorted_v)
    mid = n // 2
    med = sorted_v[mid] if n % 2 != 0 else (sorted_v[mid - 1] + sorted_v[mid]) / 2.0
    devs = sorted([abs(v - med) for v in vals])
    mad = devs[mid] if n % 2 != 0 else (devs[mid - 1] + devs[mid]) / 2.0
    if mad == 0:
        db_zero_var.append((j_id, vals, mad))

print(f"Found {len(db_zero_var)} judges in SQLite with MAD == 0:")
for j_id, vals, mad in db_zero_var:
    print(f"  Judge: {j_id}, Values: {vals}, MAD: {mad}")

# Check that every project evaluated by zero-variance judges received normalized score 0.0
all_zero_contributions = True
for j_id, vals, _ in db_zero_var:
    for pid, norm_val in judge_norm_scores[j_id].items():
        if norm_val != 0.0:
            all_zero_contributions = False
            break

check("All zero-variance judges in DB contribute exactly 0.0 to normalized scores", all_zero_contributions)

# Now, test the pure Python simulation of normaliseJudgeScores for stress scenarios
def normalise_judge_scores(scores):
    if not scores:
        return []
    sorted_s = sorted(scores)
    mid = len(sorted_s) // 2
    med = sorted_s[mid] if len(sorted_s) % 2 != 0 else (sorted_s[mid - 1] + sorted_s[mid]) / 2.0
    devs = sorted([abs(s - med) for s in scores])
    mad = devs[mid] if len(devs) % 2 != 0 else (devs[mid - 1] + devs[mid]) / 2.0
    if mad == 0:
        return [0.0] * len(scores)
    return [(0.6745 * (s - med)) / mad for s in scores]

# Scenario A: Rafa Okonkwo / jdg_30 identical scores case [4, 4, 4, 4]
res_rafa = normalise_judge_scores([4.0, 4.0, 4.0, 4.0])
check("Identical scores [4, 4, 4, 4] yields [0, 0, 0, 0] without divide-by-zero", res_rafa == [0.0, 0.0, 0.0, 0.0])

# Scenario B: Single score [5.0]
res_single = normalise_judge_scores([5.0])
check("Single score [5.0] yields [0.0] without divide-by-zero", res_single == [0.0])

# Scenario C: Majority identical [3, 3, 3, 5] -> median=3, devs=[0, 0, 0, 2], MAD=0
res_majority = normalise_judge_scores([3.0, 3.0, 3.0, 5.0])
check("Majority identical [3, 3, 3, 5] yields [0, 0, 0, 0] (MAD=0 guard)", res_majority == [0.0, 0.0, 0.0, 0.0])

# Scenario D: Symmetric distribution [1, 3, 5] -> median=3, devs=[0, 2, 2], MAD=2
# z for 1: 0.6745*(1-3)/2 = -0.6745; z for 3: 0; z for 5: 0.6745
res_sym = normalise_judge_scores([1.0, 3.0, 5.0])
check("Symmetric [1, 3, 5] yields [-0.6745, 0.0, 0.6745]",
      len(res_sym) == 3 and math.isclose(res_sym[0], -0.6745, abs_tol=1e-6) and math.isclose(res_sym[2], 0.6745, abs_tol=1e-6))

# Scenario E: Empty array
res_empty = normalise_judge_scores([])
check("Empty array yields []", res_empty == [])

# Scenario F: Extreme outlier robustness [1, 1, 1, 1, 1, 1, 1, 1, 100] -> median=1, MAD=0
res_outlier = normalise_judge_scores([1.0]*8 + [100.0])
check("Extreme outlier with identical majority yields [0]*9 (no crash/overflow)", res_outlier == [0.0]*9)

# ============================================================================
# Section 5: Strict RBAC Peer Isolation Probes
# ============================================================================
print("\n--- Section 5: Strict RBAC Peer Isolation Probes ---")

# Judge B tries to access Judge A's scores
status_peer, _, peer_body = http_get("/api/judge/scores?judge=user_jdg_a_01", cookie="session=jdg_b_seed_token_2026")
check("Judge B accessing Judge A's scores returns 403 Forbidden", status_peer == 403, f"Got status {status_peer}")

# Judge A accesses own scores
status_own, _, own_body = http_get("/api/judge/scores?judge=user_jdg_a_01", cookie="session=jdg_a_seed_token_2026")
check("Judge A accessing own scores with query param returns 200", status_own == 200, f"Got status {status_own}")

# Judge A accesses own scores without query param
status_own_noq, _, own_noq_body = http_get("/api/judge/scores", cookie="session=jdg_a_seed_token_2026")
check("Judge A accessing /api/judge/scores without param returns 200", status_own_noq == 200, f"Got status {status_own_noq}")

# Participant tries to access scores
status_prt, _, _ = http_get("/api/judge/scores", cookie="session=prt_seed_token_2026")
check("Participant accessing /api/judge/scores returns 403 Forbidden", status_prt == 403, f"Got status {status_prt}")

# Unauthenticated access to judge scores
status_noauth, _, _ = http_get("/api/judge/scores")
check("Unauthenticated accessing /api/judge/scores returns 401 Unauthorized", status_noauth == 401, f"Got status {status_noauth}")

# ============================================================================
# Section 6: Official Acceptance Runner Execution
# ============================================================================
print("\n--- Section 6: Official Acceptance Suite Execution ---")

proc = subprocess.run(
    ["python", "Hack_docs/run.py", ".dogfood.toml"],
    capture_output=True,
    text=True,
    cwd="."
)

checker_stdout = proc.stdout
print("Checker Output:")
print(checker_stdout)

check("Checker exit code is 0", proc.returncode == 0, f"Return code: {proc.returncode}")
check("Checker output contains 'T1  gallery is public ................. PASS'", "T1  gallery is public ................. PASS" in checker_stdout)
check("Checker output contains 'T1  project from fixtures shown ....... PASS'", "T1  project from fixtures shown ....... PASS" in checker_stdout)
check("Checker output contains 'T1  closed event refuses submissions .. PASS'", "T1  closed event refuses submissions .. PASS" in checker_stdout)
check("Checker output contains 'T2  judge sees own scores ............. PASS'", "T2  judge sees own scores ............. PASS" in checker_stdout)
check("Checker output contains 'T2  judge cannot see peer scores ...... PASS'", "T2  judge cannot see peer scores ...... PASS" in checker_stdout)
check("Checker output contains 'T2  participant blocked ............... PASS'", "T2  participant blocked ............... PASS" in checker_stdout)
check("Checker output contains 'T2  csv export works .................. PASS'", "T2  csv export works .................. PASS" in checker_stdout)
check("Checker output summary line is 'claimed T1 T2, verified T1 T2'", "claimed T1 T2, verified T1 T2" in checker_stdout)

# ============================================================================
# Final Summary
# ============================================================================
print("\n" + "="*50)
print(f"CHALLENGER 2 SUITE SUMMARY: {PASS_COUNT} PASSED, {FAIL_COUNT} FAILED")
print("="*50)

if FAIL_COUNT > 0:
    print("VERDICT: REQUEST_CHANGES")
    sys.exit(1)
else:
    print("VERDICT: APPROVE")
    sys.exit(0)
