-- =========================================================================
-- MIGRACIÓN 24: PERSONALIZACIÓN COMPLETA DE COLORES DEL SISTEMA
-- Cruz Verde Salvadoreña - Sistema Integrado
-- =========================================================================

-- 1. Asegurar la existencia de la tabla general de configuración
CREATE TABLE IF NOT EXISTS public.configuracion (
    id BIGSERIAL PRIMARY KEY,
    clave TEXT NOT NULL,
    valor TEXT,
    descripcion TEXT,
    verificacion_fields JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Asegurar restricción única en la columna clave
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.configuracion'::regclass 
          AND conname = 'uq_configuracion_clave'
    ) THEN
        ALTER TABLE public.configuracion ADD CONSTRAINT uq_configuracion_clave UNIQUE (clave);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- 3. Habilitar Seguridad por Nivel de Fila (RLS)
ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Acceso para configuracion
DROP POLICY IF EXISTS "Permitir lectura publica configuracion" ON public.configuracion;
DROP POLICY IF EXISTS "Public can read configuracion" ON public.configuracion;
DROP POLICY IF EXISTS "Lectura pública o autenticada de configuración" ON public.configuracion;
CREATE POLICY "Permitir lectura publica configuracion" 
    ON public.configuracion FOR SELECT 
    USING (true);

DROP POLICY IF EXISTS "Permitir gestion autenticada configuracion" ON public.configuracion;
DROP POLICY IF EXISTS "Admins can manage configuracion" ON public.configuracion;
DROP POLICY IF EXISTS "Edición de configuración por administradores" ON public.configuracion;
CREATE POLICY "Permitir gestion autenticada configuracion" 
    ON public.configuracion FOR ALL 
    USING (true) 
    WITH CHECK (true);

-- 5. Insertar o actualizar los registros por defecto de personalización de colores
-- Estructura JSON completa soportada por el Sistema:
-- {
--   "primary": "#008f39",          -- Color principal (Botones, Acentos)
--   "primaryHover": "#00702c",     -- Color hover principal
--   "secondary": "#10b981",        -- Color secundario (Insignias, Destacados)
--   "sidebarBg": "#0a2014",        -- Menú lateral (Fondo estilo noche Apple)
--   "sidebarText": "#d1fae5",      -- Menú lateral (Texto e iconos inactivos)
--   "sidebarActiveBg": "rgba(255, 255, 255, 0.15)", -- Menú lateral (Fondo de ítem activo)
--   "sidebarBorder": "rgba(0, 0, 0, 0.2)",           -- Menú lateral (Borde derecho)
--   "dashboardBg": "#f8faf9",      -- Fondo general del dashboard y sistema
--   "cardBg": "#ffffff",           -- Fondo de las tarjetas del dashboard
--   "cardBorder": "rgba(226, 232, 240, 0.8)",        -- Borde de las tarjetas del dashboard
--   "anuncioBg": "#ffffff",        -- Fondo del cuadro de anuncio superior
--   "anuncioBorder": "#a7f3d0",    -- Borde del cuadro de anuncio superior
--   "anuncioText": "#111827",      -- Color de texto del anuncio
--   "tickerBg": "#0a0f0d",         -- Fondo de la línea de anuncio (slider/cinta de noticias)
--   "tickerText": "#f3f4f6",       -- Texto de la noticia en la línea de anuncio
--   "tickerBadgeBg": "#059669",    -- Fondo del badge "NOTICIAS CVS"
--   "tickerBadgeText": "#ffffff"   -- Texto del badge "NOTICIAS CVS"
-- }

INSERT INTO public.configuracion (clave, valor, descripcion)
VALUES (
    'colores',
    '{"primary":"#008f39","primaryHover":"#00702c","secondary":"#10b981","sidebarBg":"#0a2014","sidebarText":"#d1fae5","sidebarActiveBg":"rgba(255, 255, 255, 0.15)","sidebarBorder":"rgba(0, 0, 0, 0.2)","dashboardBg":"#f8faf9","cardBg":"#ffffff","cardBorder":"rgba(226, 232, 240, 0.8)","anuncioBg":"#ffffff","anuncioBorder":"#a7f3d0","anuncioText":"#111827","tickerBg":"#0a0f0d","tickerText":"#f3f4f6","tickerBadgeBg":"#059669","tickerBadgeText":"#ffffff"}',
    'Personalización de colores del sistema: menú, dashboard, anuncios, línea de noticias y botones'
)
ON CONFLICT (clave) DO NOTHING;

-- Notificar éxito de la migración
SELECT 'Migración 24: Configuración de colores del sistema verificada y configurada exitosamente' as resultado;
