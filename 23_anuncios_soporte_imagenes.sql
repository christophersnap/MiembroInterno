-- =========================================================================
-- MIGRACIÓN 23: SOPORTE DE IMÁGENES Y BANNERS PARA ANUNCIOS INSTITUCIONALES
-- Cruz Verde Salvadoreña - Sistema Integrado
-- =========================================================================

-- 1. Añadir columna 'imagen_url' a la tabla 'anuncios' si no existe
ALTER TABLE IF EXISTS public.anuncios 
ADD COLUMN IF NOT EXISTS imagen_url TEXT;

-- 2. Comentario explicativo en la columna
COMMENT ON COLUMN public.anuncios.imagen_url IS 'URL de la imagen destacada o banner del anuncio (dimensiones recomendadas: 1200x630 px proporción 16:9)';

-- 3. Índice para optimizar consultas con o sin imagen
CREATE INDEX IF NOT EXISTS idx_anuncios_imagen ON public.anuncios(imagen_url) WHERE imagen_url IS NOT NULL;

-- 4. Verificación de políticas RLS existentes:
-- Los usuarios autenticados ya cuentan con política SELECT en public.anuncios.
-- Los administradores ya cuentan con política INSERT / UPDATE en public.anuncios.
-- Por lo tanto, 'imagen_url' se hereda inmediatamente en los permisos existentes.
