import { normaliseJudgeScores, normaliseAllJudges } from '../src/lib/normalization';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  } else {
    console.log(`PASS: ${msg}`);
  }
}

console.log('=== Section 1: normaliseJudgeScores Mathematical Invariants ===');

// 1. Empty array
const resEmpty = normaliseJudgeScores([]);
assert(Array.isArray(resEmpty) && resEmpty.length === 0, 'Empty array returns []');

// 2. Single element
const resSingle = normaliseJudgeScores([5]);
assert(resSingle.length === 1 && resSingle[0] === 0, 'Single element [5] returns [0]');

// 3. Even-length array [1, 2, 3, 4]
// sorted = [1, 2, 3, 4], mid = 2
// median = (sorted[1] + sorted[2]) / 2 = (2 + 3) / 2 = 2.5
// deviations = [1.5, 0.5, 0.5, 1.5]
// sortedDevs = [0.5, 0.5, 1.5, 1.5], mid = 2
// mad = (sortedDevs[1] + sortedDevs[2]) / 2 = (0.5 + 1.5) / 2 = 1.0
// s=1: 0.6745 * (1 - 2.5) / 1.0 = -1.01175
// s=2: 0.6745 * (2 - 2.5) / 1.0 = -0.33725
// s=3: 0.6745 * (3 - 2.5) / 1.0 = 0.33725
// s=4: 0.6745 * (4 - 2.5) / 1.0 = 1.01175
const resEven = normaliseJudgeScores([1, 2, 3, 4]);
assert(resEven.length === 4, 'Even-length array returns length 4');
assert(Math.abs(resEven[0] - (-1.01175)) < 1e-5, 'Even index 0: -1.01175');
assert(Math.abs(resEven[1] - (-0.33725)) < 1e-5, 'Even index 1: -0.33725');
assert(Math.abs(resEven[2] - 0.33725) < 1e-5, 'Even index 2: 0.33725');
assert(Math.abs(resEven[3] - 1.01175) < 1e-5, 'Even index 3: 1.01175');

// 4. Odd-length array [1, 3, 5]
// sorted = [1, 3, 5], mid = 1
// median = sorted[1] = 3.0
// deviations = [2, 0, 2]
// sortedDevs = [0, 2, 2], mid = 1
// mad = sortedDevs[1] = 2.0
// s=1: 0.6745 * (1 - 3) / 2 = -0.6745
// s=3: 0.6745 * (3 - 3) / 2 = 0.0
// s=5: 0.6745 * (5 - 3) / 2 = 0.6745
const resOdd = normaliseJudgeScores([1, 3, 5]);
assert(resOdd.length === 3, 'Odd-length array returns length 3');
assert(Math.abs(resOdd[0] - (-0.6745)) < 1e-5, 'Odd index 0: -0.6745');
assert(Math.abs(resOdd[1] - 0) < 1e-5, 'Odd index 1: 0.0');
assert(Math.abs(resOdd[2] - 0.6745) < 1e-5, 'Odd index 2: 0.6745');

// 5. Zero-variance guard: [3, 3, 3, 3] (Rafa Okonkwo / jdg_30 case)
const resZeroVar = normaliseJudgeScores([3, 3, 3, 3]);
assert(resZeroVar.length === 4 && resZeroVar.every((v) => v === 0), 'Zero-variance [3, 3, 3, 3] returns [0, 0, 0, 0]');

// 6. Zero-variance guard: all zeros [0, 0, 0]
const resAllZero = normaliseJudgeScores([0, 0, 0]);
assert(resAllZero.length === 3 && resAllZero.every((v) => v === 0), 'All zeros [0, 0, 0] returns [0, 0, 0]');

// 7. Majority identical: [2, 2, 2, 5]
// median = 2, devs = [0, 0, 0, 3], mad = 0
const resMaj = normaliseJudgeScores([2, 2, 2, 5]);
assert(resMaj.length === 4 && resMaj.every((v) => v === 0), 'Majority identical [2, 2, 2, 5] yields [0, 0, 0, 0] (no NaN/crash)');

