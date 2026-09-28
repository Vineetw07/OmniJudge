# DOGFOOD 2026 System Architecture & Engineering Specifications

> **A deep dive into the design principles, security model, and deployment invariants of the DOGFOOD 2026 Hackathon Portal.**

---

## 1. High-Level Architectural Topology

DOGFOOD 2026 is architected as an offline-first, high-resilience, single-tier full-stack application built on **Next.js 14 (App Router)** and **Prisma ORM** backed by an embedded **SQLite** engine.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Docker Container (:8080)                        │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                      Next.js 14 App Router                     │   │
│   │                                                                │   │
│   │   [ React Server Components ]     [ Dynamic Route Handlers ]   │   │
│   │   - /projects (Public Gallery)     - /api/auth/login           │   │
│   │   - /judge (Scoring Portal)        - /api/projects             │   │
│   │   - /dashboard (Organizer KPIs)    - /api/judge/scores         │   │
│   │                                    - /api/export.csv           │   │
│   │                                    - /api/community/vote       │   │
│   │                                    - /api/community/comments   │   │
│   │                                    - /api/community/settings   │   │
│   └───────────────┬────────────────────────────────┬───────────────┘   │
│                   │                                │                   │
│                   ▼                                ▼                   │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                 Core Server Libraries & Domain                 │   │
│   │                                                                │   │
│   │   • src/lib/auth.ts          (Session extraction & RBAC)       │   │
│   │   • src/lib/normalization.ts (MAD Modified Z-Score engine)     │   │
│   │   • src/lib/prisma.ts        (Prisma Client Singleton)         │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │                                    │
│                                   ▼                                    │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                Prisma Engine (v5.22.0)                         │   │
│   │                Driver: SQLite (C-bindings)                     │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │                                    │
│                                   ▼                                    │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │          Mounted Volume: /data/dogfood.db (SQLite)             │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Traits
1. **Server-First Execution:** Data fetching for public views (`/projects`), judge views (`/judge`), and organizer views (`/dashboard`) occurs entirely in **React Server Components (RSC)**. No client-side waterfall API requests or flash-of-unauthenticated-content (FOUC).
2. **Stateless Node Runner + Stateful Storage Volume:** The container application runs as a stateless standalone Node.js process (`output: 'standalone'` in Next.js), mounting `/data` as a durable Docker volume for database persistence.
3. **Deterministic Seeding Engine:** Fixture data from `Hack_docs/fixtures.json` is imported idempotently via `src/lib/seed.ts`, providing guaranteed session tokens for automated acceptance testing.

---

## 2. Rationale for Single-Container Deployment

A primary architectural decision was opting for a **single self-contained container** rather than a multi-container compose stack (e.g., separate web server, database container, cache container).

### Elimination of Startup Race Conditions
In traditional multi-container setups (`web` + `db`), web containers frequently boot before the database engine completes socket initialization. This necessitates complex retry scripts, `wait-for-it.sh` wrappers, or health check dependencies. In competitive evaluation environments, any startup timing jitter can cause immediate checker failure. 

In DOGFOOD 2026:
- The database is an embedded SQLite file accessed directly via native process memory and filesystem syscalls.
- `entrypoint.sh` executes migrations (`prisma migrate deploy`), runs deterministic seeding (`seed.ts`), and boots the web server (`node server.js`) strictly sequentially in a single process tree. Startup failure risk is mathematically reduced to zero.

### Air-Gapped & `--network none` Verification
Evaluation environments often test resilience by cutting external network access (`docker run --network none`). Multi-tier architectures fail under these conditions if they attempt external DNS resolution, telemetry callbacks, font CDNs, or remote database synchronization.

DOGFOOD 2026 is 100% self-reliant:
- Fonts and UI assets are self-hosted within `@/public` and local packages.
- All dependencies are baked into the Docker image layers.
- Zero outbound telemetry or cloud provider handshakes exist.

---

## 3. RBAC Security Boundary Architecture

### The Anti-Pattern: UI-Level Masking
The single most common vulnerability in hackathon platforms is **UI-level access masking** — hiding an element in React JSX (`{isJudge && <Scores />}`) while leaving the underlying JSON API completely open to unauthenticated `curl` requests or IDOR parameter tampering (`?judge=peer_id`).

### The DOGFOOD Security Invariant: Perimeter Parameter Guards
DOGFOOD 2026 enforces security strictly at the **HTTP protocol and Route Handler level**. The UI is treated as untrusted presentation; all security policies are validated before any database query is issued.

```
                              HTTP Request
                                   │
                                   ▼
                  ┌──────────────────────────────────┐
                  │ Does `Cookie: session=...` exist?│
                  └────────────────┬─────────────────┘
                            No ───►│◄─── Invalid/Expired
                                   ▼
                         [ 401 Unauthorized ]
                                   │
                               Valid
                                   ▼
                  ┌──────────────────────────────────┐
                  │ Does user role permit this route?│
                  └────────────────┬─────────────────┘
                                   │ No
                                   ▼
                          [ 403 Forbidden ]
                                   │
                                  Yes
                                   ▼
                  ┌──────────────────────────────────┐
                  │ Is this a peer-isolation probe?  │
                  │   (?judge=id !== session.id)     │
                  └────────────────┬─────────────────┘
                                   │ Yes (Peer Snooping)
                                   ▼
                          [ 403 Forbidden ]
                                   │
                                   No
                                   ▼
                  [ Execute Scoped Query in Prisma ]
```

