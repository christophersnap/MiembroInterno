-- ==============================================================================
-- 21_archivos_y_anuncios_sistema.sql
-- Módulo de Archivos Descargables Institucionales y Sistema de Anuncios / Noticias
-- Cruz Verde Salvadoreña - Sistema Administrativo
-- ==============================================================================

-- ==============================================================================
-- 1. TABLA: ARCHIVOS DESCARGABLES INSTITUCIONALES (public.archivos)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.archivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descripcion TEXT,
  categoria TEXT DEFAULT 'General',
  nombre_archivo TEXT NOT NULL,
  url_archivo TEXT NOT NULL,
  tipo_archivo TEXT,                     -- Tipo MIME (ej: application/pdf, image/jpeg)
  extension TEXT,                        -- Extensión en minúsculas (ej: pdf, docx, xlsx, zip)
  tamano_bytes BIGINT DEFAULT 0,
  tamano_legible TEXT,                   -- Formato legible (ej: 2.4 MB, 850 KB)
  subido_por_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subido_por_nombre TEXT,
  seccional_id INTEGER REFERENCES public.seccionales(id) ON DELETE SET NULL,
  descargas_count INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  enlace_externo TEXT,                   -- Enlace alternativo opcional (ej: Google Drive, OneDrive)
  tags TEXT[],                           -- Etiquetas de búsqueda
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para optimizar búsquedas y filtrados
CREATE INDEX IF NOT EXISTS idx_archivos_categoria ON public.archivos(categoria);
CREATE INDEX IF NOT EXISTS idx_archivos_activo ON public.archivos(activo);
CREATE INDEX IF NOT EXISTS idx_archivos_created_at ON public.archivos(created_at DESC);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.archivos ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad para Archivos:
-- a) Cualquier usuario autenticado puede ver y descargar los archivos activos
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver archivos activos" ON public.archivos;
CREATE POLICY "Usuarios autenticados pueden ver archivos activos"
  ON public.archivos
  FOR SELECT
  TO authenticated
  USING (activo = true OR auth.uid() = subido_por_id OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role = 'admin'
  ));

-- b) Inserción: Administradores y usuarios con permiso o creadores
DROP POLICY IF EXISTS "Usuarios autorizados pueden subir archivos" ON public.archivos;
CREATE POLICY "Usuarios autorizados pueden subir archivos"
  ON public.archivos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.id = auth.uid() AND (ur.role = 'admin' OR ur.can_upload_files = true)
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role = ur.role
      WHERE ur.id = auth.uid() AND (rp.permissions->>'subir_archivos')::boolean = true
    )
  );

-- c) Modificación: Quien subió el archivo o administradores
DROP POLICY IF EXISTS "Admin y autor pueden modificar archivos" ON public.archivos;
CREATE POLICY "Admin y autor pueden modificar archivos"
  ON public.archivos
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = subido_por_id OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role = 'admin')
  );

-- d) Eliminación: Solo administradores o quien lo subió
DROP POLICY IF EXISTS "Admin y autor pueden eliminar archivos" ON public.archivos;
CREATE POLICY "Admin y autor pueden eliminar archivos"
  ON public.archivos
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = subido_por_id OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role = 'admin')
  );


-- ==============================================================================
-- 2. TABLA: ANUNCIOS Y NOTICIAS INSTITUCIONALES (public.anuncios)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.anuncios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  contenido TEXT NOT NULL,
  tipo TEXT DEFAULT 'info' CHECK (tipo IN ('info', 'alerta', 'urgente', 'exito', 'evento')),
  prioridad INTEGER DEFAULT 1,
  mostrar_cuadro_dashboard BOOLEAN DEFAULT true,   -- Cuadro/banner superior en Dashboard
  mostrar_ticker_dashboard BOOLEAN DEFAULT true,   -- Línea deslizante / slider de noticias
  activo BOOLEAN DEFAULT true,                     -- Estado de activación general
  fecha_expiracion TIMESTAMPTZ,                   -- Si vence, deja de mostrarse en Dashboard
  enlace_url TEXT,                                 -- Redirección interna o enlace externo
  enlace_texto TEXT DEFAULT 'Más información',
  imagen_url TEXT,                                 -- Imagen o banner visual destacado (Recomendado 1200x630px)
  archivo_nombre TEXT,                             -- Documento descargable adjunto (opcional)
  archivo_url TEXT,
  archivo_tamano TEXT,
  autor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  autor_nombre TEXT,
  vistas_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Migración idónea si la tabla ya existía previamente en Supabase
