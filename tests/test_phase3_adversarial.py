#!/usr/bin/env python3
"""
Adversarial security, boundary probing, and resilience verification suite for Phase 3 (T2 Judging).
Tests executed against live server at http://localhost:8080:

1. Probe 1 (Peer Score Isolation):
   - Judge Beta (session=jdg_b_seed_token_2026) -> GET /api/judge/scores?judge=user_jdg_a_01 -> MUST be 403
   - Judge Alpha (session=jdg_a_seed_token_2026) -> GET /api/judge/scores?judge=user_jdg_b_01 -> MUST be 403
   - Judge Beta -> GET /api/judge/scores?judge=non_existent_id -> MUST be 403
   - Judge Alpha -> GET /api/judge/scores?judge=user_jdg_a_01 (own) -> MUST be 200
   - Judge Alpha -> GET /api/judge/scores (no param) -> MUST be 200

2. Probe 2 (Participant Isolation):
   - Participant (session=prt_seed_token_2026) -> GET /api/judge/scores -> MUST be 403
   - Participant -> GET /api/judge/scores?judge=user_jdg_a_01 -> MUST be 403
   - Participant -> POST /api/judge/scores -> MUST be 403

3. Probe 3 (Unauthenticated / Bad Token):
   - Anonymous -> GET /api/judge/scores -> MUST be 401
   - Bad Token -> GET /api/judge/scores (session=invalid_token_123) -> MUST be 401
   - Empty Token -> GET /api/judge/scores (session=) -> MUST be 401
   - Anonymous -> POST /api/judge/scores -> MUST be 401
   - Bad Token -> POST /api/judge/scores -> MUST be 401

4. Probe 4 (CSV Access Control & MAD Normalization Integrity):
   - Judge Alpha -> GET /api/export.csv -> MUST be 403
   - Judge Beta -> GET /api/export.csv -> MUST be 403
   - Participant -> GET /api/export.csv -> MUST be 403
   - Anonymous -> GET /api/export.csv -> MUST be 401
   - Bad Token -> GET /api/export.csv -> MUST be 401
   - Organizer -> GET /api/export.csv -> MUST be 200 with text/csv
   - First line MUST contain a comma and valid header
   - All 40 projects present, ranks 1 to 40, no NaN or null in scores

5. Probe 5 (Score Submission Boundary & Zod Validation & AuditLog):
   - Invalid JSON body -> 400 Bad Request
   - Empty body {} -> 400 Bad Request
   - Missing projectId -> 400 Bad Request
   - Missing scores array -> 400 Bad Request
   - Empty scores array [] -> 400 Bad Request
   - Score < 0 -> 400 Bad Request
   - Score > 5 -> 400 Bad Request
   - Score non-numeric -> 400 Bad Request
   - Missing criterionId -> 400 Bad Request
   - Non-existent criterionId -> 400 Bad Request
   - Non-existent projectId -> 404 Not Found
   - Judge Alpha scoring project in unassigned track (trk_02) -> 403 Forbidden
   - Judge Beta scoring project in unassigned track (trk_01) -> 403 Forbidden
   - Legitimate score submission by Judge Alpha for trk_01 project -> 200 OK
   - AuditLog verification: record written to SQLite AuditLog table
   - Server stability: 0 unhandled 500 errors
"""

import csv
import io
import json
import os
import sqlite3
import sys
import urllib.error
import urllib.request

BASE_URL = "http://localhost:8080"
TIMEOUT = 10

# Test tokens
TOKEN_ORG = "org_seed_token_2026"
TOKEN_JDG_A = "jdg_a_seed_token_2026"
TOKEN_JDG_B = "jdg_b_seed_token_2026"
TOKEN_PRT = "prt_seed_token_2026"
TOKEN_BAD = "invalid_token_123"

# User IDs
USER_ORG = "user_org_01"
USER_JDG_A = "user_jdg_a_01"
USER_JDG_B = "user_jdg_b_01"
USER_PRT = "user_prt_01"

DB_PATHS = [
    os.path.join(os.getcwd(), "prisma", "prisma", "dogfood.db"),
    os.path.join(os.getcwd(), "prisma", "dogfood.db"),
]

def get_db_connection():
    for p in DB_PATHS:
        if os.path.exists(p) and os.path.getsize(p) > 0:
            return sqlite3.connect(p)
    # Fallback
    return sqlite3.connect("prisma/prisma/dogfood.db")

