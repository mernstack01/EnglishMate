import type { BoundingBox, MarkRegion, OcrWord } from "../types";
import { isDarkPixel } from "./underline-detection";

/**
 * Checks if a word is physically enclosed inside a drawn box or circle.
 * Evaluates the perimeter around the word bounding box for dark border pixels.
 */
export function evaluateWordBox(
  imageData: ImageData,
  bbox: BoundingBox,
): {
  isBoxed: boolean;
  confidence: number;
  boxBbox?: BoundingBox;
} {
  const { width, height, data } = imageData;

  const wordWidth = bbox.x1 - bbox.x0;
  const wordHeight = bbox.y1 - bbox.y0;

  if (wordWidth < 12 || wordHeight < 10) {
    return { isBoxed: false, confidence: 0 };
  }

  // Margin around the word to check for drawn box borders
  const marginX = Math.max(3, Math.min(12, wordWidth * 0.15));
  const marginY = Math.max(3, Math.min(10, wordHeight * 0.25));

  const outerX0 = Math.max(0, Math.floor(bbox.x0 - marginX));
  const outerX1 = Math.min(width - 1, Math.ceil(bbox.x1 + marginX));
  const outerY0 = Math.max(0, Math.floor(bbox.y0 - marginY));
  const outerY1 = Math.min(height - 1, Math.ceil(bbox.y1 + marginY));

  const spanX = outerX1 - outerX0;
  const spanY = outerY1 - outerY0;

  if (spanX <= 0 || spanY <= 0) {
    return { isBoxed: false, confidence: 0 };
  }

  // Check top margin border for dark pixels
  let topDark = 0;
  for (let x = outerX0; x <= outerX1; x++) {
    for (let y = outerY0; y < bbox.y0; y++) {
      const idx = (y * width + x) * 4;
      if (isDarkPixel(data[idx], data[idx + 1], data[idx + 2])) {
        topDark++;
        break; // Count once per column
      }
    }
  }

  // Check bottom margin border for dark pixels
  let bottomDark = 0;
  for (let x = outerX0; x <= outerX1; x++) {
    for (let y = Math.ceil(bbox.y1); y <= outerY1; y++) {
      const idx = (y * width + x) * 4;
      if (isDarkPixel(data[idx], data[idx + 1], data[idx + 2])) {
        bottomDark++;
        break;
      }
    }
  }

  // Check left margin border for dark pixels
  let leftDark = 0;
  for (let y = outerY0; y <= outerY1; y++) {
    for (let x = outerX0; x < bbox.x0; x++) {
      const idx = (y * width + x) * 4;
      if (isDarkPixel(data[idx], data[idx + 1], data[idx + 2])) {
        leftDark++;
        break;
      }
    }
  }

  // Check right margin border for dark pixels
  let rightDark = 0;
  for (let y = outerY0; y <= outerY1; y++) {
    for (let x = Math.ceil(bbox.x1); x <= outerX1; x++) {
      const idx = (y * width + x) * 4;
      if (isDarkPixel(data[idx], data[idx + 1], data[idx + 2])) {
        rightDark++;
        break;
      }
    }
  }

  const topRatio = topDark / spanX;
  const bottomRatio = bottomDark / spanX;
  const leftRatio = leftDark / spanY;
  const rightRatio = rightDark / spanY;

  // A drawn box/circle requires dark border continuity on all 4 perimeter segments
  const minThreshold = 0.4;
  if (
    topRatio >= minThreshold &&
    bottomRatio >= minThreshold &&
    leftRatio >= minThreshold &&
    rightRatio >= minThreshold
  ) {
    const avgRatio = (topRatio + bottomRatio + leftRatio + rightRatio) / 4;
    return {
      isBoxed: true,
      confidence: Math.round(Math.min(1, avgRatio * 1.1) * 100) / 100,
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
        type: "box",
        bbox: res.boxBbox,
        confidence: res.confidence,
      });
    }
  }

  return regions;
}
