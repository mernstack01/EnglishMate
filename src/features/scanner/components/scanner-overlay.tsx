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
        {/* Drop shadow filter for overlay labels */}
        <filter id="badge-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.5" />
        </filter>
      </defs>

      {/* 1. All OCR recognized word boxes (subtle dotted outline) */}
      <g id="overlay-ocr-boxes" opacity="0.6">
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
              stroke="#94a3b8"
              strokeWidth="1"
              strokeDasharray="2,2"
            />
          );
        })}
      </g>

      {/* 2. Physical Mark Regions (Highlights, Underlines, Boxes/Circles) */}
      <g id="overlay-mark-regions">
        {markRegions.map((m, idx) => {
          const x = m.bbox.x0;
          const y = m.bbox.y0;
          const width = Math.max(2, m.bbox.x1 - m.bbox.x0);
          const height = Math.max(2, m.bbox.y1 - m.bbox.y0);

          if (m.type === "highlight") {
            let fillColor = "rgba(250, 204, 21, 0.35)"; // yellow
            let strokeColor = "#eab308";
            if (m.colorName === "green") {
              fillColor = "rgba(34, 197, 94, 0.35)";
              strokeColor = "#16a34a";
            } else if (m.colorName === "pink") {
              fillColor = "rgba(244, 114, 182, 0.35)";
              strokeColor = "#ec4899";
            } else if (m.colorName === "orange") {
              fillColor = "rgba(251, 146, 60, 0.35)";
              strokeColor = "#ea580c";
            } else if (m.colorName === "blue") {
              fillColor = "rgba(56, 189, 248, 0.35)";
              strokeColor = "#0284c7";
            }

            return (
              <rect
                key={`mark_hl_${idx}`}
                x={x}
                y={y}
                width={width}
                height={height}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth="1.5"
                rx="3"
              />
            );
          }

          if (m.type === "underline") {
            let lineColor = "#2563eb"; // blue pen default
            if (m.colorName === "red") lineColor = "#dc2626";
            else if (m.colorName === "green") lineColor = "#16a34a";
            else if (m.colorName === "dark") lineColor = "#0f172a";

            const lineY = (y + m.bbox.y1) / 2;
            const lineThickness = Math.max(2, m.bbox.y1 - y);

            return (
              <line
                key={`mark_ul_${idx}`}
                x1={x}
                y1={lineY}
                x2={m.bbox.x1}
                y2={lineY}
                stroke={lineColor}
                strokeWidth={lineThickness}
                strokeLinecap="round"
              />
            );
          }

          if (m.type === "box" || m.type === "circle") {
            return (
              <rect
                key={`mark_bx_${idx}`}
                x={x}
                y={y}
                width={width}
                height={height}
                fill="none"
                stroke="#d946ef"
                strokeWidth="2"
                strokeDasharray="4,2"
                rx={m.type === "circle" ? "10" : "3"}
              />
            );
          }

          return null;
        })}
      </g>

      {/* 3. Matched/Selected Words (Solid bright outline + tag) */}
      <g id="overlay-matched-words">
        {detectedWords.map((dw) => {
          const x = dw.bbox.x0;
          const y = dw.bbox.y0;
          const width = Math.max(2, dw.bbox.x1 - dw.bbox.x0);
          const height = Math.max(2, dw.bbox.y1 - dw.bbox.y0);

          let strokeColor = "#10b981"; // emerald for highlights
          if (dw.markType === "underline") strokeColor = "#3b82f6"; // blue
          if (dw.markType === "box" || dw.markType === "circle")
            strokeColor = "#d946ef"; // purple/fuchsia

          return (
            <g key={`dw_${dw.id}`}>
              {/* Highlight bounding box */}
              <rect
                x={x - 2}
                y={y - 2}
                width={width + 4}
                height={height + 4}
                fill="none"
                stroke={strokeColor}
                strokeWidth="2"
                rx="4"
              />

              {/* Word Badge Label */}
              {y >= 14 && (
                <g filter="url(#badge-shadow)">
                  <rect
                    x={x - 2}
                    y={y - 14}
                    width={Math.max(48, dw.text.length * 6.5 + 8)}
                    height="12"
                    fill={strokeColor}
                    rx="2"
                  />
                  <text
                    x={x + 2}
                    y={y - 4}
                    fill="#ffffff"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {dw.text}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
