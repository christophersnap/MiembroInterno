import { formatFechaHoraSV, formatFechaSV, formatHoraSV, getElSalvadorDateTime } from '../utils/dateUtils';
import { PdfWatermarkPosition, normalizePdfWatermarkPosition } from '../components/common/PdfWatermarkOverlay';

export const ACTIVIDADES_COMBUSTIBLE_OPTIONS = [
  'Emergencias Cotidianas',
  'Planes Operativos',
  'Alertas Nacionales',
  'Capacitaciones',
  'Otros',
] as const;

export type ActividadCombustibleOption = (typeof ACTIVIDADES_COMBUSTIBLE_OPTIONS)[number];

export interface SolicitudCombustible {
  id: number;
  folio: string;
  seccional_id?: number;
  seccional_nombre: string;
  director_nombre: string;
  correo_electronico: string;
  actividad: string;
  entrego_liquidacion_anterior: boolean;
  motivo_no_liquidacion?: string;
  nombre_solicitante: string;
  telefono_solicitante: string;
  observaciones?: string;
  fecha_solicitud: string;
  hora_solicitud?: string;
  fecha_envio_completa?: string;
  estado: 'Pendiente' | 'Aprobada' | 'Rechazada' | 'En Proceso' | 'Entregada' | string;
  autorizado_por?: string | null;
  fecha_autorizacion?: string | null;
  motivo_rechazo?: string | null;
  correo_enviado?: boolean;
  correos_notificados?: string;
  created_at?: string;
  updated_at?: string;
  cargo_solicitante?: string;
  vehiculo_placa?: string;
  vehiculo_marca?: string;
  vehiculo_modelo?: string;
  tipo_combustible?: string;
  galones_solicitados?: string | number;
  cantidad_dinero?: string | number;
}

export interface CombustibleBlockItem {
  id: string;
  label?: string;
  name?: string;
  description?: string;
  visible?: boolean;
  enabled?: boolean;
  align?: 'left' | 'center' | 'right';
}

export interface CombustibleConfig {
  correoDestino: string;
  correoCcDefault: string;
  correoContactoTelefono: string;
  asuntoPlantilla: string;
  enviarCopiaSolicitante: boolean;
  correoTitulo: string;
  correoSubtitulo: string;
  correoFooterTexto: string;

  pdfTitulo: string;
  pdfSubtitulo: string;
  pdfSubtituloSecundario: string;
  pdfFontFamily: 'sans' | 'serif' | 'mono';
  pdfFontSize: 'small' | 'normal' | 'large';
  pdfCodigoFormulario: string;
  pdfWatermark: boolean;
  pdfWatermarkImgUrl: string;
  pdfWatermarkText: string;
  pdfWatermarkOpacity: string;
  pdfWatermarkScale: string;
  pdfWatermarkPosition: PdfWatermarkPosition;

  pdfMostrarLogoHeader: boolean;
  pdfLogoHeaderUrl: string;
  pdfLogoPosicion: 'left' | 'center' | 'right' | 'none';
  pdfLogoSize: 'small' | 'medium' | 'large';

  pdfMostrarLogoSecundario: boolean;
  pdfLogoSecundarioUrl: string;
  pdfLogoSecundarioPosicion: 'left' | 'center' | 'right' | 'none';
  pdfLogoSecundarioSize: 'small' | 'medium' | 'large';

  pdfMostrarSelloImg: boolean;
  pdfSelloImgUrl: string;
  pdfSelloImgPosicion: 'left' | 'center' | 'right' | 'none';
  pdfSelloImgSize: 'small' | 'medium' | 'large';

  pdfMostrarLogoFooter: boolean;
  pdfLogoFooterUrl: string;
  pdfLogoFooterPosicion?: 'left' | 'center' | 'right' | 'none';
  pdfLogoFooterSize?: 'small' | 'medium' | 'large';
  pdfFooterImgPosicion?: 'left' | 'center' | 'right' | 'none';
  pdfFooterImgSize?: 'small' | 'medium' | 'large';

  pdfLabelSolicitante: string;
  pdfLabelSeccional: string;
  pdfLabelDirector: string;
  pdfLabelActividad: string;
  pdfLabelCorreo: string;
  pdfLabelContacto: string;
  pdfLabelLiquidacion: string;
  pdfLabelMotivo: string;
  pdfLabelObservaciones: string;

