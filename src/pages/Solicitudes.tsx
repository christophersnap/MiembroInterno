import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ClipboardList, Fuel, Plus, Search, Filter, Eye, Download, Mail, 
  CheckCircle2, Clock, XCircle, AlertCircle, RefreshCw, ChevronLeft, 
  Building2, User, FileText, Send, Calendar, Check, ExternalLink,
  DollarSign, Truck, AlertTriangle, ShieldCheck, Info, ArrowUpRight,
  Sliders, Edit3, X, IdCard, CheckCheck
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';
import { SolicitudCombustible, CombustibleConfig, DEFAULT_COMBUSTIBLE_CONFIG, resolveCombustibleLogoUrl } from '../types/combustible';
import { SolicitudCompra, CompraConfig, DEFAULT_COMPRA_CONFIG } from '../types/compra';
import { isSolicitudRealizadaPorUsuario } from '../utils/solicitudFilter';
import { sendEmailNotification } from '../lib/api';
import { generarHtmlCorreoCombustible, generarHtmlCorreoCompra } from '../lib/emailNotification';
import { getOfficialSolicitudPdfUrl } from '../utils/appUrl';
import CombustiblePdfModal from '../components/combustible/CombustiblePdfModal';
import CompraPdfPreviewModal from '../components/compra/CompraPdfPreviewModal';
import SolicitudesCarnetTab from '../components/solicitudes/SolicitudesCarnetTab';
import { useSolicitudReadTracker, useModuleUnreadCount } from '../utils/solicitudReadTracker';
import { formatFechaSV, getElSalvadorIsoTimestamp } from '../utils/dateUtils';
import { isSolicitudFinalizada } from '../utils/solicitudLimite';

export type TipoSolicitudFilter = 'todas' | 'combustible' | 'compra';

export interface SolicitudUnifiedItem {
  id: string;
  originalId: number;
  tipo: 'combustible' | 'compra';
  folio: string;
  seccional_id?: number;
  seccional_nombre: string;
  solicitante: string;
  cargo: string;
  fecha: string;
  hora: string;
  fecha_completa: string;
  detalle_resumen: string;
  detalle_completo: string;
  monto_o_dotacion?: string;
  vehiculo_info?: string;
  estado: string;
  correo_enviado: boolean;
  correos_notificados?: string;
  correo_solicitante?: string;
  autorizado_por?: string;
  fecha_autorizacion?: string;
  motivo_rechazo?: string;
  rawCombustible?: SolicitudCombustible;
  rawCompra?: SolicitudCompra;
}

