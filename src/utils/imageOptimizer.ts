import { supabase } from '../lib/supabase';
import { getApiUrl } from '../lib/api';

export type ImageOptimizationPreset = 'maximum_fidelity' | 'visually_lossless' | 'balanced';

export type ImageOptimizationProfile =
  | 'carnet'
  | 'template'
  | 'banner'
  | 'general'
  | 'logo'
  | 'email_logo';

export interface ImageOptimizationConfig {
  enabled: boolean;
  preset: ImageOptimizationPreset;
  preferWebp: boolean;
  stripMetadata: boolean;
  storageQuotaMb: number;
  carnetQuality: number;
  carnetMaxDim: number;
  templateQuality: number;
  templateMaxDim: number;
  bannerQuality: number;
  bannerMaxDim: number;
  generalQuality: number;
  generalMaxDim: number;
  logoQuality: number;
  logoMaxDim: number;
}

export const DEFAULT_IMAGE_OPT_CONFIG: ImageOptimizationConfig = {
  enabled: true,
  preset: 'visually_lossless',
  preferWebp: true,
  stripMetadata: true,
  storageQuotaMb: 1024,
  carnetQuality: 0.94,
  carnetMaxDim: 1600,
  templateQuality: 0.95,
  templateMaxDim: 2600,
  bannerQuality: 0.90,
  bannerMaxDim: 2200,
  generalQuality: 0.90,
  generalMaxDim: 2000,
  logoQuality: 0.94,
  logoMaxDim: 1200,
};

export const PRESET_DEFINITIONS: Record<
  ImageOptimizationPreset,
  {
    label: string;
    shortDesc: string;
    carnetQuality: number;
    templateQuality: number;
    bannerQuality: number;
    generalQuality: number;
    logoQuality: number;
  }
> = {
  maximum_fidelity: {
    label: 'Fidelidad Máxima (Archivo / Impresión)',
    shortDesc: 'Calidad 95%–96%. Ahorra ~55%–70% de peso manteniendo detalle microscópico.',
    carnetQuality: 0.96,
    templateQuality: 0.97,
    bannerQuality: 0.94,
    generalQuality: 0.93,
    logoQuality: 0.96,
  },
  visually_lossless: {
    label: 'Sin Pérdida Visual (Recomendado)',
    shortDesc: 'Calidad 90%–95%. Indistinguible del original al ojo humano y en carnets impresos; ahorra ~65%–82%.',
    carnetQuality: 0.94,
    templateQuality: 0.95,
    bannerQuality: 0.90,
    generalQuality: 0.90,
    logoQuality: 0.94,
  },
  balanced: {
    label: 'Ahorro Máximo Equilibrado',
    shortDesc: 'Calidad 84%–90%. Prioriza ligereza máxima para conexiones móviles lentas; ahorra ~75%–88%.',
    carnetQuality: 0.90,
    templateQuality: 0.92,
    bannerQuality: 0.85,
    generalQuality: 0.84,
    logoQuality: 0.90,
  },
};

const LS_OPT_CONFIG_KEY = 'cv_image_opt_config';
const LS_OPT_STATS_KEY = 'cv_image_opt_local_stats';

interface LocalOptimizationSummary {
  total_processed: number;
  optimized_count: number;
  total_original_bytes: number;
  total_final_bytes: number;
  total_saved_bytes: number;
}

let memoryConfigCache: ImageOptimizationConfig | null = null;
let lastConfigFetchTs = 0;
let webpSupportCached: boolean | null = null;

export function formatStorageBytes(bytes: number, decimals = 2): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = Math.max(0, decimals);
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function normalizeImageOptimizationConfig(raw: any): ImageOptimizationConfig {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_IMAGE_OPT_CONFIG };
  }
  const preset: ImageOptimizationPreset =
    raw.preset === 'maximum_fidelity' || raw.preset === 'balanced' || raw.preset === 'visually_lossless'
      ? raw.preset
      : 'visually_lossless';

  const clampNum = (val: any, fallback: number, min: number, max: number) => {
    const n = Number(val);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  };

  return {
    enabled: raw.enabled !== false,
    preset,
    preferWebp: raw.preferWebp !== false,
    stripMetadata: raw.stripMetadata !== false,
    storageQuotaMb: clampNum(raw.storageQuotaMb, DEFAULT_IMAGE_OPT_CONFIG.storageQuotaMb, 100, 1024000),
    carnetQuality: clampNum(raw.carnetQuality, DEFAULT_IMAGE_OPT_CONFIG.carnetQuality, 0.7, 1),
    carnetMaxDim: clampNum(raw.carnetMaxDim, DEFAULT_IMAGE_OPT_CONFIG.carnetMaxDim, 600, 4096),
    templateQuality: clampNum(raw.templateQuality, DEFAULT_IMAGE_OPT_CONFIG.templateQuality, 0.75, 1),
    templateMaxDim: clampNum(raw.templateMaxDim, DEFAULT_IMAGE_OPT_CONFIG.templateMaxDim, 1000, 5000),
    bannerQuality: clampNum(raw.bannerQuality, DEFAULT_IMAGE_OPT_CONFIG.bannerQuality, 0.65, 1),
    bannerMaxDim: clampNum(raw.bannerMaxDim, DEFAULT_IMAGE_OPT_CONFIG.bannerMaxDim, 800, 4096),
    generalQuality: clampNum(raw.generalQuality, DEFAULT_IMAGE_OPT_CONFIG.generalQuality, 0.65, 1),
    generalMaxDim: clampNum(raw.generalMaxDim, DEFAULT_IMAGE_OPT_CONFIG.generalMaxDim, 800, 4096),
    logoQuality: clampNum(raw.logoQuality, DEFAULT_IMAGE_OPT_CONFIG.logoQuality, 0.75, 1),
    logoMaxDim: clampNum(raw.logoMaxDim, DEFAULT_IMAGE_OPT_CONFIG.logoMaxDim, 300, 2500),
  };
}

