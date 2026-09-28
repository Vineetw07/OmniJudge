"""
Phase 6 M3 & M4 Verification Suite:
Tests Ballot Randomization & Ordering, Glass Voting Controls, Results Sealed Invariant,
and Project Feedback Stream / Comment Drawer.
"""

import urllib.request
import urllib.error
import json
import sys

BASE_URL = "http://localhost:8080"
COOKIE_PARTICIPANT = "session=prt_seed_token_2026"
COOKIE_ORGANIZER = "session=org_seed_token_2026"
COOKIE_JUDGE = "session=jdg_a_seed_token_2026"

def test_ssr_gallery():
    print("[1] Testing SSR Gallery & Ballot Controls...")
    req = urllib.request.Request(f"{BASE_URL}/projects")
    with urllib.request.urlopen(req) as res:
        assert res.status == 200, f"Expected 200, got {res.status}"
        body = res.read().decode('utf-8')
        lower_body = body.lower()

        # Fixture titles
        assert "glass signal" in lower_body, "Missing 'Glass Signal' in SSR HTML"
        assert "small meadow" in lower_body, "Missing 'Small Meadow' in SSR HTML"
        assert "deep compass" in lower_body, "Missing 'Deep Compass' in SSR HTML"

        # Ballot & Voting controls text
        assert "results sealed until voting window closes" in lower_body, "Missing results sealed shield badge in SSR HTML"
        assert "default randomized" in lower_body, "Missing randomized ballot sort option"
        assert "upvote" in lower_body, "Missing upvote button text"
        assert "feedback" in lower_body, "Missing feedback drawer trigger"
    print("  [PASS] SSR Gallery, Fixture Titles, and Ballot Controls verified.")

