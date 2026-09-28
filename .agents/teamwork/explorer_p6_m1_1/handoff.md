# Phase 6 Milestone 1 (M1) Schema & DB Architecture Handoff Report

**Summary:** This report provides the exact, production-ready Prisma schema specifications for Phase 6 (T3 Community Voting, Project Comments, and Voting Lifecycle Flags), proves that `npx prisma db push` applies these additions with zero data loss to seeded SQLite records, and specifies the migration implementation steps for Milestone 1.

---

## 1. Observation

### 1.1 Existing Prisma Schema & Models
Inspection of `d:\TP\Hackathon\DogFood\prisma\schema.prisma` revealed 11 models currently defined:

1. **`User`** (`schema.prisma:13-25`):
   ```prisma
   model User {
     id        String   @id @default(cuid())
     email     String   @unique
     name      String
     role      String   // "visitor" | "participant" | "judge" | "organizer" | "admin"
     createdAt DateTime @default(now())

     sessions         Session[]
     teamMember       TeamMember?
     judgeAssignments JudgeAssignment[]
     scores           Score[]
     auditLogs        AuditLog[]
   }
   ```
2. **`Event`** (`schema.prisma:35-43`):
   ```prisma
   model Event {
     id               String   @id
     name             String
     submissionsClose DateTime
     createdAt        DateTime @default(now())

     tracks   Track[]
     projects Project[]
   }
   ```
3. **`Team`** (`schema.prisma:55-61`):
   ```prisma
   model Team {
     id       String       @id
     name     String

     members  TeamMember[]
     projects Project[]
   }
   ```
4. **`TeamMember`** (`schema.prisma:63-69`):
   ```prisma
   model TeamMember {
     id     String @id @default(cuid())
     userId String @unique
     teamId String
     user   User   @relation(fields: [userId], references: [id])
     team   Team   @relation(fields: [teamId], references: [id])
   }
   ```
5. **`Project`** (`schema.prisma:71-86`):
   ```prisma
   model Project {
     id          String   @id
     teamId      String
     trackId     String
     eventId     String
     title       String
     summary     String
     repoUrl     String
     submittedAt DateTime
     isDraft     Boolean  @default(false)

     team   Team    @relation(fields: [teamId], references: [id])
     track  Track   @relation(fields: [trackId], references: [id])
     event  Event   @relation(fields: [eventId], references: [id])
     scores Score[]
   }
   ```
6. **`AuditLog`** (`schema.prisma:119-127`):
   ```prisma
   model AuditLog {
     id        String   @id @default(cuid())
     userId    String
     action    String
     payload   String   @default("{}")
     createdAt DateTime @default(now())

     user User @relation(fields: [userId], references: [id])
   }
   ```

### 1.2 SystemSettings Status
- Full-text search across `d:\TP\Hackathon\DogFood\src` and `d:\TP\Hackathon\DogFood\prisma` for `SystemSettings` returned **zero matches**.
- In the active SQLite database, exactly 1 `Event` record exists:
  `{"id":"evt_01","name":"Sample Hack 2026","submissionsClose":"2026-03-01T18:00:00.000Z","createdAt":"2026-09-27T08:21:22.382Z"}`
- `SCOPE.md` (line 22) specifies:
  `Prisma Schema Migration | CommunityVote, Comment, Event.votingOpen, Event.resultsPublic | M1 | R1`

### 1.3 Active SQLite Database File Location & Baseline State
- `.env` specifies `DATABASE_URL="file:./prisma/dogfood.db"`.
- Because Prisma resolves SQLite relative paths relative to `prisma/schema.prisma`, the active database file is located at `d:\TP\Hackathon\DogFood\prisma\prisma\dogfood.db` (file size: 192,512 bytes). The root `prisma\dogfood.db` is 0 bytes.
- Record counts in `prisma/prisma/dogfood.db`:
  - `AuditLog`: 52
  - `Event`: 1
  - `JudgeAssignment`: 41
  - `Project`: 41
  - `RubricCriterion`: 4
  - `Score`: 293
  - `Session`: 5
  - `Team`: 40
  - `TeamMember`: 0
  - `Track`: 8
  - `User`: 34
- Baseline test `python Hack_docs/run.py .dogfood.toml` executed with output:
  `claimed T1 T2, verified T1 T2` (7/7 checks PASS).