  pdfLabelFirmaSolicitante: string;
  pdfLabelFirmaAdmin: string;
  pdfNombreJefaturaOperaciones: string;
  pdfTextoSelloInstitucional: string;
  pdfLabelDui: string;
  pdfLabelFecha: string;
  pdfLabelFirmaSello: string;
  pdfLabelAutoriza: string;
  pdfLabelFechaAuto: string;

  // Campos opcionales: si se solicitan en el formulario y si se muestran en PDF/Correo
  solicitarVehiculo: boolean;
  mostrarVehiculo: boolean;
  solicitarPlaca: boolean;
  mostrarPlaca: boolean;
  solicitarGalones: boolean;
  mostrarGalones: boolean;
  solicitarTipoGasolina: boolean;
  mostrarTipoGasolina: boolean;
  solicitarCantidadDinero: boolean;
  mostrarCantidadDinero: boolean;

  // Logo global de respaldo (desde diseño de correo / configuración)
  emailLogoFallbackUrl?: string;

  pdfBloquesOrden?: CombustibleBlockItem[];
}

export const DEFAULT_COMBUSTIBLE_BLOCKS: CombustibleBlockItem[] = [
  { id: 'encabezado', name: 'Encabezado Institucional', description: 'Logos, Título y Código de Formulario', enabled: true, align: 'center' },
  { id: 'subtitulo_folio', name: 'Subtítulo y Folio', description: 'Nombre del documento y número de folio', enabled: true, align: 'left' },
  { id: 'datos_solicitante', name: 'Datos de la Solicitud y Seccional', description: 'Seccional, solicitante, director, fecha y hora', enabled: true, align: 'left' },
  { id: 'actividad_motivo', name: 'Actividad y Motivo de Combustible', description: 'Misión asignada, emergencias y observaciones', enabled: true, align: 'left' },
  { id: 'liquidacion_anterior', name: 'Estado de Liquidación Anterior', description: 'Verificación de comprobantes de combustible previo', enabled: true, align: 'left' },
  { id: 'firmas_sello', name: 'Firmas y Sello Oficial', description: 'Firma de solicitante, Jefatura de Operaciones y sello', enabled: true, align: 'center' },
  { id: 'pie_pagina', name: 'Cintillo y Pie de Página', description: 'Leyenda oficial y membrete inferior', enabled: true, align: 'center' }
];

export const DEFAULT_COMBUSTIBLE_CONFIG: CombustibleConfig = {
  correoDestino: 'control_combustible@cruzverdesv.org',
  correoCcDefault: 'presidencia@cruzverdesv.org, administracion@cruzverdesv.org',
  correoContactoTelefono: '2284-5792 / 7695-7911',
  asuntoPlantilla: 'Solicitud de Combustible: [FOLIO] - [SECCIONAL]',
  enviarCopiaSolicitante: true,
  correoTitulo: '¡Confirmamos de recibido tu solicitud de Combustible!',
  correoSubtitulo: 'Comunícate con Oficina Central para ver el estado de tu solicitud',
  correoFooterTexto: 'Cualquier duda o consulta puedes enviar un correo a control_combustible@cruzverdesv.org o llamar al 2284-5792 / 7695-7911',

  pdfTitulo: 'CRUZ VERDE SALVADOREÑA',
  pdfSubtitulo: 'SOLICITUD DE COMBUSTIBLE',
  pdfSubtituloSecundario: 'Documento Oficial Administrativo',
  pdfFontFamily: 'sans',
  pdfFontSize: 'normal',
  pdfCodigoFormulario: 'CVSCOMBUS/FORM001',
  pdfWatermark: true,
  pdfWatermarkImgUrl: '',
  pdfWatermarkText: 'CRUZ VERDE SALVADOREÑA - COMBUSTIBLE',
  pdfWatermarkOpacity: '0.08',
  pdfWatermarkScale: '45',
  pdfWatermarkPosition: 'center',
  pdfMostrarLogoHeader: true,
  pdfLogoHeaderUrl: '',
  pdfLogoPosicion: 'left',
  pdfLogoSize: 'medium',

  pdfMostrarLogoSecundario: false,
  pdfLogoSecundarioUrl: '',
  pdfLogoSecundarioPosicion: 'right',
  pdfLogoSecundarioSize: 'medium',

  pdfMostrarSelloImg: false,
  pdfSelloImgUrl: '',
  pdfSelloImgPosicion: 'center',
  pdfSelloImgSize: 'medium',

  pdfMostrarLogoFooter: true,
  pdfLogoFooterUrl: '',
  pdfLogoFooterPosicion: 'left',
  pdfLogoFooterSize: 'medium',

  pdfLabelSolicitante: 'Nombre del Solicitante',
  pdfLabelSeccional: 'Seccional Asignada',
  pdfLabelDirector: 'Director(a) Seccional',
  pdfLabelActividad: 'Tipo de Actividad',
  pdfLabelCorreo: 'Correo de la Seccional',
  pdfLabelContacto: 'Teléfono de Contacto',
  pdfLabelLiquidacion: '¿Entregó liquidación de combustible del mes anterior?',
  pdfLabelMotivo: 'Motivo de no liquidación',
  pdfLabelObservaciones: 'Observaciones Adicionales',

  pdfLabelFirmaSolicitante: 'Firma del Solicitante',
  pdfLabelFirmaAdmin: 'Jefatura de Operaciones',
  pdfNombreJefaturaOperaciones: '',
  pdfTextoSelloInstitucional: 'Sello Institucional Oficial',
  pdfLabelDui: 'Nombre:',
  pdfLabelFecha: 'Fecha:',
  pdfLabelFirmaSello: 'Firma y Sello Oficial',
  pdfLabelAutoriza: 'Autorizado por:',
  pdfLabelFechaAuto: 'Fecha Autorización:',

  solicitarVehiculo: false,
  mostrarVehiculo: false,
  solicitarPlaca: false,
  mostrarPlaca: false,
  solicitarGalones: false,
  mostrarGalones: false,
  solicitarTipoGasolina: false,
  mostrarTipoGasolina: false,
  solicitarCantidadDinero: false,
  mostrarCantidadDinero: false,

  emailLogoFallbackUrl: '',

  pdfBloquesOrden: DEFAULT_COMBUSTIBLE_BLOCKS
};

