export type FormFieldType = 
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'telefono'
  | 'telefono_internacional'
  | 'dui'
  | 'carnet'
  | 'seccional'
  | 'rango'
  | 'curso'
  | 'tipo_sangre'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'date'
  | 'terminos'
  | 'nombre'
  | 'apellido';

export interface FormField {
  id: string;
  tipo: FormFieldType | string;
  label: string;
  placeholder?: string;
  required?: boolean;
  help?: string;
  options?: string[];
  width?: string;
}

export interface Formulario {
  id: number;
  slug: string;
  titulo: string;
  descripcion?: string;
  categoria?: string;
  requiere_autenticacion?: boolean;
  activo?: boolean;
  campos: FormField[];
  creado_por?: string | null;
  creado_por_nombre?: string;
  mensaje_exito?: string;
  created_at?: string;
  updated_at?: string;
  respuestas_count?: number;
}

export interface FormularioRespuesta {
  id: number;
  formulario_id: number;
  usuario_id?: string | null;
  usuario_nombre?: string | null;
  usuario_email?: string | null;
  respuestas: Record<string, any>;
  ip_origen?: string;
  created_at?: string;
}
