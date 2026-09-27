"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Upload, Check, FileJson, ArrowRight } from "lucide-react";
import { importWordAction } from "../actions";
import { MAX_IMPORT_BYTES } from "../constants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
const example = JSON.stringify(
  [
    {
      word: "appropriate",
      translation: "mos, munosib",
      definition: "suitable for a particular situation",
      example: "This dress is appropriate for the meeting.",
      partOfSpeech: "adjective",
    },
    { word: "participate", translation: "qatnashmoq" },
  ],
  null,
  2,
);
export function ImportForm() {
  const [json, setJson] = useState("");
  const [fileError, setFileError] = useState("");
  const [state, action, pending] = useActionState(importWordAction, {});
  const normalizeNewlines = (s?: string) =>
    (s ?? "").replace(/\r\n/g, "\n").trim();
  const preview =
    state.preview &&
    (state.json === json ||
      normalizeNewlines(state.json) === normalizeNewlines(json))
      ? state.preview
      : undefined;
  const rows = preview?.rows ?? state.result?.rows;
  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-7">
        <form action={action} className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label htmlFor="json" className="text-sm font-semibold">
              Paste your JSON
            </label>
            <Button
              variant="ghost"
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => setJson(example)}
            >
              <FileJson />
              Use example
            </Button>
          </div>
          <textarea
            id="json"
            name="json"
            value={json}
            onChange={(e) => {
              setJson(e.target.value);
              setFileError("");
            }}
            placeholder={'[\n  { "word": "hello", "translation": "salom" }\n]'}
            rows={12}
            spellCheck={false}
            required
            maxLength={MAX_IMPORT_BYTES}
            className="w-full resize-y rounded-xl border border-input bg-background p-4 font-mono text-sm leading-6 focus-visible:outline-ring"
          />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <label
                htmlFor="json-file"
                className="mb-2 block text-xs font-medium"
              >
                Or choose a .json file
              </label>
              <input
                id="json-file"
                type="file"
                accept=".json,application/json"
                disabled={pending}
                className="block max-w-full text-xs file:mr-3 file:min-h-11 file:rounded-xl file:border file:bg-background file:px-3 file:text-foreground"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > MAX_IMPORT_BYTES) {
                    setFileError("Choose a file smaller than 256 KB.");
                    return;
                  }
                  try {
                    setJson(await file.text());
                    setFileError("");
                  } catch {
                    setFileError(
                      "That file couldn’t be read. Try pasting the JSON instead.",
                    );
                  }
                }}
              />
            </div>
            <Button name="step" value="preview" disabled={pending}>
              <Upload />
              {pending ? "Checking…" : "Preview import"}
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Up to 300 rows and 256 KB per import. Only word and translation are
            required. Nothing is saved until you confirm.
          </p>
          {(fileError || state.error) && (
            <p
              role="alert"
              className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
            >
              {fileError || state.error}
            </p>
          )}
        </form>
      </Card>
      {preview && (
        <Card className="p-5 sm:p-7">
          <h2 className="text-xl font-semibold">
            A quick look before they’re yours.
          </h2>
          <div className="my-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: "Detected", value: preview.detected },
              { label: "Ready to import", value: preview.ready },
              { label: "Invalid", value: preview.invalid },
              { label: "Already exist", value: preview.existing },
              { label: "Repeated rows", value: preview.duplicate },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-muted p-3">
                <p className="text-2xl font-semibold">{stat.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
          <p className="mb-5 text-xs leading-relaxed text-muted-foreground">
            Invalid rows and duplicates will be skipped. Existing words are
            never overwritten. Fix the JSON above and preview again if needed.
          </p>
          <form action={action}>
            <input type="hidden" name="json" value={state.json} />
            <input type="hidden" name="step" value="confirm" />
            <Button
              disabled={pending || !preview.ready}
              className="w-full sm:w-auto"
            >
              <Check />
              {pending
                ? "Importing…"
                : `Confirm import of ${preview.ready} words`}
            </Button>
          </form>
        </Card>
      )}
      {state.result && (
        <Card className="border-primary/20 bg-secondary p-6">
          <p role="status" className="text-sm font-semibold text-primary">
            {state.success}
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/vocabulary">
              Open your notebook
              <ArrowRight />
            </Link>
          </Button>
        </Card>
      )}
      {rows && (
        <Card className="overflow-hidden">
          <h2 className="border-b p-5 font-semibold">
            {preview ? "Review each row" : "Import rows"}
          </h2>
          <div className="max-h-[32rem] overflow-y-auto divide-y">
            {rows.map((row) => (
              <div
                key={row.row}
                className="grid gap-2 p-4 sm:grid-cols-[2rem_1fr_1fr]"
              >
                <span className="text-xs text-muted-foreground">
                  #{row.row}
                </span>
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold">
                    {row.word}
                  </p>
                  {row.translation && (
                    <p className="mt-1 break-words text-xs text-muted-foreground">
                      {row.translation}
                    </p>
                  )}
                </div>
                <div>
                  <p
                    className={`text-xs font-semibold ${row.kind === "ready" ? "text-primary" : row.kind === "invalid" ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {row.kind === "ready"
                      ? preview
                        ? "Ready to import"
                        : "Imported"
                      : row.kind === "invalid"
                        ? "Invalid — skipped"
                        : row.kind === "existing"
                          ? "Already exists — skipped"
                          : "Repeated row — skipped"}
                  </p>
                  {row.issues && (
                    <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                      {row.issues}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <details className="rounded-xl border p-4">
        <summary className="min-h-8 cursor-pointer text-sm font-semibold">
          Supported JSON fields
        </summary>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          Required: word, translation. Optional: definition, example,
          pronunciation, partOfSpeech, notes. All values must be strings.
          Imported words start as New; dates and ownership are assigned
          automatically.
        </p>
      </details>
    </div>
  );
}
