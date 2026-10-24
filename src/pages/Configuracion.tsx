import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Save, Settings, Info, Palette, Image as ImageIcon, Mail, FileText, Truck, 
  Shield, CheckCircle2, Eye, RefreshCw, AlertCircle, Printer, Sparkles, Check, QrCode,
  ShoppingCart, Fuel
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getApiUrl } from '../lib/api';
import { logActivity } from '../lib/logger';
import { useSettings } from '../contexts/SettingsContext';
import ConfiguracionCorreos from '../components/configuracion/ConfiguracionCorreos';
import ModalDisenadorCorreos from '../components/configuracion/ModalDisenadorCorreos';
import PersonalizacionColores from '../components/configuracion/PersonalizacionColores';
import CompraTemplateConfig from '../components/compra/CompraTemplateConfig';
import CombustibleTemplateConfig from '../components/combustible/CombustibleTemplateConfig';
import { CompraConfig, DEFAULT_COMPRA_CONFIG, DEFAULT_COMPRA_BLOCKS } from '../types/compra';
import { CombustibleConfig, DEFAULT_COMBUSTIBLE_CONFIG, DEFAULT_COMBUSTIBLE_BLOCKS } from '../types/combustible';

interface PlantillaFormulario {
  id: string;
  titulo: string;
  departamento: string;
  subtitulo: string;
  mostrarLogo: boolean;
  watermarkEnabled: boolean;
  watermarkText: string;
  watermarkOpacity: string;
  accesorios: {
    mostrarUrgencia: boolean;
    mostrarDetalleVehiculo: boolean;
    mostrarCostos: boolean;
    mostrarProveedor: boolean;
    mostrarFechaHoraSV: boolean;
    mostrarContactoDirector: boolean;
    mostrarEspacioCotizacion: boolean;
  };
  firmas: {
    firma1Titulo: string;
    firma1Subtitulo: string;
    firma2Titulo: string;
    firma2Subtitulo: string;
    firma3Titulo: string;
    firma3Subtitulo: string;
  };
  piePagina: string;
}

