"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Plus, X, ArrowLeft, Trash2, CheckCircle2 } from "lucide-react";
import {
  saveGrammarExerciseAction,
  deleteGrammarExerciseAction,
  type GrammarExerciseActionState,
} from "../actions";
import {
  grammarExerciseTypes,
  grammarExerciseTypeLabels,
  type GrammarExerciseType,
} from "../constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/forms/field";
import type { GrammarExerciseDTO } from "@/types/grammar";

interface ExerciseFormProps {
  topicId: string;
  topicTitle: string;
  exercise?: GrammarExerciseDTO;
}

export function ExerciseForm({
  topicId,
  topicTitle,
  exercise,
}: ExerciseFormProps) {
  const [state, action, pending] = useActionState<
    GrammarExerciseActionState,
    FormData
  >(saveGrammarExerciseAction, {});

  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteGrammarExerciseAction,
    {},
  );

  const [type, setType] = useState<GrammarExerciseType>(
    exercise?.type ?? "MULTIPLE_CHOICE",
  );
  const [question, setQuestion] = useState(exercise?.question ?? "");
  const [correctAnswer, setCorrectAnswer] = useState(
    exercise?.correctAnswer ?? "",
  );
  const [explanation, setExplanation] = useState(exercise?.explanation ?? "");
  const [difficulty, setDifficulty] = useState(exercise?.difficulty ?? 2);

  // Options for MCQ
  const [options, setOptions] = useState<string[]>(
    exercise?.options?.length
      ? exercise.options
      : ["can", "could", "will be able to", "would"],
  );
  const [newOptionInput, setNewOptionInput] = useState("");

  // Accepted answers for Fill Blank / Text Input / Sentence Correction
  const [acceptedAnswers, setAcceptedAnswers] = useState<string[]>(
    exercise?.acceptedAnswers ?? [],
  );
  const [newAcceptedInput, setNewAcceptedInput] = useState("");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleAddOption = () => {
    const val = newOptionInput.trim();
    if (!val) return;
    if (!options.includes(val)) {
      setOptions([...options, val]);
      if (!correctAnswer) setCorrectAnswer(val);
    }
    setNewOptionInput("");
  };

  const handleRemoveOption = (idx: number) => {
    const removed = options[idx];
    const next = options.filter((_, i) => i !== idx);
    setOptions(next);
    if (correctAnswer === removed) {
      setCorrectAnswer(next[0] || "");
    }
  };

  const handleAddAccepted = () => {
    const val = newAcceptedInput.trim();
    if (!val) return;
    if (!acceptedAnswers.includes(val)) {
      setAcceptedAnswers([...acceptedAnswers, val]);
    }
    setNewAcceptedInput("");
  };

  const handleRemoveAccepted = (idx: number) => {
    setAcceptedAnswers(acceptedAnswers.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-7">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Topic: {topicTitle}
          </p>
          <h2 className="text-xl font-bold tracking-tight">
            {exercise ? "Edit Exercise" : "Add New Exercise"}
          </h2>
        </div>

        <form action={action} className="space-y-6">
          <input type="hidden" name="topicId" value={topicId} />
          {exercise && (
            <input type="hidden" name="exerciseId" value={exercise.id} />
          )}
          <input
            type="hidden"
            name="optionsJson"
            value={JSON.stringify(options)}
          />
          <input
            type="hidden"
            name="acceptedAnswersJson"
            value={JSON.stringify(acceptedAnswers)}
          />

          {/* Error Message */}
          {state.error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-sm text-destructive"
            >
              {state.error}
            </div>
          )}

          {/* Success Message */}
          {state.success && (
            <div
              role="status"
              className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-sm text-emerald-700 dark:text-emerald-300"
            >
              {state.success}
            </div>
          )}

          {/* Exercise Type */}
          <div className="space-y-2">
            <label htmlFor="type" className="text-sm font-medium">
              Exercise Type
            </label>
            <select
              id="type"
              name="type"
              value={type}
              onChange={(e) => {
                const nextType = e.target.value as GrammarExerciseType;
                setType(nextType);
                if (nextType === "TRUE_FALSE") {
                  setCorrectAnswer("true");
                }
              }}
              className="h-11 w-full rounded-xl border bg-background px-3 text-sm focus:border-primary focus:outline-none"
            >
              {grammarExerciseTypes.map((t) => (
                <option key={t} value={t}>
                  {grammarExerciseTypeLabels[t]}
                </option>
              ))}
            </select>
          </div>

          {/* Question Prompt */}
          <div className="space-y-2">
            <label htmlFor="question" className="text-sm font-medium">
              {type === "SENTENCE_CORRECTION"
                ? "Incorrect Sentence to Correct"
                : type === "TRUE_FALSE"
                  ? "Statement to Evaluate"
                  : "Question or Prompt"}
            </label>
            <textarea
              id="question"
              name="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={2}
              required
              maxLength={1000}
              placeholder={
                type === "MULTIPLE_CHOICE"
                  ? "e.g. My little sister _____ read when she was only four."
                  : type === "FILL_BLANK"
                    ? "e.g. She _____ speak English when she was five."
                    : type === "TEXT_INPUT"
                      ? "e.g. Rewrite using 'be able to': I can finish the task tomorrow."
                      : type === "TRUE_FALSE"
                        ? "e.g. 'Could' can describe general ability in the past."
                        : "e.g. He can to swim."
              }
              className="w-full rounded-xl border bg-background p-3 text-sm focus:border-primary focus:outline-none"
            />
            {state.fields?.question && (
              <p className="text-xs text-destructive">
                {state.fields.question.join(", ")}
              </p>
            )}
          </div>

          {/* Type-Specific Fields */}

          {/* 1. MULTIPLE CHOICE */}
          {type === "MULTIPLE_CHOICE" && (
            <div className="space-y-4 rounded-xl border bg-secondary/20 p-4">
              <div>
                <label className="text-sm font-semibold">
                  Options & Correct Choice
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select which option is correct. Multiple choice requires at
                  least 2 distinct choices.
                </p>
              </div>

              {/* Options list */}
              <div className="space-y-2">
                {options.map((opt, idx) => {
                  const isCorrect = correctAnswer === opt;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 text-sm transition-colors ${
                        isCorrect
                          ? "border-emerald-500 bg-emerald-500/10 font-semibold text-emerald-800 dark:text-emerald-300"
                          : "bg-background"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setCorrectAnswer(opt)}
                        className="flex flex-1 items-center gap-2.5 text-left"
                      >
                        <div
                          className={`flex size-5 items-center justify-center rounded-full border ${
                            isCorrect
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-muted-foreground/40"
                          }`}
                        >
                          {isCorrect && <CheckCircle2 className="size-3.5" />}
                        </div>
                        <span>{opt}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        disabled={options.length <= 2}
                        className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-30"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Add option input */}
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={newOptionInput}
                  onChange={(e) => setNewOptionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddOption();
                    }
                  }}
                  placeholder="Type an option and press Add..."
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddOption}
                  disabled={!newOptionInput.trim()}
                >
                  <Plus className="size-4 mr-1" /> Add
                </Button>
              </div>

              <input type="hidden" name="correctAnswer" value={correctAnswer} />
              {state.fields?.correctAnswer && (
                <p className="text-xs text-destructive">
                  {state.fields.correctAnswer.join(", ")}
                </p>
              )}
            </div>
          )}

          {/* 2. TRUE / FALSE */}
          {type === "TRUE_FALSE" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Correct Evaluation</label>
              <div className="grid grid-cols-2 gap-3">
                {["true", "false"].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setCorrectAnswer(val)}
                    className={`min-h-12 rounded-xl border p-3 text-sm font-bold uppercase transition-all ${
                      correctAnswer === val
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-card text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {val === "true" ? "TRUE" : "FALSE"}
                  </button>
                ))}
              </div>
              <input type="hidden" name="correctAnswer" value={correctAnswer} />
            </div>
          )}

          {/* 3. FILL_BLANK, TEXT_INPUT, SENTENCE_CORRECTION */}
          {type !== "MULTIPLE_CHOICE" && type !== "TRUE_FALSE" && (
            <div className="space-y-4">
              <Field
                label={
                  type === "SENTENCE_CORRECTION"
                    ? "Correct Sentence"
                    : "Primary Correct Answer"
                }
                name="correctAnswer"
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
                placeholder={
                  type === "FILL_BLANK"
                    ? "e.g. could"
                    : type === "TEXT_INPUT"
                      ? "e.g. I will be able to finish the task tomorrow."
                      : "e.g. He can swim."
                }
                required
                maxLength={500}
                error={state.fields?.correctAnswer}
                hint="Normalized for case and trailing punctuation automatically."
              />

              {/* Additional accepted answers */}
              <div className="space-y-2 rounded-xl border bg-secondary/10 p-3.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Additional Accepted Answers (Optional)
                </label>

                {acceptedAnswers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {acceptedAnswers.map((ans, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded-lg border bg-background px-2.5 py-1 text-xs font-medium"
                      >
                        {ans}
                        <button
                          type="button"
                          onClick={() => handleRemoveAccepted(idx)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={newAcceptedInput}
                    onChange={(e) => setNewAcceptedInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddAccepted();
                      }
                    }}
                    placeholder="Add accepted variation..."
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddAccepted}
                    disabled={!newAcceptedInput.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Explanation */}
          <div className="space-y-2">
            <label htmlFor="explanation" className="text-sm font-medium">
              Explanation & Grammar Nuance (Optional)
            </label>
            <textarea
              id="explanation"
              name="explanation"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="e.g. 'Could' is used for general ability in the past, while modal verbs take the bare infinitive."
              className="w-full rounded-xl border bg-background p-3 text-sm focus:border-primary focus:outline-none"
            />
            <p className="text-xs text-muted-foreground">
              Shown to the learner immediately after answering.
            </p>
          </div>

          {/* Difficulty & Order */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="difficulty" className="text-sm font-medium">
                Difficulty Level (1 = Easy, 5 = Advanced)
              </label>
              <select
                id="difficulty"
                name="difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(Number(e.target.value))}
                className="h-11 w-full rounded-xl border bg-background px-3 text-sm focus:border-primary focus:outline-none"
              >
                <option value={1}>1 - Beginner</option>
                <option value={2}>2 - Elementary</option>
                <option value={3}>3 - Intermediate</option>
                <option value={4}>4 - Upper Intermediate</option>
                <option value={5}>5 - Advanced</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="order" className="text-sm font-medium">
                Sequence Order
              </label>
              <Input
                id="order"
                name="order"
                type="number"
                defaultValue={exercise?.order ?? 0}
                min={0}
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
            <Button asChild variant="ghost">
              <Link href={`/grammar/${topicId}`}>
                <ArrowLeft className="size-4 mr-1.5" />
                Back to topic
              </Link>
            </Button>

            <div className="flex flex-wrap items-center gap-2">
              {!exercise && (
                <Button
                  type="submit"
                  name="afterSave"
                  value="another"
                  variant="outline"
                  disabled={pending}
                >
                  Save & add another
                </Button>
              )}

              <Button type="submit" disabled={pending}>
                {pending
                  ? "Saving..."
                  : exercise
                    ? "Update exercise"
                    : "Save exercise"}
              </Button>
            </div>
          </div>
        </form>
      </Card>

      {/* Danger Zone: Delete Exercise */}
      {exercise && (
        <Card className="border-destructive/30 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-destructive">
                Delete this exercise
              </p>
              <p className="text-xs text-muted-foreground">
                Remove this question from the topic permanently.
              </p>
            </div>

            {!showDeleteConfirm ? (
              <Button
                variant="destructive"
                type="button"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="size-4 mr-1.5" />
                Delete
              </Button>
            ) : (
              <form action={deleteAction} className="flex items-center gap-2">
                <input type="hidden" name="topicId" value={topicId} />
                <input type="hidden" name="exerciseId" value={exercise.id} />
                <Button
                  variant="ghost"
                  type="button"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  type="submit"
                  size="sm"
                  disabled={deletePending}
                >
                  {deletePending ? "Deleting..." : "Confirm Delete"}
                </Button>
              </form>
            )}
          </div>
          {deleteState.error && (
            <p className="mt-2 text-xs text-destructive">{deleteState.error}</p>
          )}
        </Card>
      )}
    </div>
  );
}
