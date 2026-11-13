import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface WatermarkImageProps {
  src: string;
  alt?: string;
  className?: string;
  isRounded?: boolean;
  fallbackText?: string;
}

export default function WatermarkImage({
  src,
  alt = '',
  className = '',
  isRounded = false,
  fallbackText = '',
}: WatermarkImageProps) {
  const { role, watermarkEnabled, userName } = useAuth();
  const [imgError, setImgError] = useState(false);

  const showWatermark = watermarkEnabled && role !== 'admin';

  if (!src || imgError) {
    if (fallbackText) {
      return (
        <div
          className={`flex items-center justify-center bg-slate-100 text-slate-600 font-bold text-xs ${
            isRounded ? 'rounded-full' : 'rounded-lg'
          } ${className}`}
        >
          {fallbackText}
        </div>
      );
    }
    return null;
  }

  if (!showWatermark) {
    return (
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={`${className} ${isRounded ? 'rounded-full object-cover' : ''}`}
      />
    );
  }

  const isSmallAvatar = isRounded && (className.includes('h-8') || className.includes('h-9') || className.includes('h-10') || className.includes('h-11') || className.includes('h-12'));

  return (
    <div
      className={`relative inline-block overflow-hidden ${isRounded ? 'rounded-full' : 'rounded-lg'} ${className.replace(/rounded-\w+/g, '')}`}
    >
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={`w-full h-full object-cover ${isRounded ? 'rounded-full' : ''}`}
      />
      {!isSmallAvatar ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-black/15">
          <div className="transform -rotate-45 text-white/75 font-bold text-center w-[200%]">
            <p className="text-[10px] sm:text-xs tracking-wider uppercase drop-shadow-md">
              Cruz Verde Salvadoreña<br />Sistema Interno
            </p>
            <p className="text-[8px] sm:text-[10px] mt-1 opacity-80 drop-shadow-md">
              Visualizado por: {userName || 'Usuario'}
            </p>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 pointer-events-none bg-black/5" />
      )}
    </div>
  );
}
