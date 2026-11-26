import React, { useRef, useState } from 'react';
import {
  Upload,
  X,
  Image as ImageIcon,
  Check,
  Link as LinkIcon,
  Layers,
  Eye,
  EyeOff,
  Maximize2,
  Sliders,
} from 'lucide-react';
import { getApiUrl } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { optimizeImageForUpload, getExtensionFromFile } from '../../utils/imageOptimizer';
import SmartStorageImage from './SmartStorageImage';
import PdfWatermarkOverlay, {
  PDF_WATERMARK_POSITIONS,
  PdfWatermarkPosition,
  normalizePdfWatermarkPosition,
} from './PdfWatermarkOverlay';

export interface PdfWatermarkPatch {
  pdfWatermark?: boolean;
  pdfWatermarkImgUrl?: string;
  pdfWatermarkText?: string;
  pdfWatermarkOpacity?: string;
  pdfWatermarkScale?: string;
  pdfWatermarkPosition?: PdfWatermarkPosition;
}

export interface PdfWatermarkConfigCardProps {
  enabled: boolean;
  imageUrl: string;
  text: string;
  opacity: string;
  scale: string;
  position: PdfWatermarkPosition | string;
  storageFolder?: 'combustible' | 'compra';
  documentLabel?: string;
  onChange: (patch: PdfWatermarkPatch) => void;
  onAutoSave?: (patch: PdfWatermarkPatch) => void;
}

