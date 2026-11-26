export type { SolicitudCompra } from '../pages/SolicitudesCompra';
import { PdfWatermarkPosition, normalizePdfWatermarkPosition } from '../components/common/PdfWatermarkOverlay';

export interface CompraBlockItem {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  align?: 'left' | 'center' | 'right';
}

export interface CompraConfig {
  correoDestino: string;
  correoRemitente?: string;
  correoCcDefault: string;
  asuntoPlantilla: string;
  enviarCopiaSolicitante: boolean;
  correoTitulo: string;
  correoSubtitulo: string;
  correoFooterTexto: string;

  pdfTitulo: string;
  pdfDepartamento: string;
  pdfSubtitulo: string;
  pdfFontFamily: 'sans' | 'serif' | 'mono';
  pdfFontSize: 'small' | 'normal' | 'large';
  pdfWatermark: boolean;
  pdfWatermarkImgUrl: string;
  pdfWatermarkText: string;
  pdfWatermarkOpacity: string;
  pdfWatermarkScale: string;
  pdfWatermarkPosition: PdfWatermarkPosition;
  pdfPiePagina: string;

  pdfMostrarLogo: boolean;
  pdfLogoUrl: string;
  pdfLogoPosicion: 'left' | 'center' | 'right' | 'none';
  pdfLogoSize: 'small' | 'medium' | 'large';

  pdfMostrarLogoSecundario: boolean;
  pdfLogoSecundarioUrl: string;
  pdfLogoSecundarioPosicion: 'left' | 'center' | 'right' | 'none';
  pdfLogoSecundarioSize: 'small' | 'medium' | 'large';

  pdfMostrarSello: boolean;
  pdfMostrarSelloImg: boolean;
  pdfSelloImgUrl: string;
  pdfSelloImgPosicion: 'left' | 'center' | 'right' | 'none';
  pdfSelloImgSize: 'small' | 'medium' | 'large';
  pdfSelloTextoSuperior?: string;
  pdfSelloTextoInferior?: string;

  pdfMostrarFooterImg: boolean;
  pdfFooterImgUrl: string;
  pdfFooterImgPosicion: 'left' | 'center' | 'right' | 'none';
  pdfFooterImgSize: 'small' | 'medium' | 'large';

  pdfMostrarUrgencia?: boolean;
  pdfMostrarVehiculo?: boolean;
  pdfMostrarCostos?: boolean;
  pdfMostrarProveedor?: boolean;
  pdfMostrarFechaHora?: boolean;
  pdfMostrarContacto?: boolean;
  pdfMostrarCotizacion?: boolean;

  pdfFirma1Titulo: string;
  pdfFirma1Subtitulo: string;
  pdfFirma2Titulo: string;
  pdfFirma2Subtitulo: string;
  pdfFirma3Titulo: string;
  pdfFirma3Subtitulo: string;

  pdfLabelSolicitante?: string;
  pdfLabelCargo?: string;
  pdfLabelSeccional?: string;
  pdfLabelTipo?: string;
  pdfLabelVehiculo?: string;
  pdfLabelPlaca?: string;
  pdfLabelMonto?: string;
  pdfLabelProveedor?: string;
  pdfLabelDescripcion?: string;
  pdfLabelFecha?: string;
  pdfLabelHora?: string;
  pdfLabelPrioridad?: string;
  pdfLabelLugarFecha?: string;
  pdfLabelEstado?: string;

  pdfBloquesOrden: CompraBlockItem[];
}

export const DEFAULT_COMPRA_BLOCKS: CompraBlockItem[] = [
  { id: 'encabezado', name: 'Encabezado Institucional', description: 'Logos, Título y Departamento', enabled: true, align: 'center' },
  { id: 'subtitulo_folio', name: 'Subtítulo y Folio', description: 'Nombre del documento y número de folio', enabled: true, align: 'left' },
  { id: 'datos_solicitante', name: 'Datos del Solicitante', description: 'Seccional, solicitante, fecha y hora', enabled: true, align: 'left' },
  { id: 'detalle_compra', name: 'Detalle de la Compra / Reparación', description: 'Descripción de bienes, repuestos o servicios', enabled: true, align: 'left' },
  { id: 'costos_proveedor', name: 'Costos y Proveedor Sugerido', description: 'Monto estimado y datos del comercio cotizado', enabled: true, align: 'left' },
  { id: 'firmas_sello', name: 'Firmas y Sello Oficial', description: 'Firmas de solicitante, jefatura y sello', enabled: true, align: 'center' },
  { id: 'pie_pagina', name: 'Pie de Página Institucional', description: 'Leyenda oficial y membrete inferior', enabled: true, align: 'center' }
];

