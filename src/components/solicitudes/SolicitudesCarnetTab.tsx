import React, { useState, useEffect, useMemo } from 'react';
import {
  IdCard,
  Search,
  Filter,
  Eye,
  Edit3,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  Building2,
  User,
  RefreshCw,
  X,
  Check,
  FileSpreadsheet,
  Camera,
  MessageSquare,
  ZoomIn,
  ImagePlus,
  CheckCheck,
  Crop,
  ScanFace,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { logActivity } from '../../lib/logger';
import SmartStorageImage from '../common/SmartStorageImage';
import CarnetPhotoCaptureModal, { CarnetPhotoReadyMeta } from '../common/CarnetPhotoCaptureModal';
import { uploadCarnetPhotoWithFallback } from '../../utils/solicitudesCarnet';
import { useSolicitudReadTracker, publishModuleUnreadCount } from '../../utils/solicitudReadTracker';
import {
  analyzeCarnetPhoto,
  loadImageSafelyAsDataUrl,
  CarnetPhotoAnalysis,
} from '../../utils/carnetPhotoAnalyzer';

export interface SolicitudCarnetRecord {
  id: number | string;
  socorrista_id: number;
  socorrista_nombre: string;
  carnet: string;
  seccional_id: number | null;
  seccional_nombre: string;
  tipo_solicitud: string;
  motivo: string | null;
  detalles_motivo: string | null;
  foto_url: string | null;
  socorrista_foto_actual?: string | null;
  observaciones: string | null;
  solicitado_por: string;
  solicitado_por_email: string | null;
  revisado_por: string | null;
  fecha_revision: string | null;
  estado_solicitud: string;
  fecha_solicitud: string;
  lote_id?: string | null;
  es_lote?: boolean;
  source: 'db' | 'config';
  config_clave?: string;
}

const ESTADOS_CARNET = [
  'Pendiente',
  'En revisión',
  'Observada',
  'Aprobada',
  'En impresión',
  'Lista para entrega',
  'Completado',
  'Completada',
  'Finalizada',
  'Rechazada',
];

function isCompletedCarnetEstado(estado?: string | null): boolean {
  return estado === 'Completado' || estado === 'Completada' || estado === 'Finalizada';
}

function isAcceptedCarnetEstado(estado?: string | null): boolean {
  return estado === 'Aprobada' || estado === 'Aceptada';
}

function getWeekDateRange(weekStr: string): { start: Date; end: Date; label: string } | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekStr);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setDate(jan4.getDate() - (jan4Day - 1));
  const start = new Date(mondayWeek1);
  start.setDate(mondayWeek1.getDate() + (week - 1) * 7);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  return { start, end, label: `Lun ${fmt(start)} - Dom ${fmt(end)}` };
}

