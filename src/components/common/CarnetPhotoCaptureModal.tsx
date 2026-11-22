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
  Video,
  VideoOff,
  KeyRound,
  Scissors,
  Undo2,
  AlertTriangle,
  SlidersHorizontal,
  ScanFace,
  Check,
} from 'lucide-react';
import { getCroppedImgResult } from '../../utils/cropImage';
import {
  analyzeCarnetPhoto,
  loadImageSafelyAsDataUrl,
  CarnetPhotoAnalysis,
} from '../../utils/carnetPhotoAnalyzer';
import {
  replaceCarnetPhotoBackground,
  BackgroundPreset,
} from '../../utils/carnetBackgroundReplace';
import { useAuth } from '../../contexts/AuthContext';
import CarnetPhotoGuideVisual from './CarnetPhotoGuideVisual';

export interface CarnetPhotoReadyMeta {
  analysis: CarnetPhotoAnalysis | null;
  backgroundReplaced: boolean;
  backgroundColor?: BackgroundPreset;
}

interface CarnetPhotoCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoReady: (file: File, previewUrl: string, meta?: CarnetPhotoReadyMeta) => void;
  title?: string;
  initialStep?: 'guidelines' | 'camera' | 'crop';
  /** Opcional: URL o dataURL existente para abrir directamente el recorte, análisis y reemplazo de fondo */
  initialImageSrc?: string | null;
  initialFallbackSrc?: string | null;
}

const GUIDE_IMAGE_CANDIDATES = Array.from(
  new Set([
    `${import.meta.env.BASE_URL || '/'}assets/aistudio/Requisitos_para_fotograf_a_de_carnet__1__90eb9817.png`,
    '/miembros/assets/aistudio/Requisitos_para_fotograf_a_de_carnet__1__90eb9817.png',
    '/assets/aistudio/Requisitos_para_fotograf_a_de_carnet__1__90eb9817.png',
  ])
);

