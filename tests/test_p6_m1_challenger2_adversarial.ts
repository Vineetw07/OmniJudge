import { prisma } from '../src/lib/prisma';
import { execSync } from 'child_process';

async function testAdversarial() {
  console.log('=== CHALLENGER 2 ADVERSARIAL TEST: Lifecycle Flag Persistence Across Seed ===');

  // Step 1: Set votingOpen = false and resultsPublic = true
  await prisma.event.update({
    where: { id: 'evt_01' },
    data: {
      votingOpen: false,
      resultsPublic: true,
    },
  });

  const modified = await prisma.event.findUnique({ where: { id: 'evt_01' } });
  console.log('Modified Event state:', {
    votingOpen: modified?.votingOpen,
    resultsPublic: modified?.resultsPublic,
  });

  // Step 2: Run npm run seed
  console.log('Running npm run seed while flags are toggled...');
  execSync('npm run seed', { stdio: 'pipe' });

  // Step 3: Check if flags were preserved
  const afterSeed = await prisma.event.findUnique({ where: { id: 'evt_01' } });
  console.log('Event state after seed:', {
    votingOpen: afterSeed?.votingOpen,
    resultsPublic: afterSeed?.resultsPublic,
  });

  const preserved = afterSeed?.votingOpen === false && afterSeed?.resultsPublic === true;
  console.log(`Organizer state preserved across seed: ${preserved}`);

  // Step 4: Restore pristine state (votingOpen = true, resultsPublic = false)
  await prisma.event.update({
    where: { id: 'evt_01' },
    data: {
      votingOpen: true,
      resultsPublic: false,
    },
  });

  const restored = await prisma.event.findUnique({ where: { id: 'evt_01' } });
  console.log('Restored Event state:', {
    votingOpen: restored?.votingOpen,
    resultsPublic: restored?.resultsPublic,
  });

  if (!preserved) {
    throw new Error('FAILURE: Seed script overwrote organizer lifecycle flags!');
  }

  console.log('SUCCESS: Seed script safely respects existing Event lifecycle toggles.');
}

testAdversarial()
  .catch((err) => {
    console.error('Adversarial test error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
