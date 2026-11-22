import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  IdCard,
  ArrowLeft,
  Search,
  Camera,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  Send,
  Loader2,
  Building2,
  ShieldCheck,
  CheckSquare,
  Square,
  Layers,
  RefreshCw,
  ImagePlus,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { logActivity } from '../lib/logger';
import CarnetPhotoCaptureModal from '../components/common/CarnetPhotoCaptureModal';
import CarnetSubmitConfirmModal from '../components/common/CarnetSubmitConfirmModal';
import SmartStorageImage from '../components/common/SmartStorageImage';
import {
  CarnetRequestStatusInfo,
  createCarnetSolicitudSafe,
  fetchLatestCarnetRequestsMap,
  formatCarnetRequestDate,
  isBlockingCarnetState,
  uploadCarnetPhotoWithFallback,
  validateSocorristaNameForCarnet,
} from '../utils/solicitudesCarnet';
import { getElSalvadorDateTime, getElSalvadorIsoTimestamp } from '../utils/dateUtils';

interface StagedPhoto {
  file: File;
  previewUrl: string;
}

export default function SolicitudCarnetLote() {
  const {
    user,
    userName,
    role,
    socorristaId,
    permissions,
    seccionalesSocorristasAccess,
    directorSeccionalId,
    userSeccionalId,
    userSeccionalNombre,
    getModuleScope,
    getModuleSeccionalIds,
    getAllowedSocorristaSeccionalIds,
    loading: authLoading,
  } = useAuth();
  const { logos } = useSettings();

  const [socorristas, setSocorristas] = useState<any[]>([]);
  const [seccionalesList, setSeccionalesList] = useState<{ id: number; nombre: string }[]>([]);
  const [requestsMap, setRequestsMap] = useState<Record<number, CarnetRequestStatusInfo>>({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeccional, setFilterSeccional] = useState('Todas');
  const [filterEstado, setFilterEstado] = useState<
    'Todos' | 'Disponibles' | 'SinFoto' | 'NombreInvalido' | 'Bloqueados' | 'Observados'
  >('Todos');

  // Selection & Staged Photos
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [stagedPhotos, setStagedPhotos] = useState<Record<number, StagedPhoto>>({});
  const [photoModalTarget, setPhotoModalTarget] = useState<{
    socorrista: any;
    selectAfterCapture: boolean;
  } | null>(null);

  // Batch Configuration
  const [tipoSolicitud, setTipoSolicitud] = useState<'Nuevo' | 'Cambio' | 'Reposición'>('Nuevo');
  const [motivo, setMotivo] = useState('');
  const [detallesMotivo, setDetallesMotivo] = useState('');
  const [confirmBatch, setConfirmBatch] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState(false);
  const [submitProgress, setSubmitProgress] = useState<{ current: number; total: number } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [batchSuccessInfo, setBatchSuccessInfo] = useState<{
    loteId: string;
    fecha: string;
    elementos: { carnet: string; nombre: string; via: string }[];
  } | null>(null);

  // Resolve exact access scope for the logged-in user
  const accessScopeInfo = useMemo(() => {
    const scope = getModuleScope('solicitudes_carnet');
    const modSeccionalIds = getModuleSeccionalIds('solicitudes_carnet');
    const socAllowed = getAllowedSocorristaSeccionalIds();
    const effectiveSecId = directorSeccionalId || userSeccionalId;

    if (role === 'admin') {
      return { mode: 'all' as const, allowedSeccIds: [] as number[], label: 'Global (Todas las Seccionales)' };
    }
    if (seccionalesSocorristasAccess.mode === 'custom') {
      const ids = Array.isArray(socAllowed) ? socAllowed : [];
      return {
        mode: 'seccionales' as const,
        allowedSeccIds: ids,
        label: ids.length > 0 ? `Seccionales Autorizadas (${ids.length})` : 'Sin seccionales asignadas',
      };
    }
    if (seccionalesSocorristasAccess.mode === 'all' || permissions.ver_todas_seccionales || scope === 'global') {
      return { mode: 'all' as const, allowedSeccIds: [] as number[], label: 'Global (Todas las Seccionales)' };
    }
    if (scope === 'seccional') {
      const ids =
        modSeccionalIds.length > 0
          ? modSeccionalIds
          : Array.isArray(socAllowed) && socAllowed.length > 0
          ? socAllowed
          : effectiveSecId
          ? [Number(effectiveSecId)]
          : [];
      return {
        mode: 'seccionales' as const,
        allowedSeccIds: ids,
        label: ids.length === 1 && userSeccionalNombre ? `Seccional: ${userSeccionalNombre}` : `Seccional (${ids.length})`,
      };
    }
    if (permissions.view_socorristas || role === 'director') {
      const ids = Array.isArray(socAllowed)
        ? socAllowed
        : effectiveSecId
        ? [Number(effectiveSecId)]
        : [];
      return {
        mode: 'seccionales' as const,
        allowedSeccIds: ids,
        label: ids.length === 1 && userSeccionalNombre ? `Seccional: ${userSeccionalNombre}` : `Seccionales (${ids.length})`,
      };
    }
    return { mode: 'usuario' as const, allowedSeccIds: [] as number[], label: 'Solo Mi Registro' };
  }, [
    role,
    seccionalesSocorristasAccess,
    permissions,
    directorSeccionalId,
    userSeccionalId,
    userSeccionalNombre,
    getModuleScope,
    getModuleSeccionalIds,
    getAllowedSocorristaSeccionalIds,
  ]);

  const loadElementsAndRequests = async () => {
    if (authLoading) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data: secData } = await supabase.from('seccionales').select('id, nombre').order('nombre');
      const allSecs = secData || [];

      if (accessScopeInfo.mode === 'all') {
        setSeccionalesList(allSecs);
      } else if (accessScopeInfo.mode === 'seccionales') {
        const allowedSet = new Set(accessScopeInfo.allowedSeccIds.map(Number));
        setSeccionalesList(allSecs.filter((s: any) => allowedSet.has(Number(s.id))));
      } else {
        setSeccionalesList([]);
      }

      let query = supabase
        .from('socorristas')
        .select(`
          id,
          carnet,
          dui,
          primer_nombre,
          segundo_nombre,
          primer_apellido,
          segundo_apellido,
          estado,
          cargo_institucional,
          foto_url,
          seccional_id,
          seccionales (id, nombre)
        `)
        .eq('estado', 'Activo')
        .order('primer_apellido', { ascending: true });

      if (accessScopeInfo.mode === 'seccionales') {
        if (accessScopeInfo.allowedSeccIds.length === 0) {
          setSocorristas([]);
          setRequestsMap({});
          setLoading(false);
          return;
        }
        query = query.in('seccional_id', accessScopeInfo.allowedSeccIds);
      } else if (accessScopeInfo.mode === 'usuario') {
        if (!socorristaId) {
          setSocorristas([]);
          setRequestsMap({});
          setLoading(false);
          return;
        }
        query = query.eq('id', socorristaId);
      }

      const { data: socData, error: socErr } = await query;
      if (socErr) throw socErr;

      const mapped = (socData || []).map((s: any) => {
        const secObj = Array.isArray(s.seccionales) ? s.seccionales[0] : s.seccionales;
        const nameValidation = validateSocorristaNameForCarnet(s);
        return {
          ...s,
          seccional_nombre: secObj?.nombre || 'N/A',
          nombre_completo: `${s.primer_nombre || ''} ${s.segundo_nombre || ''} ${s.primer_apellido || ''} ${s.segundo_apellido || ''}`
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase(),
          nameValidation,
        };
      });

      setSocorristas(mapped);

      const ids = mapped.map((m: any) => Number(m.id)).filter(Boolean);
      const reqMap = ids.length > 0 ? await fetchLatestCarnetRequestsMap(ids) : {};
      setRequestsMap(reqMap);
    } catch (err: any) {
      console.error('Error cargando elementos para lote:', err);
      setErrorMsg(err?.message || 'No se pudieron cargar los elementos habilitados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      loadElementsAndRequests();
    }
  }, [authLoading, accessScopeInfo.mode, accessScopeInfo.allowedSeccIds.join(','), socorristaId]);

  const filteredSocorristas = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return socorristas.filter((s) => {
      const matchesQuery =
        !q ||
        s.nombre_completo.toLowerCase().includes(q) ||
        (s.carnet || '').toLowerCase().includes(q) ||
        (s.dui || '').toLowerCase().includes(q) ||
        (s.cargo_institucional || '').toLowerCase().includes(q) ||
        (s.seccional_nombre || '').toLowerCase().includes(q);

      const matchesSeccional = filterSeccional === 'Todas' || s.seccional_nombre === filterSeccional;

      const req = requestsMap[s.id];
      const blocked = Boolean(req && isBlockingCarnetState(req.estado_solicitud));
      const observed = req?.estado_solicitud === 'Observada';
      const hasPhoto = Boolean(stagedPhotos[s.id]?.previewUrl || s.foto_url);
      const hasValidName = s.nameValidation ? s.nameValidation.isValid : true;

      let matchesStatus = true;
      if (filterEstado === 'Disponibles') matchesStatus = !blocked && hasValidName;
      else if (filterEstado === 'SinFoto') matchesStatus = !blocked && !hasPhoto;
      else if (filterEstado === 'NombreInvalido') matchesStatus = !hasValidName;
      else if (filterEstado === 'Bloqueados') matchesStatus = blocked;
      else if (filterEstado === 'Observados') matchesStatus = observed;

      return matchesQuery && matchesSeccional && matchesStatus;
    });
  }, [socorristas, searchTerm, filterSeccional, filterEstado, requestsMap, stagedPhotos]);

  const stats = useMemo(() => {
    let disponibles = 0;
    let bloqueados = 0;
    let sinFoto = 0;
    let observados = 0;
    let nombreInvalido = 0;
    socorristas.forEach((s) => {
      const req = requestsMap[s.id];
      const blocked = Boolean(req && isBlockingCarnetState(req.estado_solicitud));
      const hasPhoto = Boolean(stagedPhotos[s.id]?.previewUrl || s.foto_url);
      const hasValidName = s.nameValidation ? s.nameValidation.isValid : true;
      if (!hasValidName) nombreInvalido += 1;
      if (blocked) bloqueados += 1;
      else {
        if (hasValidName) disponibles += 1;
        if (!hasPhoto) sinFoto += 1;
      }
      if (req?.estado_solicitud === 'Observada') observados += 1;
    });
    return { total: socorristas.length, disponibles, bloqueados, sinFoto, observados, nombreInvalido };
  }, [socorristas, requestsMap, stagedPhotos]);

  const handleToggleRow = (s: any) => {
    const req = requestsMap[s.id];
    if (req && isBlockingCarnetState(req.estado_solicitud)) return;
    if (s.nameValidation && !s.nameValidation.isValid) {
      setSubmitError(s.nameValidation.message);
      return;
    }

    const hasPhoto = Boolean(stagedPhotos[s.id]?.previewUrl || s.foto_url);
    if (!hasPhoto) {
      setPhotoModalTarget({ socorrista: s, selectAfterCapture: true });
      return;
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(s.id)) next.delete(s.id);
      else next.add(s.id);
      return next;
    });
  };

  const handleSelectAllAvailableWithPhoto = () => {
    const selectableIds = filteredSocorristas
      .filter((s) => {
        const req = requestsMap[s.id];
        const blocked = Boolean(req && isBlockingCarnetState(req.estado_solicitud));
        const hasPhoto = Boolean(stagedPhotos[s.id]?.previewUrl || s.foto_url);
        const hasValidName = s.nameValidation ? s.nameValidation.isValid : true;
        return !blocked && hasPhoto && hasValidName;
      })
      .map((s) => s.id);

    const allAlreadySelected =
      selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allAlreadySelected) {
        selectableIds.forEach((id) => next.delete(id));
      } else {
        selectableIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handlePhotoReady = (file: File, previewUrl: string) => {
    if (!photoModalTarget) return;
    const targetId = photoModalTarget.socorrista.id;
    setStagedPhotos((prev) => ({
      ...prev,
      [targetId]: { file, previewUrl },
    }));
    if (photoModalTarget.selectAfterCapture) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.add(targetId);
        return next;
      });
    }
    setPhotoModalTarget(null);
  };

  const handleSubmitBatch = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (selectedIds.size === 0) {
      setSubmitError('Selecciona al menos un elemento disponible con fotografía para enviar el lote.');
      return;
    }
    if (['Cambio', 'Reposición'].includes(tipoSolicitud) && !motivo) {
      setSubmitError('Selecciona el motivo para la solicitud de Cambio o Reposición.');
      return;
    }
    if (motivo === 'Otro' && !detallesMotivo.trim()) {
      setSubmitError('Detalla el motivo de la solicitud.');
      return;
    }
    if (!confirmBatch) {
      setSubmitError('Debes confirmar la verificación de datos y fotografías antes de enviar el lote.');
      return;
    }

    const targets = socorristas.filter((s) => selectedIds.has(s.id));
    const invalidNameTarget = targets.find((s) => s.nameValidation && !s.nameValidation.isValid);
    if (invalidNameTarget) {
      setSubmitError(invalidNameTarget.nameValidation.message);
      return;
    }
    const missingPhoto = targets.find((s) => !stagedPhotos[s.id]?.file && !s.foto_url);
    if (missingPhoto) {
      setSubmitError(`El elemento ${missingPhoto.nombre_completo} requiere fotografía antes de incluirse en el lote.`);
      return;
    }

    setShowSubmitConfirmModal(true);
  };

  const executeSubmitBatch = async () => {
    const targets = socorristas.filter((s) => selectedIds.has(s.id));
    if (targets.length === 0) return;

    setSubmitError(null);
    setSubmitting(true);
    const total = targets.length;
    setSubmitProgress({ current: 0, total });

    const loteId = `LOTE-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    const submittedResults: { carnet: string; nombre: string; via: string }[] = [];
    const failedItems: string[] = [];

    try {
      for (let i = 0; i < targets.length; i++) {
        const s = targets[i];
        setSubmitProgress({ current: i + 1, total });

        let fotoUrl: string | null = s.foto_url || null;
        const staged = stagedPhotos[s.id];

        if (staged?.file) {
          fotoUrl = await uploadCarnetPhotoWithFallback(
            staged.file,
            `${s.carnet || `SOC_${s.id}`}_lote_${i}`
          );
        }

        const res = await createCarnetSolicitudSafe({
          socorrista_id: s.id,
          carnet: s.carnet,
          nombre_completo: s.nombre_completo,
          seccional_id: s.seccional_id,
          seccional_nombre: s.seccional_nombre,
          tipo_solicitud: tipoSolicitud,
          motivo: ['Cambio', 'Reposición'].includes(tipoSolicitud) ? motivo : null,
          detalles_motivo: motivo === 'Otro' ? detallesMotivo.trim() : null,
          foto_url: fotoUrl,
          solicitado_por: userName || user?.email || 'Usuario del Sistema',
          solicitado_por_email: user?.email || null,
          lote_id: loteId,
          es_lote: true,
        });

        if (res.ok) {
          submittedResults.push({
            carnet: s.carnet || `ID-${s.id}`,
            nombre: s.nombre_completo,
            via: res.via,
          });
        } else {
          failedItems.push(`${s.nombre_completo} (${res.error || 'Error'})`);
        }
      }

      if (submittedResults.length > 0) {
        await logActivity('Creó solicitud de carnet en lote', 'SolicitudCarnet', loteId, {
          lote_id: loteId,
          cantidad: submittedResults.length,
          tipo_solicitud: tipoSolicitud,
          carnets: submittedResults.map((r) => r.carnet),
          confirmacion_datos_dui: true,
          confirmacion_foto_cumplimiento: true,
        });
        window.dispatchEvent(new Event('solicitudes_updated'));

        setBatchSuccessInfo({
          loteId,
          fecha: formatCarnetRequestDate(getElSalvadorIsoTimestamp()),
          elementos: submittedResults,
        });
        setSelectedIds(new Set());
        setStagedPhotos({});
        setConfirmBatch(false);
        await loadElementsAndRequests();
      }

      if (failedItems.length > 0) {
        setSubmitError(`No se pudieron registrar ${failedItems.length} solicitud(es): ${failedItems.join(', ')}`);
      }
    } catch (err: any) {
      console.error('Error enviando lote de carnets:', err);
      setSubmitError(err?.message || 'Error inesperado al procesar el lote.');
    } finally {
      setShowSubmitConfirmModal(false);
      setSubmitting(false);
      setSubmitProgress(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Top Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              to="/solicitud-carnet"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 shadow-2xs transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-primary" />
              Volver a Solicitud Individual
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white shadow-2xs transition-colors"
            >
              Ir al Dashboard
            </Link>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Nivel de acceso: {accessScopeInfo.label}</span>
          </div>
        </div>

        {/* Hero Header */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {logos?.verificacion ? (
              <img src={logos.verificacion} alt="Cruz Verde" className="h-14 w-auto object-contain rounded-lg" />
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                <Layers className="w-6 h-6" />
              </div>
            )}
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Solicitud de Carnet en Lote
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Selecciona múltiples elementos habilitados de tu seccional para solicitar su carnet institucional. Si alguno no tiene fotografía, el sistema te pedirá tomar o subir una antes de seleccionarlo.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadElementsAndRequests}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer shrink-0 self-start md:self-center"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar Lista
          </button>
        </div>

        {/* Batch Success Banner */}
        {batchSuccessInfo && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-3xl p-5 shadow-xs space-y-3 animate-in fade-in">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-emerald-950">
                    ¡Solicitud en Lote Enviada Correctamente!
                  </h2>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Código de lote: <span className="font-mono font-bold">{batchSuccessInfo.loteId}</span> • Fecha: <strong>{batchSuccessInfo.fecha}</strong> • {batchSuccessInfo.elementos.length} elemento(s) registrados.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBatchSuccessInfo(null)}
                className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
              >
                Cerrar aviso
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {batchSuccessInfo.elementos.map((el, idx) => (
                <span
                  key={`${el.carnet}-${idx}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-[11px] font-semibold text-emerald-900"
                >
                  <span className="font-mono text-emerald-700">{el.carnet}</span>
                  <span>{el.nombre}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Stats Strip */}
        <div className={`grid grid-cols-2 ${stats.nombreInvalido > 0 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3`}>
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase">Accesibles</p>
              <p className="text-2xl font-black text-slate-900">{stats.total}</p>
            </div>
            <Users className="w-6 h-6 text-slate-300" />
          </div>
          <div className="bg-white rounded-2xl border border-emerald-200/80 p-4 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-emerald-700 uppercase">Disponibles</p>
              <p className="text-2xl font-black text-emerald-800">{stats.disponibles}</p>
            </div>
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          </div>
          <div className="bg-white rounded-2xl border border-amber-200/80 p-4 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-amber-700 uppercase">Sin Foto (Req.)</p>
              <p className="text-2xl font-black text-amber-800">{stats.sinFoto}</p>
            </div>
            <Camera className="w-6 h-6 text-amber-500" />
          </div>
          {stats.nombreInvalido > 0 && (
            <button
              type="button"
              onClick={() => setFilterEstado('NombreInvalido')}
              className="bg-rose-50/70 hover:bg-rose-50 rounded-2xl border border-rose-300 p-4 shadow-2xs flex items-center justify-between text-left transition-colors cursor-pointer"
            >
              <div>
                <p className="text-[11px] font-bold text-rose-700 uppercase">Nombre Inválido</p>
                <p className="text-2xl font-black text-rose-800">{stats.nombreInvalido}</p>
              </div>
              <AlertTriangle className="w-6 h-6 text-rose-500" />
            </button>
          )}
          <div className="bg-white rounded-2xl border border-rose-200/80 p-4 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-rose-700 uppercase">Con Sol. Activa</p>
              <p className="text-2xl font-black text-rose-800">{stats.bloqueados}</p>
            </div>
            <Clock className="w-6 h-6 text-rose-500" />
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre, carnet, DUI..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
              />
            </div>

            <select
              value={filterSeccional}
              onChange={(e) => setFilterSeccional(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            >
              <option value="Todas">
                {seccionalesList.length === 1
                  ? seccionalesList[0].nombre
                  : `Todas las seccionales permitidas (${seccionalesList.length})`}
              </option>
              {seccionalesList.map((sec) => (
                <option key={sec.id} value={sec.nombre}>
                  {sec.nombre}
                </option>
              ))}
            </select>

            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value as any)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            >
              <option value="Todos">Todos los estados</option>
              <option value="Disponibles">Disponibles para solicitar</option>
              <option value="SinFoto">Disponibles sin fotografía</option>
              <option value="NombreInvalido">Con símbolos inválidos en el nombre</option>
              <option value="Bloqueados">Con solicitud activa (bloqueados)</option>
              <option value="Observados">Con observación (requieren corrección)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleSelectAllAvailableWithPhoto}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 cursor-pointer shrink-0"
          >
            <CheckSquare className="w-4 h-4 text-emerald-600" />
            Seleccionar disponibles con foto
          </button>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-800 font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Table of Accessible Elements */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-xs font-semibold">Cargando elementos habilitados y estado de solicitudes...</p>
            </div>
          ) : filteredSocorristas.length === 0 ? (
            <div className="py-16 text-center px-4 space-y-2">
              <IdCard className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">No hay elementos disponibles con los filtros actuales</p>
              <p className="text-xs text-slate-400">
                Verifica tu nivel de acceso por seccional o ajusta los criterios de búsqueda.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/90">
                  <tr>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider w-12">
                      Sel.
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Fotografía
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Elemento / Carnet
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Seccional / Cargo
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Estado de Solicitud / Disponibilidad
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredSocorristas.map((s) => {
                    const req = requestsMap[s.id];
                    const blocked = Boolean(req && isBlockingCarnetState(req.estado_solicitud));
                    const observed = req?.estado_solicitud === 'Observada';
                    const rejected = req?.estado_solicitud === 'Rechazada';
                    const staged = stagedPhotos[s.id];
                    const effectivePhoto = staged?.previewUrl || s.foto_url || null;
                    const hasPhoto = Boolean(effectivePhoto);
                    const hasValidName = s.nameValidation ? s.nameValidation.isValid : true;
                    const rowBlocked = blocked || !hasValidName;
                    const isSelected = selectedIds.has(s.id);

                    return (
                      <tr
                        key={s.id}
                        className={`transition-colors ${
                          !hasValidName
                            ? 'bg-rose-50/40'
                            : blocked
                            ? 'bg-slate-50/60 opacity-85'
                            : isSelected
                            ? 'bg-emerald-50/50'
                            : 'hover:bg-slate-50/70'
                        }`}
                      >
                        {/* Select Checkbox */}
                        <td className="px-4 py-3.5 align-middle">
                          <button
                            type="button"
                            disabled={rowBlocked}
                            onClick={() => handleToggleRow(s)}
                            title={
                              !hasValidName
                                ? s.nameValidation.message
                                : blocked
                                ? 'Elemento bloqueado hasta que finalice su solicitud activa o reciba observación'
                                : !hasPhoto
                                ? 'Subir o tomar fotografía antes de seleccionar'
                                : isSelected
                                ? 'Quitar del lote'
                                : 'Incluir en el lote'
                            }
                            className={`p-1 rounded-lg transition-colors ${
                              rowBlocked
                                ? 'text-slate-300 cursor-not-allowed'
                                : isSelected
                                ? 'text-emerald-600 hover:bg-emerald-100 cursor-pointer'
                                : !hasPhoto
                                ? 'text-amber-500 hover:bg-amber-50 cursor-pointer'
                                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer'
                            }`}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5" />
                            ) : (
                              <Square className="w-5 h-5" />
                            )}
                          </button>
                        </td>

                        {/* Photo Column */}
                        <td className="px-4 py-3.5 align-middle">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-12 h-12 rounded-full overflow-hidden border-2 flex items-center justify-center shrink-0 ${
                                staged
                                  ? 'border-emerald-500 bg-emerald-50'
                                  : effectivePhoto
                                  ? 'border-slate-200 bg-slate-100'
                                  : 'border-amber-400 border-dashed bg-amber-50'
                              }`}
                            >
                              {effectivePhoto ? (
                                <SmartStorageImage
                                  src={effectivePhoto}
                                  fallbackSrc={s.foto_url}
                                  alt={s.nombre_completo}
                                  className="w-full h-full object-cover"
                                  fallback={<Camera className="w-5 h-5 text-amber-500" />}
                                />
                              ) : (
                                <Camera className="w-5 h-5 text-amber-500" />
                              )}
                            </div>

                            {!blocked && (
                              <div className="space-y-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPhotoModalTarget({
                                      socorrista: s,
                                      selectAfterCapture: !hasPhoto || isSelected,
                                    })
                                  }
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                                    !hasPhoto
                                      ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500 shadow-2xs'
                                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  <ImagePlus className="w-3.5 h-3.5" />
                                  {!hasPhoto ? 'Subir / Tomar Foto' : staged ? 'Cambiar nueva foto' : 'Actualizar foto'}
                                </button>
                                {!hasPhoto && (
                                  <p className="text-[10px] font-semibold text-amber-700">
                                    Requerida antes de seleccionar
                                  </p>
                                )}
                                {staged && (
                                  <p className="text-[10px] font-semibold text-emerald-700">
                                    ✓ Nueva foto lista
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Name & Carnet */}
                        <td className="px-4 py-3.5 align-middle">
                          <p className="text-xs font-bold text-slate-900">{s.nombre_completo}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="inline-flex px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[11px] font-semibold">
                              {s.carnet || 'Sin Carnet'}
                            </span>
                            {s.dui && (
                              <span className="text-[11px] text-slate-400">DUI: {s.dui}</span>
                            )}
                          </div>
                          {!hasValidName && s.nameValidation && (
                            <div className="mt-1.5 p-2 rounded-lg bg-rose-50 border border-rose-200 space-y-1 max-w-xs">
                              <p className="text-[11px] font-bold text-rose-800 flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                <span>
                                  {s.nameValidation.invalidSymbols.length > 0
                                    ? `Símbolo no válido en nombre: ${s.nameValidation.invalidSymbols.map((sym: string) => `"${sym}"`).join(', ')}`
                                    : 'Nombre incompleto en perfil'}
                                </span>
                              </p>
                              <Link
                                to={`/socorristas/${s.id}`}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 hover:text-rose-900 underline"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Corregir nombre en perfil
                              </Link>
                            </div>
                          )}
                        </td>

                        {/* Seccional & Cargo */}
                        <td className="px-4 py-3.5 align-middle">
                          <div className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {s.seccional_nombre}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {s.cargo_institucional || 'Socorrista'}
                          </p>
                        </td>

                        {/* Status & Blocking Feedback */}
                        <td className="px-4 py-3.5 align-middle">
                          {blocked && req ? (
                            <div className="p-2.5 rounded-xl bg-rose-50/80 border border-rose-200 space-y-1 max-w-sm">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                  <Clock className="w-3 h-3" />
                                  {req.estado_solicitud}
                                </span>
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-slate-700 border border-slate-200">
                                  {req.es_lote ? `En Lote${req.lote_id ? ` (${req.lote_id})` : ''}` : 'Individual'}
                                </span>
                              </div>
                              <p className="text-[11px] font-semibold text-rose-900">
                                Solicitado el: {formatCarnetRequestDate(req.fecha_solicitud)}
                              </p>
                              <p className="text-[10px] text-rose-700 leading-snug">
                                Bloqueado: debe esperar hasta que la solicitud sea completada/finalizada o reciba una observación.
                              </p>
                            </div>
                          ) : (observed || rejected) && req ? (
                            <div
                              className={`p-2.5 rounded-xl border space-y-1 max-w-sm ${
                                rejected
                                  ? 'bg-rose-50 border-rose-200'
                                  : 'bg-orange-50 border-orange-200'
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                    rejected
                                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                                      : 'bg-orange-100 text-orange-800 border-orange-300'
                                  }`}
                                >
                                  <AlertTriangle className="w-3 h-3" />
                                  {rejected
                                    ? 'Rechazada (Habilitada para reenviar)'
                                    : 'Observada (Habilitada para reenviar)'}
                                </span>
                              </div>
                              <p
                                className={`text-[11px] font-semibold ${
                                  rejected ? 'text-rose-900' : 'text-orange-900'
                                }`}
                              >
                                Solicitud previa: {formatCarnetRequestDate(req.fecha_solicitud)}
                              </p>
                              {req.observaciones && (
                                <p
                                  className={`text-[11px] leading-snug ${
                                    rejected ? 'text-rose-800' : 'text-orange-800'
                                  }`}
                                >
                                  <strong>{rejected ? 'Motivo:' : 'Observación:'}</strong> {req.observaciones}
                                </p>
                              )}
                            </div>
                          ) : req ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                Disponible
                              </span>
                              <p className="text-[10px] text-slate-500">
                                Última solicitud ({req.estado_solicitud}): {formatCarnetRequestDate(req.fecha_solicitud)}
                              </p>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Disponible para solicitar
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Batch Submission Form */}
        <form
          onSubmit={handleSubmitBatch}
          className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 sm:p-6 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Configuración de Solicitud en Lote
              </h2>
              <p className="text-xs text-slate-500">
                Elementos seleccionados actualmente: <strong className="text-emerald-700">{selectedIds.size}</strong>
              </p>
            </div>
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer self-start sm:self-center"
              >
                Limpiar selección
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tipo de Solicitud para el Lote
              </label>
              <select
                value={tipoSolicitud}
                onChange={(e) => setTipoSolicitud(e.target.value as any)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
              >
                <option value="Nuevo">Solicitud de Carnet Nuevo</option>
                <option value="Cambio">Cambio de Carnet</option>
                <option value="Reposición">Reposición de Carnet</option>
              </select>
            </div>

            {['Cambio', 'Reposición'].includes(tipoSolicitud) && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Motivo</label>
                <select
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                >
                  <option value="">Seleccione un motivo...</option>
                  <option value="Extravio">Extravío</option>
                  <option value="Robo">Robo</option>
                  <option value="Dañado">Dañado</option>
                  <option value="Informacion incorrecta">Información incorrecta</option>
                  <option value="Actualizacion de fotografia">Actualización de fotografía</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
            )}

            {['Cambio', 'Reposición'].includes(tipoSolicitud) && motivo === 'Otro' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Detalle del Motivo</label>
                <input
                  type="text"
                  value={detallesMotivo}
                  onChange={(e) => setDetallesMotivo(e.target.value)}
                  required
                  placeholder="Describe el motivo del lote..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                />
              </div>
            )}
          </div>

          <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmBatch}
              onChange={(e) => setConfirmBatch(e.target.checked)}
              className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-xs text-slate-700 leading-relaxed">
              Confirmo que los datos y fotografías de los <strong>{selectedIds.size}</strong> elemento(s) seleccionados son correctos y acepto el proceso de validación y tiempo estimado de emisión institucional (1 a 15 días hábiles).
            </span>
          </label>

          {submitError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            {submitProgress && (
              <span className="text-xs font-semibold text-emerald-700">
                Procesando {submitProgress.current} de {submitProgress.total}...
              </span>
            )}
            <button
              type="submit"
              disabled={submitting || selectedIds.size === 0 || !confirmBatch}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary hover:bg-primary-hover text-white text-sm font-bold shadow-sm disabled:opacity-50 cursor-pointer transition-all"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {submitting
                ? 'Enviando Solicitud en Lote...'
                : `Enviar Solicitud en Lote (${selectedIds.size})`}
            </button>
          </div>
        </form>
      </div>

      <CarnetPhotoCaptureModal
        isOpen={Boolean(photoModalTarget)}
        onClose={() => setPhotoModalTarget(null)}
        onPhotoReady={handlePhotoReady}
        title={
          photoModalTarget
            ? `Fotografía para ${photoModalTarget.socorrista.nombre_completo}`
            : 'Fotografía Oficial para Carnet'
        }
      />

      <CarnetSubmitConfirmModal
        isOpen={showSubmitConfirmModal}
        onClose={() => setShowSubmitConfirmModal(false)}
        onConfirmFinal={executeSubmitBatch}
        loading={submitting}
        isBatch={true}
        items={socorristas
          .filter((s) => selectedIds.has(s.id))
          .map((s) => ({
            id: s.id,
            nombre: s.nombre_completo,
            carnet: s.carnet,
            dui: s.dui || null,
            fotoUrl: stagedPhotos[s.id]?.previewUrl || s.foto_url || null,
          }))}
      />

      <footer className="bg-white border-t border-slate-200 py-6 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500">
          &copy; {getElSalvadorDateTime().year} Cruz Verde Salvadoreña
        </div>
      </footer>
    </div>
  );
}
