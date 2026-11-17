import React, { useEffect, useState } from 'react';
import { Camera } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface CarnetPhotoImgProps {
  src?: string | null;
  fallbackSrc?: string | null;
  alt: string;
  className?: string;
  iconClassName?: string;
}

function normalizeCandidateUrl(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
  // Descartar URLs temporales blob: guardadas por error de otra sesión
  if (trimmed.startsWith('blob:')) return null;
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('/')
  ) {
    return trimmed;
  }
  // Si es una ruta relativa en el bucket 'socorristas'
  const { data } = supabase.storage.from('socorristas').getPublicUrl(trimmed);
  return data?.publicUrl || trimmed;
}

function extractStorageParts(url: string): { bucket: string; path: string } | null {
  const match = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?#]+)/.exec(url);
  if (!match) return null;
  return {
    bucket: decodeURIComponent(match[1]),
    path: decodeURIComponent(match[2]),
  };
}

export default function CarnetPhotoImg({
  src,
  fallbackSrc,
  alt,
  className = 'w-full h-full object-cover',
  iconClassName = 'w-5 h-5 text-slate-400',
}: CarnetPhotoImgProps) {
  const primary = normalizeCandidateUrl(src);
  const secondary = normalizeCandidateUrl(fallbackSrc);

  const [resolvedSrc, setResolvedSrc] = useState<string | null>(primary || secondary);
  const [attemptedRecovery, setAttemptedRecovery] = useState(false);
  const [triedSecondary, setTriedSecondary] = useState(!primary && Boolean(secondary));
  const [failedAll, setFailedAll] = useState(false);

  useEffect(() => {
    const p = normalizeCandidateUrl(src);
    const s = normalizeCandidateUrl(fallbackSrc);
    setResolvedSrc(p || s);
    setAttemptedRecovery(false);
    setTriedSecondary(!p && Boolean(s));
    setFailedAll(false);
  }, [src, fallbackSrc]);

  const handleError = async () => {
    const current = resolvedSrc;

    // 1. Intentar recuperar desde Supabase Storage (signed URL o descarga directa) por si el bucket es privado
    if (current && !attemptedRecovery) {
      setAttemptedRecovery(true);
      const parts = extractStorageParts(current);
      if (parts) {
        try {
          const { data: signedData } = await supabase.storage
            .from(parts.bucket)
            .createSignedUrl(parts.path, 3600);
          if (signedData?.signedUrl && signedData.signedUrl !== current) {
            setResolvedSrc(signedData.signedUrl);
            return;
          }
        } catch {}

        try {
          const { data: blobData } = await supabase.storage
            .from(parts.bucket)
            .download(parts.path);
          if (blobData && blobData.size > 0) {
            const objUrl = URL.createObjectURL(blobData);
            setResolvedSrc(objUrl);
            return;
          }
        } catch {}
      }
    }

    // 2. Intentar foto secundaria del perfil del socorrista si existe
    if (!triedSecondary && secondary && secondary !== current) {
      setTriedSecondary(true);
      setAttemptedRecovery(false);
      setResolvedSrc(secondary);
      return;
    }

    // 3. Mostrar placeholder limpio en lugar de caja blanca rota
    setFailedAll(true);
  };

  if (!resolvedSrc || failedAll) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400">
        <Camera className={iconClassName} />
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={handleError}
      className={className}
    />
  );
}
