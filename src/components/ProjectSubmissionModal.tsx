'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Send,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Lock,
  Unlock,
  Sparkles,
  GitBranch,
  FileText,
  Tag,
  LogIn,
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { ProjectWithRelations } from '@/app/projects/projects-client';

export interface TrackOption {
  id: string;
  name: string;
}

interface ProjectSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  submissionsOpen: boolean;
  submissionsClose?: string | null;
  tracks: TrackOption[];
  currentUserId?: string | null;
  currentUserRole?: string | null;
  onProjectSubmitted?: (newProject: ProjectWithRelations) => void;
}

export function ProjectSubmissionModal({
  isOpen,
  onClose,
  submissionsOpen,
  submissionsClose,
  tracks,
  currentUserId,
  currentUserRole,
  onProjectSubmitted,
}: ProjectSubmissionModalProps) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [trackId, setTrackId] = useState(tracks[0]?.id || 'trk_01');
  const [repoUrl, setRepoUrl] = useState('');
  const [isDraft, setIsDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isAuthenticated = Boolean(currentUserId);
  const isAuthorizedRole =
    currentUserRole === 'participant' ||
    currentUserRole === 'organizer' ||
    currentUserRole === 'admin';

  const resetForm = () => {
    setTitle('');
    setSummary('');
    setRepoUrl('');
    setIsDraft(false);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Project title is required.');
      return;
    }
    if (!summary.trim()) {
      setErrorMsg('Project summary is required.');
      return;
    }

    if (repoUrl && !repoUrl.startsWith('http://') && !repoUrl.startsWith('https://')) {
      setErrorMsg('Repository URL must be a valid URL starting with http:// or https://');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          summary: summary.trim(),
          trackId,
          repoUrl: repoUrl.trim() || undefined,
          isDraft,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          throw new Error(data.error || 'Submissions are closed for this event.');
        } else if (res.status === 401) {
          throw new Error('Please sign in to submit a project.');
        } else if (res.status === 403) {
          throw new Error('Only participants or organizers may submit projects.');
        } else {
          throw new Error(data.error || 'Failed to submit project. Please try again.');
        }
      }

      setSuccessMsg(
        isDraft
          ? 'Draft project saved successfully!'
          : 'Project successfully submitted to the hackathon gallery!'
      );

      if (data.project && onProjectSubmitted) {
        // Construct full relation object for immediate gallery display
        const selectedTrack = tracks.find((t) => t.id === trackId) || {
          id: trackId,
          name: 'General',
        };
        const completeProject: ProjectWithRelations = {
          ...data.project,
          submittedAt: new Date(data.project.submittedAt),
          team: {
            id: data.project.teamId,
            name: 'Your Team',
          },
          track: {
            id: selectedTrack.id,
            name: selectedTrack.name,
            eventId: data.project.eventId,
          },
        };
        onProjectSubmitted(completeProject);
      }

      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'An error occurred while submitting.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-xl rounded-2xl bg-slate-900/95 border border-white/10 shadow-2xl p-6 sm:p-7 overflow-hidden z-10 max-h-[90vh] flex flex-col"
        >
          {/* Subtle Top Glow Accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-emerald-400 to-indigo-500" />

          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <Sparkles className="size-4 text-cyan-400" />
                  Submit Hackathon Project
                </span>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-mono py-0.5 flex items-center gap-1 ${
                    submissionsOpen
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  }`}
                >
                  {submissionsOpen ? (
                    <>
                      <Unlock className="size-2.5" /> OPEN
                    </>
                  ) : (
                    <>
                      <Lock className="size-2.5" /> CLOSED
                    </>
                  )}
                </Badge>
              </div>
              <p className="text-xs text-slate-400">
                {submissionsOpen
                  ? `Add your project to the public gallery. ${
                      submissionsClose
                        ? `Deadline: ${new Date(submissionsClose).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}`
                        : ''
                    }`
                  : 'Submissions are currently closed by the organizer (deadline passed).'}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close dialog"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="py-4 overflow-y-auto space-y-4 flex-1 pr-1">
            {/* Status alerts */}
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs flex items-center gap-2"
              >
                <AlertCircle className="size-4 shrink-0" />
                <span>{errorMsg}</span>
              </motion.div>
            )}

            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2"
              >
                <CheckCircle2 className="size-4 shrink-0" />
                <span>{successMsg}</span>
              </motion.div>
            )}

            {!isAuthenticated ? (
              <div className="text-center py-8 space-y-4">
                <div className="size-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto">
                  <LogIn className="size-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-white">Authentication Required</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    You need to be signed in as a participant or organizer to submit a project.
                  </p>
                </div>
                <Link href="/login">
                  <Button size="sm" className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-medium text-xs">
                    Sign In to Portal
                  </Button>
                </Link>
              </div>
            ) : !isAuthorizedRole ? (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-3">
                <AlertCircle className="size-5 shrink-0" />
                <span>
                  Your current role (<strong className="font-mono">{currentUserRole}</strong>) does not have project submission privileges. Only participants and organizers may submit.
                </span>
              </div>
            ) : !submissionsOpen ? (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-3">
                <Lock className="size-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-rose-200">Submissions Window is Closed</h4>
                  <p className="text-slate-400 mt-1 leading-relaxed">
                    The organizer has locked project submissions. New entries and updates cannot be submitted right now unless an organizer re-opens the portal in the Command Dashboard.
                  </p>
                </div>
              </div>
            ) : (
              <form id="submission-form" onSubmit={handleSubmit} className="space-y-4">
                {/* Title */}
                <div className="space-y-1.5">
                  <label htmlFor="project-title" className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <FileText className="size-3.5 text-cyan-400" />
                    <span>Project Title *</span>
                  </label>
                  <Input
                    id="project-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Quiet Hours, ZeroLeak, NeuralMesh"
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 text-xs focus:border-cyan-500"
                    maxLength={100}
                    required
                  />
                </div>

                {/* Track Selector */}
                <div className="space-y-1.5">
                  <label htmlFor="project-track" className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <Tag className="size-3.5 text-cyan-400" />
                    <span>Track / Category *</span>
                  </label>
                  <select
                    id="project-track"
                    value={trackId}
                    onChange={(e) => setTrackId(e.target.value)}
                    className="w-full h-9 rounded-lg bg-slate-900 border border-white/10 text-white text-xs px-3 focus:outline-none focus:border-cyan-500 transition-colors"
                  >
                    {tracks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Summary */}
                <div className="space-y-1.5">
                  <label htmlFor="project-summary" className="text-xs font-medium text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FileText className="size-3.5 text-cyan-400" />
                      <span>Elevator Pitch / Summary *</span>
                    </span>
                    <span className="text-[10px] text-slate-500">{summary.length}/280</span>
                  </label>
                  <Textarea
                    id="project-summary"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="One-to-two sentence description of what your team built, why it matters, and technical highlights."
                    rows={3}
                    maxLength={280}
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 text-xs focus:border-cyan-500 resize-none"
                    required
                  />
                </div>

                {/* Repo URL */}
                <div className="space-y-1.5">
                  <label htmlFor="project-repo" className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <GitBranch className="size-3.5 text-cyan-400" />
                    <span>Repository URL (optional)</span>
                  </label>
                  <Input
                    id="project-repo"
                    type="url"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/team/project-repo"
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 text-xs focus:border-cyan-500"
                  />
                </div>

                {/* Draft Option */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-slate-200">Save as Draft</span>
                    <span className="text-[10px] text-slate-400">
                      Drafts can be refined before the deadline and won&apos;t be finalized for judging yet.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    id="is-draft"
                    checked={isDraft}
                    onChange={(e) => setIsDraft(e.target.checked)}
                    className="size-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0 cursor-pointer"
                  />
                </div>
              </form>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              className="text-xs border-white/10 hover:bg-white/5 text-slate-300"
            >
              Cancel
            </Button>

            {isAuthenticated && isAuthorizedRole && submissionsOpen && (
              <Button
                type="submit"
                form="submission-form"
                size="sm"
                disabled={isSubmitting || !title.trim() || !summary.trim()}
                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs shadow-[0_0_15px_rgba(56,189,248,0.3)] transition-all flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="size-3.5" />
                    <span>{isDraft ? 'Save Draft' : 'Submit Project'}</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
