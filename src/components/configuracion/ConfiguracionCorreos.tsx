import React, { useState, useEffect } from 'react';
import { 
  Mail, ShoppingCart, Fuel, Save, CheckCircle2, Copy, 
  HelpCircle, Lock, Shield, Eye, RefreshCw, Send, Sparkles, Building2, User,
  Palette, FileText, Check, ShieldAlert
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../lib/logger';
import { useSettings } from '../../contexts/SettingsContext';
import ModalDisenadorCorreos from './ModalDisenadorCorreos';

interface SeccionalInfo {
  id: number;
  nombre: string;
  director?: string;
  correo?: string;
}

export default function ConfiguracionCorreos() {
  const { refreshSettings } = useSettings();

  // Modal Diseñador de Plantillas y Remitente No-Reply
  const [isDisenadorOpen, setIsDisenadorOpen] = useState(false);

  // Configuración de Remitente Unificado No-Reply
  const [remitenteGlobal, setRemitenteGlobal] = useState('info@cruzverdesv.org');
  const [remitenteNombreGlobal, setRemitenteNombreGlobal] = useState('Cruz Verde Salvadoreña (No Responder)');
  const [usarRemitenteGlobal, setUsarRemitenteGlobal] = useState(true);

  // Subpestaña activa: Compra vs Combustible
  const [activeFormTab, setActiveFormTab] = useState<'compra' | 'combustible'>('compra');

  // Lista de seccionales para demostración y prueba en vivo
  const [seccionales, setSeccionales] = useState<SeccionalInfo[]>([]);
  const [testSeccionalId, setTestSeccionalId] = useState<string>('');

  // Estados de configuración para Solicitudes de Compra
  const [configCompra, setConfigCompra] = useState({
    destino: 'administracion@cruzverdesv.org',
    remitente: 'sistema@cruzverdesv.org',
    cc: 'presidencia@cruzverdesv.org',
    telefono: '2284-0000',
    asunto: 'Solicitud de Compra/Mantenimiento - [DIRECTOR] - Seccional [SECCIONAL] - [FECHA]',
    enviarCopiaSeccional: true,
    titulo: '¡Confirmamos de recibido tu solicitud de Compra y Mantenimiento!',
    subtitulo: 'Tu solicitud ha ingresado a la bandeja del Departamento Administrativo para su revisión',
    footer: 'Cualquier duda o consulta puedes enviar un correo a administracion@cruzverdesv.org o comunicarte al 2284-0000'
  });

  // Estados de configuración para Solicitudes de Combustible
  const [configCombustible, setConfigCombustible] = useState({
    destino: 'control_combustible@cruzverdesv.org',
    remitente: 'sistema@cruzverdesv.org',
    cc: 'presidencia@cruzverdesv.org, administracion@cruzverdesv.org',
    telefono: '7695-7911',
    asunto: 'Solicitud de Combustible - [SOLICITANTE] - Seccional [SECCIONAL] - [FECHA]',
    enviarCopiaSeccional: true,
    titulo: '¡Confirmamos de recibido tu solicitud de Combustible!',
    subtitulo: 'Comunícate con Oficina Central para ver el estado de tu solicitud',
    footer: 'Cualquier duda o consulta puedes enviar un correo a control_combustible@cruzverdesv.org o llama/whatsapp al 7695-7911'
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [copiedPreview, setCopiedPreview] = useState(false);

  // Cargar datos de seccionales y configuración desde Supabase
  const loadAll = async () => {
    setLoading(true);
    try {
      // 1. Cargar Seccionales
      const { data: secData } = await supabase
        .from('seccionales')
        .select('id, nombre, director, correo')
        .order('nombre');

      if (secData && secData.length > 0) {
        setSeccionales(secData);
        // Buscar Santa Anita por defecto si existe, o la primera
        const santaAnita = secData.find(s => s.nombre.toLowerCase().includes('santa anita'));
        setTestSeccionalId(santaAnita ? String(santaAnita.id) : String(secData[0].id));
      }

      // 2. Cargar Configuración de la base de datos
      const { data: configData } = await supabase.from('configuracion').select('*');
      if (configData) {
        const compraUpdates: Partial<typeof configCompra> = {};
        const combUpdates: Partial<typeof configCombustible> = {};

        configData.forEach(row => {
          // Compra
          if (row.clave === 'solicitudes_correo_destino') compraUpdates.destino = row.valor;
          if (row.clave === 'solicitudes_correo_remitente') compraUpdates.remitente = row.valor;
          if (row.clave === 'solicitudes_correo_cc') compraUpdates.cc = row.valor;
          if (row.clave === 'solicitudes_asunto_plantilla') compraUpdates.asunto = row.valor;
          if (row.clave === 'solicitudes_enviar_copia_solicitante') compraUpdates.enviarCopiaSeccional = row.valor !== 'false';
          if (row.clave === 'solicitudes_correo_titulo') compraUpdates.titulo = row.valor;
          if (row.clave === 'solicitudes_correo_subtitulo') compraUpdates.subtitulo = row.valor;
          if (row.clave === 'solicitudes_correo_footer') compraUpdates.footer = row.valor;
          if (row.clave === 'solicitudes_correo_telefono') compraUpdates.telefono = row.valor;

          // Combustible
          if (row.clave === 'combustible_correo_destino') combUpdates.destino = row.valor;
          if (row.clave === 'combustible_correo_remitente') combUpdates.remitente = row.valor;
          if (row.clave === 'combustible_correo_cc') combUpdates.cc = row.valor;
          if (row.clave === 'combustible_correo_asunto_plantilla') combUpdates.asunto = row.valor;
          if (row.clave === 'combustible_correo_enviar_copia_solicitante') combUpdates.enviarCopiaSeccional = row.valor !== 'false';
          if (row.clave === 'combustible_correo_titulo') combUpdates.titulo = row.valor;
          if (row.clave === 'combustible_correo_subtitulo') combUpdates.subtitulo = row.valor;
          if (row.clave === 'combustible_correo_footer_texto') combUpdates.footer = row.valor;
          if (row.clave === 'combustible_correo_contacto_telefono') combUpdates.telefono = row.valor;

          // Global No-Reply
          if (row.clave === 'email_remitente_global' && row.valor) setRemitenteGlobal(row.valor);
          if (row.clave === 'email_remitente_nombre_global' && row.valor) setRemitenteNombreGlobal(row.valor);
          if (row.clave === 'email_remitente_no_reply_mode') setUsarRemitenteGlobal(row.valor !== 'false');
        });

        setConfigCompra(prev => ({ ...prev, ...compraUpdates }));
        setConfigCombustible(prev => ({ ...prev, ...combUpdates }));
      }
    } catch (err) {
      console.error('Error cargando configuración de correos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Seccional seleccionada para la simulación
  const selectedSeccional = seccionales.find(s => String(s.id) === testSeccionalId) || seccionales[0];

  // Resolver correo de la seccional seleccionada
  const getSeccionalEmail = (sec?: SeccionalInfo) => {
    if (!sec) return 'santaanita@cruzverdesv.org';
    if (sec.correo) return sec.correo;
    const cleanName = sec.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
    return `${cleanName}@cruzverdesv.org`;
  };

  // Guardar configuración en Supabase
  const handleSave = async () => {
    setSaving(true);
    try {
      let pairs: { clave: string; valor: string }[] = [];

      if (activeFormTab === 'compra') {
        pairs = [
          { clave: 'solicitudes_correo_destino', valor: configCompra.destino },
          { clave: 'solicitudes_correo_remitente', valor: configCompra.remitente },
          { clave: 'solicitudes_correo_cc', valor: configCompra.cc },
          { clave: 'solicitudes_asunto_plantilla', valor: configCompra.asunto },
          { clave: 'solicitudes_enviar_copia_solicitante', valor: String(configCompra.enviarCopiaSeccional) },
          { clave: 'solicitudes_correo_titulo', valor: configCompra.titulo },
          { clave: 'solicitudes_correo_subtitulo', valor: configCompra.subtitulo },
          { clave: 'solicitudes_correo_footer', valor: configCompra.footer },
          { clave: 'solicitudes_correo_telefono', valor: configCompra.telefono }
        ];
      } else {
        pairs = [
          { clave: 'combustible_correo_destino', valor: configCombustible.destino },
          { clave: 'combustible_correo_remitente', valor: configCombustible.remitente },
          { clave: 'combustible_correo_cc', valor: configCombustible.cc },
          { clave: 'combustible_correo_asunto_plantilla', valor: configCombustible.asunto },
          { clave: 'combustible_correo_enviar_copia_solicitante', valor: String(configCombustible.enviarCopiaSeccional) },
          { clave: 'combustible_correo_titulo', valor: configCombustible.titulo },
          { clave: 'combustible_correo_subtitulo', valor: configCombustible.subtitulo },
          { clave: 'combustible_correo_footer_texto', valor: configCombustible.footer },
          { clave: 'combustible_correo_contacto_telefono', valor: configCombustible.telefono }
        ];
      }

      // Guardar o actualizar en Supabase
      for (const pair of pairs) {
        const { data: existing } = await supabase
          .from('configuracion')
          .select('id')
          .eq('clave', pair.clave)
          .maybeSingle();

        if (existing) {
          await supabase.from('configuracion').update({ valor: pair.valor }).eq('id', existing.id);
        } else {
          await supabase.from('configuracion').insert({ clave: pair.clave, valor: pair.valor });
        }
      }

      // También guardar en localStorage de contingencia
      localStorage.setItem(`cruz_verde_config_correo_${activeFormTab}`, JSON.stringify(
        activeFormTab === 'compra' ? configCompra : configCombustible
      ));

      await refreshSettings();
      await logActivity(
        `Actualizó plantilla de correo para ${activeFormTab === 'compra' ? 'Solicitudes de Compra' : 'Solicitudes de Combustible'}`,
        'Configuración',
        `correo_${activeFormTab}`
      );

      setSaveSuccessMsg(`¡Plantilla de correo para ${activeFormTab === 'compra' ? 'Solicitudes de Compra' : 'Solicitudes de Combustible'} guardada exitosamente!`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);

    } catch (err: any) {
      console.error('Error guardando plantilla de correo:', err);
      alert('Error al guardar configuración: ' + (err.message || 'Error de conexión'));
    } finally {
      setSaving(false);
    }
  };

  // Insertar tag dinámico en el asunto
  const insertTagInSubject = (tag: string) => {
    if (activeFormTab === 'compra') {
      setConfigCompra(prev => ({ ...prev, asunto: `${prev.asunto} ${tag}` }));
    } else {
      setConfigCombustible(prev => ({ ...prev, asunto: `${prev.asunto} ${tag}` }));
    }
  };

  // Parsear asunto para la previsualización
  const currentConfig = activeFormTab === 'compra' ? configCompra : configCombustible;
  const currentSecNombre = selectedSeccional?.nombre || 'Santa Anita';
  const currentDirectorNombre = selectedSeccional?.director || 'Lic. Roberto Gómez';
  const currentSecEmail = getSeccionalEmail(selectedSeccional);

  const previewSubject = currentConfig.asunto
    .replace('[SECCIONAL]', currentSecNombre)
    .replace('[DIRECTOR]', currentDirectorNombre)
    .replace('[SOLICITANTE]', 'Carlos Mendoza (Encargado)')
    .replace('[FECHA]', new Date().toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' }))
    .replace('[FOLIO]', activeFormTab === 'compra' ? 'CVS-SOL-2026-0045' : 'CVS-COMB-2026-0012')
    .replace('[PLACA]', 'CVS-014');

  // Copiar el texto de la previsualización
  const handleCopyPreview = () => {
    const previewContent = `
${currentConfig.titulo}
Estimado(a): Carlos Mendoza
${currentConfig.subtitulo}

DATOS DEL FORMULARIO:
• Seccional: ${currentSecNombre}
• Director(a): (${currentSecNombre.toUpperCase()}) - ${currentDirectorNombre} [Automático / Solo Lectura]
• Correo Seccional: ${currentSecEmail} [Automático / Solo Lectura]
${activeFormTab === 'compra' ? `• Tipo: Repuestos para Ambulancia\n• Vehículo: CVS-014 (Toyota Land Cruiser)\n• Monto Estimado: $245.50` : `• Actividad: Emergencias cotidianas\n• Liquidación anterior entregada: Sí\n• Teléfono: 7890-1234`}

${currentConfig.footer}
    `.trim();

    navigator.clipboard.writeText(previewContent);
    setCopiedPreview(true);
    setTimeout(() => setCopiedPreview(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-gray-200">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
        <p className="mt-3 text-sm font-semibold text-gray-700">Cargando plantillas de correo institucional...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Alerta de Éxito al Guardar */}
      {saveSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl flex items-center shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 mr-2.5 text-emerald-600 shrink-0" />
          <span className="text-sm font-semibold">{saveSuccessMsg}</span>
        </div>
      )}

      {/* 0. Card de Remitente Institucional No-Reply & Botón Diseñador de Plantilla */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-green-900 text-white rounded-2xl p-5 shadow-lg border border-emerald-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-2xs font-extrabold uppercase tracking-wider bg-white/20 text-white border border-white/30 flex items-center">
              <ShieldAlert className="w-3 h-3 mr-1" />
              Remitente No-Reply Unificado
            </span>
            <span className="text-2xs text-emerald-200">
              Aplica para todos los correos institucionales
            </span>
          </div>
          <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
            <span>{remitenteNombreGlobal}</span>
            <span className="text-xs font-mono font-normal opacity-85">&lt;{remitenteGlobal}&gt;</span>
          </h2>
          <p className="text-xs text-emerald-100/90 max-w-2xl leading-relaxed">
            Todos los correos de <strong>Notificaciones de Acceso</strong>, <strong>Solicitudes de Compra</strong> y <strong>Solicitudes de Combustible</strong> se emiten desde este remitente con leyenda de <em>No Responder</em> para que la gente no responda a una casilla desatendida.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsDisenadorOpen(true)}
            className="inline-flex items-center px-4 py-2.5 bg-white hover:bg-emerald-50 text-emerald-950 text-xs font-black rounded-xl shadow-md transition-all hover:scale-102 cursor-pointer"
          >
            <Palette className="w-4 h-4 mr-2 text-emerald-700" />
            Personalizar Plantilla y Correos (Colores, Fuentes, Logo, PDF)
          </button>
        </div>
      </div>

      {/* Selector Centralizado de Formulario (Subpestañas de Correo) */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <Mail className="w-5 h-5 mr-2 text-primary" />
              Configuración y Plantillas de Correo para Solicitudes
            </h2>
            <p className="text-xs md:text-sm text-gray-500 mt-0.5">
              Administre de forma centralizada el cuerpo, los campos y la notificación por correo de cada formulario por separado.
            </p>
          </div>

          {/* Selector de Pestaña */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl self-start sm:self-auto border border-gray-200">
            <button
              type="button"
              onClick={() => setActiveFormTab('compra')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                activeFormTab === 'compra'
                  ? 'bg-white text-primary shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Solicitud de Compra</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFormTab('combustible')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                activeFormTab === 'combustible'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Fuel className="w-4 h-4 text-emerald-600" />
              <span>Solicitud de Combustible</span>
            </button>
          </div>
        </div>

        {/* Banner Explicativo de Asignación Automática y Solo Lectura */}
        <div className="mt-3 bg-blue-50/70 border border-blue-200 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start space-x-2.5">
            <Lock className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
            <div className="text-xs text-blue-900">
              <span className="font-bold">Regla de Integridad en Formularios:</span> Al seleccionar una Seccional (o detectarse la del usuario), el sistema asigna en automático a su <strong>Director</strong> y el <strong>Correo de la Seccional</strong>. En los formularios ambos campos se bloquean en <strong>sólo lectura</strong> para garantizar trazabilidad.
            </div>
          </div>

          {/* Selector de Prueba de Seccional para la Simulación */}
          <div className="flex items-center space-x-2 shrink-0">
            <span className="text-2xs font-bold uppercase tracking-wider text-blue-900">Probar con Seccional:</span>
            <select
              value={testSeccionalId}
              onChange={(e) => setTestSeccionalId(e.target.value)}
              className="px-2.5 py-1 text-xs bg-white border border-blue-300 rounded-lg text-gray-900 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {seccionales.map(s => (
                <option key={s.id} value={s.id}>
                  {s.nombre} {s.correo ? `(${s.correo})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Grid de 2 Columnas: Lado Izquierdo (Edición de Plantilla) | Lado Derecho (Live Preview de Correo) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* COLUMNA IZQUIERDA: CONFIGURACIÓN EDITABLE */}
        <div className="lg:col-span-6 space-y-5">
          
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center">
                  {activeFormTab === 'compra' ? (
                    <ShoppingCart className="w-4 h-4 mr-2 text-primary" />
                  ) : (
                    <Fuel className="w-4 h-4 mr-2 text-emerald-600" />
                  )}
                  Plantilla: {activeFormTab === 'compra' ? 'Solicitud de Compra / Mantenimiento' : 'Solicitud de Combustible'}
                </h3>
                <span className="text-2xs text-gray-500">
                  Modifique las direcciones de destino, el asunto y el cuerpo del correo
                </span>
              </div>
              <span className={`text-2xs px-2.5 py-1 rounded-full font-bold ${
                activeFormTab === 'compra' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {activeFormTab === 'compra' ? 'Compras & Mantenimiento' : 'Dotación Combustible'}
              </span>
            </div>

            {/* 1. Destinatario Principal & Remitente */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Correo Destinatario Principal:
                </label>
                <input
                  type="email"
                  value={currentConfig.destino}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (activeFormTab === 'compra') setConfigCompra({ ...configCompra, destino: val });
                    else setConfigCombustible({ ...configCombustible, destino: val });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-primary outline-none"
                  placeholder="bandeja@cruzverdesv.org"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-700">
                    Correo Remitente Institucional:
                  </label>
                  {usarRemitenteGlobal && (
                    <span className="text-3xs font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                      No-Reply Global
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="email"
                    value={usarRemitenteGlobal ? remitenteGlobal : currentConfig.remitente}
                    readOnly={usarRemitenteGlobal}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (activeFormTab === 'compra') setConfigCompra({ ...configCompra, remitente: val });
                      else setConfigCombustible({ ...configCombustible, remitente: val });
                    }}
                    className={`w-full px-3 py-2 border rounded-lg text-xs font-mono outline-none ${
                      usarRemitenteGlobal ? 'bg-gray-100 border-gray-300 text-gray-700 cursor-not-allowed' : 'border-gray-300 text-gray-900 focus:ring-2 focus:ring-primary'
                    }`}
                    placeholder="no-reply@cruzverdesv.org"
                  />
                  {usarRemitenteGlobal && (
                    <button
                      type="button"
                      onClick={() => setIsDisenadorOpen(true)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-2xs font-bold text-emerald-700 hover:text-emerald-900"
                    >
                      Ajustar
                    </button>
                  )}
                </div>
                {usarRemitenteGlobal ? (
                  <span className="text-3xs text-emerald-700 font-medium">
                    Sincronizado con el remitente unificado No-Reply institucional.
                  </span>
                ) : (
                  <span className="text-3xs text-gray-500">Remitente configurado para este formulario</span>
                )}
              </div>
            </div>

            {/* 2. Con Copia Fija (CC) & Teléfono */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Con Copia Por Defecto (CC):
                </label>
                <input
                  type="text"
                  value={currentConfig.cc}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (activeFormTab === 'compra') setConfigCompra({ ...configCompra, cc: val });
                    else setConfigCombustible({ ...configCombustible, cc: val });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-primary outline-none"
                  placeholder="presidencia@cruzverdesv.org, jefatura@cruzverdesv.org"
                />
                <span className="text-3xs text-gray-500">Separados por coma</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Teléfono / WhatsApp de Soporte en el Correo:
                </label>
                <input
                  type="text"
                  value={currentConfig.telefono}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (activeFormTab === 'compra') setConfigCompra({ ...configCompra, telefono: val });
                    else setConfigCombustible({ ...configCombustible, telefono: val });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-primary outline-none"
                  placeholder="7695-7911"
                />
              </div>
            </div>

            {/* 3. Checkbox de Copia al Correo Asignado de la Seccional */}
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <label className="flex items-start space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentConfig.enviarCopiaSeccional}
                  onChange={(e) => {
                    const val = e.target.checked;
                    if (activeFormTab === 'compra') setConfigCompra({ ...configCompra, enviarCopiaSeccional: val });
                    else setConfigCombustible({ ...configCombustible, enviarCopiaSeccional: val });
                  }}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded mt-0.5"
                />
                <div>
                  <span className="text-xs font-bold text-gray-800 block">
                    Enviar automáticamente acuse al correo asignado de la Seccional
                  </span>
                  <span className="text-2xs text-gray-500">
                    Se enviará copia al correo oficial de la seccional (ej. <code className="bg-gray-200 px-1 rounded">{currentSecEmail}</code>) registrado en el módulo de Seccionales.
                  </span>
                </div>
              </label>
            </div>

            {/* 4. Plantilla de Asunto con Tags Dinámicos */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-700">
                  Formato de Asunto del Correo:
                </label>
                <span className="text-3xs text-gray-500">Haga clic en un tag para insertarlo</span>
              </div>
              <input
                type="text"
                value={currentConfig.asunto}
                onChange={(e) => {
                  const val = e.target.value;
                  if (activeFormTab === 'compra') setConfigCompra({ ...configCompra, asunto: val });
                  else setConfigCombustible({ ...configCombustible, asunto: val });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono text-gray-900 focus:ring-2 focus:ring-primary outline-none"
              />

              {/* Botones de Tags para insertar */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {['[SECCIONAL]', '[DIRECTOR]', '[SOLICITANTE]', '[FECHA]', '[FOLIO]', ...(activeFormTab === 'compra' ? ['[PLACA]'] : [])].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => insertTagInSubject(tag)}
                    className="text-3xs bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 px-2 py-0.5 rounded-md font-mono transition"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Título Principal y Subtítulo en el Cuerpo del Correo */}
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Título Resaltado en el Encabezado del Correo:
                </label>
                <input
                  type="text"
                  value={currentConfig.titulo}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (activeFormTab === 'compra') setConfigCompra({ ...configCompra, titulo: val });
                    else setConfigCombustible({ ...configCombustible, titulo: val });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-primary outline-none"
                  placeholder="¡Confirmamos de recibido tu solicitud...!"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Subtítulo o Indicación a los Solicitantes:
                </label>
                <input
                  type="text"
                  value={currentConfig.subtitulo}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (activeFormTab === 'compra') setConfigCompra({ ...configCompra, subtitulo: val });
                    else setConfigCombustible({ ...configCombustible, subtitulo: val });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-primary outline-none"
                  placeholder="Comunícate con Oficina Central..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Texto al Pie del Correo (Información de Contacto y Dudas):
                </label>
                <textarea
                  rows={2}
                  value={currentConfig.footer}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (activeFormTab === 'compra') setConfigCompra({ ...configCompra, footer: val });
                    else setConfigCombustible({ ...configCombustible, footer: val });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-primary outline-none"
                  placeholder="Cualquier duda o consulta puedes enviar un correo..."
                />
              </div>
            </div>

            {/* Botón Guardar Plantilla de Correo */}
            <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
              <span className="text-2xs text-gray-500">
                Se sincronizará en la base de datos de Cruz Verde
              </span>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-1.5" />
                    Guardar Plantilla de Correo
                  </>
                )}
              </button>
            </div>

          </div>

        </div>

        {/* COLUMNA DERECHA: PREVISUALIZACIÓN EN VIVO (LIVE EMAIL PREVIEW) */}
        <div className="lg:col-span-6 sticky top-6">
          <div className="bg-gray-800 rounded-2xl p-4 shadow-xl border border-gray-700 text-white space-y-3">
            
            {/* Cabecera del Preview */}
            <div className="flex items-center justify-between pb-2 border-b border-gray-700">
              <div className="flex items-center space-x-2">
                <Eye className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Previsualización en Vivo — Correo Acuse de Recibo
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyPreview}
                className="inline-flex items-center text-3xs text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 px-2.5 py-1 rounded-md transition"
              >
                {copiedPreview ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-400" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 mr-1" />
                    Copiar Texto
                  </>
                )}
              </button>
            </div>

            {/* Metadatos del Mensaje Simulado */}
            <div className="bg-gray-900/90 p-2.5 rounded-lg text-2xs space-y-1 font-mono border border-gray-700">
              <div className="text-gray-400 flex items-center justify-between">
                <span>
                  <strong>De:</strong> {usarRemitenteGlobal ? remitenteNombreGlobal : 'Cruz Verde Notificaciones'} &lt;{usarRemitenteGlobal ? remitenteGlobal : currentConfig.remitente}&gt;
                </span>
                {usarRemitenteGlobal && (
                  <span className="text-emerald-400 font-sans text-3xs font-extrabold bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-700/50">
                    No-Reply
                  </span>
                )}
              </div>
              <div className="text-gray-300">
                <strong>Para:</strong> {currentConfig.destino}
                {currentConfig.enviarCopiaSeccional && (
                  <span className="text-blue-400 font-sans">, {currentSecEmail} (Seccional)</span>
                )}
              </div>
              <div className="text-gray-400">
                <strong>CC:</strong> {currentConfig.cc}
              </div>
              <div className="text-white font-semibold pt-1 border-t border-gray-800">
                <strong>Asunto:</strong> {previewSubject}
              </div>
            </div>

            {/* Plantilla HTML Renderizada en Vivo (Idéntica a la Imagen 2) */}
            <div className="bg-white text-gray-900 rounded-xl shadow-inner overflow-hidden border border-gray-300 font-sans text-xs">
              
              {/* Encabezado con Escudo Cruz Verde */}
              <div className="bg-[#f3f4f6] p-4 text-center border-b border-gray-200 flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full border-2 border-green-700 bg-white flex flex-col items-center justify-center text-center p-1 shadow-2xs">
                  <span className="text-[6px] font-bold text-green-800 leading-none">CRUZ VERDE</span>
                  <span className="text-lg font-black text-green-700 leading-none my-0.5">+</span>
                  <span className="text-[6px] font-bold text-green-800 leading-none">EL SALVADOR</span>
                </div>
                <span className="text-2xs font-bold text-gray-800 uppercase tracking-widest mt-1">
                  Cruz Verde Salvadoreña
                </span>
              </div>

              {/* Contenido Central */}
              <div className="p-5 space-y-4">
                
                {/* Título de Confirmación con Resaltado Amarillo */}
                <div className="text-center space-y-1">
                  <h3 className="text-base md:text-lg font-black text-gray-900 leading-snug">
                    {activeFormTab === 'compra' ? (
                      <>
                        ¡Confirmamos de recibido tu{' '}
                        <mark className="bg-yellow-200 text-gray-900 px-1 py-0.5 rounded">solicitud</mark>
                        <br />
                        de{' '}
                        <mark className="bg-yellow-200 text-gray-900 px-1 py-0.5 rounded">Compra y Mantenimiento</mark>!
                      </>
                    ) : (
                      <>
                        ¡Confirmamos de recibido tu{' '}
                        <mark className="bg-yellow-200 text-gray-900 px-1 py-0.5 rounded">solicitud</mark>
                        <br />
                        de{' '}
                        <mark className="bg-yellow-200 text-gray-900 px-1 py-0.5 rounded">Combustible</mark>!
                      </>
                    )}
                  </h3>
                </div>

                {/* Saludo e Instrucción */}
                <div className="text-center space-y-1 text-xs text-gray-700">
                  <p className="font-bold text-sm text-gray-900">
                    Estimado(a): Carlos Mendoza
                  </p>
                  <p>
                    {currentConfig.subtitulo}{' '}
                    <mark className="bg-yellow-200 text-gray-900 px-1 rounded">solicitud</mark>
                  </p>
                </div>

                {/* Tabla Cebra de Campos según el Formulario Seleccionado */}
                <div className="border border-gray-200 rounded-lg overflow-hidden text-2xs md:text-xs">
                  
                  {/* Campo Seccional */}
                  <div className="bg-gray-100/90 px-3.5 py-2 flex items-center justify-between border-b border-gray-200">
                    <span className="font-bold text-gray-700">Seccional:</span>
                    <span className="font-semibold text-gray-900">{currentSecNombre}</span>
                  </div>

                  {/* Campo Director(a) - Bloqueado / Solo Lectura */}
                  <div className="bg-white px-3.5 py-2 flex items-center justify-between border-b border-gray-200">
                    <span className="font-bold text-gray-700 flex items-center">
                      Director(a):
                      <span title="Asignado automáticamente / Solo Lectura">
                        <Lock className="w-3 h-3 ml-1 text-amber-600" />
                      </span>
                    </span>
                    <span className="font-semibold text-gray-900">
                      ({currentSecNombre.toUpperCase()}) - {currentDirectorNombre}
                    </span>
                  </div>

                  {/* Campo Correo de la Seccional - Bloqueado / Solo Lectura */}
                  <div className="bg-gray-100/90 px-3.5 py-2 flex items-center justify-between border-b border-gray-200">
                    <span className="font-bold text-gray-700 flex items-center">
                      Correo Electrónico Seccional:
                      <span title="Asignado automáticamente / Solo Lectura">
                        <Lock className="w-3 h-3 ml-1 text-amber-600" />
                      </span>
                    </span>
                    <span className="font-semibold text-primary">{currentSecEmail}</span>
                  </div>

                  {/* Campos Específicos de Solicitud de Compra */}
                  {activeFormTab === 'compra' && (
                    <>
                      <div className="bg-white px-3.5 py-2 flex items-center justify-between border-b border-gray-200">
                        <span className="font-bold text-gray-700">Rubro / Tipo:</span>
                        <span className="font-semibold text-gray-900">Repuestos para Vehículo</span>
                      </div>

                      <div className="bg-gray-100/90 px-3.5 py-2 flex items-center justify-between border-b border-gray-200">
                        <span className="font-bold text-gray-700">Unidad Vehicular:</span>
                        <span className="font-semibold text-gray-900">CVS-014 • Toyota Land Cruiser (Ambulancia)</span>
                      </div>

                      <div className="bg-white px-3.5 py-2 flex items-center justify-between border-b border-gray-200">
                        <span className="font-bold text-gray-700">Monto Estimado:</span>
                        <span className="font-semibold text-emerald-700">$245.50 USD</span>
                      </div>

                      <div className="bg-gray-100/90 px-3.5 py-2 flex items-center justify-between border-b border-gray-200">
                        <span className="font-bold text-gray-700">Prioridad:</span>
                        <span className="font-semibold text-amber-700">🟡 Urgente</span>
                      </div>
                    </>
                  )}

                  {/* Campos Específicos de Solicitud de Combustible */}
                  {activeFormTab === 'combustible' && (
                    <>
                      <div className="bg-white px-3.5 py-2 flex items-center justify-between border-b border-gray-200">
                        <span className="font-bold text-gray-700">Actividad:</span>
                        <span className="font-semibold text-gray-900">Emergencias cotidianas</span>
                      </div>

                      <div className="bg-gray-100/90 px-3.5 py-2 flex items-center justify-between border-b border-gray-200">
                        <span className="font-bold text-gray-700">Teléfono del Solicitante:</span>
                        <span className="font-semibold text-gray-900">7890-1234</span>
                      </div>

                      <div className="bg-white px-3.5 py-2 flex items-center justify-between border-b border-gray-200">
                        <span className="font-bold text-gray-700">¿Entregó liquidación mes anterior?:</span>
                        <span className="font-semibold text-emerald-700">Sí</span>
                      </div>
                    </>
                  )}

                  {/* Fecha de Envío */}
                  <div className="bg-gray-100/90 px-3.5 py-2 flex items-center justify-between">
                    <span className="font-bold text-gray-700">Fecha de Registro:</span>
                    <span className="font-semibold text-gray-900">
                      {new Date().toLocaleDateString('es-SV', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </span>
                  </div>

                </div>

                {/* Documento PDF Adjunto Oficial Generado */}
                <div className="bg-red-50/70 border-2 border-dashed border-red-200 rounded-xl p-3.5 flex items-center justify-between gap-3 my-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-lg bg-red-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
                      PDF
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-900 flex items-center">
                        <FileText className="w-3.5 h-3.5 mr-1 text-red-600" />
                        {activeFormTab === 'compra' ? 'Solicitud_Compra_SC-2026-0042.pdf' : 'Solicitud_Combustible_COMB-2026-0089.pdf'}
                      </div>
                      <div className="text-3xs text-gray-500">
                        Documento oficial membretado generado en automático con firmas y sellos
                      </div>
                    </div>
                  </div>
                  <span className="text-3xs font-extrabold px-2 py-1 rounded bg-red-100 text-red-800 border border-red-200 shrink-0">
                    Adjunto Oficial
                  </span>
                </div>

                {/* Advertencia No-Reply */}
                <div className="bg-amber-50 border border-amber-200 text-amber-900 text-3xs rounded-lg p-2 text-center font-semibold">
                  🚫 <strong>NO-REPLY:</strong> Mensaje automático institucional. Por favor no responda a este correo.
                </div>

                {/* Pie de Página del Correo */}
                <div className="pt-3 border-t border-gray-200 text-center space-y-1 text-3xs text-gray-500">
                  <p className="font-medium text-gray-700">
                    {currentConfig.footer}
                  </p>
                  <p className="text-gray-400">
                    Mensaje generado automáticamente por el Sistema Integrado de Cruz Verde Salvadoreña.
                  </p>
                </div>

              </div>

            </div>

          </div>
        </div>

      </div>

      {/* Modal Diseñador de Plantillas y Remitente No-Reply */}
      <ModalDisenadorCorreos
        isOpen={isDisenadorOpen}
        onClose={() => setIsDisenadorOpen(false)}
        onSaved={loadAll}
      />

    </div>
  );
}
