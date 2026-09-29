import type {
  BoundingBox,
  DetectedWord,
  MarkRegion,
  MarkType,
  OcrWord,
} from "../types";
import { cleanOcrToken } from "./normalize-token";
import { bboxWordCoverage, isUnderlineForWord } from "./geometry";
import { evaluateWordHighlight } from "./highlight-detection";
import { evaluateWordUnderline } from "./underline-detection";
import { evaluateWordBox } from "./box-circle-detection";

export interface MatchResult {
  detectedWords: DetectedWord[];
  otherWords: DetectedWord[];
}

/**
 * Natural reading order comparator:
 * Groups words by lines based on vertical overlap/closeness, then sorts left-to-right.
 */
export function sortWordsInReadingOrder<T extends { bbox: BoundingBox }>(
  words: T[],
): T[] {
  return [...words].sort((a, b) => {
    const heightA = a.bbox.y1 - a.bbox.y0;
    const heightB = b.bbox.y1 - b.bbox.y0;
    const avgHeight = (heightA + heightB) / 2;

    // If y0 differs by more than half the average line height, consider them different lines
    if (Math.abs(a.bbox.y0 - b.bbox.y0) > avgHeight * 0.5) {
      return a.bbox.y0 - b.bbox.y0;
    }

    // Otherwise sort left-to-right on the same line
    return a.bbox.x0 - b.bbox.x0;
  });
}

/**
 * Deterministically matches recognized OCR words against physical marks
 * (highlights, underlines, boxes/circles) and groups them into detected marked words
 * versus other recognized words.
 */
export function matchWordsToMarks(
  ocrWords: OcrWord[],
  markRegions: MarkRegion[],
  imageData?: ImageData | null,
): MatchResult {
  const detectedWords: DetectedWord[] = [];
  const otherWords: DetectedWord[] = [];

  // Track unique keys to avoid duplicate detections of identical physical words
  const seenBoxes = new Set<string>();

  let idCounter = 1;

  for (const ocrWord of ocrWords) {
    const cleaned = cleanOcrToken(ocrWord.text);
    if (!cleaned) {
      // Discard invalid tokens (pure numbers, punctuation-only, OCR junk)
      continue;
    }

    const { cleanWord, normalizedWord } = cleaned;

    // Deduplication key by approximate bounding box
    const boxKey = `${Math.round(ocrWord.bbox.x0 / 4)}_${Math.round(ocrWord.bbox.y0 / 4)}_${normalizedWord}`;
    if (seenBoxes.has(boxKey)) {
      continue;
    }
    seenBoxes.add(boxKey);

    let bestMarkType: MarkType | null = null;
    let bestMarkConfidence = 0;

    // 1. Direct pixel-level evaluation if ImageData is available
    if (imageData) {
      // Evaluate highlight
      const hlEval = evaluateWordHighlight(imageData, ocrWord.bbox);
      if (hlEval.isHighlighted && hlEval.confidence > bestMarkConfidence) {
        bestMarkType = "highlight";
        bestMarkConfidence = hlEval.confidence;
      }

      // Evaluate underline
      const ulEval = evaluateWordUnderline(imageData, ocrWord.bbox);
      if (ulEval.isUnderlined && ulEval.confidence > bestMarkConfidence) {
        bestMarkType = "underline";
        bestMarkConfidence = ulEval.confidence;
      }

      // Evaluate box
      const boxEval = evaluateWordBox(imageData, ocrWord.bbox);
      if (boxEval.isBoxed && boxEval.confidence > bestMarkConfidence) {
        bestMarkType = "box";
        bestMarkConfidence = boxEval.confidence;
      }
    }

    // 2. Evaluate against detected MarkRegions (overlap / proximity)
    for (const region of markRegions) {
      if (region.type === "highlight") {
        const coverage = bboxWordCoverage(ocrWord.bbox, region.bbox);
        if (coverage >= 0.25) {
          const conf = Math.min(1, region.confidence * 0.7 + coverage * 0.3);
          if (conf > bestMarkConfidence) {
            bestMarkType = "highlight";
            bestMarkConfidence = conf;
          }
        }
      } else if (region.type === "underline") {
        const match = isUnderlineForWord(ocrWord.bbox, region.bbox);
        if (match.matches && match.confidence > bestMarkConfidence) {
          bestMarkType = "underline";
          bestMarkConfidence = match.confidence;
        }
      } else if (region.type === "box" || region.type === "circle") {
        const coverage = bboxWordCoverage(ocrWord.bbox, region.bbox);
        if (coverage >= 0.6) {
          const conf = Math.min(1, region.confidence * 0.8 + coverage * 0.2);
          if (conf > bestMarkConfidence) {
            bestMarkType = region.type;
            bestMarkConfidence = conf;
          }
        }
      }
    }

    const detected: DetectedWord = {
      id: `word_${idCounter++}_${Date.now()}`,
      text: cleanWord,
      normalizedWord,
      ocrConfidence: Math.round(ocrWord.confidence),
      markType: bestMarkType ?? "manual",
      markConfidence: Math.round(bestMarkConfidence * 100) / 100,
      bbox: ocrWord.bbox,
      selected: bestMarkType !== null, // Auto-selected if physically marked
      translation: "",
      notes: bestMarkType ? `Marked with ${bestMarkType}` : undefined,
    };

    if (bestMarkType !== null) {
      detectedWords.push(detected);
    } else {
      otherWords.push(detected);
    }
  }

  return {
    detectedWords: sortWordsInReadingOrder(detectedWords),
    otherWords: sortWordsInReadingOrder(otherWords),
  };
}
