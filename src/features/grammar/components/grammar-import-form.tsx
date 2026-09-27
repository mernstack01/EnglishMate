"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Upload, Check, FileJson, AlertCircle } from "lucide-react";
import { importGrammarAction } from "../actions";
import { MAX_GRAMMAR_IMPORT_BYTES } from "../constants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface GrammarImportFormProps {
  existingTopics: Array<{ id: string; title: string }>;
  defaultTopicId?: string;
}

const sampleGrammarJson = JSON.stringify(
  {
    title: "Modal Verbs — Ability",
    category: "MODAL_VERBS",
    description: "Can, could, and be able to across different tenses",
    content:
      "## Can\nUsed for present ability.\nExample: I can swim.\n\n## Could\nUsed for past general ability.\nExample: I could read when I was four.\n\n## Be able to\nUsed for specific achievements or other tenses.",
    notes:
      "For a single past achievement in affirmative, use 'was/were able to' instead of 'could'.",
    exercises: [
      {
        type: "MULTIPLE_CHOICE",
        question: "My little sister _____ read when she was only four.",
        options: ["can", "could", "will be able to", "has been able to"],
        correctAnswer: "could",
        explanation: "'Could' is used to describe general ability in the past.",
        difficulty: 2,
      },
      {
        type: "FILL_BLANK",
        question: "She _____ speak English when she was five.",
        correctAnswer: "could",
        acceptedAnswers: ["could"],
        explanation: "The sentence refers to general past ability.",
        difficulty: 2,
      },
      {
        type: "TEXT_INPUT",
        question: "Rewrite using 'be able to': I can finish the task tomorrow.",
        correctAnswer: "I will be able to finish the task tomorrow",
        acceptedAnswers: [
          "I will be able to finish the task tomorrow.",
          "I'll be able to finish the task tomorrow",
          "I'll be able to finish the task tomorrow.",
        ],
        explanation:
          "Future ability requires 'will be able to' rather than 'can'.",
        difficulty: 3,
      },
      {
        type: "TRUE_FALSE",
        question: "'Could' can describe general ability in the past.",
        correctAnswer: "true",
        explanation:
          "True: 'could' describes general past ability (e.g. I could swim when I was 5).",
        difficulty: 1,
      },
      {
        type: "SENTENCE_CORRECTION",
        question: "He can to swim.",
        correctAnswer: "He can swim.",
        acceptedAnswers: ["He can swim"],
        explanation:
          "Modal verbs are followed by the base infinitive without 'to'.",
        difficulty: 1,
      },
    ],
  },
  null,
  2,
);

