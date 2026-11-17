-- ==============================================================================
-- 39_soporte_sistema_y_permisos.sql
-- Módulo de Soporte Técnico y Reporte de Anomalías + Permisos de Historial/Cierre
-- Cruz Verde Salvadoreña - Sistema Administrativo
-- ==============================================================================

-- 1. Tabla principal de tickets/solicitudes de soporte
CREATE TABLE IF NOT EXISTS public.soporte_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio TEXT UNIQUE,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario_nombre TEXT NOT NULL,
  usuario_email TEXT,
  seccional_id INTEGER REFERENCES public.seccionales(id) ON DELETE SET NULL,
  seccional_nombre TEXT,
  motivo TEXT NOT NULL,
  tipo_caso TEXT NOT NULL CHECK (
    tipo_caso IN (
      'Sistema',
      'Registro de elementos',
      'Información',
      'Cambio de seccional de elemento',
      'Otro'
    )
  ),
  descripcion TEXT NOT NULL,
  imagenes JSONB DEFAULT '[]'::jsonb,
  ruta_origen TEXT,
  estado TEXT NOT NULL DEFAULT 'Pendiente' CHECK (
    estado IN ('Pendiente', 'En revisión', 'Finalizado')
  ),
  nota_resolucion TEXT,
  atendido_por_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  atendido_por_nombre TEXT,
  fecha_finalizacion TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_soporte_tickets_usuario_id ON public.soporte_tickets(usuario_id);
CREATE INDEX IF NOT EXISTS idx_soporte_tickets_estado ON public.soporte_tickets(estado);
CREATE INDEX IF NOT EXISTS idx_soporte_tickets_tipo_caso ON public.soporte_tickets(tipo_caso);
CREATE INDEX IF NOT EXISTS idx_soporte_tickets_created_at ON public.soporte_tickets(created_at DESC);

-- 2. Habilitar Row Level Security (RLS)
ALTER TABLE public.soporte_tickets ENABLE ROW LEVEL SECURITY;

-- a) Lectura: cada usuario ve sus propias solicitudes; admin o usuarios con
--    permiso 'view_soporte_historial' / 'edit_soporte_estado' ven todo el historial.
DROP POLICY IF EXISTS "Lectura de soporte por usuario o historial autorizado" ON public.soporte_tickets;
CREATE POLICY "Lectura de soporte por usuario o historial autorizado"
  ON public.soporte_tickets
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = usuario_id
    OR LOWER(COALESCE(usuario_email, '')) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    OR (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com'
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      LEFT JOIN public.role_permissions rp ON rp.role = ur.role
      WHERE ur.id = auth.uid()
        AND (
          ur.role = 'admin'
          OR COALESCE((ur.custom_permissions->>'view_soporte_historial')::boolean, false) = true
          OR COALESCE((ur.custom_permissions->>'edit_soporte_estado')::boolean, false) = true
          OR COALESCE((rp.permissions->>'view_soporte_historial')::boolean, false) = true
          OR COALESCE((rp.permissions->>'edit_soporte_estado')::boolean, false) = true
        )
    )
  );

-- b) Inserción: cualquier usuario autenticado puede reportar anomalías o soporte
DROP POLICY IF EXISTS "Usuarios autenticados pueden crear tickets de soporte" ON public.soporte_tickets;
CREATE POLICY "Usuarios autenticados pueden crear tickets de soporte"
  ON public.soporte_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    usuario_id IS NULL
    OR usuario_id = auth.uid()
    OR (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com'
  );

-- c) Actualización: solo admin o usuarios autorizados en Accesos (edit_soporte_estado)
--    pueden cambiar el estado a En revisión / Finalizado y agregar notas de resolución.
DROP POLICY IF EXISTS "Autorizados pueden gestionar y finalizar soporte" ON public.soporte_tickets;
CREATE POLICY "Autorizados pueden gestionar y finalizar soporte"
  ON public.soporte_tickets
  FOR UPDATE
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
          OR COALESCE((ur.custom_permissions->>'edit_soporte_estado')::boolean, false) = true
          OR COALESCE((rp.permissions->>'edit_soporte_estado')::boolean, false) = true
        )
    )
  )
  WITH CHECK (true);

-- d) Eliminación: solo administradores
DROP POLICY IF EXISTS "Solo administradores pueden eliminar tickets de soporte" ON public.soporte_tickets;
CREATE POLICY "Solo administradores pueden eliminar tickets de soporte"
  ON public.soporte_tickets
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.id = auth.uid() AND ur.role = 'admin'
    )
  );

-- 3. Actualizar permisos predeterminados por rol en role_permissions
UPDATE public.role_permissions
SET permissions = COALESCE(permissions, '{}'::jsonb) || jsonb_build_object(
  'view_soporte', true,
  'view_soporte_historial', true,
  'edit_soporte_estado', true
)
WHERE role = 'admin';

UPDATE public.role_permissions
SET permissions = COALESCE(permissions, '{}'::jsonb) || jsonb_build_object(
  'view_soporte', true,
  'view_soporte_historial', false,
  'edit_soporte_estado', false
)
WHERE role IN ('socorrista', 'director', 'instructor', 'administrativo');

-- 4. Asegurar lectura/subida en Storage para capturas de pantalla en soporte
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('socorristas', 'socorristas', true, 52428800, NULL)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = NULL;

-- Recargar caché de esquema de PostgREST
NOTIFY pgrst, 'reload schema';
