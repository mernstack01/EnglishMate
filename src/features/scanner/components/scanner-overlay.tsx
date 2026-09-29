"use client";

import React from "react";
import type { ScanResult } from "../types";

interface ScannerOverlayProps {
  scanResult: ScanResult;
}

export function ScannerOverlay({ scanResult }: ScannerOverlayProps) {
  const { imageWidth, imageHeight, ocrWords, markRegions, detectedWords } =
    scanResult;

  if (!imageWidth || !imageHeight) return null;

  return (
    <svg
      viewBox={`0 0 ${imageWidth} ${imageHeight}`}
      className="pointer-events-none absolute inset-0 size-full"
      aria-hidden="true"
    >
      <defs>
        <filter id="badge-bg" x="0" y="0" width="1" height="1">
          <feFlood floodColor="rgba(0, 0, 0, 0.75)" />
          <feComposite in="SourceGraphic" in2="flood" operator="over" />
        </filter>
      </defs>

      {/* 1. All OCR recognized word boxes (subtle dotted outline) */}
      {ocrWords.map((w, idx) => {
        const x = w.bbox.x0;
        const y = w.bbox.y0;
        const width = Math.max(2, w.bbox.x1 - w.bbox.x0);
        const height = Math.max(2, w.bbox.y1 - w.bbox.y0);

        return (
          <rect
            key={`ocr_${idx}`}
            x={x}
            y={y}
            width={width}
            height={height}
            fill="none"
            stroke="rgba(148, 163, 184, 0.4)"
            strokeWidth="1"
            strokeDasharray="2,2"
          />
        );
      })}

      {/* 2. Detected Mark Regions (Highlights, Underlines, Boxes) */}
      {markRegions.map((m, idx) => {
        const x = m.bbox.x0;
        const y = m.bbox.y0;
        const width = Math.max(2, m.bbox.x1 - m.bbox.x0);
        const height = Math.max(2, m.bbox.y1 - m.bbox.y0);

        if (m.type === "highlight") {
          let fillColor = "rgba(250, 204, 21, 0.35)"; // yellow
          if (m.colorName === "green") fillColor = "rgba(34, 197, 94, 0.35)";
          else if (m.colorName === "pink")
            fillColor = "rgba(244, 114, 182, 0.35)";
          else if (m.colorName === "orange")
            fillColor = "rgba(251, 146, 60, 0.35)";
          else if (m.colorName === "blue")
            fillColor = "rgba(56, 189, 248, 0.35)";

          return (
            <rect
              key={`mark_${idx}`}
              x={x}
              y={y}
              width={width}
              height={height}
              fill={fillColor}
              stroke="rgba(234, 179, 8, 0.6)"
              strokeWidth="1"
              rx="2"
            />
          );
        }

        if (m.type === "underline") {
          return (
            <line
              key={`mark_${idx}`}
              x1={x}
              y1={(y + m.bbox.y1) / 2}
              x2={m.bbox.x1}
              y2={(y + m.bbox.y1) / 2}
              stroke="rgba(37, 99, 235, 0.9)"
              strokeWidth="3"
              strokeLinecap="round"
            />
          );
        }

        if (m.type === "box" || m.type === "circle") {
          return (
            <rect
              key={`mark_${idx}`}
              x={x}
              y={y}
              width={width}
              height={height}
              fill="none"
              stroke="rgba(234, 88, 12, 0.85)"
              strokeWidth="2"
              rx={m.type === "circle" ? "8" : "2"}
            />
          );
        }

        return null;
      })}

      {/* 3. Matched Marked Words (Bold border with confidence tag) */}
      {detectedWords.map((dw) => {
        const x = dw.bbox.x0;
        const y = dw.bbox.y0;
        const width = Math.max(2, dw.bbox.x1 - dw.bbox.x0);
        const height = Math.max(2, dw.bbox.y1 - dw.bbox.y0);

        let strokeColor = "#22c55e"; // green for highlight
        if (dw.markType === "underline")
          strokeColor = "#3b82f6"; // blue
        else if (dw.markType === "box") strokeColor = "#f97316"; // orange

        return (
          <g key={`dw_${dw.id}`}>
            <rect
              x={x - 1}
              y={y - 1}
              width={width + 2}
              height={height + 2}
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
              rx="2"
            />
          </g>
        );
      })}
    </svg>
  );
}
