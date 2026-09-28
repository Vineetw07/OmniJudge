import { prisma } from '../src/lib/prisma';

const BASE_URL = 'http://localhost:8080';
const ORG_COOKIE = 'session=org_seed_token_2026';
const PRT_COOKIE = 'session=prt_seed_token_2026';

async function runTests() {
  console.log('🧪 Starting Phase 6 M5 Dashboard Governance & Settings Tests...\n');

  // 1. Check initial settings
  console.log('Test 1: Verify GET /api/community/settings');
  const getRes = await fetch(`${BASE_URL}/api/community/settings`);
  if (!getRes.ok) throw new Error(`GET /api/community/settings failed: ${getRes.status}`);
  const getBody = await getRes.json();
  console.log('  Initial settings:', getBody);
  if (typeof getBody.votingOpen !== 'boolean' || typeof getBody.resultsPublic !== 'boolean') {
    throw new Error('Invalid settings response format');
  }
  console.log('  ✅ GET /api/community/settings returned valid flags.\n');

  // 2. Test unauthorized user cannot modify settings
  console.log('Test 2: Participant cannot update settings (RBAC isolation)');
  const partRes = await fetch(`${BASE_URL}/api/community/settings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': PRT_COOKIE,
    },
    body: JSON.stringify({ resultsPublic: true }),
  });
  if (partRes.status !== 403) {
    throw new Error(`Expected 403 for participant, got ${partRes.status}`);
  }
  console.log('  ✅ Participant blocked with HTTP 403 Forbidden.\n');

  // 3. Test organizer toggles resultsPublic: true (Unseal)
  console.log('Test 3: Organizer unseals public results (resultsPublic: true)');
  const unsealRes = await fetch(`${BASE_URL}/api/community/settings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': ORG_COOKIE,
    },
    body: JSON.stringify({ resultsPublic: true }),
  });
  if (!unsealRes.ok) throw new Error(`POST unseal failed: ${unsealRes.status}`);
  const unsealBody = await unsealRes.json();
  if (unsealBody.resultsPublic !== true) {
    throw new Error(`Expected resultsPublic: true, got ${unsealBody.resultsPublic}`);
  }
  
  // Verify DB reflects it
  const eventInDb1 = await prisma.event.findFirst();
  if (eventInDb1?.resultsPublic !== true) {
    throw new Error(`Database event.resultsPublic did not update to true!`);
  }
  console.log('  ✅ Database and API reflect resultsPublic: true.\n');

  // 4. Test organizer toggles votingOpen: false (Close voting)
  console.log('Test 4: Organizer closes community voting (votingOpen: false)');
  const closeRes = await fetch(`${BASE_URL}/api/community/settings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': ORG_COOKIE,
    },
    body: JSON.stringify({ votingOpen: false }),
  });
  if (!closeRes.ok) throw new Error(`POST close voting failed: ${closeRes.status}`);
  const closeBody = await closeRes.json();
  if (closeBody.votingOpen !== false) {
    throw new Error(`Expected votingOpen: false, got ${closeBody.votingOpen}`);
  }
  
  const eventInDb2 = await prisma.event.findFirst();
  if (eventInDb2?.votingOpen !== false) {
    throw new Error(`Database event.votingOpen did not update to false!`);
  }
  console.log('  ✅ Database and API reflect votingOpen: false.\n');

  // 5. Verify AuditLog entries created for governance actions
  console.log('Test 5: Verify AuditLog captures COMMUNITY_SETTINGS_UPDATED');
  const auditEntries = await prisma.auditLog.findMany({
    where: { action: 'COMMUNITY_SETTINGS_UPDATED' },
    orderBy: { createdAt: 'desc' },
    take: 2,
  });
  if (auditEntries.length < 2) {
    throw new Error(`Expected at least 2 COMMUNITY_SETTINGS_UPDATED logs, found ${auditEntries.length}`);
  }
  console.log('  Latest audit entry payload:', auditEntries[0].payload);
  console.log('  ✅ AuditLog successfully captured COMMUNITY_SETTINGS_UPDATED actions.\n');

  // 6. Test Dashboard queries & top 5 favorites aggregation
  console.log('Test 6: Test Community Governance Queries directly');
  const totalVotes = await prisma.communityVote.count();
  const uniqueVoters = await prisma.communityVote.groupBy({ by: ['userId'] }).then((r) => r.length);
  const topFavorites = await prisma.project.findMany({
    select: {
      id: true,
      title: true,
      track: { select: { name: true } },
      _count: { select: { communityVotes: true } },
    },
    orderBy: { communityVotes: { _count: 'desc' } },
    take: 5,
  });
  console.log(`  Current Total Votes: ${totalVotes}, Unique Voters: ${uniqueVoters}`);
  console.log(`  Top 5 Favorites fetched: ${topFavorites.length} projects`);
  if (topFavorites.length !== 5) {
    throw new Error(`Expected 5 top projects, got ${topFavorites.length}`);
  }
  console.log('  ✅ Dashboard queries return consistent, properly typed data.\n');

  // 7. Test Dashboard HTML rendering with Organizer Cookie
  console.log('Test 7: Verify /dashboard renders Community Voting Governance card');
  const dashRes = await fetch(`${BASE_URL}/dashboard`, {
    headers: {
      'Cookie': ORG_COOKIE,
    },
  });
  if (!dashRes.ok) throw new Error(`/dashboard failed with status: ${dashRes.status}`);
  const dashHtml = await dashRes.text();
  if (!dashHtml.includes('Community Voting Governance')) {
    throw new Error('Dashboard HTML missing "Community Voting Governance" card title');
  }
  if (!dashHtml.includes('Top 5 Community Favorites')) {
    throw new Error('Dashboard HTML missing "Top 5 Community Favorites" section');
  }
  if (!dashHtml.includes('Total Votes Cast') || !dashHtml.includes('Unique Voters')) {
    throw new Error('Dashboard HTML missing community KPI metrics');
  }
  console.log('  ✅ /dashboard HTML contains all Community Voting Governance sections.\n');

  // 8. Revert settings back to standard baseline
  console.log('Test 8: Revert settings back to standard baseline (votingOpen: true, resultsPublic: false)');
  const revertRes = await fetch(`${BASE_URL}/api/community/settings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': ORG_COOKIE,
    },
    body: JSON.stringify({ votingOpen: true, resultsPublic: false }),
  });
  if (!revertRes.ok) throw new Error(`Revert failed: ${revertRes.status}`);
  const revertBody = await revertRes.json();
  if (revertBody.votingOpen !== true || revertBody.resultsPublic !== false) {
    throw new Error('Revert did not restore expected baseline');
  }
  console.log('  ✅ Settings reverted to baseline: votingOpen=true, resultsPublic=false.\n');

  console.log('🎉 ALL 8 ACCEPTANCE CHECKS PASSED FOR PHASE 6 MILESTONE 5!');
}

runTests()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
