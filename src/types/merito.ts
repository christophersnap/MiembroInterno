export interface SocorristaAsignadoMerito {
  socorrista_id: number;
  socorrista_nombre: string;
  socorrista_carnet: string;
  seccional_nombre?: string;
  fecha_asignacion: string;
  nota_distincion?: string;
}

export interface MeritoEnlace {
  id?: string;
  titulo: string;
  url: string;
}

export interface Merito {
  id?: number | string;
  titulo: string;
  categoria: 'Misión Humanitaria' | 'Condecoración al Valor' | 'Antigüedad y Constancia' | 'Distinción Especial' | 'Reconocimiento Institucional' | 'Otro';
  descripcion: string;
  institucion_otorgante: string;
  fecha_merito: string;
  socorristas_asignados: SocorristaAsignadoMerito[];
  enlaces?: MeritoEnlace[];
  created_at?: string;
  updated_at?: string;
}

export const CATEGORIAS_MERITO = [
  'Misión Humanitaria',
  'Condecoración al Valor',
  'Antigüedad y Constancia',
  'Distinción Especial',
  'Reconocimiento Institucional',
  'Otro'
] as const;
