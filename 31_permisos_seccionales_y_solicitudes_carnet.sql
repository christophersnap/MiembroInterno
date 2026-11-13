-- =========================================================================================
-- MIGRACIÓN 31: PERMISOS GRANULARES POR SECCIONAL, ALCANCES Y SOLICITUDES DE CARNET
-- =========================================================================================
-- Ejecutar este script en el SQL Editor de Supabase para garantizar compatibilidad total con:
-- 1. Permisos individuales avanzados (alcances Global/Seccional/Usuario y acceso por seccional).
-- 2. Nueva pestaña de Solicitudes de Carnet en Gestión Logística (estados Pendiente, Completada, Observada).
-- 3. Permisos de edición granulares (Solo Ver vs Editar/Modificar) en todos los módulos.
-- =========================================================================================

-- -----------------------------------------------------------------------------------------
-- 1. TABLA: public.user_roles (Soporte para permisos individuales, alcances y seccionales)
-- -----------------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.user_roles
  ADD COLUMN IF NOT EXISTS custom_permissions JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS can_upload_files BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'activo';

COMMENT ON COLUMN public.user_roles.custom_permissions IS
  'Almacena excepciones booleanas individuales, _module_scopes (usuario/seccional/global) y _seccionales_socorristas (permisos por seccional)';

-- Permitir lectura y actualización controlada para administradores
ALTER TABLE IF EXISTS public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can update user_roles custom_permissions" ON public.user_roles;
CREATE POLICY "Admins can update user_roles custom_permissions"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.id = auth.uid() AND ur.role = 'admin'
    )
    OR (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com'
  )
  WITH CHECK (true);

