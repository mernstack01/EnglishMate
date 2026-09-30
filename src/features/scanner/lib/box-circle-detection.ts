import type { BoundingBox, MarkRegion, OcrWord } from "../types";
import { isUnderlinePixel } from "./underline-detection";
import { rgbToHsv } from "./highlight-detection";

export interface WordBoxAnalysis {
  isBoxed: boolean;
  confidence: number;
  markType?: "circle" | "box";
  colorName?: string;
  boxBbox?: BoundingBox;
}

/**
 * Checks if a word is physically enclosed inside a drawn box or hand-drawn circle.
 * Evaluates the perimeter around the word bounding box for drawn ink/pen pixels
 * (supports colored pens like red/pink, blue, green, and dark pen/pencil).
 */
export function evaluateWordBox(
  imageData: ImageData,
  bbox: BoundingBox,
): WordBoxAnalysis {
  const { width, height, data } = imageData;

  const wordWidth = bbox.x1 - bbox.x0;
  const wordHeight = bbox.y1 - bbox.y0;

  if (wordWidth < 10 || wordHeight < 8) {
    return { isBoxed: false, confidence: 0 };
  }

  // --- Step 1: Check for hand-drawn colored pen circle (e.g. red/pink, blue, green pen) ---
  // Hand-drawn circles often intersect or wrap tightly around the word boundary.
  const padX = Math.max(4, Math.round(wordWidth * 0.12));
  const padY = Math.max(4, Math.round(wordHeight * 0.2));

  const x0 = Math.max(0, bbox.x0 - padX);
  const y0 = Math.max(0, bbox.y0 - padY);
  const x1 = Math.min(width, bbox.x1 + padX);
  const y1 = Math.min(height, bbox.y1 + padY);

  let redCount = 0;
  let topRed = 0,
    bottomRed = 0,
    leftRed = 0,
    rightRed = 0;

  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const hsv = rgbToHsv(r, g, b);
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // Red/pink pen stroke commonly used for circling words
      const isRedPen =
        ((hsv.h >= 335 && hsv.h <= 360) || (hsv.h >= 0 && hsv.h <= 25)) &&
        hsv.s >= 0.22 &&
        lum < 180;

      if (isRedPen) {
        redCount++;
        if (y < bbox.y0 + wordHeight * 0.3) topRed++;
        if (y > bbox.y1 - wordHeight * 0.3) bottomRed++;
        if (x < bbox.x0 + wordWidth * 0.3) leftRed++;
        if (x > bbox.x1 - wordWidth * 0.3) rightRed++;
      }
    }
  }

  // A complete circle enclosing the word must have red ink on all 4 quadrants (top, bottom, left, right)
  if (
    redCount >= 40 &&
    topRed > 15 &&
    bottomRed > 15 &&
    leftRed > 15 &&
    rightRed > 15
  ) {
    return {
      isBoxed: true,
      confidence: 0.95,
      markType: "circle",
      colorName: "red",
      boxBbox: { x0, y0, x1, y1 },
    };
  }

  // --- Step 2: Check for drawn rectangular box around outer margins ---
  const marginX = Math.max(4, Math.min(16, wordWidth * 0.18));
  const marginY = Math.max(4, Math.min(14, wordHeight * 0.3));

  const outerX0 = Math.max(0, Math.floor(bbox.x0 - marginX));
  const outerX1 = Math.min(width - 1, Math.ceil(bbox.x1 + marginX));
  const outerY0 = Math.max(0, Math.floor(bbox.y0 - marginY));
  const outerY1 = Math.min(height - 1, Math.ceil(bbox.y1 + marginY));

  const spanX = outerX1 - outerX0;
  const spanY = outerY1 - outerY0;

  if (spanX <= 0 || spanY <= 0) {
    return { isBoxed: false, confidence: 0 };
  }

  // Check top margin border for ink pixels (colored or dark pen)
  let topInk = 0;
  for (let x = outerX0; x <= outerX1; x++) {
    for (let y = outerY0; y < bbox.y0; y++) {
      const idx = (y * width + x) * 4;
      if (
        isUnderlinePixel(data[idx], data[idx + 1], data[idx + 2]).isUnderline
      ) {
        topInk++;
        break;
      }
    }
  }

  // Check bottom margin border for ink pixels
  let bottomInk = 0;
  for (let x = outerX0; x <= outerX1; x++) {
    for (let y = Math.ceil(bbox.y1); y <= outerY1; y++) {
      const idx = (y * width + x) * 4;
      if (
        isUnderlinePixel(data[idx], data[idx + 1], data[idx + 2]).isUnderline
      ) {
        bottomInk++;
        break;
      }
    }
  }

  // Check left margin border for ink pixels
  let leftInk = 0;
  for (let y = outerY0; y <= outerY1; y++) {
    for (let x = outerX0; x < bbox.x0; x++) {
      const idx = (y * width + x) * 4;
      if (
        isUnderlinePixel(data[idx], data[idx + 1], data[idx + 2]).isUnderline
      ) {
        leftInk++;
        break;
      }
    }
  }

  // Check right margin border for ink pixels
  let rightInk = 0;
  for (let y = outerY0; y <= outerY1; y++) {
    for (let x = Math.ceil(bbox.x1); x <= outerX1; x++) {
      const idx = (y * width + x) * 4;
      if (
        isUnderlinePixel(data[idx], data[idx + 1], data[idx + 2]).isUnderline
      ) {
        rightInk++;
        break;
      }
    }
  }

  const topRatio = topInk / spanX;
  const bottomRatio = bottomInk / spanX;
  const leftRatio = leftInk / spanY;
  const rightRatio = rightInk / spanY;

  // Drawn rectangular box requires solid ink presence on all 4 perimeter segments
  const minSideThreshold = 0.35;
  const avgRatio = (topRatio + bottomRatio + leftRatio + rightRatio) / 4;

  if (
    topRatio >= minSideThreshold &&
    bottomRatio >= minSideThreshold &&
    leftRatio >= minSideThreshold &&
    rightRatio >= minSideThreshold &&
    avgRatio >= 0.4
  ) {
    return {
      isBoxed: true,
      confidence: Math.round(Math.min(1, avgRatio * 1.15) * 100) / 100,
      markType: "box",
      boxBbox: {
        x0: outerX0,
        y0: outerY0,
        x1: outerX1,
        y1: outerY1,
      },
    };
  }

  return { isBoxed: false, confidence: 0 };
}

/**
 * Runs box evaluation across OCR words and returns detected MarkRegions.
 */
export function detectBoxRegions(
  imageData: ImageData,
  words: OcrWord[],
): MarkRegion[] {
  const regions: MarkRegion[] = [];

  for (const word of words) {
    const res = evaluateWordBox(imageData, word.bbox);
    if (res.isBoxed && res.boxBbox) {
      regions.push({
        type: res.markType || "box",
        bbox: res.boxBbox,
        confidence: res.confidence,
        colorName: res.colorName,
      });
    }
  }

  return regions;
}
