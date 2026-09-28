import { prisma } from '../../../src/lib/prisma';

async function main() {
  const userCount = await prisma.user.count();
  const projectCount = await prisma.project.count();
  const scoreCount = await prisma.score.count();
  const auditLogCount = await prisma.auditLog.count();
  const event = await prisma.event.findFirst();
  const cvCount = await prisma.communityVote.count();
  const commentCount = await prisma.comment.count();
  const tm = await prisma.teamMember.findUnique({
    where: { userId: 'user_prt_01' },
    include: { user: true, team: true },
  });

  console.log(JSON.stringify({
    userCount,
    projectCount,
    scoreCount,
    auditLogCount,
    event,
    cvCount,
    commentCount,
    teamMember_user_prt_01: tm,
  }, null, 2));
}

main()
  .catch((e) => {
    console.error('Error in main:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
