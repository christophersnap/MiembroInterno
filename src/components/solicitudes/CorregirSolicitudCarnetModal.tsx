import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  AlertTriangle,
  Camera,
  Crop,
  ImagePlus,
  CheckCircle2,
  Send,
  UserCheck,
  Info,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../lib/logger';
import SmartStorageImage from '../common/SmartStorageImage';
import CarnetPhotoCaptureModal, { CarnetPhotoReadyMeta } from '../common/CarnetPhotoCaptureModal';
import {
  uploadCarnetPhotoWithFallback,
  validateSocorristaNameForCarnet,
  correctObservedCarnetSolicitudSafe,
} from '../../utils/solicitudesCarnet';
import type { SolicitudCarnetRecord } from './SolicitudesCarnetTab';

interface CorregirSolicitudCarnetModalProps {
  record: SolicitudCarnetRecord | null;
  onClose: () => void;
  onCorrected: (updated: {
    id: number | string;
    socorrista_nombre: string;
    primer_nombre: string;
    segundo_nombre: string;
    primer_apellido: string;
    segundo_apellido: string;
    foto_url: string | null;
    nota_correccion: string | null;
    fecha_correccion: string;
    fecha_solicitud: string;
  }) => void;
}

interface HomonymMatch {
  id: number;
  carnet: string;
  nombre_completo: string;
  seccional: string;
}

