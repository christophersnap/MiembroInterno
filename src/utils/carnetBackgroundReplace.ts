import { createImage } from './cropImage';

export type BackgroundPreset = '#FFFFFF' | '#F1F5F9' | '#E0F2FE' | 'transparent';

export interface BackgroundReplaceOptions {
  backgroundColor: BackgroundPreset;
  /** Sensibilidad del recorte (0.25 a 0.80, por defecto 0.50) */
  threshold?: number;
  /** Suavizado de bordes en píxeles (0 a 3, por defecto 1.5) */
  feather?: number;
}

export interface BackgroundReplaceResult {
  dataUrl: string;
  engine: 'mediapipe' | 'canvas';
  width: number;
  height: number;
}

interface CachedMatte {
  sourceKey: string;
  width: number;
  height: number;
  /** Imagen original rasterizada al tamaño de trabajo */
  sourceRgba: Uint8ClampedArray;
  /** Probabilidad cruda de primer plano (persona) en rango [0, 1] por píxel */
  foregroundProb: Float32Array;
  engine: 'mediapipe' | 'canvas';
}

let segmenterPromise: Promise<any | null> | null = null;
let cachedMatte: CachedMatte | null = null;

/**
 * Inicializa MediaPipe ImageSegmenter (modelo local selfie_segmenter en WebAssembly, ~250KB,
 * 100% ejecutado en el navegador del usuario, CERO tokens de IA).
 */
async function getMediaPipeSegmenter(): Promise<any | null> {
  if (segmenterPromise) return segmenterPromise;

  segmenterPromise = (async () => {
    try {
      const vision = await import('@mediapipe/tasks-vision');
      const { FilesetResolver, ImageSegmenter } = vision;
      const wasmBaseUrl = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm';
      const filesetResolver = await FilesetResolver.forVisionTasks(wasmBaseUrl);

      const segmenter = await ImageSegmenter.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
          delegate: 'CPU',
        },
        runningMode: 'IMAGE',
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      });

      return segmenter;
    } catch (err) {
      console.warn('MediaPipe WASM no disponible, usando motor local Canvas LAB:', err);
      segmenterPromise = null;
      return null;
    }
  })();

  return segmenterPromise;
}

function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  let rn = r / 255;
  let gn = g / 255;
  let bn = b / 255;
  rn = rn > 0.04045 ? Math.pow((rn + 0.055) / 1.055, 2.4) : rn / 12.92;
  gn = gn > 0.04045 ? Math.pow((gn + 0.055) / 1.055, 2.4) : gn / 12.92;
  bn = bn > 0.04045 ? Math.pow((bn + 0.055) / 1.055, 2.4) : bn / 12.92;

  const x = (rn * 0.4124 + gn * 0.3576 + bn * 0.1805) / 0.95047;
  const y = (rn * 0.2126 + gn * 0.7152 + bn * 0.0722) / 1.0;
  const z = (rn * 0.0193 + gn * 0.1192 + bn * 0.9505) / 1.08883;

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/**
 * Respaldo 100% local en Canvas (sin red externa ni tokens):
 * Segmenta el fondo usando muestras LAB del perímetro + conectividad BFS desde los bordes
 * y un prior espacial de busto/cabeza para proteger siempre el rostro y los hombros.
 */
