import { prisma } from '../src/lib/prisma';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8080';

const TOKEN_ORG = 'org_seed_token_2026';
const TOKEN_JDG_A = 'jdg_a_seed_token_2026';
const TOKEN_PRT = 'prt_seed_token_2026';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`[PASS] ${message}`);
}

async function runLeaderboardTests() {
  console.log('================================================================');
  console.log('TEST SUITE: PUBLIC JUDGE RANKING LEADERBOARD (GET /api/leaderboard)');
  console.log(`Target: ${BASE_URL}`);
  console.log('================================================================\n');

  // Ensure baseline state: Event.resultsPublic is false
  const eventBefore = await prisma.event.findFirst();
  assert(!!eventBefore, 'Database seed Event is present');
  await prisma.event.update({
    where: { id: eventBefore!.id },
    data: { resultsPublic: false },
  });

  try {
    // -------------------------------------------------------------------------
    // 1. GET /api/leaderboard with no session -> 401
    // -------------------------------------------------------------------------
    console.log('--- Test 1: Anonymous Access (No Session) ---');
    const resNoAuth = await fetch(`${BASE_URL}/api/leaderboard`);
    assert(resNoAuth.status === 401, '1. GET /api/leaderboard with no session returns 401 Unauthorized');
    const noAuthJson = await resNoAuth.json().catch(() => ({}));
    assert(Boolean(noAuthJson.error?.includes('Unauthorized')), '1.1 Error message indicates unauthorized session requirement');

    // -------------------------------------------------------------------------
    // 2. GET /api/leaderboard as participant when resultsPublic=false -> 403
    // -------------------------------------------------------------------------
    console.log('\n--- Test 2: Participant Access When Sealed (resultsPublic=false) ---');
    const resParticipantSealed = await fetch(`${BASE_URL}/api/leaderboard`, {
      headers: { Cookie: `session=${TOKEN_PRT}` },
    });
    assert(resParticipantSealed.status === 403, '2. GET /api/leaderboard as participant when resultsPublic=false returns 403 Forbidden');
    const participantSealedJson = await resParticipantSealed.json().catch(() => ({}));
    assert(participantSealedJson.error === 'Results are not yet public', '2.1 Returns exact error "Results are not yet public"');

    // Also verify judge role is blocked when resultsPublic=false
    const resJudgeSealed = await fetch(`${BASE_URL}/api/leaderboard`, {
      headers: { Cookie: `session=${TOKEN_JDG_A}` },
    });
    assert(resJudgeSealed.status === 403, '2.2 GET /api/leaderboard as judge when resultsPublic=false returns 403 Forbidden');

    // -------------------------------------------------------------------------
    // 3. GET /api/leaderboard as organizer always -> 200 with leaderboard array
    // -------------------------------------------------------------------------
    console.log('\n--- Test 3: Organizer Access Always (Even When Sealed) ---');
    const resOrganizer = await fetch(`${BASE_URL}/api/leaderboard`, {
      headers: { Cookie: `session=${TOKEN_ORG}` },
    });
    assert(resOrganizer.status === 200, '3. GET /api/leaderboard as organizer returns 200 OK');
    const orgData = await resOrganizer.json();
    assert(Array.isArray(orgData.leaderboard), '3.1 Response contains leaderboard array');
    assert(orgData.leaderboard.length > 0, `3.2 Leaderboard array is non-empty (${orgData.leaderboard.length} projects)`);

    // -------------------------------------------------------------------------
    // 4. Leaderboard response shape: rank, projectId, title, trackName, normalizedScore, reviewCount
    // -------------------------------------------------------------------------
    console.log('\n--- Test 4: Leaderboard Entry Response Shape ---');
    const sample = orgData.leaderboard[0];
    assert(typeof sample.rank === 'number', '4.1 Entry has numeric rank field');
    assert(typeof sample.projectId === 'string' && sample.projectId.length > 0, '4.2 Entry has string projectId field');
    assert(typeof sample.title === 'string' && sample.title.length > 0, '4.3 Entry has string title field');
    assert(typeof sample.trackName === 'string' && sample.trackName.length > 0, '4.4 Entry has string trackName field');
    assert(typeof sample.normalizedScore === 'number' && Number.isFinite(sample.normalizedScore), '4.5 Entry has numeric normalizedScore field');
    assert(typeof sample.reviewCount === 'number' && sample.reviewCount >= 0, '4.6 Entry has numeric reviewCount field');

    const allEntriesValid = orgData.leaderboard.every((e: any) =>
      typeof e.rank === 'number' &&
      typeof e.projectId === 'string' &&
      typeof e.title === 'string' &&
      typeof e.trackName === 'string' &&
      typeof e.normalizedScore === 'number' &&
      typeof e.reviewCount === 'number'
    );
    assert(allEntriesValid, '4.7 All entries in leaderboard strictly conform to required shape');

    // -------------------------------------------------------------------------
    // 5. rank field is sequential (1, 2, 3...)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 5: Sequential Monotonic Ranks ---');
    const ranks = orgData.leaderboard.map((e: any) => e.rank);
    const expectedRanks = Array.from({ length: orgData.leaderboard.length }, (_, i) => i + 1);
    const isSequential = ranks.every((r: number, idx: number) => r === expectedRanks[idx]);
    assert(isSequential, `5. Rank field is strictly sequential from 1 to ${orgData.leaderboard.length} (1, 2, 3...)`);

    // -------------------------------------------------------------------------
    // 6. Reviewed projects outrank unreviewed (reviewCount > 0 before reviewCount === 0)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 6: Reviewed vs Unreviewed Project Ordering ---');
    let seenZeroReview = false;
    let reviewedPrecedesUnreviewed = true;
    for (const entry of orgData.leaderboard) {
      if (entry.reviewCount === 0) {
        seenZeroReview = true;
      } else if (seenZeroReview && entry.reviewCount > 0) {
        reviewedPrecedesUnreviewed = false;
        break;
      }
    }
    assert(
      reviewedPrecedesUnreviewed,
      '6. Evaluated projects (reviewCount > 0) strictly outrank unreviewed projects (reviewCount === 0)'
    );

    // -------------------------------------------------------------------------
    // 7. No per-judge raw score data exposed in response
    // -------------------------------------------------------------------------
    console.log('\n--- Test 7: Confidentiality of Raw Scores & Per-Judge Breakdowns ---');
    const rawJsonString = JSON.stringify(orgData);
    assert(!rawJsonString.includes('rawScore'), '7.1 rawScore is stripped from public leaderboard items');
    assert(!rawJsonString.includes('judgeScores'), '7.2 No judgeScores structure exposed');
    assert(!rawJsonString.includes('judgeRawMap'), '7.3 No judgeRawMap exposed');
    assert(!rawJsonString.includes('criterionId'), '7.4 No per-criterion breakdown exposed');
    const noRawFieldsInEntries = orgData.leaderboard.every(
      (e: any) => !('scores' in e) && !('rawScore' in e) && !('breakdown' in e)
    );
    assert(noRawFieldsInEntries, '7.5 Leaderboard items contain only aggregated normalized score and rank');

    // -------------------------------------------------------------------------
    // 8. Response does not include judgeId, judgeEmail, or any PII
    // -------------------------------------------------------------------------
    console.log('\n--- Test 8: Anonymity & PII Isolation ---');
    assert(!rawJsonString.includes('judgeId'), '8.1 No judgeId field in response');
    assert(!rawJsonString.includes('judgeEmail'), '8.2 No judgeEmail field in response');
    assert(!rawJsonString.includes('user_jdg_'), '8.3 No judge user ID prefixes found in response body');
    const noJudgeFieldsInEntries = orgData.leaderboard.every(
      (e: any) => !('judgeId' in e) && !('judgeEmail' in e) && !('email' in e) && !('userId' in e)
    );
    assert(noJudgeFieldsInEntries, '8.4 No judge identity or PII fields present in leaderboard items');

    // -------------------------------------------------------------------------
    // Bonus Check: Unsealed Public Access (resultsPublic=true)
    // -------------------------------------------------------------------------
    console.log('\n--- Bonus Test: Participant & Judge Access When Unsealed ---');
    await prisma.event.update({
      where: { id: eventBefore!.id },
      data: { resultsPublic: true },
    });

    const resParticipantUnsealed = await fetch(`${BASE_URL}/api/leaderboard`, {
      headers: { Cookie: `session=${TOKEN_PRT}` },
    });
    assert(resParticipantUnsealed.status === 200, 'Bonus: Participant gets 200 OK when resultsPublic=true');
    const prtData = await resParticipantUnsealed.json();
    assert(prtData.resultsPublic === true, 'Bonus: resultsPublic flag is true in unsealed response');
    assert(prtData.leaderboard.length === orgData.leaderboard.length, 'Bonus: Participant sees identical ranking count');

    const resJudgeUnsealed = await fetch(`${BASE_URL}/api/leaderboard`, {
      headers: { Cookie: `session=${TOKEN_JDG_A}` },
    });
    assert(resJudgeUnsealed.status === 200, 'Bonus: Judge gets 200 OK when resultsPublic=true');

  } finally {
    // Revert Event.resultsPublic to false to keep fixture clean
    await prisma.event.update({
      where: { id: eventBefore!.id },
      data: { resultsPublic: false },
    });
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log('ALL 8 LEADERBOARD SPECIFICATION ASSERTIONS CONFIRMED PASSING (100%)');
  console.log('================================================================');
}

runLeaderboardTests().catch((err) => {
  console.error('Leaderboard test run failed:', err);
  process.exit(1);
});
