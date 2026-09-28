# Scope: DOGFOOD 2026 Comprehensive Adversarial Self-Review (Phases 1-3)

## Objective
Lead an exhaustive, rigorous, and adversarial self-review of all deliverables produced across Phases 1 through 3 of the DOGFOOD 2026 Hackathon Portal.

## Feature Inventory & Requirement Matrix
| # | Requirement | Area | Target Artifacts | Verification Method |
|---|-------------|------|------------------|---------------------|
| 1 | R1: Code Quality Audit | Quality & Cleanliness | `src/**/*`, `prisma/**/*` | Static analysis, AST/grep inspection, typecheck verification, code pattern audit |
| 2 | R2: Acceptance Checker Alignment | Compatibility & Spec Conformance | `Hack_docs/run.py`, `.dogfood.toml`, API routes | Exact code path mapping to 7 checks in `run.py`, status code verification |
| 3 | R3: Security & RBAC Audit | Security & Isolation | `src/app/api/**/*`, `src/lib/auth.ts` | Endpoint probe testing, RBAC boundary verification, parameter tampering analysis |
| 4 | R4: MAD Normalization Correctness | Mathematical Soundness | `src/lib/normalization.ts`, `src/app/api/export.csv/route.ts` | Property-based and unit verification of median, MAD, zero-variance, and aggregation |
| 5 | R5: Schema & Seed Integrity | Data Layer Integrity | `prisma/schema.prisma`, `src/lib/seed.ts`, `Hack_docs/fixtures.json` | 11 models validation, token determinism, session longevity, deadline timestamps |
| 6 | Forensic Integrity | Authentic Implementation | Entire codebase | Check for dummy facades, hardcoded outputs, test cheats, bypasses |

## Work Streams & Subagent Roles
1. **Stream 1 (R1 Code Quality)**: `teamwork_preview_explorer` (Code Quality & Static Analysis Specialist)
   - Scope: Inspect all files in `src/` and `prisma/`. Check for empty catch blocks, `@ts-ignore`, `eslint-disable`, unsafe `as` casts, unhandled promises, and crash-site masking via `?.`.
2. **Stream 2 (R2 & R5 Checker Alignment + Schema/Seed)**: `teamwork_preview_explorer` (Spec & Contract Alignment Specialist)
   - Scope: Map all 7 checks in `run.py` to route handlers. Check 5 API-layer 403, Check 7 CSV comma, Check 3 event.submissionsClose DB lookup, `.dogfood.toml` routes and seeded IDs. Verify 11 Prisma models, deterministic tokens, seed idempotency, session expiry.
3. **Stream 3 (R3 Security & RBAC Audit)**: `teamwork_preview_reviewer` (Security & RBAC Boundary Reviewer)
   - Scope: API route authentication guards (401 anonymous, 403 participant, 403 cross-judge peer score leak), `/api/export.csv` organizer guard before DB queries, AuditLog upsert coverage (both create and update paths), parameter tampering defense.
4. **Stream 4 (R4 MAD Normalization & Empirical Stress Testing)**: `teamwork_preview_challenger` (Mathematical & Adversarial Verifier)
   - Scope: Test even-length median, zero-variance judge (jdg_30), `normaliseJudgeScores`, `normaliseAllJudges` ID mapping, CSV export integration, run test suites (`tests/test_phase3_adversarial.py`, `tests/test_phase3_challenger2_full.py`, `Hack_docs/run.py`).
5. **Stream 5 (Forensic Integrity Audit)**: `teamwork_preview_auditor` (Forensic Integrity Auditor)
   - Scope: Run integrity forensics across all deliverables. Ensure no hardcoded test responses, dummy facades, or acceptance test cheats.
6. **Stream 6 (Synthesis)**: Orchestrator
   - Scope: Collate all reports into a comprehensive, publication-grade self-review document.