export default function Solicitudes() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, userName, role, directorSeccionalId, userSeccionalId, userSeccionalNombre, permissions, getModuleScope, getModuleSeccionalIds } = useAuth();
  const { isUnread, markAsRead, markManyAsRead } = useSolicitudReadTracker(user?.id);
  const unreadCarnetTabCount = useModuleUnreadCount('carnet');
  
  const isAdmin = role === 'admin';
  const effectiveSeccionalId = directorSeccionalId || userSeccionalId;
  const compraScope = getModuleScope('solicitudes_compra');
  const combustibleScope = getModuleScope('solicitudes_combustible');
  const compraSeccionalIds = getModuleSeccionalIds('solicitudes_compra');
  const combustibleSeccionalIds = getModuleSeccionalIds('solicitudes_combustible');

  const canViewCompra = isAdmin || Boolean(permissions.view_solicitudes_compra);
  const canViewCombustible = isAdmin || Boolean(permissions.view_solicitudes_combustible);
  const canCreateCompra = canViewCompra && (isAdmin || (permissions.crear_solicitudes_compra ?? true));
  const canCreateCombustible = canViewCombustible && (isAdmin || (permissions.crear_solicitudes_combustible ?? true));
  const canViewLogistica = canViewCompra || canViewCombustible;
  const canViewCarnet = isAdmin || Boolean(permissions.view_solicitudes_carnet);
  const canPreviewPdf = isAdmin || (permissions.ver_previsualizacion_pdf ?? true);

  const hasNivelNacional = isAdmin || (canViewCompra && compraScope === 'global') || (canViewCombustible && combustibleScope === 'global');
  const combinedAllowedSecIds = Array.from(new Set([
    ...(canViewCompra && compraScope === 'seccional' ? compraSeccionalIds : []),
    ...(canViewCombustible && combustibleScope === 'seccional' ? combustibleSeccionalIds : []),
  ]));
  const isRestrictedSeccional = !hasNivelNacional && (compraScope === 'seccional' || combustibleScope === 'seccional') && (combinedAllowedSecIds.length > 0 || Boolean(userSeccionalNombre || effectiveSeccionalId));

  const [activeMainTab, setActiveMainTab] = useState<'logistica' | 'carnet'>(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'carnet' && canViewCarnet) return 'carnet';
    if (!canViewLogistica && canViewCarnet) return 'carnet';
    return 'logistica';
  });

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'carnet' && canViewCarnet) {
      setActiveMainTab('carnet');
    } else if (tabParam !== 'carnet' && canViewLogistica) {
      setActiveMainTab('logistica');
    } else if (!canViewLogistica && canViewCarnet) {
      setActiveMainTab('carnet');
    }
  }, [searchParams, canViewCarnet, canViewLogistica]);

  // Estados de datos
  const [solicitudes, setSolicitudes] = useState<SolicitudUnifiedItem[]>([]);
  const [seccionales, setSeccionales] = useState<{ id: number; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [tipoFiltro, setTipoFiltro] = useState<TipoSolicitudFilter>(() => {
    if (canViewCombustible && !canViewCompra) return 'combustible';
    if (canViewCompra && !canViewCombustible) return 'compra';
    return 'todas';
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('Todos');
  const [filterSeccional, setFilterSeccional] = useState('Todas');

  useEffect(() => {
    if (canViewCombustible && !canViewCompra && tipoFiltro !== 'combustible') {
      setTipoFiltro('combustible');
    } else if (canViewCompra && !canViewCombustible && tipoFiltro !== 'compra') {
      setTipoFiltro('compra');
    }
  }, [canViewCombustible, canViewCompra, tipoFiltro]);

  // Modales
  const [detailItem, setDetailItem] = useState<SolicitudUnifiedItem | null>(null);
  const [emailInfoItem, setEmailInfoItem] = useState<SolicitudUnifiedItem | null>(null);
  const [pdfCombustibleItem, setPdfCombustibleItem] = useState<SolicitudCombustible | null>(null);
  const [pdfCompraItem, setPdfCompraItem] = useState<SolicitudCompra | null>(null);

  // Configuraciones de PDF
  const [combustibleConfig, setCombustibleConfig] = useState<CombustibleConfig>(DEFAULT_COMBUSTIBLE_CONFIG);
  const [compraConfig, setCompraConfig] = useState<CompraConfig>(DEFAULT_COMPRA_CONFIG);

  // Permisos y estados para cambio de estado unificado (Editar vs Solo Ver por módulo)
  const canEditCompra = isAdmin || Boolean(permissions?.edit_solicitudes_compra || permissions?.aprobar_solicitudes_compra || permissions?.autorizar_solicitudes);
  const canEditCombustible = isAdmin || Boolean(permissions?.edit_solicitudes_combustible || permissions?.aprobar_solicitudes_combustible || permissions?.autorizar_solicitudes);
  const canManageItem = (item: SolicitudUnifiedItem) => item.tipo === 'compra' ? canEditCompra : canEditCombustible;
  const canManageStatus = canEditCompra || canEditCombustible;
  const [statusModalItem, setStatusModalItem] = useState<SolicitudUnifiedItem | null>(null);
  const [newStatus, setNewStatus] = useState<string>('Aprobada');
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Modal para reenviar notificación oficial con PDF
  const [resendEmailItem, setResendEmailItem] = useState<SolicitudUnifiedItem | null>(null);
  const [resendEmailTo, setResendEmailTo] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendSuccessMsg, setSendSuccessMsg] = useState('');
  const [sendErrorMsg, setSendErrorMsg] = useState('');

  const handleOpenStatusModal = (item: SolicitudUnifiedItem) => {
    markAsRead(item.tipo, item.originalId);
    setStatusModalItem(item);
    setNewStatus(item.estado || 'Pendiente');
    setMotivoRechazo(item.motivo_rechazo || '');
  };

  const handleQuickStatus = async (item: SolicitudUnifiedItem, targetStatus: string) => {
    markAsRead(item.tipo, item.originalId);
    if (targetStatus === 'Rechazada') {
      handleOpenStatusModal(item);
      setNewStatus('Rechazada');
      return;
    }

    setUpdatingStatus(true);
    try {
      const payload: any = {
        estado: targetStatus,
        updated_at: getElSalvadorIsoTimestamp()
      };

      if (targetStatus === 'Aprobada' || targetStatus === 'Finalizada' || targetStatus === 'Entregada') {
        payload.autorizado_por = userName || user?.email || 'Administración Central';
        payload.fecha_autorizacion = getElSalvadorIsoTimestamp();
        payload.motivo_rechazo = null;
      } else if (targetStatus === 'Pendiente') {
        payload.autorizado_por = null;
        payload.fecha_autorizacion = null;
        payload.motivo_rechazo = null;
      }

      const table = item.tipo === 'combustible' ? 'solicitudes_combustible' : 'solicitudes_compra';

      await supabase
        .from(table)
        .update(payload)
        .eq('id', item.originalId);

      // Actualizar fallback en almacenamiento local
      if (item.tipo === 'combustible') {
        const stored = sessionStorage.getItem('cruz_verde_solicitudes_combustible');
        if (stored) {
          try {
            const arr = JSON.parse(stored);
            const upd = arr.map((s: any) => s.id === item.originalId ? { ...s, ...payload } : s);
            sessionStorage.setItem('cruz_verde_solicitudes_combustible', JSON.stringify(upd));
          } catch (e) {}
        }
      } else {
        const stored = sessionStorage.getItem('cruz_verde_solicitudes_compra');
        if (stored) {
          try {
            const arr = JSON.parse(stored);
            const upd = arr.map((s: any) => s.id === item.originalId ? { ...s, ...payload } : s);
            sessionStorage.setItem('cruz_verde_solicitudes_compra', JSON.stringify(upd));
          } catch (e) {}
        }
      }

      // Actualizar estado en UI
      setSolicitudes(prev => prev.map(s => {
        if (s.id === item.id) {
          return {
            ...s,
            estado: targetStatus,
            autorizado_por: payload.autorizado_por !== undefined ? payload.autorizado_por : s.autorizado_por,
            fecha_autorizacion: payload.fecha_autorizacion !== undefined ? payload.fecha_autorizacion : s.fecha_autorizacion,
            motivo_rechazo: null
          };
        }
        return s;
      }));

      if (detailItem && detailItem.id === item.id) {
        setDetailItem(prev => prev ? {
          ...prev,
          estado: targetStatus,
          autorizado_por: payload.autorizado_por !== undefined ? payload.autorizado_por : prev.autorizado_por,
          fecha_autorizacion: payload.fecha_autorizacion !== undefined ? payload.fecha_autorizacion : prev.fecha_autorizacion,
          motivo_rechazo: null
        } : null);
      }

      await logActivity(
        `Cambió estado a ${targetStatus}`,
        item.tipo === 'combustible' ? 'SolicitudCombustible' : 'SolicitudCompra',
        item.folio,
        { estado: targetStatus }
      );

      window.dispatchEvent(new Event('solicitudes_updated'));
    } catch (err: any) {
      alert(`Error al actualizar estado: ${err.message || 'Error desconocido'}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSaveStatus = async () => {
    if (!statusModalItem) return;
    setUpdatingStatus(true);
    try {
      const payload: any = {
        estado: newStatus,
        updated_at: getElSalvadorIsoTimestamp()
      };

      if (newStatus === 'Aprobada' || newStatus === 'Finalizada' || newStatus === 'Entregada') {
        payload.autorizado_por = userName || user?.email || 'Administración Central';
        payload.fecha_autorizacion = getElSalvadorIsoTimestamp();
        payload.motivo_rechazo = null;
      } else if (newStatus === 'Rechazada') {
        payload.motivo_rechazo = motivoRechazo.trim() || 'No especificado';
      } else if (newStatus === 'Pendiente') {
        payload.autorizado_por = null;
        payload.fecha_autorizacion = null;
        payload.motivo_rechazo = null;
      }

      const table = statusModalItem.tipo === 'combustible' ? 'solicitudes_combustible' : 'solicitudes_compra';

      const { error: updateErr } = await supabase
        .from(table)
        .update(payload)
        .eq('id', statusModalItem.originalId);

      if (updateErr) {
        console.warn('Advertencia actualizando en Supabase:', updateErr);
      }

      // Actualizar fallback en almacenamiento local
      if (statusModalItem.tipo === 'combustible') {
        const stored = sessionStorage.getItem('cruz_verde_solicitudes_combustible');
        if (stored) {
          try {
            const arr = JSON.parse(stored);
            const upd = arr.map((s: any) => s.id === statusModalItem.originalId ? { ...s, ...payload } : s);
            sessionStorage.setItem('cruz_verde_solicitudes_combustible', JSON.stringify(upd));
          } catch (e) {}
        }
      } else {
        const stored = sessionStorage.getItem('cruz_verde_solicitudes_compra');
        if (stored) {
          try {
            const arr = JSON.parse(stored);
            const upd = arr.map((s: any) => s.id === statusModalItem.originalId ? { ...s, ...payload } : s);
            sessionStorage.setItem('cruz_verde_solicitudes_compra', JSON.stringify(upd));
          } catch (e) {}
        }
      }

      // Actualizar en el estado local de la tabla
      setSolicitudes(prev => prev.map(s => {
        if (s.id === statusModalItem.id) {
          return {
            ...s,
            estado: newStatus,
            autorizado_por: payload.autorizado_por !== undefined ? payload.autorizado_por : s.autorizado_por,
            fecha_autorizacion: payload.fecha_autorizacion !== undefined ? payload.fecha_autorizacion : s.fecha_autorizacion,
            motivo_rechazo: payload.motivo_rechazo !== undefined ? payload.motivo_rechazo : s.motivo_rechazo
          };
        }
        return s;
      }));

      if (detailItem && detailItem.id === statusModalItem.id) {
        setDetailItem(prev => prev ? {
          ...prev,
          estado: newStatus,
          autorizado_por: payload.autorizado_por !== undefined ? payload.autorizado_por : prev.autorizado_por,
          fecha_autorizacion: payload.fecha_autorizacion !== undefined ? payload.fecha_autorizacion : prev.fecha_autorizacion,
          motivo_rechazo: payload.motivo_rechazo !== undefined ? payload.motivo_rechazo : prev.motivo_rechazo
        } : null);
      }

      await logActivity(
        `Cambió estado a ${newStatus}`,
        statusModalItem.tipo === 'combustible' ? 'SolicitudCombustible' : 'SolicitudCompra',
        statusModalItem.folio,
        { estado: newStatus, motivo: motivoRechazo }
      );

      // Disparar evento para actualizar notificaciones y contadores en el menú
      window.dispatchEvent(new Event('solicitudes_updated'));

      setStatusModalItem(null);
    } catch (err: any) {
      alert(`Error al actualizar estado: ${err.message || 'Error desconocido'}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSendEmailWithPdf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmailItem) return;
    setSendingEmail(true);
    setSendSuccessMsg('');
    setSendErrorMsg('');
    try {
      const isCombustible = resendEmailItem.tipo === 'combustible';
      const pdfUrl = getOfficialSolicitudPdfUrl(resendEmailItem.tipo, resendEmailItem.folio);
      const recipient = resendEmailTo.trim() || resendEmailItem.correo_solicitante || 'notificaciones@cruzverdesv.org';
      
      let htmlBody = '';
      if (isCombustible && resendEmailItem.rawCombustible) {
        const resolvedLogoUrl = resolveCombustibleLogoUrl(combustibleConfig);
        htmlBody = generarHtmlCorreoCombustible(
          {
            remitenteNombre: 'Cruz Verde Salvadoreña (No Responder)',
            remitenteCorreo: 'notificaciones@cruzverdesv.org',
            destinatarioCorreo: recipient,
            destinatarioNombre: resendEmailItem.solicitante,
            asunto: `Solicitud de Combustible: ${resendEmailItem.folio} - ${resendEmailItem.seccional_nombre}`,
            seccionalNombre: resendEmailItem.seccional_nombre,
            numeroSolicitud: resendEmailItem.folio,
          },
          {
            folio: resendEmailItem.folio,
            codigoSolicitud: resendEmailItem.folio,
            seccional: resendEmailItem.seccional_nombre,
            seccionalNombre: resendEmailItem.seccional_nombre,
            director: resendEmailItem.rawCombustible.director_nombre,
            solicitante: resendEmailItem.solicitante,
            telefonoSolicitante: resendEmailItem.rawCombustible.telefono_solicitante,
            correoSolicitante: resendEmailItem.rawCombustible.correo_electronico,
            actividad: resendEmailItem.rawCombustible.actividad,
            entregoLiquidacionAnterior: !!resendEmailItem.rawCombustible.entrego_liquidacion_anterior,
            motivoNoLiquidacion: resendEmailItem.rawCombustible.motivo_no_liquidacion,
            observaciones: resendEmailItem.rawCombustible.observaciones,
            fecha: resendEmailItem.fecha,
            fechaEnvio: resendEmailItem.fecha_completa,
            nombreArchivoPdf: `${resendEmailItem.folio}.pdf`,
            pdfUrl,
            logoUrl: resolvedLogoUrl || undefined,
            subtituloSecundario: combustibleConfig.pdfSubtituloSecundario || 'Documento Oficial Administrativo',
            mostrarVehiculo: combustibleConfig.mostrarVehiculo,
            mostrarPlaca: combustibleConfig.mostrarPlaca,
            mostrarGalones: combustibleConfig.mostrarGalones,
            mostrarTipoGasolina: combustibleConfig.mostrarTipoGasolina,
            mostrarCantidadDinero: combustibleConfig.mostrarCantidadDinero,
          },
          {
            ...(resolvedLogoUrl ? { logoUrl: resolvedLogoUrl, mostrarLogo: true } : {}),
            ...(combustibleConfig.correoContactoTelefono?.trim()
              ? { telefonoContacto: combustibleConfig.correoContactoTelefono.trim() }
              : {}),
          }
        );
      } else {
        htmlBody = generarHtmlCorreoCompra({
          folio: resendEmailItem.folio,
          seccional: resendEmailItem.seccional_nombre,
          solicitante: resendEmailItem.solicitante,
          cargoSolicitante: resendEmailItem.cargo,
          tipo: resendEmailItem.rawCompra?.tipo_solicitud || 'General',
          esParaVehiculo: resendEmailItem.rawCompra?.es_para_vehiculo,
          vehiculoPlaca: resendEmailItem.rawCompra?.vehiculo_placa,
          vehiculoDescripcion: resendEmailItem.rawCompra?.vehiculo_descripcion,
          justificacion: resendEmailItem.detalle_completo,
          proveedorSugerido: resendEmailItem.rawCompra?.proveedor_sugerido,
          items: [{
            descripcion: resendEmailItem.detalle_resumen,
            cantidad: 1,
            precioEstimado: 0,
            subtotal: 0
          }],
          totalEstimado: 0,
          nombreArchivoPdf: `${resendEmailItem.folio}.pdf`,
          pdfUrl
        });
      }

      await sendEmailNotification({
        destinatario: recipient,
        asunto: `Documento Oficial: ${resendEmailItem.folio} - ${resendEmailItem.seccional_nombre} (${isCombustible ? 'Combustible' : 'Compra'})`,
        cuerpoHtml: htmlBody,
        tipo: isCombustible ? 'solicitud_combustible' : 'solicitud_compra',
        remitente: 'Cruz Verde Salvadoreña (No Responder) <notificaciones@cruzverdesv.org>'
      });

      setSendSuccessMsg(`Correo con el documento PDF enviado exitosamente a: ${recipient}`);
      setTimeout(() => {
        setResendEmailItem(null);
        setSendSuccessMsg('');
        setSendErrorMsg('');
      }, 2000);
    } catch (err: any) {
      setSendErrorMsg(err.message || 'No se pudo enviar el correo desde el servidor.');
    } finally {
      setSendingEmail(false);
    }
  };

  // 1. Cargar datos
  const fetchAllData = async () => {
    setLoading(true);
    try {
      // Cargar configuraciones guardadas de localStorage si existen
      const localCombConf = localStorage.getItem('cruz_verde_combustible_config');
      if (localCombConf) {
        try { setCombustibleConfig(JSON.parse(localCombConf)); } catch (e) {}
      }
      const localCompraConf = localStorage.getItem('cruz_verde_compra_config');
      if (localCompraConf) {
        try { setCompraConfig(JSON.parse(localCompraConf)); } catch (e) {}
      }

      // A. Seccionales
      const { data: secData } = await supabase
        .from('seccionales')
        .select('id, nombre')
        .order('nombre');
      
      const loadedSeccs = secData || [];
      setSeccionales(loadedSeccs);

      // B. Solicitudes de Combustible
      let combustibleList: SolicitudCombustible[] = [];
      try {
        let combQuery = supabase
          .from('solicitudes_combustible')
          .select('*')
          .order('created_at', { ascending: false });

        if (combustibleScope === 'seccional' && combustibleSeccionalIds.length <= 1 && userSeccionalNombre && !effectiveSeccionalId) {
          combQuery = combQuery.ilike('seccional_nombre', `%${userSeccionalNombre}%`);
        }

        const { data: cData, error: cErr } = await combQuery;
        if (cErr) throw cErr;
        combustibleList = cData || [];
      } catch (err) {
        // Fallback local storage
        const localComb = sessionStorage.getItem('cruz_verde_solicitudes_combustible');
        if (localComb) {
          try { combustibleList = JSON.parse(localComb); } catch (e) {}
        } else {
          // Demo inicial
          combustibleList = [{
            id: 1,
            folio: 'COMB-2026-0042',
            seccional_id: 1,
            seccional_nombre: userSeccionalNombre || 'Aguilares',
            director_nombre: '(AGUILARES) - JOSUE ARMANDO RAMOS URRUTIA',
            correo_electronico: 'aguilares@cruzverdesv.org',
            actividad: 'Cobertura de emergencias en turno regular',
            entrego_liquidacion_anterior: true,
            motivo_no_liquidacion: '',
            nombre_solicitante: userName && userName !== 'Usuario' ? userName : 'Socorrista de Guardia',
            telefono_solicitante: '7000-0000',
            observaciones: 'Dotación mensual para ambulancia y unidad de rescate.',
            fecha_solicitud: '2026-09-09',
            hora_solicitud: '19:35:00',
            fecha_envio_completa: '2026-09-09 19:35:00',
            estado: 'Pendiente',
            correo_enviado: true,
            correos_notificados: 'control_combustible@cruzverdesv.org',
            created_at: getElSalvadorIsoTimestamp()
          }];
        }
      }

      // C. Solicitudes de Compra y Mantenimiento
      let compraList: SolicitudCompra[] = [];
      try {
        let compQuery = supabase
          .from('solicitudes_compra')
          .select('*')
          .order('created_at', { ascending: false });

        if (compraScope === 'seccional' && compraSeccionalIds.length <= 1 && userSeccionalNombre && !effectiveSeccionalId) {
          compQuery = compQuery.ilike('seccional_nombre', `%${userSeccionalNombre}%`);
        }

        const { data: pData, error: pErr } = await compQuery;
        if (pErr) throw pErr;
        compraList = pData || [];
      } catch (err) {
        // Fallback local storage
        const localComp = sessionStorage.getItem('cruz_verde_solicitudes_compra');
        if (localComp) {
          try { compraList = JSON.parse(localComp); } catch (e) {}
        } else {
          // Demo inicial
          compraList = [{
            id: 1,
            folio: 'SC-2026-0001',
            seccional_id: 1,
            seccional_nombre: userSeccionalNombre || 'Santa Ana',
            solicitado_por: 'Daniel Martinez',
            cargo: 'Director Seccional',
            user_email: user?.email || 'santaana@cruzverdesv.org',
            tipo_solicitud: 'Repuestos para Vehículo',
            es_para_vehiculo: true,
            vehiculo_placa: 'CVS-014',
            vehiculo_descripcion: 'Toyota Land Cruiser HZJ78 (Ambulancia)',
            descripcion: 'Repuestos para mantenimiento preventivo: pastillas de freno y cambio de aceite de motor.',
            monto_estimado: 145.50,
            proveedor_sugerido: 'Auto Repuestos El Salvador',
            prioridad: 'Urgente',
            lugar_fecha: 'Santa Ana, 15 de agosto de 2026 (10:30)',
            fecha_solicitud: '2026-08-15',
            hora_solicitud: '10:30:00',
            estado: 'Aprobada',
            correo_enviado: true,
            correos_notificados: 'administracion@cruzverdesv.org, presidencia@cruzverdesv.org, santaana@cruzverdesv.org',
            created_at: getElSalvadorIsoTimestamp()
          }];
        }
      }

      // Unificar datos
      const unified: SolicitudUnifiedItem[] = [];

      // Mapear combustible
      combustibleList.forEach(c => {
        unified.push({
          id: `comb-${c.id}`,
          originalId: c.id,
          tipo: 'combustible',
          folio: c.folio,
          seccional_id: c.seccional_id,
          seccional_nombre: c.seccional_nombre,
          solicitante: c.nombre_solicitante,
          cargo: 'Director Seccional',
          fecha: c.fecha_solicitud || (c.created_at ? c.created_at.split('T')[0] : '2026-09-09'),
          hora: c.hora_solicitud || '12:00:00',
          fecha_completa: c.fecha_envio_completa || `${c.fecha_solicitud || ''} ${c.hora_solicitud || ''}`,
          detalle_resumen: c.actividad,
          detalle_completo: `Actividad: ${c.actividad}. Liquidación anterior: ${c.entrego_liquidacion_anterior ? 'Sí entregada' : `No entregada (${c.motivo_no_liquidacion || 'Sin motivo'})`}. Observaciones: ${c.observaciones || 'Ninguna'}.`,
          monto_o_dotacion: 'Dotación Combustible',
          vehiculo_info: 'Unidades de Emergencia / Flota',
          estado: c.estado,
          correo_enviado: Boolean(c.correo_enviado),
          correos_notificados: c.correos_notificados,
          correo_solicitante: c.correo_electronico,
          autorizado_por: c.autorizado_por,
          fecha_autorizacion: c.fecha_autorizacion,
          motivo_rechazo: c.motivo_rechazo,
          rawCombustible: c
        });
      });

      // Mapear compra
      compraList.forEach(p => {
        unified.push({
          id: `compra-${p.id}`,
          originalId: p.id,
          tipo: 'compra',
          folio: p.folio,
          seccional_id: p.seccional_id,
          seccional_nombre: p.seccional_nombre,
          solicitante: p.solicitado_por,
          cargo: p.cargo,
          fecha: p.fecha_solicitud || (p.created_at ? p.created_at.split('T')[0] : '2026-08-15'),
          hora: p.hora_solicitud || '10:00:00',
          fecha_completa: p.lugar_fecha || `${p.fecha_solicitud || ''} ${p.hora_solicitud || ''}`,
          detalle_resumen: p.tipo_solicitud,
          detalle_completo: p.descripcion,
          monto_o_dotacion: p.monto_estimado ? `$${p.monto_estimado.toFixed(2)}` : 'Cotización pendiente',
          vehiculo_info: p.es_para_vehiculo ? `${p.vehiculo_placa || 'Placa s/n'} - ${p.vehiculo_descripcion || 'Vehículo'}` : undefined,
          estado: p.estado,
          correo_enviado: Boolean(p.correo_enviado),
          correos_notificados: p.correos_notificados,
          correo_solicitante: p.user_email,
          autorizado_por: p.autorizado_por,
          fecha_autorizacion: p.fecha_autorizacion,
          motivo_rechazo: p.motivo_rechazo,
          rawCompra: p
        });
      });

      // Ordenar por fecha descendente
      unified.sort((a, b) => {
        const dateA = new Date(`${a.fecha}T${a.hora || '00:00:00'}`).getTime();
        const dateB = new Date(`${b.fecha}T${b.hora || '00:00:00'}`).getTime();
        return dateB - dateA;
      });

      // Filtrar según permisos de módulo y alcance individual (global | seccional | usuario)
      const matchesScope = (item: SolicitudUnifiedItem) => {
        if (item.tipo === 'compra' && !canViewCompra) return false;
        if (item.tipo === 'combustible' && !canViewCombustible) return false;
        const scope = item.tipo === 'compra' ? compraScope : combustibleScope;
        if (scope === 'global') return true;
        if (scope === 'seccional') {
          const customIds = item.tipo === 'compra' ? compraSeccionalIds : combustibleSeccionalIds;
          const targetIds = customIds.length > 0
            ? customIds
            : (effectiveSeccionalId ? [Number(effectiveSeccionalId)] : []);

          if (targetIds.length > 0) {
            if (item.seccional_id && targetIds.includes(Number(item.seccional_id))) return true;
            const allowedNames = loadedSeccs
              .filter(s => targetIds.includes(s.id))
              .map(s => s.nombre.toLowerCase());
            if (item.seccional_nombre && allowedNames.some(n => item.seccional_nombre.toLowerCase().includes(n))) {
              return true;
            }
            return false;
          }
          if (userSeccionalNombre) {
            return (item.seccional_nombre || '').toLowerCase().includes(userSeccionalNombre.toLowerCase());
          }
          return isSolicitudRealizadaPorUsuario(item, user, userName);
        }
        return isSolicitudRealizadaPorUsuario(item, user, userName);
      };

      setSolicitudes(unified.filter(matchesScope));

    } catch (err) {
      console.error('Error cargando solicitudes:', err);
    } finally {
      setLoading(false);
    }
  };

  const allowedSecsKey = `${compraSeccionalIds.join(',')}|${combustibleSeccionalIds.join(',')}`;
  useEffect(() => {
    fetchAllData();
  }, [userSeccionalNombre, effectiveSeccionalId, role, user?.id, user?.email, userName, compraScope, combustibleScope, allowedSecsKey, canViewCompra, canViewCombustible]);

  // Filtrado de solicitudes
  const filteredSolicitudes = useMemo(() => {
    return solicitudes.filter(item => {
      // 1. Tipo
      if (tipoFiltro !== 'todas' && item.tipo !== tipoFiltro) {
        return false;
      }

      // 2. Seccional
      const itemScope = item.tipo === 'compra' ? compraScope : combustibleScope;
      const canFilterBySec = itemScope === 'global' || (itemScope === 'seccional' && combinedAllowedSecIds.length > 1);
      if (canFilterBySec && filterSeccional !== 'Todas') {
        if (item.seccional_nombre !== filterSeccional) {
          return false;
        }
      }

      // 3. Estado
      if (filterEstado !== 'Todos') {
        if (item.estado !== filterEstado) {
          return false;
        }
      }

      // 4. Búsqueda por texto
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesFolio = item.folio.toLowerCase().includes(query);
        const matchesSolicitante = item.solicitante.toLowerCase().includes(query);
        const matchesSeccional = item.seccional_nombre.toLowerCase().includes(query);
        const matchesDetalle = item.detalle_resumen.toLowerCase().includes(query) || item.detalle_completo.toLowerCase().includes(query);
        const matchesVehiculo = item.vehiculo_info ? item.vehiculo_info.toLowerCase().includes(query) : false;

        if (!matchesFolio && !matchesSolicitante && !matchesSeccional && !matchesDetalle && !matchesVehiculo) {
          return false;
        }
      }

      return true;
    });
  }, [solicitudes, tipoFiltro, filterSeccional, filterEstado, searchTerm, compraScope, combustibleScope]);

  // Manejar apertura de PDF
  const handleOpenPdf = (item: SolicitudUnifiedItem) => {
    markAsRead(item.tipo, item.originalId);
    if (item.tipo === 'combustible' && item.rawCombustible) {
      setPdfCombustibleItem(item.rawCombustible);
    } else if (item.tipo === 'compra' && item.rawCompra) {
      setPdfCompraItem(item.rawCompra);
    }
  };

  const isItemUnread = (item: SolicitudUnifiedItem) =>
    isUnread(
      item.tipo,
      item.originalId,
      item.estado,
      item.rawCombustible?.created_at || item.rawCompra?.created_at || item.fecha
    );

  // Contadores por tipo y no leídas
  const countCombustible = useMemo(() => solicitudes.filter(s => s.tipo === 'combustible').length, [solicitudes]);
  const countCompra = useMemo(() => solicitudes.filter(s => s.tipo === 'compra').length, [solicitudes]);
  const unreadLogisticaAll = useMemo(
    () =>
      solicitudes.filter((s) =>
        isUnread(s.tipo, s.originalId, s.estado, s.rawCombustible?.created_at || s.rawCompra?.created_at || s.fecha)
      ).length,
    [solicitudes, isUnread]
  );
  const unreadCombustibleCount = useMemo(
    () =>
      solicitudes.filter(
        (s) =>
          s.tipo === 'combustible' &&
          isUnread('combustible', s.originalId, s.estado, s.rawCombustible?.created_at || s.fecha)
      ).length,
    [solicitudes, isUnread]
  );
  const unreadCompraCount = useMemo(
    () =>
      solicitudes.filter(
        (s) =>
          s.tipo === 'compra' &&
          isUnread('compra', s.originalId, s.estado, s.rawCompra?.created_at || s.fecha)
      ).length,
    [solicitudes, isUnread]
  );
  const unreadVisibleItems = useMemo(
    () =>
      filteredSolicitudes.filter((s) =>
        isUnread(s.tipo, s.originalId, s.estado, s.rawCombustible?.created_at || s.rawCompra?.created_at || s.fecha)
      ),
    [filteredSolicitudes, isUnread]
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* Encabezado Principal */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-primary text-white rounded-2xl shadow-sm">
            <ClipboardList className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                {isAdmin ? 'Página Central de Solicitudes' : 'Mis Solicitudes Realizadas'}
              </h1>
              {!isAdmin ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <User className="w-3 h-3 mr-1 text-emerald-600" />
                  {userName && userName !== 'Usuario' ? userName : (user?.email || 'Mis Solicitudes')}
                </span>
              ) : (
                isRestrictedSeccional && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                    <Building2 className="w-3 h-3 mr-1" />
                    {userSeccionalNombre || 'Tu Seccional'}
                  </span>
                )
              )}
            </div>
            <p className="text-xs md:text-sm text-gray-500 mt-0.5">
              {isAdmin
                ? 'Historial unificado de solicitudes de compra, mantenimiento y dotación de combustible, con registro de correos y PDF oficial.'
                : 'Historial exclusivo de las solicitudes que tú has realizado. Consulta el estado de aprobación y descarga los comprobantes en PDF.'
              }
            </p>
          </div>
        </div>

        {/* Botones de Acción Rápida para Nuevas Solicitudes */}
        {activeMainTab === 'logistica' && (
          <div className="flex flex-wrap items-center gap-2.5">
            {unreadVisibleItems.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  markManyAsRead(
                    unreadVisibleItems.map((it) => ({ modulo: it.tipo, solicitudKey: it.originalId }))
                  )
                }
                className="inline-flex items-center px-3.5 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 rounded-xl text-xs font-bold transition cursor-pointer"
                title="Marcar las solicitudes visibles como leídas"
              >
                <CheckCheck className="w-4 h-4 mr-1.5 text-sky-700" />
                Marcar vistas ({unreadVisibleItems.length})
              </button>
            )}

            {canCreateCombustible && (
              <button
                onClick={() => navigate('/solicitudes-combustible')}
                className="inline-flex items-center px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Fuel className="w-4 h-4 mr-1.5" />
                + Nueva Solicitud de Combustible
              </button>
            )}

            {canCreateCompra && (
              <button
                onClick={() => navigate('/solicitudes-compra')}
                className="inline-flex items-center px-4 py-2.5 bg-primary hover:bg-blue-900 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <FileText className="w-4 h-4 mr-1.5" />
                + Nueva Solicitud de Compra
              </button>
            )}

            <button
              onClick={fetchAllData}
              title="Recargar datos"
              className="p-2.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl transition shadow-2xs"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {/* Selector de Módulo dentro de Gestión Logística */}
      {(canViewLogistica || canViewCarnet) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3">
          {canViewLogistica && (
            <button
              type="button"
              onClick={() => {
                setActiveMainTab('logistica');
                setSearchParams({});
              }}
              className={`inline-flex items-center px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                activeMainTab === 'logistica'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <ClipboardList className="w-4 h-4 mr-2" />
              <span>Compras y Combustible ({solicitudes.length})</span>
              {unreadLogisticaAll > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-[10px] font-black bg-rose-500 text-white rounded-full min-w-5 text-center leading-none shadow-2xs">
                  {unreadLogisticaAll}
                </span>
              )}
            </button>
          )}
          {canViewCarnet && (
            <button
              type="button"
              onClick={() => {
                setActiveMainTab('carnet');
                setSearchParams({ tab: 'carnet' });
              }}
              className={`inline-flex items-center px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                activeMainTab === 'carnet'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <IdCard className="w-4 h-4 mr-2" />
              <span>Solicitudes de Carnet</span>
              {unreadCarnetTabCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-[10px] font-black bg-rose-500 text-white rounded-full min-w-5 text-center leading-none shadow-2xs">
                  {unreadCarnetTabCount}
                </span>
              )}
            </button>
          )}
        </div>
      )}

      {activeMainTab === 'carnet' && canViewCarnet ? (
        <SolicitudesCarnetTab />
      ) : (
        <>
      {/* Tarjetas de Resumen Rápido / Pestañas de Tipo */}
      <div className={`grid grid-cols-1 gap-3 ${canViewCombustible && canViewCompra ? 'sm:grid-cols-3' : 'sm:grid-cols-1 max-w-md'}`}>
        
        {/* Todas (solo cuando tiene acceso a ambos módulos) */}
        {canViewCombustible && canViewCompra && (
          <button
            onClick={() => setTipoFiltro('todas')}
            className={`p-4 rounded-xl border text-left transition cursor-pointer ${
              tipoFiltro === 'todas'
                ? 'bg-white border-primary ring-2 ring-primary/20 shadow-sm'
                : 'bg-gray-50/70 hover:bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                {isAdmin ? 'Todas las Solicitudes' : 'Mis Solicitudes'}
              </span>
              <div className="flex items-center gap-1.5">
                {unreadLogisticaAll > 0 && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500 text-white">
                    {unreadLogisticaAll} sin leer
                  </span>
                )}
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-800 tabular-nums">
                  {solicitudes.length}
                </span>
              </div>
            </div>
            <p className="text-2xl font-black text-gray-900 mt-2 tabular-nums">
              {solicitudes.length}
            </p>
            <span className="text-xs text-gray-500 mt-1 block">
              {isAdmin ? 'Compra, Mantenimiento y Combustible' : 'Realizadas por ti en el sistema'}
            </span>
          </button>
        )}

        {/* Combustible */}
        {canViewCombustible && (
          <button
            onClick={() => setTipoFiltro('combustible')}
            className={`p-4 rounded-xl border text-left transition cursor-pointer ${
              tipoFiltro === 'combustible'
                ? 'bg-emerald-50/50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                : 'bg-gray-50/70 hover:bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 flex items-center">
                <Fuel className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                {isAdmin ? 'Combustible' : 'Mis Solicitudes de Combustible'}
              </span>
              <div className="flex items-center gap-1.5">
                {unreadCombustibleCount > 0 && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500 text-white">
                    {unreadCombustibleCount} sin leer
                  </span>
                )}
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 tabular-nums">
                  {countCombustible}
                </span>
              </div>
            </div>
            <p className="text-2xl font-black text-emerald-900 mt-2 tabular-nums">
              {countCombustible}
            </p>
            <span className="text-xs text-emerald-700 mt-1 block">
              Dotación y liquidación de combustible
            </span>
          </button>
        )}

        {/* Compra */}
        {canViewCompra && (
          <button
            onClick={() => setTipoFiltro('compra')}
            className={`p-4 rounded-xl border text-left transition cursor-pointer ${
              tipoFiltro === 'compra'
                ? 'bg-blue-50/50 border-primary ring-2 ring-primary/20 shadow-sm'
                : 'bg-gray-50/70 hover:bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center">
                <FileText className="w-3.5 h-3.5 mr-1 text-primary" />
                {isAdmin ? 'Compras y Mantenimiento' : 'Mis Solicitudes de Compra'}
              </span>
              <div className="flex items-center gap-1.5">
                {unreadCompraCount > 0 && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500 text-white">
                    {unreadCompraCount} sin leer
                  </span>
                )}
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 tabular-nums">
                  {countCompra}
                </span>
              </div>
            </div>
            <p className="text-2xl font-black text-primary mt-2 tabular-nums">
              {countCompra}
            </p>
            <span className="text-xs text-blue-700 mt-1 block">
              Repuestos, suministros y servicios
            </span>
          </button>
        )}
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
          
          {/* Buscador */}
          <div className={`${canViewCombustible && canViewCompra ? 'md:col-span-5' : 'md:col-span-7'} relative`}>
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por folio, solicitante, seccional, detalle, vehículo..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            />
          </div>

          {/* Filtro Tipo (solo si tiene acceso a ambos tipos) */}
          {canViewCombustible && canViewCompra && (
            <div className="md:col-span-2">
              <select
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value as TipoSolicitudFilter)}
                className="w-full py-2 px-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white font-medium"
              >
                <option value="todas">Tipo: Todos</option>
                <option value="combustible">Combustible</option>
                <option value="compra">Compra / Mant.</option>
              </select>
            </div>
          )}

          {/* Filtro Estado */}
          <div className="md:col-span-2">
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="w-full py-2 px-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white font-medium"
            >
              <option value="Todos">Estado: Todos</option>
              <option value="Pendiente">Pendiente</option>
              <option value="En Proceso">En Proceso</option>
              <option value="Aprobada">Aprobada</option>
              <option value="Finalizada">Finalizada</option>
              <option value="Rechazada">Rechazada</option>
            </select>
          </div>

          {/* Filtro Seccional o Indicador de Alcance */}
          <div className="md:col-span-3">
            {hasNivelNacional || combinedAllowedSecIds.length > 1 ? (
              <select
                value={filterSeccional}
                onChange={(e) => setFilterSeccional(e.target.value)}
                className="w-full py-2 px-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white font-medium"
              >
                <option value="Todas">
                  {hasNivelNacional ? 'Seccional: Todas las seccionales' : `Seccionales (${combinedAllowedSecIds.length}): Todas`}
                </option>
                {(hasNivelNacional
                  ? seccionales
                  : seccionales.filter(s => combinedAllowedSecIds.includes(s.id))
                ).map(s => (
                  <option key={s.id} value={s.nombre}>{s.nombre}</option>
                ))}
              </select>
            ) : isRestrictedSeccional ? (
              <div className="w-full py-2 px-3 bg-gray-100 border border-gray-300 rounded-lg flex items-center justify-between text-gray-700 font-medium">
                <span className="truncate">
                  Seccional: {seccionales.find(s => combinedAllowedSecIds.includes(s.id))?.nombre || userSeccionalNombre || 'Asignada'}
                </span>
                <span className="text-2xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">Seccional</span>
              </div>
            ) : (
              <div className="w-full py-2 px-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-emerald-900 text-xs font-medium">
                <span className="truncate flex items-center">
                  <User className="w-3.5 h-3.5 mr-1.5 text-emerald-600 shrink-0" />
                  Solo mis solicitudes
                </span>
                <span className="text-2xs bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold shrink-0">Usuario</span>
              </div>
            )}
          </div>
        </div>

        {/* Badges de filtros activos */}
        {(searchTerm || filterEstado !== 'Todos' || filterSeccional !== 'Todas' || tipoFiltro !== 'todas') && (
          <div className="flex items-center justify-between pt-1 border-t border-gray-100 text-2xs text-gray-500">
            <span className="font-medium">
              Mostrando {filteredSolicitudes.length} de {solicitudes.length} solicitudes encontradas
            </span>
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterEstado('Todos');
                if (!isRestrictedSeccional) setFilterSeccional('Todas');
                setTipoFiltro('todas');
              }}
              className="text-primary hover:underline font-bold"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Tabla de Solicitudes */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto"></div>
            <p className="mt-3 text-xs text-gray-500 font-medium">Cargando solicitudes unificadas...</p>
          </div>
        ) : filteredSolicitudes.length === 0 ? (
          <div className="py-16 text-center text-gray-500 space-y-3">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto" />
            <p className="text-sm font-bold text-gray-700">
              {!isAdmin 
                ? 'No has realizado ninguna solicitud todavía'
                : 'No se encontraron solicitudes registradas'
              }
            </p>
            <p className="text-xs text-gray-400 max-w-md mx-auto">
              {searchTerm || filterEstado !== 'Todos' || (isAdmin && filterSeccional !== 'Todas')
                ? 'Pruebe a cambiar los términos de búsqueda o los filtros aplicados.'
                : !isAdmin
                ? 'Las solicitudes de combustible o compra que tú envíes se listarán automáticamente en esta tabla con su estado y copia PDF.'
                : 'Puede registrar una nueva solicitud utilizando los botones superiores.'}
            </p>
            {!isAdmin && (canCreateCombustible || canCreateCompra) && (
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {canCreateCombustible && (
                  <button
                    onClick={() => navigate('/solicitudes-combustible')}
                    className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                  >
                    <Fuel className="w-4 h-4 mr-1.5" />
                    + Nueva Solicitud de Combustible
                  </button>
                )}
                {canCreateCompra && (
                  <button
                    onClick={() => navigate('/solicitudes-compra')}
                    className="inline-flex items-center px-4 py-2 bg-primary hover:bg-blue-900 text-white rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                  >
                    <FileText className="w-4 h-4 mr-1.5" />
                    + Nueva Solicitud de Compra
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50 border-b border-gray-200 uppercase text-2xs font-bold text-gray-700 tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Folio / Tipo</th>
                  <th className="px-4 py-3.5">Seccional</th>
                  <th className="px-4 py-3.5">Solicitante</th>
                  <th className="px-4 py-3.5">Fecha</th>
                  <th className="px-4 py-3.5">Requerimiento</th>
                  <th className="px-4 py-3.5">Estado</th>
                  <th className="px-4 py-3.5 text-center">Envío Correo y PDF</th>
                  <th className="px-4 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSolicitudes.map((item) => {
                  const isCombustible = item.tipo === 'combustible';
                  const rowUnread = isItemUnread(item);
                  const rowFinalizada = isSolicitudFinalizada(item.estado);
                  const rowRechazada = item.estado === 'Rechazada';

                  return (
                    <tr
                      key={item.id}
                      onClick={() => {
                        if (rowUnread) markAsRead(item.tipo, item.originalId);
                      }}
                      className={`transition-colors ${
                        rowUnread
                          ? 'bg-sky-50/85 hover:bg-sky-100/75 border-l-4 border-l-rose-500 cursor-pointer'
                          : rowFinalizada
                          ? 'bg-emerald-50/75 hover:bg-emerald-100/65 border-l-4 border-l-emerald-500'
                          : rowRechazada
                          ? 'bg-rose-50/35 hover:bg-rose-50/65 border-l-4 border-l-rose-300'
                          : 'bg-white hover:bg-slate-50/80 border-l-4 border-l-transparent'
                      }`}
                    >
                      
                      {/* Folio y Tipo */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {rowUnread && (
                            <span
                              className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"
                              title="Solicitud no leída"
                            />
                          )}
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-2xs font-bold ${
                              isCombustible
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {isCombustible ? (
                              <>
                                <Fuel className="w-3 h-3 mr-1" />
                                Combustible
                              </>
                            ) : (
                              <>
                                <FileText className="w-3 h-3 mr-1" />
                                Compra
                              </>
                            )}
                          </span>
                          <span className={`font-mono tabular-nums ${rowUnread ? 'font-black text-slate-950' : rowFinalizada ? 'font-bold text-emerald-950' : 'font-bold text-gray-900'}`}>
                            {item.folio}
                          </span>
                          {rowUnread && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black uppercase tracking-wide">
                              Sin leer
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Seccional */}
                      <td className={`px-4 py-3 whitespace-nowrap ${rowUnread ? 'font-bold text-slate-900' : rowFinalizada ? 'font-medium text-emerald-950' : 'font-medium text-gray-800'}`}>
                        <div className="flex items-center space-x-1.5">
                          <Building2 className={`w-3.5 h-3.5 shrink-0 ${rowFinalizada ? 'text-emerald-600/70' : 'text-gray-400'}`} />
                          <span>{item.seccional_nombre}</span>
                        </div>
                      </td>

                      {/* Solicitante */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className={rowUnread ? 'font-bold text-slate-950' : rowFinalizada ? 'font-semibold text-emerald-950' : 'font-semibold text-gray-900'}>{item.solicitante}</div>
                        <div className={`text-2xs ${rowFinalizada ? 'text-emerald-800/70' : 'text-gray-500'}`}>{item.cargo}</div>
                      </td>

                      {/* Fecha */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className={`flex items-center space-x-1 tabular-nums ${rowUnread ? 'text-slate-900 font-semibold' : rowFinalizada ? 'text-emerald-950 font-medium' : 'text-gray-800 font-medium'}`}>
                          <Calendar className={`w-3.5 h-3.5 ${rowFinalizada ? 'text-emerald-600/70' : 'text-gray-400'}`} />
                          <span>{item.fecha}</span>
                        </div>
                        <div className={`text-2xs tabular-nums ${rowFinalizada ? 'text-emerald-800/65' : 'text-gray-400'}`}>{item.hora}</div>
                      </td>

                      {/* Requerimiento */}
                      <td className="px-4 py-3 max-w-xs truncate">
                        <div className={`truncate ${rowUnread ? 'font-bold text-slate-950' : rowFinalizada ? 'font-medium text-emerald-950' : 'font-medium text-gray-900'}`}>
                          {item.detalle_resumen}
                        </div>
                        {item.vehiculo_info && (
                          <div className="text-2xs text-blue-700 flex items-center space-x-1 truncate mt-0.5">
                            <Truck className="w-3 h-3 shrink-0" />
                            <span className="truncate">{item.vehiculo_info}</span>
                          </div>
                        )}
                        {item.monto_o_dotacion && (
                          <div className={`text-2xs mt-0.5 tabular-nums ${rowFinalizada ? 'text-emerald-800/75' : 'text-gray-500'}`}>
                            {item.monto_o_dotacion}
                          </div>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col space-y-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (canManageItem(item)) handleOpenStatusModal(item);
                            }}
                            disabled={!canManageItem(item)}
                            className={`inline-flex items-center px-2.5 py-1 rounded-xl text-2xs font-semibold transition w-fit ${
                              canManageItem(item) ? 'cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-slate-300' : 'cursor-default'
                            } ${
                              item.estado === 'Aprobada'
                                ? 'bg-blue-50 text-blue-800 border border-blue-200/80'
                                : item.estado === 'Pendiente'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200/80'
                                : rowFinalizada
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : rowRechazada
                                ? 'bg-rose-50 text-rose-800 border border-rose-200/80'
                                : 'bg-slate-100 text-slate-700 border border-slate-200/80'
                            }`}
                            title={canManageItem(item) ? 'Gestionar estado' : item.estado}
                          >
                            {item.estado === 'Aprobada' && <CheckCircle2 className="w-3 h-3 mr-1 text-blue-600" />}
                            {item.estado === 'Pendiente' && <Clock className="w-3 h-3 mr-1 text-amber-600" />}
                            {rowFinalizada && <CheckCheck className="w-3 h-3 mr-1 text-white" />}
                            {rowRechazada && <XCircle className="w-3 h-3 mr-1 text-rose-600" />}
                            <span>{item.estado}</span>
                            {canManageItem(item) && <Edit3 className="w-2.5 h-2.5 ml-1.5 opacity-60" />}
                          </button>

                          {/* Acciones directas minimalistas */}
                          {canManageItem(item) && (
                            <div className="flex items-center gap-1 pt-0.5">
                              {item.estado !== 'Aprobada' && !rowFinalizada && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuickStatus(item, 'Aprobada');
                                  }}
                                  className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-white text-blue-700 hover:bg-blue-50 border border-slate-200 transition cursor-pointer whitespace-nowrap"
                                  title="Aprobar solicitud"
                                >
                                  Aprobar
                                </button>
                              )}
                              {!rowFinalizada && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuickStatus(item, 'Finalizada');
                                  }}
                                  className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-white text-emerald-700 hover:bg-emerald-50 border border-slate-200 transition cursor-pointer whitespace-nowrap"
                                  title="Marcar como Finalizada"
                                >
                                  Finalizar
                                </button>
                              )}
                              {item.estado !== 'Pendiente' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuickStatus(item, 'Pendiente');
                                  }}
                                  className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 transition cursor-pointer whitespace-nowrap"
                                  title="Regresar a Pendiente"
                                >
                                  Pendiente
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Envío Correo y Copia PDF */}
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {item.correo_enviado ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(item.tipo, item.originalId);
                              setEmailInfoItem(item);
                            }}
                            className="inline-flex items-center px-2.5 py-1 rounded-xl text-2xs font-semibold bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200/80 transition cursor-pointer shadow-2xs"
                            title="Ver correos notificados"
                          >
                            <Mail className="w-3 h-3 mr-1 text-emerald-600" />
                            Notificado
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(item.tipo, item.originalId);
                              setResendEmailItem(item);
                              setResendEmailTo(item.correo_solicitante || '');
                            }}
                            className="inline-flex items-center px-2.5 py-1 rounded-xl text-2xs font-semibold bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition cursor-pointer"
                            title="Enviar correo con PDF"
                          >
                            <Mail className="w-3 h-3 mr-1 text-slate-400" />
                            Enviar
                          </button>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1">
                          {canManageItem(item) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenStatusModal(item);
                              }}
                              className="inline-flex items-center justify-center w-8 h-8 text-slate-600 hover:text-slate-950 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition cursor-pointer"
                              title="Gestionar estado"
                            >
                              <Sliders className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(item.tipo, item.originalId);
                              setDetailItem(item);
                            }}
                            className="inline-flex items-center justify-center w-8 h-8 text-slate-600 hover:text-slate-950 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition cursor-pointer"
                            title="Ver solicitud"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(item.tipo, item.originalId);
                              setResendEmailItem(item);
                              setResendEmailTo(item.correo_solicitante || '');
                            }}
                            className="inline-flex items-center justify-center w-8 h-8 text-slate-600 hover:text-emerald-700 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition cursor-pointer"
                            title="Enviar o reenviar correo con PDF"
                          >
                            <Mail className="w-4 h-4" />
                          </button>

                          {canPreviewPdf && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenPdf(item);
                              }}
                              className="inline-flex items-center px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-2xs font-semibold transition shadow-2xs cursor-pointer whitespace-nowrap"
                              title="Abrir documento PDF"
                            >
                              <Download className="w-3 h-3 mr-1" />
                              PDF
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
        </>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: VER DETALLE DE LA SOLICITUD (ESTILO iOS)         */}
      {/* ========================================================= */}
      {detailItem && (() => {
        const detailFinalizada = isSolicitudFinalizada(detailItem.estado);
        const detailStatusDot =
          detailFinalizada
            ? 'bg-emerald-500'
            : detailItem.estado === 'Aprobada'
            ? 'bg-blue-500'
            : detailItem.estado === 'Pendiente'
            ? 'bg-amber-500'
            : detailItem.estado === 'Rechazada'
            ? 'bg-rose-500'
            : 'bg-slate-400';

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-md p-3 sm:p-5"
            onClick={() => setDetailItem(null)}
          >
            <div
              className="bg-[#F2F2F7] rounded-[28px] max-w-xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200/80 animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header estilo iOS Sheet */}
              <div className="px-5 py-4 bg-white border-b border-slate-200/70 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                      detailItem.tipo === 'combustible'
                        ? 'bg-emerald-500/12 text-emerald-600'
                        : 'bg-blue-500/12 text-blue-600'
                    }`}
                  >
                    {detailItem.tipo === 'combustible' ? (
                      <Fuel className="w-5 h-5" />
                    ) : (
                      <FileText className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-900 tracking-tight truncate font-mono">
                      {detailItem.folio}
                    </h3>
                    <p className="text-xs text-slate-500 truncate">
                      {detailItem.tipo === 'combustible'
                        ? 'Solicitud de Combustible'
                        : 'Solicitud de Compra y Mantenimiento'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDetailItem(null)}
                  aria-label="Cerrar detalle"
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Contenido agrupado estilo iOS */}
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
                {/* Tarjeta resumen */}
                <section className="space-y-1.5">
                  <h4 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Información general
                  </h4>
                  <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden shadow-2xs text-xs">
                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                      <span className="text-slate-500">Estado</span>
                      <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                        <span className={`w-2 h-2 rounded-full ${detailStatusDot}`} />
                        {detailItem.estado}
                      </span>
                    </div>
                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                      <span className="text-slate-500">Seccional</span>
                      <span className="font-semibold text-slate-900 text-right">{detailItem.seccional_nombre}</span>
                    </div>
                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                      <span className="text-slate-500">Solicitante</span>
                      <div className="text-right min-w-0">
                        <span className="font-semibold text-slate-900 block truncate">{detailItem.solicitante}</span>
                        {detailItem.cargo && (
                          <span className="text-[11px] text-slate-500 block">{detailItem.cargo}</span>
                        )}
                      </div>
                    </div>
                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                      <span className="text-slate-500">Fecha y hora</span>
                      <span className="font-medium text-slate-800 tabular-nums">
                        {detailItem.fecha} · {detailItem.hora}
                      </span>
                    </div>
                    {detailItem.vehiculo_info && (
                      <div className="px-4 py-3 flex items-center justify-between gap-3">
                        <span className="text-slate-500">Unidad / Vehículo</span>
                        <span className="font-medium text-slate-900 text-right">{detailItem.vehiculo_info}</span>
                      </div>
                    )}
                    {detailItem.monto_o_dotacion && (
                      <div className="px-4 py-3 flex items-center justify-between gap-3">
                        <span className="text-slate-500">Concepto / Monto</span>
                        <span className="font-semibold text-slate-900 tabular-nums text-right">
                          {detailItem.monto_o_dotacion}
                        </span>
                      </div>
                    )}
                  </div>
                </section>

                {/* Detalle del requerimiento */}
                <section className="space-y-1.5">
                  <h4 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Requerimiento
                  </h4>
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {detailItem.detalle_completo}
                    </p>
                  </div>
                </section>

                {/* Autorización o Rechazo */}
                {detailItem.autorizado_por && (
                  <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-2xl px-4 py-3 flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-xs min-w-0">
                      <p className="font-semibold text-emerald-950">Autorizada</p>
                      <p className="text-[11px] text-emerald-800 mt-0.5">
                        {detailItem.autorizado_por}
                        {detailItem.fecha_autorizacion ? ` · ${formatFechaSV(detailItem.fecha_autorizacion)}` : ''}
                      </p>
                    </div>
                  </div>
                )}

                {detailItem.motivo_rechazo && (
                  <div className="bg-rose-50/90 border border-rose-200/80 rounded-2xl px-4 py-3 flex items-start gap-3">
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="text-xs min-w-0">
                      <p className="font-semibold text-rose-950">Motivo de rechazo</p>
                      <p className="text-[11px] text-rose-800 mt-0.5 leading-relaxed">{detailItem.motivo_rechazo}</p>
                    </div>
                  </div>
                )}

                {/* Cambio rápido de estado */}
                {canManageItem(detailItem) && (
                  <section className="space-y-1.5">
                    <div className="flex items-center justify-between px-1">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Actualizar estado
                      </h4>
                      <button
                        type="button"
                        onClick={() => handleOpenStatusModal(detailItem)}
                        className="text-[11px] font-semibold text-slate-600 hover:text-slate-950 transition-colors cursor-pointer"
                      >
                        Más opciones
                      </button>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-2 shadow-2xs grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        disabled={updatingStatus}
                        onClick={() => handleQuickStatus(detailItem, 'Pendiente')}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                          detailItem.estado === 'Pendiente'
                            ? 'bg-amber-500 text-white shadow-2xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Pendiente</span>
                      </button>

                      <button
                        type="button"
                        disabled={updatingStatus}
                        onClick={() => handleQuickStatus(detailItem, 'Aprobada')}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                          detailItem.estado === 'Aprobada'
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Aprobar</span>
                      </button>

                      <button
                        type="button"
                        disabled={updatingStatus}
                        onClick={() => handleQuickStatus(detailItem, 'Finalizada')}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                          detailFinalizada
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Finalizar</span>
                      </button>

                      <button
                        type="button"
                        disabled={updatingStatus}
                        onClick={() => {
                          handleOpenStatusModal(detailItem);
                          setNewStatus('Rechazada');
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                          detailItem.estado === 'Rechazada'
                            ? 'bg-rose-600 text-white shadow-2xs'
                            : 'bg-slate-50 hover:bg-rose-50 text-rose-700'
                        }`}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Rechazar</span>
                      </button>
                    </div>
                  </section>
                )}
              </div>

              {/* Footer limpio estilo iOS */}
              <div className="px-5 py-3.5 bg-white border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setDetailItem(null);
                      setEmailInfoItem(detailItem);
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <span>Correos</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResendEmailItem(detailItem);
                      setResendEmailTo(detailItem.correo_solicitante || '');
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Send className="w-3.5 h-3.5 text-slate-500" />
                    <span>Reenviar</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailItem(null)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Cerrar
                  </button>

                  {canPreviewPdf && (
                    <button
                      type="button"
                      onClick={() => {
                        handleOpenPdf(detailItem);
                        setDetailItem(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Ver PDF</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================= */}
      {/* MODAL 2: HISTORIAL DE CORREOS NOTIFICADOS (ESTILO iOS)    */}
      {/* ========================================================= */}
      {emailInfoItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-md p-3 sm:p-5"
          onClick={() => setEmailInfoItem(null)}
        >
          <div
            className="bg-[#F2F2F7] rounded-[28px] max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200/80 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-white border-b border-slate-200/70 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/12 text-emerald-600 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 tracking-tight truncate">
                    Correos notificados
                  </h3>
                  <p className="text-xs text-slate-500 truncate">
                    <span className="font-mono font-semibold text-slate-700">{emailInfoItem.folio}</span> · {emailInfoItem.seccional_nombre}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEmailInfoItem(null)}
                aria-label="Cerrar"
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Estado de envío */}
              <div className="bg-white rounded-2xl border border-slate-200/80 px-4 py-3.5 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3 min-w-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">
                      {emailInfoItem.correo_enviado ? 'Notificación enviada' : 'Pendiente de envío'}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      Incluye enlace al documento PDF oficial
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-medium text-slate-500 tabular-nums shrink-0">
                  {emailInfoItem.fecha}
                </span>
              </div>

              {/* Destinatarios */}
              <section className="space-y-1.5">
                <h4 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Destinatarios
                </h4>
                <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden shadow-2xs">
                  {emailInfoItem.correo_solicitante && (
                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{emailInfoItem.correo_solicitante}</p>
                        <p className="text-[11px] text-slate-500 truncate">
                          Copia al solicitante · {emailInfoItem.solicitante}
                        </p>
                      </div>
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    </div>
                  )}

                  {emailInfoItem.correos_notificados ? (
                    emailInfoItem.correos_notificados.split(',').map((c, idx) => {
                      const trimmed = c.trim();
                      if (!trimmed || trimmed === emailInfoItem.correo_solicitante) return null;

                      const isAdminDest = trimmed.includes('administracion') || trimmed.includes('combustible');
                      const isPresidencia = trimmed.includes('presidencia');

                      return (
                        <div key={idx} className="px-4 py-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{trimmed}</p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {isAdminDest
                                ? 'Revisión y control'
                                : isPresidencia
                                ? 'Copia institucional'
                                : 'Destinatario notificado'}
                            </p>
                          </div>
                          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        </div>
                      );
                    })
                  ) : !emailInfoItem.correo_solicitante ? (
                    <div className="px-4 py-3 text-slate-500">
                      No se registraron correos adicionales en el envío.
                    </div>
                  ) : null}
                </div>
              </section>

              {/* Asunto */}
              <section className="space-y-1.5">
                <h4 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Asunto registrado
                </h4>
                <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs">
                  <p className="font-mono text-[11px] text-slate-700 leading-relaxed break-words">
                    {emailInfoItem.tipo === 'combustible'
                      ? `Solicitud de Combustible [${emailInfoItem.folio}] - ${emailInfoItem.seccional_nombre} - ${emailInfoItem.solicitante} - ${emailInfoItem.fecha}`
                      : `Solicitud de Compra [${emailInfoItem.folio}] - ${emailInfoItem.seccional_nombre} - ${emailInfoItem.solicitante} - ${emailInfoItem.fecha}`}
                  </p>
                </div>
              </section>
            </div>

            <div className="px-5 py-3.5 bg-white border-t border-slate-200/70 flex items-center justify-between gap-2 shrink-0">
              {canPreviewPdf ? (
                <button
                  type="button"
                  onClick={() => {
                    handleOpenPdf(emailInfoItem);
                    setEmailInfoItem(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Ver PDF</span>
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={() => setEmailInfoItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: GESTIONAR ESTADO (ESTILO iOS)                      */}
      {/* ========================================================= */}
      {statusModalItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-md p-3 sm:p-5"
          onClick={() => setStatusModalItem(null)}
        >
          <div
            className="bg-[#F2F2F7] rounded-[28px] max-w-md w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200/80 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header iOS */}
            <div className="px-5 py-4 bg-white border-b border-slate-200/70 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-slate-900/8 text-slate-800 flex items-center justify-center shrink-0">
                  <Sliders className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    Gestionar estado
                  </h3>
                  <p className="text-xs text-slate-500 truncate">
                    <span className="font-mono font-semibold text-slate-700">{statusModalItem.folio}</span> · {statusModalItem.tipo === 'combustible' ? 'Combustible' : 'Compra'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStatusModalItem(null)}
                aria-label="Cerrar"
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Resumen compacto */}
              <div className="bg-white rounded-2xl border border-slate-200/80 px-4 py-3 shadow-2xs">
                <p className="font-semibold text-slate-900 truncate">
                  {statusModalItem.seccional_nombre} · {statusModalItem.solicitante}
                </p>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  {statusModalItem.detalle_resumen}
                </p>
              </div>

              {/* Lista de estados estilo iOS Grouped Table */}
              <section className="space-y-1.5">
                <h4 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Seleccionar estado
                </h4>
                <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden shadow-2xs">
                  {[
                    {
                      val: 'Pendiente',
                      label: 'Pendiente',
                      desc: 'En espera de revisión o documentos',
                      dot: 'bg-amber-500',
                    },
                    {
                      val: 'En Proceso',
                      label: 'En Proceso',
                      desc: 'En cotización o gestión operativa',
                      dot: 'bg-sky-500',
                    },
                    {
                      val: 'Aprobada',
                      label: 'Aprobada',
                      desc: 'Autorizada formalmente para ejecución',
                      dot: 'bg-blue-600',
                    },
                    {
                      val: 'Finalizada',
                      label: 'Finalizada',
                      desc: 'Entrega o despacho concluido (habilita nuevas solicitudes)',
                      dot: 'bg-emerald-600',
                    },
                    {
                      val: 'Rechazada',
                      label: 'Rechazada',
                      desc: 'No procede; se registra el motivo',
                      dot: 'bg-rose-500',
                    },
                  ].map((opt) => {
                    const selected = newStatus === opt.val;
                    return (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setNewStatus(opt.val)}
                        className={`w-full px-4 py-3 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                          selected ? 'bg-slate-50' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <span className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${opt.dot}`} />
                          <div className="min-w-0">
                            <span className={`block text-xs font-semibold ${selected ? 'text-slate-950' : 'text-slate-800'}`}>
                              {opt.label}
                            </span>
                            <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">
                              {opt.desc}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                            selected
                              ? 'bg-slate-900 text-white'
                              : 'border border-slate-300 bg-white'
                          }`}
                        >
                          {selected && <Check className="w-3 h-3" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {newStatus === 'Rechazada' && (
                <section className="space-y-1.5">
                  <label className="px-1 block text-[11px] font-semibold uppercase tracking-wider text-rose-600">
                    Motivo del rechazo (obligatorio)
                  </label>
                  <textarea
                    rows={3}
                    value={motivoRechazo}
                    onChange={(e) => setMotivoRechazo(e.target.value)}
                    placeholder="Indique brevemente por qué no procede esta solicitud..."
                    className="w-full p-3.5 bg-white border border-rose-200 rounded-2xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 outline-none text-xs text-slate-800"
                  />
                </section>
              )}

              {(newStatus === 'Aprobada' || newStatus === 'Finalizada') && (
                <div className="px-3.5 py-2.5 bg-white rounded-2xl border border-slate-200/80 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span>Registro de auditoría</span>
                  <span className="font-semibold text-slate-800 truncate">
                    {userName || user?.email || 'Administración Central'}
                  </span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-white border-t border-slate-200/70 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setStatusModalItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={updatingStatus || (newStatus === 'Rechazada' && !motivoRechazo.trim())}
                onClick={handleSaveStatus}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors disabled:opacity-45 cursor-pointer whitespace-nowrap"
              >
                {updatingStatus ? 'Guardando...' : 'Guardar estado'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: REENVIAR / NOTIFICAR POR CORREO (ESTILO iOS)       */}
      {/* ========================================================= */}
      {resendEmailItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-md p-3 sm:p-5"
          onClick={() => setResendEmailItem(null)}
        >
          <div
            className="bg-[#F2F2F7] rounded-[28px] max-w-md w-full overflow-hidden shadow-2xl border border-slate-200/80 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-white border-b border-slate-200/70 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/12 text-emerald-600 flex items-center justify-center shrink-0">
                  <Send className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 tracking-tight truncate">
                    Enviar notificación
                  </h3>
                  <p className="text-xs text-slate-500 truncate">
                    <span className="font-mono font-semibold text-slate-700">{resendEmailItem.folio}</span> · {resendEmailItem.seccional_nombre}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setResendEmailItem(null)}
                aria-label="Cerrar"
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendEmailWithPdf}>
              <div className="p-4 sm:p-5 space-y-4 text-xs">
                {sendSuccessMsg ? (
                  <div className="bg-white rounded-2xl border border-emerald-200 p-5 text-center space-y-2">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/12 text-emerald-600 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <p className="font-semibold text-slate-900">{sendSuccessMsg}</p>
                  </div>
                ) : (
                  <>
                    {sendErrorMsg && (
                      <div className="bg-rose-50 border border-rose-200 rounded-2xl px-3.5 py-2.5 text-rose-700 text-xs font-medium">
                        {sendErrorMsg}
                      </div>
                    )}
                    <section className="space-y-1.5">
                      <label className="px-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Destinatario
                      </label>
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 space-y-2 shadow-2xs">
                        <input
                          type="email"
                          required
                          value={resendEmailTo}
                          onChange={(e) => setResendEmailTo(e.target.value)}
                          placeholder="correo@cruzverdesv.org"
                          className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none text-xs text-slate-900"
                        />
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Se enviará el resumen oficial junto al enlace directo al documento PDF.
                        </p>
                      </div>
                    </section>

                    <section className="space-y-1.5">
                      <span className="px-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Enlace del documento PDF
                      </span>
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-2xs">
                        <p className="font-mono text-[11px] text-slate-600 break-all select-all leading-relaxed">
                          {getOfficialSolicitudPdfUrl(resendEmailItem.tipo, resendEmailItem.folio)}
                        </p>
                      </div>
                    </section>
                  </>
                )}
              </div>

              <div className="px-5 py-3.5 bg-white border-t border-slate-200/70 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResendEmailItem(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  Cerrar
                </button>
                {!sendSuccessMsg && (
                  <button
                    type="submit"
                    disabled={sendingEmail || !resendEmailTo.trim()}
                    className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-45 cursor-pointer whitespace-nowrap"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{sendingEmail ? 'Enviando...' : 'Enviar correo'}</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: PDF DE COMBUSTIBLE                               */}
      {/* ========================================================= */}
      {canPreviewPdf && pdfCombustibleItem && (
        <CombustiblePdfModal
          solicitud={pdfCombustibleItem}
          config={combustibleConfig}
          onClose={() => setPdfCombustibleItem(null)}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL 4: PDF DE COMPRA Y MANTENIMIENTO                    */}
      {/* ========================================================= */}
      {canPreviewPdf && pdfCompraItem && (
        <CompraPdfPreviewModal
          solicitud={pdfCompraItem}
          config={compraConfig}
          onClose={() => setPdfCompraItem(null)}
        />
      )}

    </div>
  );
}