function computeCanvasFallbackForegroundProb(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): Float32Array {
  const total = width * height;
  const labL = new Float32Array(total);
  const labA = new Float32Array(total);
  const labB = new Float32Array(total);

  for (let p = 0, i = 0; p < total; p++, i += 4) {
    const [L, a, b] = rgbToLab(rgba[i], rgba[i + 1], rgba[i + 2]);
    labL[p] = L;
    labA[p] = a;
    labB[p] = b;
  }

  // Muestrear colores de fondo desde borde superior y bordes laterales superiores (hasta 68% altura)
  const bgSamples: [number, number, number][] = [];
  const stepX = Math.max(1, Math.floor(width / 36));
  const stepY = Math.max(1, Math.floor(height / 36));

  for (let x = 0; x < width; x += stepX) {
    for (let y = 0; y < Math.min(8, height); y += 2) {
      const p = y * width + x;
      bgSamples.push([labL[p], labA[p], labB[p]]);
    }
  }
  for (let y = 0; y < Math.floor(height * 0.7); y += stepY) {
    for (let x = 0; x < Math.min(8, width); x += 2) {
      const p1 = y * width + x;
      const p2 = y * width + (width - 1 - x);
      bgSamples.push([labL[p1], labA[p1], labB[p1]]);
      bgSamples.push([labL[p2], labA[p2], labB[p2]]);
    }
  }

  // Reducir a ~18 prototipos representativos para distancia LAB rápida
  const stride = Math.max(1, Math.floor(bgSamples.length / 20));
  const prototypes: [number, number, number][] = [];
  for (let i = 0; i < bgSamples.length; i += stride) {
    prototypes.push(bgSamples[i]);
  }

  const distToBg = new Float32Array(total);
  for (let p = 0; p < total; p++) {
    let minD = 9999;
    const L = labL[p];
    const a = labA[p];
    const b = labB[p];
    for (let k = 0; k < prototypes.length; k++) {
      const dL = L - prototypes[k][0];
      const da = a - prototypes[k][1];
      const db = b - prototypes[k][2];
      const d = Math.sqrt(dL * dL * 0.75 + da * da + db * db);
      if (d < minD) minD = d;
    }
    distToBg[p] = minD;
  }

  // Flood-fill (BFS) desde bordes superior y laterales para marcar fondo conectado
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let qHead = 0;
  let qTail = 0;

  const isInsideProtectedCore = (x: number, y: number): boolean => {
    const nx = x / width;
    const ny = y / height;
    // Óvalo facial central protegido
    const fx = (nx - 0.5) / 0.17;
    const fy = (ny - 0.42) / 0.21;
    if (fx * fx + fy * fy <= 1) return true;
    // Centro de torso/hombros protegido
    if (ny > 0.68 && nx > 0.28 && nx < 0.72) return true;
    return false;
  };

  const trySeed = (x: number, y: number) => {
    const p = y * width + x;
    if (visited[p]) return;
    if (distToBg[p] < 24 && !isInsideProtectedCore(x, y)) {
      visited[p] = 1;
      queue[qTail++] = p;
    }
  };

  for (let x = 0; x < width; x++) {
    trySeed(x, 0);
    trySeed(x, 1);
  }
  for (let y = 0; y < Math.floor(height * 0.85); y++) {
    trySeed(0, y);
    trySeed(width - 1, y);
  }

  const neighbors = [-1, 1, -width, width];
  while (qHead < qTail) {
    const curr = queue[qHead++];
    const cx = curr % width;
    const cy = (curr - cx) / width;

    for (let n = 0; n < 4; n++) {
      const next = curr + neighbors[n];
      if (next < 0 || next >= total || visited[next]) continue;
      const nx = next % width;
      const ny = (next - nx) / width;
      if (Math.abs(nx - cx) + Math.abs(ny - cy) !== 1) continue;
      if (isInsideProtectedCore(nx, ny)) continue;

      const stepDiff = Math.hypot(
        labL[next] - labL[curr],
        labA[next] - labA[curr],
        labB[next] - labB[curr]
      );
      if (distToBg[next] < 28 || (distToBg[next] < 38 && stepDiff < 9)) {
        visited[next] = 1;
        queue[qTail++] = next;
      }
    }
  }

  const fgProb = new Float32Array(total);
  for (let p = 0; p < total; p++) {
    if (visited[p]) {
      // Fondo conectado: probabilidad baja suavizada por distancia LAB
      fgProb[p] = Math.max(0, Math.min(0.45, (distToBg[p] - 10) / 40));
    } else {
      // Primer plano (persona)
      fgProb[p] = Math.max(0.55, Math.min(1, 0.55 + distToBg[p] / 35));
    }
  }

  return fgProb;
}

