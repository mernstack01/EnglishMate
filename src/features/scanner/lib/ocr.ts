import type { Worker } from "tesseract.js";
import type { OcrWord } from "../types";

export interface OcrProgress {
  status: string;
  progress: number; // 0 to 1
}

export type OcrProgressCallback = (progress: OcrProgress) => void;

let cachedWorker: Worker | null = null;
let currentLanguage = "eng";

/**
 * Initializes and caches a Tesseract worker client-side.
 * Worker is created lazily only when a scan is requested.
 */
export async function getTesseractWorker(
  lang = "eng",
  onProgress?: OcrProgressCallback,
) {
  if (typeof window === "undefined") {
    throw new Error(
      "Tesseract OCR can only be executed in a browser environment.",
    );
  }

  // Dynamically import tesseract.js to avoid loading it into server or unrelated routes
  const { createWorker } = await import("tesseract.js");

  if (cachedWorker && currentLanguage === lang) {
    return cachedWorker;
  }

  if (cachedWorker) {
    try {
      await cachedWorker.terminate();
    } catch {
      // ignore termination error
    }
    cachedWorker = null;
  }

  const worker = await createWorker(lang, 1, {
    logger: (m: { status?: string; progress?: number }) => {
      if (onProgress && m && typeof m.progress === "number") {
        onProgress({
          status: m.status || "processing",
          progress: Math.min(1, Math.max(0, m.progress)),
        });
      }
    },
  });

  cachedWorker = worker;
  currentLanguage = lang;
  return worker;
}

/**
 * Terminates the cached Tesseract worker to free memory when the scanner is unmounted.
 */
export async function terminateTesseractWorker(): Promise<void> {
  if (cachedWorker) {
    try {
      await cachedWorker.terminate();
    } catch {
      // ignore
    }
    cachedWorker = null;
  }
}

/**
 * Performs local OCR on an HTMLCanvasElement or image source using Tesseract.js.
 * Returns word geometry: text, confidence, and normalized bounding box.
 */
export async function recognizeWordsLocally(
  canvasOrImage: HTMLCanvasElement | HTMLImageElement | string,
  onProgress?: OcrProgressCallback,
): Promise<OcrWord[]> {
  if (typeof window !== "undefined") {
    const mockWords = (window as unknown as { __MOCK_OCR_WORDS__?: OcrWord[] })
      .__MOCK_OCR_WORDS__;
    if (mockWords) {
      if (onProgress) {
        onProgress({ status: "recognizing text", progress: 1 });
      }
      return mockWords;
    }
  }

  const worker = await getTesseractWorker("eng", onProgress);

  // In Tesseract.js v7, defaultOutput.js specifies { blocks: false }.
  // Explicitly passing { blocks: true, text: true } ensures word bounding boxes and blocks are populated.
  const result = await worker.recognize(
    canvasOrImage,
    {},
    { blocks: true, text: true },
  );
  const words: OcrWord[] = [];

  // Tesseract Page hierarchy: blocks -> paragraphs -> lines -> words
  if (result?.data?.blocks && result.data.blocks.length > 0) {
    for (const block of result.data.blocks) {
      if (!block.paragraphs) continue;
      for (const para of block.paragraphs) {
        if (!para.lines) continue;
        for (const line of para.lines) {
          if (!line.words) continue;
          for (const w of line.words) {
            if (!w.text || !w.bbox) continue;
            words.push({
              text: w.text,
              confidence: typeof w.confidence === "number" ? w.confidence : 80,
              bbox: {
                x0: w.bbox.x0,
                y0: w.bbox.y0,
                x1: w.bbox.x1,
                y1: w.bbox.y1,
              },
            });
          }
        }
      }
    }
  } else if (
    Array.isArray(
      (
        result?.data as unknown as {
          words?: Array<{
            text?: string;
            confidence?: number;
            bbox?: { x0: number; y0: number; x1: number; y1: number };
          }>;
        }
      )?.words,
    )
  ) {
    const rawWords = (
      result.data as unknown as {
        words: Array<{
          text?: string;
          confidence?: number;
          bbox?: { x0: number; y0: number; x1: number; y1: number };
        }>;
      }
    ).words;
    for (const w of rawWords) {
      if (!w.text || !w.bbox) continue;
      words.push({
        text: w.text,
        confidence: typeof w.confidence === "number" ? w.confidence : 80,
        bbox: {
          x0: w.bbox.x0,
          y0: w.bbox.y0,
          x1: w.bbox.x1,
          y1: w.bbox.y1,
        },
      });
    }
  }

  return words;
}
