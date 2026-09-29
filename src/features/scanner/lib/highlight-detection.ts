import type { BoundingBox, MarkRegion } from "../types";

export type HighlightColor = "yellow" | "green" | "pink" | "orange" | "blue";

export interface HsvColor {
  h: number; // 0 to 360
  s: number; // 0 to 1
  v: number; // 0 to 1
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
 * Checks whether an HSV color matches common physical highlighters.
 * Filters out dark text pixels and plain white/gray paper pixels.
 */
export function classifyHighlighter(hsv: HsvColor): HighlightColor | null {
  // Reject dark text pixels
  if (hsv.v < 0.35) return null;

  // Reject neutral paper pixels (white, gray, light cream)
  if (hsv.s < 0.2) return null;

  // Reject excessively dark saturated pixels (pen ink or non-highlighter marks)
  if (hsv.v < 0.4) return null;

  const { h, s, v } = hsv;

  // Yellow highlighter (H ~ 40° - 70°, high brightness)
  if (h >= 40 && h <= 72 && s >= 0.22 && v >= 0.5) {
    return "yellow";
  }

  // Green highlighter (H ~ 75° - 165°)
  if (h >= 75 && h <= 165 && s >= 0.22 && v >= 0.4) {
    return "green";
  }

  // Pink / Magenta highlighter (H ~ 290° - 355° or 0° - 10°)
  if (
    ((h >= 290 && h <= 355) || (h >= 0 && h <= 10)) &&
    s >= 0.22 &&
    v >= 0.5
  ) {
    return "pink";
  }

  // Orange highlighter (H ~ 12° - 38°)
  if (h >= 12 && h <= 38 && s >= 0.3 && v >= 0.5) {
    return "orange";
  }

  // Cyan / Blue highlighter (H ~ 170° - 240°)
  if (h >= 170 && h <= 240 && s >= 0.22 && v >= 0.45) {
    return "blue";
  }

  return null;
}

/**
 * Scans the pixels directly inside an OCR word bounding box.
 * Returns whether the word is highlighted, its dominant color, and confidence.
 */
export function evaluateWordHighlight(
  imageData: ImageData,
  bbox: BoundingBox,
): {
  isHighlighted: boolean;
  colorName?: HighlightColor;
  confidence: number;
} {
  const { width, height, data } = imageData;

  const x0 = Math.max(0, Math.floor(bbox.x0));
  const y0 = Math.max(0, Math.floor(bbox.y0));
  const x1 = Math.min(width, Math.ceil(bbox.x1));
  const y1 = Math.min(height, Math.ceil(bbox.y1));

  const totalPixels = (x1 - x0) * (y1 - y0);
  if (totalPixels <= 0) {
    return { isHighlighted: false, confidence: 0 };
  }

  const counts: Record<HighlightColor, number> = {
    yellow: 0,
    green: 0,
    pink: 0,
    orange: 0,
    blue: 0,
  };

  let matchingPixels = 0;
  let nonDarkPixels = 0;

  // Sample pixels within the bounding box (sample every 2px for speed)
  const step = 2;
  let sampledCount = 0;

  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      sampledCount++;
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const hsv = rgbToHsv(r, g, b);
      if (hsv.v >= 0.35) {
        nonDarkPixels++;
      }

      const color = classifyHighlighter(hsv);
      if (color) {
        counts[color]++;
        matchingPixels++;
      }
    }
  }

  if (sampledCount === 0 || nonDarkPixels === 0) {
    return { isHighlighted: false, confidence: 0 };
  }

  // Fraction of sampled background/foreground pixels that have highlighter pigment
  const highlightRatio = matchingPixels / sampledCount;

  // Threshold: at least 15% of pixels inside the box are highlighted
  if (highlightRatio >= 0.15) {
    // Find dominant color
    let dominantColor: HighlightColor = "yellow";
    let maxCount = -1;
    for (const [col, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantColor = col as HighlightColor;
      }
    }

    // Confidence scales between 0.5 (15% coverage) to 1.0 (50%+ coverage)
    const confidence = Math.min(1, 0.5 + (highlightRatio - 0.15) * 1.4);
    return {
      isHighlighted: true,
      colorName: dominantColor,
      confidence: Math.round(confidence * 100) / 100,
    };
  }

  return { isHighlighted: false, confidence: 0 };
}

/**
 * Detects global highlight regions across the canvas by grid downsampling.
 * Used for the visual debug overlay and region matching.
 */
export function detectHighlightRegions(
  imageData: ImageData,
  gridSize = 12,
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

  // Merge contiguous horizontal runs of cells of the same color into MarkRegions
  const regions: MarkRegion[] = [];

  for (let r = 0; r < rows; r++) {
    let startC = -1;
    let currentColor: HighlightColor | null = null;

    for (let c = 0; c < cols; c++) {
      const color = grid[r * cols + c];

      if (color && currentColor === color) {
        // continue run
        continue;
      }

      if (currentColor && startC !== -1) {
        // End of run
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