### 1.4 Empirical Migration & Data Preservation Test
A test database `test_verify.db` was created as an exact byte clone of `prisma/prisma/dogfood.db`. A test schema containing `CommunityVote`, `Comment`, and `Event` with `votingOpen` and `resultsPublic` was pushed via `npx prisma db push --schema=test_verify_schema.prisma --skip-generate`.
Result:
```
Your database is now in sync with your Prisma schema. Done in 41ms
```
Database inspection of `test_verify.db` confirmed:
- `AuditLog`: 52 (identical)
- `Comment`: 0 (new table created)
- `CommunityVote`: 0 (new table created)
- `Event`: 1 (identical row preserved, with `votingOpen: 1` and `resultsPublic: 0`)
- `JudgeAssignment`: 41 (identical)
- `Project`: 41 (identical)
- `RubricCriterion`: 4 (identical)
- `Score`: 293 (identical)
- `Session`: 5 (identical)
- `Team`: 40 (identical)
- `TeamMember`: 0 (identical)
- `Track`: 8 (identical)
- `User`: 34 (identical)
- Zero data loss, zero table drops, zero reset warnings.

---

## 2. Logic Chain

1. **Event vs SystemSettings Architecture Decision**:
   - *Observation*: `Event` (`schema.prisma:35-43`) already manages the hackathon phase lifecycle via `submissionsClose`. `SCOPE.md:22` explicitly declares `Event.votingOpen` and `Event.resultsPublic`.
   - *Logic*: Creating a separate `SystemSettings` table would introduce an artificial 1-row table alongside `Event`, splitting hackathon phase controls into two distinct tables. Adding `votingOpen: Boolean @default(true)` and `resultsPublic: Boolean @default(false)` directly to `Event` maintains a unified lifecycle entity (`Event.submissionsClose`, `Event.votingOpen`, `Event.resultsPublic`).
   - *Inference*: Existing queries like `prisma.event.findFirst()` in route handlers (such as `POST /api/projects` and new `/api/community/*` routes) will immediately have access to voting flags without extra queries or foreign joins.

2. **CommunityVote Duplicate & Self-Voting Constraints**:
   - *Observation*: R1 and R2 require database-level duplicate prevention and self-voting blocks.
   - *Logic*: Adding `@@unique([projectId, userId])` on `CommunityVote` provides engine-level enforcement that no user can cast duplicate votes on the same project, even in high-concurrency race conditions.
   - *Logic*: For self-voting, `Project.teamId` maps to `Team.id`, and `TeamMember.teamId` maps a user to their team. At the API boundary (`POST /api/community/vote`), querying `prisma.teamMember.findUnique({ where: { userId } })` and comparing `member.teamId === project.teamId` reliably catches team self-votes.

3. **Comment Model Integrity & Moderation**:
   - *Observation*: R1 requires `authorName`, `content`, `createdAt`, `isFlagged` (default false), and relations to `Project` and `User`.
   - *Logic*: Storing `authorName` directly on `Comment` avoids N+1 queries when rendering the comment stream on cards, while the relational `userId` foreign key retains strict referential integrity with `User`. Adding `isFlagged Boolean @default(false)` satisfies the anti-abuse moderation requirement.
   - *Logic*: Adding `@@index([projectId])` and `@@index([userId])` ensures sub-millisecond query retrieval as comment volumes scale.

4. **Referential Integrity & Cascading Deletes**:
   - *Observation*: Projects and Users may be cleaned up or reset during development or administrative maintenance.
   - *Logic*: Setting `onDelete: Cascade` on both `CommunityVote` and `Comment` foreign keys (`project Project @relation(..., onDelete: Cascade)` and `user User @relation(..., onDelete: Cascade)`) prevents orphaned votes/comments and foreign key constraint violations in SQLite.

5. **Safe Migration Strategy**:
   - *Observation*: SQLite does not support native `ADD COLUMN` for non-null columns without defaults, but supports tables with defaults. In `test_verify.db`, Prisma safely ran a table-redefinition pattern for `Event` (copying rows into `new_Event` and swapping), and created `CommunityVote` and `Comment`.
   - *Logic*: Running `npx prisma db push` followed by `npx prisma generate` is safe, non-interactive, preserves all 293 scores, 41 projects, and 52 audit logs, and requires zero manual data patching.

---

## 3. Caveats

1. **Active Database Path in SQLite**:
   `prisma/prisma/dogfood.db` is the actual database used at runtime by both the Next.js dev server and Prisma CLI commands due to relative resolution against `prisma/schema.prisma`. Implementers must ensure any manual backups target `prisma/prisma/dogfood.db`.
