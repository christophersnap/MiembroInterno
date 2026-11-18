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
  CheckCheck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { logActivity } from '../lib/logger';
import {
  EstadoSoporte,
  fetchSoporteTickets,
  SoporteTicket,
  SQL_MIGRATION_50_TEXT,
  TIPOS_CASO_SOPORTE,
  updateSoporteTicketEstado,
} from '../lib/soporte';
import { useSolicitudReadTracker } from '../utils/solicitudReadTracker';
import SoporteFormModal from '../components/soporte/SoporteFormModal';

export default function Soporte() {
  const {
    user,
    userName,
    role,
    permissions,
    directorSeccionalId,
    userSeccionalId,
    userSeccionalNombre,
    getModuleScope,
    getModuleSeccionalIds,
  } = useAuth();

  const isAdmin = role === 'admin';
  const effectiveSeccionalId = directorSeccionalId || userSeccionalId;
  const soporteScope = getModuleScope('soporte');
  const soporteSeccionalIds = getModuleSeccionalIds('soporte');
  const soporteSecKey = soporteSeccionalIds.join(',');

  const canCreateSoporte = isAdmin || Boolean(permissions.crear_soporte ?? true);
  const canResolveSoporte = isAdmin || Boolean(permissions.edit_soporte_estado);
  const canViewScopedTickets =
    isAdmin ||
    soporteScope === 'global' ||
    soporteScope === 'seccional' ||
    Boolean(
      permissions.view_soporte_historial ||
        permissions.view_soporte_seccional ||
        permissions.edit_soporte_estado
    );

  const { isUnread, markAsRead, markManyAsRead } = useSolicitudReadTracker(user?.id);

  const [tickets, setTickets] = useState<SoporteTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [supabaseWarning, setSupabaseWarning] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'mis_solicitudes' | 'historial'>(() =>
    canViewScopedTickets ? 'historial' : 'mis_solicitudes'
  );

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState<'Todos' | EstadoSoporte>('Todos');
  const [filterTipo, setFilterTipo] = useState<string>('Todos');

  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SoporteTicket | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Edición de estado / nota (solventar)
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
        scope: soporteScope,
        canViewAll: soporteScope === 'global',
        allowedSeccionalIds: soporteSeccionalIds,
        userSeccionalId: effectiveSeccionalId,
        userSeccionalNombre: userSeccionalNombre || null,
      });
      setTickets(res.tickets);
      if (res.supabaseError) {
        setSupabaseWarning(
          `Supabase informó un problema al consultar soporte_tickets (${res.supabaseError}). Ejecuta la Migración SQL #50 en el SQL Editor.`
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
  }, [
    user?.id,
    user?.email,
    soporteScope,
    soporteSecKey,
    effectiveSeccionalId,
    userSeccionalNombre,
  ]);

  useEffect(() => {
    if (!canViewScopedTickets && activeTab === 'historial') {
      setActiveTab('mis_solicitudes');
    }
  }, [canViewScopedTickets, activeTab]);

  const myTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchId = user?.id && t.usuario_id === user.id;
      const matchEmail =
        user?.email && t.usuario_email && t.usuario_email.toLowerCase() === user.email.toLowerCase();
      return Boolean(matchId || matchEmail);
    });
  }, [tickets, user?.id, user?.email]);

  const displayedBaseList = useMemo(() => {
    if (activeTab === 'historial' && canViewScopedTickets) return tickets;
    return myTickets;
  }, [activeTab, canViewScopedTickets, tickets, myTickets]);

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

  const unreadMyCount = useMemo(
    () => myTickets.filter((t) => isUnread('soporte', t.id, t.estado, t.created_at)).length,
    [myTickets, isUnread]
  );

  const unreadScopedCount = useMemo(
    () => tickets.filter((t) => isUnread('soporte', t.id, t.estado, t.created_at)).length,
    [tickets, isUnread]
  );

  const unreadVisibleTickets = useMemo(
    () => filteredTickets.filter((t) => isUnread('soporte', t.id, t.estado, t.created_at)),
    [filteredTickets, isUnread]
  );

  const openTicketDetail = (ticket: SoporteTicket) => {
    markAsRead('soporte', ticket.id);
    setSelectedTicket(ticket);
    setEditEstado(ticket.estado);
    setEditNota(ticket.nota_resolucion || '');
    setSaveFeedback(null);
  };

  const handleMarkVisibleAsRead = () => {
    if (unreadVisibleTickets.length === 0) return;
    markManyAsRead(
      unreadVisibleTickets.map((t) => ({
        modulo: 'soporte' as const,
        solicitudKey: t.id,
      }))
    );
  };

  const handleSaveTicketEstado = async (targetEstado?: EstadoSoporte) => {
    if (!selectedTicket || !canResolveSoporte) return;
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
      markAsRead('soporte', mergedTicket.id);

      await logActivity('update', 'Soporte', mergedTicket.id, {
        folio: mergedTicket.folio,
        estado: mergedTicket.estado,
        nota_resolucion: mergedTicket.nota_resolucion,
      });

      if (error) {
        setSaveFeedback(
          `Actualizado localmente, pero Supabase devolvió: ${error}. Verifica haber aplicado la Migración SQL #50.`
        );
      } else {
        setSaveFeedback(
          estadoToSave === 'Finalizado'
            ? 'Solicitud solventada y marcada como Finalizada.'
            : 'Estado y nota de soporte guardados correctamente.'
        );
      }
    } finally {
      setSavingEstado(false);
    }
  };

  const getEstadoBadge = (estado: EstadoSoporte) => {
    if (estado === 'Finalizado') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap shrink-0">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Finalizado</span>
        </span>
      );
    }
    if (estado === 'En revisión') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200 whitespace-nowrap shrink-0">
          <Eye className="w-3 h-3 text-blue-600" />
          <span>En revisión</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap shrink-0">
        <Clock className="w-3 h-3 text-amber-600" />
        <span>Pendiente</span>
      </span>
    );
  };

  const historialTabLabel =
    soporteScope === 'seccional' && !isAdmin
      ? 'Solicitudes de Seccional'
      : 'Historial Global de Soporte';

  return (
    <div className="space-y-6 w-full mx-auto pb-14">
      {/* Encabezado */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 rounded-2xl p-6 md:p-7 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-8">
          <LifeBuoy className="w-56 h-56" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="text-xs font-semibold text-emerald-300 flex items-center gap-2">
              <LifeBuoy className="w-4 h-4" />
              <span>Centro de Soporte y Reporte de Anomalías</span>
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
                className="px-3.5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition flex items-center gap-2 border border-white/20 cursor-pointer whitespace-nowrap shrink-0"
              >
                <FileCode className="w-4 h-4 text-emerald-400" />
                <span>Script SQL #50</span>
              </button>
            )}

            <button
              type="button"
              onClick={loadTickets}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition cursor-pointer shrink-0"
              title="Actualizar listado"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {canCreateSoporte ? (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs sm:text-sm font-bold shadow-md transition flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Solicitud de Soporte</span>
              </button>
            ) : (
              <span className="px-3.5 py-2 rounded-xl bg-white/10 border border-white/15 text-xs text-slate-200 font-medium whitespace-nowrap shrink-0">
                Modo consulta de soporte
              </span>
            )}
          </div>
        </div>
      </div>

      {supabaseWarning && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>{supabaseWarning}</span>
        </div>
      )}

      {/* Pestañas estilo iOS + Contador de no leídas */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="bg-slate-200/75 p-1 rounded-xl inline-flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('mis_solicitudes')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
              activeTab === 'mis_solicitudes'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Mis Solicitudes ({myTickets.length})</span>
            {unreadMyCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white leading-none">
                {unreadMyCount}
              </span>
            )}
          </button>

          {canViewScopedTickets && (
            <button
              type="button"
              onClick={() => setActiveTab('historial')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
                activeTab === 'historial'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {soporteScope === 'seccional' && !isAdmin ? (
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span>
                {historialTabLabel} ({tickets.length})
              </span>
              {unreadScopedCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white leading-none">
                  {unreadScopedCount}
                </span>
              )}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {unreadVisibleTickets.length > 0 && (
            <button
              type="button"
              onClick={handleMarkVisibleAsRead}
              className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums"
            >
              <CheckCheck className="w-3.5 h-3.5 text-sky-700" />
              <span>Marcar visibles como leídas ({unreadVisibleTickets.length})</span>
            </button>
          )}

          <span className="text-[11px] text-slate-500">
            {activeTab === 'mis_solicitudes'
              ? 'Tus reportes enviados y notas de respuesta.'
              : canResolveSoporte
              ? soporteScope === 'seccional' && !isAdmin
                ? 'Alcance por seccional · Permiso activo para solventar casos'
                : 'Alcance global · Permiso activo para solventar casos'
              : soporteScope === 'seccional' && !isAdmin
              ? 'Consulta de solicitudes de tu seccional asignada'
              : 'Consulta del historial global de soporte'}
          </span>
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
            placeholder="Buscar por folio, motivo, seccional, detalle o usuario..."
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
            className="text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 font-medium outline-none cursor-pointer"
          >
            <option value="Todos">Todos los Estados</option>
            <option value="Pendiente">Pendiente</option>
            <option value="En revisión">En revisión</option>
            <option value="Finalizado">Finalizado</option>
          </select>

          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 font-medium outline-none cursor-pointer"
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

      {/* Listado de Tickets con tonalidad de no leído por solicitud */}
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
              ? 'Cuando se registre una solicitud de soporte dentro de tu alcance aparecerá listada aquí con su estado y nota de resolución.'
              : 'Ninguna solicitud coincide con los filtros de búsqueda seleccionados.'}
          </p>
          {canCreateSoporte && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Nueva Solicitud</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((ticket) => {
            const ticketUnread = isUnread('soporte', ticket.id, ticket.estado, ticket.created_at);

            return (
              <div
                key={ticket.id}
                onClick={() => {
                  if (ticketUnread) {
                    markAsRead('soporte', ticket.id);
                  }
                }}
                className={`rounded-2xl border transition-all p-4 sm:p-5 space-y-3 ${
                  ticketUnread
                    ? 'bg-sky-50/90 hover:bg-sky-100/75 border-sky-300 ring-1 ring-sky-200/70 shadow-xs cursor-pointer'
                    : 'bg-white hover:border-slate-300 border-slate-200 shadow-2xs'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {ticketUnread && (
                        <span
                          className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"
                          title="Solicitud de soporte no leída"
                        />
                      )}
                      <span
                        className={`font-mono text-[11px] px-2 py-0.5 rounded-md border tabular-nums ${
                          ticketUnread
                            ? 'font-black bg-white text-slate-950 border-sky-300'
                            : 'font-bold bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {ticket.folio}
                      </span>
                      {ticketUnread && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-rose-500 text-white text-[10px] font-black uppercase tracking-wide whitespace-nowrap shrink-0">
                          Sin leer
                        </span>
                      )}
                      <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-slate-900 text-white whitespace-nowrap shrink-0">
                        {ticket.tipo_caso}
                      </span>
                      {getEstadoBadge(ticket.estado)}
                    </div>

                    <h3
                      className={`text-sm sm:text-base ${
                        ticketUnread ? 'font-black text-slate-950' : 'font-bold text-slate-900'
                      }`}
                    >
                      {ticket.motivo}
                    </h3>

                    <div
                      className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] ${
                        ticketUnread ? 'text-slate-700 font-medium' : 'text-slate-500'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{ticket.usuario_nombre}</span>
                      </span>
                      {ticket.seccional_nombre && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{ticket.seccional_nombre}</span>
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(ticket.created_at).toLocaleString()}</span>
                      </span>
                      {ticket.imagenes.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold tabular-nums">
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>{ticket.imagenes.length} imagen(es)</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openTicketDetail(ticket);
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap shrink-0 ${
                        canResolveSoporte && activeTab === 'historial'
                          ? 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs'
                          : ticketUnread
                          ? 'bg-slate-900 hover:bg-black text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>
                        {canResolveSoporte && activeTab === 'historial'
                          ? 'Solventar / Ver'
                          : 'Ver Solicitud'}
                      </span>
                    </button>
                  </div>
                </div>

                <p
                  className={`text-xs line-clamp-2 leading-relaxed ${
                    ticketUnread ? 'text-slate-800 font-medium' : 'text-slate-600'
                  }`}
                >
                  {ticket.descripcion}
                </p>

                {/* Nota agregada por soporte */}
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
                        <span>Nota de Soporte:</span>
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
            );
          })}
        </div>
      )}

      {/* MODAL CREAR NUEVA SOLICITUD DE SOPORTE */}
      {canCreateSoporte && (
        <SoporteFormModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          hideNavigateButton
          onCreated={(created) => {
            markAsRead('soporte', created.id);
            loadTickets();
          }}
        />
      )}

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
                  <span className="font-mono text-xs font-bold text-slate-700 tabular-nums">
                    {selectedTicket.folio}
                  </span>
                  <span className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-slate-900 text-white">
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
                  <span className="block text-[11px] text-slate-500 tabular-nums">
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

              {/* Panel para solventar solicitud (solo usuarios con permiso edit_soporte_estado) */}
              {canResolveSoporte ? (
                <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-700" />
                      <span>Solventar Solicitud de Soporte</span>
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
                          className={`py-2 px-2 rounded-xl text-xs font-bold border cursor-pointer transition whitespace-nowrap shrink-0 ${
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
                      Nota de Solución / Respuesta al Usuario (Opcional)
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
                      className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      {savingEstado ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                    {editEstado !== 'Finalizado' && (
                      <button
                        type="button"
                        disabled={savingEstado}
                        onClick={() => handleSaveTicketEstado('Finalizado')}
                        className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Solventar y Finalizar</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-emerald-700" />
                    <span>Seguimiento y Respuesta de Soporte</span>
                  </h4>
                  {selectedTicket.nota_resolucion ? (
                    <>
                      <p className="text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                        {selectedTicket.nota_resolucion}
                      </p>
                      {selectedTicket.atendido_por_nombre && (
                        <p className="text-[11px] text-slate-500">
                          Solventado por: <strong>{selectedTicket.atendido_por_nombre}</strong>
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
                        : 'Solicitud en seguimiento; cuando el personal autorizado la solvente verás la respuesta aquí.'}
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

      {/* MODAL SQL SUPABASE (#50) */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold">
                  Script SQL #50: Soporte con Notificaciones, Alcance por Seccional y Permisos
                </h3>
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
                Ejecuta <code className="font-mono bg-slate-100 px-1 rounded">50_soporte_alcance_seccional_y_lecturas.sql</code> en el <strong>SQL Editor</strong> de Supabase para habilitar el control de lectura individual en Soporte, la visualización por seccional y los permisos para crear y solventar solicitudes.
              </p>
              <div className="relative">
                <pre className="bg-slate-950 text-emerald-300 p-4 rounded-xl text-[11px] font-mono max-h-72 overflow-y-auto">
                  {SQL_MIGRATION_50_TEXT}
                </pre>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(SQL_MIGRATION_50_TEXT);
                    setSqlCopied(true);
                    setTimeout(() => setSqlCopied(false), 2500);
                  }}
                  className="absolute top-3 right-3 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {sqlCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{sqlCopied ? '¡Copiado!' : 'Copiar SQL #50'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
