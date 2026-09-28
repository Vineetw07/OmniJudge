import { prisma } from '../src/lib/prisma';
import { Prisma } from '@prisma/client';

async function testFK() {
  console.log('=== CHALLENGER 2 ADVERSARIAL TEST: Foreign Key Integrity ===');

  let invalidProjectRejected = false;
  try {
    await prisma.communityVote.create({
      data: {
        projectId: 'non_existent_project_99999',
        userId: 'user_prt_01',
      },
    });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      console.log('Prisma caught invalid projectId foreign key error code:', err.code);
      // P2003: Foreign key constraint failed
      invalidProjectRejected = err.code === 'P2003';
    } else {
      console.log('Caught other error:', err);
    }
  }

  let invalidUserRejected = false;
  try {
    await prisma.communityVote.create({
      data: {
        projectId: 'prj_01',
        userId: 'non_existent_user_99999',
      },
    });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      console.log('Prisma caught invalid userId foreign key error code:', err.code);
      invalidUserRejected = err.code === 'P2003';
    } else {
      console.log('Caught other error:', err);
    }
  }

  console.log(`Invalid projectId rejected with P2003: ${invalidProjectRejected}`);
  console.log(`Invalid userId rejected with P2003: ${invalidUserRejected}`);

  if (!invalidProjectRejected || !invalidUserRejected) {
    throw new Error('FAILURE: Foreign key constraints not properly enforced!');
  }

  console.log('SUCCESS: Foreign key constraints strictly enforced by database engine.');
}

testFK()
  .catch((err) => {
    console.error('FK test error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
