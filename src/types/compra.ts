export interface SolicitudCompra {
  id: number;
  folio: string;
  seccional_id?: number;
  seccional_nombre: string;
  solicitado_por: string;
  cargo: string;
  user_id?: string;
  user_email?: string;
  tipo_solicitud: string;
  es_para_vehiculo: boolean;
  vehiculo_id?: number;
  vehiculo_placa?: string;
  vehiculo_descripcion?: string;
  descripcion: string;
  monto_estimado?: number;
  proveedor_sugerido?: string;
  prioridad: 'Normal' | 'Urgente' | 'Emergencia';
  lugar_fecha: string;
  fecha_solicitud: string;
  hora_solicitud?: string;
  estado: 'Pendiente' | 'Aprobada' | 'En Proceso de Compra' | 'Rechazada' | 'Finalizada';
  autorizado_por?: string;
  fecha_autorizacion?: string;
  motivo_rechazo?: string;
  correo_enviado?: boolean;
  correos_notificados?: string;
  created_at?: string;
}

export interface VehiculoSimple {
  id: number;
  placa: string;
  marca: string;
  modelo: string;
  carroceria: string;
  seccional_id?: number;
  seccional_nombre?: string;
  millaje_actual?: number;
  unidad_distancia?: string;
}

export interface CompraBlockItem {
  id: string;
  name: string;
  enabled: boolean;
  align: 'left' | 'center' | 'right';
  description?: string;
}

export interface CompraConfig {
  // Configuración de Correo
  correoDestino: string;
  correoRemitente: string;
  correoCcDefault: string;
  asuntoPlantilla: string;
  enviarCopiaSolicitante: boolean;
  correoTitulo: string;
  correoSubtitulo: string;
  correoFooterTexto: string;

  // Configuración de PDF y Estilo
  pdfTitulo: string;
  pdfDepartamento: string;
  pdfSubtitulo: string;
  pdfFontFamily: 'sans' | 'serif' | 'mono';
  pdfFontSize: 'small' | 'normal' | 'large';
  pdfWatermark: boolean;
  pdfWatermarkText: string;
  pdfWatermarkOpacity: string;
  pdfPiePagina: string;

  // Logos e Imágenes individuales (Encabezado, Sello y Pie de Página)
  pdfMostrarLogo: boolean;
  pdfLogoUrl: string;
  pdfLogoPosicion: 'left' | 'center' | 'right' | 'none';
  pdfLogoSize: 'small' | 'medium' | 'large';

  pdfMostrarLogoSecundario: boolean;
  pdfLogoSecundarioUrl: string;
  pdfLogoSecundarioPosicion: 'left' | 'center' | 'right' | 'none';
  pdfLogoSecundarioSize: 'small' | 'medium' | 'large';

  pdfMostrarSello: boolean;
  pdfSelloTextoSuperior: string;
  pdfSelloTextoInferior: string;
  pdfMostrarSelloImg: boolean;
  pdfSelloImgUrl: string;
  pdfSelloImgPosicion: 'left' | 'center' | 'right' | 'none';
  pdfSelloImgSize: 'small' | 'medium' | 'large';

  pdfMostrarFooterImg: boolean;
  pdfFooterImgUrl: string;
  pdfFooterImgPosicion: 'left' | 'center' | 'right' | 'none';
  pdfFooterImgSize: 'small' | 'medium' | 'large';

  // Visibilidad de secciones
  pdfMostrarUrgencia: boolean;
  pdfMostrarVehiculo: boolean;
  pdfMostrarCostos: boolean;
  pdfMostrarProveedor: boolean;
  pdfMostrarFechaHora: boolean;

  // Firmas
  pdfFirma1Titulo: string;
  pdfFirma1Subtitulo: string;
  pdfFirma2Titulo: string;
  pdfFirma2Subtitulo: string;
  pdfFirma3Titulo: string;
  pdfFirma3Subtitulo: string;

  // Etiquetas de Campos
  pdfLabelSolicitante: string;
  pdfLabelCargo: string;
  pdfLabelSeccional: string;
  pdfLabelFecha: string;
  pdfLabelLugar: string;
  pdfLabelTipo: string;
  pdfLabelVehiculo: string;
  pdfLabelPlaca: string;
  pdfLabelDescripcion: string;
  pdfLabelMonto: string;
  pdfLabelProveedor: string;

  // Orden de bloques para colocación por arrastre
  pdfBloquesOrden: CompraBlockItem[];
}

