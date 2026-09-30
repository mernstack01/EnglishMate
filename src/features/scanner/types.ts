export type BoundingBox = {
  x0: number; // left
  y0: number; // top
  x1: number; // right
  y1: number; // bottom
};

export type OcrWord = {
  text: string;
  confidence: number;
  bbox: BoundingBox;
};

export type MarkType = "highlight" | "underline" | "circle" | "box" | "manual";

export type MarkRegion = {
  type: Exclude<MarkType, "manual">;
  bbox: BoundingBox;
  confidence: number;
  colorName?: string; // "yellow" | "green" | "pink" | "orange" | "blue" | "red" | "dark"
};

export type DetectedWord = {
  id: string;
  text: string;
  normalizedWord: string;
  ocrConfidence: number;
  markType: MarkType;
  markConfidence: number;
  bbox: BoundingBox;
  selected: boolean;
  colorName?: string;
  translation?: string;
  notes?: string;
};

export type ScanProcessingStage =
  "idle" | "preparing" | "detecting-text" | "finding-marks" | "ready" | "error";

export type WordDiagnostic = {
  word: string;
  normalized: string;
  bbox: BoundingBox;
  ocrConfidence: number;
  highlightStats?: {
    isHighlighted: boolean;
    color?: string;
    coverage: number;
    avgSaturation: number;
    avgValue: number;
  };
  underlineStats?: {
    isUnderlined: boolean;
    confidence: number;
    color?: string;
    horizontalCoverage: number;
    verticalDistance: number;
  };
  boxStats?: {
    isBoxed: boolean;
    confidence: number;
  };
  bestMarkType: MarkType;
  markConfidence: number;
  selected: boolean;
  reason: string;
};

export type ScanDiagnostics = {
  image: {
    originalWidth: number;
    originalHeight: number;
    processedWidth: number;
    processedHeight: number;
    rotation: number;
    scale: number;
  };
  ocr: {
    totalOcrWords: number;
    validNormalizedWords: number;
    averageConfidence: number;
  };
  marks: {
    highlightCandidateCount: number;
    underlineCandidateCount: number;
    boxCandidateCount: number;
    finalMarkRegionCount: number;
  };
  matching: {
    matchedMarkedWordCount: number;
  };
  wordDiagnostics: WordDiagnostic[];
};

export type ScanResult = {
  imageWidth: number;
  imageHeight: number;
  processedImageUrl?: string;
  ocrWords: OcrWord[];
  markRegions: MarkRegion[];
  detectedWords: DetectedWord[];
  otherWords: DetectedWord[];
  diagnostics?: ScanDiagnostics;
};

export type ImportScannedWordsItem = {
  word: string;
  translation?: string;
  notes?: string;
};

export type ImportScannedWordsResult = {
  importedCount: number;
  skippedDuplicatesCount: number;
  importedWords: Array<{
    id: string;
    word: string;
    translation: string;
  }>;
};
