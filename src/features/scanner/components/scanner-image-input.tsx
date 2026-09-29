"use client";

import React, { useRef, useState } from "react";
import { Camera, Upload, ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScannerImageInputProps {
  onImageSelected: (file: File) => void;
  maxSizeBytes?: number; // default 15MB
}

const DEFAULT_MAX_BYTES = 15 * 1024 * 1024; // 15MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function ScannerImageInput({
  onImageSelected,
  maxSizeBytes = DEFAULT_MAX_BYTES,
}: ScannerImageInputProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const validateAndProceed = (file: File) => {
    setError(null);

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setError(
        "Unsupported image format. Please select a JPEG, PNG, or WebP photo.",
      );
      return;
    }

    // Validate file size
    if (file.size > maxSizeBytes) {
      setError(
        `File size exceeds limit of ${Math.round(maxSizeBytes / (1024 * 1024))}MB.`,
      );
      return;
    }

    if (file.size === 0) {
      setError("The selected file is empty. Please choose a valid image.");
      return;
    }

    onImageSelected(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndProceed(file);
    }
    // Reset inputs so selecting the same file again triggers change
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndProceed(file);
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden native file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-label="Take photo with camera"
        onChange={handleFileChange}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-label="Upload image from gallery"
        onChange={handleFileChange}
      />

      {/* Drag & Drop / Input area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center rounded-3xl border-2 border-dashed p-6 text-center transition-colors sm:p-10 ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border bg-card/60 hover:bg-card"
        }`}
      >
        <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm sm:size-20">
          <Camera className="size-8 sm:size-10" />
        </div>

        <h2 className="text-xl font-semibold sm:text-2xl">
          Scan a textbook or notebook page
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Snap a photo or upload an image. The scanner detects English text and
          words you have highlighted or underlined.
        </p>

        {/* Action Buttons: Large and touch friendly */}
        <div className="mt-6 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button
            type="button"
            size="lg"
            className="w-full shadow-md sm:w-auto"
            onClick={() => cameraInputRef.current?.click()}
          >
            <Camera className="size-5" />
            Take Photo
          </Button>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-5" />
            Upload Image
          </Button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Supports JPEG, PNG, and WebP (up to 15MB)
        </p>
      </div>

      {/* Validation Error Message */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircle className="size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Privacy Notice Banner */}
      <div className="flex items-start gap-3 rounded-2xl border bg-muted/40 p-4 text-xs text-muted-foreground sm:text-sm">
        <ShieldCheck className="size-5 shrink-0 text-primary" />
        <div>
          <p className="font-semibold text-foreground">
            Local OCR processes the page on your device.
          </p>
          <p className="mt-0.5">
            Your image is analyzed directly inside your browser. No image data
            is sent to Gemini, OpenAI, or external cloud vision servers.
          </p>
        </div>
      </div>
    </div>
  );
}
