import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, Plus, Search, Filter, Printer, Download, Mail, 
  CheckCircle2, Clock, AlertTriangle, XCircle, Truck, Building2, 
  User, Copy, Send, Check, Settings, AlertCircle, Eye, ChevronRight,
  DollarSign, Wrench, Shield, RefreshCw, X, MessageSquare, Info, Lock, Sliders,
  ChevronLeft, ShieldAlert, Paperclip, ExternalLink, Image as ImageIcon
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';
import { CompraConfig, DEFAULT_COMPRA_CONFIG } from '../types/compra';
import { isSolicitudRealizadaPorUsuario } from '../utils/solicitudFilter';
import CompraTemplateConfig from '../components/compra/CompraTemplateConfig';
import CompraPdfPreviewModal from '../components/compra/CompraPdfPreviewModal';
import CompraForm, { ArchivoCotizacion } from '../components/compra/CompraForm';
import { generarHtmlCorreoCompra } from '../lib/emailNotification';
import { sendEmailNotification } from '../lib/api';

export interface SolicitudCompra {
  id: number;
  folio: string;
  seccional_id?: number;
  seccional_nombre: string;
  solicitado_por: string;
  cargo: string;
  user_id?: string;
  user_email?: string;
  tipo_solicitud: string;
  es_para_vehiculo: boolean;
  vehiculo_id?: number;
  vehiculo_placa?: string;
  vehiculo_descripcion?: string;
  descripcion: string;
  monto_estimado?: number;
  proveedor_sugerido?: string;
  prioridad: 'Normal' | 'Urgente' | 'Emergencia';
  lugar_fecha: string;
  fecha_solicitud: string;
  hora_solicitud?: string;
  estado: 'Pendiente' | 'Aprobada' | 'En Proceso de Compra' | 'Rechazada' | 'Finalizada';
  autorizado_por?: string;
  fecha_autorizacion?: string;
  motivo_rechazo?: string;
  correo_enviado?: boolean;
  correos_notificados?: string;
  cotizaciones_archivos?: ArchivoCotizacion[];
  created_at?: string;
}

export interface VehiculoSimple {
  id: number;
  placa: string;
  marca: string;
  modelo: string;
  carroceria: string;
  seccional_id?: number;
  seccional_nombre?: string;
  millaje_actual?: number;
  unidad_distancia?: string;
}

const TIPOS_SOLICITUD = [
  'Repuestos para Vehículo',
  'Mantenimiento Preventivo de Vehículo',
  'Reparación Mecánica / Eléctrica Urgente',
  'Compra de Equipo y Material de Socorro / Médico',
  'Insumos y Suministros de Oficina',
  'Mantenimiento de Instalaciones de Seccional',
  'Combustible y Lubricantes',
  'Uniforme y Equipo de Protección Personal (EPP)',
  'Otro Servicio o Producto'
];

