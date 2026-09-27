"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Upload, Check, FileJson, AlertCircle } from "lucide-react";
import { importSynonymAction } from "../actions";
import { MAX_SYNONYM_IMPORT_BYTES } from "../constants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const sampleSynonymsJson = JSON.stringify(
  [
    {
      term: "want to",
      meaning: "xohlamoq",
      synonyms: ["would like to", "wish to", "intend to", "be willing to"],
      notes: "Expressing desire or intention with varying formality",
    },
    {
      term: "problem",
      meaning: "muammo",
      synonyms: ["issue", "difficulty", "obstacle", "challenge"],
      notes: "'obstacle' is something blocking your way",
    },
    {
      term: "mostly",
      meaning: "asosan",
      synonyms: ["mainly", "generally", "primarily", "largely"],
    },
  ],
  null,
  2,
);

export function SynonymImportForm() {
  const [json, setJson] = useState("");
  const [state, action, pending] = useActionState(importSynonymAction, {});

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
              <Button asChild size="sm">
                <Link href="/synonyms">View notebook</Link>
              </Button>
              <Button
                variant="outline"
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
          <div className="mb-6 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-3">
            <AlertCircle className="size-5 shrink-0" />
            <p>{state.error}</p>
          </div>
        )}

        <form action={action} className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <label htmlFor="json" className="text-sm font-semibold">
                Paste JSON array of synonym groups
              </label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Each group needs a &ldquo;term&rdquo; and an array of
                &ldquo;synonyms&rdquo;.
              </p>
            </div>
            <Button
              variant="ghost"
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => setJson(sampleSynonymsJson)}
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
            placeholder={
              '[\n  {\n    "term": "want to",\n    "meaning": "xohlamoq",\n    "synonyms": ["would like to", "wish to"]\n  }\n]'
            }
            rows={10}
            spellCheck={false}
            required
            maxLength={MAX_SYNONYM_IMPORT_BYTES}
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
                <h3 className="font-semibold text-base">Import Preview</h3>
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-lg bg-secondary px-2.5 py-1 text-primary">
                    Total: {preview.total}
                  </span>
                  <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-emerald-700 dark:text-emerald-300">
                    Ready: {preview.ready}
                  </span>
                  {preview.duplicates > 0 && (
                    <span className="rounded-lg bg-amber-500/10 px-2.5 py-1 text-amber-800 dark:text-amber-300">
                      Duplicates: {preview.duplicates}
                    </span>
                  )}
                  {preview.invalid > 0 && (
                    <span className="rounded-lg bg-destructive/10 px-2.5 py-1 text-destructive">
                      Invalid: {preview.invalid}
                    </span>
                  )}
                </div>
              </div>

              {/* Items preview table/list */}
              <div className="max-h-80 overflow-y-auto space-y-2 rounded-xl border p-2 bg-secondary/20">
                {preview.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border bg-background p-3 text-xs"
                  >
                    <div>
                      <span className="font-bold uppercase text-foreground">
                        {item.term}
                      </span>
                      {item.meaning && (
                        <span className="ml-2 text-muted-foreground">
                          ({item.meaning})
                        </span>
                      )}
                      <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                        {item.synonyms.map((s, sidx) => (
                          <span
                            key={sidx}
                            className="rounded bg-secondary px-1.5 py-0.5 text-foreground"
                          >
                            {s.word}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {item.status === "READY" && (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
                          Ready
                        </span>
                      )}
                      {item.status === "DUPLICATE" && (
                        <span
                          className="rounded-full bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-600 dark:text-amber-400"
                          title={item.reason}
                        >
                          Duplicate
                        </span>
                      )}
                      {item.status === "INVALID" && (
                        <span
                          className="rounded-full bg-destructive/10 px-2 py-0.5 font-semibold text-destructive"
                          title={item.reason}
                        >
                          Invalid
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
                  <input
                    type="hidden"
                    name="readyItemsJson"
                    value={JSON.stringify(
                      preview.items
                        .filter((i) => i.status === "READY")
                        .map((i) => ({
                          term: i.term,
                          meaning: i.meaning,
                          notes: i.notes,
                          synonyms: i.synonyms,
                        })),
                    )}
                  />
                  <Button
                    type="submit"
                    disabled={pending || preview.ready === 0}
                  >
                    <Check className="size-4 mr-1.5" />
                    Confirm & import {preview.ready} ready groups
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
