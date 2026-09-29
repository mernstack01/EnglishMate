"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BookOpen,
  Layers,
  Sparkles,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Flame,
  RotateCcw,
  Trophy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  submitDailyAnswerAction,
  startDailySessionAction,
} from "../daily-actions";
import { grammarExerciseTypeLabels } from "@/features/grammar/constants";
import type {
  DailySessionStateDTO,
  DailyQuestionDTO,
  DailySessionSummaryDTO,
} from "@/types/daily-learning";

interface DailyLearningRunnerProps {
  session: DailySessionStateDTO;
  summary?: DailySessionSummaryDTO | null;
}

export function DailyLearningRunner({
  session,
  summary: initialSummary,
}: DailyLearningRunnerProps) {
  const [questions, setQuestions] = useState<DailyQuestionDTO[]>(
    session.questions,
  );
  const [currentIndex, setCurrentIndex] = useState(session.currentIndex);
  const [isCompleted, setIsCompleted] = useState(session.isCompleted);
  const [summary] = useState<DailySessionSummaryDTO | null>(
    initialSummary || null,
  );

  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [typingInput, setTypingInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    show: boolean;
    isCorrect: boolean;
    correctAnswer: string;
    explanation?: string;
  } | null>(null);

  const [activeSeconds, setActiveSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const currentQ = questions[currentIndex];
  const prevQ = currentIndex > 0 ? questions[currentIndex - 1] : null;
  const isModuleTransition =
    prevQ && currentQ && prevQ.module !== currentQ.module;

  const progressPercent = Math.min(
    100,
    Math.round(
      (questions.filter((q) => q.isAnswered).length /
        Math.max(1, questions.length)) *
        100,
    ),
  );

  const handleSelectOption = (option: string) => {
    if (feedback?.show || isSubmitting) return;
    setSelectedAnswer(option);
    handleSubmitAnswer(option);
  };

  const handleTypingSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (feedback?.show || isSubmitting || !typingInput.trim()) return;
    handleSubmitAnswer(typingInput.trim());
  };

  const handleSubmitAnswer = async (answer: string) => {
    if (!currentQ || isSubmitting) return;
    setIsSubmitting(true);

    const elapsedSeconds = Math.max(1, Math.min(120, activeSeconds || 5));
    setActiveSeconds(0);

    try {
      const res = await submitDailyAnswerAction(
        session.id,
        currentQ.sessionItemId,
        answer,
        elapsedSeconds,
      );

      if (res.data) {
        const result = res.data;

        // Update current question in state
        const nextQuestions = [...questions];
        nextQuestions[currentIndex] = {
          ...currentQ,
          isAnswered: true,
          isCorrect: result.isCorrect,
          correctAnswers: result.correctAnswer
            ? [result.correctAnswer]
            : currentQ.correctAnswers,
        };

        // If wrong answer was reinserted later in queue
        if (result.reinsertedQuestion && result.reinsertIndex !== undefined) {
          nextQuestions.splice(
            result.reinsertIndex,
            0,
            result.reinsertedQuestion,
          );
        }

        setQuestions(nextQuestions);

        if (!result.isCorrect) {
          // Show explanation feedback before advancing
          setFeedback({
            show: true,
            isCorrect: false,
            correctAnswer: result.correctAnswer,
            explanation: result.explanation,
          });
        } else {
          // If correct, advance after brief micro-delay
          setFeedback({
            show: true,
            isCorrect: true,
            correctAnswer: result.correctAnswer,
          });

          setTimeout(() => {
            advanceNext(nextQuestions, result.isCompleted);
          }, 800);
        }

        if (result.isCompleted) {
          setIsCompleted(true);
        }
      }
    } catch {
      // Error handling
    } finally {
      setIsSubmitting(false);
    }
  };

  const advanceNext = (
    currentQuestionsList?: DailyQuestionDTO[],
    forceCompleted?: boolean,
  ) => {
    const list = currentQuestionsList || questions;
    setFeedback(null);
    setSelectedAnswer("");
    setTypingInput("");
    setActiveSeconds(0);

    if (forceCompleted || list.every((q) => q.isAnswered)) {
      setIsCompleted(true);
      return;
    }

    const nextUnanswered = list.findIndex(
      (q, idx) => idx > currentIndex && !q.isAnswered,
    );

    if (nextUnanswered !== -1) {
      setCurrentIndex(nextUnanswered);
    } else {
      // Fallback search from beginning
      const firstUnanswered = list.findIndex((q) => !q.isAnswered);
      if (firstUnanswered !== -1) {
        setCurrentIndex(firstUnanswered);
      } else {
        setIsCompleted(true);
      }
    }
  };

  // COMPLETION SCREEN
  if (isCompleted || !currentQ) {
    const totalAnswered = questions.filter((q) => q.isAnswered).length;
    const totalCorrect = questions.filter((q) => q.isCorrect).length;
    const overallAccuracy =
      totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
    const mistakesCount = totalAnswered - totalCorrect;

    // Calculate module breakdowns
    const vocabQs = questions.filter((q) => q.module === "VOCABULARY");
    const synQs = questions.filter((q) => q.module === "SYNONYMS");
    const grammarQs = questions.filter((q) => q.module === "GRAMMAR");

    const getBreakdown = (list: DailyQuestionDTO[]) => {
      const answered = list.filter((q) => q.isAnswered).length;
      const correct = list.filter((q) => q.isCorrect).length;
      const acc = answered > 0 ? Math.round((correct / answered) * 100) : 0;
      return { total: answered, correct, acc };
    };

    const vocabStats = getBreakdown(vocabQs);
    const synStats = getBreakdown(synQs);
    const grammarStats = getBreakdown(grammarQs);

    return (
      <div className="mx-auto max-w-2xl space-y-6 py-6 sm:py-10">
        <Card className="overflow-hidden border border-border/80 p-6 sm:p-8 text-center space-y-6">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Trophy className="size-8" />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {session.type === "MISTAKES"
                ? "Mistakes Practice Complete!"
                : "Today's Learning Complete!"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Great progress! You finished today’s personalized commute plan.
            </p>
          </div>

          {/* Core Metric Highlights */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-2">
            <div className="rounded-xl border bg-card/60 p-3.5">
              <p className="text-2xl font-bold text-foreground">
                {totalAnswered}
              </p>
              <p className="text-xs text-muted-foreground">Questions</p>
            </div>
            <div className="rounded-xl border bg-card/60 p-3.5">
              <p className="text-2xl font-bold text-primary">
                {overallAccuracy}%
              </p>
              <p className="text-xs text-muted-foreground">Accuracy</p>
            </div>
            <div className="rounded-xl border bg-card/60 p-3.5">
              <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                {mistakesCount}
              </p>
              <p className="text-xs text-muted-foreground">Mistakes</p>
            </div>
            <div className="rounded-xl border bg-card/60 p-3.5">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1">
                <Flame className="size-5 fill-amber-500 text-amber-500" />
                {summary?.currentStreak || 1}
              </p>
              <p className="text-xs text-muted-foreground">Day Streak</p>
            </div>
          </div>

          {/* Module Performance Breakdown */}
          <div className="rounded-xl border bg-secondary/30 p-4 text-left space-y-3">
            <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Module Performance
            </h3>

            <div className="divide-y divide-border/60">
              {vocabStats.total > 0 && (
                <div className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <BookOpen className="size-4 text-primary" />
                    <span>Vocabulary</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold">
                      {vocabStats.correct} / {vocabStats.total}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({vocabStats.acc}%)
                    </span>
                  </div>
                </div>
              )}

              {synStats.total > 0 && (
                <div className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Layers className="size-4 text-purple-500" />
                    <span>Synonyms</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold">
                      {synStats.correct} / {synStats.total}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({synStats.acc}%)
                    </span>
                  </div>
                </div>
              )}

              {grammarStats.total > 0 && (
                <div className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-emerald-500" />
                    <span>Grammar</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold">
                      {grammarStats.correct} / {grammarStats.total}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({grammarStats.acc}%)
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/learn">
                Back to Learn <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
            {mistakesCount > 0 && (
              <Button
                asChild
                variant="outline"
                size="lg"
                className="w-full sm:w-auto"
              >
                <Link href="/mistakes">Review Mistakes ({mistakesCount})</Link>
              </Button>
            )}
            <Button
              variant="ghost"
              size="lg"
              className="w-full sm:w-auto text-muted-foreground"
              onClick={() => startDailySessionAction({ forceNew: true })}
            >
              Practice 5 More
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // QUESTION RUNNER UI
  const getModuleBadge = (mod: string, sub?: string) => {
    if (mod === "VOCABULARY") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          <BookOpen className="size-3.5" /> VOCABULARY
        </span>
      );
    }
    if (mod === "SYNONYMS") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-purple-500/10 px-2.5 py-1 text-xs font-semibold text-purple-600 dark:text-purple-400">
          <Layers className="size-3.5" /> SYNONYMS
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        <Sparkles className="size-3.5" /> GRAMMAR {sub ? `· ${sub}` : ""}
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-4 sm:py-6">
      {/* Top Header: Progress & Question Count */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
          <span className="flex items-center gap-1.5">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <span className="font-semibold text-foreground">
            {progressPercent}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Lightweight Module Transition Pill */}
      {isModuleTransition && (
        <div className="animate-in fade-in flex items-center justify-center">
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            Next:{" "}
            {currentQ.module === "GRAMMAR"
              ? `Grammar · ${currentQ.topicTitle || "Exercise"}`
              : currentQ.module === "SYNONYMS"
                ? "Synonyms Practice"
                : "Vocabulary Review"}
          </span>
        </div>
      )}

      {/* Main Question Card */}
      <Card className="overflow-hidden border border-border/80 p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {getModuleBadge(currentQ.module, currentQ.topicTitle)}
            {currentQ.module === "GRAMMAR" && (
              <span className="inline-flex rounded-md bg-secondary/80 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                {(grammarExerciseTypeLabels as Record<string, string>)[
                  currentQ.exerciseType
                ] || currentQ.exerciseType}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {session.type === "MISTAKES" ? "Mistakes Review" : "Today's Plan"}
          </span>
        </div>

        {/* Prompt */}
        <div className="space-y-2">
          {currentQ.module === "GRAMMAR" &&
            currentQ.exerciseType === "SENTENCE_CORRECTION" && (
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Correct this sentence:
              </p>
            )}
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {currentQ.prompt || currentQ.question}
          </h2>
          {currentQ.subPrompt && (
            <p className="text-xs sm:text-sm text-muted-foreground">
              {currentQ.subPrompt}
            </p>
          )}
        </div>

        {/* Multiple Choice Options */}
        {(() => {
          const effectiveOptions =
            currentQ.options && currentQ.options.length > 0
              ? currentQ.options
              : currentQ.exerciseType === "TRUE_FALSE"
                ? ["True", "False"]
                : undefined;

          if (effectiveOptions && effectiveOptions.length > 0) {
            return (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {effectiveOptions.map((option, idx) => {
                  const isSelected = selectedAnswer === option;
                  let btnClass =
                    "border bg-card/60 hover:bg-accent/80 text-left justify-start h-auto py-3 px-4";

                  if (feedback?.show) {
                    const isCorrectOption =
                      feedback.correctAnswer?.toLowerCase() ===
                        option.toLowerCase() ||
                      currentQ.correctAnswers?.some(
                        (ca) => ca.toLowerCase() === option.toLowerCase(),
                      );

                    if (isCorrectOption) {
                      btnClass =
                        "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 justify-start h-auto py-3 px-4";
                    } else if (isSelected && !feedback.isCorrect) {
                      btnClass =
                        "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300 justify-start h-auto py-3 px-4";
                    }
                  }

                  return (
                    <Button
                      key={idx}
                      data-testid="daily-option-button"
                      variant="outline"
                      className={btnClass}
                      disabled={feedback?.show || isSubmitting}
                      onClick={() => handleSelectOption(option)}
                    >
                      <span className="font-semibold mr-2 text-muted-foreground">
                        {String.fromCharCode(65 + idx)}.
                      </span>
                      <span className="flex-1 text-sm">{option}</span>
                      {feedback?.show &&
                        (feedback.correctAnswer?.toLowerCase() ===
                          option.toLowerCase() ||
                          currentQ.correctAnswers?.some(
                            (ca) => ca.toLowerCase() === option.toLowerCase(),
                          )) && (
                          <Check className="size-4 text-emerald-500 ml-2" />
                        )}
                    </Button>
                  );
                })}
              </div>
            );
          }

          return (
            <form onSubmit={handleTypingSubmit} className="space-y-3">
              <Input
                value={typingInput}
                onChange={(e) => setTypingInput(e.target.value)}
                placeholder={
                  currentQ.module === "GRAMMAR"
                    ? currentQ.exerciseType === "FILL_BLANK"
                      ? "Type missing word(s)..."
                      : currentQ.exerciseType === "SENTENCE_CORRECTION"
                        ? "Type the corrected sentence..."
                        : "Type your answer here..."
                    : currentQ.module === "SYNONYMS"
                      ? "Type a synonym..."
                      : "Type your answer here..."
                }
                disabled={feedback?.show || isSubmitting}
                autoFocus
                className="h-12 text-base"
              />
              {!feedback?.show && (
                <Button
                  type="submit"
                  disabled={!typingInput.trim() || isSubmitting}
                  className="w-full sm:w-auto"
                >
                  Submit Answer
                </Button>
              )}
            </form>
          );
        })()}

        {/* Feedback Card for Incorrect Answer */}
        {feedback?.show && !feedback.isCorrect && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 space-y-3">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold text-sm">
              <XCircle className="size-5" /> Incorrect
            </div>

            <div className="text-sm space-y-1">
              <p className="text-muted-foreground">Correct answer:</p>
              <p className="font-bold text-foreground">
                {feedback.correctAnswer}
              </p>
            </div>

            {feedback.explanation && (
              <div className="text-xs text-muted-foreground border-t border-rose-500/20 pt-2">
                <span className="font-semibold text-foreground">
                  Explanation:
                </span>{" "}
                {feedback.explanation}
              </div>
            )}

            <p className="text-xs text-muted-foreground italic flex items-center gap-1.5">
              <RotateCcw className="size-3.5" />
              This item will return later in this session.
            </p>

            <Button
              size="sm"
              onClick={() => advanceNext()}
              className="w-full sm:w-auto mt-2"
            >
              Continue <ArrowRight className="ml-1 size-4" />
            </Button>
          </div>
        )}

        {/* Feedback Card for Correct Answer */}
        {feedback?.show && feedback.isCorrect && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center justify-between text-emerald-700 dark:text-emerald-300 text-sm font-semibold">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-500" /> Correct!
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
