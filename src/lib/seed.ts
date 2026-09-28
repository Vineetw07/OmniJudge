import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Deterministic session tokens — same every run, hardcoded for .dogfood.toml
// ---------------------------------------------------------------------------
const TEST_USERS = [
  {
    id: 'user_org_01',
    email: 'organizer@dogfood.dev',
    name: 'Organizer',
    role: 'organizer',
    token: 'org_seed_token_2026',
  },
  {
    id: 'user_jdg_a_01',
    email: 'judge_a@dogfood.dev',
    name: 'Judge Alpha',
    role: 'judge',
    token: 'jdg_a_seed_token_2026',
  },
  {
    id: 'user_jdg_b_01',
    email: 'judge_b@dogfood.dev',
    name: 'Judge Beta',
    role: 'judge',
    token: 'jdg_b_seed_token_2026',
  },
  {
    id: 'user_prt_01',
    email: 'participant@dogfood.dev',
    name: 'Participant',
    role: 'participant',
    token: 'prt_seed_token_2026',
  },
] as const;

// Default rubric criteria
const RUBRIC_CRITERIA = [
  { name: 'functionality', weight: 1.5, maxScore: 5 },
  { name: 'quality', weight: 1.0, maxScore: 5 },
  { name: 'creativity', weight: 1.0, maxScore: 5 },
  { name: 'presentation', weight: 0.5, maxScore: 5 },
];

