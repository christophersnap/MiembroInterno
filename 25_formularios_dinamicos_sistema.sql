-- =========================================================================
-- MIGRACIÓN 25: MÓDULO DE FORMULARIOS DINÁMICOS Y CONTROL DE ACCESO
-- Cruz Verde Salvadoreña - Sistema Integrado
-- =========================================================================

-- 1. Tabla de Formularios Dinámicos
CREATE TABLE IF NOT EXISTS public.formularios (
    id BIGSERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    categoria TEXT DEFAULT 'General',
    requiere_autenticacion BOOLEAN DEFAULT false,
    activo BOOLEAN DEFAULT true,
    campos JSONB NOT NULL DEFAULT '[]'::jsonb,
    creado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    creado_por_nombre TEXT DEFAULT 'Cruz Verde Salvadoreña',
    mensaje_exito TEXT DEFAULT '¡Muchas gracias! Tu respuesta ha sido registrada exitosamente en el sistema.',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_formularios_slug ON public.formularios(slug);
CREATE INDEX IF NOT EXISTS idx_formularios_activo ON public.formularios(activo);
CREATE INDEX IF NOT EXISTS idx_formularios_categoria ON public.formularios(categoria);

-- 3. Tabla de Respuestas a Formularios
CREATE TABLE IF NOT EXISTS public.formulario_respuestas (
    id BIGSERIAL PRIMARY KEY,
    formulario_id BIGINT NOT NULL REFERENCES public.formularios(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    usuario_nombre TEXT,
    usuario_email TEXT,
    respuestas JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_origen TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Índices de Respuestas
CREATE INDEX IF NOT EXISTS idx_formulario_respuestas_form_id ON public.formulario_respuestas(formulario_id);
CREATE INDEX IF NOT EXISTS idx_formulario_respuestas_created_at ON public.formulario_respuestas(created_at DESC);

-- 4. Habilitar Seguridad por Nivel de Fila (RLS)
ALTER TABLE public.formularios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formulario_respuestas ENABLE ROW LEVEL SECURITY;

-- 5. Políticas para Formularios
-- Lectura: Público si activo o si usuario autenticado
DROP POLICY IF EXISTS "Permitir lectura de formularios" ON public.formularios;
CREATE POLICY "Permitir lectura de formularios" 
    ON public.formularios FOR SELECT 
    USING (activo = true OR auth.role() = 'authenticated');

-- Gestión (Crear, Editar, Borrar): Administradores y Personal Autorizado
DROP POLICY IF EXISTS "Permitir gestion de formularios" ON public.formularios;
CREATE POLICY "Permitir gestion de formularios" 
    ON public.formularios FOR ALL 
    USING (auth.role() = 'authenticated') 
    WITH CHECK (auth.role() = 'authenticated');

-- 6. Políticas para Respuestas
-- Inserción: Cualquiera puede responder si el formulario es público; o autenticado si lo requiere
DROP POLICY IF EXISTS "Permitir envio de respuestas" ON public.formulario_respuestas;
CREATE POLICY "Permitir envio de respuestas" 
    ON public.formulario_respuestas FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.formularios f 
            WHERE f.id = formulario_id 
              AND f.activo = true 
              AND (f.requiere_autenticacion = false OR auth.role() = 'authenticated')
        )
    );

-- Lectura de Respuestas: Solo usuarios autenticados del sistema
DROP POLICY IF EXISTS "Permitir ver respuestas a personal autenticado" ON public.formulario_respuestas;
CREATE POLICY "Permitir ver respuestas a personal autenticado" 
    ON public.formulario_respuestas FOR SELECT 
    USING (auth.role() = 'authenticated');

-- Eliminación de Respuestas: Personal autenticado
DROP POLICY IF EXISTS "Permitir borrar respuestas a personal autenticado" ON public.formulario_respuestas;
CREATE POLICY "Permitir borrar respuestas a personal autenticado" 
    ON public.formulario_respuestas FOR DELETE 
    USING (auth.role() = 'authenticated');

-- 7. Insertar Formulario de Ejemplo Inicial (Inscripción a Cursos y Talleres)
INSERT INTO public.formularios (
    slug, 
    titulo, 
    descripcion, 
    categoria, 
    requiere_autenticacion, 
    activo, 
    mensaje_exito, 
    campos
) VALUES (
    'inscripcion-curso-primeros-auxilios',
    'Inscripción Oficial - Curso de Primeros Auxilios y Soporte Vital Básico',
    'Formulario oficial de inscripción para socorristas y voluntarios de Cruz Verde Salvadoreña. Por favor complete todos los datos requeridos para validar su participación.',
    'Cursos y Capacitaciones',
    false,
    true,
    '¡Inscripción registrada con éxito! La Coordinación de Capacitaciones de Cruz Verde Salvadoreña se comunicará vía WhatsApp o correo electrónico para confirmar su sede y horario.',
    '[
        {"id":"carnet","tipo":"carnet","label":"Número de Carnet Institucional","placeholder":"Ej: CV-1024","required":false,"help":"Si ya eres elemento activo de Cruz Verde, ingresa tu número"},
        {"id":"nombre","tipo":"nombre","label":"Nombres","placeholder":"Ingresa tus nombres","required":true},
        {"id":"apellido","tipo":"apellido","label":"Apellidos","placeholder":"Ingresa tus apellidos","required":true},
        {"id":"seccional","tipo":"seccional","label":"Seccional de Pertenencia / Más cercana","required":true},
        {"id":"correo","tipo":"email","label":"Correo Electrónico de Contacto","placeholder":"ejemplo@correo.com","required":true},
        {"id":"telefono","tipo":"telefono_internacional","label":"Teléfono Móvil (WhatsApp)","placeholder":"7000-0000","required":true,"help":"Selecciona el código de país para el formato automático"},
        {"id":"tipo_sangre","tipo":"tipo_sangre","label":"Tipo de Sangre","required":false},
        {"id":"experiencia","tipo":"textarea","label":"Experiencia Previa o Motivación","placeholder":"Describe brevemente tu interés o capacitaciones anteriores...","required":false}
    ]'::jsonb
) ON CONFLICT (slug) DO NOTHING;

SELECT 'Migración 25: Módulo de Formularios Dinámicos ejecutado exitosamente.' as resultado;
