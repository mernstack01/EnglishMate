import type { BoundingBox, MarkRegion, OcrWord } from "../types";

/**
 * Checks whether a given pixel is dark (ink/pen/pencil line) against a lighter paper background.
 */
export function isDarkPixel(
  r: number,
  g: number,
  b: number,
  maxBrightness = 135,
): boolean {
  // Grayscale luminance
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance < maxBrightness;
}

/**
 * Evaluates whether an OCR word has a drawn physical underline immediately below it.
 */
export function evaluateWordUnderline(
  imageData: ImageData,
  bbox: BoundingBox,
): {
  isUnderlined: boolean;
  confidence: number;
  underlineBbox?: BoundingBox;
} {
  const { width, height, data } = imageData;

  const wordWidth = bbox.x1 - bbox.x0;
  const wordHeight = bbox.y1 - bbox.y0;

  if (wordWidth < 10 || wordHeight < 8) {
    return { isUnderlined: false, confidence: 0 };
  }

  // Define underline search band immediately beneath the word
  // Start slightly above baseline (h * 0.05) to catch tight underlines,
  // extending up to 45% of word height below the word.
  const searchY0 = Math.max(0, Math.floor(bbox.y1 - wordHeight * 0.05));
  const searchY1 = Math.min(
    height - 1,
    Math.ceil(bbox.y1 + Math.max(6, wordHeight * 0.45)),
  );

  const searchX0 = Math.max(0, Math.floor(bbox.x0 - wordWidth * 0.05));
  const searchX1 = Math.min(width - 1, Math.ceil(bbox.x1 + wordWidth * 0.05));
  const searchSpan = searchX1 - searchX0;

  if (searchSpan <= 0 || searchY1 <= searchY0) {
    return { isUnderlined: false, confidence: 0 };
  }

  // Scan row by row within the band to find horizontal line segments
  let bestRow = -1;
  let bestDarkRatio = 0;
  let bestLineX0 = searchX0;
  let bestLineX1 = searchX1;

  for (let y = searchY0; y <= searchY1; y++) {
    let darkCount = 0;
    let minDarkX = -1;
    let maxDarkX = -1;

    for (let x = searchX0; x <= searchX1; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      if (isDarkPixel(r, g, b)) {
        darkCount++;
        if (minDarkX === -1) minDarkX = x;
        maxDarkX = x;
      }
    }

    // Ratio of dark pixels across the word span
    const darkRatio = darkCount / searchSpan;

    // A handwritten/drawn underline typically covers 40% to 90% of the word span in that row
    if (darkRatio >= 0.4 && darkRatio > bestDarkRatio) {
      bestDarkRatio = darkRatio;
      bestRow = y;
      bestLineX0 = minDarkX !== -1 ? minDarkX : searchX0;
      bestLineX1 = maxDarkX !== -1 ? maxDarkX : searchX1;
    }
  }

  // If a dense dark row was found, check vertical thickness
  if (bestRow !== -1 && bestDarkRatio >= 0.4) {
    // Measure thickness of the line (adjacent rows above/below)
    let thickness = 1;
    for (let dy = 1; dy <= 4; dy++) {
      const yBelow = bestRow + dy;
      if (yBelow <= searchY1) {
        let count = 0;
        for (let x = searchX0; x <= searchX1; x++) {
          const idx = (yBelow * width + x) * 4;
          if (isDarkPixel(data[idx], data[idx + 1], data[idx + 2])) count++;
        }
        if (count / searchSpan >= 0.3) {
          thickness++;
        } else {
          break;
        }
      }
    }

    // Normal pen underlines are between 1 and 6 pixels thick.
    // If thickness > 10, it's likely a solid black block or dark photo, not an underline.
    if (thickness <= 8) {
      // Confidence calculated from horizontal coverage and proximity
      const coverageScore = Math.min(1, bestDarkRatio * 1.2);
      const verticalDistance = bestRow - bbox.y1;
      const maxDistance = Math.max(6, wordHeight * 0.45);
      const proximityScore = Math.max(
        0,
        1 - Math.abs(verticalDistance) / maxDistance,
      );

      const confidence = Math.min(
        1,
        coverageScore * 0.65 + proximityScore * 0.35,
      );

      return {
        isUnderlined: true,
        confidence: Math.round(confidence * 100) / 100,
        underlineBbox: {
          x0: bestLineX0,
          y0: bestRow,
          x1: bestLineX1,
          y1: bestRow + thickness,
        },
      };
    }
  }

  return { isUnderlined: false, confidence: 0 };
}

/**
 * Runs underline evaluation across all recognized OCR words and returns detected MarkRegions.
 */
export function detectUnderlineRegions(
  imageData: ImageData,
  words: OcrWord[],
): MarkRegion[] {
  const regions: MarkRegion[] = [];

  for (const word of words) {
    const res = evaluateWordUnderline(imageData, word.bbox);
    if (res.isUnderlined && res.underlineBbox) {
      regions.push({
        type: "underline",
        bbox: res.underlineBbox,
        confidence: res.confidence,
      });
    }
  }

  return regions;
}
