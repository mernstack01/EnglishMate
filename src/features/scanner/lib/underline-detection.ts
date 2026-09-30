import type { BoundingBox, MarkRegion, OcrWord } from "../types";
import { rgbToHsv, classifyHighlighter } from "./highlight-detection";

export type UnderlineColor = "dark" | "blue" | "red" | "green" | "colored";

export interface WordUnderlineAnalysis {
  isUnderlined: boolean;
  confidence: number;
  colorName?: UnderlineColor;
  horizontalCoverage: number;
  verticalDistance: number;
  underlineBbox?: BoundingBox;
}

/**
 * Checks whether a given pixel is dark against a lighter paper background.
 */
export function isDarkPixel(
  r: number,
  g: number,
  b: number,
  maxBrightness = 135,
): boolean {
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance < maxBrightness;
}

/**
 * Checks whether a pixel belongs to a drawn underline mark.
 * Supports black/pencil dark ink as well as blue, red, green, and colored pens.
 * Explicitly rejects fluorescent/semi-transparent highlighters and neutral paper background.
 */
export function isUnderlinePixel(
  r: number,
  g: number,
  b: number,
): {
  isUnderline: boolean;
  color?: UnderlineColor;
} {
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  const hsv = rgbToHsv(r, g, b);

  // Reject bright fluorescent highlighters (highlighters are wide translucent strokes, not pen lines)
  if (luminance >= 145 && classifyHighlighter(hsv) !== null) {
    return { isUnderline: false };
  }

  // 1. Dark ink / black pen / pencil (luminance < 135, low saturation)
  if (luminance < 135 && hsv.s < 0.35) {
    return { isUnderline: true, color: "dark" };
  }

  // 2. Blue pen underline (e.g., ballpoint blue, royal blue, dark blue)
  // Blue pen ink has hue ~175° - 255°, saturation >= 0.20, luminance < 145
  if (hsv.h >= 175 && hsv.h <= 255 && hsv.s >= 0.2 && luminance < 145) {
    return { isUnderline: true, color: "blue" };
  }

  // 3. Red pen underline
  // Red pen ink has hue ~340° - 360° or 0° - 25°, saturation >= 0.22, luminance < 135
  if (
    ((hsv.h >= 340 && hsv.h <= 360) || (hsv.h >= 0 && hsv.h <= 25)) &&
    hsv.s >= 0.22 &&
    luminance < 135
  ) {
    return { isUnderline: true, color: "red" };
  }

  // 4. Green pen underline (darker green ink, not neon green highlighter)
  if (hsv.h >= 75 && hsv.h <= 165 && hsv.s >= 0.22 && luminance < 125) {
    return { isUnderline: true, color: "green" };
  }

  // 5. Any other saturated colored pen line on light paper
  if (hsv.s >= 0.3 && luminance < 130) {
    return { isUnderline: true, color: "colored" };
  }

  return { isUnderline: false };
}

/**
 * Evaluates whether an OCR word has a drawn physical underline immediately below it.
 * Supports black, blue, red, and colored pens.
 */
