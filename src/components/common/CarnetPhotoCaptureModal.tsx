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
} from 'lucide-react';
import getCroppedImg from '../../utils/cropImage';

interface CarnetPhotoCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoReady: (file: File, previewUrl: string) => void;
  title?: string;
  initialStep?: 'guidelines' | 'camera';
}

const GUIDE_IMAGE_URL = '/assets/aistudio/Requisitos_para_fotograf_a_de_carnet__1__90eb9817.png';

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

type CameraPermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported';
type CameraErrorKind = 'no-device' | 'permission-denied' | 'in-use' | 'unsupported' | 'other' | null;

export default function CarnetPhotoCaptureModal({
  isOpen,
  onClose,
  onPhotoReady,
  title = 'Fotografía Oficial para Carnet',
  initialStep = 'guidelines',
}: CarnetPhotoCaptureModalProps) {
  const [step, setStep] = useState<'guidelines' | 'camera' | 'crop'>(initialStep);
  const [zoomGuideModal, setZoomGuideModal] = useState(false);

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

  // Cropper state
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [processingCrop, setProcessingCrop] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!isOpen) {
      stopCameraStream();
      setStep(initialStep);
      setImageSrc(null);
      setCameraError(null);
      setCameraErrorKind(null);
      setModalError(null);
      setZoomGuideModal(false);
    } else {
      setStep(initialStep);
      setModalError(null);
      detectCameraHardwareAndPermissions();
      if (initialStep === 'camera') {
        startCamera(facingMode);
      }
    }
    return () => {
      stopCameraStream();
    };
  }, [isOpen, initialStep]);

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
    setImageSrc(dataUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setStep('crop');
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
    setModalError(null);
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
      setModalError('No se pudo recortar la fotografía. Intente nuevamente.');
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
                    <span className="px-3 py-1 rounded-full bg-slate-950/80 border border-emerald-400/50 text-white text-[11px] font-semibold backdrop-blur-xs">
                      Alinea tu rostro en el óvalo y hombros en la guía (fondo blanco, camisa blanca)
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