function boxBlurFloat(src: Float32Array, width: number, height: number, radius: number): Float32Array {
  if (radius <= 0) return src;
  const r = Math.max(1, Math.round(radius));
  const tmp = new Float32Array(src.length);
  const dst = new Float32Array(src.length);
  const windowSize = r * 2 + 1;

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let sum = 0;
    for (let dx = -r; dx <= r; dx++) {
      const x = Math.max(0, Math.min(width - 1, dx));
      sum += src[row + x];
    }
    for (let x = 0; x < width; x++) {
      tmp[row + x] = sum / windowSize;
      const outX = Math.max(0, Math.min(width - 1, x - r));
      const inX = Math.max(0, Math.min(width - 1, x + r + 1));
      sum += src[row + inX] - src[row + outX];
    }
  }

  // Vertical pass
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let dy = -r; dy <= r; dy++) {
      const y = Math.max(0, Math.min(height - 1, dy));
      sum += tmp[y * width + x];
    }
    for (let y = 0; y < height; y++) {
      dst[y * width + x] = sum / windowSize;
      const outY = Math.max(0, Math.min(height - 1, y - r));
      const inY = Math.max(0, Math.min(height - 1, y + r + 1));
      sum += tmp[inY * width + x] - tmp[outY * width + x];
    }
  }

  return dst;
}

function parseHexColor(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) || 255;
  const g = parseInt(clean.slice(2, 4), 16) || 255;
  const b = parseInt(clean.slice(4, 6), 16) || 255;
  return [r, g, b];
}

async function computeOrGetMatte(imageSrc: string): Promise<CachedMatte> {
  const sourceKey = `${imageSrc.length}:${imageSrc.slice(0, 64)}:${imageSrc.slice(-48)}`;
  if (cachedMatte && cachedMatte.sourceKey === sourceKey) {
    return cachedMatte;
  }

  const img = await createImage(imageSrc);
  const natW = img.naturalWidth || img.width;
  const natH = img.naturalHeight || img.height;
  const maxDim = 960;
  const scale = Math.min(1, maxDim / Math.max(natW, natH, 1));
  const width = Math.max(64, Math.round(natW * scale));
  const height = Math.max(64, Math.round(natH * scale));

  const workCanvas = document.createElement('canvas');
  workCanvas.width = width;
  workCanvas.height = height;
  const workCtx = workCanvas.getContext('2d', { willReadFrequently: true });
  if (!workCtx) throw new Error('No se pudo crear contexto de imagen.');
  workCtx.drawImage(img, 0, 0, width, height);
  const sourceRgba = new Uint8ClampedArray(workCtx.getImageData(0, 0, width, height).data);

  let foregroundProb: Float32Array | null = null;
  let engine: 'mediapipe' | 'canvas' = 'canvas';

  const segmenter = await getMediaPipeSegmenter();
  if (segmenter) {
    try {
      const result = segmenter.segment(workCanvas);
      const masks = result?.confidenceMasks;
      if (masks && masks.length > 0) {
        // En selfie_segmenter: si hay 2 máscaras [bg, person] usamos índice 1; si hay 1 máscara es confianza de persona
        const personMask = masks.length > 1 ? masks[1] : masks[0];
        const maskFloat = personMask.getAsFloat32Array();
        const mw = personMask.width || width;
        const mh = personMask.height || height;

        if (mw === width && mh === height && maskFloat.length === width * height) {
          foregroundProb = new Float32Array(maskFloat);
        } else {
          // Escalar bilinealmente la máscara al tamaño de trabajo
          foregroundProb = new Float32Array(width * height);
          for (let y = 0; y < height; y++) {
            const sy = (y / height) * (mh - 1);
            const y0 = Math.floor(sy);
            const y1 = Math.min(mh - 1, y0 + 1);
            const wy = sy - y0;
            for (let x = 0; x < width; x++) {
              const sx = (x / width) * (mw - 1);
              const x0 = Math.floor(sx);
              const x1 = Math.min(mw - 1, x0 + 1);
              const wx = sx - x0;
              const v00 = maskFloat[y0 * mw + x0] ?? 0;
              const v10 = maskFloat[y0 * mw + x1] ?? 0;
              const v01 = maskFloat[y1 * mw + x0] ?? 0;
              const v11 = maskFloat[y1 * mw + x1] ?? 0;
              const top = v00 + (v10 - v00) * wx;
              const bot = v01 + (v11 - v01) * wx;
              foregroundProb[y * width + x] = top + (bot - top) * wy;
            }
          }
        }
        engine = 'mediapipe';
      }
      if (typeof result?.close === 'function') {
        result.close();
      }
    } catch (err) {
      console.warn('Error ejecutando MediaPipe segmenter, usando fallback Canvas:', err);
      foregroundProb = null;
    }
  }

  if (!foregroundProb) {
    foregroundProb = computeCanvasFallbackForegroundProb(sourceRgba, width, height);
    engine = 'canvas';
  }

  cachedMatte = {
    sourceKey,
    width,
    height,
    sourceRgba,
    foregroundProb,
    engine,
  };

  return cachedMatte;
}