export function evaluateWordUnderline(
  imageData: ImageData,
  bbox: BoundingBox,
): WordUnderlineAnalysis {
  const { width, height, data } = imageData;

  const wordWidth = bbox.x1 - bbox.x0;
  const wordHeight = bbox.y1 - bbox.y0;

  if (wordWidth < 8 || wordHeight < 6) {
    return {
      isUnderlined: false,
      confidence: 0,
      horizontalCoverage: 0,
      verticalDistance: 0,
    };
  }

  // 1. Colored pen search band (blue, red, green, colored ink):
  // Can safely start slightly above bbox.y1 (up to 22% of word height) to handle descenders
  // (e.g. 'hiking,' where the blue line sits under the 'hikin' baseline, while 'g' and ',' extend lower).
  // Colored ink is never confused with black printed text.
  const coloredY0 = Math.max(
    0,
    Math.floor(bbox.y1 - Math.max(5, wordHeight * 0.22)),
  );
  const coloredY1 = Math.min(
    height - 1,
    Math.ceil(bbox.y1 + Math.max(6, Math.min(12, wordHeight * 0.25))),
  );

  // 2. Dark ink search band (black pen / pencil):
  // Must start strictly below bbox.y1 + 1 to avoid mistaking the word's own black character bottoms/serifs for underlines.
  // Must end strictly before the top of the next line of text.
  const darkY0 = Math.min(height - 1, Math.ceil(bbox.y1 + 1));
  const darkY1 = Math.min(
    height - 1,
    Math.ceil(bbox.y1 + Math.max(5, Math.min(10, wordHeight * 0.22))),
  );

  const searchX0 = Math.max(0, Math.floor(bbox.x0 - wordWidth * 0.05));
  const searchX1 = Math.min(width - 1, Math.ceil(bbox.x1 + wordWidth * 0.05));
  const searchSpan = searchX1 - searchX0;

  if (searchSpan <= 0) {
    return {
      isUnderlined: false,
      confidence: 0,
      horizontalCoverage: 0,
      verticalDistance: 0,
    };
  }

  // --- Step A: Check for Colored Pen Underline (Priority) ---
  let bestColoredRatio = 0;
  let bestColoredRow = -1;
  let bestColoredLineX0 = searchX0;
  let bestColoredLineX1 = searchX1;
  let bestColoredType: UnderlineColor = "blue";

  for (let y = coloredY0; y <= coloredY1; y++) {
    let coloredPixelCount = 0;
    let minLineX = -1;
    let maxLineX = -1;
    const colorCounts: Record<UnderlineColor, number> = {
      dark: 0,
      blue: 0,
      red: 0,
      green: 0,
      colored: 0,
    };

    for (let x = searchX0; x <= searchX1; x++) {
      const idx = (y * width + x) * 4;
      const res = isUnderlinePixel(data[idx], data[idx + 1], data[idx + 2]);
      if (res.isUnderline && res.color && res.color !== "dark") {
        coloredPixelCount++;
        colorCounts[res.color]++;
        if (minLineX === -1) minLineX = x;
        maxLineX = x;
      }
    }

    const lineRatio = coloredPixelCount / searchSpan;
    if (lineRatio >= 0.48 && lineRatio > bestColoredRatio) {
      bestColoredRatio = lineRatio;
      bestColoredRow = y;
      bestColoredLineX0 = minLineX !== -1 ? minLineX : searchX0;
      bestColoredLineX1 = maxLineX !== -1 ? maxLineX : searchX1;

      let maxC = 0;
      for (const [c, count] of Object.entries(colorCounts)) {
        if (count > maxC && c !== "dark") {
          maxC = count;
          bestColoredType = c as UnderlineColor;
        }
      }
    }
  }

  if (bestColoredRow !== -1 && bestColoredRatio >= 0.48) {
    let thickness = 1;
    for (let dy = 1; dy <= 4; dy++) {
      const yBelow = bestColoredRow + dy;
      if (yBelow <= coloredY1) {
        let count = 0;
        for (let x = searchX0; x <= searchX1; x++) {
          const idx = (yBelow * width + x) * 4;
          const res = isUnderlinePixel(data[idx], data[idx + 1], data[idx + 2]);
          if (res.isUnderline && res.color && res.color !== "dark") {
            count++;
          }
        }
        if (count / searchSpan >= 0.25) {
          thickness++;
        } else {
          break;
        }
      }
    }

    if (thickness <= 7) {
      const horizontalCoverage = Math.min(1, bestColoredRatio * 1.15);
      const verticalDistance = bestColoredRow - bbox.y1;
      const confidence = Math.min(
        1,
        Math.round((0.65 + horizontalCoverage * 0.35) * 100) / 100,
      );

      return {
        isUnderlined: true,
        confidence,
        colorName: bestColoredType,
        horizontalCoverage: Math.round(horizontalCoverage * 100) / 100,
        verticalDistance,
        underlineBbox: {
          x0: bestColoredLineX0,
          y0: bestColoredRow,
          x1: bestColoredLineX1,
          y1: bestColoredRow + thickness,
        },
      };
    }
  }

  // --- Step B: Check for Dark Pen Underline (Strict Thresholds) ---
  if (darkY1 > darkY0) {
    let bestDarkRatio = 0;
    let bestDarkRow = -1;
    let bestDarkLineX0 = searchX0;
    let bestDarkLineX1 = searchX1;

    for (let y = darkY0; y <= darkY1; y++) {
      let darkPixelCount = 0;
      let minLineX = -1;
      let maxLineX = -1;

      for (let x = searchX0; x <= searchX1; x++) {
        const idx = (y * width + x) * 4;
        const res = isUnderlinePixel(data[idx], data[idx + 1], data[idx + 2]);
        if (res.isUnderline && res.color === "dark") {
          darkPixelCount++;
          if (minLineX === -1) minLineX = x;
          maxLineX = x;
        }
      }

      const lineRatio = darkPixelCount / searchSpan;
      if (lineRatio >= 0.55 && lineRatio > bestDarkRatio) {
        bestDarkRatio = lineRatio;
        bestDarkRow = y;
        bestDarkLineX0 = minLineX !== -1 ? minLineX : searchX0;
        bestDarkLineX1 = maxLineX !== -1 ? maxLineX : searchX1;
      }
    }

    if (bestDarkRow !== -1 && bestDarkRatio >= 0.55) {
      let thickness = 1;
      for (let dy = 1; dy <= 4; dy++) {
        const yBelow = bestDarkRow + dy;
        if (yBelow <= darkY1) {
          let count = 0;
          for (let x = searchX0; x <= searchX1; x++) {
            const idx = (yBelow * width + x) * 4;
            const res = isUnderlinePixel(
              data[idx],
              data[idx + 1],
              data[idx + 2],
            );
            if (res.isUnderline && res.color === "dark") {
              count++;
            }
          }
          if (count / searchSpan >= 0.3) {
            thickness++;
          } else {
            break;
          }
        }
      }

      if (thickness <= 6) {
        const horizontalCoverage = Math.min(1, bestDarkRatio * 1.1);
        const verticalDistance = bestDarkRow - bbox.y1;
        const confidence = Math.round(horizontalCoverage * 0.85 * 100) / 100;

        if (confidence >= 0.65) {
          return {
            isUnderlined: true,
            confidence,
            colorName: "dark",
            horizontalCoverage: Math.round(horizontalCoverage * 100) / 100,
            verticalDistance,
            underlineBbox: {
              x0: bestDarkLineX0,
              y0: bestDarkRow,
              x1: bestDarkLineX1,
              y1: bestDarkRow + thickness,
            },
          };
        }
      }
    }
  }

  return {
    isUnderlined: false,
    confidence: 0,
    horizontalCoverage: Math.round(Math.max(bestColoredRatio, 0) * 100) / 100,
    verticalDistance: 0,
  };
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
        colorName: res.colorName,
      });
    }
  }

  return regions;
}
