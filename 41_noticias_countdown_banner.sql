-- ==============================================================================
-- 41_noticias_countdown_banner.sql
-- Módulo de Banner Countdown de Eventos (ubicado debajo del Banner Slider)
-- Cruz Verde Salvadoreña - Sistema Administrativo
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.noticias_countdown (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_evento TEXT NOT NULL,
  etiqueta_superior TEXT DEFAULT 'Próximo Evento',
  subtitulo TEXT,
  fecha_objetivo TIMESTAMPTZ NOT NULL,
  texto_finalizado TEXT DEFAULT '¡El evento ha comenzado!',
  mostrar_meses BOOLEAN DEFAULT true,
  imagen_url TEXT,
  logo_url TEXT,
  posicion_imagen TEXT DEFAULT 'izquierda' CHECK (posicion_imagen IN ('izquierda', 'centro', 'derecha')),
  posicion_logo TEXT DEFAULT 'izquierda' CHECK (posicion_logo IN ('izquierda', 'centro', 'derecha')),
  posicion_conteo TEXT DEFAULT 'derecha' CHECK (posicion_conteo IN ('izquierda', 'centro', 'derecha')),
  tipografia TEXT DEFAULT 'jakarta',
  tamano_titulo TEXT DEFAULT 'md' CHECK (tamano_titulo IN ('sm', 'md', 'lg')),
  color_fondo TEXT DEFAULT '#064e3b',
  color_fondo_secundario TEXT DEFAULT '#0f172a',
  usar_gradiente BOOLEAN DEFAULT true,
  color_texto TEXT DEFAULT '#ffffff',
  color_acento TEXT DEFAULT '#34d399',
  color_caja_tiempo TEXT DEFAULT '#022c22',
  color_texto_tiempo TEXT DEFAULT '#ffffff',
  enlace_url TEXT,
  enlace_texto TEXT DEFAULT 'Ver más detalles',
  activo BOOLEAN DEFAULT true,
  orden INTEGER DEFAULT 0,
  autor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.noticias_countdown
  ADD COLUMN IF NOT EXISTS etiqueta_superior TEXT DEFAULT 'Próximo Evento',
  ADD COLUMN IF NOT EXISTS subtitulo TEXT,
  ADD COLUMN IF NOT EXISTS texto_finalizado TEXT DEFAULT '¡El evento ha comenzado!',
  ADD COLUMN IF NOT EXISTS mostrar_meses BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS imagen_url TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS posicion_imagen TEXT DEFAULT 'izquierda',
  ADD COLUMN IF NOT EXISTS posicion_logo TEXT DEFAULT 'izquierda',
  ADD COLUMN IF NOT EXISTS posicion_conteo TEXT DEFAULT 'derecha',
  ADD COLUMN IF NOT EXISTS tipografia TEXT DEFAULT 'jakarta',
  ADD COLUMN IF NOT EXISTS tamano_titulo TEXT DEFAULT 'md',
  ADD COLUMN IF NOT EXISTS color_fondo TEXT DEFAULT '#064e3b',
  ADD COLUMN IF NOT EXISTS color_fondo_secundario TEXT DEFAULT '#0f172a',
  ADD COLUMN IF NOT EXISTS usar_gradiente BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS color_texto TEXT DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS color_acento TEXT DEFAULT '#34d399',
  ADD COLUMN IF NOT EXISTS color_caja_tiempo TEXT DEFAULT '#022c22',
  ADD COLUMN IF NOT EXISTS color_texto_tiempo TEXT DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS enlace_url TEXT,
  ADD COLUMN IF NOT EXISTS enlace_texto TEXT DEFAULT 'Ver más detalles',
  ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS orden INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_noticias_countdown_activo ON public.noticias_countdown(activo);
CREATE INDEX IF NOT EXISTS idx_noticias_countdown_orden ON public.noticias_countdown(orden ASC, fecha_objetivo ASC);

ALTER TABLE public.noticias_countdown ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios autenticados pueden ver countdowns activos" ON public.noticias_countdown;
CREATE POLICY "Usuarios autenticados pueden ver countdowns activos"
  ON public.noticias_countdown
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

DROP POLICY IF EXISTS "Autorizados pueden administrar noticias_countdown" ON public.noticias_countdown;
CREATE POLICY "Autorizados pueden administrar noticias_countdown"
  ON public.noticias_countdown
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
  WITH CHECK (true);

INSERT INTO public.configuracion (clave, valor, descripcion)
SELECT 'noticias_countdown_activo', 'true', 'Activa o desactiva la sección de Banner Countdown debajo del Banner Slider'
WHERE NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'noticias_countdown_activo');

INSERT INTO public.configuracion (clave, valor, descripcion)
SELECT 'noticias_countdown_layout', 'grid', 'Disposición de múltiples countdowns en escritorio: grid o stack'
WHERE NOT EXISTS (SELECT 1 FROM public.configuracion WHERE clave = 'noticias_countdown_layout');

NOTIFY pgrst, 'reload schema';
