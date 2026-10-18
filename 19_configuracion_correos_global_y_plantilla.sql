-- =========================================================================
-- MIGRACIÓN 19: CONFIGURACIÓN GLOBAL DE REMITENTE NO-REPLY Y PLANTILLA DE CORREOS
-- Cruz Verde Salvadoreña - Sistema Institucional
-- =========================================================================

-- 1. Asegurar que la tabla configuracion existe
CREATE TABLE IF NOT EXISTS public.configuracion (
  id BIGSERIAL PRIMARY KEY,
  clave TEXT UNIQUE NOT NULL,
  valor TEXT,
  watermark_enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Asegurar columnas adicionales de forma segura si la tabla ya existía
ALTER TABLE public.configuracion ADD COLUMN IF NOT EXISTS valor TEXT;
ALTER TABLE public.configuracion ADD COLUMN IF NOT EXISTS descripcion TEXT;
ALTER TABLE public.configuracion ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 3. Asegurar que la restricción única en clave exista
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.configuracion'::regclass 
      AND contype = 'u' 
      AND conname = 'configuracion_clave_key'
  ) THEN
    ALTER TABLE public.configuracion ADD CONSTRAINT configuracion_clave_key UNIQUE (clave);
  END IF;
EXCEPTION
  WHEN duplicate_table OR duplicate_object THEN
    NULL;
END $$;

-- 4. Habilitar RLS en configuracion
ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;

-- 5. Políticas permisivas para lectura y administración
DROP POLICY IF EXISTS "Lectura pública o autenticada de configuración" ON public.configuracion;
DROP POLICY IF EXISTS "Permitir lectura publica configuracion" ON public.configuracion;
DROP POLICY IF EXISTS "Public can read configuracion" ON public.configuracion;
CREATE POLICY "Permitir lectura publica configuracion" 
  ON public.configuracion FOR SELECT USING (true);

DROP POLICY IF EXISTS "Edición de configuración por administradores" ON public.configuracion;
DROP POLICY IF EXISTS "Permitir gestion autenticada configuracion" ON public.configuracion;
DROP POLICY IF EXISTS "Admins can manage configuracion" ON public.configuracion;
CREATE POLICY "Permitir gestion autenticada configuracion" 
  ON public.configuracion FOR ALL USING (true) WITH CHECK (true);

-- 6. Insertar valores de configuración usando solo (clave, valor) para máxima compatibilidad
INSERT INTO public.configuracion (clave, valor)
VALUES 
  -- Configuración de Remitente Global Unificado No-Reply
  ('email_remitente_global', 'info@cruzverdesv.org'),
  ('email_remitente_nombre_global', 'Cruz Verde Salvadoreña (No Responder)'),
  ('email_remitente_no_reply_mode', 'true'),
  
  -- Configuración de Diseño de Plantilla de Correos
  ('email_template_header_color', '#15803d'),
  ('email_template_header_text_color', '#ffffff'),
  ('email_template_footer_color', '#f9fafb'),
  ('email_template_footer_text_color', '#6b7280'),
  ('email_template_font_title', 'Plus Jakarta Sans'),
  ('email_template_font_body', 'Plus Jakarta Sans'),
  ('email_template_logo', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Cruz_Verde_Salvadore%C3%B1a.png/120px-Cruz_Verde_Salvadore%C3%B1a.png'),
  ('email_template_mostrar_logo', 'true'),
  ('email_template_legend', 'Este es un mensaje institucional automático generado por el Sistema Interno de Cruz Verde Salvadoreña. Por favor no responda a esta dirección de correo electrónico ya que es una casilla no monitoreada. Para consultas oficiales, comuníquese con la jefatura de su seccional o la administración nacional.'),
  ('email_template_telefono_contacto', '2284-0000 / 7695-7911'),
  
  -- Valores por defecto sincronizados para Compra, Combustible y Accesos
  ('solicitudes_correo_remitente', 'info@cruzverdesv.org'),
  ('combustible_correo_remitente', 'info@cruzverdesv.org'),
  ('email_remitente_correo', 'info@cruzverdesv.org')
ON CONFLICT (clave) DO NOTHING;