export default function PdfWatermarkConfigCard({
  enabled,
  imageUrl,
  text,
  opacity,
  scale,
  position,
  storageFolder = 'combustible',
  documentLabel = 'DOCUMENTO OFICIAL PDF',
  onChange,
  onAutoSave,
}: PdfWatermarkConfigCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const safeOpacityNum = (() => {
    const n = Number(opacity);
    return Number.isFinite(n) ? Math.min(0.6, Math.max(0.02, n)) : 0.1;
  })();

  const safeScaleNum = (() => {
    const n = Number(scale);
    return Number.isFinite(n) ? Math.min(100, Math.max(15, n)) : 45;
  })();

  const safePosition = normalizePdfWatermarkPosition(position, 'center');
  const activePosMeta =
    PDF_WATERMARK_POSITIONS.find((p) => p.value === safePosition) || PDF_WATERMARK_POSITIONS[4];

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    if (!rawFile.type.startsWith('image/')) {
      setUploadError('Seleccione un archivo de imagen válido (PNG, JPG, WEBP o SVG).');
      return;
    }

    setProcessing(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      const file = await optimizeImageForUpload(rawFile, {
        profile: 'email_logo',
        modulo: `watermark_${storageFolder}`,
        bucketId: 'socorristas',
      });
      const fileExt = getExtensionFromFile(file, 'png');
      const cleanFileName = `wm_${storageFolder}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

      // 1. Generar vista previa local preservando transparencia PNG/WEBP hasta 900px
      const localDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const rawResult = ev.target?.result as string;
          if (file.type === 'image/svg+xml') {
            resolve(rawResult);
            return;
          }
          const img = new Image();
          img.onload = () => {
            const maxDim = 900;
            let width = img.width;
            let height = img.height;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, width, height);
              ctx.drawImage(img, 0, 0, width, height);
              const keepAlpha =
                file.type.includes('png') ||
                file.type.includes('webp') ||
                rawFile.type.includes('png') ||
                rawFile.type.includes('webp');
              const mime = keepAlpha ? 'image/png' : 'image/jpeg';
              resolve(canvas.toDataURL(mime, keepAlpha ? undefined : 0.85));
            } else {
              resolve(rawResult);
            }
          };
          img.onerror = () => resolve(rawResult);
          img.src = rawResult;
        };
        reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
        reader.readAsDataURL(file);
      });

      // Aplicar de inmediato para respuesta visual instantánea
      const initialPatch: PdfWatermarkPatch = {
        pdfWatermark: true,
        pdfWatermarkImgUrl: localDataUrl,
      };
      onChange(initialPatch);

      let resolvedPublicUrl: string | null = null;

      // 2. Intentar subir a Supabase Storage ('socorristas' -> carpeta 'plantillas/watermarks/')
      const storagePaths: Array<{ bucket: string; path: string }> = [
        { bucket: 'socorristas', path: `plantillas/watermarks/${cleanFileName}` },
        { bucket: 'socorristas', path: `logos/${cleanFileName}` },
        { bucket: 'assets', path: `plantillas/watermarks/${cleanFileName}` },
      ];

      for (const target of storagePaths) {
        if (resolvedPublicUrl) break;
        try {
          const { error: uploadErr } = await supabase.storage
            .from(target.bucket)
            .upload(target.path, file, { upsert: true, cacheControl: '3600' });

          if (!uploadErr) {
            const { data } = supabase.storage.from(target.bucket).getPublicUrl(target.path);
            if (data?.publicUrl) {
              resolvedPublicUrl = data.publicUrl;
            }
          }
        } catch (err) {
          console.warn(`Subida marca de agua a ${target.bucket}/${target.path} falló:`, err);
        }
      }

      // 3. Respaldo por backend (/api/upload-file)
      if (!resolvedPublicUrl) {
        try {
          const formData = new FormData();
          formData.append('archivo', file);
          const res = await fetch(getApiUrl('/api/upload-file'), {
            method: 'POST',
            body: formData,
          });
          if (res.ok) {
            const data = await res.json();
            if (data.url) {
              resolvedPublicUrl = data.url.startsWith('http')
                ? data.url
                : `${window.location.origin}${data.url}`;
            }
          }
        } catch (err) {
          console.warn('Subida marca de agua al servidor backend falló:', err);
        }
      }

      const finalUrl = resolvedPublicUrl || localDataUrl;
      const finalPatch: PdfWatermarkPatch = {
        pdfWatermark: true,
        pdfWatermarkImgUrl: finalUrl,
      };

      onChange(finalPatch);
      if (onAutoSave) {
        onAutoSave(finalPatch);
      }

      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error subiendo marca de agua:', err);
      setUploadError(err?.message || 'Error al procesar la imagen de marca de agua.');
    } finally {
      setProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = () => {
    const patch: PdfWatermarkPatch = { pdfWatermarkImgUrl: '' };
    onChange(patch);
    if (onAutoSave) {
      onAutoSave(patch);
    }
  };

  return (
    <div
      className={`p-4 sm:p-5 rounded-2xl border transition-all ${
        enabled
          ? 'bg-white border-emerald-200 shadow-xs'
          : 'bg-gray-50/80 border-gray-200'
      }`}
    >
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-gray-100">
        <div className="flex items-center space-x-2.5">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'
            }`}
          >
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h5 className="text-xs sm:text-sm font-bold text-gray-900 leading-tight">
              Marca de Agua de PDF (Imagen o Texto)
            </h5>
            <p className="text-3xs text-gray-500 mt-0.5">
              Suba un logotipo o sello de fondo y ajuste su opacidad, escala y ubicación en la hoja Carta.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onChange({ pdfWatermark: !enabled })}
          className={`inline-flex items-center px-3 py-1.5 text-xs font-bold rounded-xl border transition cursor-pointer ${
            enabled
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
          }`}
        >
          {enabled ? (
            <>
              <Eye className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              Activa en PDF
            </>
          ) : (
            <>
              <EyeOff className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
              Desactivada
            </>
          )}
        </button>
      </div>

      {/* Cuerpo: Controles a la izquierda + Vista Previa de Hoja Carta a la derecha */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Columna Controles */}
        <div className={`lg:col-span-7 space-y-4 ${!enabled ? 'opacity-55 pointer-events-none' : ''}`}>
          {/* 1. Carga de Imagen */}
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-gray-700 flex items-center">
                <ImageIcon className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                Imagen de Marca de Agua (PNG transparente recomendado)
              </span>
              {imageUrl && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="inline-flex items-center text-2xs font-bold text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                >
                  <X className="w-3 h-3 mr-0.5" />
                  Quitar imagen
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleFileSelected}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={processing}
                className="inline-flex items-center px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs transition cursor-pointer disabled:opacity-60"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                {processing ? 'Subiendo...' : imageUrl ? 'Cambiar Imagen' : 'Subir Imagen'}
              </button>

              <button
                type="button"
                onClick={() => setShowUrlInput((prev) => !prev)}
                className="inline-flex items-center px-2.5 py-1.5 bg-white hover:bg-gray-100 text-gray-700 text-xs font-medium rounded-xl border border-gray-300 transition cursor-pointer"
              >
                <LinkIcon className="w-3 h-3 mr-1 text-gray-500" />
                {showUrlInput ? 'Ocultar URL' : 'Pegar URL'}
              </button>

              {uploadSuccess && (
                <span className="inline-flex items-center px-2 py-0.5 bg-emerald-100 text-emerald-800 text-3xs font-bold rounded-lg">
                  <Check className="w-3 h-3 mr-1" /> Imagen lista
                </span>
              )}
            </div>

            {showUrlInput && (
              <div className="flex items-center gap-1.5">
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) =>
                    onChange({
                      pdfWatermark: true,
                      pdfWatermarkImgUrl: e.target.value,
                    })
                  }
                  placeholder="https://ejemplo.com/marca-agua.png"
                  className="flex-1 px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {imageUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="p-1.5 text-gray-400 hover:text-red-600 cursor-pointer"
                    title="Limpiar URL"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {uploadError && (
              <p className="text-2xs text-red-600 font-semibold">{uploadError}</p>
            )}

            {imageUrl ? (
              <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-gray-200">
                <div className="w-12 h-12 rounded-md border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center p-1 shrink-0">
                  <SmartStorageImage
                    src={imageUrl}
                    alt="Miniatura marca de agua"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-emerald-800">Imagen personalizada activa</p>
                  <p className="text-3xs text-gray-500 truncate">
                    Se renderizará como marca de agua detrás del contenido del PDF.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-3xs text-gray-500">
                Sin imagen cargada: si activa la marca de agua, se usará el texto alternativo de respaldo.
              </p>
            )}
          </div>

          {/* 2. Opacidad y Escala */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Opacidad */}
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-2xs font-bold text-gray-700 uppercase tracking-wider flex items-center">
                  <Sliders className="w-3 h-3 mr-1 text-emerald-600" />
                  Opacidad
                </label>
                <span className="text-xs font-black text-emerald-700 font-mono">
                  {Math.round(safeOpacityNum * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.02"
                max="0.60"
                step="0.01"
                value={safeOpacityNum}
                onChange={(e) => onChange({ pdfWatermarkOpacity: e.target.value })}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-4xs text-gray-400 font-medium">
                <span>2% (Sutil)</span>
                <span>30%</span>
                <span>60% (Intensa)</span>
              </div>
            </div>

            {/* Escala */}
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-2xs font-bold text-gray-700 uppercase tracking-wider flex items-center">
                  <Maximize2 className="w-3 h-3 mr-1 text-emerald-600" />
                  Escala en Hoja
                </label>
                <span className="text-xs font-black text-emerald-700 font-mono">
                  {Math.round(safeScaleNum)}%
                </span>
              </div>
              <input
                type="range"
                min="15"
                max="100"
                step="5"
                value={safeScaleNum}
                onChange={(e) => onChange({ pdfWatermarkScale: e.target.value })}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-4xs text-gray-400 font-medium">
                <span>15% (Pequeña)</span>
                <span>50%</span>
                <span>100% (Ancho total)</span>
              </div>
            </div>
          </div>

          {/* 3. Selector visual de Ubicación (Cuadrícula 3x3) */}
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold text-gray-700 uppercase tracking-wider">
                Ubicación en la Hoja PDF
              </span>
              <span className="text-3xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                {activePosMeta.label}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {PDF_WATERMARK_POSITIONS.map((pos) => {
                const isSelected = safePosition === pos.value;
                return (
                  <button
                    key={pos.value}
                    type="button"
                    onClick={() => onChange({ pdfWatermarkPosition: pos.value })}
                    title={pos.label}
                    className={`py-2 px-2 rounded-lg text-3xs font-bold border transition text-center cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:text-emerald-700'
                    }`}
                  >
                    {pos.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Texto alternativo de respaldo */}
          <div>
            <label className="block text-2xs font-bold text-gray-600 uppercase tracking-wider mb-1">
              Texto Alternativo (si no se sube imagen)
            </label>
            <input
              type="text"
              value={text}
              onChange={(e) => onChange({ pdfWatermarkText: e.target.value })}
              placeholder="Ej: CRUZ VERDE SALVADOREÑA - DOCUMENTO OFICIAL"
              className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Columna Vista Previa Miniatura Hoja Carta */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <span className="text-3xs font-bold uppercase tracking-wider text-gray-500 mb-2">
            Vista Previa en Vivo (Hoja Carta)
          </span>
          <div className="w-full max-w-[230px] aspect-[8.5/11] bg-white rounded-lg border border-gray-300 shadow-md relative overflow-hidden p-3 flex flex-col justify-between select-none">
            {/* Marca de agua real renderizada en vivo */}
            <PdfWatermarkOverlay
              enabled={enabled}
              imageUrl={imageUrl}
              text={text}
              opacity={safeOpacityNum}
              scale={safeScaleNum}
              position={safePosition}
              compact
            />

            {/* Simulación liviana de contenido de documento */}
            <div className="relative z-10 space-y-2">
              <div className="flex items-center justify-between border-b border-gray-300 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full border border-emerald-600/60 bg-emerald-50/70 flex items-center justify-center text-[9px] font-black text-emerald-700">
                    +
                  </div>
                  <div>
                    <div className="text-[6.5px] font-black text-gray-800 uppercase tracking-wide">
                      Cruz Verde Salvadoreña
                    </div>
                    <div className="text-[5.5px] font-bold text-gray-500 uppercase">
                      {documentLabel}
                    </div>
                  </div>
                </div>
                <div className="text-[5.5px] font-mono text-gray-500 text-right">
                  <div>FOLIO-001</div>
                  <div>SV UTC-6</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <div className="h-5 rounded bg-gray-100/75 border border-gray-200/70 p-1">
                  <div className="h-1 w-8 bg-gray-300 rounded mb-1" />
                  <div className="h-1.5 w-14 bg-gray-400/70 rounded" />
                </div>
                <div className="h-5 rounded bg-gray-100/75 border border-gray-200/70 p-1">
                  <div className="h-1 w-8 bg-gray-300 rounded mb-1" />
                  <div className="h-1.5 w-12 bg-gray-400/70 rounded" />
                </div>
                <div className="col-span-2 h-8 rounded bg-gray-100/75 border border-gray-200/70 p-1 space-y-1">
                  <div className="h-1 w-12 bg-gray-300 rounded" />
                  <div className="h-1 w-full bg-gray-300/70 rounded" />
                  <div className="h-1 w-4/5 bg-gray-300/70 rounded" />
                </div>
              </div>
            </div>

            <div className="relative z-10 space-y-2">
              <div className="grid grid-cols-3 gap-2 pt-2 items-end">
                <div className="text-center">
                  <div className="border-b border-gray-400 mb-0.5" />
                  <div className="text-[5px] text-gray-500">Solicitante</div>
                </div>
                <div className="h-6 border border-dashed border-gray-300 rounded flex items-center justify-center text-[4.5px] text-gray-400 uppercase">
                  Sello
                </div>
                <div className="text-center">
                  <div className="border-b border-gray-400 mb-0.5" />
                  <div className="text-[5px] text-gray-500">Autorización</div>
                </div>
              </div>
              <div className="border-t border-gray-200 pt-1 flex justify-between text-[5px] text-gray-400">
                <span>Documento Oficial</span>
                <span>Pág 1/1</span>
              </div>
            </div>
          </div>
          <p className="text-4xs text-gray-400 mt-1.5 text-center">
            {enabled
              ? `Opacidad ${Math.round(safeOpacityNum * 100)}% • Escala ${Math.round(safeScaleNum)}% • ${activePosMeta.label}`
              : 'Marca de agua desactivada actualmente'}
          </p>
        </div>
      </div>
    </div>
  );
}
