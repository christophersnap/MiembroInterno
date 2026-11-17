import React, { useEffect, useMemo, useState } from 'react';
import {
  LifeBuoy,
  Plus,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  Eye,
  AlertTriangle,
  FileCode,
  Copy,
  Check,
  X,
  Image as ImageIcon,
  MessageSquare,
  ShieldCheck,
  User,
  Building2,
  Calendar,
  Loader2,
  Filter,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { logActivity } from '../lib/logger';
import {
  EstadoSoporte,
  fetchSoporteTickets,
  SoporteTicket,
  TIPOS_CASO_SOPORTE,
  updateSoporteTicketEstado,
} from '../lib/soporte';
import SoporteFormModal from '../components/soporte/SoporteFormModal';

const SQL_MIGRATION_39 = `-- Migración 39: Tabla de Soporte y Permisos de Historial/Finalización
CREATE TABLE IF NOT EXISTS public.soporte_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio TEXT UNIQUE,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario_nombre TEXT NOT NULL,
  usuario_email TEXT,
  seccional_id INTEGER REFERENCES public.seccionales(id) ON DELETE SET NULL,
  seccional_nombre TEXT,
  motivo TEXT NOT NULL,
  tipo_caso TEXT NOT NULL CHECK (
    tipo_caso IN ('Sistema', 'Registro de elementos', 'Información', 'Cambio de seccional de elemento', 'Otro')
  ),
  descripcion TEXT NOT NULL,
  imagenes JSONB DEFAULT '[]'::jsonb,
  ruta_origen TEXT,
  estado TEXT NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'En revisión', 'Finalizado')),
  nota_resolucion TEXT,
  atendido_por_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  atendido_por_nombre TEXT,
  fecha_finalizacion TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.soporte_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura de soporte por usuario o historial autorizado" ON public.soporte_tickets;
CREATE POLICY "Lectura de soporte por usuario o historial autorizado"
  ON public.soporte_tickets FOR SELECT TO authenticated
  USING (
    auth.uid() = usuario_id
    OR LOWER(COALESCE(usuario_email, '')) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    OR (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur LEFT JOIN public.role_permissions rp ON rp.role = ur.role
      WHERE ur.id = auth.uid() AND (
        ur.role = 'admin'
        OR COALESCE((ur.custom_permissions->>'view_soporte_historial')::boolean, false) = true
        OR COALESCE((ur.custom_permissions->>'edit_soporte_estado')::boolean, false) = true
        OR COALESCE((rp.permissions->>'view_soporte_historial')::boolean, false) = true
        OR COALESCE((rp.permissions->>'edit_soporte_estado')::boolean, false) = true
      )
    )
  );

DROP POLICY IF EXISTS "Usuarios autenticados pueden crear tickets de soporte" ON public.soporte_tickets;
CREATE POLICY "Usuarios autenticados pueden crear tickets de soporte"
  ON public.soporte_tickets FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Autorizados pueden gestionar y finalizar soporte" ON public.soporte_tickets;
CREATE POLICY "Autorizados pueden gestionar y finalizar soporte"
  ON public.soporte_tickets FOR UPDATE TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur LEFT JOIN public.role_permissions rp ON rp.role = ur.role
      WHERE ur.id = auth.uid() AND (
        ur.role = 'admin'
        OR COALESCE((ur.custom_permissions->>'edit_soporte_estado')::boolean, false) = true
        OR COALESCE((rp.permissions->>'edit_soporte_estado')::boolean, false) = true
      )
    )
  ) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';`;

export default function Soporte() {
  const { user, userName, role, permissions } = useAuth();
  const isAdmin = role === 'admin';
  const canViewHistorial = isAdmin || Boolean(permissions.view_soporte_historial || permissions.edit_soporte_estado);
  const canEditEstado = isAdmin || Boolean(permissions.edit_soporte_estado);

  const [tickets, setTickets] = useState<SoporteTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [supabaseWarning, setSupabaseWarning] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'mis_solicitudes' | 'historial'>(() =>
    canViewHistorial ? 'historial' : 'mis_solicitudes'
  );

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState<'Todos' | EstadoSoporte>('Todos');
  const [filterTipo, setFilterTipo] = useState<string>('Todos');

  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SoporteTicket | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Edición de estado / nota
  const [editEstado, setEditEstado] = useState<EstadoSoporte>('Pendiente');
  const [editNota, setEditNota] = useState('');
  const [savingEstado, setSavingEstado] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // SQL Modal
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const res = await fetchSoporteTickets({
        usuarioId: user?.id || null,
        usuarioEmail: user?.email || null,
        canViewAll: canViewHistorial,
      });
      setTickets(res.tickets);
      if (res.supabaseError) {
        setSupabaseWarning(
          `Supabase informó un problema al leer soporte_tickets (${res.supabaseError}). Ejecuta la migración 39_soporte_sistema_y_permisos.sql.`
        );
      } else {
        setSupabaseWarning(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
    const onSoporteUpdate = () => loadTickets();
    window.addEventListener('soporte_updated', onSoporteUpdate);
    return () => window.removeEventListener('soporte_updated', onSoporteUpdate);
  }, [user?.id, user?.email, canViewHistorial]);

  useEffect(() => {
    if (!canViewHistorial && activeTab === 'historial') {
      setActiveTab('mis_solicitudes');
    }
  }, [canViewHistorial, activeTab]);

  const myTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchId = user?.id && t.usuario_id === user.id;
      const matchEmail =
        user?.email && t.usuario_email && t.usuario_email.toLowerCase() === user.email.toLowerCase();
      return Boolean(matchId || matchEmail);
    });
  }, [tickets, user?.id, user?.email]);

  const displayedBaseList = useMemo(() => {
    if (activeTab === 'historial' && canViewHistorial) return tickets;
    return myTickets;
  }, [activeTab, canViewHistorial, tickets, myTickets]);

  const filteredTickets = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return displayedBaseList.filter((t) => {
      if (filterEstado !== 'Todos' && t.estado !== filterEstado) return false;
      if (filterTipo !== 'Todos' && t.tipo_caso !== filterTipo) return false;
      if (!q) return true;
      return (
        t.folio.toLowerCase().includes(q) ||
        t.motivo.toLowerCase().includes(q) ||
        t.descripcion.toLowerCase().includes(q) ||
        t.tipo_caso.toLowerCase().includes(q) ||
        t.usuario_nombre.toLowerCase().includes(q) ||
        (t.seccional_nombre || '').toLowerCase().includes(q) ||
        (t.nota_resolucion || '').toLowerCase().includes(q)
      );
    });
  }, [displayedBaseList, searchTerm, filterEstado, filterTipo]);

  const pendingGlobalCount = useMemo(
    () => tickets.filter((t) => t.estado !== 'Finalizado').length,
    [tickets]
  );

  const openTicketDetail = (ticket: SoporteTicket) => {
    setSelectedTicket(ticket);
    setEditEstado(ticket.estado);
    setEditNota(ticket.nota_resolucion || '');
    setSaveFeedback(null);
  };

  const handleSaveTicketEstado = async (targetEstado?: EstadoSoporte) => {
    if (!selectedTicket || !canEditEstado) return;
    const estadoToSave = targetEstado || editEstado;
    setSavingEstado(true);
    setSaveFeedback(null);

    try {
      const { ticket: updatedFromDb, error } = await updateSoporteTicketEstado({
        id: selectedTicket.id,
        estado: estadoToSave,
        nota_resolucion: editNota,
        atendido_por_id: user?.id || null,
        atendido_por_nombre: userName || user?.email || 'Soporte Técnico',
      });

      const mergedTicket: SoporteTicket = updatedFromDb || {
        ...selectedTicket,
        estado: estadoToSave,
        nota_resolucion: editNota.trim() || null,
        atendido_por_nombre: userName || user?.email || 'Soporte Técnico',
        fecha_finalizacion: estadoToSave === 'Finalizado' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      setSelectedTicket(mergedTicket);
      setEditEstado(mergedTicket.estado);
      setTickets((prev) => prev.map((t) => (t.id === mergedTicket.id ? mergedTicket : t)));

      await logActivity('update', 'Soporte', mergedTicket.id, {
        folio: mergedTicket.folio,
        estado: mergedTicket.estado,
        nota_resolucion: mergedTicket.nota_resolucion,
      });

      if (error) {
        setSaveFeedback(
          `Actualizado localmente, pero Supabase devolvió: ${error}. Verifica la migración SQL #39.`
        );
      } else {
        setSaveFeedback(
          estadoToSave === 'Finalizado'
            ? 'Solicitud marcada como Finalizada y nota guardada correctamente.'
            : 'Estado y nota actualizados correctamente.'
        );
      }
    } finally {
      setSavingEstado(false);
    }
  };

  const getEstadoBadge = (estado: EstadoSoporte) => {
    if (estado === 'Finalizado') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Finalizado
        </span>
      );
    }
    if (estado === 'En revisión') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
          <Eye className="w-3 h-3 text-blue-600" />
          En revisión
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
        <Clock className="w-3 h-3 text-amber-600" />
        Pendiente
      </span>
    );
  };

  return (
    <div className="space-y-6 w-full mx-auto pb-14">
      {/* Encabezado */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 rounded-2xl p-6 md:p-7 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-8">
          <LifeBuoy className="w-56 h-56" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-emerald-300 border border-white/15">
              <LifeBuoy className="w-3.5 h-3.5" />
              Centro de Soporte y Reporte de Anomalías
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Soporte Técnico e Incidencias
            </h1>
            <p className="text-slate-200 text-xs md:text-sm leading-relaxed">
              Reporta fallas del sistema, inconvenientes en registro de elementos, cambios de seccional o consultas administrativas con capturas de pantalla.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowSqlModal(true)}
                className="px-3.5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition flex items-center gap-2 border border-white/20 cursor-pointer"
              >
                <FileCode className="w-4 h-4 text-emerald-400" />
                Script SQL
              </button>
            )}

            <button
              type="button"
              onClick={loadTickets}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition cursor-pointer"
              title="Actualizar listado"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs sm:text-sm font-bold shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Nueva Solicitud de Soporte
            </button>
          </div>
        </div>
      </div>

      {supabaseWarning && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>{supabaseWarning}</span>
        </div>
      )}

      {/* Pestañas: Mis Solicitudes vs Historial Global (según permisos en Accesos) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('mis_solicitudes')}
            className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'mis_solicitudes'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Mis Solicitudes ({myTickets.length})</span>
          </button>

          {canViewHistorial && (
            <button
              type="button"
              onClick={() => setActiveTab('historial')}
              className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'historial'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Historial Global de Soporte ({tickets.length})</span>
              {pendingGlobalCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white">
                  {pendingGlobalCount}
                </span>
              )}
            </button>
          )}
        </div>

        <div className="text-[11px] text-slate-500">
          {activeTab === 'mis_solicitudes'
            ? 'Solo visualizas tus propias solicitudes, su estado y las notas agregadas por soporte.'
            : canEditEstado
            ? 'Permiso activo: ver historial completo, agregar notas y finalizar casos.'
            : 'Permiso activo: solo lectura del historial global de soporte.'}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por folio, motivo, detalle, nota o usuario..."
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
            <Filter className="w-3.5 h-3.5" />
          </div>
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value as any)}
            className="text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 font-medium outline-none"
          >
            <option value="Todos">Todos los Estados</option>
            <option value="Pendiente">Pendiente</option>
            <option value="En revisión">En revisión</option>
            <option value="Finalizado">Finalizado</option>
          </select>

          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 font-medium outline-none"
          >
            <option value="Todos">Todos los Casos</option>
            {TIPOS_CASO_SOPORTE.map((tc) => (
              <option key={tc.value} value={tc.value}>
                {tc.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Listado de Tickets */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-700" />
          <p className="text-xs text-slate-500 mt-3 font-medium">Cargando solicitudes de soporte...</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-500 mx-auto flex items-center justify-center">
            <LifeBuoy className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            No hay solicitudes de soporte para mostrar
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {displayedBaseList.length === 0
              ? 'Cuando reportes una anomalía o caso de soporte aparecerá listado aquí con su estado y nota de resolución.'
              : 'Ninguna solicitud coincide con los filtros de búsqueda seleccionados.'}
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Nueva Solicitud</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((ticket) => (
            <div
              key={ticket.id}
              className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-300 shadow-2xs transition-all p-4 sm:p-5 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                      {ticket.folio}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-900 text-white">
                      {ticket.tipo_caso}
                    </span>
                    {getEstadoBadge(ticket.estado)}
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    {ticket.motivo}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {ticket.usuario_nombre}
                    </span>
                    {ticket.seccional_nombre && (
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        {ticket.seccional_nombre}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(ticket.created_at).toLocaleString()}
                    </span>
                    {ticket.imagenes.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                        <ImageIcon className="w-3.5 h-3.5" />
                        {ticket.imagenes.length} imagen(es)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openTicketDetail(ticket)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition ${
                      activeTab === 'historial' && canEditEstado
                        ? 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{activeTab === 'historial' && canEditEstado ? 'Gestionar / Finalizar' : 'Ver Detalle'}</span>
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                {ticket.descripcion}
              </p>

              {/* Nota agregada por soporte (visible siempre al usuario solicitante y al historial) */}
              {ticket.nota_resolucion && (
                <div
                  className={`p-3 rounded-xl border text-xs space-y-1 ${
                    ticket.estado === 'Finalizado'
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                      : 'bg-blue-50/80 border-blue-200 text-blue-950'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold inline-flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" />
                      Nota de Soporte:
                    </span>
                    {ticket.atendido_por_nombre && (
                      <span className="text-[10px] opacity-80">
                        Atendido por {ticket.atendido_por_nombre}
                        {ticket.fecha_finalizacion
                          ? ` · ${new Date(ticket.fecha_finalizacion).toLocaleDateString()}`
                          : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed whitespace-pre-line">
                    {ticket.nota_resolucion}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* MODAL CREAR NUEVA SOLICITUD DE SOPORTE */}
      <SoporteFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        hideNavigateButton
        onCreated={() => loadTickets()}
      />

      {/* MODAL DETALLE Y RESOLUCIÓN DE TICKET */}
      {selectedTicket && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
          onClick={() => setSelectedTicket(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-700">
                    {selectedTicket.folio}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-900 text-white">
                    {selectedTicket.tipo_caso}
                  </span>
                  {getEstadoBadge(selectedTicket.estado)}
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-1">
                  {selectedTicket.motivo}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
              {/* Metadatos del solicitante */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Solicitante</span>
                  <span className="font-semibold text-slate-900">{selectedTicket.usuario_nombre}</span>
                  {selectedTicket.usuario_email && (
                    <span className="block text-[11px] text-slate-500">{selectedTicket.usuario_email}</span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Seccional y Fecha</span>
                  <span className="font-semibold text-slate-900">
                    {selectedTicket.seccional_nombre || 'No especificada'}
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    {new Date(selectedTicket.created_at).toLocaleString()}
                    {selectedTicket.ruta_origen ? ` · Ruta: ${selectedTicket.ruta_origen}` : ''}
                  </span>
                </div>
              </div>

              {/* Descripción ampliada */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-1.5">Información Detallada</h4>
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                  {selectedTicket.descripcion}
                </div>
              </div>

              {/* Imágenes adjuntas */}
              {selectedTicket.imagenes.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-800">
                    Evidencias Adjuntas ({selectedTicket.imagenes.length})
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {selectedTicket.imagenes.map((img, i) => (
                      <button
                        key={`${img.url}_${i}`}
                        type="button"
                        onClick={() => setLightboxUrl(img.url)}
                        className="group rounded-xl border border-slate-200 overflow-hidden bg-slate-50 text-left cursor-pointer hover:border-emerald-500 transition"
                      >
                        <img
                          src={img.url}
                          alt={img.nombre}
                          className="w-full h-28 object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="px-2 py-1 text-[10px] text-slate-600 truncate bg-white border-t border-slate-100">
                          {img.nombre}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Panel de Gestión / Finalización (solo usuarios con edit_soporte_estado) */}
              {canEditEstado ? (
                <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-700" />
                      Gestión y Resolución del Caso
                    </h4>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Estado</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['Pendiente', 'En revisión', 'Finalizado'] as EstadoSoporte[]).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setEditEstado(st)}
                          className={`py-2 px-2 rounded-xl text-xs font-bold border cursor-pointer transition ${
                            editEstado === st
                              ? st === 'Finalizado'
                                ? 'bg-emerald-700 text-white border-emerald-700'
                                : st === 'En revisión'
                                ? 'bg-blue-700 text-white border-blue-700'
                                : 'bg-amber-500 text-white border-amber-500'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Nota de Resolución / Respuesta al Usuario (Opcional)
                    </label>
                    <textarea
                      rows={3}
                      value={editNota}
                      onChange={(e) => setEditNota(e.target.value)}
                      placeholder="Explica la solución aplicada o comentario para el usuario que reportó..."
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 outline-none"
                    />
                  </div>

                  {saveFeedback && (
                    <div className="p-2.5 rounded-lg bg-white border border-emerald-300 text-xs font-semibold text-emerald-900">
                      {saveFeedback}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={savingEstado}
                      onClick={() => handleSaveTicketEstado()}
                      className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      {savingEstado ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                    {editEstado !== 'Finalizado' && (
                      <button
                        type="button"
                        disabled={savingEstado}
                        onClick={() => handleSaveTicketEstado('Finalizado')}
                        className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Marcar como Finalizado</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-emerald-700" />
                    Seguimiento y Nota de Soporte
                  </h4>
                  {selectedTicket.nota_resolucion ? (
                    <>
                      <p className="text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                        {selectedTicket.nota_resolucion}
                      </p>
                      {selectedTicket.atendido_por_nombre && (
                        <p className="text-[11px] text-slate-500">
                          Atendido por: <strong>{selectedTicket.atendido_por_nombre}</strong>
                          {selectedTicket.fecha_finalizacion
                            ? ` · Finalizado el ${new Date(selectedTicket.fecha_finalizacion).toLocaleString()}`
                            : ''}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-slate-500">
                      {selectedTicket.estado === 'Finalizado'
                        ? 'Esta solicitud fue marcada como Finalizada sin notas adicionales.'
                        : 'Tu solicitud está en seguimiento; cuando sea atendida o finalizada verás cualquier nota aquí.'}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX PARA IMÁGENES ADJUNTAS */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/15 hover:bg-white/25 text-white cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxUrl}
            alt="Evidencia de soporte"
            className="max-w-full max-h-[88vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* MODAL SQL SUPABASE */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold">Script SQL #39: Módulo de Soporte</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <p className="text-slate-600">
                Ejecuta el archivo <code className="font-mono bg-slate-100 px-1 rounded">39_soporte_sistema_y_permisos.sql</code> en el <strong>SQL Editor</strong> de Supabase para habilitar la tabla <code className="font-mono">soporte_tickets</code> y las políticas RLS de aislamiento por usuario e historial autorizado.
              </p>
              <div className="relative">
                <pre className="bg-slate-950 text-emerald-300 p-4 rounded-xl text-[11px] font-mono max-h-72 overflow-y-auto">
                  {SQL_MIGRATION_39}
                </pre>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(SQL_MIGRATION_39);
                    setSqlCopied(true);
                    setTimeout(() => setSqlCopied(false), 2500);
                  }}
                  className="absolute top-3 right-3 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  {sqlCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{sqlCopied ? '¡Copiado!' : 'Copiar SQL'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
