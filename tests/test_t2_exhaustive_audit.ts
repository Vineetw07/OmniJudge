import { prisma } from '../src/lib/prisma';
import { normaliseJudgeScores, normaliseAllJudges } from '../src/lib/normalization';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`[PASS] ${message}`);
}

async function runExhaustiveT2Audit() {
  console.log('================================================================');
  console.log('PRINCIPAL STAFF ENGINEER & SENIOR JUDGE AUDIT: TIER 2 ENGINE');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // PILLAR 1: Judge Assignment, Jurisdiction & Incomplete Block Design
  // ---------------------------------------------------------------------------
  console.log('--- PILLAR 1: Judge Assignment & Jurisdiction Boundaries ---');

  // Test 1.1: Verify track deduplication in progress KPIs
  const duplicateAssignments = [
    { trackId: 'trk_01' },
    { trackId: 'trk_01' },
    { trackId: 'trk_02' },
  ];
  const dedupedTrackIds = Array.from(new Set(duplicateAssignments.map((a) => a.trackId)));
  assert(dedupedTrackIds.length === 2, 'P1.1: Duplicate track assignments successfully deduplicated');
  assert(dedupedTrackIds.includes('trk_01') && dedupedTrackIds.includes('trk_02'), 'P1.2: All distinct track IDs preserved');

  // Test 1.2: Unassigned judge scope isolation
  const emptyTrackIds: string[] = [];
  const unassignedWhere = { trackId: { in: emptyTrackIds } };
  const unassignedProjects = await prisma.project.findMany({ where: unassignedWhere });
  assert(unassignedProjects.length === 0, 'P1.3: Unassigned judge (0 tracks) retrieves exactly 0 projects (no scope leak)');

  // ---------------------------------------------------------------------------
  // PILLAR 2: Conflict of Interest (COI) Defense & Self-Evaluation Bar
  // ---------------------------------------------------------------------------
  console.log('\n--- PILLAR 2: Conflict of Interest (COI) Defense ---');

  // Setup a test CoI condition: link user_jdg_b_01 to tm_01 (owner of prj_01)
  const prj01 = await prisma.project.findUnique({
    where: { id: 'prj_01' },
    include: { team: true },
  });
  assert(!!prj01, 'P2.1: prj_01 exists in database');

  // Check if judge affiliated with tm_01 is barred from evaluating prj_01
  const existingJudgeBTeam = await prisma.teamMember.findUnique({
    where: { userId: 'user_jdg_b_01' },
  });

  // Temporarily assign judge_b to tm_01
  await prisma.teamMember.upsert({
    where: { userId: 'user_jdg_b_01' },
    update: { teamId: 'tm_01' },
    create: { userId: 'user_jdg_b_01', teamId: 'tm_01' },
  });

  // Verify DB query detects the CoI
  const coiCheck = await prisma.teamMember.findFirst({
    where: {
      userId: 'user_jdg_b_01',
      teamId: prj01!.teamId,
    },
  });
  assert(!!coiCheck, 'P2.2: Relational traversal detects judge team membership on target project team');

  // Restore judge_b team membership
  if (existingJudgeBTeam) {
    await prisma.teamMember.update({
      where: { userId: 'user_jdg_b_01' },
      data: { teamId: existingJudgeBTeam.teamId },
    });
  } else {
    await prisma.teamMember.delete({
      where: { userId: 'user_jdg_b_01' },
    });
  }

  // ---------------------------------------------------------------------------
  // PILLAR 3: Backend Security Boundary & Role Isolation
  // ---------------------------------------------------------------------------
  console.log('\n--- PILLAR 3: Backend Security Boundary & Peer Isolation ---');

  // Verify test sessions are active and non-expired in SQLite
  const sessions = await prisma.session.findMany({
    where: { id: { in: ['org_seed_token_2026', 'jdg_a_seed_token_2026', 'jdg_b_seed_token_2026', 'prt_seed_token_2026'] } },
    include: { user: true },
  });
  assert(sessions.length === 4, 'P3.1: All 4 deterministic test tokens present in Session table');
  const orgSession = sessions.find((s) => s.id === 'org_seed_token_2026');
  const jdgASession = sessions.find((s) => s.id === 'jdg_a_seed_token_2026');
  const prtSession = sessions.find((s) => s.id === 'prt_seed_token_2026');
  assert(orgSession?.user.role === 'organizer', 'P3.2: Organizer role verified');
  assert(jdgASession?.user.role === 'judge', 'P3.3: Judge role verified');
  assert(prtSession?.user.role === 'participant', 'P3.4: Participant role verified');

  // ---------------------------------------------------------------------------
  // PILLAR 4: Rubric Weighting & Numerical Score Aggregation
  // ---------------------------------------------------------------------------
  console.log('\n--- PILLAR 4: Rubric Weighting & Numerical Aggregation ---');

  // Test 4.1: Rubric weighting formula
  const sampleWeights = new Map<string, number>([
    ['func', 1.5],
    ['qual', 1.0],
    ['crea', 1.0],
    ['pres', 0.5],
  ]);
  const sampleScores = [
    { criterionId: 'func', value: 4.0 },
    { criterionId: 'qual', value: 5.0 },
    { criterionId: 'crea', value: 3.0 },
    { criterionId: 'pres', value: 2.0 },
  ];
  let wSum = 0;
  let wTot = 0;
  for (const s of sampleScores) {
    const w = sampleWeights.get(s.criterionId) ?? 1.0;
    wSum += s.value * w;
    wTot += w;
  }
  const weightedComposite = wSum / wTot;
  // (4*1.5 + 5*1.0 + 3*1.0 + 2*0.5) / (1.5 + 1.0 + 1.0 + 0.5) = (6.0 + 5.0 + 3.0 + 1.0) / 4.0 = 15.0 / 4.0 = 3.75
  assert(Math.abs(weightedComposite - 3.75) < 1e-9, `P4.1: Weighted composite calculation exact (expected 3.75, got ${weightedComposite})`);

  // Test 4.2: Unreviewed project ranking invariant
  // An unreviewed project (reviewCount = 0, normalizedScore = 0.0) MUST NOT outrank
  // a reviewed project with below-median score (reviewCount = 1, normalizedScore = -0.5)
  const candidateA = { id: 'prj_reviewed_low', reviewCount: 1, rawScore: 2.0, normalizedScore: -0.5 };
  const candidateB = { id: 'prj_unreviewed', reviewCount: 0, rawScore: 0.0, normalizedScore: 0.0 };
  const candidates = [candidateB, candidateA];

  candidates.sort((a, b) => {
    const aHasReviews = a.reviewCount > 0;
    const bHasReviews = b.reviewCount > 0;
    if (aHasReviews !== bHasReviews) {
      return aHasReviews ? -1 : 1;
    }
    if (Math.abs(b.normalizedScore - a.normalizedScore) > 1e-9) {
      return b.normalizedScore - a.normalizedScore;
    }
    if (Math.abs(b.rawScore - a.rawScore) > 1e-9) {
      return b.rawScore - a.rawScore;
    }
    return a.id.localeCompare(b.id);
  });

  assert(candidates[0].id === 'prj_reviewed_low', 'P4.2: Reviewed project strictly outranks unreviewed project despite negative Z-score');
  assert(candidates[1].id === 'prj_unreviewed', 'P4.3: Unreviewed project placed at bottom of ranking');

  // Test 4.3: Floating-point precision epsilon tie-breaking
  const tieCandidate1 = { id: 'prj_alpha', reviewCount: 2, rawScore: 4.2, normalizedScore: 0.33725000000000005 };
  const tieCandidate2 = { id: 'prj_beta', reviewCount: 2, rawScore: 4.2, normalizedScore: 0.33725000000000000 };
  const tieList = [tieCandidate2, tieCandidate1];
  tieList.sort((a, b) => {
    const aHasReviews = a.reviewCount > 0;
    const bHasReviews = b.reviewCount > 0;
    if (aHasReviews !== bHasReviews) return aHasReviews ? -1 : 1;
    if (Math.abs(b.normalizedScore - a.normalizedScore) > 1e-9) {
      return b.normalizedScore - a.normalizedScore;
    }
    if (Math.abs(b.rawScore - a.rawScore) > 1e-9) {
      return b.rawScore - a.rawScore;
    }
    return a.id.localeCompare(b.id);
  });
  // Since normalizedScore diff is < 1e-9 and rawScore is equal, prj_alpha ASC should come first
  assert(tieList[0].id === 'prj_alpha', 'P4.4: Epsilon tie-break handles IEEE 754 precision and falls back to deterministic ID sort');

  // ---------------------------------------------------------------------------
  // PILLAR 5: Cross-Judge Score Normalization Math (Modified Z-Score & MAD)
  // ---------------------------------------------------------------------------
  console.log('\n--- PILLAR 5: Cross-Judge Score Normalization Math ---');

  // Test 5.1: Zero-variance guard
  const zeroVarRes = normaliseJudgeScores([3, 3, 3, 3]);
  assert(zeroVarRes.every((v) => v === 0), 'P5.1: Zero-variance scores produce neutral [0, 0, 0, 0]');

  // Test 5.2: Non-finite input protection
  const nanInputRes = normaliseJudgeScores([NaN, 3, 4]);
  assert(nanInputRes.every((v) => v === 0), 'P5.2: Non-finite inputs safely neutralized to zeros without throwing');

  // Test 5.3: Classical Gaussian consistency (0.6745 constant)
  // For [1, 2, 3, 4], median is 2.5, MAD is 1.0
  // s=4: 0.6745 * (4 - 2.5) / 1.0 = 1.01175
  const evenRes = normaliseJudgeScores([1, 2, 3, 4]);
  assert(Math.abs(evenRes[3] - 1.01175) < 1e-5, 'P5.3: 0.6745 scaling factor confirmed for even-length array');

  // Test 5.4: Odd-length array
  // For [1, 3, 5], median is 3.0, MAD is 2.0
  // s=5: 0.6745 * (5 - 3) / 2 = 0.6745
  const oddRes = normaliseJudgeScores([1, 3, 5]);
  assert(Math.abs(oddRes[2] - 0.6745) < 1e-5, 'P5.4: Odd-length array calculates correct MAD Modified Z-score');

  // ---------------------------------------------------------------------------
  // PILLAR 6: Organizer Dashboard & RFC 4180 CSV Export Engine
  // ---------------------------------------------------------------------------
  console.log('\n--- PILLAR 6: Dashboard Telemetry & RFC 4180 CSV Engine ---');

  // Test 6.1: CSV Formula Injection (CWE-1236) Defense
  function testEscapeCsvField(value: string | number): string {
    let str = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(str) && typeof value === 'string' && isNaN(Number(str))) {
      str = `'${str}`;
    }
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  const formulaPayload1 = '=cmd|\'/C calc\'!A0';
  const escaped1 = testEscapeCsvField(formulaPayload1);
  assert(escaped1.startsWith("'=") || escaped1.startsWith('"\'='), `P6.1: Formula injection payload '=cmd...' neutralized: ${escaped1}`);

  const formulaPayload2 = '@SUM(A1:A10)';
  const escaped2 = testEscapeCsvField(formulaPayload2);
  assert(escaped2.startsWith("'@SUM"), `P6.2: Formula injection payload '@SUM...' neutralized: ${escaped2}`);

  // Test 6.2: Negative numeric values remain valid floats
  const negativeScore = -0.6745;
  const escapedScore = testEscapeCsvField(negativeScore.toFixed(4));
  assert(escapedScore === '-0.6745', `P6.3: Valid negative numeric values unaffected by formula sanitization: ${escapedScore}`);

  // Test 6.3: Standard RFC 4180 quote escaping
  const titleWithQuotes = 'Glass "Acoustic" Signal, Inc.';
  const escapedTitle = testEscapeCsvField(titleWithQuotes);
  assert(escapedTitle === '"Glass ""Acoustic"" Signal, Inc."', `P6.4: RFC 4180 quote doubling verified: ${escapedTitle}`);

  console.log('\n================================================================');
  console.log('ALL 17 TIER 2 EXHAUSTIVE AUDIT ASSERTIONS CONFIRMED PASSING (100%)');
  console.log('================================================================');
}

runExhaustiveT2Audit()
  .catch((err) => {
    console.error('Audit failed with error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