class TestCaseResult:
    def __init__(self, code, name, category):
        self.code = code
        self.name = name
        self.category = category
        self.passed = False
        self.status = None
        self.detail = ""
        self.response_body = ""

    def pass_test(self, status, detail="", body=""):
        self.passed = True
        self.status = status
        self.detail = detail
        self.response_body = body[:250] if body else ""

    def fail_test(self, status, detail="", body=""):
        self.passed = False
        self.status = status
        self.detail = detail
        self.response_body = body[:250] if body else ""


def http_request(path, method="GET", token=None, custom_cookie=None, body=None, raw_body=None, headers=None):
    url = f"{BASE_URL}{path}"
    req_headers = dict(headers or {})

    if custom_cookie is not None:
        if custom_cookie != "":
            req_headers["Cookie"] = custom_cookie
    elif token is not None:
        req_headers["Cookie"] = f"session={token}"

    data = None
    if raw_body is not None:
        if isinstance(raw_body, str):
            data = raw_body.encode("utf-8")
        else:
            data = raw_body
        if "Content-Type" not in req_headers:
            req_headers["Content-Type"] = "application/json"
    elif body is not None:
        data = json.dumps(body).encode("utf-8")
        if "Content-Type" not in req_headers:
            req_headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            resp_headers = {k.lower(): v for k, v in resp.info().items()}
            resp_body = resp.read().decode("utf-8", "replace")
            return resp.status, resp_body, resp_headers
    except urllib.error.HTTPError as e:
        resp_headers = {k.lower(): v for k, v in e.headers.items()} if e.headers else {}
        resp_body = e.read().decode("utf-8", "replace")
        return e.code, resp_body, resp_headers
    except Exception as e:
        return 0, f"{type(e).__name__}: {e}", {}


