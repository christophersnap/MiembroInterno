import React, { useState, useRef, useEffect, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import {
  Camera,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  Crop,
  ArrowLeft,
  ZoomIn,
  ShieldCheck,
  Maximize2,
  RefreshCw,
} from 'lucide-react';
import getCroppedImg from '../../utils/cropImage';

interface CarnetPhotoCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoReady: (file: File, previewUrl: string) => void;
  title?: string;
  initialStep?: 'guidelines' | 'camera';
}

const GUIDE_IMAGE_URL = '/assets/aistudio/Gu_a_para_Fotograf_a_de_Carnet_Cruz_Verde_6c51e8c9.png';

const PHOTO_RULES = [
  {
    title: 'De frente tipo pasaporte',
    desc: 'Rostro centrado, mirando directamente a la cámara y completamente visible.',
  },
  {
    title: 'Vestimenta formal (Camisa blanca)',
    desc: 'Use camisa de vestir blanca formal con cuello y botones.',
  },
  {
    title: 'Fondo liso uniforme',
    desc: 'Preferiblemente blanco sólido, sin objetos, cuadros ni sombras.',
  },
  {
    title: 'Buena iluminación y expresión neutral',
    desc: 'Luz natural o uniforme, sin sonreír ni hacer gestos.',
  },
  {
    title: 'Sin accesorios ni filtros',
    desc: 'No usar gorras, sombreros, lentes oscuros, mascarillas ni filtros digitales.',
  },
];

