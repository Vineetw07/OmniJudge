#!/usr/bin/env python3
"""
Adversarial edge-case and boundary verification suite for Phase 2 routes.
Tests executed against http://localhost:8080:
- GET /projects (public access, case sensitivity, title presence, query injection, method enforcement)
- POST /api/projects (unauthenticated -> 401, non-participant role -> 403, invalid JSON/body -> 400, closed deadline -> 409)
- POST /api/auth/login (invalid email -> 400, unknown email -> 401, valid test emails -> 200 with Set-Cookie, session validation)
"""

import sys
import json
import urllib.request
import urllib.error
import urllib.parse
from http.cookies import SimpleCookie

BASE_URL = "http://localhost:8080"
TIMEOUT = 10

class TestResult:
    def __init__(self, name, description):
        self.name = name
        self.description = description
        self.passed = False
        self.status = None
        self.response_body = ""
        self.headers = {}
        self.error_detail = ""

    def record_success(self, status, body, headers):
        self.passed = True
        self.status = status
        self.response_body = body[:500]
        self.headers = headers

    def record_failure(self, status, body, headers, error_detail):
        self.passed = False
        self.status = status
        self.response_body = body[:500] if body else ""
        self.headers = headers
        self.error_detail = error_detail

def make_request(path, method="GET", headers=None, body=None, raw_body=None):
    url = f"{BASE_URL}{path}"
    req_headers = headers or {}
    data = None

    if raw_body is not None:
        if isinstance(raw_body, str):
            data = raw_body.encode("utf-8")
        else:
            data = raw_body
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

