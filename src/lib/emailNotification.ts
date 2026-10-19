/**
 * Helper de plantillas, estilos y notificaciones por correo para Cruz Verde Salvadoreña
 * Soporta personalización de colores de header, footer, fuentes, logos y remitente No-Reply.
 */
import { getOfficialLoginUrl } from '../utils/appUrl';

export interface EmailDesignConfig {
  headerColor?: string;
  headerTextColor?: string;
  footerColor?: string;
  footerTextColor?: string;
  fontTitle?: string;
  fontBody?: string;
  logoUrl?: string;
  mostrarLogo?: boolean;
  leyendaNoReply?: string;
  telefonoContacto?: string;
}

export interface EmailTemplateParams {
  remitenteNombre: string;
  remitenteCorreo: string;
  destinatarioCorreo: string;
  destinatarioNombre: string;
  asunto: string;
  numeroSolicitud?: string;
  seccionalNombre?: string;
  rolNombre?: string;
  rolAsignado?: string;
  temporalPassword?: string;
  mensajePersonalizado?: string;
  loginUrl?: string;
}

export interface DatosSolicitudCompra {
  numeroSolicitud: string;
  fecha: string;
  seccional: string;
  solicitante: string;
  director: string;
  vehiculoOEquipo?: string;
  urgencia: 'Baja' | 'Media' | 'Alta' | 'Urgente';
  justificacion: string;
  proveedorSugerido?: string;
  items: Array<{
    descripcion: string;
    cantidad: number;
    unidad?: string;
    precioEstimado?: number;
    subtotal?: number;
  }>;
  totalEstimado: number;
  nombreArchivoPdf?: string;
  pdfUrl?: string;
}

export interface DatosSolicitudCombustible {
  codigoSolicitud: string;
  fecha?: string;
  fechaEnvio?: string;
  seccional?: string;
  seccionalNombre?: string;
  solicitante?: string;
  telefonoSolicitante?: string;
  correoSolicitante?: string;
  actividad?: string;
  entregoLiquidacionAnterior?: boolean;
  motivoNoLiquidacion?: string;
  vehiculo?: string;
  vehiculoAsignado?: string;
  placa?: string;
  kilometrajeActual?: string;
  misionOJustificacion?: string;
  tipoCombustible?: string;
  galonesSolicitados?: number | string;
  combustibleSolicitado?: string;
  cuponOVales?: string;
  nombreArchivoPdf?: string;
  pdfUrl?: string;
}

// Configuración de diseño por defecto institucional
export const DEFAULT_EMAIL_DESIGN: Required<EmailDesignConfig> = {
  headerColor: '#15803d',
  headerTextColor: '#ffffff',
  footerColor: '#f9fafb',
  footerTextColor: '#6b7280',
  fontTitle: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  fontBody: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Cruz_Verde_Salvadore%C3%B1a.png/120px-Cruz_Verde_Salvadore%C3%B1a.png',
  mostrarLogo: true,
  leyendaNoReply: 'Este es un mensaje institucional automático generado por el Sistema Interno de Cruz Verde Salvadoreña. Por favor no responda a esta dirección de correo electrónico ya que es una casilla no monitoreada. Para consultas oficiales, comuníquese con la jefatura de su seccional o la administración nacional.',
  telefonoContacto: '2284-0000 / 7695-7911'
};

export function getStoredDesignConfig(): Partial<EmailDesignConfig> {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('cruz_verde_email_design');
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          headerColor: parsed.headerColor,
          headerTextColor: parsed.headerTextColor,
          footerColor: parsed.footerColor,
          footerTextColor: parsed.footerTextColor,
          fontTitle: parsed.fontTitle ? `'${parsed.fontTitle}', -apple-system, BlinkMacSystemFont, sans-serif` : undefined,
          fontBody: parsed.fontBody ? `'${parsed.fontBody}', -apple-system, BlinkMacSystemFont, sans-serif` : undefined,
          logoUrl: parsed.logoUrl,
          mostrarLogo: parsed.mostrarLogo !== undefined ? parsed.mostrarLogo : true,
          leyendaNoReply: parsed.leyendaNoReply,
          telefonoContacto: parsed.telefonoContacto
        };
      }
    } catch (e) {
      // Ignorar error de parsing
    }
  }
  return {};
}