export default function SolicitudesCompra() {
  const navigate = useNavigate();
  const { user, userName, role, userSeccionalId, userSeccionalNombre, permissions, loading: authLoading } = useAuth();
  const isAdmin = role === 'admin';
  const hasNivelNacional = isAdmin || Boolean(permissions.ver_todas_seccionales);
  const isSeccionalOnly = !hasNivelNacional;
  const canApprove = isAdmin || permissions.aprobar_solicitudes_compra === true;

  // Estados principales
  const [solicitudes, setSolicitudes] = useState<SolicitudCompra[]>([]);
  const [seccionales, setSeccionales] = useState<{ id: number; nombre: string; director?: string; correo?: string }[]>([]);
  const [vehiculos, setVehiculos] = useState<VehiculoSimple[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbTableMissing, setDbTableMissing] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Navegación de vistas:
  // - Para los usuarios que no son admin (nivel seccional), al ingresar van directo al formulario ('nueva')
  // - El usuario admin o con el rol adecuado (nivel nacional) puede ver la tabla y su dashboard ('lista')
  const [activeTab, setActiveTab] = useState<'lista' | 'nueva' | 'plantillas'>(
    isAdmin || hasNivelNacional ? 'lista' : 'nueva'
  );

  // Sincronizar pestaña inicial una vez que el contexto de autenticación termina de cargar
  const initialResolvedRef = useRef(false);
  useEffect(() => {
    if (!authLoading && !initialResolvedRef.current) {
      initialResolvedRef.current = true;
      if (isAdmin || hasNivelNacional) {
        setActiveTab('lista');
      } else {
        setActiveTab('nueva');
      }
    }
  }, [authLoading, isAdmin, hasNivelNacional]);

  // Configuración completa de plantillas y PDF
  const [compraConfig, setCompraConfig] = useState<CompraConfig>(() => {
    const cached = localStorage.getItem('cruz_verde_compra_config');
    if (cached) {
      try {
        return { ...DEFAULT_COMPRA_CONFIG, ...JSON.parse(cached) };
      } catch (e) {
        console.warn('Error parsing cached compra config:', e);
      }
    }
    return DEFAULT_COMPRA_CONFIG;
  });
  const [savingCompraConfig, setSavingCompraConfig] = useState(false);
  const [showPreviewPdfModal, setShowPreviewPdfModal] = useState(false);
  const [previewPdfSolicitud, setPreviewPdfSolicitud] = useState<SolicitudCompra | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('Todos');
  const [filterSeccional, setFilterSeccional] = useState(isAdmin ? 'Todas' : (userSeccionalNombre || 'Todas'));
  const [filterTipo, setFilterTipo] = useState('Todos');

  // Formulario de Nueva Solicitud
  const [formData, setFormData] = useState({
    seccional_id: '',
    seccional_nombre: '',
    solicitado_por: '',
    cargo: 'Director',
    tipo_solicitud: 'Repuestos para Vehículo',
    es_para_vehiculo: true,
    vehiculo_id: '',
    vehiculo_placa: '',
    vehiculo_descripcion: '',
    descripcion: '',
    monto_estimado: '',
    proveedor_sugerido: '',
    prioridad: 'Normal' as 'Normal' | 'Urgente' | 'Emergencia',
    lugar: 'San Salvador',
    enviar_correo_ahora: true,
    correo_cc_extra: ''
  });

  const [submitting, setSubmitting] = useState(false);

  // Modales
  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudCompra | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  // Estado del modal de cambio de estado
  const [newStatus, setNewStatus] = useState<SolicitudCompra['estado']>('Aprobada');
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Configuración de correo y PDF (desde tabla configuracion o defaults)
  const [configParams, setConfigParams] = useState({
    correoDestino: 'administracion@cruzverdesv.org',
    correoRemitente: 'sistema@cruzverdesv.org',
    correoCcDefault: 'presidencia@cruzverdesv.org',
    asuntoPlantilla: 'Solicitud de Compra/Mantenimiento - [DIRECTOR] - Seccional [SECCIONAL] - [FECHA]',
    enviarCopiaSolicitante: true,
    pdfTitulo: 'CRUZ VERDE SALVADOREÑA',
    pdfDepartamento: 'DEPARTAMENTO ADMINISTRATIVO.',
    pdfSubtitulo: 'HOJA DE SOLICITUD DE COMPRA.',
    pdfWatermark: true,
    pdfWatermarkText: 'CRUZ VERDE SALVADOREÑA - DOCUMENTO OFICIAL',
    pdfWatermarkOpacity: '0.08',
    pdfMostrarUrgencia: true,
    pdfMostrarVehiculo: true,
    pdfMostrarCostos: true,
    pdfMostrarProveedor: true,
    pdfMostrarFechaHora: true,
    pdfFirma1Titulo: 'Firma: SOLICITANTE',
    pdfFirma1Subtitulo: 'Director de Seccional',
    pdfFirma2Titulo: 'Vo.Bo. Jefatura Administrativa',
    pdfFirma2Subtitulo: 'Administración Central',
    pdfFirma3Titulo: 'Autorizado Presidencia',
    pdfFirma3Subtitulo: 'Dirección General',
    pdfPiePagina: 'Este documento es de carácter oficial e institucional de Cruz Verde Salvadoreña.'
  });

  // Envío de correo en modal
  const [emailForm, setEmailForm] = useState({
    destinatario: '',
    remitente: '',
    cc: '',
    asunto: '',
    mensaje: '',
    enviando: false,
    enviadoExitoso: false
  });

  // Imprimir ref
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Fecha y hora formateada oficial de El Salvador (UTC-6)
  const getFechaHoraElSalvador = () => {
    const ahora = new Date();
    // Opciones para El Salvador
    const fechaStr = ahora.toLocaleDateString('es-SV', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/El_Salvador'
    });
    const horaStr = ahora.toLocaleTimeString('es-SV', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/El_Salvador'
    });
    return {
      completo: `San Salvador, ${fechaStr} (${horaStr})`,
      fechaTexto: fechaStr,
      horaTexto: horaStr,
      fechaIso: ahora.toISOString().split('T')[0]
    };
  };

  // Carga inicial de datos
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Cargar Seccionales con sus directores y correos
      const { data: secData, error: secErr } = await supabase
        .from('seccionales')
        .select('id, nombre, director, correo')
        .order('nombre');

      const loadedSeccs = (!secErr && secData) ? secData : [
        { id: 1, nombre: 'Santa Ana', director: 'Daniel Martinez', correo: 'santaana@cruzverdesv.org' },
        { id: 2, nombre: 'Santa Anita', director: 'Lic. Roberto Gómez', correo: 'santaanita@cruzverdesv.org' },
        { id: 3, nombre: 'San Salvador', director: 'Carlos Alvarado', correo: 'sansalvador@cruzverdesv.org' },
        { id: 4, nombre: 'Chalchuapa', director: 'Eduardo Ramos', correo: 'chalchuapa@cruzverdesv.org' },
        { id: 5, nombre: 'Soyapango', director: 'Roberto Gómez', correo: 'soyapango@cruzverdesv.org' },
        { id: 6, nombre: 'Apopa', director: 'Marcos Rivera', correo: 'apopa@cruzverdesv.org' }
      ];
      setSeccionales(loadedSeccs);

      // 2. Cargar Vehículos
      const { data: vehData, error: vehErr } = await supabase
        .from('vehiculos')
        .select('id, placa, marca, modelo, carroceria, seccional_id, millaje_actual, unidad_distancia');

      let loadedVehs: VehiculoSimple[] = [];
      if (!vehErr && vehData) {
        loadedVehs = vehData.map((v: any) => ({
          ...v,
          seccional_nombre: loadedSeccs.find(s => s.id === v.seccional_id)?.nombre || 'Sin seccional'
        }));
      } else {
        // Fallback local desde storage si la tabla aún no se ha ejecutado
        const localV = sessionStorage.getItem('cruz_verde_demo_vehiculos');
        if (localV) {
          try {
            loadedVehs = JSON.parse(localV);
          } catch (e) {}
        } else {
          loadedVehs = [
            { id: 1, placa: 'CVS-014', marca: 'Toyota', modelo: 'Land Cruiser HZJ78', carroceria: 'Ambulancia', seccional_id: loadedSeccs[0]?.id, millaje_actual: 34500, unidad_distancia: 'km' },
            { id: 2, placa: 'CVS-022', marca: 'Nissan', modelo: 'Urvan NV350', carroceria: 'Ambulancia', seccional_id: loadedSeccs[1]?.id, millaje_actual: 58200, unidad_distancia: 'km' },
            { id: 3, placa: 'P-445-912', marca: 'Toyota', modelo: 'Hilux 4x4', carroceria: 'Pick Up', seccional_id: loadedSeccs[0]?.id, millaje_actual: 91400, unidad_distancia: 'km' },
            { id: 4, placa: 'M-112-908', marca: 'Yamaha', modelo: 'XTZ 125', carroceria: 'Motocicleta', seccional_id: loadedSeccs[2]?.id, millaje_actual: 12400, unidad_distancia: 'km' }
          ];
        }
      }
      setVehiculos(loadedVehs);

      // 3. Cargar Parámetros de Configuración
      const { data: confData } = await supabase.from('configuracion').select('*');
      if (confData) {
        const confMap: any = {};
        confData.forEach(c => { confMap[c.clave] = c.valor; });
        setConfigParams(prev => ({
          correoDestino: confMap.solicitudes_correo_destino || prev.correoDestino,
          correoRemitente: confMap.solicitudes_correo_remitente || prev.correoRemitente,
          correoCcDefault: confMap.solicitudes_correo_cc || prev.correoCcDefault,
          asuntoPlantilla: confMap.solicitudes_asunto_plantilla || prev.asuntoPlantilla,
          enviarCopiaSolicitante: confMap.solicitudes_enviar_copia_solicitante !== 'false',
          pdfTitulo: confMap.solicitudes_pdf_titulo || prev.pdfTitulo,
          pdfDepartamento: confMap.solicitudes_pdf_departamento || prev.pdfDepartamento,
          pdfSubtitulo: confMap.solicitudes_pdf_subtitulo || prev.pdfSubtitulo,
          pdfWatermark: confMap.solicitudes_pdf_watermark !== 'false',
          pdfWatermarkText: confMap.solicitudes_pdf_watermark_text || prev.pdfWatermarkText,
          pdfWatermarkOpacity: confMap.solicitudes_pdf_watermark_opacity || prev.pdfWatermarkOpacity,
          pdfMostrarUrgencia: confMap.solicitudes_pdf_mostrar_urgencia !== 'false',
          pdfMostrarVehiculo: confMap.solicitudes_pdf_mostrar_vehiculo !== 'false',
          pdfMostrarCostos: confMap.solicitudes_pdf_mostrar_costos !== 'false',
          pdfMostrarProveedor: confMap.solicitudes_pdf_mostrar_proveedor !== 'false',
          pdfMostrarFechaHora: confMap.solicitudes_pdf_mostrar_fechahora !== 'false',
          pdfFirma1Titulo: confMap.solicitudes_pdf_firma1_titulo || prev.pdfFirma1Titulo,
          pdfFirma1Subtitulo: confMap.solicitudes_pdf_firma1_subtitulo || prev.pdfFirma1Subtitulo,
          pdfFirma2Titulo: confMap.solicitudes_pdf_firma2_titulo || prev.pdfFirma2Titulo,
          pdfFirma2Subtitulo: confMap.solicitudes_pdf_firma2_subtitulo || prev.pdfFirma2Subtitulo,
          pdfFirma3Titulo: confMap.solicitudes_pdf_firma3_titulo || prev.pdfFirma3Titulo,
          pdfFirma3Subtitulo: confMap.solicitudes_pdf_firma3_subtitulo || prev.pdfFirma3Subtitulo,
          pdfPiePagina: confMap.solicitudes_pdf_pie_pagina || prev.pdfPiePagina
        }));

        // Cargar bloques de configuración compra si existen
        let parsedBlocks = DEFAULT_COMPRA_CONFIG.pdfBloquesOrden;
        if (confMap.solicitudes_pdf_bloques_orden) {
          try {
            parsedBlocks = JSON.parse(confMap.solicitudes_pdf_bloques_orden);
          } catch (e) {
            console.warn('Error parsing stored bloques orden:', e);
          }
        }

        setCompraConfig(prev => ({
          ...prev,
          correoDestino: confMap.solicitudes_correo_destino || prev.correoDestino,
          correoRemitente: confMap.solicitudes_correo_remitente || prev.correoRemitente,
          correoCcDefault: confMap.solicitudes_correo_cc || prev.correoCcDefault,
          asuntoPlantilla: confMap.solicitudes_asunto_plantilla || prev.asuntoPlantilla,
          enviarCopiaSolicitante: confMap.solicitudes_enviar_copia_solicitante !== 'false',
          correoTitulo: confMap.solicitudes_correo_titulo || prev.correoTitulo,
          correoSubtitulo: confMap.solicitudes_correo_subtitulo || prev.correoSubtitulo,
          correoFooterTexto: confMap.solicitudes_correo_footer_texto || prev.correoFooterTexto,
          pdfTitulo: confMap.solicitudes_pdf_titulo || prev.pdfTitulo,
          pdfDepartamento: confMap.solicitudes_pdf_departamento || prev.pdfDepartamento,
          pdfSubtitulo: confMap.solicitudes_pdf_subtitulo || prev.pdfSubtitulo,
          pdfFontFamily: (confMap.solicitudes_pdf_font_family as any) || prev.pdfFontFamily,
          pdfFontSize: (confMap.solicitudes_pdf_font_size as any) || prev.pdfFontSize,
          pdfWatermark: confMap.solicitudes_pdf_watermark !== 'false',
          pdfWatermarkText: confMap.solicitudes_pdf_watermark_text || prev.pdfWatermarkText,
          pdfWatermarkOpacity: confMap.solicitudes_pdf_watermark_opacity || prev.pdfWatermarkOpacity,
          pdfPiePagina: confMap.solicitudes_pdf_pie_pagina || prev.pdfPiePagina,
          pdfMostrarLogo: confMap.solicitudes_pdf_mostrar_logo !== 'false',
          pdfLogoUrl: confMap.solicitudes_pdf_logo_url ?? prev.pdfLogoUrl,
          pdfLogoPosicion: (confMap.solicitudes_pdf_logo_posicion as any) || prev.pdfLogoPosicion,
          pdfLogoSize: (confMap.solicitudes_pdf_logo_size as any) || prev.pdfLogoSize,
          pdfMostrarLogoSecundario: confMap.solicitudes_pdf_mostrar_logo_secundario === 'true',
          pdfLogoSecundarioUrl: confMap.solicitudes_pdf_logo_secundario_url ?? prev.pdfLogoSecundarioUrl,
          pdfLogoSecundarioPosicion: (confMap.solicitudes_pdf_logo_secundario_posicion as any) || prev.pdfLogoSecundarioPosicion,
          pdfLogoSecundarioSize: (confMap.solicitudes_pdf_logo_secundario_size as any) || prev.pdfLogoSecundarioSize,
          pdfMostrarSello: confMap.solicitudes_pdf_mostrar_sello !== 'false',
          pdfMostrarSelloImg: confMap.solicitudes_pdf_mostrar_sello_img === 'true',
          pdfSelloImgUrl: confMap.solicitudes_pdf_sello_img_url ?? prev.pdfSelloImgUrl,
          pdfSelloImgPosicion: (confMap.solicitudes_pdf_sello_img_posicion as any) || prev.pdfSelloImgPosicion,
          pdfSelloImgSize: (confMap.solicitudes_pdf_sello_img_size as any) || prev.pdfSelloImgSize,
          pdfMostrarFooterImg: confMap.solicitudes_pdf_mostrar_footer_img === 'true',
          pdfFooterImgUrl: confMap.solicitudes_pdf_footer_img_url ?? prev.pdfFooterImgUrl,
          pdfFooterImgPosicion: (confMap.solicitudes_pdf_footer_img_posicion as any) || prev.pdfFooterImgPosicion,
          pdfFooterImgSize: (confMap.solicitudes_pdf_footer_img_size as any) || prev.pdfFooterImgSize,
          pdfSelloTextoSuperior: confMap.solicitudes_pdf_sello_texto_superior || prev.pdfSelloTextoSuperior,
          pdfSelloTextoInferior: confMap.solicitudes_pdf_sello_texto_inferior || prev.pdfSelloTextoInferior,
          pdfFirma1Titulo: confMap.solicitudes_pdf_firma1_titulo || prev.pdfFirma1Titulo,
          pdfFirma1Subtitulo: confMap.solicitudes_pdf_firma1_subtitulo || prev.pdfFirma1Subtitulo,
          pdfFirma2Titulo: confMap.solicitudes_pdf_firma2_titulo || prev.pdfFirma2Titulo,
          pdfFirma2Subtitulo: confMap.solicitudes_pdf_firma2_subtitulo || prev.pdfFirma2Subtitulo,
          pdfFirma3Titulo: confMap.solicitudes_pdf_firma3_titulo || prev.pdfFirma3Titulo,
          pdfFirma3Subtitulo: confMap.solicitudes_pdf_firma3_subtitulo || prev.pdfFirma3Subtitulo,
          pdfBloquesOrden: parsedBlocks
        }));
      }

      // 4. Cargar Solicitudes de Compra y Mantenimiento
      const { data: solData, error: solErr } = await supabase
        .from('solicitudes_compra')
        .select('*')
        .order('id', { ascending: false });

      // Verificación de columnas requeridas en el esquema
      const { error: schemaCheckErr } = await supabase
        .from('solicitudes_compra')
        .select('folio, cargo, descripcion')
        .limit(1);

      const tableIncomplete = !!solErr || !!schemaCheckErr;

      if (tableIncomplete) {
        setDbTableMissing(true);
        // Cargar desde sessionStorage
        const localSols = sessionStorage.getItem('cruz_verde_solicitudes_compra');
        if (localSols) {
          setSolicitudes(JSON.parse(localSols));
        } else {
          // Solicitud de ejemplo inicial idéntica a la fotografía del usuario
          const demoSol: SolicitudCompra[] = [
            {
              id: 1,
              folio: 'SC-2026-0001',
              seccional_id: loadedSeccs[0]?.id || 1,
              seccional_nombre: loadedSeccs[0]?.nombre || 'Santa Ana',
              solicitado_por: loadedSeccs[0]?.director || 'Daniel Martinez',
              cargo: 'Director',
              user_email: user?.email || 'director.santaana@cruzverdesv.org',
              tipo_solicitud: 'Repuestos para Vehículo',
              es_para_vehiculo: true,
              vehiculo_id: loadedVehs[0]?.id || 1,
              vehiculo_placa: 'CVS-014',
              vehiculo_descripcion: 'Toyota Land Cruiser HZJ78 (Ambulancia)',
              descripcion: 'Repuestos eq 231-145: Pastillas de frenos delanteros y traseros, kit de empaquetadura de bomba auxiliar de embrague y líquido DOT 4 para ambulancia institucional.',
              monto_estimado: 245.50,
              proveedor_sugerido: 'Repuestos Los Andes / Taller Central',
              prioridad: 'Urgente',
              lugar_fecha: 'San Salvador, 15 de agosto de 2025 (10:30 AM)',
              fecha_solicitud: '2025-08-15',
              hora_solicitud: '10:30 AM',
              estado: 'Pendiente',
              correo_enviado: true,
              correos_notificados: 'administracion@cruzverdesv.org, presidencia@cruzverdesv.org',
              created_at: new Date(Date.now() - 86400000).toISOString()
            }
          ];
          setSolicitudes(demoSol);
          sessionStorage.setItem('cruz_verde_solicitudes_compra', JSON.stringify(demoSol));
        }
      } else {
        let list = solData || [];
        if (!isAdmin) {
          list = list.filter(s => isSolicitudRealizadaPorUsuario(s, user, userName));
        }
        setSolicitudes(list);
        setDbTableMissing(false);
      }

    } catch (err) {
      console.error('Error cargando solicitudes:', err);
    } finally {
      setLoading(false);
    }
  };

  // Guardar configuración completa de plantillas de compras
  const handleSaveCompraConfig = async (newConfig: CompraConfig) => {
    setSavingCompraConfig(true);
    try {
      setCompraConfig(newConfig);
      localStorage.setItem('cruz_verde_compra_config', JSON.stringify(newConfig));

      // Actualizar también configParams para compatibilidad hacia atrás
      setConfigParams(prev => ({
        ...prev,
        correoDestino: newConfig.correoDestino,
        correoRemitente: newConfig.correoRemitente,
        correoCcDefault: newConfig.correoCcDefault,
        asuntoPlantilla: newConfig.asuntoPlantilla,
        enviarCopiaSolicitante: newConfig.enviarCopiaSolicitante,
        pdfTitulo: newConfig.pdfTitulo,
        pdfDepartamento: newConfig.pdfDepartamento,
        pdfSubtitulo: newConfig.pdfSubtitulo,
        pdfWatermark: newConfig.pdfWatermark,
        pdfWatermarkText: newConfig.pdfWatermarkText,
        pdfWatermarkOpacity: newConfig.pdfWatermarkOpacity,
        pdfPiePagina: newConfig.pdfPiePagina,
        pdfFirma1Titulo: newConfig.pdfFirma1Titulo,
        pdfFirma1Subtitulo: newConfig.pdfFirma1Subtitulo,
        pdfFirma2Titulo: newConfig.pdfFirma2Titulo,
        pdfFirma2Subtitulo: newConfig.pdfFirma2Subtitulo,
        pdfFirma3Titulo: newConfig.pdfFirma3Titulo,
        pdfFirma3Subtitulo: newConfig.pdfFirma3Subtitulo
      }));

      const entries = [
        { clave: 'solicitudes_correo_destino', valor: newConfig.correoDestino },
        { clave: 'solicitudes_correo_remitente', valor: newConfig.correoRemitente },
        { clave: 'solicitudes_correo_cc', valor: newConfig.correoCcDefault },
        { clave: 'solicitudes_asunto_plantilla', valor: newConfig.asuntoPlantilla },
        { clave: 'solicitudes_enviar_copia_solicitante', valor: String(newConfig.enviarCopiaSolicitante) },
        { clave: 'solicitudes_correo_titulo', valor: newConfig.correoTitulo },
        { clave: 'solicitudes_correo_subtitulo', valor: newConfig.correoSubtitulo },
        { clave: 'solicitudes_correo_footer_texto', valor: newConfig.correoFooterTexto },
        { clave: 'solicitudes_pdf_titulo', valor: newConfig.pdfTitulo },
        { clave: 'solicitudes_pdf_departamento', valor: newConfig.pdfDepartamento },
        { clave: 'solicitudes_pdf_subtitulo', valor: newConfig.pdfSubtitulo },
        { clave: 'solicitudes_pdf_font_family', valor: newConfig.pdfFontFamily },
        { clave: 'solicitudes_pdf_font_size', valor: newConfig.pdfFontSize },
        { clave: 'solicitudes_pdf_watermark', valor: String(newConfig.pdfWatermark) },
        { clave: 'solicitudes_pdf_watermark_text', valor: newConfig.pdfWatermarkText },
        { clave: 'solicitudes_pdf_watermark_opacity', valor: newConfig.pdfWatermarkOpacity },
        { clave: 'solicitudes_pdf_pie_pagina', valor: newConfig.pdfPiePagina },
        { clave: 'solicitudes_pdf_mostrar_logo', valor: String(newConfig.pdfMostrarLogo) },
        { clave: 'solicitudes_pdf_logo_url', valor: newConfig.pdfLogoUrl },
        { clave: 'solicitudes_pdf_logo_posicion', valor: newConfig.pdfLogoPosicion },
        { clave: 'solicitudes_pdf_logo_size', valor: newConfig.pdfLogoSize },
        { clave: 'solicitudes_pdf_mostrar_logo_secundario', valor: String(newConfig.pdfMostrarLogoSecundario) },
        { clave: 'solicitudes_pdf_logo_secundario_url', valor: newConfig.pdfLogoSecundarioUrl || '' },
        { clave: 'solicitudes_pdf_logo_secundario_posicion', valor: newConfig.pdfLogoSecundarioPosicion },
        { clave: 'solicitudes_pdf_logo_secundario_size', valor: newConfig.pdfLogoSecundarioSize },
        { clave: 'solicitudes_pdf_mostrar_sello', valor: String(newConfig.pdfMostrarSello) },
        { clave: 'solicitudes_pdf_mostrar_sello_img', valor: String(newConfig.pdfMostrarSelloImg) },
        { clave: 'solicitudes_pdf_sello_img_url', valor: newConfig.pdfSelloImgUrl || '' },
        { clave: 'solicitudes_pdf_sello_img_posicion', valor: newConfig.pdfSelloImgPosicion },
        { clave: 'solicitudes_pdf_sello_img_size', valor: newConfig.pdfSelloImgSize },
        { clave: 'solicitudes_pdf_mostrar_footer_img', valor: String(newConfig.pdfMostrarFooterImg) },
        { clave: 'solicitudes_pdf_footer_img_url', valor: newConfig.pdfFooterImgUrl || '' },
        { clave: 'solicitudes_pdf_footer_img_posicion', valor: newConfig.pdfFooterImgPosicion },
        { clave: 'solicitudes_pdf_footer_img_size', valor: newConfig.pdfFooterImgSize },
        { clave: 'solicitudes_pdf_sello_texto_superior', valor: newConfig.pdfSelloTextoSuperior },
        { clave: 'solicitudes_pdf_sello_texto_inferior', valor: newConfig.pdfSelloTextoInferior },
        { clave: 'solicitudes_pdf_firma1_titulo', valor: newConfig.pdfFirma1Titulo },
        { clave: 'solicitudes_pdf_firma1_subtitulo', valor: newConfig.pdfFirma1Subtitulo },
        { clave: 'solicitudes_pdf_firma2_titulo', valor: newConfig.pdfFirma2Titulo },
        { clave: 'solicitudes_pdf_firma2_subtitulo', valor: newConfig.pdfFirma2Subtitulo },
        { clave: 'solicitudes_pdf_firma3_titulo', valor: newConfig.pdfFirma3Titulo },
        { clave: 'solicitudes_pdf_firma3_subtitulo', valor: newConfig.pdfFirma3Subtitulo },
        { clave: 'solicitudes_pdf_bloques_orden', valor: JSON.stringify(newConfig.pdfBloquesOrden) }
      ];

      for (const item of entries) {
        await supabase
          .from('configuracion')
          .upsert(item, { onConflict: 'clave' });
      }

      await logActivity('Actualizó configuración de plantilla de compras/mantenimiento', 'Configuracion', 'plantilla_compras');
    } catch (err) {
      console.warn('Configuración de compras guardada localmente:', err);
    } finally {
      setSavingCompraConfig(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isAdmin, user?.email, user?.id, userName]);

  // Prellenar automáticamente el formulario según el usuario detectado
  useEffect(() => {
    if (seccionales.length === 0) return;

    let targetSec: any = null;

    if (!isAdmin && userSeccionalNombre) {
      // Buscar seccional del usuario no-admin
      targetSec = seccionales.find(s => 
        (userSeccionalId && s.id === userSeccionalId) || 
        s.nombre.toLowerCase() === userSeccionalNombre.toLowerCase()
      );
    }

    if (!targetSec) {
      targetSec = seccionales[0];
    }

    if (targetSec) {
      const infoFecha = getFechaHoraElSalvador();
      const vehsDeSec = vehiculos.filter(v => v.seccional_id === targetSec.id);

      setFormData(prev => ({
        ...prev,
        seccional_id: String(targetSec.id),
        seccional_nombre: targetSec.nombre,
        solicitado_por: targetSec.director || (userName && userName !== 'Usuario' ? userName : 'Director Seccional'),
        cargo: 'Director',
        lugar: 'San Salvador',
        vehiculo_id: vehsDeSec[0] ? String(vehsDeSec[0].id) : '',
        vehiculo_placa: vehsDeSec[0]?.placa || '',
        vehiculo_descripcion: vehsDeSec[0] ? `${vehsDeSec[0].marca} ${vehsDeSec[0].modelo} (${vehsDeSec[0].carroceria})` : ''
      }));
    }
  }, [seccionales, isAdmin, userSeccionalId, userSeccionalNombre, userName]);

  // Al cambiar la seccional en el formulario (solo permitido para Admin)
  const handleSeccionalChange = (secId: string) => {
    const sec = seccionales.find(s => String(s.id) === secId);
    if (!sec) return;

    const vehsDeSec = vehiculos.filter(v => v.seccional_id === sec.id);

    setFormData(prev => ({
      ...prev,
      seccional_id: String(sec.id),
      seccional_nombre: sec.nombre,
      solicitado_por: sec.director || 'Director Seccional',
      cargo: 'Director',
      vehiculo_id: vehsDeSec[0] ? String(vehsDeSec[0].id) : '',
      vehiculo_placa: vehsDeSec[0]?.placa || '',
      vehiculo_descripcion: vehsDeSec[0] ? `${vehsDeSec[0].marca} ${vehsDeSec[0].modelo} (${vehsDeSec[0].carroceria})` : ''
    }));
  };

  // Al cambiar el vehículo en el formulario
  const handleVehiculoChange = (vehId: string) => {
    if (!vehId) {
      setFormData(prev => ({
        ...prev,
        vehiculo_id: '',
        vehiculo_placa: '',
        vehiculo_descripcion: ''
      }));
      return;
    }

    const veh = vehiculos.find(v => String(v.id) === vehId);
    if (veh) {
      setFormData(prev => ({
        ...prev,
        vehiculo_id: String(veh.id),
        vehiculo_placa: veh.placa,
        vehiculo_descripcion: `${veh.marca} ${veh.modelo} (${veh.carroceria})`
      }));
    }
  };

  // Vehículos disponibles para el formulario (filtrados por la seccional elegida)
  const vehiculosDisponiblesParaForm = useMemo(() => {
    if (!formData.seccional_id) return [];
    return vehiculos.filter(v => String(v.seccional_id) === String(formData.seccional_id));
  }, [vehiculos, formData.seccional_id]);

  // Copiar script SQL
  const handleCopySql = () => {
    const sqlText = `-- ========================================================
-- Script de Solicitudes de Compra y Mantenimiento
-- Copie y pegue en el SQL Editor de Supabase:
-- ========================================================
DROP TABLE IF EXISTS public.solicitudes_compra CASCADE;

CREATE TABLE public.solicitudes_compra (
  id BIGSERIAL PRIMARY KEY,
  folio TEXT NOT NULL UNIQUE,
  seccional_id INTEGER REFERENCES public.seccionales(id) ON DELETE SET NULL,
  seccional_nombre TEXT NOT NULL,
  solicitado_por TEXT NOT NULL,
  cargo TEXT NOT NULL DEFAULT 'Director',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  tipo_solicitud TEXT NOT NULL DEFAULT 'Repuestos para Vehículo',
  es_para_vehiculo BOOLEAN DEFAULT FALSE,
  vehiculo_id BIGINT REFERENCES public.vehiculos(id) ON DELETE SET NULL,
  vehiculo_placa TEXT,
  vehiculo_descripcion TEXT,
  descripcion TEXT NOT NULL,
  monto_estimado NUMERIC(12, 2),
  proveedor_sugerido TEXT,
  prioridad TEXT NOT NULL DEFAULT 'Normal',
  lugar_fecha TEXT NOT NULL,
  fecha_solicitud DATE DEFAULT CURRENT_DATE,
  hora_solicitud TEXT,
  estado TEXT NOT NULL DEFAULT 'Pendiente',
  autorizado_por TEXT,
  fecha_autorizacion TIMESTAMPTZ,
  motivo_rechazo TEXT,
  correo_enviado BOOLEAN DEFAULT FALSE,
  correos_notificados TEXT,
  cotizaciones_archivos JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de búsqueda
CREATE INDEX IF NOT EXISTS idx_solicitudes_seccional ON public.solicitudes_compra(seccional_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_vehiculo ON public.solicitudes_compra(vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON public.solicitudes_compra(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_fecha ON public.solicitudes_compra(fecha_solicitud);
CREATE INDEX IF NOT EXISTS idx_solicitudes_folio ON public.solicitudes_compra(folio);

-- Habilitar RLS con permisos de lectura y escritura
ALTER TABLE public.solicitudes_compra ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura solicitudes_compra" ON public.solicitudes_compra;
CREATE POLICY "Permitir lectura solicitudes_compra" ON public.solicitudes_compra FOR SELECT USING (true);
DROP POLICY IF EXISTS "Permitir insercion solicitudes_compra" ON public.solicitudes_compra;
CREATE POLICY "Permitir insercion solicitudes_compra" ON public.solicitudes_compra FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Permitir actualizacion solicitudes_compra" ON public.solicitudes_compra;
CREATE POLICY "Permitir actualizacion solicitudes_compra" ON public.solicitudes_compra FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Permitir eliminacion solicitudes_compra" ON public.solicitudes_compra;
CREATE POLICY "Permitir eliminacion solicitudes_compra" ON public.solicitudes_compra FOR DELETE USING (true);

NOTIFY pgrst, 'reload schema';`;

    navigator.clipboard.writeText(sqlText);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  // Crear y guardar la Solicitud
  const handleSubmitSolicitud = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.descripcion.trim()) {
      alert('Por favor ingrese la descripción detallada del servicio o producto a adquirir.');
      return;
    }

    if (!formData.solicitado_por.trim()) {
      alert('El nombre del solicitante (Director) es requerido.');
      return;
    }

    setSubmitting(true);
    try {
      const infoFecha = getFechaHoraElSalvador();
      const lugarFechaStr = `${formData.lugar}, ${infoFecha.fechaTexto} (${infoFecha.horaTexto})`;

      // Generar Folio
      const year = new Date().getFullYear();
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const folioGenerado = `SC-${year}-${randomNum}`;

      // Armar lista de correos a notificar
      const correosArr: string[] = [configParams.correoDestino];
      if (configParams.correoCcDefault) correosArr.push(configParams.correoCcDefault);
      if (formData.enviar_correo_ahora && user?.email && configParams.enviarCopiaSolicitante) {
        correosArr.push(user.email);
      }
      if (formData.correo_cc_extra.trim()) {
        formData.correo_cc_extra.split(',').forEach(c => {
          const trimmed = c.trim();
          if (trimmed && !correosArr.includes(trimmed)) correosArr.push(trimmed);
        });
      }

      const payload = {
        folio: folioGenerado,
        seccional_id: formData.seccional_id ? parseInt(formData.seccional_id) : null,
        seccional_nombre: formData.seccional_nombre || 'Seccional Central',
        solicitado_por: formData.solicitado_por.trim(),
        cargo: formData.cargo.trim() || 'Director',
        user_id: user?.id || null,
        user_email: user?.email || null,
        tipo_solicitud: formData.tipo_solicitud,
        es_para_vehiculo: formData.es_para_vehiculo,
        vehiculo_id: (formData.es_para_vehiculo && formData.vehiculo_id) ? parseInt(formData.vehiculo_id) : null,
        vehiculo_placa: formData.es_para_vehiculo ? (formData.vehiculo_placa || null) : null,
        vehiculo_descripcion: formData.es_para_vehiculo ? (formData.vehiculo_descripcion || null) : null,
        descripcion: formData.descripcion.trim(),
        monto_estimado: formData.monto_estimado ? parseFloat(formData.monto_estimado) : null,
        proveedor_sugerido: formData.proveedor_sugerido.trim() || null,
        prioridad: formData.prioridad,
        lugar_fecha: lugarFechaStr,
        fecha_solicitud: infoFecha.fechaIso,
        hora_solicitud: infoFecha.horaTexto,
        estado: 'Pendiente' as const,
        correo_enviado: formData.enviar_correo_ahora,
        correos_notificados: correosArr.join(', ')
      };

      if (dbTableMissing) {
        // Guardado local
        const newRecord: SolicitudCompra = {
          id: Date.now(),
          ...payload,
          created_at: new Date().toISOString()
        };
        const updatedList = [newRecord, ...solicitudes];
        setSolicitudes(updatedList);
        sessionStorage.setItem('cruz_verde_solicitudes_compra', JSON.stringify(updatedList));
      } else {
        const { error: insErr } = await supabase
          .from('solicitudes_compra')
          .insert([payload]);

        if (insErr) {
          console.warn('Error al insertar en Supabase (posible esquema incompleto):', insErr);
          setDbTableMissing(true);
          const newRecord: SolicitudCompra = {
            id: Date.now(),
            ...payload,
            created_at: new Date().toISOString()
          };
          const updatedList = [newRecord, ...solicitudes];
          setSolicitudes(updatedList);
          sessionStorage.setItem('cruz_verde_solicitudes_compra', JSON.stringify(updatedList));
          alert(`La solicitud ${folioGenerado} fue guardada localmente. La tabla en Supabase requiere ejecutar el script de actualización para guardar en la nube. Use el botón "Copiar Script SQL" en el banner superior.`);
        } else {
          await fetchData();
        }
      }

      await logActivity('Creó solicitud de compra/mantenimiento', 'SolicitudCompra', folioGenerado, {
        seccional: formData.seccional_nombre,
        solicitante: formData.solicitado_por,
        tipo: formData.tipo_solicitud,
        vehiculo: formData.vehiculo_placa
      });

      // Enviar notificación automática por correo SMTP si hay destinatarios configurados
      if (correosArr.length > 0) {
        try {
          const htmlEmail = generarHtmlCorreoCompra({
            folio: folioGenerado,
            seccional: formData.seccional_nombre || 'Seccional Central',
            solicitante: formData.solicitado_por,
            cargoSolicitante: formData.cargo,
            tipo: formData.tipo_solicitud,
            esParaVehiculo: formData.es_para_vehiculo,
            vehiculoPlaca: formData.vehiculo_placa,
            vehiculoDescripcion: formData.vehiculo_descripcion,
            justificacion: formData.descripcion,
            proveedorSugerido: formData.proveedor_sugerido,
            items: [{
              descripcion: formData.descripcion,
              cantidad: 1,
              precioEstimado: formData.monto_estimado ? parseFloat(formData.monto_estimado) : undefined,
              subtotal: formData.monto_estimado ? parseFloat(formData.monto_estimado) : undefined
            }],
            totalEstimado: formData.monto_estimado ? parseFloat(formData.monto_estimado) : 0,
            nombreArchivoPdf: `${folioGenerado}.pdf`
          });

          await sendEmailNotification({
            destinatario: correosArr.join(', '),
            asunto: `Solicitud de Compra: ${folioGenerado} - ${formData.seccional_nombre || 'Cruz Verde'}`,
            cuerpoHtml: htmlEmail,
            tipo: 'solicitud_compra',
            remitente: 'Cruz Verde Salvadoreña (No Responder) <notificaciones@cruzverdesv.org>'
          });
        } catch (mailErr) {
          console.warn('[COMPRA] Aviso al enviar correo automático:', mailErr);
        }
      }

      // Limpiar formulario y pasar a lista
      setFormData(prev => ({
        ...prev,
        descripcion: '',
        monto_estimado: '',
        proveedor_sugerido: '',
        correo_cc_extra: ''
      }));

      setActiveTab('lista');
      alert(`¡Solicitud ${folioGenerado} registrada con éxito! Puede imprimir el PDF o revisar el estado en el historial.`);

    } catch (err: any) {
      console.error('Error guardando solicitud:', err);
      alert(`Error al registrar la solicitud: ${err.message || 'Error desconocido'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Crear solicitud desde el formulario limpio y simplificado CompraForm
  const handleCrearCompraFromForm = async (payloadData: {
    seccional_id?: number;
    seccional_nombre: string;
    solicitado_por: string;
    cargo: string;
    tipo_solicitud: string;
    es_para_vehiculo: boolean;
    vehiculo_id?: number | null;
    vehiculo_placa?: string | null;
    vehiculo_descripcion?: string | null;
    descripcion: string;
    monto_estimado?: number | null;
    proveedor_sugerido?: string | null;
    prioridad: 'Normal' | 'Urgente' | 'Emergencia';
    cotizaciones_archivos?: ArchivoCotizacion[];
  }) => {
    setSubmitting(true);
    try {
      const infoFecha = getFechaHoraElSalvador();
      const lugarFechaStr = `San Salvador, ${infoFecha.fechaTexto} (${infoFecha.horaTexto})`;

      // Generar Folio institucional
      const year = new Date().getFullYear();
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const folioGenerado = `SC-${year}-${randomNum}`;

      // Armar lista de correos a notificar
      const correosArr: string[] = [configParams.correoDestino];
      if (configParams.correoCcDefault) correosArr.push(configParams.correoCcDefault);
      if (user?.email && configParams.enviarCopiaSolicitante) {
        correosArr.push(user.email);
      }

      const payload = {
        folio: folioGenerado,
        seccional_id: payloadData.seccional_id || null,
        seccional_nombre: payloadData.seccional_nombre || 'Seccional',
        solicitado_por: payloadData.solicitado_por.trim(),
        cargo: payloadData.cargo.trim() || 'Motorista',
        user_id: user?.id || null,
        user_email: user?.email || null,
        tipo_solicitud: payloadData.tipo_solicitud,
        es_para_vehiculo: payloadData.es_para_vehiculo,
        vehiculo_id: payloadData.vehiculo_id || null,
        vehiculo_placa: payloadData.vehiculo_placa || null,
        vehiculo_descripcion: payloadData.vehiculo_descripcion || null,
        descripcion: payloadData.descripcion.trim(),
        monto_estimado: payloadData.monto_estimado || null,
        proveedor_sugerido: payloadData.proveedor_sugerido?.trim() || null,
        prioridad: payloadData.prioridad,
        lugar_fecha: lugarFechaStr,
        fecha_solicitud: infoFecha.fechaIso,
        hora_solicitud: infoFecha.horaTexto,
        estado: 'Pendiente' as const,
        correo_enviado: true,
        correos_notificados: correosArr.join(', '),
        cotizaciones_archivos: payloadData.cotizaciones_archivos || []
      };

      if (dbTableMissing) {
        const newRecord: SolicitudCompra = {
          id: Date.now(),
          ...payload,
          created_at: new Date().toISOString()
        };
        const updatedList = [newRecord, ...solicitudes];
        setSolicitudes(updatedList);
        sessionStorage.setItem('cruz_verde_solicitudes_compra', JSON.stringify(updatedList));
      } else {
        let { error: insErr } = await supabase
          .from('solicitudes_compra')
          .insert([payload]);

        // Si la columna cotizaciones_archivos aún no ha sido creada con el script SQL en Supabase, reintentar sin ella para no fallar
        if (insErr && (insErr.message?.includes('cotizaciones_archivos') || insErr.code === '42703')) {
          console.warn('Columna cotizaciones_archivos no detectada en Supabase, guardando campos principales...');
          const { cotizaciones_archivos, ...payloadSinAdjuntos } = payload;
          const retry = await supabase.from('solicitudes_compra').insert([payloadSinAdjuntos]);
          insErr = retry.error;
        }

        if (insErr) {
          console.warn('Error al insertar en Supabase (modo fallback local):', insErr);
          setDbTableMissing(true);
          const newRecord: SolicitudCompra = {
            id: Date.now(),
            ...payload,
            created_at: new Date().toISOString()
          };
          const updatedList = [newRecord, ...solicitudes];
          setSolicitudes(updatedList);
          sessionStorage.setItem('cruz_verde_solicitudes_compra', JSON.stringify(updatedList));
        } else {
          await fetchData();
        }
      }

      await logActivity('Creó solicitud de compra/mantenimiento', 'SolicitudCompra', folioGenerado, {
        seccional: payloadData.seccional_nombre,
        solicitante: payloadData.solicitado_por,
        tipo: payloadData.tipo_solicitud,
        vehiculo: payloadData.vehiculo_placa
      });

      // Enviar notificación automática por correo SMTP si hay destinatarios configurados
      if (correosArr.length > 0) {
        try {
          const htmlEmail = generarHtmlCorreoCompra({
            folio: folioGenerado,
            seccional: payloadData.seccional_nombre || 'Seccional Central',
            solicitante: payloadData.solicitado_por,
            cargoSolicitante: payloadData.cargo,
            tipo: payloadData.tipo_solicitud,
            esParaVehiculo: payloadData.es_para_vehiculo,
            vehiculoPlaca: payloadData.vehiculo_placa,
            vehiculoDescripcion: payloadData.vehiculo_descripcion,
            justificacion: payloadData.descripcion,
            proveedorSugerido: payloadData.proveedor_sugerido,
            items: ((payloadData as any).items || []).map((it: any) => ({
              descripcion: it.descripcion,
              cantidad: Number(it.cantidad) || 1,
              unidad: it.unidad,
              precioEstimado: Number(it.precio_estimado) || undefined,
              subtotal: Number(it.subtotal) || undefined
            })),
            totalEstimado: payloadData.monto_estimado || 0,
            nombreArchivoPdf: `${folioGenerado}.pdf`
          });

          await sendEmailNotification({
            destinatario: correosArr.join(', '),
            asunto: `Solicitud de Compra: ${folioGenerado} - ${payloadData.seccional_nombre || 'Cruz Verde'}`,
            cuerpoHtml: htmlEmail,
            tipo: 'solicitud_compra',
            remitente: 'Cruz Verde Salvadoreña (No Responder) <notificaciones@cruzverdesv.org>'
          });
        } catch (mailErr) {
          console.warn('[COMPRA] Aviso al enviar correo automático:', mailErr);
        }
      }

      alert(`¡Solicitud ${folioGenerado} registrada con éxito! Ha sido enviada al Área Administrativa.`);

      setActiveTab('lista');
    } catch (err: any) {
      console.error('Error guardando solicitud:', err);
      alert(`Error al registrar la solicitud: ${err.message || 'Error desconocido'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Abrir Modal de Envío de Correo
  const handleOpenEmailModal = (sol: SolicitudCompra) => {
    setSelectedSolicitud(sol);

    // Formatear asunto con la plantilla de configuración
    let asuntoParsed = configParams.asuntoPlantilla
      .replace('[DIRECTOR]', sol.solicitado_por)
      .replace('[SECCIONAL]', sol.seccional_nombre)
      .replace('[FECHA]', sol.fecha_solicitud)
      .replace('[FOLIO]', sol.folio)
      .replace('[PLACA]', sol.vehiculo_placa || 'N/A');

    const cuerpoMensaje = `Estimado Departamento Administrativo de Cruz Verde Salvadoreña,

Por medio de la presente, la Seccional ${sol.seccional_nombre} a través de su Director ${sol.solicitado_por} remite la solicitud formal ${sol.folio}:

• Dependencia / Seccional: ${sol.seccional_nombre}
• Solicitado por: ${sol.solicitado_por} (${sol.cargo})
• Tipo de Adquisición: ${sol.tipo_solicitud}
${sol.vehiculo_placa ? `• Unidad Vehicular: Placa ${sol.vehiculo_placa} - ${sol.vehiculo_descripcion || ''}\n` : ''}• Prioridad: ${sol.prioridad}
• Lugar y Fecha: ${sol.lugar_fecha}
• Monto estimado: ${sol.monto_estimado ? `$${sol.monto_estimado.toFixed(2)} USD` : 'Por cotizar'}

DESCRIPCIÓN DEL REQUERIMIENTO:
${sol.descripcion}

${sol.proveedor_sugerido ? `Proveedor sugerido: ${sol.proveedor_sugerido}\n` : ''}
Se adjunta el presente requerimiento para su debida autorización y gestión de compra correspondiente.

Atentamente,
${sol.solicitado_por}
${sol.cargo} - Seccional ${sol.seccional_nombre}
Cruz Verde Salvadoreña`;

    setEmailForm({
      destinatario: configParams.correoDestino,
      remitente: user?.email || configParams.correoRemitente,
      cc: configParams.correoCcDefault ? `${configParams.correoCcDefault}${sol.user_email ? `, ${sol.user_email}` : ''}` : (sol.user_email || ''),
      asunto: asuntoParsed,
      mensaje: cuerpoMensaje,
      enviando: false,
      enviadoExitoso: false
    });

    setShowEmailModal(true);
  };

  // Enviar correo (Simulación realista con registro de notificación)
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSolicitud) return;

    setEmailForm(prev => ({ ...prev, enviando: true }));

    try {
      const pdfFileName = `Solicitud_Compra_${selectedSolicitud.folio}.pdf`;
      const htmlEmail = generarHtmlCorreoCompra({
        remitenteNombre: 'Cruz Verde Salvadoreña (No Responder)',
        remitenteCorreo: 'no-reply@cruzverdesv.org',
        destinatarioCorreo: emailForm.destinatario,
        destinatarioNombre: 'Departamento Administrativo',
        asunto: emailForm.asunto,
        seccionalNombre: selectedSolicitud.seccional_nombre,
        numeroSolicitud: selectedSolicitud.folio
      }, {
        numeroSolicitud: selectedSolicitud.folio,
        fecha: selectedSolicitud.fecha_solicitud || selectedSolicitud.lugar_fecha || new Date().toLocaleDateString('es-SV'),
        seccional: selectedSolicitud.seccional_nombre,
        solicitante: selectedSolicitud.solicitado_por,
        director: selectedSolicitud.solicitado_por,
        vehiculoOEquipo: selectedSolicitud.vehiculo_placa ? `${selectedSolicitud.vehiculo_placa} - ${selectedSolicitud.vehiculo_descripcion || ''}` : undefined,
        urgencia: (selectedSolicitud.prioridad as any) || 'Media',
        justificacion: selectedSolicitud.descripcion,
        proveedorSugerido: selectedSolicitud.proveedor_sugerido,
        items: ((selectedSolicitud as any).items || [{
          descripcion: selectedSolicitud.descripcion,
          cantidad: 1,
          precioEstimado: selectedSolicitud.monto_estimado,
          subtotal: selectedSolicitud.monto_estimado
        }]).map((it: any) => ({
          descripcion: it.descripcion,
          cantidad: Number(it.cantidad) || 1,
          unidad: it.unidad,
          precioEstimado: Number(it.precio_estimado) || undefined,
          subtotal: Number(it.subtotal) || undefined
        })),
        totalEstimado: Number(selectedSolicitud.monto_estimado) || 0,
        nombreArchivoPdf: pdfFileName
      });

      // Despacho vía servicio SMTP (Hostinger / Servidor)
      try {
        await sendEmailNotification({
          remitente: 'Cruz Verde Salvadoreña (No Responder) <notificaciones@cruzverdesv.org>',
          destinatario: emailForm.destinatario,
          cc: emailForm.cc,
          asunto: emailForm.asunto,
          cuerpoHtml: htmlEmail,
          tipo: 'solicitud_compra',
          nombreArchivoPdf: pdfFileName
        });
      } catch (errApi) {
        console.warn('Aviso de envío por SMTP:', errApi);
      }

      // Delay visual de envío
      await new Promise(res => setTimeout(res, 800));

      const updatedNotificados = `${selectedSolicitud.correos_notificados ? selectedSolicitud.correos_notificados + ', ' : ''}${emailForm.destinatario}`;

      if (dbTableMissing) {
        const updatedSols = solicitudes.map(s => s.id === selectedSolicitud.id ? {
          ...s,
          correo_enviado: true,
          correos_notificados: updatedNotificados
        } : s);
        setSolicitudes(updatedSols);
        sessionStorage.setItem('cruz_verde_solicitudes_compra', JSON.stringify(updatedSols));
      } else {
        await supabase
          .from('solicitudes_compra')
          .update({
            correo_enviado: true,
            correos_notificados: updatedNotificados,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedSolicitud.id);
        
        await fetchData();
      }

      await logActivity('Envió correo de notificación de solicitud', 'SolicitudCompra', selectedSolicitud.folio, {
        destinatario: emailForm.destinatario,
        cc: emailForm.cc,
        asunto: emailForm.asunto
      });

      setEmailForm(prev => ({ ...prev, enviando: false, enviadoExitoso: true }));
      setTimeout(() => {
        setShowEmailModal(false);
      }, 1800);

    } catch (err: any) {
      console.error('Error enviando correo:', err);
      alert(`Error al enviar notificación: ${err.message || 'Error de red'}`);
      setEmailForm(prev => ({ ...prev, enviando: false }));
    }
  };

  // Cambiar Estado / Autorizar Solicitud (Solo Administradores o Autorizados)
  const handleUpdateStatus = async () => {
    if (!selectedSolicitud) return;

    setUpdatingStatus(true);
    try {
      const payload: any = {
        estado: newStatus,
        updated_at: new Date().toISOString()
      };

      if (newStatus === 'Aprobada') {
        payload.autorizado_por = userName || user?.email || 'Departamento Administrativo';
        payload.fecha_autorizacion = new Date().toISOString();
        payload.motivo_rechazo = null;
      } else if (newStatus === 'Rechazada') {
        payload.motivo_rechazo = motivoRechazo.trim() || 'No especificado';
      }

      if (dbTableMissing) {
        const updatedSols = solicitudes.map(s => s.id === selectedSolicitud.id ? {
          ...s,
          ...payload
        } : s);
        setSolicitudes(updatedSols);
        sessionStorage.setItem('cruz_verde_solicitudes_compra', JSON.stringify(updatedSols));
      } else {
        const { error: updErr } = await supabase
          .from('solicitudes_compra')
          .update(payload)
          .eq('id', selectedSolicitud.id);

        if (updErr) throw updErr;
        await fetchData();
      }

      await logActivity(`Cambió estado de solicitud a ${newStatus}`, 'SolicitudCompra', selectedSolicitud.folio, {
        estado: newStatus,
        autorizado_por: payload.autorizado_por
      });

      setShowStatusModal(false);
      setShowDetailModal(false);
      alert(`El estado de la solicitud ${selectedSolicitud.folio} se actualizó a: ${newStatus}`);

    } catch (err: any) {
      console.error('Error actualizando estado:', err);
      alert(`Error al actualizar estado: ${err.message || 'Error desconocido'}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Disparar Impresión de PDF
  const handleTriggerPrint = (sol: SolicitudCompra) => {
    setSelectedSolicitud(sol);
    setShowPrintModal(true);
  };

  const executePrint = () => {
    window.print();
  };

  // Filtrado de solicitudes en la tabla
  const filteredSolicitudes = useMemo(() => {
    return solicitudes.filter(s => {
      // Si el usuario no es admin, solo puede ver las solicitudes que ha realizado
      if (!isAdmin && !isSolicitudRealizadaPorUsuario(s, user, userName)) {
        return false;
      }

      const search = searchTerm.toLowerCase().trim();
      const matchesSearch = !search ||
        s.folio.toLowerCase().includes(search) ||
        s.seccional_nombre.toLowerCase().includes(search) ||
        s.solicitado_por.toLowerCase().includes(search) ||
        s.descripcion.toLowerCase().includes(search) ||
        (s.vehiculo_placa && s.vehiculo_placa.toLowerCase().includes(search));

      const matchesEstado = filterEstado === 'Todos' || s.estado === filterEstado;

      let matchesSeccional = true;
      if (!isAdmin && userSeccionalNombre) {
        matchesSeccional = s.seccional_nombre === userSeccionalNombre || (userSeccionalId ? s.seccional_id === userSeccionalId : false);
      } else {
        matchesSeccional = filterSeccional === 'Todas' || s.seccional_nombre === filterSeccional;
      }

      const matchesTipo = filterTipo === 'Todos' || s.tipo_solicitud === filterTipo;

      return matchesSearch && matchesEstado && matchesSeccional && matchesTipo;
    });
  }, [solicitudes, searchTerm, filterEstado, filterSeccional, filterTipo, isAdmin, userSeccionalNombre, userSeccionalId, user, userName]);

  // Contadores de resumen
  const stats = useMemo(() => {
    let pendientes = 0;
    let aprobadas = 0;
    let enProceso = 0;
    let rechazadas = 0;

    solicitudes.forEach(s => {
      if (s.estado === 'Pendiente') pendientes++;
      if (s.estado === 'Aprobada') aprobadas++;
      if (s.estado === 'En Proceso de Compra') enProceso++;
      if (s.estado === 'Rechazada') rechazadas++;
    });

    return {
      total: solicitudes.length,
      pendientes,
      aprobadas,
      enProceso,
      rechazadas
    };
  }, [solicitudes]);

  // Render badge de estado
  const renderEstadoBadge = (estado: SolicitudCompra['estado']) => {
    switch (estado) {
      case 'Pendiente':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 mr-1" /> Pendiente
          </span>
        );
      case 'Aprobada':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Aprobada
          </span>
        );
      case 'En Proceso de Compra':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <DollarSign className="w-3 h-3 mr-1" /> En Proceso
          </span>
        );
      case 'Rechazada':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
            <XCircle className="w-3 h-3 mr-1" /> Rechazada
          </span>
        );
      case 'Finalizada':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
            <Check className="w-3 h-3 mr-1" /> Finalizada
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto pb-16">
      
      {/* Encabezado Principal con Botón Regresar al Menú y Pestañas */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/solicitudes')}
            className="inline-flex items-center px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer mr-1"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Regresar al Menú
          </button>

          <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
            <FileText className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                Solicitud de Compra y Mantenimiento
              </h1>
              {isSeccionalOnly && userSeccionalNombre && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  {userSeccionalNombre}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              Departamento Administrativo • Formulario oficial de requerimiento institucional
            </p>
          </div>
        </div>

        {/* Selector de pestañas y Acciones Principales */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 bg-gray-100 p-1 rounded-xl">
            {!isAdmin ? (
              <>
                <button
                  onClick={() => setActiveTab('nueva')}
                  className={`inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'nueva'
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Formulario
                </button>
                <button
                  onClick={() => setActiveTab('lista')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'lista'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Mis Solicitudes ({solicitudes.length})
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setActiveTab('lista')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'lista'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Historial y Dashboard ({solicitudes.length})
                </button>
                <button
                  onClick={() => setActiveTab('nueva')}
                  className={`inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'nueva'
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Formulario
                </button>
                {!isSeccionalOnly && (
                  <button
                    onClick={() => setActiveTab('plantillas')}
                    className={`inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === 'plantillas'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5 mr-1" />
                    Plantillas y Configuración
                  </button>
                )}
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              const sol = selectedSolicitud || (solicitudes.length > 0 ? solicitudes[0] : null);
              setPreviewPdfSolicitud(sol);
              setShowPreviewPdfModal(true);
            }}
            className="inline-flex items-center px-3.5 py-2 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 rounded-xl text-xs font-bold transition shadow-2xs"
            title="Previsualizar el formato oficial PDF con logotipo y bloques actuales"
          >
            <Eye className="w-3.5 h-3.5 mr-1.5 text-emerald-700" />
            Previsualizar PDF
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VISTA 1: FORMULARIO DE SOLICITUD SIMPLIFICADO (ESTILO COMBUSTIBLE)        */}
      {/* ========================================================================= */}
      {activeTab === 'nueva' && (
        <CompraForm
          seccionales={seccionales}
          vehiculos={vehiculos}
          isAdmin={isAdmin}
          userSeccionalNombre={userSeccionalNombre}
          userSeccionalId={userSeccionalId}
          submitting={submitting}
          onSubmit={handleCrearCompraFromForm}
        />
      )}

      {/* ========================================================================= */}
      {/* VISTA 2: TABLA DE HISTORIAL Y SEGUIMIENTO (DASHBOARD O MIS SOLICITUDES)  */}
      {/* ========================================================================= */}
      {activeTab === 'lista' && (
        <div className="space-y-4">
          
          {/* Banner de Ayuda Supabase si la tabla aún no existe (Solo Administrador) */}
          {dbTableMissing && isAdmin && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold text-amber-900">
                    Tabla <code className="bg-amber-100 px-1 py-0.5 rounded">solicitudes_compra</code> pendiente de ejecutar en Supabase
                  </h4>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Para sincronización permanente, ejecute el script <span className="font-semibold">15_solicitudes_compra_mantenimiento.sql</span> en el SQL Editor de Supabase. El sistema está operando en modo local para que pueda interactuar y probar la creación de solicitudes y generación de PDF de inmediato.
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 flex-shrink-0">
                <button
                  onClick={handleCopySql}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-md transition-colors shadow-2xs"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  {copiedSql ? 'Copiado' : 'Copiar SQL'}
                </button>
                <button
                  onClick={fetchData}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium border border-amber-300 text-amber-800 bg-white hover:bg-amber-100 rounded-md transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  Reintentar
                </button>
              </div>
            </div>
          )}

          {/* Tarjetas de Métricas Rápidas */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Solicitudes</span>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
              <span className="text-xs text-gray-400">Registradas en sistema</span>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">Pendientes</span>
              <p className="text-2xl font-bold text-amber-700 mt-1">{stats.pendientes}</p>
              <span className="text-xs text-amber-600">Por autorizar</span>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-green-700">Aprobadas</span>
              <p className="text-2xl font-bold text-green-700 mt-1">{stats.aprobadas}</p>
              <span className="text-xs text-green-600">Con visto bueno</span>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">En Proceso</span>
              <p className="text-2xl font-bold text-blue-700 mt-1">{stats.enProceso}</p>
              <span className="text-xs text-blue-600">En compras / taller</span>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-red-700">Rechazadas</span>
              <p className="text-2xl font-bold text-red-700 mt-1">{stats.rechazadas}</p>
              <span className="text-xs text-red-600">No procedentes</span>
            </div>
          </div>

          {/* Barra de Filtros */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              
              {/* Búsqueda */}
              <div className="md:col-span-4 relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Buscar por folio, seccional, director o repuesto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
              </div>

              {/* Filtro Estado */}
              <div className="md:col-span-3">
                <select
                  value={filterEstado}
                  onChange={(e) => setFilterEstado(e.target.value)}
                  className="w-full py-2 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white"
                >
                  <option value="Todos">Estado: Todos</option>
                  <option value="Pendiente">🟡 Pendiente</option>
                  <option value="Aprobada">🟢 Aprobada</option>
                  <option value="En Proceso de Compra">🔵 En Proceso de Compra</option>
                  <option value="Rechazada">🔴 Rechazada</option>
                  <option value="Finalizada">⚪ Finalizada</option>
                </select>
              </div>

              {/* Filtro Seccional */}
              <div className="md:col-span-3">
                {!isAdmin && userSeccionalNombre ? (
                  <div className="w-full py-2 px-3 text-xs bg-gray-100 border border-gray-300 rounded-lg flex items-center justify-between text-gray-700 font-medium">
                    <span className="truncate">Seccional: {userSeccionalNombre}</span>
                    <span className="text-2xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">Fijada</span>
                  </div>
                ) : (
                  <select
                    value={filterSeccional}
                    onChange={(e) => setFilterSeccional(e.target.value)}
                    className="w-full py-2 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white"
                  >
                    <option value="Todas">Seccional: Todas</option>
                    {seccionales.map(s => (
                      <option key={s.id} value={s.nombre}>{s.nombre}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Filtro Tipo */}
              <div className="md:col-span-2">
                <select
                  value={filterTipo}
                  onChange={(e) => setFilterTipo(e.target.value)}
                  className="w-full py-2 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white"
                >
                  <option value="Todos">Tipo: Todos</option>
                  {TIPOS_SOLICITUD.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Tabla de Solicitudes */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-2xs overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                <p className="mt-3 text-sm text-gray-500">Cargando solicitudes de compra...</p>
              </div>
            ) : filteredSolicitudes.length === 0 ? (
              <div className="text-center py-16 p-8">
                <FileText className="mx-auto h-12 w-12 text-gray-300" />
                <h3 className="mt-3 text-lg font-medium text-gray-900">No hay solicitudes registradas</h3>
                <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
                  {searchTerm || filterEstado !== 'Todos' || filterSeccional !== 'Todas'
                    ? 'No se encontraron solicitudes con los filtros aplicados.'
                    : 'Aún no se han generado solicitudes de compra o mantenimiento para esta seccional.'}
                </p>
                <button
                  onClick={() => setActiveTab('nueva')}
                  className="mt-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary hover:bg-blue-900 transition"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Crear Primera Solicitud
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Folio / Fecha</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Seccional & Solicitante</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Rubro / Vehículo</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Descripción</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Monto Est.</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Estado</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredSolicitudes.map((sol) => (
                      <tr key={sol.id} className="hover:bg-gray-50/80 transition-colors">
                        
                        {/* Folio y Fecha */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="font-mono font-bold text-primary text-sm block">
                            {sol.folio}
                          </span>
                          <span className="text-xs text-gray-500 block mt-0.5">
                            {sol.fecha_solicitud} {sol.hora_solicitud ? `• ${sol.hora_solicitud}` : ''}
                          </span>
                          {sol.prioridad === 'Emergencia' && (
                            <span className="inline-block mt-1 text-2xs font-bold px-1.5 py-0.5 bg-red-100 text-red-800 rounded">
                              Emergencia
                            </span>
                          )}
                          {sol.prioridad === 'Urgente' && (
                            <span className="inline-block mt-1 text-2xs font-bold px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded">
                              Urgente
                            </span>
                          )}
                        </td>

                        {/* Seccional y Director */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center space-x-1 text-sm font-semibold text-gray-900">
                            <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span>Seccional {sol.seccional_nombre}</span>
                          </div>
                          <div className="flex items-center space-x-1 text-xs text-gray-600 mt-0.5">
                            <User className="w-3 h-3 text-gray-400 shrink-0" />
                            <span className="truncate">{sol.solicitado_por} ({sol.cargo})</span>
                          </div>
                        </td>

                        {/* Rubro y Vehículo */}
                        <td className="px-4 py-3.5">
                          <span className="text-xs font-medium text-gray-800 block">
                            {sol.tipo_solicitud}
                          </span>
                          {sol.vehiculo_placa ? (
                            <div className="inline-flex items-center space-x-1 text-2xs font-mono font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded mt-1 border border-blue-200">
                              <Truck className="w-3 h-3 text-blue-600 mr-1" />
                              <span>{sol.vehiculo_placa}</span>
                            </div>
                          ) : (
                            <span className="text-2xs text-gray-400">Sin vehículo vinculado</span>
                          )}
                        </td>

                        {/* Descripción Resumida */}
                        <td className="px-4 py-3.5 max-w-xs">
                          <p className="text-xs text-gray-700 line-clamp-2" title={sol.descripcion}>
                            {sol.descripcion}
                          </p>
                        </td>

                        {/* Monto Estimado */}
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs font-semibold text-gray-900">
                          {sol.monto_estimado ? (
                            <span>${sol.monto_estimado.toFixed(2)}</span>
                          ) : (
                            <span className="text-gray-400 font-normal">Por cotizar</span>
                          )}
                          {sol.cotizaciones_archivos && sol.cotizaciones_archivos.length > 0 && (
                            <div className="flex items-center text-3xs font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-1 w-fit">
                              <Paperclip className="w-2.5 h-2.5 mr-1" />
                              <span>{sol.cotizaciones_archivos.length} cotización(es)</span>
                            </div>
                          )}
                        </td>

                        {/* Estado */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {renderEstadoBadge(sol.estado)}
                          {sol.autorizado_por && (
                            <span className="block text-2xs text-gray-400 mt-1 truncate">
                              Por: {sol.autorizado_por}
                            </span>
                          )}
                        </td>

                        {/* Acciones */}
                        <td className="px-4 py-3.5 whitespace-nowrap text-right text-xs font-medium space-x-1">
                          
                          {/* Ver Detalle */}
                          <button
                            onClick={() => {
                              setSelectedSolicitud(sol);
                              setShowDetailModal(true);
                            }}
                            className="p-1.5 text-gray-600 hover:text-primary hover:bg-gray-100 rounded-md transition"
                            title="Ver detalles completos"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Imprimir / Descargar PDF */}
                          <button
                            onClick={() => handleTriggerPrint(sol)}
                            className="p-1.5 text-gray-600 hover:text-green-700 hover:bg-green-50 rounded-md transition"
                            title="Imprimir / Descargar PDF Oficial"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Notificar por Correo */}
                          <button
                            onClick={() => handleOpenEmailModal(sol)}
                            className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition"
                            title="Enviar por Correo Electrónico"
                          >
                            <Mail className="w-4 h-4" />
                          </button>

                          {/* Autorizar / Cambiar Estado (Admin) */}
                          {canApprove && (
                            <button
                              onClick={() => {
                                setSelectedSolicitud(sol);
                                setNewStatus(sol.estado);
                                setMotivoRechazo(sol.motivo_rechazo || '');
                                setShowStatusModal(true);
                              }}
                              className="p-1.5 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-md transition"
                              title="Gestionar estado de autorización"
                            >
                              <Shield className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 3: PLANTILLAS Y CONFIGURACIÓN (ARRASTRE DE BLOQUES, LOGO Y TEXTOS)  */}
      {/* ========================================================================= */}
      {!isSeccionalOnly && activeTab === 'plantillas' && (
        <CompraTemplateConfig
          config={compraConfig}
          onSave={handleSaveCompraConfig}
          saving={savingCompraConfig}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: DETALLES DE LA SOLICITUD */}
      {/* ========================================================================= */}
      {showDetailModal && selectedSolicitud && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Detalle de Solicitud</span>
                <h3 className="text-xl font-bold text-gray-900">{selectedSolicitud.folio}</h3>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-sm">
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-gray-100">
                <div>
                  <span className="text-xs font-semibold text-gray-400 block">Lugar y Fecha:</span>
                  <span className="font-medium text-gray-900">{selectedSolicitud.lugar_fecha}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-gray-400 block">Estado Actual:</span>
                  <div className="mt-1">{renderEstadoBadge(selectedSolicitud.estado)}</div>
                </div>
                <div>
                  <span className="text-xs font-semibold text-gray-400 block">Seccional o Dependencia:</span>
                  <span className="font-bold text-gray-900">{selectedSolicitud.seccional_nombre}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-gray-400 block">Solicitado por:</span>
                  <span className="font-bold text-gray-900">{selectedSolicitud.solicitado_por} ({selectedSolicitud.cargo})</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-gray-400 block">Rubro / Tipo:</span>
                  <span className="font-medium text-gray-900">{selectedSolicitud.tipo_solicitud}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-gray-400 block">Prioridad:</span>
                  <span className="font-bold text-gray-900">{selectedSolicitud.prioridad}</span>
                </div>
              </div>

              {selectedSolicitud.vehiculo_placa && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center space-x-3">
                  <Truck className="w-6 h-6 text-blue-600 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-blue-900 block">Unidad Vehicular Asignada</span>
                    <span className="text-sm font-semibold text-blue-800">
                      Placa {selectedSolicitud.vehiculo_placa} — {selectedSolicitud.vehiculo_descripcion}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <span className="text-xs font-bold text-gray-800 uppercase tracking-wider block mb-1">
                  Descripción del servicio o producto a adquirir:
                </span>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-800 leading-relaxed whitespace-pre-wrap">
                  {selectedSolicitud.descripcion}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <span className="text-xs font-semibold text-gray-400 block">Monto Estimado:</span>
                  <span className="text-lg font-bold text-green-700">
                    {selectedSolicitud.monto_estimado ? `$${selectedSolicitud.monto_estimado.toFixed(2)} USD` : 'Por cotizar'}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-gray-400 block">Proveedor o Taller Sugerido:</span>
                  <span className="text-sm font-medium text-gray-800">
                    {selectedSolicitud.proveedor_sugerido || 'No especificado'}
                  </span>
                </div>
              </div>

              {/* Archivos / Cotizaciones Adjuntas */}
              {selectedSolicitud.cotizaciones_archivos && selectedSolicitud.cotizaciones_archivos.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-800 flex items-center">
                      <Paperclip className="w-3.5 h-3.5 text-emerald-600 mr-1.5" />
                      Cotizaciones Adjuntas ({selectedSolicitud.cotizaciones_archivos.length}):
                    </span>
                    <span className="text-3xs text-gray-500">Documentos y fotografías respaldatorias</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedSolicitud.cotizaciones_archivos.map((archivo, aIdx) => (
                      <a
                        key={aIdx}
                        href={archivo.url}
                        target="_blank"
                        rel="noreferrer"
                        download={archivo.nombre}
                        className="flex items-center space-x-2.5 p-2 bg-white border border-gray-200 rounded-lg hover:border-emerald-400 hover:shadow-xs transition group"
                      >
                        {archivo.tipo?.startsWith('image/') ? (
                          <img 
                            src={archivo.url} 
                            alt={archivo.nombre} 
                            className="w-10 h-10 object-cover rounded border border-gray-200 shrink-0" 
                          />
                        ) : (
                          <div className="w-10 h-10 bg-red-50 text-red-600 rounded flex items-center justify-center border border-red-200 shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                        )}
                        <div className="truncate flex-1 min-w-0 text-left">
                          <p className="text-xs font-semibold text-gray-800 truncate group-hover:text-emerald-700">
                            {archivo.nombre}
                          </p>
                          <span className="text-3xs text-gray-400 block">
                            {archivo.tipo?.startsWith('image/') ? 'Foto cotización' : 'Documento PDF'} • Clic para ver / descargar
                          </span>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-gray-400 group-hover:text-emerald-600 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {selectedSolicitud.autorizado_por && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                  <span className="text-xs font-bold text-green-900 block">Autorizado por:</span>
                  <span className="text-sm text-green-800 font-medium">
                    {selectedSolicitud.autorizado_por}
                  </span>
                </div>
              )}

              {selectedSolicitud.motivo_rechazo && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <span className="text-xs font-bold text-red-900 block">Motivo de Rechazo:</span>
                  <span className="text-sm text-red-800 font-medium">
                    {selectedSolicitud.motivo_rechazo}
                  </span>
                </div>
              )}

              {selectedSolicitud.correos_notificados && (
                <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
                  <span className="font-semibold text-gray-700">Correos notificados:</span> {selectedSolicitud.correos_notificados}
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  handleTriggerPrint(selectedSolicitud);
                }}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 text-xs font-semibold shadow-2xs"
              >
                <Printer className="w-4 h-4 mr-1.5 text-gray-600" />
                Imprimir Documento
              </button>

              <div className="space-x-2">
                {canApprove && (
                  <button
                    onClick={() => {
                      setNewStatus(selectedSolicitud.estado);
                      setMotivoRechazo(selectedSolicitud.motivo_rechazo || '');
                      setShowStatusModal(true);
                    }}
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-2xs"
                  >
                    <Shield className="w-4 h-4 mr-1.5" />
                    Cambiar Estado
                  </button>
                )}
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-semibold"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: VISTA PREVIA E IMPRESIÓN OFICIAL PDF SEGÚN PLANTILLA Y BLOQUES    */}
      {/* ========================================================================= */}
      {(showPrintModal || showPreviewPdfModal) && (
        <CompraPdfPreviewModal
          solicitud={selectedSolicitud || previewPdfSolicitud || {
            id: 999,
            folio: 'SC-2026-DEMO',
            seccional_id: 1,
            seccional_nombre: 'Santa Anita',
            solicitado_por: 'Carlos Hernández',
            cargo: 'Director Seccional',
            tipo_solicitud: 'Repuestos para Vehículo',
            es_para_vehiculo: true,
            vehiculo_id: 1,
            vehiculo_placa: 'CVS-014',
            vehiculo_descripcion: 'Toyota Land Cruiser HZJ78 (Ambulancia)',
            descripcion: 'Repuestos eq 231-145: Pastillas de frenos delanteros y traseros, kit de empaquetadura de bomba auxiliar de embrague y líquido DOT 4 para ambulancia institucional.',
            monto_estimado: 245.50,
            proveedor_sugerido: 'Repuestos Los Andes / Taller Central',
            prioridad: 'Urgente',
            lugar_fecha: 'San Salvador, 15 de agosto de 2026 (10:30 AM)',
            fecha_solicitud: new Date().toISOString().split('T')[0],
            hora_solicitud: '10:30 AM',
            estado: 'Pendiente',
            correo_enviado: true,
            correos_notificados: 'administracion@cruzverdesv.org',
            created_at: new Date().toISOString()
          }}
          config={compraConfig}
          onClose={() => {
            setShowPrintModal(false);
            setShowPreviewPdfModal(false);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ENVIAR NOTIFICACIÓN POR CORREO                                   */}
      {/* ========================================================================= */}
      {showEmailModal && selectedSolicitud && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden animate-in fade-in">
            <div className="p-5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Mail className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-gray-900 text-base">
                  Enviar Notificación de Solicitud ({selectedSolicitud.folio})
                </h3>
              </div>
              <button
                onClick={() => setShowEmailModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendEmail} className="p-6 space-y-4 text-sm">
              {emailForm.enviadoExitoso ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-3">
                    <Check className="w-6 h-6" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-900">¡Correo Enviado con Éxito!</h4>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                    Se ha remitido la notificación oficial de la solicitud a {emailForm.destinatario} y copias correspondientes.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Remitente (De:):
                    </label>
                    <input
                      type="email"
                      required
                      value={emailForm.remitente}
                      onChange={(e) => setEmailForm({ ...emailForm, remitente: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Destinatario Principal (Para:):
                    </label>
                    <input
                      type="email"
                      required
                      value={emailForm.destinatario}
                      onChange={(e) => setEmailForm({ ...emailForm, destinatario: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    />
                    <span className="text-2xs text-gray-400">Dirección del Departamento Administrativo de Cruz Verde</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      En Copia (CC:):
                    </label>
                    <input
                      type="text"
                      value={emailForm.cc}
                      onChange={(e) => setEmailForm({ ...emailForm, cc: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      placeholder="presidencia@cruzverdesv.org, director@cruzverdesv.org"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Asunto:
                    </label>
                    <input
                      type="text"
                      required
                      value={emailForm.asunto}
                      onChange={(e) => setEmailForm({ ...emailForm, asunto: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Cuerpo del Mensaje:
                    </label>
                    <textarea
                      rows={6}
                      value={emailForm.mensaje}
                      onChange={(e) => setEmailForm({ ...emailForm, mensaje: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none font-mono text-gray-800"
                    />
                  </div>

                  {/* Documento PDF adjunto y aviso No-Reply */}
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-xs text-red-900">
                    <div className="flex items-center space-x-2">
                      <span className="bg-red-600 text-white text-3xs font-extrabold px-1.5 py-0.5 rounded">PDF</span>
                      <div>
                        <span className="font-bold">Solicitud_Compra_{selectedSolicitud.folio}.pdf</span>
                        <span className="block text-3xs text-gray-500">Documento oficial membretado y tabulado adjunto</span>
                      </div>
                    </div>
                    <span className="text-3xs text-red-700 bg-red-100 px-2 py-0.5 rounded font-bold">Adjunto Oficial</span>
                  </div>

                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center space-x-2 text-2xs text-amber-900">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                    <span><strong>Remitente Oficial No-Reply:</strong> Se despachará desde <code>no-reply@cruzverdesv.org</code> con plantilla oficial y membrete para proteger la cuenta institucional.</span>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => setShowEmailModal(false)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={emailForm.enviando}
                      className="inline-flex items-center px-5 py-2 rounded-lg bg-primary hover:bg-blue-900 text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
                    >
                      {emailForm.enviando ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5 mr-1.5" />
                          Enviar Notificación
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: CAMBIAR ESTADO DE AUTORIZACIÓN (SOLO ADMIN / AUTORIZADOS)         */}
      {/* ========================================================================= */}
      {showStatusModal && selectedSolicitud && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in">
            <div className="p-5 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-purple-700" />
                <h3 className="font-bold text-gray-900 text-base">
                  Gestionar Autorización
                </h3>
              </div>
              <button
                onClick={() => setShowStatusModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div>
                <span className="text-xs font-bold text-gray-500 uppercase block">Solicitud:</span>
                <span className="font-bold text-gray-900">{selectedSolicitud.folio} — Seccional {selectedSolicitud.seccional_nombre}</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nuevo Estado de la Solicitud:
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white font-medium"
                >
                  <option value="Pendiente">🟡 Pendiente de Revisión</option>
                  <option value="Aprobada">🟢 Aprobada (Autorizada para compra)</option>
                  <option value="En Proceso de Compra">🔵 En Proceso de Compra / Taller</option>
                  <option value="Rechazada">🔴 Rechazada</option>
                  <option value="Finalizada">⚪ Finalizada (Entrega completada)</option>
                </select>
              </div>

              {newStatus === 'Rechazada' && (
                <div>
                  <label className="block text-xs font-semibold text-red-700 mb-1">
                    Motivo de Rechazo:
                  </label>
                  <textarea
                    rows={3}
                    value={motivoRechazo}
                    onChange={(e) => setMotivoRechazo(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                    placeholder="Explique el motivo por el cual no procede la compra..."
                  />
                </div>
              )}

              {newStatus === 'Aprobada' && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800">
                  <p className="font-semibold">La solicitud quedará firmada digitalmente con su usuario:</p>
                  <p className="mt-0.5">{userName || user?.email || 'Administrador'}</p>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={updatingStatus}
                  onClick={handleUpdateStatus}
                  className="inline-flex items-center px-5 py-2 rounded-lg bg-primary hover:bg-blue-900 text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
                >
                  {updatingStatus ? 'Guardando...' : 'Confirmar Estado'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