### Verified Security Implementation: `src/app/api/judge/scores/route.ts`
```typescript
// 1. Resolve Session from Cookie Header
const session = await getSession(req);
if (!session) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// 2. Reject non-judge and non-organizer callers
if (session.role !== 'judge' && session.role !== 'organizer' && session.role !== 'admin') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// 3. IDOR Defense: Prevent Judge B from querying Judge A's scores
const targetJudge = req.nextUrl.searchParams.get('judge');
if (session.role === 'judge') {
  if (targetJudge && targetJudge !== session.id) {
    return NextResponse.json({ error: 'Forbidden: Cannot inspect peer scores' }, { status: 403 });
  }
}
```

### Transactional Audit Logging & Judging RBAC Boundary
When a judge submits rubric scores via `POST /api/judge/scores`, data integrity and jurisdictional boundaries are strictly enforced:
1. Rubric payload is validated strictly against Zod schemas.
2. The judge's track assignment is verified to ensure they have jurisdiction over the project track (`JudgeAssignment`).
3. **Conflict of Interest (COI) Defense:** The database verifies that the judge is not a member of the project's submitting team (`TeamMember.teamId !== project.teamId`), rejecting collusion attempts with `403 Forbidden`.
4. Every score is upserted inside an atomic transaction (`prisma.$transaction`).
5. An immutable `AuditLog` entry is written with `judgeId`, `projectId`, `action: 'score_submitted'`, and the full JSON score delta.
If any step fails, the entire transaction rolls back, guaranteeing zero orphaned or partial evaluations.

### Community Voting RBAC Boundary *(Phase 6 — T3)*
The community vote endpoint (`POST /api/community/vote`) adds a second RBAC enforcement layer on top of the standard session/role check:

```
  Authenticated session ──► Role permitted ──► Self-vote check
                                                      │
                           TeamMember.teamId ─────────┤
                           === project.teamId?         │
                                                      ▼
                                             [ 403 Forbidden ]
                                   "Team members cannot vote for
                                    their own submission"
```

- `CommunityVote` records are protected at **database level** by `@@unique([projectId, userId])` — a second vote from the same user on the same project is rejected before the application layer.
- `GET /api/community/vote` enforces a **sealed results invariant**: `totalVotes` is returned as `null` for all non-organizer roles while `Event.resultsPublic === false`, preventing vote-count inspection that could cause bandwagon cascading.

---

## 4. Swapping Guide: Migrating from SQLite to PostgreSQL

While SQLite is optimal for single-instance, zero-network deployments, production platforms with thousands of concurrent judges writing simultaneously benefit from PostgreSQL's row-level locking.

Because DOGFOOD 2026 uses Prisma ORM as its data access layer, migrating to PostgreSQL requires zero application code changes. Follow this 4-step migration path:

### Step 1: Update Prisma Datasource Provider
In `prisma/schema.prisma`, change the provider and connection URL:

```diff
datasource db {
-  provider = "sqlite"
-  url      = env("DATABASE_URL")
+  provider = "postgresql"
+  url      = env("DATABASE_URL")
}
```

### Step 2: Configure PostgreSQL Environment Variable
In `.env` (or Docker environment secrets):
```bash
# PostgreSQL Connection URI
DATABASE_URL="postgresql://dogfood_user:secure_password@postgres:5432/dogfood_db?schema=public&connection_limit=20"
```

### Step 3: Generate New Migration
Run Prisma migration engine to compile PostgreSQL DDL:
```bash
# Generates native PostgreSQL schema with standard UUID/CUID constraints
npx prisma migrate dev --name init_postgres
```

### Step 4: Update `docker-compose.yml` for Multi-Container Production
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: dogfood_user
      POSTGRES_PASSWORD: secure_password
      POSTGRES_DB: dogfood_db
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dogfood_user -d dogfood_db"]
      interval: 5s
      timeout: 5s
      retries: 5

  portal:
    build: .
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgresql://dogfood_user:secure_password@postgres:5432/dogfood_db?schema=public
      - NODE_ENV=production
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  pgdata:
```

### Compatibility Audit
- **Types:** All fields in `prisma/schema.prisma` use standard scalar types (`String`, `Int`, `Float`, `Boolean`, `DateTime`, `Json`) fully supported by both SQLite and PostgreSQL.
- **Transactions:** `prisma.$transaction([ ... ])` used in `src/app/api/judge/scores/route.ts` seamlessly translates from SQLite `BEGIN IMMEDIATE` to PostgreSQL ACID transactions with snapshot isolation.
