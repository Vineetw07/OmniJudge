import { prisma } from '../src/lib/prisma';

interface AssertionResult {
  id: string;
  category: string;
  name: string;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  details?: string;
}

const BASE_URL = 'http://localhost:8080';
const PRT_COOKIE = 'session=prt_seed_token_2026';
const ORG_COOKIE = 'session=org_seed_token_2026';
const JDG_A_COOKIE = 'session=jdg_a_seed_token_2026';
const JDG_B_COOKIE = 'session=jdg_b_seed_token_2026';

const results: AssertionResult[] = [];

function check(
  id: string,
  category: string,
  name: string,
  condition: boolean,
  expected: unknown,
  actual: unknown,
  details?: string
) {
  results.push({
    id,
    category,
    name,
    passed: condition,
    expected,
    actual,
    details,
  });

  const badge = condition ? '✅ PASS' : '❌ FAIL';
  console.log(`[${id}] ${badge} - ${name}`);
  if (!condition) {
    console.error(`     Expected: ${JSON.stringify(expected)}`);
    console.error(`     Actual:   ${JSON.stringify(actual)}`);
    if (details) console.error(`     Details:  ${details}`);
  }
}

async function apiRequest(
  path: string,
  options: {
    method?: string;
    cookie?: string;
    body?: unknown;
  } = {}
): Promise<{ status: number; data: any; raw: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.cookie) {
    headers['Cookie'] = options.cookie;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const raw = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(raw);
  } catch {
    data = raw;
  }

  return { status: res.status, data, raw };
}

