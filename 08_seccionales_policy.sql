CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role = 'admin'
  ) OR current_setting('request.jwt.claims', true)::jsonb ->> 'email' = 'christopher.snap@gmail.com';
END;
$$;

-- Permite a un director modificar su propia seccional, o a admin gestionarlas todas
CREATE OR REPLACE FUNCTION public.can_manage_seccionales(seccional_id INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN true;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM public.seccionales s 
    WHERE s.id = seccional_id AND s.director_id = auth.uid()
  );
END;
$$;

DROP POLICY IF EXISTS "Admins can manage seccionales" ON public.seccionales;
CREATE POLICY "Role based seccionales management" ON public.seccionales
  FOR ALL USING (
    public.is_admin() OR 
    (director_id = auth.uid()) OR
    current_setting('request.jwt.claims', true)::jsonb ->> 'email' = 'christopher.snap@gmail.com'
  );
