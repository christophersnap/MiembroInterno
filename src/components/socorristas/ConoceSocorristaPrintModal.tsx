import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Printer,
  Download,
  Edit3,
  Save,
  Image as ImageIcon,
  Lock,
  Check,
  FileText,
} from 'lucide-react';
import { toJpeg, toPng } from 'html-to-image';
import { useSettings } from '../../contexts/SettingsContext';
import { logActivity } from '../../lib/logger';
import ConoceSocorristaFormFields from './ConoceSocorristaFormFields';
import {
  ConoceSocorristaExtraData,
  extractKycFromSocorrista,
  formatDependientesDetalleToText,
  jpegDataUrlToLetterPdfBlob,
  saveSocorristaKycData,
  validateConoceSocorrista,
} from '../../utils/conoceSocorrista';

interface ConoceSocorristaPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  socorrista: any;
  canEdit: boolean;
  canPrint?: boolean;
  initialMode?: 'auto' | 'edit';
  onSavedKyc: (
    updatedExtra: ConoceSocorristaExtraData,
    baseUpdates?: { email?: string; direccion?: string }
  ) => void;
}

function formatDateDisplay(isoOrText?: string | null): string {
  if (!isoOrText) return '';
  const trimmed = String(isoOrText).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-');
    return `${d}/${m}/${y}`;
  }
  return trimmed;
}

async function toSafeDataUrl(url?: string | null): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  try {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!response.ok) return url;
    const blob = await response.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : url);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

const CruzVerdeOfficialSeal = () => (
  <svg
    viewBox="0 0 120 120"
    className="w-16 h-16 shrink-0"
    aria-label="Emblema Cruz Verde Salvadoreña"
  >
    <circle cx="60" cy="60" r="56" fill="#ffffff" stroke="#1e293b" strokeWidth="3.5" />
    <circle cx="60" cy="60" r="41" fill="#ffffff" stroke="#1e293b" strokeWidth="2" />
    <defs>
      <path id="cvsTopArc" d="M 16,60 A 44,44 0 1,1 104,60" />
      <path id="cvsBottomArc" d="M 22,68 A 42,42 0 0,0 98,68" />
    </defs>
    <text fontSize="9.2" fontWeight="800" fill="#0f172a" letterSpacing="1.1">
      <textPath href="#cvsTopArc" startOffset="50%" textAnchor="middle">
        CRUZ VERDE SALVADOREÑA
      </textPath>
    </text>
    <text fontSize="9.5" fontWeight="800" fill="#0f172a" letterSpacing="2">
      <textPath href="#cvsBottomArc" startOffset="50%" textAnchor="middle">
        • C.A. •
      </textPath>
    </text>
    <path
      d="M50 32 H70 V50 H88 V70 H70 V88 H50 V70 H32 V50 H50 Z"
      fill="#008f39"
      stroke="#065f46"
      strokeWidth="1.5"
    />
  </svg>
);

