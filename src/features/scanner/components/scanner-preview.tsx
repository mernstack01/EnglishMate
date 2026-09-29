"use client";

import React from "react";
import { RotateCcw, RotateCw, Scan, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScanProcessingStage } from "../types";

interface ScannerPreviewProps {
  imageSrc: string;
  rotation: number;
  stage: ScanProcessingStage;
  stageProgress: number; // 0 to 1
  stageMessage?: string;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onReplaceImage: () => void;
  onScanPage: () => void;
}

export function ScannerPreview({
  imageSrc,
  rotation,
  stage,
  stageProgress,
  stageMessage,
  onRotateLeft,
  onRotateRight,
  onReplaceImage,
  onScanPage,
}: ScannerPreviewProps) {
  const isProcessing =
    stage === "preparing" ||
    stage === "detecting-text" ||
    stage === "finding-marks";

  return (
    <div className="space-y-4">
      {/* Image Preview Container */}
      <div className="relative flex min-h-[280px] max-h-[550px] w-full items-center justify-center overflow-hidden rounded-3xl border bg-black/5 dark:bg-black/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt="Textbook preview"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: "transform 0.2s ease-in-out",
          }}
          className="max-h-[520px] w-auto max-w-full rounded-2xl object-contain p-2 shadow-sm"
        />

        {/* Processing Overlay Card */}
        {isProcessing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 p-6 text-center backdrop-blur-sm">
            <Loader2 className="size-10 animate-spin text-primary" />
            <h3 className="mt-4 text-base font-semibold sm:text-lg">
              {stage === "preparing" && "Preparing image..."}
              {stage === "detecting-text" && "Detecting English text..."}
              {stage === "finding-marks" && "Finding marked words..."}
            </h3>
            {stageMessage && (
              <p className="mt-1 text-xs text-muted-foreground">
                {stageMessage}
              </p>
            )}

            {/* Progress Bar */}
            <div className="mt-4 h-2 w-48 max-w-full overflow-hidden rounded-full bg-muted sm:w-64">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{
                  width: `${Math.round(stageProgress * 100)}%`,
                }}
              />
            </div>
            <span className="mt-1 text-xs font-medium text-muted-foreground">
              {Math.round(stageProgress * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* Control Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Rotation & Replacement controls */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRotateLeft}
            disabled={isProcessing}
            title="Rotate left 90°"
          >
            <RotateCcw className="size-4" />
            <span className="hidden sm:inline">Rotate Left</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRotateRight}
            disabled={isProcessing}
            title="Rotate right 90°"
          >
            <RotateCw className="size-4" />
            <span className="hidden sm:inline">Rotate Right</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReplaceImage}
            disabled={isProcessing}
          >
            <RefreshCw className="size-4" />
            Replace Image
          </Button>
        </div>

        {/* Primary Scan Button */}
        <Button
          type="button"
          size="lg"
          onClick={onScanPage}
          disabled={isProcessing}
          className="w-full shadow-md sm:w-auto"
        >
          {isProcessing ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <Scan className="size-4" />
              Scan Page
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
