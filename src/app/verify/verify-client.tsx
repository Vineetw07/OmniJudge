'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  CheckCircle2,
  Copy,
  Check,
  Award,
  Calendar,
  Layers,
  FileCheck2,
  Hash,
  ExternalLink,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { VerificationResult } from '@/lib/certificates';

interface VerifyClientProps {
  initialResult: VerificationResult | null;
  initialToken?: string;
}

export function VerifyClient({ initialResult, initialToken = '' }: VerifyClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tokenInput, setTokenInput] = useState(initialToken);
  const [result, setResult] = useState<VerificationResult | null>(initialResult);
  const [copiedSignature, setCopiedSignature] = useState(false);
  const [copiedShareUrl, setCopiedShareUrl] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const verifyToken = useCallback(async (tok: string) => {
    if (!tok.trim()) {
      setResult(null);
      return;
    }
    setIsVerifying(true);
    try {
      const res = await fetch('/api/judge/certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tok.trim() }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({
        isValid: false,
        payload: null,
        signature: null,
        error: 'Network error occurred during verification',
      });
    } finally {
      setIsVerifying(false);
    }
  }, []);

  // Sync with URL query parameter changes
  useEffect(() => {
    const urlRecord = searchParams.get('record');
    if (urlRecord && urlRecord !== tokenInput) {
      setTokenInput(urlRecord);
      verifyToken(urlRecord);
    }
  }, [searchParams, tokenInput, verifyToken]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let cleaned = tokenInput.trim();
    if (cleaned.includes('record=')) {
      const match = cleaned.match(/[?&]record=([^&#\s]+)/);
      if (match) cleaned = decodeURIComponent(match[1]);
    }
    if (cleaned) {
      setTokenInput(cleaned);
      router.push(`/verify?record=${encodeURIComponent(cleaned)}`);
      verifyToken(cleaned);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      {/* Header Banner */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-mono uppercase tracking-wider mb-4 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
          <ShieldCheck className="size-3.5" />
          <span>Cryptographic Trust Registry</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
          Judge Record Verification
        </h1>
        <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
          Verify tamper-evident digital judge participation certificates and evaluation records issued by the OmniJudge platform.
        </p>
      </div>

      {/* Verification Search Bar */}
      <form onSubmit={handleSearchSubmit} className="mb-10">
        <div className="relative flex items-center">
          <input
            type="text"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Paste certificate token (?record=...), verification URL, or JSON..."
            className="w-full pl-4 pr-32 py-3.5 rounded-2xl bg-white/[0.04] border border-white/10 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 font-mono transition-all"
          />
          <button
            type="submit"
            disabled={isVerifying || !tokenInput.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(56,189,248,0.25)]"
          >
            <Search className="size-3.5" />
            <span>{isVerifying ? 'Verifying...' : 'Verify'}</span>
          </button>
        </div>
      </form>

      {/* Verification Display Results */}
      {result && (
        <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          {result.isValid && result.payload ? (
            /* VALID CERTIFICATE CARD */
            <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/20 via-black/40 to-black/60 p-6 sm:p-8 backdrop-blur-xl shadow-[0_0_40px_rgba(16,185,129,0.15)] relative overflow-hidden">
              {/* Corner Watermark */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

              {/* Status Header Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-emerald-500/20 mb-6">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-xs font-bold tracking-wide shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                  <CheckCircle2 className="size-4 text-emerald-400" />
                  <span>VERIFIED AUTHENTIC CREDENTIAL</span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-mono text-emerald-400/80 block">Algorithm: HMAC-SHA256</span>
                  <span className="text-[10px] text-slate-500">Zero-Tamper Guarantee</span>
                </div>
              </div>

              {/* Main Credential Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Judge Info */}
                <div className="space-y-4">
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                      Appointed Judge
                    </span>
                    <h2 className="text-2xl font-black text-white flex items-center gap-2">
                      <Award className="size-6 text-amber-400" />
                      <span>{result.payload.judgeName}</span>
                    </h2>
                    <span className="text-xs font-mono text-slate-500">{result.payload.judgeId}</span>
                  </div>

                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                      Assigned Judging Tracks
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {result.payload.tracks.map((track) => (
                        <Badge
                          key={track}
                          variant="outline"
                          className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs px-2.5 py-0.5"
                        >
                          <Layers className="size-3 mr-1" />
                          {track}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Event & Metric Info */}
                <div className="space-y-4">
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                      Hackathon Event
                    </span>
                    <p className="text-lg font-bold text-white">{result.payload.event}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
                      <span className="text-[10px] font-mono text-slate-400 block mb-1">
                        Completed Reviews
                      </span>
                      <div className="flex items-center gap-2">
                        <FileCheck2 className="size-4 text-emerald-400" />
                        <span className="text-xl font-extrabold text-white">
                          {result.payload.reviewsCompleted}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
                      <span className="text-[10px] font-mono text-slate-400 block mb-1">
                        Issuance Date
                      </span>
                      <div className="flex items-center gap-1.5 text-xs text-slate-200">
                        <Calendar className="size-3.5 text-cyan-400" />
                        <span>{new Date(result.payload.issuedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cryptographic Proof Block */}
              <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                    <Hash className="size-3 text-cyan-400" />
                    <span>HMAC-SHA256 Digital Signature:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (result.signature) {
                        navigator.clipboard.writeText(result.signature);
                        setCopiedSignature(true);
                        setTimeout(() => setCopiedSignature(false), 2000);
                      }
                    }}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors inline-flex items-center gap-1"
                  >
                    {copiedSignature ? <Check className="size-3" /> : <Copy className="size-3" />}
                    <span>{copiedSignature ? 'Copied' : 'Copy Signature'}</span>
                  </button>
                </div>
                <p className="font-mono text-xs text-emerald-300/90 break-all select-all">
                  {result.signature}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    setCopiedShareUrl(true);
                    setTimeout(() => setCopiedShareUrl(false), 2000);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-white/10 hover:bg-white/15 text-white transition-colors"
                >
                  {copiedShareUrl ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                  <span>{copiedShareUrl ? 'Verification URL Copied!' : 'Copy Verification Link'}</span>
                </button>

                <a
                  href="/projects"
                  className="text-xs text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1"
                >
                  <span>Return to Project Gallery</span>
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </div>
          ) : (
            /* TAMPERED / INVALID CARD */
            <div className="rounded-3xl border border-red-500/40 bg-gradient-to-b from-red-950/20 via-black/40 to-black/60 p-6 sm:p-8 backdrop-blur-xl shadow-[0_0_40px_rgba(239,68,68,0.15)]">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-2xl bg-red-500/10 border border-red-500/40 flex items-center justify-center text-red-400">
                  <ShieldAlert className="size-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-red-400">INVALID OR TAMPERED RECORD</h3>
                  <p className="text-xs text-slate-400">Cryptographic authenticity could not be verified.</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-red-950/30 border border-red-500/20 mb-4">
                <p className="text-xs text-red-200 leading-relaxed font-mono">
                  {result.error || 'The cryptographic signature does not match the payload content.'}
                </p>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                This verification failure occurs if the judge details, evaluation count, or timestamp were modified after issuance, or if the signature was generated with an unauthorized secret key.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Info Card / Explainer */}
      {!result && (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 text-center">
          <ShieldCheck className="size-8 text-cyan-400/80 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white mb-1">Cryptographic Integrity Architecture</h3>
          <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
            Every appointed judge receives an immutable HMAC-SHA256 signed evaluation credential upon completing scoring batches. Third-party institutions can verify authentic records without direct database access.
          </p>
        </div>
      )}
    </div>
  );
}