const WIKIMEDIA_DEFAULT_LOGO = 'upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Cruz_Verde_Salvadore';

function isValidCustomLogo(url?: string | null): url is string {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return false;
  return true;
}

/**
 * Resuelve la mejor URL de logo institucional configurada entre la plantilla de combustible,
 * la plantilla de correo y la configuración almacenada localmente.
 */
export function resolveCombustibleLogoUrl(config?: Partial<CombustibleConfig> | null): string {
  if (isValidCustomLogo(config?.pdfLogoHeaderUrl)) {
    return config!.pdfLogoHeaderUrl!.trim();
  }
  if (isValidCustomLogo(config?.emailLogoFallbackUrl)) {
    return config!.emailLogoFallbackUrl!.trim();
  }
  if (typeof window !== 'undefined') {
    try {
      const rawComb = localStorage.getItem('cruz_verde_combustible_config');
      if (rawComb) {
        const parsed = JSON.parse(rawComb);
        if (isValidCustomLogo(parsed.pdfLogoHeaderUrl)) {
          return parsed.pdfLogoHeaderUrl.trim();
        }
      }
    } catch {}
    try {
      const rawEmail = localStorage.getItem('cruz_verde_email_design');
      if (rawEmail) {
        const parsed = JSON.parse(rawEmail);
        if (isValidCustomLogo(parsed.logoUrl) && !parsed.logoUrl.includes(WIKIMEDIA_DEFAULT_LOGO)) {
          return parsed.logoUrl.trim();
        }
      }
    } catch {}
  }
  return '';
}

/**
 * Formatea fecha y hora de una solicitud de combustible siempre en hora oficial de El Salvador.
 */
