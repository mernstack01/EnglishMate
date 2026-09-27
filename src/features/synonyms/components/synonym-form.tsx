"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { saveSynonymGroupAction, deleteSynonymGroupAction } from "../actions";
import { synonymStatuses, synonymStatusLabels } from "../constants";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SynonymGroupDTO, SynonymItemDTO } from "@/types/synonyms";

export function SynonymForm({ group }: { group?: SynonymGroupDTO }) {
  const [term, setTerm] = useState(group?.term || "");
  const [meaning, setMeaning] = useState(group?.meaning || "");
  const [notes, setNotes] = useState(group?.notes || "");
  const [status, setStatus] = useState<string>(group?.status || "NEW");

  const [synonyms, setSynonyms] = useState<SynonymItemDTO[]>(
    group?.synonyms?.length ? group.synonyms : [],
  );
  const [newSynonymWord, setNewSynonymWord] = useState("");
  const [newSynonymError, setNewSynonymError] = useState<string | null>(null);

  const termInputRef = useRef<HTMLInputElement>(null);
  const newSynInputRef = useRef<HTMLInputElement>(null);

  const [state, action, pending] = useActionState(
    async (
      previous: Parameters<typeof saveSynonymGroupAction>[0],
      form: FormData,
    ) => {
      // Serialize current synonyms state to hidden field
      form.set("synonymsJson", JSON.stringify(synonyms));
      const result = await saveSynonymGroupAction(previous, form);
      if (result.success && !group) {
        setTerm("");
        setMeaning("");
        setNotes("");
        setSynonyms([]);
        setNewSynonymWord("");
        termInputRef.current?.focus();
      }
      return result;
    },
    {},
  );

  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteSynonymGroupAction,
    {},
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const addSynonym = () => {
    const word = newSynonymWord.trim();
    if (!word) {
      setNewSynonymError("Enter a synonym first.");
      return;
    }
    const lowerWord = word.toLowerCase();
    if (lowerWord === term.trim().toLowerCase()) {
      setNewSynonymError("Synonym cannot be the same as the main term.");
      return;
    }
    if (synonyms.some((s) => s.word.trim().toLowerCase() === lowerWord)) {
      setNewSynonymError("This synonym is already in the list.");
      return;
    }

    setSynonyms([...synonyms, { word, example: "" }]);
    setNewSynonymWord("");
    setNewSynonymError(null);
    newSynInputRef.current?.focus();
  };

  const removeSynonym = (index: number) => {
    setSynonyms(synonyms.filter((_, i) => i !== index));
  };

  const updateSynonymExample = (index: number, example: string) => {
    setSynonyms(synonyms.map((s, i) => (i === index ? { ...s, example } : s)));
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="p-6 sm:p-8">
        <form
          action={action}
          className="space-y-6"
          noValidate
          aria-label={group ? "Edit synonym group" : "New synonym group"}
        >
          {group && <input type="hidden" name="id" value={group.id} />}
          <input
            type="hidden"
            name="synonymsJson"
            value={JSON.stringify(synonyms)}
          />

          {/* Form Header */}
          <div className="border-b pb-4">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {group ? `Edit “${group.term}”` : "New Synonym Group"}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Group words that share similar meanings and practice recognizing
              their nuances.
            </p>
          </div>

          {/* Status Message */}
          {state.error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {state.error}
            </div>
          )}
          {state.success && (
            <div
              role="status"
              className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400"
            >
              {state.success}
            </div>
          )}

          {/* Main Term */}
          <Field
            ref={termInputRef}
            label="Main Term or Phrase"
            name="term"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="e.g. want to"
            maxLength={120}
            autoFocus={!group}
            required
            error={state.fields?.term}
            hint="The primary anchor word (e.g. 'want to', 'problem', 'mostly')"
          />

          {/* Uzbek Meaning */}
          <Field
            label="Meaning (Uzbek)"
            name="meaning"
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            placeholder="e.g. xohlamoq"
            maxLength={500}
            error={state.fields?.meaning}
            hint="Uzbek translation or explanation (e.g. 'xohlamoq', 'muammo')"
          />

          {/* Synonyms List Section */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <label className="text-sm font-semibold text-foreground">
                Synonyms <span className="text-destructive">*</span>
              </label>
              <span className="text-xs text-muted-foreground">
                {synonyms.length} added
              </span>
            </div>

            {state.fields?.synonyms?.[0] && (
              <p className="text-xs font-medium text-destructive">
                {state.fields.synonyms[0]}
              </p>
            )}

            {/* List of current synonyms */}
            {synonyms.length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                No synonyms added yet. Type a synonym below and press Enter or
                click &ldquo;+ Add&rdquo;.
              </div>
            ) : (
              <div className="space-y-2">
                {synonyms.map((s, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-2 rounded-xl border bg-secondary/30 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {index + 1}
                      </span>
                      <span className="font-semibold text-sm">{s.word}</span>
                    </div>

                    <div className="flex flex-1 items-center gap-2 sm:max-w-xs">
                      <input
                        type="text"
                        placeholder="Optional example sentence"
                        value={s.example || ""}
                        onChange={(e) =>
                          updateSynonymExample(index, e.target.value)
                        }
                        maxLength={2000}
                        className="w-full rounded-lg border bg-background px-2.5 py-1 text-xs transition-colors focus:border-primary focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeSynonym(index)}
                        aria-label={`Remove synonym ${s.word}`}
                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Input to add a new synonym */}
            <div className="space-y-1.5 pt-1">
              <div className="flex gap-2">
                <input
                  ref={newSynInputRef}
                  type="text"
                  value={newSynonymWord}
                  onChange={(e) => {
                    setNewSynonymWord(e.target.value);
                    if (newSynonymError) setNewSynonymError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSynonym();
                    }
                  }}
                  placeholder="Type a synonym (e.g. 'would like to') and press Enter"
                  maxLength={120}
                  className="flex-1 rounded-xl border bg-background px-3.5 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addSynonym}
                  className="shrink-0"
                >
                  <Plus className="size-4 mr-1" /> Add
                </Button>
              </div>
              {newSynonymError && (
                <p className="text-xs text-destructive">{newSynonymError}</p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label htmlFor="notes" className="text-sm font-medium">
              Notes & Usage Nuances
            </label>
            <textarea
              id="notes"
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={4000}
              placeholder="Usage notes, register (formal/informal), prepositions..."
              className="w-full rounded-xl border bg-background px-3.5 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {state.fields?.notes && (
              <p className="text-xs text-destructive">
                {state.fields.notes.join(", ")}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Context notes (e.g. &apos;intend to&apos; is more formal than
              &apos;want to&apos;)
            </p>
          </div>

          {/* Status (when editing) */}
          {group && (
            <div className="space-y-2">
              <label htmlFor="status" className="text-sm font-medium">
                Status
              </label>
              <select
                id="status"
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-xl border bg-background px-3.5 py-2 text-sm transition-colors focus:border-primary focus:outline-none"
              >
                {synonymStatuses.map((st) => (
                  <option key={st} value={st}>
                    {synonymStatusLabels[st]}
                  </option>
                ))}
              </select>
              {state.fields?.status && (
                <p className="text-xs text-destructive">
                  {state.fields.status.join(", ")}
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
            <Button asChild variant="ghost">
              <Link href="/synonyms">Cancel</Link>
            </Button>

            <div className="flex flex-wrap gap-2">
              {!group && (
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
                {group ? "Save changes" : "Save synonym group"}
              </Button>
            </div>
          </div>
        </form>

        {/* Delete Group (when editing) */}
        {group && (
          <div className="mt-8 border-t border-destructive/20 pt-6">
            <h2 className="text-sm font-semibold text-destructive">
              Danger Zone
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Deleting this synonym group permanently removes its synonyms,
              review history, and practice attempts.
            </p>

            {deleteState.error && (
              <p className="mt-2 text-xs text-destructive">
                {deleteState.error}
              </p>
            )}

            {!confirmDelete ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                className="mt-3"
              >
                <Trash2 className="size-4 mr-1.5" /> Delete group
              </Button>
            ) : (
              <form
                action={deleteAction}
                className="mt-3 flex items-center gap-3"
              >
                <input type="hidden" name="id" value={group.id} />
                <input type="hidden" name="confirmed" value="yes" />
                <Button
                  type="submit"
                  variant="destructive"
                  size="sm"
                  disabled={deletePending}
                >
                  Yes, delete &ldquo;{group.term}&rdquo;
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </Button>
              </form>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
