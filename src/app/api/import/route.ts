import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ImportTrackSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

const ImportTeamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

const ImportProjectSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  repoUrl: z.string().optional(),
  repo_url: z.string().optional(),
  trackId: z.string().optional(),
  track: z.string().optional(),
  teamId: z.string().optional(),
  team: z.string().optional(),
  submittedAt: z.string().optional(),
  submitted_at: z.string().optional(),
});

const ImportCriterionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  weight: z.number().positive().optional(),
  maxScore: z.number().int().positive().optional(),
});

const BulkImportPayloadSchema = z.object({
  event: z
    .object({
      id: z.string().optional(),
      name: z.string().optional(),
      submissionsClose: z.string().optional(),
      submissions_close: z.string().optional(),
    })
    .optional(),
  tracks: z.array(ImportTrackSchema).optional().default([]),
  teams: z.array(ImportTeamSchema).optional().default([]),
  projects: z.array(ImportProjectSchema).optional().default([]),
  criteria: z.array(ImportCriterionSchema).optional().default([]),
  rubricCriteria: z.array(ImportCriterionSchema).optional().default([]),
  scores: z.array(z.any()).optional().default([]),
});

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized: Session required' }, { status: 401 });
  }

  // RBAC: Organizer and admin only
  if (session.role !== 'organizer' && session.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: Bulk data import is restricted to organizers' },
      { status: 403 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Bad Request: Malformed JSON payload' },
      { status: 400 }
    );
  }

  try {
    const parseResult = BulkImportPayloadSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Bad Request: Invalid import schema', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { event, tracks, teams, projects } = parseResult.data;
    const criteria =
      parseResult.data.criteria.length > 0
        ? parseResult.data.criteria
        : parseResult.data.rubricCriteria;

    // Resolve or find target event ID
    let eventId = 'evt_01';
    const existingEvent = await prisma.event.findFirst();
    if (existingEvent) {
      eventId = existingEvent.id;
    }

    // Execute atomic transactional import
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update event if provided
      if (event?.name) {
        await tx.event.upsert({
          where: { id: event.id || eventId },
          update: {
            name: event.name,
            submissionsClose: event.submissionsClose || event.submissions_close
              ? new Date(event.submissionsClose || event.submissions_close!)
              : undefined,
          },
          create: {
            id: event.id || eventId,
            name: event.name,
            submissionsClose: new Date(
              event.submissionsClose || event.submissions_close || '2026-12-31T23:59:59Z'
            ),
          },
        });
      }

      // 2. Upsert tracks
      for (const t of tracks) {
        await tx.track.upsert({
          where: { id: t.id },
          update: { name: t.name },
          create: {
            id: t.id,
            name: t.name,
            eventId,
          },
        });
      }

      // 3. Upsert teams
      for (const tm of teams) {
        await tx.team.upsert({
          where: { id: tm.id },
          update: { name: tm.name },
          create: {
            id: tm.id,
            name: tm.name,
          },
        });
      }

      // 4. Upsert criteria
      for (const crit of criteria) {
        await tx.rubricCriterion.upsert({
          where: { id: crit.id },
          update: {
            name: crit.name,
            weight: crit.weight ?? 1.0,
            maxScore: crit.maxScore ?? 5,
          },
          create: {
            id: crit.id,
            name: crit.name,
            weight: crit.weight ?? 1.0,
            maxScore: crit.maxScore ?? 5,
          },
        });
      }

      // 5. Upsert projects
      for (const p of projects) {
        const targetTrackId = p.trackId || p.track || tracks[0]?.id || 'trk_01';
        const targetTeamId = p.teamId || p.team || teams[0]?.id || 'tm_01';
        const targetRepo = p.repoUrl || p.repo_url || 'https://github.com';
        const submittedAtDate = p.submittedAt || p.submitted_at
          ? new Date(p.submittedAt || p.submitted_at!)
          : new Date();

        await tx.project.upsert({
          where: { id: p.id },
          update: {
            title: p.title,
            summary: p.summary,
            repoUrl: targetRepo,
            trackId: targetTrackId,
            teamId: targetTeamId,
          },
          create: {
            id: p.id,
            title: p.title,
            summary: p.summary,
            repoUrl: targetRepo,
            trackId: targetTrackId,
            teamId: targetTeamId,
            eventId,
            submittedAt: submittedAtDate,
          },
        });
      }

      // 6. Record audit log
      await tx.auditLog.create({
        data: {
          userId: session.id,
          action: 'BULK_IMPORT_EXECUTED',
          payload: JSON.stringify({
            tracksCount: tracks.length,
            teamsCount: teams.length,
            projectsCount: projects.length,
            criteriaCount: criteria.length,
          }),
        },
      });

      return {
        tracks: tracks.length,
        teams: teams.length,
        projects: projects.length,
        criteria: criteria.length,
      };
    });

    return NextResponse.json({
      success: true,
      message: 'Bulk dataset imported successfully into database',
      imported: result,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Internal Server Error: ${err instanceof Error ? err.message : 'Unknown'}` },
      { status: 500 }
    );
  }
}
