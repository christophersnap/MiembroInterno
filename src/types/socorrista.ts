export interface DocumentoSocorrista {
  id?: number | string;
  socorrista_id: number;
  tipo_documento: 'cv' | 'antecedentes_penales' | 'antecedentes_policiales' | 'solvencia_municipal' | 'otro';
  nombre_archivo: string;
  archivo_url: string;
  version: number;
  es_vigente: boolean;
  tamanio_bytes?: number;
  fecha_subida: string;
  subido_por?: string;
  observaciones?: string;
}

export const TIPOS_DOCUMENTOS: {
  id: DocumentoSocorrista['tipo_documento'];
  titulo: string;
  descripcion: string;
  requeridoAnual: boolean;
  color: string;
}[] = [
  {
    id: 'cv',
    titulo: 'Curriculum Vitae (CV)',
    descripcion: 'Hoja de vida profesional y voluntaria actualizada',
    requeridoAnual: false,
    color: 'blue'
  },
  {
    id: 'antecedentes_penales',
    titulo: 'Constancia de Antecedentes Penales',
    descripcion: 'Certificación oficial emitida por Dirección General de Centros Penales',
    requeridoAnual: true,
    color: 'emerald'
  },
  {
    id: 'antecedentes_policiales',
    titulo: 'Solvencia de la Policía Nacional Civil (PNC)',
    descripcion: 'Solvencia policial vigente sin registros desfavorables',
    requeridoAnual: true,
    color: 'indigo'
  },
  {
    id: 'solvencia_municipal',
    titulo: 'Solvencia Municipal u Otros Documentos',
    descripcion: 'Constancias municipales, permisos o atestados complementarios',
    requeridoAnual: false,
    color: 'amber'
  }
];