ALTER TABLE public.anuncios ADD COLUMN IF NOT EXISTS imagen_url TEXT;

-- Índices para consultas del Dashboard
CREATE INDEX IF NOT EXISTS idx_anuncios_activo ON public.anuncios(activo);
CREATE INDEX IF NOT EXISTS idx_anuncios_fecha_expiracion ON public.anuncios(fecha_expiracion);
CREATE INDEX IF NOT EXISTS idx_anuncios_created_at ON public.anuncios(created_at DESC);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.anuncios ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad para Anuncios:
-- a) Todos los usuarios autenticados pueden ver los anuncios vigentes (para mostrarlos en Dashboard)
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver anuncios" ON public.anuncios;
CREATE POLICY "Usuarios autenticados pueden ver anuncios"
  ON public.anuncios
  FOR SELECT
  TO authenticated
  USING (
    activo = true OR 
    EXISTS (SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role = 'admin')
  );

-- b) Solo administradores o roles con permiso 'view_anuncios' pueden insertar, modificar o eliminar
DROP POLICY IF EXISTS "Solo administradores pueden crear anuncios" ON public.anuncios;
CREATE POLICY "Solo administradores pueden crear anuncios"
  ON public.anuncios
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role = 'admin')
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role = ur.role
      WHERE ur.id = auth.uid() AND (rp.permissions->>'view_anuncios')::boolean = true
    )
  );

DROP POLICY IF EXISTS "Solo administradores pueden modificar anuncios" ON public.anuncios;
CREATE POLICY "Solo administradores pueden modificar anuncios"
  ON public.anuncios
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role = 'admin')
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role = ur.role
      WHERE ur.id = auth.uid() AND (rp.permissions->>'view_anuncios')::boolean = true
    )
  );

DROP POLICY IF EXISTS "Solo administradores pueden eliminar anuncios" ON public.anuncios;
CREATE POLICY "Solo administradores pueden eliminar anuncios"
  ON public.anuncios
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role = 'admin')
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role = ur.role
      WHERE ur.id = auth.uid() AND (rp.permissions->>'view_anuncios')::boolean = true
    )
  );


-- ==============================================================================
-- 3. CAMPO PARA PERMITIR SUBIDA DE ARCHIVOS A USUARIOS INDIVIDUALES EN user_roles
-- ==============================================================================
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS can_upload_files BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.user_roles.can_upload_files IS 'Permite que un usuario específico pueda subir y gestionar archivos institucionales independientemente de su rol';


-- ==============================================================================
-- 4. ACTUALIZACIÓN DE PERMISOS POR ROL EN role_permissions
-- ==============================================================================
-- Asegurar que el rol 'admin' tenga acceso a todo:
UPDATE public.role_permissions
SET permissions = jsonb_set(
  jsonb_set(
    jsonb_set(
      COALESCE(permissions, '{}'::jsonb),
      '{view_archivos}', 'true'::jsonb, true
    ),
    '{subir_archivos}', 'true'::jsonb, true
  ),
  '{view_anuncios}', 'true'::jsonb, true
)
WHERE role = 'admin';

-- Para los roles no administradores:
-- view_archivos = true (pueden ver y descargar)
-- subir_archivos = false (solo si el admin se lo habilita explícitamente)
-- view_anuncios = false (pestaña en menú oculta para los demás usuarios por defecto)
UPDATE public.role_permissions
SET permissions = jsonb_set(
  jsonb_set(
    jsonb_set(
      COALESCE(permissions, '{}'::jsonb),
      '{view_archivos}', 'true'::jsonb, true
    ),
    '{subir_archivos}', 'false'::jsonb, true
  ),
  '{view_anuncios}', 'false'::jsonb, true
)
WHERE role IN ('socorrista', 'director', 'instructor', 'administrativo');