export default function CarnetPhotoCaptureModal({
  isOpen,
  onClose,
  onPhotoReady,
  title = 'Fotografía Oficial para Carnet',
  initialStep = 'guidelines',
}: CarnetPhotoCaptureModalProps) {
  const [step, setStep] = useState<'guidelines' | 'camera' | 'crop'>(initialStep);
  const [zoomGuideModal, setZoomGuideModal] = useState(false);

  // Camera state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  // Cropper state
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [processingCrop, setProcessingCrop] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(
    async (mode: 'user' | 'environment') => {
      stopCameraStream();
      setCameraError(null);
      setCameraReady(false);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'Tu navegador o entorno no permite acceso directo a la cámara. Puedes subir una fotografía desde archivo.'
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: mode,
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(() => {});
            setCameraReady(true);
          };
        }
      } catch (err: any) {
        console.error('Camera error:', err);
        setCameraError(
          'No se pudo acceder a la cámara. Verifica los permisos del navegador o sube una fotografía desde tu dispositivo.'
        );
      }
    },
    [stopCameraStream]
  );

  useEffect(() => {
    if (!isOpen) {
      stopCameraStream();
      setStep(initialStep);
      setImageSrc(null);
      setCameraError(null);
      setZoomGuideModal(false);
    } else {
      setStep(initialStep);
      if (initialStep === 'camera') {
        startCamera(facingMode);
      }
    }
    return () => {
      stopCameraStream();
    };
  }, [isOpen, initialStep]);

  const handleOpenCamera = () => {
    setStep('camera');
    startCamera(facingMode);
  };

  const handleToggleCamera = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  const handleCaptureFromCamera = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
    stopCameraStream();
    setImageSrc(dataUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setStep('crop');
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('La imagen no debe superar los 10MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setStep('crop');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleApplyCrop = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setProcessingCrop(true);
    try {
      const croppedUrl = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (croppedUrl) {
        const res = await fetch(croppedUrl);
        const blob = await res.blob();
        const file = new File([blob], `carnet_foto_${Date.now()}.jpg`, { type: 'image/jpeg' });
        stopCameraStream();
        onPhotoReady(file, croppedUrl);
        onClose();
      }
    } catch (err) {
      console.error('Error cropping photo:', err);
      alert('No se pudo recortar la fotografía. Intente de nuevo.');
    } finally {
      setProcessingCrop(false);
    }
  };

  const handleClose = () => {
    stopCameraStream();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/70 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{title}</h3>
              <p className="text-2xs text-slate-500">
                {step === 'guidelines' && 'Revisa los lineamientos oficiales antes de tomar o subir tu fotografía'}
                {step === 'camera' && 'Encuadra tu rostro y hombros dentro de la máscara guía tipo pasaporte'}
                {step === 'crop' && 'Ajusta el encuadre final y zoom para tu carnet institucional'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelected}
          className="hidden"
        />

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-slate-50/70 p-4 sm:p-6">
          {/* STEP 1: LINEAMIENTOS Y MÉTODO */}
          {step === 'guidelines' && (
            <div className="space-y-5">
              {/* Official Guidelines Image */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="px-4 py-3 bg-emerald-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-300" />
                    <span className="text-xs font-bold tracking-wide uppercase">
                      Guía Oficial de Fotografía para Carnet — Cruz Verde Salvadoreña
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setZoomGuideModal(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-2xs font-semibold transition-colors cursor-pointer"
                  >
                    <Maximize2 className="w-3 h-3" />
                    Ampliar Guía
                  </button>
                </div>

                <div className="p-3 bg-slate-100/70">
                  <button
                    type="button"
                    onClick={() => setZoomGuideModal(true)}
                    className="w-full block rounded-xl overflow-hidden border border-slate-200 bg-white hover:opacity-95 transition-opacity cursor-zoom-in"
                    title="Clic para ampliar imagen de lineamientos"
                  >
                    <img
                      src={GUIDE_IMAGE_URL}
                      alt="Requisitos para Fotografía de Carnet Cruz Verde Salvadoreña"
                      className="w-full h-auto max-h-[340px] object-contain mx-auto"
                    />
                  </button>
                </div>

                {/* Summary Checklist */}
                <div className="p-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {PHOTO_RULES.map((rule, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-slate-900">{rule.title}</p>
                        <p className="text-[11px] text-slate-600 leading-snug mt-0.5">{rule.desc}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/70">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-900">Importante</p>
                      <p className="text-[11px] text-amber-800 leading-snug mt-0.5">
                        El fondo debe ser completamente liso y uniforme para facilitar la emisión del carnet oficial.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleOpenCamera}
                  className="flex items-center justify-center gap-3 p-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white shadow-md transition-all cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold">Tomar Foto con Cámara</p>
                    <p className="text-[11px] text-emerald-100">Incluye máscara guía tipo pasaporte / ID</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-3 p-4 rounded-2xl bg-white hover:bg-slate-50 text-slate-900 border-2 border-slate-200 hover:border-emerald-500 shadow-xs transition-all cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold">Subir Fotografía desde Archivo</p>
                    <p className="text-[11px] text-slate-500">JPG o PNG (máximo 10MB) con recorte</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: LIVE CAMERA WITH PASSPORT/ID MASK */}
          {step === 'camera' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    stopCameraStream();
                    setStep('guidelines');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Ver Lineamientos
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleCamera}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Cambiar Cámara ({facingMode === 'user' ? 'Frontal' : 'Trasera'})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopCameraStream();
                      fileInputRef.current?.click();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Subir Archivo
                  </button>
                </div>
              </div>

              {cameraError ? (
                <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center space-y-4">
                  <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Cámara no disponible</h4>
                    <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">{cameraError}</p>
                  </div>
                  <div className="flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => startCamera(facingMode)}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800 cursor-pointer"
                    >
                      Reintentar Cámara
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-xs font-semibold text-white cursor-pointer"
                    >
                      Subir Fotografía desde Archivo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative mx-auto max-w-xl aspect-[4/3] sm:aspect-[4/4.2] max-h-[520px] rounded-2xl overflow-hidden bg-slate-950 border-2 border-slate-800 shadow-xl flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
                  />

                  {/* SVG PASSPORT / ID SILHOUETTE MASK */}
                  <svg
                    viewBox="0 0 360 440"
                    preserveAspectRatio="xMidYMid slice"
                    className="absolute inset-0 w-full h-full pointer-events-none"
                  >
                    <defs>
                      <mask id="passport-id-cutout-mask">
                        <rect width="360" height="440" fill="white" />
                        <rect x="45" y="42" width="270" height="346" rx="16" fill="black" />
                      </mask>
                    </defs>

                    {/* Darkened outer area */}
                    <rect width="360" height="440" fill="rgba(6, 18, 12, 0.62)" mask="url(#passport-id-cutout-mask)" />

                    {/* Outer ID frame */}
                    <rect
                      x="45"
                      y="42"
                      width="270"
                      height="346"
                      rx="16"
                      fill="none"
                      stroke="#34d399"
                      strokeWidth="2.5"
                    />

                    {/* Corner brackets */}
                    <path d="M 45 72 L 45 50 Q 45 42 53 42 L 75 42" fill="none" stroke="#ffffff" strokeWidth="3.5" />
                    <path d="M 285 42 L 307 42 Q 315 42 315 50 L 315 72" fill="none" stroke="#ffffff" strokeWidth="3.5" />
                    <path d="M 45 358 L 45 380 Q 45 388 53 388 L 75 388" fill="none" stroke="#ffffff" strokeWidth="3.5" />
                    <path d="M 285 388 L 307 388 Q 315 388 315 380 L 315 358" fill="none" stroke="#ffffff" strokeWidth="3.5" />

                    {/* Head oval guide */}
                    <ellipse
                      cx="180"
                      cy="176"
                      rx="68"
                      ry="90"
                      fill="none"
                      stroke="rgba(255,255,255,0.92)"
                      strokeWidth="2.5"
                      strokeDasharray="7 5"
                    />

                    {/* Shoulder & shirt collar silhouette guide */}
                    <path
                      d="M 74 374 C 82 314, 125 288, 180 288 C 235 288, 278 314, 286 374"
                      fill="none"
                      stroke="rgba(52,211,153,0.9)"
                      strokeWidth="2.5"
                      strokeDasharray="6 5"
                    />

                    {/* Eye alignment horizontal line */}
                    <line
                      x1="100"
                      y1="164"
                      x2="260"
                      y2="164"
                      stroke="rgba(52,211,153,0.45)"
                      strokeWidth="1.2"
                      strokeDasharray="4 4"
                    />
                    {/* Vertical center axis */}
                    <line
                      x1="180"
                      y1="72"
                      x2="180"
                      y2="374"
                      stroke="rgba(255,255,255,0.28)"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                  </svg>

                  {/* Top prompt overlay */}
                  <div className="absolute top-3 inset-x-3 flex justify-center pointer-events-none">
                    <span className="px-3 py-1 rounded-full bg-slate-950/80 border border-emerald-400/50 text-white text-[11px] font-semibold backdrop-blur-xs">
                      Alinea tu rostro en el óvalo y hombros en la guía (fondo blanco, camisa blanca)
                    </span>
                  </div>

                  {!cameraReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-white text-xs font-medium">
                      Iniciando cámara...
                    </div>
                  )}
                </div>
              )}

              {!cameraError && (
                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    disabled={!cameraReady}
                    onClick={handleCaptureFromCamera}
                    className="inline-flex items-center gap-2.5 px-7 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm font-bold shadow-lg transition-all cursor-pointer"
                  >
                    <Camera className="w-5 h-5" />
                    Capturar Fotografía
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: CROPPER */}
          {step === 'crop' && imageSrc && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setStep('guidelines')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Cambiar Foto o Lineamientos
                </button>
                <button
                  type="button"
                  onClick={handleOpenCamera}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Volver a Tomar con Cámara
                </button>
              </div>

              <div className="relative w-full h-[360px] sm:h-[420px] rounded-2xl overflow-hidden bg-slate-900 border border-slate-800">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={true}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                />
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full sm:max-w-xs">
                  <ZoomIn className="w-4 h-4 text-slate-500 shrink-0" />
                  <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.05}
                    aria-label="Zoom de fotografía"
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                  <span className="text-xs font-mono text-slate-600 w-10 text-right">{zoom.toFixed(1)}x</span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={processingCrop}
                    onClick={handleApplyCrop}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <Crop className="w-4 h-4" />
                    {processingCrop ? 'Procesando...' : 'Aplicar Fotografía'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox zoom for guidelines image */}
      {zoomGuideModal && (
        <div
          className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setZoomGuideModal(false)}
        >
          <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setZoomGuideModal(false)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white flex items-center gap-1 text-xs font-semibold cursor-pointer"
            >
              <X className="w-5 h-5" /> Cerrar
            </button>
            <img
              src={GUIDE_IMAGE_URL}
              alt="Guía de Fotografía de Carnet Cruz Verde Salvadoreña"
              className="w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}
