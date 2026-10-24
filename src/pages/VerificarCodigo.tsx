import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, IdCard, ArrowLeft, ArrowRight, QrCode, AlertCircle, Search, Camera, X, Upload } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';

export default function VerificarCodigo() {
  const { user } = useAuth();
  const { logos } = useSettings();
  const navigate = useNavigate();

  const [carnet, setCarnet] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  // Auto-format carnet: CVS-0000-AA (exacto como en SolicitudCarnet)
  const handleCarnetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (val.startsWith('CVS')) {
      val = val.substring(3);
    }
    
    let formatted = 'CVS';
    if (val.length > 0) formatted += '-' + val.substring(0, 4);
    if (val.length > 4) formatted += '-' + val.substring(4, 6);
    
    setCarnet(formatted);
  };

  const handleVerifyCarnet = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCarnet = carnet.trim();
    if (cleanCarnet.length < 5) {
      setErrorMsg('Ingresa el código oficial de carnet (ejemplo: CVS-1024-SV)');
      return;
    }
    navigate(`/v/${encodeURIComponent(cleanCarnet)}`);
  };

  // Extraer el carnet o token a partir del contenido escaneado
  const processQrResult = (qrText: string) => {
    if (!qrText) return;
    let code = qrText.trim();
    // Si viene en formato URL (ej: https://.../v/CVS-1024-SV o /verificar/CVS-1024-SV)
    if (code.includes('/v/')) {
      code = code.split('/v/').pop() || code;
    } else if (code.includes('/verificar/')) {
      code = code.split('/verificar/').pop() || code;
    }
    code = code.split('?')[0].split('#')[0].trim();
    
    closeScanner();
    navigate(`/v/${encodeURIComponent(code)}`);
  };

  // Iniciar cámara al abrir modal de scanner
  const startCamera = async () => {
    setCameraError(null);
    setShowScannerModal(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Su navegador no permite acceso directo a la cámara. Puede subir una foto del código QR.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Iniciar detector de código de barras / QR nativo si el navegador lo soporta
      if ('BarcodeDetector' in window) {
        try {
          const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
          scanIntervalRef.current = window.setInterval(async () => {
            if (videoRef.current && videoRef.current.readyState >= 2) {
              try {
                const barcodes = await barcodeDetector.detect(videoRef.current);
                if (barcodes.length > 0 && barcodes[0].rawValue) {
                  processQrResult(barcodes[0].rawValue);
                }
              } catch (e) {
                // frame detection error ignore
              }
            }
          }, 350);
        } catch (e) {
          console.warn('BarcodeDetector no soportado nativamente');
        }
      }
    } catch (err: any) {
      console.warn('Error accediendo a la cámara:', err);
      setCameraError('No se pudo acceder a la cámara. Por favor autorice los permisos o suba una foto del QR.');
    }
  };

  const closeScanner = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowScannerModal(false);
    setCameraError(null);
  };

  useEffect(() => {
    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Procesar archivo de imagen con código QR
  const handleFileQr = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if ('BarcodeDetector' in window) {
      try {
        const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        const img = new Image();
        img.src = URL.createObjectURL(file);
        await img.decode();
        const barcodes = await barcodeDetector.detect(img);
        if (barcodes.length > 0 && barcodes[0].rawValue) {
          processQrResult(barcodes[0].rawValue);
          return;
        }
        alert('No se detectó un código QR legible en la imagen subida.');
      } catch (err) {
        alert('No se pudo leer el código QR de la imagen.');
      }
    } else {
      alert('Para procesar imágenes de QR, use un navegador compatible con cámara o ingrese el código del carnet.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between">
      <div className="flex-grow py-8 sm:px-6 lg:px-8">
        
        {/* Barra superior de navegación */}
        <div className="mb-4 flex justify-between items-center sm:mx-auto sm:w-full sm:max-w-xl px-4 sm:px-0">
          {user ? (
            <Link to="/" className="inline-flex items-center text-sm font-medium text-emerald-700 hover:text-emerald-800">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Volver al Sistema
            </Link>
          ) : (
            <div className="w-full flex justify-between items-center">
              <Link to="/solicitud-carnet" className="inline-flex items-center text-sm font-medium text-emerald-700 hover:text-emerald-800">
                <IdCard className="mr-1 h-4 w-4" />
                Solicitar Carnet
              </Link>
              <Link to="/login" className="inline-flex items-center text-sm font-medium text-emerald-700 hover:text-emerald-800">
                Iniciar Sesión
              </Link>
            </div>
          )}
        </div>

        {/* Encabezado Institucional Centrado */}
        <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center mb-8">
          {logos?.verificacion ? (
            <img 
              src={logos.verificacion} 
              alt="Logo Institucional Cruz Verde" 
              className="h-20 w-auto mx-auto mb-4 object-contain rounded p-1" 
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4 shadow-sm border border-emerald-200">
              <ShieldCheck className="w-10 h-10 text-emerald-600" />
            </div>
          )}
          <h1 className="text-3xl font-extrabold text-emerald-800 flex items-center justify-center mt-2 tracking-tight">
            Verificación de Carnet Institucional
          </h1>
          <p className="mt-2 text-sm text-gray-600 max-w-md mx-auto">
            Consulte la autenticidad, vigencia y estado oficial del personal voluntario y socorrista de Cruz Verde Salvadoreña.
          </p>
        </div>

        {/* Tarjeta de Formulario Principal */}
        <div className="sm:mx-auto sm:w-full sm:max-w-xl">
          <div className="bg-white py-8 px-4 shadow-md sm:rounded-2xl sm:px-10 border border-gray-100 space-y-6">
            
            {/* Botón Destacado: Escanear QR */}
            <div>
              <button
                type="button"
                onClick={startCamera}
                className="w-full flex items-center justify-center py-3.5 px-4 rounded-xl border-2 border-dashed border-emerald-500 bg-emerald-50/70 hover:bg-emerald-100/80 text-emerald-800 font-bold text-sm transition-all shadow-2xs group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center mr-3 group-hover:scale-105 transition-transform shadow-xs">
                  <QrCode className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="block text-sm font-extrabold text-emerald-900 leading-tight">Escanear QR</span>
                  <span className="block text-3xs font-medium text-emerald-700">Abrir cámara o lector automático de credencial</span>
                </div>
              </button>
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink mx-4 text-2xs uppercase tracking-wider text-gray-400 font-bold bg-white px-2">
                O ingrese el carnet manualmente
              </span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            <form onSubmit={handleVerifyCarnet} className="space-y-5">
              <div>
                <label htmlFor="carnet" className="block text-sm font-semibold text-gray-700 mb-1">
                  Número de Carnet Oficial
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Ingrese el prefijo CVS, los 4 dígitos numéricos y las dos letras de serie.
                </p>
                <div className="relative">
                  <input
                    type="text"
                    name="carnet"
                    id="carnet"
                    required
                    value={carnet}
                    onChange={handleCarnetChange}
                    placeholder="CVS-0000-AA"
                    maxLength={11}
                    autoFocus
                    className="block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-xs placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-lg font-mono tracking-widest text-gray-900 uppercase bg-gray-50/50 text-center font-bold"
                  />
                </div>
                <span className="text-3xs text-gray-400 block mt-1 text-center">
                  Formato requerido: CVS-0000-AA (ejemplo: CVS-1024-SV)
                </span>
              </div>

              {errorMsg && (
                <div className="rounded-xl bg-red-50 p-3.5 border border-red-200 flex items-start space-x-2 text-red-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full flex items-center justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600 transition cursor-pointer"
              >
                <Search className="w-4 h-4 mr-2" />
                <span>Consultar Credencial Oficial</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center text-3xs text-gray-400">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  Validación institucional protegida
                </span>
                <Link to="/solicitud-carnet" className="text-emerald-700 font-semibold hover:underline text-2xs">
                  ¿Necesitas tramitar carnet?
                </Link>
              </div>
            </form>
          </div>
        </div>

      </div>

      {/* Modal Scanner de Cámara / QR */}
      {showScannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-gray-200">
            <div className="p-4 bg-emerald-800 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <QrCode className="w-5 h-5 text-emerald-300" />
                <h3 className="text-sm font-bold">Escanear Código QR de Carnet</h3>
              </div>
              <button
                type="button"
                onClick={closeScanner}
                className="p-1.5 rounded-lg hover:bg-emerald-700 text-emerald-100 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-center">
              {cameraError ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs space-y-3">
                  <p>{cameraError}</p>
                  <label className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer transition">
                    <Upload className="w-4 h-4 mr-2" />
                    Subir foto con Código QR
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileQr} />
                  </label>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden bg-black aspect-square flex items-center justify-center border-2 border-emerald-500 shadow-inner">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {/* Guía visual de escaneo */}
                  <div className="absolute inset-8 border-2 border-dashed border-emerald-400 rounded-2xl pointer-events-none flex items-center justify-center animate-pulse">
                    <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_8px_#34d399]"></div>
                  </div>
                </div>
              )}

              <p className="text-2xs text-gray-500">
                Apunte la cámara hacia el código QR impreso en la credencial de Cruz Verde Salvadoreña para consultar su autenticidad.
              </p>

              <div className="pt-2 flex items-center justify-between gap-3">
                <label className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl cursor-pointer border border-gray-300 transition">
                  <Upload className="w-3.5 h-3.5 mr-1.5 text-gray-600" />
                  Cargar imagen QR
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileQr} />
                </label>
                <button
                  type="button"
                  onClick={closeScanner}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="py-4 text-center text-xs text-gray-500 border-t border-gray-200/60 bg-white/50">
        Cruz Verde Salvadoreña &copy; {new Date().getFullYear()} • Sistema Oficial de Identificación Institucional
      </footer>
    </div>
  );
}