export function GrammarImportForm({
  existingTopics,
  defaultTopicId,
}: GrammarImportFormProps) {
  const [json, setJson] = useState("");
  const [targetTopicId, setTargetTopicId] = useState(defaultTopicId ?? "");
  const [mode, setMode] = useState<"NEW_TOPIC" | "EXISTING_TOPIC">(
    defaultTopicId ? "EXISTING_TOPIC" : "NEW_TOPIC",
  );

  const [state, action, pending] = useActionState(importGrammarAction, {});
  const preview = state.preview;

  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-7">
        {/* Success confirmation */}
        {state.success && (
          <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-emerald-700 dark:text-emerald-300">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <Check className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base">Import successful!</h3>
                <p className="text-xs opacity-90">{state.success}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              {state.importedTopicId && (
                <Button asChild size="sm">
                  <Link href={`/grammar/${state.importedTopicId}`}>
                    View topic & exercises
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline" size="sm">
                <Link href="/grammar">Grammar notebook</Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setJson("");
                }}
              >
                Import more
              </Button>
            </div>
          </div>
        )}

        {/* Error message */}
        {state.error && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle className="size-5 shrink-0" />
            <p>{state.error}</p>
          </div>
        )}

        <form action={action} className="space-y-5">
          {/* Mode Selector */}
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setMode("NEW_TOPIC");
                setTargetTopicId("");
              }}
              className={`rounded-xl border p-4 text-left transition-all ${
                mode === "NEW_TOPIC"
                  ? "border-primary bg-primary/10 font-semibold text-primary ring-2 ring-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              <p className="font-bold text-sm text-foreground">
                Create New Topic
              </p>
              <p className="text-xs mt-0.5">
                Import topic rules + lesson content + exercises all at once.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setMode("EXISTING_TOPIC")}
              className={`rounded-xl border p-4 text-left transition-all ${
                mode === "EXISTING_TOPIC"
                  ? "border-primary bg-primary/10 font-semibold text-primary ring-2 ring-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              <p className="font-bold text-sm text-foreground">
                Add to Existing Topic
              </p>
              <p className="text-xs mt-0.5">
                Append exercises to one of your existing grammar topics.
              </p>
            </button>
          </div>

          {/* Existing Topic Picker */}
          {mode === "EXISTING_TOPIC" && (
            <div className="space-y-2 rounded-xl border bg-secondary/10 p-4">
              <label htmlFor="targetTopicId" className="text-sm font-medium">
                Choose Existing Topic
              </label>
              {existingTopics.length > 0 ? (
                <select
                  id="targetTopicId"
                  name="targetTopicId"
                  value={targetTopicId}
                  onChange={(e) => setTargetTopicId(e.target.value)}
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="">-- Select a topic --</option>
                  {existingTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-muted-foreground">
                  You don&apos;t have any topics yet. Select &ldquo;Create New
                  Topic&rdquo; above.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <label htmlFor="json" className="text-sm font-semibold">
                Paste JSON Payload
              </label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Support topic definition or array of exercises.
              </p>
            </div>
            <Button
              variant="ghost"
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => setJson(sampleGrammarJson)}
            >
              <FileJson className="size-4 mr-1.5" />
              Load example
            </Button>
          </div>

          <textarea
            id="json"
            name="json"
            value={json}
            onChange={(e) => setJson(e.target.value)}
            placeholder={`{\n  "title": "Modal Verbs",\n  "exercises": [\n    {\n      "type": "MULTIPLE_CHOICE",\n      "question": "He _____ swim.",\n      "options": ["can", "could"],\n      "correctAnswer": "can"\n    }\n  ]\n}`}
            rows={10}
            spellCheck={false}
            required
            maxLength={MAX_GRAMMAR_IMPORT_BYTES}
            className="w-full resize-y rounded-xl border bg-background p-4 font-mono text-sm leading-6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />

          {/* Action button before preview */}
          {!preview && (
            <div className="flex justify-end">
              <Button type="submit" disabled={pending || !json.trim()}>
                <Upload className="size-4 mr-1.5" />
                {pending ? "Analyzing..." : "Preview import"}
              </Button>
            </div>
          )}

          {/* Preview section */}
          {preview && (
            <div className="space-y-5 border-t pt-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-base">Import Preview</h3>
                  <p className="text-xs text-muted-foreground">
                    Target:{" "}
                    <span className="font-bold text-foreground">
                      {preview.title || preview.targetTopicTitle}
                    </span>
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-lg bg-secondary px-2.5 py-1 text-primary">
                    Total: {preview.totalDetected}
                  </span>
                  <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-emerald-700 dark:text-emerald-300">
                    Ready: {preview.readyCount}
                  </span>
                  {preview.invalidCount > 0 && (
                    <span className="rounded-lg bg-destructive/10 px-2.5 py-1 text-destructive">
                      Invalid: {preview.invalidCount}
                    </span>
                  )}
                </div>
              </div>

              {/* Items preview list */}
              <div className="max-h-80 overflow-y-auto space-y-2 rounded-xl border p-2 bg-secondary/20">
                {preview.exercises.map((ex, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border bg-background p-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">
                          {ex.type}
                        </span>
                        <span className="font-medium text-foreground">
                          {ex.question}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Correct:{" "}
                        <span className="font-semibold text-foreground">
                          {ex.correctAnswer}
                        </span>
                        {ex.explanation && ` · ${ex.explanation}`}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {ex.status === "READY" ? (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
                          Ready
                        </span>
                      ) : (
                        <span
                          className="rounded-full bg-destructive/10 px-2 py-0.5 font-semibold text-destructive"
                          title={ex.reason}
                        >
                          Invalid: {ex.reason}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Confirmation CTA */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <Button
                  type="submit"
                  name="step"
                  value="preview"
                  variant="outline"
                  disabled={pending}
                >
                  Re-preview
                </Button>

                <div className="flex gap-2">
                  <input type="hidden" name="step" value="confirm" />
                  <input type="hidden" name="title" value={preview.title} />
                  <input
                    type="hidden"
                    name="category"
                    value={preview.category}
                  />
                  <input
                    type="hidden"
                    name="description"
                    value={preview.description}
                  />
                  <input type="hidden" name="content" value={preview.content} />
                  <input type="hidden" name="notes" value={preview.notes} />
                  {preview.targetTopicId && (
                    <input
                      type="hidden"
                      name="targetTopicId"
                      value={preview.targetTopicId}
                    />
                  )}
                  <input
                    type="hidden"
                    name="readyExercisesJson"
                    value={JSON.stringify(
                      preview.exercises
                        .filter((e) => e.status === "READY")
                        .map((e) => ({
                          type: e.type,
                          question: e.question,
                          options: e.options,
                          correctAnswer: e.correctAnswer,
                          acceptedAnswers: e.acceptedAnswers,
                          explanation: e.explanation,
                          difficulty: e.difficulty,
                        })),
                    )}
                  />
                  <Button
                    type="submit"
                    disabled={pending || preview.readyCount === 0}
                  >
                    <Check className="size-4 mr-1.5" />
                    Confirm & import {preview.readyCount} exercises
                  </Button>
                </div>
              </div>
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}
