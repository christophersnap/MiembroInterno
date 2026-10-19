import React, { useState } from 'react';
import { 
  UserCheck, UserX, Clock, CheckCircle2, XCircle, Search, Filter, Mail, 
  Building2, Phone, Calendar, Shield, AlertCircle, Send, Check, Eye, X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../lib/logger';
import { generarHtmlCorreoAprobacion } from '../../lib/emailNotification';
import { sendEmailNotification } from '../../lib/api';
import { getOfficialLoginUrl } from '../../utils/appUrl';

interface Solicitud {
  id: string;
  auth_user_id?: string;
  nombre_completo: string;
  email: string;
  telefono?: string;
  seccional_id?: number;
  carnet?: string;
  tipo_usuario?: string;
  motivo?: string;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  fecha_solicitud: string;
  fecha_revision?: string;
  notas_admin?: string;
  seccionales?: { id: number; nombre: string };
}

interface SolicitudesRegistroTabProps {
  solicitudes: Solicitud[];
  roles: string[];
  seccionales: { id: number; nombre: string }[];
  onRefresh: () => void;
  remitenteNombre: string;
  remitenteCorreo: string;
}

export default function SolicitudesRegistroTab({
  solicitudes,
  roles,
  seccionales,
  onRefresh,
  remitenteNombre,
  remitenteCorreo,
}: SolicitudesRegistroTabProps) {
  const [filter, setFilter] = useState<'todas' | 'pendiente' | 'aprobado' | 'rechazado'>('pendiente');
  const [search, setSearch] = useState('');
  
  // Modal de Aprobación
  const [selectedSolicitud, setSelectedSolicitud] = useState<Solicitud | null>(null);
  const [assignedRole, setAssignedRole] = useState('socorrista');
  const [assignedSeccionalId, setAssignedSeccionalId] = useState<number | ''>('');
  const [sendNotificationEmail, setSendNotificationEmail] = useState(true);
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  const filteredSolicitudes = solicitudes.filter(sol => {
    const matchesFilter = filter === 'todas' || sol.estado === filter;
    const term = search.toLowerCase();
    const matchesSearch = !search || 
      sol.nombre_completo?.toLowerCase().includes(term) ||
      sol.email?.toLowerCase().includes(term) ||
      sol.carnet?.toLowerCase().includes(term) ||
      sol.telefono?.toLowerCase().includes(term);
    return matchesFilter && matchesSearch;
  });

  const countPendientes = solicitudes.filter(s => s.estado === 'pendiente').length;
  const countAprobadas = solicitudes.filter(s => s.estado === 'aprobado').length;
  const countRechazadas = solicitudes.filter(s => s.estado === 'rechazado').length;

  const handleOpenApprove = (solicitud: Solicitud) => {
    setSelectedSolicitud(solicitud);
    setAssignedRole(solicitud.tipo_usuario === 'director' ? 'director' : 'socorrista');
    setAssignedSeccionalId(solicitud.seccional_id || '');
    setSendNotificationEmail(true);
    setAdminNotes('');
  };

  const handleConfirmApproval = async () => {
    if (!selectedSolicitud) return;
    setProcessing(true);

    try {
      const seccionalObj = seccionales.find(s => s.id === Number(assignedSeccionalId));
      const seccionalNombre = seccionalObj?.nombre || 'Cruz Verde Salvadoreña';

      // 1. Si existe auth_user_id, actualizar user_roles para activar al usuario
      if (selectedSolicitud.auth_user_id) {
        // Intentar actualizar activo, estado, rol y seccional
        const { error: roleUpdateError } = await supabase
          .from('user_roles')
          .upsert({
            id: selectedSolicitud.auth_user_id,
            role: assignedRole,
            activo: true,
            estado: 'activo',
            seccional_id: assignedSeccionalId ? Number(assignedSeccionalId) : null,
          });

        if (roleUpdateError) {
          console.warn('Fallo upsert en user_roles con columnas extendidas, reintentando con rol básico:', roleUpdateError);
          await supabase
            .from('user_roles')
            .upsert({
              id: selectedSolicitud.auth_user_id,
              role: assignedRole,
            });
        }

        // Si estaba en la lista de inactivos de configuracion, removerlo
        try {
          const { data: inactConfig } = await supabase.from('configuracion').select('valor').eq('clave', 'inactive_user_ids').maybeSingle();
          if (inactConfig?.valor) {
            let list: string[] = JSON.parse(inactConfig.valor);
            list = list.filter(id => id !== selectedSolicitud.auth_user_id && id !== selectedSolicitud.email);
            await supabase.from('configuracion').update({ valor: JSON.stringify(list) }).eq('clave', 'inactive_user_ids');
          }
        } catch (e) {
          console.warn('Error sincronizando inactive_user_ids:', e);
        }
      }

      // 2. Actualizar estado en solicitudes_registro
      const { error: solUpdateError } = await supabase
        .from('solicitudes_registro')
        .update({
          estado: 'aprobado',
          fecha_revision: new Date().toISOString(),
          notas_admin: adminNotes || 'Aprobado por el Administrador',
        })
        .eq('id', selectedSolicitud.id);

      if (solUpdateError) {
        console.warn('Error actualizando solicitudes_registro:', solUpdateError);
      }

      // 3. Enviar correo al usuario si está seleccionado
      if (sendNotificationEmail) {
        const emailHtml = generarHtmlCorreoAprobacion({
          remitenteNombre,
          remitenteCorreo,
          destinatarioCorreo: selectedSolicitud.email,
          destinatarioNombre: selectedSolicitud.nombre_completo,
          asunto: '¡Tu cuenta ha sido aprobada! - Cruz Verde Salvadoreña',
          seccionalNombre,
          rolAsignado: assignedRole,
          loginUrl: getOfficialLoginUrl(),
        });

        try {
          await sendEmailNotification({
            remitente: `${remitenteNombre} <${remitenteCorreo}>`,
            destinatario: selectedSolicitud.email,
            asunto: '¡Tu cuenta ha sido aprobada! - Cruz Verde Salvadoreña',
            cuerpoHtml: emailHtml,
            tipo: 'aprobacion_cuenta'
          });
        } catch (mailErr) {
          console.error('Error al despachar el correo de aprobación:', mailErr);
        }
      }

      await logActivity('Aprobó solicitud de registro', 'Acceso', selectedSolicitud.id, {
        usuario: selectedSolicitud.email,
        nombre: selectedSolicitud.nombre_completo,
        rol: assignedRole,
        seccional: seccionalNombre,
      });

      setActionSuccessMessage(`La solicitud de ${selectedSolicitud.nombre_completo} ha sido aprobada con éxito. Ya puede iniciar sesión.`);
      setTimeout(() => setActionSuccessMessage(null), 5000);
      setSelectedSolicitud(null);
      onRefresh();
    } catch (err: any) {
      console.error('Error aprobando solicitud:', err);
      alert(`Error al aprobar: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectSolicitud = async (solicitud: Solicitud) => {
    const motivo = prompt(`Ingrese el motivo del rechazo para la solicitud de ${solicitud.nombre_completo}:`, 'No cumple con los requisitos institucionales');
    if (motivo === null) return;

    try {
      // Marcar solicitud como rechazada
      await supabase
        .from('solicitudes_registro')
        .update({
          estado: 'rechazado',
          fecha_revision: new Date().toISOString(),
          notas_admin: motivo,
        })
        .eq('id', solicitud.id);

      // Si tiene auth_user_id, ponerlo como inactivo
      if (solicitud.auth_user_id) {
        await supabase
          .from('user_roles')
          .update({ role: 'inactivo', activo: false, estado: 'inactivo' })
          .eq('id', solicitud.auth_user_id);
      }

      await logActivity('Rechazó solicitud de registro', 'Acceso', solicitud.id, {
        usuario: solicitud.email,
        motivo,
      });

      setActionSuccessMessage(`La solicitud de ${solicitud.nombre_completo} ha sido marcada como rechazada.`);
      setTimeout(() => setActionSuccessMessage(null), 5000);
      onRefresh();
    } catch (err: any) {
      console.error('Error rechazando solicitud:', err);
      alert(`Error al rechazar: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Banner de Mensaje de Éxito */}
      {actionSuccessMessage && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-lg flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-sm font-semibold text-emerald-900">{actionSuccessMessage}</p>
          </div>
          <button onClick={() => setActionSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900 text-xs font-bold">
            Cerrar
          </button>
        </div>
      )}

      {/* Tarjetas de Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Total Recibidas</span>
          <span className="text-2xl font-black text-gray-900 mt-1 block">{solicitudes.length}</span>
        </div>
        <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider block">Pendientes de Aceptación</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <span className="text-2xl font-black text-amber-900 mt-1 block">{countPendientes}</span>
        </div>
        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block">Aprobadas</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-2xl font-black text-emerald-900 mt-1 block">{countAprobadas}</span>
        </div>
        <div className="bg-red-50 p-4 rounded-xl border border-red-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-800 uppercase tracking-wider block">Rechazadas</span>
            <XCircle className="w-4 h-4 text-red-600" />
          </div>
          <span className="text-2xl font-black text-red-900 mt-1 block">{countRechazadas}</span>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3 rounded-xl border border-gray-200">
        <div className="flex items-center space-x-1 overflow-x-auto">
          <button
            onClick={() => setFilter('pendiente')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filter === 'pendiente' ? 'bg-amber-500 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Pendientes ({countPendientes})
          </button>
          <button
            onClick={() => setFilter('aprobado')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filter === 'aprobado' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Aprobadas ({countAprobadas})
          </button>
          <button
            onClick={() => setFilter('rechazado')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filter === 'rechazado' ? 'bg-red-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Rechazadas ({countRechazadas})
          </button>
          <button
            onClick={() => setFilter('todas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filter === 'todas' ? 'bg-gray-800 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Todas ({solicitudes.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por nombre, correo, carnet..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-primary focus:border-primary"
          />
        </div>
      </div>

      {/* Tabla de Solicitudes */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left">
            <thead className="bg-gray-50 text-2xs font-bold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-5 py-3">Solicitante</th>
                <th className="px-5 py-3">Contacto</th>
                <th className="px-5 py-3">Seccional y Carnet</th>
                <th className="px-5 py-3">Motivo / Tipo</th>
                <th className="px-5 py-3">Fecha</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3 text-right">Acciones de Administrador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-xs">
              {filteredSolicitudes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-gray-400">
                    No se encontraron solicitudes con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredSolicitudes.map((sol) => (
                  <tr key={sol.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-gray-900">{sol.nombre_completo}</div>
                      <div className="text-gray-500 font-mono text-2xs">{sol.email}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      {sol.telefono ? (
                        <div className="flex items-center space-x-1 text-gray-700">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          <span>{sol.telefono}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">No especificado</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center space-x-1 font-medium text-gray-800">
                        <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{sol.seccionales?.nombre || 'Cruz Verde Salvadoreña'}</span>
                      </div>
                      {sol.carnet && (
                        <div className="mt-0.5">
                          <span className="font-mono text-2xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                            Carnet: {sol.carnet}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 max-w-xs">
                      <span className="inline-block uppercase font-bold text-2xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 mb-1">
                        {sol.tipo_usuario || 'socorrista'}
                      </span>
                      {sol.motivo && (
                        <p className="text-gray-500 text-2xs line-clamp-2" title={sol.motivo}>
                          {sol.motivo}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">
                      {sol.fecha_solicitud ? new Date(sol.fecha_solicitud).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {sol.estado === 'pendiente' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          <Clock className="w-3 h-3 mr-1" />
                          Pendiente
                        </span>
                      )}
                      {sol.estado === 'aprobado' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Aprobado
                        </span>
                      )}
                      {sol.estado === 'rechazado' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                          <XCircle className="w-3 h-3 mr-1" />
                          Rechazado
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      {sol.estado === 'pendiente' ? (
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleOpenApprove(sol)}
                            className="inline-flex items-center px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                            Aceptar y Activar
                          </button>
                          <button
                            onClick={() => handleRejectSolicitud(sol)}
                            className="inline-flex items-center px-2.5 py-1.5 bg-gray-100 hover:bg-red-50 text-gray-700 hover:text-red-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                            title="Rechazar solicitud"
                          >
                            <UserX className="w-3.5 h-3.5 mr-1" />
                            Rechazar
                          </button>
                        </div>
                      ) : (
                        <span className="text-2xs text-gray-400">
                          Revisado {sol.fecha_revision ? new Date(sol.fecha_revision).toLocaleDateString() : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE APROBACIÓN DE CUENTA (ESTILO APPLE) */}
      {selectedSolicitud && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200/80 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3.5">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center border border-slate-200/60 shadow-2xs">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 tracking-tight">Aprobar Usuario Institucional</h3>
                  <p className="text-2xs text-gray-400">Habilitación de credenciales y notificación oficial</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedSolicitud(null)} 
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-3xs font-medium text-gray-400 uppercase tracking-wider block">Solicitante</span>
                  <p className="text-xs font-semibold text-gray-900">{selectedSolicitud.nombre_completo}</p>
                  <p className="text-2xs text-gray-500 font-mono">{selectedSolicitud.email}</p>
                </div>
                {selectedSolicitud.carnet && (
                  <span className="px-2.5 py-1 rounded-full text-3xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-mono">
                    {selectedSolicitud.carnet}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-3xs font-medium text-gray-500 uppercase tracking-wider mb-1">Rol a Asignar</label>
                <select
                  value={assignedRole}
                  onChange={(e) => setAssignedRole(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-gray-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all cursor-pointer"
                >
                  {roles.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                  {!roles.includes('socorrista') && <option value="socorrista">socorrista</option>}
                  {!roles.includes('director') && <option value="director">director</option>}
                  {!roles.includes('instructor') && <option value="instructor">instructor</option>}
                  {!roles.includes('administrativo') && <option value="administrativo">administrativo</option>}
                  {!roles.includes('admin') && <option value="admin">admin</option>}
                </select>
              </div>

              <div>
                <label className="block text-3xs font-medium text-gray-500 uppercase tracking-wider mb-1">Seccional Asignada</label>
                <select
                  value={assignedSeccionalId}
                  onChange={(e) => setAssignedSeccionalId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-gray-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all cursor-pointer"
                >
                  <option value="">Cruz Verde Salvadoreña (Nivel Central)</option>
                  {seccionales.map(sec => (
                    <option key={sec.id} value={sec.id}>{sec.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Checkbox de Enviar Correo Estilo Inset Apple */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
                <label className="flex items-start space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendNotificationEmail}
                    onChange={(e) => setSendNotificationEmail(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <div className="space-y-0.5">
                    <span className="font-semibold text-gray-900 block text-2xs">Enviar correo de confirmación</span>
                    <span className="text-gray-500 text-3xs block leading-relaxed">
                      Notifica al solicitante con sus datos de acceso para inicio de sesión.
                    </span>
                  </div>
                </label>

                {sendNotificationEmail && (
                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-3xs text-gray-500">
                    <span>Remitente: <strong className="text-gray-700">{remitenteNombre}</strong></span>
                    <button
                      type="button"
                      onClick={() => setShowPreviewModal(true)}
                      className="text-emerald-700 font-semibold hover:underline flex items-center cursor-pointer"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Vista previa
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-3xs font-medium text-gray-500 uppercase tracking-wider mb-1">Notas de Administración (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: Aprobado tras validación con jefatura de seccional"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-gray-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-4 mt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedSolicitud(null)}
                disabled={processing}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmApproval}
                disabled={processing}
                className="px-5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-all disabled:opacity-40 flex items-center cursor-pointer"
              >
                {processing ? (
                  <>Procesando...</>
                ) : (
                  <>
                    <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                    Confirmar Aprobación
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VISTA PREVIA CORREO (ESTILO APPLE) */}
      {showPreviewModal && selectedSolicitud && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md flex items-center justify-center p-4 z-60 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200/80 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 border border-slate-200/60">
                  <Mail className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-gray-900">Vista Previa del Correo Oficial</h4>
                  <p className="text-3xs text-gray-400">Notificación automática de aprobación</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowPreviewModal(false)} 
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-100/70">
              <div 
                className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden"
                dangerouslySetInnerHTML={{
                  __html: generarHtmlCorreoAprobacion({
                    remitenteNombre,
                    remitenteCorreo,
                    destinatarioCorreo: selectedSolicitud.email,
                    destinatarioNombre: selectedSolicitud.nombre_completo,
                    asunto: '¡Tu cuenta ha sido aprobada! - Cruz Verde Salvadoreña',
                    seccionalNombre: seccionales.find(s => s.id === Number(assignedSeccionalId))?.nombre || 'Cruz Verde Salvadoreña',
                    rolAsignado: assignedRole,
                    loginUrl: getOfficialLoginUrl()
                  })
                }}
              />
            </div>

            <div className="px-6 py-3.5 border-t border-slate-100 flex justify-end bg-white">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Cerrar Vista Previa
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
