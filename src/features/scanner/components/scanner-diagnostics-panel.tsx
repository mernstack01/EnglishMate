"use client";

import React, { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Bug,
  Search,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ScanDiagnostics } from "../types";

interface ScannerDiagnosticsPanelProps {
  diagnostics: ScanDiagnostics;
}

export function ScannerDiagnosticsPanel({
  diagnostics,
}: ScannerDiagnosticsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<
    "all" | "selected" | "highlight" | "underline" | "box" | "rejected"
  >("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { image, ocr, marks, matching, wordDiagnostics } = diagnostics;

  const filteredWords = wordDiagnostics.filter((w) => {
    if (searchTerm) {
      const match =
        w.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.normalized.toLowerCase().includes(searchTerm.toLowerCase());
      if (!match) return false;
    }

    if (filter === "selected") return w.selected;
    if (filter === "highlight") return w.bestMarkType === "highlight";
    if (filter === "underline") return w.bestMarkType === "underline";
    if (filter === "box")
      return w.bestMarkType === "box" || w.bestMarkType === "circle";
    if (filter === "rejected") return !w.selected;

    return true;
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/5 text-foreground shadow-sm">
      {/* Panel Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-amber-500/10"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
            <Bug className="size-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              Scanner Diagnostics (Development Mode)
            </h4>
            <p className="text-xs text-muted-foreground">
              {matching.matchedMarkedWordCount} marks detected ·{" "}
              {ocr.totalOcrWords} OCR words · {marks.finalMarkRegionCount}{" "}
              regions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400">
          <span>{isOpen ? "Hide" : "Show"} details</span>
          {isOpen ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </div>
      </button>

      {/* Expanded Diagnostics Content */}
      {isOpen && (
        <div className="space-y-4 border-t border-amber-500/20 p-4 text-xs">
          {/* Top Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Image Stats */}
            <div className="rounded-xl border bg-background/80 p-3">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                Image Dimensions
              </span>
              <p className="mt-1 font-mono text-sm font-medium">
                {image.processedWidth} × {image.processedHeight}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Orig: {image.originalWidth} × {image.originalHeight} (rot:{" "}
                {image.rotation}°, scale: {image.scale.toFixed(2)})
              </p>
            </div>

            {/* OCR Stats */}
            <div className="rounded-xl border bg-background/80 p-3">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                OCR Words
              </span>
              <p className="mt-1 font-mono text-sm font-medium">
                {ocr.validNormalizedWords} / {ocr.totalOcrWords}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Avg confidence: {ocr.averageConfidence}%
              </p>
            </div>

            {/* Mark Breakdown */}
            <div className="rounded-xl border bg-background/80 p-3">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                Detected Mark Types
              </span>
              <p className="mt-1 font-mono text-sm font-medium">
                H:{marks.highlightCandidateCount} · U:
                {marks.underlineCandidateCount} · B:{marks.boxCandidateCount}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Total regions: {marks.finalMarkRegionCount}
              </p>
            </div>

            {/* Matched Words */}
            <div className="rounded-xl border bg-background/80 p-3">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                Matched Words
              </span>
              <p className="mt-1 font-mono text-sm font-medium text-emerald-600 dark:text-emerald-400">
                {matching.matchedMarkedWordCount} marked words
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Auto-selected for notebook
              </p>
            </div>
          </div>

          {/* Filtering and Search Controls */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: "all", label: `All (${wordDiagnostics.length})` },
                  {
                    id: "selected",
                    label: `Selected (${matching.matchedMarkedWordCount})`,
                  },
                  {
                    id: "highlight",
                    label: `Highlights (${marks.highlightCandidateCount})`,
                  },
                  {
                    id: "underline",
                    label: `Underlines (${marks.underlineCandidateCount})`,
                  },
                  { id: "box", label: `Boxes (${marks.boxCandidateCount})` },
                  {
                    id: "rejected",
                    label: `Unmarked (${wordDiagnostics.length - matching.matchedMarkedWordCount})`,
                  },
                ] as const
              ).map((f) => (
                <Button
                  key={f.id}
                  type="button"
                  variant={filter === f.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(f.id)}
                  className="h-7 text-xs"
                >
                  {f.label}
                </Button>
              ))}
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search word..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>

          {/* Candidates Diagnostic List */}
          <div className="max-h-96 overflow-y-auto rounded-xl border bg-background divide-y">
            {filteredWords.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                No words match filter &quot;{filter}&quot;
              </div>
            ) : (
              filteredWords.map((w, idx) => (
                <div
                  key={`${w.word}_${idx}`}
                  className="p-3 transition-colors hover:bg-muted/30"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {w.selected ? (
                        <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="size-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="font-semibold text-sm text-foreground">
                        {w.word}
                      </span>
                      {w.normalized &&
                        w.normalized !== w.word.toLowerCase() && (
                          <span className="text-muted-foreground">
                            ({w.normalized})
                          </span>
                        )}
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                        OCR {w.ocrConfidence}%
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                          w.selected
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {w.bestMarkType.toUpperCase()} (
                        {Math.round(w.markConfidence * 100)}%)
                      </span>
                    </div>
                  </div>

                  {/* Word Details & Coordinates */}
                  <div className="mt-2 grid grid-cols-1 gap-1 text-[11px] sm:grid-cols-2 text-muted-foreground">
                    <div>
                      <span className="font-medium text-foreground">
                        BBox:{" "}
                      </span>
                      <code className="font-mono">
                        [{Math.round(w.bbox.x0)}, {Math.round(w.bbox.y0)},{" "}
                        {Math.round(w.bbox.x1)}, {Math.round(w.bbox.y1)}]
                      </code>
                    </div>

                    {w.highlightStats && (
                      <div>
                        <span className="font-medium text-foreground">
                          Highlight:{" "}
                        </span>
                        <span>
                          {w.highlightStats.color ?? "none"} (cov:{" "}
                          {Math.round(w.highlightStats.coverage * 100)}%, sat:{" "}
                          {w.highlightStats.avgSaturation}, val:{" "}
                          {w.highlightStats.avgValue})
                        </span>
                      </div>
                    )}

                    {w.underlineStats && (
                      <div>
                        <span className="font-medium text-foreground">
                          Underline:{" "}
                        </span>
                        <span>
                          {w.underlineStats.color ?? "dark"} (cov:{" "}
                          {Math.round(
                            w.underlineStats.horizontalCoverage * 100,
                          )}
                          %, dist:{" "}
                          {Math.round(w.underlineStats.verticalDistance)}
                          px)
                        </span>
                      </div>
                    )}

                    {w.boxStats && (
                      <div>
                        <span className="font-medium text-foreground">
                          Box/Circle:{" "}
                        </span>
                        <span>
                          {w.boxStats.isBoxed ? "Yes" : "No"} (conf:{" "}
                          {Math.round(w.boxStats.confidence * 100)}%)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Decision Reason */}
                  <p className="mt-1 text-[11px] text-foreground/80 italic">
                    Reason: {w.reason}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
