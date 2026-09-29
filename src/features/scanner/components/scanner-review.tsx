"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Check,
  CheckSquare,
  Square,
  Plus,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  BookOpen,
  ArrowRight,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  DetectedWord,
  ImportScannedWordsResult,
  ScanResult,
} from "../types";
import { ScannerOverlay } from "./scanner-overlay";

interface ScannerReviewProps {
  imageSrc: string;
  scanResult: ScanResult;
  onRescan: () => void;
  onImport: (
    words: Array<{ word: string; translation?: string; notes?: string }>,
  ) => Promise<ImportScannedWordsResult>;
}

export function ScannerReview({
  imageSrc,
  scanResult,
  onRescan,
  onImport,
}: ScannerReviewProps) {
  const [detectedWords, setDetectedWords] = useState<DetectedWord[]>(
    scanResult.detectedWords,
  );
  const [otherWords, setOtherWords] = useState<DetectedWord[]>(
    scanResult.otherWords,
  );
  const [showOverlay, setShowOverlay] = useState(false);
  const [showOtherWords, setShowOtherWords] = useState(
    scanResult.detectedWords.length === 0, // Auto-expand if no marks found
  );

  // Manual add state
  const [manualWord, setManualWord] = useState("");
  const [manualTranslation, setManualTranslation] = useState("");

  // Editing inline state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingWord, setEditingWord] = useState("");
  const [editingTranslation, setEditingTranslation] = useState("");

  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] =
    useState<ImportScannedWordsResult | null>(null);

  // Toggle selection of a detected word
  const toggleSelectDetected = (id: string) => {
    setDetectedWords((prev) =>
      prev.map((w) => (w.id === id ? { ...w, selected: !w.selected } : w)),
    );
  };

  // Toggle selection of an other word
  const toggleSelectOther = (id: string) => {
    setOtherWords((prev) =>
      prev.map((w) => (w.id === id ? { ...w, selected: !w.selected } : w)),
    );
  };

  // Remove a word from detected list
  const removeWord = (id: string) => {
    setDetectedWords((prev) => prev.filter((w) => w.id !== id));
  };

  // Select all / Deselect all
  const selectAll = () => {
    setDetectedWords((prev) => prev.map((w) => ({ ...w, selected: true })));
  };

  const deselectAll = () => {
    setDetectedWords((prev) => prev.map((w) => ({ ...w, selected: false })));
    setOtherWords((prev) => prev.map((w) => ({ ...w, selected: false })));
  };

  // Save manual word
  const handleAddManualWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualWord.trim()) return;

    const newWord: DetectedWord = {
      id: `manual_${Date.now()}`,
      text: manualWord.trim(),
      normalizedWord: manualWord.trim().toLowerCase(),
      ocrConfidence: 100,
      markType: "manual",
      markConfidence: 1.0,
      bbox: { x0: 0, y0: 0, x1: 0, y1: 0 },
      selected: true,
      translation: manualTranslation.trim() || undefined,
      notes: "Added manually during scan review",
    };

    setDetectedWords((prev) => [newWord, ...prev]);
    setManualWord("");
    setManualTranslation("");
  };

  // Start editing inline
  const startEdit = (word: DetectedWord) => {
    setEditingId(word.id);
    setEditingWord(word.text);
    setEditingTranslation(word.translation || "");
  };

  // Save inline edit
  const saveEdit = (id: string) => {
    if (!editingWord.trim()) return;

    setDetectedWords((prev) =>
      prev.map((w) =>
        w.id === id
          ? {
              ...w,
              text: editingWord.trim(),
              normalizedWord: editingWord.trim().toLowerCase(),
              translation: editingTranslation.trim() || undefined,
            }
          : w,
      ),
    );
    setEditingId(null);
  };

  // Selected words count
  const selectedDetected = detectedWords.filter((w) => w.selected);
  const selectedOther = otherWords.filter((w) => w.selected);
  const totalSelected = selectedDetected.length + selectedOther.length;

  // Handle final import
  const handleImport = async () => {
    const allSelected = [...selectedDetected, ...selectedOther];
    if (allSelected.length === 0) return;

    setIsImporting(true);
    setImportError(null);

    try {
      const payload = allSelected.map((w) => ({
        word: w.text,
        translation: w.translation || "",
        notes: w.notes || `Scanned (${w.markType})`,
      }));

      const result = await onImport(payload);
      setImportSummary(result);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to import words into your notebook.";
      setImportError(message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Visual Image & Overlay Container */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
            Scanned Page
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowOverlay(!showOverlay)}
            className="text-xs"
          >
            {showOverlay ? (
              <>
                <EyeOff className="size-3.5" />
                Hide detection overlay
              </>
            ) : (
              <>
                <Eye className="size-3.5" />
                Show detection overlay
              </>
            )}
          </Button>
        </div>

        <div className="relative flex max-h-[400px] w-full items-center justify-center overflow-hidden rounded-2xl border bg-black/5 dark:bg-black/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
            alt="Scanned textbook with detected marks"
            className="max-h-[380px] w-auto max-w-full rounded-xl object-contain p-1"
          />

          {showOverlay && (
            <div className="pointer-events-none absolute inset-0">
              <ScannerOverlay scanResult={scanResult} />
            </div>
          )}
        </div>
      </div>

      {/* Import Success / Summary Card */}
      {importSummary && (
        <div className="rounded-3xl border border-primary/20 bg-secondary/30 p-6 text-foreground shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Check className="size-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">
                Import completed successfully!
              </h3>
              <p className="text-sm text-muted-foreground">
                Imported:{" "}
                <strong className="text-foreground">
                  {importSummary.importedCount}
                </strong>{" "}
                · Already existed:{" "}
                <strong className="text-foreground">
                  {importSummary.skippedDuplicatesCount}
                </strong>
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="default">
              <Link href="/vocabulary">
                <BookOpen className="size-4" />
                View in Vocabulary
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={onRescan}
            >
              Scan Another Page
            </Button>
          </div>
        </div>
      )}

      {/* Main Review Section */}
      {!importSummary && (
        <div className="space-y-6">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
            <div>
              <h3 className="text-xl font-bold">Review Detected Words</h3>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Select and verify words before adding them to your vocabulary.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selectAll}
              >
                <CheckSquare className="size-4" />
                Select All
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={deselectAll}
              >
                <Square className="size-4" />
                Deselect All
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRescan}
              >
                Rescan
              </Button>
            </div>
          </div>

          {/* Add Word Manually Form */}
          <form
            onSubmit={handleAddManualWord}
            className="flex flex-col gap-2 rounded-2xl border bg-card p-3 sm:flex-row sm:items-center"
          >
            <Input
              type="text"
              placeholder="Add word manually..."
              value={manualWord}
              onChange={(e) => setManualWord(e.target.value)}
              className="h-10 text-sm"
            />
            <Input
              type="text"
              placeholder="Translation (optional)"
              value={manualTranslation}
              onChange={(e) => setManualTranslation(e.target.value)}
              className="h-10 text-sm"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!manualWord.trim()}
              className="shrink-0"
            >
              <Plus className="size-4" />
              Add Word
            </Button>
          </form>

          {/* Detected Marked Words List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold">
                Detected marked words ({detectedWords.length})
              </h4>
              <span className="text-xs text-muted-foreground">
                {selectedDetected.length} selected
              </span>
            </div>

            {detectedWords.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                <AlertCircle className="mx-auto mb-2 size-6 text-amber-500" />
                <p className="font-medium text-foreground">
                  No marked words were confidently detected.
                </p>
                <p className="mt-1">
                  You can pick from recognized words below or add words
                  manually.
                </p>
              </div>
            ) : (
              <div className="divide-y rounded-2xl border bg-card">
                {detectedWords.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 p-3 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                  >
                    {/* Checkbox and word text */}
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => toggleSelectDetected(item.id)}
                        className="size-5 shrink-0 rounded-md border-input text-primary focus:ring-primary"
                        aria-label={`Select ${item.text}`}
                      />

                      {editingId === item.id ? (
                        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
                          <Input
                            value={editingWord}
                            onChange={(e) => setEditingWord(e.target.value)}
                            className="h-8 text-sm"
                            placeholder="Word"
                          />
                          <Input
                            value={editingTranslation}
                            onChange={(e) =>
                              setEditingTranslation(e.target.value)
                            }
                            className="h-8 text-sm"
                            placeholder="Translation"
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => saveEdit(item.id)}
                            className="h-8 shrink-0 text-xs"
                          >
                            Save
                          </Button>
                        </div>
                      ) : (
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-foreground">
                              {item.text}
                            </span>

                            {/* Mark Badge */}
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                item.markType === "highlight"
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                  : item.markType === "underline"
                                    ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                                    : item.markType === "box"
                                      ? "bg-orange-500/15 text-orange-700 dark:text-orange-300"
                                      : "bg-secondary text-primary"
                              }`}
                            >
                              {item.markType}
                            </span>

                            {/* OCR Confidence */}
                            {item.ocrConfidence > 0 && (
                              <span className="text-[11px] text-muted-foreground">
                                {item.ocrConfidence}% OCR
                              </span>
                            )}
                          </div>

                          {item.translation && (
                            <p className="truncate text-xs text-muted-foreground">
                              {item.translation}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions: Edit / Remove */}
                    {editingId !== item.id && (
                      <div className="flex items-center gap-1 self-end sm:self-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(item)}
                          className="size-8 p-0 text-muted-foreground hover:text-foreground"
                          title="Edit word"
                        >
                          <Edit2 className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeWord(item.id)}
                          className="size-8 p-0 text-muted-foreground hover:text-destructive"
                          title="Remove word"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Other Recognized Words (Fallback) */}
          <div className="rounded-2xl border bg-card/60">
            <button
              type="button"
              onClick={() => setShowOtherWords(!showOtherWords)}
              className="flex w-full items-center justify-between p-4 text-left font-medium transition-colors hover:bg-muted/40"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">
                  Other recognized words ({otherWords.length})
                </span>
                <span className="text-xs text-muted-foreground">
                  (Words without detected marks)
                </span>
              </div>
              {showOtherWords ? (
                <ChevronUp className="size-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="size-4 text-muted-foreground" />
              )}
            </button>

            {showOtherWords && (
              <div className="border-t p-4">
                {otherWords.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No other text tokens recognized.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {otherWords.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleSelectOther(item.id)}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                          item.selected
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {item.selected && <Check className="size-3" />}
                        {item.text}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Import Error Message */}
          {importError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
            >
              <AlertCircle className="size-5 shrink-0" />
              <span>{importError}</span>
            </div>
          )}

          {/* Sticky Mobile / Bottom Action Bar */}
          <div className="sticky bottom-4 z-20 flex items-center justify-between gap-3 rounded-2xl border bg-card/95 p-3 shadow-xl backdrop-blur-md sm:p-4">
            <div className="min-w-0">
              <span className="text-sm font-semibold">
                {totalSelected} {totalSelected === 1 ? "word" : "words"}{" "}
                selected
              </span>
              <p className="text-xs text-muted-foreground">
                Ready to add to notebook
              </p>
            </div>

            <Button
              type="button"
              size="lg"
              onClick={handleImport}
              disabled={totalSelected === 0 || isImporting}
              className="shadow-md"
            >
              {isImporting ? (
                <>Importing...</>
              ) : (
                <>
                  Import Selected
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
