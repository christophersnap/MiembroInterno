import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Activity,
  Clock,
  Calendar,
  User,
  FileText,
  Info,
  Search,
  Filter,
  RefreshCw,
  Mail,
  Shield,
  LogIn,
  Users,
  ClipboardList,
  MapPin,
  Settings,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  ActivityLogRecord,
  formatActivityHuman,
  HumanActivityResult,
} from '../utils/activityFormatter';

type ActivityCategoryFilter = 'todas' | HumanActivityResult['category'];
type TimeWindowPreset = '3h' | '6h' | '12h' | 'today' | 'custom';

interface EnrichedActivityLog extends ActivityLogRecord {
  user_nombre: string;
  human: HumanActivityResult;
}

const CATEGORY_TABS: { id: ActivityCategoryFilter; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'sesion', label: 'Inicios de sesión' },
  { id: 'usuarios', label: 'Usuarios y Roles' },
  { id: 'socorristas', label: 'Socorristas' },
  { id: 'solicitudes', label: 'Solicitudes' },
  { id: 'seccionales', label: 'Seccionales' },
  { id: 'sistema', label: 'Sistema' },
];

const TIME_WINDOWS: { id: TimeWindowPreset; label: string }[] = [
  { id: '3h', label: 'Últimas 3 h' },
  { id: '6h', label: 'Últimas 6 h' },
  { id: '12h', label: 'Últimas 12 h' },
  { id: 'today', label: 'Hoy (Diaria)' },
  { id: 'custom', label: 'Anteriores' },
];

const MAX_ACTIVITY_ROWS = 300;

