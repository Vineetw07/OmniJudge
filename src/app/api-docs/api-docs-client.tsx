'use client';

import React, { useState, useMemo } from 'react';
import {
  Code2,
  Search,
  Download,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface EndpointSpec {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  tag: string;
  summary: string;
  description: string;
  authRequired: boolean;
  requiredRole: 'Public' | 'Any Auth' | 'Judge' | 'Organizer';
  sampleCurl: string;
  requestBody?: string;
  responses: { code: string; desc: string }[];
}

const ENDPOINTS: EndpointSpec[] = [
  {
    method: 'POST',
    path: '/api/auth/login',
    tag: 'Authentication',
    summary: 'Authenticate via email session token',
    description: 'Looks up the user by email, sets the durable HTTP-only session cookie.',
    authRequired: false,
    requiredRole: 'Public',
    sampleCurl: `curl -X POST http://localhost:8080/api/auth/login \\\n  -H "Content-Type: application/json" \\\n  -d '{"email": "organizer@dogfood.dev"}'`,
    requestBody: JSON.stringify({ email: 'organizer@dogfood.dev' }, null, 2),
    responses: [
      { code: '200 OK', desc: 'Sets session cookie; returns user profile' },
      { code: '400 Bad Request', desc: 'Invalid email syntax' },
      { code: '401 Unauthorized', desc: 'User does not exist in database' },
    ],
  },
  {
    method: 'POST',
    path: '/api/auth/logout',
    tag: 'Authentication',
    summary: 'Terminate session and clear cookie',
    description: 'Invalidates session token and expires the session cookie.',
    authRequired: false,
    requiredRole: 'Public',
    sampleCurl: `curl -X POST http://localhost:8080/api/auth/logout`,
    responses: [{ code: '200 OK', desc: 'Successfully logged out' }],
  },
  {
    method: 'GET',
    path: '/api/projects',
    tag: 'Projects',
    summary: 'Retrieve project gallery submissions',
    description: 'Returns array of active projects with track and team associations.',
    authRequired: false,
    requiredRole: 'Public',
    sampleCurl: `curl http://localhost:8080/api/projects`,
    responses: [{ code: '200 OK', desc: 'JSON array of projects' }],
  },
  {
    method: 'POST',
    path: '/api/projects',
    tag: 'Projects',
    summary: 'Submit a new project',
    description: 'Checks deadline timestamp. If past deadline, rejects with 409 Conflict.',
    authRequired: true,
    requiredRole: 'Any Auth',
    sampleCurl: `curl -X POST http://localhost:8080/api/projects \\\n  -H "Cookie: session=prt_seed_token_2026" \\\n  -H "Content-Type: application/json" \\\n  -d '{"title": "New Project", "summary": "Abstract"}'`,
    responses: [
      { code: '200 OK', desc: 'Project created' },
      { code: '409 Conflict', desc: 'Submissions closed; deadline has elapsed' },
    ],
  },
  {
    method: 'GET',
    path: '/api/judge/scores',
    tag: 'Judging',
    summary: 'Retrieve judge own scores with strict IDOR isolation',
    description: 'Enforces backend parameter guard: ?judge=<id> must match caller session.',
    authRequired: true,
    requiredRole: 'Judge',
    sampleCurl: `curl http://localhost:8080/api/judge/scores \\\n  -H "Cookie: session=jdg_a_seed_token_2026"`,
    responses: [
      { code: '200 OK', desc: 'Judge own scores' },
      { code: '401 Unauthorized', desc: 'Missing or expired session' },
      { code: '403 Forbidden', desc: 'Peer snooping IDOR attempt blocked' },
    ],
  },
  {
    method: 'POST',
    path: '/api/judge/scores',
    tag: 'Judging',
    summary: 'Atomic rubric score submission',
    description: 'Validates rubric jurisdiction and conflict of interest, writes Score and AuditLog.',
    authRequired: true,
    requiredRole: 'Judge',
    sampleCurl: `curl -X POST http://localhost:8080/api/judge/scores \\\n  -H "Cookie: session=jdg_a_seed_token_2026" \\\n  -H "Content-Type: application/json" \\\n  -d '{"projectId": "prj_01", "scores": [{"criterionId": "crit_01", "value": 4.5}]}'`,
    requestBody: JSON.stringify(
      {
        projectId: 'prj_01',
        scores: [{ criterionId: 'crit_01', value: 4.5 }],
        comment: 'Outstanding implementation.',
      },
      null,
      2
    ),
    responses: [
      { code: '200 OK', desc: 'Evaluation saved' },
      { code: '403 Forbidden', desc: 'Unassigned track or self-evaluation COI bar' },
    ],
  },
  {
    method: 'GET',
    path: '/api/judge/certificate',
    tag: 'Judging',
    summary: 'Generate HMAC-SHA256 signed judge participation credential',
    description: 'Generates canonical JSON evaluation payload, signs with HMAC-SHA256, and returns URL-safe Base64 token.',
    authRequired: true,
    requiredRole: 'Judge',
    sampleCurl: `curl http://localhost:8080/api/judge/certificate \\\n  -H "Cookie: session=jdg_a_seed_token_2026"`,
    responses: [
      { code: '200 OK', desc: 'Canonical payload, signature, and token' },
      { code: '403 Forbidden', desc: 'Peer judge snooping blocked' },
    ],
  },
  {
    method: 'POST',
    path: '/api/judge/certificate',
    tag: 'Judging',
    summary: 'Cryptographically verify evaluation certificate token',
    description: 'Decodes Base64url token, validates schema, and verifies HMAC-SHA256 signature.',
    authRequired: false,
    requiredRole: 'Public',
    sampleCurl: `curl -X POST http://localhost:8080/api/judge/certificate \\\n  -H "Content-Type: application/json" \\\n  -d '{"token": "..."}'`,
    requestBody: JSON.stringify({ token: '<url_safe_base64_record_token>' }, null, 2),
    responses: [
      { code: '200 OK', desc: 'Verification verdict (isValid, payload, signature)' },
      { code: '400 Bad Request', desc: 'Missing or malformed token' },
    ],
  },
  {
    method: 'POST',
    path: '/api/community/vote',
    tag: 'Community',
    summary: 'Toggle community vote',
    description: 'Enforces self-vote relational defense: team members cannot vote for their own project.',
    authRequired: true,
    requiredRole: 'Any Auth',
    sampleCurl: `curl -X POST http://localhost:8080/api/community/vote \\\n  -H "Cookie: session=prt_seed_token_2026" \\\n  -H "Content-Type: application/json" \\\n  -d '{"projectId": "prj_02"}'`,
    requestBody: JSON.stringify({ projectId: 'prj_02' }, null, 2),
    responses: [
      { code: '200 OK', desc: 'Vote toggled successfully' },
      { code: '403 Forbidden', desc: 'Self-voting blocked via TeamMember relational check' },
    ],
  },
  {
    method: 'POST',
    path: '/api/community/settings',
    tag: 'Governance',
    summary: 'Organizer lifecycle and sealed results toggle',
    description: 'Enables or seals public vote counts and controls voting window.',
    authRequired: true,
    requiredRole: 'Organizer',
    sampleCurl: `curl -X POST http://localhost:8080/api/community/settings \\\n  -H "Cookie: session=org_seed_token_2026" \\\n  -H "Content-Type: application/json" \\\n  -d '{"resultsPublic": true}'`,
    requestBody: JSON.stringify({ resultsPublic: true, votingOpen: true }, null, 2),
    responses: [
      { code: '200 OK', desc: 'Settings updated and results.unsealed dispatched' },
      { code: '403 Forbidden', desc: 'Organizer access required' },
    ],
  },
  {
    method: 'GET',
    path: '/api/export.csv',
    tag: 'Data Portability',
    summary: 'Stream RFC 4180 CSV with MAD score normalization',
    description: 'Computes Modified Z-Score via Median Absolute Deviation, sanitizes formula injection (CWE-1236).',
    authRequired: true,
    requiredRole: 'Organizer',
    sampleCurl: `curl http://localhost:8080/api/export.csv \\\n  -H "Cookie: session=org_seed_token_2026"`,
    responses: [
      { code: '200 OK', desc: 'RFC 4180 CSV stream' },
      { code: '403 Forbidden', desc: 'Organizer access required' },
    ],
  },
  {
    method: 'GET',
    path: '/api/export.json',
    tag: 'Data Portability',
    summary: 'Bulk JSON export of entire database state',
    description: 'Exports event, tracks, teams, projects, rubric, scores, and MAD-normalized leaderboard.',
    authRequired: true,
    requiredRole: 'Organizer',
    sampleCurl: `curl http://localhost:8080/api/export.json \\\n  -H "Cookie: session=org_seed_token_2026"`,
    responses: [
      { code: '200 OK', desc: 'Full application state JSON' },
      { code: '403 Forbidden', desc: 'Organizer access required' },
    ],
  },
  {
    method: 'POST',
    path: '/api/import',
    tag: 'Data Portability',
    summary: 'Bulk import tracks, teams, and projects transactionally',
    description: 'Validates schema with Zod and applies atomic upsert transaction into SQLite.',
    authRequired: true,
    requiredRole: 'Organizer',
    sampleCurl: `curl -X POST http://localhost:8080/api/import \\\n  -H "Cookie: session=org_seed_token_2026" \\\n  -H "Content-Type: application/json" \\\n  -d '{"tracks": [{"id": "trk_01", "name": "Dev Tools"}]}'`,
    responses: [
      { code: '200 OK', desc: 'Imported records summary' },
      { code: '400 Bad Request', desc: 'Invalid JSON schema' },
      { code: '403 Forbidden', desc: 'Organizer access required' },
    ],
  },
  {
    method: 'GET',
    path: '/api/webhooks',
    tag: 'Webhooks',
    summary: 'List registered webhook subscriptions',
    description: 'Retrieves all webhook endpoints with secrets masked.',
    authRequired: true,
    requiredRole: 'Organizer',
    sampleCurl: `curl http://localhost:8080/api/webhooks \\\n  -H "Cookie: session=org_seed_token_2026"`,
    responses: [
      { code: '200 OK', desc: 'Array of webhook subscriptions' },
      { code: '403 Forbidden', desc: 'Organizer access required' },
    ],
  },
  {
    method: 'POST',
    path: '/api/webhooks',
    tag: 'Webhooks',
    summary: 'Register webhook endpoint or dispatch test ping',
    description: 'Registers URL with secret and subscribed events (score.submitted, vote.cast, results.unsealed).',
    authRequired: true,
    requiredRole: 'Organizer',
    sampleCurl: `curl -X POST http://localhost:8080/api/webhooks \\\n  -H "Cookie: session=org_seed_token_2026" \\\n  -H "Content-Type: application/json" \\\n  -d '{"url": "https://hooks.slack.com/services/...", "secret": "whsec_key_123", "events": "score.submitted,vote.cast"}'`,
    requestBody: JSON.stringify(
      {
        url: 'https://example.org/webhook',
        secret: 'whsec_secret_12345',
        events: 'score.submitted,vote.cast,results.unsealed',
      },
      null,
      2
    ),
    responses: [
      { code: '201 Created', desc: 'Webhook subscription registered' },
      { code: '400 Bad Request', desc: 'Invalid URL or secret' },
      { code: '403 Forbidden', desc: 'Organizer access required' },
    ],
  },
  {
    method: 'DELETE',
    path: '/api/webhooks',
    tag: 'Webhooks',
    summary: 'Delete webhook subscription',
    description: 'Removes subscription by ID and logs to AuditLog.',
    authRequired: true,
    requiredRole: 'Organizer',
    sampleCurl: `curl -X DELETE "http://localhost:8080/api/webhooks?id=<sub_id>" \\\n  -H "Cookie: session=org_seed_token_2026"`,
    responses: [
      { code: '200 OK', desc: 'Webhook subscription deleted' },
      { code: '404 Not Found', desc: 'Subscription does not exist' },
    ],
  },
];

const TAGS = [
  'All',
  'Authentication',
  'Projects',
  'Judging',
  'Community',
  'Governance',
  'Data Portability',
  'Webhooks',
] as const;

export function ApiDocsClient() {
  const [selectedTag, setSelectedTag] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [expandedEndpoints, setExpandedEndpoints] = useState<Set<string>>(
    () => new Set(['/api/judge/scores-GET', '/api/judge/certificate-GET', '/api/webhooks-POST'])
  );
  const [copiedCurl, setCopiedCurl] = useState<string | null>(null);

  const toggleExpanded = (key: string) => {
    setExpandedEndpoints((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filteredEndpoints = useMemo(() => {
    return ENDPOINTS.filter((ep) => {
      if (selectedTag !== 'All' && ep.tag !== selectedTag) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        ep.path.toLowerCase().includes(q) ||
        ep.summary.toLowerCase().includes(q) ||
        ep.description.toLowerCase().includes(q) ||
        ep.tag.toLowerCase().includes(q)
      );
    });
  }, [selectedTag, search]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCurl(id);
    setTimeout(() => setCopiedCurl(null), 2000);
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
      {/* Top Hero Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-cyan-950/30 via-slate-900/40 to-indigo-950/30 border border-white/10 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="space-y-3 z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs font-mono uppercase tracking-wider shadow-[0_0_15px_rgba(56,189,248,0.2)]">
            <Code2 className="size-3.5" />
            <span>OpenAPI 3.1 REST Engine</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            REST API Explorer & Reference
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm max-w-2xl leading-relaxed">
            Full specification of OmniJudge headless REST endpoints, strict RBAC perimeter guards, cryptographic HMAC records, and real-time webhook subscriptions.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 z-10">
          <a
            href="/api/openapi.json"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(56,189,248,0.3)] transition-all"
          >
            <Download className="size-4" />
            <span>OpenAPI 3.1 JSON</span>
          </a>
          <a
            href="/verify"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium bg-white/10 hover:bg-white/15 text-white transition-colors"
          >
            <ShieldCheck className="size-4 text-emerald-400" />
            <span>Verify Registry</span>
          </a>
        </div>
      </div>

      {/* Search and Category Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full no-scrollbar">
          {TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all border ${
                selectedTag === tag
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-[0_0_12px_rgba(56,189,248,0.25)]'
                  : 'bg-white/[0.03] border-white/10 text-slate-400 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter endpoints, methods, tags..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
          />
        </div>
      </div>

      {/* Endpoints List */}
      <div className="space-y-4">
        {filteredEndpoints.map((ep) => {
          const epKey = `${ep.path}-${ep.method}`;
          const isExpanded = expandedEndpoints.has(epKey);

          return (
            <div
              key={epKey}
              className={`rounded-2xl border transition-all duration-200 backdrop-blur-md ${
                isExpanded
                  ? 'bg-white/[0.035] border-cyan-500/30 shadow-[0_4px_25px_rgba(0,0,0,0.3)]'
                  : 'bg-white/[0.02] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.03]'
              }`}
            >
              {/* Endpoint Header Bar */}
              <button
                type="button"
                onClick={() => toggleExpanded(epKey)}
                className="w-full p-4 sm:p-5 flex items-center justify-between text-left gap-4"
              >
                <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                  {/* Method Badge */}
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold tracking-wider ${
                      ep.method === 'GET'
                        ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                        : ep.method === 'POST'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {ep.method}
                  </span>

                  {/* Path */}
                  <span className="font-mono text-sm sm:text-base font-semibold text-white">
                    {ep.path}
                  </span>

                  {/* Summary */}
                  <span className="text-xs text-slate-400 hidden lg:inline">
                    — {ep.summary}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Role Badge */}
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${
                      ep.requiredRole === 'Organizer'
                        ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300'
                        : ep.requiredRole === 'Judge'
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                        : ep.requiredRole === 'Public'
                        ? 'border-slate-500/40 bg-slate-500/10 text-slate-300'
                        : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                    }`}
                  >
                    {ep.requiredRole}
                  </Badge>

                  {isExpanded ? (
                    <ChevronDown className="size-4 text-cyan-400" />
                  ) : (
                    <ChevronRight className="size-4 text-slate-500" />
                  )}
                </div>
              </button>

              {/* Expanded Details Pane */}
              {isExpanded && (
                <div className="px-5 pb-6 pt-2 border-t border-white/[0.06] space-y-5 animate-in fade-in-0 duration-200">
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {ep.description}
                  </p>

                  {/* Request Body (if applicable) */}
                  {ep.requestBody && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-mono text-slate-400">
                        Request Body (JSON):
                      </span>
                      <pre className="p-3.5 rounded-xl bg-black/60 border border-white/10 font-mono text-xs text-cyan-300 overflow-x-auto whitespace-pre">
                        {ep.requestBody}
                      </pre>
                    </div>
                  )}

                  {/* Responses Table */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-mono text-slate-400">HTTP Responses:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {ep.responses.map((resp) => (
                        <div
                          key={resp.code}
                          className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-xs"
                        >
                          <span
                            className={`font-mono font-bold ${
                              resp.code.startsWith('2')
                                ? 'text-emerald-400'
                                : resp.code.startsWith('4')
                                ? 'text-amber-400'
                                : 'text-slate-300'
                            }`}
                          >
                            {resp.code}
                          </span>
                          <span className="text-slate-400 text-right">{resp.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* cURL Snippet */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-slate-400">
                        Example cURL Command:
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(ep.sampleCurl, epKey)}
                        className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors inline-flex items-center gap-1 font-mono"
                      >
                        {copiedCurl === epKey ? (
                          <>
                            <Check className="size-3" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-3" />
                            <span>Copy cURL</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="p-3.5 rounded-xl bg-black/70 border border-white/10 font-mono text-xs text-slate-200 overflow-x-auto select-all">
                      {ep.sampleCurl}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