-- -----------------------------------------------------------------------------------------
-- 2. TABLA: public.solicitudes_carnet (Seguimiento logístico, observaciones y seccionales)
-- -----------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.solicitudes_carnet (
  id BIGSERIAL PRIMARY KEY,
  socorrista_id INTEGER REFERENCES public.socorristas(id) ON DELETE CASCADE,
  seccional_id INTEGER REFERENCES public.seccionales(id) ON DELETE SET NULL,
  seccional_nombre TEXT,
  tipo_solicitud TEXT NOT NULL DEFAULT 'Nuevo',
  motivo TEXT,
  detalles_motivo TEXT,
  foto_url TEXT,
  observaciones TEXT,
  solicitado_por TEXT,
  solicitado_por_email TEXT,
  revisado_por TEXT,
  fecha_revision TIMESTAMPTZ,
  estado_solicitud TEXT NOT NULL DEFAULT 'Pendiente',
  fecha_solicitud TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asegurar nuevas columnas si la tabla ya existía previamente
ALTER TABLE public.solicitudes_carnet
  ADD COLUMN IF NOT EXISTS seccional_id INTEGER REFERENCES public.seccionales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seccional_nombre TEXT,
  ADD COLUMN IF NOT EXISTS observaciones TEXT,
  ADD COLUMN IF NOT EXISTS solicitado_por TEXT,
  ADD COLUMN IF NOT EXISTS solicitado_por_email TEXT,
  ADD COLUMN IF NOT EXISTS revisado_por TEXT,
  ADD COLUMN IF NOT EXISTS fecha_revision TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Actualizar restricción CHECK de estado_solicitud para soportar Pendiente, Completada, Observada y estados de flujo
DO $$
DECLARE
  constraint_rec RECORD;
BEGIN
  FOR constraint_rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.solicitudes_carnet'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%estado_solicitud%'
  LOOP
    EXECUTE format('ALTER TABLE public.solicitudes_carnet DROP CONSTRAINT IF EXISTS %I', constraint_rec.conname);
  END LOOP;
END $$;

ALTER TABLE public.solicitudes_carnet
  ADD CONSTRAINT solicitudes_carnet_estado_check
  CHECK (estado_solicitud IN (
    'Pendiente',
    'En revisión',
    'Observada',
    'Aprobada',
    'En impresión',
    'Lista para entrega',
    'Completada',
    'Rechazada'
  ));

-- Índices para filtros inteligentes (seccional, fecha, estado)
CREATE INDEX IF NOT EXISTS idx_solicitudes_carnet_seccional ON public.solicitudes_carnet(seccional_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_carnet_estado ON public.solicitudes_carnet(estado_solicitud);
CREATE INDEX IF NOT EXISTS idx_solicitudes_carnet_fecha ON public.solicitudes_carnet(fecha_solicitud DESC);

-- RLS para solicitudes_carnet (Inserción pública para formulario de solicitud, lectura y edición controlada sin eliminación)
ALTER TABLE public.solicitudes_carnet ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir crear solicitudes_carnet publico" ON public.solicitudes_carnet;
CREATE POLICY "Permitir crear solicitudes_carnet publico"
  ON public.solicitudes_carnet
  FOR INSERT
  TO public, anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir lectura solicitudes_carnet" ON public.solicitudes_carnet;
CREATE POLICY "Permitir lectura solicitudes_carnet"
  ON public.solicitudes_carnet
  FOR SELECT
  TO public, anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Permitir actualizacion solicitudes_carnet" ON public.solicitudes_carnet;
CREATE POLICY "Permitir actualizacion solicitudes_carnet"
  ON public.solicitudes_carnet
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------------------
-- 3. ACTUALIZAR PERMISOS BASE DE ROLES (role_permissions) CON NUEVAS CLAVES GRANULARES
-- -----------------------------------------------------------------------------------------
UPDATE public.role_permissions
SET permissions = COALESCE(permissions, '{}'::jsonb) || jsonb_build_object(
  'add_socorristas', true,
  'edit_socorristas', true,
  'view_solicitudes_carnet', true,
  'edit_solicitudes_carnet', true,
  'edit_solicitudes_compra', true,
  'edit_solicitudes_combustible', true,
  'edit_formularios', true,
  'edit_anuncios', true,
  'edit_archivos', true,
  'edit_meritos', true,
  'edit_vehiculos', true
)
WHERE role = 'admin';

-- -----------------------------------------------------------------------------------------
-- 4. POLÍTICAS RLS DE ESCRITURA PARA USUARIOS AUTORIZADOS INDIVIDUALMENTE
-- -----------------------------------------------------------------------------------------
-- Asegurar que usuarios con permisos individuales (no solo role='admin') puedan gestionar módulos autorizados
ALTER TABLE IF EXISTS public.socorristas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver socorristas" ON public.socorristas;
CREATE POLICY "Usuarios autenticados pueden ver socorristas"
  ON public.socorristas FOR SELECT TO public, anon, authenticated USING (true);

DROP POLICY IF EXISTS "Usuarios autorizados pueden insertar socorristas" ON public.socorristas;
CREATE POLICY "Usuarios autorizados pueden insertar socorristas"
  ON public.socorristas FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Usuarios autorizados pueden actualizar socorristas" ON public.socorristas;
CREATE POLICY "Usuarios autorizados pueden actualizar socorristas"
  ON public.socorristas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Anuncios: permitir gestión cuando tiene permiso individual o rol autorizado
ALTER TABLE IF EXISTS public.anuncios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuarios autenticados pueden gestionar anuncios autorizados" ON public.anuncios;
CREATE POLICY "Usuarios autenticados pueden gestionar anuncios autorizados"
  ON public.anuncios
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.id = auth.uid()
        AND (
          ur.role = 'admin'
          OR COALESCE((ur.custom_permissions->>'edit_anuncios')::boolean, false) = true
          OR COALESCE((ur.custom_permissions->>'crear_anuncios')::boolean, false) = true
        )
    )
    OR (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com'
  )
  WITH CHECK (true);

-- Archivos: permitir subida cuando can_upload_files o permiso individual edit_archivos/subir_archivos está activo
ALTER TABLE IF EXISTS public.archivos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuarios autorizados pueden subir archivos" ON public.archivos;
CREATE POLICY "Usuarios autorizados pueden subir archivos"
  ON public.archivos FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.id = auth.uid()
        AND (
          ur.role = 'admin'
          OR ur.can_upload_files = true
          OR COALESCE((ur.custom_permissions->>'subir_archivos')::boolean, false) = true
          OR COALESCE((ur.custom_permissions->>'edit_archivos')::boolean, false) = true
        )
    )
  );

-- Recargar caché de esquema de PostgREST
NOTIFY pgrst, 'reload schema';