/** Convierte una fecha a formato YYYY-MM-DDTHH:mm en hora de El Salvador (UTC-6) para inputs datetime-local */
function toSvDateTimeInput(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/El_Salvador',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}

/** Inicio del día actual (00:00:00) en El Salvador (UTC-6 sin cambio de horario) como ISO UTC */
function getStartOfTodaySvIso(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/El_Salvador',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value || '2026';
  const m = parts.find((p) => p.type === 'month')?.value || '01';
  const d = parts.find((p) => p.type === 'day')?.value || '01';
  return new Date(`${y}-${m}-${d}T00:00:00-06:00`).toISOString();
}

/** Convierte un valor datetime-local (interpretado en hora El Salvador UTC-6) a ISO UTC */
function svInputToIso(val: string): string | null {
  if (!val) return null;
  const parsed = new Date(`${val}:00-06:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export default function ActivityLogs() {
  const [logs, setLogs] = useState<EnrichedActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [truncatedByLimit, setTruncatedByLimit] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ActivityCategoryFilter>('todas');
  const [selectedEntity, setSelectedEntity] = useState('Todas');
  const [selectedLog, setSelectedLog] = useState<EnrichedActivityLog | null>(null);
  const [showRawDetails, setShowRawDetails] = useState(false);

  // Filtro temporal a nivel de base de datos (por defecto: Hoy / actividad diaria)
  const [timeWindow, setTimeWindow] = useState<TimeWindowPreset>('today');
  const [customFrom, setCustomFrom] = useState<string>(() => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return toSvDateTimeInput(yesterday);
  });
  const [customTo, setCustomTo] = useState<string>(() => toSvDateTimeInput(new Date()));

  // Caché en memoria de nombres resueltos para no escanear tablas completas en cada consulta
  const nameCacheRef = useRef<Record<string, string>>({});

  const fetchLogs = useCallback(
    async (overrideWindow?: TimeWindowPreset, overrideFrom?: string, overrideTo?: string) => {
      const activeWindow = overrideWindow ?? timeWindow;
      const fromVal = overrideFrom ?? customFrom;
      const toVal = overrideTo ?? customTo;

      setLoading(true);
      try {
        let startIso: string | null = null;
        let endIso: string | null = null;
        const nowMs = Date.now();

        if (activeWindow === '3h') {
          startIso = new Date(nowMs - 3 * 60 * 60 * 1000).toISOString();
        } else if (activeWindow === '6h') {
          startIso = new Date(nowMs - 6 * 60 * 60 * 1000).toISOString();
        } else if (activeWindow === '12h') {
          startIso = new Date(nowMs - 12 * 60 * 60 * 1000).toISOString();
        } else if (activeWindow === 'today') {
          startIso = getStartOfTodaySvIso();
        } else {
          startIso = svInputToIso(fromVal);
          endIso = svInputToIso(toVal);
        }

        let query = supabase
          .from('activity_logs')
          .select('id, user_id, user_email, action, entity_type, entity_id, details, created_at')
          .order('created_at', { ascending: false })
          .limit(MAX_ACTIVITY_ROWS);

        if (startIso) {
          query = query.gte('created_at', startIso);
        }
        if (endIso) {
          query = query.lte('created_at', endIso);
        }

        const { data, error } = await query;
        if (error) throw error;

        const rows = data || [];
        setTruncatedByLimit(rows.length >= MAX_ACTIVITY_ROWS);

        // Resolver únicamente los nombres de los usuarios presentes en los registros devueltos (con caché)
        const nameMap = nameCacheRef.current;
        const missingIds = Array.from(
          new Set(
            rows
              .map((r: any) => r.user_id)
              .filter((id: any): id is string => Boolean(id) && !nameMap[`id:${id}`])
          )
        );
        const missingEmails = Array.from(
          new Set(
            rows
              .map((r: any) => String(r.user_email || '').toLowerCase().trim())
              .filter((em) => Boolean(em) && !nameMap[em])
          )
        );

        await Promise.all([
          (async () => {
            if (missingIds.length === 0) return;
            try {
              const { data: roles } = await supabase
                .from('user_roles')
                .select('id, nombre_usuario, nombre_completo')
                .in('id', missingIds);
              if (roles) {
                roles.forEach((r: any) => {
                  const name = String(r.nombre_usuario || r.nombre_completo || '').trim();
                  if (r.id && name) {
                    nameMap[`id:${r.id}`] = name;
                  }
                });
              }
            } catch {}
          })(),
          (async () => {
            if (missingEmails.length === 0) return;
            try {
              const { data: socs } = await supabase
                .from('socorristas')
                .select('email, primer_nombre, primer_apellido')
                .in('email', missingEmails);
              if (socs) {
                socs.forEach((s: any) => {
                  if (s.email) {
                    nameMap[s.email.toLowerCase().trim()] =
                      `${s.primer_nombre || ''} ${s.primer_apellido || ''}`.trim();
                  }
                });
              }
            } catch {}
          })(),
        ]);

        const formatted: EnrichedActivityLog[] = rows.map((l: any) => {
          const emailLower = (l.user_email || '').toLowerCase().trim();
          const detailsNombre = l.details?.user_nombre;
          const mappedNombre =
            (l.user_id && nameMap[`id:${l.user_id}`]) ||
            detailsNombre ||
            nameMap[emailLower] ||
            (l.user_email ? l.user_email.split('@')[0] : 'Sistema');

          const baseLog: ActivityLogRecord = {
            ...l,
            user_nombre: mappedNombre,
          };

          return {
            ...baseLog,
            user_nombre: mappedNombre,
            human: formatActivityHuman(baseLog),
          };
        });

        setLogs(formatted);
      } catch (error) {
        console.error('Error fetching logs:', error);
      } finally {
        setLoading(false);
      }
    },
    [timeWindow, customFrom, customTo]
  );

  useEffect(() => {
    if (timeWindow !== 'custom') {
      fetchLogs(timeWindow);
    }
  }, [timeWindow]);

  const applyQuickPastRange = (daysBack: number, onlyYesterday = false) => {
    const now = new Date();
    let fromDate: Date;
    let toDate: Date;

    if (onlyYesterday) {
      const todayStart = new Date(getStartOfTodaySvIso());
      fromDate = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      toDate = new Date(todayStart.getTime() - 60 * 1000);
    } else {
      fromDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
      toDate = now;
    }

    const fromStr = toSvDateTimeInput(fromDate);
    const toStr = toSvDateTimeInput(toDate);
    setCustomFrom(fromStr);
    setCustomTo(toStr);
    setTimeWindow('custom');
    fetchLogs('custom', fromStr, toStr);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('es-SV', {
        timeZone: 'America/El_Salvador',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(date);
    } catch {
      return dateString;
    }
  };

  const getInitials = (nombre: string) => {
    if (!nombre) return 'CV';
    const parts = nombre.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  const entityOptions = useMemo(() => {
    const setEnt = new Set<string>();
    logs.forEach((l) => {
      if (l.human.entityLabel) setEnt.add(l.human.entityLabel);
    });
    return ['Todas', ...Array.from(setEnt).sort((a, b) => a.localeCompare(b))];
  }, [logs]);

  const categoryCounts = useMemo(() => {
    const counts: Record<ActivityCategoryFilter, number> = {
      todas: logs.length,
      sesion: 0,
      usuarios: 0,
      socorristas: 0,
      solicitudes: 0,
      seccionales: 0,
      sistema: 0,
    };
    logs.forEach((l) => {
      counts[l.human.category] = (counts[l.human.category] || 0) + 1;
    });
    return counts;
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedCategory !== 'todas' && log.human.category !== selectedCategory) return false;
      if (selectedEntity !== 'Todas' && log.human.entityLabel !== selectedEntity) return false;

      if (!search.trim()) return true;

      const q = search.toLowerCase();
      const fieldsText = log.human.fields.map((f) => `${f.label} ${f.value}`).join(' ').toLowerCase();
      return (
        log.user_nombre.toLowerCase().includes(q) ||
        (log.user_email || '').toLowerCase().includes(q) ||
        log.human.actionLabel.toLowerCase().includes(q) ||
        log.human.entityLabel.toLowerCase().includes(q) ||
        log.human.summary.toLowerCase().includes(q) ||
        fieldsText.includes(q) ||
        (log.entity_id || '').toLowerCase().includes(q)
      );
    });
  }, [logs, search, selectedCategory, selectedEntity]);

  const getCategoryIcon = (cat: HumanActivityResult['category']) => {
    switch (cat) {
      case 'sesion':
        return <LogIn className="w-3.5 h-3.5 text-sky-600 shrink-0" />;
      case 'usuarios':
        return <Shield className="w-3.5 h-3.5 text-violet-600 shrink-0" />;
      case 'socorristas':
        return <Users className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
      case 'solicitudes':
        return <ClipboardList className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
      case 'seccionales':
        return <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />;
      default:
        return <Settings className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
    }
  };

  const getActionTone = (log: EnrichedActivityLog) => {
    const act = log.human.actionLabel.toLowerCase();
    if (act.includes('inició sesión')) return 'text-sky-700 font-semibold';
    if (act.includes('cerró sesión')) return 'text-slate-600 font-semibold';
    if (act.includes('eliminó') || act.includes('desactivó')) return 'text-rose-700 font-semibold';
    if (act.includes('creó') || act.includes('registró') || act.includes('activó') || act.includes('agregó')) {
      return 'text-emerald-700 font-semibold';
    }
    return 'text-slate-900 font-semibold';
  };

  return (
    <div className="w-full space-y-5">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 tracking-tight flex items-center gap-2.5">
            <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200/70">
              <Activity className="h-5 w-5" />
            </span>
            Registro y Auditoría de Actividades
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Inicios de sesión y acciones del sistema redactadas en lenguaje claro.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchLogs()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Selector de Período Temporal (limitado a nivel de base de datos para optimizar rendimiento) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
              Período:
            </span>
            <div
              className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto"
              role="group"
              aria-label="Período de actividad"
            >
              {TIME_WINDOWS.map((win) => {
                const active = timeWindow === win.id;
                return (
                  <button
                    key={win.id}
                    type="button"
                    onClick={() => {
                      setTimeWindow(win.id);
                      if (win.id === 'custom') {
                        fetchLogs('custom', customFrom, customTo);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {win.label}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
            {loading ? (
              'Consultando período...'
            ) : (
              <>
                <span className="font-semibold text-slate-700">{filteredLogs.length}</span>{' '}
                {filteredLogs.length === 1 ? 'registro' : 'registros'}
                {truncatedByLimit && (
                  <span className="text-amber-700 font-medium">
                    {' '}
                    (máx. {MAX_ACTIVITY_ROWS}; acota el rango para ver más detalle)
                  </span>
                )}
              </>
            )}
          </p>
        </div>

        {/* Panel de rango personalizado para consultar horas o días anteriores */}
        {timeWindow === 'custom' && (
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Consultar actividad anterior por fecha y hora</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => applyQuickPastRange(1, true)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
                >
                  Ayer
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickPastRange(3)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
                >
                  Últimos 3 días
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickPastRange(7)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
                >
                  Últimos 7 días
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Desde (fecha y hora)
                </label>
                <input
                  type="datetime-local"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500 tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Hasta (fecha y hora)
                </label>
                <input
                  type="datetime-local"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500 tabular-nums"
                />
              </div>
              <button
                type="button"
                onClick={() => fetchLogs('custom', customFrom, customTo)}
                disabled={loading}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Consultar rango</span>
              </button>
            </div>
          </div>
        )}

        {/* Filtro rápido segmentado por tipo de actividad */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
          {CATEGORY_TABS.map((tab) => {
            const active = selectedCategory === tab.id;
            const count = categoryCounts[tab.id] || 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  active
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{tab.label}</span>
                <span className="text-[11px] font-medium text-slate-400 tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Barra de Búsqueda y Filtro por Módulo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por usuario, correo, acción o detalle..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all cursor-pointer"
            >
              {entityOptions.map((ent) => (
                <option key={ent} value={ent}>
                  {ent === 'Todas' ? 'Todos los módulos' : ent}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Vista Móvil en Tarjetas limpias (< md) */}
      <div className="md:hidden space-y-2.5">
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 py-12 text-center text-xs text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
            Cargando historial de actividades...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 py-12 text-center text-xs text-slate-500">
            No se encontraron registros de actividad coincidentes.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <button
              key={log.id}
              type="button"
              onClick={() => {
                setSelectedLog(log);
                setShowRawDetails(false);
              }}
              className="w-full text-left bg-white rounded-2xl border border-slate-200/80 p-4 space-y-2 hover:border-slate-300 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {getCategoryIcon(log.human.category)}
                  <span className={`text-xs truncate ${getActionTone(log)}`}>
                    {log.human.actionLabel}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                  {formatDate(log.created_at)}
                </span>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed">{log.human.summary}</p>

              <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                <span className="font-semibold text-slate-800 truncate">{log.user_nombre}</span>
                <span aria-hidden="true">·</span>
                <span className="truncate">{log.human.entityLabel}</span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Tabla Principal Desktop / Tablet (>= md) */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="py-3 pl-5 pr-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <span>Fecha y Hora</span>
                  </div>
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    <span>Usuario</span>
                  </div>
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-slate-400" />
                    <span>Acción</span>
                  </div>
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-slate-400" />
                    <span>Módulo</span>
                  </div>
                </th>
                <th scope="col" className="px-3 py-3 pr-5 text-left text-xs font-semibold text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-slate-400" />
                    <span>Detalle de lo realizado</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                    Cargando historial de actividades...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-slate-500">
                    No se encontraron registros de actividad coincidentes.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isSistema = !log.user_email || log.user_email === 'Sistema';

                  return (
                    <tr
                      key={log.id}
                      onClick={() => {
                        setSelectedLog(log);
                        setShowRawDetails(false);
                      }}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      {/* Fecha y Hora */}
                      <td className="whitespace-nowrap py-3 pl-5 pr-3 text-xs text-slate-700 tabular-nums">
                        {formatDate(log.created_at)}
                      </td>

                      {/* Usuario */}
                      <td className="px-3 py-3 text-xs whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] uppercase shrink-0 ${
                              isSistema
                                ? 'bg-slate-200 text-slate-700'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                            }`}
                          >
                            {isSistema ? <Shield className="w-3.5 h-3.5" /> : getInitials(log.user_nombre)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 text-xs">{log.user_nombre}</div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[210px]">
                                {log.user_email || 'Proceso de Sistema'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Acción */}
                      <td className="px-3 py-3 text-xs whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {getCategoryIcon(log.human.category)}
                          <span className={getActionTone(log)}>{log.human.actionLabel}</span>
                        </div>
                      </td>

                      {/* Módulo */}
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">
                        <span className="font-medium text-slate-800">{log.human.entityLabel}</span>
                      </td>

                      {/* Detalle en lenguaje humano */}
                      <td className="px-3 py-3 pr-5 text-xs text-slate-700 max-w-xl">
                        <p className="leading-snug line-clamp-2 text-slate-700">{log.human.summary}</p>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalle de Actividad (Estilo iOS limpio sin JSON crudo visible) */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {getCategoryIcon(selectedLog.human.category)}
                <h3 className="text-sm font-bold text-slate-900 truncate">
                  Detalle de Actividad
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                aria-label="Cerrar detalle"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Resumen claro en español */}
              <div className="bg-slate-50 rounded-xl border border-slate-200/80 p-4">
                <p className="text-[11px] font-semibold text-slate-500 mb-1">Qué ocurrió</p>
                <p className="text-sm font-semibold text-slate-900 leading-relaxed">
                  {selectedLog.human.summary}
                </p>
              </div>

              {/* Datos generales */}
              <div className="bg-white rounded-xl border border-slate-200/80 divide-y divide-slate-100 text-xs">
                <div className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <span className="text-slate-500">Realizado por</span>
                  <span className="font-semibold text-slate-900 text-right">{selectedLog.user_nombre}</span>
                </div>
                <div className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <span className="text-slate-500">Correo</span>
                  <span className="text-slate-700 text-right truncate">
                    {selectedLog.user_email || 'Proceso de Sistema'}
                  </span>
                </div>
                <div className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <span className="text-slate-500">Módulo</span>
                  <span className="font-medium text-slate-800 text-right">
                    {selectedLog.human.entityLabel}
                  </span>
                </div>
                <div className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <span className="text-slate-500">Fecha y hora</span>
                  <span className="text-slate-800 tabular-nums text-right">
                    {formatDate(selectedLog.created_at)}
                  </span>
                </div>
              </div>

              {/* Campos específicos legibles */}
              {selectedLog.human.fields.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-600 px-1">Información registrada</p>
                  <div className="bg-white rounded-xl border border-slate-200/80 divide-y divide-slate-100 text-xs">
                    {selectedLog.human.fields.map((field, idx) => (
                      <div
                        key={`${field.label}-${idx}`}
                        className="px-4 py-2.5 flex items-start justify-between gap-4"
                      >
                        <span className="text-slate-500 shrink-0">{field.label}</span>
                        <span className="font-medium text-slate-900 text-right break-words">
                          {field.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Datos técnicos ocultos por defecto */}
              {selectedLog.details && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowRawDetails((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    {showRawDetails ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                    <span>{showRawDetails ? 'Ocultar datos técnicos' : 'Ver datos técnicos de auditoría'}</span>
                  </button>

                  {showRawDetails && (
                    <pre className="mt-2 bg-slate-900 text-slate-100 p-3.5 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48 leading-relaxed">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
