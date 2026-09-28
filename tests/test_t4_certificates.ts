import {
  toCanonicalJson,
  signJudgePayload,
  createCertificateToken,
  verifyCertificateToken,
  CanonicalJudgePayload,
} from '../src/lib/certificates';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`[PASS] ${message}`);
}

async function runCertificateSuite() {
  console.log('================================================================');
  console.log('PILLAR 2 VERIFICATION: CRYPTOGRAPHIC JUDGE CERTIFICATES');
  console.log('================================================================\n');

  const samplePayload: CanonicalJudgePayload = {
    judgeId: 'user_jdg_a_01',
    judgeName: 'Ada Okonkwo',
    tracks: ['Developer Tools'],
    reviewsCompleted: 12,
    event: 'Sample Hack 2026',
    issuedAt: '2026-09-28T18:00:00.000Z',
  };

  // Test 1: Canonical JSON deterministic serialization
  const canonical = toCanonicalJson(samplePayload);
  assert(canonical.includes('"event":"Sample Hack 2026"'), 'P2.1: Canonical JSON contains event');
  assert(canonical.includes('"reviewsCompleted":12'), 'P2.2: Canonical JSON contains reviewsCompleted');

  // Test 2: Signature generation
  const signature = signJudgePayload(samplePayload);
  assert(typeof signature === 'string' && signature.length === 64, 'P2.3: HMAC-SHA256 produces 64-char hex string');

  // Test 3: Token creation and verification
  const token = createCertificateToken(samplePayload);
  assert(typeof token === 'string' && token.length > 20, 'P2.4: URL-safe Base64 token created');

  const verification = verifyCertificateToken(token);
  assert(verification.isValid === true, 'P2.5: Fresh token verifies as valid');
  assert(verification.payload?.judgeName === 'Ada Okonkwo', 'P2.6: Decoded payload matches judgeName');
  assert(verification.payload?.reviewsCompleted === 12, 'P2.7: Decoded payload matches reviewsCompleted');
  assert(verification.signature === signature, 'P2.8: Verified signature matches generated signature');

  // Test 4: Tampering with reviews completed (grade inflation forgery)
  const decodedRaw = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
  const tamperedInflation = {
    ...decodedRaw,
    payload: { ...decodedRaw.payload, reviewsCompleted: 99 },
  };
  const tamperedTokenInflation = Buffer.from(JSON.stringify(tamperedInflation)).toString('base64url');
  const verifyInflation = verifyCertificateToken(tamperedTokenInflation);
  assert(verifyInflation.isValid === false, 'P2.9: Tampered reviewsCompleted fails cryptographic verification');
  assert(Boolean(verifyInflation.error?.includes('mismatch')), 'P2.10: Signature mismatch error reported');

  // Test 5: Tampering with judge identity (impersonation forgery)
  const tamperedImpersonation = {
    ...decodedRaw,
    payload: { ...decodedRaw.payload, judgeName: 'Attacker Hack' },
  };
  const tamperedTokenImpersonation = Buffer.from(JSON.stringify(tamperedImpersonation)).toString('base64url');
  const verifyImpersonation = verifyCertificateToken(tamperedTokenImpersonation);
  assert(verifyImpersonation.isValid === false, 'P2.11: Tampered judgeName fails cryptographic verification');

  // Test 6: Corrupted token string
  const corrupted = verifyCertificateToken('invalid-garbage-token');
  assert(corrupted.isValid === false, 'P2.12: Malformed/garbage token safely handled without crashing');

  // Test 7: Full URL verification (?record=...)
  const fullUrl = `http://localhost:8080/verify?record=${token}`;
  const verifyUrl = verifyCertificateToken(fullUrl);
  assert(verifyUrl.isValid === true && verifyUrl.payload?.judgeId === 'user_jdg_a_01', 'P2.13: Full verification URL parsed and verified');

  // Test 8: Raw JSON envelope verification
  const rawJsonEnvelope = JSON.stringify({ payload: samplePayload, signature });
  const verifyRawJson = verifyCertificateToken(rawJsonEnvelope);
  assert(verifyRawJson.isValid === true && verifyRawJson.signature === signature, 'P2.14: Raw JSON envelope verified without base64 decoding');

  // Test 9: Bare 64-char signature detection
  const verifyBareSig = verifyCertificateToken(signature);
  assert(verifyBareSig.isValid === false && Boolean(verifyBareSig.error?.includes('without its evaluation payload')), 'P2.15: Bare 64-char hex signature cleanly diagnosed');

  // Test 10: Negative reviewsCompleted schema defense
  const invalidNegativePayload = { ...samplePayload, reviewsCompleted: -1 };
  const tokenNegative = createCertificateToken(invalidNegativePayload);
  const verifyNegative = verifyCertificateToken(tokenNegative);
  assert(verifyNegative.isValid === false, 'P2.16: Negative reviewsCompleted rejected by schema guard');

  console.log('\n================================================================');
  console.log('ALL 16 CRYPTOGRAPHIC CERTIFICATE AUDIT ASSERTIONS PASSING (100%)');
  console.log('================================================================');
}

runCertificateSuite().catch((err) => {
  console.error(err);
  process.exit(1);
});