export function getCachedImageOptimizationConfig(): ImageOptimizationConfig {
  if (memoryConfigCache) return memoryConfigCache;
  try {
    const raw = localStorage.getItem(LS_OPT_CONFIG_KEY);
    if (raw) {
      const parsed = normalizeImageOptimizationConfig(JSON.parse(raw));
      memoryConfigCache = parsed;
      return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return { ...DEFAULT_IMAGE_OPT_CONFIG };
}

export async function fetchImageOptimizationConfig(forceRefresh = false): Promise<ImageOptimizationConfig> {
  const now = Date.now();
  if (!forceRefresh && memoryConfigCache && now - lastConfigFetchTs < 30000) {
    return memoryConfigCache;
  }

  let resolved = getCachedImageOptimizationConfig();

  try {
    const { data, error } = await supabase
      .from('configuracion')
      .select('valor')
      .eq('clave', 'optimizacion_imagenes_config')
      .maybeSingle();

    if (!error && data?.valor) {
      const parsed = typeof data.valor === 'string' ? JSON.parse(data.valor) : data.valor;
      resolved = normalizeImageOptimizationConfig(parsed);
      memoryConfigCache = resolved;
      lastConfigFetchTs = now;
      try {
        localStorage.setItem(LS_OPT_CONFIG_KEY, JSON.stringify(resolved));
      } catch {}
      return resolved;
    }
  } catch {
    // fallback to local API / cache
  }

  try {
    const res = await fetch(getApiUrl('/api/configuracion'));
    if (res.ok) {
      const json = await res.json();
      if (json?.optimizacion_imagenes_config) {
        const parsed =
          typeof json.optimizacion_imagenes_config === 'string'
            ? JSON.parse(json.optimizacion_imagenes_config)
            : json.optimizacion_imagenes_config;
        resolved = normalizeImageOptimizationConfig(parsed);
        memoryConfigCache = resolved;
        lastConfigFetchTs = now;
        try {
          localStorage.setItem(LS_OPT_CONFIG_KEY, JSON.stringify(resolved));
        } catch {}
      }
    }
  } catch {}

  memoryConfigCache = resolved;
  lastConfigFetchTs = now;
  return resolved;
}

export async function saveImageOptimizationConfig(
  nextConfig: ImageOptimizationConfig
): Promise<ImageOptimizationConfig> {
  const clean = normalizeImageOptimizationConfig(nextConfig);
  const serialized = JSON.stringify(clean);

  memoryConfigCache = clean;
  lastConfigFetchTs = Date.now();
  try {
    localStorage.setItem(LS_OPT_CONFIG_KEY, JSON.stringify(clean));
  } catch {}

  // Save in Supabase public.configuracion
  const { data: existing, error: selErr } = await supabase
    .from('configuracion')
    .select('id')
    .eq('clave', 'optimizacion_imagenes_config')
    .maybeSingle();

  if (!selErr && existing) {
    const { error: updErr } = await supabase
      .from('configuracion')
      .update({ valor: serialized })
      .eq('id', existing.id);
    if (updErr) throw updErr;
  } else {
    const { error: insErr } = await supabase
      .from('configuracion')
      .insert([{ clave: 'optimizacion_imagenes_config', valor: serialized }]);
    if (insErr) throw insErr;
  }

  // Sync optional local SQLite API
  try {
    await fetch(getApiUrl('/api/configuracion'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optimizacion_imagenes_config: serialized }),
    });
  } catch {}

  return clean;
}

function supportsWebpEncode(): boolean {
  if (webpSupportCached !== null) return webpSupportCached;
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const dataUrl = canvas.toDataURL('image/webp');
    webpSupportCached = dataUrl.startsWith('data:image/webp');
    return webpSupportCached;
  } catch {
    webpSupportCached = false;
    return false;
  }
}

function getProfileParameters(
  config: ImageOptimizationConfig,
  profile: ImageOptimizationProfile,
  customMaxDim?: number
): { quality: number; maxDim: number; allowWebp: boolean } {
  switch (profile) {
    case 'carnet':
      return {
        quality: config.carnetQuality,
        maxDim: customMaxDim || config.carnetMaxDim,
        allowWebp: config.preferWebp,
      };
    case 'template':
      return {
        quality: config.templateQuality,
        maxDim: customMaxDim || config.templateMaxDim,
        allowWebp: config.preferWebp,
      };
    case 'banner':
      return {
        quality: config.bannerQuality,
        maxDim: customMaxDim || config.bannerMaxDim,
        allowWebp: config.preferWebp,
      };
    case 'logo':
      return {
        quality: config.logoQuality,
        maxDim: customMaxDim || config.logoMaxDim,
        allowWebp: config.preferWebp,
      };
    case 'email_logo':
      // Email clients like classic desktop Outlook do not support WebP reliably: keep PNG/JPEG
      return {
        quality: config.logoQuality,
        maxDim: customMaxDim || config.logoMaxDim,
        allowWebp: false,
      };
    case 'general':
    default:
      return {
        quality: config.generalQuality,
        maxDim: customMaxDim || config.generalMaxDim,
        allowWebp: config.preferWebp,
      };
  }
}

function canvasHasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    // Sample grid up to 64x64 for fast alpha detection
    const stepX = Math.max(1, Math.floor(width / 64));
    const stepY = Math.max(1, Math.floor(height / 64));
    const data = ctx.getImageData(0, 0, width, height).data;
    for (let y = 0; y < height; y += stepY) {
      for (let x = 0; x < width; x += stepX) {
        const alphaIdx = (y * width + x) * 4 + 3;
        if (data[alphaIdx] < 250) {
          return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

function extensionForMime(mime: string, fallbackExt = 'jpg'): string {
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/svg+xml') return 'svg';
  if (mime === 'image/gif') return 'gif';
  return fallbackExt;
}

function replaceFileExtension(originalName: string, newExt: string): string {
  const base = originalName.replace(/\.[^/.]+$/, '') || 'imagen';
  return `${base}.${newExt}`;
}

export function getExtensionFromFile(file: File, fallback = 'jpg'): string {
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/jpeg') return 'jpg';
  if (file.type === 'image/svg+xml') return 'svg';
  if (file.type === 'image/gif') return 'gif';
  const nameExt = file.name.split('.').pop()?.toLowerCase();
  return nameExt || fallback;
}

async function decodeImageElement(blob: Blob): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => {
          try {
            bitmap.close();
          } catch {}
        },
      };
    } catch {
      // fallback to HTMLImageElement
    }
  }

  return await new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({
        source: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        cleanup: () => URL.revokeObjectURL(objectUrl),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo decodificar la imagen para optimización'));
    };
    img.src = objectUrl;
  });
}

function recordLocalOptimizationStats(originalBytes: number, finalBytes: number, wasOptimized: boolean) {
  try {
    const raw = localStorage.getItem(LS_OPT_STATS_KEY);
    const current: LocalOptimizationSummary = raw
      ? JSON.parse(raw)
      : {
          total_processed: 0,
          optimized_count: 0,
          total_original_bytes: 0,
          total_final_bytes: 0,
          total_saved_bytes: 0,
        };
    const saved = Math.max(0, originalBytes - finalBytes);
    const updated: LocalOptimizationSummary = {
      total_processed: (current.total_processed || 0) + 1,
      optimized_count: (current.optimized_count || 0) + (wasOptimized ? 1 : 0),
      total_original_bytes: (current.total_original_bytes || 0) + originalBytes,
      total_final_bytes: (current.total_final_bytes || 0) + finalBytes,
      total_saved_bytes: (current.total_saved_bytes || 0) + saved,
    };
    localStorage.setItem(LS_OPT_STATS_KEY, JSON.stringify(updated));
  } catch {}
}

