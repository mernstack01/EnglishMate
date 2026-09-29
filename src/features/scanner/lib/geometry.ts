import type { BoundingBox } from "../types";

export function bboxArea(bbox: BoundingBox): number {
  const w = Math.max(0, bbox.x1 - bbox.x0);
  const h = Math.max(0, bbox.y1 - bbox.y0);
  return w * h;
}

export function bboxIntersection(
  a: BoundingBox,
  b: BoundingBox,
): BoundingBox | null {
  const x0 = Math.max(a.x0, b.x0);
  const y0 = Math.max(a.y0, b.y0);
  const x1 = Math.min(a.x1, b.x1);
  const y1 = Math.min(a.y1, b.y1);

  if (x1 <= x0 || y1 <= y0) {
    return null;
  }

  return { x0, y0, x1, y1 };
}

export function bboxIntersectionArea(a: BoundingBox, b: BoundingBox): number {
  const inter = bboxIntersection(a, b);
  return inter ? bboxArea(inter) : 0;
}

/**
 * Returns what fraction of `target` is covered by `mark`.
 * Ratio is between 0 and 1.
 */
export function bboxWordCoverage(
  target: BoundingBox,
  mark: BoundingBox,
): number {
  const targetArea = bboxArea(target);
  if (targetArea <= 0) return 0;
  const interArea = bboxIntersectionArea(target, mark);
  return interArea / targetArea;
}

/**
 * Returns Intersection over Union (IoU) between two bounding boxes.
 */
export function bboxIoU(a: BoundingBox, b: BoundingBox): number {
  const interArea = bboxIntersectionArea(a, b);
  if (interArea <= 0) return 0;
  const unionArea = bboxArea(a) + bboxArea(b) - interArea;
  return unionArea > 0 ? interArea / unionArea : 0;
}

/**
 * Tests whether an underline bounding box sits directly below an OCR word.
 * Requirements:
 * - Underline top edge should be at or slightly below word bottom edge (within 0.5 * wordHeight).
 * - Underline horizontal span overlaps at least 40% of the word's width.
 */
export function isUnderlineForWord(
  wordBbox: BoundingBox,
  underlineBbox: BoundingBox,
): { matches: boolean; confidence: number } {
  const wordWidth = wordBbox.x1 - wordBbox.x0;
  const wordHeight = wordBbox.y1 - wordBbox.y0;

  if (wordWidth <= 0 || wordHeight <= 0) {
    return { matches: false, confidence: 0 };
  }

  // Vertical proximity: Underline should be close below word baseline (from y1 - h*0.2 to y1 + h*0.6)
  const verticalDistance = underlineBbox.y0 - wordBbox.y1;
  const maxAllowedDistance = Math.max(8, wordHeight * 0.6);
  const minAllowedY = wordBbox.y1 - wordHeight * 0.25; // in case baseline crosses bottom

  if (underlineBbox.y0 < minAllowedY || verticalDistance > maxAllowedDistance) {
    return { matches: false, confidence: 0 };
  }

  // Horizontal overlap
  const overlapX0 = Math.max(wordBbox.x0, underlineBbox.x0);
  const overlapX1 = Math.min(wordBbox.x1, underlineBbox.x1);
  const overlapWidth = Math.max(0, overlapX1 - overlapX0);
  const horizontalOverlapRatio = overlapWidth / wordWidth;

  if (horizontalOverlapRatio < 0.4) {
    return { matches: false, confidence: 0 };
  }

  // Confidence based on horizontal coverage and vertical closeness
  const proximityScore = Math.max(
    0,
    1 - Math.abs(verticalDistance) / maxAllowedDistance,
  );
  const confidence = Math.min(
    1,
    horizontalOverlapRatio * 0.6 + proximityScore * 0.4,
  );

  return { matches: true, confidence };
}
