import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Activity, Clock, User, FileText, Info, Search, 
  Filter, RefreshCw, Mail, Shield, CheckCircle2, ChevronRight 
} from 'lucide-react';

interface ActivityLog {
  id: string | number;
  user_id?: string;
  user_email: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: any;
  created_at: string;
  user_nombre?: string;
}

export default function ActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('Todas');
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // 1. Cargar mapa de nombres de socorristas y roles
      const nameMap: Record<string, string> = {};

      try {
        const { data: socs } = await supabase
          .from('socorristas')
          .select('email, primer_nombre, primer_apellido');
        if (socs) {
          socs.forEach((s: any) => {
            if (s.email) {
              nameMap[s.email.toLowerCase().trim()] = `${s.primer_nombre} ${s.primer_apellido}`.trim();
            }
          });
        }
      } catch (e) {}

      try {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('email, nombre_completo');
        if (roles) {
          roles.forEach((r: any) => {
            if (r.email && r.nombre_completo) {
              nameMap[r.email.toLowerCase().trim()] = r.nombre_completo.trim();
            }
          });
        }
      } catch (e) {}

      setUserMap(nameMap);

      // 2. Cargar registros de actividad
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(150);

      if (error) throw error;

      // 3. Formatear con nombre de usuario enriquecido
      const formatted = (data || []).map((l: any) => {
        const emailLower = (l.user_email || '').toLowerCase().trim();
        const detailsNombre = l.details?.user_nombre;
        const mappedNombre = detailsNombre || nameMap[emailLower] || (l.user_email ? l.user_email.split('@')[0] : 'Sistema');

        return {
          ...l,
          user_nombre: mappedNombre
        };
      });

      setLogs(formatted);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('es-SV', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }).format(date);
    } catch (e) {
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
    logs.forEach(l => {
      if (l.entity_type) setEnt.add(l.entity_type);
    });
    return ['Todas', ...Array.from(setEnt)];
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchEntity = selectedEntity === 'Todas' || log.entity_type === selectedEntity;
      if (!matchEntity) return false;

      if (!search.trim()) return true;

      const q = search.toLowerCase();
      const nombre = (log.user_nombre || '').toLowerCase();
      const email = (log.user_email || '').toLowerCase();
      const action = (log.action || '').toLowerCase();
      const entity = (log.entity_type || '').toLowerCase();
      const entityId = (log.entity_id || '').toLowerCase();
      const detailsStr = JSON.stringify(log.details || '').toLowerCase();

      return nombre.includes(q) || email.includes(q) || action.includes(q) || entity.includes(q) || entityId.includes(q) || detailsStr.includes(q);
    });
  }, [logs, search, selectedEntity]);

  return (
    <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Encabezado */}
      <div className="sm:flex sm:items-center sm:justify-between pb-5 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-black text-gray-950 flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <Activity className="h-6 w-6" />
            </div>
            Registro y Auditoría de Actividades
          </h1>
          <p className="mt-1 text-xs text-gray-500">
            Historial de acciones registradas con identificación de nombre y correo del usuario.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center space-x-2">
          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, correo, acción, folio o entidad..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-400 shrink-0" />
          <select
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all cursor-pointer"
          >
            {entityOptions.map(ent => (
              <option key={ent} value={ent}>{ent === 'Todas' ? 'Todas las Entidades' : ent}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla Principal */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-slate-50/80">
              <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-2xs font-bold uppercase tracking-wider text-gray-500 sm:pl-6">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                    <span>Fecha y Hora</span>
                  </div>
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-2xs font-bold uppercase tracking-wider text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-gray-400" />
                    <span>Usuario (Nombre y Correo)</span>
                  </div>
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-2xs font-bold uppercase tracking-wider text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-gray-400" />
                    <span>Acción Realizada</span>
                  </div>
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-2xs font-bold uppercase tracking-wider text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-gray-400" />
                    <span>Módulo / Entidad</span>
                  </div>
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-2xs font-bold uppercase tracking-wider text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-gray-400" />
                    <span>Detalles</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                    Cargando historial de actividades...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-gray-500">
                    No se encontraron registros de actividad coincidentes.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const nombre = log.user_nombre || (log.user_email ? log.user_email.split('@')[0] : 'Sistema');
                  const isSistema = !log.user_email || log.user_email === 'Sistema';

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Fecha y Hora */}
                      <td className="whitespace-nowrap py-3.5 pl-4 pr-3 text-xs text-gray-600 sm:pl-6">
                        <div className="font-medium text-gray-900">{formatDate(log.created_at)}</div>
                      </td>

                      {/* Usuario (Nombre + Correo) */}
                      <td className="px-3 py-3.5 text-xs">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-2xs uppercase shrink-0 ${
                            isSistema ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {isSistema ? <Shield className="w-4 h-4" /> : getInitials(nombre)}
                          </div>
                          <div>
                            <div className="font-bold text-gray-950 text-xs flex items-center space-x-1.5">
                              <span>{nombre}</span>
                            </div>
                            <div className="text-3xs text-gray-500 font-mono flex items-center space-x-1 mt-0.5">
                              <Mail className="w-2.5 h-2.5 text-gray-400" />
                              <span>{log.user_email || 'Sin correo (Proceso de Sistema)'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Acción */}
                      <td className="px-3 py-3.5 text-xs">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-2xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                          {log.action}
                        </span>
                      </td>

                      {/* Entidad */}
                      <td className="whitespace-nowrap px-3 py-3.5 text-xs">
                        <span className="font-semibold text-gray-800">{log.entity_type}</span>
                        {log.entity_id && (
                          <span className="ml-1.5 text-3xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-bold border border-gray-200">
                            #{log.entity_id}
                          </span>
                        )}
                      </td>

                      {/* Detalles */}
                      <td className="px-3 py-3.5 text-xs text-gray-500 max-w-xs">
                        {log.details ? (
                          <button
                            type="button"
                            onClick={() => setSelectedLog(log)}
                            className="text-left font-mono text-3xs bg-slate-50 hover:bg-slate-100 p-1.5 rounded-lg border border-slate-200 text-slate-700 block w-full truncate cursor-pointer transition-colors"
                            title="Ver detalles completos de la acción"
                          >
                            {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details)}
                          </button>
                        ) : (
                          <span className="text-gray-400 text-3xs">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalle de Registro */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Info className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-gray-900">Detalles de Actividad #{selectedLog.id}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-3xs uppercase font-bold text-gray-400 block">Usuario</span>
                  <span className="font-bold text-gray-900">{selectedLog.user_nombre}</span>
                </div>
                <div>
                  <span className="text-3xs uppercase font-bold text-gray-400 block">Correo</span>
                  <span className="font-mono text-gray-700">{selectedLog.user_email || 'Sistema'}</span>
                </div>
                <div>
                  <span className="text-3xs uppercase font-bold text-gray-400 block">Acción</span>
                  <span className="font-semibold text-emerald-700">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-3xs uppercase font-bold text-gray-400 block">Fecha y Hora</span>
                  <span className="text-gray-700">{formatDate(selectedLog.created_at)}</span>
                </div>
              </div>

              <div>
                <span className="text-2xs uppercase font-bold text-gray-500 block mb-1">Cuerpo de Datos JSON</span>
                <pre className="bg-slate-900 text-slate-100 p-3.5 rounded-xl text-3xs font-mono overflow-x-auto max-h-60 leading-relaxed">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
