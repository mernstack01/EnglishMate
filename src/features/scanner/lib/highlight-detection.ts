import type { BoundingBox, MarkRegion } from "../types";

export type HighlightColor = "yellow" | "green" | "pink" | "orange" | "blue";

export interface HsvColor {
  h: number; // 0 to 360
  s: number; // 0 to 1
  v: number; // 0 to 1
}

export interface WordHighlightAnalysis {
  isHighlighted: boolean;
  colorName?: HighlightColor;
  confidence: number;
  coverage: number;
  avgSaturation: number;
  avgValue: number;
  paddedBbox: BoundingBox;
}

/**
 * Converts RGB (0-255) to HSV.
 */
export function rgbToHsv(r: number, g: number, b: number): HsvColor {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  const s = max === 0 ? 0 : delta / max;
  const v = max;

  if (delta !== 0) {
    if (max === rNorm) {
      h = ((gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0)) % 6;
    } else if (max === gNorm) {
      h = (bNorm - rNorm) / delta + 2;
    } else {
      h = (rNorm - gNorm) / delta + 4;
    }
    h *= 60;
  }

  return { h, s, v };
}

/**
 * Checks whether an HSV pixel is dark printed text ink.
 */
export function isDarkTextPixel(hsv: HsvColor): boolean {
  return hsv.v < 0.32 || (hsv.s < 0.22 && hsv.v < 0.42);
}

/**
 * Checks whether an HSV pixel is neutral, unhighlighted paper background (white, light gray, cream).
 */
export function isNeutralPaperPixel(hsv: HsvColor): boolean {
  return hsv.s < 0.14 && hsv.v > 0.65;
}

/**
 * Classifies an individual pixel into a highlighter color cluster without hue boundary gaps.
 * Tolerates semi-transparent real highlighters, paper anti-aliasing, and camera exposure variation.
 */
export function classifyHighlighter(hsv: HsvColor): HighlightColor | null {
  // Reject dark text pixels and neutral paper pixels
  if (isDarkTextPixel(hsv) || isNeutralPaperPixel(hsv)) {
    return null;
  }

  const { h, s, v } = hsv;

  // 1. Yellow highlighter (Hue 34° - 76°)
  // Catches warm yellow through neon chartreuse yellow, even with moderate saturation on white paper
  if (
    (h >= 34 && h <= 76 && s >= 0.14 && v >= 0.45) ||
    (h >= 40 && h <= 72 && s >= 0.11 && v >= 0.7)
  ) {
    return "yellow";
  }

  // 2. Green highlighter (Hue 76° - 168°)
  // Neon green, mint green, and pastel green
  if (h > 76 && h <= 168 && s >= 0.14 && v >= 0.38) {
    return "green";
  }

  // 3. Pink / Magenta highlighter (Hue 280° - 360° or 0° - 18°)
  // Continuous wrap-around at 360°/0°, catches fluorescent pink and magenta
  if (
    ((h >= 280 && h <= 360) || (h >= 0 && h <= 18)) &&
    s >= 0.14 &&
    v >= 0.45
  ) {
    return "pink";
  }

  // 4. Orange highlighter (Hue 14° - 34°)
  if (h >= 14 && h < 34 && s >= 0.22 && v >= 0.5) {
    return "orange";
  }

  // 5. Blue / Cyan highlighter (Hue 168° - 255°)
  if (h > 168 && h <= 255 && s >= 0.14 && v >= 0.42) {
    return "blue";
  }

  return null;
}

/**
 * Evaluates highlight presence directly for an OCR word using proportional padding.
 *
 * Algorithm:
 * 1. Proportional padding around word bbox (width pad ~8%, height pad ~20%) to capture
 *    highlighter ink extending beyond glyph edges.
 * 2. Exclude dark text pixels from the denominator.
 * 3. Exclude near-neutral paper background.
 * 4. Measure chromatic highlighter coverage over non-dark background pixels.
 * 5. Determine dominant color cluster and calculate confidence score.
 */