const PHOTO_RULES = [
  {
    title: 'De frente tipo pasaporte',
    desc: 'Rostro centrado, mirando directamente a la cámara y completamente visible.',
  },
  {
    title: 'Peinado ordenado y rostro despejado',
    desc: 'El cabello debe estar bien peinado o recogido; el pelo no debe tapar ni cubrir los ojos ni el rostro.',
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

const BG_COLOR_OPTIONS: { value: BackgroundPreset; label: string; swatchClass: string }[] = [
  { value: '#FFFFFF', label: 'Blanco', swatchClass: 'bg-white border-slate-300' },
  { value: '#F1F5F9', label: 'Gris claro', swatchClass: 'bg-slate-100 border-slate-300' },
  { value: '#E0F2FE', label: 'Celeste', swatchClass: 'bg-sky-100 border-sky-300' },
  {
    value: 'transparent',
    label: 'Sin fondo',
    swatchClass:
      'bg-[linear-gradient(45deg,#cbd5e1_25%,transparent_25%,transparent_75%,#cbd5e1_75%),linear-gradient(45deg,#cbd5e1_25%,#fff_25%,#fff_75%,#cbd5e1_75%)] bg-[length:8px_8px] bg-[position:0_0,4px_4px] border-slate-300',
  },
];

type CameraPermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported';
type CameraErrorKind = 'no-device' | 'permission-denied' | 'in-use' | 'unsupported' | 'other' | null;

export default function CarnetPhotoCaptureModal({
  isOpen,
  onClose,
  onPhotoReady,
  title = 'Fotografía Oficial para Carnet',
  initialStep = 'guidelines',
  initialImageSrc = null,
  initialFallbackSrc = null,
}: CarnetPhotoCaptureModalProps) {
  const { role } = useAuth();
  const isAdminUser = role === 'admin' || role === 'superadmin';
  const minRequiredScore = isAdminUser ? 50 : 98;

  const [step, setStep] = useState<'guidelines' | 'camera' | 'crop'>(initialStep);
  const [zoomGuideModal, setZoomGuideModal] = useState(false);
  const [guideImgIndex, setGuideImgIndex] = useState(0);
  const [guideImgFailed, setGuideImgFailed] = useState(false);
  const [guideViewMode, setGuideViewMode] = useState<'visual' | 'image'>('image');

  // Hardware & Permission detection state
  const [checkingHardware, setCheckingHardware] = useState(false);
  const [hasCameraHardware, setHasCameraHardware] = useState<boolean | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [permissionState, setPermissionState] = useState<CameraPermissionState>('prompt');

  // Camera state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraErrorKind, setCameraErrorKind] = useState<CameraErrorKind>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [requestingCamera, setRequestingCamera] = useState(false);

  // Cropper & Local Editor state
  const [originalImageSrc, setOriginalImageSrc] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loadingInitialImage, setLoadingInitialImage] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropShape, setCropShape] = useState<'round' | 'rect'>('round');
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [processingCrop, setProcessingCrop] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Local Zero-Token Photo Quality Analysis state
  const [analysis, setAnalysis] = useState<CarnetPhotoAnalysis | null>(null);
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);

  // Local Zero-Token Background Replacement state
  const [bgColor, setBgColor] = useState<BackgroundPreset>('#FFFFFF');
  const [bgThreshold, setBgThreshold] = useState<number>(0.5);
  const [bgFeather, setBgFeather] = useState<number>(1.5);
  const [bgReplaced, setBgReplaced] = useState(false);
  const [replacingBg, setReplacingBg] = useState(false);
  const [showBgAdvanced, setShowBgAdvanced] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const detectCameraHardwareAndPermissions = useCallback(async () => {
    setCheckingHardware(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasCameraHardware(false);
        setPermissionState('unsupported');
        setVideoDevices([]);
        return { hasHardware: false, devices: [] as MediaDeviceInfo[] };
      }

      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
          if (permStatus.state === 'granted' || permStatus.state === 'denied' || permStatus.state === 'prompt') {
            setPermissionState(permStatus.state);
          }
          permStatus.onchange = () => {
            if (
              permStatus.state === 'granted' ||
              permStatus.state === 'denied' ||
              permStatus.state === 'prompt'
            ) {
              setPermissionState(permStatus.state);
            }
          };
        } catch {
          // Safari/Firefox may not support permissions.query({ name: 'camera' })
        }
      }

      let inputs: MediaDeviceInfo[] = [];
      if (navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        inputs = devices.filter((d) => d.kind === 'videoinput');
        setVideoDevices(inputs);
        setHasCameraHardware(inputs.length > 0);
        if (inputs.length > 0 && !selectedDeviceId) {
          const firstWithId = inputs.find((d) => d.deviceId);
          if (firstWithId) setSelectedDeviceId(firstWithId.deviceId);
        }
      } else {
        setHasCameraHardware(true);
      }

      return { hasHardware: inputs.length > 0 || !navigator.mediaDevices.enumerateDevices, devices: inputs };
    } catch (err) {
      console.warn('Error verificando hardware de cámara:', err);
      setHasCameraHardware(null);
      return { hasHardware: true, devices: [] as MediaDeviceInfo[] };
    } finally {
      setCheckingHardware(false);
    }
  }, [selectedDeviceId]);

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
    async (mode: 'user' | 'environment', explicitDeviceId?: string) => {
      stopCameraStream();
      setCameraError(null);
      setCameraErrorKind(null);
      setCameraReady(false);
      setRequestingCamera(true);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraErrorKind('unsupported');
        setCameraError(
          'Tu navegador o contexto actual no permite acceso directo a la cámara (requiere HTTPS o navegador compatible). Puedes subir una fotografía desde archivo.'
        );
        setRequestingCamera(false);
        return;
      }

      try {
        // Verify hardware first when enumerateDevices is supported
        if (navigator.mediaDevices.enumerateDevices) {
          const allDevs = await navigator.mediaDevices.enumerateDevices();
          const videoDevs = allDevs.filter((d) => d.kind === 'videoinput');
          setVideoDevices(videoDevs);
          setHasCameraHardware(videoDevs.length > 0);
          if (videoDevs.length === 0) {
            setCameraErrorKind('no-device');
            setCameraError(
              'No se detectó ninguna cámara física conectada en este dispositivo. Conecta una cámara web o sube una fotografía desde tu equipo.'
            );
            setRequestingCamera(false);
            return;
          }
        }

        const videoConstraints: MediaTrackConstraints = explicitDeviceId
          ? {
              deviceId: { exact: explicitDeviceId },
              width: { ideal: 1280 },
              height: { ideal: 960 },
            }
          : {
              facingMode: mode,
              width: { ideal: 1280 },
              height: { ideal: 960 },
            };

        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });

        streamRef.current = stream;
        setPermissionState('granted');
        setHasCameraHardware(true);

        // Refresh device labels & active deviceId now that permission is granted
        if (navigator.mediaDevices.enumerateDevices) {
          const updatedDevs = await navigator.mediaDevices.enumerateDevices();
          const updatedVideoDevs = updatedDevs.filter((d) => d.kind === 'videoinput');
          setVideoDevices(updatedVideoDevs);
          const activeTrack = stream.getVideoTracks()[0];
          const activeSettings = activeTrack?.getSettings?.();
          if (activeSettings?.deviceId) {
            setSelectedDeviceId(activeSettings.deviceId);
          }
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(() => {});
            setCameraReady(true);
          };
        }
      } catch (err: any) {
        console.error('Camera error:', err);
        const errName = err?.name || '';
        if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError' || errName === 'OverconstrainedError') {
          setHasCameraHardware(false);
          setCameraErrorKind('no-device');
          setCameraError(
            'No se encontró una cámara disponible o compatible en tu dispositivo. Verifica que esté conectada o sube una fotografía desde archivo.'
          );
        } else if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError' || errName === 'SecurityError') {
          setPermissionState('denied');
          setCameraErrorKind('permission-denied');
          setCameraError(
            'Permiso de cámara denegado por el navegador o sistema. Haz clic en el icono de candado/cámara en la barra de direcciones para permitir el acceso y presiona "Solicitar Permisos".'
          );
        } else if (errName === 'NotReadableError' || errName === 'TrackStartError' || errName === 'AbortError') {
          setCameraErrorKind('in-use');
          setCameraError(
            'La cámara está siendo utilizada por otra aplicación o pestaña. Cierra el otro programa e intenta nuevamente.'
          );
        } else {
          setCameraErrorKind('other');
          setCameraError(
            'No se pudo inicializar la cámara. Verifica los permisos del navegador o sube una fotografía desde tu dispositivo.'
          );
        }
      } finally {
        setRequestingCamera(false);
      }
    },
    [stopCameraStream]
  );

  const loadNewImageForEdit = useCallback((dataUrl: string) => {
    setOriginalImageSrc(dataUrl);
    setImageSrc(dataUrl);
    setBgReplaced(false);
    setAnalysis(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setStep('crop');
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!isOpen) {
      stopCameraStream();
      setStep(initialStep);
      setOriginalImageSrc(null);
      setImageSrc(null);
      setLoadingInitialImage(false);
      setBgReplaced(false);
      setAnalysis(null);
      setCameraError(null);
      setCameraErrorKind(null);
      setModalError(null);
      setZoomGuideModal(false);
      setShowBgAdvanced(false);
    } else {
      setModalError(null);
      detectCameraHardwareAndPermissions();
      if (initialImageSrc || initialFallbackSrc) {
        setLoadingInitialImage(true);
        setStep('crop');
        loadImageSafelyAsDataUrl(initialImageSrc, initialFallbackSrc)
          .then((safeUrl) => {
            if (cancelled) return;
            if (safeUrl) {
              loadNewImageForEdit(safeUrl);
            } else {
              setModalError('No se pudo cargar la fotografía actual para editarla. Puedes subir una nueva fotografía.');
              setStep('guidelines');
            }
          })
          .catch(() => {
            if (cancelled) return;
            setModalError('No se pudo cargar la fotografía actual. Puedes seleccionar un archivo nuevo.');
            setStep('guidelines');
          })
          .finally(() => {
            if (!cancelled) setLoadingInitialImage(false);
          });
      } else {
        setStep(initialStep === 'crop' ? 'guidelines' : initialStep);
        if (initialStep === 'camera') {
          startCamera(facingMode);
        }
      }
    }
    return () => {
      cancelled = true;
      stopCameraStream();
    };
  }, [isOpen, initialStep, initialImageSrc, initialFallbackSrc]);

  // Ejecutar análisis local automático cada vez que cambia la imagen o el recorte (sin tokens de IA)
  useEffect(() => {
    if (!isOpen || step !== 'crop' || !imageSrc) return;
    let cancelled = false;
    setAnalyzingPhoto(true);
    const timer = window.setTimeout(async () => {
      try {
        const result = await analyzeCarnetPhoto(imageSrc, croppedAreaPixels);
        if (!cancelled) {
          setAnalysis(result);
        }
      } catch (err) {
        console.warn('No se pudo analizar la fotografía localmente:', err);
      } finally {
        if (!cancelled) setAnalyzingPhoto(false);
      }
    }, 260);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, step, imageSrc, croppedAreaPixels]);

  useEffect(() => {
    if (!isOpen || !navigator.mediaDevices?.addEventListener) return;
    const handleDeviceChange = () => {
      detectCameraHardwareAndPermissions();
    };
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [isOpen, detectCameraHardwareAndPermissions]);

  const handleOpenCamera = () => {
    setModalError(null);
    setStep('camera');
    startCamera(facingMode, selectedDeviceId || undefined);
  };

  const handleToggleCamera = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    setSelectedDeviceId('');
    startCamera(nextMode);
  };

  const handleDeviceSelect = (devId: string) => {
    setSelectedDeviceId(devId);
    startCamera(facingMode, devId || undefined);
  };

  const handleCaptureFromCamera = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (facingMode === 'user' && !selectedDeviceId) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
    stopCameraStream();
    loadNewImageForEdit(dataUrl);
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setModalError(null);
    if (file.size > 10 * 1024 * 1024) {
      setModalError('La imagen seleccionada supera el límite máximo permitido de 10 MB.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      loadNewImageForEdit(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleReplaceBackground = async (
    targetColor: BackgroundPreset = bgColor,
    customThreshold: number = bgThreshold,
    customFeather: number = bgFeather
  ) => {
    const source = originalImageSrc || imageSrc;
    if (!source) return;
    setReplacingBg(true);
    setModalError(null);
    try {
      const res = await replaceCarnetPhotoBackground(source, {
        backgroundColor: targetColor,
        threshold: customThreshold,
        feather: customFeather,
      });
      setBgColor(targetColor);
      setImageSrc(res.dataUrl);
      setBgReplaced(true);
    } catch (err: any) {
      console.error('Error reemplazando fondo localmente:', err);
      setModalError('No se pudo recortar el fondo de esta imagen. Intenta con una foto más clara o usa el recorte normal.');
    } finally {
      setReplacingBg(false);
    }
  };

  const handleRestoreOriginalBackground = () => {
    if (!originalImageSrc) return;
    setImageSrc(originalImageSrc);
    setBgReplaced(false);
  };

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const meetsScoreRequirement = Boolean(analysis && !analyzingPhoto && analysis.score >= minRequiredScore);

  const handleApplyCrop = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    if (!analysis || analyzingPhoto || analysis.score < minRequiredScore) {
      setModalError(
        `La fotografía debe alcanzar al menos ${minRequiredScore}% de cumplimiento para poder aplicarla (actual: ${
          analysis ? `${analysis.score}%` : 'evaluando...'
        }).`
      );
      return;
    }
    setProcessingCrop(true);
    setModalError(null);
    try {
      const preserveTransparency = bgReplaced && bgColor === 'transparent';
      const cropped = await getCroppedImgResult(
        imageSrc,
        croppedAreaPixels,
        0,
        900,
        preserveTransparency
      );
      if (!cropped || !cropped.blob || cropped.blob.size < 100) {
        throw new Error('El recorte generó una imagen vacía.');
      }
      const ext = preserveTransparency ? 'png' : 'jpg';
      const mime = preserveTransparency ? 'image/png' : 'image/jpeg';
      const file = new File([cropped.blob], `carnet_foto_${Date.now()}.${ext}`, { type: mime });
      stopCameraStream();
      onPhotoReady(file, cropped.dataUrl, {
        analysis,
        backgroundReplaced: bgReplaced,
        backgroundColor: bgReplaced ? bgColor : undefined,
      });
      onClose();
    } catch (err) {
      console.error('Error cropping photo:', err);
      setModalError('No se pudo recortar la fotografía. Intente nuevamente con otra imagen.');
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
      <div
        className={`bg-white rounded-3xl shadow-2xl ${
          step === 'crop' ? 'max-w-5xl' : 'max-w-4xl'
        } w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150`}
      >
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
                {step === 'camera' && 'Encuadra tu rostro despejado y hombros dentro de la máscara guía tipo pasaporte'}
                {step === 'crop' && 'Recorta, analiza la calidad y opcionalmente reemplaza el fondo sin consumir tokens'}
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
          {modalError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{modalError}</span>
              </div>
              <button type="button" onClick={() => setModalError(null)} className="text-rose-500 hover:text-rose-700 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* STEP 1: LINEAMIENTOS Y MÉTODO */}
          {step === 'guidelines' && (
            <div className="space-y-5">
              {/* Official Guidelines Image + Recreated Visual Guide */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="px-4 py-3 bg-emerald-900 text-white flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
                    <span className="text-xs font-bold tracking-wide uppercase">
                      Guía Oficial de Fotografía para Carnet — Cruz Verde Salvadoreña
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {!guideImgFailed && (
                      <button
                        type="button"
                        onClick={() =>
                          setGuideViewMode((m) => (m === 'image' ? 'visual' : 'image'))
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-2xs font-semibold transition-colors cursor-pointer"
                      >
                        {guideViewMode === 'image' ? 'Vista Fácil (Interactiva)' : 'Ver Imagen Oficial'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setZoomGuideModal(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-2xs font-semibold transition-colors cursor-pointer"
                    >
                      <Maximize2 className="w-3 h-3" />
                      Ampliar Guía
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-slate-100/70">
                  {guideViewMode === 'image' && !guideImgFailed ? (
                    <button
                      type="button"
                      onClick={() => setZoomGuideModal(true)}
                      className="w-full block rounded-xl overflow-hidden border border-slate-200 bg-white hover:opacity-95 transition-opacity cursor-zoom-in"
                      title="Clic para ampliar imagen de lineamientos"
                    >
                      <img
                        src={GUIDE_IMAGE_CANDIDATES[guideImgIndex]}
                        alt="Requisitos para Fotografía de Carnet Cruz Verde Salvadoreña"
                        onError={() => {
                          if (guideImgIndex < GUIDE_IMAGE_CANDIDATES.length - 1) {
                            setGuideImgIndex((i) => i + 1);
                          } else {
                            setGuideImgFailed(true);
                          }
                        }}
                        className="w-full h-auto max-h-[380px] object-contain mx-auto"
                      />
                    </button>
                  ) : (
                    <CarnetPhotoGuideVisual />
                  )}
                </div>

                {/* Summary Checklist (visible when showing raw image for quick text scan) */}
                {guideViewMode === 'image' && !guideImgFailed && (
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
                )}
              </div>

              {/* Camera Hardware & Permission Diagnostic Bar */}
              <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2.5">
                  {checkingHardware ? (
                    <>
                      <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
                      <span className="text-slate-600">Detectando hardware de cámara disponible...</span>
                    </>
                  ) : hasCameraHardware === false ? (
                    <>
                      <VideoOff className="w-4 h-4 text-rose-500 shrink-0" />
                      <div>
                        <span className="font-bold text-rose-700">No se detectó cámara física en este dispositivo</span>
                        <span className="text-slate-500 ml-1.5">
                          (Puedes conectar una cámara o usar &quot;Subir Fotografía desde Archivo&quot;)
                        </span>
                      </div>
                    </>
                  ) : permissionState === 'denied' ? (
                    <>
                      <KeyRound className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <span className="font-bold text-amber-800">Permiso de cámara bloqueado por el navegador</span>
                        <span className="text-slate-500 ml-1.5">
                          Al pulsar &quot;Tomar Foto&quot; te guiaremos para habilitarlo.
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <Video className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-bold text-slate-800">
                          {videoDevices.length > 0
                            ? `${videoDevices.length} ${videoDevices.length === 1 ? 'cámara detectada' : 'cámaras detectadas'}`
                            : 'Cámara compatible detectada'}
                        </span>
                        <span className="text-slate-500 ml-1.5">
                          • {permissionState === 'granted' ? 'Permiso concedido' : 'Se solicitará permiso al abrir'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={detectCameraHardwareAndPermissions}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${checkingHardware ? 'animate-spin' : ''}`} />
                  Re-detectar
                </button>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleOpenCamera}
                  className={`flex items-center justify-center gap-3 p-4 rounded-2xl shadow-md transition-all cursor-pointer group ${
                    hasCameraHardware === false
                      ? 'bg-slate-700 hover:bg-slate-800 text-white'
                      : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold">
                      {hasCameraHardware === false ? 'Verificar y Usar Cámara' : 'Tomar Foto con Cámara'}
                    </p>
                    <p className="text-[11px] text-emerald-100">
                      {permissionState === 'granted'
                        ? 'Cámara lista con máscara pasaporte / ID'
                        : 'Solicitará permiso de cámara y abrirá máscara guía'}
                    </p>
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

                <div className="flex items-center flex-wrap gap-2">
                  {videoDevices.length > 1 && videoDevices.some((d) => d.label) && (
                    <select
                      value={selectedDeviceId}
                      onChange={(e) => handleDeviceSelect(e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 max-w-[200px]"
                    >
                      {videoDevices.map((dev, i) => (
                        <option key={dev.deviceId || i} value={dev.deviceId}>
                          {dev.label || `Cámara ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  )}

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
                  {cameraErrorKind === 'permission-denied' ? (
                    <KeyRound className="w-12 h-12 text-amber-500 mx-auto" />
                  ) : (
                    <VideoOff className="w-12 h-12 text-rose-500 mx-auto" />
                  )}
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      {cameraErrorKind === 'no-device' && 'No se detectó cámara en el dispositivo'}
                      {cameraErrorKind === 'permission-denied' && 'Permiso de cámara requerido'}
                      {cameraErrorKind === 'in-use' && 'Cámara ocupada por otra aplicación'}
                      {(cameraErrorKind === 'unsupported' || cameraErrorKind === 'other' || !cameraErrorKind) &&
                        'Cámara no disponible'}
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto leading-relaxed">{cameraError}</p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => startCamera(facingMode, selectedDeviceId || undefined)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      {cameraErrorKind === 'permission-denied' ? 'Solicitar Permisos Nuevamente' : 'Reintentar Detección'}
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-xs font-semibold text-white cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
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
                    className={`w-full h-full object-cover ${facingMode === 'user' && !selectedDeviceId ? '-scale-x-100' : ''}`}
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
                    <span className="px-3 py-1 rounded-full bg-slate-950/80 border border-emerald-400/50 text-white text-[11px] font-semibold backdrop-blur-xs text-center">
                      Rostro en el óvalo, cabello despejado sin tapar la cara, fondo liso y camisa blanca
                    </span>
                  </div>

                  {!cameraReady && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/75 text-white text-xs font-medium px-4 text-center">
                      <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
                      <span>
                        {requestingCamera
                          ? 'Solicitando acceso a la cámara al dispositivo...'
                          : 'Iniciando vista previa de cámara...'}
                      </span>
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

          {/* STEP 3: CROPPER + LOCAL QUALITY ANALYSIS + LOCAL BACKGROUND REPLACEMENT */}
          {step === 'crop' && loadingInitialImage && (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-600">
              <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin" />
              <p className="text-xs font-semibold">Cargando fotografía para recorte y análisis...</p>
            </div>
          )}

          {step === 'crop' && !loadingInitialImage && imageSrc && (
            <div className="space-y-4">
              {/* Top toolbar */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setStep('guidelines')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer whitespace-nowrap"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Lineamientos
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer whitespace-nowrap"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Subir Otra
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenCamera}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer whitespace-nowrap"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Tomar con Cámara
                  </button>
                </div>

                {/* Shape preview toggle */}
                <div className="inline-flex bg-slate-200/80 p-0.5 rounded-xl text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setCropShape('round')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      cropShape === 'round' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Vista Carnet
                  </button>
                  <button
                    type="button"
                    onClick={() => setCropShape('rect')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      cropShape === 'rect' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Cuadrado
                  </button>
                </div>
              </div>

              {/* 2-Column Workspace: Cropper Left, Tools + Analysis Right */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* Left: Interactive Cropper & Zoom */}
                <div className="lg:col-span-7 space-y-3">
                  <div className="relative w-full h-[320px] sm:h-[390px] rounded-2xl overflow-hidden bg-slate-900 border border-slate-800">
                    <Cropper
                      image={imageSrc}
                      crop={crop}
                      zoom={zoom}
                      aspect={1}
                      cropShape={cropShape}
                      showGrid={true}
                      onCropChange={setCrop}
                      onCropComplete={onCropComplete}
                      onZoomChange={setZoom}
                    />
                    {replacingBg && (
                      <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 text-white z-20">
                        <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                        <p className="text-xs font-semibold">Recortando persona y reemplazando fondo localmente...</p>
                      </div>
                    )}
                  </div>

                  {/* Zoom bar */}
                  <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200 flex items-center gap-3">
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
                    <span className="text-xs font-mono tabular-nums text-slate-600 w-10 text-right">
                      {zoom.toFixed(1)}x
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCrop({ x: 0, y: 0 });
                        setZoom(1);
                      }}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 cursor-pointer whitespace-nowrap"
                    >
                      Centrar
                    </button>
                  </div>
                </div>

                {/* Right: Background Replacement + Local Quality Analysis */}
                <div className="lg:col-span-5 space-y-3">
                  {/* Card 1: Reemplazar fondo local (sin tokens de IA) */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-3.5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Scissors className="w-4 h-4 text-emerald-700 shrink-0" />
                        <h4 className="text-xs font-bold text-slate-900">Reemplazar Fondo (Recorte Local)</h4>
                      </div>
                      {bgReplaced && (
                        <button
                          type="button"
                          onClick={handleRestoreOriginalBackground}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                        >
                          <Undo2 className="w-3 h-3" />
                          Original
                        </button>
                      )}
                    </div>

                    {/* Color swatches */}
                    <div className="grid grid-cols-4 gap-1.5">
                      {BG_COLOR_OPTIONS.map((opt) => {
                        const selected = bgColor === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            disabled={replacingBg}
                            onClick={() => {
                              setBgColor(opt.value);
                              if (bgReplaced) {
                                handleReplaceBackground(opt.value, bgThreshold, bgFeather);
                              }
                            }}
                            className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border text-[10px] font-semibold transition-all cursor-pointer ${
                              selected
                                ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900'
                                : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-md border flex items-center justify-center ${opt.swatchClass}`}
                            >
                              {selected && <Check className="w-3 h-3 text-emerald-700 stroke-[3]" />}
                            </span>
                            <span className="truncate w-full text-center">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={replacingBg}
                        onClick={() => handleReplaceBackground(bgColor, bgThreshold, bgFeather)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Scissors className="w-3.5 h-3.5" />
                        {replacingBg
                          ? 'Recortando...'
                          : bgReplaced
                          ? 'Volver a aplicar recorte'
                          : 'Recortar persona y cambiar fondo'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowBgAdvanced((v) => !v)}
                        className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                          showBgAdvanced
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                            : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900'
                        }`}
                        title="Ajuste fino de bordes del recorte"
                      >
                        <SlidersHorizontal className="w-4 h-4" />
                      </button>
                    </div>

                    {showBgAdvanced && (
                      <div className="pt-2 border-t border-slate-100 space-y-2.5 text-[11px]">
                        <div className="space-y-1">
                          <div className="flex justify-between text-slate-600 font-medium">
                            <span>Sensibilidad de silueta</span>
                            <span className="font-mono tabular-nums">{Math.round(bgThreshold * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min={0.25}
                            max={0.78}
                            step={0.03}
                            value={bgThreshold}
                            onChange={(e) => {
                              const nextVal = Number(e.target.value);
                              setBgThreshold(nextVal);
                              if (bgReplaced) handleReplaceBackground(bgColor, nextVal, bgFeather);
                            }}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-slate-600 font-medium">
                            <span>Suavizado de bordes</span>
                            <span className="font-mono tabular-nums">{bgFeather.toFixed(1)} px</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={3}
                            step={0.5}
                            value={bgFeather}
                            onChange={(e) => {
                              const nextVal = Number(e.target.value);
                              setBgFeather(nextVal);
                              if (bgReplaced) handleReplaceBackground(bgColor, bgThreshold, nextVal);
                            }}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card 2: Análisis automático de calidad (local, sin tokens) */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ScanFace className="w-4 h-4 text-emerald-700 shrink-0" />
                        <h4 className="text-xs font-bold text-slate-900">Evaluación de Lineamientos</h4>
                      </div>
                      {analysis && !analyzingPhoto && (
                        <span
                          className={`text-xs font-bold tabular-nums ${
                            analysis.status === 'aceptable'
                              ? 'text-emerald-700'
                              : analysis.status === 'observaciones'
                              ? 'text-amber-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {analysis.status === 'aceptable'
                            ? 'Aceptable'
                            : analysis.status === 'observaciones'
                            ? 'Con observaciones'
                            : 'No recomendable'}{' '}
                          · {analysis.score}%
                        </span>
                      )}
                    </div>

                    {analyzingPhoto && !analysis ? (
                      <div className="py-4 flex items-center justify-center gap-2 text-xs text-slate-500">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                        Analizando enfoque, fondo, iluminación y rostro...
                      </div>
                    ) : analysis ? (
                      <div className="space-y-2">
                        <p
                          className={`text-[11px] font-medium px-2.5 py-1.5 rounded-xl border ${
                            analysis.status === 'aceptable'
                              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                              : analysis.status === 'observaciones'
                              ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                              : 'bg-rose-50/70 border-rose-200 text-rose-900'
                          }`}
                        >
                          {analysis.summary}
                        </p>

                        <div className="divide-y divide-slate-100">
                          {analysis.checks.map((chk) => (
                            <div key={chk.id} className="py-1.5 flex items-start gap-2">
                              {chk.status === 'pass' ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                              ) : chk.status === 'warn' ? (
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                              ) : (
                                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-bold text-slate-800 leading-tight">{chk.label}</p>
                                <p className="text-[11px] text-slate-500 leading-snug">{chk.message}</p>
                              </div>
                            </div>
                          ))}
                        </div>

                        {analysis.suggestBackgroundReplace && !bgReplaced && (
                          <button
                            type="button"
                            disabled={replacingBg}
                            onClick={() => handleReplaceBackground('#FFFFFF', bgThreshold, bgFeather)}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            <Scissors className="w-3.5 h-3.5" />
                            Aplicar fondo blanco automáticamente
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Footer Apply Bar */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between flex-wrap gap-3">
                <div className="text-[11px] space-y-0.5 min-w-0 flex-1">
                  {analyzingPhoto ? (
                    <p className="text-slate-500 font-medium">
                      Evaluando cumplimiento mínimo ({minRequiredScore}%)...
                    </p>
                  ) : analysis && analysis.score >= minRequiredScore ? (
                    <p className="text-emerald-700 font-semibold tabular-nums">
                      Cumple el requisito mínimo ({analysis.score}% de {minRequiredScore}%{isAdminUser ? ' · Modo Admin' : ''}).{' '}
                      {bgReplaced
                        ? `Fondo ${BG_COLOR_OPTIONS.find((o) => o.value === bgColor)?.label || bgColor} listo para aplicar.`
                        : 'Lista para aplicar.'}
                    </p>
                  ) : (
                    <p className="text-rose-700 font-semibold tabular-nums">
                      Requiere mínimo {minRequiredScore}% para habilitar el botón
                      {isAdminUser ? ' (Admin)' : ''} — actual: {analysis ? `${analysis.score}%` : '0%'}. Ajusta el encuadre o reemplaza el fondo.
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={processingCrop || replacingBg || !meetsScoreRequirement}
                    onClick={handleApplyCrop}
                    title={
                      meetsScoreRequirement
                        ? 'Aplicar fotografía recortada'
                        : `Se requiere mínimo ${minRequiredScore}% de cumplimiento para aplicar esta fotografía`
                    }
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
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
            {guideViewMode === 'image' && !guideImgFailed ? (
              <img
                src={GUIDE_IMAGE_CANDIDATES[guideImgIndex]}
                alt="Guía de Fotografía de Carnet Cruz Verde Salvadoreña"
                className="w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl bg-white"
              />
            ) : (
              <div className="max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl">
                <CarnetPhotoGuideVisual />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

