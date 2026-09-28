import { prisma } from '../src/lib/prisma';
import { Prisma } from '@prisma/client';

interface TestResult {
  step: string;
  passed: boolean;
  details: string;
}

async function runEmpiricalTest(): Promise<void> {
  console.log('=== STARTING EMPIRICAL CHALLENGE SUITE: Phase 6 Milestone 1 ===\n');
  const results: TestResult[] = [];

  const TEST_USER_ID = 'test_usr_p6_m1_challenger';
  const TEST_USER_EMAIL = 'challenger_p6_m1@dogfood.dev';
  const TEST_USER_2_ID = 'test_usr_p6_m1_challenger_2';
  const TEST_USER_2_EMAIL = 'challenger_p6_m1_2@dogfood.dev';
  const TEST_PROJECT_ID = 'test_prj_p6_m1_challenger';
  const TEST_PROJECT_2_ID = 'test_prj_p6_m1_challenger_2';

  // Record baseline counts
  const initialCounts = {
    users: await prisma.user.count(),
    projects: await prisma.project.count(),
    votes: await prisma.communityVote.count(),
    comments: await prisma.comment.count(),
  };

  console.log('Baseline counts before test:', initialCounts);

  try {
    // Clean up any stale records from previous aborted runs if any
    await prisma.communityVote.deleteMany({
      where: { userId: { in: [TEST_USER_ID, TEST_USER_2_ID] } },
    });
    await prisma.comment.deleteMany({
      where: { userId: { in: [TEST_USER_ID, TEST_USER_2_ID] } },
    });
    await prisma.project.deleteMany({
      where: { id: { in: [TEST_PROJECT_ID, TEST_PROJECT_2_ID] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [TEST_USER_ID, TEST_USER_2_ID] } },
    });

    // ----------------------------------------------------
    // TEST 1: Verify Event evt_01 votingOpen and resultsPublic
    // ----------------------------------------------------
    console.log('\n[Test 1] Checking Event evt_01 votingOpen and resultsPublic flags...');
    const evt = await prisma.event.findUnique({
      where: { id: 'evt_01' },
    });

    if (!evt) {
      throw new Error('Event evt_01 not found in database!');
    }

    const test1Passed = evt.votingOpen === true && evt.resultsPublic === false;
    results.push({
      step: 'Event evt_01 flags validation',
      passed: test1Passed,
      details: `votingOpen: ${evt.votingOpen} (expected true), resultsPublic: ${evt.resultsPublic} (expected false)`,
    });
    console.log(`  -> Passed: ${test1Passed}, evt_01: votingOpen=${evt.votingOpen}, resultsPublic=${evt.resultsPublic}`);

    // Also test default values on a new Event creation
    const tempEvtId = 'test_evt_defaults';
    const tempEvt = await prisma.event.create({
      data: {
        id: tempEvtId,
        name: 'Temporary Event Defaults Test',
        submissionsClose: new Date(),
      },
    });
    const defaultPassed = tempEvt.votingOpen === true && tempEvt.resultsPublic === false;
    results.push({
      step: 'New Event default flags validation',
      passed: defaultPassed,
      details: `Created new Event without explicit flags: votingOpen=${tempEvt.votingOpen} (default true), resultsPublic=${tempEvt.resultsPublic} (default false)`,
    });
    await prisma.event.delete({ where: { id: tempEvtId } });
    console.log(`  -> Passed: ${defaultPassed}, new Event defaults: votingOpen=${tempEvt.votingOpen}, resultsPublic=${tempEvt.resultsPublic}`);

    // ----------------------------------------------------
    // TEST 2: Create Test User and Test Project
    // ----------------------------------------------------
    console.log('\n[Test 2] Creating test user and test project...');
    const testUser = await prisma.user.create({
      data: {
        id: TEST_USER_ID,
        email: TEST_USER_EMAIL,
        name: 'Challenger Empirical Tester',
        role: 'visitor',
      },
    });

    const testProject = await prisma.project.create({
      data: {
        id: TEST_PROJECT_ID,
        title: 'Challenger Empirical Project',
        summary: 'A project created exclusively for empirical verification',
        repoUrl: 'https://github.com/dogfood/test-project',
        submittedAt: new Date(),
        teamId: 'tm_01',
        trackId: 'trk_01',
        eventId: 'evt_01',
      },
    });

    const test2Passed = !!testUser.id && !!testProject.id;
    results.push({
      step: 'Test User & Project creation',
      passed: test2Passed,
      details: `User created with id=${testUser.id}, Project created with id=${testProject.id}`,
    });
    console.log(`  -> Passed: ${test2Passed}, User=${testUser.id}, Project=${testProject.id}`);

    // ----------------------------------------------------
    // TEST 3: Cast a CommunityVote
    // ----------------------------------------------------
    console.log('\n[Test 3] Casting a CommunityVote...');
    const vote = await prisma.communityVote.create({
      data: {
        projectId: testProject.id,
        userId: testUser.id,
      },
    });

    const test3Passed = !!vote.id && vote.projectId === testProject.id && vote.userId === testUser.id && vote.createdAt instanceof Date;
    results.push({
      step: 'CommunityVote cast',
      passed: test3Passed,
      details: `Vote created id=${vote.id}, projectId=${vote.projectId}, userId=${vote.userId}, createdAt=${vote.createdAt.toISOString()}`,
    });
    console.log(`  -> Passed: ${test3Passed}, voteId=${vote.id}`);

    // ----------------------------------------------------
    // TEST 4: Attempt duplicate vote and assert P2002 Unique Constraint
    // ----------------------------------------------------
    console.log('\n[Test 4] Attempting duplicate vote with same projectId and userId...');
    let duplicateCaught = false;
    let errorCode = '';
    let errorMessage = '';

    try {
      await prisma.communityVote.create({
        data: {
          projectId: testProject.id,
          userId: testUser.id,
        },
      });
    } catch (err: unknown) {
      duplicateCaught = true;
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        errorCode = err.code;
        errorMessage = err.message;
      } else {
        errorMessage = String(err);
      }
    }

    const test4Passed = duplicateCaught && errorCode === 'P2002';
    results.push({
      step: 'Duplicate vote uniqueness constraint (P2002)',
      passed: test4Passed,
      details: `Duplicate caught=${duplicateCaught}, Prisma error code=${errorCode} (expected P2002)`,
    });
    console.log(`  -> Passed: ${test4Passed}, caught=${duplicateCaught}, code=${errorCode}`);

    // ----------------------------------------------------
    // TEST 5: Comment creation, isFlagged default, authorName and content
    // ----------------------------------------------------
    console.log('\n[Test 5] Creating Comment and checking defaults and fields...');
    const comment1 = await prisma.comment.create({
      data: {
        projectId: testProject.id,
        userId: testUser.id,
        authorName: 'Challenger Empirical Tester',
        content: 'This is a test comment to verify comment creation and default isFlagged value.',
      },
    });

    const test5aPassed =
      !!comment1.id &&
      comment1.isFlagged === false &&
      comment1.authorName === 'Challenger Empirical Tester' &&
      comment1.content === 'This is a test comment to verify comment creation and default isFlagged value.' &&
      comment1.createdAt instanceof Date;

    results.push({
      step: 'Comment creation & default isFlagged=false',
      passed: test5aPassed,
      details: `Comment id=${comment1.id}, authorName='${comment1.authorName}', isFlagged=${comment1.isFlagged} (expected false), content matches`,
    });
    console.log(`  -> Passed: ${test5aPassed}, commentId=${comment1.id}, isFlagged=${comment1.isFlagged}`);

    // Create a second comment with explicit isFlagged=true to verify field mutability
    const comment2 = await prisma.comment.create({
      data: {
        projectId: testProject.id,
        userId: testUser.id,
        authorName: 'Challenger Empirical Tester',
        content: 'Flagged comment test',
        isFlagged: true,
      },
    });
    const test5bPassed = comment2.isFlagged === true;
    results.push({
      step: 'Comment creation with explicit isFlagged=true',
      passed: test5bPassed,
      details: `Comment id=${comment2.id}, isFlagged=${comment2.isFlagged} (expected true)`,
    });
    console.log(`  -> Passed: ${test5bPassed}, comment2 isFlagged=${comment2.isFlagged}`);

    // ----------------------------------------------------
    // TEST 6: Cascading Deletes on Project Deletion
    // ----------------------------------------------------
    console.log('\n[Test 6] Testing Project cascading deletes (Project -> CommunityVote & Comment)...');
    // Pre-check counts on testProject
    const preVotes = await prisma.communityVote.count({ where: { projectId: testProject.id } });
    const preComments = await prisma.comment.count({ where: { projectId: testProject.id } });
    console.log(`  Before delete: testProject has ${preVotes} votes and ${preComments} comments.`);

    // Delete test project
    await prisma.project.delete({
      where: { id: testProject.id },
    });

    // Check that votes and comments were cascade deleted
    const postVotes = await prisma.communityVote.count({ where: { projectId: testProject.id } });
    const postComments = await prisma.comment.count({ where: { projectId: testProject.id } });

    const test6Passed = preVotes > 0 && preComments > 0 && postVotes === 0 && postComments === 0;
    results.push({
      step: 'Project cascade delete to CommunityVote and Comment',
      passed: test6Passed,
      details: `Pre-delete: ${preVotes} votes, ${preComments} comments. Post-delete: ${postVotes} votes, ${postComments} comments (expected 0)`,
    });
    console.log(`  -> Passed: ${test6Passed}, postVotes=${postVotes}, postComments=${postComments}`);

    // ----------------------------------------------------
    // TEST 7: Adversarial Check - Cascading Deletes on User Deletion
    // ----------------------------------------------------
    console.log('\n[Test 7] Adversarial test: User cascading deletes (User -> CommunityVote & Comment)...');
    const testUser2 = await prisma.user.create({
      data: {
        id: TEST_USER_2_ID,
        email: TEST_USER_2_EMAIL,
        name: 'User Cascade Tester',
        role: 'visitor',
      },
    });

    const testProject2 = await prisma.project.create({
      data: {
        id: TEST_PROJECT_2_ID,
        title: 'User Cascade Test Project',
        summary: 'Testing user cascade',
        repoUrl: 'https://github.com/dogfood/test-project-2',
        submittedAt: new Date(),
        teamId: 'tm_01',
        trackId: 'trk_01',
        eventId: 'evt_01',
      },
    });

    await prisma.communityVote.create({
      data: {
        projectId: testProject2.id,
        userId: testUser2.id,
      },
    });

    await prisma.comment.create({
      data: {
        projectId: testProject2.id,
        userId: testUser2.id,
        authorName: testUser2.name,
        content: 'Cascade test comment from testUser2',
      },
    });

    const userPreVotes = await prisma.communityVote.count({ where: { userId: testUser2.id } });
    const userPreComments = await prisma.comment.count({ where: { userId: testUser2.id } });

    // Delete user
    await prisma.user.delete({ where: { id: testUser2.id } });

    const userPostVotes = await prisma.communityVote.count({ where: { userId: testUser2.id } });
    const userPostComments = await prisma.comment.count({ where: { userId: testUser2.id } });

    // Clean up testProject2
    await prisma.project.delete({ where: { id: testProject2.id } });

    const test7Passed = userPreVotes === 1 && userPreComments === 1 && userPostVotes === 0 && userPostComments === 0;
    results.push({
      step: 'User cascade delete to CommunityVote and Comment',
      passed: test7Passed,
      details: `Pre-delete: ${userPreVotes} votes, ${userPreComments} comments. Post-delete: ${userPostVotes} votes, ${userPostComments} comments (expected 0)`,
    });
    console.log(`  -> Passed: ${test7Passed}, userPostVotes=${userPostVotes}, userPostComments=${userPostComments}`);

  } finally {
    // ----------------------------------------------------
    // CLEANUP & PRISTINE DB RESTORATION
    // ----------------------------------------------------
    console.log('\n[Cleanup] Cleaning up any remaining test records...');
    try {
      await prisma.communityVote.deleteMany({
        where: { userId: { in: [TEST_USER_ID, TEST_USER_2_ID] } },
      });
      await prisma.comment.deleteMany({
        where: { userId: { in: [TEST_USER_ID, TEST_USER_2_ID] } },
      });
      await prisma.project.deleteMany({
        where: { id: { in: [TEST_PROJECT_ID, TEST_PROJECT_2_ID] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [TEST_USER_ID, TEST_USER_2_ID] } },
      });
    } catch (cleanupErr) {
      console.error('Error during cleanup:', cleanupErr);
    }

    const finalCounts = {
      users: await prisma.user.count(),
      projects: await prisma.project.count(),
      votes: await prisma.communityVote.count(),
      comments: await prisma.comment.count(),
    };
    console.log('Final database counts after cleanup:', finalCounts);

    const countsMatch =
      finalCounts.users === initialCounts.users &&
      finalCounts.projects === initialCounts.projects &&
      finalCounts.votes === initialCounts.votes &&
      finalCounts.comments === initialCounts.comments;

    results.push({
      step: 'Database cleanup & pristine state verification',
      passed: countsMatch,
      details: `Initial: ${JSON.stringify(initialCounts)}, Final: ${JSON.stringify(finalCounts)} (Identical: ${countsMatch})`,
    });
    console.log(`  -> Database pristine: ${countsMatch}`);
  }

  console.log('\n=== EMPIRICAL TEST SUITE SUMMARY ===');
  let allPassed = true;
  for (const r of results) {
    console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.step} - ${r.details}`);
    if (!r.passed) allPassed = false;
  }

  if (!allPassed) {
    console.error('\n❌ EMPIRICAL CHALLENGE FAILED: One or more assertions did not pass!');
    process.exit(1);
  } else {
    console.log('\n✅ ALL EMPIRICAL CHALLENGES PASSED SUCCESSFULLY!');
  }
}

runEmpiricalTest()
  .catch((err) => {
    console.error('Fatal execution error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