// 8. Order preservation with unsorted input [4, 1, 3, 2]
const resOrder = normaliseJudgeScores([4, 1, 3, 2]);
assert(Math.abs(resOrder[0] - 1.01175) < 1e-5, 'Order preserved at 0 (original val: 4)');
assert(Math.abs(resOrder[1] - (-1.01175)) < 1e-5, 'Order preserved at 1 (original val: 1)');
assert(Math.abs(resOrder[2] - 0.33725) < 1e-5, 'Order preserved at 2 (original val: 3)');
assert(Math.abs(resOrder[3] - (-0.33725)) < 1e-5, 'Order preserved at 3 (original val: 2)');

// 9. Decimal scores: [2.5, 3.5, 4.0, 4.5]
// sorted = [2.5, 3.5, 4.0, 4.5], mid = 2
// median = (3.5 + 4.0) / 2 = 3.75
// devs = [1.25, 0.25, 0.25, 0.75]
// sortedDevs = [0.25, 0.25, 0.75, 1.25], mid = 2
// mad = (0.25 + 0.75) / 2 = 0.5
// s=2.5: 0.6745 * (2.5 - 3.75) / 0.5 = 0.6745 * -2.5 = -1.68625
const resDec = normaliseJudgeScores([2.5, 3.5, 4.0, 4.5]);
assert(Math.abs(resDec[0] - (-1.68625)) < 1e-5, 'Decimal scores calculation correct');

console.log('\n=== Section 2: normaliseAllJudges Grouping & Mapping Integrity ===');

const judgeRawMap = new Map<string, Map<string, number>>();

const j1 = new Map<string, number>([
  ['prj_01', 1],
  ['prj_02', 2],
  ['prj_03', 3],
  ['prj_04', 4],
]);

const j2 = new Map<string, number>([
  ['prj_02', 3],
  ['prj_03', 3],
  ['prj_05', 3],
]);

const j3 = new Map<string, number>([
  ['prj_10', 5],
]);

judgeRawMap.set('jdg_01', j1);
judgeRawMap.set('jdg_02', j2);
judgeRawMap.set('jdg_03', j3);

const judgeNormMap = normaliseAllJudges(judgeRawMap);

assert(judgeNormMap.size === 3, 'Output has exactly 3 judges');
assert(judgeNormMap.has('jdg_01') && judgeNormMap.has('jdg_02') && judgeNormMap.has('jdg_03'), 'Contains all judge IDs');

// Check j1 project mapping
const j1Norm = judgeNormMap.get('jdg_01')!;
assert(j1Norm.size === 4, 'j1 output has 4 projects');
const j1Keys = Array.from(j1Norm.keys());
assert(j1Keys.join(',') === 'prj_01,prj_02,prj_03,prj_04', 'j1 project IDs exactly match input order and keys');
assert(Math.abs(j1Norm.get('prj_01')! - (-1.01175)) < 1e-5, 'j1 prj_01 normalized score');
assert(Math.abs(j1Norm.get('prj_04')! - 1.01175) < 1e-5, 'j1 prj_04 normalized score');

// Check j2 project mapping (zero-variance)
const j2Norm = judgeNormMap.get('jdg_02')!;
assert(j2Norm.size === 3, 'j2 output has 3 projects');
const j2Keys = Array.from(j2Norm.keys());
assert(j2Keys.join(',') === 'prj_02,prj_03,prj_05', 'j2 project IDs exactly match input keys');
assert(j2Norm.get('prj_02') === 0 && j2Norm.get('prj_03') === 0 && j2Norm.get('prj_05') === 0, 'j2 all normalized scores are 0');

// Check j3 project mapping (single project)
const j3Norm = judgeNormMap.get('jdg_03')!;
assert(j3Norm.size === 1 && j3Norm.get('prj_10') === 0, 'j3 single project normalized to 0');

console.log('\n=== ALL MATHEMATICAL INVARIANTS EMPIRICALLY CONFIRMED ===');
