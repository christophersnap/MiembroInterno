-- =========================================================================
-- MIGRACIÓN 18: REGISTRO DE USUARIOS, APROBACIÓN Y GESTIÓN DE ACCESOS
-- Cruz Verde Salvadoreña - Sistema Institucional
-- =========================================================================

-- 1. Agregar columnas de estado y control a public.user_roles
ALTER TABLE public.user_roles 
  ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true;

ALTER TABLE public.user_roles 
  ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'activo';

ALTER TABLE public.user_roles 
  ADD COLUMN IF NOT EXISTS nombre_completo TEXT;

ALTER TABLE public.user_roles 
  ADD COLUMN IF NOT EXISTS telefono TEXT;

ALTER TABLE public.user_roles 
  ADD COLUMN IF NOT EXISTS seccional_id INTEGER REFERENCES public.seccionales(id) ON DELETE SET NULL;

-- 2. Asegurar que los roles permitan 'pendiente' e 'inactivo'
ALTER TABLE public.user_roles 
  DROP CONSTRAINT IF EXISTS user_roles_role_check;

-- 3. Crear tabla para registrar las solicitudes de nueva cuenta
CREATE TABLE IF NOT EXISTS public.solicitudes_registro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_completo TEXT NOT NULL,
  email TEXT NOT NULL,
  telefono TEXT,
  seccional_id INTEGER REFERENCES public.seccionales(id) ON DELETE SET NULL,
  carnet TEXT,
  tipo_usuario TEXT DEFAULT 'socorrista',
  motivo TEXT,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
  revisado_por UUID,
  fecha_solicitud TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  fecha_revision TIMESTAMP WITH TIME ZONE,
  notas_admin TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS en solicitudes_registro
ALTER TABLE public.solicitudes_registro ENABLE ROW LEVEL SECURITY;

-- Cualquier persona puede enviar una solicitud de registro
DROP POLICY IF EXISTS "Permitir crear solicitud de registro a cualquiera" ON public.solicitudes_registro;
CREATE POLICY "Permitir crear solicitud de registro a cualquiera"
  ON public.solicitudes_registro
  FOR INSERT
  WITH CHECK (true);

-- Solo administradores pueden ver y gestionar solicitudes de registro
DROP POLICY IF EXISTS "Admins pueden ver todas las solicitudes de registro" ON public.solicitudes_registro;
CREATE POLICY "Admins pueden ver todas las solicitudes de registro"
  ON public.solicitudes_registro
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE id = auth.uid() AND role = 'admin'
    ) OR (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com'
  );

DROP POLICY IF EXISTS "Admins pueden actualizar solicitudes de registro" ON public.solicitudes_registro;
CREATE POLICY "Admins pueden actualizar solicitudes de registro"
  ON public.solicitudes_registro
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE id = auth.uid() AND role = 'admin'
    ) OR (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com'
  );

-- 4. Funciones de ayuda para administración de estados y contraseñas

-- Función para cambiar estado activo/inactivo de un usuario
CREATE OR REPLACE FUNCTION public.set_user_active_status(target_user_id UUID, is_active BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_roles
  SET activo = is_active,
      estado = CASE WHEN is_active THEN 'activo' ELSE 'inactivo' END,
      role = CASE WHEN NOT is_active AND role != 'admin' THEN 'inactivo' ELSE role END
  WHERE id = target_user_id;
END;
$$;

-- Función para que el admin fuerce reseteo de contraseña de usuario
CREATE OR REPLACE FUNCTION public.admin_set_password_reset_required(target_user_id UUID, is_required BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_roles
  SET requires_password_reset = is_required
  WHERE id = target_user_id;
END;
$$;

-- 5. Insertar claves de configuración de correos si no existen
INSERT INTO public.configuracion (clave, valor)
VALUES 
  ('email_remitente_nombre', 'Cruz Verde Salvadoreña - Sistema Interno'),
  ('email_remitente_correo', 'notificaciones@cruzverde.org.sv'),
  ('email_aprobacion_asunto', '¡Tu cuenta ha sido aprobada! - Cruz Verde Salvadoreña'),
  ('email_aprobacion_mensaje', 'Tu solicitud de acceso al sistema institucional ha sido aprobada exitosamente por la administración.')
ON CONFLICT (clave) DO NOTHING;
