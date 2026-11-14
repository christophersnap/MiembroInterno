import React, { useState, useEffect, useMemo } from 'react';
import {
  IdCard,
  Search,
  Filter,
  Download,
  Eye,
  Edit3,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Calendar,
  Building2,
  User,
  RefreshCw,
  X,
  Check,
  FileSpreadsheet,
  Camera,
  MessageSquare,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { logActivity } from '../../lib/logger';

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
  'Completada',
  'Finalizada',
  'Rechazada',
];

function getWeekDateRange(weekStr: string): { start: Date; end: Date; label: string } | null {
  // Format: YYYY-Www
  const match = /^(\d{4})-W(\d{2})$/.exec(weekStr);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  // ISO week 1 always contains Jan 4th
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7; // 1..7 (Mon..Sun)
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

  const [records, setRecords] = useState<SolicitudCarnetRecord[]>([]);
  const [seccionales, setSeccionales] = useState<{ id: number; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

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

  // Detail & Edit Modals
  const [detailRecord, setDetailRecord] = useState<SolicitudCarnetRecord | null>(null);
  const [editRecord, setEditRecord] = useState<SolicitudCarnetRecord | null>(null);
  const [editEstado, setEditEstado] = useState('Pendiente');
  const [editObservaciones, setEditObservaciones] = useState('');
  const [applyFotoToProfile, setApplyFotoToProfile] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const allowedSecKey = allowedSeccionalIds.join(',');
  useEffect(() => {
    loadData();
  }, [scope, allowedSecKey, effectiveSeccionalId, userSeccionalNombre]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: secData } = await supabase.from('seccionales').select('id, nombre').order('nombre');
      const secList = secData || [];
      setSeccionales(secList);
      const secNameById = new Map<number, string>();
      secList.forEach((s: any) => secNameById.set(s.id, s.nombre));

      // 1. Query DB solicitudes_carnet with socorristas join
      let dbItems: SolicitudCarnetRecord[] = [];
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
            const soc = row.socorristas;
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
              socorrista_id: row.socorrista_id,
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
      } catch (e) {}

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
      observadas: filteredRecords.filter((r) => r.estado_solicitud === 'Observada').length,
      completadas: filteredRecords.filter((r) => r.estado_solicitud === 'Completada' || r.estado_solicitud === 'Finalizada' || r.estado_solicitud === 'Aprobada').length,
    };
  }, [filteredRecords]);

  const handleOpenEdit = (rec: SolicitudCarnetRecord) => {
    setEditRecord(rec);
    setEditEstado(rec.estado_solicitud || 'Pendiente');
    setEditObservaciones(rec.observaciones || '');
    setApplyFotoToProfile(Boolean(rec.foto_url && rec.foto_url !== rec.socorrista_foto_actual));
  };

  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRecord || !canEdit) return;
    setSavingEdit(true);
    try {
      const revisadoPor = userName || user?.email || 'Administración';
      const fechaRev = new Date().toISOString();

      if (editRecord.source === 'db') {
        const payload: any = {
          estado_solicitud: editEstado,
          observaciones: editObservaciones.trim() || null,
          revisado_por: revisadoPor,
          fecha_revision: fechaRev,
          updated_at: fechaRev,
        };

        const { error } = await supabase
          .from('solicitudes_carnet')
          .update(payload)
          .eq('id', editRecord.id);

        if (error) {
          // Fallback if migration 31 columns haven't been added yet
          const { error: fallbackErr } = await supabase
            .from('solicitudes_carnet')
            .update({ estado_solicitud: editEstado })
            .eq('id', editRecord.id);
          if (fallbackErr) throw fallbackErr;
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
              estado_solicitud: editEstado,
              observaciones: editObservaciones.trim() || null,
              revisado_por: revisadoPor,
              fecha_revision: fechaRev,
            }),
          })
          .eq('clave', editRecord.config_clave);
      }

      // Optionally sync submitted photo to socorrista profile when approved/completed
      if (applyFotoToProfile && editRecord.foto_url && editRecord.socorrista_id) {
        await supabase
          .from('socorristas')
          .update({ foto_url: editRecord.foto_url })
          .eq('id', editRecord.socorrista_id);
      }

      setRecords((prev) =>
        prev.map((r) =>
          r.id === editRecord.id
            ? {
                ...r,
                estado_solicitud: editEstado,
                observaciones: editObservaciones.trim() || null,
                revisado_por: revisadoPor,
                fecha_revision: fechaRev,
                socorrista_foto_actual: applyFotoToProfile && editRecord.foto_url ? editRecord.foto_url : r.socorrista_foto_actual,
              }
            : r
        )
      );

      await logActivity(`Actualizó solicitud de carnet a ${editEstado}`, 'SolicitudCarnet', String(editRecord.id), {
        socorrista: editRecord.socorrista_nombre,
        carnet: editRecord.carnet,
        estado: editEstado,
        observaciones: editObservaciones,
      });

      window.dispatchEvent(new Event('solicitudes_updated'));
      setEditRecord(null);
    } catch (err: any) {
      console.error('Error updating carnet request:', err);
      alert('No se pudo actualizar la solicitud de carnet: ' + (err?.message || 'Error de red'));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleExportExcel = async () => {
    if (filteredRecords.length === 0) {
      alert('No hay registros filtrados para exportar.');
      return;
    }
    setExporting(true);
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
        'Fotografía Adjunta': r.foto_url ? 'Sí' : 'No',
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
      alert('No se pudo exportar el archivo Excel.');
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
      case 'Lista para entrega':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
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
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200/70 flex items-center justify-center shrink-0">
            <IdCard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900">Solicitudes de Carnet</h2>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Filtradas</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">{stats.total}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <IdCard className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200/70 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Pendientes</p>
            <p className="text-2xl font-black text-amber-800 mt-0.5">{stats.pendientes}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-orange-200/70 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-orange-700 uppercase tracking-wider">Observadas</p>
            <p className="text-2xl font-black text-orange-800 mt-0.5">{stats.observadas}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200/70 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Completadas</p>
            <p className="text-2xl font-black text-emerald-800 mt-0.5">{stats.completadas}</p>
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
          {/* Search */}
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

          {/* Seccional Filter */}
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

          {/* Usuario Filter */}
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

          {/* Estado Filter */}
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

        {/* Period Filter (Todos / Mes / Semana) */}
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
                {filteredRecords.map((rec) => (
                  <tr key={String(rec.id)} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                          {rec.foto_url || rec.socorrista_foto_actual ? (
                            <img
                              src={rec.foto_url || rec.socorrista_foto_actual || ''}
                              alt={rec.socorrista_nombre}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Camera className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{rec.socorrista_nombre}</p>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[11px] font-semibold mt-0.5">
                            {rec.carnet}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="text-xs font-semibold text-slate-800 flex items-center gap-1">
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
                        <span className="text-xs font-semibold text-slate-900">{rec.tipo_solicitud}</span>
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

                    <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-600">
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
                          onClick={() => setDetailRecord(rec)}
                          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Ver detalle completo"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(rec)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/70 text-xs font-semibold transition-colors cursor-pointer"
                            title="Gestionar estado u observaciones"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Gestionar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
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
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                  {detailRecord.foto_url ? (
                    <img src={detailRecord.foto_url} alt="Foto solicitada" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-7 h-7 text-slate-400" />
                  )}
                </div>
                <div className="space-y-1 text-xs">
                  <p className="text-sm font-bold text-slate-900">{detailRecord.socorrista_nombre}</p>
                  <p className="text-slate-600">Seccional: <strong>{detailRecord.seccional_nombre}</strong></p>
                  <p className="text-slate-600">Tipo: <strong>{detailRecord.tipo_solicitud}</strong></p>
                  {detailRecord.motivo && (
                    <p className="text-slate-600">Motivo: <strong>{detailRecord.motivo}</strong></p>
                  )}
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getEstadoBadge(detailRecord.estado_solicitud)}`}>
                    {detailRecord.estado_solicitud}
                  </span>
                </div>
              </div>

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

      {/* Edit Status & Observations Modal */}
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

            <div className="p-5 space-y-4">
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
                  {(['Pendiente', 'Observada', 'Completada'] as const).map((quick) => (
                    <button
                      key={quick}
                      type="button"
                      onClick={() => setEditEstado(quick)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                        editEstado === quick
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {quick}
                    </button>
                  ))}
                </div>
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

              {editRecord.foto_url && (
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyFotoToProfile}
                    onChange={(e) => setApplyFotoToProfile(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-emerald-950 font-medium leading-snug">
                    Aplicar esta fotografía enviada como foto oficial del perfil del socorrista
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
    </div>
  );
}
