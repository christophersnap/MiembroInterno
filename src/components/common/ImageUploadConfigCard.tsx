import React, { useRef, useState } from 'react';
import { 
  Upload, X, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, 
  EyeOff, Check, Link as LinkIcon, Sparkles, RefreshCw
} from 'lucide-react';

export interface ImageUploadConfigCardProps {
  title: string;
  subtitle: string;
  imageUrl: string;
  position: 'left' | 'center' | 'right' | 'none';
  size?: 'small' | 'medium' | 'large';
  visible: boolean;
  onImageChange: (url: string) => void;
  onPositionChange: (pos: 'left' | 'center' | 'right' | 'none') => void;
  onSizeChange?: (size: 'small' | 'medium' | 'large') => void;
  onVisibilityChange: (visible: boolean) => void;
  defaultPlaceholderText?: string;
  defaultLogoName?: string;
}

export default function ImageUploadConfigCard({
  title,
  subtitle,
  imageUrl,
  position,
  size = 'medium',
  visible,
  onImageChange,
  onPositionChange,
  onSizeChange,
  onVisibilityChange,
  defaultPlaceholderText = 'Escudo Institucional Oficial de Cruz Verde',
  defaultLogoName = 'Escudo Oficial Cruz Verde'
}: ImageUploadConfigCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Procesa y comprime la imagen a tamaño adecuado para PDF
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      const result = event.target?.result as string;

      // Optimizar en canvas si es un formato rasterizado (evitar SVGs)
      if (file.type === 'image/svg+xml') {
        onImageChange(result);
        onVisibilityChange(true);
        if (position === 'none') onPositionChange('center');
        setProcessing(false);
        return;
      }

      const img = new Image();
      img.onload = () => {
        const maxDim = 800;
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
          ctx.drawImage(img, 0, 0, width, height);
          const mime = file.type.includes('png') ? 'image/png' : 'image/jpeg';
          const compressedDataUrl = canvas.toDataURL(mime, 0.88);
          onImageChange(compressedDataUrl);
        } else {
          onImageChange(result);
        }

        onVisibilityChange(true);
        if (position === 'none') onPositionChange('center');
        setProcessing(false);
      };

      img.onerror = () => {
        onImageChange(result);
        onVisibilityChange(true);
        setProcessing(false);
      };

      img.src = result;
    };

    reader.readAsDataURL(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDejarEnBlanco = () => {
    onVisibilityChange(false);
    onPositionChange('none');
  };

  const handleQuitarImagen = () => {
    onImageChange('');
  };

  return (
    <div className={`p-4 rounded-2xl border transition-all ${
      visible && position !== 'none'
        ? 'bg-white border-emerald-200 shadow-xs' 
        : 'bg-gray-50/80 border-gray-200 opacity-90'
    }`}>
      {/* Encabezado de la Tarjeta */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-gray-100">
        <div className="flex items-center space-x-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
            visible && position !== 'none' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'
          }`}>
            <ImageIcon className="w-4 h-4" />
          </div>
          <div>
            <h5 className="text-xs font-bold text-gray-900 leading-none">
              {title}
            </h5>
            <p className="text-3xs text-gray-500 mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Estado en hoja: Activo vs Dejar en Blanco */}
        <div className="flex items-center space-x-2">
          {visible && position !== 'none' ? (
            <button
              type="button"
              onClick={handleDejarEnBlanco}
              className="inline-flex items-center px-2.5 py-1 text-2xs font-semibold rounded-lg text-gray-600 bg-gray-100 hover:bg-gray-200 border border-gray-300 transition"
              title="No mostrar esta imagen en la hoja"
            >
              <EyeOff className="w-3 h-3 mr-1 text-gray-500" />
              Dejar en blanco
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onVisibilityChange(true);
                if (position === 'none') onPositionChange('center');
              }}
              className="inline-flex items-center px-2.5 py-1 text-2xs font-bold rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition"
            >
              <Check className="w-3 h-3 mr-1" />
              Activar en hoja
            </button>
          )}
        </div>
      </div>

      {/* Contenido Principal: Subir y Vista Previa */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
        {/* Previsualización Miniatura */}
        <div className="sm:col-span-4 flex flex-col items-center justify-center p-3 bg-gray-100/80 rounded-xl border border-dashed border-gray-300 min-h-[95px]">
          {imageUrl ? (
            <div className="relative group w-full flex flex-col items-center">
              <img
                src={imageUrl}
                alt={title}
                referrerPolicy="no-referrer"
                className={`object-contain max-w-full rounded-sm bg-white p-1 border border-gray-200 shadow-2xs ${
                  size === 'small' ? 'h-11' : size === 'large' ? 'h-18' : 'h-14'
                }`}
              />
              <div className="mt-1 flex items-center space-x-1">
                <button
                  type="button"
                  onClick={handleQuitarImagen}
                  className="text-3xs text-red-600 hover:text-red-700 font-medium hover:underline inline-flex items-center"
                >
                  <X className="w-2.5 h-2.5 mr-0.5" />
                  Quitar personalizada
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-1">
              <div className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white text-green-700 font-bold border border-green-700 shadow-2xs">
                <span className="text-xl leading-none">+</span>
              </div>
              <p className="text-3xs font-semibold text-gray-600 max-w-[140px] leading-tight">
                {defaultLogoName}
              </p>
              <span className="text-4xs text-gray-400 block">
                Predeterminado institucional
              </span>
            </div>
          )}
        </div>

        {/* Acciones de Carga y Posición */}
        <div className="sm:col-span-8 space-y-2.5">
          {/* Botones de Subir Archivo y URL */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleFileSelected}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={processing}
              className="inline-flex items-center px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs transition active:scale-95 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              {processing ? 'Procesando...' : 'Subir Imagen'}
            </button>

            <button
              type="button"
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="inline-flex items-center px-2.5 py-1.5 bg-white hover:bg-gray-100 text-gray-700 text-xs font-medium rounded-xl border border-gray-300 transition"
            >
              <LinkIcon className="w-3 h-3 mr-1 text-gray-500" />
              {showUrlInput ? 'Ocultar enlace' : 'Ingresar URL'}
            </button>

            {visible && (
              <button
                type="button"
                onClick={handleDejarEnBlanco}
                className="text-2xs text-gray-500 hover:text-gray-800 underline ml-auto"
              >
                Dejar espacio en blanco
              </button>
            )}
          </div>

          {/* Campo de URL Opcional */}
          {showUrlInput && (
            <div className="flex items-center space-x-1.5">
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => {
                  onImageChange(e.target.value);
                  if (e.target.value) {
                    onVisibilityChange(true);
                    if (position === 'none') onPositionChange('center');
                  }
                }}
                placeholder="https://ejemplo.com/imagen.png"
                className="flex-1 px-2.5 py-1 text-xs border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              />
              {imageUrl && (
                <button
                  type="button"
                  onClick={handleQuitarImagen}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="Limpiar URL"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Controles de Posicionamiento Individual en la Hoja */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-gray-100">
            {/* Posición individual (Izquierda / Centro / Derecha / En blanco) */}
            <div>
              <span className="block text-3xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                Colocación en la Hoja:
              </span>
              <div className="inline-flex rounded-lg border border-gray-300 bg-gray-100 p-0.5 w-full">
                <button
                  type="button"
                  onClick={() => {
                    onVisibilityChange(true);
                    onPositionChange('left');
                  }}
                  className={`flex-1 py-1 text-2xs font-bold rounded-md flex items-center justify-center transition ${
                    visible && position === 'left'
                      ? 'bg-white shadow-2xs text-emerald-800 font-black'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Alinear a la izquierda"
                >
                  <AlignLeft className="w-3 h-3 mr-1" />
                  Izq.
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onVisibilityChange(true);
                    onPositionChange('center');
                  }}
                  className={`flex-1 py-1 text-2xs font-bold rounded-md flex items-center justify-center transition ${
                    visible && position === 'center'
                      ? 'bg-white shadow-2xs text-emerald-800 font-black'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Centrar imagen"
                >
                  <AlignCenter className="w-3 h-3 mr-1" />
                  Centro
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onVisibilityChange(true);
                    onPositionChange('right');
                  }}
                  className={`flex-1 py-1 text-2xs font-bold rounded-md flex items-center justify-center transition ${
                    visible && position === 'right'
                      ? 'bg-white shadow-2xs text-emerald-800 font-black'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Alinear a la derecha"
                >
                  <AlignRight className="w-3 h-3 mr-1" />
                  Der.
                </button>

                <button
                  type="button"
                  onClick={handleDejarEnBlanco}
                  className={`px-2 py-1 text-2xs font-bold rounded-md flex items-center justify-center transition ${
                    !visible || position === 'none'
                      ? 'bg-white shadow-2xs text-amber-700 font-black'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                  title="Dejar en blanco (Ocultar)"
                >
                  Blanco
                </button>
              </div>
            </div>

            {/* Tamaño Opcional */}
            {onSizeChange && (
              <div>
                <span className="block text-3xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                  Tamaño de Escala:
                </span>
                <select
                  value={size}
                  onChange={(e) => onSizeChange(e.target.value as any)}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg outline-none bg-white font-medium text-gray-800"
                >
                  <option value="small">Pequeño (42px)</option>
                  <option value="medium">Mediano (56px - Normal)</option>
                  <option value="large">Grande (76px)</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