2. **TeamMember Population**:
   In the seeded database, `TeamMember` has 0 rows (the fixture parser in `seed.ts` created `Team` and `User` records but did not populate `TeamMember` junction rows). To test self-vote prevention in M2, a test case or seed helper should link test user `user_prt_01` to a team (e.g. `tm_01`) via `prisma.teamMember.create({ data: { userId: 'user_prt_01', teamId: 'tm_01' } })`.
3. **Alternative Standalone SystemSettings**:
   If an implementer strictly prefers a standalone `SystemSettings` table instead of `Event`, we have provided the schema definition in Section 4.3 below. However, `Event` is the primary and recommended target.

---

## 4. Conclusion & Recommended Specifications

### 4.1 Exact Model Additions for `prisma/schema.prisma`

#### A. New Model: `CommunityVote`
```prisma
model CommunityVote {
  id        String   @id @default(cuid())
  projectId String
  userId    String
  createdAt DateTime @default(now())

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([projectId, userId])
  @@index([projectId])
  @@index([userId])
}
```

#### B. New Model: `Comment`
```prisma
model Comment {
  id         String   @id @default(cuid())
  projectId  String
  userId     String
  authorName String
  content    String
  createdAt  DateTime @default(now())
  isFlagged  Boolean  @default(false)

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([projectId])
  @@index([userId])
}
```

#### C. Updated Model: `Event` (Adding Voting Lifecycle Flags)
```prisma
model Event {
  id               String   @id
  name             String
  submissionsClose DateTime
  votingOpen       Boolean  @default(true)
  resultsPublic    Boolean  @default(false)
  createdAt        DateTime @default(now())

  tracks   Track[]
  projects Project[]
}
```

#### D. Updated Model: `User` (Adding Reverse Relations)
Add lines 25-26:
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  role      String   // "visitor" | "participant" | "judge" | "organizer" | "admin"
  createdAt DateTime @default(now())

  sessions         Session[]
  teamMember       TeamMember?
  judgeAssignments JudgeAssignment[]
  scores           Score[]
  auditLogs        AuditLog[]
  communityVotes   CommunityVote[]
  comments         Comment[]
}
```

#### E. Updated Model: `Project` (Adding Reverse Relations)
Add lines 86-87:
```prisma
model Project {
  id          String   @id
  teamId      String
  trackId     String
  eventId     String
  title       String
  summary     String
  repoUrl     String
  submittedAt DateTime
  isDraft     Boolean  @default(false)

  team           Team            @relation(fields: [teamId], references: [id])
  track          Track           @relation(fields: [trackId], references: [id])
  event          Event           @relation(fields: [eventId], references: [id])
  scores         Score[]
  communityVotes CommunityVote[]
  comments       Comment[]
}
```

---

### 4.2 Complete Proposed `prisma/schema.prisma`

```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  role      String   // "visitor" | "participant" | "judge" | "organizer" | "admin"
  createdAt DateTime @default(now())

  sessions         Session[]
  teamMember       TeamMember?
  judgeAssignments JudgeAssignment[]
  scores           Score[]
  auditLogs        AuditLog[]
  communityVotes   CommunityVote[]
  comments         Comment[]
}

model Session {
  id        String   @id // the token itself
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())
  expiresAt DateTime
}

model Event {
  id               String   @id
  name             String
  submissionsClose DateTime
  votingOpen       Boolean  @default(true)
  resultsPublic    Boolean  @default(false)
  createdAt        DateTime @default(now())

  tracks   Track[]
  projects Project[]
}

model Track {
  id      String @id
  name    String
  eventId String
  event   Event  @relation(fields: [eventId], references: [id])

  projects         Project[]
  judgeAssignments JudgeAssignment[]
}

model Team {
  id       String       @id
  name     String

  members  TeamMember[]
  projects Project[]
}

model TeamMember {
  id     String @id @default(cuid())
  userId String @unique
  teamId String
  user   User   @relation(fields: [userId], references: [id])
  team   Team   @relation(fields: [teamId], references: [id])
}

model Project {
  id          String   @id
  teamId      String
  trackId     String
  eventId     String
  title       String
  summary     String
  repoUrl     String
  submittedAt DateTime
  isDraft     Boolean  @default(false)

  team           Team            @relation(fields: [teamId], references: [id])
  track          Track           @relation(fields: [trackId], references: [id])
  event          Event           @relation(fields: [eventId], references: [id])
  scores         Score[]
  communityVotes CommunityVote[]
  comments       Comment[]
}

