DROP POLICY IF EXISTS "Authenticated users can read configuracion" ON public.configuracion;
DROP POLICY IF EXISTS "Public can read configuracion" ON public.configuracion;
CREATE POLICY "Public can read configuracion" ON public.configuracion FOR SELECT USING (true);