export const DEFAULT_COMPRA_CONFIG: CompraConfig = {
  correoDestino: 'administracion@cruzverdesv.org',
  correoRemitente: 'sistema@cruzverdesv.org',
  correoCcDefault: 'presidencia@cruzverdesv.org',
  asuntoPlantilla: 'Solicitud de Compra: {folio} - {seccional}',
  enviarCopiaSolicitante: true,
  correoTitulo: '¡Confirmamos de recibido tu solicitud de compra!',
  correoSubtitulo: 'Comunícate con Administración Central para dar seguimiento',
  correoFooterTexto: 'Cruz Verde Salvadoreña - Sistema Administrativo Institucional',

  pdfTitulo: 'CRUZ VERDE SALVADOREÑA',
  pdfDepartamento: 'DEPARTAMENTO ADMINISTRATIVO.',
  pdfSubtitulo: 'HOJA DE SOLICITUD DE COMPRA.',
  pdfFontFamily: 'sans',
  pdfFontSize: 'normal',
  pdfWatermark: false,
  pdfWatermarkImgUrl: '',
  pdfWatermarkText: 'CRUZ VERDE SALVADOREÑA',
  pdfWatermarkOpacity: '0.12',
  pdfWatermarkScale: '45',
  pdfWatermarkPosition: 'center',
  pdfPiePagina: 'Este documento es de carácter oficial e institucional de Cruz Verde Salvadoreña. Toda adquisición o servicio debe contar con las firmas y sellos correspondientes.',

  pdfMostrarLogo: true,
  pdfLogoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Cruz_Verde_Salvadore%C3%B1a.png/120px-Cruz_Verde_Salvadore%C3%B1a.png',
  pdfLogoPosicion: 'left',
  pdfLogoSize: 'medium',

  pdfMostrarLogoSecundario: false,
  pdfLogoSecundarioUrl: '',
  pdfLogoSecundarioPosicion: 'right',
  pdfLogoSecundarioSize: 'medium',

  pdfMostrarSello: true,
  pdfMostrarSelloImg: false,
  pdfSelloImgUrl: '',
  pdfSelloImgPosicion: 'center',
  pdfSelloImgSize: 'medium',

  pdfMostrarFooterImg: false,
  pdfFooterImgUrl: '',
  pdfFooterImgPosicion: 'left',
  pdfFooterImgSize: 'medium',

  pdfMostrarUrgencia: true,
  pdfMostrarVehiculo: true,
  pdfMostrarCostos: true,
  pdfMostrarProveedor: true,
  pdfMostrarFechaHora: true,
  pdfMostrarContacto: true,
  pdfMostrarCotizacion: true,

  pdfFirma1Titulo: 'Firma: SOLICITANTE',
  pdfFirma1Subtitulo: 'Director de Seccional',
  pdfFirma2Titulo: 'Vo.Bo. Jefatura Administrativa',
  pdfFirma2Subtitulo: 'Administración Central',
  pdfFirma3Titulo: 'Autorizado Presidencia',
  pdfFirma3Subtitulo: 'Dirección General',

  pdfBloquesOrden: DEFAULT_COMPRA_BLOCKS
};