-- ==============================================================================
-- 5. FUNCIÓN RPC PARA INCREMENTAR CONTADOR DE DESCARGAS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.increment_descarga_archivo(archivo_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.archivos
  SET descargas_count = COALESCE(descargas_count, 0) + 1,
      updated_at = timezone('utc'::text, now())
  WHERE id = archivo_id;
END;
$$;


-- ==============================================================================
-- 6. DATOS SEMILLA INICIALES (ARCHIVOS Y ANUNCIOS INSTITUCIONALES)
-- ==============================================================================

-- Inserción de archivos de ejemplo institucionales
INSERT INTO public.archivos (titulo, descripcion, categoria, nombre_archivo, url_archivo, tipo_archivo, extension, tamano_legible, subido_por_nombre, activo)
SELECT 
  'Manual de Primeros Auxilios Básicos y Avanzados 2026',
  'Guía oficial y protocolos estandarizados de atención prehospitalaria de Cruz Verde Salvadoreña.',
  'Manuales y Protocolos',
  'Manual_Primeros_Auxilios_CVS_2026.pdf',
  'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1200&auto=format&fit=crop&q=80',
  'application/pdf',
  'pdf',
  '4.2 MB',
  'Administración Nacional',
  true
WHERE NOT EXISTS (SELECT 1 FROM public.archivos WHERE titulo = 'Manual de Primeros Auxilios Básicos y Avanzados 2026');

INSERT INTO public.archivos (titulo, descripcion, categoria, nombre_archivo, url_archivo, tipo_archivo, extension, tamano_legible, subido_por_nombre, activo)
SELECT 
  'Formato Oficial de Hoja de Servicio y Turnos de Ambulancia',
  'Plantilla descargable para registro de emergencias, traslados, kilometraje y firmas de tripulación.',
  'Formatos y Formularios',
  'Formato_Hoja_Servicio_Ambulancia_CVS.xlsx',
  'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=1200&auto=format&fit=crop&q=80',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'xlsx',
  '245 KB',
  'Jefatura de Operaciones',
  true
WHERE NOT EXISTS (SELECT 1 FROM public.archivos WHERE titulo = 'Formato Oficial de Hoja de Servicio y Turnos de Ambulancia');

INSERT INTO public.archivos (titulo, descripcion, categoria, nombre_archivo, url_archivo, tipo_archivo, extension, tamano_legible, subido_por_nombre, activo)
SELECT 
  'Reglamento Interno y Código de Ética Institucional',
  'Normativa que rige los deberes, derechos, uniformidad y disciplina del personal voluntario y remunerado.',
  'Leyes y Normativas',
  'Reglamento_Interno_Codigo_Etica_CVS.pdf',
  'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=1200&auto=format&fit=crop&q=80',
  'application/pdf',
  'pdf',
  '1.8 MB',
  'Dirección Jurídica',
  true
WHERE NOT EXISTS (SELECT 1 FROM public.archivos WHERE titulo = 'Reglamento Interno y Código de Ética Institucional');

-- Inserción de anuncios de bienvenida y alertas institucionales
INSERT INTO public.anuncios (titulo, contenido, tipo, prioridad, mostrar_cuadro_dashboard, mostrar_ticker_dashboard, activo, enlace_texto, enlace_url, autor_nombre)
SELECT 
  '¡Actualización de Protocolos y Sistema Institucional 2026!',
  'Se informa a todo el personal socorrista y voluntario que ya está habilitada la nueva sección de Archivos para descargar manuales, formatos de ambulancia y reglamentos oficiales. Favor consultar la pestaña Archivos en el menú lateral.',
  'info',
  1,
  true,
  true,
  true,
  'Ir a Archivos',
  '/archivos',
  'Comandancia General'
WHERE NOT EXISTS (SELECT 1 FROM public.anuncios WHERE titulo = '¡Actualización de Protocolos y Sistema Institucional 2026!');

INSERT INTO public.anuncios (titulo, contenido, tipo, prioridad, mostrar_cuadro_dashboard, mostrar_ticker_dashboard, activo, enlace_texto, enlace_url, autor_nombre)
SELECT 
  'Convocatoria: Taller de Reanimación Cardiopulmonar (RCP) y DEA',
  'Este sábado se llevará a cabo la jornada de certificación obligatoria para las tripulaciones de ambulancia de guardia. Inscripciones abiertas en la sección de Cursos.',
  'evento',
  2,
  false,
  true,
  true,
  'Ver Cursos',
  '/cursos',
  'Escuela de Capacitación'
WHERE NOT EXISTS (SELECT 1 FROM public.anuncios WHERE titulo = 'Convocatoria: Taller de Reanimación Cardiopulmonar (RCP) y DEA');
