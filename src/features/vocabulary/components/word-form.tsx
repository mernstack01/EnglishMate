"use client";
import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import {
  ArrowRight,
  Plus,
  Trash2,
  Sparkles,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { saveWordAction, deleteWordAction } from "../actions";
import { autofillWordAction } from "../ai-actions";
import { wordStatuses, statusLabels } from "../constants";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { VocabularyDTO } from "@/types/vocabulary";
const empty = {
  word: "",
  translation: "",
  definition: "",
  example: "",
  pronunciation: "",
  partOfSpeech: "",
  notes: "",
  status: "NEW",
  difficulty: 0,
};
export function WordForm({ word }: { word?: VocabularyDTO }) {
  const [draft, setDraft] = useState(word ? { ...empty, ...word } : empty);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(!!word);
  const wordRef = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState(
    async (previous: Parameters<typeof saveWordAction>[0], form: FormData) => {
      const result = await saveWordAction(previous, form);
      if (result.success && !word) {
        setDraft(empty);
        setAiMessage(null);
        wordRef.current?.focus();
      }
      return result;
    },
    {},
  );
  const change = (key: keyof typeof empty, value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const handleAiFill = async () => {
    const targetWord = draft.word.trim();
    if (!targetWord) {
      setAiMessage({
        type: "warning",
        text: "Please enter a word or phrase first.",
      });
      return;
    }

    setIsAiLoading(true);
    setAiMessage(null);

    const result = await autofillWordAction(targetWord, draft.example);
    setIsAiLoading(false);

    if (!result.success) {
      setAiMessage({ type: "error", text: result.error });
      return;
    }

    const { data } = result;
    setDraft((prev) => {
      const isExistingWord = !!word;
      if (isExistingWord) {
        // Only fill empty fields for existing word
        return {
          ...prev,
          translation: prev.translation || data.translation,
          definition: prev.definition || data.definition,
          example: prev.example || data.example,
          partOfSpeech: prev.partOfSpeech || data.partOfSpeech,
          pronunciation: prev.pronunciation || data.pronunciation,
          notes:
            prev.notes ||
            (data.synonyms?.length
              ? `Synonyms: ${data.synonyms.join(", ")}`
              : ""),
        };
      }

      // New word autofill: populate all suggested fields
      return {
        ...prev,
        translation: data.translation || prev.translation,
        definition: data.definition || prev.definition,
        example: data.example || prev.example,
        partOfSpeech: data.partOfSpeech || prev.partOfSpeech,
        pronunciation: data.pronunciation || prev.pronunciation,
        notes:
          prev.notes ||
          (data.synonyms?.length
            ? `Synonyms: ${data.synonyms.join(", ")}`
            : ""),
      };
    });

    setDetailsOpen(true);

    if (data.isDuplicate && !word) {
      setAiMessage({
        type: "warning",
        text: "Note: This word already exists in your notebook.",
      });
    } else {
      setAiMessage({
        type: "success",
        text: word
          ? "Filled empty fields with AI suggestions! Review and save."
          : "AI filled learning details! Review, edit if needed, and save.",
      });
    }
  };
  return (
    <Card className="p-5 sm:p-8">
      <form action={action} className="space-y-6">
        {word && <input type="hidden" name="id" value={word.id} />}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            ref={wordRef}
            label="Word or phrase"
            name="word"
            placeholder="e.g. appropriate"
            value={draft.word}
            onChange={(e) => change("word", e.target.value)}
            autoComplete="off"
            required
            maxLength={120}
            error={state.fields?.word}
          />
          <Field
            label="Translation"
            name="translation"
            placeholder="e.g. mos, munosib"
            value={draft.translation}
            onChange={(e) => change("translation", e.target.value)}
            required
            maxLength={500}
            error={state.fields?.translation}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Basic details are required to save. Add context whenever you like.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAiFill}
            disabled={isAiLoading || !draft.word.trim()}
            className="gap-2 shrink-0 border-amber-300/70 hover:bg-amber-50 dark:border-amber-700/60 dark:hover:bg-amber-950/40"
          >
            {isAiLoading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Thinking...
              </>
            ) : (
              <>
                <Sparkles className="size-3.5 text-amber-500" />
                {word ? "Improve with AI" : "Fill with AI"}
              </>
            )}
          </Button>
        </div>

        {aiMessage && (
          <div
            className={cn(
              "flex items-start gap-2 rounded-xl p-3 text-sm",
              aiMessage.type === "success" &&
                "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
              aiMessage.type === "error" &&
                "bg-destructive/10 text-destructive",
              aiMessage.type === "warning" &&
                "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
            )}
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p className="flex-1">{aiMessage.text}</p>
          </div>
        )}

        <details
          open={detailsOpen}
          onToggle={(e) =>
            setDetailsOpen((e.target as HTMLDetailsElement).open)
          }
          className="rounded-xl border p-4"
        >
          <summary className="min-h-8 cursor-pointer text-sm font-semibold text-primary">
            More details (optional)
          </summary>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {(
              [
                {
                  key: "pronunciation",
                  label: "Pronunciation",
                  max: 200,
                  placeholder: "/əˈprəʊpriət/",
                },
                {
                  key: "partOfSpeech",
                  label: "Part of speech",
                  max: 80,
                  placeholder: "adjective, verb, noun…",
                },
              ] as const
            ).map((field) => (
              <Field
                key={field.key}
                label={field.label}
                name={field.key}
                value={draft[field.key]}
                onChange={(e) => change(field.key, e.target.value)}
                placeholder={field.placeholder}
                maxLength={field.max}
                error={state.fields?.[field.key]}
              />
            ))}
            {(
              [
                { key: "definition", label: "Definition", max: 2000 },
                { key: "example", label: "Example sentence", max: 2000 },
                { key: "notes", label: "Personal notes", max: 4000 },
              ] as const
            ).map((field) => (
              <div key={field.key} className="space-y-2 sm:col-span-2">
                <label htmlFor={field.key} className="text-sm font-medium">
                  {field.label}
                </label>
                <textarea
                  id={field.key}
                  name={field.key}
                  value={draft[field.key]}
                  onChange={(e) => change(field.key, e.target.value)}
                  maxLength={field.max}
                  rows={3}
                  className="w-full resize-y rounded-xl border border-input bg-background p-3 text-base focus-visible:outline-ring"
                  aria-invalid={!!state.fields?.[field.key]}
                />
                {state.fields?.[field.key] && (
                  <p className="text-sm text-destructive">
                    {state.fields[field.key][0]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </details>
        {word && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="word-status"
                className="mb-2 block text-sm font-medium"
              >
                Learning status
              </label>
              <select
                id="word-status"
                name="status"
                value={draft.status}
                onChange={(e) => change("status", e.target.value)}
                className="h-12 w-full rounded-xl border bg-background px-3"
              >
                {wordStatuses.map((s) => (
                  <option key={s} value={s}>
                    {statusLabels[s]}
                  </option>
                ))}
              </select>
            </div>
            <Field
              label="Difficulty (0–5)"
              name="difficulty"
              type="number"
              min={0}
              max={5}
              step={1}
              value={draft.difficulty}
              onChange={(e) => change("difficulty", e.target.value)}
              error={state.fields?.difficulty}
            />
          </div>
        )}
        {state.error && (
          <p
            role="alert"
            className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
          >
            {state.error}
          </p>
        )}
        {state.success && (
          <p
            role="status"
            className="rounded-xl bg-secondary p-3 text-sm text-primary"
          >
            {state.success}{" "}
            {!word && state.savedId && (
              <Link href={`/vocabulary/${state.savedId}`} className="underline">
                View saved word
              </Link>
            )}
          </p>
        )}
        <div className="sticky bottom-20 flex flex-wrap gap-3 rounded-xl border bg-card/95 p-3 backdrop-blur lg:bottom-4">
          <Button
            name="afterSave"
            value="view"
            disabled={pending}
            className="flex-1"
          >
            {pending ? "Saving…" : word ? "Save changes" : "Save and view"}
            <ArrowRight />
          </Button>
          {!word && (
            <Button
              variant="outline"
              name="afterSave"
              value="another"
              disabled={pending}
              className="flex-1"
            >
              <Plus />
              Save and add another
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
export function DeleteWordForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(deleteWordAction, {});
  return (
    <form
      action={action}
      className="mt-6 rounded-2xl border border-destructive/20 p-5"
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Delete this word and its review state? This cannot be undone.",
          )
        )
          event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="confirmed" value="yes" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">Remove this word</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            The word and its review state will be permanently deleted.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={pending}
          className="text-destructive"
        >
          <Trash2 />
          {pending ? "Deleting…" : "Delete word"}
        </Button>
      </div>
      {state.error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
