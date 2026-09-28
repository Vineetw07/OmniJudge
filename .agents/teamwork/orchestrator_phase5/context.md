# Phase 5 Context & Invariants

## Invariants
1. **Checker Green Guarantee**: `python Hack_docs/run.py .dogfood.toml` must produce 7/7 PASS.
2. **Server-Rendered HTML Body Invariant**: `/projects` (`src/app/projects/page.tsx`) MUST remain an async Server Component that queries Prisma directly and renders fixture project titles ("Glass Signal", "Small Meadow", "Deep Compass") in initial HTML body.
3. **RBAC Isolation**: Parameter guards on `/api/judge/scores` and `/api/export.csv` must remain intact.
4. **Zero-Network Invariant**: No external fonts or CDNs. Local fonts (`Geist Sans`, `Geist Mono`) only.
5. **PowerShell 5.1 Syntax**: Use `;` or separate commands. Never use `&&` or `||`.

## Reference Paths
- Authoritative Request: `d:\TP\Hackathon\DogFood\.agents\teamwork\ORIGINAL_REQUEST.md` (## 2026-09-28T10:45:46Z)
- Acceptance Checker: `d:\TP\Hackathon\DogFood\Hack_docs\run.py`
- Configuration: `d:\TP\Hackathon\DogFood\.dogfood.toml`
- Progress Ledger: `d:\TP\Hackathon\DogFood\PROGRESS.md`
- Frontend Rules: `C:\Users\ASUS\.gemini\frontend-rules.md`