/**
 * Recorta a la persona y reemplaza el fondo 100% en el navegador sin usar tokens de IA.
 */
export async function replaceCarnetPhotoBackground(
  imageSrc: string,
  options: BackgroundReplaceOptions
): Promise<BackgroundReplaceResult> {
  const { backgroundColor, threshold = 0.5, feather = 1.5 } = options;
  const matte = await computeOrGetMatte(imageSrc);
  const { width, height, sourceRgba, foregroundProb, engine } = matte;

  // Mapear confianza [0..1] a alfa nítido con banda suave centrada en threshold
  const total = width * height;
  const rawAlpha = new Float32Array(total);
  const band = 0.16;
  const lo = Math.max(0.02, threshold - band);
  const hi = Math.min(0.98, threshold + band);
  const invSpan = 1 / Math.max(0.01, hi - lo);

  for (let p = 0; p < total; p++) {
    const v = foregroundProb[p];
    if (v <= lo) rawAlpha[p] = 0;
    else if (v >= hi) rawAlpha[p] = 1;
    else {
      const t = (v - lo) * invSpan;
      // Smoothstep para bordes naturales en cabello y hombros
      rawAlpha[p] = t * t * (3 - 2 * t);
    }
  }

  const softAlpha = feather > 0.2 ? boxBlurFloat(rawAlpha, width, height, feather) : rawAlpha;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = width;
  outCanvas.height = height;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) throw new Error('No se pudo generar el resultado del recorte.');

  const outData = outCtx.createImageData(width, height);
  const dst = outData.data;

  const isTransparent = backgroundColor === 'transparent';
  const [bgR, bgG, bgB] = isTransparent ? [255, 255, 255] : parseHexColor(backgroundColor);

  for (let p = 0, i = 0; p < total; p++, i += 4) {
    const a = Math.max(0, Math.min(1, softAlpha[p]));
    const r = sourceRgba[i];
    const g = sourceRgba[i + 1];
    const b = sourceRgba[i + 2];

    if (isTransparent) {
      dst[i] = r;
      dst[i + 1] = g;
      dst[i + 2] = b;
      dst[i + 3] = Math.round(a * 255);
    } else {
      dst[i] = Math.round(r * a + bgR * (1 - a));
      dst[i + 1] = Math.round(g * a + bgG * (1 - a));
      dst[i + 2] = Math.round(b * a + bgB * (1 - a));
      dst[i + 3] = 255;
    }
  }

  outCtx.putImageData(outData, 0, 0);

  const dataUrl = isTransparent
    ? outCanvas.toDataURL('image/png')
    : outCanvas.toDataURL('image/jpeg', 0.93);

  return {
    dataUrl,
    engine,
    width,
    height,
  };
}