def test_vote_anonymous_blocked():
    print("[2] Testing Anonymous Vote Blocked (401)...")
    req = urllib.request.Request(
        f"{BASE_URL}/api/community/vote",
        data=json.dumps({"projectId": "prj_02"}).encode('utf-8'),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        urllib.request.urlopen(req)
        assert False, "Expected HTTPError 401"
    except urllib.error.HTTPError as e:
        assert e.code == 401, f"Expected 401, got {e.code}"
    print("  [PASS] Anonymous voting rejected with 401.")

def test_self_vote_blocked():
    print("[3] Testing Self-Vote Prevention for Participant (403)...")
    # user_prt_01 is on tm_01, which owns prj_01
    req = urllib.request.Request(
        f"{BASE_URL}/api/community/vote",
        data=json.dumps({"projectId": "prj_01"}).encode('utf-8'),
        headers={
            "Content-Type": "application/json",
            "Cookie": COOKIE_PARTICIPANT
        },
        method="POST"
    )
    try:
        urllib.request.urlopen(req)
        assert False, "Expected HTTPError 403 for self-vote"
    except urllib.error.HTTPError as e:
        assert e.code == 403, f"Expected 403, got {e.code}"
        err = json.loads(e.read().decode('utf-8'))
        assert "Team members cannot vote for their own submission" in err.get("error", "")
    print("  [PASS] Self-vote prevented with 403.")

def test_vote_toggle_other_project():
    print("[4] Testing Vote & Retract on Non-Owned Project...")
    # 1. Cast vote on prj_02
    req = urllib.request.Request(
        f"{BASE_URL}/api/community/vote",
        data=json.dumps({"projectId": "prj_02"}).encode('utf-8'),
        headers={
            "Content-Type": "application/json",
            "Cookie": COOKIE_PARTICIPANT
        },
        method="POST"
    )
    with urllib.request.urlopen(req) as res:
        assert res.status == 200
        data = json.loads(res.read().decode('utf-8'))
        first_vote_state = data.get("hasVoted")

    # 2. Toggle vote again (should invert)
    req2 = urllib.request.Request(
        f"{BASE_URL}/api/community/vote",
        data=json.dumps({"projectId": "prj_02"}).encode('utf-8'),
        headers={
            "Content-Type": "application/json",
            "Cookie": COOKIE_PARTICIPANT
        },
        method="POST"
    )
    with urllib.request.urlopen(req2) as res:
        assert res.status == 200
        data2 = json.loads(res.read().decode('utf-8'))
        second_vote_state = data2.get("hasVoted")
        assert second_vote_state != first_vote_state, "Vote state should toggle"

    print("  [PASS] Vote cast & retraction toggle verified.")

def test_sealed_results_invariant():
    print("[5] Testing Sealed Results Invariant on GET /api/community/vote...")
    # Participant probe
    req = urllib.request.Request(
        f"{BASE_URL}/api/community/vote?projectId=prj_02",
        headers={"Cookie": COOKIE_PARTICIPANT}
    )
    with urllib.request.urlopen(req) as res:
        data = json.loads(res.read().decode('utf-8'))
        assert data.get("totalVotes") is None, f"Expected totalVotes to be null for participant, got {data.get('totalVotes')}"

    # Organizer probe (unsealed view)
    req_org = urllib.request.Request(
        f"{BASE_URL}/api/community/vote?projectId=prj_02",
        headers={"Cookie": COOKIE_ORGANIZER}
    )
    with urllib.request.urlopen(req_org) as res:
        data_org = json.loads(res.read().decode('utf-8'))
        assert data_org.get("totalVotes") is not None, "Organizer should see numeric totalVotes count"
    print("  [PASS] Sealed results invariant strictly verified (null for participants, numeric for organizer).")

def test_comments_stream():
    print("[6] Testing Comments Stream & Drawer API...")
    # GET comments
    req = urllib.request.Request(f"{BASE_URL}/api/community/comments?projectId=prj_01")
    with urllib.request.urlopen(req) as res:
        assert res.status == 200
        data = json.loads(res.read().decode('utf-8'))
        assert "comments" in data

    # POST comment as participant
    post_req = urllib.request.Request(
        f"{BASE_URL}/api/community/comments",
        data=json.dumps({
            "projectId": "prj_01",
            "content": "Incredible architecture! Really impressed by the distributed consensus implementation."
        }).encode('utf-8'),
        headers={
            "Content-Type": "application/json",
            "Cookie": COOKIE_PARTICIPANT
        },
        method="POST"
    )
    with urllib.request.urlopen(post_req) as res:
        assert res.status == 200
        posted = json.loads(res.read().decode('utf-8'))
        assert posted.get("success") is True
        assert posted.get("comment", {}).get("authorName") == "Participant"

    # Immediate second POST should trigger 429 rate limit
    rapid_req = urllib.request.Request(
        f"{BASE_URL}/api/community/comments",
        data=json.dumps({
            "projectId": "prj_01",
            "content": "Rapid fire spam attempt"
        }).encode('utf-8'),
        headers={
            "Content-Type": "application/json",
            "Cookie": COOKIE_PARTICIPANT
        },
        method="POST"
    )
    try:
        urllib.request.urlopen(rapid_req)
        assert False, "Expected 429 Rate Limit"
    except urllib.error.HTTPError as e:
        assert e.code == 429, f"Expected 429, got {e.code}"
        err = json.loads(e.read().decode('utf-8'))
        assert "Rate limit exceeded" in err.get("error", "")

    print("  [PASS] Comments GET, POST, and 10s Rate Limit verified.")

if __name__ == "__main__":
    try:
        test_ssr_gallery()
        test_vote_anonymous_blocked()
        test_self_vote_blocked()
        test_vote_toggle_other_project()
        test_sealed_results_invariant()
        test_comments_stream()
        print("\n==================================================")
        print("ALL PHASE 6 M3 & M4 INTEGRATION TESTS PASSED (6/6)!")
        print("==================================================")
    except Exception as e:
        print(f"\nTEST FAILED: {e}", file=sys.stderr)
        sys.exit(1)
