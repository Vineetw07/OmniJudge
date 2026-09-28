import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('=== CHALLENGER 2 EMPIRICAL VERIFICATION ===');

  // 1. Query TeamMember for user_prt_01
  const tm = await prisma.teamMember.findUnique({
    where: { userId: 'user_prt_01' },
    include: { user: true, team: true },
  });
  console.log('TeamMember for user_prt_01:', tm);

  // 2. Query Project prj_01
  const project = await prisma.project.findUnique({
    where: { id: 'prj_01' },
    include: { team: true },
  });
  console.log('Project prj_01:', {
    id: project?.id,
    title: project?.title,
    teamId: project?.teamId,
    teamName: project?.team?.name,
  });

  // Verify alignment
  const tmMatches = tm?.teamId === 'tm_01';
  const prjMatches = project?.teamId === 'tm_01';
  const ownershipMatches = tm?.teamId === project?.teamId;
  console.log(`user_prt_01 teamId is tm_01: ${tmMatches}`);
  console.log(`prj_01 teamId is tm_01: ${prjMatches}`);
  console.log(`prj_01 belongs to user_prt_01 team: ${ownershipMatches}`);

  // 3. Record all table counts
  const counts = {
    users: await prisma.user.count(),
    sessions: await prisma.session.count(),
    tracks: await prisma.track.count(),
    teams: await prisma.team.count(),
    teamMembers: await prisma.teamMember.count(),
    projects: await prisma.project.count(),
    rubricCriteria: await prisma.rubricCriterion.count(),
    judgeAssignments: await prisma.judgeAssignment.count(),
    scores: await prisma.score.count(),
    auditLogs: await prisma.auditLog.count(),
    events: await prisma.event.count(),
    communityVotes: await prisma.communityVote.count(),
    comments: await prisma.comment.count(),
  };
  console.log('Database Table Counts:', counts);

  // 4. Verify Event evt_01
  const event = await prisma.event.findUnique({
    where: { id: 'evt_01' },
  });
  console.log('Event evt_01:', {
    id: event?.id,
    name: event?.name,
    votingOpen: event?.votingOpen,
    resultsPublic: event?.resultsPublic,
    submissionsClose: event?.submissionsClose,
  });

  if (!tmMatches || !prjMatches || !ownershipMatches) {
    console.error('FAILED: Relationship mapping assertion failed!');
    process.exit(1);
  }

  console.log('SUCCESS: All Challenger 2 preliminary assertions verified.');
}

main()
  .catch((err) => {
    console.error('Fatal error in challenger 2 test:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