export default function ConoceSocorristaPrintModal({
  isOpen,
  onClose,
  socorrista,
  canEdit,
  canPrint = true,
  initialMode = 'auto',
  onSavedKyc,
}: ConoceSocorristaPrintModalProps) {
  const { logos } = useSettings();
  const sheetRef = useRef<HTMLDivElement>(null);

  const [extraData, setExtraData] = useState<ConoceSocorristaExtraData>(() =>
    extractKycFromSocorrista(socorrista)
  );
  const [direccionInput, setDireccionInput] = useState<string>(socorrista?.direccion || '');
  const [emailInput, setEmailInput] = useState<string>(socorrista?.email || '');
  const [fechaDeclaracion, setFechaDeclaracion] = useState<string>(() => {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    return `${d}/${m}/${y}`;
  });

  const [editingExtra, setEditingExtra] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedFeedback, setSavedFeedback] = useState<boolean>(false);
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);
  const [downloadingPng, setDownloadingPng] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoLoadFailed, setLogoLoadFailed] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !socorrista) return;
    const extracted = extractKycFromSocorrista(socorrista);
    const prefilled: ConoceSocorristaExtraData = {
      ...extracted,
      nacionalidad: extracted.nacionalidad || 'Salvadoreña',
      fecha_inicio_relacion_laboral:
        extracted.fecha_inicio_relacion_laboral || socorrista.fecha_ingreso || '',
      direccion_domicilio: extracted.direccion_domicilio || socorrista.direccion || '',
    };
    setExtraData(prefilled);
    setDireccionInput(socorrista.direccion || '');
    setEmailInput(socorrista.email || '');
    setErrorMsg(null);
    setSavedFeedback(false);

    const initialCheck = validateConoceSocorrista(socorrista, extracted);
    setEditingExtra(initialMode === 'edit' || !initialCheck.isComplete);
  }, [isOpen, socorrista, initialMode]);

  useEffect(() => {
    if (!isOpen || !socorrista) return;
    let active = true;
    setLogoLoadFailed(false);

    toSafeDataUrl(socorrista.foto_url).then((res) => {
      if (active) setPhotoDataUrl(res);
    });

    const candidateLogo = logos?.verificacion || logos?.login || logos?.dashboard || '';
    if (candidateLogo && candidateLogo !== '/logo.png') {
      toSafeDataUrl(candidateLogo).then((res) => {
        if (active) setLogoDataUrl(res);
      });
    } else {
      setLogoDataUrl(null);
    }

    return () => {
      active = false;
    };
  }, [isOpen, socorrista?.foto_url, logos]);

  if (!isOpen || !socorrista) return null;

  const currentValidation = validateConoceSocorrista(
    {
      ...socorrista,
      direccion: direccionInput,
      email: emailInput,
    },
    extraData
  );

  const savedValidation = validateConoceSocorrista(socorrista);
  const mustShowForm = !canPrint || editingExtra || !savedValidation.isComplete;

  const fullName = [
    socorrista.primer_nombre,
    socorrista.segundo_nombre,
    socorrista.primer_apellido,
    socorrista.segundo_apellido,
  ]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();

  const persistKycChanges = async (openPreviewAfterSave: boolean) => {
    setErrorMsg(null);
    setSavedFeedback(false);

    if (openPreviewAfterSave && !currentValidation.isComplete) {
      setErrorMsg(
        `Completa los datos pendientes para poder ver o imprimir la ficha: ${currentValidation.missingFields.join(', ')}.`
      );
      return;
    }

    setSaving(true);
    try {
      const baseUpdates: { email?: string; direccion?: string } = {};
      if (direccionInput.trim() !== (socorrista.direccion || '').trim()) {
        baseUpdates.direccion = direccionInput.trim();
      }
      if (emailInput.trim() !== (socorrista.email || '').trim()) {
        baseUpdates.email = emailInput.trim();
      }

      const cleanDetalle = (extraData.dependientes_detalle || [])
        .map((d) => ({
          nombre: String(d?.nombre || '').trim(),
          parentesco: String(d?.parentesco || 'Hijo(a)').trim(),
        }))
        .filter((d) => d.nombre !== '');

      const syncedDependientesText =
        cleanDetalle.length > 0
          ? formatDependientesDetalleToText(cleanDetalle)
          : extraData.nombre_dependientes.trim();

      const normalizedExtra: ConoceSocorristaExtraData = {
        ...extraData,
        dependientes_detalle: cleanDetalle,
        nombre_dependientes: syncedDependientesText,
        cargo_publico_periodo:
          extraData.cargo_publico_ultimos_5_anios === true
            ? extraData.cargo_publico_periodo.trim()
            : extraData.cargo_publico_ultimos_5_anios === false
            ? 'No aplica'
            : '',
        cargo_publico_posicion:
          extraData.cargo_publico_ultimos_5_anios === true
            ? extraData.cargo_publico_posicion.trim()
            : extraData.cargo_publico_ultimos_5_anios === false
            ? 'No aplica'
            : '',
      };

      await saveSocorristaKycData(
        socorrista.id,
        normalizedExtra,
        Object.keys(baseUpdates).length > 0 ? baseUpdates : undefined
      );

      await logActivity('Actualizó Ficha Conoce a tu Socorrista', 'Socorrista', socorrista.id, {
        nombre: fullName,
        carnet: socorrista.carnet,
        documento: 'CVSSOCC/FORM001',
      });

      onSavedKyc(normalizedExtra, Object.keys(baseUpdates).length > 0 ? baseUpdates : undefined);

      if (openPreviewAfterSave && canPrint && currentValidation.isComplete) {
        setEditingExtra(false);
      } else {
        setSavedFeedback(true);
        setTimeout(() => setSavedFeedback(false), 2600);
        // Si ya quedó completa y vino desde auto con permiso de impresión, abrir hoja automáticamente
        if (canPrint && currentValidation.isComplete && initialMode === 'auto') {
          setEditingExtra(false);
        }
      }
    } catch (err: any) {
      console.error('Error guardando datos CVSSOCC/FORM001:', err);
      setErrorMsg(err.message || 'No se pudo guardar la información.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!sheetRef.current) return;
    setDownloadingPdf(true);
    setErrorMsg(null);
    try {
      const node = sheetRef.current;
      const pixelRatio = 2.5;
      const width = 816;
      const height = Math.max(1056, node.scrollHeight);

      const jpegDataUrl = await toJpeg(node, {
        quality: 0.95,
        pixelRatio,
        backgroundColor: '#ffffff',
        cacheBust: true,
        width,
        height,
      });

      const pdfBlob = jpegDataUrlToLetterPdfBlob(
        jpegDataUrl,
        width * pixelRatio,
        height * pixelRatio
      );
      const blobUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      const safeCode = (socorrista.carnet || socorrista.id || 'elemento')
        .toString()
        .replace(/[^a-zA-Z0-9_-]/g, '_');
      link.href = blobUrl;
      link.download = `CVSSOCC_FORM001_${safeCode}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);

      await logActivity(
        'Descargó Ficha Conoce a tu Socorrista (PDF)',
        'Socorrista',
        socorrista.id,
        {
          nombre: fullName,
          carnet: socorrista.carnet,
        }
      );
    } catch (err: any) {
      console.error('Error generando PDF CVSSOCC/FORM001:', err);
      setErrorMsg(
        'No se pudo generar el PDF directo. Usa el botón "Imprimir" y elige "Guardar como PDF".'
      );
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadPng = async () => {
    if (!sheetRef.current) return;
    setDownloadingPng(true);
    setErrorMsg(null);
    try {
      const dataUrl = await toPng(sheetRef.current, {
        pixelRatio: 2.5,
        backgroundColor: '#ffffff',
        cacheBust: true,
      });
      const link = document.createElement('a');
      const safeCode = (socorrista.carnet || socorrista.id || 'elemento')
        .toString()
        .replace(/[^a-zA-Z0-9_-]/g, '_');
      link.href = dataUrl;
      link.download = `CVSSOCC_FORM001_${safeCode}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error generando imagen PNG:', err);
      setErrorMsg('No se pudo exportar la imagen de la ficha.');
    } finally {
      setDownloadingPng(false);
    }
  };

  const displayKyc = extractKycFromSocorrista(socorrista);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {mustShowForm ? (
        /* MODAL ESTILO iOS CON SCROLL INTERNO Y BARRA DE GUARDADO FIJA */
        <div className="w-full max-w-2xl max-h-[90vh] bg-[#F2F2F7] rounded-3xl shadow-2xl border border-white/60 flex flex-col overflow-hidden">
          {/* Header fijo estilo iOS */}
          <div className="shrink-0 bg-white/95 backdrop-blur px-6 py-4 border-b border-slate-200/80 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 truncate">
                Conoce a tu Socorrista
              </h3>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                <span>{fullName}</span>
                <span aria-hidden="true" className="mx-1.5">·</span>
                <span className="font-mono tabular-nums">Carnet {socorrista.carnet || 'N/A'}</span>
                <span aria-hidden="true" className="mx-1.5">·</span>
                <span>CVSSOCC/FORM001</span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Cuerpo con scroll interno garantizado */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-5 space-y-5 custom-scrollbar">
            {!canEdit ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 text-center space-y-2">
                <Lock className="w-7 h-7 text-slate-400 mx-auto" />
                <p className="text-sm font-semibold text-slate-900">
                  Información adicional pendiente
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Tu cuenta tiene acceso de solo lectura en esta seccional. Solicita a un usuario con permiso de edición completar los campos faltantes ({savedValidation.missingFields.join(' · ')}) para habilitar la impresión.
                </p>
              </div>
            ) : (
              <>
                {!currentValidation.isComplete && (
                  <div className="bg-amber-50/90 rounded-2xl border border-amber-200/80 px-4 py-3 text-xs text-amber-950">
                    <span className="font-semibold">
                      Pendiente para habilitar impresión ({currentValidation.missingFields.length}):{' '}
                    </span>
                    <span className="text-amber-900">
                      {currentValidation.missingFields.join(' · ')}
                    </span>
                  </div>
                )}

                {errorMsg && (
                  <div className="bg-rose-50 rounded-2xl border border-rose-200 px-4 py-3 text-xs text-rose-900 font-medium">
                    {errorMsg}
                  </div>
                )}

                {savedFeedback && (
                  <div className="bg-emerald-50 rounded-2xl border border-emerald-200 px-4 py-2.5 text-xs text-emerald-900 font-semibold flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    Datos guardados correctamente en el expediente.
                  </div>
                )}

                {/* Datos base del expediente presentes en la hoja */}
                <div className="space-y-2">
                  <div className="px-1">
                    <span className="text-xs font-semibold text-slate-500">
                      Contacto base en la ficha
                    </span>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
                    <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="text-sm font-medium text-slate-800 sm:w-44 shrink-0">
                        Dirección <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={direccionInput}
                        onChange={(e) => setDireccionInput(e.target.value)}
                        placeholder="Dirección registrada del elemento"
                        className="flex-1 bg-slate-50/70 focus:bg-white rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="text-sm font-medium text-slate-800 sm:w-44 shrink-0">
                        Correo electrónico
                      </label>
                      <input
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="correo@ejemplo.com (Opcional)"
                        className="flex-1 bg-slate-50/70 focus:bg-white rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <ConoceSocorristaFormFields
                  value={extraData}
                  onChange={setExtraData}
                  dui={socorrista.dui || ''}
                  direccionBase={direccionInput || socorrista.direccion || ''}
                  fechaIngresoBase={socorrista.fecha_ingreso || ''}
                />
              </>
            )}
          </div>

          {/* Barra inferior fija con botón Guardar siempre visible */}
          <div className="shrink-0 bg-white px-6 py-3.5 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors whitespace-nowrap cursor-pointer"
              >
                Cancelar
              </button>
              {canPrint && savedValidation.isComplete && (
                <button
                  type="button"
                  onClick={() => setEditingExtra(false)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Ver Hoja
                </button>
              )}
            </div>

            {canEdit && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => persistKycChanges(false)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer ${
                    canPrint
                      ? 'border border-slate-200 bg-slate-100 hover:bg-slate-200/80 text-slate-900'
                      : 'bg-slate-900 hover:bg-slate-800 text-white shadow-2xs'
                  }`}
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>

                {canPrint && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => persistKycChanges(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Guardar e Imprimir
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* VISTA PREVIA DE IMPRESIÓN / DESCARGA OFICIAL CVSSOCC/FORM001 */
        <div className="w-full max-w-4xl max-h-[92vh] flex flex-col items-center overflow-hidden">
          {/* Barra superior flotante estilo iOS (no se imprime) */}
          <div className="no-print shrink-0 w-full max-w-[816px] bg-white/95 backdrop-blur rounded-2xl shadow-lg border border-slate-200/80 px-4 py-3 mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-slate-900 whitespace-nowrap">
                CVSSOCC/FORM001
              </span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>Fecha:</span>
                <input
                  type="text"
                  value={fechaDeclaracion}
                  onChange={(e) => setFechaDeclaracion(e.target.value)}
                  className="w-24 px-2 py-1 text-xs font-mono tabular-nums border border-slate-200 rounded-lg bg-slate-50 text-slate-800"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setEditingExtra(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold whitespace-nowrap cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Editar datos
                </button>
              )}

              <button
                type="button"
                onClick={handleDownloadPng}
                disabled={downloadingPng}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold disabled:opacity-50 whitespace-nowrap cursor-pointer"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                {downloadingPng ? 'Exportando...' : 'PNG'}
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs disabled:opacity-50 whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                {downloadingPdf ? 'Generando...' : 'Descargar PDF'}
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold shadow-2xs whitespace-nowrap cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar vista previa"
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="no-print shrink-0 w-full max-w-[816px] mb-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              {errorMsg}
            </div>
          )}

          {/* Contenedor con scroll para la hoja tamaño Carta */}
          <div className="flex-1 min-h-0 w-full overflow-auto flex justify-center pb-6 custom-scrollbar">
            <div
              ref={sheetRef}
              id="ficha-conoce-socorrista-print"
              className="w-[816px] min-h-[1056px] bg-white text-black px-12 py-10 shadow-2xl border border-slate-300 flex flex-col justify-between shrink-0 font-sans select-text"
            >
              <div>
                {/* ENCABEZADO: EMBLEMA + TÍTULO + FOTO TIPO ID */}
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div className="flex flex-col items-center text-center w-36 shrink-0">
                    {logoDataUrl && !logoLoadFailed ? (
                      <img
                        src={logoDataUrl}
                        alt="Cruz Verde Salvadoreña"
                        referrerPolicy="no-referrer"
                        onError={() => setLogoLoadFailed(true)}
                        className="w-16 h-16 object-contain"
                      />
                    ) : (
                      <CruzVerdeOfficialSeal />
                    )}
                    <div className="mt-1.5 font-extrabold text-[11px] leading-tight tracking-wide text-black uppercase">
                      CRUZ VERDE
                      <br />
                      SALVADOREÑA
                    </div>
                  </div>

                  <div className="flex-1 text-center px-2">
                    <h1 className="text-[16px] font-extrabold tracking-wide uppercase text-black">
                      FORMULARIO CONOCE A TU SOCORRISTA
                    </h1>
                    <p className="text-[11px] text-neutral-700 font-semibold mt-1">
                      Carnet Institucional:{' '}
                      <span className="font-mono font-bold text-black">
                        {socorrista.carnet || 'N/A'}
                      </span>
                      {socorrista.seccional_nombre
                        ? ` · Seccional: ${socorrista.seccional_nombre}`
                        : ''}
                    </p>
                  </div>

                  {/* Derecha: Fotografía Tipo ID */}
                  <div className="w-28 flex flex-col items-center shrink-0">
                    <div className="w-[92px] h-[114px] border border-black bg-neutral-50 overflow-hidden flex items-center justify-center">
                      {photoDataUrl ? (
                        <img
                          src={photoDataUrl}
                          alt={`Foto ID ${fullName}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center px-2 text-[9px] font-semibold text-neutral-500 leading-tight uppercase">
                          FOTO
                          <br />
                          TIPO ID
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* CUADRÍCULA OFICIAL CVSSOCC/FORM001 */}
                <div className="border border-black text-[12px] leading-snug text-black">
                  {/* Fila 1: Nombre */}
                  <div className="border-b border-black px-2.5 py-2 min-h-[40px]">
                    <span className="font-normal block text-[11.5px]">Nombre:</span>
                    <div className="font-semibold text-[12.5px] mt-0.5 uppercase">{fullName}</div>
                  </div>

                  {/* Fila 2: Dirección */}
                  <div className="border-b border-black px-2.5 py-2 min-h-[42px]">
                    <span className="font-normal block text-[11.5px]">Dirección:</span>
                    <div className="font-medium text-[12px] mt-0.5">
                      {socorrista.direccion || ''}
                    </div>
                  </div>

                  {/* Fila 3: DUI | NIT | Estado civil */}
                  <div className="grid grid-cols-12 border-b border-black min-h-[54px] divide-x divide-black">
                    <div className="col-span-4 px-2.5 py-1.5">
                      <span className="block text-[11.5px]">DUI:</span>
                      <div className="font-semibold font-mono tabular-nums text-[12.5px] mt-1">
                        {socorrista.dui || ''}
                      </div>
                    </div>
                    <div className="col-span-4 px-2.5 py-1.5">
                      <span className="block text-[11.5px]">NIT:</span>
                      <div className="font-semibold font-mono tabular-nums text-[12.5px] mt-1">
                        {displayKyc.nit || ''}
                      </div>
                    </div>
                    <div className="col-span-4 px-2.5 py-1.5">
                      <span className="block text-[11.5px]">Estado civil:</span>
                      <div className="font-semibold text-[12px] mt-1">
                        {displayKyc.estado_civil || ''}
                      </div>
                    </div>
                  </div>

                  {/* Fila 4: Fecha de Nacimiento | Teléfono | Correo electrónico */}
                  <div className="grid grid-cols-12 border-b border-black min-h-[56px] divide-x divide-black">
                    <div className="col-span-4 px-2.5 py-1.5">
                      <span className="block text-[11.5px]">Fecha de Nacimiento:</span>
                      <div className="font-semibold tabular-nums text-[12px] mt-1">
                        {formatDateDisplay(socorrista.fecha_nacimiento)}
                      </div>
                    </div>
                    <div className="col-span-4 px-2.5 py-1.5">
                      <span className="block text-[11.5px]">Teléfono:</span>
                      <div className="font-semibold font-mono tabular-nums text-[12px] mt-1">
                        {socorrista.telefono || ''}
                      </div>
                    </div>
                    <div className="col-span-4 px-2.5 py-1.5 break-all">
                      <span className="block text-[11.5px]">Correo electrónico:</span>
                      <div className="font-medium text-[11.5px] mt-1">
                        {socorrista.email || '—'}
                      </div>
                    </div>
                  </div>

                  {/* Fila 5: Nombre de cónyuge */}
                  <div className="border-b border-black px-2.5 py-2 min-h-[54px]">
                    <span className="block text-[11.5px]">Nombre de cónyuge:</span>
                    <div className="font-medium text-[12px] mt-1">
                      {displayKyc.nombre_conyuge || ''}
                    </div>
                  </div>

                  {/* Fila 6: Nombre de dependientes (con Parentesco + Nombre) */}
                  <div className="border-b border-black px-2.5 py-2 min-h-[96px]">
                    <span className="block text-[11.5px]">Nombre de dependientes:</span>
                    {Array.isArray(displayKyc.dependientes_detalle) &&
                    displayKyc.dependientes_detalle.length > 0 ? (
                      <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-[12px]">
                        {displayKyc.dependientes_detalle.map((dep, i) => (
                          <div key={i} className="font-medium">
                            <span className="font-semibold">{dep.nombre}</span>{' '}
                            <span className="text-neutral-700">({dep.parentesco})</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="font-medium text-[12px] mt-1 whitespace-pre-line">
                        {displayKyc.nombre_dependientes || ''}
                      </div>
                    )}
                  </div>

                  {/* Fila 7: Nacionalidad | Profesión u ocupación | Fecha de inicio */}
                  <div className="grid grid-cols-12 border-b border-black min-h-[58px] divide-x divide-black">
                    <div className="col-span-4 px-2.5 py-1.5">
                      <span className="block text-[11.5px]">Nacionalidad:</span>
                      <div className="font-semibold text-[12px] mt-1">
                        {displayKyc.nacionalidad || ''}
                      </div>
                    </div>
                    <div className="col-span-4 px-2.5 py-1.5">
                      <span className="block text-[11.5px]">Profesión u ocupación:</span>
                      <div className="font-semibold text-[12px] mt-1">
                        {displayKyc.profesion_ocupacion || ''}
                      </div>
                    </div>
                    <div className="col-span-4 px-2.5 py-1.5">
                      <span className="block text-[11.5px]">Fecha de inicio de relación laboral.</span>
                      <div className="font-semibold tabular-nums text-[12px] mt-1">
                        {formatDateDisplay(displayKyc.fecha_inicio_relacion_laboral)}
                      </div>
                    </div>
                  </div>

                  {/* Fila 8: Dirección de domicilio */}
                  <div className="border-b border-black px-2.5 py-2 min-h-[48px]">
                    <span className="block text-[11.5px]">Dirección de domicilio:</span>
                    <div className="font-medium text-[12px] mt-0.5">
                      {displayKyc.direccion_domicilio || ''}
                    </div>
                  </div>

                  {/* Fila 9: Cargo público o político últimos 5 años */}
                  <div className="grid grid-cols-12 border-b border-black min-h-[74px] divide-x divide-black">
                    <div className="col-span-5 px-2.5 py-2 flex flex-col justify-between">
                      <span className="block text-[11.5px] leading-tight">
                        Ejerce o ha ejercido usted un cargo público o político en los últimos 5 años:
                      </span>
                      <div className="flex items-center gap-8 mt-2 pt-0.5">
                        <span className="inline-flex items-center gap-1.5 text-[12px]">
                          <span className="w-3.5 h-3.5 border border-black inline-flex items-center justify-center font-bold text-[10px] leading-none">
                            {displayKyc.cargo_publico_ultimos_5_anios === true ? 'X' : ''}
                          </span>
                          <span>Sí</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-[12px]">
                          <span className="w-3.5 h-3.5 border border-black inline-flex items-center justify-center font-bold text-[10px] leading-none">
                            {displayKyc.cargo_publico_ultimos_5_anios === false ? 'X' : ''}
                          </span>
                          <span>No</span>
                        </span>
                      </div>
                    </div>
                    <div className="col-span-3 px-2.5 py-2">
                      <span className="block text-[11.5px]">Periodo de tiempo:</span>
                      <div className="font-medium text-[12px] mt-1.5">
                        {displayKyc.cargo_publico_ultimos_5_anios === true
                          ? displayKyc.cargo_publico_periodo
                          : 'No aplica'}
                      </div>
                    </div>
                    <div className="col-span-4 px-2.5 py-2">
                      <span className="block text-[11.5px]">Posición:</span>
                      <div className="font-medium text-[12px] mt-1.5">
                        {displayKyc.cargo_publico_ultimos_5_anios === true
                          ? displayKyc.cargo_publico_posicion
                          : 'No aplica'}
                      </div>
                    </div>
                  </div>

                  {/* Fila 10: Declaración Bajo Juramento UIF y Firmas */}
                  <div className="px-3.5 py-3 min-h-[195px] flex flex-col justify-between">
                    <div className="space-y-3 text-[11.5px] leading-relaxed text-justify text-neutral-900">
                      <p>
                        Yo,{' '}
                        <span className="inline-block min-w-[240px] border-b border-black font-bold text-black px-1 uppercase">
                          {fullName}
                        </span>{' '}
                        declaro <strong className="font-extrabold text-black">BAJO JURAMENTO:</strong>{' '}
                        Que la información anteriormente detallada es fidedigna y que me ha sido
                        solicitada por{' '}
                        <strong className="font-extrabold text-black">CRUZ VERDE SALVADOREÑA</strong>;
                        en cumplimiento de lo dispuesto en el instructivo de la Unidad de
                        Investigación Financiera para la Prevención del Lavado de Dinero y de
                        Activos; asimismo autorizo a la Institución para que pueda investigar la
                        información que he proporcionado en este formulario y/o contratos que
                        pudieran firmarse.
                      </p>

                      <p className="pt-1 font-normal text-black">
                        Fecha:{' '}
                        <span className="inline-block min-w-[130px] border-b border-black font-semibold tabular-nums px-2">
                          {fechaDeclaracion}
                        </span>
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-12 pt-12 pb-1 px-4">
                      <div className="text-center">
                        <div className="border-t border-black pt-1 text-[11.5px] text-black">
                          Firma de socorrista
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="border-t border-black pt-1 text-[11.5px] text-black">
                          Firma de Sujeto Obligado
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-5 flex items-center justify-end">
                <span className="text-[12px] font-extrabold tracking-wide text-black uppercase">
                  CVSSOCC/FORM001
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
