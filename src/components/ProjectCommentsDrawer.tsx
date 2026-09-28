'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  MessageSquare,
  Send,
  AlertCircle,
  Loader2,
  Clock,
  LogIn,
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ProjectWithRelations } from '@/app/projects/projects-client';

export interface CommentItem {
  id: string;
  projectId: string;
  userId: string;
  authorName: string;
  authorRole: 'participant' | 'judge' | 'visitor' | 'organizer' | 'admin' | string;
  content: string;
  createdAt: string;
}

interface ProjectCommentsDrawerProps {
  project: ProjectWithRelations | null;
  isOpen: boolean;
  onClose: () => void;
  onCommentCountChange?: (projectId: string, newCount: number) => void;
  currentUserId?: string | null;
  currentUserRole?: string | null;
}

/**
 * Format relative timestamp: "just now", "X min ago", "X hours ago", etc.
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Author Role Badge with exact required palette:
 * - Participant in emerald/cyan
 * - Judge in amber/indigo
 * - Visitor in slate
 * - Organizer / Admin in purple
 */
function RoleBadge({ role }: { role: string }) {
  const r = (role || 'visitor').toLowerCase();
  let badgeClasses = 'border-slate-500/40 bg-slate-500/10 text-slate-300';
  let label = 'Visitor';

  if (r === 'organizer' || r === 'admin') {
    badgeClasses = 'border-purple-500/40 bg-purple-500/10 text-purple-300';
    label = r === 'admin' ? 'Admin' : 'Organizer';
  } else if (r === 'judge') {
    badgeClasses = 'border-amber-500/40 bg-amber-500/10 text-amber-300';
    label = 'Judge';
  } else if (r === 'participant') {
    badgeClasses = 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
    label = 'Participant';
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${badgeClasses}`}
    >
      {label}
    </span>
  );
}

export function ProjectCommentsDrawer({
  project,
  isOpen,
  onClose,
  onCommentCountChange,
  currentUserId,
  currentUserRole,
}: ProjectCommentsDrawerProps) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form states
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);

  const commentsEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep callback ref updated without triggering fetch effect
  const onCommentCountChangeRef = useRef(onCommentCountChange);
  useEffect(() => {
    onCommentCountChangeRef.current = onCommentCountChange;
  }, [onCommentCountChange]);

  // Close on Escape key press
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Rate-limit countdown timer
  useEffect(() => {
    if (rateLimitCountdown === null) return;
    if (rateLimitCountdown <= 0) {
      setRateLimitCountdown(null);
      setSubmitError(null);
      return;
    }

    const timer = setTimeout(() => {
      setRateLimitCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [rateLimitCountdown]);

  // Fetch comments when drawer opens or active project changes
  const projectId = project?.id;
  useEffect(() => {
    if (!isOpen || !projectId) {
      setComments([]);
      setContent('');
      setSubmitError(null);
      setFetchError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setFetchError(null);

    fetch(`/api/community/comments?projectId=${encodeURIComponent(projectId)}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP error ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        const fetchedComments: CommentItem[] = data.comments || [];
        setComments(fetchedComments);
        onCommentCountChangeRef.current?.(projectId, fetchedComments.length);
      })
      .catch((err) => {
        if (!isMounted) return;
        setFetchError(err.message || 'Failed to load comments');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, projectId]);

  // Submit comment handler
  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!project) return;

    const trimmed = content.trim();
    if (!trimmed) {
      setSubmitError('Comment cannot be empty.');
      return;
    }
    if (trimmed.length > 500) {
      setSubmitError('Comment must be 500 characters or fewer.');
      return;
    }
    if (rateLimitCountdown !== null && rateLimitCountdown > 0) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    // Optimistic temporary comment
    const tempId = `temp_${Date.now()}`;
    const optimisticComment: CommentItem = {
      id: tempId,
      projectId: project.id,
      userId: currentUserId || 'local_user',
      authorName: 'You',
      authorRole: currentUserRole || 'participant',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    // Optimistic prepend
    setComments((prev) => [optimisticComment, ...prev]);
    const previousContent = content;
    setContent('');

    try {
      const res = await fetch('/api/community/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: project.id,
          content: trimmed,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Roll back optimistic comment
        setComments((prev) => prev.filter((c) => c.id !== tempId));
        setContent(previousContent);

        if (res.status === 429) {
          setRateLimitCountdown(10);
          setSubmitError(
            data.error || 'Rate limit exceeded: 1 comment per 10s. Please wait a moment.'
          );
        } else if (res.status === 401) {
          setSubmitError('You must be signed in to post comments.');
        } else {
          setSubmitError(data.error || 'Failed to post comment. Please try again.');
        }
        return;
      }

      // Success: replace temp comment with confirmed server comment
      const realComment: CommentItem = {
        id: data.comment.id,
        projectId: data.comment.projectId,
        userId: data.comment.userId,
        authorName: data.comment.authorName,
        authorRole: currentUserRole || 'participant',
        content: data.comment.content,
        createdAt: data.comment.createdAt,
      };

      setComments((prev) =>
        prev.map((c) => (c.id === tempId ? realComment : c))
      );

      // Notify parent of updated comment count
      onCommentCountChangeRef.current?.(project.id, comments.length + 1);
    } catch {
      // Roll back on network failure
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setContent(previousContent);
      setSubmitError('Network error while posting comment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Handle Ctrl+Enter to submit
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }

  if (!isOpen || !project) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Drawer Panel in Midnight Obsidian */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="relative z-50 w-full max-w-lg md:max-w-xl bg-[#0a0d14]/95 border-l border-white/[0.08] backdrop-blur-xl h-full shadow-2xl flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label={`Feedback stream for ${project.title}`}
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-white/[0.08] flex items-start justify-between gap-4 bg-white/[0.02]">
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-[10px] font-semibold"
                  >
                    {project.track?.name || 'General Track'}
                  </Badge>
                  <span className="text-[11px] font-mono text-slate-500">
                    {project.id}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white tracking-tight truncate">
                  {project.title}
                </h2>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <MessageSquare className="size-3.5 text-cyan-400" />
                  <span>
                    {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-500">
                    Team: {project.team?.name || 'Independent'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close comment drawer"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors border border-transparent hover:border-white/10"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Comments List Stream */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                  <Loader2 className="size-6 text-cyan-400 animate-spin" />
                  <p className="text-xs">Loading feedback stream...</p>
                </div>
              ) : fetchError ? (
                <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Unable to load comments</p>
                    <p className="text-red-400 mt-0.5">{fetchError}</p>
                  </div>
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-16 px-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                  <div className="size-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto mb-3">
                    <MessageSquare className="size-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">No comments yet</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                    Be the first to share constructive thoughts, questions, or recognition for this submission!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <article
                      key={comment.id}
                      className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:border-white/[0.12] transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="size-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-[10px] font-bold text-cyan-300 uppercase shrink-0">
                            {comment.authorName ? comment.authorName.charAt(0) : 'U'}
                          </div>
                          <span className="text-xs font-semibold text-white truncate">
                            {comment.authorName}
                          </span>
                          <RoleBadge role={comment.authorRole} />
                        </div>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1 shrink-0 font-mono">
                          <Clock className="size-3 text-slate-600" />
                          {formatRelativeTime(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-wrap break-words pl-8">
                        {comment.content}
                      </p>
                    </article>
                  ))}
                  <div ref={commentsEndRef} />
                </div>
              )}
            </div>

            {/* Post Comment Input Form */}
            <div className="p-4 border-t border-white/[0.08] bg-[#07090e]/80 backdrop-blur-md">
              {submitError && (
                <div className="mb-3 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs flex items-start justify-between gap-2 animate-in fade-in-0 duration-150">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <div>
                      <span>{submitError}</span>
                      {submitError.includes('signed in') && (
                        <div className="mt-1">
                          <Link
                            href="/login"
                            className="inline-flex items-center gap-1 text-cyan-400 hover:underline font-medium"
                          >
                            <LogIn className="size-3" /> Go to Login
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubmitError(null)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-2.5">
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => {
                      if (e.target.value.length <= 500) {
                        setContent(e.target.value);
                      }
                    }}
                    onKeyDown={handleKeyDown}
                    disabled={isSubmitting || (rateLimitCountdown !== null && rateLimitCountdown > 0)}
                    placeholder="Share constructive feedback or questions with the team (Ctrl+Enter to post)..."
                    rows={3}
                    maxLength={500}
                    className="w-full resize-none p-3 text-xs sm:text-sm rounded-xl bg-white/[0.04] border border-white/[0.1] text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all disabled:opacity-50"
                    aria-label="Write a comment"
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-mono ${
                        content.length >= 500
                          ? 'text-red-400 font-bold'
                          : content.length >= 450
                          ? 'text-amber-400'
                          : 'text-slate-500'
                      }`}
                    >
                      {content.length}/500 chars
                    </span>
                    {rateLimitCountdown !== null && rateLimitCountdown > 0 && (
                      <span className="text-[11px] text-amber-400 font-medium">
                        (Cooldown: {rateLimitCountdown}s)
                      </span>
                    )}
                  </div>

                  <Button
                    type="submit"
                    size="sm"
                    disabled={
                      !content.trim() ||
                      isSubmitting ||
                      (rateLimitCountdown !== null && rateLimitCountdown > 0)
                    }
                    className="h-8 px-4 text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_15px_rgba(56,189,248,0.25)] border-0 disabled:opacity-40"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                        Posting...
                      </>
                    ) : (
                      <>
                        <Send className="size-3.5 mr-1.5" />
                        Post Feedback
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