export function getLocalOptimizationStats(): LocalOptimizationSummary {
  try {
    const raw = localStorage.getItem(LS_OPT_STATS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    total_processed: 0,
    optimized_count: 0,
    total_original_bytes: 0,
    total_final_bytes: 0,
    total_saved_bytes: 0,
  };
}

export interface OptimizeImageResult {
  file: File;
  wasOptimized: boolean;
  originalBytes: number;
  finalBytes: number;
  savedBytes: number;
  reductionPercent: number;
  originalWidth: number;
  originalHeight: number;
  finalWidth: number;
  finalHeight: number;
  originalMime: string;
  finalMime: string;
  skipReason?: string;
}

export interface OptimizeUploadOptions {
  profile?: ImageOptimizationProfile;
  modulo?: string;
  bucketId?: string;
  customMaxDim?: number;
  fileNameOverride?: string;
  recordTelemetry?: boolean;
  overrideConfig?: ImageOptimizationConfig;
  forceRunWhenDisabled?: boolean;
}

export async function optimizeImageDetailed(
  input: File | Blob,
  options: OptimizeUploadOptions = {}
): Promise<OptimizeImageResult> {
  const {
    profile = 'general',
    modulo = 'general',
    bucketId = 'socorristas',
    customMaxDim,
    fileNameOverride,
    recordTelemetry = true,
    overrideConfig,
    forceRunWhenDisabled = false,
  } = options;

  const baseFile: File =
    input instanceof File
      ? input
      : new File([input], fileNameOverride || `imagen_${Date.now()}.png`, {
          type: input.type || 'image/png',
        });

  const originalMime = baseFile.type || 'application/octet-stream';
  const isRasterImage =
    originalMime.startsWith('image/') &&
    originalMime !== 'image/svg+xml' &&
    originalMime !== 'image/gif';

  if (!isRasterImage) {
    return {
      file: baseFile,
      wasOptimized: false,
      originalBytes: baseFile.size,
      finalBytes: baseFile.size,
      savedBytes: 0,
      reductionPercent: 0,
      originalWidth: 0,
      originalHeight: 0,
      finalWidth: 0,
      finalHeight: 0,
      originalMime,
      finalMime: originalMime,
      skipReason: 'Formato vectorial/animado o documento no fotográfico (se conserva intacto)',
    };
  }

  const config = overrideConfig || (await fetchImageOptimizationConfig());

  if (!config.enabled && !forceRunWhenDisabled) {
    return {
      file: baseFile,
      wasOptimized: false,
      originalBytes: baseFile.size,
      finalBytes: baseFile.size,
      savedBytes: 0,
      reductionPercent: 0,
      originalWidth: 0,
      originalHeight: 0,
      finalWidth: 0,
      finalHeight: 0,
      originalMime,
      finalMime: originalMime,
      skipReason: 'Optimización desactivada en Configuración',
    };
  }

  try {
    const decoded = await decodeImageElement(baseFile);
    const { source, width: origW, height: origH, cleanup } = decoded;

    try {
      const { quality, maxDim, allowWebp } = getProfileParameters(config, profile, customMaxDim);

      let targetW = origW;
      let targetH = origH;

      if (origW > maxDim || origH > maxDim) {
        if (origW >= origH) {
          targetH = Math.max(1, Math.round((origH * maxDim) / origW));
          targetW = maxDim;
        } else {
          targetW = Math.max(1, Math.round((origW * maxDim) / origH));
          targetH = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        return {
          file: baseFile,
          wasOptimized: false,
          originalBytes: baseFile.size,
          finalBytes: baseFile.size,
          savedBytes: 0,
          reductionPercent: 0,
          originalWidth: origW,
          originalHeight: origH,
          finalWidth: origW,
          finalHeight: origH,
          originalMime,
          finalMime: originalMime,
          skipReason: 'Canvas 2D no disponible',
        };
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source, 0, 0, targetW, targetH);

      const canWebp = allowWebp && supportsWebpEncode();
      let targetMime = 'image/jpeg';

      if (canWebp) {
        targetMime = 'image/webp';
      } else {
        const mightHaveAlpha = originalMime === 'image/png' || originalMime === 'image/webp';
        if (mightHaveAlpha && canvasHasTransparency(ctx, targetW, targetH)) {
          targetMime = 'image/png';
        } else {
          targetMime = 'image/jpeg';
        }
      }

      const encodedBlob = await new Promise<Blob | null>((resolve) => {
        if (targetMime === 'image/png') {
          canvas.toBlob((b) => resolve(b), 'image/png');
        } else {
          canvas.toBlob((b) => resolve(b), targetMime, quality);
        }
      });

      if (!encodedBlob || encodedBlob.size === 0) {
        return {
          file: baseFile,
          wasOptimized: false,
          originalBytes: baseFile.size,
          finalBytes: baseFile.size,
          savedBytes: 0,
          reductionPercent: 0,
          originalWidth: origW,
          originalHeight: origH,
          finalWidth: origW,
          finalHeight: origH,
          originalMime,
          finalMime: originalMime,
          skipReason: 'No se pudo codificar versión optimizada',
        };
      }

      const wasResized = targetW < origW || targetH < origH;
      const savesSpace = encodedBlob.size < baseFile.size * 0.98;

      if (!savesSpace && !wasResized) {
        if (recordTelemetry) {
          recordLocalOptimizationStats(baseFile.size, baseFile.size, false);
        }
        return {
          file: baseFile,
          wasOptimized: false,
          originalBytes: baseFile.size,
          finalBytes: baseFile.size,
          savedBytes: 0,
          reductionPercent: 0,
          originalWidth: origW,
          originalHeight: origH,
          finalWidth: origW,
          finalHeight: origH,
          originalMime,
          finalMime: originalMime,
          skipReason: 'La imagen original ya estaba optimizada al máximo',
        };
      }

      // If resized slightly larger (rare), still keep whichever is smaller unless dimensions exceeded limit
      const finalBlob = encodedBlob.size < baseFile.size ? encodedBlob : baseFile;
      const finalMime = encodedBlob.size < baseFile.size ? targetMime : originalMime;
      const finalExt = extensionForMime(finalMime, getExtensionFromFile(baseFile));
      const newFileName = replaceFileExtension(fileNameOverride || baseFile.name, finalExt);

      const optimizedFile = new File([finalBlob], newFileName, {
        type: finalMime,
        lastModified: Date.now(),
      });

      const savedBytes = Math.max(0, baseFile.size - optimizedFile.size);
      const reductionPercent =
        baseFile.size > 0 ? Math.max(0, Number(((savedBytes / baseFile.size) * 100).toFixed(1))) : 0;
      const wasOptimized = savedBytes > 0 || wasResized;

      if (recordTelemetry) {
        recordLocalOptimizationStats(baseFile.size, optimizedFile.size, wasOptimized);
        // Non-blocking insert into Supabase optimization log table
        void (async () => {
          try {
            await supabase.from('imagenes_optimizacion_log').insert([
              {
                modulo,
                bucket_id: bucketId,
                nombre_original: baseFile.name.slice(0, 200),
                formato_original: originalMime,
                formato_final: finalMime,
                bytes_original: baseFile.size,
                bytes_final: optimizedFile.size,
                bytes_ahorrados: savedBytes,
                ancho_original: origW,
                alto_original: origH,
                ancho_final: targetW,
                alto_final: targetH,
                fue_optimizada: wasOptimized,
              },
            ]);
          } catch {
            // Ignore silently if Migration 47 has not been run yet
          }
        })();
      }

      return {
        file: optimizedFile,
        wasOptimized,
        originalBytes: baseFile.size,
        finalBytes: optimizedFile.size,
        savedBytes,
        reductionPercent,
        originalWidth: origW,
        originalHeight: origH,
        finalWidth: targetW,
        finalHeight: targetH,
        originalMime,
        finalMime,
      };
    } finally {
      cleanup();
    }
  } catch (err) {
    console.warn('Optimizador de imagen omitido por seguridad (se sube archivo original):', err);
    return {
      file: baseFile,
      wasOptimized: false,
      originalBytes: baseFile.size,
      finalBytes: baseFile.size,
      savedBytes: 0,
      reductionPercent: 0,
      originalWidth: 0,
      originalHeight: 0,
      finalWidth: 0,
      finalHeight: 0,
      originalMime,
      finalMime: originalMime,
      skipReason: 'Se conservó el archivo original por compatibilidad',
    };
  }
}

/**
 * Función directa para todos los puntos de subida a Supabase Storage:
 * Devuelve un `File` optimizado sin pérdida visual (o el original intacto si está desactivado o es PDF/SVG).
 */
export async function optimizeImageForUpload(
  input: File | Blob,
  options: OptimizeUploadOptions = {}
): Promise<File> {
  const result = await optimizeImageDetailed(input, options);
  return result.file;
}

// ============================================================================
// ESTADÍSTICAS E INVENTARIO DE IMÁGENES EN SUPABASE STORAGE
// ============================================================================

export interface StorageBucketStat {
  bucket_id: string;
  image_count: number;
  image_bytes: number;
  other_count: number;
  other_bytes: number;
}

export interface StorageFolderStat {
  folder: string;
  image_count: number;
  image_bytes: number;
}

export interface StorageFormatStat {
  format: string;
  count: number;
  bytes: number;
  avg_bytes: number;
}

export interface StorageImageItem {
  bucket_id: string;
  name: string;
  folder: string;
  format: string;
  mimetype: string;
  size_bytes: number;
  created_at: string | null;
  publicUrl: string;
}

export interface StorageImagesAnalytics {
  source: 'sql_rpc' | 'storage_scan';
  total_images: number;
  total_image_bytes: number;
  avg_image_bytes: number;
  other_files_count: number;
  other_files_bytes: number;
  by_bucket: StorageBucketStat[];
  by_folder: StorageFolderStat[];
  by_format: StorageFormatStat[];
  largest_images: StorageImageItem[];
  recent_images: StorageImageItem[];
  optimization_log: {
    total_processed: number;
    optimized_count: number;
    total_original_bytes: number;
    total_final_bytes: number;
    total_saved_bytes: number;
  };
}

function classifyFileFormat(name: string, mime: string): { isImage: boolean; format: string } {
  const lower = name.toLowerCase();
  const m = (mime || '').toLowerCase();
  if (m === 'image/webp' || lower.endsWith('.webp')) return { isImage: true, format: 'WebP' };
  if (m === 'image/jpeg' || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return { isImage: true, format: 'JPEG' };
  }
  if (m === 'image/png' || lower.endsWith('.png')) return { isImage: true, format: 'PNG' };
  if (m === 'image/svg+xml' || lower.endsWith('.svg')) return { isImage: true, format: 'SVG' };
  if (
    m.startsWith('image/') ||
    /\.(gif|avif|bmp|heic|heif)$/.test(lower)
  ) {
    return { isImage: true, format: 'Otros (GIF/HEIC)' };
  }
  return { isImage: false, format: 'Otros archivos' };
}

function enrichImageItems(items: any[]): StorageImageItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((it) => {
    const bucketId = String(it.bucket_id || 'socorristas');
    const name = String(it.name || '');
    const { data } = supabase.storage.from(bucketId).getPublicUrl(name);
    return {
      bucket_id: bucketId,
      name,
      folder: String(it.folder || 'carnets_y_perfiles'),
      format: String(it.format || 'Imagen'),
      mimetype: String(it.mimetype || 'image/jpeg'),
      size_bytes: Number(it.size_bytes || 0),
      created_at: it.created_at || null,
      publicUrl: data?.publicUrl || '',
    };
  });
}

export async function fetchStorageImagesAnalytics(): Promise<StorageImagesAnalytics> {
  const localOpt = getLocalOptimizationStats();

  // 1. Intentar función SQL RPC rápida y exacta (Migración 47)
  try {
    const { data, error } = await supabase.rpc('get_storage_images_stats');
    if (!error && data && typeof data === 'object') {
      const rpcOpt = data.optimization_log || {};
      const mergedOpt =
        Number(rpcOpt.total_processed || 0) >= localOpt.total_processed
          ? {
              total_processed: Number(rpcOpt.total_processed || 0),
              optimized_count: Number(rpcOpt.optimized_count || 0),
              total_original_bytes: Number(rpcOpt.total_original_bytes || 0),
              total_final_bytes: Number(rpcOpt.total_final_bytes || 0),
              total_saved_bytes: Number(rpcOpt.total_saved_bytes || 0),
            }
          : localOpt;

      return {
        source: 'sql_rpc',
        total_images: Number(data.total_images || 0),
        total_image_bytes: Number(data.total_image_bytes || 0),
        avg_image_bytes: Number(data.avg_image_bytes || 0),
        other_files_count: Number(data.other_files_count || 0),
        other_files_bytes: Number(data.other_files_bytes || 0),
        by_bucket: Array.isArray(data.by_bucket) ? data.by_bucket : [],
        by_folder: Array.isArray(data.by_folder) ? data.by_folder : [],
        by_format: Array.isArray(data.by_format) ? data.by_format : [],
        largest_images: enrichImageItems(data.largest_images),
        recent_images: enrichImageItems(data.recent_images),
        optimization_log: mergedOpt,
      };
    }
  } catch {
    // Continuar con escaneo directo de buckets como respaldo automático
  }

  // 2. Respaldo automático: escaneo directo sobre buckets conocidos en Supabase Storage
  const buckets = ['socorristas', 'assets', 'archivos', 'logos', 'plantillas'];
  const knownSubfolders = [
    '',
    'logos',
    'noticias',
    'anuncios',
    'vehiculos',
    'documentos',
    'archivos',
    'combustible',
    'soporte',
    'templates',
    'fonts',
  ];

  interface ScannedObj {
    bucket_id: string;
    name: string;
    folder: string;
    isImage: boolean;
    format: string;
    mimetype: string;
    size_bytes: number;
    created_at: string | null;
  }

  const collected: ScannedObj[] = [];
  const seenKeys = new Set<string>();

  await Promise.all(
    buckets.map(async (bucket) => {
      await Promise.all(
        knownSubfolders.map(async (folder) => {
          try {
            const { data: list, error } = await supabase.storage.from(bucket).list(folder, {
              limit: 500,
              sortBy: { column: 'created_at', order: 'desc' },
            });
            if (error || !Array.isArray(list)) return;

            for (const entry of list) {
              if (!entry.name || entry.name === '.emptyFolderPlaceholder') continue;
              // En Supabase Storage, las subcarpetas tienen id === null y metadata === null
              if (!entry.id && !entry.metadata) continue;

              const fullPath = folder ? `${folder}/${entry.name}` : entry.name;
              const uniqueKey = `${bucket}:${fullPath}`;
              if (seenKeys.has(uniqueKey)) continue;
              seenKeys.add(uniqueKey);

              const meta: any = entry.metadata || {};
              const mime = String(meta.mimetype || meta.contentType || '');
              const sizeBytes = Number(meta.size || 0);
              const { isImage, format } = classifyFileFormat(fullPath, mime);

              collected.push({
                bucket_id: bucket,
                name: fullPath,
                folder: folder || 'carnets_y_perfiles',
                isImage,
                format,
                mimetype: mime || (isImage ? 'image/jpeg' : 'application/octet-stream'),
                size_bytes: Number.isFinite(sizeBytes) ? sizeBytes : 0,
                created_at: entry.created_at || entry.updated_at || null,
              });
            }
          } catch {
            // bucket/carpeta inexistente o sin permisos
          }
        })
      );
    })
  );

  const images = collected.filter((c) => c.isImage);
  const others = collected.filter((c) => !c.isImage);

  const totalImageBytes = images.reduce((acc, i) => acc + i.size_bytes, 0);
  const otherFilesBytes = others.reduce((acc, i) => acc + i.size_bytes, 0);

  const bucketMap = new Map<string, StorageBucketStat>();
  for (const c of collected) {
    const cur = bucketMap.get(c.bucket_id) || {
      bucket_id: c.bucket_id,
      image_count: 0,
      image_bytes: 0,
      other_count: 0,
      other_bytes: 0,
    };
    if (c.isImage) {
      cur.image_count += 1;
      cur.image_bytes += c.size_bytes;
    } else {
      cur.other_count += 1;
      cur.other_bytes += c.size_bytes;
    }
    bucketMap.set(c.bucket_id, cur);
  }

  const folderMap = new Map<string, StorageFolderStat>();
  const formatMap = new Map<string, { count: number; bytes: number }>();

  for (const img of images) {
    const fStat = folderMap.get(img.folder) || {
      folder: img.folder,
      image_count: 0,
      image_bytes: 0,
    };
    fStat.image_count += 1;
    fStat.image_bytes += img.size_bytes;
    folderMap.set(img.folder, fStat);

    const fmtStat = formatMap.get(img.format) || { count: 0, bytes: 0 };
    fmtStat.count += 1;
    fmtStat.bytes += img.size_bytes;
    formatMap.set(img.format, fmtStat);
  }

  const largestSorted = [...images]
    .sort((a, b) => b.size_bytes - a.size_bytes)
    .slice(0, 20);

  const recentSorted = [...images]
    .sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    })
    .slice(0, 20);

  return {
    source: 'storage_scan',
    total_images: images.length,
    total_image_bytes: totalImageBytes,
    avg_image_bytes: images.length > 0 ? Math.round(totalImageBytes / images.length) : 0,
    other_files_count: others.length,
    other_files_bytes: otherFilesBytes,
    by_bucket: Array.from(bucketMap.values()).sort((a, b) => b.image_bytes - a.image_bytes),
    by_folder: Array.from(folderMap.values()).sort((a, b) => b.image_bytes - a.image_bytes),
    by_format: Array.from(formatMap.entries())
      .map(([format, v]) => ({
        format,
        count: v.count,
        bytes: v.bytes,
        avg_bytes: v.count > 0 ? Math.round(v.bytes / v.count) : 0,
      }))
      .sort((a, b) => b.bytes - a.bytes),
    largest_images: enrichImageItems(largestSorted),
    recent_images: enrichImageItems(recentSorted),
    optimization_log: localOpt,
  };
}

