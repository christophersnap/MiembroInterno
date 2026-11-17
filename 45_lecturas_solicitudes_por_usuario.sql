-- =========================================================================================
-- MIGRACIÓN 45: CONTROL DE LECTURA INDIVIDUAL POR SOLICITUD Y POR USUARIO
-- Permite recordar qué solicitudes (Carnet, Combustible, Compra) ya fueron vistas por cada
-- usuario para mostrar tonalidad de "no leído" en fila y descontar del contador rojo en vivo.
-- =========================================================================================

CREATE TABLE IF NOT EXISTS public.solicitudes_lecturas (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modulo TEXT NOT NULL CHECK (modulo IN ('carnet', 'combustible', 'compra')),
  solicitud_key TEXT NOT NULL,
  leido_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, modulo, solicitud_key)
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_lecturas_user_modulo
  ON public.solicitudes_lecturas (user_id, modulo);

ALTER TABLE public.solicitudes_lecturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios leen sus propias lecturas de solicitudes" ON public.solicitudes_lecturas;
CREATE POLICY "Usuarios leen sus propias lecturas de solicitudes"
  ON public.solicitudes_lecturas
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios registran sus propias lecturas de solicitudes" ON public.solicitudes_lecturas;
CREATE POLICY "Usuarios registran sus propias lecturas de solicitudes"
  ON public.solicitudes_lecturas
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios actualizan sus propias lecturas de solicitudes" ON public.solicitudes_lecturas;
CREATE POLICY "Usuarios actualizan sus propias lecturas de solicitudes"
  ON public.solicitudes_lecturas
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios eliminan sus propias lecturas de solicitudes" ON public.solicitudes_lecturas;
CREATE POLICY "Usuarios eliminan sus propias lecturas de solicitudes"
  ON public.solicitudes_lecturas
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitudes_lecturas TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.solicitudes_lecturas_id_seq TO authenticated;

NOTIFY pgrst, 'reload schema';