export function formatSolicitudCombustibleFechaHoraSV(solicitud: Partial<SolicitudCombustible>): {
  fecha: string;
  hora: string;
  completa: string;
} {
  if (solicitud.created_at) {
    const fecha = formatFechaSV(solicitud.created_at);
    const hora = formatHoraSV(solicitud.created_at, { hour: '2-digit', minute: '2-digit', hour12: true });
    if (fecha !== '-' && hora !== '-') {
      return {
        fecha,
        hora,
        completa: `${fecha} · ${hora}`,
      };
    }
  }

  if (solicitud.fecha_solicitud && solicitud.hora_solicitud) {
    const rawHora = String(solicitud.hora_solicitud).trim();
    // Si ya tiene AM/PM o a. m./p. m.
    if (/[ap]\.?\s*m\.?/i.test(rawHora)) {
      const fechaFmt = formatFechaSV(solicitud.fecha_solicitud);
      return {
        fecha: fechaFmt,
        hora: rawHora,
        completa: `${fechaFmt} · ${rawHora}`,
      };
    }
    const isoCandidate = `${solicitud.fecha_solicitud}T${rawHora.length === 5 ? `${rawHora}:00` : rawHora}`;
    const fecha = formatFechaSV(isoCandidate);
    const hora = formatHoraSV(isoCandidate, { hour: '2-digit', minute: '2-digit', hour12: true });
    if (fecha !== '-' && hora !== '-') {
      return {
        fecha,
        hora,
        completa: `${fecha} · ${hora}`,
      };
    }
  }

  if (solicitud.fecha_envio_completa) {
    const parts = solicitud.fecha_envio_completa.trim().split(/\s+/);
    const fecha = parts[0] || formatFechaSV(solicitud.fecha_solicitud);
    const hora = parts.slice(1).join(' ') || '-';
    return {
      fecha,
      hora,
      completa: solicitud.fecha_envio_completa,
    };
  }

  const svNow = getElSalvadorDateTime();
  const fecha = solicitud.fecha_solicitud ? formatFechaSV(solicitud.fecha_solicitud) : svNow.fechaSV;
  const hora = solicitud.hora_solicitud || formatFechaHoraSV(svNow.isoTimestamp, { hour: '2-digit', minute: '2-digit', hour12: true });
  return {
    fecha,
    hora,
    completa: `${fecha} · ${hora}`,
  };
}

/**
 * Construye una CombustibleConfig completa combinando un mapa de claves de BD y localStorage.
 */