async function runChallengerSuite() {
  console.log('================================================================');
  console.log('  CHALLENGER 1 ADVERSARIAL STRESS TEST: COMMUNITY VOTE API (M2)');
  console.log('================================================================\n');

  // Baseline preparation
  console.log('--- Phase 0: Baseline Setup & State Sanitation ---');
  await prisma.communityVote.deleteMany({
    where: {
      userId: { in: ['user_prt_01', 'user_org_01', 'user_jdg_a_01', 'user_jdg_b_01'] },
    },
  });
  await prisma.auditLog.deleteMany({
    where: {
      action: { in: ['COMMUNITY_VOTE_CAST', 'COMMUNITY_VOTE_RETRACTED', 'COMMUNITY_SETTINGS_UPDATED'] },
    },
  });

  const activeEvent = await prisma.event.findFirst();
  if (activeEvent) {
    await prisma.event.update({
      where: { id: activeEvent.id },
      data: { votingOpen: true, resultsPublic: false },
    });
  }

  const teamMember = await prisma.teamMember.findUnique({
    where: { userId: 'user_prt_01' },
  });
  const project1 = await prisma.project.findUnique({ where: { id: 'prj_01' } });
  const project2 = await prisma.project.findUnique({ where: { id: 'prj_02' } });

  check(
    'PRE-01',
    'Pre-flight',
    'Participant user_prt_01 belongs to team tm_01',
    teamMember?.teamId === 'tm_01',
    'tm_01',
    teamMember?.teamId
  );
  check(
    'PRE-02',
    'Pre-flight',
    'Project prj_01 belongs to team tm_01 (own project)',
    project1?.teamId === 'tm_01',
    'tm_01',
    project1?.teamId
  );
  check(
    'PRE-03',
    'Pre-flight',
    'Project prj_02 belongs to team tm_02 (peer project)',
    project2?.teamId === 'tm_02',
    'tm_02',
    project2?.teamId
  );

  // ---------------------------------------------------------------------------
  // TASK 1: Self-Voting Attack
  // ---------------------------------------------------------------------------
  console.log('\n--- Task 1: Self-Voting Attack Vector Testing ---');

  // 1.1 Standard self-vote attempt
  const selfVoteRes = await apiRequest('/api/community/vote', {
    method: 'POST',
    cookie: PRT_COOKIE,
    body: { projectId: 'prj_01' },
  });
  check(
    'SELF-01',
    'Self-Voting',
    'Participant voting for own team project (prj_01) returns 403 Forbidden',
    selfVoteRes.status === 403,
    403,
    selfVoteRes.status
  );
  check(
    'SELF-02',
    'Self-Voting',
    'Self-vote rejection error message specifies team member restriction',
    selfVoteRes.data?.error === 'Team members cannot vote for their own submission',
    'Team members cannot vote for their own submission',
    selfVoteRes.data?.error
  );

  // 1.2 DB verification: No vote record created in CommunityVote
  const dbSelfVote = await prisma.communityVote.findUnique({
    where: {
      projectId_userId: {
        projectId: 'prj_01',
        userId: 'user_prt_01',
      },
    },
  });
  check(
    'SELF-03',
    'Self-Voting',
    'Database integrity: CommunityVote record for prj_01 does not exist',
    dbSelfVote === null,
    null,
    dbSelfVote
  );

  // 1.3 DB verification: No COMMUNITY_VOTE_CAST in AuditLog
  const dbAuditSelfVote = await prisma.auditLog.findFirst({
    where: {
      userId: 'user_prt_01',
      action: 'COMMUNITY_VOTE_CAST',
      payload: { contains: 'prj_01' },
    },
  });
  check(
    'SELF-04',
    'Self-Voting',
    'Database integrity: No AuditLog entry for self-vote attempt',
    dbAuditSelfVote === null,
    null,
    dbAuditSelfVote
  );

  // 1.4 Attack variation: Extra fields in body to bypass Zod schema
  const selfVoteExtraFields = await apiRequest('/api/community/vote', {
    method: 'POST',
    cookie: PRT_COOKIE,
    body: { projectId: 'prj_01', bypassSelfVote: true, role: 'organizer' },
  });
  check(
    'SELF-05',
    'Self-Voting',
    'Self-vote with extraneous schema fields rejected with 400 Bad Request',
    selfVoteExtraFields.status === 400,
    400,
    selfVoteExtraFields.status
  );

  // 1.5 Positive control: Judge (non-team member) can vote on prj_01
  const judgeVotePrj1 = await apiRequest('/api/community/vote', {
    method: 'POST',
    cookie: JDG_A_COOKIE,
    body: { projectId: 'prj_01' },
  });
  check(
    'SELF-06',
    'Self-Voting',
    'Non-team member (Judge) voting on prj_01 is allowed (200 OK)',
    judgeVotePrj1.status === 200,
    200,
    judgeVotePrj1.status
  );
  // Retract judge vote immediately
  await apiRequest('/api/community/vote', {
    method: 'POST',
    cookie: JDG_A_COOKIE,
    body: { projectId: 'prj_01' },
  });

  // ---------------------------------------------------------------------------
  // TASK 2: Toggle Voting Lifecycle (Vote, Retract, Re-vote)
  // ---------------------------------------------------------------------------
  console.log('\n--- Task 2: Toggle Voting Lifecycle & DB State Verification ---');

  // Step A: Vote on peer project prj_02
  const voteStep1 = await apiRequest('/api/community/vote', {
    method: 'POST',
    cookie: PRT_COOKIE,
    body: { projectId: 'prj_02' },
  });
  check(
    'TOGGLE-01',
    'Toggle-Voting',
    'Initial vote cast on peer project prj_02 returns 200',
    voteStep1.status === 200,
    200,
    voteStep1.status
  );
  check(
    'TOGGLE-02',
    'Toggle-Voting',
    'Vote cast response: hasVoted is true, message is "Vote cast"',
    voteStep1.data?.hasVoted === true && voteStep1.data?.message === 'Vote cast',
    { hasVoted: true, message: 'Vote cast' },
    { hasVoted: voteStep1.data?.hasVoted, message: voteStep1.data?.message }
  );

  // DB verification Step A
  const dbVoteStep1 = await prisma.communityVote.findUnique({
    where: {
      projectId_userId: { projectId: 'prj_02', userId: 'user_prt_01' },
    },
  });
  check(
    'TOGGLE-03',
    'Toggle-Voting',
    'DB Check Step A: CommunityVote row created for prj_02 and user_prt_01',
    dbVoteStep1 !== null && dbVoteStep1.projectId === 'prj_02' && dbVoteStep1.userId === 'user_prt_01',
    true,
    !!dbVoteStep1
  );

  const dbAuditStep1 = await prisma.auditLog.findFirst({
    where: {
      userId: 'user_prt_01',
      action: 'COMMUNITY_VOTE_CAST',
    },
    orderBy: { createdAt: 'desc' },
  });
  check(
    'TOGGLE-04',
    'Toggle-Voting',
    'DB Check Step A: AuditLog logged COMMUNITY_VOTE_CAST',
    dbAuditStep1 !== null && JSON.parse(dbAuditStep1.payload).projectId === 'prj_02',
    true,
    !!dbAuditStep1
  );

  // Step B: Retract vote (Toggle)
  const voteStep2 = await apiRequest('/api/community/vote', {
    method: 'POST',
    cookie: PRT_COOKIE,
    body: { projectId: 'prj_02' },
  });
  check(
    'TOGGLE-05',
    'Toggle-Voting',
    'Subsequent vote toggle on prj_02 returns 200',
    voteStep2.status === 200,
    200,
    voteStep2.status
  );
  check(
    'TOGGLE-06',
    'Toggle-Voting',
    'Vote retract response: hasVoted is false, message is "Vote retracted"',
    voteStep2.data?.hasVoted === false && voteStep2.data?.message === 'Vote retracted',
    { hasVoted: false, message: 'Vote retracted' },
    { hasVoted: voteStep2.data?.hasVoted, message: voteStep2.data?.message }
  );

  // DB verification Step B
  const dbVoteStep2 = await prisma.communityVote.findUnique({
    where: {
      projectId_userId: { projectId: 'prj_02', userId: 'user_prt_01' },
    },
  });
  check(
    'TOGGLE-07',
    'Toggle-Voting',
    'DB Check Step B: CommunityVote row successfully deleted from DB',
    dbVoteStep2 === null,
    null,
    dbVoteStep2
  );

  const dbAuditStep2 = await prisma.auditLog.findFirst({
    where: {
      userId: 'user_prt_01',
      action: 'COMMUNITY_VOTE_RETRACTED',
    },
    orderBy: { createdAt: 'desc' },
  });
  check(
    'TOGGLE-08',
    'Toggle-Voting',
    'DB Check Step B: AuditLog logged COMMUNITY_VOTE_RETRACTED',
    dbAuditStep2 !== null && JSON.parse(dbAuditStep2.payload).projectId === 'prj_02',
    true,
    !!dbAuditStep2
  );

  // Step C: Re-vote (Re-cast)
  const voteStep3 = await apiRequest('/api/community/vote', {
    method: 'POST',
    cookie: PRT_COOKIE,
    body: { projectId: 'prj_02' },
  });
  check(
    'TOGGLE-09',
    'Toggle-Voting',
    'Re-voting on prj_02 returns 200',
    voteStep3.status === 200,
    200,
    voteStep3.status
  );
  check(
    'TOGGLE-10',
    'Toggle-Voting',
    'Re-voting response: hasVoted is true, message is "Vote cast"',
    voteStep3.data?.hasVoted === true && voteStep3.data?.message === 'Vote cast',
    { hasVoted: true, message: 'Vote cast' },
    { hasVoted: voteStep3.data?.hasVoted, message: voteStep3.data?.message }
  );

  // DB verification Step C
  const dbVoteStep3 = await prisma.communityVote.findUnique({
    where: {
      projectId_userId: { projectId: 'prj_02', userId: 'user_prt_01' },
    },
  });
  check(
    'TOGGLE-11',
    'Toggle-Voting',
    'DB Check Step C: CommunityVote row re-created in database',
    dbVoteStep3 !== null && dbVoteStep3.projectId === 'prj_02',
    true,
    !!dbVoteStep3
  );

  // Step D: Rapid toggle sequence (Stress test toggle stability)
  let rapidToggleSuccess = true;
  for (let i = 0; i < 4; i++) {
    const res = await apiRequest('/api/community/vote', {
      method: 'POST',
      cookie: PRT_COOKIE,
      body: { projectId: 'prj_02' },
    });
    if (res.status !== 200) {
      rapidToggleSuccess = false;
      break;
    }
  }
  check(
    'TOGGLE-12',
    'Toggle-Voting',
    'Rapid 4x toggle sequence completed with all 200 OK statuses',
    rapidToggleSuccess,
    true,
    rapidToggleSuccess
  );

  // After 4 additional toggles from cast state (cast -> retract -> cast -> retract -> cast):
  // Should be in 'cast' state now (hasVoted = true)
  const finalToggleGet = await apiRequest('/api/community/vote?projectId=prj_02', {
    cookie: PRT_COOKIE,
  });
  check(
    'TOGGLE-13',
    'Toggle-Voting',
    'Final toggle state correctly reflects hasVoted: true',
    finalToggleGet.data?.hasVoted === true,
    true,
    finalToggleGet.data?.hasVoted
  );

  // ---------------------------------------------------------------------------
  // TASK 3: Sealed Results Invariant under Adversarial Probing
  // ---------------------------------------------------------------------------
  console.log('\n--- Task 3: Sealed Results Invariant under Adversarial Probing ---');
  // State: prj_02 has exactly 1 community vote (from user_prt_01). resultsPublic is false.

  // 3.1 Anonymous Probe
  const anonProbe = await apiRequest('/api/community/vote?projectId=prj_02');
  check(
    'SEAL-01',
    'Sealed-Results',
    'Anonymous probe: totalVotes is strictly null',
    anonProbe.data?.totalVotes === null,
    null,
    anonProbe.data?.totalVotes
  );
  check(
    'SEAL-02',
    'Sealed-Results',
    'Anonymous probe: resultsPublic is false',
    anonProbe.data?.resultsPublic === false,
    false,
    anonProbe.data?.resultsPublic
  );
  check(
    'SEAL-03',
    'Sealed-Results',
    'Anonymous probe: hasVoted is false',
    anonProbe.data?.hasVoted === false,
    false,
    anonProbe.data?.hasVoted
  );

  // 3.2 Participant Probe
  const prtProbe = await apiRequest('/api/community/vote?projectId=prj_02', {
    cookie: PRT_COOKIE,
  });
  check(
    'SEAL-04',
    'Sealed-Results',
    'Participant probe: totalVotes is strictly null (SEALED RESULTS)',
    prtProbe.data?.totalVotes === null,
    null,
    prtProbe.data?.totalVotes
  );
  check(
    'SEAL-05',
    'Sealed-Results',
    'Participant probe: hasVoted is true',
    prtProbe.data?.hasVoted === true,
    true,
    prtProbe.data?.hasVoted
  );
  check(
    'SEAL-06',
    'Sealed-Results',
    'Participant probe: resultsPublic is false',
    prtProbe.data?.resultsPublic === false,
    false,
    prtProbe.data?.resultsPublic
  );

  // 3.3 Judge Alpha Probe
  const jdgAProbe = await apiRequest('/api/community/vote?projectId=prj_02', {
    cookie: JDG_A_COOKIE,
  });
  check(
    'SEAL-07',
    'Sealed-Results',
    'Judge Alpha probe: totalVotes is strictly null (SEALED RESULTS)',
    jdgAProbe.data?.totalVotes === null,
    null,
    jdgAProbe.data?.totalVotes
  );
  check(
    'SEAL-08',
    'Sealed-Results',
    'Judge Alpha probe: resultsPublic is false',
    jdgAProbe.data?.resultsPublic === false,
    false,
    jdgAProbe.data?.resultsPublic
  );

  // 3.4 Judge Beta Probe
  const jdgBProbe = await apiRequest('/api/community/vote?projectId=prj_02', {
    cookie: JDG_B_COOKIE,
  });
  check(
    'SEAL-09',
    'Sealed-Results',
    'Judge Beta probe: totalVotes is strictly null (SEALED RESULTS)',
    jdgBProbe.data?.totalVotes === null,
    null,
    jdgBProbe.data?.totalVotes
  );

  // 3.5 Organizer Probe
  const orgProbe = await apiRequest('/api/community/vote?projectId=prj_02', {
    cookie: ORG_COOKIE,
  });
  check(
    'SEAL-10',
    'Sealed-Results',
    'Organizer probe: totalVotes is numeric count (1) even when resultsPublic is false',
    orgProbe.data?.totalVotes === 1,
    1,
    orgProbe.data?.totalVotes
  );
  check(
    'SEAL-11',
    'Sealed-Results',
    'Organizer probe: resultsPublic remains false',
    orgProbe.data?.resultsPublic === false,
    false,
    orgProbe.data?.resultsPublic
  );

  // 3.6 Ballot summary probe without projectId: verify no tally leak
  const ballotSummaryPrt = await apiRequest('/api/community/vote', {
    cookie: PRT_COOKIE,
  });
  check(
    'SEAL-12',
    'Sealed-Results',
    'Summary endpoint without projectId returns userVotes array without vote totals',
    Array.isArray(ballotSummaryPrt.data?.userVotes) &&
      ballotSummaryPrt.data?.userVotes.includes('prj_02') &&
      ballotSummaryPrt.data?.totalVotes === undefined,
    true,
    {
      hasUserVotes: Array.isArray(ballotSummaryPrt.data?.userVotes),
      totalVotes: ballotSummaryPrt.data?.totalVotes,
    }
  );

  // 3.7 Dynamic unsealing: Organizer toggles resultsPublic = true
  const unsealRes = await apiRequest('/api/community/settings', {
    method: 'POST',
    cookie: ORG_COOKIE,
    body: { resultsPublic: true },
  });
  check(
    'SEAL-13',
    'Sealed-Results',
    'Organizer can set resultsPublic: true via /api/community/settings (200 OK)',
    unsealRes.status === 200 && unsealRes.data?.resultsPublic === true,
    true,
    unsealRes.data?.resultsPublic
  );

  // Verify that once unsealed, non-organizers DO receive numeric totalVotes
  const prtUnsealedProbe = await apiRequest('/api/community/vote?projectId=prj_02', {
    cookie: PRT_COOKIE,
  });
  check(
    'SEAL-14',
    'Sealed-Results',
    'When unsealed: Participant receives numeric totalVotes (1)',
    prtUnsealedProbe.data?.totalVotes === 1 && prtUnsealedProbe.data?.resultsPublic === true,
    { totalVotes: 1, resultsPublic: true },
    { totalVotes: prtUnsealedProbe.data?.totalVotes, resultsPublic: prtUnsealedProbe.data?.resultsPublic }
  );

  const anonUnsealedProbe = await apiRequest('/api/community/vote?projectId=prj_02');
  check(
    'SEAL-15',
    'Sealed-Results',
    'When unsealed: Anonymous user receives numeric totalVotes (1)',
    anonUnsealedProbe.data?.totalVotes === 1 && anonUnsealedProbe.data?.resultsPublic === true,
    { totalVotes: 1, resultsPublic: true },
    { totalVotes: anonUnsealedProbe.data?.totalVotes, resultsPublic: anonUnsealedProbe.data?.resultsPublic }
  );

  // 3.8 Re-seal results: Organizer sets resultsPublic = false
  const resealRes = await apiRequest('/api/community/settings', {
    method: 'POST',
    cookie: ORG_COOKIE,
    body: { resultsPublic: false },
  });
  check(
    'SEAL-16',
    'Sealed-Results',
    'Organizer can re-seal results (resultsPublic: false)',
    resealRes.status === 200 && resealRes.data?.resultsPublic === false,
    false,
    resealRes.data?.resultsPublic
  );

  const prtResealedProbe = await apiRequest('/api/community/vote?projectId=prj_02', {
    cookie: PRT_COOKIE,
  });
  check(
    'SEAL-17',
    'Sealed-Results',
    'After re-sealing: Participant totalVotes immediately returns to null',
    prtResealedProbe.data?.totalVotes === null && prtResealedProbe.data?.resultsPublic === false,
    { totalVotes: null, resultsPublic: false },
    { totalVotes: prtResealedProbe.data?.totalVotes, resultsPublic: prtResealedProbe.data?.resultsPublic }
  );

  // ---------------------------------------------------------------------------
  // TASK 4: Voting Closed (votingOpen = false) Lifecycle
  // ---------------------------------------------------------------------------
  console.log('\n--- Task 4: Voting Closed (votingOpen = false) Lifecycle ---');

  // 4.1 Close voting via Organizer settings
  const closeVotingRes = await apiRequest('/api/community/settings', {
    method: 'POST',
    cookie: ORG_COOKIE,
    body: { votingOpen: false },
  });
  check(
    'CLOSE-01',
    'Voting-Closed',
    'Organizer sets votingOpen: false returns 200 OK',
    closeVotingRes.status === 200 && closeVotingRes.data?.votingOpen === false,
    false,
    closeVotingRes.data?.votingOpen
  );

  // 4.2 Participant attempts to vote when closed
  const prtVoteClosed = await apiRequest('/api/community/vote', {
    method: 'POST',
    cookie: PRT_COOKIE,
    body: { projectId: 'prj_02' },
  });
  check(
    'CLOSE-02',
    'Voting-Closed',
    'Participant vote rejected with 403 Forbidden when votingOpen is false',
    prtVoteClosed.status === 403,
    403,
    prtVoteClosed.status
  );
  check(
    'CLOSE-03',
    'Voting-Closed',
    'Rejection message states community voting is closed',
    prtVoteClosed.data?.error === 'Community voting is currently closed',
    'Community voting is currently closed',
    prtVoteClosed.data?.error
  );

  // 4.3 Judge attempts to vote when closed
  const jdgVoteClosed = await apiRequest('/api/community/vote', {
    method: 'POST',
    cookie: JDG_A_COOKIE,
    body: { projectId: 'prj_02' },
  });
  check(
    'CLOSE-04',
    'Voting-Closed',
    'Judge vote rejected with 403 Forbidden when votingOpen is false',
    jdgVoteClosed.status === 403,
    403,
    jdgVoteClosed.status
  );

  // 4.4 Organizer attempts to vote when closed
  const orgVoteClosed = await apiRequest('/api/community/vote', {
    method: 'POST',
    cookie: ORG_COOKIE,
    body: { projectId: 'prj_02' },
  });
  check(
    'CLOSE-05',
    'Voting-Closed',
    'Organizer vote rejected with 403 Forbidden when votingOpen is false',
    orgVoteClosed.status === 403,
    403,
    orgVoteClosed.status
  );

  // 4.5 Re-open voting
  const reopenVotingRes = await apiRequest('/api/community/settings', {
    method: 'POST',
    cookie: ORG_COOKIE,
    body: { votingOpen: true },
  });
  check(
    'CLOSE-06',
    'Voting-Closed',
    'Organizer re-opens voting (votingOpen: true)',
    reopenVotingRes.status === 200 && reopenVotingRes.data?.votingOpen === true,
    true,
    reopenVotingRes.data?.votingOpen
  );

  // 4.6 Verify voting works again
  const prtVoteReopened = await apiRequest('/api/community/vote', {
    method: 'POST',
    cookie: PRT_COOKIE,
    body: { projectId: 'prj_02' },
  });
  check(
    'CLOSE-07',
    'Voting-Closed',
    'After re-opening, voting returns 200 OK',
    prtVoteReopened.status === 200,
    200,
    prtVoteReopened.status
  );

  // ---------------------------------------------------------------------------
  // TASK 5: Abuse & Malicious Payload Edge Cases
  // ---------------------------------------------------------------------------
  console.log('\n--- Task 5: Additional Security & Boundary Probing ---');

  // 5.1 Unauthenticated POST /api/community/vote returns 401
  const unauthVote = await apiRequest('/api/community/vote', {
    method: 'POST',
    body: { projectId: 'prj_02' },
  });
  check(
    'SEC-01',
    'Security-Abuse',
    'Unauthenticated vote attempt returns 401 Unauthorized',
    unauthVote.status === 401,
    401,
    unauthVote.status
  );

  // 5.2 Invalid / Non-existent project ID returns 404
  const nonExistentVote = await apiRequest('/api/community/vote', {
    method: 'POST',
    cookie: PRT_COOKIE,
    body: { projectId: 'prj_ghost_99999' },
  });
  check(
    'SEC-02',
    'Security-Abuse',
    'Vote on non-existent project returns 404 Not Found',
    nonExistentVote.status === 404,
    404,
    nonExistentVote.status
  );

  // 5.3 Non-existent project GET returns 404
  const nonExistentGet = await apiRequest('/api/community/vote?projectId=prj_ghost_99999', {
    cookie: PRT_COOKIE,
  });
  check(
    'SEC-03',
    'Security-Abuse',
    'GET vote on non-existent project returns 404 Not Found',
    nonExistentGet.status === 404,
    404,
    nonExistentGet.status
  );

  // 5.4 Privilege escalation: Participant attempting to modify settings
  const prtSettingsTamper = await apiRequest('/api/community/settings', {
    method: 'POST',
    cookie: PRT_COOKIE,
    body: { resultsPublic: true, votingOpen: true },
  });
  check(
    'SEC-04',
    'Security-Abuse',
    'Participant tampering with /api/community/settings blocked with 403 Forbidden',
    prtSettingsTamper.status === 403,
    403,
    prtSettingsTamper.status
  );

  // 5.5 SQL Injection probe in projectId
  const sqliVote = await apiRequest('/api/community/vote', {
    method: 'POST',
    cookie: PRT_COOKIE,
    body: { projectId: "prj_02' OR '1'='1" },
  });
  check(
    'SEC-05',
    'Security-Abuse',
    'SQL injection string as projectId safely handled (returns 404, not 500)',
    sqliVote.status === 404,
    404,
    sqliVote.status
  );

  // ---------------------------------------------------------------------------
  // Clean up & Restore
  // ---------------------------------------------------------------------------
  console.log('\n--- Cleanup: Restoring Baseline Database State ---');
  await prisma.communityVote.deleteMany({
    where: {
      userId: { in: ['user_prt_01', 'user_org_01', 'user_jdg_a_01', 'user_jdg_b_01'] },
    },
  });
  await prisma.auditLog.deleteMany({
    where: {
      action: { in: ['COMMUNITY_VOTE_CAST', 'COMMUNITY_VOTE_RETRACTED', 'COMMUNITY_SETTINGS_UPDATED'] },
    },
  });
  if (activeEvent) {
    await prisma.event.update({
      where: { id: activeEvent.id },
      data: { votingOpen: true, resultsPublic: false },
    });
  }
  console.log('Cleanup complete.\n');

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log('================================================================');
  console.log(`  CHALLENGER 1 SUMMARY: ${passed}/${total} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    console.error(`\nFAILED TESTS (${failed}):`);
    results.filter((r) => !r.passed).forEach((r) => {
      console.error(` - [${r.id}] ${r.name}`);
    });
    process.exit(1);
  } else {
    console.log('\nALL ADVERSARIAL STRESS TESTS CONFIRMED PASS! 🎉');
  }
}

runChallengerSuite()
  .catch((e) => {
    console.error('Fatal suite failure:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
