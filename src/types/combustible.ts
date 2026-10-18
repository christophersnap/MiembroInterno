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
  fecha_solicitud?: string;
  hora_solicitud?: string;
  fecha_envio_completa?: string;
  estado: 'Pendiente' | 'Aprobada' | 'En Proceso' | 'Rechazada' | 'Entregada';
  autorizado_por?: string;
  fecha_autorizacion?: string;
  motivo_rechazo?: string;
  correo_enviado?: boolean;
  correos_notificados?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CombustibleBlockItem {
  id: string;
  name: string;
  enabled: boolean;
  align: 'left' | 'center' | 'right';
  description?: string;
}

export interface CombustibleConfig {
  // Correo
  correoDestino: string;
  correoCcDefault: string;
  correoContactoTelefono: string;
  asuntoPlantilla: string;
  enviarCopiaSolicitante: boolean;
  correoTitulo: string;
  correoSubtitulo: string;
  correoFooterTexto: string;

  // PDF
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
  pdfLogoFooterPosicion: 'left' | 'center' | 'right' | 'none';
  pdfLogoFooterSize: 'small' | 'medium' | 'large';

  // Aliases para soporte uniforme
  pdfMostrarFooterImg?: boolean;
  pdfFooterImgUrl?: string;
  pdfFooterImgPosicion?: 'left' | 'center' | 'right' | 'none';
  pdfFooterImgSize?: 'small' | 'medium' | 'large';

  pdfBloquesOrden?: CombustibleBlockItem[];

  // PDF Labels
  pdfLabelSolicitante: string;
  pdfLabelSeccional: string;
  pdfLabelDirector: string;
  pdfLabelActividad: string;
  pdfLabelCorreo: string;
  pdfLabelContacto: string;
  pdfLabelLiquidacion: string;
  pdfLabelMotivo: string;
  pdfLabelObservaciones: string;

  // Firmas
  pdfLabelFirmaSolicitante: string;
  pdfLabelFirmaAdmin: string;
  pdfLabelDui: string;
  pdfLabelFecha: string;
  pdfLabelFirmaSello: string;
  pdfLabelAutoriza: string;
  pdfLabelFechaAuto: string;
}

export const DEFAULT_COMBUSTIBLE_CONFIG: CombustibleConfig = {
  correoDestino: 'control_combustible@cruzverdesv.org',
  correoCcDefault: 'presidencia@cruzverdesv.org, administracion@cruzverdesv.org',
  correoContactoTelefono: '7695-7911',
  asuntoPlantilla: 'Solicitud de Combustible - [SOLICITANTE] - Seccional [SECCIONAL] - [FECHA]',
  enviarCopiaSolicitante: true,
  correoTitulo: '¡Confirmamos de recibido tu solicitud de Combustible!',
  correoSubtitulo: 'Comunícate con Oficina Central para ver el estado de tu solicitud',
  correoFooterTexto: 'Cualquier duda o consulta puedes enviar un correo a control_combustible@cruzverdesv.org o llama/whatsapp al 7695-7911',

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

  pdfMostrarFooterImg: true,
  pdfFooterImgUrl: '',
  pdfFooterImgPosicion: 'left',
  pdfFooterImgSize: 'medium',
  pdfBloquesOrden: [
    { id: 'encabezado', name: '1. Encabezado y Logotipo Oficial', enabled: true, align: 'left', description: 'Logo institucional de Cruz Verde y título' },
    { id: 'subtitulo_folio', name: '2. Subtítulo, Fecha, Hora y Código Formulario', enabled: true, align: 'left', description: 'Identificación de solicitud y control interno' },
    { id: 'datos_solicitante', name: '3. Datos del Solicitante, Seccional y Director', enabled: true, align: 'left', description: 'Nombre, seccional, director asignado y contacto' },
    { id: 'actividad_liquidacion', name: '4. Actividad / Eventualidad y Liquidación Anterior', enabled: true, align: 'left', description: 'Misión asignada y estado de comprobante previo' },
    { id: 'observaciones', name: '5. Observaciones Adicionales', enabled: true, align: 'left', description: 'Detalle o justificación de combustible requerida' },
    { id: 'firmas_sellos', name: '6. Cuadro de Firmas, Sellos y Autorizaciones', enabled: true, align: 'center', description: 'Firma de solicitante y visto bueno administrativo' },
    { id: 'pie_pagina', name: '7. Membrete de Pie de Página y Validación', enabled: true, align: 'left', description: 'Registro y validación oficial' }
  ],

  pdfLabelSolicitante: 'Nombre del solicitante',
  pdfLabelSeccional: 'Seccional',
  pdfLabelDirector: 'Director de la seccional',
  pdfLabelActividad: 'Actividad o Eventualidad',
  pdfLabelCorreo: 'Correo Electronico',
  pdfLabelContacto: 'Contacto',
  pdfLabelLiquidacion: 'A entregado liquidación de combustible del mes anterior?',
  pdfLabelMotivo: 'En caso de responder NO, favor especifique',
  pdfLabelObservaciones: 'Observaciones:',

  pdfLabelFirmaSolicitante: 'Llenado por solicitante',
  pdfLabelFirmaAdmin: 'Llenado por Area Administrativa',
  pdfLabelDui: 'Nombre segun DUI:',
  pdfLabelFecha: 'Fecha:',
  pdfLabelFirmaSello: 'Firma y Sello',
  pdfLabelAutoriza: 'Nombre quién autoriza:',
  pdfLabelFechaAuto: 'Fecha de autorización:'
};
