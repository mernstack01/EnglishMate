"use client";

import React, { useState, useEffect, useRef } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  ScanProcessingStage,
  ScanResult,
  ImportScannedWordsResult,
} from "../types";
import { ScannerImageInput } from "./scanner-image-input";
import { ScannerPreview } from "./scanner-preview";
import { ScannerReview } from "./scanner-review";
import {
  loadImageElement,
  createProcessedCanvas,
  getImageDataSafe,
} from "../lib/image-processing";
import { recognizeWordsLocally, terminateTesseractWorker } from "../lib/ocr";
import { detectHighlightRegions } from "../lib/highlight-detection";
import { detectUnderlineRegions } from "../lib/underline-detection";
import { detectBoxRegions } from "../lib/box-circle-detection";
import { matchWordsToMarks } from "../lib/mark-matching";
import { importScannedWordsAction } from "../scanner-actions";

export function ScannerContainer() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [rotation, setRotation] = useState<number>(0);

  // Scanning stages
  const [stage, setStage] = useState<ScanProcessingStage>("idle");
  const [stageProgress, setStageProgress] = useState<number>(0);
  const [stageMessage, setStageMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Output result
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  // Clean up object URLs and Tesseract worker when component unmounts
  const imageSrcRef = useRef<string | null>(null);

  useEffect(() => {
    imageSrcRef.current = imageSrc;
  }, [imageSrc]);

  useEffect(() => {
    return () => {
      if (imageSrcRef.current && imageSrcRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(imageSrcRef.current);
      }
      terminateTesseractWorker();
    };
  }, []);

  const handleImageSelected = (file: File) => {
    setErrorMessage(null);
    setScanResult(null);
    setRotation(0);

    if (imageSrc && imageSrc.startsWith("blob:")) {
      URL.revokeObjectURL(imageSrc);
    }

    const objectUrl = URL.createObjectURL(file);
    setImageSrc(objectUrl);
  };

  const handleRotateLeft = () => {
    setRotation((prev) => (prev - 90 + 360) % 360);
  };

  const handleRotateRight = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReplaceImage = () => {
    if (imageSrc && imageSrc.startsWith("blob:")) {
      URL.revokeObjectURL(imageSrc);
    }
    setImageSrc(null);
    setScanResult(null);
    setStage("idle");
    setErrorMessage(null);
    setRotation(0);
  };

  const handleScanPage = async () => {
    if (!imageSrc) return;

    setErrorMessage(null);
    setStage("preparing");
    setStageProgress(0.1);
    setStageMessage("Loading image...");

    try {
      // 1. Load image and scale to max 1800px on canvas with user rotation
      const imgElement = await loadImageElement(imageSrc);
      const processed = createProcessedCanvas(imgElement, 1800, rotation);

      setStageProgress(0.25);
      setStageMessage("Initializing local OCR engine...");
      setStage("detecting-text");

      // 2. Perform local OCR using Tesseract.js
      const ocrWords = await recognizeWordsLocally(
        processed.canvas,
        ({ progress }) => {
          // Map OCR progress 0..1 to overall progress 0.25..0.75
          setStageProgress(0.25 + progress * 0.5);
          setStageMessage(`Reading text (${Math.round(progress * 100)}%)...`);
        },
      );

      // 3. Mark Detection on Canvas ImageData
      setStage("finding-marks");
      setStageProgress(0.8);
      setStageMessage("Scanning for highlighters and underlines...");

      const imageData = getImageDataSafe(
        processed.ctx,
        processed.width,
        processed.height,
      );

      const highlightRegions = imageData
        ? detectHighlightRegions(imageData)
        : [];
      const underlineRegions = imageData
        ? detectUnderlineRegions(imageData, ocrWords)
        : [];
      const boxRegions = imageData ? detectBoxRegions(imageData, ocrWords) : [];

      const markRegions = [
        ...highlightRegions,
        ...underlineRegions,
        ...boxRegions,
      ];

      // 4. Match OCR words with detected physical marks
      setStageProgress(0.95);
      setStageMessage("Matching words to physical marks...");

      const { detectedWords, otherWords } = matchWordsToMarks(
        ocrWords,
        markRegions,
        imageData,
      );

      const result: ScanResult = {
        imageWidth: processed.width,
        imageHeight: processed.height,
        ocrWords,
        markRegions,
        detectedWords,
        otherWords,
      };

      setScanResult(result);
      setStage("ready");
      setStageProgress(1);
    } catch (err: unknown) {
      setStage("error");
      const message =
        err instanceof Error
          ? err.message
          : "An error occurred while scanning the image. Please try again.";
      setErrorMessage(message);
    }
  };

  const handleImportAction = async (
    words: Array<{ word: string; translation?: string; notes?: string }>,
  ): Promise<ImportScannedWordsResult> => {
    const res = await importScannedWordsAction({ words });
    if (!res.success) {
      throw new Error(res.error);
    }
    return res.data;
  };

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="size-5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReplaceImage}
          >
            <RefreshCw className="size-4" />
            Start Over
          </Button>
        </div>
      )}

      {/* Step 1: No image selected yet -> Show image input */}
      {!imageSrc && <ScannerImageInput onImageSelected={handleImageSelected} />}

      {/* Step 2: Image selected, not yet reviewed -> Show preview & scan CTA */}
      {imageSrc && !scanResult && (
        <ScannerPreview
          imageSrc={imageSrc}
          rotation={rotation}
          stage={stage}
          stageProgress={stageProgress}
          stageMessage={stageMessage}
          onRotateLeft={handleRotateLeft}
          onRotateRight={handleRotateRight}
          onReplaceImage={handleReplaceImage}
          onScanPage={handleScanPage}
        />
      )}

      {/* Step 3: Scan complete -> Show Review screen */}
      {imageSrc && scanResult && (
        <ScannerReview
          imageSrc={imageSrc}
          scanResult={scanResult}
          onRescan={handleScanPage}
          onImport={handleImportAction}
        />
      )}
    </div>
  );
}
