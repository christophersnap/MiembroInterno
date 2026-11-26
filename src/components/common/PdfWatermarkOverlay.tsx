import React from 'react';
import SmartStorageImage from './SmartStorageImage';

export type PdfWatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export const PDF_WATERMARK_POSITIONS: ReadonlyArray<{
  value: PdfWatermarkPosition;
  label: string;
  shortLabel: string;
}> = [
  { value: 'top-left', label: 'Arriba Izquierda', shortLabel: 'Arr. Izq.' },
  { value: 'top-center', label: 'Arriba Centro', shortLabel: 'Arr. Cen.' },
  { value: 'top-right', label: 'Arriba Derecha', shortLabel: 'Arr. Der.' },
  { value: 'middle-left', label: 'Centro Izquierda', shortLabel: 'Cen. Izq.' },
  { value: 'center', label: 'Centro', shortLabel: 'Centro' },
  { value: 'middle-right', label: 'Centro Derecha', shortLabel: 'Cen. Der.' },
  { value: 'bottom-left', label: 'Abajo Izquierda', shortLabel: 'Aba. Izq.' },
  { value: 'bottom-center', label: 'Abajo Centro', shortLabel: 'Aba. Cen.' },
  { value: 'bottom-right', label: 'Abajo Derecha', shortLabel: 'Aba. Der.' },
];

export function isValidPdfWatermarkPosition(val?: string | null): val is PdfWatermarkPosition {
  return PDF_WATERMARK_POSITIONS.some((p) => p.value === val);
}

export function normalizePdfWatermarkPosition(
  val?: string | null,
  fallback: PdfWatermarkPosition = 'center'
): PdfWatermarkPosition {
  return isValidPdfWatermarkPosition(val) ? val : fallback;
}

const POSITION_FLEX_CLASSES: Record<PdfWatermarkPosition, string> = {
  'top-left': 'items-start justify-start',
  'top-center': 'items-start justify-center',
  'top-right': 'items-start justify-end',
  'middle-left': 'items-center justify-start',
  center: 'items-center justify-center',
  'middle-right': 'items-center justify-end',
  'bottom-left': 'items-end justify-start',
  'bottom-center': 'items-end justify-center',
  'bottom-right': 'items-end justify-end',
};

export interface PdfWatermarkOverlayProps {
  enabled?: boolean;
  imageUrl?: string;
  text?: string;
  opacity?: string | number;
  scale?: string | number;
  position?: PdfWatermarkPosition | string;
  /** Compact mode for mini previews inside template configuration cards */
  compact?: boolean;
}

export default function PdfWatermarkOverlay({
  enabled = false,
  imageUrl,
  text,
  opacity = 0.1,
  scale = 45,
  position = 'center',
  compact = false,
}: PdfWatermarkOverlayProps) {
  if (!enabled) return null;

  const cleanImageUrl = (imageUrl || '').trim();
  const cleanText = (text || '').trim();

  if (!cleanImageUrl && !cleanText) return null;

  const parsedOpacity = Number(opacity);
  const safeOpacity = Number.isFinite(parsedOpacity)
    ? Math.min(0.8, Math.max(0.02, parsedOpacity))
    : 0.1;

  const parsedScale = Number(scale);
  const safeScale = Number.isFinite(parsedScale)
    ? Math.min(100, Math.max(15, parsedScale))
    : 45;

  const safePosition = normalizePdfWatermarkPosition(position, 'center');
  const alignClasses = POSITION_FLEX_CLASSES[safePosition];

  return (
    <div
      className={`absolute inset-0 flex ${alignClasses} pointer-events-none select-none z-0 overflow-hidden ${
        compact ? 'p-2.5' : 'p-8 md:p-10'
      }`}
      aria-hidden="true"
    >
      {cleanImageUrl ? (
        <div
          className="flex items-center justify-center max-h-[85%]"
          style={{
            width: `${safeScale}%`,
            opacity: safeOpacity,
          }}
        >
          <SmartStorageImage
            src={cleanImageUrl}
            alt="Marca de agua institucional"
            className="w-full h-auto max-h-full object-contain"
          />
        </div>
      ) : (
        <div
          className="flex items-center justify-center max-w-[90%]"
          style={{
            opacity: safeOpacity,
            transform: `scale(${Math.max(0.45, Math.min(1.6, safeScale / 55))})`,
            transformOrigin: 'center center',
          }}
        >
          <span
            className={`${
              compact
                ? 'text-[9px] leading-tight tracking-wider'
                : 'text-4xl md:text-5xl leading-relaxed tracking-widest'
            } font-black uppercase text-gray-900 -rotate-35 text-center`}
          >
            {cleanText}
          </span>
        </div>
      )}
    </div>
  );
}
