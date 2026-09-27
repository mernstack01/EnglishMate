"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  Sparkles,
  Trophy,
  PenLine,
  BookOpen,
  RotateCcw,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { submitGrammarAnswerAction } from "@/features/learning/grammar-actions";
import { grammarExerciseTypeLabels } from "@/features/grammar/constants";
import type { GrammarSessionDTO, GrammarQuestionDTO } from "@/types/grammar";
import { cn } from "@/lib/utils";

interface GrammarPracticeRunnerProps {
  session: GrammarSessionDTO;
}

export function GrammarPracticeRunner({ session }: GrammarPracticeRunnerProps) {
  const [questions, setQuestions] = useState<GrammarQuestionDTO[]>(
    session.questions,
  );
  const [currentIndex, setCurrentIndex] = useState(
    session.currentQuestionIndex ?? 0,
  );
  const [isCompleted, setIsCompleted] = useState(session.isCompleted);
  const [sessionCompleted, setSessionCompleted] = useState(false);

  // Per-question state
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [textInput, setTextInput] = useState("");
  const [feedback, setFeedback] = useState<{
    show: boolean;
    isCorrect: boolean;
    correctAnswer: string;
    userAnswer: string;
    explanation?: string;
    wasReinserted?: boolean;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Running session statistics
  const [correctCount, setCorrectCount] = useState(session.correctAnswers || 0);
  const [incorrectCount, setIncorrectCount] = useState(
    session.incorrectAnswers || 0,
  );
  const [streak, setStreak] = useState(0);

  const currentQ = questions[currentIndex];
  const progressPercent = Math.min(
    100,
    Math.round((currentIndex / Math.max(1, questions.length)) * 100),
  );

  const submitAnswer = async (ans: string) => {
    if (isSubmitting || !currentQ) return;
    setIsSubmitting(true);

    try {
      const res = await submitGrammarAnswerAction(
        session.id,
        currentIndex,
        ans,
        currentQ.exerciseId,
      );

      if (res && "data" in res && res.data) {
        const {
          isCorrect,
          correctAnswer,
          explanation,
          wasReinserted,
          reinsertedQuestion,
          reinsertIndex,
          isCompleted: sessionDone,
          streak: newStreak,
        } = res.data;

        if (isCorrect) {
          setCorrectCount((prev) => prev + 1);
        } else {
          setIncorrectCount((prev) => prev + 1);
        }

        if (newStreak) {
          setStreak(newStreak);
        }

        // If reinserted on server, use the server's reinserted question and reinsertIndex
        if (
          wasReinserted &&
          reinsertedQuestion &&
          reinsertIndex !== undefined
        ) {
          const nextQuestions = [...questions];
          const insertAt = Math.min(nextQuestions.length, reinsertIndex);
          nextQuestions.splice(insertAt, 0, reinsertedQuestion);
          // Keep all question indexes aligned with their array positions
          nextQuestions.forEach((q, i) => {
            q.index = i;
          });
          setQuestions(nextQuestions);
        }

        setFeedback({
          show: true,
          isCorrect,
          correctAnswer,
          userAnswer: ans,
          explanation: explanation || currentQ.explanation,
          wasReinserted,
        });

        if (sessionDone) {
          setSessionCompleted(true);
        }
      }
    } catch {
      // Keep UI responsive
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextQuestion = () => {
    setFeedback(null);
    setSelectedAnswer("");
    setTextInput("");

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

    return (
      <div className="mx-auto max-w-xl space-y-6">
        <Card className="overflow-hidden border p-6 sm:p-8 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Trophy className="size-8" />
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" /> GRAMMAR PRACTICE COMPLETE
          </span>

          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Grammar Session Complete!
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {session.topicTitle
              ? `Practiced: ${session.topicTitle}`
              : "Great work! Grammar mastery updated."}
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

          {streak > 0 && (
            <div className="mb-6 flex items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300">
              <Flame className="size-5 text-amber-500" />
              <span className="text-sm font-semibold">
                {streak}-day learning streak maintained!
              </span>
            </div>
          )}

          {/* Action CTAs */}
          <div className="mt-8 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
            <Button asChild size="default" className="w-full sm:w-auto">
              <Link href="/learn/grammar">
                <PenLine className="size-4 mr-2" />
                Back to Grammar Learning
              </Link>
            </Button>
            {session.topicId && (
              <Button
                asChild
                variant="outline"
                size="default"
                className="w-full sm:w-auto"
              >
                <Link href={`/grammar/${session.topicId}`}>
                  <BookOpen className="size-4 mr-2" />
                  View Topic Notes
                </Link>
              </Button>
            )}
            <Button
              asChild
              variant="ghost"
              size="default"
              className="w-full sm:w-auto"
            >
              <Link href="/grammar">Grammar Notebook</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!currentQ) return null;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      {/* Top Header & Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
          <span>{session.topicTitle || "Grammar Practice"}</span>
          <span>
            Question {currentIndex + 1} of {questions.length}
          </span>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Main Question Card */}
      <Card className="p-6 sm:p-8">
        {/* Exercise Type Pill */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <span className="inline-flex rounded-md bg-secondary/80 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
            {(grammarExerciseTypeLabels as Record<string, string>)[
              currentQ.exerciseType
            ] || currentQ.exerciseType}
          </span>
        </div>

        {/* Prompt */}
        <div className="mb-6 space-y-1">
          {currentQ.exerciseType === "SENTENCE_CORRECTION" && (
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Correct this sentence:
            </p>
          )}
          <h2 className="text-lg font-bold tracking-tight sm:text-xl text-foreground">
            {currentQ.prompt}
          </h2>
        </div>

        {/* Interactive Answer Input */}

        {/* 1. MULTIPLE CHOICE */}
        {currentQ.exerciseType === "MULTIPLE_CHOICE" && (
          <div className="grid gap-2.5">
            {currentQ.options.map((option, optIdx) => {
              const letter = String.fromCharCode(65 + optIdx);
              const isSelected = selectedAnswer === option;
              const isCorrectTarget = feedback?.correctAnswer === option;

              let btnStyle =
                "border-border bg-card hover:bg-secondary/40 text-foreground";
              if (feedback?.show) {
                if (isCorrectTarget) {
                  btnStyle =
                    "border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-semibold";
                } else if (isSelected && !feedback.isCorrect) {
                  btnStyle =
                    "border-destructive bg-destructive/10 text-destructive font-semibold";
                }
              }

              return (
                <button
                  key={optIdx}
                  type="button"
                  disabled={feedback?.show || isSubmitting}
                  onClick={() => {
                    setSelectedAnswer(option);
                    submitAnswer(option);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-4 text-left text-sm transition-all min-h-12",
                    btnStyle,
                  )}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-foreground">
                    {letter}
                  </span>
                  <span className="flex-1 font-medium">{option}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* 2. TRUE / FALSE */}
        {currentQ.exerciseType === "TRUE_FALSE" && (
          <div className="grid grid-cols-2 gap-3">
            {["true", "false"].map((val) => {
              const label = val === "true" ? "TRUE" : "FALSE";
              const isSelected = selectedAnswer === val;
              const isCorrectTarget = feedback?.correctAnswer === val;

              let btnStyle =
                "border-border bg-card hover:bg-secondary/50 text-foreground";
              if (feedback?.show) {
                if (isCorrectTarget) {
                  btnStyle =
                    "border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-bold";
                } else if (isSelected && !feedback.isCorrect) {
                  btnStyle =
                    "border-destructive bg-destructive/10 text-destructive font-bold";
                }
              }

              return (
                <button
                  key={val}
                  type="button"
                  disabled={feedback?.show || isSubmitting}
                  onClick={() => {
                    setSelectedAnswer(val);
                    submitAnswer(val);
                  }}
                  className={cn(
                    "flex min-h-14 items-center justify-center rounded-xl border p-4 text-center font-bold tracking-wider uppercase transition-all",
                    btnStyle,
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* 3. FILL_BLANK, TEXT_INPUT, SENTENCE_CORRECTION */}
        {currentQ.exerciseType !== "MULTIPLE_CHOICE" &&
          currentQ.exerciseType !== "TRUE_FALSE" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (feedback?.show || isSubmitting || !textInput.trim()) return;
                submitAnswer(textInput.trim());
              }}
              className="space-y-3"
            >
              <Input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={
                  currentQ.exerciseType === "FILL_BLANK"
                    ? "Type the missing word..."
                    : currentQ.exerciseType === "SENTENCE_CORRECTION"
                      ? "Type the corrected sentence..."
                      : "Type your answer..."
                }
                disabled={feedback?.show || isSubmitting}
                autoFocus
                className="min-h-12 text-base"
              />

              {!feedback?.show && (
                <Button
                  type="submit"
                  disabled={isSubmitting || !textInput.trim()}
                  className="w-full min-h-11"
                >
                  {isSubmitting ? "Checking..." : "Check Answer"}
                </Button>
              )}
            </form>
          )}

        {/* Immediate Feedback Card */}
        {feedback?.show && (
          <div className="mt-6 space-y-4 border-t pt-5">
            <div
              className={cn(
                "rounded-2xl border p-4",
                feedback.isCorrect
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                  : "border-destructive/20 bg-destructive/10 text-destructive",
              )}
            >
              <div className="flex items-center gap-3">
                {feedback.isCorrect ? (
                  <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <XCircle className="size-5 shrink-0 text-destructive" />
                )}
                <div>
                  <p className="font-semibold text-sm">
                    {feedback.isCorrect ? "Correct!" : "Not quite."}
                  </p>
                  {!feedback.isCorrect && (
                    <p className="mt-1 text-xs opacity-90">
                      Correct answer:{" "}
                      <span className="font-bold underline">
                        {feedback.correctAnswer}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              {feedback.wasReinserted && (
                <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium opacity-85">
                  <RotateCcw className="size-3" />
                  This question will return later in this session.
                </div>
              )}
            </div>

            {/* Explanation */}
            {feedback.explanation && (
              <div className="rounded-xl border bg-secondary/30 p-3.5 text-xs">
                <p className="font-semibold text-foreground uppercase tracking-wide text-[10px] mb-1">
                  Grammar Explanation:
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  {feedback.explanation}
                </p>
              </div>
            )}

            {/* Next / Continue CTA */}
            <Button
              type="button"
              onClick={handleNextQuestion}
              className="w-full min-h-12 text-sm font-semibold"
            >
              Continue
              <ArrowRight className="size-4 ml-1.5" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
