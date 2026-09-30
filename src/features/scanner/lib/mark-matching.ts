import type {
  BoundingBox,
  DetectedWord,
  MarkRegion,
  MarkType,
  OcrWord,
  ScanDiagnostics,
  WordDiagnostic,
} from "../types";
import { cleanOcrToken } from "./normalize-token";
import { bboxWordCoverage, isUnderlineForWord } from "./geometry";
import { analyzeHighlightForWord } from "./highlight-detection";
import { evaluateWordUnderline } from "./underline-detection";
import { evaluateWordBox } from "./box-circle-detection";

export interface ImageDiagnosticsMeta {
  originalWidth: number;
  originalHeight: number;
  processedWidth: number;
  processedHeight: number;
  rotation: number;
  scale: number;
}

export interface MatchResult {
  detectedWords: DetectedWord[];
  otherWords: DetectedWord[];
  markRegions: MarkRegion[];
  diagnostics?: ScanDiagnostics;
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
 *
 * Direct OCR-first pixel analysis inspects the bounding box region for highlights,
 * underlines, and bounding strokes, generating structured diagnostics for development inspection.
 */
export function matchWordsToMarks(
  ocrWords: OcrWord[],
  markRegions: MarkRegion[] = [],
  imageData?: ImageData | null,
  imageMeta?: ImageDiagnosticsMeta,
): MatchResult {
  const detectedWords: DetectedWord[] = [];
  const otherWords: DetectedWord[] = [];
  const wordDiagnostics: WordDiagnostic[] = [];

  const seenBoxes = new Set<string>();
  const finalMarkRegions: MarkRegion[] = [...markRegions];
  const seenRegionKeys = new Set(
    markRegions.map(
      (m) =>
        `${m.type}_${Math.round(m.bbox.x0)}_${Math.round(m.bbox.y0)}_${Math.round(m.bbox.x1)}_${Math.round(m.bbox.y1)}`,
    ),
  );

  let idCounter = 1;
  let highlightCandidateCount = 0;
  let underlineCandidateCount = 0;
  let boxCandidateCount = 0;
  let validWordCount = 0;
  let totalConfidenceSum = 0;

  for (const ocrWord of ocrWords) {
    totalConfidenceSum += ocrWord.confidence;
    const cleaned = cleanOcrToken(ocrWord.text);

    if (!cleaned) {
      wordDiagnostics.push({
        word: ocrWord.text,
        normalized: "",
        bbox: ocrWord.bbox,
        ocrConfidence: Math.round(ocrWord.confidence),
        bestMarkType: "manual",
        markConfidence: 0,
        selected: false,
        reason: "Rejected: invalid OCR token (punctuation, numbers, or noise)",
      });
      continue;
    }

    validWordCount++;
    const { cleanWord, normalizedWord } = cleaned;

    // Deduplication key by approximate bounding box and normalized word
    const boxKey = `${Math.round(ocrWord.bbox.x0 / 4)}_${Math.round(ocrWord.bbox.y0 / 4)}_${normalizedWord}`;
    if (seenBoxes.has(boxKey)) {
      wordDiagnostics.push({
        word: cleanWord,
        normalized: normalizedWord,
        bbox: ocrWord.bbox,
        ocrConfidence: Math.round(ocrWord.confidence),
        bestMarkType: "manual",
        markConfidence: 0,
        selected: false,
        reason: "Rejected: duplicate bounding box/word occurrence",
      });
      continue;
    }
    seenBoxes.add(boxKey);

    let bestMarkType: MarkType | null = null;
    let bestMarkConfidence = 0;
    let bestColorName: string | undefined;

    let hlStats: WordDiagnostic["highlightStats"];
    let ulStats: WordDiagnostic["underlineStats"];
    let bxStats: WordDiagnostic["boxStats"];

    // 1. Direct pixel-level evaluation if ImageData is available
    if (imageData) {
      // Evaluate highlight with proportional padding and chromatic clustering
      const hlAnalysis = analyzeHighlightForWord(imageData, ocrWord.bbox);
      hlStats = {
        isHighlighted: hlAnalysis.isHighlighted,
        color: hlAnalysis.colorName,
        coverage: hlAnalysis.coverage,
        avgSaturation: hlAnalysis.avgSaturation,
        avgValue: hlAnalysis.avgValue,
      };

      if (hlAnalysis.isHighlighted) {
        highlightCandidateCount++;
        if (hlAnalysis.confidence > bestMarkConfidence) {
          bestMarkType = "highlight";
          bestMarkConfidence = hlAnalysis.confidence;
          bestColorName = hlAnalysis.colorName;
        }

        // Add generated mark region for visual overlay display
        const rKey = `highlight_${Math.round(hlAnalysis.paddedBbox.x0)}_${Math.round(hlAnalysis.paddedBbox.y0)}_${Math.round(hlAnalysis.paddedBbox.x1)}_${Math.round(hlAnalysis.paddedBbox.y1)}`;
        if (!seenRegionKeys.has(rKey)) {
          seenRegionKeys.add(rKey);
          finalMarkRegions.push({
            type: "highlight",
            bbox: hlAnalysis.paddedBbox,
            confidence: hlAnalysis.confidence,
            colorName: hlAnalysis.colorName,
          });
        }
      }

      // Evaluate box / circle (enclosing marks take structural precedence over single underline)
      const boxAnalysis = evaluateWordBox(imageData, ocrWord.bbox);
      bxStats = {
        isBoxed: boxAnalysis.isBoxed,
        confidence: boxAnalysis.confidence,
      };

      if (boxAnalysis.isBoxed) {
        boxCandidateCount++;
        if (boxAnalysis.confidence >= bestMarkConfidence) {
          bestMarkType = boxAnalysis.markType || "box";
          bestMarkConfidence = boxAnalysis.confidence;
          if (boxAnalysis.colorName) {
            bestColorName = boxAnalysis.colorName;
          }
        }

        if (boxAnalysis.boxBbox) {
          const markKind = boxAnalysis.markType || "box";
          const rKey = `${markKind}_${Math.round(boxAnalysis.boxBbox.x0)}_${Math.round(boxAnalysis.boxBbox.y0)}_${Math.round(boxAnalysis.boxBbox.x1)}_${Math.round(boxAnalysis.boxBbox.y1)}`;
          if (!seenRegionKeys.has(rKey)) {
            seenRegionKeys.add(rKey);
            finalMarkRegions.push({
              type: markKind,
              bbox: boxAnalysis.boxBbox,
              confidence: boxAnalysis.confidence,
              colorName: boxAnalysis.colorName,
            });
          }
        }
      } else {
        // Evaluate underline only if the word is not already enclosed in a box/circle
        const ulAnalysis = evaluateWordUnderline(imageData, ocrWord.bbox);
        ulStats = {
          isUnderlined: ulAnalysis.isUnderlined,
          confidence: ulAnalysis.confidence,
          color: ulAnalysis.colorName,
          horizontalCoverage: ulAnalysis.horizontalCoverage,
          verticalDistance: ulAnalysis.verticalDistance,
        };

        if (ulAnalysis.isUnderlined) {
          underlineCandidateCount++;
          if (ulAnalysis.confidence > bestMarkConfidence) {
            bestMarkType = "underline";
            bestMarkConfidence = ulAnalysis.confidence;
            bestColorName = ulAnalysis.colorName;
          }

          if (ulAnalysis.underlineBbox) {
            const rKey = `underline_${Math.round(ulAnalysis.underlineBbox.x0)}_${Math.round(ulAnalysis.underlineBbox.y0)}_${Math.round(ulAnalysis.underlineBbox.x1)}_${Math.round(ulAnalysis.underlineBbox.y1)}`;
            if (!seenRegionKeys.has(rKey)) {
              seenRegionKeys.add(rKey);
              finalMarkRegions.push({
                type: "underline",
                bbox: ulAnalysis.underlineBbox,
                confidence: ulAnalysis.confidence,
                colorName: ulAnalysis.colorName,
              });
            }
          }
        }
      }
    }

    // 2. Evaluate against existing detected MarkRegions (overlap / proximity)
    for (const region of markRegions) {
      if (region.type === "highlight") {
        const coverage = bboxWordCoverage(ocrWord.bbox, region.bbox);
        if (coverage >= 0.25) {
          const conf = Math.min(1, region.confidence * 0.7 + coverage * 0.3);
          if (conf > bestMarkConfidence) {
            bestMarkType = "highlight";
            bestMarkConfidence = conf;
            if (region.colorName) bestColorName = region.colorName;
          }
        }
      } else if (region.type === "underline") {
        const match = isUnderlineForWord(ocrWord.bbox, region.bbox);
        if (match.matches && match.confidence > bestMarkConfidence) {
          bestMarkType = "underline";
          bestMarkConfidence = match.confidence;
          if (region.colorName) bestColorName = region.colorName;
        }
      } else if (region.type === "box" || region.type === "circle") {
        const coverage = bboxWordCoverage(ocrWord.bbox, region.bbox);
        if (coverage >= 0.55) {
          const conf = Math.min(1, region.confidence * 0.8 + coverage * 0.2);
          if (conf > bestMarkConfidence) {
            bestMarkType = region.type;
            bestMarkConfidence = conf;
          }
        }
      }
    }

    const isSelected = bestMarkType !== null;
    let reason =
      "Not marked: no highlight, underline, or enclosing box detected";

    if (bestMarkType === "highlight") {
      reason = `Selected: detected ${bestColorName ?? ""} highlight (coverage: ${Math.round((hlStats?.coverage ?? 0) * 100)}%, sat: ${hlStats?.avgSaturation ?? 0}, val: ${hlStats?.avgValue ?? 0})`;
    } else if (bestMarkType === "underline") {
      reason = `Selected: detected ${bestColorName ?? ""} underline (coverage: ${Math.round((ulStats?.horizontalCoverage ?? 0) * 100)}%, distance: ${Math.round(ulStats?.verticalDistance ?? 0)}px)`;
    } else if (bestMarkType === "box" || bestMarkType === "circle") {
      reason = `Selected: enclosed in drawn ${bestMarkType} (confidence: ${Math.round(bestMarkConfidence * 100)}%)`;
    }

    wordDiagnostics.push({
      word: cleanWord,
      normalized: normalizedWord,
      bbox: ocrWord.bbox,
      ocrConfidence: Math.round(ocrWord.confidence),
      highlightStats: hlStats,
      underlineStats: ulStats,
      boxStats: bxStats,
      bestMarkType: bestMarkType ?? "manual",
      markConfidence: Math.round(bestMarkConfidence * 100) / 100,
      selected: isSelected,
      reason,
    });

    const detected: DetectedWord = {
      id: `word_${idCounter++}_${Date.now()}`,
      text: cleanWord,
      normalizedWord,
      ocrConfidence: Math.round(ocrWord.confidence),
      markType: bestMarkType ?? "manual",
      markConfidence: Math.round(bestMarkConfidence * 100) / 100,
      bbox: ocrWord.bbox,
      selected: isSelected,
      colorName: bestColorName,
      translation: "",
      notes: bestMarkType
        ? `Marked with ${bestColorName ? `${bestColorName} ` : ""}${bestMarkType}`
        : undefined,
    };

    if (isSelected) {
      detectedWords.push(detected);
    } else {
      otherWords.push(detected);
    }
  }

  const sortedDetected = sortWordsInReadingOrder(detectedWords);
  const sortedOther = sortWordsInReadingOrder(otherWords);

  const diagnostics: ScanDiagnostics = {
    image: {
      originalWidth: imageMeta?.originalWidth ?? imageData?.width ?? 0,
      originalHeight: imageMeta?.originalHeight ?? imageData?.height ?? 0,
      processedWidth: imageMeta?.processedWidth ?? imageData?.width ?? 0,
      processedHeight: imageMeta?.processedHeight ?? imageData?.height ?? 0,
      rotation: imageMeta?.rotation ?? 0,
      scale: imageMeta?.scale ?? 1,
    },
    ocr: {
      totalOcrWords: ocrWords.length,
      validNormalizedWords: validWordCount,
      averageConfidence:
        ocrWords.length > 0
          ? Math.round((totalConfidenceSum / ocrWords.length) * 10) / 10
          : 0,
    },
    marks: {
      highlightCandidateCount,
      underlineCandidateCount,
      boxCandidateCount,
      finalMarkRegionCount: finalMarkRegions.length,
    },
    matching: {
      matchedMarkedWordCount: sortedDetected.length,
    },
    wordDiagnostics,
  };

  return {
    detectedWords: sortedDetected,
    otherWords: sortedOther,
    markRegions: finalMarkRegions,
    diagnostics,
  };
}
