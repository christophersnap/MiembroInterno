-- =========================================================================================
-- MIGRACIÓN 32: MÓDULO DE NOTICIAS, BANNER SLIDE DEL DASHBOARD Y LANDING PAGES
-- =========================================================================================
-- Ejecutar este script en el SQL Editor de Supabase para habilitar:
-- 1. Tabla public.noticias_banner (slides con imagen destacada, editor HTML rico y videos).
-- 2. Configuración global del banner en public.configuracion (activo/inactivo, intervalo).
-- 3. Permisos de acceso para la pestaña de Ajustes de Noticias (view_noticias_ajustes / edit_noticias_banner).
-- =========================================================================================

-- -----------------------------------------------------------------------------------------
-- 1. TABLA: public.noticias_banner
-- -----------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.noticias_banner (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  subtitulo TEXT,
  categoria TEXT DEFAULT 'Noticia',
  imagen_url TEXT NOT NULL,
  contenido_html TEXT DEFAULT '',
  videos JSONB DEFAULT '[]'::jsonb,
  accion_click TEXT DEFAULT 'landing' CHECK (accion_click IN ('landing', 'url')),
  enlace_redireccion TEXT,
  enlace_texto TEXT DEFAULT 'Más información',
  activo BOOLEAN DEFAULT true,
  orden INTEGER DEFAULT 0,
  autor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  autor_nombre TEXT DEFAULT 'Cruz Verde Salvadoreña',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para ordenar y filtrar rápidamente en el Dashboard
CREATE INDEX IF NOT EXISTS idx_noticias_banner_activo ON public.noticias_banner(activo);
CREATE INDEX IF NOT EXISTS idx_noticias_banner_orden ON public.noticias_banner(orden ASC, created_at DESC);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.noticias_banner ENABLE ROW LEVEL SECURITY;

-- Lectura: Todos los usuarios autenticados ven los slides activos;
-- Administradores y usuarios autorizados para Noticias ven todos (activos e inactivos).
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver noticias activas" ON public.noticias_banner;
CREATE POLICY "Usuarios autenticados pueden ver noticias activas"
  ON public.noticias_banner
  FOR SELECT
  TO authenticated
  USING (
    activo = true
    OR (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com'
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      LEFT JOIN public.role_permissions rp ON rp.role = ur.role
      WHERE ur.id = auth.uid()
        AND (
          ur.role = 'admin'
          OR COALESCE((ur.custom_permissions->>'view_noticias_ajustes')::boolean, false) = true
          OR COALESCE((ur.custom_permissions->>'edit_noticias_banner')::boolean, false) = true
          OR COALESCE((rp.permissions->>'view_noticias_ajustes')::boolean, false) = true
          OR COALESCE((rp.permissions->>'edit_noticias_banner')::boolean, false) = true
        )
    )
  );

-- Creación / Edición / Eliminación: Admin o usuarios con permiso individual/rol de Noticias
DROP POLICY IF EXISTS "Autorizados pueden administrar noticias_banner" ON public.noticias_banner;
CREATE POLICY "Autorizados pueden administrar noticias_banner"
  ON public.noticias_banner
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com'
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      LEFT JOIN public.role_permissions rp ON rp.role = ur.role
      WHERE ur.id = auth.uid()
        AND (
          ur.role = 'admin'
          OR COALESCE((ur.custom_permissions->>'view_noticias_ajustes')::boolean, false) = true
          OR COALESCE((ur.custom_permissions->>'edit_noticias_banner')::boolean, false) = true
          OR COALESCE((rp.permissions->>'view_noticias_ajustes')::boolean, false) = true
          OR COALESCE((rp.permissions->>'edit_noticias_banner')::boolean, false) = true
        )
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com'
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      LEFT JOIN public.role_permissions rp ON rp.role = ur.role
      WHERE ur.id = auth.uid()
        AND (
          ur.role = 'admin'
          OR COALESCE((ur.custom_permissions->>'view_noticias_ajustes')::boolean, false) = true
          OR COALESCE((ur.custom_permissions->>'edit_noticias_banner')::boolean, false) = true
          OR COALESCE((rp.permissions->>'view_noticias_ajustes')::boolean, false) = true
          OR COALESCE((rp.permissions->>'edit_noticias_banner')::boolean, false) = true
        )
    )
  );

-- -----------------------------------------------------------------------------------------
-- 2. CONFIGURACIÓN DEL BANNER SLIDE EN public.configuracion
-- -----------------------------------------------------------------------------------------
INSERT INTO public.configuracion (clave, valor, descripcion)
SELECT 'noticias_banner_activo', 'true', 'Activa o desactiva el Banner Slide de Noticias en el Dashboard'
WHERE NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'noticias_banner_activo');

INSERT INTO public.configuracion (clave, valor, descripcion)
SELECT 'noticias_banner_intervalo', '6', 'Tiempo en segundos entre transiciones automáticas del Banner Slide'
WHERE NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'noticias_banner_intervalo');

INSERT INTO public.configuracion (clave, valor, descripcion)
SELECT 'noticias_banner_autoplay', 'true', 'Reproducción automática del carrusel de noticias en el Dashboard'
WHERE NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'noticias_banner_autoplay');

-- -----------------------------------------------------------------------------------------
-- 3. ACTUALIZAR PERMISOS EN public.role_permissions
-- -----------------------------------------------------------------------------------------
UPDATE public.role_permissions
SET permissions = COALESCE(permissions, '{}'::jsonb) || jsonb_build_object(
  'view_noticias_ajustes', true,
  'edit_noticias_banner', true
)
WHERE role = 'admin';

UPDATE public.role_permissions
SET permissions = jsonb_build_object(
  'view_noticias_ajustes', false,
  'edit_noticias_banner', false
) || COALESCE(permissions, '{}'::jsonb)
WHERE role IN ('socorrista', 'director', 'instructor', 'administrativo');

-- Recargar caché de esquema de PostgREST
NOTIFY pgrst, 'reload schema';
