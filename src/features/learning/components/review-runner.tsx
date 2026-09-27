"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Trophy,
  Home,
  Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { submitAnswerAction } from "@/features/learning/actions";
import type { LearningSessionDTO, LearningQuestionDTO } from "@/types/learning";
import type { ReviewRating } from "@/models/vocabulary-review";

interface ReviewRunnerProps {
  session: LearningSessionDTO;
}

export function ReviewRunner({ session }: ReviewRunnerProps) {
  const router = useRouter();
  const [questions, setQuestions] = useState<LearningQuestionDTO[]>(
    session.questions,
  );
  const [currentIndex, setCurrentIndex] = useState(() => {
    // Find first unanswered question
    const firstUnanswered = session.questions.findIndex((q) => !q.isAnswered);
    return firstUnanswered >= 0 ? firstUnanswered : session.questions.length;
  });

  const [isCompleted, setIsCompleted] = useState(() => {
    return (
      !!session.completedAt || session.questions.every((q) => q.isAnswered)
    );
  });

  const [sessionCompleted, setSessionCompleted] = useState(false);

  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [typingInput, setTypingInput] = useState("");
  const [feedback, setFeedback] = useState<{
    show: boolean;
    isCorrect: boolean;
    correctAnswer: string;
    userAnswer: string;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // State for Match game
  const [matchedEnId, setMatchedEnId] = useState<string | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Set<string>>(new Set());

  const currentQ = questions[currentIndex];
  const progressPercent = Math.min(
    100,
    Math.round((currentIndex / Math.max(1, questions.length)) * 100),
  );

  const handleSelectOption = (option: string) => {
    if (feedback?.show || isSubmitting) return;
    setSelectedAnswer(option);
    submitAnswer(option);
  };

  const handleTypingSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (feedback?.show || isSubmitting || !typingInput.trim()) return;
    submitAnswer(typingInput.trim());
  };

  const handleMatchTap = (type: "en" | "uz", id: string) => {
    if (feedback?.show || isSubmitting) return;

    if (type === "en") {
      setMatchedEnId(id);
    } else if (type === "uz" && matchedEnId) {
      if (matchedEnId === id) {
        // Correct pair!
        const nextSet = new Set(matchedPairs);
        nextSet.add(id);
        setMatchedPairs(nextSet);
        setMatchedEnId(null);

        // Check if all pairs are matched
        const totalNeeded = currentQ.matchPairs?.length || 4;
        if (nextSet.size >= totalNeeded) {
          submitAnswer("MATCHED");
        }
      } else {
        // Mismatched
        setMatchedEnId(null);
      }
    }
  };

  const submitAnswer = async (
    answerText: string,
    ratingOverride?: ReviewRating,
  ) => {
    if (isSubmitting || !currentQ) return;
    setIsSubmitting(true);

    try {
      const res = await submitAnswerAction(
        session.id,
        currentIndex,
        answerText,
        ratingOverride || undefined,
      );

      if (res && "data" in res && res.data) {
        const data = res.data;
        setFeedback({
          show: true,
          isCorrect: data.isCorrect,
          correctAnswer: data.correctAnswer,
          userAnswer: answerText,
        });

        // Update local question state
        setQuestions((prev) => {
          const next = [...prev];
          if (next[currentIndex]) {
            next[currentIndex] = {
              ...next[currentIndex],
              isAnswered: true,
              isCorrect: data.isCorrect,
              userAnswer: answerText,
            };
          }
          if (data.reinsertedQuestion && data.reinsertIndex !== undefined) {
            const insertAt = Math.min(next.length, data.reinsertIndex);
            next.splice(insertAt, 0, data.reinsertedQuestion);
          }
          return next;
        });

        if (data.isCompleted) {
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
    setTypingInput("");
    setMatchedEnId(null);
    setMatchedPairs(new Set());

    if (currentIndex + 1 >= questions.length || sessionCompleted) {
      setIsCompleted(true);
      router.refresh();
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  // If session is complete, render celebration summary
  if (isCompleted || currentIndex >= questions.length) {
    const answeredList = questions.filter((q) => q.isAnswered);
    const correctCount = answeredList.filter((q) => q.isCorrect).length;
    const incorrectCount = answeredList.filter((q) => !q.isCorrect).length;
    const totalCount = answeredList.length || questions.length || 1;
    const accuracy = Math.round((correctCount / totalCount) * 100);

    const uniqueWords = Array.from(
      new Map(questions.map((q) => [q.wordId, q])).values(),
    );
    const improvedWords = uniqueWords.filter((q) => q.isCorrect);
    const reviewAgainWords = uniqueWords.filter((q) => !q.isCorrect);

    return (
      <div className="mx-auto max-w-xl space-y-6 py-6">
        <Card className="overflow-hidden border p-6 text-center sm:p-8">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Trophy className="size-8" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Session Complete!
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Great job! Consistent daily practice turns vocabulary into long-term
            mastery.
          </p>

          <div className="my-8 grid grid-cols-4 divide-x rounded-2xl border bg-muted/40 p-4">
            <div>
              <p className="text-xl font-semibold sm:text-2xl">{totalCount}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Questions
              </p>
            </div>
            <div>
              <p className="text-xl font-semibold text-emerald-600 sm:text-2xl dark:text-emerald-400">
                {correctCount}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Correct</p>
            </div>
            <div>
              <p className="text-xl font-semibold text-rose-600 sm:text-2xl dark:text-rose-400">
                {incorrectCount}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Incorrect
              </p>
            </div>
            <div>
              <p className="text-xl font-semibold text-primary sm:text-2xl">
                {accuracy}%
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Accuracy</p>
            </div>
          </div>

          <div className="space-y-4 text-left">
            {improvedWords.length > 0 && (
              <div>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Words Remembered ({improvedWords.length})
                </h2>
                <div className="flex flex-wrap gap-2">
                  {improvedWords.map((w) => (
                    <span
                      key={w.wordId}
                      className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1 text-xs font-medium"
                    >
                      <CheckCircle2 className="size-3 text-emerald-500" />
                      {w.targetWord}
                      <span className="text-muted-foreground">
                        — {w.targetTranslation}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {reviewAgainWords.length > 0 && (
              <div>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  To Review Again ({reviewAgainWords.length})
                </h2>
                <div className="flex flex-wrap gap-2">
                  {reviewAgainWords.map((w) => (
                    <span
                      key={w.wordId}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-1 text-xs font-medium"
                    >
                      <RotateCcw className="size-3 text-amber-500" />
                      {w.targetWord}
                      <span className="text-muted-foreground">
                        — {w.targetTranslation}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="outline" className="flex-1">
              <Link href="/learn">
                <Home className="size-4" /> Back to Learn
              </Link>
            </Button>
            {reviewAgainWords.length > 0 ? (
              <Button asChild className="flex-1">
                <Link href="/learn/vocabulary/difficult">
                  <RotateCcw className="size-4" /> Practice Mistakes
                </Link>
              </Button>
            ) : (
              <Button asChild className="flex-1">
                <Link href="/learn">
                  <Sparkles className="size-4" /> Continue Practicing
                </Link>
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 py-4 sm:py-6">
      {/* Top Header & Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 font-medium">
            <Brain className="size-3.5 text-primary" />
            {session.type} REVIEW
          </span>
          <span className="font-semibold text-foreground">
            Question {currentIndex + 1} of {questions.length}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Main Question Card */}
      <Card className="overflow-hidden border p-5 sm:p-7">
        <div className="mb-2 flex items-center justify-between">
          <span className="rounded-md bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground">
            {currentQ.exerciseType === "MULTIPLE_CHOICE" && "Multiple Choice"}
            {currentQ.exerciseType === "EN_TO_UZ" && "English → Uzbek"}
            {currentQ.exerciseType === "UZ_TO_EN" && "Uzbek → English"}
            {currentQ.exerciseType === "TYPING" && "Type in English"}
            {currentQ.exerciseType === "FILL_BLANK" && "Fill in the Blank"}
            {currentQ.exerciseType === "MATCH" && "Match Pairs"}
          </span>
          <span className="text-xs text-muted-foreground">
            {currentQ.subPrompt}
          </span>
        </div>

        {/* Prompt */}
        <div className="my-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {currentQ.prompt}
          </h1>
          {currentQ.exerciseType === "FILL_BLANK" && (
            <p className="mt-2 text-sm text-muted-foreground">
              Meaning:{" "}
              <span className="font-medium text-foreground">
                {currentQ.targetTranslation}
              </span>
            </p>
          )}
        </div>

        {/* Interaction Area */}
        <div className="space-y-3">
          {/* MULTIPLE CHOICE / OPTIONS */}
          {currentQ.options && currentQ.options.length > 0 && (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {currentQ.options.map((opt, i) => {
                const isSelected = selectedAnswer === opt;
                let btnStyle =
                  "border bg-card hover:border-primary/50 text-left";

                if (feedback?.show) {
                  const isCorrectOpt =
                    opt.toLowerCase() === feedback.correctAnswer.toLowerCase();
                  if (isCorrectOpt) {
                    btnStyle =
                      "border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-600 font-semibold";
                  } else if (isSelected && !feedback.isCorrect) {
                    btnStyle =
                      "border-rose-500 bg-rose-50 text-rose-950 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-600";
                  } else {
                    btnStyle = "opacity-50 border bg-muted";
                  }
                }

                return (
                  <button
                    key={opt + i}
                    type="button"
                    disabled={feedback?.show || isSubmitting}
                    onClick={() => handleSelectOption(opt)}
                    className={`flex min-h-14 items-center justify-between rounded-xl p-4 text-sm font-medium transition-colors ${btnStyle}`}
                  >
                    <span>{opt}</span>
                    <span className="ml-2 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted/70 text-[11px] text-muted-foreground">
                      {String.fromCharCode(65 + i)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* TYPING MODE */}
          {currentQ.exerciseType === "TYPING" && (
            <form onSubmit={handleTypingSubmit} className="space-y-3">
              <Input
                type="text"
                autoFocus
                disabled={feedback?.show || isSubmitting}
                placeholder="Type the English word..."
                value={typingInput}
                onChange={(e) => setTypingInput(e.target.value)}
                className="h-12 text-base text-center"
              />
              {!feedback?.show && (
                <Button
                  type="submit"
                  disabled={!typingInput.trim() || isSubmitting}
                  className="w-full h-11"
                >
                  Check Answer
                </Button>
              )}
            </form>
          )}

          {/* MATCH GAME */}
          {currentQ.exerciseType === "MATCH" && currentQ.matchPairs && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground text-center">
                  English
                </p>
                {currentQ.matchPairs.map((pair) => {
                  const isDone = matchedPairs.has(pair.id);
                  const isSelected = matchedEnId === pair.id;
                  let style = "border bg-card";
                  if (isDone)
                    style =
                      "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 opacity-60";
                  else if (isSelected)
                    style =
                      "border-primary bg-primary/10 text-primary ring-2 ring-primary/20";

                  return (
                    <button
                      key={"en-" + pair.id}
                      type="button"
                      disabled={isDone || feedback?.show}
                      onClick={() => handleMatchTap("en", pair.id)}
                      className={`w-full min-h-12 rounded-xl p-3 text-center text-sm font-medium transition-all ${style}`}
                    >
                      {pair.en}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground text-center">
                  Uzbek
                </p>
                {currentQ.matchPairs.map((pair) => {
                  const isDone = matchedPairs.has(pair.id);
                  let style = "border bg-card hover:border-primary/40";
                  if (isDone)
                    style =
                      "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 opacity-60";

                  return (
                    <button
                      key={"uz-" + pair.id}
                      type="button"
                      disabled={isDone || feedback?.show}
                      onClick={() => handleMatchTap("uz", pair.id)}
                      className={`w-full min-h-12 rounded-xl p-3 text-center text-sm font-medium transition-all ${style}`}
                    >
                      {pair.uz}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Immediate Feedback Box */}
        {feedback?.show && (
          <div
            className={`mt-6 rounded-2xl p-4 sm:p-5 transition-all ${
              feedback.isCorrect
                ? "bg-emerald-50 text-emerald-950 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800"
                : "bg-rose-50 text-rose-950 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800"
            }`}
          >
            <div className="flex items-start gap-3">
              {feedback.isCorrect ? (
                <CheckCircle2 className="size-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <XCircle className="size-6 shrink-0 text-rose-600 dark:text-rose-400" />
              )}
              <div className="flex-1 space-y-1">
                <p className="font-semibold text-base">
                  {feedback.isCorrect ? "Correct!" : "Not quite!"}
                </p>
                {!feedback.isCorrect && (
                  <p className="text-sm">
                    Correct answer:{" "}
                    <span className="font-bold underline">
                      {feedback.correctAnswer}
                    </span>
                  </p>
                )}
                <p className="text-xs opacity-80 pt-1">
                  {currentQ.targetWord} = {currentQ.targetTranslation}
                </p>
              </div>
            </div>

            {/* Next Question Button */}
            <div className="mt-4 pt-3 border-t border-current/10 flex justify-end">
              <Button
                onClick={handleNextQuestion}
                className="w-full sm:w-auto min-h-11 px-6 font-semibold"
              >
                Next Question <ArrowRight className="size-4 ml-1.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Footer shortcut */}
      <div className="flex justify-between items-center px-1 text-xs text-muted-foreground">
        <Link
          href="/learn"
          className="hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          ← Quit session
        </Link>
        <span>EnglishMate Learning Engine</span>
      </div>
    </div>
  );
}
