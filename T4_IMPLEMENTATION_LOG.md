# OmniJudge Tier 4 (T4: Stretch Surface) Engineering Log

**Context:** DogFood 2026 Hackathon Portal  
**Branch / Workspace:** `d:\TP\Hackathon\DogFood`  
**Engineer:** Principal Staff Systems Architect  
**Initial Baseline:**
- 7/7 PASS on `Hack_docs/run.py .dogfood.toml` (T1 + T2).
- 17/17 PASS on `tests/test_t2_exhaustive_audit.ts`.
- 47/47 PASS on `tests/test_phase3_adversarial.py`.
- Hard Rule: Never claim "T4" in `.dogfood.toml` (claimed = ["T1", "T2"]).
- Zero Regressions on T1/T2/T3.

---

## Pillar Implementation Status

| Pillar | Feature | Routes / Modules | Status |
| :--- | :--- | :--- | :--- |
| **Pillar 1** | Embeddable Gallery Widget | `/embed/projects`, `/projects` embed modal, frame headers | COMPLETED (100%) |
| **Pillar 2** | Cryptographic Judge Records & Certs | `/api/judge/certificate`, `/verify`, `/judge` export UI | COMPLETED (16/16 PASS) |
| **Pillar 3** | Real-Time Webhooks Engine | `/api/webhooks`, `src/lib/webhooks.ts`, dispatch hooks, dashboard UI | COMPLETED (6/6 PASS) |
| **Pillar 4** | Bulk Data Import & Export | `GET /api/export.json`, `POST /api/import`, dashboard UI | COMPLETED (5/5 PASS) |
| **Pillar 5** | OpenAPI 3.1 & REST API Explorer | `GET /api/openapi.json`, `/api-docs` interactive explorer UI | COMPLETED (100%) |

---

## Log of Operations
- **Phase 0:** Validated existing baseline: `npm run typecheck`, `npm run lint`, `npm run build`, and `tests/test_t2_exhaustive_audit.ts` passing.
- **Phase 0.1:** Added `WebhookSubscription` model to `prisma/schema.prisma` and applied via `npx prisma db push`. Re-verified client generation and T2 tests.
- **Pillar 1 Complete:**
  - Implemented `/embed/projects` server route with distraction-free layout (`src/app/embed/layout.tsx`).
  - Implemented `EmbedProjectsClient` with live search, 5 category filter pills, glassmorphic project cards, and external repo links.
  - Added CSP `frame-ancestors *` and CORS headers in `next.config.mjs` for seamless iframe embedding.
  - Added "Embed Gallery" modal and copy button on `/projects` with standard iframe snippet.
- **Pillar 2 Complete:**
  - Implemented `src/lib/certificates.ts` with canonical JSON serialization, HMAC-SHA256 signing, and timing-safe base64url verification.
  - Implemented `GET /api/judge/certificate` and `POST /api/judge/certificate` (verifying token & preventing peer IDOR).
  - Built interactive public verification portal `/verify` (`src/app/verify/page.tsx` & `verify-client.tsx`).
  - Added "Verifiable Judge Certificate" modal, verification link copy, and JSON download to `/judge`.
  - Created automated test suite `tests/test_t4_certificates.ts` (16/16 assertions passing).
- **Pillar 3 Complete:**
  - Added asynchronous webhook dispatcher `src/lib/webhooks.ts` with HMAC-SHA256 signatures (`X-OmniJudge-Signature` and `X-OmniJudge-Signature-256`).
  - Built CRUD route `src/app/api/webhooks/route.ts` with secret masking and targeted test ping dispatch.
  - Attached non-blocking triggers to `score.submitted`, `vote.cast`, and `results.unsealed`.
- **Pillar 4 Complete:**
  - Created `GET /api/export.json` providing complete platform state backup with MAD-normalized leaderboard.
  - Created `POST /api/import` with transactional bulk upsert supporting DOGFOOD fixture and export JSON schemas.
- **Pillar 5 Complete:**
  - Created OpenAPI 3.1 specification at `GET /api/openapi.json` covering all platform endpoints and schemas.
  - Built dark-mode interactive API explorer at `/api-docs` (`src/app/api-docs/page.tsx` and `api-docs-client.tsx`).
- **Post-Attempt Review & Fixes:**
  - Fixed webhook test ping dispatch dropping notifications when target subscription events didn't explicitly include `webhook.test`.
  - Fixed certificate verification failing with syntax errors when user pasted full URL or raw JSON envelope.
  - Fixed HTTP 500 error on malformed JSON bodies in `/api/judge/certificate` and `/api/import` (now strictly returning 400 Bad Request).
  - Added `rubricCriteria` alias support to bulk import schema for full export/import interoperability.
  - Added text label to "Download Certificate" button in judge cockpit modal.
  - All test suites passing 100%: 7/7 Dogfood runner, 47/47 adversarial tests, 17/17 T2 audit, 16/16 certificate tests, 11/11 webhook/import tests.
