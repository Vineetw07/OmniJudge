import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { computeRankedProjects } from '@/lib/ranking';

export const dynamic = 'force-dynamic';

function escapeCsvField(value: string | number): string {
  let str = String(value ?? '');
  // Sanitize CSV Formula Injection (CWE-1236) for text strings
  if (/^[=+\-@\t\r]/.test(str) && typeof value === 'string' && isNaN(Number(str))) {
    str = `'${str}`;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * GET /api/export.csv
 *
 * Strictly restricted to Organizer and Admin roles.
 * Computes rubric-weighted composite scores, applies MAD normalization
 * per judge (handling zero-variance judges cleanly), calculates average
 * normalized and raw scores per project, ranks projects, and streams CSV.
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized: Valid session required' },
      { status: 401 }
    );
  }

  // RBAC Guard: Organizers and Admins only
  if (session.role !== 'organizer' && session.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: Organizer or Admin role required' },
      { status: 403 }
    );
  }

  const projectResults = await computeRankedProjects();

  // Generate CSV content (Line 1 MUST contain comma)
  const header = 'project_id,project_title,track,raw_score,normalized_score,rank';
  const rows = projectResults.map((p) => {
    return [
      escapeCsvField(p.projectId),
      escapeCsvField(p.title),
      escapeCsvField(p.trackName),
      p.rawScore.toFixed(2),
      p.normalizedScore.toFixed(4),
      p.rank,
    ].join(',');
  });

  const csvContent = [header, ...rows].join('\r\n');

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="omnijudge_scores.csv"',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
