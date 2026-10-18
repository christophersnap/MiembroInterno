import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Save, Settings, Info, Palette, Image as ImageIcon, Mail, FileText, Truck, 
  Shield, CheckCircle2, Eye, RefreshCw, AlertCircle, Printer, Sparkles, Check
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/logger';
import { useSettings } from '../contexts/SettingsContext';
import ConfiguracionCorreos from '../components/configuracion/ConfiguracionCorreos';
import ModalDisenadorCorreos from '../components/configuracion/ModalDisenadorCorreos';
import PersonalizacionColores from '../components/configuracion/PersonalizacionColores';

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

  // Estado general de configuración
  const [config, setConfig] = useState<any>({
    // Verificación
    verificacion_titulo: '',
    verificacion_mensaje: '',
    verificacion_fields: {
      dui: true,
      seccional: true,
      cargoInstitucional: true,
      cargoAdministrativo: true,
      fechaIngreso: true,
      fechaNacimiento: true,
      telefono: true,
      cursos: true,
      tipoSangre: true,
      email: true
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
            if (row.clave === 'verificacion_fields' && row.verificacion_fields) {
              newConfig.verificacion_fields = row.verificacion_fields;
            } else if (row.clave === 'verificacion_fields' && row.valor) {
              try { newConfig.verificacion_fields = { ...newConfig.verificacion_fields, ...JSON.parse(row.valor) }; } catch (e) {}
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
      } catch (err) {
        console.error('Error cargando configuración:', err);
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
      if (existing) {
        await supabase.from('configuracion').update({ valor: pair.valor }).eq('id', existing.id);
      } else {
        await supabase.from('configuracion').insert({ clave: pair.clave, valor: pair.valor });
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
        { clave: 'verificacion_fields', valor: JSON.stringify(config.verificacion_fields) }
      ];

      await saveConfigPairs(pairs);

      // Subir public config json para acceso público sin login
      try {
        const publicConfig = {
          verificacion_titulo: config.verificacion_titulo,
          verificacion_mensaje: config.verificacion_mensaje,
          verificacion_fields: config.verificacion_fields,
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
          
          {/* Selector de Formulario - Estilo Apple Inset */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Plantillas Oficiales de Formatos y PDF</h2>
                <p className="text-xs text-gray-500">Hoja membretada, marcas de agua de seguridad y estructura de firmas</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={selectedFormularioId}
                onChange={(e) => setSelectedFormularioId(e.target.value as any)}
                aria-label="Seleccionar plantilla oficial"
                className="px-3.5 py-2 text-xs font-semibold bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl text-gray-900 shadow-2xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors cursor-pointer"
              >
                <option value="solicitud_mantenimiento">Solicitud de Mantenimiento / Compra (Flota)</option>
                <option value="solicitud_carnet" disabled>Solicitud de Carnets (Próximamente)</option>
                <option value="reporte_emergencia" disabled>Informe de Emergencia (Próximamente)</option>
              </select>
            </div>
          </div>

          {/* Panel Dividido: Controles a la Izquierda, Previsualización en Vivo a la Derecha */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LADO IZQUIERDO: CONTROLES DE LA PLANTILLA (ESTILO APPLE SETTINGS) */}
            <div className="lg:col-span-6 space-y-4">
              
              {/* 1. Encabezado y Membrete */}
              <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-lg bg-blue-500 text-white flex items-center justify-center shadow-xs">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-gray-900">Encabezado y Títulos</h3>
                      <p className="text-3xs text-gray-500">Membrete oficial que se imprime al tope del documento</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-3 bg-slate-50/40">
                  <div>
                    <label className="block text-2xs font-medium text-gray-600 mb-1">Título Institucional Superior</label>
                    <input
                      type="text"
                      value={config.solicitudes_pdf_titulo || ''}
                      onChange={(e) => setConfig({ ...config, solicitudes_pdf_titulo: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-semibold uppercase bg-white border border-slate-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-2xs"
                      placeholder="CRUZ VERDE SALVADOREÑA"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-2xs font-medium text-gray-600 mb-1">Departamento Emisor</label>
                      <input
                        type="text"
                        value={config.solicitudes_pdf_departamento || ''}
                        onChange={(e) => setConfig({ ...config, solicitudes_pdf_departamento: e.target.value })}
                        className="w-full px-3 py-2 text-xs uppercase bg-white border border-slate-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-2xs"
                        placeholder="DEPARTAMENTO ADMINISTRATIVO."
                      />
                    </div>
                    <div>
                      <label className="block text-2xs font-medium text-gray-600 mb-1">Nombre de la Hoja / Subtítulo</label>
                      <input
                        type="text"
                        value={config.solicitudes_pdf_subtitulo || ''}
                        onChange={(e) => setConfig({ ...config, solicitudes_pdf_subtitulo: e.target.value })}
                        className="w-full px-3 py-2 text-xs font-semibold uppercase bg-white border border-slate-200 rounded-xl text-blue-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-2xs"
                        placeholder="HOJA DE SOLICITUD DE COMPRA."
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Marca de Agua Oficial */}
              <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500 text-white flex items-center justify-center shadow-xs">
                      <Eye className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-gray-900">Marca de Agua de Seguridad</h3>
                      <p className="text-3xs text-gray-500">Impresión diagonal translúcida de autenticidad</p>
                    </div>
                  </div>
                  {/* Switch iOS */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.solicitudes_pdf_watermark !== false}
                      onChange={(e) => setConfig({ ...config, solicitudes_pdf_watermark: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {config.solicitudes_pdf_watermark !== false && (
                  <div className="p-4 bg-slate-50/40 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in">
                    <div className="sm:col-span-2">
                      <label className="block text-2xs font-medium text-gray-600 mb-1">Texto de Seguridad</label>
                      <input
                        type="text"
                        value={config.solicitudes_pdf_watermark_text || ''}
                        onChange={(e) => setConfig({ ...config, solicitudes_pdf_watermark_text: e.target.value })}
                        className="w-full px-3 py-2 text-xs uppercase bg-white border border-slate-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-2xs"
                        placeholder="CRUZ VERDE SALVADOREÑA"
                      />
                    </div>
                    <div>
                      <label className="block text-2xs font-medium text-gray-600 mb-1">Intensidad</label>
                      <select
                        value={config.solicitudes_pdf_watermark_opacity || '0.08'}
                        onChange={(e) => setConfig({ ...config, solicitudes_pdf_watermark_opacity: e.target.value })}
                        aria-label="Intensidad de la marca de agua"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-2xs cursor-pointer"
                      >
                        <option value="0.04">Tenue (4%)</option>
                        <option value="0.08">Estándar (8%)</option>
                        <option value="0.14">Fuerte (14%)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Accesorios y Campos Visibles en la Hoja */}
              <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                      <Shield className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-gray-900">Campos y Secciones a Imprimir</h3>
                      <p className="text-3xs text-gray-500">Activa o desactiva elementos según el protocolo</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50/40 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { key: 'solicitudes_pdf_mostrar_urgencia', label: 'Nivel de Prioridad / Urgencia', desc: 'Indica urgencia en la cabecera' },
                    { key: 'solicitudes_pdf_mostrar_vehiculo', label: 'Placa y Datos de Vehículo', desc: 'Unidad de flota involucrada' },
                    { key: 'solicitudes_pdf_mostrar_costos', label: 'Monto Estimado ($ USD)', desc: 'Costo calculado para compra' },
                    { key: 'solicitudes_pdf_mostrar_proveedor', label: 'Taller o Proveedor Sugerido', desc: 'Recomendación del técnico' },
                    { key: 'solicitudes_pdf_mostrar_fechahora', label: 'Hora Oficial El Salvador', desc: 'Estampa temporal de emisión' },
                    { key: 'solicitudes_pdf_mostrar_cotizacion', label: 'Líneas de Cotización', desc: 'Espacio para adjuntos/cotización' },
                  ].map((field) => {
                    const isChecked = (config as any)[field.key] !== false;
                    return (
                      <div
                        key={field.key}
                        onClick={() => setConfig({ ...config, [field.key]: !isChecked })}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isChecked
                            ? 'bg-white border-slate-200/90 shadow-2xs'
                            : 'bg-transparent border-transparent opacity-60 hover:opacity-100'
                        }`}
                      >
                        <div className="pr-2">
                          <span className="text-xs font-medium text-gray-800 block">{field.label}</span>
                          <span className="text-3xs text-gray-400 block">{field.desc}</span>
                        </div>
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                          isChecked ? 'bg-emerald-500 text-white' : 'border border-slate-300 text-transparent'
                        }`}>
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. Firmas y Autorizaciones */}
              <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-lg bg-violet-500 text-white flex items-center justify-center shadow-xs">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-gray-900">Firmas y Pie del Documento</h3>
                      <p className="text-3xs text-gray-500">Títulos de cargos para los 3 bloques de aprobación</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-3 bg-slate-50/40">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Firma 1 */}
                    <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5">
                      <span className="text-3xs font-semibold uppercase tracking-wider text-gray-400 block">Firma 1 (Emisor)</span>
                      <input
                        type="text"
                        value={config.solicitudes_pdf_firma1_titulo || ''}
                        onChange={(e) => setConfig({ ...config, solicitudes_pdf_firma1_titulo: e.target.value })}
                        placeholder="SOLICITANTE"
                        className="w-full px-2 py-1 text-2xs font-semibold uppercase bg-slate-50 border border-slate-200 rounded-lg text-gray-800 focus:bg-white outline-none"
                      />
                      <input
                        type="text"
                        value={config.solicitudes_pdf_firma1_subtitulo || ''}
                        onChange={(e) => setConfig({ ...config, solicitudes_pdf_firma1_subtitulo: e.target.value })}
                        placeholder="Director Seccional"
                        className="w-full px-2 py-1 text-3xs bg-slate-50 border border-slate-200 rounded-lg text-gray-500 focus:bg-white outline-none"
                      />
                    </div>

                    {/* Firma 2 */}
                    <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5">
                      <span className="text-3xs font-semibold uppercase tracking-wider text-gray-400 block">Firma 2 (Revisor)</span>
                      <input
                        type="text"
                        value={config.solicitudes_pdf_firma2_titulo || ''}
                        onChange={(e) => setConfig({ ...config, solicitudes_pdf_firma2_titulo: e.target.value })}
                        placeholder="Vo.Bo. JEFATURA"
                        className="w-full px-2 py-1 text-2xs font-semibold uppercase bg-slate-50 border border-slate-200 rounded-lg text-gray-800 focus:bg-white outline-none"
                      />
                      <input
                        type="text"
                        value={config.solicitudes_pdf_firma2_subtitulo || ''}
                        onChange={(e) => setConfig({ ...config, solicitudes_pdf_firma2_subtitulo: e.target.value })}
                        placeholder="Administración Central"
                        className="w-full px-2 py-1 text-3xs bg-slate-50 border border-slate-200 rounded-lg text-gray-500 focus:bg-white outline-none"
                      />
                    </div>

                    {/* Firma 3 */}
                    <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5">
                      <span className="text-3xs font-semibold uppercase tracking-wider text-gray-400 block">Firma 3 (Aprobador)</span>
                      <input
                        type="text"
                        value={config.solicitudes_pdf_firma3_titulo || ''}
                        onChange={(e) => setConfig({ ...config, solicitudes_pdf_firma3_titulo: e.target.value })}
                        placeholder="AUTORIZADO"
                        className="w-full px-2 py-1 text-2xs font-semibold uppercase bg-slate-50 border border-slate-200 rounded-lg text-gray-800 focus:bg-white outline-none"
                      />
                      <input
                        type="text"
                        value={config.solicitudes_pdf_firma3_subtitulo || ''}
                        onChange={(e) => setConfig({ ...config, solicitudes_pdf_firma3_subtitulo: e.target.value })}
                        placeholder="Presidencia"
                        className="w-full px-2 py-1 text-3xs bg-slate-50 border border-slate-200 rounded-lg text-gray-500 focus:bg-white outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-2xs font-medium text-gray-600 mb-1">Nota Legal al Pie de la Hoja</label>
                    <textarea
                      rows={2}
                      value={config.solicitudes_pdf_pie_pagina || ''}
                      onChange={(e) => setConfig({ ...config, solicitudes_pdf_pie_pagina: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-gray-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-2xs"
                      placeholder="Texto institucional o base legal que aparecerá centrado al pie..."
                    />
                  </div>
                </div>
              </div>

              {/* Botón Guardar Plantilla - Barra Flotante Estilo Apple */}
              <div className="sticky bottom-4 z-20 bg-white/90 backdrop-blur-md p-3.5 rounded-2xl border border-slate-200/90 shadow-md flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-gray-900 block">Plantilla de Solicitud de Compra</span>
                  <span className="text-3xs text-gray-500">Cambios visibles en tiempo real en la vista previa</span>
                </div>
                <button
                  type="button"
                  onClick={handleSavePlantilla}
                  disabled={savingSection === 'plantilla'}
                  className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {savingSection === 'plantilla' ? 'Guardando...' : 'Guardar Plantilla'}
                </button>
              </div>

            </div>

            {/* LADO DERECHO: PREVISUALIZACIÓN EN VIVO (ESTILO MACOS DOCUMENT VIEWER) */}
            <div className="lg:col-span-6 sticky top-6">
              <div className="bg-slate-900/95 rounded-2xl shadow-xl border border-slate-800/80 overflow-hidden backdrop-blur-md">
                
                {/* macOS Titlebar */}
                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></div>
                    </div>
                    <span className="text-2xs font-medium text-slate-300 ml-2">
                      Vista Previa Carta (Letter)
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-3xs font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>En Vivo</span>
                  </div>
                </div>

                {/* Hoja de Carta Renderizada */}
                <div className="p-4 sm:p-6 bg-slate-950/40">
                  <div className="bg-white text-black p-6 md:p-8 rounded-lg shadow-xl relative font-serif text-2xs select-none overflow-hidden min-h-[660px] flex flex-col justify-between border border-slate-200">
                    
                    {/* Marca de Agua en Vivo */}
                    {config.solicitudes_pdf_watermark !== false && (
                      <div 
                        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden"
                        style={{ opacity: Number(config.solicitudes_pdf_watermark_opacity || 0.08) }}
                      >
                        <span className="text-3xl md:text-4xl font-black uppercase text-gray-900 transform -rotate-45 text-center leading-relaxed">
                          {config.solicitudes_pdf_watermark_text || 'CRUZ VERDE SALVADOREÑA'}
                        </span>
                      </div>
                    )}

                    <div className="relative z-10 space-y-4">
                      {/* Encabezado */}
                      <div className="flex items-start justify-between border-b-2 border-black pb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-11 h-11 rounded-full border-2 border-emerald-800 flex flex-col items-center justify-center text-center p-0.5 shrink-0">
                            <span className="text-4xs font-bold text-emerald-900 leading-none">CRUZ VERDE</span>
                            <span className="text-base font-black text-emerald-800 leading-none my-0.5">+</span>
                            <span className="text-4xs font-bold text-emerald-900 leading-none">EL SALVADOR</span>
                          </div>
                          <div>
                            <h4 className="text-xs md:text-sm font-black text-gray-900 uppercase font-sans tracking-wide">
                              {config.solicitudes_pdf_titulo || 'CRUZ VERDE SALVADOREÑA'}
                            </h4>
                            <h5 className="text-3xs md:text-2xs font-bold text-gray-800 uppercase font-sans tracking-wider mt-0.5">
                              {config.solicitudes_pdf_departamento || 'DEPARTAMENTO ADMINISTRATIVO.'}
                            </h5>
                            <span className="text-4xs text-gray-500 uppercase font-sans block mt-0.5">
                              República de El Salvador • Fundada para servir
                            </span>
                          </div>
                        </div>

                        <div className="text-right font-sans text-3xs">
                          <span className="font-bold text-blue-900 block text-2xs">CVS-SOL-2026-0045</span>
                          {config.solicitudes_pdf_mostrar_fechahora !== false && (
                            <>
                              <span className="text-gray-500 block">Hora Oficial (UTC-6)</span>
                              <span className="text-gray-800 font-semibold block">10:45 AM</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Subtítulo */}
                      <div className="text-center my-2">
                        <span className="text-xs font-black tracking-widest text-black uppercase underline decoration-2 underline-offset-4">
                          {config.solicitudes_pdf_subtitulo || 'HOJA DE SOLICITUD DE COMPRA.'}
                        </span>
                      </div>

                      {/* Campos de Prueba */}
                      <div className="space-y-2.5 font-sans text-3xs">
                        <div className="flex items-baseline">
                          <span className="font-bold text-gray-900 w-32 shrink-0">Lugar y fecha:</span>
                          <span className="border-b border-black flex-1 font-semibold text-gray-800 pb-0.5">
                            San Salvador, 9 de septiembre de 2026
                          </span>
                        </div>

                        <div className="flex items-baseline">
                          <span className="font-bold text-gray-900 w-32 shrink-0">Solicitado por:</span>
                          <span className="border-b border-black flex-1 font-bold text-gray-800 pb-0.5">
                            Lic. Roberto Gómez (Director Seccional)
                          </span>
                        </div>

                        <div className="flex items-baseline">
                          <span className="font-bold text-gray-900 w-32 shrink-0">Seccional o dependencia:</span>
                          <span className="border-b border-black flex-1 font-bold text-gray-900 pb-0.5">
                            Seccional Santa Ana
                          </span>
                        </div>

                        {config.solicitudes_pdf_mostrar_vehiculo !== false && (
                          <div className="flex items-baseline bg-blue-50/50 p-1 rounded">
                            <span className="font-bold text-blue-950 w-32 shrink-0">Unidad Vehicular:</span>
                            <span className="font-bold text-blue-900 flex-1">
                              Placa CVS-014 — Toyota Land Cruiser HZJ78 (Ambulancia Tipo A)
                            </span>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div className="flex items-baseline">
                            <span className="font-bold text-gray-900 w-20 shrink-0">Rubro:</span>
                            <span className="border-b border-gray-400 flex-1 text-gray-800 pb-0.5 font-semibold">
                              Repuestos y Mantenimiento Mecánico
                            </span>
                          </div>
                          {config.solicitudes_pdf_mostrar_costos !== false && (
                            <div className="flex items-baseline">
                              <span className="font-bold text-gray-900 w-24 shrink-0">Monto Est.:</span>
                              <span className="border-b border-gray-400 flex-1 font-bold text-gray-900 pb-0.5">
                                $ 245.50 USD
                              </span>
                            </div>
                          )}
                        </div>

                        {config.solicitudes_pdf_mostrar_urgencia !== false && (
                          <div className="flex items-baseline">
                            <span className="font-bold text-gray-900 w-32 shrink-0">Nivel de Prioridad:</span>
                            <span className="text-amber-800 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              🟡 Urgente (Mantenimiento preventivo programado)
                            </span>
                          </div>
                        )}

                        {/* Descripción */}
                        <div className="pt-2">
                          <span className="font-bold text-gray-900 block mb-1">
                            Descripción del servicio o producto a adquirir:
                          </span>
                          <div className="border border-gray-400 rounded p-2.5 bg-gray-50/30 text-gray-800 leading-relaxed font-sans min-h-[90px]">
                            Repuestos eq 231-145: Pastillas de frenos delanteros y traseros, kit de empaquetadura de bomba auxiliar de embrague y líquido DOT 4 para ambulancia institucional.
                            {config.solicitudes_pdf_mostrar_proveedor !== false && (
                              <p className="mt-2 text-4xs text-gray-600 italic">
                                Proveedor sugerido: Taller Central / Repuestos Los Andes
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Firmas en Vivo */}
                    <div className="relative z-10 pt-8 pb-2">
                      <div className="grid grid-cols-3 gap-3 text-center font-sans">
                        
                        <div className="flex flex-col items-center">
                          <div className="w-full border-b border-black pb-1 mb-1">
                            <span className="text-4xs font-bold text-gray-900 block">Lic. Roberto Gómez</span>
                          </div>
                          <span className="text-3xs font-black uppercase text-gray-900">
                            {config.solicitudes_pdf_firma1_titulo || 'Firma: SOLICITANTE'}
                          </span>
                          <span className="text-4xs text-gray-500 uppercase mt-0.5">
                            {config.solicitudes_pdf_firma1_subtitulo || 'Director Seccional'}
                          </span>
                        </div>

                        <div className="flex flex-col items-center">
                          <div className="w-10 h-10 rounded-full border border-dashed border-gray-400 flex items-center justify-center mb-1">
                            <span className="text-4xs text-gray-400 uppercase">Sello</span>
                          </div>
                          <span className="text-3xs font-black uppercase text-gray-900">
                            {config.solicitudes_pdf_firma2_titulo || 'Vo.Bo. Jefatura'}
                          </span>
                          <span className="text-4xs text-gray-500 uppercase mt-0.5">
                            {config.solicitudes_pdf_firma2_subtitulo || 'Administración Central'}
                          </span>
                        </div>

                        <div className="flex flex-col items-center">
                          <div className="w-full border-b border-black pb-1 mb-1">
                            <span className="text-4xs font-bold text-gray-400 italic">Espacio de Autorización</span>
                          </div>
                          <span className="text-3xs font-black uppercase text-gray-900">
                            {config.solicitudes_pdf_firma3_titulo || 'Autorizado'}
                          </span>
                          <span className="text-4xs text-gray-500 uppercase mt-0.5">
                            {config.solicitudes_pdf_firma3_subtitulo || 'Presidencia'}
                          </span>
                        </div>
                      </div>

                      {/* Nota al pie */}
                      {config.solicitudes_pdf_pie_pagina && (
                        <div className="mt-4 pt-2 border-t border-gray-200 text-center">
                          <p className="text-4xs text-gray-500 italic">
                            {config.solicitudes_pdf_pie_pagina}
                          </p>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              </div>
            </div>

          </div>

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
      {/* 4. MÓDULO: VERIFICACIÓN DE CARNET                                         */}
      {/* ========================================================================= */}
      {activeCategory === 'verificacion' && (
        <div className="max-w-3xl space-y-4 animate-in fade-in">
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">
                  Verificación Pública de Carnet (Código QR)
                </h2>
                <p className="text-xs text-gray-500">
                  Información visible al escanear el carnet oficial
                </p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-2xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                  Título de la Página
                </label>
                <input
                  type="text"
                  value={config.verificacion_titulo || ''}
                  onChange={(e) => setConfig({ ...config, verificacion_titulo: e.target.value })}
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  placeholder="Cruz Verde Salvadoreña - Verificación Oficial"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                  Mensaje de Autenticidad
                </label>
                <textarea
                  rows={2}
                  value={config.verificacion_mensaje || ''}
                  onChange={(e) => setConfig({ ...config, verificacion_mensaje: e.target.value })}
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-gray-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  placeholder="Este documento certifica que el titular es miembro activo..."
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  Campos Visibles en el Escaneo QR
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/60">
                  {Object.entries(config.verificacion_fields || {}).map(([key, value]) => (
                    <label key={key} className="flex items-center space-x-2 text-xs text-gray-700 cursor-pointer p-1 rounded-md hover:bg-white transition-colors">
                      <input
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={() => setConfig((prev: any) => ({
                          ...prev,
                          verificacion_fields: { ...prev.verificacion_fields, [key]: !value }
                        }))}
                        className="w-3.5 h-3.5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                      />
                      <span className="capitalize text-2xs font-medium">
                        {key === 'dui' ? 'DUI' : key === 'seccional' ? 'Seccional' : key === 'cargoInstitucional' ? 'Cargo Institucional' : key === 'cargoAdministrativo' ? 'Cargo Admin' : key === 'fechaIngreso' ? 'Ingreso' : key === 'fechaNacimiento' ? 'Nacimiento' : key === 'telefono' ? 'Teléfono' : key === 'cursos' ? 'Cursos' : key === 'tipoSangre' ? 'Tipo Sangre' : key === 'email' ? 'Email' : key}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={handleSaveVerificacion}
                disabled={savingSection === 'verificacion'}
                className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 mr-1.5" />
                {savingSection === 'verificacion' ? 'Guardando...' : 'Guardar Verificación'}
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