export default function SolicitudesCarnetTab() {
  const {
    user,
    userName,
    role,
    socorristaId,
    permissions,
    userSeccionalId,
    userSeccionalNombre,
    directorSeccionalId,
    getModuleScope,
    getModuleSeccionalIds,
  } = useAuth();

  const isAdmin = role === 'admin';
  const scope = getModuleScope('solicitudes_carnet');
  const allowedSeccionalIds = getModuleSeccionalIds('solicitudes_carnet');
  const canEdit = isAdmin || Boolean(permissions?.edit_solicitudes_carnet);
  const effectiveSeccionalId = directorSeccionalId || userSeccionalId;
  const { isUnread, markAsRead, markManyAsRead } = useSolicitudReadTracker(user?.id);

  const [records, setRecords] = useState<SolicitudCarnetRecord[]>([]);
  const [seccionales, setSeccionales] = useState<{ id: number; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // Smart Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('Todos');
  const [filterSeccional, setFilterSeccional] = useState('Todas');
  const [filterUsuario, setFilterUsuario] = useState('Todos');
  const [periodMode, setPeriodMode] = useState<'todos' | 'mes' | 'semana'>('todos');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedWeek, setSelectedWeek] = useState(() => {
    const now = new Date();
    const jan4 = new Date(now.getFullYear(), 0, 4);
    const days = Math.floor((now.getTime() - jan4.getTime()) / 86400000);
    const weekNum = Math.ceil((days + (jan4.getDay() || 7)) / 7);
    return `${now.getFullYear()}-W${String(Math.max(1, Math.min(53, weekNum))).padStart(2, '0')}`;
  });

  // Detail, Zoom, Crop & Edit Modals
  const [detailRecord, setDetailRecord] = useState<SolicitudCarnetRecord | null>(null);
  const [detailAnalysis, setDetailAnalysis] = useState<CarnetPhotoAnalysis | null>(null);
  const [analyzingDetail, setAnalyzingDetail] = useState(false);
  const [zoomPhotoInfo, setZoomPhotoInfo] = useState<{
    src?: string | null;
    fallbackSrc?: string | null;
    nombre: string;
    carnet: string;
  } | null>(null);
  const [editRecord, setEditRecord] = useState<SolicitudCarnetRecord | null>(null);
  const [editEstado, setEditEstado] = useState('Pendiente');
  const [editObservaciones, setEditObservaciones] = useState('');
  const [editReplacementFile, setEditReplacementFile] = useState<File | null>(null);
  const [editReplacementPreview, setEditReplacementPreview] = useState<string | null>(null);
  const [editPhotoMeta, setEditPhotoMeta] = useState<CarnetPhotoReadyMeta | null>(null);
  const [showReplacePhotoModal, setShowReplacePhotoModal] = useState(false);
  const [photoModalMode, setPhotoModalMode] = useState<'new' | 'crop-edit' | 'crop-direct'>('new');
  const [quickCropRecord, setQuickCropRecord] = useState<SolicitudCarnetRecord | null>(null);
  const [savingQuickActionId, setSavingQuickActionId] = useState<string | number | null>(null);
  const [applyFotoToProfile, setApplyFotoToProfile] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const allowedSecKey = allowedSeccionalIds.join(',');
  useEffect(() => {
    loadData();
  }, [scope, allowedSecKey, effectiveSeccionalId, userSeccionalNombre]);

  // Refrescar automáticamente cuando se genera un carnet o se actualiza una solicitud en otra vista
  useEffect(() => {
    const onUpdated = () => {
      loadData();
    };
    window.addEventListener('solicitudes_updated', onUpdated);
    return () => window.removeEventListener('solicitudes_updated', onUpdated);
  }, []);

  // Analizar automáticamente la fotografía en el modal de detalle (100% local, sin tokens de IA)
  useEffect(() => {
    let cancelled = false;
    if (!detailRecord || (!detailRecord.foto_url && !detailRecord.socorrista_foto_actual)) {
      setDetailAnalysis(null);
      setAnalyzingDetail(false);
      return;
    }
    setAnalyzingDetail(true);
    setDetailAnalysis(null);
    loadImageSafelyAsDataUrl(detailRecord.foto_url, detailRecord.socorrista_foto_actual)
      .then((safeUrl) => (safeUrl ? analyzeCarnetPhoto(safeUrl) : null))
      .then((res) => {
        if (!cancelled) setDetailAnalysis(res);
      })
      .catch(() => {
        if (!cancelled) setDetailAnalysis(null);
      })
      .finally(() => {
        if (!cancelled) setAnalyzingDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailRecord?.id, detailRecord?.foto_url, detailRecord?.socorrista_foto_actual]);

  const loadData = async () => {
    setLoading(true);
    setFeedbackError(null);
    try {
      const { data: secData } = await supabase.from('seccionales').select('id, nombre').order('nombre');
      const secList = secData || [];
      setSeccionales(secList);
      const secNameById = new Map<number, string>();
      secList.forEach((s: any) => secNameById.set(s.id, s.nombre));

      // 1. Query DB solicitudes_carnet with socorristas join
      let dbItems: SolicitudCarnetRecord[] = [];
      const socLookup = new Map<number, any>();

      try {
        const { data, error } = await supabase
          .from('solicitudes_carnet')
          .select(`
            *,
            socorristas (
              id,
              carnet,
              primer_nombre,
              segundo_nombre,
              primer_apellido,
              segundo_apellido,
              foto_url,
              seccional_id,
              seccionales (id, nombre)
            )
          `)
          .order('fecha_solicitud', { ascending: false });

        if (!error && data) {
          dbItems = data.map((row: any) => {
            const soc = Array.isArray(row.socorristas) ? row.socorristas[0] : row.socorristas;
            if (soc?.id) socLookup.set(Number(soc.id), soc);
            const socSec = Array.isArray(soc?.seccionales) ? soc.seccionales[0] : soc?.seccionales;
            const resolvedSecId = row.seccional_id || soc?.seccional_id || socSec?.id || null;
            const resolvedSecNombre =
              row.seccional_nombre ||
              socSec?.nombre ||
              (resolvedSecId ? secNameById.get(resolvedSecId) : null) ||
              'Sin Seccional';

            const nombreSoc = soc
              ? `${soc.primer_nombre || ''} ${soc.segundo_nombre || ''} ${soc.primer_apellido || ''} ${soc.segundo_apellido || ''}`
                  .replace(/\s+/g, ' ')
                  .trim()
              : `Elemento #${row.socorrista_id}`;

            return {
              id: row.id,
              socorrista_id: Number(row.socorrista_id),
              socorrista_nombre: nombreSoc,
              carnet: soc?.carnet || 'S/C',
              seccional_id: resolvedSecId,
              seccional_nombre: resolvedSecNombre,
              tipo_solicitud: row.tipo_solicitud || 'Nuevo',
              motivo: row.motivo || null,
              detalles_motivo: row.detalles_motivo || null,
              foto_url: row.foto_url || null,
              socorrista_foto_actual: soc?.foto_url || null,
              observaciones: row.observaciones || null,
              solicitado_por: row.solicitado_por || nombreSoc,
              solicitado_por_email: row.solicitado_por_email || null,
              revisado_por: row.revisado_por || null,
              fecha_revision: row.fecha_revision || null,
              estado_solicitud: row.estado_solicitud || 'Pendiente',
              fecha_solicitud: row.fecha_solicitud || row.created_at || new Date().toISOString(),
              lote_id: row.lote_id || null,
              es_lote: Boolean(row.es_lote || row.lote_id),
              source: 'db',
            };
          });
        }
      } catch (err) {
        console.warn('Error cargando solicitudes_carnet de DB:', err);
      }

      // 2. Fallback configuracion entries (`solicitud_carnet_%`)
      let configItems: SolicitudCarnetRecord[] = [];
      try {
        const { data: cfgRows } = await supabase
          .from('configuracion')
          .select('clave, valor')
          .like('clave', 'solicitud_carnet_%');

        if (cfgRows) {
          configItems = cfgRows
            .map((r: any) => {
              try {
                const parsed = JSON.parse(r.valor);
                const resolvedSecId = parsed.seccional_id || null;
                const resolvedSecName =
                  parsed.seccional_nombre ||
                  (resolvedSecId ? secNameById.get(resolvedSecId) : null) ||
                  'Sin Seccional';
                return {
                  id: r.clave,
                  socorrista_id: Number(parsed.socorrista_id || 0),
                  socorrista_nombre: parsed.nombre_completo || `Elemento #${parsed.socorrista_id}`,
                  carnet: parsed.carnet || 'S/C',
                  seccional_id: resolvedSecId,
                  seccional_nombre: resolvedSecName,
                  tipo_solicitud: parsed.tipo_solicitud || 'Nuevo',
                  motivo: parsed.motivo || null,
                  detalles_motivo: parsed.detalles_motivo || null,
                  foto_url: parsed.foto_url || null,
                  socorrista_foto_actual: null,
                  observaciones: parsed.observaciones || null,
                  solicitado_por: parsed.solicitado_por || parsed.nombre_completo || 'Solicitante',
                  solicitado_por_email: parsed.solicitado_por_email || null,
                  revisado_por: parsed.revisado_por || null,
                  fecha_revision: parsed.fecha_revision || null,
                  estado_solicitud: parsed.estado_solicitud || 'Pendiente',
                  fecha_solicitud: parsed.fecha_solicitud || new Date().toISOString(),
                  lote_id: parsed.lote_id || null,
                  es_lote: Boolean(parsed.es_lote || parsed.lote_id),
                  source: 'config' as const,
                  config_clave: r.clave,
                };
              } catch {
                return null;
              }
            })
            .filter(Boolean) as SolicitudCarnetRecord[];
        }
      } catch {}

      // Fetch missing socorrista rows (for configItems or rows where join didn't hydrate)
      const allMissingSocIds = Array.from(
        new Set(
          [...dbItems, ...configItems]
            .map((it) => it.socorrista_id)
            .filter((sid) => sid > 0 && !socLookup.has(sid))
        )
      );

      if (allMissingSocIds.length > 0) {
        try {
          const { data: extraSocs } = await supabase
            .from('socorristas')
            .select('id, carnet, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, foto_url, seccional_id')
            .in('id', allMissingSocIds.slice(0, 200));
          if (extraSocs) {
            extraSocs.forEach((s: any) => socLookup.set(Number(s.id), s));
          }
        } catch {}
      }

      // Enrich items with socLookup so socorrista_foto_actual & seccional_id are always available
      const enrichItem = (item: SolicitudCarnetRecord): SolicitudCarnetRecord => {
        const soc = socLookup.get(item.socorrista_id);
        if (!soc) return item;
        const fullName = `${soc.primer_nombre || ''} ${soc.segundo_nombre || ''} ${soc.primer_apellido || ''} ${soc.segundo_apellido || ''}`
          .replace(/\s+/g, ' ')
          .trim();
        const secId = item.seccional_id || soc.seccional_id || null;
        const secName =
          item.seccional_nombre && item.seccional_nombre !== 'Sin Seccional'
            ? item.seccional_nombre
            : (secId ? secNameById.get(secId) : null) || 'Sin Seccional';
        return {
          ...item,
          socorrista_nombre:
            item.socorrista_nombre.startsWith('Elemento #') && fullName ? fullName : item.socorrista_nombre,
          carnet: item.carnet === 'S/C' && soc.carnet ? soc.carnet : item.carnet,
          seccional_id: secId,
          seccional_nombre: secName,
          socorrista_foto_actual: item.socorrista_foto_actual || soc.foto_url || null,
        };
      };

      dbItems = dbItems.map(enrichItem);
      configItems = configItems.map(enrichItem);

      // Merge avoiding duplicates where DB already holds the same socorrista+foto or close timestamp
      const merged = [...dbItems];
      configItems.forEach((ci) => {
        const dup = dbItems.some(
          (di) =>
            di.socorrista_id === ci.socorrista_id &&
            ((di.foto_url && ci.foto_url && di.foto_url === ci.foto_url) ||
              Math.abs(new Date(di.fecha_solicitud).getTime() - new Date(ci.fecha_solicitud).getTime()) < 60000)
        );
        if (!dup) merged.push(ci);
      });

      merged.sort((a, b) => new Date(b.fecha_solicitud).getTime() - new Date(a.fecha_solicitud).getTime());

      // Apply module scope
      const scoped = merged.filter((item) => {
        if (scope === 'global') return true;
        if (scope === 'seccional') {
          const targetIds = allowedSeccionalIds.length > 0
            ? allowedSeccionalIds
            : (effectiveSeccionalId ? [Number(effectiveSeccionalId)] : []);

          if (targetIds.length > 0) {
            if (item.seccional_id && targetIds.includes(Number(item.seccional_id))) return true;
            const allowedNames = secList
              .filter((s: any) => targetIds.includes(s.id))
              .map((s: any) => String(s.nombre || '').toLowerCase());
            if (item.seccional_nombre && allowedNames.some((n) => item.seccional_nombre.toLowerCase().includes(n))) {
              return true;
            }
            return false;
          }
          if (userSeccionalNombre) {
            return item.seccional_nombre.toLowerCase().includes(userSeccionalNombre.toLowerCase());
          }
          return false;
        }
        // scope === 'usuario'
        const emailMatch =
          user?.email && item.solicitado_por_email && item.solicitado_por_email.toLowerCase() === user.email.toLowerCase();
        const nameMatch =
          userName && item.solicitado_por && item.solicitado_por.toLowerCase() === userName.toLowerCase();
        const socMatch = socorristaId && item.socorrista_id === socorristaId;
        return Boolean(emailMatch || nameMatch || socMatch);
      });

      setRecords(scoped);
    } catch (err) {
      console.error('Error loading solicitudes de carnet:', err);
    } finally {
      setLoading(false);
    }
  };

  const uniqueUsuarios = useMemo(() => {
    const names = Array.from(new Set(records.map((r) => r.solicitado_por).filter(Boolean)));
    return names.sort((a, b) => a.localeCompare(b));
  }, [records]);

  const weekRange = useMemo(() => (periodMode === 'semana' ? getWeekDateRange(selectedWeek) : null), [periodMode, selectedWeek]);

  const filteredRecords = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return records.filter((r) => {
      const matchesSearch =
        !q ||
        r.socorrista_nombre.toLowerCase().includes(q) ||
        r.carnet.toLowerCase().includes(q) ||
        r.seccional_nombre.toLowerCase().includes(q) ||
        (r.motivo || '').toLowerCase().includes(q) ||
        (r.observaciones || '').toLowerCase().includes(q) ||
        r.solicitado_por.toLowerCase().includes(q);

      const matchesEstado = filterEstado === 'Todos' || r.estado_solicitud === filterEstado;
      const matchesSeccional = filterSeccional === 'Todas' || r.seccional_nombre === filterSeccional;
      const matchesUsuario = filterUsuario === 'Todos' || r.solicitado_por === filterUsuario;

      let matchesPeriod = true;
      if (periodMode === 'mes' && selectedMonth) {
        const d = new Date(r.fecha_solicitud);
        if (!isNaN(d.getTime())) {
          const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          matchesPeriod = ym === selectedMonth;
        }
      } else if (periodMode === 'semana' && weekRange) {
        const d = new Date(r.fecha_solicitud);
        if (!isNaN(d.getTime())) {
          matchesPeriod = d >= weekRange.start && d <= weekRange.end;
        }
      }

      return matchesSearch && matchesEstado && matchesSeccional && matchesUsuario && matchesPeriod;
    });
  }, [records, searchTerm, filterEstado, filterSeccional, filterUsuario, periodMode, selectedMonth, weekRange]);

  const stats = useMemo(() => {
    return {
      total: filteredRecords.length,
      pendientes: filteredRecords.filter((r) => r.estado_solicitud === 'Pendiente' || r.estado_solicitud === 'En revisión').length,
      aprobadas: filteredRecords.filter((r) => isAcceptedCarnetEstado(r.estado_solicitud)).length,
      observadas: filteredRecords.filter((r) => r.estado_solicitud === 'Observada').length,
      completadas: filteredRecords.filter((r) => isCompletedCarnetEstado(r.estado_solicitud)).length,
    };
  }, [filteredRecords]);

  const unreadVisibleRecords = useMemo(
    () => filteredRecords.filter((r) => isUnread('carnet', r.id, r.estado_solicitud, r.fecha_solicitud)),
    [filteredRecords, isUnread]
  );

  const totalUnreadScope = useMemo(
    () => records.filter((r) => isUnread('carnet', r.id, r.estado_solicitud, r.fecha_solicitud)).length,
    [records, isUnread]
  );

  useEffect(() => {
    if (!loading) {
      publishModuleUnreadCount('carnet', totalUnreadScope);
    }
  }, [loading, totalUnreadScope]);

  const handleOpenDetail = (rec: SolicitudCarnetRecord) => {
    markAsRead('carnet', rec.id);
    setDetailRecord(rec);
  };

  const handleOpenEdit = (rec: SolicitudCarnetRecord) => {
    markAsRead('carnet', rec.id);
    setEditRecord(rec);
    setEditEstado(rec.estado_solicitud || 'Pendiente');
    setEditObservaciones(rec.observaciones || '');
    setEditReplacementFile(null);
    setEditReplacementPreview(null);
    setEditPhotoMeta(null);
    setApplyFotoToProfile(Boolean(rec.foto_url && rec.foto_url !== rec.socorrista_foto_actual));
  };

  const handleOpenDirectCrop = (rec: SolicitudCarnetRecord) => {
    markAsRead('carnet', rec.id);
    setQuickCropRecord(rec);
    setPhotoModalMode('crop-direct');
    setShowReplacePhotoModal(true);
  };

  const handleQuickAccept = async (rec: SolicitudCarnetRecord) => {
    if (!canEdit) return;
    markAsRead('carnet', rec.id);
    setSavingQuickActionId(rec.id);
    setFeedbackError(null);
    setFeedbackSuccess(null);
    try {
      const revisadoPor = userName || user?.email || 'Administración';
      const fechaRev = new Date().toISOString();

      if (rec.source === 'db') {
        const { error } = await supabase
          .from('solicitudes_carnet')
          .update({
            estado_solicitud: 'Aprobada',
            revisado_por: revisadoPor,
            fecha_revision: fechaRev,
            updated_at: fechaRev,
          })
          .eq('id', rec.id);

        if (error) {
          const { error: fallbackErr } = await supabase
            .from('solicitudes_carnet')
            .update({ estado_solicitud: 'Aprobada' })
            .eq('id', rec.id);
          if (fallbackErr) throw fallbackErr;
        }
      } else if (rec.config_clave) {
        const { data: existing } = await supabase
          .from('configuracion')
          .select('valor')
          .eq('clave', rec.config_clave)
          .maybeSingle();
        const currentObj = existing?.valor ? JSON.parse(existing.valor) : {};
        await supabase
          .from('configuracion')
          .update({
            valor: JSON.stringify({
              ...currentObj,
              estado_solicitud: 'Aprobada',
              revisado_por: revisadoPor,
              fecha_revision: fechaRev,
            }),
          })
          .eq('clave', rec.config_clave);
      }

      // Sincronizar fotografía aprobada con el perfil si existe
      if (rec.foto_url && rec.socorrista_id) {
        await supabase
          .from('socorristas')
          .update({ foto_url: rec.foto_url })
          .eq('id', rec.socorrista_id);
      }

      setRecords((prev) =>
        prev.map((r) =>
          r.id === rec.id
            ? {
                ...r,
                estado_solicitud: 'Aprobada',
                revisado_por: revisadoPor,
                fecha_revision: fechaRev,
                socorrista_foto_actual: rec.foto_url || r.socorrista_foto_actual,
              }
            : r
        )
      );
      if (detailRecord?.id === rec.id) {
        setDetailRecord((prev) =>
          prev
            ? {
                ...prev,
                estado_solicitud: 'Aprobada',
                revisado_por: revisadoPor,
                fecha_revision: fechaRev,
              }
            : null
        );
      }

      await logActivity('Aceptó solicitud de carnet para emisión', 'SolicitudCarnet', String(rec.id), {
        socorrista: rec.socorrista_nombre,
        carnet: rec.carnet,
        estado: 'Aprobada',
      });

      window.dispatchEvent(new Event('solicitudes_updated'));
      setFeedbackSuccess(
        `Solicitud de ${rec.socorrista_nombre} aceptada. Ahora está disponible en Generar Carnet.`
      );
    } catch (err: any) {
      console.error('Error aceptando solicitud de carnet:', err);
      setFeedbackError('No se pudo aceptar la solicitud: ' + (err?.message || 'Error de red'));
    } finally {
      setSavingQuickActionId(null);
    }
  };

  const handleReplacementPhotoReady = async (
    file: File,
    previewUrl: string,
    meta?: CarnetPhotoReadyMeta
  ) => {
    if (photoModalMode === 'crop-direct' && quickCropRecord) {
      const target = quickCropRecord;
      setSavingQuickActionId(target.id);
      setFeedbackError(null);
      setFeedbackSuccess(null);
      try {
        const uploadedUrl = await uploadCarnetPhotoWithFallback(
          file,
          `${target.carnet || `SOC_${target.socorrista_id}`}_recorte`
        );
        const nowIso = new Date().toISOString();
        const revisadoPor = userName || user?.email || 'Administración';

        if (target.source === 'db') {
          const fullPayload: any = {
            foto_url: uploadedUrl,
            updated_at: nowIso,
            revisado_por: revisadoPor,
            fecha_revision: nowIso,
          };
          if (meta?.analysis) {
            fullPayload.foto_analisis = {
              status: meta.analysis.status,
              score: meta.analysis.score,
              summary: meta.analysis.summary,
              checked_at: nowIso,
            };
          }
          if (typeof meta?.backgroundReplaced === 'boolean') {
            fullPayload.foto_fondo_reemplazado = meta.backgroundReplaced;
          }

          const { error } = await supabase
            .from('solicitudes_carnet')
            .update(fullPayload)
            .eq('id', target.id);

          if (error) {
            const { error: fallbackErr } = await supabase
              .from('solicitudes_carnet')
              .update({ foto_url: uploadedUrl })
              .eq('id', target.id);
            if (fallbackErr) throw fallbackErr;
          }
        } else if (target.config_clave) {
          const { data: existing } = await supabase
            .from('configuracion')
            .select('valor')
            .eq('clave', target.config_clave)
            .maybeSingle();
          const currentObj = existing?.valor ? JSON.parse(existing.valor) : {};
          await supabase
            .from('configuracion')
            .update({
              valor: JSON.stringify({
                ...currentObj,
                foto_url: uploadedUrl,
                revisado_por: revisadoPor,
                fecha_revision: nowIso,
              }),
            })
            .eq('clave', target.config_clave);
        }

        // Si ya estaba aprobada, mantener sincronizada la foto en el perfil del socorrista
        if (isAcceptedCarnetEstado(target.estado_solicitud) && target.socorrista_id) {
          await supabase
            .from('socorristas')
            .update({ foto_url: uploadedUrl })
            .eq('id', target.socorrista_id);
        }

        setRecords((prev) =>
          prev.map((r) =>
            r.id === target.id
              ? {
                  ...r,
                  foto_url: uploadedUrl,
                  socorrista_foto_actual: isAcceptedCarnetEstado(target.estado_solicitud)
                    ? uploadedUrl
                    : r.socorrista_foto_actual,
                }
              : r
          )
        );
        if (detailRecord?.id === target.id) {
          setDetailRecord((prev) => (prev ? { ...prev, foto_url: uploadedUrl } : null));
        }

        await logActivity('Recortó/editó fotografía de solicitud de carnet', 'SolicitudCarnet', String(target.id), {
          socorrista: target.socorrista_nombre,
          carnet: target.carnet,
          fondo_reemplazado: Boolean(meta?.backgroundReplaced),
          evaluacion: meta?.analysis?.status || null,
        });

        window.dispatchEvent(new Event('solicitudes_updated'));
        setFeedbackSuccess(
          `Fotografía de ${target.socorrista_nombre} recortada y guardada correctamente.`
        );
      } catch (err: any) {
        console.error('Error guardando recorte directo:', err);
        setFeedbackError('No se pudo guardar el recorte de fotografía: ' + (err?.message || 'Error de red'));
      } finally {
        setSavingQuickActionId(null);
        setQuickCropRecord(null);
      }
      return;
    }

    setEditReplacementFile(file);
    setEditReplacementPreview(previewUrl);
    setEditPhotoMeta(meta || null);
    setApplyFotoToProfile(true);
  };

  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRecord || !canEdit) return;
    setSavingEdit(true);
    setFeedbackError(null);
    setFeedbackSuccess(null);
    try {
      const revisadoPor = userName || user?.email || 'Administración';
      const fechaRev = new Date().toISOString();

      let updatedFotoUrl = editRecord.foto_url;
      if (editReplacementFile) {
        updatedFotoUrl = await uploadCarnetPhotoWithFallback(
          editReplacementFile,
          `${editRecord.carnet || `SOC_${editRecord.socorrista_id}`}_solicitud`
        );
      }

      let savedEstado = editEstado;

      if (editRecord.source === 'db') {
        const payload: any = {
          estado_solicitud: editEstado,
          observaciones: editObservaciones.trim() || null,
          revisado_por: revisadoPor,
          fecha_revision: fechaRev,
          updated_at: fechaRev,
        };
        if (updatedFotoUrl !== editRecord.foto_url) {
          payload.foto_url = updatedFotoUrl;
        }
        if (editPhotoMeta?.analysis) {
          payload.foto_analisis = {
            status: editPhotoMeta.analysis.status,
            score: editPhotoMeta.analysis.score,
            summary: editPhotoMeta.analysis.summary,
            checked_at: fechaRev,
          };
        }
        if (typeof editPhotoMeta?.backgroundReplaced === 'boolean') {
          payload.foto_fondo_reemplazado = editPhotoMeta.backgroundReplaced;
        }
        if (editEstado === 'Completado' || editEstado === 'Completada') {
          payload.fecha_completado = fechaRev;
          payload.completado_por = revisadoPor;
        }

        let { error } = await supabase
          .from('solicitudes_carnet')
          .update(payload)
          .eq('id', editRecord.id);

        if (error) {
          // Fallback sin columnas nuevas de migración 53
          const basePayload: any = {
            estado_solicitud: editEstado,
            observaciones: editObservaciones.trim() || null,
            revisado_por: revisadoPor,
            fecha_revision: fechaRev,
          };
          if (updatedFotoUrl !== editRecord.foto_url) {
            basePayload.foto_url = updatedFotoUrl;
          }
          const retry1 = await supabase
            .from('solicitudes_carnet')
            .update(basePayload)
            .eq('id', editRecord.id);
          error = retry1.error;

          // Si el CHECK constraint previo aún no acepta 'Completado', usar 'Completada' sin fallar
          if (error && editEstado === 'Completado') {
            savedEstado = 'Completada';
            const retry2 = await supabase
              .from('solicitudes_carnet')
              .update({ ...basePayload, estado_solicitud: 'Completada' })
              .eq('id', editRecord.id);
            error = retry2.error;
          }

          if (error) {
            const minimalPayload: any = { estado_solicitud: savedEstado };
            if (updatedFotoUrl !== editRecord.foto_url) {
              minimalPayload.foto_url = updatedFotoUrl;
            }
            const { error: fallbackErr } = await supabase
              .from('solicitudes_carnet')
              .update(minimalPayload)
              .eq('id', editRecord.id);
            if (fallbackErr) throw fallbackErr;
          }
        }
      } else if (editRecord.config_clave) {
        const { data: existing } = await supabase
          .from('configuracion')
          .select('valor')
          .eq('clave', editRecord.config_clave)
          .maybeSingle();

        const currentObj = existing?.valor ? JSON.parse(existing.valor) : {};
        await supabase
          .from('configuracion')
          .update({
            valor: JSON.stringify({
              ...currentObj,
              foto_url: updatedFotoUrl,
              estado_solicitud: savedEstado,
              observaciones: editObservaciones.trim() || null,
              revisado_por: revisadoPor,
              fecha_revision: fechaRev,
            }),
          })
          .eq('clave', editRecord.config_clave);
      }

      // Sincronizar foto al perfil si se marcó o al aceptar la solicitud
      if ((applyFotoToProfile || isAcceptedCarnetEstado(savedEstado)) && updatedFotoUrl && editRecord.socorrista_id) {
        await supabase
          .from('socorristas')
          .update({ foto_url: updatedFotoUrl })
          .eq('id', editRecord.socorrista_id);
      }

      setRecords((prev) =>
        prev.map((r) =>
          r.id === editRecord.id
            ? {
                ...r,
                foto_url: updatedFotoUrl,
                estado_solicitud: savedEstado,
                observaciones: editObservaciones.trim() || null,
                revisado_por: revisadoPor,
                fecha_revision: fechaRev,
                socorrista_foto_actual:
                  (applyFotoToProfile || isAcceptedCarnetEstado(savedEstado)) && updatedFotoUrl
                    ? updatedFotoUrl
                    : r.socorrista_foto_actual,
              }
            : r
        )
      );

      await logActivity(`Actualizó solicitud de carnet a ${savedEstado}`, 'SolicitudCarnet', String(editRecord.id), {
        socorrista: editRecord.socorrista_nombre,
        carnet: editRecord.carnet,
        estado: savedEstado,
        observaciones: editObservaciones,
        foto_actualizada: Boolean(editReplacementFile),
      });

      window.dispatchEvent(new Event('solicitudes_updated'));
      if (isAcceptedCarnetEstado(savedEstado)) {
        setFeedbackSuccess(
          `Solicitud de ${editRecord.socorrista_nombre} aceptada. Ya está visible en Generar Carnet.`
        );
      } else {
        setFeedbackSuccess(`Solicitud de ${editRecord.socorrista_nombre} actualizada a ${savedEstado}.`);
      }
      setEditRecord(null);
    } catch (err: any) {
      console.error('Error updating carnet request:', err);
      setFeedbackError('No se pudo actualizar la solicitud de carnet: ' + (err?.message || 'Error de red'));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleExportExcel = async () => {
    if (filteredRecords.length === 0) return;
    setExporting(true);
    setFeedbackError(null);
    try {
      const XLSX = await import('xlsx');
      const rows = filteredRecords.map((r) => ({
        'ID Solicitud': String(r.id),
        'Fecha Solicitud': new Date(r.fecha_solicitud).toLocaleDateString('es-SV'),
        Carnet: r.carnet,
        Socorrista: r.socorrista_nombre,
        Seccional: r.seccional_nombre,
        'Tipo Solicitud': r.tipo_solicitud,
        Origen: r.es_lote ? `Lote (${r.lote_id || 'LOTE'})` : 'Individual',
        Motivo: r.motivo || (r.tipo_solicitud === 'Nuevo' ? 'Emisión inicial' : 'N/A'),
        'Detalle Motivo': r.detalles_motivo || '',
        Estado: r.estado_solicitud,
        Observaciones: r.observaciones || '',
        'Solicitado Por': r.solicitado_por,
        'Correo Solicitante': r.solicitado_por_email || '',
        'Revisado Por': r.revisado_por || '',
        'Fecha Revisión': r.fecha_revision ? new Date(r.fecha_revision).toLocaleDateString('es-SV') : '',
        'Fotografía Adjunta': r.foto_url || r.socorrista_foto_actual ? 'Sí' : 'No',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 14 },
        { wch: 15 },
        { wch: 14 },
        { wch: 28 },
        { wch: 20 },
        { wch: 16 },
        { wch: 22 },
        { wch: 24 },
        { wch: 18 },
        { wch: 30 },
        { wch: 24 },
        { wch: 24 },
        { wch: 22 },
        { wch: 15 },
        { wch: 14 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Solicitudes Carnet');

      const periodSuffix =
        periodMode === 'mes' ? `_${selectedMonth}` : periodMode === 'semana' ? `_${selectedWeek}` : '_historico';
      XLSX.writeFile(wb, `solicitudes_carnet${periodSuffix}.xlsx`);
    } catch (err) {
      console.error('Error exporting Excel:', err);
      setFeedbackError('No se pudo exportar el archivo Excel.');
    } finally {
      setExporting(false);
    }
  };

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'Pendiente':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'En revisión':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'Observada':
        return 'bg-orange-50 text-orange-800 border-orange-300';
      case 'Aprobada':
      case 'Aceptada':
      case 'Lista para entrega':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'Completado':
      case 'Completada':
      case 'Finalizada':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'Rechazada':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setFilterEstado('Todos');
    setFilterSeccional('Todas');
    setFilterUsuario('Todos');
    setPeriodMode('todos');
  };

  return (
    <div className="space-y-5">
      {feedbackError && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{feedbackError}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackError(null)}
            className="text-rose-500 hover:text-rose-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {feedbackSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackSuccess(null)}
            className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200/70 flex items-center justify-center shrink-0">
            <IdCard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900">Solicitudes de Carnet</h2>
              {totalUnreadScope > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-500 text-white shadow-2xs">
                  {totalUnreadScope} sin leer
                </span>
              )}
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                Alcance: {scope === 'global' ? 'Global' : scope === 'seccional' ? `Seccional (${userSeccionalNombre || 'Asignada'})` : 'Solo Usuario'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Seguimiento logístico de emisiones, reposiciones y observaciones fotográficas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {unreadVisibleRecords.length > 0 && (
            <button
              type="button"
              onClick={() =>
                markManyAsRead(
                  unreadVisibleRecords.map((r) => ({ modulo: 'carnet' as const, solicitudKey: r.id }))
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-xs font-semibold text-sky-900 cursor-pointer transition-colors"
              title="Marcar las solicitudes visibles como leídas"
            >
              <CheckCheck className="w-3.5 h-3.5 text-sky-700" />
              Marcar vistas ({unreadVisibleRecords.length})
            </button>
          )}
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exporting || filteredRecords.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {exporting ? 'Exportando...' : `Exportar Excel (${filteredRecords.length})`}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Filtradas</p>
            <p className="text-2xl font-black tabular-nums text-slate-900 mt-0.5">{stats.total}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <IdCard className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200/70 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Pendientes</p>
            <p className="text-2xl font-black tabular-nums text-amber-800 mt-0.5">{stats.pendientes}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-indigo-200/70 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider">Aceptadas</p>
            <p className="text-2xl font-black tabular-nums text-indigo-800 mt-0.5">{stats.aprobadas}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Check className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-orange-200/70 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-orange-700 uppercase tracking-wider">Observadas</p>
            <p className="text-2xl font-black tabular-nums text-orange-800 mt-0.5">{stats.observadas}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200/70 shadow-xs flex items-center justify-between col-span-2 lg:col-span-1">
          <div>
            <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Completados</p>
            <p className="text-2xl font-black tabular-nums text-emerald-800 mt-0.5">{stats.completadas}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Smart Advanced Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Filter className="w-4 h-4 text-emerald-600" />
            Filtro Inteligente Avanzado
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
          >
            Limpiar filtros
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar carnet, nombre, observación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            />
          </div>

          <div>
            <select
              value={filterSeccional}
              onChange={(e) => setFilterSeccional(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            >
              <option value="Todas">
                {scope === 'global'
                  ? 'Todas las Seccionales'
                  : scope === 'seccional' && allowedSeccionalIds.length > 1
                  ? `Todas mis Seccionales (${allowedSeccionalIds.length})`
                  : 'Todas las Seccionales'}
              </option>
              {(scope === 'seccional' && allowedSeccionalIds.length > 0
                ? seccionales.filter((s) => allowedSeccionalIds.includes(s.id))
                : seccionales
              ).map((s) => (
                <option key={s.id} value={s.nombre}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filterUsuario}
              onChange={(e) => setFilterUsuario(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            >
              <option value="Todos">Todos los Usuarios / Solicitantes</option>
              {uniqueUsuarios.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            >
              <option value="Todos">Todos los Estados</option>
              {ESTADOS_CARNET.map((est) => (
                <option key={est} value={est}>
                  {est}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Period Filter */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-slate-600 inline-flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            Periodo:
          </span>

          <div className="inline-flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/70 text-xs font-semibold">
            {(['todos', 'mes', 'semana'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPeriodMode(m)}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer capitalize ${
                  periodMode === m ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {m === 'todos' ? 'Todo el historial' : m === 'mes' ? 'Por Mes' : 'Por Semana'}
              </button>
            ))}
          </div>

          {periodMode === 'mes' && (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-none"
            />
          )}

          {periodMode === 'semana' && (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="week"
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-none"
              />
              {weekRange && (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/70 text-[11px] font-semibold">
                  {weekRange.label}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">Cargando solicitudes de carnet...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <IdCard className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">No hay solicitudes de carnet que coincidan</p>
            <p className="text-xs text-slate-400">Ajusta los filtros de seccional, usuario, estado o periodo.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Elemento / Carnet</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Seccional / Solicitante</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tipo / Motivo</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredRecords.map((rec) => {
                  const hasAnyPhoto = Boolean(rec.foto_url || rec.socorrista_foto_actual);
                  const rowUnread = isUnread('carnet', rec.id, rec.estado_solicitud, rec.fecha_solicitud);
                  return (
                    <tr
                      key={String(rec.id)}
                      onClick={() => {
                        if (rowUnread) markAsRead('carnet', rec.id);
                      }}
                      className={`transition-colors ${
                        rowUnread
                          ? 'bg-sky-50/85 hover:bg-sky-100/75 border-l-4 border-l-rose-500 cursor-pointer'
                          : 'bg-white hover:bg-slate-50/70 border-l-4 border-l-transparent'
                      }`}
                    >
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead('carnet', rec.id);
                                if (hasAnyPhoto) {
                                  setZoomPhotoInfo({
                                    src: rec.foto_url,
                                    fallbackSrc: rec.socorrista_foto_actual,
                                    nombre: rec.socorrista_nombre,
                                    carnet: rec.carnet,
                                  });
                                } else {
                                  setDetailRecord(rec);
                                }
                              }}
                              title={hasAnyPhoto ? 'Clic para ampliar fotografía del elemento' : 'Sin fotografía registrada'}
                              className="w-11 h-11 rounded-full bg-slate-200/80 border-2 border-slate-200 hover:border-emerald-400 overflow-hidden flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                            >
                              <SmartStorageImage
                                src={rec.foto_url}
                                fallbackSrc={rec.socorrista_foto_actual}
                                alt={rec.socorrista_nombre}
                                className="w-full h-full object-cover"
                                fallback={<Camera className="w-4 h-4 text-slate-500" />}
                              />
                            </button>
                            {rowUnread && (
                              <span
                                className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-rose-500 ring-2 ring-white"
                                title="Solicitud no leída"
                              />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className={`text-xs ${rowUnread ? 'font-black text-slate-950' : 'font-bold text-slate-900'}`}>
                                {rec.socorrista_nombre}
                              </p>
                              {rowUnread && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black uppercase tracking-wide">
                                  Sin leer
                                </span>
                              )}
                            </div>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[11px] font-semibold mt-0.5">
                              {rec.carnet}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className={`text-xs flex items-center gap-1 ${rowUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {rec.seccional_nombre}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                          {rec.solicitado_por}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-xs ${rowUnread ? 'font-bold text-slate-950' : 'font-semibold text-slate-900'}`}>
                            {rec.tipo_solicitud}
                          </span>
                          {rec.es_lote && (
                            <span className="inline-flex px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                              Lote{rec.lote_id ? ` · ${rec.lote_id}` : ''}
                            </span>
                          )}
                        </div>
                        {rec.motivo && <span className="text-[11px] text-slate-500 block">{rec.motivo}</span>}
                        {rec.observaciones && (
                          <span className="text-[11px] text-orange-700 inline-flex items-center gap-1 mt-0.5 max-w-xs truncate">
                            <MessageSquare className="w-3 h-3 shrink-0" />
                            {rec.observaciones}
                          </span>
                        )}
                      </td>

                      <td className={`px-4 py-3.5 whitespace-nowrap text-xs ${rowUnread ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                        {new Date(rec.fecha_solicitud).toLocaleDateString('es-SV', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${getEstadoBadge(
                            rec.estado_solicitud
                          )}`}
                        >
                          {rec.estado_solicitud}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDetail(rec);
                            }}
                            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Ver detalle y evaluación de fotografía"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {canEdit && hasAnyPhoto && (
                            <button
                              type="button"
                              disabled={savingQuickActionId === rec.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDirectCrop(rec);
                              }}
                              className="p-2 rounded-xl text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-colors cursor-pointer disabled:opacity-50"
                              title="Recortar fotografía, analizar calidad o reemplazar fondo"
                            >
                              <Crop className="w-4 h-4" />
                            </button>
                          )}

                          {canEdit &&
                            !isAcceptedCarnetEstado(rec.estado_solicitud) &&
                            !isCompletedCarnetEstado(rec.estado_solicitud) && (
                              <button
                                type="button"
                                disabled={savingQuickActionId === rec.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickAccept(rec);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                                title="Aceptar solicitud para habilitarla en Generar Carnet"
                              >
                                <Check className="w-3.5 h-3.5" />
                                {savingQuickActionId === rec.id ? '...' : 'Aceptar'}
                              </button>
                            )}

                          {canEdit && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEdit(rec);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/70 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                              title="Gestionar estado, fotografía u observaciones"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Gestionar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {detailRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Detalle de Solicitud de Carnet</h3>
                <p className="text-2xs text-slate-500 font-mono">{detailRecord.carnet}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailRecord(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (detailRecord.foto_url || detailRecord.socorrista_foto_actual) {
                        setZoomPhotoInfo({
                          src: detailRecord.foto_url,
                          fallbackSrc: detailRecord.socorrista_foto_actual,
                          nombre: detailRecord.socorrista_nombre,
                          carnet: detailRecord.carnet,
                        });
                      }
                    }}
                    className="group relative w-28 h-28 rounded-2xl bg-slate-200/80 border-2 border-slate-300 overflow-hidden flex items-center justify-center shadow-xs cursor-zoom-in"
                    title="Clic para ver fotografía en tamaño completo"
                  >
                    <SmartStorageImage
                      src={detailRecord.foto_url}
                      fallbackSrc={detailRecord.socorrista_foto_actual}
                      alt={detailRecord.socorrista_nombre}
                      className="w-full h-full object-cover"
                      fallback={
                        <div className="flex flex-col items-center justify-center text-slate-500 px-2 text-center">
                          <Camera className="w-7 h-7 mb-1 text-slate-400" />
                          <span className="text-[10px] font-semibold leading-tight">Sin foto legible</span>
                        </div>
                      }
                    />
                    {(detailRecord.foto_url || detailRecord.socorrista_foto_actual) && (
                      <span className="absolute bottom-1.5 right-1.5 p-1 rounded-lg bg-slate-900/70 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <ZoomIn className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </button>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {detailRecord.foto_url ? 'Foto de solicitud' : detailRecord.socorrista_foto_actual ? 'Foto en perfil' : 'Sin fotografía'}
                  </span>
                </div>

                <div className="space-y-1 text-xs min-w-0">
                  <p className="text-sm font-bold text-slate-900">{detailRecord.socorrista_nombre}</p>
                  <p className="text-slate-600">Seccional: <strong>{detailRecord.seccional_nombre}</strong></p>
                  <p className="text-slate-600">Tipo: <strong>{detailRecord.tipo_solicitud}</strong></p>
                  {detailRecord.motivo && (
                    <p className="text-slate-600">Motivo: <strong>{detailRecord.motivo}</strong></p>
                  )}
                  <div className="pt-1 flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getEstadoBadge(detailRecord.estado_solicitud)}`}>
                      {detailRecord.estado_solicitud}
                    </span>
                    {canEdit && (detailRecord.foto_url || detailRecord.socorrista_foto_actual) && (
                      <button
                        type="button"
                        onClick={() => handleOpenDirectCrop(detailRecord)}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200 cursor-pointer"
                      >
                        <Crop className="w-3 h-3" />
                        Recortar / Fondo
                      </button>
                    )}
                    {canEdit &&
                      !isAcceptedCarnetEstado(detailRecord.estado_solicitud) &&
                      !isCompletedCarnetEstado(detailRecord.estado_solicitud) && (
                        <button
                          type="button"
                          disabled={savingQuickActionId === detailRecord.id}
                          onClick={() => handleQuickAccept(detailRecord)}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100 cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          Aceptar
                        </button>
                      )}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          const target = detailRecord;
                          setDetailRecord(null);
                          handleOpenEdit(target);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        Gestionar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Evaluación automática local de la fotografía */}
              {(analyzingDetail || detailAnalysis) && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <ScanFace className="w-3.5 h-3.5 text-emerald-700" />
                      Análisis de Fotografía
                    </span>
                    {detailAnalysis && (
                      <span
                        className={`text-xs font-bold tabular-nums ${
                          detailAnalysis.status === 'aceptable'
                            ? 'text-emerald-700'
                            : detailAnalysis.status === 'observaciones'
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {detailAnalysis.status === 'aceptable'
                          ? 'Aceptable'
                          : detailAnalysis.status === 'observaciones'
                          ? 'Con observaciones'
                          : 'No recomendable'}{' '}
                        · {detailAnalysis.score}%
                      </span>
                    )}
                  </div>
                  {analyzingDetail ? (
                    <p className="text-[11px] text-slate-500">Evaluando lineamientos de carnet...</p>
                  ) : detailAnalysis ? (
                    <>
                      <p className="text-[11px] text-slate-600">{detailAnalysis.summary}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                        {detailAnalysis.checks.map((chk) => (
                          <div key={chk.id} className="flex items-start gap-1.5 text-[11px]">
                            {chk.status === 'pass' ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            ) : chk.status === 'warn' ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                            )}
                            <span className="text-slate-700 leading-tight">{chk.label}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              )}

              {detailRecord.detalles_motivo && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                  <span className="font-bold block mb-0.5">Detalle del motivo:</span>
                  {detailRecord.detalles_motivo}
                </div>
              )}

              {detailRecord.observaciones && (
                <div className="p-3 rounded-xl bg-orange-50 border border-orange-200 text-xs text-orange-900">
                  <span className="font-bold block mb-0.5">Observaciones logísticas:</span>
                  {detailRecord.observaciones}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block">Solicitado por</span>
                  <span className="font-semibold text-slate-800">{detailRecord.solicitado_por}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Fecha solicitud</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(detailRecord.fecha_solicitud).toLocaleString('es-SV')}
                  </span>
                </div>
                {detailRecord.revisado_por && (
                  <>
                    <div>
                      <span className="text-slate-400 block">Revisado por</span>
                      <span className="font-semibold text-slate-800">{detailRecord.revisado_por}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Fecha revisión</span>
                      <span className="font-semibold text-slate-800">
                        {detailRecord.fecha_revision ? new Date(detailRecord.fecha_revision).toLocaleString('es-SV') : '-'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Status, Photo & Observations Modal */}
      {editRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveStatus}
            className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200"
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Gestionar Solicitud de Carnet</h3>
                <p className="text-2xs text-slate-500">
                  {editRecord.socorrista_nombre} ({editRecord.carnet})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditRecord(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[78vh] overflow-y-auto">
              {/* Fotografía del elemento en la solicitud */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3.5">
                <button
                  type="button"
                  onClick={() =>
                    setZoomPhotoInfo({
                      src: editReplacementPreview || editRecord.foto_url,
                      fallbackSrc: editRecord.socorrista_foto_actual,
                      nombre: editRecord.socorrista_nombre,
                      carnet: editRecord.carnet,
                    })
                  }
                  className="w-20 h-20 rounded-2xl bg-slate-200/80 border-2 border-slate-300 overflow-hidden flex items-center justify-center shrink-0 cursor-zoom-in"
                  title="Ampliar fotografía"
                >
                  <SmartStorageImage
                    src={editReplacementPreview || editRecord.foto_url}
                    fallbackSrc={editRecord.socorrista_foto_actual}
                    alt={editRecord.socorrista_nombre}
                    className="w-full h-full object-cover"
                    fallback={
                      <div className="flex flex-col items-center justify-center text-slate-500 px-1 text-center">
                        <Camera className="w-5 h-5 mb-0.5 text-slate-400" />
                        <span className="text-[9px] font-semibold leading-tight">Sin foto</span>
                      </div>
                    }
                  />
                </button>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <p className="text-xs font-bold text-slate-800">
                    {editReplacementPreview
                      ? 'Nueva fotografía cargada'
                      : editRecord.foto_url
                      ? 'Fotografía adjunta a la solicitud'
                      : editRecord.socorrista_foto_actual
                      ? 'Fotografía actual en perfil'
                      : 'Sin fotografía válida'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(editReplacementPreview || editRecord.foto_url || editRecord.socorrista_foto_actual) && (
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoModalMode('crop-edit');
                          setShowReplacePhotoModal(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold shadow-2xs cursor-pointer transition-colors"
                      >
                        <Crop className="w-3.5 h-3.5" />
                        Recortar / Fondo
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoModalMode('new');
                        setShowReplacePhotoModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-[11px] font-bold shadow-2xs cursor-pointer transition-colors"
                    >
                      <ImagePlus className="w-3.5 h-3.5 text-emerald-700" />
                      {editRecord.foto_url || editReplacementPreview ? 'Subir / Tomar Nueva' : 'Subir Fotografía'}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Estado de Solicitud</label>
                <select
                  value={editEstado}
                  onChange={(e) => setEditEstado(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                >
                  {ESTADOS_CARNET.map((est) => (
                    <option key={est} value={est}>
                      {est}
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(
                    [
                      { value: 'Pendiente', label: 'Pendiente' },
                      { value: 'Observada', label: 'Observada' },
                      { value: 'Aprobada', label: 'Aceptar (Generar Carnet)' },
                      { value: 'Completado', label: 'Completado' },
                      { value: 'Rechazada', label: 'Rechazada' },
                    ] as const
                  ).map((quick) => (
                    <button
                      key={quick.value}
                      type="button"
                      onClick={() => setEditEstado(quick.value)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                        editEstado === quick.value
                          ? quick.value === 'Aprobada'
                            ? 'bg-indigo-700 text-white border-indigo-700'
                            : 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {quick.label}
                    </button>
                  ))}
                </div>
                {isAcceptedCarnetEstado(editEstado) && (
                  <p className="text-[11px] text-indigo-700 font-medium mt-1.5">
                    Al guardar como Aprobada, esta solicitud quedará habilitada en Generar Carnet.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Observaciones</label>
                <textarea
                  rows={3}
                  value={editObservaciones}
                  onChange={(e) => setEditObservaciones(e.target.value)}
                  placeholder="Ej. Foto con fondo oscuro, solicitar nueva fotografía con camisa blanca..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                />
              </div>

              {(editRecord.foto_url || editReplacementPreview) && (
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyFotoToProfile}
                    onChange={(e) => setApplyFotoToProfile(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-emerald-950 font-medium leading-snug">
                    Aplicar esta fotografía como foto oficial del perfil del socorrista
                  </span>
                </label>
              )}
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditRecord(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                {savingEdit ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Fullscreen Photo Lightbox */}
      {zoomPhotoInfo && (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setZoomPhotoInfo(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900">{zoomPhotoInfo.nombre}</h4>
                <p className="text-[11px] font-mono text-slate-500">{zoomPhotoInfo.carnet}</p>
              </div>
              <button
                type="button"
                onClick={() => setZoomPhotoInfo(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-slate-200/70 flex items-center justify-center min-h-[280px]">
              <SmartStorageImage
                src={zoomPhotoInfo.src}
                fallbackSrc={zoomPhotoInfo.fallbackSrc}
                alt={zoomPhotoInfo.nombre}
                className="max-h-[70vh] w-auto rounded-2xl object-contain shadow-md bg-white"
                fallback={
                  <div className="py-12 text-center text-slate-500 space-y-2">
                    <Camera className="w-10 h-10 mx-auto text-slate-400" />
                    <p className="text-xs font-semibold">La fotografía no está disponible o está dañada.</p>
                  </div>
                }
              />
            </div>
          </div>
        </div>
      )}

      <CarnetPhotoCaptureModal
        isOpen={showReplacePhotoModal}
        onClose={() => {
          setShowReplacePhotoModal(false);
          setQuickCropRecord(null);
        }}
        onPhotoReady={handleReplacementPhotoReady}
        initialImageSrc={
          photoModalMode === 'crop-direct'
            ? quickCropRecord?.foto_url || quickCropRecord?.socorrista_foto_actual || null
            : photoModalMode === 'crop-edit'
            ? editReplacementPreview || editRecord?.foto_url || editRecord?.socorrista_foto_actual || null
            : null
        }
        initialFallbackSrc={
          photoModalMode === 'crop-direct'
            ? quickCropRecord?.socorrista_foto_actual || null
            : photoModalMode === 'crop-edit'
            ? editRecord?.socorrista_foto_actual || null
            : null
        }
        title={
          photoModalMode === 'crop-direct' && quickCropRecord
            ? `Recortar y Editar Fotografía — ${quickCropRecord.socorrista_nombre}`
            : editRecord
            ? `Fotografía de Solicitud — ${editRecord.socorrista_nombre}`
            : 'Actualizar Fotografía de Solicitud'
        }
      />
    </div>
  );
}