export function parseCombustibleConfigFromMap(
  confMap: Record<string, string>,
  storedLocalConfig: Partial<CombustibleConfig> = {},
  base: CombustibleConfig = DEFAULT_COMBUSTIBLE_CONFIG
): CombustibleConfig {
  const boolVal = (key: string, localVal: boolean | undefined, fallback: boolean): boolean => {
    if (confMap[key] !== undefined && confMap[key] !== '') {
      return confMap[key] === 'true';
    }
    if (typeof localVal === 'boolean') return localVal;
    return fallback;
  };

  const strVal = (key: string, localVal: string | undefined, fallback: string): string => {
    if (confMap[key] !== undefined && confMap[key] !== '') {
      return confMap[key];
    }
    if (localVal !== undefined && localVal !== '') return localVal;
    return fallback;
  };

  const strAllowEmpty = (key: string, localVal: string | undefined, fallback: string): string => {
    if (confMap[key] !== undefined) return confMap[key];
    if (localVal !== undefined) return localVal;
    return fallback;
  };

  const rawLogoHeader =
    confMap.combustible_pdf_logo_header_url ||
    confMap.combustible_pdf_logo_url ||
    storedLocalConfig.pdfLogoHeaderUrl ||
    base.pdfLogoHeaderUrl;

  const emailLogoFallback =
    confMap.email_template_logo ||
    storedLocalConfig.emailLogoFallbackUrl ||
    base.emailLogoFallbackUrl ||
    '';

  return {
    ...base,
    ...storedLocalConfig,
    correoDestino: strVal('combustible_correo_destino', storedLocalConfig.correoDestino, base.correoDestino),
    correoCcDefault: strAllowEmpty('combustible_correo_cc', storedLocalConfig.correoCcDefault, base.correoCcDefault),
    correoContactoTelefono: strVal('combustible_correo_contacto_telefono', storedLocalConfig.correoContactoTelefono, base.correoContactoTelefono),
    asuntoPlantilla: strVal('combustible_correo_asunto_plantilla', storedLocalConfig.asuntoPlantilla, base.asuntoPlantilla),
    enviarCopiaSolicitante: boolVal('combustible_correo_enviar_copia_solicitante', storedLocalConfig.enviarCopiaSolicitante, base.enviarCopiaSolicitante),
    correoTitulo: strVal('combustible_correo_titulo', storedLocalConfig.correoTitulo, base.correoTitulo),
    correoSubtitulo: strVal('combustible_correo_subtitulo', storedLocalConfig.correoSubtitulo, base.correoSubtitulo),
    correoFooterTexto: strVal('combustible_correo_footer_texto', storedLocalConfig.correoFooterTexto, base.correoFooterTexto),

    pdfTitulo: strVal('combustible_pdf_titulo', storedLocalConfig.pdfTitulo, base.pdfTitulo),
    pdfSubtitulo: strVal('combustible_pdf_subtitulo', storedLocalConfig.pdfSubtitulo, base.pdfSubtitulo),
    pdfSubtituloSecundario: strVal('combustible_pdf_subtitulo_secundario', storedLocalConfig.pdfSubtituloSecundario, base.pdfSubtituloSecundario),
    pdfFontFamily: (strVal('combustible_pdf_font_family', storedLocalConfig.pdfFontFamily, base.pdfFontFamily) as CombustibleConfig['pdfFontFamily']),
    pdfFontSize: (strVal('combustible_pdf_font_size', storedLocalConfig.pdfFontSize, base.pdfFontSize) as CombustibleConfig['pdfFontSize']),
    pdfCodigoFormulario: strVal('combustible_pdf_codigo_formulario', storedLocalConfig.pdfCodigoFormulario, base.pdfCodigoFormulario),
    pdfWatermark: boolVal('combustible_pdf_watermark', storedLocalConfig.pdfWatermark, base.pdfWatermark),
    pdfWatermarkImgUrl: strAllowEmpty('combustible_pdf_watermark_img_url', storedLocalConfig.pdfWatermarkImgUrl, base.pdfWatermarkImgUrl),
    pdfWatermarkText: strVal('combustible_pdf_watermark_text', storedLocalConfig.pdfWatermarkText, base.pdfWatermarkText),
    pdfWatermarkOpacity: strVal('combustible_pdf_watermark_opacity', storedLocalConfig.pdfWatermarkOpacity, base.pdfWatermarkOpacity),
    pdfWatermarkScale: strVal('combustible_pdf_watermark_scale', storedLocalConfig.pdfWatermarkScale, base.pdfWatermarkScale),
    pdfWatermarkPosition: normalizePdfWatermarkPosition(
      strVal('combustible_pdf_watermark_position', storedLocalConfig.pdfWatermarkPosition, base.pdfWatermarkPosition),
      base.pdfWatermarkPosition
    ),

    pdfMostrarLogoHeader: boolVal('combustible_pdf_mostrar_logo_header', storedLocalConfig.pdfMostrarLogoHeader, base.pdfMostrarLogoHeader),
    pdfLogoHeaderUrl: rawLogoHeader || '',
    pdfLogoPosicion: (strVal('combustible_pdf_logo_posicion', storedLocalConfig.pdfLogoPosicion, base.pdfLogoPosicion) as CombustibleConfig['pdfLogoPosicion']),
    pdfLogoSize: (strVal('combustible_pdf_logo_size', storedLocalConfig.pdfLogoSize, base.pdfLogoSize) as CombustibleConfig['pdfLogoSize']),

    pdfMostrarLogoSecundario: boolVal('combustible_pdf_mostrar_logo_secundario', storedLocalConfig.pdfMostrarLogoSecundario, base.pdfMostrarLogoSecundario),
    pdfLogoSecundarioUrl: strAllowEmpty('combustible_pdf_logo_secundario_url', storedLocalConfig.pdfLogoSecundarioUrl, base.pdfLogoSecundarioUrl),
    pdfLogoSecundarioPosicion: (strVal('combustible_pdf_logo_secundario_posicion', storedLocalConfig.pdfLogoSecundarioPosicion, base.pdfLogoSecundarioPosicion) as CombustibleConfig['pdfLogoSecundarioPosicion']),
    pdfLogoSecundarioSize: (strVal('combustible_pdf_logo_secundario_size', storedLocalConfig.pdfLogoSecundarioSize, base.pdfLogoSecundarioSize) as CombustibleConfig['pdfLogoSecundarioSize']),

    pdfMostrarSelloImg: boolVal('combustible_pdf_mostrar_sello_img', storedLocalConfig.pdfMostrarSelloImg, base.pdfMostrarSelloImg),
    pdfSelloImgUrl: strAllowEmpty('combustible_pdf_sello_img_url', storedLocalConfig.pdfSelloImgUrl, base.pdfSelloImgUrl),
    pdfSelloImgPosicion: (strVal('combustible_pdf_sello_img_posicion', storedLocalConfig.pdfSelloImgPosicion, base.pdfSelloImgPosicion) as CombustibleConfig['pdfSelloImgPosicion']),
    pdfSelloImgSize: (strVal('combustible_pdf_sello_img_size', storedLocalConfig.pdfSelloImgSize, base.pdfSelloImgSize) as CombustibleConfig['pdfSelloImgSize']),

    pdfMostrarLogoFooter: boolVal('combustible_pdf_mostrar_logo_footer', storedLocalConfig.pdfMostrarLogoFooter, base.pdfMostrarLogoFooter),
    pdfLogoFooterUrl: strAllowEmpty('combustible_pdf_logo_footer_url', storedLocalConfig.pdfLogoFooterUrl, base.pdfLogoFooterUrl),
    pdfFooterImgPosicion: (strVal('combustible_pdf_footer_img_posicion', storedLocalConfig.pdfFooterImgPosicion, base.pdfFooterImgPosicion || 'center') as CombustibleConfig['pdfFooterImgPosicion']),
    pdfFooterImgSize: (strVal('combustible_pdf_footer_img_size', storedLocalConfig.pdfFooterImgSize, base.pdfFooterImgSize || 'medium') as CombustibleConfig['pdfFooterImgSize']),

    pdfLabelSolicitante: strVal('combustible_pdf_label_solicitante', storedLocalConfig.pdfLabelSolicitante, base.pdfLabelSolicitante),
    pdfLabelSeccional: strVal('combustible_pdf_label_seccional', storedLocalConfig.pdfLabelSeccional, base.pdfLabelSeccional),
    pdfLabelDirector: strVal('combustible_pdf_label_director', storedLocalConfig.pdfLabelDirector, base.pdfLabelDirector),
    pdfLabelActividad: strVal('combustible_pdf_label_actividad', storedLocalConfig.pdfLabelActividad, base.pdfLabelActividad),
    pdfLabelCorreo: strVal('combustible_pdf_label_correo', storedLocalConfig.pdfLabelCorreo, base.pdfLabelCorreo),
    pdfLabelContacto: strVal('combustible_pdf_label_contacto', storedLocalConfig.pdfLabelContacto, base.pdfLabelContacto),
    pdfLabelLiquidacion: strVal('combustible_pdf_label_liquidacion', storedLocalConfig.pdfLabelLiquidacion, base.pdfLabelLiquidacion),
    pdfLabelMotivo: strVal('combustible_pdf_label_motivo', storedLocalConfig.pdfLabelMotivo, base.pdfLabelMotivo),
    pdfLabelObservaciones: strVal('combustible_pdf_label_observaciones', storedLocalConfig.pdfLabelObservaciones, base.pdfLabelObservaciones),

    pdfLabelFirmaSolicitante: strVal('combustible_pdf_label_firma_solicitante', storedLocalConfig.pdfLabelFirmaSolicitante, base.pdfLabelFirmaSolicitante),
    pdfLabelFirmaAdmin: strVal('combustible_pdf_label_firma_admin', storedLocalConfig.pdfLabelFirmaAdmin, base.pdfLabelFirmaAdmin),
    pdfNombreJefaturaOperaciones: strAllowEmpty('combustible_pdf_nombre_jefatura_operaciones', storedLocalConfig.pdfNombreJefaturaOperaciones, base.pdfNombreJefaturaOperaciones),
    pdfTextoSelloInstitucional: strVal('combustible_pdf_texto_sello_institucional', storedLocalConfig.pdfTextoSelloInstitucional, base.pdfTextoSelloInstitucional),
    pdfLabelDui: strVal('combustible_pdf_label_dui', storedLocalConfig.pdfLabelDui, base.pdfLabelDui),
    pdfLabelFecha: strVal('combustible_pdf_label_fecha', storedLocalConfig.pdfLabelFecha, base.pdfLabelFecha),
    pdfLabelFirmaSello: strVal('combustible_pdf_label_firma_sello', storedLocalConfig.pdfLabelFirmaSello, base.pdfLabelFirmaSello),
    pdfLabelAutoriza: strVal('combustible_pdf_label_autoriza', storedLocalConfig.pdfLabelAutoriza, base.pdfLabelAutoriza),
    pdfLabelFechaAuto: strVal('combustible_pdf_label_fecha_auto', storedLocalConfig.pdfLabelFechaAuto, base.pdfLabelFechaAuto),

    solicitarVehiculo: boolVal('combustible_solicitar_vehiculo', storedLocalConfig.solicitarVehiculo, base.solicitarVehiculo),
    mostrarVehiculo: boolVal('combustible_mostrar_vehiculo', storedLocalConfig.mostrarVehiculo, base.mostrarVehiculo),
    solicitarPlaca: boolVal('combustible_solicitar_placa', storedLocalConfig.solicitarPlaca, base.solicitarPlaca),
    mostrarPlaca: boolVal('combustible_mostrar_placa', storedLocalConfig.mostrarPlaca, base.mostrarPlaca),
    solicitarGalones: boolVal('combustible_solicitar_galones', storedLocalConfig.solicitarGalones, base.solicitarGalones),
    mostrarGalones: boolVal('combustible_mostrar_galones', storedLocalConfig.mostrarGalones, base.mostrarGalones),
    solicitarTipoGasolina: boolVal('combustible_solicitar_tipo_gasolina', storedLocalConfig.solicitarTipoGasolina, base.solicitarTipoGasolina),
    mostrarTipoGasolina: boolVal('combustible_mostrar_tipo_gasolina', storedLocalConfig.mostrarTipoGasolina, base.mostrarTipoGasolina),
    solicitarCantidadDinero: boolVal('combustible_solicitar_cantidad_dinero', storedLocalConfig.solicitarCantidadDinero, base.solicitarCantidadDinero),
    mostrarCantidadDinero: boolVal('combustible_mostrar_cantidad_dinero', storedLocalConfig.mostrarCantidadDinero, base.mostrarCantidadDinero),

    emailLogoFallbackUrl: emailLogoFallback,
  };
}

