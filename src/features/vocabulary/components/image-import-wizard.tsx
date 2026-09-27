"use client";

import { useState, useRef, useTransition, useId } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Upload,
  Sparkles,
  Camera,
  Check,
  AlertCircle,
  X,
  RotateCcw,
  BookOpen,
  GraduationCap,
  Quote,
  Loader2,
  Trash2,
  Edit2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  analyzeImageAction,
  enrichCandidatesAction,
  confirmImageImportAction,
} from "../ai-actions";
import type {
  ExtractedCandidate,
  CandidateToEnrich,
  EnrichedVocabulary,
  MarkingType,
} from "@/lib/ai/types";
import { MAX_IMAGE_BYTES } from "@/validations/ai";

type WizardStep = "upload" | "candidates" | "preview" | "complete";

const MARKING_LABELS: Record<
  MarkingType,
  { label: string; className: string }
> = {
  HIGHLIGHTED: {
    label: "Highlighted",
    className:
      "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800",
  },
  UNDERLINED: {
    label: "Underlined",
    className:
      "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800",
  },
  CIRCLED: {
    label: "Circled",
    className:
      "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-800",
  },
  BOXED: {
    label: "Boxed",
    className:
      "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800",
  },
  VOCABULARY_LIST: {
    label: "Vocabulary List",
    className:
      "bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-200 dark:border-cyan-800",
  },
  PEN_MARK: {
    label: "Pen Mark",
    className:
      "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800",
  },
  OTHER: {
    label: "Marked",
    className: "bg-secondary text-secondary-foreground border-border",
  },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImageImportWizard() {
  const [step, setStep] = useState<WizardStep>("upload");
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const dropzoneId = useId();

  // Step 1: Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isConfigError, setIsConfigError] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Step 2: Candidate selection state
  const [candidates, setCandidates] = useState<ExtractedCandidate[]>([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(
    new Set(),
  );
  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(
    null,
  );

  // Step 3: Enriched preview state
  const [enrichedItems, setEnrichedItems] = useState<EnrichedVocabulary[]>([]);

  // Step 4: Import result state
  const [importResult, setImportResult] = useState<{
    importedCount: number;
    skippedDuplicatesCount: number;
  }>({ importedCount: 0, skippedDuplicatesCount: 0 });

  // Cleanup object URL
  const clearSelectedFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadError(null);
    setIsConfigError(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const handleFile = (file: File) => {
    setUploadError(null);
    setIsConfigError(false);

    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      setUploadError("Please upload a JPG, PNG, or WEBP image file.");
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setUploadError(
        `File is too large (${formatFileSize(file.size)}). Maximum size is ${MAX_IMAGE_BYTES / (1024 * 1024)} MB.`,
      );
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // Trigger Stage 1: Image -> Candidate extraction
  const handleAnalyzeImage = () => {
    if (!selectedFile) return;
    setUploadError(null);
    setIsConfigError(false);

    const formData = new FormData();
    formData.append("image", selectedFile);

    startTransition(async () => {
      const result = await analyzeImageAction(formData);
      if (!result.success) {
        setUploadError(result.error);
        if (result.isConfigError) {
          setIsConfigError(true);
        }
        return;
      }

      if (result.candidates.length === 0) {
        setUploadError(
          "We couldn't detect clearly marked vocabulary in this image. Try a clearer photo or ensure highlighted or underlined words are visible.",
        );
        return;
      }

      setCandidates(result.candidates);
      // Select all candidates by default
      setSelectedCandidateIds(new Set(result.candidates.map((c) => c.id)));
      setStep("candidates");
    });
  };

  // Candidate selection helpers
  const toggleSelectCandidate = (id: string) => {
    setSelectedCandidateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedCandidateIds(new Set(candidates.map((c) => c.id)));
  };

  const handleDeselectAll = () => {
    setSelectedCandidateIds(new Set());
  };

  const handleUpdateCandidateWord = (id: string, newWord: string) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, word: newWord } : c)),
    );
  };

  const handleDeleteCandidate = (id: string) => {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
    setSelectedCandidateIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Trigger Stage 2: Selected candidates -> Enrichment
  const handlePrepareVocabulary = () => {
    const selected = candidates.filter((c) => selectedCandidateIds.has(c.id));
    if (selected.length === 0) return;

    setUploadError(null);
    const toEnrich: CandidateToEnrich[] = selected.map((c) => ({
      id: c.id,
      word: c.word,
      context: c.context,
    }));

    startTransition(async () => {
      const result = await enrichCandidatesAction(toEnrich);
      if (!result.success) {
        setUploadError(result.error);
        return;
      }

      setEnrichedItems(result.items);
      setStep("preview");
    });
  };

  // Preview modification helpers
  const handleUpdateEnriched = (
    index: number,
    field: keyof EnrichedVocabulary,
    value: string,
  ) => {
    setEnrichedItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleDeleteEnriched = (index: number) => {
    setEnrichedItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Trigger Save / Confirmation
  const handleConfirmImport = () => {
    if (enrichedItems.length === 0) return;
    setUploadError(null);

    startTransition(async () => {
      const result = await confirmImageImportAction(enrichedItems);
      if (!result.success) {
        setUploadError(result.error);
        return;
      }

      setImportResult({
        importedCount: result.importedCount,
        skippedDuplicatesCount: result.skippedDuplicatesCount,
      });
      setStep("complete");
    });
  };

  const handleResetAll = () => {
    clearSelectedFile();
    setCandidates([]);
    setSelectedCandidateIds(new Set());
    setEnrichedItems([]);
    setStep("upload");
  };

  return (
    <div className="space-y-6">
      {/* Configuration warning banner */}
      {isConfigError && (
        <Card className="border-amber-400 bg-amber-50 p-4 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold">AI Feature Not Configured</p>
              <p className="leading-relaxed">
                {uploadError ||
                  "Please configure GEMINI_API_KEY (or OPENAI_API_KEY) in your environment variables to enable AI image extraction."}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* STEP 1: UPLOAD & ANALYZE */}
      {step === "upload" && (
        <Card className="p-6 sm:p-8">
          <div className="space-y-6">
            {!selectedFile ? (
              <div
                id={dropzoneId}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center transition-all",
                  isDragging
                    ? "border-primary bg-primary/5 scale-[0.99]"
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30",
                )}
              >
                <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Upload className="size-8" />
                </div>
                <div className="mt-4 space-y-1">
                  <p className="text-base font-semibold">
                    Upload textbook or notebook photo
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Drag & drop here, or browse from your device
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-md bg-muted px-2 py-1">JPG</span>
                  <span className="rounded-md bg-muted px-2 py-1">PNG</span>
                  <span className="rounded-md bg-muted px-2 py-1">WEBP</span>
                  <span>· Max 10 MB</span>
                </div>

                <div
                  className="mt-6 flex flex-wrap gap-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2"
                  >
                    <Upload className="size-4" />
                    Choose File
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => cameraInputRef.current?.click()}
                    className="gap-2 sm:hidden"
                  >
                    <Camera className="size-4" />
                    Take Photo
                  </Button>
                </div>

                {/* Normal file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFile(e.target.files[0]);
                  }}
                />

                {/* Camera input with capture hint for mobile */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFile(e.target.files[0]);
                  }}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative overflow-hidden rounded-2xl border bg-muted/20">
                  <div className="relative max-h-96 w-full flex items-center justify-center bg-black/5 p-4">
                    {previewUrl && (
                      <Image
                        src={previewUrl}
                        alt="Textbook preview"
                        width={800}
                        height={600}
                        className="max-h-80 w-auto rounded-xl object-contain shadow-sm"
                        unoptimized
                      />
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-card p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearSelectedFile}
                      disabled={isPending}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="mr-1.5 size-4" />
                      Replace image
                    </Button>
                  </div>
                </div>

                {uploadError && (
                  <div className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <p className="flex-1">{uploadError}</p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={clearSelectedFile}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleAnalyzeImage}
                    disabled={isPending}
                    className="min-w-40 gap-2"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Analyzing image...
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4 text-amber-400" />
                        Analyze image
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {isPending && !selectedFile && (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin text-primary" />
                Preparing image...
              </div>
            )}
          </div>
        </Card>
      )}

      {/* STEP 2: CANDIDATE SELECTION */}
      {step === "candidates" && (
        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  Detected vocabulary
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {candidates.length} candidates found ·{" "}
                  {selectedCandidateIds.size} selected
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={
                    isPending || selectedCandidateIds.size === candidates.length
                  }
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDeselectAll}
                  disabled={isPending || selectedCandidateIds.size === 0}
                >
                  Deselect all
                </Button>
              </div>
            </div>

            {uploadError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <p className="flex-1">{uploadError}</p>
              </div>
            )}

            <div className="mt-4 divide-y">
              {candidates.map((candidate) => {
                const isSelected = selectedCandidateIds.has(candidate.id);
                const isEditing = editingCandidateId === candidate.id;
                const markingInfo =
                  MARKING_LABELS[candidate.markingType] || MARKING_LABELS.OTHER;
                const isLowConfidence = candidate.confidence < 0.75;

                return (
                  <div
                    key={candidate.id}
                    className={cn(
                      "group flex flex-col gap-3 py-4 transition-colors sm:flex-row sm:items-center sm:justify-between rounded-xl px-2",
                      isSelected ? "bg-card" : "opacity-60 bg-muted/20",
                    )}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectCandidate(candidate.id)}
                        className="mt-1 size-5 rounded-md border-input text-primary focus:ring-primary cursor-pointer shrink-0"
                        aria-label={`Select ${candidate.word}`}
                      />

                      <div className="space-y-1.5 flex-1 min-w-0">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={candidate.word}
                              onChange={(e) =>
                                handleUpdateCandidateWord(
                                  candidate.id,
                                  e.target.value,
                                )
                              }
                              onBlur={() => setEditingCandidateId(null)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  setEditingCandidateId(null);
                              }}
                              autoFocus
                              className="h-9 max-w-sm text-base font-semibold"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingCandidateId(null)}
                            >
                              <Check className="size-4 text-emerald-600" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-base font-semibold text-foreground">
                              {candidate.word}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setEditingCandidateId(candidate.id)
                              }
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                              title="Edit word"
                            >
                              <Edit2 className="size-3.5" />
                            </button>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md border px-2 py-0.5 font-medium",
                              markingInfo.className,
                            )}
                          >
                            {markingInfo.label}
                          </span>

                          <span
                            className={cn(
                              "inline-flex items-center rounded-md px-2 py-0.5 font-medium",
                              isLowConfidence
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "text-muted-foreground",
                            )}
                          >
                            {isLowConfidence ? "Low confidence · " : ""}
                            {Math.round(candidate.confidence * 100)}%
                          </span>
                        </div>

                        {candidate.context && (
                          <p className="flex items-center gap-1.5 text-xs text-muted-foreground italic truncate">
                            <Quote className="size-3 shrink-0 opacity-50" />
                            {candidate.context}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteCandidate(candidate.id)}
                        className="text-muted-foreground hover:text-destructive size-9"
                        title="Discard"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("upload")}
                disabled={isPending}
              >
                Back to Image
              </Button>

              <Button
                type="button"
                onClick={handlePrepareVocabulary}
                disabled={isPending || selectedCandidateIds.size === 0}
                className="gap-2 min-w-48"
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Preparing translations...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4 text-amber-400" />
                    Prepare vocabulary ({selectedCandidateIds.size})
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* STEP 3: EDITABLE PREVIEW */}
      {step === "preview" && (
        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  Review & edit vocabulary
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Verify Uzbek translations and meanings before adding them to
                  your notebook.
                </p>
              </div>

              <div className="text-xs font-medium text-muted-foreground">
                {enrichedItems.filter((i) => !i.isDuplicate).length} new ·{" "}
                {enrichedItems.filter((i) => i.isDuplicate).length} duplicates
              </div>
            </div>

            {uploadError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <p className="flex-1">{uploadError}</p>
              </div>
            )}

            <div className="mt-4 space-y-4">
              {enrichedItems.map((item, index) => (
                <div
                  key={item.id || index}
                  className={cn(
                    "rounded-xl border p-4 sm:p-5 space-y-4 transition-all",
                    item.isDuplicate
                      ? "border-amber-300/60 bg-amber-50/40 dark:border-amber-800/60 dark:bg-amber-950/20"
                      : "bg-card shadow-xs",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          value={item.word}
                          onChange={(e) =>
                            handleUpdateEnriched(index, "word", e.target.value)
                          }
                          className="h-9 w-auto min-w-44 text-base font-semibold"
                        />
                        {item.partOfSpeech && (
                          <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                            {item.partOfSpeech}
                          </span>
                        )}
                        {item.pronunciation && (
                          <span className="font-mono text-xs text-muted-foreground">
                            {item.pronunciation}
                          </span>
                        )}
                      </div>

                      {item.isDuplicate && (
                        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                          <AlertCircle className="size-3.5" />
                          Already in your vocabulary · Will be skipped on save
                        </p>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteEnriched(index)}
                      className="text-muted-foreground hover:text-destructive size-8"
                      title="Remove"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Uzbek Translation{" "}
                        <span className="text-destructive">*</span>
                      </label>
                      <Input
                        value={item.translation}
                        onChange={(e) =>
                          handleUpdateEnriched(
                            index,
                            "translation",
                            e.target.value,
                          )
                        }
                        placeholder="e.g. mos, munosib"
                        required
                        className="h-10 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Simple English Definition
                      </label>
                      <Input
                        value={item.definition}
                        onChange={(e) =>
                          handleUpdateEnriched(
                            index,
                            "definition",
                            e.target.value,
                          )
                        }
                        placeholder="Suitable or right for a situation"
                        className="h-10 text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Example Sentence
                    </label>
                    <textarea
                      value={item.example}
                      onChange={(e) =>
                        handleUpdateEnriched(index, "example", e.target.value)
                      }
                      rows={2}
                      className="w-full resize-y rounded-xl border border-input bg-background p-2.5 text-sm leading-relaxed focus-visible:outline-ring"
                      placeholder="An example sentence showing natural usage"
                    />
                  </div>

                  {item.synonyms && item.synonyms.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="font-medium">Synonyms:</span>
                      {item.synonyms.map((syn, synIdx) => (
                        <span
                          key={synIdx}
                          className="rounded-md bg-secondary/80 px-2 py-0.5 font-medium text-secondary-foreground"
                        >
                          {syn}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("candidates")}
                disabled={isPending}
              >
                Back to Selection
              </Button>

              <Button
                type="button"
                onClick={handleConfirmImport}
                disabled={isPending || enrichedItems.length === 0}
                className="gap-2 min-w-44"
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving words...
                  </>
                ) : (
                  <>
                    <Check className="size-4" />
                    Confirm import
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* STEP 4: IMPORT COMPLETE */}
      {step === "complete" && (
        <Card className="p-8 text-center sm:p-12">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <CheckCircle2 className="size-10" />
          </div>

          <h2 className="mt-5 text-2xl font-bold tracking-tight">
            Import complete!
          </h2>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              {importResult.importedCount}{" "}
              {importResult.importedCount === 1 ? "word" : "words"} added
            </span>
            {importResult.skippedDuplicatesCount > 0 && (
              <>
                <span>·</span>
                <span>
                  {importResult.skippedDuplicatesCount} duplicates skipped
                </span>
              </>
            )}
          </div>

          <p className="mt-2 text-xs text-muted-foreground max-w-md mx-auto">
            Spaced repetition schedules have been initialized. All imported
            words are ready for your daily study session.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="default" className="gap-2">
              <Link href="/learn">
                <GraduationCap className="size-4" />
                Start Learning
              </Link>
            </Button>

            <Button asChild variant="outline" size="default" className="gap-2">
              <Link href="/vocabulary">
                <BookOpen className="size-4" />
                Open Vocabulary
              </Link>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="default"
              onClick={handleResetAll}
              className="gap-2"
            >
              <RotateCcw className="size-4" />
              Import Another Image
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
