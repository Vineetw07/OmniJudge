'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Users,
  Award,
  AlertCircle,
  FileCheck,
  Send,
  Layers,
  Sparkles,
} from 'lucide-react';

export interface ProjectItem {
  id: string;
  title: string;
  summary: string;
  repoUrl: string;
  trackId: string;
  trackName: string;
  teamName: string;
  submittedAt: string;
}

export interface RubricCriterionItem {
  id: string;
  name: string;
  weight: number;
  maxScore: number;
}

export interface ExistingScoreItem {
  id: string;
  projectId: string;
  criterionId: string;
  value: number;
  comment: string;
}

export interface JudgePortalClientProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  assignedTracks: { id: string; name: string }[];
  projects: ProjectItem[];
  criteria: RubricCriterionItem[];
  initialScores: ExistingScoreItem[];
}

export function JudgePortalClient({
  user,
  assignedTracks,
  projects,
  criteria,
  initialScores,
}: JudgePortalClientProps) {
  // Score mapping: projectId -> criterionId -> score value
  const [scoresMap, setScoresMap] = React.useState<Map<string, Map<string, number>>>(() => {
    const map = new Map<string, Map<string, number>>();
    for (const s of initialScores) {
      if (!map.has(s.projectId)) {
        map.set(s.projectId, new Map());
      }
      map.get(s.projectId)!.set(s.criterionId, s.value);
    }
    return map;
  });

  // Comments mapping: projectId -> comment
  const [commentsMap, setCommentsMap] = React.useState<Map<string, string>>(() => {
    const map = new Map<string, string>();
    for (const s of initialScores) {
      if (s.comment && !map.has(s.projectId)) {
        map.set(s.projectId, s.comment);
      }
    }
    return map;
  });

  // Currently selected project for evaluation
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>(() => {
    return projects.length > 0 ? projects[0].id : '';
  });

  // Form state for current project
  const [currentScores, setCurrentScores] = React.useState<{ [criterionId: string]: number }>({});
  const [currentComment, setCurrentComment] = React.useState<string>('');
  const [submitting, setSubmitting] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Sync form inputs when selected project changes
  React.useEffect(() => {
    if (!selectedProjectId) return;

    const existingProjectScores = scoresMap.get(selectedProjectId);
    const initialFormScores: { [criterionId: string]: number } = {};

    for (const crit of criteria) {
      const val = existingProjectScores?.get(crit.id);
      initialFormScores[crit.id] = val !== undefined ? val : 3; // Default to neutral 3/5
    }

    setCurrentScores(initialFormScores);
    setCurrentComment(commentsMap.get(selectedProjectId) || '');
    setStatusMessage(null);
  }, [selectedProjectId, scoresMap, commentsMap, criteria]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // Calculate live composite score for current project
  const compositeScore = React.useMemo(() => {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const crit of criteria) {
      const val = currentScores[crit.id];
      if (typeof val === 'number') {
        weightedSum += val * crit.weight;
        totalWeight += crit.weight;
      }
    }

    return totalWeight > 0 ? (weightedSum / totalWeight).toFixed(2) : '0.00';
  }, [currentScores, criteria]);

  // Check if project is scored
  const isProjectScored = (projectId: string) => {
    return scoresMap.has(projectId) && (scoresMap.get(projectId)?.size || 0) > 0;
  };

  const scoredCount = projects.filter((p) => isProjectScored(p.id)).length;
  const progressPercent = projects.length > 0 ? Math.round((scoredCount / projects.length) * 100) : 0;

  const handleScoreChange = (criterionId: string, value: number) => {
    setCurrentScores((prev) => ({
      ...prev,
      [criterionId]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    setSubmitting(true);
    setStatusMessage(null);

    try {
      const payloadScores = criteria.map((crit) => ({
        criterionId: crit.id,
        value: currentScores[crit.id] ?? 0,
      }));

      const res = await fetch('/api/judge/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject.id,
          scores: payloadScores,
          comment: currentComment.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit score');
      }

      // Update local state maps upon successful submission
      setScoresMap((prev) => {
        const next = new Map(prev);
        const projMap = new Map<string, number>();
        for (const item of payloadScores) {
          projMap.set(item.criterionId, item.value);
        }
        next.set(selectedProject.id, projMap);
        return next;
      });

      setCommentsMap((prev) => {
        const next = new Map(prev);
        next.set(selectedProject.id, currentComment.trim());
        return next;
      });

      setStatusMessage({
        type: 'success',
        text: `Scores for "${selectedProject.title}" saved successfully!`,
      });
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight">DOGFOOD 2026</span>
            </Link>
            <Badge variant="secondary" className="text-xs font-normal">
              Judge Console
            </Badge>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="hidden sm:flex flex-col text-right">
              <span className="font-semibold text-foreground">{user.name}</span>
              <span className="text-muted-foreground">{user.email}</span>
            </div>
            <Link href="/projects">
              <Button variant="outline" size="sm">
                Gallery
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        {/* Banner / Track Info */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-card border shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary font-medium text-xs">
              <Award className="size-4" />
              <span>Rubric-Based Evaluation</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Assigned Project Reviews</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Evaluate submissions according to the official weighted rubric. Your scores remain private and isolated.
            </p>
          </div>

          {/* Progress Pill */}
          <div className="flex items-center gap-4 bg-muted/40 p-3 rounded-xl border">
            <div className="space-y-1 min-w-[120px]">
              <div className="flex justify-between text-xs font-medium">
                <span>Evaluated</span>
                <span>{scoredCount} / {projects.length}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold">{progressPercent}%</span>
            </div>
          </div>
        </div>

        {/* Assigned Tracks Badge Bar */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-muted-foreground flex items-center gap-1 font-medium">
            <Layers className="size-3.5" /> Assigned Tracks:
          </span>
          {assignedTracks.map((t) => (
            <Badge key={t.id} variant="outline" className="font-normal text-xs">
              {t.name}
            </Badge>
          ))}
        </div>

        {/* 2-Column Judging Workspace */}
        {projects.length === 0 ? (
          <div className="text-center py-20 border rounded-2xl bg-card shadow-sm space-y-3">
            <Layers className="size-10 text-muted-foreground mx-auto" />
            <h3 className="text-lg font-semibold">No assigned projects</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              You are currently not assigned to any tracks with submitted projects.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Project Selector List */}
            <div className="lg:col-span-5 space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                Submissions ({projects.length})
              </div>
              <div className="space-y-2.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                {projects.map((project) => {
                  const scored = isProjectScored(project.id);
                  const isSelected = project.id === selectedProjectId;

                  return (
                    <motion.div
                      key={project.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setSelectedProjectId(project.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-primary/5 border-primary shadow-sm ring-1 ring-primary/20'
                          : 'bg-card hover:bg-muted/40 border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="font-semibold text-sm line-clamp-1">
                          {project.title}
                        </span>
                        {scored ? (
                          <Badge
                            variant="default"
                            className="bg-emerald-600 hover:bg-emerald-600 text-[10px] py-0 px-2 flex items-center gap-1 shrink-0"
                          >
                            <CheckCircle2 className="size-2.5" />
                            <span>Scored</span>
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-amber-600 border-amber-300 dark:border-amber-700 py-0 px-2 flex items-center gap-1 shrink-0"
                          >
                            <Clock className="size-2.5" />
                            <span>Pending</span>
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="truncate">{project.teamName}</span>
                        <Badge variant="secondary" className="text-[10px] font-normal py-0">
                          {project.trackName}
                        </Badge>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Right: Scoring Console Form */}
            {selectedProject && (
              <div className="lg:col-span-7">
                <Card className="border shadow-sm">
                  <CardHeader className="space-y-3 pb-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {selectedProject.trackName}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">
                          {selectedProject.id}
                        </span>
                      </div>
                      {selectedProject.repoUrl && (
                        <a
                          href={selectedProject.repoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="size-3.5" />
                          <span>View Code</span>
                        </a>
                      )}
                    </div>

                    <div>
                      <CardTitle className="text-xl font-bold">
                        {selectedProject.title}
                      </CardTitle>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                        <Users className="size-3.5" />
                        <span>{selectedProject.teamName}</span>
                      </div>
                    </div>

                    <CardDescription className="text-xs leading-relaxed line-clamp-4 bg-muted/40 p-3 rounded-lg border">
                      {selectedProject.summary}
                    </CardDescription>
                  </CardHeader>

                  <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-6 pt-2">
                      {/* Rubric Criteria Inputs */}
                      <div className="space-y-5">
                        <div className="flex items-center justify-between border-b pb-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Rubric Criteria
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Weight / Rating (0 to 5)
                          </span>
                        </div>

                        {criteria.map((crit) => {
                          const val = currentScores[crit.id] ?? 3;

                          return (
                            <div
                              key={crit.id}
                              className="p-3.5 rounded-xl border bg-muted/20 space-y-2.5 transition-colors hover:border-border"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="font-semibold text-sm capitalize">
                                    {crit.name}
                                  </span>
                                  <Badge
                                    variant="secondary"
                                    className="ml-2 text-[10px] font-normal"
                                  >
                                    {crit.weight}x weight
                                  </Badge>
                                </div>
                                <span className="font-mono text-sm font-bold text-primary">
                                  {val} / {crit.maxScore}
                                </span>
                              </div>

                              {/* 0-5 Quick Rating Buttons */}
                              <div className="grid grid-cols-6 gap-1.5">
                                {[0, 1, 2, 3, 4, 5].map((num) => (
                                  <button
                                    key={num}
                                    type="button"
                                    onClick={() => handleScoreChange(crit.id, num)}
                                    className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                                      val === num
                                        ? 'bg-primary text-primary-foreground border-primary shadow-sm ring-1 ring-primary'
                                        : 'bg-background hover:bg-muted/80 text-foreground border-input'
                                    }`}
                                  >
                                    {num}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Qualitative Comments */}
                      <div className="space-y-2">
                        <Label htmlFor="comment" className="text-xs font-medium">
                          Judges Feedback & Comments (Optional)
                        </Label>
                        <Textarea
                          id="comment"
                          placeholder="Provide constructive feedback, architectural notes, or standout features..."
                          value={currentComment}
                          onChange={(e) => setCurrentComment(e.target.value)}
                          rows={3}
                          className="text-xs resize-none"
                        />
                      </div>

                      {/* Composite Score Pill */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20">
                        <div className="flex items-center gap-2 text-xs">
                          <Sparkles className="size-4 text-primary" />
                          <span className="font-medium text-foreground">
                            Weighted Raw Composite:
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-extrabold text-primary font-mono">
                            {compositeScore}
                          </span>
                          <span className="text-xs text-muted-foreground">/ 5.00</span>
                        </div>
                      </div>

                      {/* Status Notification */}
                      <AnimatePresence>
                        {statusMessage && (
                          <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            className={`p-3 text-xs rounded-xl flex items-start gap-2 border ${
                              statusMessage.type === 'success'
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                                : 'bg-destructive/10 text-destructive border-destructive/20'
                            }`}
                          >
                            {statusMessage.type === 'success' ? (
                              <FileCheck className="size-4 shrink-0 mt-0.5" />
                            ) : (
                              <AlertCircle className="size-4 shrink-0 mt-0.5" />
                            )}
                            <span>{statusMessage.text}</span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>

                    <CardFooter className="flex justify-between items-center border-t pt-4">
                      <span className="text-xs text-muted-foreground">
                        {isProjectScored(selectedProject.id)
                          ? 'Previously evaluated — submit to update'
                          : 'Not yet submitted'}
                      </span>
                      <Button
                        type="submit"
                        disabled={submitting}
                        className="flex items-center gap-1.5"
                      >
                        <Send className="size-3.5" />
                        <span>
                          {submitting
                            ? 'Saving...'
                            : isProjectScored(selectedProject.id)
                            ? 'Update Evaluation'
                            : 'Submit Evaluation'}
                        </span>
                      </Button>
                    </CardFooter>
                  </form>
                </Card>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