export const DEFAULT_COMPRA_BLOCKS: CompraBlockItem[] = [
  { id: 'encabezado', name: '1. Encabezado Oficial y Logotipo Institucional', enabled: true, align: 'center', description: 'Logotipo de Cruz Verde, título institucional y departamento' },
  { id: 'subtitulo_folio', name: '2. Barra de Subtítulo, Folio y Fecha/Hora', enabled: true, align: 'center', description: 'Hoja de Solicitud de Compra, folio único y fecha de emisión' },
  { id: 'datos_seccional', name: '3. Datos del Solicitante, Cargo y Seccional', enabled: true, align: 'left', description: 'Director a cargo, cargo institucional, seccional y correo asignado' },
  { id: 'rubro_vehiculo', name: '4. Rubro de Requerimiento y Vehículo Relacionado', enabled: true, align: 'left', description: 'Tipo de compra (repuestos, suministros) y datos de placa/unidad' },
  { id: 'costo_urgencia', name: '5. Nivel de Urgencia y Monto Estimado Cotizado', enabled: true, align: 'left', description: 'Prioridad normal/urgente y monto en dólares' },
  { id: 'descripcion_cuerpo', name: '6. Descripción Detallada del Producto / Servicio', enabled: true, align: 'left', description: 'Cuerpo descriptivo y desglose de materiales a adquirir' },
  { id: 'proveedor_taller', name: '7. Proveedor o Taller Sugerido', enabled: true, align: 'left', description: 'Nombre de proveedor o comercio propuesto para la cotización' },
  { id: 'firmas_sello', name: '8. Bloque de Firmas, Autorizaciones y Sello Oficial', enabled: true, align: 'center', description: 'Firma de solicitante, sello institucional de Cruz Verde y visto bueno administrativo' },
  { id: 'pie_pagina', name: '9. Pie de Página Institucional y Folio Legal', enabled: true, align: 'center', description: 'Leyenda de control administrativo y código de validación' },
];

export const DEFAULT_COMPRA_CONFIG: CompraConfig = {
  correoDestino: 'administracion@cruzverdesv.org',
  correoRemitente: 'sistema@cruzverdesv.org',
  correoCcDefault: 'presidencia@cruzverdesv.org',
  asuntoPlantilla: 'Solicitud de Compra [FOLIO] - [SECCIONAL] - [DIRECTOR] - [FECHA]',
  enviarCopiaSolicitante: true,
  correoTitulo: '¡Hemos recibido formalmente la Solicitud de Compra!',
  correoSubtitulo: 'El departamento administrativo ha registrado su requerimiento institucional',
  correoFooterTexto: 'Para consultas sobre esta solicitud de compra, responda a este correo institucional o comuníquese con Administración Central.',

  pdfTitulo: 'CRUZ VERDE SALVADOREÑA',
  pdfDepartamento: 'DEPARTAMENTO ADMINISTRATIVO.',
  pdfSubtitulo: 'HOJA DE SOLICITUD DE COMPRA.',
  pdfFontFamily: 'sans',
  pdfFontSize: 'normal',
  pdfWatermark: true,
  pdfWatermarkText: 'CRUZ VERDE SALVADOREÑA - DOCUMENTO OFICIAL',
  pdfWatermarkOpacity: '0.08',
  pdfPiePagina: 'Cruz Verde Salvadoreña - Sistema de Compras y Mantenimiento • Documento Oficial Interno',

  pdfMostrarLogo: true,
  pdfLogoUrl: '',
  pdfLogoPosicion: 'center',
  pdfLogoSize: 'medium',

  pdfMostrarLogoSecundario: false,
  pdfLogoSecundarioUrl: '',
  pdfLogoSecundarioPosicion: 'right',
  pdfLogoSecundarioSize: 'medium',

  pdfMostrarSello: true,
  pdfSelloTextoSuperior: 'CRUZ VERDE',
  pdfSelloTextoInferior: 'EL SALVADOR, C.A.',
  pdfMostrarSelloImg: false,
  pdfSelloImgUrl: '',
  pdfSelloImgPosicion: 'center',
  pdfSelloImgSize: 'medium',

  pdfMostrarFooterImg: false,
  pdfFooterImgUrl: '',
  pdfFooterImgPosicion: 'center',
  pdfFooterImgSize: 'medium',

  pdfMostrarUrgencia: true,
  pdfMostrarVehiculo: true,
  pdfMostrarCostos: true,
  pdfMostrarProveedor: true,
  pdfMostrarFechaHora: true,

  pdfFirma1Titulo: 'Firma: SOLICITANTE',
  pdfFirma1Subtitulo: 'Director(a) Seccional',
  pdfFirma2Titulo: 'Vo. Bo. y Autorización',
  pdfFirma2Subtitulo: 'Departamento Administrativo',
  pdfFirma3Titulo: 'Revisión y Control',
  pdfFirma3Subtitulo: 'Presidencia / Jefatura',

  pdfLabelSolicitante: 'Solicitado por:',
  pdfLabelCargo: 'Cargo:',
  pdfLabelSeccional: 'Seccional:',
  pdfLabelFecha: 'Fecha y Hora:',
  pdfLabelLugar: 'Lugar:',
  pdfLabelTipo: 'Tipo de Solicitud:',
  pdfLabelVehiculo: 'Vehículo Relacionado:',
  pdfLabelPlaca: 'Placa:',
  pdfLabelDescripcion: 'Descripción del servicio o producto a adquirir:',
  pdfLabelMonto: 'Monto Estimado:',
  pdfLabelProveedor: 'Proveedor o Taller Sugerido:',

  pdfBloquesOrden: DEFAULT_COMPRA_BLOCKS
};
