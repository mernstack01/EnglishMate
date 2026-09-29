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
  colorName?: string; // "yellow" | "green" | "pink" | "orange" | "blue"
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
  translation?: string;
  notes?: string;
};

export type ScanProcessingStage =
  "idle" | "preparing" | "detecting-text" | "finding-marks" | "ready" | "error";

export type ScanResult = {
  imageWidth: number;
  imageHeight: number;
  ocrWords: OcrWord[];
  markRegions: MarkRegion[];
  detectedWords: DetectedWord[];
  otherWords: DetectedWord[];
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
