import { supabase } from '../lib/supabase';
import { createImage } from './cropImage';

export type PhotoCheckStatus = 'pass' | 'warn' | 'fail';

export interface CarnetPhotoCheck {
  id: 'resolution' | 'background' | 'lighting' | 'framing' | 'face_clear' | 'attire';
  label: string;
  status: PhotoCheckStatus;
  message: string;
}

export interface CarnetPhotoAnalysis {
  status: 'aceptable' | 'observaciones' | 'no_recomendable';
  score: number;
  summary: string;
  checks: CarnetPhotoCheck[];
  suggestBackgroundReplace: boolean;
  dimensions: { width: number; height: number };
}

function normalizeUrlCandidate(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
  if (trimmed.startsWith('blob:') && typeof window !== 'undefined' && !trimmed.startsWith(`blob:${window.location.origin}`)) {
    return null;
  }
  const driveFileMatch = /drive\.google\.com\/file\/d\/([^/?#]+)/i.exec(trimmed);
  if (driveFileMatch?.[1]) {
    return `https://lh3.googleusercontent.com/d/${driveFileMatch[1]}=w900`;
  }
  const driveOpenMatch = /drive\.google\.com\/(?:open|uc)\?[^#]*id=([^&#]+)/i.exec(trimmed);
  if (driveOpenMatch?.[1]) {
    return `https://lh3.googleusercontent.com/d/${driveOpenMatch[1]}=w900`;
  }
  if (
    !trimmed.startsWith('http://') &&
    !trimmed.startsWith('https://') &&
    !trimmed.startsWith('data:') &&
    !trimmed.startsWith('blob:') &&
    !trimmed.startsWith('/')
  ) {
    const cleanPath = trimmed.replace(/^socorristas\//, '');
    const { data } = supabase.storage.from('socorristas').getPublicUrl(cleanPath);
    return data?.publicUrl || trimmed;
  }
  return trimmed;
}

function parseSupabaseStoragePath(url: string): { bucket: string; objectPath: string } | null {
  const match = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/?#]+)\/([^?#]+)/i.exec(url);
  if (!match) return null;
  try {
    return { bucket: decodeURIComponent(match[1]), objectPath: decodeURIComponent(match[2]) };
  } catch {
    return { bucket: match[1], objectPath: match[2] };
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Carga una URL remota, ruta de Supabase Storage o dataURL como dataURL local seguro para Canvas
 * (evita errores CORS / tainted canvas al recortar, analizar o reemplazar fondo).
 */
export async function loadImageSafelyAsDataUrl(
  src?: string | null,
  fallbackSrc?: string | null
): Promise<string | null> {
  const candidates = [normalizeUrlCandidate(src), normalizeUrlCandidate(fallbackSrc)].filter(
    (u, idx, arr): u is string => Boolean(u) && arr.indexOf(u) === idx
  );

  for (const url of candidates) {
    if (url.startsWith('data:image/')) {
      return url;
    }

    // 1. Si es de Supabase Storage, intentar descarga directa autenticada (evita problemas de CORS o buckets privados)
    const parsed = parseSupabaseStoragePath(url);
    if (parsed) {
      try {
        const { data: blob } = await supabase.storage.from(parsed.bucket).download(parsed.objectPath);
        if (blob && blob.size > 120) {
          return await blobToDataUrl(blob);
        }
      } catch {
        // continuar con fetch / signedUrl
      }
    }

    // 2. Intentar fetch con CORS
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (res.ok) {
        const blob = await res.blob();
        if (blob && blob.size > 120) {
          return await blobToDataUrl(blob);
        }
      }
    } catch {
      // continuar con fallback
    }

    // 3. Si es Supabase Storage, intentar signedUrl + fetch
    if (parsed) {
      try {
        const { data: signed } = await supabase.storage.from(parsed.bucket).createSignedUrl(parsed.objectPath, 300);
        if (signed?.signedUrl) {
          const res = await fetch(signed.signedUrl, { mode: 'cors' });
          if (res.ok) {
            const blob = await res.blob();
            if (blob && blob.size > 120) {
              return await blobToDataUrl(blob);
            }
          }
        }
      } catch {
        // continuar
      }
    }

    // 4. Último recurso: cargar como <img> con crossOrigin anonymous y volcar a canvas
    try {
      const img = await createImage(url);
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          return c.toDataURL('image/jpeg', 0.92);
        }
      }
    } catch {
      // probar siguiente candidato
    }
  }

  return null;
}

function rgbToLuma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function isSkinToneRgb(r: number, g: number, b: number): boolean {
  // Detector de tono de piel amplio en espacio YCbCr (inclusivo con todos los tonos de piel)
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return y > 45 && y < 245 && cb >= 76 && cb <= 130 && cr >= 132 && cr <= 178 && r > b;
}

function rgbSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

interface DetectedFaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function tryNativeFaceDetection(canvas: HTMLCanvasElement): Promise<DetectedFaceBox[] | null> {
  try {
    const FaceDetectorCtor = (window as any).FaceDetector;
    if (typeof FaceDetectorCtor !== 'function') return null;
    const detector = new FaceDetectorCtor({ fastMode: true, maxDetectedFaces: 3 });
    const faces = await detector.detect(canvas);
    if (!Array.isArray(faces)) return null;
    return faces
      .filter((f: any) => f?.boundingBox)
      .map((f: any) => ({
        x: f.boundingBox.x,
        y: f.boundingBox.y,
        width: f.boundingBox.width,
        height: f.boundingBox.height,
      }));
  } catch {
    return null;
  }
}

/**
 * Análisis 100% local en navegador (sin tokens de IA) basado en los lineamientos oficiales
 * de fotografía para carnet de Cruz Verde Salvadoreña.
 */
export async function analyzeCarnetPhoto(
  imageSrc: string,
  cropPixels?: { x: number; y: number; width: number; height: number } | null
): Promise<CarnetPhotoAnalysis> {
  const img = await createImage(imageSrc);
  const natW = img.naturalWidth || img.width;
  const natH = img.naturalHeight || img.height;

  const srcX = cropPixels ? Math.max(0, Math.round(cropPixels.x)) : 0;
  const srcY = cropPixels ? Math.max(0, Math.round(cropPixels.y)) : 0;
  const srcW = cropPixels ? Math.min(natW - srcX, Math.max(1, Math.round(cropPixels.width))) : natW;
  const srcH = cropPixels ? Math.min(natH - srcY, Math.max(1, Math.round(cropPixels.height))) : natH;

  // Normalizar a un canvas de análisis de 240px de lado mayor para rapidez (<30ms) y consistencia
  const targetMax = 240;
  const scale = Math.min(1, targetMax / Math.max(srcW, srcH, 1));
  const w = Math.max(64, Math.round(srcW * scale));
  const h = Math.max(64, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('No se pudo inicializar el analizador local de imagen.');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Mapear luminancia rápida
  const luma = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    luma[p] = rgbToLuma(data[i], data[i + 1], data[i + 2]);
  }

  // ---------------------------------------------------------------------------
  // 1. RESOLUCIÓN Y NITIDEZ (Varianza Laplaciana en zona central del retrato)
  // ---------------------------------------------------------------------------
  const minDim = Math.min(srcW, srcH);
  let lapSum = 0;
  let lapSqSum = 0;
  let lapCount = 0;
  const x0 = Math.floor(w * 0.22);
  const x1 = Math.floor(w * 0.78);
  const y0 = Math.floor(h * 0.14);
  const y1 = Math.floor(h * 0.74);

  for (let y = Math.max(1, y0); y < Math.min(h - 1, y1); y++) {
    for (let x = Math.max(1, x0); x < Math.min(w - 1, x1); x++) {
      const idx = y * w + x;
      const lap =
        4 * luma[idx] -
        luma[idx - 1] -
        luma[idx + 1] -
        luma[idx - w] -
        luma[idx + w];
      lapSum += lap;
      lapSqSum += lap * lap;
      lapCount++;
    }
  }
  const lapMean = lapCount > 0 ? lapSum / lapCount : 0;
  const lapVar = lapCount > 0 ? lapSqSum / lapCount - lapMean * lapMean : 0;

  let resolutionCheck: CarnetPhotoCheck;
  if (minDim < 220) {
    resolutionCheck = {
      id: 'resolution',
      label: 'Resolución y nitidez',
      status: 'fail',
      message: `Resolución muy baja (${srcW}×${srcH}px). Usa una foto de al menos 350×350px.`,
    };
  } else if (lapVar < 55) {
    resolutionCheck = {
      id: 'resolution',
      label: 'Resolución y nitidez',
      status: 'fail',
      message: 'La imagen se percibe borrosa o desenfocada. Toma la foto con mejor enfoque.',
    };
  } else if (minDim < 360 || lapVar < 120) {
    resolutionCheck = {
      id: 'resolution',
      label: 'Resolución y nitidez',
      status: 'warn',
      message: `Nitidez justa (${srcW}×${srcH}px). Se recomienda mayor enfoque o menos zoom.`,
    };
  } else {
    resolutionCheck = {
      id: 'resolution',
      label: 'Resolución y nitidez',
      status: 'pass',
      message: `Buena nitidez y tamaño adecuado (${srcW}×${srcH}px).`,
    };
  }

  // ---------------------------------------------------------------------------
  // 2. FONDO LISO Y UNIFORME (Muestreo de esquinas superiores y bordes laterales)
  // ---------------------------------------------------------------------------
  let bgR = 0;
  let bgG = 0;
  let bgB = 0;
  let bgLumaSum = 0;
  let bgLumaSq = 0;
  let bgSatSum = 0;
  let bgEdgeCount = 0;
  let bgCount = 0;
  let bgTransparentCount = 0;

  const isBackgroundSamplePixel = (x: number, y: number): boolean => {
    const nx = x / w;
    const ny = y / h;
    // Franja superior (excepto tope muy pegado al pelo si está arriba) y esquinas superiores izquierda/derecha
    const inTopStrip = ny < 0.14 && (nx < 0.28 || nx > 0.72);
    const inUpperCorners = ny < 0.45 && (nx < 0.14 || nx > 0.86);
    const inMidSides = ny >= 0.45 && ny < 0.68 && (nx < 0.08 || nx > 0.92);
    return inTopStrip || inUpperCorners || inMidSides;
  };

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (!isBackgroundSamplePixel(x, y)) continue;
      const idx = y * w + x;
      const off = idx * 4;
      const a = data[off + 3];
      if (a < 200) {
        bgTransparentCount++;
        bgCount++;
        continue;
      }
      const r = data[off];
      const g = data[off + 1];
      const b = data[off + 2];
      const lum = luma[idx];
      bgR += r;
      bgG += g;
      bgB += b;
      bgLumaSum += lum;
      bgLumaSq += lum * lum;
      bgSatSum += rgbSaturation(r, g, b);
      const grad = Math.abs(luma[idx] - luma[idx - 1]) + Math.abs(luma[idx] - luma[idx - w]);
      if (grad > 18) bgEdgeCount++;
      bgCount++;
    }
  }

  const opaqueBgCount = Math.max(1, bgCount - bgTransparentCount);
  const bgMeanLuma = bgLumaSum / opaqueBgCount;
  const bgStdLuma = Math.sqrt(Math.max(0, bgLumaSq / opaqueBgCount - bgMeanLuma * bgMeanLuma));
  const bgMeanSat = bgSatSum / opaqueBgCount;
  const bgEdgeRatio = bgEdgeCount / opaqueBgCount;
  const isMostlyTransparentBg = bgCount > 0 && bgTransparentCount / bgCount > 0.65;

  let backgroundCheck: CarnetPhotoCheck;
  let suggestBackgroundReplace = false;

  if (isMostlyTransparentBg) {
    backgroundCheck = {
      id: 'background',
      label: 'Fondo liso uniforme',
      status: 'pass',
      message: 'Fondo recortado limpio (transparente), listo para carnet.',
    };
  } else if (bgStdLuma > 34 || bgEdgeRatio > 0.22) {
    suggestBackgroundReplace = true;
    backgroundCheck = {
      id: 'background',
      label: 'Fondo liso uniforme',
      status: 'fail',
      message: 'Se detectan objetos, textura o variación fuerte en el fondo. Usa "Reemplazar fondo" abajo.',
    };
  } else if (bgMeanLuma < 145 || bgMeanSat > 0.24 || bgStdLuma > 22) {
    suggestBackgroundReplace = true;
    backgroundCheck = {
      id: 'background',
      label: 'Fondo liso uniforme',
      status: 'warn',
      message: 'El fondo es oscuro, con color marcado o ligeramente irregular. Puedes cambiarlo a blanco aquí.',
    };
  } else {
    backgroundCheck = {
      id: 'background',
      label: 'Fondo liso uniforme',
      status: 'pass',
      message: 'Fondo claro y uniforme, conforme a los lineamientos.',
    };
  }

  // ---------------------------------------------------------------------------
  // 3. ILUMINACIÓN Y SOMBRAS + 4. ENCUADRE + 5. ROSTRO DESPEJADO (CABELLO/LENTES)
  // ---------------------------------------------------------------------------
  const nativeFaces = await tryNativeFaceDetection(canvas);

  // Definir óvalo esperado del rostro (cx=0.5, cy=0.40, rx=0.22, ry=0.27) o caja detectada
  let faceCx = w * 0.5;
  let faceCy = h * 0.4;
  let faceRx = w * 0.22;
  let faceRy = h * 0.26;

  if (nativeFaces && nativeFaces.length === 1) {
    const f = nativeFaces[0];
    faceCx = f.x + f.width / 2;
    faceCy = f.y + f.height / 2;
    faceRx = Math.max(w * 0.14, f.width * 0.45);
    faceRy = Math.max(h * 0.16, f.height * 0.48);
  }

  let faceLumaSum = 0;
  let faceCount = 0;
  let leftLumaSum = 0;
  let leftCount = 0;
  let rightLumaSum = 0;
  let rightCount = 0;
  let faceOverexposed = 0;
  let faceUnderexposed = 0;
  let skinCount = 0;
  let skinXSum = 0;
  let skinYSum = 0;

  // Banda de ojos/frente (zona superior-media del óvalo facial) para detectar cabello o lentes oscuros tapando rostro
  let eyeBandTotal = 0;
  let eyeBandVeryDark = 0;
  let eyeBandSkin = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - faceCx) / faceRx;
      const dy = (y - faceCy) / faceRy;
      const inOval = dx * dx + dy * dy <= 1.0;

      const idx = y * w + x;
      const off = idx * 4;
      const r = data[off];
      const g = data[off + 1];
      const b = data[off + 2];
      const lum = luma[idx];
      const isSkin = isSkinToneRgb(r, g, b);

      // Acumular centroide de piel en el área superior/media para estimar centrado incluso sin FaceDetector
      if (isSkin && y > h * 0.1 && y < h * 0.74 && x > w * 0.12 && x < w * 0.88) {
        skinXSum += x;
        skinYSum += y;
        skinCount++;
      }

      if (inOval) {
        faceLumaSum += lum;
        faceCount++;
        if (lum > 244) faceOverexposed++;
        if (lum < 48) faceUnderexposed++;

        if (x < faceCx) {
          leftLumaSum += lum;
          leftCount++;
        } else {
          rightLumaSum += lum;
          rightCount++;
        }

        // Banda de ojos y frente baja: dy entre -0.52 y 0.08
        if (dy >= -0.52 && dy <= 0.08 && Math.abs(dx) <= 0.82) {
          eyeBandTotal++;
          if (lum < 42) eyeBandVeryDark++;
          if (isSkin) eyeBandSkin++;
        }
      }
    }
  }

  const faceMeanLuma = faceCount > 0 ? faceLumaSum / faceCount : 128;
  const leftMean = leftCount > 0 ? leftLumaSum / leftCount : faceMeanLuma;
  const rightMean = rightCount > 0 ? rightLumaSum / rightCount : faceMeanLuma;
  const sideShadowDiff = Math.abs(leftMean - rightMean);
  const overRatio = faceCount > 0 ? faceOverexposed / faceCount : 0;
  const underRatio = faceCount > 0 ? faceUnderexposed / faceCount : 0;

  let lightingCheck: CarnetPhotoCheck;
  if (faceMeanLuma < 68 || underRatio > 0.45) {
    lightingCheck = {
      id: 'lighting',
      label: 'Iluminación uniforme',
      status: 'fail',
      message: 'El rostro está demasiado oscuro o a contraluz. Busca luz frontal pareja.',
    };
  } else if (faceMeanLuma > 228 || overRatio > 0.35) {
    lightingCheck = {
      id: 'lighting',
      label: 'Iluminación uniforme',
      status: 'warn',
      message: 'Iluminación muy intensa o sobreexpuesta en el rostro.',
    };
  } else if (sideShadowDiff > 32) {
    lightingCheck = {
      id: 'lighting',
      label: 'Iluminación uniforme',
      status: 'warn',
      message: 'Se detecta sombra lateral marcada en un lado del rostro.',
    };
  } else {
    lightingCheck = {
      id: 'lighting',
      label: 'Iluminación uniforme',
      status: 'pass',
      message: 'Iluminación equilibrada sin sombras fuertes.',
    };
  }

  // 4. ENCUADRE Y CENTRADO
  const skinRatio = skinCount / Math.max(1, w * h * 0.48);
  let framingCheck: CarnetPhotoCheck;

  if (nativeFaces && nativeFaces.length > 1) {
    framingCheck = {
      id: 'framing',
      label: 'Encuadre y centrado',
      status: 'fail',
      message: `Se detectaron ${nativeFaces.length} rostros. La foto de carnet debe ser individual.`,
    };
  } else if (nativeFaces && nativeFaces.length === 1) {
    const f = nativeFaces[0];
    const centerOffsetX = Math.abs((f.x + f.width / 2) / w - 0.5);
    const faceWidthRatio = f.width / w;
    const topMargin = f.y / h;
    if (centerOffsetX > 0.16) {
      framingCheck = {
        id: 'framing',
        label: 'Encuadre y centrado',
        status: 'warn',
        message: 'El rostro está descentrado. Arrastra la imagen para alinearlo al centro.',
      };
    } else if (faceWidthRatio < 0.22) {
      framingCheck = {
        id: 'framing',
        label: 'Encuadre y centrado',
        status: 'warn',
        message: 'La persona se ve muy lejos. Acerca con el control de zoom.',
      };
    } else if (faceWidthRatio > 0.72 || topMargin < 0.04) {
      framingCheck = {
        id: 'framing',
        label: 'Encuadre y centrado',
        status: 'warn',
        message: 'Encuadre muy cerrado; deja un poco de margen superior sobre la cabeza.',
      };
    } else {
      framingCheck = {
        id: 'framing',
        label: 'Encuadre y centrado',
        status: 'pass',
        message: 'Rostro individual bien centrado y proporcionado.',
      };
    }
  } else {
    // Heurística universal (cuando FaceDetector no está disponible en el navegador)
    if (skinCount < w * h * 0.03) {
      framingCheck = {
        id: 'framing',
        label: 'Encuadre y centrado',
        status: 'warn',
        message: 'No se distingue con claridad un rostro centrado. Ajusta el recorte y acercamiento.',
      };
    } else {
      const avgSkinX = skinXSum / skinCount / w;
      const avgSkinY = skinYSum / skinCount / h;
      if (Math.abs(avgSkinX - 0.5) > 0.15) {
        framingCheck = {
          id: 'framing',
          label: 'Encuadre y centrado',
          status: 'warn',
          message: 'El rostro aparece ligeramente desplazado. Céntralo dentro del círculo guía.',
        };
      } else if (avgSkinY < 0.2 || avgSkinY > 0.62) {
        framingCheck = {
          id: 'framing',
          label: 'Encuadre y centrado',
          status: 'warn',
          message: 'Ajusta la altura vertical para dejar espacio arriba y mostrar hombros.',
        };
      } else {
        framingCheck = {
          id: 'framing',
          label: 'Encuadre y centrado',
          status: 'pass',
          message: 'Encuadre frontal equilibrado dentro del área de carnet.',
        };
      }
    }
  }

  // 5. ROSTRO DESPEJADO (CABELLO Y ACCESORIOS)
  const eyeDarkRatio = eyeBandTotal > 0 ? eyeBandVeryDark / eyeBandTotal : 0;
  const eyeSkinRatio = eyeBandTotal > 0 ? eyeBandSkin / eyeBandTotal : 0;

  let faceClearCheck: CarnetPhotoCheck;
  if (eyeDarkRatio > 0.42 || (eyeDarkRatio > 0.28 && eyeSkinRatio < 0.2)) {
    faceClearCheck = {
      id: 'face_clear',
      label: 'Rostro despejado (cabello / lentes)',
      status: 'fail',
      message: 'Posible obstrucción en ojos o frente (cabello cubriendo el rostro, gorra o lentes oscuros).',
    };
  } else if (eyeDarkRatio > 0.22 || skinRatio < 0.08) {
    faceClearCheck = {
      id: 'face_clear',
      label: 'Rostro despejado (cabello / lentes)',
      status: 'warn',
      message: 'Verifica que el cabello esté peinado hacia atrás y no tape ojos ni rostro, sin accesorios.',
    };
  } else {
    faceClearCheck = {
      id: 'face_clear',
      label: 'Rostro despejado (cabello / lentes)',
      status: 'pass',
      message: 'Zona facial y ojos despejados, sin obstrucciones visibles.',
    };
  }

  // 6. VESTIMENTA CLARA (CAMISA BLANCA FORMAL — verificación orientativa)
  let attireLumaSum = 0;
  let attireSatSum = 0;
  let attireCount = 0;
  for (let y = Math.floor(h * 0.76); y < Math.floor(h * 0.96); y++) {
    for (let x = Math.floor(w * 0.24); x < Math.floor(w * 0.76); x++) {
      const idx = y * w + x;
      const off = idx * 4;
      if (data[off + 3] < 200) continue;
      attireLumaSum += luma[idx];
      attireSatSum += rgbSaturation(data[off], data[off + 1], data[off + 2]);
      attireCount++;
    }
  }
  const attireMeanLuma = attireCount > 0 ? attireLumaSum / attireCount : 180;
  const attireMeanSat = attireCount > 0 ? attireSatSum / attireCount : 0.1;

  let attireCheck: CarnetPhotoCheck;
  if (attireMeanLuma >= 155 && attireMeanSat <= 0.24) {
    attireCheck = {
      id: 'attire',
      label: 'Vestimenta (camisa blanca)',
      status: 'pass',
      message: 'Tono claro compatible con camisa blanca formal.',
    };
  } else {
    attireCheck = {
      id: 'attire',
      label: 'Vestimenta (camisa blanca)',
      status: 'warn',
      message: 'Zona de hombros/camisa se percibe oscura o de color. Recuerda usar camisa blanca formal.',
    };
  }

  const checks: CarnetPhotoCheck[] = [
    resolutionCheck,
    backgroundCheck,
    lightingCheck,
    framingCheck,
    faceClearCheck,
    attireCheck,
  ];

  // Calcular puntuación determinística ponderada
  const weights: Record<CarnetPhotoCheck['id'], number> = {
    resolution: 22,
    background: 22,
    lighting: 18,
    framing: 16,
    face_clear: 14,
    attire: 8,
  };

  let earned = 0;
  let failCount = 0;
  let warnCount = 0;
  for (const c of checks) {
    const wt = weights[c.id];
    if (c.status === 'pass') {
      earned += wt;
    } else if (c.status === 'warn') {
      earned += wt * 0.55;
      warnCount++;
    } else {
      earned += wt * 0.1;
      failCount++;
    }
  }

  const score = Math.max(0, Math.min(100, Math.round(earned)));

  let status: CarnetPhotoAnalysis['status'];
  let summary: string;
  if (failCount === 0 && score >= 82) {
    status = 'aceptable';
    summary = 'Fotografía aceptable: cumple con los lineamientos institucionales.';
  } else if (failCount <= 1 && score >= 62) {
    status = 'observaciones';
    summary =
      suggestBackgroundReplace
        ? 'Aceptable con observaciones: puedes mejorarla reemplazando el fondo aquí mismo.'
        : 'Aceptable con observaciones menores: revisa los puntos señalados.';
  } else {
    status = 'no_recomendable';
    summary = 'No recomendable para carnet: corrige los puntos en rojo o toma una nueva foto.';
  }

  return {
    status,
    score,
    summary,
    checks,
    suggestBackgroundReplace,
    dimensions: { width: srcW, height: srcH },
  };
}