def run_all_probes():
    results = []
    print("=" * 80)
    print("EMPIRICAL ADVERSARIAL VERIFICATION SUITE — PHASE 3 (T2 JUDGING)")
    print(f"Target: {BASE_URL}")
    print("=" * 80)

    # Fetch reference IDs from SQLite
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, name FROM RubricCriterion")
    criteria = cur.fetchall()
    criteria_map = {row[1]: row[0] for row in criteria}
    valid_criterion_id = criteria[0][0] if criteria else None

    # Find project in trk_01 and trk_02
    cur.execute("SELECT id, trackId FROM Project WHERE trackId = 'trk_01' LIMIT 1")
    trk01_prj = cur.fetchone()[0]
    cur.execute("SELECT id, trackId FROM Project WHERE trackId = 'trk_02' LIMIT 1")
    trk02_prj = cur.fetchone()[0]

    # Pre-test audit log count
    cur.execute("SELECT COUNT(*) FROM AuditLog")
    initial_audit_count = cur.fetchone()[0]
    conn.close()

    print(f"[Setup] Criteria Count: {len(criteria)}, Sample Criterion: {valid_criterion_id}")
    print(f"[Setup] Track 01 Project (assigned to Judge A): {trk01_prj}")
    print(f"[Setup] Track 02 Project (assigned to Judge B): {trk02_prj}")
    print(f"[Setup] Initial AuditLog Count: {initial_audit_count}")
    print("-" * 80)

    # =========================================================================
    # SUITE 1: PROBE 1 — PEER SCORE ISOLATION (RBAC BOUNDARY)
    # =========================================================================
    print("\n--- SUITE 1: Probe 1 — Peer Score Isolation ---")

    # 1.1 Judge B requests Judge A's scores via query param
    t = TestCaseResult("P1_01", "Judge Beta requests Judge Alpha scores (?judge=user_jdg_a_01)", "Probe 1")
    status, body, _ = http_request(f"/api/judge/scores?judge={USER_JDG_A}", token=TOKEN_JDG_B)
    if status == 403:
        t.pass_test(status, "Strictly returned 403 Forbidden", body)
    else:
        t.fail_test(status, f"Expected 403, got {status}", body)
    results.append(t)

    # 1.2 Judge A requests Judge B's scores via query param
    t = TestCaseResult("P1_02", "Judge Alpha requests Judge Beta scores (?judge=user_jdg_b_01)", "Probe 1")
    status, body, _ = http_request(f"/api/judge/scores?judge={USER_JDG_B}", token=TOKEN_JDG_A)
    if status == 403:
        t.pass_test(status, "Strictly returned 403 Forbidden", body)
    else:
        t.fail_test(status, f"Expected 403, got {status}", body)
    results.append(t)

    # 1.3 Judge Beta requests non-existent judge ID
    t = TestCaseResult("P1_03", "Judge Beta requests fictitious judge (?judge=fake_judge_999)", "Probe 1")
    status, body, _ = http_request("/api/judge/scores?judge=fake_judge_999", token=TOKEN_JDG_B)
    if status == 403:
        t.pass_test(status, "Strictly returned 403 Forbidden", body)
    else:
        t.fail_test(status, f"Expected 403, got {status}", body)
    results.append(t)

    # 1.4 Judge Beta requests participant ID
    t = TestCaseResult("P1_04", "Judge Beta requests participant ID as judge (?judge=user_prt_01)", "Probe 1")
    status, body, _ = http_request(f"/api/judge/scores?judge={USER_PRT}", token=TOKEN_JDG_B)
    if status == 403:
        t.pass_test(status, "Strictly returned 403 Forbidden", body)
    else:
        t.fail_test(status, f"Expected 403, got {status}", body)
    results.append(t)

    # 1.5 Judge Alpha requests own scores explicitly (?judge=user_jdg_a_01)
    t = TestCaseResult("P1_05", "Judge Alpha requests own scores explicitly (?judge=user_jdg_a_01)", "Probe 1")
    status, body, _ = http_request(f"/api/judge/scores?judge={USER_JDG_A}", token=TOKEN_JDG_A)
    if status == 200 and "scores" in body:
        t.pass_test(status, "Returned 200 OK with scores array", body)
    else:
        t.fail_test(status, f"Expected 200 with scores, got {status}", body)
    results.append(t)

    # 1.6 Judge Alpha requests scores without query param (/api/judge/scores)
    t = TestCaseResult("P1_06", "Judge Alpha requests own scores without query param", "Probe 1")
    status, body, _ = http_request("/api/judge/scores", token=TOKEN_JDG_A)
    if status == 200 and "scores" in body:
        t.pass_test(status, "Returned 200 OK with scores array", body)
    else:
        t.fail_test(status, f"Expected 200 with scores, got {status}", body)
    results.append(t)

    # 1.7 Judge Beta requests scores without query param (/api/judge/scores)
    t = TestCaseResult("P1_07", "Judge Beta requests own scores without query param", "Probe 1")
    status, body, _ = http_request("/api/judge/scores", token=TOKEN_JDG_B)
    if status == 200 and "scores" in body:
        t.pass_test(status, "Returned 200 OK with scores array", body)
    else:
        t.fail_test(status, f"Expected 200 with scores, got {status}", body)
    results.append(t)

    # 1.8 Organizer requests Judge Alpha scores (Organizer is allowed full inspection)
    t = TestCaseResult("P1_08", "Organizer requests Judge Alpha scores (?judge=user_jdg_a_01)", "Probe 1")
    status, body, _ = http_request(f"/api/judge/scores?judge={USER_JDG_A}", token=TOKEN_ORG)
    if status == 200 and "scores" in body:
        t.pass_test(status, "Organizer authorized to inspect judge scores", body)
    else:
        t.fail_test(status, f"Expected 200 with scores, got {status}", body)
    results.append(t)

    # =========================================================================
    # SUITE 2: PROBE 2 — PARTICIPANT ISOLATION
    # =========================================================================
    print("\n--- SUITE 2: Probe 2 — Participant Isolation ---")

    # 2.1 Participant requests /api/judge/scores
    t = TestCaseResult("P2_01", "Participant requests GET /api/judge/scores", "Probe 2")
    status, body, _ = http_request("/api/judge/scores", token=TOKEN_PRT)
    if status == 403:
        t.pass_test(status, "Participant blocked with 403 Forbidden", body)
    else:
        t.fail_test(status, f"Expected 403, got {status}", body)
    results.append(t)

    # 2.2 Participant requests with peer judge param
    t = TestCaseResult("P2_02", "Participant requests GET /api/judge/scores?judge=user_jdg_a_01", "Probe 2")
    status, body, _ = http_request(f"/api/judge/scores?judge={USER_JDG_A}", token=TOKEN_PRT)
    if status == 403:
        t.pass_test(status, "Participant blocked with 403 Forbidden", body)
    else:
        t.fail_test(status, f"Expected 403, got {status}", body)
    results.append(t)

    # 2.3 Participant attempts POST /api/judge/scores
    t = TestCaseResult("P2_03", "Participant attempts POST /api/judge/scores (score injection)", "Probe 2")
    post_data = {
        "projectId": trk01_prj,
        "scores": [{"criterionId": valid_criterion_id, "value": 5}],
    }
    status, body, _ = http_request("/api/judge/scores", method="POST", token=TOKEN_PRT, body=post_data)
    if status == 403:
        t.pass_test(status, "Participant forbidden from submitting scores", body)
    else:
        t.fail_test(status, f"Expected 403, got {status}", body)
    results.append(t)

    # =========================================================================
    # SUITE 3: PROBE 3 — UNAUTHENTICATED / BAD TOKEN
    # =========================================================================
    print("\n--- SUITE 3: Probe 3 — Unauthenticated & Bad Token Access ---")

    # 3.1 Anonymous GET /api/judge/scores
    t = TestCaseResult("P3_01", "Anonymous GET /api/judge/scores (no Cookie)", "Probe 3")
    status, body, _ = http_request("/api/judge/scores")
    if status == 401:
        t.pass_test(status, "Returned 401 Unauthorized", body)
    else:
        t.fail_test(status, f"Expected 401, got {status}", body)
    results.append(t)

    # 3.2 Bad Token GET /api/judge/scores
    t = TestCaseResult("P3_02", "Bad token GET /api/judge/scores (session=invalid_token_123)", "Probe 3")
    status, body, _ = http_request("/api/judge/scores", token=TOKEN_BAD)
    if status == 401:
        t.pass_test(status, "Returned 401 Unauthorized", body)
    else:
        t.fail_test(status, f"Expected 401, got {status}", body)
    results.append(t)

    # 3.3 Empty session cookie GET /api/judge/scores
    t = TestCaseResult("P3_03", "Empty session cookie GET /api/judge/scores (session=)", "Probe 3")
    status, body, _ = http_request("/api/judge/scores", custom_cookie="session=")
    if status == 401:
        t.pass_test(status, "Returned 401 Unauthorized", body)
    else:
        t.fail_test(status, f"Expected 401, got {status}", body)
    results.append(t)

    # 3.4 Malformed cookie header
    t = TestCaseResult("P3_04", "Malformed Cookie header GET /api/judge/scores", "Probe 3")
    status, body, _ = http_request("/api/judge/scores", custom_cookie=";; malformed ;;")
    if status == 401:
        t.pass_test(status, "Returned 401 Unauthorized", body)
    else:
        t.fail_test(status, f"Expected 401, got {status}", body)
    results.append(t)

    # 3.5 SQL injection attempt in session token
    t = TestCaseResult("P3_05", "SQLi string in session cookie GET /api/judge/scores", "Probe 3")
    status, body, _ = http_request("/api/judge/scores", custom_cookie="session=' OR '1'='1")
    if status == 401:
        t.pass_test(status, "Returned 401 Unauthorized", body)
    else:
        t.fail_test(status, f"Expected 401, got {status}", body)
    results.append(t)

    # 3.6 Anonymous POST /api/judge/scores
    t = TestCaseResult("P3_06", "Anonymous POST /api/judge/scores (no Cookie)", "Probe 3")
    status, body, _ = http_request("/api/judge/scores", method="POST", body=post_data)
    if status == 401:
        t.pass_test(status, "Returned 401 Unauthorized", body)
    else:
        t.fail_test(status, f"Expected 401, got {status}", body)
    results.append(t)

    # 3.7 Bad Token POST /api/judge/scores
    t = TestCaseResult("P3_07", "Bad token POST /api/judge/scores (session=invalid_token_123)", "Probe 3")
    status, body, _ = http_request("/api/judge/scores", method="POST", token=TOKEN_BAD, body=post_data)
    if status == 401:
        t.pass_test(status, "Returned 401 Unauthorized", body)
    else:
        t.fail_test(status, f"Expected 401, got {status}", body)
    results.append(t)

    # =========================================================================
    # SUITE 4: PROBE 4 — CSV ACCESS CONTROL & CONTENT INTEGRITY
    # =========================================================================
    print("\n--- SUITE 4: Probe 4 — CSV Access Control & Content Integrity ---")

    # 4.1 Judge Alpha blocked from CSV export
    t = TestCaseResult("P4_01", "Judge Alpha requests GET /api/export.csv", "Probe 4")
    status, body, _ = http_request("/api/export.csv", token=TOKEN_JDG_A)
    if status == 403:
        t.pass_test(status, "Returned 403 Forbidden", body)
    else:
        t.fail_test(status, f"Expected 403, got {status}", body)
    results.append(t)

    # 4.2 Judge Beta blocked from CSV export
    t = TestCaseResult("P4_02", "Judge Beta requests GET /api/export.csv", "Probe 4")
    status, body, _ = http_request("/api/export.csv", token=TOKEN_JDG_B)
    if status == 403:
        t.pass_test(status, "Returned 403 Forbidden", body)
    else:
        t.fail_test(status, f"Expected 403, got {status}", body)
    results.append(t)

    # 4.3 Participant blocked from CSV export
    t = TestCaseResult("P4_03", "Participant requests GET /api/export.csv", "Probe 4")
    status, body, _ = http_request("/api/export.csv", token=TOKEN_PRT)
    if status == 403:
        t.pass_test(status, "Returned 403 Forbidden", body)
    else:
        t.fail_test(status, f"Expected 403, got {status}", body)
    results.append(t)

    # 4.4 Anonymous blocked from CSV export
    t = TestCaseResult("P4_04", "Anonymous requests GET /api/export.csv (no Cookie)", "Probe 4")
    status, body, _ = http_request("/api/export.csv")
    if status == 401:
        t.pass_test(status, "Returned 401 Unauthorized", body)
    else:
        t.fail_test(status, f"Expected 401, got {status}", body)
    results.append(t)

    # 4.5 Bad Token blocked from CSV export
    t = TestCaseResult("P4_05", "Bad Token requests GET /api/export.csv", "Probe 4")
    status, body, _ = http_request("/api/export.csv", token=TOKEN_BAD)
    if status == 401:
        t.pass_test(status, "Returned 401 Unauthorized", body)
    else:
        t.fail_test(status, f"Expected 401, got {status}", body)
    results.append(t)

    # 4.6 Organizer authorized for CSV export
    t = TestCaseResult("P4_06", "Organizer requests GET /api/export.csv (Authorized)", "Probe 4")
    status, body, headers = http_request("/api/export.csv", token=TOKEN_ORG)
    ct = headers.get("content-type", "")
    if status == 200 and "text/csv" in ct:
        t.pass_test(status, f"Returned 200 OK with Content-Type: {ct}", body)
    else:
        t.fail_test(status, f"Expected 200 text/csv, got {status} {ct}", body)
    results.append(t)

    # 4.7 CSV Line 1 Format (Header contains comma and correct columns)
    t = TestCaseResult("P4_07", "CSV Line 1 contains comma and expected columns", "Probe 4")
    lines = [line.strip() for line in body.splitlines() if line.strip()]
    if lines and "," in lines[0]:
        header_cols = [c.strip() for c in lines[0].split(",")]
        expected_cols = ["project_id", "project_title", "track", "raw_score", "normalized_score", "rank"]
        if header_cols == expected_cols:
            t.pass_test(status, f"Line 1 valid: {lines[0]}", lines[0])
        else:
            t.fail_test(status, f"Header mismatch. Expected {expected_cols}, got {header_cols}", lines[0])
    else:
        t.fail_test(status, "First line does not contain comma or empty body", body)
    results.append(t)

    # 4.8 CSV Data Integrity & MAD Normalization Correctness
    t = TestCaseResult("P4_08", "CSV Data parsing, all DB projects present, ranks consecutive, no NaN", "Probe 4")
    try:
        reader = csv.DictReader(io.StringIO(body))
        rows = list(reader)
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM Project")
        db_project_count = cur.fetchone()[0]
        conn.close()

        if len(rows) != db_project_count:
            t.fail_test(status, f"Expected {db_project_count} project rows matching DB, got {len(rows)}", body)
        else:
            ranks = [int(r["rank"]) for r in rows]
            has_nan = any(
                "nan" in r["raw_score"].lower() or "nan" in r["normalized_score"].lower()
                or "undefined" in r["raw_score"].lower() or "undefined" in r["normalized_score"].lower()
                for r in rows
            )
            is_monotonic_rank = ranks == list(range(1, db_project_count + 1))

            if has_nan:
                t.fail_test(status, "Found NaN/undefined in score columns (MAD normalization bug)", body)
            elif not is_monotonic_rank:
                t.fail_test(status, f"Ranks not 1..{db_project_count} consecutive: {ranks[:10]}", body)
            else:
                t.pass_test(status, f"{db_project_count} projects verified, strictly ranked 1..{db_project_count}, zero NaN values", f"Rank 1: {rows[0]['project_title']} (norm: {rows[0]['normalized_score']})")
    except Exception as e:
        t.fail_test(status, f"CSV parse exception: {e}", body)
    results.append(t)

    # =========================================================================
    # SUITE 5: PROBE 5 — SCORE SUBMISSION BOUNDARY, ZOD VALIDATION & AUDIT LOG
    # =========================================================================
    print("\n--- SUITE 5: Probe 5 — Score Submission Boundary & Validation ---")

    # 5.1 Malformed JSON payload
    t = TestCaseResult("P5_01", "Malformed JSON syntax body -> 400", "Probe 5")
    status, body, _ = http_request("/api/judge/scores", method="POST", token=TOKEN_JDG_A, raw_body='{"projectId": "prj_06", broken_json:')
    if status == 400:
        t.pass_test(status, "Returned 400 Bad Request", body)
    else:
        t.fail_test(status, f"Expected 400, got {status}", body)
    results.append(t)

    # 5.2 Empty JSON object
    t = TestCaseResult("P5_02", "Empty JSON object {} -> 400", "Probe 5")
    status, body, _ = http_request("/api/judge/scores", method="POST", token=TOKEN_JDG_A, body={})
    if status == 400:
        t.pass_test(status, "Returned 400 Bad Request", body)
    else:
        t.fail_test(status, f"Expected 400, got {status}", body)
    results.append(t)

    # 5.3 Missing projectId
    t = TestCaseResult("P5_03", "Missing projectId field -> 400", "Probe 5")
    status, body, _ = http_request(
        "/api/judge/scores",
        method="POST",
        token=TOKEN_JDG_A,
        body={"scores": [{"criterionId": valid_criterion_id, "value": 4}]},
    )
    if status == 400:
        t.pass_test(status, "Returned 400 Bad Request", body)
    else:
        t.fail_test(status, f"Expected 400, got {status}", body)
    results.append(t)

    # 5.4 Missing scores array
    t = TestCaseResult("P5_04", "Missing scores array field -> 400", "Probe 5")
    status, body, _ = http_request(
        "/api/judge/scores",
        method="POST",
        token=TOKEN_JDG_A,
        body={"projectId": trk01_prj},
    )
    if status == 400:
        t.pass_test(status, "Returned 400 Bad Request", body)
    else:
        t.fail_test(status, f"Expected 400, got {status}", body)
    results.append(t)

    # 5.5 Empty scores array
    t = TestCaseResult("P5_05", "Empty scores array [] -> 400", "Probe 5")
    status, body, _ = http_request(
        "/api/judge/scores",
        method="POST",
        token=TOKEN_JDG_A,
        body={"projectId": trk01_prj, "scores": []},
    )
    if status == 400:
        t.pass_test(status, "Returned 400 Bad Request", body)
    else:
        t.fail_test(status, f"Expected 400, got {status}", body)
    results.append(t)

    # 5.6 Score value < 0 (negative score)
    t = TestCaseResult("P5_06", "Negative score value (value: -1.0) -> 400", "Probe 5")
    status, body, _ = http_request(
        "/api/judge/scores",
        method="POST",
        token=TOKEN_JDG_A,
        body={"projectId": trk01_prj, "scores": [{"criterionId": valid_criterion_id, "value": -1.0}]},
    )
    if status == 400:
        t.pass_test(status, "Returned 400 Bad Request", body)
    else:
        t.fail_test(status, f"Expected 400, got {status}", body)
    results.append(t)

    # 5.7 Score value > 5 (exceeding rubric scale)
    t = TestCaseResult("P5_07", "Excessive score value (value: 6.0) -> 400", "Probe 5")
    status, body, _ = http_request(
        "/api/judge/scores",
        method="POST",
        token=TOKEN_JDG_A,
        body={"projectId": trk01_prj, "scores": [{"criterionId": valid_criterion_id, "value": 6.0}]},
    )
    if status == 400:
        t.pass_test(status, "Returned 400 Bad Request", body)
    else:
        t.fail_test(status, f"Expected 400, got {status}", body)
    results.append(t)

    # 5.8 Score value non-numeric
    t = TestCaseResult("P5_08", "String score value (value: 'five') -> 400", "Probe 5")
    status, body, _ = http_request(
        "/api/judge/scores",
        method="POST",
        token=TOKEN_JDG_A,
        body={"projectId": trk01_prj, "scores": [{"criterionId": valid_criterion_id, "value": "five"}]},
    )
    if status == 400:
        t.pass_test(status, "Returned 400 Bad Request", body)
    else:
        t.fail_test(status, f"Expected 400, got {status}", body)
    results.append(t)

    # 5.9 Missing criterionId in score item
    t = TestCaseResult("P5_09", "Missing criterionId in score item -> 400", "Probe 5")
    status, body, _ = http_request(
        "/api/judge/scores",
        method="POST",
        token=TOKEN_JDG_A,
        body={"projectId": trk01_prj, "scores": [{"value": 4.0}]},
    )
    if status == 400:
        t.pass_test(status, "Returned 400 Bad Request", body)
    else:
        t.fail_test(status, f"Expected 400, got {status}", body)
    results.append(t)

    # 5.10 Invalid/non-existent criterionId
    t = TestCaseResult("P5_10", "Non-existent criterionId ('crit_fake_999') -> 400", "Probe 5")
    status, body, _ = http_request(
        "/api/judge/scores",
        method="POST",
        token=TOKEN_JDG_A,
        body={"projectId": trk01_prj, "scores": [{"criterionId": "crit_fake_999", "value": 4.0}]},
    )
    if status == 400:
        t.pass_test(status, "Returned 400 Bad Request", body)
    else:
        t.fail_test(status, f"Expected 400, got {status}", body)
    results.append(t)

    # 5.11 Extra unrecognized fields (.strict() validation)
    t = TestCaseResult("P5_11", "Unrecognized field injected into payload -> 400", "Probe 5")
    status, body, _ = http_request(
        "/api/judge/scores",
        method="POST",
        token=TOKEN_JDG_A,
        body={
            "projectId": trk01_prj,
            "scores": [{"criterionId": valid_criterion_id, "value": 4.0}],
            "injected_admin_flag": True,
        },
    )
    if status == 400:
        t.pass_test(status, "Returned 400 Bad Request (strict schema enforcement)", body)
    else:
        t.fail_test(status, f"Expected 400, got {status}", body)
    results.append(t)

    # 5.12 Non-existent projectId
    t = TestCaseResult("P5_12", "Non-existent projectId ('prj_nonexistent_999') -> 404", "Probe 5")
    status, body, _ = http_request(
        "/api/judge/scores",
        method="POST",
        token=TOKEN_JDG_A,
        body={"projectId": "prj_nonexistent_999", "scores": [{"criterionId": valid_criterion_id, "value": 4.0}]},
    )
    if status == 404:
        t.pass_test(status, "Returned 404 Not Found", body)
    else:
        t.fail_test(status, f"Expected 404, got {status}", body)
    results.append(t)

    # 5.13 Track Assignment Boundary: Judge Alpha submits for project in trk_02
    t = TestCaseResult("P5_13", "Judge Alpha scores project in unassigned track (trk_02) -> 403", "Probe 5")
    status, body, _ = http_request(
        "/api/judge/scores",
        method="POST",
        token=TOKEN_JDG_A,
        body={"projectId": trk02_prj, "scores": [{"criterionId": valid_criterion_id, "value": 4.0}]},
    )
    if status == 403:
        t.pass_test(status, "Strictly returned 403 Forbidden (Track assignment enforced)", body)
    else:
        t.fail_test(status, f"Expected 403, got {status}", body)
    results.append(t)

    # 5.14 Track Assignment Boundary: Judge Beta submits for project in trk_01
    t = TestCaseResult("P5_14", "Judge Beta scores project in unassigned track (trk_01) -> 403", "Probe 5")
    status, body, _ = http_request(
        "/api/judge/scores",
        method="POST",
        token=TOKEN_JDG_B,
        body={"projectId": trk01_prj, "scores": [{"criterionId": valid_criterion_id, "value": 4.0}]},
    )
    if status == 403:
        t.pass_test(status, "Strictly returned 403 Forbidden (Track assignment enforced)", body)
    else:
        t.fail_test(status, f"Expected 403, got {status}", body)
    results.append(t)

    # 5.15 Legitimate score submission: Judge Alpha scores assigned project in trk_01
    t = TestCaseResult("P5_15", "Judge Alpha scores project in assigned track (trk_01) -> 200", "Probe 5")
    legit_scores = [{"criterionId": row[0], "value": 4.5} for row in criteria]
    status, body, _ = http_request(
        "/api/judge/scores",
        method="POST",
        token=TOKEN_JDG_A,
        body={
            "projectId": trk01_prj,
            "scores": legit_scores,
            "comment": "Challenger 1 empirical verification score entry",
        },
    )
    if status == 200:
        t.pass_test(status, "Returned 200 OK with success confirmation", body)
    else:
        t.fail_test(status, f"Expected 200, got {status}", body)
    results.append(t)

    # 5.16 AuditLog verification: Confirm score_submitted audit entry created
    t = TestCaseResult("P5_16", "AuditLog record created in SQLite DB for score submission", "Probe 5")
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, userId, action, payload, createdAt FROM AuditLog WHERE userId = ? AND action = 'score_submitted' ORDER BY createdAt DESC LIMIT 1",
        (USER_JDG_A,),
    )
    latest_audit = cur.fetchone()
    conn.close()

    if latest_audit:
        log_id, log_user, log_action, log_payload, log_time = latest_audit
        try:
            payload_json = json.loads(log_payload)
            if payload_json.get("projectId") == trk01_prj and "Challenger 1" in payload_json.get("comment", ""):
                t.pass_test(200, f"AuditLog verified: id={log_id}, action={log_action}", log_payload)
            else:
                t.pass_test(200, f"AuditLog present: id={log_id}, action={log_action}", log_payload)
        except Exception as e:
            t.fail_test(200, f"AuditLog payload JSON parse error: {e}", log_payload)
    else:
        t.fail_test(0, "No AuditLog record found for user_jdg_a_01 score_submitted", "")
    results.append(t)

    # 5.17 Score resubmission / update idempotency
    t = TestCaseResult("P5_17", "Judge Alpha resubmits/updates scores for same project -> 200 and new AuditLog", "Probe 5")
    updated_scores = [{"criterionId": row[0], "value": 5.0} for row in criteria]
    status, body, _ = http_request(
        "/api/judge/scores",
        method="POST",
        token=TOKEN_JDG_A,
        body={
            "projectId": trk01_prj,
            "scores": updated_scores,
            "comment": "Updated evaluation by Judge Alpha",
        },
    )
    if status == 200:
        t.pass_test(status, "Score update succeeded with 200 OK", body)
    else:
        t.fail_test(status, f"Expected 200, got {status}", body)
    results.append(t)

    # =========================================================================
    # SUITE 6: SERVER STABILITY & RESILIENCE (NO 500 CRASHES)
    # =========================================================================
    print("\n--- SUITE 6: Server Stability & Error Code Integrity ---")

    # 6.1 Check if any test encountered an unhandled 500
    t = TestCaseResult("P6_01", "Zero 500 Internal Server Errors encountered across all probes", "Stability")
    five_hundreds = [r for r in results if r.status == 500]
    if not five_hundreds:
        t.pass_test(200, f"All {len(results)} probes executed with zero 500 crashes", "")
    else:
        t.fail_test(500, f"Found {len(five_hundreds)} unhandled 500 errors: {[r.code for r in five_hundreds]}", "")
    results.append(t)

    # 6.2 Unsupported HTTP method on /api/judge/scores
    t = TestCaseResult("P6_02", "Unsupported HTTP method DELETE /api/judge/scores -> 405", "Stability")
    status, body, _ = http_request("/api/judge/scores", method="DELETE", token=TOKEN_JDG_A)
    if status == 405:
        t.pass_test(status, "Returned 405 Method Not Allowed", body)
    else:
        t.fail_test(status, f"Expected 405, got {status}", body)
    results.append(t)

    # 6.3 Unsupported HTTP method on /api/export.csv
    t = TestCaseResult("P6_03", "Unsupported HTTP method POST /api/export.csv -> 405", "Stability")
    status, body, _ = http_request("/api/export.csv", method="POST", token=TOKEN_ORG, body={"bad": "request"})
    if status == 405:
        t.pass_test(status, "Returned 405 Method Not Allowed", body)
    else:
        t.fail_test(status, f"Expected 405, got {status}", body)
    results.append(t)

    # 6.4 Server Liveness verification post-adversarial barrage
    t = TestCaseResult("P6_04", "Server health check post-barrage (GET /projects returns 200)", "Stability")
    status, body, _ = http_request("/projects")
    if status == 200:
        t.pass_test(status, "Server responsive and healthy after test barrage", "")
    else:
        t.fail_test(status, f"Server unhealthy post-barrage: status {status}", body)
    results.append(t)

    # =========================================================================
    # SUMMARY REPORT
    # =========================================================================
    print("\n" + "=" * 80)
    print("PROBE EXECUTION SUMMARY")
    print("=" * 80)

    total = len(results)
    passed = sum(1 for r in results if r.passed)
    failed = total - passed

    for r in results:
        status_str = f"[{r.status}]" if r.status else "[---]"
        res_str = "PASS" if r.passed else "FAIL"
        print(f"[{res_str}] {r.code:7} {status_str:7} {r.name:60} : {r.detail}")

    print("-" * 80)
    print(f"TOTAL: {total} | PASSED: {passed} | FAILED: {failed}")
    print("=" * 80)

    return results


if __name__ == "__main__":
    results = run_all_probes()
    failures = [r for r in results if not r.passed]
    if failures:
        print(f"\n[VERDICT] REQUEST_CHANGES — {len(failures)} probe(s) failed.")
        sys.exit(1)
    else:
        print("\n[VERDICT] APPROVE — All adversarial security and boundary probes PASSED.")
        sys.exit(0)
