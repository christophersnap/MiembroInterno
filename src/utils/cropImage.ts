export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    if (!url.startsWith('data:') && !url.startsWith('blob:')) {
      image.setAttribute('crossOrigin', 'anonymous');
    }
    image.src = url;
  });

export function getRadianAngle(degreeValue: number) {
  return (degreeValue * Math.PI) / 180;
}

export interface CroppedImgResult {
  blob: Blob;
  dataUrl: string;
  objectUrl: string;
}

export async function getCroppedImgResult(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  rotation = 0,
  maxOutputSize = 900
): Promise<CroppedImgResult | null> {
  const image = await createImage(imageSrc);
  const srcW = image.naturalWidth || image.width;
  const srcH = image.naturalHeight || image.height;
  if (!srcW || !srcH) return null;

  const cropW = Math.max(1, Math.round(pixelCrop.width));
  const cropH = Math.max(1, Math.round(pixelCrop.height));
  const cropX = Math.max(0, Math.round(pixelCrop.x));
  const cropY = Math.max(0, Math.round(pixelCrop.y));

  // Escalar salida para no exceder límites de memoria de canvas en móviles y acelerar subida
  const scale = Math.min(1, maxOutputSize / Math.max(cropW, cropH));
  const outW = Math.max(1, Math.round(cropW * scale));
  const outH = Math.max(1, Math.round(cropH * scale));

  const croppedCanvas = document.createElement('canvas');
  const croppedCtx = croppedCanvas.getContext('2d');
  if (!croppedCtx) return null;

  croppedCanvas.width = outW;
  croppedCanvas.height = outH;

  // Fondo blanco por si el archivo origen es PNG/WebP con transparencia
  croppedCtx.fillStyle = '#ffffff';
  croppedCtx.fillRect(0, 0, outW, outH);

  if (rotation === 0) {
    // Recorte directo sin crear un canvas gigante intermedio (evita lienzos en blanco en fotos HD)
    const safeX = Math.min(cropX, Math.max(0, srcW - 1));
    const safeY = Math.min(cropY, Math.max(0, srcH - 1));
    const safeW = Math.min(cropW, Math.max(1, srcW - safeX));
    const safeH = Math.min(cropH, Math.max(1, srcH - safeY));
    croppedCtx.drawImage(image, safeX, safeY, safeW, safeH, 0, 0, outW, outH);
  } else {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const rotRad = getRadianAngle(rotation);
    const bBoxWidth =
      Math.abs(Math.cos(rotRad) * srcW) + Math.abs(Math.sin(rotRad) * srcH);
    const bBoxHeight =
      Math.abs(Math.sin(rotRad) * srcW) + Math.abs(Math.cos(rotRad) * srcH);

    canvas.width = Math.round(bBoxWidth);
    canvas.height = Math.round(bBoxHeight);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rotRad);
    ctx.translate(-srcW / 2, -srcH / 2);
    ctx.drawImage(image, 0, 0);

    croppedCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, outW, outH);
  }

  const dataUrl = croppedCanvas.toDataURL('image/jpeg', 0.9);

  return new Promise((resolve) => {
    croppedCanvas.toBlob(
      (blob) => {
        if (blob && blob.size > 100) {
          resolve({
            blob,
            dataUrl,
            objectUrl: URL.createObjectURL(blob),
          });
        } else {
          resolve(null);
        }
      },
      'image/jpeg',
      0.9
    );
  });
}

export default async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  rotation = 0,
  maxOutputSize = 900
): Promise<string | null> {
  const res = await getCroppedImgResult(imageSrc, pixelCrop, rotation, maxOutputSize);
  return res ? res.objectUrl : null;
}

export async function fileToCompactDataUrl(
  file: File,
  maxDim = 520,
  quality = 0.82
): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await createImage(objectUrl);
    const srcW = img.naturalWidth || img.width || maxDim;
    const srcH = img.naturalHeight || img.height || maxDim;
    const scale = Math.min(1, maxDim / Math.max(srcW, srcH, 1));
    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No canvas context');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