export function parseCompraConfigFromMap(
  confMap: Record<string, string>,
  storedLocalConfig: Partial<CompraConfig> = {},
  base: CompraConfig = DEFAULT_COMPRA_CONFIG
): CompraConfig {
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

  let parsedBlocks = storedLocalConfig.pdfBloquesOrden?.length
    ? storedLocalConfig.pdfBloquesOrden
    : base.pdfBloquesOrden;
  if (confMap.solicitudes_pdf_bloques_orden) {
    try {
      const parsed = JSON.parse(confMap.solicitudes_pdf_bloques_orden);
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsedBlocks = parsed;
      }
    } catch {
      // mantener bloques actuales
    }
  }

  return {
    ...base,
    ...storedLocalConfig,
    correoDestino: strVal('solicitudes_correo_destino', storedLocalConfig.correoDestino, base.correoDestino),
    correoRemitente: strVal('solicitudes_correo_remitente', storedLocalConfig.correoRemitente, base.correoRemitente || ''),
    correoCcDefault: strAllowEmpty('solicitudes_correo_cc', storedLocalConfig.correoCcDefault, base.correoCcDefault),
    asuntoPlantilla: strVal('solicitudes_asunto_plantilla', storedLocalConfig.asuntoPlantilla, base.asuntoPlantilla),
    enviarCopiaSolicitante: boolVal('solicitudes_enviar_copia_solicitante', storedLocalConfig.enviarCopiaSolicitante, base.enviarCopiaSolicitante),
    correoTitulo: strVal('solicitudes_correo_titulo', storedLocalConfig.correoTitulo, base.correoTitulo),
    correoSubtitulo: strVal('solicitudes_correo_subtitulo', storedLocalConfig.correoSubtitulo, base.correoSubtitulo),
    correoFooterTexto: strVal('solicitudes_correo_footer_texto', storedLocalConfig.correoFooterTexto, base.correoFooterTexto),

    pdfTitulo: strVal('solicitudes_pdf_titulo', storedLocalConfig.pdfTitulo, base.pdfTitulo),
    pdfDepartamento: strVal('solicitudes_pdf_departamento', storedLocalConfig.pdfDepartamento, base.pdfDepartamento),
    pdfSubtitulo: strVal('solicitudes_pdf_subtitulo', storedLocalConfig.pdfSubtitulo, base.pdfSubtitulo),
    pdfFontFamily: (strVal('solicitudes_pdf_font_family', storedLocalConfig.pdfFontFamily, base.pdfFontFamily) as CompraConfig['pdfFontFamily']),
    pdfFontSize: (strVal('solicitudes_pdf_font_size', storedLocalConfig.pdfFontSize, base.pdfFontSize) as CompraConfig['pdfFontSize']),

    pdfWatermark: boolVal('solicitudes_pdf_watermark', storedLocalConfig.pdfWatermark, base.pdfWatermark),
    pdfWatermarkImgUrl: strAllowEmpty('solicitudes_pdf_watermark_img_url', storedLocalConfig.pdfWatermarkImgUrl, base.pdfWatermarkImgUrl),
    pdfWatermarkText: strVal('solicitudes_pdf_watermark_text', storedLocalConfig.pdfWatermarkText, base.pdfWatermarkText),
    pdfWatermarkOpacity: strVal('solicitudes_pdf_watermark_opacity', storedLocalConfig.pdfWatermarkOpacity, base.pdfWatermarkOpacity),
    pdfWatermarkScale: strVal('solicitudes_pdf_watermark_scale', storedLocalConfig.pdfWatermarkScale, base.pdfWatermarkScale),
    pdfWatermarkPosition: normalizePdfWatermarkPosition(
      strVal('solicitudes_pdf_watermark_position', storedLocalConfig.pdfWatermarkPosition, base.pdfWatermarkPosition),
      base.pdfWatermarkPosition
    ),
    pdfPiePagina: strVal('solicitudes_pdf_pie_pagina', storedLocalConfig.pdfPiePagina, base.pdfPiePagina),

    pdfMostrarLogo: boolVal('solicitudes_pdf_mostrar_logo', storedLocalConfig.pdfMostrarLogo, base.pdfMostrarLogo),
    pdfLogoUrl: strAllowEmpty('solicitudes_pdf_logo_url', storedLocalConfig.pdfLogoUrl, base.pdfLogoUrl),
    pdfLogoPosicion: (strVal('solicitudes_pdf_logo_posicion', storedLocalConfig.pdfLogoPosicion, base.pdfLogoPosicion) as CompraConfig['pdfLogoPosicion']),
    pdfLogoSize: (strVal('solicitudes_pdf_logo_size', storedLocalConfig.pdfLogoSize, base.pdfLogoSize) as CompraConfig['pdfLogoSize']),

    pdfMostrarLogoSecundario: boolVal('solicitudes_pdf_mostrar_logo_secundario', storedLocalConfig.pdfMostrarLogoSecundario, base.pdfMostrarLogoSecundario),
    pdfLogoSecundarioUrl: strAllowEmpty('solicitudes_pdf_logo_secundario_url', storedLocalConfig.pdfLogoSecundarioUrl, base.pdfLogoSecundarioUrl),
    pdfLogoSecundarioPosicion: (strVal('solicitudes_pdf_logo_secundario_posicion', storedLocalConfig.pdfLogoSecundarioPosicion, base.pdfLogoSecundarioPosicion) as CompraConfig['pdfLogoSecundarioPosicion']),
    pdfLogoSecundarioSize: (strVal('solicitudes_pdf_logo_secundario_size', storedLocalConfig.pdfLogoSecundarioSize, base.pdfLogoSecundarioSize) as CompraConfig['pdfLogoSecundarioSize']),

    pdfMostrarSello: boolVal('solicitudes_pdf_mostrar_sello', storedLocalConfig.pdfMostrarSello, base.pdfMostrarSello),
    pdfMostrarSelloImg: boolVal('solicitudes_pdf_mostrar_sello_img', storedLocalConfig.pdfMostrarSelloImg, base.pdfMostrarSelloImg),
    pdfSelloImgUrl: strAllowEmpty('solicitudes_pdf_sello_img_url', storedLocalConfig.pdfSelloImgUrl, base.pdfSelloImgUrl),
    pdfSelloImgPosicion: (strVal('solicitudes_pdf_sello_img_posicion', storedLocalConfig.pdfSelloImgPosicion, base.pdfSelloImgPosicion) as CompraConfig['pdfSelloImgPosicion']),
    pdfSelloImgSize: (strVal('solicitudes_pdf_sello_img_size', storedLocalConfig.pdfSelloImgSize, base.pdfSelloImgSize) as CompraConfig['pdfSelloImgSize']),
    pdfSelloTextoSuperior: strAllowEmpty('solicitudes_pdf_sello_texto_superior', storedLocalConfig.pdfSelloTextoSuperior, base.pdfSelloTextoSuperior || ''),
    pdfSelloTextoInferior: strAllowEmpty('solicitudes_pdf_sello_texto_inferior', storedLocalConfig.pdfSelloTextoInferior, base.pdfSelloTextoInferior || ''),

    pdfMostrarFooterImg: boolVal('solicitudes_pdf_mostrar_footer_img', storedLocalConfig.pdfMostrarFooterImg, base.pdfMostrarFooterImg),
    pdfFooterImgUrl: strAllowEmpty('solicitudes_pdf_footer_img_url', storedLocalConfig.pdfFooterImgUrl, base.pdfFooterImgUrl),
    pdfFooterImgPosicion: (strVal('solicitudes_pdf_footer_img_posicion', storedLocalConfig.pdfFooterImgPosicion, base.pdfFooterImgPosicion) as CompraConfig['pdfFooterImgPosicion']),
    pdfFooterImgSize: (strVal('solicitudes_pdf_footer_img_size', storedLocalConfig.pdfFooterImgSize, base.pdfFooterImgSize) as CompraConfig['pdfFooterImgSize']),

    pdfFirma1Titulo: strVal('solicitudes_pdf_firma1_titulo', storedLocalConfig.pdfFirma1Titulo, base.pdfFirma1Titulo),
    pdfFirma1Subtitulo: strVal('solicitudes_pdf_firma1_subtitulo', storedLocalConfig.pdfFirma1Subtitulo, base.pdfFirma1Subtitulo),
    pdfFirma2Titulo: strVal('solicitudes_pdf_firma2_titulo', storedLocalConfig.pdfFirma2Titulo, base.pdfFirma2Titulo),
    pdfFirma2Subtitulo: strVal('solicitudes_pdf_firma2_subtitulo', storedLocalConfig.pdfFirma2Subtitulo, base.pdfFirma2Subtitulo),
    pdfFirma3Titulo: strVal('solicitudes_pdf_firma3_titulo', storedLocalConfig.pdfFirma3Titulo, base.pdfFirma3Titulo),
    pdfFirma3Subtitulo: strVal('solicitudes_pdf_firma3_subtitulo', storedLocalConfig.pdfFirma3Subtitulo, base.pdfFirma3Subtitulo),
    pdfBloquesOrden: parsedBlocks,
  };
}