function normalizeNameCompare(str: string): string {
  return String(str || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export default function CorregirSolicitudCarnetModal({
  record,
  onClose,
  onCorrected,
}: CorregirSolicitudCarnetModalProps) {
  const [primerNombre, setPrimerNombre] = useState('');
  const [segundoNombre, setSegundoNombre] = useState('');
  const [primerApellido, setPrimerApellido] = useState('');
  const [segundoApellido, setSegundoApellido] = useState('');
  const [loadingSocorrista, setLoadingSocorrista] = useState(false);

  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
  const [newPhotoPreview, setNewPhotoPreview] = useState<string | null>(null);
  const [newPhotoMeta, setNewPhotoMeta] = useState<CarnetPhotoReadyMeta | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoModalMode, setPhotoModalMode] = useState<'new' | 'crop'>('new');

  const [notaCorreccion, setNotaCorreccion] = useState('');
  const [homonyms, setHomonyms] = useState<HomonymMatch[]>([]);
  const [checkingHomonyms, setCheckingHomonyms] = useState(false);
  const [confirmHomonym, setConfirmHomonym] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Hydrate initial structured name fields from record or directly from socorristas table
  useEffect(() => {
    if (!record) return;
    setErrorMsg(null);
    setNewPhotoFile(null);
    setNewPhotoPreview(null);
    setNewPhotoMeta(null);
    setNotaCorreccion('');
    setHomonyms([]);
    setConfirmHomonym(false);

    const hasParts = Boolean(record.primer_nombre || record.primer_apellido);
    if (hasParts) {
      setPrimerNombre((record.primer_nombre || '').toUpperCase());
      setSegundoNombre((record.segundo_nombre || '').toUpperCase());
      setPrimerApellido((record.primer_apellido || '').toUpperCase());
      setSegundoApellido((record.segundo_apellido || '').toUpperCase());
    } else {
      // Fallback split from socorrista_nombre while fetching exact columns from DB
      const parts = (record.socorrista_nombre || '').trim().split(/\s+/).filter(Boolean);
      setPrimerNombre((parts[0] || '').toUpperCase());
      setSegundoNombre(parts.length >= 4 ? parts[1].toUpperCase() : '');
      setPrimerApellido(
        (parts.length >= 4 ? parts[2] : parts.length === 3 ? parts[1] : parts[1] || '').toUpperCase()
      );
      setSegundoApellido(
        (parts.length >= 4 ? parts.slice(3).join(' ') : parts.length === 3 ? parts[2] : '').toUpperCase()
      );
    }

    if (record.socorrista_id > 0) {
      let cancelled = false;
      setLoadingSocorrista(true);
      supabase
        .from('socorristas')
        .select('primer_nombre, segundo_nombre, primer_apellido, segundo_apellido')
        .eq('id', record.socorrista_id)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled && data) {
            setPrimerNombre(String(data.primer_nombre || '').toUpperCase());
            setSegundoNombre(String(data.segundo_nombre || '').toUpperCase());
            setPrimerApellido(String(data.primer_apellido || '').toUpperCase());
            setSegundoApellido(String(data.segundo_apellido || '').toUpperCase());
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoadingSocorrista(false);
        });
      return () => {
        cancelled = true;
      };
    }
  }, [record]);

  // Live name validation using the exact institutional carnet rules
  const nameValidation = useMemo(
    () =>
      validateSocorristaNameForCarnet({
        primer_nombre: primerNombre,
        segundo_nombre: segundoNombre,
        primer_apellido: primerApellido,
        segundo_apellido: segundoApellido,
      }),
    [primerNombre, segundoNombre, primerApellido, segundoApellido]
  );

  const invalidFieldMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    nameValidation.invalidFields.forEach((f) => {
      map[f.field] = f.symbols;
    });
    return map;
  }, [nameValidation]);

  // Live homonym check (identical criteria to NewSocorrista.tsx, excluding current socorrista_id)
  useEffect(() => {
    if (!record) return;
    const p1 = primerNombre.trim();
    const a1 = primerApellido.trim();
    if (p1.length < 2 || a1.length < 2) {
      setHomonyms([]);
      setConfirmHomonym(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setCheckingHomonyms(true);
      try {
        const { data } = await supabase
          .from('socorristas')
          .select('id, carnet, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, seccionales(nombre)')
          .ilike('primer_nombre', p1)
          .ilike('primer_apellido', a1)
          .neq('id', record.socorrista_id)
          .limit(10);

        if (!cancelled && Array.isArray(data)) {
          const targetFull = normalizeNameCompare(
            `${primerNombre} ${segundoNombre} ${primerApellido} ${segundoApellido}`
          );
          const matches: HomonymMatch[] = data
            .map((row: any) => {
              const full = [row.primer_nombre, row.segundo_nombre, row.primer_apellido, row.segundo_apellido]
                .filter(Boolean)
                .join(' ');
              const secObj = Array.isArray(row.seccionales) ? row.seccionales[0] : row.seccionales;
              return {
                id: Number(row.id),
                carnet: row.carnet || 'S/C',
                nombre_completo: full,
                seccional: secObj?.nombre || 'Sin seccional',
              };
            })
            .filter((item) => {
              const candidateFull = normalizeNameCompare(item.nombre_completo);
              const candidateCore = normalizeNameCompare(
                `${p1} ${a1}`
              );
              return candidateFull === targetFull || candidateFull.includes(candidateCore);
            });
          setHomonyms(matches);
          if (matches.length === 0) setConfirmHomonym(false);
        }
      } catch {
        if (!cancelled) setHomonyms([]);
      } finally {
        if (!cancelled) setCheckingHomonyms(false);
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [record, primerNombre, segundoNombre, primerApellido, segundoApellido]);

  if (!record) return null;

  const activePhotoSrc = newPhotoPreview || record.foto_url || record.socorrista_foto_actual;
  const hasPhoto = Boolean(activePhotoSrc);

  const originalFullName = [
    record.primer_nombre || '',
    record.segundo_nombre || '',
    record.primer_apellido || '',
    record.segundo_apellido || '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim()
    .toUpperCase();
  const currentFullName = nameValidation.fullName.trim().toUpperCase();
  const nameChanged = originalFullName
    ? currentFullName !== originalFullName
    : currentFullName !== record.socorrista_nombre.trim().toUpperCase();
  const photoChanged = Boolean(newPhotoFile);

  const canSubmit =
    !submitting &&
    !loadingSocorrista &&
    nameValidation.isValid &&
    hasPhoto &&
    (homonyms.length === 0 || confirmHomonym);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setErrorMsg(null);
    try {
      let finalPhotoUrl: string | null = record.foto_url || record.socorrista_foto_actual || null;
      if (newPhotoFile) {
        finalPhotoUrl = await uploadCarnetPhotoWithFallback(
          newPhotoFile,
          `${record.carnet || `SOC_${record.socorrista_id}`}_corregida`
        );
      }

      const result = await correctObservedCarnetSolicitudSafe({
        solicitudId: record.id,
        source: record.source,
        configClave: record.config_clave,
        socorristaId: record.socorrista_id,
        primer_nombre: primerNombre,
        segundo_nombre: segundoNombre || null,
        primer_apellido: primerApellido,
        segundo_apellido: segundoApellido || null,
        foto_url: finalPhotoUrl,
        foto_analisis: newPhotoMeta?.analysis
          ? {
              status: newPhotoMeta.analysis.status,
              score: newPhotoMeta.analysis.score,
              summary: newPhotoMeta.analysis.summary,
            }
          : null,
        foto_fondo_reemplazado: newPhotoMeta ? Boolean(newPhotoMeta.backgroundReplaced) : null,
        nota_correccion: notaCorreccion.trim() || null,
      });

      if (!result.ok) {
        setErrorMsg(result.error || 'No se pudo guardar la corrección de la solicitud.');
        return;
      }

      await logActivity('Corrigió y reenvió solicitud de carnet observada', 'SolicitudCarnet', String(record.id), {
        socorrista_anterior: record.socorrista_nombre,
        socorrista_corregido: result.fullName,
        carnet: record.carnet,
        nombre_modificado: nameChanged,
        foto_modificada: photoChanged,
        nota_correccion: notaCorreccion.trim() || null,
      });

      window.dispatchEvent(new Event('solicitudes_updated'));

      onCorrected({
        id: record.id,
        socorrista_nombre: result.fullName,
        primer_nombre: primerNombre.trim().toUpperCase(),
        segundo_nombre: segundoNombre.trim().toUpperCase(),
        primer_apellido: primerApellido.trim().toUpperCase(),
        segundo_apellido: segundoApellido.trim().toUpperCase(),
        foto_url: finalPhotoUrl,
        nota_correccion: notaCorreccion.trim() || null,
        fecha_correccion: result.updatedAt,
        fecha_solicitud: result.updatedAt,
      });
    } catch (err: any) {
      console.error('Error corrigiendo solicitud de carnet:', err);
      setErrorMsg(err?.message || 'Ocurrió un error inesperado al guardar las correcciones.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-orange-50/80 via-white to-white shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-700 border border-orange-200 flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 truncate">
                  Corregir Solicitud Observada
                </h3>
                <p className="text-[11px] text-slate-500 font-mono truncate">
                  Carnet: {record.carnet} · {record.seccional_nombre}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-5 overflow-y-auto flex-1">
            {/* Reviewer Observation Alert */}
            <div className="p-3.5 rounded-2xl bg-orange-50 border border-orange-200 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-orange-900">
                <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0" />
                <span>Observación recibida en revisión</span>
              </div>
              <p className="text-xs text-orange-900/90 leading-relaxed pl-6">
                {record.observaciones?.trim()
                  ? record.observaciones
                  : 'Esta solicitud fue marcada como Observada. Revisa y corrige el nombre del elemento y/o la fotografía según los lineamientos institucionales.'}
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Section 1: Structured Name Fields (Exact parameters from NewSocorrista form) */}
            <div className="space-y-3 p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span>1. Nombre del Socorrista</span>
                  {nameChanged && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold normal-case tracking-normal">
                      Modificado
                    </span>
                  )}
                </h4>
                {loadingSocorrista && (
                  <span className="text-[11px] text-slate-400">Cargando datos exactos...</span>
                )}
              </div>

              {/* Official DUI Notice (from NewSocorrista.tsx) */}
              <div className="bg-amber-50 border border-amber-200/90 rounded-xl p-2.5 flex items-start gap-2 text-[11px] text-amber-900">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-snug">
                  <strong>Importante:</strong> Los campos de nombres y apellidos deben llenarse{' '}
                  <strong>tal cual el nombre completo aparece en el DUI o Documento de Identidad</strong>{' '}
                  (sin abreviaturas, números ni símbolos).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Primer Nombre <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={primerNombre}
                    onChange={(e) => setPrimerNombre(e.target.value.toUpperCase())}
                    placeholder="PRIMER NOMBRE"
                    className={`w-full px-3 py-2 text-xs font-semibold uppercase rounded-xl border bg-white outline-none transition-all ${
                      invalidFieldMap.primer_nombre || (!primerNombre.trim() && !loadingSocorrista)
                        ? 'border-rose-400 focus:ring-2 focus:ring-rose-500/20'
                        : 'border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                    }`}
                  />
                  {invalidFieldMap.primer_nombre && (
                    <p className="text-[10px] font-semibold text-rose-700 mt-1">
                      Símbolos no permitidos: {invalidFieldMap.primer_nombre.map((s) => `"${s}"`).join(', ')}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Segundo Nombre <span className="text-slate-400 font-normal">(Opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={segundoNombre}
                    onChange={(e) => setSegundoNombre(e.target.value.toUpperCase())}
                    placeholder="SEGUNDO NOMBRE"
                    className={`w-full px-3 py-2 text-xs font-semibold uppercase rounded-xl border bg-white outline-none transition-all ${
                      invalidFieldMap.segundo_nombre
                        ? 'border-rose-400 focus:ring-2 focus:ring-rose-500/20'
                        : 'border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                    }`}
                  />
                  {invalidFieldMap.segundo_nombre && (
                    <p className="text-[10px] font-semibold text-rose-700 mt-1">
                      Símbolos no permitidos: {invalidFieldMap.segundo_nombre.map((s) => `"${s}"`).join(', ')}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Primer Apellido <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={primerApellido}
                    onChange={(e) => setPrimerApellido(e.target.value.toUpperCase())}
                    placeholder="PRIMER APELLIDO"
                    className={`w-full px-3 py-2 text-xs font-semibold uppercase rounded-xl border bg-white outline-none transition-all ${
                      invalidFieldMap.primer_apellido || (!primerApellido.trim() && !loadingSocorrista)
                        ? 'border-rose-400 focus:ring-2 focus:ring-rose-500/20'
                        : 'border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                    }`}
                  />
                  {invalidFieldMap.primer_apellido && (
                    <p className="text-[10px] font-semibold text-rose-700 mt-1">
                      Símbolos no permitidos: {invalidFieldMap.primer_apellido.map((s) => `"${s}"`).join(', ')}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Segundo Apellido <span className="text-slate-400 font-normal">(Opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={segundoApellido}
                    onChange={(e) => setSegundoApellido(e.target.value.toUpperCase())}
                    placeholder="SEGUNDO APELLIDO"
                    className={`w-full px-3 py-2 text-xs font-semibold uppercase rounded-xl border bg-white outline-none transition-all ${
                      invalidFieldMap.segundo_apellido
                        ? 'border-rose-400 focus:ring-2 focus:ring-rose-500/20'
                        : 'border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                    }`}
                  />
                  {invalidFieldMap.segundo_apellido && (
                    <p className="text-[10px] font-semibold text-rose-700 mt-1">
                      Símbolos no permitidos: {invalidFieldMap.segundo_apellido.map((s) => `"${s}"`).join(', ')}
                    </p>
                  )}
                </div>
              </div>

              {/* Resulting Full Name & Validation Status */}
              <div
                className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 flex-wrap ${
                  nameValidation.isValid
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {nameValidation.isValid ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span className="truncate">
                    <span className="font-medium">Nombre en carnet:</span>{' '}
                    <strong className="uppercase">{currentFullName || 'INCOMPLETO'}</strong>
                  </span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wide shrink-0">
                  {nameValidation.isValid ? 'Formato válido' : 'Corregir nombre'}
                </span>
              </div>

              {/* Homonym Alert */}
              {!checkingHomonyms && homonyms.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 space-y-2 text-xs text-amber-950">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold">Posible homónimo detectado en el sistema:</p>
                      <ul className="space-y-0.5 text-[11px] text-amber-900">
                        {homonyms.slice(0, 3).map((h) => (
                          <li key={h.id}>
                            • <strong>{h.nombre_completo}</strong> (Carnet: {h.carnet} — {h.seccional})
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 pl-6 cursor-pointer text-[11px] font-semibold">
                    <input
                      type="checkbox"
                      checked={confirmHomonym}
                      onChange={(e) => setConfirmHomonym(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    Confirmo que el nombre corregido es exacto según DUI y corresponde a este elemento.
                  </label>
                </div>
              )}
            </div>

            {/* Section 2: Carnet Photo Correction */}
            <div className="space-y-3 p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span>2. Fotografía para Carnet</span>
                  {photoChanged && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold normal-case tracking-normal inline-flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Nueva foto lista
                    </span>
                  )}
                </h4>
                {newPhotoMeta?.analysis && (
                  <span className="text-[11px] font-bold text-emerald-700 tabular-nums">
                    Cumplimiento: {newPhotoMeta.analysis.score}%
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="w-28 h-28 rounded-2xl bg-slate-200/80 border-2 border-slate-300 overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
                  <SmartStorageImage
                    src={newPhotoPreview || record.foto_url}
                    fallbackSrc={record.socorrista_foto_actual}
                    alt={currentFullName || record.socorrista_nombre}
                    className="w-full h-full object-cover"
                    fallback={
                      <div className="flex flex-col items-center justify-center text-slate-500 px-2 text-center">
                        <Camera className="w-7 h-7 mb-1 text-slate-400" />
                        <span className="text-[10px] font-semibold">Sin foto</span>
                      </div>
                    }
                  />
                </div>

                <div className="flex-1 space-y-2.5 text-center sm:text-left">
                  <p className="text-xs text-slate-600 leading-snug">
                    {photoChanged
                      ? 'Se aplicará esta nueva fotografía corregida tanto a la solicitud como al perfil del socorrista.'
                      : 'Puedes tomar una fotografía nueva, subir otra desde tu dispositivo, o recortar / reemplazar el fondo de la foto actual.'}
                  </p>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoModalMode('new');
                        setShowPhotoModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
                    >
                      <ImagePlus className="w-4 h-4" />
                      Tomar o Subir Nueva Foto
                    </button>

                    {hasPhoto && (
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoModalMode('crop');
                          setShowPhotoModal(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold shadow-2xs cursor-pointer transition-colors"
                      >
                        <Crop className="w-4 h-4 text-emerald-700" />
                        Recortar / Cambiar Fondo
                      </button>
                    )}
                  </div>
                  {!hasPhoto && (
                    <p className="text-[11px] font-semibold text-rose-700">
                      Es obligatorio adjuntar una fotografía válida para reenviar la solicitud.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Section 3: Optional Correction Note */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nota sobre la corrección realizada{' '}
                <span className="text-slate-400 font-normal">(Opcional)</span>
              </label>
              <textarea
                rows={2}
                value={notaCorreccion}
                onChange={(e) => setNotaCorreccion(e.target.value)}
                placeholder="Ej. Se corrigió el segundo apellido según DUI y se subió nueva foto con camisa blanca y fondo liso."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap shrink-0">
            <p className="text-[11px] text-slate-500">
              Al guardar, la solicitud regresará a estado <strong>Pendiente</strong> para nueva revisión.
            </p>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                {submitting ? 'Guardando y reenviando...' : 'Guardar Corrección y Reenviar'}
              </button>
            </div>
          </div>
        </form>
      </div>

      <CarnetPhotoCaptureModal
        isOpen={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        onPhotoReady={(file, previewUrl, meta) => {
          setNewPhotoFile(file);
          setNewPhotoPreview(previewUrl);
          setNewPhotoMeta(meta || null);
          setShowPhotoModal(false);
        }}
        initialImageSrc={
          photoModalMode === 'crop'
            ? newPhotoPreview || record.foto_url || record.socorrista_foto_actual || null
            : null
        }
        initialFallbackSrc={photoModalMode === 'crop' ? record.socorrista_foto_actual || null : null}
        title={
          photoModalMode === 'crop'
            ? `Recortar / Cambiar Fondo — ${currentFullName || record.socorrista_nombre}`
            : `Nueva Fotografía de Carnet — ${currentFullName || record.socorrista_nombre}`
        }
      />
    </>
  );
}