def run_tests():
    results = []

    print("=" * 80)
    print("STARTING ADVERSARIAL TEST SUITE FOR PHASE 2")
    print(f"Target URL: {BASE_URL}")
    print("=" * 80)

    # =========================================================================
    # SUITE 1: GET /projects
    # =========================================================================
    print("\n--- Running Suite 1: GET /projects ---")

    # 1.1 Public access without auth
    t = TestResult("GET_PROJECTS_PUBLIC_ACCESS", "Unauthenticated GET /projects returns 200 with HTML")
    status, body, headers = make_request("/projects")
    ct = headers.get("content-type", "")
    if status == 200 and "text/html" in ct:
        t.record_success(status, body, headers)
    else:
        t.record_failure(status, body, headers, f"Expected 200 text/html, got {status} {ct}")
    results.append(t)

    # 1.2 Fixture project titles presence
    t = TestResult("GET_PROJECTS_TITLES_PRESENCE", "HTML contains fixture titles (Glass Signal, Small Meadow, Deep Compass)")
    status, body, headers = make_request("/projects")
    found_titles = []
    for title in ["Glass Signal", "Small Meadow", "Deep Compass"]:
        if title.lower() in body.lower():
            found_titles.append(title)
    if status == 200 and len(found_titles) >= 3:
        t.record_success(status, f"Found titles: {found_titles}", headers)
    else:
        t.record_failure(status, body, headers, f"Missing fixture titles. Found only: {found_titles}")
    results.append(t)

    # 1.3 Case sensitivity preservation in rendered HTML
    t = TestResult("GET_PROJECTS_CASE_PRESERVATION", "Rendered HTML preserves exact title casing (Glass Signal)")
    if "Glass Signal" in body and "Small Meadow" in body and "Deep Compass" in body:
        t.record_success(status, "Exact case matches found", headers)
    else:
        t.record_failure(status, body, headers, "Exact case was mutated or not preserved in HTML")
    results.append(t)

    # 1.4 GET /projects with valid participant cookie
    t = TestResult("GET_PROJECTS_AUTHENTICATED_COOKIE", "GET /projects with valid participant session cookie returns 200")
    status, body, headers = make_request("/projects", headers={"Cookie": "session=prt_seed_token_2026"})
    if status == 200:
        t.record_success(status, body, headers)
    else:
        t.record_failure(status, body, headers, f"Expected 200, got {status}")
    results.append(t)

    # 1.5 GET /projects with corrupted / malicious cookie
    t = TestResult("GET_PROJECTS_CORRUPT_COOKIE", "GET /projects with malformed/SQLi cookie returns 200 gracefully")
    status, body, headers = make_request("/projects", headers={"Cookie": "session=' OR '1'='1; bad_cookie=###"})
    if status == 200:
        t.record_success(status, body, headers)
    else:
        t.record_failure(status, body, headers, f"Expected 200, got {status}")
    results.append(t)

    # 1.6 GET /projects with query parameters & XSS probe
    t = TestResult("GET_PROJECTS_QUERY_XSS", "GET /projects with arbitrary & XSS query parameters returns 200")
    status, body, headers = make_request("/projects?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E&page=-1&foo=bar")
    if status == 200:
        t.record_success(status, body, headers)
    else:
        t.record_failure(status, body, headers, f"Expected 200, got {status}")
    results.append(t)

    # 1.7 API route method enforcement (PUT/DELETE /api/projects return 405)
    t = TestResult("API_PROJECTS_DISALLOWED_METHOD_PUT", "PUT /api/projects returns 405 Method Not Allowed")
    status, body, headers = make_request("/api/projects", method="PUT", body={"test": 1})
    if status == 405:
        t.record_success(status, body, headers)
    else:
        t.record_failure(status, body, headers, f"Expected 405 Method Not Allowed, got {status}")
    results.append(t)

    t = TestResult("API_PROJECTS_DISALLOWED_METHOD_DELETE", "DELETE /api/projects returns 405 Method Not Allowed")
    status, body, headers = make_request("/api/projects", method="DELETE")
    if status == 405:
        t.record_success(status, body, headers)
    else:
        t.record_failure(status, body, headers, f"Expected 405 Method Not Allowed, got {status}")
    results.append(t)

    # =========================================================================
    # SUITE 2: POST /api/projects
    # =========================================================================
    print("\n--- Running Suite 2: POST /api/projects ---")

    valid_payload = {
        "title": "Adversarial Edge Project",
        "summary": "Valid summary description for testing",
        "repoUrl": "https://github.com/dogfood/test-project"
    }

    # 2.1 Unauthenticated POST
    t = TestResult("POST_PROJECTS_NO_AUTH", "Unauthenticated POST /api/projects returns 401 Unauthorized")
    status, body, headers = make_request("/api/projects", method="POST", body=valid_payload)
    if status == 401:
        t.record_success(status, body, headers)
    else:
        t.record_failure(status, body, headers, f"Expected 401, got {status}")
    results.append(t)

    # 2.2 Invalid / Non-existent session token
    t = TestResult("POST_PROJECTS_INVALID_TOKEN", "POST /api/projects with fake session token returns 401")
    status, body, headers = make_request("/api/projects", method="POST", headers={"Cookie": "session=fake_invalid_token_999"}, body=valid_payload)
    if status == 401:
        t.record_success(status, body, headers)
    else:
        t.record_failure(status, body, headers, f"Expected 401, got {status}")
    results.append(t)

    # 2.3 Empty session cookie value
    t = TestResult("POST_PROJECTS_EMPTY_COOKIE_VAL", "POST /api/projects with empty session cookie returns 401")
    status, body, headers = make_request("/api/projects", method="POST", headers={"Cookie": "session="}, body=valid_payload)
    if status == 401:
        t.record_success(status, body, headers)
    else:
        t.record_failure(status, body, headers, f"Expected 401, got {status}")
    results.append(t)

    # 2.4 Non-participant role (Judge A) -> 403 Forbidden
    t = TestResult("POST_PROJECTS_ROLE_JUDGE_A", "POST /api/projects as judge_a returns 403 Forbidden")
    status, body, headers = make_request("/api/projects", method="POST", headers={"Cookie": "session=jdg_a_seed_token_2026"}, body=valid_payload)
    if status == 403:
        t.record_success(status, body, headers)
    else:
        t.record_failure(status, body, headers, f"Expected 403, got {status}")
    results.append(t)

    # 2.5 Non-participant role (Judge B) -> 403 Forbidden
    t = TestResult("POST_PROJECTS_ROLE_JUDGE_B", "POST /api/projects as judge_b returns 403 Forbidden")
    status, body, headers = make_request("/api/projects", method="POST", headers={"Cookie": "session=jdg_b_seed_token_2026"}, body=valid_payload)
    if status == 403:
        t.record_success(status, body, headers)
    else:
        t.record_failure(status, body, headers, f"Expected 403, got {status}")
    results.append(t)

    # 2.6 Malformed JSON body as participant -> 400 Bad Request
    t = TestResult("POST_PROJECTS_MALFORMED_JSON", "POST /api/projects as participant with malformed JSON returns 400")
    status, body, headers = make_request("/api/projects", method="POST", headers={"Cookie": "session=prt_seed_token_2026", "Content-Type": "application/json"}, raw_body="{title: broken json")
    if status == 400:
        t.record_success(status, body, headers)
    else:
        t.record_failure(status, body, headers, f"Expected 400, got {status}")
    results.append(t)

    # 2.7 Missing required field 'title' -> 400 Bad Request
    t = TestResult("POST_PROJECTS_MISSING_TITLE", "POST /api/projects as participant missing title returns 400")
    status, body, headers = make_request("/api/projects", method="POST", headers={"Cookie": "session=prt_seed_token_2026"}, body={"summary": "Has summary but no title"})
    if status == 400:
        t.record_success(status, body, headers)
    else:
        t.record_failure(status, body, headers, f"Expected 400, got {status}")
    results.append(t)

    # 2.8 Empty string 'title' -> 400 Bad Request
    t = TestResult("POST_PROJECTS_EMPTY_TITLE", "POST /api/projects as participant with empty title returns 400")
    status, body, headers = make_request("/api/projects", method="POST", headers={"Cookie": "session=prt_seed_token_2026"}, body={"title": "", "summary": "Valid summary"})
    if status == 400:
        t.record_success(status, body, headers)
    else:
        t.record_failure(status, body, headers, f"Expected 400, got {status}")
    results.append(t)

    # 2.9 Missing required field 'summary' -> 400 Bad Request
    t = TestResult("POST_PROJECTS_MISSING_SUMMARY", "POST /api/projects as participant missing summary returns 400")
    status, body, headers = make_request("/api/projects", method="POST", headers={"Cookie": "session=prt_seed_token_2026"}, body={"title": "Has title but no summary"})
    if status == 400:
        t.record_success(status, body, headers)
    else:
        t.record_failure(status, body, headers, f"Expected 400, got {status}")
    results.append(t)

    # 2.10 Invalid repoUrl format -> 400 Bad Request
    t = TestResult("POST_PROJECTS_INVALID_REPO_URL", "POST /api/projects as participant with invalid repoUrl returns 400")
    status, body, headers = make_request("/api/projects", method="POST", headers={"Cookie": "session=prt_seed_token_2026"}, body={"title": "Title", "summary": "Summary", "repoUrl": "not-a-valid-url"})
    if status == 400:
        t.record_success(status, body, headers)
    else:
        t.record_failure(status, body, headers, f"Expected 400, got {status}")
    results.append(t)

    # 2.11 Closed event deadline check -> 409 Conflict
    t = TestResult("POST_PROJECTS_CLOSED_DEADLINE_PARTICIPANT", "POST /api/projects as participant with valid payload returns 409 Conflict")
    status, body, headers = make_request("/api/projects", method="POST", headers={"Cookie": "session=prt_seed_token_2026"}, body=valid_payload)
    if status == 409:
        t.record_success(status, body, headers)
    else:
        t.record_failure(status, body, headers, f"Expected 409 Conflict, got {status}")
    results.append(t)

    # 2.12 Closed event deadline check as organizer -> 409 Conflict
    t = TestResult("POST_PROJECTS_CLOSED_DEADLINE_ORGANIZER", "POST /api/projects as organizer with valid payload returns 409 Conflict")
    status, body, headers = make_request("/api/projects", method="POST", headers={"Cookie": "session=org_seed_token_2026"}, body=valid_payload)
    if status == 409:
        t.record_success(status, body, headers)
    else:
        t.record_failure(status, body, headers, f"Expected 409 Conflict, got {status}")
    results.append(t)

    # 2.13 Invalid non-existent eventId -> 404 Not Found
    t = TestResult("POST_PROJECTS_UNKNOWN_EVENT_ID", "POST /api/projects with invalid eventId returns 404 Not Found")
    invalid_event_payload = dict(valid_payload)
    invalid_event_payload["eventId"] = "non_existent_event_99999"
    status, body, headers = make_request("/api/projects", method="POST", headers={"Cookie": "session=prt_seed_token_2026"}, body=invalid_event_payload)
    if status == 404:
        t.record_success(status, body, headers)
    else:
        t.record_failure(status, body, headers, f"Expected 404 Not Found, got {status}")
    results.append(t)

    # 2.14 GET /api/projects public list
    t = TestResult("GET_API_PROJECTS_LIST", "GET /api/projects returns 200 with JSON projects array")
    status, body, headers = make_request("/api/projects")
    try:
        data = json.loads(body)
        if status == 200 and "projects" in data and isinstance(data["projects"], list):
            t.record_success(status, f"Returned {len(data['projects'])} projects", headers)
        else:
            t.record_failure(status, body, headers, f"Expected 200 JSON with projects array, got {status}")
    except Exception as e:
        t.record_failure(status, body, headers, f"JSON parse error: {e}")
    results.append(t)

    # =========================================================================
    # SUITE 3: POST /api/auth/login
    # =========================================================================
    print("\n--- Running Suite 3: POST /api/auth/login ---")

    # 3.1 Malformed JSON body
    t = TestResult("POST_LOGIN_MALFORMED_JSON", "POST /api/auth/login with malformed JSON returns 400")
    status, body, headers = make_request("/api/auth/login", method="POST", headers={"Content-Type": "application/json"}, raw_body="{email: broken")
    if status == 400:
        t.record_success(status, body, headers)
    else:
        t.record_failure(status, body, headers, f"Expected 400, got {status}")
    results.append(t)

    # 3.2 Empty JSON body
    t = TestResult("POST_LOGIN_EMPTY_BODY", "POST /api/auth/login with empty JSON object returns 400")
    status, body, headers = make_request("/api/auth/login", method="POST", body={})
    if status == 400:
        t.record_success(status, body, headers)
    else:
        t.record_failure(status, body, headers, f"Expected 400, got {status}")
    results.append(t)

    # 3.3 Missing email field
    t = TestResult("POST_LOGIN_MISSING_EMAIL", "POST /api/auth/login with missing email returns 400")
    status, body, headers = make_request("/api/auth/login", method="POST", body={"username": "participant"})
    if status == 400:
        t.record_success(status, body, headers)
    else:
        t.record_failure(status, body, headers, f"Expected 400, got {status}")
    results.append(t)

    # 3.4 Invalid email formats
    invalid_emails = [
        "notanemail",
        "user@",
        "@domain.com",
        "user name@domain.com",
        "user@domain..com",
        "",
        "   "
    ]
    for inv_email in invalid_emails:
        t = TestResult(f"POST_LOGIN_INVALID_EMAIL_{inv_email.replace('@', '_at_').replace(' ', '_') or 'empty'}", f"POST /api/auth/login with invalid email '{inv_email}' returns 400")
        status, body, headers = make_request("/api/auth/login", method="POST", body={"email": inv_email})
        if status == 400:
            t.record_success(status, body, headers)
        else:
            t.record_failure(status, body, headers, f"Expected 400, got {status}")
        results.append(t)

    # 3.5 SQL Injection strings in email
    t = TestResult("POST_LOGIN_SQLI_EMAIL", "POST /api/auth/login with SQL injection payload in email returns 400")
    status, body, headers = make_request("/api/auth/login", method="POST", body={"email": "' OR '1'='1"})
    if status == 400:
        t.record_success(status, body, headers)
    else:
        t.record_failure(status, body, headers, f"Expected 400, got {status}")
    results.append(t)

    # 3.6 Unknown / non-existent email
    t = TestResult("POST_LOGIN_UNKNOWN_EMAIL", "POST /api/auth/login with unknown valid email returns 401")
    status, body, headers = make_request("/api/auth/login", method="POST", body={"email": "nobody_exists_in_db_12345@dogfood.dev"})
    if status == 401:
        t.record_success(status, body, headers)
    else:
        t.record_failure(status, body, headers, f"Expected 401, got {status}")
    results.append(t)

    # 3.7 Valid test users login (organizer, judge_a, judge_b, participant)
    test_users = [
        ("organizer@dogfood.dev", "organizer"),
        ("judge_a@dogfood.dev", "judge"),
        ("judge_b@dogfood.dev", "judge"),
        ("participant@dogfood.dev", "participant"),
    ]

    captured_tokens = {}

    for email, expected_role in test_users:
        t = TestResult(f"POST_LOGIN_VALID_{expected_role.upper()}_{email.split('@')[0]}", f"POST /api/auth/login with '{email}' returns 200 + Set-Cookie")
        status, body, headers = make_request("/api/auth/login", method="POST", body={"email": email})
        set_cookie = headers.get("set-cookie", "")

        token_found = None
        if "session=" in set_cookie:
            # Extract token
            cookie = SimpleCookie()
            cookie.load(set_cookie)
            if "session" in cookie:
                token_found = cookie["session"].value

        try:
            data = json.loads(body)
            role_match = data.get("user", {}).get("role") == expected_role
            has_token = bool(token_found)
            if status == 200 and role_match and has_token:
                captured_tokens[email] = token_found
                t.record_success(status, f"Role: {expected_role}, Token: {token_found[:8]}...", headers)
            else:
                t.record_failure(status, body, headers, f"Status={status}, role_match={role_match}, has_token={has_token}")
        except Exception as e:
            t.record_failure(status, body, headers, f"Response error: {e}")
        results.append(t)

    # 3.8 Email case insensitivity
    t = TestResult("POST_LOGIN_CASE_INSENSITIVE", "POST /api/auth/login with UPPERCASE email returns 200")
    status, body, headers = make_request("/api/auth/login", method="POST", body={"email": "PARTICIPANT@DOGFOOD.DEV"})
    if status == 200 and "session=" in headers.get("set-cookie", ""):
        t.record_success(status, body, headers)
    else:
        t.record_failure(status, body, headers, f"Expected 200 with Set-Cookie, got {status}")
    results.append(t)

    # 3.9 Email leading/trailing whitespace probe (trimmed properly by backend)
    t = TestResult("POST_LOGIN_WHITESPACE_TRIM", "POST /api/auth/login with whitespace email is trimmed and accepted with 200")
    status, body, headers = make_request("/api/auth/login", method="POST", body={"email": "   participant@dogfood.dev   "})
    if status == 200:
        t.record_success(status, "Confirmed: backend trims email and succeeds with 200", headers)
    else:
        t.record_failure(status, body, headers, f"Expected 200, got {status}")
    results.append(t)

    # 3.10 Verify newly logged-in participant token works for POST /api/projects
    t = TestResult("AUTH_SESSION_INTEGRATION_PARTICIPANT", "Use session token from login to call POST /api/projects -> 409 (not 401)")
    prt_token = captured_tokens.get("participant@dogfood.dev")
    if prt_token:
        status, body, headers = make_request("/api/projects", method="POST", headers={"Cookie": f"session={prt_token}"}, body=valid_payload)
        # It must NOT return 401 (auth succeeds) and must return 409 (deadline check)
        if status == 409:
            t.record_success(status, body, headers)
        else:
            t.record_failure(status, body, headers, f"Expected 409 (authenticated but closed), got {status}")
    else:
        t.record_failure(0, "", {}, "No participant token captured in login step")
    results.append(t)

    # 3.11 Verify newly logged-in judge token returns 403 on POST /api/projects
    t = TestResult("AUTH_SESSION_INTEGRATION_JUDGE_ROLE", "Use session token from judge login to call POST /api/projects -> 403 Forbidden")
    jdg_token = captured_tokens.get("judge_a@dogfood.dev")
    if jdg_token:
        status, body, headers = make_request("/api/projects", method="POST", headers={"Cookie": f"session={jdg_token}"}, body=valid_payload)
        if status == 403:
            t.record_success(status, body, headers)
        else:
            t.record_failure(status, body, headers, f"Expected 403 Forbidden, got {status}")
    else:
        t.record_failure(0, "", {}, "No judge token captured in login step")
    results.append(t)

    # 3.12 Disallowed HTTP method GET /api/auth/login
    t = TestResult("POST_LOGIN_DISALLOWED_GET", "GET /api/auth/login returns 405 Method Not Allowed")
    status, body, headers = make_request("/api/auth/login", method="GET")
    if status == 405:
        t.record_success(status, body, headers)
    else:
        t.record_failure(status, body, headers, f"Expected 405 Method Not Allowed, got {status}")
    results.append(t)

    # =========================================================================
    # SUMMARY REPORT
    # =========================================================================
    total = len(results)
    passed = sum(1 for r in results if r.passed)
    failed = total - passed

    print("\n" + "=" * 80)
    print("DETAILED RESULTS")
    print("=" * 80)
    for r in results:
        mark = "PASS" if r.passed else "FAIL"
        print(f"[{mark}] {r.name}: {r.description}")
        print(f"       Status: {r.status}")
        if not r.passed:
            print(f"       Error: {r.error_detail}")
            print(f"       Response snippet: {r.response_body[:200]}")

    print("\n" + "=" * 80)
    print(f"SUMMARY: Total: {total} | Passed: {passed} | Failed: {failed}")
    print("=" * 80)

    return total, passed, failed, results

if __name__ == "__main__":
    total, passed, failed, results = run_tests()
    if failed > 0:
        sys.exit(1)
    else:
        sys.exit(0)
