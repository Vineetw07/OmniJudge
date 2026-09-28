import { prisma } from '../src/lib/prisma';

interface TestAssertion {
  name: string;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  details?: string;
}

const BASE_URL = 'http://localhost:8080';
const PRT_COOKIE = 'session=prt_seed_token_2026';
const ORG_COOKIE = 'session=org_seed_token_2026';

const assertions: TestAssertion[] = [];

function assert(name: string, condition: boolean, expected: unknown, actual: unknown, details?: string) {
  assertions.push({
    name,
    passed: condition,
    expected,
    actual,
    details,
  });
  const status = condition ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${name}`);
  if (!condition) {
    console.error(`  Expected:`, expected);
    console.error(`  Actual:  `, actual);
    if (details) console.error(`  Details: `, details);
  }
}

async function request(path: string, options: {
  method?: string;
  cookie?: string;
  body?: unknown;
} = {}): Promise<{ status: number; data: any; headers: Headers }> {
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

  let data: any = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: res.status, data, headers: res.headers };
}

async function runSuite() {
  console.log('====================================================');
  console.log('  OmniJudge Phase 6 M2: Anti-Abuse Integration Suite');
  console.log('====================================================\n');

  // Baseline cleanup: remove any leftover votes/comments from previous tests
  await prisma.communityVote.deleteMany({
    where: {
      userId: { in: ['user_prt_01', 'user_org_01'] },
    },
  });
  await prisma.comment.deleteMany({
    where: {
      userId: { in: ['user_prt_01', 'user_org_01'] },
    },
  });
  await prisma.auditLog.deleteMany({
    where: {
      action: { in: ['COMMUNITY_VOTE_CAST', 'COMMUNITY_VOTE_RETRACTED', 'COMMENT_POSTED', 'COMMUNITY_SETTINGS_UPDATED'] },
    },
  });
  // Ensure default event settings: votingOpen: true, resultsPublic: false
  const activeEvent = await prisma.event.findFirst();
  if (activeEvent) {
    await prisma.event.update({
      where: { id: activeEvent.id },
      data: { votingOpen: true, resultsPublic: false },
    });
  }

  try {
    // -------------------------------------------------------------------------
    // 1. Unauthenticated request to POST /api/community/vote returns 401
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Authentication Guards ---');
    const unauthVote = await request('/api/community/vote', {
      method: 'POST',
      body: { projectId: 'prj_02' },
    });
    assert(
      'Unauthenticated POST /api/community/vote returns 401',
      unauthVote.status === 401,
      401,
      unauthVote.status
    );

    const unauthComment = await request('/api/community/comments', {
      method: 'POST',
      body: { projectId: 'prj_02', content: 'test comment' },
    });
    assert(
      'Unauthenticated POST /api/community/comments returns 401',
      unauthComment.status === 401,
      401,
      unauthComment.status
    );

    // -------------------------------------------------------------------------
    // 2. Self-Vote Defense: user_prt_01 (member of tm_01) cannot vote on prj_01
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Self-Vote Defense ---');
    const selfVoteRes = await request('/api/community/vote', {
      method: 'POST',
      cookie: PRT_COOKIE,
      body: { projectId: 'prj_01' },
    });
    assert(
      'Self-vote on own team project returns 403',
      selfVoteRes.status === 403,
      403,
      selfVoteRes.status
    );
    assert(
      'Self-vote returns exact rejection message',
      selfVoteRes.data?.error === 'Team members cannot vote for their own submission',
      'Team members cannot vote for their own submission',
      selfVoteRes.data?.error
    );

    // -------------------------------------------------------------------------
    // 3. Participant voting on peer project (prj_02) returns 200 & { hasVoted: true }
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Peer Voting & Toggle Defense ---');
    const peerVoteRes = await request('/api/community/vote', {
      method: 'POST',
      cookie: PRT_COOKIE,
      body: { projectId: 'prj_02' },
    });
    assert(
      'Participant vote on peer project returns 200',
      peerVoteRes.status === 200,
      200,
      peerVoteRes.status
    );
    assert(
      'Vote response hasVoted is true and message is "Vote cast"',
      peerVoteRes.data?.hasVoted === true && peerVoteRes.data?.message === 'Vote cast',
      { hasVoted: true, message: 'Vote cast' },
      { hasVoted: peerVoteRes.data?.hasVoted, message: peerVoteRes.data?.message }
    );

    // Verify DB state
    const voteInDb = await prisma.communityVote.findUnique({
      where: {
        projectId_userId: {
          projectId: 'prj_02',
          userId: 'user_prt_01',
        },
      },
    });
    assert('Vote record exists in SQLite database', !!voteInDb, true, !!voteInDb);

    // Verify AuditLog for vote cast
    const castAudit = await prisma.auditLog.findFirst({
      where: {
        userId: 'user_prt_01',
        action: 'COMMUNITY_VOTE_CAST',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert('AuditLog recorded COMMUNITY_VOTE_CAST', !!castAudit, true, !!castAudit);
    assert(
      'AuditLog payload contains projectId: prj_02',
      castAudit?.payload?.includes('prj_02') ?? false,
      true,
      castAudit?.payload
    );

    // -------------------------------------------------------------------------
    // 4. Sealed Results Check (resultsPublic === false)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Sealed Results Invariant ---');
    const sealedGetParticipant = await request('/api/community/vote?projectId=prj_02', {
      cookie: PRT_COOKIE,
    });
    assert(
      'Participant GET vote returns hasVoted: true',
      sealedGetParticipant.data?.hasVoted === true,
      true,
      sealedGetParticipant.data?.hasVoted
    );
    assert(
      'Participant GET vote returns totalVotes: null (SEALED RESULTS)',
      sealedGetParticipant.data?.totalVotes === null,
      null,
      sealedGetParticipant.data?.totalVotes
    );
    assert(
      'Participant GET vote returns resultsPublic: false',
      sealedGetParticipant.data?.resultsPublic === false,
      false,
      sealedGetParticipant.data?.resultsPublic
    );

    const sealedGetOrganizer = await request('/api/community/vote?projectId=prj_02', {
      cookie: ORG_COOKIE,
    });
    assert(
      'Organizer GET vote returns numeric totalVotes (1)',
      sealedGetOrganizer.data?.totalVotes === 1,
      1,
      sealedGetOrganizer.data?.totalVotes
    );

    // Anonymous visitor check
    const sealedGetAnon = await request('/api/community/vote?projectId=prj_02');
    assert(
      'Anonymous GET vote returns totalVotes: null (SEALED RESULTS)',
      sealedGetAnon.data?.totalVotes === null,
      null,
      sealedGetAnon.data?.totalVotes
    );
    assert(
      'Anonymous GET vote returns hasVoted: false',
      sealedGetAnon.data?.hasVoted === false,
      false,
      sealedGetAnon.data?.hasVoted
    );

    // -------------------------------------------------------------------------
    // 5. Vote Toggle / Retraction: Voting again on prj_02 retracts vote
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Vote Toggle / Retraction ---');
    const retractVoteRes = await request('/api/community/vote', {
      method: 'POST',
      cookie: PRT_COOKIE,
      body: { projectId: 'prj_02' },
    });
    assert(
      'Toggling vote on prj_02 returns 200',
      retractVoteRes.status === 200,
      200,
      retractVoteRes.status
    );
    assert(
      'Toggling vote returns hasVoted: false and message "Vote retracted"',
      retractVoteRes.data?.hasVoted === false && retractVoteRes.data?.message === 'Vote retracted',
      { hasVoted: false, message: 'Vote retracted' },
      { hasVoted: retractVoteRes.data?.hasVoted, message: retractVoteRes.data?.message }
    );

    // Verify DB retraction
    const voteInDbAfter = await prisma.communityVote.findUnique({
      where: {
        projectId_userId: {
          projectId: 'prj_02',
          userId: 'user_prt_01',
        },
      },
    });
    assert('Vote record was deleted from database', voteInDbAfter === null, null, voteInDbAfter);

    const retractAudit = await prisma.auditLog.findFirst({
      where: {
        userId: 'user_prt_01',
        action: 'COMMUNITY_VOTE_RETRACTED',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert('AuditLog recorded COMMUNITY_VOTE_RETRACTED', !!retractAudit, true, !!retractAudit);

    // -------------------------------------------------------------------------
    // 6. Settings Governance: Toggle resultsPublic and votingOpen
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Settings Governance & Voting Lifecycle ---');
    // Participant blocked from modifying settings
    const settingsBlocked = await request('/api/community/settings', {
      method: 'POST',
      cookie: PRT_COOKIE,
      body: { votingOpen: false },
    });
    assert(
      'Participant blocked from POST /api/community/settings (403)',
      settingsBlocked.status === 403,
      403,
      settingsBlocked.status
    );

    // Organizer closes voting
    const closeVotingRes = await request('/api/community/settings', {
      method: 'POST',
      cookie: ORG_COOKIE,
      body: { votingOpen: false },
    });
    assert(
      'Organizer closes voting returns 200',
      closeVotingRes.status === 200,
      200,
      closeVotingRes.status
    );
    assert(
      'votingOpen is now false',
      closeVotingRes.data?.votingOpen === false,
      false,
      closeVotingRes.data?.votingOpen
    );

    // When voting is closed, voting attempt returns 403
    const voteWhileClosed = await request('/api/community/vote', {
      method: 'POST',
      cookie: PRT_COOKIE,
      body: { projectId: 'prj_02' },
    });
    assert(
      'POST vote returns 403 when votingOpen is false',
      voteWhileClosed.status === 403,
      403,
      voteWhileClosed.status
    );
    assert(
      'Error message states voting is closed',
      voteWhileClosed.data?.error === 'Community voting is currently closed',
      'Community voting is currently closed',
      voteWhileClosed.data?.error
    );

    // Organizer re-opens voting and unseals results
    const unsealRes = await request('/api/community/settings', {
      method: 'POST',
      cookie: ORG_COOKIE,
      body: { votingOpen: true, resultsPublic: true },
    });
    assert('Organizer re-opens voting and unseals results (200)', unsealRes.status === 200, 200, unsealRes.status);
    assert('resultsPublic is true', unsealRes.data?.resultsPublic === true, true, unsealRes.data?.resultsPublic);

    // Cast vote again now that voting is open
    await request('/api/community/vote', {
      method: 'POST',
      cookie: PRT_COOKIE,
      body: { projectId: 'prj_02' },
    });

    // When results are public, participant sees numeric totalVotes
    const unsealedGetParticipant = await request('/api/community/vote?projectId=prj_02', {
      cookie: PRT_COOKIE,
    });
    assert(
      'When resultsPublic === true, participant sees totalVotes as numeric',
      unsealedGetParticipant.data?.totalVotes === 1,
      1,
      unsealedGetParticipant.data?.totalVotes
    );

    // Verify AuditLog for settings update
    const settingsAudit = await prisma.auditLog.findFirst({
      where: {
        userId: 'user_org_01',
        action: 'COMMUNITY_SETTINGS_UPDATED',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert('AuditLog recorded COMMUNITY_SETTINGS_UPDATED', !!settingsAudit, true, !!settingsAudit);

    // -------------------------------------------------------------------------
    // 7. Comments: Sanitization, 500-char limit, Rate-limiting, AuditLog
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Comments Engine & Anti-Abuse ---');

    // 7a: HTML Sanitization
    const commentWithScript = await request('/api/community/comments', {
      method: 'POST',
      cookie: PRT_COOKIE,
      body: {
        projectId: 'prj_02',
        content: 'Awesome work! <script>alert("xss")</script> Very clean code.',
      },
    });
    assert(
      'Comment with HTML tags accepted with 200',
      commentWithScript.status === 200,
      200,
      commentWithScript.status
    );
    assert(
      'HTML tags stripped from stored comment',
      commentWithScript.data?.comment?.content === 'Awesome work! alert("xss") Very clean code.',
      'Awesome work! alert("xss") Very clean code.',
      commentWithScript.data?.comment?.content
    );

    // 7b: Rate Limiting: immediate next comment within 10s is rejected with 429
    const fastCommentRes = await request('/api/community/comments', {
      method: 'POST',
      cookie: PRT_COOKIE,
      body: {
        projectId: 'prj_02',
        content: 'Spamming another comment right away!',
      },
    });
    assert(
      'Rapid subsequent comment within 10s returns 429 Too Many Requests',
      fastCommentRes.status === 429,
      429,
      fastCommentRes.status
    );
    assert(
      'Rate limit message matches expected text',
      fastCommentRes.data?.error === 'Rate limit exceeded. Please wait a few seconds before commenting again.',
      'Rate limit exceeded. Please wait a few seconds before commenting again.',
      fastCommentRes.data?.error
    );

    // 7c: 500-character limit rejection
    // We create a fake user session or simulate long comment
    const hugeContent = 'A'.repeat(501);
    const hugeCommentRes = await request('/api/community/comments', {
      method: 'POST',
      cookie: ORG_COOKIE,
      body: {
        projectId: 'prj_02',
        content: hugeContent,
      },
    });
    assert(
      'Comment exceeding 500 characters returns 400',
      hugeCommentRes.status === 400,
      400,
      hugeCommentRes.status
    );

    // 7d: Empty comment after sanitization
    const emptyCommentRes = await request('/api/community/comments', {
      method: 'POST',
      cookie: ORG_COOKIE,
      body: {
        projectId: 'prj_02',
        content: '   <b></b>   ',
      },
    });
    assert(
      'Comment containing only HTML tags/spaces returns 400',
      emptyCommentRes.status === 400,
      400,
      emptyCommentRes.status
    );

    // 7e: Verify AuditLog for comment
    const commentAudit = await prisma.auditLog.findFirst({
      where: {
        userId: 'user_prt_01',
        action: 'COMMENT_POSTED',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert('AuditLog recorded COMMENT_POSTED', !!commentAudit, true, !!commentAudit);

    // 7f: GET /api/community/comments?projectId=prj_02 returns mapped payload
    const getCommentsRes = await request('/api/community/comments?projectId=prj_02');
    assert('GET comments returns 200', getCommentsRes.status === 200, 200, getCommentsRes.status);
    assert(
      'GET comments returns array with author metadata',
      Array.isArray(getCommentsRes.data?.comments) && getCommentsRes.data?.comments.length > 0,
      true,
      Array.isArray(getCommentsRes.data?.comments)
    );
    const firstComment = getCommentsRes.data?.comments[0];
    assert(
      'Comment contains authorRole, authorName, content, createdAt',
      firstComment && typeof firstComment.authorRole === 'string' && typeof firstComment.authorName === 'string',
      true,
      !!(firstComment?.authorRole && firstComment?.authorName)
    );

  } finally {
    // -------------------------------------------------------------------------
    // Cleanup: Reset Event state & clean up test votes/comments/audit logs
    // -------------------------------------------------------------------------
    console.log('\n--- Cleanup ---');
    await prisma.communityVote.deleteMany({
      where: { userId: { in: ['user_prt_01', 'user_org_01'] } },
    });
    await prisma.comment.deleteMany({
      where: { userId: { in: ['user_prt_01', 'user_org_01'] } },
    });
    await prisma.auditLog.deleteMany({
      where: {
        action: { in: ['COMMUNITY_VOTE_CAST', 'COMMUNITY_VOTE_RETRACTED', 'COMMENT_POSTED', 'COMMUNITY_SETTINGS_UPDATED'] },
      },
    });
    if (activeEvent) {
      await prisma.event.update({
        where: { id: activeEvent.id },
        data: { votingOpen: true, resultsPublic: false },
      });
    }
    console.log('Cleanup completed successfully.');
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n====================================================');
  console.log('  Suite Summary');
  console.log('====================================================');
  const failed = assertions.filter((a) => !a.passed);
  console.log(`Total tests: ${assertions.length}`);
  console.log(`Passed:      ${assertions.length - failed.length}`);
  console.log(`Failed:      ${failed.length}`);

  if (failed.length > 0) {
    console.error('\nFailed tests:');
    for (const f of failed) {
      console.error(`- ${f.name}`);
    }
    process.exit(1);
  } else {
    console.log('\nALL TESTS PASSED! 🎉');
  }
}

runSuite()
  .catch((err) => {
    console.error('Test suite uncaught error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