export function serializeCombustibleConfigToEntries(cfg: CombustibleConfig): Array<{ clave: string; valor: string }> {
  return [
    { clave: 'combustible_correo_destino', valor: cfg.correoDestino || '' },
    { clave: 'combustible_correo_cc', valor: cfg.correoCcDefault || '' },
    { clave: 'combustible_correo_contacto_telefono', valor: cfg.correoContactoTelefono || '' },
    { clave: 'combustible_correo_asunto_plantilla', valor: cfg.asuntoPlantilla || '' },
    { clave: 'combustible_correo_enviar_copia_solicitante', valor: String(cfg.enviarCopiaSolicitante) },
    { clave: 'combustible_correo_titulo', valor: cfg.correoTitulo || '' },
    { clave: 'combustible_correo_subtitulo', valor: cfg.correoSubtitulo || '' },
    { clave: 'combustible_correo_footer_texto', valor: cfg.correoFooterTexto || '' },

    { clave: 'combustible_pdf_titulo', valor: cfg.pdfTitulo || '' },
    { clave: 'combustible_pdf_subtitulo', valor: cfg.pdfSubtitulo || '' },
    { clave: 'combustible_pdf_subtitulo_secundario', valor: cfg.pdfSubtituloSecundario || 'Documento Oficial Administrativo' },
    { clave: 'combustible_pdf_font_family', valor: cfg.pdfFontFamily || 'sans' },
    { clave: 'combustible_pdf_font_size', valor: cfg.pdfFontSize || 'normal' },
    { clave: 'combustible_pdf_codigo_formulario', valor: cfg.pdfCodigoFormulario || '' },
    { clave: 'combustible_pdf_watermark', valor: String(cfg.pdfWatermark) },
    { clave: 'combustible_pdf_watermark_img_url', valor: cfg.pdfWatermarkImgUrl || '' },
    { clave: 'combustible_pdf_watermark_text', valor: cfg.pdfWatermarkText || '' },
    { clave: 'combustible_pdf_watermark_opacity', valor: cfg.pdfWatermarkOpacity || '0.08' },
    { clave: 'combustible_pdf_watermark_scale', valor: cfg.pdfWatermarkScale || '45' },
    { clave: 'combustible_pdf_watermark_position', valor: cfg.pdfWatermarkPosition || 'center' },

    { clave: 'combustible_pdf_mostrar_logo_header', valor: String(cfg.pdfMostrarLogoHeader) },
    { clave: 'combustible_pdf_logo_header_url', valor: cfg.pdfLogoHeaderUrl || '' },
    { clave: 'combustible_pdf_logo_posicion', valor: cfg.pdfLogoPosicion || 'left' },
    { clave: 'combustible_pdf_logo_size', valor: cfg.pdfLogoSize || 'medium' },

    { clave: 'combustible_pdf_mostrar_logo_secundario', valor: String(cfg.pdfMostrarLogoSecundario) },
    { clave: 'combustible_pdf_logo_secundario_url', valor: cfg.pdfLogoSecundarioUrl || '' },
    { clave: 'combustible_pdf_logo_secundario_posicion', valor: cfg.pdfLogoSecundarioPosicion || 'right' },
    { clave: 'combustible_pdf_logo_secundario_size', valor: cfg.pdfLogoSecundarioSize || 'medium' },

    { clave: 'combustible_pdf_mostrar_sello_img', valor: String(cfg.pdfMostrarSelloImg) },
    { clave: 'combustible_pdf_sello_img_url', valor: cfg.pdfSelloImgUrl || '' },
    { clave: 'combustible_pdf_sello_img_posicion', valor: cfg.pdfSelloImgPosicion || 'center' },
    { clave: 'combustible_pdf_sello_img_size', valor: cfg.pdfSelloImgSize || 'medium' },

    { clave: 'combustible_pdf_mostrar_logo_footer', valor: String(cfg.pdfMostrarLogoFooter) },
    { clave: 'combustible_pdf_logo_footer_url', valor: cfg.pdfLogoFooterUrl || '' },
    { clave: 'combustible_pdf_footer_img_posicion', valor: cfg.pdfFooterImgPosicion || 'center' },
    { clave: 'combustible_pdf_footer_img_size', valor: cfg.pdfFooterImgSize || 'medium' },

    { clave: 'combustible_pdf_label_solicitante', valor: cfg.pdfLabelSolicitante || '' },
    { clave: 'combustible_pdf_label_seccional', valor: cfg.pdfLabelSeccional || '' },
    { clave: 'combustible_pdf_label_director', valor: cfg.pdfLabelDirector || '' },
    { clave: 'combustible_pdf_label_actividad', valor: cfg.pdfLabelActividad || '' },
    { clave: 'combustible_pdf_label_correo', valor: cfg.pdfLabelCorreo || '' },
    { clave: 'combustible_pdf_label_contacto', valor: cfg.pdfLabelContacto || '' },
    { clave: 'combustible_pdf_label_liquidacion', valor: cfg.pdfLabelLiquidacion || '' },
    { clave: 'combustible_pdf_label_motivo', valor: cfg.pdfLabelMotivo || '' },
    { clave: 'combustible_pdf_label_observaciones', valor: cfg.pdfLabelObservaciones || '' },

    { clave: 'combustible_pdf_label_firma_solicitante', valor: cfg.pdfLabelFirmaSolicitante || '' },
    { clave: 'combustible_pdf_label_firma_admin', valor: cfg.pdfLabelFirmaAdmin || 'Jefatura de Operaciones' },
    { clave: 'combustible_pdf_nombre_jefatura_operaciones', valor: cfg.pdfNombreJefaturaOperaciones || '' },
    { clave: 'combustible_pdf_texto_sello_institucional', valor: cfg.pdfTextoSelloInstitucional || 'Sello Institucional Oficial' },
    { clave: 'combustible_pdf_label_dui', valor: cfg.pdfLabelDui || '' },
    { clave: 'combustible_pdf_label_fecha', valor: cfg.pdfLabelFecha || '' },
    { clave: 'combustible_pdf_label_firma_sello', valor: cfg.pdfLabelFirmaSello || '' },
    { clave: 'combustible_pdf_label_autoriza', valor: cfg.pdfLabelAutoriza || '' },
    { clave: 'combustible_pdf_label_fecha_auto', valor: cfg.pdfLabelFechaAuto || '' },

    { clave: 'combustible_solicitar_vehiculo', valor: String(cfg.solicitarVehiculo) },
    { clave: 'combustible_mostrar_vehiculo', valor: String(cfg.mostrarVehiculo) },
    { clave: 'combustible_solicitar_placa', valor: String(cfg.solicitarPlaca) },
    { clave: 'combustible_mostrar_placa', valor: String(cfg.mostrarPlaca) },
    { clave: 'combustible_solicitar_galones', valor: String(cfg.solicitarGalones) },
    { clave: 'combustible_mostrar_galones', valor: String(cfg.mostrarGalones) },
    { clave: 'combustible_solicitar_tipo_gasolina', valor: String(cfg.solicitarTipoGasolina) },
    { clave: 'combustible_mostrar_tipo_gasolina', valor: String(cfg.mostrarTipoGasolina) },
    { clave: 'combustible_solicitar_cantidad_dinero', valor: String(cfg.solicitarCantidadDinero) },
    { clave: 'combustible_mostrar_cantidad_dinero', valor: String(cfg.mostrarCantidadDinero) },
  ];
}
