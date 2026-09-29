import { normalizeWord } from "@/features/vocabulary/constants";

/**
 * Cleans an OCR token by removing surrounding punctuation, brackets, and quotes,
 * while preserving valid internal apostrophes and hyphens.
 *
 * Examples:
 *   '"hello,"' -> 'hello'
 *   '[example]' -> 'example'
 *   'well-known,' -> 'well-known'
 *   "don't." -> "don't"
 *   '123' -> null (pure numbers rejected)
 *   '---' -> null (pure punctuation rejected)
 */
export function cleanOcrToken(rawToken: string): {
  cleanWord: string;
  normalizedWord: string;
} | null {
  if (!rawToken) return null;

  // Trim whitespace
  let text = rawToken.trim();
  if (!text) return null;

  // Remove surrounding quotes, parentheses, brackets, punctuation
  // Keep characters that are alphanumeric, internal hyphens, and apostrophes
  text = text.replace(/^[^a-zA-Z0-9]+/, "").replace(/[^a-zA-Z0-9]+$/, "");

  if (!text) return null;

  // Reject pure numbers (e.g., "123", "2026")
  if (/^\d+$/.test(text)) {
    return null;
  }

  // Reject strings that have no letters at all (e.g., "$100" or just symbols)
  if (!/[a-zA-Z]/.test(text)) {
    return null;
  }

  // Reject single-letter tokens unless it is 'a' or 'i' (common OCR noise)
  if (text.length === 1 && !/^[aAiI]$/.test(text)) {
    return null;
  }

  const normalized = normalizeWord(text);
  if (!normalized) return null;

  return {
    cleanWord: text,
    normalizedWord: normalized,
  };
}
