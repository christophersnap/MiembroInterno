export type { SolicitudCompra } from '../pages/SolicitudesCompra';

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
  pdfWatermarkText: string;
  pdfWatermarkOpacity: string;
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
  pdfWatermarkText: 'NO VÁLIDO',
  pdfWatermarkOpacity: '0.15',
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
