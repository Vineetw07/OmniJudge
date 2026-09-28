import { prisma } from '../src/lib/prisma';

interface AssertionResult {
  category: string;
  name: string;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  details?: string;
}

const BASE_URL = 'http://localhost:8080';
const COOKIES = {
  participant: 'session=prt_seed_token_2026',
  organizer: 'session=org_seed_token_2026',
  judge_a: 'session=jdg_a_seed_token_2026',
  judge_b: 'session=jdg_b_seed_token_2026',
};

const results: AssertionResult[] = [];

function assert(
  category: string,
  name: string,
  condition: boolean,
  expected: unknown,
  actual: unknown,
  details?: string
) {
  results.push({
    category,
    name,
    passed: condition,
    expected,
    actual,
    details,
  });
  const icon = condition ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [${category}] ${name}`);
  if (!condition) {
    console.error(`   Expected:`, expected);
    console.error(`   Actual:  `, actual);
    if (details) console.error(`   Details: `, details);
  }
}

async function request(
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

async function clearComments(userIds: string[]) {
  await prisma.comment.deleteMany({
    where: {
      userId: { in: userIds },
    },
  });
}

async function runChallenger2Suite() {
  console.log('================================================================');
  console.log('  CHALLENGER 2: Phase 6 Milestone 2 Adversarial Stress Suite   ');
  console.log('================================================================\n');

  const testUserIds = ['user_prt_01', 'user_org_01', 'user_jdg_a_01', 'user_jdg_b_01'];

  // Initial cleanup
  await clearComments(testUserIds);
  await prisma.auditLog.deleteMany({
    where: {
      action: 'COMMENT_POSTED',
      userId: { in: testUserIds },
    },
  });

  // Verify project prj_01 exists
  const project = await prisma.project.findUnique({ where: { id: 'prj_01' } });
  if (!project) {
    throw new Error('Prerequisite failed: project prj_01 does not exist in DB');
  }

  // ===========================================================================
  // CATEGORY 1: XSS / HTML INJECTION VECTORS
  // ===========================================================================
  console.log('\n--- Category 1: XSS & HTML Injection Vectors ---');

  // Vector 1a: <script>alert(1)</script>
  {
    await clearComments(['user_prt_01']);
    const res = await request('/api/community/comments', {
      method: 'POST',
      cookie: COOKIES.participant,
      body: {
        projectId: 'prj_01',
        content: '<script>alert(1)</script>',
      },
    });

    assert(
      'XSS',
      'Submit <script>alert(1)</script> returns HTTP 200',
      res.status === 200,
      200,
      res.status
    );

    const stored = await prisma.comment.findFirst({
      where: { userId: 'user_prt_01', projectId: 'prj_01' },
      orderBy: { createdAt: 'desc' },
    });

    assert(
      'XSS',
      'Stored content for <script>alert(1)</script> has script tags stripped (equals "alert(1)")',
      stored?.content === 'alert(1)',
      'alert(1)',
      stored?.content
    );

    assert(
      'XSS',
      'Stored content does NOT contain <script> or </script>',
      !stored?.content.includes('<script>') && !stored?.content.includes('</script>'),
      true,
      stored?.content
    );
  }

  // Vector 1b: <b>bold</b>
  {
    await clearComments(['user_jdg_a_01']);
    const res = await request('/api/community/comments', {
      method: 'POST',
      cookie: COOKIES.judge_a,
      body: {
        projectId: 'prj_01',
        content: 'This is <b>bold</b> text',
      },
    });

    assert(
      'XSS',
      'Submit "This is <b>bold</b> text" returns HTTP 200',
      res.status === 200,
      200,
      res.status
    );

    const stored = await prisma.comment.findFirst({
      where: { userId: 'user_jdg_a_01', projectId: 'prj_01' },
      orderBy: { createdAt: 'desc' },
    });

    assert(
      'XSS',
      'Stored content for <b>bold</b> has HTML tags stripped (equals "This is bold text")',
      stored?.content === 'This is bold text',
      'This is bold text',
      stored?.content
    );
  }

  // Vector 1c: <img src=x onerror=alert(1)> alone (strips to empty -> 400)
  {
    await clearComments(['user_jdg_b_01']);
    const res = await request('/api/community/comments', {
      method: 'POST',
      cookie: COOKIES.judge_b,
      body: {
        projectId: 'prj_01',
        content: '<img src=x onerror=alert(1)>',
      },
    });

    assert(
      'XSS',
      'Submit standalone <img src=x onerror=alert(1)> strips to empty and returns HTTP 400',
      res.status === 400,
      400,
      res.status,
      res.data?.error
    );

    const stored = await prisma.comment.findFirst({
      where: { userId: 'user_jdg_b_01', projectId: 'prj_01' },
    });
    assert(
      'XSS',
      'Standalone <img onerror> comment was NOT saved to database',
      stored === null,
      null,
      stored
    );
  }

  // Vector 1d: Embedded <img src=x onerror=alert(1)> with surrounding text
  {
    await clearComments(['user_jdg_b_01']);
    const res = await request('/api/community/comments', {
      method: 'POST',
      cookie: COOKIES.judge_b,
      body: {
        projectId: 'prj_01',
        content: 'Check out <img src=x onerror=alert(1)> this project!',
      },
    });

    assert(
      'XSS',
      'Submit embedded <img onerror> returns HTTP 200',
      res.status === 200,
      200,
      res.status
    );

    const stored = await prisma.comment.findFirst({
      where: { userId: 'user_jdg_b_01', projectId: 'prj_01' },
      orderBy: { createdAt: 'desc' },
    });

    assert(
      'XSS',
      'Stored content strips <img> tag cleanly and preserves benign text',
      stored?.content === 'Check out  this project!' && !stored?.content.includes('<img'),
      'Check out  this project!',
      stored?.content
    );
  }

  // Vector 1e: Adversarial nested/complex tags: <svg/onload=alert(1)>, <<script>script>
  {
    await clearComments(['user_org_01']);
    const res = await request('/api/community/comments', {
      method: 'POST',
      cookie: COOKIES.organizer,
      body: {
        projectId: 'prj_01',
        content: 'Payload: <svg/onload=alert(document.domain)> and <a href="javascript:void(0)">link</a>',
      },
    });

    assert(
      'XSS',
      'Submit complex <svg> and <a> payload returns HTTP 200',
      res.status === 200,
      200,
      res.status
    );

    const stored = await prisma.comment.findFirst({
      where: { userId: 'user_org_01', projectId: 'prj_01' },
      orderBy: { createdAt: 'desc' },
    });

    assert(
      'XSS',
      'Stored content does not contain <svg or <a href tags',
      !stored?.content.includes('<svg') && !stored?.content.includes('<a') && !stored?.content.includes('>'),
      true,
      stored?.content
    );
  }

  // ===========================================================================
  // CATEGORY 2: RAPID-FIRE SPAM / RATE LIMITING
  // ===========================================================================
  console.log('\n--- Category 2: Rapid-Fire Spam & Rate Limiting ---');

  {
    await clearComments(['user_prt_01', 'user_org_01']);

    // First request: should succeed
    const req1 = await request('/api/community/comments', {
      method: 'POST',
      cookie: COOKIES.participant,
      body: {
        projectId: 'prj_01',
        content: 'Rapid fire comment 1',
      },
    });

    assert(
      'RateLimit',
      'First comment submission returns HTTP 200',
      req1.status === 200,
      200,
      req1.status
    );

    // Second request immediately after (within milliseconds): should return 429
    const req2 = await request('/api/community/comments', {
      method: 'POST',
      cookie: COOKIES.participant,
      body: {
        projectId: 'prj_01',
        content: 'Rapid fire comment 2 - should be blocked',
      },
    });

    assert(
      'RateLimit',
      'Second comment submission within 10s returns HTTP 429 Too Many Requests',
      req2.status === 429,
      429,
      req2.status
    );

    assert(
      'RateLimit',
      '429 response contains rate limit error message',
      typeof req2.data?.error === 'string' && req2.data.error.includes('Rate limit exceeded'),
      true,
      req2.data?.error
    );

    // Third request: verify a DIFFERENT user is NOT blocked by user 1's rate limit
    const reqOtherUser = await request('/api/community/comments', {
      method: 'POST',
      cookie: COOKIES.organizer,
      body: {
        projectId: 'prj_01',
        content: 'Organizer comment while participant is rate limited',
      },
    });

    assert(
      'RateLimit',
      'Different user is NOT rate limited by another users activity (returns 200)',
      reqOtherUser.status === 200,
      200,
      reqOtherUser.status
    );
  }

  // ===========================================================================
  // CATEGORY 3: LENGTH BOUNDARY (500 vs 501)
  // ===========================================================================
  console.log('\n--- Category 3: Length Boundaries (500 vs 501) ---');

  // Boundary 3a: Exactly 500 characters
  {
    await clearComments(['user_jdg_a_01']);
    const content500 = 'X'.repeat(500);

    const res500 = await request('/api/community/comments', {
      method: 'POST',
      cookie: COOKIES.judge_a,
      body: {
        projectId: 'prj_01',
        content: content500,
      },
    });

    assert(
      'LengthBoundary',
      'Comment with exactly 500 characters returns HTTP 200',
      res500.status === 200,
      200,
      res500.status
    );

    const stored500 = await prisma.comment.findFirst({
      where: { userId: 'user_jdg_a_01', projectId: 'prj_01' },
      orderBy: { createdAt: 'desc' },
    });

    assert(
      'LengthBoundary',
      'Stored 500-char comment has length exactly 500',
      stored500?.content.length === 500,
      500,
      stored500?.content.length
    );
  }

  // Boundary 3b: Exactly 501 characters
  {
    await clearComments(['user_jdg_b_01']);
    const content501 = 'Y'.repeat(501);

    const res501 = await request('/api/community/comments', {
      method: 'POST',
      cookie: COOKIES.judge_b,
      body: {
        projectId: 'prj_01',
        content: content501,
      },
    });

    assert(
      'LengthBoundary',
      'Comment with exactly 501 characters returns HTTP 400',
      res501.status === 400,
      400,
      res501.status
    );

    assert(
      'LengthBoundary',
      'Rejection error specifies length boundary 1 to 500',
      typeof res501.data?.error === 'string' && res501.data.error.includes('between 1 and 500 characters'),
      true,
      res501.data?.error
    );

    const stored501 = await prisma.comment.findFirst({
      where: { userId: 'user_jdg_b_01', content: content501 },
    });
    assert(
      'LengthBoundary',
      'Comment of 501 characters was NOT stored in database',
      stored501 === null,
      null,
      stored501
    );
  }

  // Boundary 3c: 514 raw characters that strip down to exactly 500 characters
  {
    await clearComments(['user_org_01']);
    const rawContent = 'Z'.repeat(500) + '<b></b><i></i>'; // 500 chars + 14 chars tags = 514 chars raw

    const resStripped500 = await request('/api/community/comments', {
      method: 'POST',
      cookie: COOKIES.organizer,
      body: {
        projectId: 'prj_01',
        content: rawContent,
      },
    });

    assert(
      'LengthBoundary',
      'Raw 514 chars stripping to 500 chars returns HTTP 200',
      resStripped500.status === 200,
      200,
      resStripped500.status
    );

    const storedStripped500 = await prisma.comment.findFirst({
      where: { userId: 'user_org_01', projectId: 'prj_01' },
      orderBy: { createdAt: 'desc' },
    });

    assert(
      'LengthBoundary',
      'Stored stripped comment is exactly 500 chars of Z',
      storedStripped500?.content.length === 500 && storedStripped500?.content === 'Z'.repeat(500),
      500,
      storedStripped500?.content.length
    );
  }

  // ===========================================================================
  // CATEGORY 4: EMPTY & WHITESPACE-ONLY SUBMISSIONS
  // ===========================================================================
  console.log('\n--- Category 4: Empty & Whitespace-Only Submissions ---');

  // Empty string ""
  {
    await clearComments(['user_prt_01']);
    const resEmpty = await request('/api/community/comments', {
      method: 'POST',
      cookie: COOKIES.participant,
      body: {
        projectId: 'prj_01',
        content: '',
      },
    });

    assert(
      'EmptyWhitespace',
      'Empty string "" returns HTTP 400',
      resEmpty.status === 400,
      400,
      resEmpty.status
    );
  }

  // Whitespace only: single space " "
  {
    const resSingleSpace = await request('/api/community/comments', {
      method: 'POST',
      cookie: COOKIES.participant,
      body: {
        projectId: 'prj_01',
        content: ' ',
      },
    });

    assert(
      'EmptyWhitespace',
      'Single space " " returns HTTP 400',
      resSingleSpace.status === 400,
      400,
      resSingleSpace.status
    );
  }

  // Whitespace only: tabs, newlines, spaces
  {
    const resWhitespace = await request('/api/community/comments', {
      method: 'POST',
      cookie: COOKIES.participant,
      body: {
        projectId: 'prj_01',
        content: '   \n\t  \r\n   ',
      },
    });

    assert(
      'EmptyWhitespace',
      'Tabs, newlines, and spaces only return HTTP 400',
      resWhitespace.status === 400,
      400,
      resWhitespace.status
    );
  }

  // HTML tags only: <b></b><div>   </div>
  {
    const resHtmlOnly = await request('/api/community/comments', {
      method: 'POST',
      cookie: COOKIES.participant,
      body: {
        projectId: 'prj_01',
        content: '<b></b><div>   </div><p></p>',
      },
    });

    assert(
      'EmptyWhitespace',
      'HTML tags that strip to whitespace return HTTP 400',
      resHtmlOnly.status === 400,
      400,
      resHtmlOnly.status
    );
  }

  // Missing content property
  {
    const resMissing = await request('/api/community/comments', {
      method: 'POST',
      cookie: COOKIES.participant,
      body: {
        projectId: 'prj_01',
      },
    });

    assert(
      'EmptyWhitespace',
      'Missing content property returns HTTP 400',
      resMissing.status === 400,
      400,
      resMissing.status
    );
  }

  // ===========================================================================
  // CATEGORY 5: ENDPOINT INTEGRITY, RETRIEVAL & AUDIT LOGGING
  // ===========================================================================
  console.log('\n--- Category 5: Endpoint Integrity, Retrieval & Audit Logging ---');

  // Verify GET /api/community/comments without projectId returns 400
  {
    const resNoProject = await request('/api/community/comments');
    assert(
      'Integrity',
      'GET /api/community/comments without projectId returns HTTP 400',
      resNoProject.status === 400,
      400,
      resNoProject.status
    );
  }

  // Verify GET /api/community/comments?projectId=prj_01 returns comments with author metadata
  {
    const resGet = await request('/api/community/comments?projectId=prj_01');
    assert(
      'Integrity',
      'GET /api/community/comments?projectId=prj_01 returns HTTP 200',
      resGet.status === 200,
      200,
      resGet.status
    );

    assert(
      'Integrity',
      'GET returns success: true and comments array',
      resGet.data?.success === true && Array.isArray(resGet.data?.comments),
      true,
      resGet.data?.success
    );

    if (Array.isArray(resGet.data?.comments) && resGet.data.comments.length > 0) {
      const first = resGet.data.comments[0];
      assert(
        'Integrity',
        'Comment items contain id, authorName, authorRole, content, createdAt',
        Boolean(first.id && first.authorName && first.authorRole && first.content && first.createdAt),
        true,
        { id: Boolean(first.id), authorName: Boolean(first.authorName), authorRole: Boolean(first.authorRole) }
      );
    }
  }

  // Verify AuditLog entries created with COMMENT_POSTED
  {
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        action: 'COMMENT_POSTED',
        userId: { in: testUserIds },
      },
    });

    assert(
      'Integrity',
      'AuditLog records exist for COMMENT_POSTED action',
      auditLogs.length > 0,
      true,
      auditLogs.length
    );

    if (auditLogs.length > 0) {
      const payload = JSON.parse(auditLogs[0].payload);
      assert(
        'Integrity',
        'AuditLog payload contains projectId and commentId',
        Boolean(payload.projectId && payload.commentId),
        true,
        payload
      );
    }
  }

  // Post to non-existent project returns 404
  {
    await clearComments(['user_prt_01']);
    const res404 = await request('/api/community/comments', {
      method: 'POST',
      cookie: COOKIES.participant,
      body: {
        projectId: 'prj_non_existent_9999',
        content: 'Valid content for invalid project',
      },
    });

    assert(
      'Integrity',
      'POST comment to non-existent project returns HTTP 404',
      res404.status === 404,
      404,
      res404.status
    );
  }

  // Final cleanup
  await clearComments(testUserIds);
  await prisma.auditLog.deleteMany({
    where: {
      action: 'COMMENT_POSTED',
      userId: { in: testUserIds },
    },
  });

  // ===========================================================================
  // SUMMARY
  // ===========================================================================
  console.log('\n================================================================');
  console.log('  CHALLENGER 2 SUITE SUMMARY');
  console.log('================================================================');

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Total Probes: ${total}`);
  console.log(`Passed:       ${passed}`);
  console.log(`Failed:       ${failed}`);

  if (failed > 0) {
    console.error(`\n❌ VERDICT: REJECT (${failed} probes failed)`);
    process.exit(1);
  } else {
    console.log(`\n🎉 VERDICT: CONFIRM (${passed}/${total} probes passed)`);
  }
}

runChallenger2Suite()
  .catch((err) => {
    console.error('Unhandled suite error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