export default function Configuracion() {
  const { refreshSettings } = useSettings();
  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') as any;
  
  // Categoría activa seleccionada
  const [activeCategory, setActiveCategory] = useState<'plantillas' | 'correo' | 'flota' | 'verificacion' | 'colores' | 'identidad'>(
    urlTab && ['plantillas', 'correo', 'flota', 'verificacion', 'colores', 'identidad'].includes(urlTab) ? urlTab : 'colores'
  );

  useEffect(() => {
    const tab = searchParams.get('tab') as any;
    if (tab && ['plantillas', 'correo', 'flota', 'verificacion', 'colores', 'identidad'].includes(tab)) {
      setActiveCategory(tab);
    }
  }, [searchParams]);
  
  // Formulario seleccionado para la plantilla PDF
  const [selectedFormularioId, setSelectedFormularioId] = useState<'solicitud_mantenimiento' | 'solicitud_carnet' | 'reporte_emergencia'>('solicitud_mantenimiento');

  // Modal Diseñador de Plantillas y Remitente No-Reply
  const [isEmailDesignerOpen, setIsEmailDesignerOpen] = useState(false);

  // Subpestaña para separar claramente Compra y Combustible en la categoría de Plantillas PDF
  const [plantillaSubTab, setPlantillaSubTab] = useState<'compra' | 'combustible'>('compra');

  // Configuración de Plantilla Compra / Mantenimiento
  const [compraConfig, setCompraConfig] = useState<CompraConfig>(() => {
    try {
      const cached = localStorage.getItem('cruz_verde_compra_config');
      if (cached) return { ...DEFAULT_COMPRA_CONFIG, ...JSON.parse(cached) };
    } catch (e) {}
    return DEFAULT_COMPRA_CONFIG;
  });
  const [savingCompraConfig, setSavingCompraConfig] = useState(false);

  // Configuración de Plantilla Combustible
  const [combustibleConfig, setCombustibleConfig] = useState<CombustibleConfig>(() => {
    try {
      const cached = localStorage.getItem('cruz_verde_combustible_config');
      if (cached) return { ...DEFAULT_COMBUSTIBLE_CONFIG, ...JSON.parse(cached) };
    } catch (e) {}
    return DEFAULT_COMBUSTIBLE_CONFIG;
  });
  const [savingCombustibleConfig, setSavingCombustibleConfig] = useState(false);

  // Estado general de configuración
  const [config, setConfig] = useState<any>({
    // Verificación
    verificacion_titulo: '',
    verificacion_mensaje: '',
    qr_base_url: 'https://cruzverdesv.org/miembros',
    qr_link_format: 'short',
    verificacion_fields: {
      foto: true,
      carnetId: true,
      nombre: true,
      cargoInstitucional: true,
      cargoAdministrativo: true,
      seccional: true,
      estado: true,
      dui: true,
      telefono: true,
      contactoEmergencia: true,
      email: true,
      fechaNacimiento: true,
      fechaIngreso: true,
      tipoSangre: true,
      motoristaAutorizado: true,
      licencias: true,
      cursos: true,
      carnetImagen: true
    },
    // Logos
    logos: {
      login: '/logo.png',
      dashboard: '/logo.png',
      footer: '/logo.png',
      verificacion: '/logo.png'
    },
    // Colores
    colores: {
      primary: '#001A70',
      primaryHover: '#001250'
    },
    // Notificaciones y Correo
    solicitudes_correo_destino: 'administracion@cruzverdesv.org',
    solicitudes_correo_remitente: 'sistema@cruzverdesv.org',
    solicitudes_correo_cc: 'presidencia@cruzverdesv.org',
    solicitudes_asunto_plantilla: 'Solicitud de [DIRECTOR] - Seccional [SECCIONAL] - [FECHA]',
    solicitudes_enviar_copia_solicitante: true,
    // Permisos de flota
    allow_seccional_edit_vehiculos: false,
    // Plantilla PDF Formulario Mantenimiento y Compra
    solicitudes_pdf_titulo: 'CRUZ VERDE SALVADOREÑA',
    solicitudes_pdf_departamento: 'DEPARTAMENTO ADMINISTRATIVO.',
    solicitudes_pdf_subtitulo: 'HOJA DE SOLICITUD DE COMPRA.',
    solicitudes_pdf_watermark: true,
    solicitudes_pdf_watermark_text: 'CRUZ VERDE SALVADOREÑA - DOCUMENTO OFICIAL',
    solicitudes_pdf_watermark_opacity: '0.08',
    solicitudes_pdf_mostrar_urgencia: true,
    solicitudes_pdf_mostrar_vehiculo: true,
    solicitudes_pdf_mostrar_costos: true,
    solicitudes_pdf_mostrar_proveedor: true,
    solicitudes_pdf_mostrar_fechahora: true,
    solicitudes_pdf_mostrar_contacto: true,
    solicitudes_pdf_mostrar_cotizacion: true,
    solicitudes_pdf_firma1_titulo: 'Firma: SOLICITANTE',
    solicitudes_pdf_firma1_subtitulo: 'Director de Seccional',
    solicitudes_pdf_firma2_titulo: 'Vo.Bo. Jefatura Administrativa',
    solicitudes_pdf_firma2_subtitulo: 'Administración Central',
    solicitudes_pdf_firma3_titulo: 'Autorizado Presidencia',
    solicitudes_pdf_firma3_subtitulo: 'Dirección General',
    solicitudes_pdf_pie_pagina: 'Este documento es de carácter oficial e institucional de Cruz Verde Salvadoreña. Toda adquisición o servicio debe contar con las firmas y sellos correspondientes.'
  });

  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Cargar configuración desde Supabase
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { data, error } = await supabase.from('configuracion').select('*');
        if (error) throw error;

        let newConfig = { ...config };

        if (data) {
          data.forEach(row => {
            if (row.clave === 'verificacion_titulo') newConfig.verificacion_titulo = row.valor;
            if (row.clave === 'verificacion_mensaje') newConfig.verificacion_mensaje = row.valor;
            if (row.clave === 'qr_base_url') newConfig.qr_base_url = row.valor;
            if (row.clave === 'qr_link_format') newConfig.qr_link_format = row.valor;
            if (row.clave === 'verificacion_fields') {
              let parsedFields: any = null;
              if (row.valor) {
                try { parsedFields = JSON.parse(row.valor); } catch (e) {}
              }
              if (!parsedFields && row.verificacion_fields && typeof row.verificacion_fields === 'object') {
                parsedFields = row.verificacion_fields;
              }
              if (parsedFields) {
                newConfig.verificacion_fields = { ...newConfig.verificacion_fields, ...parsedFields };
              }
            }
            if (row.clave === 'logos' && row.valor) {
              try { newConfig.logos = { ...newConfig.logos, ...JSON.parse(row.valor) }; } catch (e) {}
            }
            if (row.clave === 'colores' && row.valor) {
              try { newConfig.colores = { ...newConfig.colores, ...JSON.parse(row.valor) }; } catch (e) {}
            }
            if (row.clave === 'solicitudes_correo_destino') newConfig.solicitudes_correo_destino = row.valor;
            if (row.clave === 'solicitudes_correo_remitente') newConfig.solicitudes_correo_remitente = row.valor;
            if (row.clave === 'solicitudes_correo_cc') newConfig.solicitudes_correo_cc = row.valor;
            if (row.clave === 'solicitudes_asunto_plantilla') newConfig.solicitudes_asunto_plantilla = row.valor;
            if (row.clave === 'solicitudes_enviar_copia_solicitante') newConfig.solicitudes_enviar_copia_solicitante = row.valor !== 'false';
            if (row.clave === 'allow_seccional_edit_vehiculos') newConfig.allow_seccional_edit_vehiculos = row.valor === 'true';

            // Parámetros de Plantilla PDF
            if (row.clave === 'solicitudes_pdf_titulo') newConfig.solicitudes_pdf_titulo = row.valor;
            if (row.clave === 'solicitudes_pdf_departamento') newConfig.solicitudes_pdf_departamento = row.valor;
            if (row.clave === 'solicitudes_pdf_subtitulo') newConfig.solicitudes_pdf_subtitulo = row.valor;
            if (row.clave === 'solicitudes_pdf_watermark') newConfig.solicitudes_pdf_watermark = row.valor !== 'false';
            if (row.clave === 'solicitudes_pdf_watermark_text') newConfig.solicitudes_pdf_watermark_text = row.valor;
            if (row.clave === 'solicitudes_pdf_watermark_opacity') newConfig.solicitudes_pdf_watermark_opacity = row.valor;

            // Accesorios
            if (row.clave === 'solicitudes_pdf_mostrar_urgencia') newConfig.solicitudes_pdf_mostrar_urgencia = row.valor !== 'false';
            if (row.clave === 'solicitudes_pdf_mostrar_vehiculo') newConfig.solicitudes_pdf_mostrar_vehiculo = row.valor !== 'false';
            if (row.clave === 'solicitudes_pdf_mostrar_costos') newConfig.solicitudes_pdf_mostrar_costos = row.valor !== 'false';
            if (row.clave === 'solicitudes_pdf_mostrar_proveedor') newConfig.solicitudes_pdf_mostrar_proveedor = row.valor !== 'false';
            if (row.clave === 'solicitudes_pdf_mostrar_fechahora') newConfig.solicitudes_pdf_mostrar_fechahora = row.valor !== 'false';
            if (row.clave === 'solicitudes_pdf_mostrar_contacto') newConfig.solicitudes_pdf_mostrar_contacto = row.valor !== 'false';
            if (row.clave === 'solicitudes_pdf_mostrar_cotizacion') newConfig.solicitudes_pdf_mostrar_cotizacion = row.valor !== 'false';

            // Firmas
            if (row.clave === 'solicitudes_pdf_firma1_titulo') newConfig.solicitudes_pdf_firma1_titulo = row.valor;
            if (row.clave === 'solicitudes_pdf_firma1_subtitulo') newConfig.solicitudes_pdf_firma1_subtitulo = row.valor;
            if (row.clave === 'solicitudes_pdf_firma2_titulo') newConfig.solicitudes_pdf_firma2_titulo = row.valor;
            if (row.clave === 'solicitudes_pdf_firma2_subtitulo') newConfig.solicitudes_pdf_firma2_subtitulo = row.valor;
            if (row.clave === 'solicitudes_pdf_firma3_titulo') newConfig.solicitudes_pdf_firma3_titulo = row.valor;
            if (row.clave === 'solicitudes_pdf_firma3_subtitulo') newConfig.solicitudes_pdf_firma3_subtitulo = row.valor;
            if (row.clave === 'solicitudes_pdf_pie_pagina') newConfig.solicitudes_pdf_pie_pagina = row.valor;
          });
        }

        setConfig(newConfig);

        // Mapear configuración de Compra y Combustible
        const confMap: Record<string, string> = {};
        if (data) {
          data.forEach(r => { confMap[r.clave] = r.valor; });
        }
        try {
          const apiRes = await fetch(getApiUrl('/api/configuracion'));
          if (apiRes.ok) {
            const apiJson = await apiRes.json();
            Object.entries(apiJson).forEach(([k, v]) => {
              confMap[k] = String(v);
            });
          }
        } catch (e) {}

        // 1. Cargar Compra
        let parsedCompraBlocks = DEFAULT_COMPRA_CONFIG.pdfBloquesOrden;
        if (confMap.solicitudes_pdf_bloques_orden) {
          try { parsedCompraBlocks = JSON.parse(confMap.solicitudes_pdf_bloques_orden); } catch (e) {}
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
          pdfBloquesOrden: parsedCompraBlocks
        }));

        // 2. Cargar Combustible
        setCombustibleConfig(prev => ({
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
      } catch (error: any) {
        console.error('Error loading config:', error);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  // Subir Logo
  const uploadLogo = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `logo_${fieldName}_${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    try {
      setLoading(true);
      const { error: uploadError } = await supabase.storage
        .from('socorristas')
        .upload(`logos/${filePath}`, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('socorristas')
        .getPublicUrl(`logos/${filePath}`);

      setConfig((prev: any) => ({
        ...prev,
        logos: {
          ...prev.logos,
          [fieldName]: publicUrl
        }
      }));

      // Auto guardar el logo subido
      await saveConfigPairs([{ clave: 'logos', valor: JSON.stringify({ ...config.logos, [fieldName]: publicUrl }) }]);
      showSuccessAlert(`Logo ${fieldName} actualizado exitosamente.`);
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      alert('Error al subir logo: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Función genérica para guardar pares clave/valor en Supabase
  const saveConfigPairs = async (pairs: { clave: string; valor: string }[]) => {
    for (const pair of pairs) {
      const { data: existing } = await supabase.from('configuracion').select('id').eq('clave', pair.clave).maybeSingle();
      const payload: Record<string, any> = { valor: pair.valor };
      if (pair.clave === 'verificacion_fields') {
        try {
          payload.verificacion_fields = JSON.parse(pair.valor);
        } catch (e) {}
      }
      if (existing) {
        await supabase.from('configuracion').update(payload).eq('id', existing.id);
      } else {
        await supabase.from('configuracion').insert({ clave: pair.clave, ...payload });
      }
    }
    await refreshSettings();
  };

  const showSuccessAlert = (message: string) => {
    setSaveSuccessMsg(message);
    setTimeout(() => {
      setSaveSuccessMsg(null);
    }, 4000);
  };

  // Guardar configuración de Solicitud de Compra / Mantenimiento
  const handleSaveCompraConfig = async (newConfig: CompraConfig) => {
    setSavingCompraConfig(true);
    try {
      setCompraConfig(newConfig);
      try {
        localStorage.setItem('cruz_verde_compra_config', JSON.stringify(newConfig));
      } catch (e) {}

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

      try {
        const confObj: Record<string, string> = {};
        entries.forEach(e => { confObj[e.clave] = e.valor; });
        await fetch(getApiUrl('/api/configuracion'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(confObj)
        });
      } catch (errApi) {
        console.warn('Error backend API config:', errApi);
      }

      try {
        for (const item of entries) {
          await supabase.from('configuracion').upsert(item, { onConflict: 'clave' });
        }
      } catch (errSupabase) {
        console.warn('Error supabase config:', errSupabase);
      }

      await logActivity('Actualizó configuración de plantilla de compras/mantenimiento', 'Configuracion', 'plantilla_compras');
      showSuccessAlert('Plantilla de Solicitud de Compra y Mantenimiento guardada exitosamente.');
      await refreshSettings();
    } catch (err: any) {
      alert('Error guardando plantilla de compras: ' + err.message);
    } finally {
      setSavingCompraConfig(false);
    }
  };

  // Guardar configuración de Solicitud de Vales de Combustible
  const handleSaveCombustibleConfig = async (newConfig: CombustibleConfig) => {
    setSavingCombustibleConfig(true);
    try {
      setCombustibleConfig(newConfig);
      try {
        localStorage.setItem('cruz_verde_combustible_config', JSON.stringify(newConfig));
      } catch (e) {}

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

      try {
        const confObj: Record<string, string> = {};
        entries.forEach(e => { confObj[e.clave] = e.valor; });
        await fetch(getApiUrl('/api/configuracion'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(confObj)
        });
      } catch (errApi) {
        console.warn('Error backend API config:', errApi);
      }

      try {
        for (const item of entries) {
          await supabase.from('configuracion').upsert(item, { onConflict: 'clave' });
        }
      } catch (errSupabase) {
        console.warn('Error supabase config:', errSupabase);
      }

      await logActivity('Actualizó plantilla y configuración de combustible', 'Configuracion', 'plantilla_combustible');
      showSuccessAlert('Plantilla de Solicitud de Vales de Combustible guardada exitosamente.');
      await refreshSettings();
    } catch (err: any) {
      alert('Error guardando plantilla de combustible: ' + err.message);
    } finally {
      setSavingCombustibleConfig(false);
    }
  };

  // 1. Guardar Plantilla de Formulario y PDF
  const handleSavePlantilla = async () => {
    setSavingSection('plantilla');
    try {
      const pairs = [
        { clave: 'solicitudes_pdf_titulo', valor: config.solicitudes_pdf_titulo },
        { clave: 'solicitudes_pdf_departamento', valor: config.solicitudes_pdf_departamento },
        { clave: 'solicitudes_pdf_subtitulo', valor: config.solicitudes_pdf_subtitulo },
        { clave: 'solicitudes_pdf_watermark', valor: String(config.solicitudes_pdf_watermark) },
        { clave: 'solicitudes_pdf_watermark_text', valor: config.solicitudes_pdf_watermark_text },
        { clave: 'solicitudes_pdf_watermark_opacity', valor: config.solicitudes_pdf_watermark_opacity || '0.08' },
        { clave: 'solicitudes_pdf_mostrar_urgencia', valor: String(config.solicitudes_pdf_mostrar_urgencia) },
        { clave: 'solicitudes_pdf_mostrar_vehiculo', valor: String(config.solicitudes_pdf_mostrar_vehiculo) },
        { clave: 'solicitudes_pdf_mostrar_costos', valor: String(config.solicitudes_pdf_mostrar_costos) },
        { clave: 'solicitudes_pdf_mostrar_proveedor', valor: String(config.solicitudes_pdf_mostrar_proveedor) },
        { clave: 'solicitudes_pdf_mostrar_fechahora', valor: String(config.solicitudes_pdf_mostrar_fechahora) },
        { clave: 'solicitudes_pdf_mostrar_contacto', valor: String(config.solicitudes_pdf_mostrar_contacto) },
        { clave: 'solicitudes_pdf_mostrar_cotizacion', valor: String(config.solicitudes_pdf_mostrar_cotizacion) },
        { clave: 'solicitudes_pdf_firma1_titulo', valor: config.solicitudes_pdf_firma1_titulo },
        { clave: 'solicitudes_pdf_firma1_subtitulo', valor: config.solicitudes_pdf_firma1_subtitulo },
        { clave: 'solicitudes_pdf_firma2_titulo', valor: config.solicitudes_pdf_firma2_titulo },
        { clave: 'solicitudes_pdf_firma2_subtitulo', valor: config.solicitudes_pdf_firma2_subtitulo },
        { clave: 'solicitudes_pdf_firma3_titulo', valor: config.solicitudes_pdf_firma3_titulo },
        { clave: 'solicitudes_pdf_firma3_subtitulo', valor: config.solicitudes_pdf_firma3_subtitulo },
        { clave: 'solicitudes_pdf_pie_pagina', valor: config.solicitudes_pdf_pie_pagina }
      ];

      await saveConfigPairs(pairs);
      await logActivity('Actualizó plantilla de solicitud de mantenimiento y PDF', 'Configuración', 'plantilla_pdf');
      showSuccessAlert('Plantilla de Solicitud de Mantenimiento y Formato PDF guardada exitosamente.');
    } catch (err: any) {
      console.error(err);
      alert('Error guardando plantilla: ' + (err.message || 'Error desconocido'));
    } finally {
      setSavingSection(null);
    }
  };

  // 2. Guardar Notificaciones y Correo
  const handleSaveCorreo = async () => {
    setSavingSection('correo');
    try {
      const pairs = [
        { clave: 'solicitudes_correo_destino', valor: config.solicitudes_correo_destino },
        { clave: 'solicitudes_correo_remitente', valor: config.solicitudes_correo_remitente },
        { clave: 'solicitudes_correo_cc', valor: config.solicitudes_correo_cc },
        { clave: 'solicitudes_asunto_plantilla', valor: config.solicitudes_asunto_plantilla },
        { clave: 'solicitudes_enviar_copia_solicitante', valor: String(config.solicitudes_enviar_copia_solicitante) }
      ];

      await saveConfigPairs(pairs);
      await logActivity('Actualizó configuración de correo para solicitudes', 'Configuración', 'correo');
      showSuccessAlert('Configuración de notificaciones por correo guardada exitosamente.');
    } catch (err: any) {
      console.error(err);
      alert('Error guardando configuración de correo: ' + (err.message || 'Error desconocido'));
    } finally {
      setSavingSection(null);
    }
  };

  // 3. Guardar Permisos de Flota
  const handleSaveFlota = async () => {
    setSavingSection('flota');
    try {
      const pairs = [
        { clave: 'allow_seccional_edit_vehiculos', valor: String(config.allow_seccional_edit_vehiculos) }
      ];

      await saveConfigPairs(pairs);
      await logActivity('Actualizó permisos de flota para usuarios de seccional', 'Configuración', 'flota');
      showSuccessAlert('Permisos de flota vehicular guardados exitosamente.');
    } catch (err: any) {
      console.error(err);
      alert('Error guardando permisos de flota: ' + (err.message || 'Error desconocido'));
    } finally {
      setSavingSection(null);
    }
  };

  // 4. Guardar Verificación de Carnet
  const handleSaveVerificacion = async () => {
    setSavingSection('verificacion');
    try {
      const pairs = [
        { clave: 'verificacion_titulo', valor: config.verificacion_titulo },
        { clave: 'verificacion_mensaje', valor: config.verificacion_mensaje },
        { clave: 'verificacion_fields', valor: JSON.stringify(config.verificacion_fields) },
        { clave: 'qr_base_url', valor: config.qr_base_url || 'https://cruzverdesv.org/miembros' },
        { clave: 'qr_link_format', valor: config.qr_link_format || 'short' }
      ];

      await saveConfigPairs(pairs);

      // Asegurar actualización directa con JSON en Supabase
      try {
        await supabase
          .from('configuracion')
          .update({
            valor: JSON.stringify(config.verificacion_fields || {}),
            verificacion_fields: config.verificacion_fields || {}
          })
          .eq('clave', 'verificacion_fields');
      } catch (err) {
        console.warn('Sync directo verificacion_fields:', err);
      }

      // Sincronizar también con backend API si existe
      try {
        await fetch(getApiUrl('/api/configuracion'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            verificacion_titulo: config.verificacion_titulo,
            verificacion_mensaje: config.verificacion_mensaje,
            verificacion_fields: config.verificacion_fields,
            qr_base_url: config.qr_base_url,
            qr_link_format: config.qr_link_format
          })
        });
      } catch (e) {}

      // Subir public config json para acceso público sin login
      try {
        const publicConfig = {
          verificacion_titulo: config.verificacion_titulo,
          verificacion_mensaje: config.verificacion_mensaje,
          verificacion_fields: config.verificacion_fields,
          qr_base_url: config.qr_base_url || 'https://cruzverdesv.org/miembros',
          qr_link_format: config.qr_link_format || 'short',
          logos: config.logos,
          colores: config.colores
        };
        const configBlob = new Blob([JSON.stringify(publicConfig)], { type: 'application/json' });
        await supabase.storage.from('socorristas').upload('public_config.json', configBlob, {
          upsert: true,
          contentType: 'application/json'
        });
      } catch (e) {}

      await logActivity('Actualizó configuración de verificación de carnet', 'Configuración', 'verificacion');
      showSuccessAlert('Configuración de verificación de carnet guardada exitosamente.');
    } catch (err: any) {
      console.error(err);
      alert('Error guardando verificación: ' + (err.message || 'Error desconocido'));
    } finally {
      setSavingSection(null);
    }
  };

  // 5. Guardar Logos e Identidad
  const handleSaveIdentidad = async () => {
    setSavingSection('identidad');
    try {
      const pairs = [
        { clave: 'logos', valor: JSON.stringify(config.logos) },
        { clave: 'colores', valor: JSON.stringify(config.colores) }
      ];

      await saveConfigPairs(pairs);
      await logActivity('Actualizó logos y colores institucionales', 'Configuración', 'identidad');
      showSuccessAlert('Identidad visual y colores guardados exitosamente.');
    } catch (err: any) {
      console.error(err);
      alert('Error guardando identidad visual: ' + (err.message || 'Error desconocido'));
    } finally {
      setSavingSection(null);
    }
  };

  if (loading && !config.verificacion_titulo && !config.solicitudes_pdf_titulo) {
    return (
      <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-primary mb-3" />
        <p className="text-sm font-medium">Cargando configuración institucional...</p>
      </div>
    );
  }

  const CATEGORIES = [
    { 
      id: 'plantillas', 
      label: 'Plantillas PDF', 
      icon: FileText,
      iconColor: 'bg-blue-500 text-white'
    },
    { 
      id: 'correo', 
      label: 'Notificaciones', 
      icon: Mail, 
      iconColor: 'bg-emerald-500 text-white'
    },
    { 
      id: 'flota', 
      label: 'Flota Vehicular', 
      icon: Truck, 
      iconColor: 'bg-amber-500 text-white'
    },
    { 
      id: 'verificacion', 
      label: 'Verificación QR', 
      icon: Info, 
      iconColor: 'bg-indigo-500 text-white'
    },
    { 
      id: 'colores', 
      label: 'Colores del Sistema', 
      icon: Palette, 
      iconColor: 'bg-emerald-600 text-white'
    },
    { 
      id: 'identidad', 
      label: 'Logotipos Institucionales', 
      icon: ImageIcon, 
      iconColor: 'bg-rose-500 text-white'
    }
  ];

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* Encabezado Estilo Apple */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Configuración
          </h1>
          <p className="mt-0.5 text-xs text-gray-500">
            Preferencias del sistema y personalización institucional
          </p>
        </div>

        {/* Acciones del Encabezado */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsEmailDesignerOpen(true)}
            className="inline-flex items-center px-3.5 py-1.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <Palette className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
            Diseño de Correos (No-Reply)
          </button>

          {/* Notificación Flotante de Éxito */}
          {saveSuccessMsg && (
            <div className="bg-emerald-50 border border-emerald-200/80 text-emerald-800 px-3 py-1.5 rounded-xl text-xs font-medium flex items-center shadow-xs animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mr-1.5 shrink-0" />
              {saveSuccessMsg}
            </div>
          )}
        </div>
      </div>

      {/* Segmented Control Estilo Apple */}
      <div className="bg-slate-200/60 p-1 rounded-2xl flex flex-wrap gap-1 border border-slate-200/80">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const isSelected = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`flex-1 min-w-[140px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isSelected
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/40'
              }`}
            >
              <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${cat.iconColor}`}>
                <Icon className="w-3 h-3" />
              </span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 1. MÓDULO: PLANTILLAS DE FORMULARIOS Y PDFS (APPLE DESIGN)                */}
      {/* ========================================================================= */}
      {activeCategory === 'plantillas' && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* Selector Segmentado Superior: Compra / Mantenimiento vs Vales de Combustible */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Plantillas Oficiales de Formatos y PDF</h2>
                <p className="text-xs text-gray-500">Configuración separada de documentos PDF, imágenes, orden de bloques y membretes</p>
              </div>
            </div>

            {/* Segmented Control Estilo Apple Settings */}
            <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200/60 shadow-2xs">
              <button
                type="button"
                onClick={() => setPlantillaSubTab('compra')}
                className={`inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  plantillaSubTab === 'compra'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShoppingCart className="w-4 h-4 mr-2 text-emerald-600" />
                1. Solicitud de Compra / Mantenimiento
              </button>

              <button
                type="button"
                onClick={() => setPlantillaSubTab('combustible')}
                className={`inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  plantillaSubTab === 'combustible'
                    ? 'bg-white text-amber-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Fuel className="w-4 h-4 mr-2 text-amber-600" />
                2. Solicitud de Vales de Combustible
              </button>
            </div>
          </div>

          {/* Renderizado de Configuración Separada por Tipo de Solicitud */}
          {plantillaSubTab === 'compra' ? (
            <div className="animate-in fade-in duration-200">
              <CompraTemplateConfig
                config={compraConfig}
                onSave={handleSaveCompraConfig}
                saving={savingCompraConfig}
              />
            </div>
          ) : (
            <div className="animate-in fade-in duration-200">
              <CombustibleTemplateConfig
                config={combustibleConfig}
                onSave={handleSaveCombustibleConfig}
                saving={savingCombustibleConfig}
              />
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MÓDULO: NOTIFICACIONES Y CORREO CENTRALIZADO                            */}
      {/* ========================================================================= */}
      {activeCategory === 'correo' && (
        <div className="animate-in fade-in">
          <ConfiguracionCorreos />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MÓDULO: PERMISOS DE FLOTA VEHICULAR                                    */}
      {/* ========================================================================= */}
      {activeCategory === 'flota' && (
        <div className="max-w-3xl space-y-4 animate-in fade-in">
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">
                    Permisos de Flota Vehicular
                  </h2>
                  <p className="text-xs text-gray-500">
                    Control de edición y registro de unidades para seccionales
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 flex items-center justify-between">
              <div className="pr-4">
                <span className="text-xs font-semibold text-gray-900 block">
                  Edición de unidades por directores de seccional
                </span>
                <span className="text-2xs text-gray-500 block mt-0.5">
                  {config.allow_seccional_edit_vehiculos
                    ? 'Activado: Las seccionales pueden agregar unidades y editar kilometrajes'
                    : 'Desactivado (Recomendado): Las seccionales sólo tienen lectura y canalizan solicitudes'}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={!!config.allow_seccional_edit_vehiculos}
                  onChange={(e) => setConfig({ ...config, allow_seccional_edit_vehiculos: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={handleSaveFlota}
                disabled={savingSection === 'flota'}
                className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 mr-1.5" />
                {savingSection === 'flota' ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MÓDULO: VERIFICACIÓN DE CARNET Y CÓDIGOS QR                             */}
      {/* ========================================================================= */}
      {activeCategory === 'verificacion' && (
        <div className="max-w-4xl space-y-5 animate-in fade-in">
          {/* Tarjeta 1: Parámetros Generales y Enlace QR */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">
                    Verificación Pública de Carnet y Configuración QR
                  </h2>
                  <p className="text-xs text-gray-500">
                    Controla los enlaces oficiales y la información visible al consultar un carnet
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                    Título de la Pantalla de Verificación
                  </label>
                  <input
                    type="text"
                    value={config.verificacion_titulo || ''}
                    onChange={(e) => setConfig({ ...config, verificacion_titulo: e.target.value })}
                    className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    placeholder="Cruz Verde Salvadoreña - Verificación Oficial"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                    Dominio Oficial para Códigos QR
                  </label>
                  <input
                    type="text"
                    value={config.qr_base_url || 'https://cruzverdesv.org/miembros'}
                    onChange={(e) => setConfig({ ...config, qr_base_url: e.target.value })}
                    className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    placeholder="https://cruzverdesv.org/miembros"
                  />
                  <p className="text-3xs text-gray-500 mt-1">
                    Evita enlaces largos y autenticación de Google al escanear desde cualquier teléfono celular.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-2xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                  Mensaje Institucional de Autenticidad
                </label>
                <textarea
                  rows={2}
                  value={config.verificacion_mensaje || ''}
                  onChange={(e) => setConfig({ ...config, verificacion_mensaje: e.target.value })}
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-gray-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  placeholder="Este carnet es auténtico y pertenece a un elemento activo de la institución..."
                />
              </div>

              {/* Vista previa del enlace generado */}
              <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-xs text-emerald-900 font-medium">Enlace Oficial de Escaneo:</span>
                  <code className="text-xs font-mono bg-white px-2 py-0.5 rounded border border-emerald-200 text-emerald-800 font-bold">
                    {(config.qr_base_url || 'https://cruzverdesv.org/miembros').replace(/\/$/, '')}/v/CV-1024
                  </code>
                </div>
                <span className="text-3xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                  Acceso Público Sin Login
                </span>
              </div>
            </div>
          </div>

          {/* Tarjeta 2: Selección Detallada de Campos del Perfil */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Campos y Datos Visibles al Consultar el Perfil
                </h3>
                <p className="text-xs text-gray-500">
                  Selecciona de forma individual cada elemento que se mostrará al escanear el carnet
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const allTrue: Record<string, boolean> = {};
                    ['foto', 'carnetId', 'nombre', 'cargoInstitucional', 'cargoAdministrativo', 'seccional', 'estado', 'dui', 'telefono', 'contactoEmergencia', 'email', 'fechaNacimiento', 'fechaIngreso', 'tipoSangre', 'motoristaAutorizado', 'licencias', 'cursos', 'carnetImagen'].forEach(k => { allTrue[k] = true; });
                    setConfig({ ...config, verificacion_fields: allTrue });
                  }}
                  className="px-2.5 py-1 text-2xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                >
                  Marcar Todos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const allFalse: Record<string, boolean> = {};
                    ['foto', 'carnetId', 'nombre', 'cargoInstitucional', 'cargoAdministrativo', 'seccional', 'estado', 'dui', 'telefono', 'contactoEmergencia', 'email', 'fechaNacimiento', 'fechaIngreso', 'tipoSangre', 'motoristaAutorizado', 'licencias', 'cursos', 'carnetImagen'].forEach(k => { allFalse[k] = false; });
                    setConfig({ ...config, verificacion_fields: allFalse });
                  }}
                  className="px-2.5 py-1 text-2xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Desmarcar Todos
                </button>
              </div>
            </div>

            <div className="p-5 space-y-6">
              {/* Sección 1: Identificación Oficial */}
              <div>
                <h4 className="text-2xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>1. Identificación y Estado Institucional</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {[
                    { id: 'foto', label: 'Fotografía Oficial', desc: 'Foto de perfil del socorrista' },
                    { id: 'nombre', label: 'Nombre Completo', desc: 'Nombres y apellidos del titular' },
                    { id: 'carnetId', label: 'Número de Carnet', desc: 'Código oficial (ej: CV-1024)' },
                    { id: 'cargoInstitucional', label: 'Rango / Cargo', desc: 'Socorrista, TEM, Rescatista' },
                    { id: 'cargoAdministrativo', label: 'Cargo Administrativo', desc: 'Jefatura, coordinador, etc.' },
                    { id: 'seccional', label: 'Seccional o Filial', desc: 'Base o filial asignada' },
                    { id: 'estado', label: 'Estado de Membresía', desc: 'Insignia Activo o Inactivo' },
                  ].map(f => {
                    const isChecked = config.verificacion_fields?.[f.id] !== false;
                    return (
                      <label key={f.id} className={`flex items-start space-x-3 p-3 rounded-xl border transition-all cursor-pointer ${isChecked ? 'bg-emerald-50/40 border-emerald-200' : 'bg-slate-50/50 border-slate-200 opacity-60'}`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => setConfig((prev: any) => ({
                            ...prev,
                            verificacion_fields: { ...prev.verificacion_fields, [f.id]: !isChecked }
                          }))}
                          className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                        />
                        <div className="flex-1">
                          <span className="block text-xs font-bold text-gray-900">{f.label}</span>
                          <span className="text-3xs text-gray-500 leading-tight block mt-0.5">{f.desc}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Sección 2: Datos Personales y de Contacto */}
              <div>
                <h4 className="text-2xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  <span>2. Datos Personales y de Contacto</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {[
                    { id: 'dui', label: 'Documento DUI', desc: 'Número de documento de identidad' },
                    { id: 'telefono', label: 'Teléfono Móvil', desc: 'Contacto telefónico oficial' },
                    { id: 'contactoEmergencia', label: 'Contacto de Emergencia', desc: 'Números de teléfono para avisos de emergencia' },
                    { id: 'email', label: 'Correo Electrónico', desc: 'Dirección de email registrada' },
                    { id: 'fechaNacimiento', label: 'Fecha de Nacimiento', desc: 'Día de nacimiento / cumpleaños' },
                    { id: 'fechaIngreso', label: 'Fecha de Ingreso', desc: 'Antigüedad en la institución' },
                    { id: 'tipoSangre', label: 'Tipo de Sangre', desc: 'Grupo sanguíneo y factor RH' },
                  ].map(f => {
                    const isChecked = config.verificacion_fields?.[f.id] !== false;
                    return (
                      <label key={f.id} className={`flex items-start space-x-3 p-3 rounded-xl border transition-all cursor-pointer ${isChecked ? 'bg-blue-50/40 border-blue-200' : 'bg-slate-50/50 border-slate-200 opacity-60'}`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => setConfig((prev: any) => ({
                            ...prev,
                            verificacion_fields: { ...prev.verificacion_fields, [f.id]: !isChecked }
                          }))}
                          className="mt-0.5 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <span className="block text-xs font-bold text-gray-900">{f.label}</span>
                          <span className="text-3xs text-gray-500 leading-tight block mt-0.5">{f.desc}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Sección 3: Conducción, Cursos y Credencial Digital */}
              <div>
                <h4 className="text-2xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                  <span>3. Conducción, Capacitación y Credencial Digital</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {[
                    { id: 'motoristaAutorizado', label: 'Autorización de Manejo', desc: 'Conductor autorizado de ambulancias' },
                    { id: 'licencias', label: 'Licencias de Conducir', desc: 'Clase y números de licencia' },
                    { id: 'cursos', label: 'Cursos Realizados', desc: 'Lista de certificaciones y cursos' },
                    { id: 'carnetImagen', label: 'Copia Digital del Carnet', desc: 'Imagen protegida con marca de agua' },
                  ].map(f => {
                    const isChecked = config.verificacion_fields?.[f.id] !== false;
                    return (
                      <label key={f.id} className={`flex items-start space-x-3 p-3 rounded-xl border transition-all cursor-pointer ${isChecked ? 'bg-purple-50/40 border-purple-200' : 'bg-slate-50/50 border-slate-200 opacity-60'}`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => setConfig((prev: any) => ({
                            ...prev,
                            verificacion_fields: { ...prev.verificacion_fields, [f.id]: !isChecked }
                          }))}
                          className="mt-0.5 w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                        />
                        <div className="flex-1">
                          <span className="block text-xs font-bold text-gray-900">{f.label}</span>
                          <span className="text-3xs text-gray-500 leading-tight block mt-0.5">{f.desc}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-5 py-4 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                Los cambios se reflejarán de inmediato en todos los carnets físicos y digitales al ser escaneados.
              </span>
              <button
                type="button"
                onClick={handleSaveVerificacion}
                disabled={savingSection === 'verificacion'}
                className="inline-flex items-center px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4 mr-2" />
                {savingSection === 'verificacion' ? 'Guardando Ajustes...' : 'Guardar Ajustes de Verificación y QR'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MÓDULO: PERSONALIZACIÓN DE COLORES DEL SISTEMA                         */}
      {/* ========================================================================= */}
      {activeCategory === 'colores' && (
        <PersonalizacionColores />
      )}

      {/* ========================================================================= */}
      {/* 6. MÓDULO: LOGOTIPOS INSTITUCIONALES                                      */}
      {/* ========================================================================= */}
      {activeCategory === 'identidad' && (
        <div className="max-w-3xl space-y-4 animate-in fade-in">
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">
                  Logotipos Institucionales
                </h2>
                <p className="text-xs text-gray-500">
                  Imágenes y emblemas para pantalla de login, menú principal y verificación QR
                </p>
              </div>
            </div>

            {/* Logos */}
            <div className="divide-y divide-slate-100">
              {[
                { key: 'login', label: 'Logo Login', desc: 'Pantalla de acceso público' },
                { key: 'dashboard', label: 'Logo Barra Lateral', desc: 'Menú principal del sistema' },
                { key: 'verificacion', label: 'Logo Carnet', desc: 'Verificación pública QR' }
              ].map(item => (
                <div key={item.key} className="p-4 sm:px-6 flex items-center justify-between gap-4">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center overflow-hidden border border-slate-200/80 shrink-0 p-1">
                      <img src={config.logos[item.key] || '/logo.png'} alt={item.label} className="max-w-full max-h-full object-contain" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-900 block">{item.label}</span>
                      <span className="text-2xs text-gray-400 block">{item.desc}</span>
                    </div>
                  </div>
                  <label className="inline-flex cursor-pointer items-center px-3 py-1.5 border border-slate-200 rounded-lg text-2xs font-semibold text-gray-700 bg-white hover:bg-slate-50 transition-all shadow-2xs">
                    <span>Cambiar imagen</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadLogo(e, item.key)} />
                  </label>
                </div>
              ))}
            </div>

            <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
              <span className="text-2xs text-gray-400">Formatos recomendados: PNG o WebP con fondo transparente.</span>
              <button
                type="button"
                onClick={handleSaveIdentidad}
                disabled={savingSection === 'identidad'}
                className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 mr-1.5" />
                {savingSection === 'identidad' ? 'Guardando...' : 'Guardar Logotipos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Diseñador de Plantillas y Remitente No-Reply */}
      <ModalDisenadorCorreos
        isOpen={isEmailDesignerOpen}
        onClose={() => setIsEmailDesignerOpen(false)}
        onSaved={() => refreshSettings()}
      />

    </div>
  );
}
