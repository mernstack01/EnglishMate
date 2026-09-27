"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  Sparkles,
  Trophy,
  Layers,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { submitSynonymAnswerAction } from "@/features/learning/synonym-actions";
import type { SynonymSessionDTO, SynonymQuestionDTO } from "@/types/synonyms";
import type { ReviewRating } from "@/models/vocabulary-review";
import { cn } from "@/lib/utils";

interface SynonymReviewRunnerProps {
  session: SynonymSessionDTO;
}

export function SynonymReviewRunner({ session }: SynonymReviewRunnerProps) {
  const [questions, setQuestions] = useState<SynonymQuestionDTO[]>(
    session.questions,
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(!!session.completedAt);
  const [sessionCompleted, setSessionCompleted] = useState(false);

  // Per-question state
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const [typingInput, setTypingInput] = useState("");
  const [feedback, setFeedback] = useState<{
    show: boolean;
    isCorrect: boolean;
    correctAnswer: string;
    userAnswer: string;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // State for Match game
  const [matchedLeftId, setMatchedLeftId] = useState<string | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Set<string>>(new Set());

  // Running session statistics
  const [correctCount, setCorrectCount] = useState(session.correctAnswers || 0);
  const [incorrectCount, setIncorrectCount] = useState(
    session.incorrectAnswers || 0,
  );
  const [groupsReviewed, setGroupsReviewed] = useState<
    Array<{ term: string; isCorrect: boolean }>
  >([]);

  const currentQ = questions[currentIndex];
  const progressPercent = Math.min(
    100,
    Math.round((currentIndex / Math.max(1, questions.length)) * 100),
  );

  const submitAnswer = async (ans: string, ratingOverride?: ReviewRating) => {
    if (isSubmitting || !currentQ) return;
    setIsSubmitting(true);

    try {
      const res = await submitSynonymAnswerAction(
        session.id,
        currentIndex,
        ans,
        ratingOverride,
      );

      if (res && "data" in res && res.data) {
        const d = res.data;
        setFeedback({
          show: true,
          isCorrect: d.isCorrect,
          correctAnswer: d.correctAnswer,
          userAnswer: ans,
        });

        if (d.isCorrect) {
          setCorrectCount((prev) => prev + 1);
        } else {
          setIncorrectCount((prev) => prev + 1);
        }

        setGroupsReviewed((prev) => [
          ...prev,
          { term: currentQ.prompt, isCorrect: d.isCorrect },
        ]);

        // If wrong answer was reinserted by the engine
        if (d.reinsertedQuestion && d.reinsertIndex !== undefined) {
          setQuestions((prev) => {
            const next = [...prev];
            next.splice(d.reinsertIndex!, 0, d.reinsertedQuestion!);
            return next;
          });
        }

        if (d.isCompleted) {
          setSessionCompleted(true);
        }
      } else {
        // Fallback local feedback if network/server issue
        setFeedback({
          show: true,
          isCorrect: false,
          correctAnswer: currentQ.correctAnswers?.join(", ") || "",
          userAnswer: ans,
        });
      }
    } catch {
      setFeedback({
        show: true,
        isCorrect: false,
        correctAnswer: currentQ.correctAnswers?.join(", ") || "",
        userAnswer: ans,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectOption = (option: string) => {
    if (feedback?.show || isSubmitting) return;
    setSelectedAnswer(option);
    submitAnswer(option);
  };

  const handleToggleMultiOption = (option: string) => {
    if (feedback?.show || isSubmitting) return;
    const next = new Set(multiSelected);
    if (next.has(option)) {
      next.delete(option);
    } else {
      next.add(option);
    }
    setMultiSelected(next);
  };

  const handleMultiSubmit = () => {
    if (feedback?.show || isSubmitting || multiSelected.size === 0) return;
    const payload = JSON.stringify(Array.from(multiSelected));
    submitAnswer(payload);
  };

  const handleTypingSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (feedback?.show || isSubmitting || !typingInput.trim()) return;
    submitAnswer(typingInput.trim());
  };

  const handleMatchTap = (side: "left" | "right", id: string) => {
    if (feedback?.show || isSubmitting) return;

    if (side === "left") {
      setMatchedLeftId(id);
    } else if (side === "right" && matchedLeftId) {
      if (matchedLeftId === id) {
        // Correct pair!
        const nextSet = new Set(matchedPairs);
        nextSet.add(id);
        setMatchedPairs(nextSet);
        setMatchedLeftId(null);

        const totalNeeded = currentQ.matchPairs?.length || 3;
        if (nextSet.size >= totalNeeded) {
          submitAnswer("MATCHED");
        }
      } else {
        // Mismatched tap
        setMatchedLeftId(null);
      }
    }
  };

  const handleNextQuestion = () => {
    setFeedback(null);
    setSelectedAnswer("");
    setMultiSelected(new Set());
    setTypingInput("");
    setMatchedLeftId(null);
    setMatchedPairs(new Set());

    if (sessionCompleted || currentIndex >= questions.length - 1) {
      setIsCompleted(true);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  // Completion Screen
  if (
    isCompleted ||
    (currentIndex >= questions.length && questions.length > 0)
  ) {
    const totalAnswered = correctCount + incorrectCount || 1;
    const accuracy = Math.round((correctCount / totalAnswered) * 100);

    const improved = groupsReviewed.filter((g) => g.isCorrect);
    const toReview = groupsReviewed.filter((g) => !g.isCorrect);

    return (
      <div className="mx-auto max-w-xl space-y-6">
        <Card className="overflow-hidden border p-6 sm:p-8 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Trophy className="size-8" />
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" /> PRACTICE COMPLETE
          </span>

          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Synonym Session Complete!
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Great work! Spaced repetition schedules have been updated.
          </p>

          {/* Stats Grid */}
          <div className="my-6 grid grid-cols-3 divide-x rounded-2xl border bg-secondary/30 p-4">
            <div>
              <p className="text-2xl font-bold text-foreground">
                {correctCount + incorrectCount}
              </p>
              <p className="text-xs text-muted-foreground">Questions</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {correctCount}
              </p>
              <p className="text-xs text-muted-foreground">Correct</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{accuracy}%</p>
              <p className="text-xs text-muted-foreground">Accuracy</p>
            </div>
          </div>

          {/* Groups list */}
          {(improved.length > 0 || toReview.length > 0) && (
            <div className="text-left space-y-3 border-t pt-5">
              {improved.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold uppercase text-emerald-600 dark:text-emerald-400">
                    Groups Strengthened ({improved.length}):
                  </h2>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {Array.from(new Set(improved.map((g) => g.term))).map(
                      (term, i) => (
                        <span
                          key={i}
                          className="rounded-lg bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"
                        >
                          {term}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              )}

              {toReview.length > 0 && (
                <div className="pt-2">
                  <h2 className="text-xs font-semibold uppercase text-amber-600 dark:text-amber-400">
                    Groups to practice again ({toReview.length}):
                  </h2>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {Array.from(new Set(toReview.map((g) => g.term))).map(
                      (term, i) => (
                        <span
                          key={i}
                          className="rounded-lg bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300"
                        >
                          {term}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action CTAs */}
          <div className="mt-8 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
            <Button asChild size="default" className="w-full sm:w-auto">
              <Link href="/learn/synonyms">
                <Layers className="size-4 mr-2" />
                Back to Synonym Learning
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="default"
              className="w-full sm:w-auto"
            >
              <Link href="/synonyms">View Notebook</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!currentQ) return null;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      {/* Top Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>
            Question {currentIndex + 1} of {questions.length}
          </span>
          <span className="capitalize">
            {currentQ.exerciseType.toLowerCase().replace(/_/g, " ")}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Main Interactive Question Card */}
      <Card className="p-6 sm:p-8 space-y-6">
        {/* Prompt Header */}
        <div className="text-center space-y-2">
          {currentQ.subPrompt && (
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {currentQ.subPrompt}
            </p>
          )}
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
            {currentQ.prompt}
          </h2>
          {currentQ.meaning && (
            <p className="text-sm font-medium text-primary">
              {currentQ.meaning}
            </p>
          )}
        </div>

        {/* 1. RECOGNITION or REVERSE_RECOGNITION: Single Choice Options */}
        {(currentQ.exerciseType === "RECOGNITION" ||
          currentQ.exerciseType === "REVERSE_RECOGNITION") &&
          currentQ.options && (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {currentQ.options.map((option, idx) => {
                const isSelected = selectedAnswer === option;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectOption(option)}
                    disabled={feedback?.show || isSubmitting}
                    className={cn(
                      "flex min-h-14 items-center justify-center rounded-xl border p-4 text-center text-sm font-medium transition-all active:scale-[0.98]",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary font-semibold ring-2 ring-primary/20"
                        : "border-border bg-card hover:border-primary/50 hover:bg-secondary/40",
                      feedback?.show &&
                        option === feedback.correctAnswer &&
                        "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold",
                      feedback?.show &&
                        isSelected &&
                        !feedback.isCorrect &&
                        "border-destructive bg-destructive/10 text-destructive",
                    )}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          )}

        {/* 2. MULTI_ANSWER: Checkbox selection */}
        {currentQ.exerciseType === "MULTI_ANSWER" && currentQ.options && (
          <div className="space-y-4">
            <div className="space-y-2">
              {currentQ.options.map((option, idx) => {
                const isChecked = multiSelected.has(option);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleToggleMultiOption(option)}
                    disabled={feedback?.show || isSubmitting}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border p-3.5 text-left text-sm transition-all",
                      isChecked
                        ? "border-primary bg-primary/10 font-semibold text-primary"
                        : "border-border bg-card hover:bg-secondary/40",
                    )}
                  >
                    <span>{option}</span>
                    <div
                      className={cn(
                        "flex size-5 items-center justify-center rounded-md border",
                        isChecked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/30",
                      )}
                    >
                      {isChecked && <Check className="size-3.5 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {!feedback?.show && (
              <Button
                type="button"
                onClick={handleMultiSubmit}
                disabled={isSubmitting || multiSelected.size === 0}
                className="w-full min-h-12 text-sm font-semibold"
              >
                Submit selection ({multiSelected.size})
              </Button>
            )}
          </div>
        )}

        {/* 3. TYPING: Input box */}
        {currentQ.exerciseType === "TYPING" && (
          <form onSubmit={handleTypingSubmit} className="space-y-3">
            <Input
              type="text"
              value={typingInput}
              onChange={(e) => setTypingInput(e.target.value)}
              placeholder="Type any synonym for this term..."
              disabled={feedback?.show || isSubmitting}
              autoFocus
              className="min-h-12 text-center text-base"
            />
            {!feedback?.show && (
              <Button
                type="submit"
                disabled={isSubmitting || !typingInput.trim()}
                className="w-full min-h-11"
              >
                Check Answer
              </Button>
            )}
          </form>
        )}

        {/* 4. MATCH: Tap to match */}
        {currentQ.exerciseType === "MATCH" && currentQ.matchPairs && (
          <div className="space-y-3">
            <p className="text-center text-xs text-muted-foreground">
              Tap a term on the left, then tap its synonym on the right:
            </p>
            <div className="grid grid-cols-2 gap-3">
              {/* Left Column (Terms) */}
              <div className="space-y-2">
                {currentQ.matchPairs.map((pair) => {
                  const isDone = matchedPairs.has(pair.id);
                  const isSelected = matchedLeftId === pair.id;
                  return (
                    <button
                      key={pair.id}
                      type="button"
                      data-side="left"
                      data-pair={pair.id}
                      disabled={isDone || feedback?.show}
                      onClick={() => handleMatchTap("left", pair.id)}
                      className={cn(
                        "w-full rounded-xl border p-3 text-center text-xs font-semibold transition-all min-h-12",
                        isDone
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 opacity-60"
                          : isSelected
                            ? "border-primary bg-primary/20 text-primary ring-2 ring-primary"
                            : "border-border bg-card hover:bg-secondary",
                      )}
                    >
                      {pair.left}
                    </button>
                  );
                })}
              </div>

              {/* Right Column (Synonyms) */}
              <div className="space-y-2">
                {[...currentQ.matchPairs].reverse().map((pair) => {
                  const isDone = matchedPairs.has(pair.id);
                  return (
                    <button
                      key={pair.id}
                      type="button"
                      data-side="right"
                      data-pair={pair.id}
                      disabled={isDone || feedback?.show}
                      onClick={() => handleMatchTap("right", pair.id)}
                      className={cn(
                        "w-full rounded-xl border p-3 text-center text-xs font-semibold transition-all min-h-12",
                        isDone
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 opacity-60"
                          : "border-border bg-card hover:bg-secondary",
                      )}
                    >
                      {pair.right}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Feedback Banner */}
        {feedback?.show && (
          <div
            className={cn(
              "rounded-2xl border p-4 space-y-3",
              feedback.isCorrect
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                : "border-destructive/30 bg-destructive/10 text-destructive",
            )}
          >
            <div className="flex items-center gap-2 font-bold text-sm">
              {feedback.isCorrect ? (
                <>
                  <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
                  <span>Correct!</span>
                </>
              ) : (
                <>
                  <XCircle className="size-5 text-destructive" />
                  <span>Not quite!</span>
                </>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider opacity-80">
                Synonyms in this group:
              </p>
              <p className="mt-0.5 text-sm font-semibold">
                {feedback.correctAnswer}
              </p>
            </div>

            {currentQ.notes && (
              <p className="text-xs opacity-90 border-t border-border/40 pt-2">
                <strong>Note:</strong> {currentQ.notes}
              </p>
            )}

            {/* Next Button */}
            <Button
              type="button"
              onClick={handleNextQuestion}
              className="w-full min-h-11 font-semibold"
            >
              Continue <ArrowRight className="size-4 ml-1.5" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
