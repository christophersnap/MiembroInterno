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
  cargo_solicitante?: string;
  vehiculo_placa?: string;
  vehiculo_marca?: string;
  vehiculo_modelo?: string;
  tipo_combustible?: string;
  galones_solicitados?: string | number;
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
  pdfFontFamily: 'sans' | 'serif' | 'mono';
  pdfFontSize: 'small' | 'normal' | 'large';
  pdfCodigoFormulario: string;
  pdfWatermark: boolean;
  pdfWatermarkText: string;
  pdfWatermarkOpacity: string;

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
  pdfLabelDui: string;
  pdfLabelFecha: string;
  pdfLabelFirmaSello: string;
  pdfLabelAutoriza: string;
  pdfLabelFechaAuto: string;

  pdfBloquesOrden?: CombustibleBlockItem[];
}

export const DEFAULT_COMBUSTIBLE_BLOCKS: CombustibleBlockItem[] = [
  { id: 'encabezado', name: 'Encabezado Institucional', description: 'Logos, Título y Código de Formulario', enabled: true, align: 'center' },
  { id: 'subtitulo_folio', name: 'Subtítulo y Folio', description: 'Nombre del documento y número de folio', enabled: true, align: 'left' },
  { id: 'datos_solicitante', name: 'Datos de la Solicitud y Seccional', description: 'Seccional, solicitante, director, fecha y hora', enabled: true, align: 'left' },
  { id: 'actividad_motivo', name: 'Actividad y Motivo de Combustible', description: 'Misión asignada, emergencias y observaciones', enabled: true, align: 'left' },
  { id: 'liquidacion_anterior', name: 'Estado de Liquidación Anterior', description: 'Verificación de comprobantes de combustible previo', enabled: true, align: 'left' },
  { id: 'firmas_sello', name: 'Firmas y Sello Oficial', description: 'Firma de solicitante, administración y sello', enabled: true, align: 'center' },
  { id: 'pie_pagina', name: 'Cintillo y Pie de Página', description: 'Leyenda oficial y membrete inferior', enabled: true, align: 'center' }
];

export const DEFAULT_COMBUSTIBLE_CONFIG: CombustibleConfig = {
  correoDestino: 'control_combustible@cruzverdesv.org',
  correoCcDefault: 'presidencia@cruzverdesv.org, administracion@cruzverdesv.org',
  correoContactoTelefono: '7695-7911',
  asuntoPlantilla: 'Solicitud de Combustible: [FOLIO] - [SECCIONAL]',
  enviarCopiaSolicitante: true,
  correoTitulo: '¡Confirmamos de recibido tu solicitud de Combustible!',
  correoSubtitulo: 'Comunícate con Oficina Central para ver el estado de tu solicitud',
  correoFooterTexto: 'Cualquier duda o consulta puedes enviar un correo a control_combustible@cruzverdesv.org o llamar al 7695-7911',

  pdfTitulo: 'CRUZ VERDE SALVADOREÑA',
  pdfSubtitulo: 'SOLICITUD DE COMBUSTIBLE',
  pdfFontFamily: 'sans',
  pdfFontSize: 'normal',
  pdfCodigoFormulario: 'CVSCOMBUS/FORM001',
  pdfWatermark: true,
  pdfWatermarkText: 'CRUZ VERDE SALVADOREÑA - COMBUSTIBLE',
  pdfWatermarkOpacity: '0.08',
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
  pdfLabelActividad: 'Actividad / Emergencia',
  pdfLabelCorreo: 'Correo de la Seccional',
  pdfLabelContacto: 'Teléfono de Contacto',
  pdfLabelLiquidacion: '¿Entregó liquidación de combustible anterior?',
  pdfLabelMotivo: 'Motivo de no liquidación',
  pdfLabelObservaciones: 'Observaciones Adicionales',

  pdfLabelFirmaSolicitante: 'SOLICITANTE',
  pdfLabelFirmaAdmin: 'ADMINISTRACIÓN CENTRAL',
  pdfLabelDui: 'Nombre / Cargo:',
  pdfLabelFecha: 'Fecha:',
  pdfLabelFirmaSello: 'Firma y Sello Oficial',
  pdfLabelAutoriza: 'Autorizado por:',
  pdfLabelFechaAuto: 'Fecha Autorización:',

  pdfBloquesOrden: DEFAULT_COMBUSTIBLE_BLOCKS
};
