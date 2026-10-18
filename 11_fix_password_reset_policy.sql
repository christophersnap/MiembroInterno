-- Allow users to set their own requires_password_reset to false securely
CREATE OR REPLACE FUNCTION public.acknowledge_password_reset()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_roles
  SET requires_password_reset = false
  WHERE id = auth.uid();
END;
$$;