export function serializeCompraConfigToEntries(cfg: CompraConfig): Array<{ clave: string; valor: string }> {
  return [
    { clave: 'solicitudes_correo_destino', valor: cfg.correoDestino || '' },
    { clave: 'solicitudes_correo_remitente', valor: cfg.correoRemitente || '' },
    { clave: 'solicitudes_correo_cc', valor: cfg.correoCcDefault || '' },
    { clave: 'solicitudes_asunto_plantilla', valor: cfg.asuntoPlantilla || '' },
    { clave: 'solicitudes_enviar_copia_solicitante', valor: String(cfg.enviarCopiaSolicitante) },
    { clave: 'solicitudes_correo_titulo', valor: cfg.correoTitulo || '' },
    { clave: 'solicitudes_correo_subtitulo', valor: cfg.correoSubtitulo || '' },
    { clave: 'solicitudes_correo_footer_texto', valor: cfg.correoFooterTexto || '' },

    { clave: 'solicitudes_pdf_titulo', valor: cfg.pdfTitulo || '' },
    { clave: 'solicitudes_pdf_departamento', valor: cfg.pdfDepartamento || '' },
    { clave: 'solicitudes_pdf_subtitulo', valor: cfg.pdfSubtitulo || '' },
    { clave: 'solicitudes_pdf_font_family', valor: cfg.pdfFontFamily || 'sans' },
    { clave: 'solicitudes_pdf_font_size', valor: cfg.pdfFontSize || 'normal' },

    { clave: 'solicitudes_pdf_watermark', valor: String(cfg.pdfWatermark) },
    { clave: 'solicitudes_pdf_watermark_img_url', valor: cfg.pdfWatermarkImgUrl || '' },
    { clave: 'solicitudes_pdf_watermark_text', valor: cfg.pdfWatermarkText || '' },
    { clave: 'solicitudes_pdf_watermark_opacity', valor: cfg.pdfWatermarkOpacity || '0.12' },
    { clave: 'solicitudes_pdf_watermark_scale', valor: cfg.pdfWatermarkScale || '45' },
    { clave: 'solicitudes_pdf_watermark_position', valor: cfg.pdfWatermarkPosition || 'center' },
    { clave: 'solicitudes_pdf_pie_pagina', valor: cfg.pdfPiePagina || '' },

    { clave: 'solicitudes_pdf_mostrar_logo', valor: String(cfg.pdfMostrarLogo) },
    { clave: 'solicitudes_pdf_logo_url', valor: cfg.pdfLogoUrl || '' },
    { clave: 'solicitudes_pdf_logo_posicion', valor: cfg.pdfLogoPosicion || 'left' },
    { clave: 'solicitudes_pdf_logo_size', valor: cfg.pdfLogoSize || 'medium' },

    { clave: 'solicitudes_pdf_mostrar_logo_secundario', valor: String(cfg.pdfMostrarLogoSecundario) },
    { clave: 'solicitudes_pdf_logo_secundario_url', valor: cfg.pdfLogoSecundarioUrl || '' },
    { clave: 'solicitudes_pdf_logo_secundario_posicion', valor: cfg.pdfLogoSecundarioPosicion || 'right' },
    { clave: 'solicitudes_pdf_logo_secundario_size', valor: cfg.pdfLogoSecundarioSize || 'medium' },

    { clave: 'solicitudes_pdf_mostrar_sello', valor: String(cfg.pdfMostrarSello) },
    { clave: 'solicitudes_pdf_mostrar_sello_img', valor: String(cfg.pdfMostrarSelloImg) },
    { clave: 'solicitudes_pdf_sello_img_url', valor: cfg.pdfSelloImgUrl || '' },
    { clave: 'solicitudes_pdf_sello_img_posicion', valor: cfg.pdfSelloImgPosicion || 'center' },
    { clave: 'solicitudes_pdf_sello_img_size', valor: cfg.pdfSelloImgSize || 'medium' },
    { clave: 'solicitudes_pdf_sello_texto_superior', valor: cfg.pdfSelloTextoSuperior || '' },
    { clave: 'solicitudes_pdf_sello_texto_inferior', valor: cfg.pdfSelloTextoInferior || '' },

    { clave: 'solicitudes_pdf_mostrar_footer_img', valor: String(cfg.pdfMostrarFooterImg) },
    { clave: 'solicitudes_pdf_footer_img_url', valor: cfg.pdfFooterImgUrl || '' },
    { clave: 'solicitudes_pdf_footer_img_posicion', valor: cfg.pdfFooterImgPosicion || 'left' },
    { clave: 'solicitudes_pdf_footer_img_size', valor: cfg.pdfFooterImgSize || 'medium' },

    { clave: 'solicitudes_pdf_firma1_titulo', valor: cfg.pdfFirma1Titulo || '' },
    { clave: 'solicitudes_pdf_firma1_subtitulo', valor: cfg.pdfFirma1Subtitulo || '' },
    { clave: 'solicitudes_pdf_firma2_titulo', valor: cfg.pdfFirma2Titulo || '' },
    { clave: 'solicitudes_pdf_firma2_subtitulo', valor: cfg.pdfFirma2Subtitulo || '' },
    { clave: 'solicitudes_pdf_firma3_titulo', valor: cfg.pdfFirma3Titulo || '' },
    { clave: 'solicitudes_pdf_firma3_subtitulo', valor: cfg.pdfFirma3Subtitulo || '' },
    { clave: 'solicitudes_pdf_bloques_orden', valor: JSON.stringify(cfg.pdfBloquesOrden || DEFAULT_COMPRA_BLOCKS) },
  ];
}
