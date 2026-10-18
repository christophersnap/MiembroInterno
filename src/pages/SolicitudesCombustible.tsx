import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Fuel, Plus, List, Settings, Search, CheckCircle2, Clock, 
  AlertCircle, Printer, Mail, Eye, Shield, Copy, Check, Filter, X,
  ChevronLeft
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';
import { 
  SolicitudCombustible, 
  CombustibleConfig, 
  DEFAULT_COMBUSTIBLE_CONFIG 
} from '../types/combustible';
import { isSolicitudRealizadaPorUsuario } from '../utils/solicitudFilter';
import CombustibleForm from '../components/combustible/CombustibleForm';
import CombustibleEmailModal from '../components/combustible/CombustibleEmailModal';
import CombustiblePdfModal from '../components/combustible/CombustiblePdfModal';
import CombustibleTemplateConfig from '../components/combustible/CombustibleTemplateConfig';

export default function SolicitudesCombustible() {
  const navigate = useNavigate();
  const { user, userName, role, userSeccionalId, userSeccionalNombre, permissions } = useAuth();
  const isAdmin = role === 'admin';
  const hasNivelNacional = isAdmin || Boolean(permissions.ver_todas_seccionales);
  const isSeccionalOnly = !hasNivelNacional;
  const canApprove = isAdmin || permissions.aprobar_solicitudes_compra === true;

  // Estados principales
  const [solicitudes, setSolicitudes] = useState<SolicitudCombustible[]>([]);
  const [seccionales, setSeccionales] = useState<{ id: number; nombre: string; director?: string; correo?: string }[]>([]);
  const [config, setConfig] = useState<CombustibleConfig>(DEFAULT_COMBUSTIBLE_CONFIG);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [dbTableMissing, setDbTableMissing] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Navegación de pestañas
  const [activeTab, setActiveTab] = useState<'formulario' | 'historial' | 'plantillas'>('formulario');

  // Filtros de búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('Todos');
  const [filterSeccional, setFilterSeccional] = useState(isAdmin ? 'Todas' : (userSeccionalNombre || 'Todas'));

  // Modales
  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudCombustible | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState<SolicitudCombustible['estado']>('Aprobada');
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Modal de confirmación inmediata tras enviar solicitud
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);
  const [lastSubmittedSolicitud, setLastSubmittedSolicitud] = useState<SolicitudCombustible | null>(null);

  // Script SQL para copiar en caso de que falte la tabla
  const sqlScript = `-- Ejecutar en el SQL Editor de Supabase:
CREATE TABLE IF NOT EXISTS public.solicitudes_combustible (
  id BIGSERIAL PRIMARY KEY,
  folio TEXT NOT NULL UNIQUE,
  seccional_id INTEGER REFERENCES public.seccionales(id) ON DELETE SET NULL,
  seccional_nombre TEXT NOT NULL,
  director_nombre TEXT NOT NULL,
  correo_electronico TEXT NOT NULL,
  actividad TEXT NOT NULL,
  entrego_liquidacion_anterior BOOLEAN NOT NULL DEFAULT FALSE,
  motivo_no_liquidacion TEXT,
  nombre_solicitante TEXT NOT NULL,
  telefono_solicitante TEXT NOT NULL,
  observaciones TEXT,
  fecha_solicitud DATE DEFAULT CURRENT_DATE,
  hora_solicitud TEXT,
  fecha_envio_completa TEXT,
  estado TEXT NOT NULL DEFAULT 'Pendiente',
  autorizado_por TEXT,
  fecha_autorizacion TIMESTAMPTZ,
  motivo_rechazo TEXT,
  correo_enviado BOOLEAN DEFAULT FALSE,
  correos_notificados TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.solicitudes_combustible ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo solicitudes_combustible" ON public.solicitudes_combustible FOR ALL USING (true) WITH CHECK (true);
NOTIFY pgrst, 'reload schema';`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlScript);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  // 1. Cargar datos iniciales
  const fetchData = async () => {
    setLoading(true);
    try {
      // A. Cargar Seccionales
      const { data: secData, error: secErr } = await supabase
        .from('seccionales')
        .select('id, nombre, director, correo')
        .order('nombre');

      let loadedSeccs: { id: number; nombre: string; director?: string; correo?: string }[] = [];
      if (!secErr && secData && secData.length > 0) {
        loadedSeccs = secData.map((s: any) => ({
          id: s.id,
          nombre: s.nombre,
          director: s.director && s.director !== 'N/A' ? s.director : undefined,
          correo: s.correo || undefined
        }));
      } else {
        loadedSeccs = [
          { id: 1, nombre: 'Aguilares', director: 'JOSUE ARMANDO RAMOS URRUTIA', correo: 'aguilares@cruzverdesv.org' },
          { id: 2, nombre: 'Santa Anita', director: 'Lic. Roberto Gómez', correo: 'santaanita@cruzverdesv.org' },
          { id: 3, nombre: 'Santa Tecla', director: 'Juan Carlos Perez', correo: 'santatecla@cruzverdesv.org' },
          { id: 4, nombre: 'San Salvador', director: 'Carlos Ramirez', correo: 'sansalvador@cruzverdesv.org' },
          { id: 5, nombre: 'Soyapango', director: 'Luis Gomez', correo: 'soyapango@cruzverdesv.org' },
          { id: 6, nombre: 'Apopa', director: 'Marcos Rivera', correo: 'apopa@cruzverdesv.org' }
        ];
      }
      setSeccionales(loadedSeccs);

      // B. Cargar Configuración de Combustible
      const { data: confData } = await supabase
        .from('configuracion')
        .select('*')
        .like('clave', 'combustible_%');

      if (confData && confData.length > 0) {
        const confMap: Record<string, string> = {};
        confData.forEach(c => { confMap[c.clave] = c.valor; });

        setConfig(prev => ({
          ...prev,
          correoDestino: confMap.combustible_correo_destino || prev.correoDestino,
          correoCcDefault: confMap.combustible_correo_cc || prev.correoCcDefault,
          correoContactoTelefono: confMap.combustible_correo_contacto_telefono || prev.correoContactoTelefono,
          asuntoPlantilla: confMap.combustible_correo_asunto_plantilla || prev.asuntoPlantilla,
          enviarCopiaSolicitante: confMap.combustible_correo_enviar_copia_solicitante !== 'false',
          correoTitulo: confMap.combustible_correo_titulo || prev.correoTitulo,
          correoSubtitulo: confMap.combustible_correo_subtitulo || prev.correoSubtitulo,
          correoFooterTexto: confMap.combustible_correo_footer_texto || prev.correoFooterTexto,

          pdfTitulo: confMap.combustible_pdf_titulo || prev.pdfTitulo,
          pdfSubtitulo: confMap.combustible_pdf_subtitulo || prev.pdfSubtitulo,
          pdfFontFamily: (confMap.combustible_pdf_font_family as any) || prev.pdfFontFamily,
          pdfFontSize: (confMap.combustible_pdf_font_size as any) || prev.pdfFontSize,
          pdfCodigoFormulario: confMap.combustible_pdf_codigo_formulario || prev.pdfCodigoFormulario,
          pdfWatermark: confMap.combustible_pdf_watermark !== 'false',
          pdfWatermarkText: confMap.combustible_pdf_watermark_text || prev.pdfWatermarkText,
          pdfWatermarkOpacity: confMap.combustible_pdf_watermark_opacity || prev.pdfWatermarkOpacity,

          pdfMostrarLogoHeader: confMap.combustible_pdf_mostrar_logo_header !== 'false',
          pdfLogoHeaderUrl: confMap.combustible_pdf_logo_header_url ?? prev.pdfLogoHeaderUrl,
          pdfLogoPosicion: (confMap.combustible_pdf_logo_posicion as any) || prev.pdfLogoPosicion,
          pdfLogoSize: (confMap.combustible_pdf_logo_size as any) || prev.pdfLogoSize,
          pdfMostrarLogoSecundario: confMap.combustible_pdf_mostrar_logo_secundario === 'true',
          pdfLogoSecundarioUrl: confMap.combustible_pdf_logo_secundario_url ?? prev.pdfLogoSecundarioUrl,
          pdfLogoSecundarioPosicion: (confMap.combustible_pdf_logo_secundario_posicion as any) || prev.pdfLogoSecundarioPosicion,
          pdfLogoSecundarioSize: (confMap.combustible_pdf_logo_secundario_size as any) || prev.pdfLogoSecundarioSize,
          pdfMostrarSelloImg: confMap.combustible_pdf_mostrar_sello_img === 'true',
          pdfSelloImgUrl: confMap.combustible_pdf_sello_img_url ?? prev.pdfSelloImgUrl,
          pdfSelloImgPosicion: (confMap.combustible_pdf_sello_img_posicion as any) || prev.pdfSelloImgPosicion,
          pdfSelloImgSize: (confMap.combustible_pdf_sello_img_size as any) || prev.pdfSelloImgSize,
          pdfMostrarLogoFooter: confMap.combustible_pdf_mostrar_logo_footer !== 'false',
          pdfLogoFooterUrl: confMap.combustible_pdf_logo_footer_url ?? prev.pdfLogoFooterUrl,
          pdfFooterImgPosicion: (confMap.combustible_pdf_footer_img_posicion as any) || prev.pdfFooterImgPosicion,
          pdfFooterImgSize: (confMap.combustible_pdf_footer_img_size as any) || prev.pdfFooterImgSize,

          pdfLabelSolicitante: confMap.combustible_pdf_label_solicitante || prev.pdfLabelSolicitante,
          pdfLabelSeccional: confMap.combustible_pdf_label_seccional || prev.pdfLabelSeccional,
          pdfLabelDirector: confMap.combustible_pdf_label_director || prev.pdfLabelDirector,
          pdfLabelActividad: confMap.combustible_pdf_label_actividad || prev.pdfLabelActividad,
          pdfLabelCorreo: confMap.combustible_pdf_label_correo || prev.pdfLabelCorreo,
          pdfLabelContacto: confMap.combustible_pdf_label_contacto || prev.pdfLabelContacto,
          pdfLabelLiquidacion: confMap.combustible_pdf_label_liquidacion || prev.pdfLabelLiquidacion,
          pdfLabelMotivo: confMap.combustible_pdf_label_motivo || prev.pdfLabelMotivo,
          pdfLabelObservaciones: confMap.combustible_pdf_label_observaciones || prev.pdfLabelObservaciones,

          pdfLabelFirmaSolicitante: confMap.combustible_pdf_label_firma_solicitante || prev.pdfLabelFirmaSolicitante,
          pdfLabelFirmaAdmin: confMap.combustible_pdf_label_firma_admin || prev.pdfLabelFirmaAdmin,
          pdfLabelDui: confMap.combustible_pdf_label_dui || prev.pdfLabelDui,
          pdfLabelFecha: confMap.combustible_pdf_label_fecha || prev.pdfLabelFecha,
          pdfLabelFirmaSello: confMap.combustible_pdf_label_firma_sello || prev.pdfLabelFirmaSello,
          pdfLabelAutoriza: confMap.combustible_pdf_label_autoriza || prev.pdfLabelAutoriza,
          pdfLabelFechaAuto: confMap.combustible_pdf_label_fecha_auto || prev.pdfLabelFechaAuto
        }));
      }

      // C. Cargar Solicitudes de Combustible
      let query = supabase
        .from('solicitudes_combustible')
        .select('*')
        .order('created_at', { ascending: false });

      if (!isAdmin && userSeccionalNombre) {
        query = query.ilike('seccional_nombre', `%${userSeccionalNombre}%`);
      }

      const { data: solData, error: solErr } = await query;

      if (solErr) {
        console.warn('Tabla solicitudes_combustible aún no existe en Supabase, usando almacenamiento local:', solErr);
        setDbTableMissing(true);

        const localData = sessionStorage.getItem('cruz_verde_solicitudes_combustible');
        if (localData) {
          try {
            setSolicitudes(JSON.parse(localData));
          } catch (e) {
            setSolicitudes([]);
          }
        } else {
          // Solicitud de demostración basada en la Imagen 2
          const demoSolicitud: SolicitudCombustible = {
            id: 1,
            folio: 'COMB-2026-0042',
            seccional_id: 1,
            seccional_nombre: 'Aguilares',
            director_nombre: '(AGUILARES) - JOSUE ARMANDO RAMOS URRUTIA',
            correo_electronico: user?.email || 'christopher.snap@gmail.com',
            actividad: 'Emergencias cotidianas',
            entrego_liquidacion_anterior: true,
            motivo_no_liquidacion: '',
            nombre_solicitante: userName && userName !== 'Usuario' ? userName : 'Christopher prueba a outlook',
            telefono_solicitante: '7742-8734',
            observaciones: 'Dotación mensual para ambulancia y unidad de rescate.',
            fecha_solicitud: '2026-09-09',
            hora_solicitud: '19:35:00',
            fecha_envio_completa: '2026-09-09 19:35:00',
            estado: 'Pendiente',
            correo_enviado: true,
            correos_notificados: 'control_combustible@cruzverdesv.org',
            created_at: new Date().toISOString()
          };
          setSolicitudes([demoSolicitud]);
          sessionStorage.setItem('cruz_verde_solicitudes_combustible', JSON.stringify([demoSolicitud]));
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
      console.error('Error cargando combustible:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isAdmin, user?.email, user?.id, userName]);

  // 2. Manejar envío de formulario
  const handleSubmitForm = async (formData: Omit<SolicitudCombustible, 'id' | 'folio' | 'estado' | 'created_at'>) => {
    setSubmitting(true);
    try {
      const now = new Date();
      const year = now.getFullYear();
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const folioGenerado = `COMB-${year}-${randomNum}`;
      const horaStr = now.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      const fechaStr = now.toISOString().split('T')[0];
      const fechaCompletaStr = `${fechaStr} ${horaStr}`;

      const correosArr = [config.correoDestino];
      if (config.correoCcDefault) correosArr.push(config.correoCcDefault);
      if (formData.correo_electronico && config.enviarCopiaSolicitante) {
        correosArr.push(formData.correo_electronico);
      }

      const payload = {
        ...formData,
        folio: folioGenerado,
        fecha_solicitud: fechaStr,
        hora_solicitud: horaStr,
        fecha_envio_completa: fechaCompletaStr,
        estado: 'Pendiente' as const,
        correo_enviado: true,
        correos_notificados: correosArr.join(', ')
      };

      let newRecord: SolicitudCombustible;

      if (dbTableMissing) {
        newRecord = {
          id: Date.now(),
          ...payload,
          created_at: new Date().toISOString()
        };
        const updatedList = [newRecord, ...solicitudes];
        setSolicitudes(updatedList);
        sessionStorage.setItem('cruz_verde_solicitudes_combustible', JSON.stringify(updatedList));
      } else {
        const { data, error: insErr } = await supabase
          .from('solicitudes_combustible')
          .insert([payload])
          .select()
          .single();

        if (insErr) {
          console.warn('Error insertando en Supabase, guardando localmente:', insErr);
          setDbTableMissing(true);
          newRecord = {
            id: Date.now(),
            ...payload,
            created_at: new Date().toISOString()
          };
          const updatedList = [newRecord, ...solicitudes];
          setSolicitudes(updatedList);
          sessionStorage.setItem('cruz_verde_solicitudes_combustible', JSON.stringify(updatedList));
        } else {
          newRecord = data;
          await fetchData();
        }
      }

      await logActivity('Registró solicitud de combustible', 'SolicitudCombustible', folioGenerado, {
        seccional: formData.seccional_nombre,
        solicitante: formData.nombre_solicitante,
        actividad: formData.actividad
      });

      // Mostrar modal de confirmación con el acuse de recibo
      setLastSubmittedSolicitud(newRecord);
      setShowCelebrationModal(true);

    } catch (err: any) {
      console.error('Error guardando solicitud de combustible:', err);
      alert(`Error al guardar solicitud: ${err.message || 'Error desconocido'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Guardar configuración de plantillas
  const handleSaveConfig = async (newConfig: CombustibleConfig) => {
    setSavingConfig(true);
    try {
      setConfig(newConfig);
      localStorage.setItem('cruz_verde_combustible_config', JSON.stringify(newConfig));

      const entries = [
        { clave: 'combustible_correo_destino', valor: newConfig.correoDestino },
        { clave: 'combustible_correo_cc', valor: newConfig.correoCcDefault },
        { clave: 'combustible_correo_contacto_telefono', valor: newConfig.correoContactoTelefono },
        { clave: 'combustible_correo_asunto_plantilla', valor: newConfig.asuntoPlantilla },
        { clave: 'combustible_correo_enviar_copia_solicitante', valor: String(newConfig.enviarCopiaSolicitante) },
        { clave: 'combustible_correo_titulo', valor: newConfig.correoTitulo },
        { clave: 'combustible_correo_subtitulo', valor: newConfig.correoSubtitulo },
        { clave: 'combustible_correo_footer_texto', valor: newConfig.correoFooterTexto },
        { clave: 'combustible_pdf_titulo', valor: newConfig.pdfTitulo },
        { clave: 'combustible_pdf_subtitulo', valor: newConfig.pdfSubtitulo },
        { clave: 'combustible_pdf_font_family', valor: newConfig.pdfFontFamily },
        { clave: 'combustible_pdf_font_size', valor: newConfig.pdfFontSize },
        { clave: 'combustible_pdf_codigo_formulario', valor: newConfig.pdfCodigoFormulario },
        { clave: 'combustible_pdf_watermark', valor: String(newConfig.pdfWatermark) },
        { clave: 'combustible_pdf_watermark_text', valor: newConfig.pdfWatermarkText },
        { clave: 'combustible_pdf_watermark_opacity', valor: newConfig.pdfWatermarkOpacity },
        { clave: 'combustible_pdf_mostrar_logo_header', valor: String(newConfig.pdfMostrarLogoHeader) },
        { clave: 'combustible_pdf_logo_header_url', valor: newConfig.pdfLogoHeaderUrl || '' },
        { clave: 'combustible_pdf_logo_posicion', valor: newConfig.pdfLogoPosicion || 'left' },
        { clave: 'combustible_pdf_logo_size', valor: newConfig.pdfLogoSize || 'medium' },
        { clave: 'combustible_pdf_mostrar_logo_secundario', valor: String(newConfig.pdfMostrarLogoSecundario) },
        { clave: 'combustible_pdf_logo_secundario_url', valor: newConfig.pdfLogoSecundarioUrl || '' },
        { clave: 'combustible_pdf_logo_secundario_posicion', valor: newConfig.pdfLogoSecundarioPosicion || 'right' },
        { clave: 'combustible_pdf_logo_secundario_size', valor: newConfig.pdfLogoSecundarioSize || 'medium' },
        { clave: 'combustible_pdf_mostrar_sello_img', valor: String(newConfig.pdfMostrarSelloImg) },
        { clave: 'combustible_pdf_sello_img_url', valor: newConfig.pdfSelloImgUrl || '' },
        { clave: 'combustible_pdf_sello_img_posicion', valor: newConfig.pdfSelloImgPosicion || 'center' },
        { clave: 'combustible_pdf_sello_img_size', valor: newConfig.pdfSelloImgSize || 'medium' },
        { clave: 'combustible_pdf_mostrar_logo_footer', valor: String(newConfig.pdfMostrarLogoFooter) },
        { clave: 'combustible_pdf_logo_footer_url', valor: newConfig.pdfLogoFooterUrl || '' },
        { clave: 'combustible_pdf_footer_img_posicion', valor: newConfig.pdfFooterImgPosicion || 'center' },
        { clave: 'combustible_pdf_footer_img_size', valor: newConfig.pdfFooterImgSize || 'medium' },
        { clave: 'combustible_pdf_label_solicitante', valor: newConfig.pdfLabelSolicitante },
        { clave: 'combustible_pdf_label_seccional', valor: newConfig.pdfLabelSeccional },
        { clave: 'combustible_pdf_label_director', valor: newConfig.pdfLabelDirector },
        { clave: 'combustible_pdf_label_actividad', valor: newConfig.pdfLabelActividad },
        { clave: 'combustible_pdf_label_correo', valor: newConfig.pdfLabelCorreo },
        { clave: 'combustible_pdf_label_contacto', valor: newConfig.pdfLabelContacto },
        { clave: 'combustible_pdf_label_liquidacion', valor: newConfig.pdfLabelLiquidacion },
        { clave: 'combustible_pdf_label_motivo', valor: newConfig.pdfLabelMotivo },
        { clave: 'combustible_pdf_label_observaciones', valor: newConfig.pdfLabelObservaciones },
        { clave: 'combustible_pdf_label_firma_solicitante', valor: newConfig.pdfLabelFirmaSolicitante },
        { clave: 'combustible_pdf_label_firma_admin', valor: newConfig.pdfLabelFirmaAdmin },
        { clave: 'combustible_pdf_label_dui', valor: newConfig.pdfLabelDui },
        { clave: 'combustible_pdf_label_fecha', valor: newConfig.pdfLabelFecha },
        { clave: 'combustible_pdf_label_firma_sello', valor: newConfig.pdfLabelFirmaSello },
        { clave: 'combustible_pdf_label_autoriza', valor: newConfig.pdfLabelAutoriza },
        { clave: 'combustible_pdf_label_fecha_auto', valor: newConfig.pdfLabelFechaAuto }
      ];

      for (const item of entries) {
        await supabase
          .from('configuracion')
          .upsert({ clave: item.clave, valor: item.valor }, { onConflict: 'clave' });
      }

      await logActivity('Actualizó plantilla y configuración de combustible', 'Configuracion', 'Combustible', {});

    } catch (err: any) {
      console.warn('No se pudo guardar en tabla configuracion de Supabase, guardado en localStorage:', err);
    } finally {
      setSavingConfig(false);
    }
  };

  // 4. Cambiar estado de solicitud
  const handleUpdateStatus = async () => {
    if (!selectedSolicitud) return;
    setUpdatingStatus(true);
    try {
      const payload: any = {
        estado: newStatus,
        updated_at: new Date().toISOString()
      };

      if (newStatus === 'Aprobada') {
        payload.autorizado_por = userName || user?.email || 'Administración Central';
        payload.fecha_autorizacion = new Date().toISOString();
        payload.motivo_rechazo = null;
      } else if (newStatus === 'Rechazada') {
        payload.motivo_rechazo = motivoRechazo.trim() || 'No especificado';
      }

      if (dbTableMissing) {
        const updated = solicitudes.map(s => s.id === selectedSolicitud.id ? { ...s, ...payload } : s);
        setSolicitudes(updated);
        sessionStorage.setItem('cruz_verde_solicitudes_combustible', JSON.stringify(updated));
      } else {
        await supabase
          .from('solicitudes_combustible')
          .update(payload)
          .eq('id', selectedSolicitud.id);
        await fetchData();
      }

      await logActivity(`Cambió estado a ${newStatus}`, 'SolicitudCombustible', selectedSolicitud.folio, { estado: newStatus });
      setShowStatusModal(false);

    } catch (err: any) {
      alert(`Error al actualizar estado: ${err.message}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Filtrado de solicitudes
  const filteredSolicitudes = solicitudes.filter(sol => {
    // Si el usuario no es admin, solo puede ver las solicitudes que ha realizado
    if (!isAdmin && !isSolicitudRealizadaPorUsuario(sol, user, userName)) {
      return false;
    }

    const matchesSearch = 
      sol.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sol.nombre_solicitante.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sol.seccional_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sol.actividad.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesEstado = filterEstado === 'Todos' || sol.estado === filterEstado;
    const matchesSeccional = filterSeccional === 'Todas' || sol.seccional_nombre === filterSeccional;

    return matchesSearch && matchesEstado && matchesSeccional;
  });

  return (
    <div className="space-y-6">
      
      {/* Banner de Ayuda si falta la tabla en Supabase */}
      {dbTableMissing && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                Módulo de Combustible Activo en Modo Local / En espera de migración en Supabase
              </p>
              <p className="text-amber-800 mt-0.5">
                La tabla <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">public.solicitudes_combustible</code> aún no se ha ejecutado en Supabase. El sistema funciona con persistencia en memoria local. Copie el script SQL para crear la tabla oficial.
              </p>
            </div>
          </div>

          <button
            onClick={copySqlToClipboard}
            className="inline-flex items-center px-4 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg font-bold shadow-xs transition shrink-0 cursor-pointer"
          >
            {copiedSql ? (
              <>
                <Check className="w-4 h-4 mr-1.5" />
                ¡Script Copiado!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-1.5" />
                Copiar Script SQL
              </>
            )}
          </button>
        </div>
      )}

      {/* Cabecera Principal con Navegación o Botón de Regresar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/solicitudes')}
            className="inline-flex items-center px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer mr-1"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Regresar al Menú
          </button>
          
          <div className="p-2.5 bg-emerald-600 rounded-2xl text-white shadow-sm">
            <Fuel className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">
                Solicitud de Combustible
              </h1>
              {isSeccionalOnly && userSeccionalNombre && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {userSeccionalNombre}
                </span>
              )}
            </div>
            <p className="text-xs md:text-sm text-gray-500">
              Formulario oficial de requerimiento de combustible institucional
            </p>
          </div>
        </div>

        {/* Pestañas */}
        <div className="flex items-center bg-gray-100 p-1 rounded-xl shadow-2xs">
          <button
            onClick={() => setActiveTab('formulario')}
            className={`inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === 'formulario'
                ? 'bg-white text-gray-900 shadow-2xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Plus className="w-4 h-4 mr-1.5 text-emerald-600" />
            Formulario
          </button>

          <button
            onClick={() => setActiveTab('historial')}
            className={`inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === 'historial'
                ? 'bg-white text-gray-900 shadow-2xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <List className="w-4 h-4 mr-1.5 text-blue-600" />
            {isAdmin ? `Historial (${solicitudes.length})` : `Mis Solicitudes (${solicitudes.length})`}
          </button>

          {!isSeccionalOnly && (
            <button
              onClick={() => setActiveTab('plantillas')}
              className={`inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold transition ${
                activeTab === 'plantillas'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Settings className="w-4 h-4 mr-1.5 text-purple-600" />
              Plantillas y Configuración
            </button>
          )}
        </div>
      </div>

      {/* PESTAÑA 1: FORMULARIO (IMAGEN 1) */}
      {activeTab === 'formulario' && (
        <CombustibleForm
          seccionales={seccionales}
          isAdmin={isAdmin}
          userSeccionalNombre={userSeccionalNombre}
          defaultDirector={userSeccionalNombre ? (seccionales.find(s => s.nombre.toLowerCase() === userSeccionalNombre.toLowerCase())?.director || 'Director Seccional') : 'Director Seccional'}
          defaultEmail={user?.email || ''}
          defaultSolicitante={userName && userName !== 'Usuario' ? userName : ''}
          submitting={submitting}
          onSubmit={handleSubmitForm}
        />
      )}

      {/* PESTAÑA 2: HISTORIAL DE SOLICITUDES */}
      {activeTab === 'historial' && (
        <div className="space-y-4">
          
          {/* Barra de Filtros y Búsqueda */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por folio, solicitante, seccional o actividad..."
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg outline-none bg-white font-medium"
              >
                <option value="Todos">Todos los Estados</option>
                <option value="Pendiente">🟡 Pendiente</option>
                <option value="Aprobada">🟢 Aprobada</option>
                <option value="En Proceso">🔵 En Proceso</option>
                <option value="Rechazada">🔴 Rechazada</option>
                <option value="Entregada">⚪ Entregada</option>
              </select>

              {isAdmin && (
                <select
                  value={filterSeccional}
                  onChange={(e) => setFilterSeccional(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg outline-none bg-white font-medium"
                >
                  <option value="Todas">Todas las Seccionales</option>
                  {seccionales.map(s => (
                    <option key={s.id} value={s.nombre}>{s.nombre}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Tabla de Resultados */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 uppercase font-semibold border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3">Folio</th>
                    <th className="px-4 py-3">Seccional</th>
                    <th className="px-4 py-3">Solicitante</th>
                    <th className="px-4 py-3">Actividad</th>
                    <th className="px-4 py-3 text-center">Liquidación Anterior</th>
                    <th className="px-4 py-3">Fecha y Hora</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredSolicitudes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                        No se encontraron solicitudes registradas con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredSolicitudes.map((sol) => (
                      <tr key={sol.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 font-mono font-bold text-gray-900">
                          {sol.folio}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-800">
                          {sol.seccional_nombre}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-gray-900 block">{sol.nombre_solicitante}</span>
                          <span className="text-3xs text-gray-500">{sol.telefono_solicitante}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 max-w-xs truncate" title={sol.actividad}>
                          {sol.actividad}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {sol.entrego_liquidacion_anterior ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-3xs font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Sí
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-3xs font-bold bg-amber-100 text-amber-800" title={sol.motivo_no_liquidacion || 'Pendiente'}>
                              <AlertCircle className="w-3 h-3 mr-1" /> No
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 font-mono text-3xs">
                          {sol.fecha_envio_completa || `${sol.fecha_solicitud} ${sol.hora_solicitud || ''}`}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-3xs font-bold ${
                            sol.estado === 'Aprobada' ? 'bg-emerald-100 text-emerald-800' :
                            sol.estado === 'Rechazada' ? 'bg-red-100 text-red-800' :
                            sol.estado === 'En Proceso' ? 'bg-blue-100 text-blue-800' :
                            sol.estado === 'Entregada' ? 'bg-purple-100 text-purple-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {sol.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            {/* Botón Acuse de Correo (Imagen 2) */}
                            <button
                              onClick={() => {
                                setSelectedSolicitud(sol);
                                setShowEmailModal(true);
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="Ver Acuse de Correo Recibido"
                            >
                              <Mail className="w-4 h-4" />
                            </button>

                            {/* Botón Documento Oficial PDF (Documento 3) */}
                            <button
                              onClick={() => {
                                setSelectedSolicitud(sol);
                                setShowPdfModal(true);
                              }}
                              className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                              title="Ver / Imprimir Hoja Oficial PDF"
                            >
                              <Printer className="w-4 h-4" />
                            </button>

                            {/* Botón Gestión de Estado (Admin) */}
                            {canApprove && (
                              <button
                                onClick={() => {
                                  setSelectedSolicitud(sol);
                                  setNewStatus(sol.estado);
                                  setMotivoRechazo(sol.motivo_rechazo || '');
                                  setShowStatusModal(true);
                                }}
                                className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition"
                                title="Cambiar Estado / Autorización"
                              >
                                <Shield className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* PESTAÑA 3: PLANTILLAS Y CONFIGURACIÓN */}
      {activeTab === 'plantillas' && (
        <CombustibleTemplateConfig
          config={config}
          onSave={handleSaveConfig}
          saving={savingConfig}
        />
      )}

      {/* MODAL 1: ACUSE DE RECIBO POR CORREO (IMAGEN 2) */}
      {showEmailModal && selectedSolicitud && (
        <CombustibleEmailModal
          solicitud={selectedSolicitud}
          config={config}
          onClose={() => setShowEmailModal(false)}
        />
      )}

      {/* MODAL 2: DOCUMENTO OFICIAL PDF TAMAÑO CARTA (DOCUMENTO 3) */}
      {showPdfModal && selectedSolicitud && (
        <CombustiblePdfModal
          solicitud={selectedSolicitud}
          config={config}
          onClose={() => setShowPdfModal(false)}
        />
      )}

      {/* MODAL 3: CELEBRACIÓN Y CONFIRMACIÓN INMEDIATA TRAS REGISTRAR */}
      {showCelebrationModal && lastSubmittedSolicitud && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl p-6 text-center space-y-4 animate-in fade-in">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h3 className="text-xl font-black text-gray-900">
              ¡Solicitud de Combustible Enviada con Éxito!
            </h3>

            <p className="text-xs text-gray-600">
              Folio generado: <strong className="text-emerald-700 font-mono text-sm">{lastSubmittedSolicitud.folio}</strong>
              <br />
              Se ha preparado el acuse de recibo para el correo institucional y el solicitante.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-3 border-t border-gray-100">
              <button
                onClick={() => {
                  setSelectedSolicitud(lastSubmittedSolicitud);
                  setShowCelebrationModal(false);
                  setShowEmailModal(true);
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold hover:bg-blue-100 transition"
              >
                <Mail className="w-4 h-4 mr-1.5" />
                Ver Acuse de Correo
              </button>

              <button
                onClick={() => {
                  setSelectedSolicitud(lastSubmittedSolicitud);
                  setShowCelebrationModal(false);
                  setShowPdfModal(true);
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition"
              >
                <Printer className="w-4 h-4 mr-1.5" />
                Imprimir Documento PDF
              </button>

              <button
                onClick={() => {
                  setShowCelebrationModal(false);
                  setActiveTab('historial');
                }}
                className="w-full sm:w-auto px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition"
              >
                Ir al Historial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: GESTIÓN DE ESTADO / AUTORIZACIÓN (SOLO ADMIN) */}
      {showStatusModal && selectedSolicitud && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in">
            <div className="p-4 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-purple-700" />
                <h3 className="font-bold text-gray-900 text-sm">
                  Gestionar Solicitud de Combustible
                </h3>
              </div>
              <button
                onClick={() => setShowStatusModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <span className="font-bold text-gray-500 uppercase block text-3xs">Solicitud:</span>
                <span className="font-bold text-gray-900 text-sm">
                  {selectedSolicitud.folio} • Seccional {selectedSolicitud.seccional_nombre}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Estado de la Solicitud:
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none bg-white font-medium"
                >
                  <option value="Pendiente">🟡 Pendiente de Revisión</option>
                  <option value="Aprobada">🟢 Aprobada (Autorizada para dotación)</option>
                  <option value="En Proceso">🔵 En Proceso de Despacho</option>
                  <option value="Rechazada">🔴 Rechazada</option>
                  <option value="Entregada">⚪ Entregada / Finalizada</option>
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
                    placeholder="Explique el motivo por el cual no procede la dotación de combustible..."
                    className="w-full px-3 py-2 text-xs border border-red-300 rounded-lg outline-none focus:ring-2 focus:ring-red-500"
                  />
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
                  className="inline-flex items-center px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
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
