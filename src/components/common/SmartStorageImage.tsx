import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface SmartStorageImageProps {
  src?: string | null;
  fallbackSrc?: string | null;
  alt?: string;
  className?: string;
  fallback?: React.ReactNode;
  onResolvedUrl?: (url: string | null) => void;
}

function normalizeCandidateUrl(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
  // Ignore stale blob: URLs saved in DB from previous browser sessions
  if (trimmed.startsWith('blob:') && !trimmed.startsWith(`blob:${window.location.origin}`)) {
    return null;
  }

  // Normalize Google Drive share links if present
  const driveFileMatch = /drive\.google\.com\/file\/d\/([^/?#]+)/i.exec(trimmed);
  if (driveFileMatch?.[1]) {
    return `https://lh3.googleusercontent.com/d/${driveFileMatch[1]}=w800`;
  }
  const driveOpenMatch = /drive\.google\.com\/(?:open|uc)\?[^#]*id=([^&#]+)/i.exec(trimmed);
  if (driveOpenMatch?.[1]) {
    return `https://lh3.googleusercontent.com/d/${driveOpenMatch[1]}=w800`;
  }

  // Bare storage filename inside 'socorristas' bucket
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

function parseSupabaseStorageUrl(url: string): { bucket: string; objectPath: string } | null {
  const match = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/?#]+)\/([^?#]+)/i.exec(url);
  if (!match) return null;
  try {
    return {
      bucket: decodeURIComponent(match[1]),
      objectPath: decodeURIComponent(match[2]),
    };
  } catch {
    return {
      bucket: match[1],
      objectPath: match[2],
    };
  }
}

export default function SmartStorageImage({
  src,
  fallbackSrc,
  alt = '',
  className = '',
  fallback = null,
  onResolvedUrl,
}: SmartStorageImageProps) {
  const candidates = React.useMemo(() => {
    const list: string[] = [];
    const primary = normalizeCandidateUrl(src);
    const secondary = normalizeCandidateUrl(fallbackSrc);
    if (primary) list.push(primary);
    if (secondary && secondary !== primary) list.push(secondary);
    return list;
  }, [src, fallbackSrc]);

  const [candidateIdx, setCandidateIdx] = useState(0);
  const [activeUrl, setActiveUrl] = useState<string | null>(() => candidates[0] || null);
  const [triedSignedForIdx, setTriedSignedForIdx] = useState<number>(-1);
  const [failedAll, setFailedAll] = useState(candidates.length === 0);

  useEffect(() => {
    if (candidates.length === 0) {
      setCandidateIdx(0);
      setActiveUrl(null);
      setTriedSignedForIdx(-1);
      setFailedAll(true);
      onResolvedUrl?.(null);
    } else {
      setCandidateIdx(0);
      setActiveUrl(candidates[0]);
      setTriedSignedForIdx(-1);
      setFailedAll(false);
    }
  }, [candidates.join('||')]);

  useEffect(() => {
    let revokedUrl: string | null = null;
    return () => {
      if (revokedUrl) URL.revokeObjectURL(revokedUrl);
    };
  }, []);

  const advanceToNextOrFail = (idx: number) => {
    if (idx + 1 < candidates.length) {
      const nextIdx = idx + 1;
      setCandidateIdx(nextIdx);
      setActiveUrl(candidates[nextIdx]);
    } else {
      setActiveUrl(null);
      setFailedAll(true);
      onResolvedUrl?.(null);
    }
  };

  const handleImageError = async () => {
    const baseCandidate = candidates[candidateIdx];
    if (baseCandidate && triedSignedForIdx !== candidateIdx) {
      setTriedSignedForIdx(candidateIdx);
      const parsed = parseSupabaseStorageUrl(baseCandidate);
      if (parsed) {
        try {
          const { data: signedData } = await supabase.storage
            .from(parsed.bucket)
            .createSignedUrl(parsed.objectPath, 3600);
          if (signedData?.signedUrl && signedData.signedUrl !== activeUrl) {
            setActiveUrl(signedData.signedUrl);
            return;
          }
        } catch {}

        try {
          const { data: blobData } = await supabase.storage
            .from(parsed.bucket)
            .download(parsed.objectPath);
          // Reject corrupt tiny blobs (< 120 bytes, e.g. accidental "blob:..." string uploads)
          if (blobData && blobData.size > 120) {
            const objUrl = URL.createObjectURL(blobData);
            setActiveUrl(objUrl);
            return;
          }
        } catch {}
      }
    }

    advanceToNextOrFail(candidateIdx);
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (!img.naturalWidth || !img.naturalHeight) {
      handleImageError();
      return;
    }
    onResolvedUrl?.(activeUrl);
  };

  if (failedAll || !activeUrl) {
    return <>{fallback}</>;
  }

  return (
    <img
      src={activeUrl}
      alt={alt}
      referrerPolicy="no-referrer"
      onLoad={handleImageLoad}
      onError={handleImageError}
      className={className}
    />
  );
}
