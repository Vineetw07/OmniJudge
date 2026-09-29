import { prisma } from '../src/lib/prisma';

const BASE_URL = 'http://localhost:8080';
const ORG_COOKIE = 'session=org_seed_token_2026';
const PRT_COOKIE = 'session=prt_seed_token_2026';

async function run() {
  console.log('🧪 Starting Project Submission & Organizer Toggle Integration Tests...\n');

  // 1. Initial State Check
  console.log('Test 1: Verify GET /api/community/settings includes submissionsOpen');
  const getRes1 = await fetch(`${BASE_URL}/api/community/settings`);
  if (!getRes1.ok) throw new Error(`GET /api/community/settings failed: ${getRes1.status}`);
  const settings1 = await getRes1.json();
  console.log('  Settings:', settings1);
  if (typeof settings1.submissionsOpen !== 'boolean') {
    throw new Error('submissionsOpen boolean flag is missing from GET /api/community/settings');
  }
  console.log('  ✅ SubmissionsOpen returned in settings.\n');

  // 2. Participant attempt to submit while closed
  console.log('Test 2: Participant cannot submit project when window is closed');
  const lateSubmitRes = await fetch(`${BASE_URL}/api/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': PRT_COOKIE,
    },
    body: JSON.stringify({
      title: 'Late Project Attempt',
      summary: 'This should fail with 409',
    }),
  });
  if (lateSubmitRes.status !== 409) {
    throw new Error(`Expected 409 when closed, got ${lateSubmitRes.status}`);
  }
  const lateBody = await lateSubmitRes.json();
  console.log('  Rejected response:', lateBody.error);
  console.log('  ✅ Closed event rejects submission with HTTP 409.\n');

  // 3. Participant cannot toggle settings (RBAC)
  console.log('Test 3: Participant cannot toggle submissionsOpen (RBAC)');
  const partToggleRes = await fetch(`${BASE_URL}/api/community/settings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': PRT_COOKIE,
    },
    body: JSON.stringify({ submissionsOpen: true }),
  });
  if (partToggleRes.status !== 403) {
    throw new Error(`Expected 403 for participant toggle, got ${partToggleRes.status}`);
  }
  console.log('  ✅ Participant blocked with HTTP 403 Forbidden.\n');

  // 4. Organizer toggles submissionsOpen: true
  console.log('Test 4: Organizer opens submissions portal');
  const openRes = await fetch(`${BASE_URL}/api/community/settings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': ORG_COOKIE,
    },
    body: JSON.stringify({ submissionsOpen: true }),
  });
  if (!openRes.ok) throw new Error(`Organizer open toggle failed: ${openRes.status}`);
  const openBody = await openRes.json();
  if (openBody.submissionsOpen !== true) {
    throw new Error(`Expected submissionsOpen: true, got ${openBody.submissionsOpen}`);
  }
  console.log('  Updated settings:', openBody);
  console.log('  ✅ Organizer opened submissions portal.\n');

  // 5. Participant successfully submits project
  console.log('Test 5: Participant submits project while portal is open');
  const projectTitle = `OmniTester Project ${Date.now()}`;
  const submitRes = await fetch(`${BASE_URL}/api/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': PRT_COOKIE,
    },
    body: JSON.stringify({
      title: projectTitle,
      summary: 'Automated test verified project submission for DogFood hackathon.',
      repoUrl: 'https://github.com/example/omni-tester',
      isDraft: false,
    }),
  });
  if (submitRes.status !== 201) {
    const errText = await submitRes.text();
    throw new Error(`Expected 201 Created, got ${submitRes.status}: ${errText}`);
  }
  const submitBody = await submitRes.json();
  console.log('  Created project ID:', submitBody.project.id);
  console.log('  Assigned team ID:', submitBody.project.teamId);
  if (submitBody.project.title !== projectTitle) {
    throw new Error('Submitted project title mismatch');
  }

  // Verify project in DB
  const dbProject = await prisma.project.findUnique({
    where: { id: submitBody.project.id },
  });
  if (!dbProject) throw new Error('Submitted project not found in database');
  console.log('  ✅ Project successfully persisted in SQLite database.\n');

  // 6. Organizer closes submissions portal
  console.log('Test 6: Organizer closes submissions portal');
  const closeRes = await fetch(`${BASE_URL}/api/community/settings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': ORG_COOKIE,
    },
    body: JSON.stringify({ submissionsOpen: false }),
  });
  if (!closeRes.ok) throw new Error(`Organizer close toggle failed: ${closeRes.status}`);
  const closeBody = await closeRes.json();
  if (closeBody.submissionsOpen !== false) {
    throw new Error(`Expected submissionsOpen: false, got ${closeBody.submissionsOpen}`);
  }
  console.log('  ✅ Organizer closed submissions portal.\n');

  // 7. Verify submission blocked again
  console.log('Test 7: Verify submission is blocked again after organizer locks portal');
  const blockedRes = await fetch(`${BASE_URL}/api/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': PRT_COOKIE,
    },
    body: JSON.stringify({
      title: 'Another Attempt',
      summary: 'Should be blocked',
    }),
  });
  if (blockedRes.status !== 409) {
    throw new Error(`Expected 409 after closing, got ${blockedRes.status}`);
  }
  console.log('  ✅ Submissions locked again with HTTP 409.\n');

  // Cleanup test project
  await prisma.project.delete({
    where: { id: submitBody.project.id },
  });
  console.log('  Cleaned up test project from database.');

  console.log('\n🎉 ALL INTEGRATION TESTS PASSED CLEANLY!');
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
