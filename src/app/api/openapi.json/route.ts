import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const openApiSpec = {
    openapi: '3.1.0',
    info: {
      title: 'OmniJudge Headless REST API',
      version: '1.0.0',
      description:
        'Official REST API for OmniJudge: autonomous, offline-resilient hackathon submission, evaluation, and community voting platform.',
      contact: {
        name: 'OmniJudge Core Team',
        url: 'https://dogfoodhack.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:8080',
        description: 'Local OmniJudge Daemon',
      },
    ],
    tags: [
      { name: 'Authentication', description: 'Session creation and termination' },
      { name: 'Projects', description: 'Project submission and gallery endpoints' },
      { name: 'Judging', description: 'Judge scoring, rubric evaluation, and signed certificates' },
      { name: 'Community', description: 'Community voting and feedback comments' },
      { name: 'Governance', description: 'Organizer lifecycle and unsealing governance' },
      { name: 'Webhooks', description: 'Real-time webhook subscriptions and delivery' },
      { name: 'Data Portability', description: 'RFC 4180 CSV export, bulk JSON export and import' },
    ],
    components: {
      securitySchemes: {
        CookieSession: {
          type: 'apiKey',
          in: 'cookie',
          name: 'session',
          description: 'Stateful session cookie token stored in SQLite database.',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            details: { type: 'array', items: { type: 'object' } },
          },
          required: ['error'],
        },
        Project: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'prj_01' },
            title: { type: 'string', example: 'Glass Signal' },
            summary: { type: 'string', example: 'Real-time acoustic analysis for distributed networks.' },
            repoUrl: { type: 'string', example: 'https://github.com/example/repo' },
            trackId: { type: 'string', example: 'trk_01' },
            teamId: { type: 'string', example: 'tm_01' },
            submittedAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'title', 'summary', 'trackId', 'teamId'],
        },
        ScoreSubmission: {
          type: 'object',
          properties: {
            projectId: { type: 'string', example: 'prj_01' },
            scores: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  criterionId: { type: 'string', example: 'crit_01' },
                  value: { type: 'number', minimum: 0, maximum: 5, example: 4.5 },
                },
                required: ['criterionId', 'value'],
              },
            },
            comment: { type: 'string', example: 'Exceptional system architecture.' },
          },
          required: ['projectId', 'scores'],
        },
        WebhookSubscription: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            url: { type: 'string', format: 'uri' },
            events: { type: 'string', example: 'score.submitted,vote.cast,results.unsealed' },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    paths: {
      '/api/auth/login': {
        post: {
          tags: ['Authentication'],
          summary: 'Authenticate via email session token',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { email: { type: 'string', format: 'email' } },
                  required: ['email'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'Authenticated successfully; sets session cookie' },
            '400': { description: 'Invalid email' },
            '401': { description: 'User not found' },
          },
        },
      },
      '/api/auth/logout': {
        post: {
          tags: ['Authentication'],
          summary: 'Terminate session and clear cookie',
          responses: {
            '200': { description: 'Logged out successfully' },
          },
        },
      },
      '/api/projects': {
        get: {
          tags: ['Projects'],
          summary: 'Retrieve project gallery submissions',
          responses: {
            '200': { description: 'List of projects with teams and tracks' },
          },
        },
        post: {
          tags: ['Projects'],
          summary: 'Submit a new project (closed after event deadline)',
          security: [{ CookieSession: [] }],
          responses: {
            '200': { description: 'Project created' },
            '400': { description: 'Validation error' },
            '409': { description: 'Event closed; submissions refused' },
          },
        },
      },
      '/api/judge/scores': {
        get: {
          tags: ['Judging'],
          summary: 'Retrieve judge own scores (with strict IDOR peer isolation)',
          security: [{ CookieSession: [] }],
          parameters: [
            {
              name: 'judge',
              in: 'query',
              required: false,
              description: 'Optional IDOR probe parameter; peer IDs trigger 403 Forbidden',
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': { description: 'Array of submitted scores' },
            '401': { description: 'Unauthorized' },
            '403': { description: 'Forbidden (Peer score snooping or invalid role)' },
          },
        },
        post: {
          tags: ['Judging'],
          summary: 'Submit rubric-based evaluation scores atomically',
          security: [{ CookieSession: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ScoreSubmission' },
              },
            },
          },
          responses: {
            '200': { description: 'Scores submitted and audit log written' },
            '400': { description: 'Schema or criterion validation error' },
            '403': { description: 'Unassigned track jurisdiction or conflict of interest' },
          },
        },
      },
      '/api/judge/certificate': {
        get: {
          tags: ['Judging'],
          summary: 'Generate HMAC-SHA256 signed judge participation credential',
          security: [{ CookieSession: [] }],
          parameters: [
            {
              name: 'judgeId',
              in: 'query',
              required: false,
              description: 'Target judge ID (organizers can query any; judges only own ID)',
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': { description: 'Returns canonical payload, signature, and verification token' },
            '401': { description: 'Unauthorized' },
            '403': { description: 'Forbidden (Peer IDOR blocked)' },
          },
        },
        post: {
          tags: ['Judging'],
          summary: 'Cryptographically verify an evaluation token or envelope',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { token: { type: 'string' } },
                  required: ['token'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'Verification verdict (isValid, payload, signature)' },
            '400': { description: 'Missing token' },
          },
        },
      },
      '/api/community/vote': {
        get: {
          tags: ['Community'],
          summary: 'Inspect user vote status and public vote counts (sealed when active)',
          security: [{ CookieSession: [] }],
          parameters: [
            { name: 'projectId', in: 'query', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Vote state (totalVotes null while sealed)' },
          },
        },
        post: {
          tags: ['Community'],
          summary: 'Toggle community vote (enforces self-vote team relational defense)',
          security: [{ CookieSession: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { projectId: { type: 'string' } },
                  required: ['projectId'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'Vote toggled successfully' },
            '403': { description: 'Forbidden: Self-vote attempt on own project' },
          },
        },
      },
      '/api/community/comments': {
        get: {
          tags: ['Community'],
          summary: 'Retrieve project constructive comments',
          parameters: [
            { name: 'projectId', in: 'query', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Array of comments' },
          },
        },
        post: {
          tags: ['Community'],
          summary: 'Post feedback comment (XSS sanitized, 10s rate limited)',
          security: [{ CookieSession: [] }],
          responses: {
            '200': { description: 'Comment published' },
            '429': { description: 'Rate limit: 10s sliding-window cooldown' },
          },
        },
      },
      '/api/community/settings': {
        get: {
          tags: ['Governance'],
          summary: 'Retrieve community voting lifecycle flags',
          responses: { '200': { description: 'Flags { votingOpen, resultsPublic }' } },
        },
        post: {
          tags: ['Governance'],
          summary: 'Update voting lifecycle and seal/unseal results',
          security: [{ CookieSession: [] }],
          responses: {
            '200': { description: 'Updated flags' },
            '403': { description: 'Forbidden (Organizer only)' },
          },
        },
      },
      '/api/leaderboard': {
        get: {
          tags: ['Judging & Rankings'],
          summary: 'Retrieve MAD-normalized dual leaderboard with overall and track-specific standings',
          security: [{ CookieSession: [] }],
          responses: {
            '200': {
              description: 'Dual leaderboard dataset',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      resultsPublic: { type: 'boolean' },
                      leaderboard: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            rank: { type: 'integer' },
                            trackRank: { type: 'integer' },
                            projectId: { type: 'string' },
                            title: { type: 'string' },
                            trackName: { type: 'string' },
                            normalizedScore: { type: 'number' },
                            reviewCount: { type: 'integer' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            '401': { description: 'Unauthorized' },
            '403': { description: 'Forbidden (Results sealed for non-organizer)' },
          },
        },
      },
      '/api/export.csv': {
        get: {
          tags: ['Data Portability'],
          summary: 'Stream RFC 4180 CSV with MAD-normalized judge scoring and CWE-1236 protection',
          security: [{ CookieSession: [] }],
          responses: {
            '200': { description: 'text/csv file stream' },
            '403': { description: 'Forbidden (Organizer only)' },
          },
        },
      },
      '/api/export.json': {
        get: {
          tags: ['Data Portability'],
          summary: 'Bulk JSON export of entire hackathon database state and normalized leaderboard',
          security: [{ CookieSession: [] }],
          responses: {
            '200': { description: 'application/json full state backup' },
            '403': { description: 'Forbidden (Organizer only)' },
          },
        },
      },
      '/api/import': {
        post: {
          tags: ['Data Portability'],
          summary: 'Bulk import tracks, teams, and projects transactionally',
          security: [{ CookieSession: [] }],
          responses: {
            '200': { description: 'Bulk dataset imported' },
            '400': { description: 'Validation error' },
            '403': { description: 'Forbidden (Organizer only)' },
          },
        },
      },
      '/api/webhooks': {
        get: {
          tags: ['Webhooks'],
          summary: 'List active webhook subscriptions (secrets masked)',
          security: [{ CookieSession: [] }],
          responses: {
            '200': { description: 'List of webhook endpoints' },
            '403': { description: 'Forbidden (Organizer only)' },
          },
        },
        post: {
          tags: ['Webhooks'],
          summary: 'Register new webhook subscription or dispatch test ping',
          security: [{ CookieSession: [] }],
          responses: {
            '201': { description: 'Webhook created' },
            '200': { description: 'Test ping executed' },
            '400': { description: 'Invalid URL or secret' },
            '403': { description: 'Forbidden (Organizer only)' },
          },
        },
        delete: {
          tags: ['Webhooks'],
          summary: 'Delete webhook subscription',
          security: [{ CookieSession: [] }],
          responses: {
            '200': { description: 'Webhook deleted' },
            '403': { description: 'Forbidden (Organizer only)' },
          },
        },
      },
    },
  };

  return NextResponse.json(openApiSpec, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
