"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  saveGrammarTopicAction,
  deleteGrammarTopicAction,
  type GrammarTopicActionState,
} from "../actions";
import {
  grammarCategories,
  grammarCategoryLabels,
  grammarStatuses,
  grammarStatusLabels,
  type GrammarCategory,
  type GrammarStatus,
} from "../constants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/forms/field";
import type { GrammarTopicDTO } from "@/types/grammar";

interface TopicFormProps {
  topic?: GrammarTopicDTO;
}

export function TopicForm({ topic }: TopicFormProps) {
  const [state, action, pending] = useActionState<
    GrammarTopicActionState,
    FormData
  >(saveGrammarTopicAction, {});

  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteGrammarTopicAction,
    {},
  );

  const [title, setTitle] = useState(topic?.title ?? "");
  const [category, setCategory] = useState(topic?.category ?? "OTHER");
  const [description, setDescription] = useState(topic?.description ?? "");
  const [content, setContent] = useState(topic?.content ?? "");
  const [notes, setNotes] = useState(topic?.notes ?? "");
  const [status, setStatus] = useState(topic?.status ?? "NEW");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-7">
        <form action={action} className="space-y-6">
          {topic && <input type="hidden" name="id" value={topic.id} />}

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

          {/* Title */}
          <Field
            label="Topic Title"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Modal Verbs — Ability"
            maxLength={160}
            autoFocus={!topic}
            required
            error={state.fields?.title}
            hint="A clear grammar concept title (e.g. 'Relative Clauses', 'Past Simple vs Present Perfect')"
          />

          {/* Category */}
          <div className="space-y-2">
            <label htmlFor="category" className="text-sm font-medium">
              Category
            </label>
            <select
              id="category"
              name="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as GrammarCategory)}
              className="h-11 w-full rounded-xl border bg-background px-3 text-sm focus:border-primary focus:outline-none"
            >
              {grammarCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {grammarCategoryLabels[cat]}
                </option>
              ))}
            </select>
            {state.fields?.category && (
              <p className="text-xs text-destructive">
                {state.fields.category.join(", ")}
              </p>
            )}
          </div>

          {/* Short Description */}
          <Field
            label="Short Description (Summary)"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Can, could, and be able to across different tenses"
            maxLength={500}
            error={state.fields?.description}
            hint="Brief high-level overview of what this topic covers."
          />

          {/* Lesson Content / Rules / Markdown */}
          <div className="space-y-2">
            <label htmlFor="content" className="text-sm font-medium">
              Lesson Content & Rules (Markdown text)
            </label>
            <textarea
              id="content"
              name="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              maxLength={20000}
              placeholder={`## Can\nUsed for present ability.\nExample: I can swim.\n\n## Could\nUsed for past general ability.\nExample: I could read when I was four.`}
              className="w-full rounded-xl border bg-background p-3.5 font-mono text-sm leading-6 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {state.fields?.content && (
              <p className="text-xs text-destructive">
                {state.fields.content.join(", ")}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Write clear explanations, rules, formulas, and examples.
            </p>
          </div>

          {/* Personal Nuances & Notes */}
          <div className="space-y-2">
            <label htmlFor="notes" className="text-sm font-medium">
              Personal Notes & Common Traps
            </label>
            <textarea
              id="notes"
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={4000}
              placeholder="e.g. Remember: 'could' cannot be used for a specific past achievement in affirmative; use 'was able to' instead."
              className="w-full rounded-xl border bg-background px-3.5 py-2 text-sm focus:border-primary focus:outline-none"
            />
            {state.fields?.notes && (
              <p className="text-xs text-destructive">
                {state.fields.notes.join(", ")}
              </p>
            )}
          </div>

          {/* Status (when editing) */}
          {topic && (
            <div className="space-y-2">
              <label htmlFor="status" className="text-sm font-medium">
                Learning Status
              </label>
              <select
                id="status"
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as GrammarStatus)}
                className="h-11 w-full rounded-xl border bg-background px-3 text-sm focus:border-primary focus:outline-none"
              >
                {grammarStatuses.map((st) => (
                  <option key={st} value={st}>
                    {grammarStatusLabels[st]}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
            <Button asChild variant="ghost">
              <Link href={topic ? `/grammar/${topic.id}` : "/grammar"}>
                Cancel
              </Link>
            </Button>

            <div className="flex flex-wrap items-center gap-2">
              {!topic && (
                <>
                  <Button
                    type="submit"
                    name="afterSave"
                    value="another"
                    variant="outline"
                    disabled={pending}
                  >
                    Save & add another
                  </Button>
                  <Button
                    type="submit"
                    name="afterSave"
                    value="exercise"
                    variant="outline"
                    disabled={pending}
                  >
                    Save & add exercise
                  </Button>
                </>
              )}

              <Button type="submit" disabled={pending}>
                {pending ? "Saving..." : topic ? "Update topic" : "Save topic"}
              </Button>
            </div>
          </div>
        </form>
      </Card>

      {/* Danger Zone: Delete Topic */}
      {topic && (
        <Card className="border-destructive/30 p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-destructive">
                Delete Grammar Topic
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Permanently delete this topic and all its {topic.exerciseCount}{" "}
                exercises. This action cannot be undone.
              </p>
            </div>

            {!showDeleteConfirm ? (
              <Button
                variant="destructive"
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="size-4 mr-1.5" />
                Delete topic
              </Button>
            ) : (
              <form action={deleteAction} className="flex items-center gap-2">
                <input type="hidden" name="id" value={topic.id} />
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  type="submit"
                  disabled={deletePending}
                >
                  {deletePending ? "Deleting..." : "Confirm Delete"}
                </Button>
              </form>
            )}
          </div>
          {deleteState.error && (
            <p className="mt-3 text-xs text-destructive">{deleteState.error}</p>
          )}
        </Card>
      )}
    </div>
  );
}