model RubricCriterion {
  id       String  @id @default(cuid())
  name     String
  weight   Float   @default(1.0)
  maxScore Int     @default(5)

  scores Score[]
}

model JudgeAssignment {
  id      String @id @default(cuid())
  userId  String
  trackId String
  user    User   @relation(fields: [userId], references: [id])
  track   Track  @relation(fields: [trackId], references: [id])
}

model Score {
  id          String   @id @default(cuid())
  judgeId     String
  projectId   String
  criterionId String
  value       Float
  comment     String   @default("")
  submittedAt DateTime @default(now())

  judge     User            @relation(fields: [judgeId], references: [id])
  project   Project         @relation(fields: [projectId], references: [id])
  criterion RubricCriterion @relation(fields: [criterionId], references: [id])
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  action    String
  payload   String   @default("{}")
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
}

model CommunityVote {
  id        String   @id @default(cuid())
  projectId String
  userId    String
  createdAt DateTime @default(now())

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([projectId, userId])
  @@index([projectId])
  @@index([userId])
}

model Comment {
  id         String   @id @default(cuid())
  projectId  String
  userId     String
  authorName String
  content    String
  createdAt  DateTime @default(now())
  isFlagged  Boolean  @default(false)

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([projectId])
  @@index([userId])
}
```

---

### 4.3 Alternative Standalone `SystemSettings` (Reference Only)
If required as a separate model rather than on `Event`:
```prisma
model SystemSettings {
  id            String   @id @default("default")
  votingOpen    Boolean  @default(true)
  resultsPublic Boolean  @default(false)
  updatedAt     DateTime @updatedAt
}
```
*Recommendation*: Retain on `Event` to follow `SCOPE.md` and avoid split-table lifecycle state.

---

### 4.4 Generated SQL Migration Script
The exact SQL script generated by `npx prisma migrate diff`:
```sql
-- CreateTable
CREATE TABLE "CommunityVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityVote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommunityVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Comment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "submissionsClose" DATETIME NOT NULL,
    "votingOpen" BOOLEAN NOT NULL DEFAULT true,
    "resultsPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Event" ("createdAt", "id", "name", "submissionsClose") SELECT "createdAt", "id", "name", "submissionsClose" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CommunityVote_projectId_idx" ON "CommunityVote"("projectId");
CREATE INDEX "CommunityVote_userId_idx" ON "CommunityVote"("userId");
CREATE UNIQUE INDEX "CommunityVote_projectId_userId_key" ON "CommunityVote"("projectId", "userId");

-- CreateIndex
CREATE INDEX "Comment_projectId_idx" ON "Comment"("projectId");
CREATE INDEX "Comment_userId_idx" ON "Comment"("userId");
```

---

## 5. Verification Method & Implementation Runbook

### Step 1: Safety Backup
Before applying changes, execute in PowerShell:
```powershell
Copy-Item "d:\TP\Hackathon\DogFood\prisma\prisma\dogfood.db" "d:\TP\Hackathon\DogFood\prisma\prisma\dogfood.db.bak" -Force
```

### Step 2: Apply Schema Edits
Write the contents of Section 4.2 to `d:\TP\Hackathon\DogFood\prisma\schema.prisma`.

### Step 3: Validate and Push Schema
Run sequentially (PowerShell 5.1):
```powershell
npx prisma validate
npx prisma db push
npx prisma generate
```

### Step 4: Verify Database Data & Client Generation
Run this verification one-liner:
```powershell
npx tsx -e "import { prisma } from './src/lib/prisma'; async function v() { const u = await prisma.user.count(); const p = await prisma.project.count(); const s = await prisma.score.count(); const e = await prisma.event.findFirst(); console.log({ users: u, projects: p, scores: s, event: e }); } v().then(() => prisma.\$disconnect());"
```
**Expected Invariant Output:**
- `users`: 34
- `projects`: 41
- `scores`: 293
- `event.votingOpen`: `true`
- `event.resultsPublic`: `false`

### Step 5: Run Acceptance Checker & Typecheck
Ensure zero regression on the baseline test suite:
```powershell
npm run typecheck
python Hack_docs/run.py .dogfood.toml
```
**Expected Outcome**: 7/7 checks PASS (`claimed T1 T2, verified T1 T2`).
