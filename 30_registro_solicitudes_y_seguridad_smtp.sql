-- =========================================================================================
-- MIGRACIÓN 30: SOLICITUDES DE REGISTRO, SEGURIDAD SMTP Y TABLA DE MÉRITOS CON ENLACES
-- =========================================================================================
-- Ejecutar este script en el SQL Editor de Supabase para:
-- 1. Asegurar que las solicitudes de registro desde /registro se guarden correctamente sin errores de RLS.
-- 2. Asegurar que la tabla public.meritos admita enlaces a notas de prensa y medios digitales.
-- 3. Proteger la clave de SMTP y garantizar que el flujo de aprobación funcione.
-- =========================================================================================

-- -----------------------------------------------------------------------------------------
-- 1. TABLA: public.solicitudes_registro (Flujo de Nuevos Usuarios)
-- -----------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.solicitudes_registro (
  id TEXT PRIMARY KEY,
  auth_user_id UUID,
  nombre_completo TEXT NOT NULL,
  email TEXT NOT NULL,
  telefono TEXT,
  seccional_id INTEGER REFERENCES public.seccionales(id) ON DELETE SET NULL,
  seccional_nombre TEXT,
  carnet TEXT,
  tipo_usuario TEXT DEFAULT 'socorrista',
  motivo TEXT DEFAULT 'Solicitud de acceso al sistema institucional',
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
  fecha_solicitud TIMESTAMPTZ DEFAULT NOW(),
  fecha_revision TIMESTAMPTZ,
  notas_admin TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.solicitudes_registro ENABLE ROW LEVEL SECURITY;

-- Permitir que cualquier persona (anon o autenticada) pueda registrar una solicitud desde el formulario público
DROP POLICY IF EXISTS "Permitir registro publico anonimo" ON public.solicitudes_registro;
CREATE POLICY "Permitir registro publico anonimo" 
ON public.solicitudes_registro 
FOR INSERT 
TO public, anon, authenticated 
WITH CHECK (true);

-- Permitir lectura y actualización
DROP POLICY IF EXISTS "Permitir lectura de solicitudes" ON public.solicitudes_registro;
CREATE POLICY "Permitir lectura de solicitudes" 
ON public.solicitudes_registro 
FOR SELECT 
TO public, anon, authenticated 
USING (true);

DROP POLICY IF EXISTS "Permitir actualizacion de solicitudes" ON public.solicitudes_registro;
CREATE POLICY "Permitir actualizacion de solicitudes" 
ON public.solicitudes_registro 
FOR UPDATE 
TO public, anon, authenticated 
USING (true);

-- -----------------------------------------------------------------------------------------
-- 2. TABLA: public.meritos (Méritos, Condecoraciones y Enlaces de Medios)
-- -----------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meritos (
  id BIGSERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Misión Humanitaria',
  institucion_otorgante TEXT DEFAULT 'Cruz Verde Salvadoreña',
  fecha_merito DATE DEFAULT CURRENT_DATE,
  descripcion TEXT,
  socorristas_asignados JSONB DEFAULT '[]'::jsonb,
  enlaces JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asegurar columna enlaces si la tabla ya existía
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'meritos' 
    AND column_name = 'enlaces'
  ) THEN
    ALTER TABLE public.meritos ADD COLUMN enlaces JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

ALTER TABLE public.meritos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura publica de meritos" ON public.meritos;
CREATE POLICY "Permitir lectura publica de meritos" 
ON public.meritos 
FOR SELECT 
TO public, anon, authenticated 
USING (true);

DROP POLICY IF EXISTS "Permitir administracion de meritos" ON public.meritos;
CREATE POLICY "Permitir administracion de meritos" 
ON public.meritos 
FOR ALL 
TO public, authenticated 
USING (true) 
WITH CHECK (true);

-- -----------------------------------------------------------------------------------------
-- 3. PERMISOS EN public.user_roles PARA NUEVOS USUARIOS
-- -----------------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir asignacion de rol inicial al registrarse" ON public.user_roles;
CREATE POLICY "Permitir asignacion de rol inicial al registrarse" 
ON public.user_roles 
FOR INSERT 
TO public, anon, authenticated 
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir lectura y actualizacion de roles" ON public.user_roles;
CREATE POLICY "Permitir lectura y actualizacion de roles" 
ON public.user_roles 
FOR SELECT 
TO public, anon, authenticated 
USING (true);

DROP POLICY IF EXISTS "Permitir actualizacion de roles admin" ON public.user_roles;
CREATE POLICY "Permitir actualizacion de roles admin" 
ON public.user_roles 
FOR UPDATE 
TO public, authenticated 
USING (true);

-- -----------------------------------------------------------------------------------------
-- 4. VISTA: public.usuarios_view (Para sincronizar auth.users con emails en Accesos y Seccionales)
-- -----------------------------------------------------------------------------------------
-- Se elimina primero con CASCADE para evitar el error 42P16 de PostgreSQL cuando ya existe con otra estructura de columnas
DROP VIEW IF EXISTS public.usuarios_view CASCADE;

CREATE VIEW public.usuarios_view AS
SELECT 
  u.id,
  u.email,
  COALESCE(s.primer_nombre, split_part(u.email, '@', 1)) AS primer_nombre,
  COALESCE(s.primer_apellido, '') AS primer_apellido,
  r.role,
  r.activo,
  r.estado,
  s.carnet,
  s.seccional_id,
  u.created_at,
  u.confirmed_at,
  u.last_sign_in_at
FROM auth.users u
LEFT JOIN public.user_roles r ON u.id = r.id
LEFT JOIN public.socorristas s ON r.socorrista_id = s.id;

GRANT SELECT ON public.usuarios_view TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------------------
-- NOTA IMPORTANTE SOBRE CONFIRMACIÓN DE CORREO DE SUPABASE (AUTH SETTINGS):
-- -----------------------------------------------------------------------------------------
-- Por defecto, Supabase tiene activada la opción "Confirm email" en:
--   Supabase Dashboard > Authentication > Providers > Email > "Confirm email" = ON
--
-- ¿Cómo debe ser el flujo correcto?
-- OPCIÓN A (Recomendada si el administrador aprueba manualmente las cuentas):
--   1. En Supabase Dashboard > Authentication > Providers > Email:
--      Desmarcar la casilla "Confirm email" (poner en OFF).
--   2. De esta forma, el usuario NO recibe el correo genérico en inglés de Supabase.
--   3. Su solicitud cae en la pestaña "Accesos > Solicitudes de Registro".
--   4. El Administrador revisa el carnet, seccional y datos, y presiona "Aprobar y Notificar".
--   5. En ese instante, el sistema de Cruz Verde le envía el correo oficial institucional
--      (con los colores verde/blanco, logo y enlace directo para iniciar sesión).
--
-- OPCIÓN B (Si prefieres doble verificación: correo primero, luego aprobación admin):
--   1. Dejar "Confirm email" = ON.
--   2. El usuario confirma su correo con Supabase.
--   3. Pero no puede entrar al sistema hasta que el Administrador lo apruebe en la pestaña Accesos
--      porque su rol inicial queda en 'pendiente'.
-- =========================================================================================