export function analyzeHighlightForWord(
  imageData: ImageData,
  bbox: BoundingBox,
): WordHighlightAnalysis {
  const { width, height, data } = imageData;

  const wordWidth = Math.max(1, bbox.x1 - bbox.x0);
  const wordHeight = Math.max(1, bbox.y1 - bbox.y0);

  // Proportional padding (8% width, 20% height, at least 2px)
  const padX = Math.max(2, Math.round(wordWidth * 0.08));
  const padY = Math.max(3, Math.round(wordHeight * 0.2));

  const x0 = Math.max(0, Math.floor(bbox.x0 - padX));
  const y0 = Math.max(0, Math.floor(bbox.y0 - padY));
  const x1 = Math.min(width, Math.ceil(bbox.x1 + padX));
  const y1 = Math.min(height, Math.ceil(bbox.y1 + padY));

  const paddedBbox: BoundingBox = { x0, y0, x1, y1 };

  const counts: Record<HighlightColor, number> = {
    yellow: 0,
    green: 0,
    pink: 0,
    orange: 0,
    blue: 0,
  };

  let matchingPixels = 0;
  let nonDarkPixels = 0;
  let satSum = 0;
  let valSum = 0;

  // Step 2px for fast scanning while retaining dense sampling
  const step = 2;

  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const hsv = rgbToHsv(r, g, b);

      if (!isDarkTextPixel(hsv)) {
        nonDarkPixels++;
      }

      const color = classifyHighlighter(hsv);
      if (color) {
        counts[color]++;
        matchingPixels++;
        satSum += hsv.s;
        valSum += hsv.v;
      }
    }
  }

  if (nonDarkPixels === 0 || matchingPixels === 0) {
    return {
      isHighlighted: false,
      confidence: 0,
      coverage: 0,
      avgSaturation: 0,
      avgValue: 0,
      paddedBbox,
    };
  }

  // Chromatic coverage relative to non-dark background pixels
  const coverage = matchingPixels / nonDarkPixels;
  const avgSaturation = Math.round((satSum / matchingPixels) * 100) / 100;
  const avgValue = Math.round((valSum / matchingPixels) * 100) / 100;

  // Decision rule:
  // - High-confidence highlight: requires at least 20% chromatic coverage and 10 sampled pixels
  // This robustly prevents highlighter strokes bleeding over onto neighboring ordinary words (e.g. "places" next to "beautiful")
  const isHighlighted = coverage >= 0.2 && matchingPixels >= 10;

  if (isHighlighted) {
    // Find dominant color
    let dominantColor: HighlightColor = "yellow";
    let maxCount = -1;
    for (const [col, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantColor = col as HighlightColor;
      }
    }

    const confidence = Math.min(
      1,
      Math.round((0.55 + Math.min(0.45, coverage * 0.75)) * 100) / 100,
    );

    return {
      isHighlighted: true,
      colorName: dominantColor,
      confidence,
      coverage: Math.round(coverage * 100) / 100,
      avgSaturation,
      avgValue,
      paddedBbox,
    };
  }

  return {
    isHighlighted: false,
    confidence: 0,
    coverage: Math.round(coverage * 100) / 100,
    avgSaturation,
    avgValue,
    paddedBbox,
  };
}

/**
 * Backward-compatible wrapper calling analyzeHighlightForWord.
 */
export function evaluateWordHighlight(
  imageData: ImageData,
  bbox: BoundingBox,
): WordHighlightAnalysis {
  return analyzeHighlightForWord(imageData, bbox);
}

/**
 * Detects global highlight regions across the canvas by grid downsampling.
 * Used for the visual debug overlay and region matching.
 */
export function detectHighlightRegions(
  imageData: ImageData,
  gridSize = 10,
): MarkRegion[] {
  const { width, height, data } = imageData;
  const cols = Math.ceil(width / gridSize);
  const rows = Math.ceil(height / gridSize);

  // Grid mask storing dominant highlight color for each cell
  const grid: Array<HighlightColor | null> = new Array(cols * rows).fill(null);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const centerX = Math.min(
        width - 1,
        Math.floor(c * gridSize + gridSize / 2),
      );
      const centerY = Math.min(
        height - 1,
        Math.floor(r * gridSize + gridSize / 2),
      );

      const idx = (centerY * width + centerX) * 4;
      const hsv = rgbToHsv(data[idx], data[idx + 1], data[idx + 2]);
      grid[r * cols + c] = classifyHighlighter(hsv);
    }
  }

  const regions: MarkRegion[] = [];

  for (let r = 0; r < rows; r++) {
    let startC = -1;
    let currentColor: HighlightColor | null = null;

    for (let c = 0; c < cols; c++) {
      const color = grid[r * cols + c];

      if (color && currentColor === color) {
        continue;
      }

      if (currentColor && startC !== -1) {
        const x0 = startC * gridSize;
        const x1 = Math.min(width, c * gridSize);
        const y0 = r * gridSize;
        const y1 = Math.min(height, (r + 1) * gridSize);

        regions.push({
          type: "highlight",
          bbox: { x0, y0, x1, y1 },
          confidence: 0.85,
          colorName: currentColor,
        });
      }

      currentColor = color;
      startC = color ? c : -1;
    }

    if (currentColor && startC !== -1) {
      const x0 = startC * gridSize;
      const x1 = width;
      const y0 = r * gridSize;
      const y1 = Math.min(height, (r + 1) * gridSize);

      regions.push({
        type: "highlight",
        bbox: { x0, y0, x1, y1 },
        confidence: 0.85,
        colorName: currentColor,
      });
    }
  }

  return regions;
}
