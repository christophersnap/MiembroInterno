-- =========================================================================
-- MIGRACIÓN 37: CONFIGURACIÓN DE VERIFICACIÓN QR, POLÍTICAS Y SEGURIDAD
-- Cruz Verde Salvadoreña - Sistema Oficial de Gestión
-- =========================================================================

-- 1. Asegurar columnas necesarias en public.configuracion
ALTER TABLE public.configuracion
  ADD COLUMN IF NOT EXISTS valor TEXT,
  ADD COLUMN IF NOT EXISTS descripcion TEXT,
  ADD COLUMN IF NOT EXISTS verificacion_fields JSONB,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 2. Sincronizar columna JSONB verificacion_fields con el valor textual guardado (si existe)
UPDATE public.configuracion
SET verificacion_fields = valor::jsonb
WHERE clave = 'verificacion_fields'
  AND valor IS NOT NULL
  AND valor ~ '^\s*\{.*\}\s*$';

-- 3. Asegurar políticas RLS de lectura pública y escritura autenticada en configuracion
ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura publica configuracion" ON public.configuracion;
DROP POLICY IF EXISTS "Public can read configuracion" ON public.configuracion;
DROP POLICY IF EXISTS "Lectura pública o autenticada de configuración" ON public.configuracion;
CREATE POLICY "Permitir lectura publica configuracion"
  ON public.configuracion FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir gestion autenticada configuracion" ON public.configuracion;
DROP POLICY IF EXISTS "Admins can manage configuracion" ON public.configuracion;
DROP POLICY IF EXISTS "Edición de configuración por administradores" ON public.configuracion;
CREATE POLICY "Permitir gestion autenticada configuracion"
  ON public.configuracion FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. Asegurar columnas de contactos de emergencia en socorristas (por si no se ejecutó migración 28)
ALTER TABLE public.socorristas
  ADD COLUMN IF NOT EXISTS contacto_emergencia_nombre TEXT,
  ADD COLUMN IF NOT EXISTS contacto_emergencia_telefono TEXT,
  ADD COLUMN IF NOT EXISTS contacto_emergencia_nombre_2 TEXT,
  ADD COLUMN IF NOT EXISTS contacto_emergencia_telefono_2 TEXT;
