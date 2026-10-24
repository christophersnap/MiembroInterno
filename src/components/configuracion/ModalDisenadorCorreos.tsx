import React, { useState, useEffect } from 'react';
import { 
  X, Palette, Type, Image as ImageIcon, Mail, FileText, CheckCircle2, 
  Send, Save, Copy, Check, Eye, EyeOff, AlertCircle, RefreshCw, 
  ShoppingCart, Fuel, Server, Info, Key, ChevronRight, ShieldCheck,
  Code, Database, Sparkles, Upload
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../lib/logger';
import { useSettings } from '../../contexts/SettingsContext';
import { 
  EmailDesignConfig,
  DEFAULT_EMAIL_DESIGN,
  generarHtmlCorreoAprobacion, 
  generarHtmlCorreoCompra, 
  generarHtmlCorreoCombustible 
} from '../../lib/emailNotification';
import { getApiUrl, sendEmailNotification } from '../../lib/api';
import { getOfficialLoginUrl } from '../../utils/appUrl';

interface ModalDisenadorCorreosProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initialPreviewTab?: 'notificacion' | 'compra' | 'combustible';
}

export default function ModalDisenadorCorreos({
  isOpen,
  onClose,
  onSaved,
  initialPreviewTab = 'compra'
}: ModalDisenadorCorreosProps) {
  const { refreshSettings } = useSettings();

  // Sección activa en el panel de edición (Estilo Apple Settings Tabs)
  const [activeEditorTab, setActiveEditorTab] = useState<'diseno' | 'servidor' | 'prueba'>('diseno');

  // Tipo de correo en vista previa: 'notificacion' | 'compra' | 'combustible'
  const [previewTab, setPreviewTab] = useState<'notificacion' | 'compra' | 'combustible'>(initialPreviewTab);

  // Sincronizar pestaña inicial al abrir modal
  useEffect(() => {
    if (isOpen && initialPreviewTab) {
      setPreviewTab(initialPreviewTab);
    }
  }, [isOpen, initialPreviewTab]);

  // Configuración de Remitente Unificado No-Reply
  const [remitenteGlobal, setRemitenteGlobal] = useState('notificaciones@cruzverdesv.org');
  const [remitenteNombreGlobal, setRemitenteNombreGlobal] = useState('Cruz Verde Salvadoreña (No Responder)');
  const [usarRemitenteGlobal, setUsarRemitenteGlobal] = useState(true);

  // Configuración SMTP editable directa (Predeterminado: Hostinger Webmail)
  const [smtpHost, setSmtpHost] = useState('smtp.hostinger.com');
  const [smtpPort, setSmtpPort] = useState('465');
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [smtpUser, setSmtpUser] = useState('notificaciones@cruzverdesv.org');
  const [smtpPass, setSmtpPass] = useState('');
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testConnResult, setTestConnResult] = useState<{ success: boolean; message: string; sugerencia?: string } | null>(null);

  // Estado de guardado y visualización SQL específico de SMTP
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [smtpSaveSuccess, setSmtpSaveSuccess] = useState<string | null>(null);
  const [showSqlViewer, setShowSqlViewer] = useState(false);
  const [copiedSmtpSql, setCopiedSmtpSql] = useState(false);

  // Estado del Servicio de Correo (Hostinger / Microsoft 365 / etc.)
  const [smtpStatus, setSmtpStatus] = useState<{
    configured: boolean;
    hasPassword?: boolean;
    host: string;
    port: string;
    user: string;
    from: string;
    protocol: string;
    provider?: string;
  } | null>(null);
  const [mostrarGuiaMicrosoft, setMostrarGuiaMicrosoft] = useState(false);
  const [guiaTab, setGuiaTab] = useState<'hostinger' | 'hotmail' | 'microsoft' | 'relay'>('hostinger');

  // Configuración de Diseño Visual
  const [headerColor, setHeaderColor] = useState('#15803d');
  const [headerTextColor, setHeaderTextColor] = useState('#ffffff');
  const [footerColor, setFooterColor] = useState('#f9fafb');
  const [footerTextColor, setFooterTextColor] = useState('#6b7280');
  const [fontTitle, setFontTitle] = useState('Plus Jakarta Sans');
  const [fontBody, setFontBody] = useState('Plus Jakarta Sans');
  const [logoUrl, setLogoUrl] = useState(DEFAULT_EMAIL_DESIGN.logoUrl);
  const [mostrarLogo, setMostrarLogo] = useState(true);
  const [leyendaNoReply, setLeyendaNoReply] = useState(DEFAULT_EMAIL_DESIGN.leyendaNoReply);
  const [telefonoContacto, setTelefonoContacto] = useState('2284-0000 / 7695-7911');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUploadMsg, setLogoUploadMsg] = useState<string | null>(null);

  // Subir imagen para la plantilla de correo con URL pública
  const handleUploadEmailLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen válida (PNG, JPG, SVG o WEBP).');
      return;
    }

    setUploadingLogo(true);
    setLogoUploadMsg('Procesando y subiendo imagen...');

    // 1. Vista previa local inmediata vía data URL
    try {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result && typeof ev.target.result === 'string') {
          setLogoUrl(ev.target.result);
        }
      };
      reader.readAsDataURL(file);
    } catch (e) {}

    // 2. Subida a Supabase Storage y Backend
    try {
      const ext = file.name.split('.').pop() || 'png';
      const fileName = `email_logo_${Date.now()}.${ext}`;
      const filePath = `logos/${fileName}`;

      let publicUrlCandidate = '';

      // Intento 1: Supabase Storage bucket 'socorristas'
      try {
        const { error: sbErr } = await supabase.storage
          .from('socorristas')
          .upload(filePath, file, { cacheControl: '3600', upsert: true });

        if (!sbErr) {
          const { data } = supabase.storage.from('socorristas').getPublicUrl(filePath);
          if (data?.publicUrl) {
            publicUrlCandidate = data.publicUrl;
          }
        }
      } catch (sbE) {
        console.warn('Supabase storage upload skipped/error:', sbE);
      }

      // Intento 2: Backend /api/upload-file si Supabase falló o para redundancia
      if (!publicUrlCandidate) {
        try {
          const formData = new FormData();
          formData.append('file', file);
          const uploadRes = await fetch(getApiUrl('/api/upload-file'), {
            method: 'POST',
            body: formData
          });
          if (uploadRes.ok) {
            const upJson = await uploadRes.json();
            if (upJson.url) {
              publicUrlCandidate = upJson.url.startsWith('http') 
                ? upJson.url 
                : `${window.location.origin}${upJson.url}`;
            }
          }
        } catch (upE) {
          console.warn('Backend upload-file error:', upE);
        }
      }

      if (publicUrlCandidate) {
        setLogoUrl(publicUrlCandidate);
        setLogoUploadMsg('✓ Imagen subida y URL pública generada');
      } else {
        setLogoUploadMsg('✓ Imagen precargada');
      }
      setTimeout(() => setLogoUploadMsg(null), 4000);
    } catch (err: any) {
      console.error('Error uploading email logo:', err);
      setLogoUploadMsg('Aviso: Imagen en vista local');
    } finally {
      setUploadingLogo(false);
    }
  };

  // Estado de carga y guardado
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Prueba de envío
  const [testEmailDestino, setTestEmailDestino] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Cargar configuración guardada al abrir
  useEffect(() => {
    if (!isOpen) return;

    const loadConfig = async () => {
      setLoading(true);
      try {
        // Cargar desde base de datos del backend (/api/configuracion)
        try {
          const apiRes = await fetch(getApiUrl('/api/configuracion'));
          if (apiRes.ok) {
            const cfg = await apiRes.json();
            if (cfg.email_remitente_global) setRemitenteGlobal(cfg.email_remitente_global);
            if (cfg.email_remitente_nombre_global) setRemitenteNombreGlobal(cfg.email_remitente_nombre_global);
            if (cfg.email_remitente_no_reply_mode !== undefined) setUsarRemitenteGlobal(cfg.email_remitente_no_reply_mode !== 'false');
            if (cfg.email_template_header_color) setHeaderColor(cfg.email_template_header_color);
            if (cfg.email_template_header_text_color) setHeaderTextColor(cfg.email_template_header_text_color);
            if (cfg.email_template_footer_color) setFooterColor(cfg.email_template_footer_color);
            if (cfg.email_template_footer_text_color) setFooterTextColor(cfg.email_template_footer_text_color);
            if (cfg.email_template_font_title) setFontTitle(cfg.email_template_font_title);
            if (cfg.email_template_font_body) setFontBody(cfg.email_template_font_body);
            if (cfg.email_template_logo) setLogoUrl(cfg.email_template_logo);
            if (cfg.email_template_mostrar_logo !== undefined) setMostrarLogo(cfg.email_template_mostrar_logo !== 'false');
            if (cfg.email_template_legend) setLeyendaNoReply(cfg.email_template_legend);
            if (cfg.email_template_telefono_contacto) setTelefonoContacto(cfg.email_template_telefono_contacto);
            if (cfg.smtp_host) setSmtpHost(cfg.smtp_host);
            if (cfg.smtp_port) setSmtpPort(cfg.smtp_port);
            if (cfg.smtp_secure !== undefined) setSmtpSecure(cfg.smtp_secure === 'true');
            if (cfg.smtp_user) setSmtpUser(cfg.smtp_user);
            if (cfg.smtp_pass) setSmtpPass(cfg.smtp_pass);
          }
        } catch (apiErr) {
          console.warn('Error leyendo /api/configuracion:', apiErr);
        }

        // Consultar estado de conexión SMTP con el servidor
        try {
          const statusRes = await fetch(getApiUrl('/api/smtp-config-status'));
          if (statusRes.ok) {
            const statusJson = await statusRes.json();
            setSmtpStatus(statusJson);
            if (statusJson.host) setSmtpHost(statusJson.host);
            if (statusJson.port) setSmtpPort(statusJson.port);
            if (statusJson.user) setSmtpUser(statusJson.user);
          }
        } catch (smtpErr) {
          console.warn('No se pudo verificar estado de SMTP:', smtpErr);
        }
      } catch (e) {
        console.warn('Error cargando configuración visual de correos:', e);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [isOpen]);

  if (!isOpen) return null;

  // Objetos de diseño unificado actual
  const currentDesign: EmailDesignConfig = {
    headerColor,
    headerTextColor,
    footerColor,
    footerTextColor,
    fontTitle: `'${fontTitle}', -apple-system, BlinkMacSystemFont, sans-serif`,
    fontBody: `'${fontBody}', -apple-system, BlinkMacSystemFont, sans-serif`,
    logoUrl,
    mostrarLogo,
    leyendaNoReply,
    telefonoContacto
  };

  // Datos simulados de prueba para vista previa
  const previewHtml = () => {
    if (previewTab === 'notificacion') {
      return generarHtmlCorreoAprobacion({
        remitenteNombre: remitenteNombreGlobal,
        remitenteCorreo: remitenteGlobal,
        destinatarioCorreo: 'socorrista.ejemplo@cruzverdesv.org',
        destinatarioNombre: 'Carlos Eduardo Ramírez',
        asunto: '¡Tu cuenta ha sido aprobada! - Cruz Verde Salvadoreña',
        seccionalNombre: 'Seccional Santa Anita',
        rolAsignado: 'socorrista',
        loginUrl: getOfficialLoginUrl()
      }, currentDesign);
    }

    if (previewTab === 'compra') {
      return generarHtmlCorreoCompra({
        remitenteNombre: remitenteNombreGlobal,
        remitenteCorreo: remitenteGlobal,
        destinatarioCorreo: 'administracion@cruzverde.org.sv',
        destinatarioNombre: 'Departamento Administrativo',
        asunto: 'Solicitud de Compra SC-2026-0042 - Seccional Santa Anita',
        seccionalNombre: 'Seccional Santa Anita',
      }, {
        numeroSolicitud: 'SC-2026-0042',
        fecha: new Date().toLocaleDateString('es-SV', { year: 'numeric', month: 'long', day: 'numeric' }),
        seccional: 'Seccional Santa Anita (San Salvador)',
        solicitante: 'Lic. Roberto Gómez',
        director: 'Lic. Roberto Gómez (Director Seccional)',
        vehiculoOEquipo: 'Ambulancia Tipo A (M-04) - Placa MB-4592',
        urgencia: 'Alta',
        justificacion: 'Reemplazo urgente de pastillas de frenos delanteros y amortiguadores traseros para garantizar la operatividad continua de la unidad en traslados de emergencia hacia el Hospital Bloom y Hospital Rosales.',
        proveedorSugerido: 'Repuestos Los Héroes S.A. de C.V.',
        items: [
          { descripcion: 'Juego de pastillas de freno delanteras cerámicas', cantidad: 2, unidad: 'juegos', precioEstimado: 45.00, subtotal: 90.00 },
          { descripcion: 'Amortiguadores traseros reforzados gas', cantidad: 2, unidad: 'pares', precioEstimado: 85.50, subtotal: 171.00 },
          { descripcion: 'Mano de obra certificada e instalación mecánica', cantidad: 1, unidad: 'servicio', precioEstimado: 60.00, subtotal: 60.00 }
        ],
        totalEstimado: 321.00,
        nombreArchivoPdf: 'Solicitud_Compra_SC-2026-0042.pdf'
      }, currentDesign);
    }

    // Combustible
    return generarHtmlCorreoCombustible({
      remitenteNombre: remitenteNombreGlobal,
      remitenteCorreo: remitenteGlobal,
      destinatarioCorreo: 'control_combustible@cruzverdesv.org',
      destinatarioNombre: 'Control de Flota y Combustible',
      asunto: 'Solicitud de Combustible COMB-2026-0089 - Seccional Santa Ana',
      seccionalNombre: 'Seccional Santa Ana',
    }, {
      codigoSolicitud: 'COMB-2026-0089',
      fecha: new Date().toLocaleDateString('es-SV', { year: 'numeric', month: 'long', day: 'numeric' }),
      seccional: 'Seccional Santa Ana',
      solicitante: 'Carlos Alvarado (Motorista de Turno)',
      vehiculo: 'Unidad de Rescate R-3',
      placa: 'P-89234',
      kilometrajeActual: '142,580',
      misionOJustificacion: 'Cobertura de emergencias nocturnas en Carretera Panamericana y apoyo en traslados interhospitalarios programados para el fin de semana.',
      tipoCombustible: 'Diesel Regular',
      galonesSolicitados: 15,
      cuponOVales: 'VALE-CVS-9402',
      nombreArchivoPdf: 'Solicitud_Combustible_COMB-2026-0089.pdf'
    }, currentDesign);
  };

  // Guardar configuración en la base de datos
  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const configDict: Record<string, string> = {
        email_remitente_global: remitenteGlobal,
        email_remitente_nombre_global: remitenteNombreGlobal,
        email_remitente_no_reply_mode: String(usarRemitenteGlobal),
        email_template_header_color: headerColor,
        email_template_header_text_color: headerTextColor,
        email_template_footer_color: footerColor,
        email_template_footer_text_color: footerTextColor,
        email_template_font_title: fontTitle,
        email_template_font_body: fontBody,
        email_template_logo: logoUrl,
        email_template_mostrar_logo: String(mostrarLogo),
        email_template_legend: leyendaNoReply,
        email_template_telefono_contacto: telefonoContacto,
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_secure: String(smtpSecure),
        smtp_user: smtpUser,
        smtp_pass: smtpPass,
        smtp_from: `${remitenteNombreGlobal} <${remitenteGlobal}>`,
        smtp_reply_to: 'noreply@cruzverdesv.org'
      };

      if (usarRemitenteGlobal) {
        configDict.solicitudes_correo_remitente = remitenteGlobal;
        configDict.combustible_correo_remitente = remitenteGlobal;
        configDict.email_remitente_correo = remitenteGlobal;
        configDict.email_remitente_nombre = remitenteNombreGlobal;
      }

      // Guardar en Backend SQLite
      try {
        await fetch(getApiUrl('/api/configuracion'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(configDict)
        });
      } catch (errApi) {
        console.warn('Error guardando en /api/configuracion:', errApi);
      }

      // Guardar en Supabase (si está configurado)
      try {
        const configPairs = Object.entries(configDict).map(([clave, valor]) => ({ clave, valor }));
        for (const pair of configPairs) {
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
      } catch (errSupabase) {
        console.warn('Error sincronizando con Supabase:', errSupabase);
      }

      // Guardar en contingencia local
      localStorage.setItem('cruz_verde_email_design', JSON.stringify({
        remitenteGlobal,
        remitenteNombreGlobal,
        usarRemitenteGlobal,
        headerColor,
        headerTextColor,
        footerColor,
        footerTextColor,
        fontTitle,
        fontBody,
        logoUrl,
        mostrarLogo,
        leyendaNoReply,
        telefonoContacto
      }));

      // Actualizar estado SMTP en tiempo real
      try {
        const statusRes = await fetch(getApiUrl('/api/smtp-config-status'));
        if (statusRes.ok) {
          const statusJson = await statusRes.json();
          setSmtpStatus(statusJson);
        }
      } catch (e) {}

      await refreshSettings();
      await logActivity('Actualizó diseño y credenciales de correo institucional', 'Configuración', 'email_design', {
        remitente: `${remitenteNombreGlobal} <${remitenteGlobal}>`,
        smtp_host: smtpHost,
        smtp_user: smtpUser
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
      if (onSaved) onSaved();

    } catch (err: any) {
      console.error('Error guardando configuración de correos:', err);
      alert(`Error al guardar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Guardar configuración SMTP directamente desde el apartado de Remitente y SMTP
  const handleSaveSmtpSettings = async () => {
    setSavingSmtp(true);
    setSmtpSaveSuccess(null);
    try {
      const configDict: Record<string, string> = {
        email_remitente_global: remitenteGlobal,
        email_remitente_nombre_global: remitenteNombreGlobal,
        email_remitente_no_reply_mode: String(usarRemitenteGlobal),
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_secure: String(smtpSecure),
        smtp_user: smtpUser,
        smtp_pass: smtpPass,
        smtp_from: `${remitenteNombreGlobal} <${remitenteGlobal}>`,
        smtp_reply_to: 'noreply@cruzverdesv.org'
      };

      if (usarRemitenteGlobal) {
        configDict.solicitudes_correo_remitente = remitenteGlobal;
        configDict.combustible_correo_remitente = remitenteGlobal;
        configDict.email_remitente_correo = remitenteGlobal;
        configDict.email_remitente_nombre = remitenteNombreGlobal;
      }

      // 1. Guardar en Backend SQLite
      try {
        await fetch(getApiUrl('/api/configuracion'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(configDict)
        });
      } catch (errApi) {
        console.warn('Error guardando en /api/configuracion:', errApi);
      }

      // 2. Guardar en Supabase (si está configurado)
      try {
        const configPairs = Object.entries(configDict).map(([clave, valor]) => ({ clave, valor }));
        for (const pair of configPairs) {
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
      } catch (errSupabase) {
        console.warn('Error sincronizando con Supabase:', errSupabase);
      }

      // 3. Consultar estado actualizado de conexión SMTP desde el servidor
      try {
        const statusRes = await fetch(getApiUrl('/api/smtp-config-status'));
        if (statusRes.ok) {
          const statusJson = await statusRes.json();
          setSmtpStatus(statusJson);
        }
      } catch (e) {}

      await refreshSettings();
      await logActivity(
        `Guardó configuración de servidor SMTP (${smtpHost})`,
        'Configuración',
        'smtp_settings',
        {
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure,
          user: smtpUser,
          remitente: `${remitenteNombreGlobal} <${remitenteGlobal}>`
        }
      );

      const providerLabel = smtpHost.includes('hostinger') 
        ? 'Hostinger' 
        : (smtpHost.includes('office365') ? 'Microsoft 365' : (smtpHost.includes('brevo') ? 'Brevo' : 'Servidor SMTP'));
      
      setSmtpSaveSuccess(`¡Ajustes de servidor SMTP (${providerLabel}) guardados exitosamente en la base de datos!`);
      setTimeout(() => setSmtpSaveSuccess(null), 6000);
      if (onSaved) onSaved();

    } catch (err: any) {
      console.error('Error guardando configuración SMTP:', err);
      alert(`Error al guardar configuración SMTP: ${err.message}`);
    } finally {
      setSavingSmtp(false);
    }
  };

  const getSmtpSql = () => {
    return `-- =========================================================================
-- CONFIGURACIÓN DE SERVIDOR SMTP EN LA BASE DE DATOS (HOSTINGER / SERVIDOR EXTERNO)
-- Tabla: public.configuracion
-- =========================================================================
INSERT INTO public.configuracion (clave, valor)
VALUES 
  ('smtp_host', '${smtpHost}'),
  ('smtp_port', '${smtpPort}'),
  ('smtp_secure', '${String(smtpSecure)}'),
  ('smtp_user', '${smtpUser}'),
  ('smtp_pass', '${smtpPass.replace(/'/g, "''")}'),
  ('smtp_from', '${remitenteNombreGlobal} <${remitenteGlobal}>'),
  ('smtp_reply_to', 'noreply@cruzverdesv.org'),
  ('email_remitente_global', '${remitenteGlobal}'),
  ('email_remitente_nombre_global', '${remitenteNombreGlobal}'),
  ('email_remitente_no_reply_mode', '${String(usarRemitenteGlobal)}')
ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor;`;
  };

  const handleCopySmtpSql = () => {
    navigator.clipboard.writeText(getSmtpSql());
    setCopiedSmtpSql(true);
    setTimeout(() => setCopiedSmtpSql(false), 3000);
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestConnResult(null);
    try {
      const res = await fetch(getApiUrl('/api/smtp-test-connection'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure,
          user: smtpUser,
          pass: smtpPass
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setTestConnResult({ 
          success: true, 
          message: data.message || 'Conexión SMTP exitosa con el servidor de correo.' 
        });
      } else {
        setTestConnResult({ 
          success: false, 
          message: data.error || 'No se pudo autenticar con el servidor de correo.',
          sugerencia: data.sugerencia
        });
      }
    } catch (err: any) {
      setTestConnResult({ 
        success: false, 
        message: 'Error al contactar el servidor: ' + err.message 
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailDestino) {
      alert('Por favor escribe un correo de destino para la prueba.');
      return;
    }
    setSendingTest(true);
    setTestSuccess(null);
    setTestError(null);
    try {
      const asuntoTest = `[PRUEBA] Diseño de Correo - ${previewTab === 'compra' ? 'Solicitud de Compra' : (previewTab === 'combustible' ? 'Solicitud de Combustible' : 'Notificación de Acceso')}`;
      
      const resData = await sendEmailNotification({
        remitente: `${remitenteNombreGlobal} <${remitenteGlobal}>`,
        destinatario: testEmailDestino,
        asunto: asuntoTest,
        cuerpoHtml: previewHtml(),
        tipo: `test_${previewTab}`
      });

      if (resData.success) {
        setTestSuccess(`Correo enviado con éxito a ${testEmailDestino}. Revisa tu bandeja.`);
        setTimeout(() => setTestSuccess(null), 8000);
      } else {
        setTestError('Aviso: El correo no se envió en modo real porque falta la contraseña SMTP. Configúrala en la pestaña de Servidor SMTP.');
      }
    } catch (err: any) {
      setTestError('Error al procesar el envío: ' + err.message);
    } finally {
      setSendingTest(false);
    }
  };

  const handleCopySql = () => {
    const sql = `-- MIGRACIÓN 19: CONFIGURACIÓN GLOBAL DE REMITENTE NO-REPLY Y PLANTILLA DE CORREOS
INSERT INTO public.configuracion (clave, valor)
VALUES 
  ('email_remitente_global', '${remitenteGlobal}'),
  ('email_remitente_nombre_global', '${remitenteNombreGlobal}'),
  ('email_remitente_no_reply_mode', '${String(usarRemitenteGlobal)}'),
  ('email_template_header_color', '${headerColor}'),
  ('email_template_header_text_color', '${headerTextColor}'),
  ('email_template_footer_color', '${footerColor}'),
  ('email_template_footer_text_color', '${footerTextColor}'),
  ('email_template_font_title', '${fontTitle}'),
  ('email_template_font_body', '${fontBody}'),
  ('email_template_logo', '${logoUrl}'),
  ('email_template_mostrar_logo', '${String(mostrarLogo)}'),
  ('email_template_legend', '${leyendaNoReply.replace(/'/g, "''")}'),
  ('email_template_telefono_contacto', '${telefonoContacto}')
ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor;`;

    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const swatchesHeader = [
    { name: 'Verde Cruz Verde', hex: '#15803d' },
    { name: 'Verde Bosque', hex: '#166534' },
    { name: 'Azul Institucional', hex: '#001A70' },
    { name: 'Azul Marino', hex: '#1e3a8a' },
    { name: 'Rojo Emergencia', hex: '#b91c1c' },
    { name: 'Grafito', hex: '#1f2937' },
  ];

  const swatchesFooter = [
    { name: 'Blanco Humo', hex: '#f9fafb' },
    { name: 'Gris Neutro', hex: '#f1f5f9' },
    { name: 'Gris Oscuro', hex: '#1f2937' },
    { name: 'Azul Noche', hex: '#0f172a' },
    { name: 'Verde Profundo', hex: '#14532d' },
  ];

  const fonts = [
    'Plus Jakarta Sans',
    'Inter',
    'Roboto',
    'Montserrat',
    'Segoe UI',
    'Arial',
    'Georgia'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-md p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-7xl max-h-[92vh] flex flex-col border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Cabecera Estilo Apple macOS Window */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center shrink-0 border border-slate-200/60 shadow-2xs">
              <Palette className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-900 tracking-tight">Personalizador de Plantillas de Correo</h2>
                <span className="px-2 py-0.5 rounded-full text-3xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  No-Reply Unificado
                </span>
              </div>
              <p className="text-2xs text-gray-400">Diseño institucional de correos, membrete y servidor de despacho</p>
            </div>
          </div>

          <button 
            type="button" 
            onClick={onClose} 
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notificación de Guardado */}
        {saveSuccess && (
          <div className="bg-emerald-600 text-white px-6 py-2.5 text-xs font-medium flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Plantilla guardada y sincronizada correctamente.</span>
            </div>
            <span className="text-2xs opacity-80">Sincronizado con Notificaciones, Compra y Combustible</span>
          </div>
        )}

        {/* Cuerpo Principal Dividido (Panel de Edición Apple a la Izq, Vista Previa a la Der) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-0">
          
          {/* COLUMNA IZQUIERDA: CONTROLES EN TABS ESTILO APPLE (5 columnas) */}
          <div className="lg:col-span-5 border-r border-slate-200/80 p-5 overflow-y-auto max-h-[calc(92vh-130px)] space-y-4 bg-slate-50/50">
            
            {/* Segmented Control de Secciones (Apple Style) */}
            <div className="bg-slate-200/60 p-1 rounded-xl flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveEditorTab('diseno')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeEditorTab === 'diseno'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Diseño Visual
              </button>
              <button
                type="button"
                onClick={() => setActiveEditorTab('servidor')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeEditorTab === 'servidor'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Remitente y SMTP
              </button>
              <button
                type="button"
                onClick={() => setActiveEditorTab('prueba')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeEditorTab === 'prueba'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Prueba
              </button>
            </div>

            {/* TAB 1: DISEÑO VISUAL */}
            {activeEditorTab === 'diseno' && (
              <div className="space-y-4 animate-in fade-in">
                
                {/* 1. Encabezado y Pie de Página (Colores) */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-4">
                  <div className="flex items-center space-x-2.5 pb-2.5 border-b border-slate-100">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-700 flex items-center justify-center">
                      <Palette className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-semibold text-gray-900">Paleta de Colores Institucionales</span>
                  </div>

                  {/* Header Color */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-2xs">
                      <label className="font-medium text-gray-700">Color de Encabezado (Header)</label>
                      <span className="font-mono text-gray-400">{headerColor}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={headerColor}
                        onChange={(e) => setHeaderColor(e.target.value)}
                        className="w-8 h-8 rounded-lg border border-slate-200 p-0.5 cursor-pointer shrink-0"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {swatchesHeader.map(sw => (
                          <button
                            key={sw.hex}
                            type="button"
                            onClick={() => setHeaderColor(sw.hex)}
                            className={`w-7 h-7 rounded-lg border transition-all cursor-pointer ${
                              headerColor.toLowerCase() === sw.hex.toLowerCase() 
                                ? 'scale-110 ring-2 ring-emerald-500 ring-offset-1 border-emerald-500' 
                                : 'border-slate-200 hover:scale-105'
                            }`}
                            style={{ backgroundColor: sw.hex }}
                            title={sw.name}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Footer Color */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <div className="flex justify-between items-center text-2xs">
                      <label className="font-medium text-gray-700">Color de Pie de Página (Footer)</label>
                      <span className="font-mono text-gray-400">{footerColor}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={footerColor}
                        onChange={(e) => {
                          setFooterColor(e.target.value);
                          if (['#1f2937', '#0f172a', '#14532d'].includes(e.target.value)) {
                            setFooterTextColor('#cbd5e1');
                          } else {
                            setFooterTextColor('#6b7280');
                          }
                        }}
                        className="w-8 h-8 rounded-lg border border-slate-200 p-0.5 cursor-pointer shrink-0"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {swatchesFooter.map(sw => (
                          <button
                            key={sw.hex}
                            type="button"
                            onClick={() => {
                              setFooterColor(sw.hex);
                              if (['#1f2937', '#0f172a', '#14532d'].includes(sw.hex)) {
                                setFooterTextColor('#cbd5e1');
                              } else {
                                setFooterTextColor('#6b7280');
                              }
                            }}
                            className={`w-7 h-7 rounded-lg border transition-all cursor-pointer ${
                              footerColor.toLowerCase() === sw.hex.toLowerCase() 
                                ? 'scale-110 ring-2 ring-emerald-500 ring-offset-1 border-emerald-500' 
                                : 'border-slate-200 hover:scale-105'
                            }`}
                            style={{ backgroundColor: sw.hex }}
                            title={sw.name}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Tipografías */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-3">
                  <div className="flex items-center space-x-2.5 pb-2.5 border-b border-slate-100">
                    <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-700 flex items-center justify-center">
                      <Type className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-semibold text-gray-900">Tipografías del Documento</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-3xs font-medium text-gray-500 uppercase tracking-wider mb-1">Títulos</label>
                      <select
                        value={fontTitle}
                        onChange={(e) => setFontTitle(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-medium text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all cursor-pointer"
                      >
                        {fonts.map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-3xs font-medium text-gray-500 uppercase tracking-wider mb-1">Cuerpo de Texto</label>
                      <select
                        value={fontBody}
                        onChange={(e) => setFontBody(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-medium text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all cursor-pointer"
                      >
                        {fonts.map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 3. Escudo y Membrete */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-700 flex items-center justify-center">
                        <ImageIcon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-gray-900">Escudo Institucional</span>
                    </div>

                    <label className="flex items-center space-x-2 cursor-pointer">
                      <span className="text-2xs text-gray-500 font-medium">{mostrarLogo ? 'Visible' : 'Oculto'}</span>
                      <input
                        type="checkbox"
                        checked={mostrarLogo}
                        onChange={(e) => setMostrarLogo(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                      />
                    </label>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-3xs font-medium text-gray-500 uppercase tracking-wider">Logo / Escudo para Correo</label>
                      <label className="inline-flex items-center px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-3xs font-bold cursor-pointer transition-colors shadow-2xs">
                        <Upload className="w-3 h-3 mr-1" />
                        {uploadingLogo ? 'Subiendo...' : 'Subir imagen'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleUploadEmailLogo}
                          disabled={uploadingLogo}
                        />
                      </label>
                    </div>

                    <input
                      type="text"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="https://.../logo.png"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-mono text-gray-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    />

                    {logoUploadMsg && (
                      <p className="text-3xs text-emerald-700 font-semibold flex items-center">
                        <Sparkles className="w-3 h-3 mr-1" />
                        {logoUploadMsg}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => setLogoUrl(DEFAULT_EMAIL_DESIGN.logoUrl)}
                      className="text-2xs text-emerald-700 hover:text-emerald-800 font-medium cursor-pointer"
                    >
                      Restaurar escudo oficial Cruz Verde
                    </button>
                    {logoUrl && (
                      <div className="h-8 w-8 rounded-lg bg-slate-100 p-0.5 border border-slate-200 flex items-center justify-center overflow-hidden">
                        <img 
                          src={logoUrl} 
                          alt="Logo" 
                          className="max-h-full max-w-full object-contain" 
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. Pie Institucional y Teléfonos */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-3">
                  <div className="flex items-center space-x-2.5 pb-2.5 border-b border-slate-100">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-semibold text-gray-900">Pie de Página y Advertencia No-Reply</span>
                  </div>

                  <div>
                    <label className="block text-3xs font-medium text-gray-500 uppercase tracking-wider mb-1">Advertencia de Seguridad</label>
                    <textarea
                      rows={2}
                      value={leyendaNoReply}
                      onChange={(e) => setLeyendaNoReply(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-gray-700 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="block text-3xs font-medium text-gray-500 uppercase tracking-wider mb-1">Teléfonos de Contacto</label>
                    <input
                      type="text"
                      value={telefonoContacto}
                      onChange={(e) => setTelefonoContacto(e.target.value)}
                      placeholder="2284-0000 / 7695-7911"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-gray-700 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    />
                  </div>
                </div>

              </div>
            )}

            {/* TAB 2: REMITENTE Y SMTP */}
            {activeEditorTab === 'servidor' && (
              <div className="space-y-4 animate-in fade-in">
                
                {/* Remitente No-Reply Unificado */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-3">
                  <div className="flex items-center space-x-2.5 pb-2.5 border-b border-slate-100">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-700 flex items-center justify-center">
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-semibold text-gray-900">Remitente Oficial No-Reply</span>
                  </div>

                  <div>
                    <label className="block text-3xs font-medium text-gray-500 uppercase tracking-wider mb-1">Dirección de Envío</label>
                    <input
                      type="email"
                      value={remitenteGlobal}
                      onChange={(e) => setRemitenteGlobal(e.target.value)}
                      placeholder="notificaciones@cruzverdesv.org"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-mono text-gray-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-3xs font-medium text-gray-500 uppercase tracking-wider mb-1">Nombre Visible</label>
                    <input
                      type="text"
                      value={remitenteNombreGlobal}
                      onChange={(e) => setRemitenteNombreGlobal(e.target.value)}
                      placeholder="Cruz Verde Salvadoreña (No Responder)"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-gray-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    />
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60 text-2xs text-gray-600 font-mono">
                    {remitenteNombreGlobal} &lt;{remitenteGlobal}&gt;
                  </div>

                  <label className="flex items-start space-x-2.5 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={usarRemitenteGlobal}
                      onChange={(e) => setUsarRemitenteGlobal(e.target.checked)}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                    <span className="text-2xs text-gray-700 font-medium leading-relaxed">
                      Aplicar este remitente a todos los módulos (Notificaciones, Compra y Combustible).
                    </span>
                  </label>
                </div>

                {/* Servidor SMTP */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-3.5">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-6 h-6 rounded-lg bg-sky-500/10 text-sky-700 flex items-center justify-center">
                        <Server className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-gray-900">Servidor de Correo SMTP</span>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-3xs font-semibold ${
                      (smtpStatus?.configured || smtpStatus?.hasPassword)
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' 
                        : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                    }`}>
                      {(smtpStatus?.configured || smtpStatus?.hasPassword) ? '● Conectado' : '○ Modo Simulación'}
                    </span>
                  </div>

                  {/* Selector rápido de proveedor (Apple segmented pills) */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-3xs font-medium text-gray-500 uppercase tracking-wider">Proveedor Rápido de Correo</label>
                      <span className="text-3xs text-emerald-700 font-medium">Recomendado: Hostinger</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSmtpHost('smtp.hostinger.com');
                          setSmtpPort('465');
                          setSmtpSecure(true);
                          if (!smtpUser || smtpUser.includes('office365') || smtpUser.includes('hotmail')) {
                            setSmtpUser('notificaciones@cruzverdesv.org');
                          }
                        }}
                        className={`px-3 py-2 rounded-xl text-2xs font-semibold transition-all cursor-pointer text-left border relative ${
                          smtpHost.includes('hostinger') 
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-950 shadow-xs ring-2 ring-emerald-500/20' 
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold flex items-center">
                            Hostinger
                            {smtpHost.includes('hostinger') && (
                              <Check className="w-3.5 h-3.5 ml-1 text-emerald-600" />
                            )}
                          </span>
                          <span className="px-1.5 py-0.2 rounded-full text-3xs font-black bg-emerald-600 text-white">
                            Oficial
                          </span>
                        </div>
                        <span className="text-3xs text-gray-500 block mt-0.5 font-mono">smtp.hostinger.com (465 SSL)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSmtpHost('smtp.office365.com');
                          setSmtpPort('587');
                          setSmtpSecure(false);
                          if (!smtpUser || smtpUser.includes('hostinger') || smtpUser.includes('hotmail')) {
                            setSmtpUser('notificaciones@cruzverdesv.org');
                          }
                        }}
                        className={`px-3 py-2 rounded-xl text-2xs font-semibold transition-all cursor-pointer text-left border ${
                          smtpHost.includes('office365') 
                            ? 'bg-sky-50 border-sky-400 text-sky-950 shadow-xs ring-2 ring-sky-500/20' 
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold">Microsoft 365</span>
                          {smtpHost.includes('office365') && (
                            <Check className="w-3.5 h-3.5 ml-1 text-sky-600" />
                          )}
                        </div>
                        <span className="text-3xs text-gray-500 block mt-0.5 font-mono">smtp.office365.com (587 TLS)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSmtpHost('smtp-relay.brevo.com');
                          setSmtpPort('587');
                          setSmtpSecure(false);
                        }}
                        className={`px-3 py-2 rounded-xl text-2xs font-semibold transition-all cursor-pointer text-left border ${
                          smtpHost.includes('brevo') 
                            ? 'bg-purple-50 border-purple-400 text-purple-950 shadow-xs ring-2 ring-purple-500/20' 
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold">Brevo Relay API</span>
                          {smtpHost.includes('brevo') && (
                            <Check className="w-3.5 h-3.5 ml-1 text-purple-600" />
                          )}
                        </div>
                        <span className="text-3xs text-gray-500 block mt-0.5 font-mono">smtp-relay.brevo.com</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSmtpHost('smtp-mail.outlook.com');
                          setSmtpPort('587');
                          setSmtpSecure(false);
                        }}
                        className={`px-3 py-2 rounded-xl text-2xs font-semibold transition-all cursor-pointer text-left border ${
                          smtpHost.includes('outlook') 
                            ? 'bg-amber-50 border-amber-400 text-amber-950 shadow-xs ring-2 ring-amber-500/20' 
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold">Outlook / Hotmail</span>
                          {smtpHost.includes('outlook') && (
                            <Check className="w-3.5 h-3.5 ml-1 text-amber-600" />
                          )}
                        </div>
                        <span className="text-3xs text-gray-500 block mt-0.5 font-mono">smtp-mail.outlook.com</span>
                      </button>
                    </div>
                  </div>

                  {/* Campos de conexión */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block text-3xs font-medium text-gray-500 uppercase tracking-wider mb-1">Host SMTP</label>
                      <input
                        type="text"
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        placeholder="smtp.hostinger.com"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-mono text-gray-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-3xs font-medium text-gray-500 uppercase tracking-wider mb-1">Puerto</label>
                      <input
                        type="text"
                        value={smtpPort}
                        onChange={(e) => {
                          setSmtpPort(e.target.value);
                          if (e.target.value === '465') setSmtpSecure(true);
                          else if (e.target.value === '587') setSmtpSecure(false);
                        }}
                        placeholder="465"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-mono text-gray-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Selector Rápido de Protocolo y Seguridad SSL/TLS */}
                  <div>
                    <label className="block text-3xs font-medium text-gray-500 uppercase tracking-wider mb-1">Cifrado y Seguridad de Conexión</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSmtpPort('465');
                          setSmtpSecure(true);
                        }}
                        className={`px-2.5 py-1.5 rounded-xl text-2xs font-semibold transition-all cursor-pointer border flex items-center justify-between ${
                          smtpSecure && smtpPort === '465'
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-900 shadow-2xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>Puerto 465 (SSL/TLS)</span>
                        <span className="text-3xs text-emerald-700 font-bold">Hostinger</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSmtpPort('587');
                          setSmtpSecure(false);
                        }}
                        className={`px-2.5 py-1.5 rounded-xl text-2xs font-semibold transition-all cursor-pointer border flex items-center justify-between ${
                          !smtpSecure && smtpPort === '587'
                            ? 'bg-sky-50 border-sky-400 text-sky-900 shadow-2xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>Puerto 587 (STARTTLS)</span>
                        <span className="text-3xs text-sky-700 font-bold">Office 365</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-3xs font-medium text-gray-500 uppercase tracking-wider mb-1">Usuario SMTP (Buzón Completo)</label>
                    <input
                      type="email"
                      value={smtpUser}
                      onChange={(e) => {
                        setSmtpUser(e.target.value);
                        if (usarRemitenteGlobal) setRemitenteGlobal(e.target.value);
                      }}
                      placeholder="notificaciones@cruzverdesv.org"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-mono text-gray-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-3xs font-medium text-gray-500 uppercase tracking-wider">Contraseña SMTP</label>
                      <button
                        type="button"
                        onClick={() => setShowSmtpPass(!showSmtpPass)}
                        className="text-3xs text-emerald-700 hover:text-emerald-900 flex items-center cursor-pointer font-medium"
                      >
                        {showSmtpPass ? <EyeOff className="w-3 h-3 mr-0.5" /> : <Eye className="w-3 h-3 mr-0.5" />}
                        {showSmtpPass ? 'Ocultar' : 'Mostrar'}
                      </button>
                    </div>
                    <input
                      type={showSmtpPass ? 'text' : 'password'}
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      placeholder="Contraseña del buzón en Hostinger o servidor"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-mono text-gray-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    />
                  </div>

                  {/* Alerta de Éxito al Guardar Ajuste SMTP */}
                  {smtpSaveSuccess && (
                    <div className="p-3 bg-emerald-600 text-white rounded-xl text-xs font-medium flex items-center justify-between shadow-xs animate-in fade-in">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{smtpSaveSuccess}</span>
                      </div>
                      <span className="text-3xs opacity-80 uppercase tracking-wider font-bold">Base de Datos OK</span>
                    </div>
                  )}

                  {/* BOTÓN PRINCIPAL DE GUARDAR AJUSTES SMTP */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleSaveSmtpSettings}
                      disabled={savingSmtp}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center transition-all cursor-pointer shadow-sm hover:shadow"
                    >
                      <Save className={`w-3.5 h-3.5 mr-1.5 ${savingSmtp ? 'animate-spin' : ''}`} />
                      {savingSmtp ? 'Guardando ajustes de SMTP...' : `Guardar Ajustes de Servidor SMTP (${smtpHost.includes('hostinger') ? 'Hostinger' : 'Servidor'})`}
                    </button>
                  </div>

                  {/* Acciones Secundarias: Probar Conexión, Copiar SQL y Ver SQL */}
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={testingConnection || !smtpPass}
                      className="py-2 px-3 bg-slate-900 hover:bg-black disabled:opacity-40 text-white rounded-xl text-xs font-medium flex items-center justify-center transition-all cursor-pointer shadow-xs"
                      title="Verifica en vivo que el host, puerto y credenciales funcionen"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${testingConnection ? 'animate-spin' : ''}`} />
                      {testingConnection ? 'Probando...' : 'Probar Conexión'}
                    </button>

                    <button
                      type="button"
                      onClick={handleCopySmtpSql}
                      className="py-2 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-medium flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                      title="Copiar script SQL para la base de datos externa"
                    >
                      {copiedSmtpSql ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                          <span className="text-emerald-700 font-semibold">¡SQL Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                          <span>Copiar SQL SMTP</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Botón para alternar vista de script SQL */}
                  <div className="text-center pt-0.5">
                    <button
                      type="button"
                      onClick={() => setShowSqlViewer(!showSqlViewer)}
                      className="text-3xs text-slate-500 hover:text-slate-800 font-medium inline-flex items-center cursor-pointer transition-colors"
                    >
                      <Code className="w-3 h-3 mr-1" />
                      {showSqlViewer ? 'Ocultar código SQL' : 'Ver script SQL para ejecutar en Base de Datos'}
                    </button>
                  </div>

                  {/* Visor de SQL desplegable */}
                  {showSqlViewer && (
                    <div className="p-3 bg-slate-900 text-slate-200 rounded-xl text-3xs font-mono border border-slate-800 space-y-2 animate-in fade-in">
                      <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                        <span className="text-slate-400 font-semibold">Script SQL (Hostinger / PostgreSQL / Supabase):</span>
                        <button
                          type="button"
                          onClick={handleCopySmtpSql}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-3xs font-sans transition-colors cursor-pointer"
                        >
                          {copiedSmtpSql ? 'Copiado' : 'Copiar'}
                        </button>
                      </div>
                      <pre className="overflow-x-auto p-1 leading-relaxed whitespace-pre-wrap">
                        {getSmtpSql()}
                      </pre>
                    </div>
                  )}

                  {testConnResult && (
                    <div className={`p-3 rounded-xl text-xs border ${
                      testConnResult.success 
                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' 
                        : 'bg-rose-50/80 border-rose-200 text-rose-900'
                    }`}>
                      <p className="font-semibold flex items-center">
                        {testConnResult.success ? <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 mr-1.5 text-rose-600 shrink-0" />}
                        {testConnResult.message}
                      </p>
                      {testConnResult.sugerencia && (
                        <p className="mt-1 text-2xs text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200/80">
                          <strong>Sugerencia:</strong> {testConnResult.sugerencia}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Desplegable de Guía Paso a Paso */}
                  <div className="pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setMostrarGuiaMicrosoft(!mostrarGuiaMicrosoft)}
                      className="w-full text-left text-2xs text-slate-600 hover:text-slate-900 flex items-center justify-between py-1 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center font-medium">
                        <Info className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                        {mostrarGuiaMicrosoft ? 'Ocultar instrucciones de configuración' : 'Ver instrucciones por proveedor (Hostinger, M365, Brevo)'}
                      </span>
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${mostrarGuiaMicrosoft ? 'rotate-90' : ''}`} />
                    </button>

                    {mostrarGuiaMicrosoft && (
                      <div className="mt-2.5 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-2xs text-slate-700 space-y-3 animate-in fade-in">
                        <div className="flex gap-1 border-b border-slate-200 pb-2">
                          <button
                            type="button"
                            onClick={() => setGuiaTab('hostinger')}
                            className={`px-2 py-0.5 rounded-md text-3xs font-semibold ${guiaTab === 'hostinger' ? 'bg-emerald-600 text-white' : 'text-slate-600'}`}
                          >
                            Hostinger (Recomendado)
                          </button>
                          <button
                            type="button"
                            onClick={() => setGuiaTab('microsoft')}
                            className={`px-2 py-0.5 rounded-md text-3xs font-semibold ${guiaTab === 'microsoft' ? 'bg-sky-600 text-white' : 'text-slate-600'}`}
                          >
                            Microsoft 365
                          </button>
                          <button
                            type="button"
                            onClick={() => setGuiaTab('relay')}
                            className={`px-2 py-0.5 rounded-md text-3xs font-semibold ${guiaTab === 'relay' ? 'bg-purple-600 text-white' : 'text-slate-600'}`}
                          >
                            Brevo Relay
                          </button>
                        </div>

                        {guiaTab === 'hostinger' && (
                          <div className="space-y-1.5 text-3xs leading-relaxed text-slate-600">
                            <p className="font-semibold text-slate-900">Hostinger Webmail / Correo Empresarial:</p>
                            <p>1. Entra a tu <strong>hPanel de Hostinger</strong> &gt; sección <em>Emails</em> &gt; <em>Cuentas de Correo</em>.</p>
                            <p>2. Crea o verifica tu cuenta institucional (ej: <code className="bg-slate-200 px-1 rounded font-mono">notificaciones@cruzverdesv.org</code>).</p>
                            <p>3. Servidor de salida SMTP: <code className="bg-slate-200 px-1 rounded font-mono">smtp.hostinger.com</code></p>
                            <p>4. Puerto recomendado: <code className="bg-slate-200 px-1 rounded font-mono">465</code> con <strong>SSL/TLS activado</strong> (o puerto 587 con STARTTLS).</p>
                            <p>5. Usuario: tu dirección de correo completa. Contraseña: la misma de tu cuenta de correo en Hostinger.</p>
                          </div>
                        )}

                        {guiaTab === 'microsoft' && (
                          <div className="space-y-1.5 text-3xs leading-relaxed text-slate-600">
                            <p className="font-semibold text-slate-900">Microsoft 365 Admin Center:</p>
                            <p>1. Entra a <span className="font-mono text-slate-900">admin.microsoft.com</span> &gt; Usuarios &gt; Usuarios activos.</p>
                            <p>2. Abre el buzón &gt; pestaña <em>Correo</em> &gt; <em>Administrar aplicaciones de correo</em>.</p>
                            <p>3. Marca <strong>"SMTP autenticado"</strong> y guarda cambios.</p>
                            <p>4. Host: <code className="bg-slate-200 px-1 rounded font-mono">smtp.office365.com</code>, Puerto: <code className="bg-slate-200 px-1 rounded font-mono">587</code>.</p>
                          </div>
                        )}

                        {guiaTab === 'relay' && (
                          <div className="space-y-1.5 text-3xs leading-relaxed text-slate-600">
                            <p className="font-semibold text-slate-900">Brevo (Relay API Gratuito - 300 correos/día):</p>
                            <p>1. Crea cuenta en Brevo y valida el dominio en Hostinger DNS (registros TXT).</p>
                            <p>2. Host: <code className="bg-slate-200 px-1 rounded font-mono">smtp-relay.brevo.com</code>, Puerto: <code className="bg-slate-200 px-1 rounded font-mono">587</code>.</p>
                            <p>3. Permite remitente no-reply@cruzverdesv.org sin bloquear por políticas de seguridad corporativas.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                </div>

              </div>
            )}

            {/* TAB 3: PRUEBA DE ENVÍO */}
            {activeEditorTab === 'prueba' && (
              <div className="space-y-4 animate-in fade-in">
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-3.5">
                  <div className="flex items-center space-x-2.5 pb-2.5 border-b border-slate-100">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-700 flex items-center justify-center">
                      <Send className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-gray-900">Envío de Prueba en Vivo</h4>
                      <p className="text-3xs text-gray-400">Verifica la llegada de la plantilla a tu correo</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-3xs font-medium text-gray-500 uppercase tracking-wider mb-1">Destinatario</label>
                    <input
                      type="email"
                      value={testEmailDestino}
                      onChange={(e) => setTestEmailDestino(e.target.value)}
                      placeholder="tu.correo@gmail.com o @cruzverdesv.org"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono text-gray-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSendTestEmail}
                    disabled={sendingTest || !testEmailDestino}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center cursor-pointer shadow-xs"
                  >
                    <Send className={`w-3.5 h-3.5 mr-1.5 ${sendingTest ? 'animate-pulse' : ''}`} />
                    {sendingTest ? 'Enviando correo de prueba...' : 'Enviar Prueba Ahora'}
                  </button>

                  {testSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-2xs font-medium text-emerald-800 flex items-start space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{testSuccess}</span>
                    </div>
                  )}

                  {testError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-2xs font-medium text-rose-800 flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span>{testError}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* COLUMNA DERECHA: VISTA PREVIA INTERACTIVA (APPLE PREVIEW CANVAS) */}
          <div className="lg:col-span-7 flex flex-col bg-slate-100/70 max-h-[calc(92vh-130px)] overflow-hidden">
            
            {/* Toolbar Superior de Vista Previa */}
            <div className="p-3 bg-white/80 backdrop-blur-md border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="bg-slate-200/60 p-0.5 rounded-lg flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setPreviewTab('compra')}
                  className={`px-2.5 py-1 rounded-md text-2xs font-semibold flex items-center transition-all cursor-pointer ${
                    previewTab === 'compra' 
                      ? 'bg-white text-slate-900 shadow-2xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ShoppingCart className="w-3 h-3 mr-1" />
                  Compra
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewTab('combustible')}
                  className={`px-2.5 py-1 rounded-md text-2xs font-semibold flex items-center transition-all cursor-pointer ${
                    previewTab === 'combustible' 
                      ? 'bg-white text-slate-900 shadow-2xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Fuel className="w-3 h-3 mr-1" />
                  Combustible
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewTab('notificacion')}
                  className={`px-2.5 py-1 rounded-md text-2xs font-semibold flex items-center transition-all cursor-pointer ${
                    previewTab === 'notificacion' 
                      ? 'bg-white text-slate-900 shadow-2xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Mail className="w-3 h-3 mr-1" />
                  Cuenta
                </button>
              </div>

              <div className="text-3xs text-slate-400 font-medium">
                Renderizado interactivo con datos oficiales
              </div>
            </div>

            {/* Documento Renderizado dentro de Marco Apple */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
              <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg border border-slate-200/80 overflow-hidden transition-all">
                {/* Ventana macOS mock header */}
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  </div>
                  <span className="text-3xs font-mono text-slate-400">
                    {previewTab === 'compra' ? 'Solicitud_Compra.html' : (previewTab === 'combustible' ? 'Solicitud_Combustible.html' : 'Aprobacion_Cuenta.html')}
                  </span>
                  <div className="w-8" />
                </div>

                <div 
                  className="p-1"
                  dangerouslySetInnerHTML={{ __html: previewHtml() }} 
                />
              </div>
            </div>

          </div>

        </div>

        {/* Pie del Modal con Acciones Apple Style */}
        <div className="px-6 py-3.5 border-t border-slate-200/80 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center text-3xs font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
              <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
              Migración 19 en BD
            </span>
            <button
              type="button"
              onClick={handleCopySql}
              className="inline-flex items-center px-2.5 py-1 border border-slate-200 rounded-lg text-3xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              title="Copiar script SQL para PostgreSQL externo"
            >
              {copiedSql ? (
                <>
                  <Check className="w-3 h-3 mr-1 text-emerald-600" />
                  SQL Copiado
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 mr-1 text-slate-400" />
                  Copiar SQL
                </>
              )}
            </button>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving}
              className="px-5 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-semibold transition-all shadow-xs disabled:opacity-50 flex items-center cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {saving ? 'Guardando...' : 'Guardar y Aplicar Diseño'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