/**
 * 1. Genera el correo de Aprobación de Cuenta de Usuario
 */
export function generarHtmlCorreoAprobacion(params: EmailTemplateParams, design?: EmailDesignConfig): string {
  const cfg = { ...DEFAULT_EMAIL_DESIGN, ...getStoredDesignConfig(), ...design };
  const loginUrl = params.loginUrl || getOfficialLoginUrl();
  const displayRol = params.rolAsignado || params.rolNombre || 'Socorrista';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.asunto}</title>
  <style>
    body { font-family: ${cfg.fontBody}; background-color: #f3f4f6; margin: 0; padding: 24px 12px; color: #1f2937; -webkit-font-smoothing: antialiased; }
    .container { max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04); border: 1px solid #e5e7eb; }
    .header { background: ${cfg.headerColor}; color: ${cfg.headerTextColor}; padding: 34px 24px; text-align: center; }
    .header-logo { max-height: 56px; width: auto; margin-bottom: 12px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.15)); }
    .header-badge { display: inline-block; background-color: rgba(255,255,255,0.22); color: ${cfg.headerTextColor}; padding: 4px 14px; border-radius: 9999px; font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 12px; }
    .header h1 { font-family: ${cfg.fontTitle}; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { margin: 8px 0 0; font-size: 14px; opacity: 0.95; font-weight: 500; }
    .content { padding: 32px 28px; }
    .greeting { font-family: ${cfg.fontTitle}; font-size: 18px; font-weight: 800; color: #111827; margin-bottom: 12px; }
    .message { font-size: 14px; line-height: 1.65; color: #4b5563; margin-bottom: 24px; }
    .card-details { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
    .detail-row { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid #edf2f7; font-size: 13px; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #64748b; font-weight: 600; }
    .detail-value { color: #0f172a; font-weight: 700; text-align: right; }
    .status-badge { display: inline-block; background-color: #dcfce7; color: #166534; padding: 3px 10px; border-radius: 6px; font-weight: 800; font-size: 11px; }
    .cta-box { text-align: center; margin: 32px 0 20px; }
    .btn-action { display: inline-block; background-color: ${cfg.headerColor}; color: #ffffff !important; text-decoration: none; padding: 14px 34px; border-radius: 10px; font-size: 14px; font-weight: 700; box-shadow: 0 4px 14px rgba(0,0,0,0.18); font-family: ${cfg.fontTitle}; }
    .footer { background-color: ${cfg.footerColor}; color: ${cfg.footerTextColor}; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb; font-size: 12px; line-height: 1.6; }
    .footer-noreply { background: #fee2e2; border: 1px solid #fca5a5; color: #991b1b; padding: 10px 14px; border-radius: 8px; font-weight: 700; font-size: 11px; margin-bottom: 14px; display: inline-block; }
    .footer-logo { font-weight: 800; color: #1f2937; font-size: 13px; margin-bottom: 4px; font-family: ${cfg.fontTitle}; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${cfg.mostrarLogo && cfg.logoUrl ? `<img src="${cfg.logoUrl}" alt="Cruz Verde Salvadoreña" class="header-logo" />` : ''}
      <div><span class="header-badge">Sistema Institucional</span></div>
      <h1>Cruz Verde Salvadoreña</h1>
      <p>Notificación Oficial de Aprobación de Cuenta</p>
    </div>
    
    <div class="content">
      <div class="greeting">¡Hola, ${params.destinatarioNombre}! 👋</div>
      <div class="message">
        Nos complace informarte que tu solicitud de registro en el <strong>Sistema Interno de Cruz Verde Salvadoreña</strong> ha sido verificada y <strong>APROBADA</strong> por la administración.
      </div>

      <div class="card-details">
        <div style="font-weight: 800; font-size: 12px; text-transform: uppercase; color: ${cfg.headerColor}; margin-bottom: 14px; letter-spacing: 0.5px;">Resumen de cuenta autorizada</div>
        <div class="detail-row">
          <span class="detail-label">Usuario / Correo:</span>
          <span class="detail-value">${params.destinatarioCorreo}</span>
        </div>
        ${params.seccionalNombre ? `
        <div class="detail-row">
          <span class="detail-label">Seccional asignada:</span>
          <span class="detail-value">${params.seccionalNombre}</span>
        </div>` : ''}
        <div class="detail-row">
          <span class="detail-label">Rol asignado:</span>
          <span class="detail-value" style="text-transform: uppercase;">${displayRol}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Estado de la cuenta:</span>
          <span class="detail-value"><span class="status-badge">ACTIVO / HABILITADO</span></span>
        </div>
      </div>

      <p class="message">
        A partir de este momento tienes acceso al portal con las credenciales que ingresaste en tu registro. Puedes acceder haciendo clic en el siguiente enlace:
      </p>

      <div class="cta-box">
        <a href="${loginUrl}" class="btn-action" target="_blank">Ingresar al Sistema Ahora</a>
      </div>
    </div>

    <div class="footer">
      <div class="footer-noreply">
        🚫 CORREO DE SÓLO ENVÍO (NO-REPLY) — NO RESPONDER A ESTE MENSAJE
      </div>
      <div class="footer-logo">Cruz Verde Salvadoreña</div>
      <p style="margin: 6px 0; font-size: 11px;">${cfg.leyendaNoReply}</p>
      <p style="margin: 8px 0 0; font-size: 11px; opacity: 0.85;">
        Remitente: <strong>${params.remitenteNombre}</strong> &lt;${params.remitenteCorreo}&gt;<br>
        Consultas técnicas: ${cfg.telefonoContacto}
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * 2. Genera el correo de Contraseña Temporal
 */
export function generarHtmlCorreoPasswordTemporal(params: EmailTemplateParams, design?: EmailDesignConfig): string {
  const cfg = { ...DEFAULT_EMAIL_DESIGN, ...getStoredDesignConfig(), ...design };
  const loginUrl = params.loginUrl || getOfficialLoginUrl();

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.asunto}</title>
  <style>
    body { font-family: ${cfg.fontBody}; background-color: #f3f4f6; margin: 0; padding: 24px 12px; color: #1f2937; }
    .container { max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08); border: 1px solid #e5e7eb; }
    .header { background: ${cfg.headerColor}; color: ${cfg.headerTextColor}; padding: 34px 24px; text-align: center; }
    .header-logo { max-height: 54px; width: auto; margin-bottom: 12px; }
    .header-badge { display: inline-block; background-color: rgba(255,255,255,0.22); color: ${cfg.headerTextColor}; padding: 4px 14px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px; }
    .header h1 { font-family: ${cfg.fontTitle}; margin: 0; font-size: 24px; font-weight: 800; }
    .header p { margin: 8px 0 0; font-size: 14px; opacity: 0.95; }
    .content { padding: 32px 28px; }
    .greeting { font-family: ${cfg.fontTitle}; font-size: 18px; font-weight: 800; color: #111827; margin-bottom: 12px; }
    .message { font-size: 14px; line-height: 1.65; color: #4b5563; margin-bottom: 24px; }
    .temp-pass-box { background: #f0fdf4; border: 2px dashed ${cfg.headerColor}; border-radius: 12px; padding: 22px; text-align: center; margin: 24px 0; }
    .temp-pass-label { font-size: 11px; text-transform: uppercase; font-weight: 800; color: ${cfg.headerColor}; margin-bottom: 8px; letter-spacing: 0.5px; }
    .temp-pass-code { font-family: monospace; font-size: 26px; font-weight: 900; color: #111827; letter-spacing: 3px; }
    .warning-box { background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px; border-radius: 6px; font-size: 13px; color: #92400e; margin-bottom: 24px; line-height: 1.5; }
    .cta-box { text-align: center; margin: 28px 0 16px; }
    .btn-action { display: inline-block; background-color: ${cfg.headerColor}; color: #ffffff !important; text-decoration: none; padding: 14px 34px; border-radius: 10px; font-size: 14px; font-weight: 700; font-family: ${cfg.fontTitle}; }
    .footer { background-color: ${cfg.footerColor}; color: ${cfg.footerTextColor}; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb; font-size: 12px; line-height: 1.6; }
    .footer-noreply { background: #fee2e2; border: 1px solid #fca5a5; color: #991b1b; padding: 10px 14px; border-radius: 8px; font-weight: 700; font-size: 11px; margin-bottom: 14px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${cfg.mostrarLogo && cfg.logoUrl ? `<img src="${cfg.logoUrl}" alt="Cruz Verde Salvadoreña" class="header-logo" />` : ''}
      <div><span class="header-badge">Seguridad y Acceso</span></div>
      <h1>Cruz Verde Salvadoreña</h1>
      <p>Restablecimiento de Credenciales de Acceso</p>
    </div>
    
    <div class="content">
      <div class="greeting">Hola, ${params.destinatarioNombre}</div>
      <div class="message">
        Se ha emitido una <strong>clave temporal de acceso</strong> para ingresar a tu cuenta en el Sistema Institucional de Cruz Verde Salvadoreña.
      </div>

      <div class="temp-pass-box">
        <div class="temp-pass-label">Tu Clave Temporal Asignada:</div>
        <div class="temp-pass-code">${params.temporalPassword || 'CVS-9K42L'}</div>
      </div>

      <div class="warning-box">
        <strong>⚠️ Medida de Seguridad Institucional:</strong> Al iniciar sesión con esta clave temporal, el sistema te solicitará obligatoriamente ingresar una contraseña nueva personal.
      </div>

      <div class="cta-box">
        <a href="${loginUrl}" class="btn-action" target="_blank">Iniciar Sesión y Cambiar Clave</a>
      </div>
    </div>

    <div class="footer">
      <div class="footer-noreply">
        🚫 CORREO DE SÓLO ENVÍO (NO-REPLY) — NO RESPONDER A ESTE MENSAJE
      </div>
      <p style="margin: 6px 0; font-size: 11px;">${cfg.leyendaNoReply}</p>
      <p style="margin: 8px 0 0; font-size: 11px; opacity: 0.85;">
        Remitente: <strong>${params.remitenteNombre}</strong> &lt;${params.remitenteCorreo}&gt;
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * 3. Genera el correo para Solicitudes de Compra y Mantenimiento
 * Incluye el FORMULARIO COMPLETO LLENO y el PDF OFICIAL ADJUNTO generado.
 */
export function generarHtmlCorreoCompra(
  paramsOrUnified: any, 
  datosArg?: DatosSolicitudCompra, 
  design?: EmailDesignConfig
): string {
  const cfg = { ...DEFAULT_EMAIL_DESIGN, ...getStoredDesignConfig(), ...design };
  
  let p: any;
  let d: any;

  if (datosArg) {
    p = paramsOrUnified || {};
    d = datosArg;
  } else {
    d = paramsOrUnified || {};
    p = {
      remitenteNombre: 'Cruz Verde Salvadoreña (No Responder)',
      remitenteCorreo: 'notificaciones@cruzverdesv.org',
      asunto: d.asunto || `Solicitud de Compra: ${d.folio || d.numeroSolicitud || 'SC-CVS'} - ${d.seccional || ''}`
    };
  }

  const codigo = d.numeroSolicitud || d.folio || 'SC-CVS';
  const pdfName = d.nombreArchivoPdf || `Solicitud_Compra_${codigo}.pdf`;
  const items = Array.isArray(d.items) && d.items.length > 0 
    ? d.items 
    : [{ descripcion: d.justificacion || d.descripcion || 'Bienes o servicios solicitados', cantidad: 1, unidad: 'Serv/Lote', precioEstimado: d.totalEstimado || 0, subtotal: d.totalEstimado || 0 }];

  const itemsRows = items.map((it: any, idx: number) => `
    <tr style="border-bottom: 1px solid #f1f5f9; ${idx % 2 === 1 ? 'background-color: #fafbfc;' : ''}">
      <td style="padding: 10px 12px; font-size: 13px; color: #1e293b; font-weight: 500;">${it.descripcion}</td>
      <td style="padding: 10px 12px; font-size: 13px; color: #475569; text-align: center;">${it.cantidad || 1} ${it.unidad || 'und'}</td>
      <td style="padding: 10px 12px; font-size: 13px; color: #475569; text-align: right;">$${Number(it.precioEstimado || 0).toFixed(2)}</td>
      <td style="padding: 10px 12px; font-size: 13px; color: #0f172a; font-weight: 700; text-align: right;">$${Number(it.subtotal || ((it.cantidad || 1) * (it.precioEstimado || 0))).toFixed(2)}</td>
    </tr>
  `).join('');

  const params = p;
  const datos = {
    ...d,
    numeroSolicitud: codigo,
    seccionalNombre: d.seccionalNombre || d.seccional || 'Cruz Verde',
    solicitante: d.solicitante || d.solicitado_por || 'Director',
    cargo: d.cargo || d.cargoSolicitante || 'Director',
    tipo: d.tipo || d.tipoSolicitud || 'General',
    totalEstimado: d.totalEstimado !== undefined ? d.totalEstimado : (d.montoEstimado || 0)
  };

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.asunto}</title>
  <style>
    body { font-family: ${cfg.fontBody}; background-color: #f3f4f6; margin: 0; padding: 24px 12px; color: #1f2937; }
    .container { max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08); border: 1px solid #e5e7eb; }
    .header { background: ${cfg.headerColor}; color: ${cfg.headerTextColor}; padding: 34px 24px; text-align: center; }
    .header-logo { max-height: 54px; width: auto; margin-bottom: 12px; }
    .header-badge { display: inline-block; background-color: rgba(255,255,255,0.22); color: ${cfg.headerTextColor}; padding: 4px 14px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px; }
    .header h1 { font-family: ${cfg.fontTitle}; margin: 0; font-size: 24px; font-weight: 800; }
    .header p { margin: 8px 0 0; font-size: 14px; opacity: 0.95; }
    .content { padding: 32px 28px; }
    .badge-urgencia { display: inline-block; padding: 4px 12px; border-radius: 6px; font-weight: 800; font-size: 12px; }
    .urgencia-Alta, .urgencia-Urgente { background-color: #fee2e2; color: #991b1b; }
    .urgencia-Media { background-color: #fef3c7; color: #92400e; }
    .urgencia-Baja { background-color: #e0f2fe; color: #075985; }
    .section-title { font-family: ${cfg.fontTitle}; font-size: 13px; font-weight: 800; text-transform: uppercase; color: ${cfg.headerColor}; margin: 20px 0 10px; letter-spacing: 0.5px; }
    .grid-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
    .grid-table td { padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
    .grid-label { color: #64748b; font-weight: 600; width: 40%; }
    .grid-value { color: #0f172a; font-weight: 700; width: 60%; }
    
    /* Tarjeta de PDF Adjunto */
    .pdf-card { background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 24px 0; display: flex; align-items: center; justify-content: space-between; }
    .pdf-icon-box { width: 48px; height: 48px; background-color: #fee2e2; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #dc2626; font-size: 14px; margin-right: 14px; }
    .pdf-info { flex: 1; }
    .pdf-title { font-weight: 800; font-size: 14px; color: #0f172a; margin-bottom: 2px; }
    .pdf-sub { font-size: 12px; color: #64748b; }
    
    .footer { background-color: ${cfg.footerColor}; color: ${cfg.footerTextColor}; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb; font-size: 12px; line-height: 1.6; }
    .footer-noreply { background: #fee2e2; border: 1px solid #fca5a5; color: #991b1b; padding: 10px 14px; border-radius: 8px; font-weight: 700; font-size: 11px; margin-bottom: 14px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${cfg.mostrarLogo && cfg.logoUrl ? `<img src="${cfg.logoUrl}" alt="Cruz Verde Salvadoreña" class="header-logo" />` : ''}
      <div><span class="header-badge">Departamento Administrativo</span></div>
      <h1>Cruz Verde Salvadoreña</h1>
      <p>Notificación Oficial de Solicitud de Compra y Mantenimiento</p>
    </div>

    <div class="content">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 14px; margin-bottom: 20px;">
        <div>
          <span style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">N° Solicitud:</span>
          <div style="font-size: 18px; font-weight: 900; color: #0f172a;">${datos.numeroSolicitud}</div>
        </div>
        <div>
          <span class="badge-urgencia urgencia-${datos.urgencia}">Prioridad: ${datos.urgencia}</span>
        </div>
      </div>

      <div class="section-title">1. Datos Generales de la Solicitud</div>
      <table class="grid-table">
        <tr>
          <td class="grid-label">Seccional Solicitante:</td>
          <td class="grid-value">${datos.seccional}</td>
        </tr>
        <tr>
          <td class="grid-label">Director / Solicitante:</td>
          <td class="grid-value">${datos.director || datos.solicitante}</td>
        </tr>
        <tr>
          <td class="grid-label">Fecha de Envío:</td>
          <td class="grid-value">${datos.fecha}</td>
        </tr>
        ${datos.vehiculoOEquipo ? `
        <tr>
          <td class="grid-label">Vehículo / Unidad / Equipo:</td>
          <td class="grid-value">${datos.vehiculoOEquipo}</td>
        </tr>` : ''}
        ${datos.proveedorSugerido ? `
        <tr>
          <td class="grid-label">Proveedor Sugerido:</td>
          <td class="grid-value">${datos.proveedorSugerido}</td>
        </tr>` : ''}
      </table>

      <div class="section-title">2. Justificación y Motivo de la Compra</div>
      <div style="background-color: #f8fafc; border-left: 4px solid ${cfg.headerColor}; padding: 14px; border-radius: 6px; font-size: 13px; color: #334155; line-height: 1.5; margin-bottom: 20px;">
        ${datos.justificacion}
      </div>

      <div class="section-title">3. Detalle de Ítems / Repuestos Requeridos</div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background-color: #f1f5f9; color: #475569; font-size: 11px; text-transform: uppercase; font-weight: 700;">
            <th style="padding: 10px 12px; text-align: left;">Descripción</th>
            <th style="padding: 10px 12px; text-align: center;">Cantidad</th>
            <th style="padding: 10px 12px; text-align: right;">Costo Est.</th>
            <th style="padding: 10px 12px; text-align: right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
        <tfoot>
          <tr style="background-color: #f8fafc; border-top: 2px solid #e2e8f0;">
            <td colspan="3" style="padding: 12px; font-weight: 800; font-size: 14px; text-align: right; color: #0f172a;">TOTAL ESTIMADO:</td>
            <td style="padding: 12px; font-weight: 900; font-size: 16px; text-align: right; color: ${cfg.headerColor};">$${Number(datos.totalEstimado || 0).toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Documento PDF Adjunto Oficial -->
      <div class="section-title">4. Documento Oficial PDF Generado</div>
      <div class="pdf-card">
        <div style="display: flex; align-items: center;">
          <div class="pdf-icon-box">PDF</div>
          <div class="pdf-info">
            <div class="pdf-title">${pdfName}</div>
            <div class="pdf-sub">Documento con firmas, sellos institucionales y código oficial</div>
          </div>
        </div>
        <div style="background-color: #e2e8f0; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; color: #475569;">
          Adjunto Oficial
        </div>
      </div>

    </div>

    <div class="footer">
      <div class="footer-noreply">
        🚫 CORREO DE SÓLO ENVÍO (NO-REPLY) — NO RESPONDER A ESTE MENSAJE
      </div>
      <p style="margin: 6px 0; font-size: 11px;">${cfg.leyendaNoReply}</p>
      <p style="margin: 8px 0 0; font-size: 11px; opacity: 0.85;">
        Remitente: <strong>${params.remitenteNombre}</strong> &lt;${params.remitenteCorreo}&gt;<br>
        Mesa de ayuda: ${cfg.telefonoContacto}
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * 4. Genera el correo para Solicitudes de Combustible
 * Incluye el FORMULARIO COMPLETO LLENO y el PDF OFICIAL ADJUNTO generado.
 */
export function generarHtmlCorreoCombustible(
  paramsOrUnified: any, 
  datosArg?: DatosSolicitudCombustible, 
  design?: EmailDesignConfig
): string {
  const cfg = { ...DEFAULT_EMAIL_DESIGN, ...getStoredDesignConfig(), ...design };
  
  let p: any;
  let d: any;

  if (datosArg) {
    p = paramsOrUnified || {};
    d = datosArg;
  } else {
    // Modo unificado (un solo objeto con todos los datos)
    d = paramsOrUnified || {};
    p = {
      remitenteNombre: 'Cruz Verde Salvadoreña (No Responder)',
      remitenteCorreo: 'notificaciones@cruzverdesv.org',
      asunto: d.asunto || `Solicitud de Combustible: ${d.folio || d.codigoSolicitud || 'CVS'} - ${d.seccional || ''}`
    };
  }

  const codigo = d.codigoSolicitud || d.folio || 'COMB-CVS';
  const pdfName = d.nombreArchivoPdf || `Solicitud_Combustible_${codigo}.pdf`;
  const asuntoStr = p.asunto || `Solicitud de Combustible: ${codigo}`;
  const datos = d;
  const params = p;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${asuntoStr}</title>
  <style>
    body { font-family: ${cfg.fontBody}; background-color: #f3f4f6; margin: 0; padding: 24px 12px; color: #1f2937; }
    .container { max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08); border: 1px solid #e5e7eb; }
    .header { background: ${cfg.headerColor}; color: ${cfg.headerTextColor}; padding: 34px 24px; text-align: center; }
    .header-logo { max-height: 54px; width: auto; margin-bottom: 12px; }
    .header-badge { display: inline-block; background-color: rgba(255,255,255,0.22); color: ${cfg.headerTextColor}; padding: 4px 14px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px; }
    .header h1 { font-family: ${cfg.fontTitle}; margin: 0; font-size: 24px; font-weight: 800; }
    .header p { margin: 8px 0 0; font-size: 14px; opacity: 0.95; }
    .content { padding: 32px 28px; }
    .section-title { font-family: ${cfg.fontTitle}; font-size: 13px; font-weight: 800; text-transform: uppercase; color: ${cfg.headerColor}; margin: 20px 0 10px; letter-spacing: 0.5px; }
    .grid-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
    .grid-table td { padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
    .grid-label { color: #64748b; font-weight: 600; width: 40%; }
    .grid-value { color: #0f172a; font-weight: 700; width: 60%; }

    .highlight-card { background-color: #f0fdf4; border: 2px solid #bbf7d0; border-radius: 12px; padding: 18px; margin: 20px 0; display: flex; justify-content: space-between; align-items: center; }
    
    /* Tarjeta de PDF Adjunto */
    .pdf-card { background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 24px 0; display: flex; align-items: center; justify-content: space-between; }
    .pdf-icon-box { width: 48px; height: 48px; background-color: #fee2e2; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #dc2626; font-size: 14px; margin-right: 14px; }
    .pdf-info { flex: 1; }
    .pdf-title { font-weight: 800; font-size: 14px; color: #0f172a; margin-bottom: 2px; }
    .pdf-sub { font-size: 12px; color: #64748b; }

    .footer { background-color: ${cfg.footerColor}; color: ${cfg.footerTextColor}; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb; font-size: 12px; line-height: 1.6; }
    .footer-noreply { background: #fee2e2; border: 1px solid #fca5a5; color: #991b1b; padding: 10px 14px; border-radius: 8px; font-weight: 700; font-size: 11px; margin-bottom: 14px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${cfg.mostrarLogo && cfg.logoUrl ? `<img src="${cfg.logoUrl}" alt="Cruz Verde Salvadoreña" class="header-logo" />` : ''}
      <div><span class="header-badge">Control de Flota y Combustible</span></div>
      <h1>Cruz Verde Salvadoreña</h1>
      <p>Notificación Oficial de Solicitud de Combustible</p>
    </div>

    <div class="content">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 14px; margin-bottom: 20px;">
        <div>
          <span style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">Código de Vale / Solicitud:</span>
          <div style="font-size: 18px; font-weight: 900; color: #0f172a;">${datos.codigoSolicitud}</div>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">Fecha:</span>
          <div style="font-size: 14px; font-weight: 700; color: #334155;">${datos.fecha || datos.fechaEnvio || 'Fecha Oficial'}</div>
        </div>
      </div>

      <div class="highlight-card">
        <div>
          <span style="font-size: 11px; color: #166534; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Combustible Solicitado:</span>
          <div style="font-size: 22px; font-weight: 900; color: #14532d;">${datos.combustibleSolicitado || `${datos.galonesSolicitados || 'N/A'} Galones (${datos.tipoCombustible || 'Regular / Diesel'})`}</div>
        </div>
        ${datos.cuponOVales ? `
        <div style="background-color: #dcfce7; color: #166534; padding: 6px 12px; border-radius: 8px; font-weight: 800; font-size: 12px;">
          Vale: ${datos.cuponOVales}
        </div>` : ''}
      </div>

      <div class="section-title">1. Datos del Vehículo y Operador</div>
      <table class="grid-table">
        <tr>
          <td class="grid-label">Seccional:</td>
          <td class="grid-value">${datos.seccional || datos.seccionalNombre || 'Cruz Verde'}</td>
        </tr>
        <tr>
          <td class="grid-label">Solicitante / Motorista:</td>
          <td class="grid-value">${datos.solicitante || 'Socorrista'} ${datos.telefonoSolicitante ? `(${datos.telefonoSolicitante})` : ''}</td>
        </tr>
        ${datos.vehiculo || datos.vehiculoAsignado ? `
        <tr>
          <td class="grid-label">Vehículo / Unidad:</td>
          <td class="grid-value">${datos.vehiculo || datos.vehiculoAsignado}</td>
        </tr>` : ''}
        ${datos.placa ? `
        <tr>
          <td class="grid-label">Número de Placa:</td>
          <td class="grid-value">${datos.placa}</td>
        </tr>` : ''}
        ${datos.kilometrajeActual ? `
        <tr>
          <td class="grid-label">Odómetro / Kilometraje Actual:</td>
          <td class="grid-value">${datos.kilometrajeActual} km</td>
        </tr>` : ''}
        ${datos.actividad ? `
        <tr>
          <td class="grid-label">Actividad / Emergencia:</td>
          <td class="grid-value">${datos.actividad}</td>
        </tr>` : ''}
      </table>

      ${datos.misionOJustificacion ? `
      <div class="section-title">2. Misión o Recorrido Programado</div>
      <div style="background-color: #f8fafc; border-left: 4px solid ${cfg.headerColor}; padding: 14px; border-radius: 6px; font-size: 13px; color: #334155; line-height: 1.5; margin-bottom: 20px;">
        ${datos.misionOJustificacion}
      </div>` : ''}

      <!-- Documento PDF Adjunto Oficial -->
      <div class="section-title">3. Vale / Documento PDF Oficial Generado</div>
      <div class="pdf-card">
        <div style="display: flex; align-items: center;">
          <div class="pdf-icon-box">PDF</div>
          <div class="pdf-info">
            <div class="pdf-title">${pdfName}</div>
            <div class="pdf-sub">Vale oficial de combustible para gasolinera con firmas y sello</div>
          </div>
        </div>
        <div style="background-color: #e2e8f0; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; color: #475569;">
          Adjunto Oficial
        </div>
      </div>

    </div>

    <div class="footer">
      <div class="footer-noreply">
        🚫 CORREO DE SÓLO ENVÍO (NO-REPLY) — NO RESPONDER A ESTE MENSAJE
      </div>
      <p style="margin: 6px 0; font-size: 11px;">${cfg.leyendaNoReply}</p>
      <p style="margin: 8px 0 0; font-size: 11px; opacity: 0.85;">
        Remitente: <strong>${params.remitenteNombre}</strong> &lt;${params.remitenteCorreo}&gt;<br>
        Control de Combustible: ${cfg.telefonoContacto}
      </p>
    </div>
  </div>
</body>
</html>`;
}