export const SQL_MIGRATION_47_TEXT = `-- =========================================================================================
-- MIGRACIÓN 47: OPTIMIZACIÓN DE IMÁGENES (SOPORTE WEBP) Y ESTADÍSTICAS REALES DE STORAGE
-- =========================================================================================

UPDATE storage.buckets
SET allowed_mime_types = NULL
WHERE id IN ('socorristas', 'assets', 'archivos', 'logos', 'plantillas')
  AND allowed_mime_types IS NOT NULL
  AND NOT ('image/webp' = ANY(allowed_mime_types));

CREATE TABLE IF NOT EXISTS public.imagenes_optimizacion_log (
  id BIGSERIAL PRIMARY KEY,
  modulo TEXT NOT NULL DEFAULT 'general',
  bucket_id TEXT,
  ruta_objeto TEXT,
  nombre_original TEXT,
  formato_original TEXT,
  formato_final TEXT,
  bytes_original BIGINT NOT NULL CHECK (bytes_original >= 0),
  bytes_final BIGINT NOT NULL CHECK (bytes_final >= 0),
  bytes_ahorrados BIGINT NOT NULL DEFAULT 0,
  ancho_original INTEGER,
  alto_original INTEGER,
  ancho_final INTEGER,
  alto_final INTEGER,
  fue_optimizada BOOLEAN NOT NULL DEFAULT true,
  subido_por UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_imagenes_opt_log_created_at
  ON public.imagenes_optimizacion_log (created_at DESC);

ALTER TABLE public.imagenes_optimizacion_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_storage_stats()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT := lower(COALESCE(auth.jwt() ->> 'email', ''));
  v_role TEXT;
  v_custom JSONB;
  v_role_perms JSONB;
BEGIN
  IF v_uid IS NULL THEN RETURN FALSE; END IF;
  IF v_email = 'christopher.snap@gmail.com' THEN RETURN TRUE; END IF;

  SELECT ur.role, COALESCE(ur.custom_permissions, '{}'::jsonb)
  INTO v_role, v_custom
  FROM public.user_roles ur
  WHERE ur.id = v_uid AND COALESCE(ur.activo, true) = true
  LIMIT 1;

  IF v_role IN ('admin', 'superadmin') THEN RETURN TRUE; END IF;
  IF (v_custom ->> 'view_configuracion') = 'true'
     OR (v_custom ->> 'perm_configuracion') = 'true'
     OR (v_custom ->> 'view_accesos') = 'true'
     OR (v_custom ->> 'perm_accesos') = 'true' THEN
    RETURN TRUE;
  END IF;

  IF v_role IS NOT NULL THEN
    SELECT COALESCE(rp.permissions, '{}'::jsonb)
    INTO v_role_perms
    FROM public.role_permissions rp
    WHERE rp.role = v_role LIMIT 1;
    IF (v_role_perms ->> 'view_configuracion') = 'true'
       OR (v_role_perms ->> 'view_accesos') = 'true' THEN
      RETURN TRUE;
    END IF;
  END IF;
  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.can_view_storage_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_storage_stats() TO authenticated;

DROP POLICY IF EXISTS "Permitir registrar metricas de optimizacion" ON public.imagenes_optimizacion_log;
CREATE POLICY "Permitir registrar metricas de optimizacion"
  ON public.imagenes_optimizacion_log FOR INSERT
  WITH CHECK (bytes_original >= 0 AND bytes_final >= 0);

DROP POLICY IF EXISTS "Admins consultan metricas de optimizacion" ON public.imagenes_optimizacion_log;
CREATE POLICY "Admins consultan metricas de optimizacion"
  ON public.imagenes_optimizacion_log FOR SELECT TO authenticated
  USING (public.can_view_storage_stats());

GRANT INSERT ON public.imagenes_optimizacion_log TO anon, authenticated;
GRANT SELECT ON public.imagenes_optimizacion_log TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.imagenes_optimizacion_log_id_seq TO anon, authenticated;

INSERT INTO public.configuracion (clave, valor)
SELECT
  'optimizacion_imagenes_config',
  '{"enabled":true,"preset":"visually_lossless","preferWebp":true,"stripMetadata":true,"carnetQuality":0.94,"carnetMaxDim":1600,"templateQuality":0.95,"templateMaxDim":2600,"bannerQuality":0.90,"bannerMaxDim":2200,"generalQuality":0.90,"generalMaxDim":2000,"logoQuality":0.94,"logoMaxDim":1200}'
WHERE NOT EXISTS (
  SELECT 1 FROM public.configuracion WHERE clave = 'optimizacion_imagenes_config'
);

CREATE OR REPLACE FUNCTION public.get_storage_images_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, auth
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.can_view_storage_stats() THEN
    RAISE EXCEPTION 'Acceso denegado: no cuenta con permisos para consultar estadísticas de almacenamiento.';
  END IF;

  WITH parsed_objects AS (
    SELECT
      o.id,
      o.bucket_id::text AS bucket_id,
      o.name::text AS name,
      COALESCE(
        NULLIF(o.metadata ->> 'mimetype', ''),
        NULLIF(o.metadata ->> 'contentType', ''),
        CASE
          WHEN lower(o.name) ~ '\\.(webp)$' THEN 'image/webp'
          WHEN lower(o.name) ~ '\\.(jpg|jpeg)$' THEN 'image/jpeg'
          WHEN lower(o.name) ~ '\\.(png)$' THEN 'image/png'
          WHEN lower(o.name) ~ '\\.(svg)$' THEN 'image/svg+xml'
          WHEN lower(o.name) ~ '\\.(gif)$' THEN 'image/gif'
          WHEN lower(o.name) ~ '\\.(pdf)$' THEN 'application/pdf'
          ELSE 'application/octet-stream'
        END
      ) AS mimetype,
      COALESCE(
        NULLIF(regexp_replace(COALESCE(o.metadata ->> 'size', '0'), '[^0-9]', '', 'g'), '')::bigint,
        0
      ) AS size_bytes,
      CASE
        WHEN position('/' IN o.name) > 0 THEN split_part(o.name, '/', 1)
        ELSE 'carnets_y_perfiles'
      END AS folder_key,
      o.created_at
    FROM storage.objects o
    WHERE o.name IS NOT NULL
      AND o.name NOT LIKE '%/.emptyFolderPlaceholder'
      AND o.name <> '.emptyFolderPlaceholder'
  ),
  classified AS (
    SELECT
      p.*,
      (
        p.mimetype LIKE 'image/%'
        OR lower(p.name) ~ '\\.(webp|jpg|jpeg|png|svg|gif|avif|bmp|heic|heif)$'
      ) AS is_image,
      CASE
        WHEN p.mimetype = 'image/webp' OR lower(p.name) ~ '\\.webp$' THEN 'WebP'
        WHEN p.mimetype = 'image/jpeg' OR lower(p.name) ~ '\\.(jpg|jpeg)$' THEN 'JPEG'
        WHEN p.mimetype = 'image/png' OR lower(p.name) ~ '\\.png$' THEN 'PNG'
        WHEN p.mimetype = 'image/svg+xml' OR lower(p.name) ~ '\\.svg$' THEN 'SVG'
        WHEN p.mimetype LIKE 'image/%' THEN 'Otros (GIF/HEIC)'
        ELSE 'Otros archivos'
      END AS format_label
    FROM parsed_objects p
  ),
  totals AS (
    SELECT
      COUNT(*) FILTER (WHERE is_image)::bigint AS total_images,
      COALESCE(SUM(size_bytes) FILTER (WHERE is_image), 0)::bigint AS total_image_bytes,
      COUNT(*) FILTER (WHERE NOT is_image)::bigint AS other_files_count,
      COALESCE(SUM(size_bytes) FILTER (WHERE NOT is_image), 0)::bigint AS other_files_bytes,
      COALESCE(AVG(size_bytes) FILTER (WHERE is_image), 0)::bigint AS avg_image_bytes
    FROM classified
  ),
  by_bucket AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'bucket_id', bucket_id,
          'image_count', image_count,
          'image_bytes', image_bytes,
          'other_count', other_count,
          'other_bytes', other_bytes
        ) ORDER BY image_bytes DESC
      ), '[]'::jsonb
    ) AS items
    FROM (
      SELECT
        bucket_id,
        COUNT(*) FILTER (WHERE is_image)::bigint AS image_count,
        COALESCE(SUM(size_bytes) FILTER (WHERE is_image), 0)::bigint AS image_bytes,
        COUNT(*) FILTER (WHERE NOT is_image)::bigint AS other_count,
        COALESCE(SUM(size_bytes) FILTER (WHERE NOT is_image), 0)::bigint AS other_bytes
      FROM classified GROUP BY bucket_id
    ) b
  ),
  by_folder AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object('folder', folder_key, 'image_count', image_count, 'image_bytes', image_bytes)
        ORDER BY image_bytes DESC
      ), '[]'::jsonb
    ) AS items
    FROM (
      SELECT folder_key, COUNT(*)::bigint AS image_count, COALESCE(SUM(size_bytes), 0)::bigint AS image_bytes
      FROM classified WHERE is_image GROUP BY folder_key
    ) f
  ),
  by_format AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object('format', format_label, 'count', cnt, 'bytes', total_b, 'avg_bytes', avg_b)
        ORDER BY total_b DESC
      ), '[]'::jsonb
    ) AS items
    FROM (
      SELECT format_label, COUNT(*)::bigint AS cnt, COALESCE(SUM(size_bytes), 0)::bigint AS total_b, COALESCE(AVG(size_bytes), 0)::bigint AS avg_b
      FROM classified WHERE is_image GROUP BY format_label
    ) fmt
  ),
  largest_imgs AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'bucket_id', bucket_id, 'name', name, 'folder', folder_key,
          'format', format_label, 'mimetype', mimetype, 'size_bytes', size_bytes, 'created_at', created_at
        )
      ), '[]'::jsonb
    ) AS items
    FROM (
      SELECT bucket_id, name, folder_key, format_label, mimetype, size_bytes, created_at
      FROM classified WHERE is_image ORDER BY size_bytes DESC, created_at DESC LIMIT 20
    ) l
  ),
  recent_imgs AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'bucket_id', bucket_id, 'name', name, 'folder', folder_key,
          'format', format_label, 'mimetype', mimetype, 'size_bytes', size_bytes, 'created_at', created_at
        )
      ), '[]'::jsonb
    ) AS items
    FROM (
      SELECT bucket_id, name, folder_key, format_label, mimetype, size_bytes, created_at
      FROM classified WHERE is_image ORDER BY created_at DESC NULLS LAST LIMIT 20
    ) r
  ),
  opt_stats AS (
    SELECT
      COUNT(*)::bigint AS total_processed,
      COUNT(*) FILTER (WHERE fue_optimizada)::bigint AS optimized_count,
      COALESCE(SUM(bytes_original), 0)::bigint AS total_original_bytes,
      COALESCE(SUM(bytes_final), 0)::bigint AS total_final_bytes,
      COALESCE(SUM(bytes_ahorrados), 0)::bigint AS total_saved_bytes
    FROM public.imagenes_optimizacion_log
  )
  SELECT jsonb_build_object(
    'source', 'sql_rpc',
    'total_images', t.total_images,
    'total_image_bytes', t.total_image_bytes,
    'avg_image_bytes', t.avg_image_bytes,
    'other_files_count', t.other_files_count,
    'other_files_bytes', t.other_files_bytes,
    'by_bucket', bb.items,
    'by_folder', bf.items,
    'by_format', bfmt.items,
    'largest_images', li.items,
    'recent_images', ri.items,
    'optimization_log', jsonb_build_object(
      'total_processed', os.total_processed,
      'optimized_count', os.optimized_count,
      'total_original_bytes', os.total_original_bytes,
      'total_final_bytes', os.total_final_bytes,
      'total_saved_bytes', os.total_saved_bytes
    )
  )
  INTO v_result
  FROM totals t
  CROSS JOIN by_bucket bb
  CROSS JOIN by_folder bf
  CROSS JOIN by_format bfmt
  CROSS JOIN largest_imgs li
  CROSS JOIN recent_imgs ri
  CROSS JOIN opt_stats os;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_storage_images_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_storage_images_stats() TO authenticated;

NOTIFY pgrst, 'reload schema';`;
