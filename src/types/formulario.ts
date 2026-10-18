export type FormFieldType = 
  | 'text'
  | 'textarea'
  | 'carnet'
  | 'dui'
  | 'telefono'
  | 'email'
  | 'seccional'
  | 'rango'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'number'
  | 'date'
  | 'terminos';

export interface FormField {
  id: string;
  tipo: FormFieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  help?: string;
  width?: '50%' | '100%';
  options?: string[]; // Para select, radio, checkbox
  defaultValue?: any;
}

export interface Formulario {
  id: number;
  slug: string;
  titulo: string;
  descripcion?: string;
  categoria: string;
  requiere_autenticacion: boolean;
  activo: boolean;
  campos: FormField[];
  creado_por?: string;
  creado_por_nombre?: string;
  mensaje_exito?: string;
  created_at?: string;
  updated_at?: string;
  respuestas_count?: number;
}

export interface FormularioRespuesta {
  id: number;
  formulario_id: number;
  usuario_id?: string;
  usuario_nombre?: string;
  usuario_email?: string;
  respuestas: Record<string, any>;
  ip_origen?: string;
  created_at: string;
}