async function main() {
  // ---------------------------------------------------------------------------
  // Load fixtures.json
  // ---------------------------------------------------------------------------
  const fixturePaths = [
    path.join(process.cwd(), 'Hack_docs', 'fixtures.json'),
    path.join(process.cwd(), 'fixtures.json'),
    path.join(__dirname, '../../Hack_docs/fixtures.json'),
  ];

  let fixturesRaw: string | null = null;
  for (const p of fixturePaths) {
    if (fs.existsSync(p)) {
      fixturesRaw = fs.readFileSync(p, 'utf-8');
      break;
    }
  }
  if (!fixturesRaw) throw new Error('fixtures.json not found. Checked: ' + fixturePaths.join(', '));

  const fixtures = JSON.parse(fixturesRaw);

  // ---------------------------------------------------------------------------
  // 1. Event
  // ---------------------------------------------------------------------------
  await prisma.event.upsert({
    where: { id: fixtures.event.id },
    update: {
      name: fixtures.event.name,
      submissionsClose: new Date(fixtures.event.submissions_close),
    },
    create: {
      id: fixtures.event.id,
      name: fixtures.event.name,
      submissionsClose: new Date(fixtures.event.submissions_close),
      votingOpen: true,
      resultsPublic: false,
    },
  });

  // ---------------------------------------------------------------------------
  // 2. Tracks
  // ---------------------------------------------------------------------------
  for (const track of fixtures.tracks) {
    await prisma.track.upsert({
      where: { id: track.id },
      update: { name: track.name },
      create: { id: track.id, name: track.name, eventId: fixtures.event.id },
    });
  }

  // ---------------------------------------------------------------------------
  // 3. Teams
  // ---------------------------------------------------------------------------
  for (const team of fixtures.teams) {
    await prisma.team.upsert({
      where: { id: team.id },
      update: { name: team.name },
      create: { id: team.id, name: team.name },
    });
  }

  // ---------------------------------------------------------------------------
  // 4. Projects
  // ---------------------------------------------------------------------------
  for (const project of fixtures.projects) {
    await prisma.project.upsert({
      where: { id: project.id },
      update: {
        title: project.title,
        summary: project.summary,
        repoUrl: project.repo_url,
        submittedAt: new Date(project.submitted_at),
      },
      create: {
        id: project.id,
        teamId: project.team,
        trackId: project.track,
        eventId: fixtures.event.id,
        title: project.title,
        summary: project.summary,
        repoUrl: project.repo_url,
        submittedAt: new Date(project.submitted_at),
        isDraft: false,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 5. Judges → Users + JudgeAssignments
  // ---------------------------------------------------------------------------
  for (const judge of fixtures.judges) {
    await prisma.user.upsert({
      where: { id: judge.id },
      update: { name: judge.name, email: judge.email },
      create: {
        id: judge.id,
        email: judge.email,
        name: judge.name,
        role: 'judge',
      },
    });

    for (const trackId of judge.tracks) {
      // upsert JudgeAssignment by looking for existing record
      const existing = await prisma.judgeAssignment.findFirst({
        where: { userId: judge.id, trackId },
      });
      if (!existing) {
        await prisma.judgeAssignment.create({
          data: { userId: judge.id, trackId },
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Rubric criteria
  // ---------------------------------------------------------------------------
  const criteriaMap = new Map<string, string>(); // name → id
  for (const crit of RUBRIC_CRITERIA) {
    const existing = await prisma.rubricCriterion.findFirst({
      where: { name: crit.name },
    });
    const record = existing
      ? await prisma.rubricCriterion.update({
          where: { id: existing.id },
          data: { weight: crit.weight, maxScore: crit.maxScore },
        })
      : await prisma.rubricCriterion.create({ data: crit });
    criteriaMap.set(crit.name, record.id);
  }

  // ---------------------------------------------------------------------------
  // 7. Scores from fixtures
  // ---------------------------------------------------------------------------
  for (const scoreEntry of fixtures.scores) {
    for (const [criterionName, value] of Object.entries(scoreEntry.criteria)) {
      const criterionId = criteriaMap.get(criterionName);
      if (!criterionId) continue; // unknown criterion — skip gracefully

      const existing = await prisma.score.findFirst({
        where: {
          judgeId: scoreEntry.judge,
          projectId: scoreEntry.project,
          criterionId,
        },
      });

      if (!existing) {
        await prisma.score.create({
          data: {
            judgeId: scoreEntry.judge,
            projectId: scoreEntry.project,
            criterionId,
            value: value as number,
            comment: scoreEntry.comment ?? '',
          },
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Test users + sessions (deterministic tokens — same every run)
  // ---------------------------------------------------------------------------
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year from now

  for (const u of TEST_USERS) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: { name: u.name, role: u.role },
      create: { id: u.id, email: u.email, name: u.name, role: u.role },
    });

    await prisma.session.upsert({
      where: { id: u.token },
      update: { expiresAt },
      create: { id: u.token, userId: u.id, expiresAt },
    });
  }

  // Assign test judges to tracks for checker compatibility
  const judgeAAssignment = await prisma.judgeAssignment.findFirst({
    where: { userId: 'user_jdg_a_01', trackId: 'trk_01' },
  });
  if (!judgeAAssignment) {
    await prisma.judgeAssignment.create({
      data: { userId: 'user_jdg_a_01', trackId: 'trk_01' },
    });
  }

  const judgeBAssignment = await prisma.judgeAssignment.findFirst({
    where: { userId: 'user_jdg_b_01', trackId: 'trk_02' },
  });
  if (!judgeBAssignment) {
    await prisma.judgeAssignment.create({
      data: { userId: 'user_jdg_b_01', trackId: 'trk_02' },
    });
  }

  // Assign participant to tm_01 for deterministic self-vote defense testing
  await prisma.teamMember.upsert({
    where: { userId: 'user_prt_01' },
    update: { teamId: 'tm_01' },
    create: { userId: 'user_prt_01', teamId: 'tm_01' },
  });

  // ---------------------------------------------------------------------------
  // 9. Print session tokens (user copies these into .dogfood.toml)
  // ---------------------------------------------------------------------------
  console.log('seeded. test logins:');
  console.log('  organizer    Cookie: session=org_seed_token_2026');
  console.log('  judge_a      Cookie: session=jdg_a_seed_token_2026');
  console.log('  judge_b      Cookie: session=jdg_b_seed_token_2026');
  console.log('  participant  Cookie: session=prt_seed_token_2026');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
