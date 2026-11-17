import React, { useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LifeBuoy,
  X,
  Send,
  Upload,
  Image as ImageIcon,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Bug,
  Users,
  Info,
  Building2,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { logActivity } from '../../lib/logger';
import {
  createSoporteTicket,
  SoporteImagen,
  SoporteTicket,
  TipoCasoSoporte,
  TIPOS_CASO_SOPORTE,
  uploadSoporteImage,
} from '../../lib/soporte';

interface SoporteFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (ticket: SoporteTicket) => void;
  hideNavigateButton?: boolean;
}

const CASE_ICONS: Record<TipoCasoSoporte, any> = {
  Sistema: Bug,
  'Registro de elementos': Users,
  'Información': Info,
  'Cambio de seccional de elemento': Building2,
  Otro: HelpCircle,
};

export default function SoporteFormModal({
  isOpen,
  onClose,
  onCreated,
  hideNavigateButton = false,
}: SoporteFormModalProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userName, userSeccionalId, userSeccionalNombre, directorSeccionalId } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [motivo, setMotivo] = useState('');
  const [tipoCaso, setTipoCaso] = useState<TipoCasoSoporte>('Sistema');
  const [descripcion, setDescripcion] = useState('');
  const [imagenes, setImagenes] = useState<SoporteImagen[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdTicket, setCreatedTicket] = useState<SoporteTicket | null>(null);
  const [submitWarning, setSubmitWarning] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setMotivo('');
    setTipoCaso('Sistema');
    setDescripcion('');
    setImagenes([]);
    setErrorMsg(null);
    setCreatedTicket(null);
    setSubmitWarning(null);
  };

  const handleClose = () => {
    if (submitting || uploadingImages) return;
    resetForm();
    onClose();
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    const remainingSlots = 5 - imagenes.length;
    if (remainingSlots <= 0) {
      setErrorMsg('Puedes adjuntar un máximo de 5 imágenes por solicitud.');
      return;
    }

    const validFiles = files.slice(0, remainingSlots).filter((f) => f.type.startsWith('image/'));
    if (validFiles.length === 0) {
      setErrorMsg('Solo se permiten archivos de imagen (PNG, JPG, WebP) como evidencia.');
      return;
    }

    setErrorMsg(null);
    setUploadingImages(true);
    try {
      const uploaded: SoporteImagen[] = [];
      for (const file of validFiles) {
        const imgObj = await uploadSoporteImage(file);
        uploaded.push(imgObj);
      }
      setImagenes((prev) => [...prev, ...uploaded]);
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudieron subir las imágenes adjuntas.');
    } finally {
      setUploadingImages(false);
    }
  };

  const handleRemoveImage = (idx: number) => {
    setImagenes((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo.trim()) {
      setErrorMsg('Ingresa el motivo de soporte.');
      return;
    }
    if (!descripcion.trim()) {
      setErrorMsg('Amplía la información detallando la anomalía o solicitud.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSubmitWarning(null);

    try {
      const originRoute = `${location.pathname}${location.search}`;
      const result = await createSoporteTicket({
        usuario_id: user?.id || null,
        usuario_nombre: userName || user?.email || 'Usuario',
        usuario_email: user?.email || null,
        seccional_id: directorSeccionalId || userSeccionalId || null,
        seccional_nombre: userSeccionalNombre || null,
        motivo: motivo.trim(),
        tipo_caso: tipoCaso,
        descripcion: descripcion.trim(),
        imagenes,
        ruta_origen: originRoute,
      });

      logActivity('create', 'Soporte', result.ticket.id, {
        folio: result.ticket.folio,
        tipo_caso: result.ticket.tipo_caso,
        motivo: result.ticket.motivo,
      }).catch(() => {});

      setCreatedTicket(result.ticket);
      if (result.warning) {
        setSubmitWarning(
          `El ticket se registró localmente, pero Supabase devolvió un aviso (${result.warning}). Si aún no se ejecuta la migración SQL #39, aplícala en Supabase.`
        );
      }
      onCreated?.(result.ticket);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Ocurrió un error al enviar la solicitud de soporte.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
              <LifeBuoy className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold leading-tight truncate">
                Reportar Anomalía o Solicitud de Soporte
              </h2>
              <p className="text-[11px] text-slate-300 truncate">
                Envía detalles e imágenes para que el equipo de soporte atienda tu caso.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        {createdTicket ? (
          <div className="p-6 space-y-5 overflow-y-auto">
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2.5">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-emerald-950">
                ¡Solicitud de Soporte Enviada!
              </h3>
              <p className="text-xs text-emerald-800">
                Tu reporte ha sido registrado con el folio{' '}
                <strong className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-200">
                  {createdTicket.folio}
                </strong>{' '}
                y estado actual <strong>Pendiente</strong>.
              </p>
              <p className="text-[11px] text-emerald-700">
                Podrás revisar el seguimiento, si ya fue finalizado y las notas agregadas desde la pestaña <strong>Soporte</strong>.
              </p>
            </div>

            {submitWarning && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{submitWarning}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Enviar Otro Reporte
              </button>
              {!hideNavigateButton && (
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    navigate('/soporte');
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Ir a Mis Solicitudes de Soporte</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer"
              >
                Listo
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Contexto automático de usuario y pantalla */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
              <span>
                Reporta: <strong className="text-slate-900">{userName || user?.email || 'Usuario'}</strong>
                {userSeccionalNombre ? ` · ${userSeccionalNombre}` : ''}
              </span>
              <span className="font-mono text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                Sección: {location.pathname}
              </span>
            </div>

            {/* Motivo de soporte */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Motivo de Soporte *
              </label>
              <input
                type="text"
                required
                maxLength={140}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: Error al registrar elemento, solicitud de traslado de seccional, falla en pantalla..."
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none"
              />
            </div>

            {/* Tipo de caso */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Tipo de Caso *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TIPOS_CASO_SOPORTE.map((item) => {
                  const Icon = CASE_ICONS[item.value];
                  const active = tipoCaso === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setTipoCaso(item.value)}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-start gap-2.5 ${
                        active
                          ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500 text-emerald-950'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div
                        className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                          active ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold leading-tight">{item.label}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{item.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ampliar texto con información */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Detalle / Ampliar Información *
              </label>
              <textarea
                rows={4}
                required
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder={
                  tipoCaso === 'Cambio de seccional de elemento'
                    ? 'Indica el nombre completo, número de carnet o DUI del elemento, su seccional actual y la seccional a la que se solicita trasladar...'
                    : 'Describe claramente la anomalía, mensaje de error, nombre o DUI involucrado y pasos realizados...'
                }
                className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none resize-y min-h-[100px]"
              />
            </div>

            {/* Adjuntar imágenes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 inline-flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-emerald-700" />
                  Adjuntar Imágenes de Evidencia (Opcional · Máx. 5)
                </label>
                <span className="text-[11px] text-slate-500 font-medium">
                  {imagenes.length}/5 adjuntas
                </span>
              </div>

              <div
                onClick={() => !uploadingImages && imagenes.length < 5 && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-3.5 text-center transition ${
                  imagenes.length >= 5
                    ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                    : 'border-slate-300 hover:border-emerald-600 bg-slate-50/60 cursor-pointer'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFilesSelected}
                  className="hidden"
                />
                {uploadingImages ? (
                  <div className="flex items-center justify-center gap-2 text-xs font-semibold text-emerald-700 py-1">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Subiendo capturas de pantalla...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Upload className="w-5 h-5 text-slate-400" />
                    <p className="text-xs font-semibold text-slate-700">
                      Haz clic para adjuntar capturas o fotos del caso
                    </p>
                    <p className="text-[10px] text-slate-400">
                      PNG, JPG o WebP para demostrar el motivo de soporte
                    </p>
                  </div>
                )}
              </div>

              {imagenes.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                  {imagenes.map((img, idx) => (
                    <div
                      key={`${img.url}_${idx}`}
                      className="relative group rounded-xl border border-slate-200 bg-slate-50 overflow-hidden"
                    >
                      <img
                        src={img.url}
                        alt={img.nombre}
                        className="w-full h-24 object-cover"
                      />
                      <div className="px-2 py-1 text-[10px] text-slate-600 truncate bg-white border-t border-slate-100">
                        {img.nombre}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-1.5 right-1.5 p-1 rounded-full bg-rose-600 text-white shadow hover:bg-rose-700 cursor-pointer"
                        title="Quitar imagen"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
              {!hideNavigateButton ? (
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    navigate('/soporte');
                  }}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
                >
                  Ver mis solicitudes
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={submitting || uploadingImages}
                  onClick={handleClose}
                  className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploadingImages}
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Enviar Soporte</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
