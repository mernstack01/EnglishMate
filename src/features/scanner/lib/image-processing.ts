/**
 * Image processing utilities for client-side camera/scanner.
 * Handles loading, dimension scaling, 90-degree step rotations, and ImageData extraction.
 *
 * RESIZING STRATEGY:
 * Smartphone cameras (iOS/Android) frequently produce photos of 4032x3024 (12MP) up to 48MP.
 * Running raw 12MP-48MP images through in-browser Tesseract.js and Canvas pixel loops
 * causes severe memory pressure (sometimes >500MB RAM) and mobile tab crashes.
 *
 * Downscaling the long edge to a maximum of 1800px:
 * - Preserves ~200-300 DPI for textbook text (optimal for OCR character clarity)
 * - Reduces total pixel processing by 4x to 8x
 * - Keeps memory usage under 60MB
 * - Maintains 100% deterministic coordinate mapping back to display coordinates
 */

export interface ProcessedCanvas {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  scale: number; // processed_dimension / original_dimension
  originalWidth: number;
  originalHeight: number;
  rotation: number;
}

export function loadImageElement(
  source: string | Blob | File,
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let objectUrl: string | null = null;

    img.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(
        new Error(
          "Failed to load image. The file may be corrupted or unsupported.",
        ),
      );
    };

    if (typeof source === "string") {
      img.src = source;
    } else {
      objectUrl = URL.createObjectURL(source);
      img.src = objectUrl;
    }
  });
}

export function createProcessedCanvas(
  img: HTMLImageElement,
  maxDimension = 1800,
  rotationDegrees = 0,
): ProcessedCanvas {
  const normRotation = ((rotationDegrees % 360) + 360) % 360;
  const isRotated90or270 = normRotation === 90 || normRotation === 270;

  const rawWidth = isRotated90or270 ? img.naturalHeight : img.naturalWidth;
  const rawHeight = isRotated90or270 ? img.naturalWidth : img.naturalHeight;

  // Calculate downscaling ratio
  const maxRaw = Math.max(rawWidth, rawHeight);
  const scale = maxRaw > maxDimension ? maxDimension / maxRaw : 1;

  const targetWidth = Math.round(rawWidth * scale);
  const targetHeight = Math.round(rawHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Unable to create 2D canvas context for image processing.");
  }

  ctx.save();

  // Translate and rotate around center
  ctx.translate(targetWidth / 2, targetHeight / 2);
  ctx.rotate((normRotation * Math.PI) / 180);

  // Scaled dimensions of original unrotated image
  const drawWidth = Math.round(img.naturalWidth * scale);
  const drawHeight = Math.round(img.naturalHeight * scale);

  ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

  ctx.restore();

  return {
    canvas,
    ctx,
    width: targetWidth,
    height: targetHeight,
    scale,
    originalWidth: rawWidth,
    originalHeight: rawHeight,
    rotation: normRotation,
  };
}

export function getImageDataSafe(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): ImageData | null {
  try {
    return ctx.getImageData(0, 0, width, height);
  } catch {
    return null;
  }
}
