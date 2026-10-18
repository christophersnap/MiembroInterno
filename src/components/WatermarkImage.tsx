import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface WatermarkImageProps {
  src: string;
  alt?: string;
  className?: string;
  isRounded?: boolean;
}

export default function WatermarkImage({ src, alt = '', className = '', isRounded = false }: WatermarkImageProps) {
  const { role, watermarkEnabled, userName } = useAuth();

  const showWatermark = watermarkEnabled && role !== 'admin';

  if (!showWatermark) {
    return <img src={src} alt={alt} className={`${className} ${isRounded ? 'rounded-full object-cover' : ''}`} />;
  }

  return (
    <div className={`relative inline-block overflow-hidden ${isRounded ? 'rounded-full' : 'rounded-lg'} ${className.replace(/rounded-\w+/g, '')}`}>
      <img src={src} alt={alt} className={`w-full h-full object-cover ${isRounded ? 'rounded-full' : ''}`} />
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-black bg-opacity-10">
        <div className="transform -rotate-45 text-white text-opacity-70 font-bold text-center w-[200%]">
          <p className="text-[10px] sm:text-xs tracking-wider uppercase drop-shadow-md">
            Cruz Verde Salvadoreña<br/>Sistema Interno
          </p>
          <p className="text-[8px] sm:text-[10px] mt-1 opacity-80 drop-shadow-md">
            Visualizado por: {userName || 'Usuario'}
          </p>
        </div>
      </div>
    </div>
  );
}
