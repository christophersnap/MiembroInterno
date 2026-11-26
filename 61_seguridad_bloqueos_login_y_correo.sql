-- =========================================================================================
-- MIGRACIÓN 61: SEGURIDAD DE BLOQUEOS POR INTENTOS FALLIDOS (GEOLOCALIZACIÓN Y DESBLOQUEO)
--               + ACTUALIZACIÓN DE TELÉFONO OFICIAL DE CONTACTO EN CORREOS (2284-5792)
-- Cruz Verde Salvadoreña - Sistema Institucional
-- =========================================================================================
-- 100% idempotente. No borra usuarios ni registros existentes.
-- =========================================================================================

-- -----------------------------------------------------------------------------------------
-- 1. ACTUALIZAR TELÉFONO DE CONTACTO DE CORREOS (2284-0000 -> 2284-5792) EN CONFIGURACION
-- -----------------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'configuracion'
  ) THEN
    UPDATE public.configuracion
    SET valor = replace(valor, '2284-0000', '2284-5792')
    WHERE clave IN (
      'email_template_telefono_contacto',
      'combustible_correo_contacto_telefono',
      'combustible_correo_footer_texto',
      'compra_correo_telefono',
      'compra_correo_footer'
    )
    AND valor LIKE '%2284-0000%';
  END IF;
END $$;

-- -----------------------------------------------------------------------------------------
-- 2. TABLA DE ESTADO DE BLOQUEO POR USUARIO (EMAIL)
-- -----------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.login_security_state (
  email TEXT PRIMARY KEY,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  locked_at TIMESTAMPTZ,
  locked_until TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  last_ip TEXT,
  last_country TEXT,
  last_country_code TEXT,
  last_city TEXT,
  last_region TEXT,
  last_isp TEXT,
  last_device TEXT,
  last_browser TEXT,
  last_timezone TEXT,
  last_user_agent TEXT,
  last_error_reason TEXT,
  unlocked_by TEXT,
  unlocked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------------------
-- 3. BITÁCORA DETALLADA DE INTENTOS DE INICIO DE SESIÓN FALLIDOS Y DESBLOQUEOS
-- -----------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.login_attempt_logs (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_type TEXT NOT NULL DEFAULT 'failed_login',
  attempt_number INTEGER NOT NULL DEFAULT 1,
  ip_address TEXT,
  country TEXT,
  country_code TEXT,
  city TEXT,
  region TEXT,
  isp TEXT,
  device TEXT,
  browser TEXT,
  timezone TEXT,
  user_agent TEXT,
  error_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_login_attempt_logs_email_date
  ON public.login_attempt_logs (lower(email), attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_security_state_locked
  ON public.login_security_state (is_locked, locked_until);

-- -----------------------------------------------------------------------------------------
-- 4. RLS ESTRICTO (SOLO ADMINISTRADORES PUEDEN LEER DIRECTAMENTE; ANON SOLO VÍA RPC)
-- -----------------------------------------------------------------------------------------
ALTER TABLE public.login_security_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempt_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read login_security_state" ON public.login_security_state;
CREATE POLICY "Admins read login_security_state"
  ON public.login_security_state
  FOR SELECT
  TO authenticated
  USING (
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'christopher.snap@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.id = auth.uid()
        AND (
          ur.role = 'admin'
          OR coalesce((ur.custom_permissions ->> 'view_accesos')::boolean, false) = true
          OR coalesce((ur.custom_permissions ->> 'edit_accesos')::boolean, false) = true
        )
    )
  );

DROP POLICY IF EXISTS "Admins read login_attempt_logs" ON public.login_attempt_logs;
CREATE POLICY "Admins read login_attempt_logs"
  ON public.login_attempt_logs
  FOR SELECT
  TO authenticated
  USING (
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'christopher.snap@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.id = auth.uid()
        AND (
          ur.role = 'admin'
          OR coalesce((ur.custom_permissions ->> 'view_accesos')::boolean, false) = true
          OR coalesce((ur.custom_permissions ->> 'edit_accesos')::boolean, false) = true
        )
    )
  );

-- -----------------------------------------------------------------------------------------
-- 5. FUNCIÓN AUXILIAR INTERNA PARA VERIFICAR PERMISO DE ADMINISTRACIÓN DE USUARIOS
-- -----------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._is_login_security_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  IF lower(coalesce(auth.jwt() ->> 'email', '')) = 'christopher.snap@gmail.com' THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.id = auth.uid()
      AND (
        ur.role = 'admin'
        OR coalesce((ur.custom_permissions ->> 'view_accesos')::boolean, false) = true
        OR coalesce((ur.custom_permissions ->> 'edit_accesos')::boolean, false) = true
      )
  );
END $$;

-- -----------------------------------------------------------------------------------------
-- 6. RPC: VERIFICAR ESTADO DE BLOQUEO EN LOGIN (DEVUELVE SOLO LO MÍNIMO NECESARIO)
-- -----------------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.check_login_status(TEXT);
CREATE OR REPLACE FUNCTION public.check_login_status(user_email TEXT)
RETURNS TABLE (
  is_locked BOOLEAN,
  locked_until TIMESTAMPTZ,
  failed_attempts INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(trim(coalesce(user_email, '')));
  v_row public.login_security_state%ROWTYPE;
BEGIN
  IF v_email = '' THEN
    RETURN QUERY SELECT FALSE, NULL::TIMESTAMPTZ, 0;
    RETURN;
  END IF;

  SELECT * INTO v_row
  FROM public.login_security_state
  WHERE email = v_email;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::TIMESTAMPTZ, 0;
    RETURN;
  END IF;

  -- Si el bloqueo temporal ya expiró, liberarlo automáticamente
  IF v_row.is_locked AND v_row.locked_until IS NOT NULL AND v_row.locked_until <= now() THEN
    UPDATE public.login_security_state
    SET is_locked = FALSE,
        failed_attempts = 0,
        locked_until = NULL,
        updated_at = now()
    WHERE email = v_email;

    RETURN QUERY SELECT FALSE, NULL::TIMESTAMPTZ, 0;
    RETURN;
  END IF;

  RETURN QUERY SELECT v_row.is_locked, v_row.locked_until, v_row.failed_attempts;
END $$;

-- -----------------------------------------------------------------------------------------
-- 7. RPC: REGISTRAR INTENTO FALLIDO CON GEOLOCALIZACIÓN Y DISPOSITIVO
--    (Compatible con llamadas previas solo con { user_email })
-- -----------------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.handle_failed_login(TEXT);
DROP FUNCTION IF EXISTS public.handle_failed_login(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.handle_failed_login(
  user_email TEXT,
  p_ip TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_country_code TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_region TEXT DEFAULT NULL,
  p_isp TEXT DEFAULT NULL,
  p_device TEXT DEFAULT NULL,
  p_browser TEXT DEFAULT NULL,
  p_timezone TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT 'Credenciales incorrectas'
)
RETURNS TABLE (
  is_locked BOOLEAN,
  locked_until TIMESTAMPTZ,
  failed_attempts INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(trim(coalesce(user_email, '')));
  v_prev_attempts INTEGER := 0;
  v_prev_locked BOOLEAN := FALSE;
  v_prev_until TIMESTAMPTZ := NULL;
  v_new_attempts INTEGER := 1;
  v_new_locked BOOLEAN := FALSE;
  v_new_until TIMESTAMPTZ := NULL;
  v_event_type TEXT := 'failed_login';
BEGIN
  IF v_email = '' THEN
    RETURN QUERY SELECT FALSE, NULL::TIMESTAMPTZ, 0;
    RETURN;
  END IF;

  SELECT s.failed_attempts, s.is_locked, s.locked_until
  INTO v_prev_attempts, v_prev_locked, v_prev_until
  FROM public.login_security_state s
  WHERE s.email = v_email;

  IF NOT FOUND THEN
    v_prev_attempts := 0;
    v_prev_locked := FALSE;
    v_prev_until := NULL;
  ELSIF v_prev_locked AND v_prev_until IS NOT NULL AND v_prev_until <= now() THEN
    v_prev_attempts := 0;
    v_prev_locked := FALSE;
    v_prev_until := NULL;
  END IF;

  v_new_attempts := v_prev_attempts + 1;

  IF v_new_attempts >= 3 THEN
    v_new_locked := TRUE;
    v_new_until := now() + INTERVAL '3 hours';
    v_event_type := 'locked';
  ELSE
    v_new_locked := FALSE;
    v_new_until := NULL;
    v_event_type := 'failed_login';
  END IF;

  INSERT INTO public.login_security_state (
    email,
    failed_attempts,
    is_locked,
    locked_at,
    locked_until,
    last_attempt_at,
    last_ip,
    last_country,
    last_country_code,
    last_city,
    last_region,
    last_isp,
    last_device,
    last_browser,
    last_timezone,
    last_user_agent,
    last_error_reason,
    updated_at
  ) VALUES (
    v_email,
    v_new_attempts,
    v_new_locked,
    CASE WHEN v_new_locked THEN now() ELSE NULL END,
    v_new_until,
    now(),
    left(coalesce(p_ip, ''), 120),
    left(coalesce(p_country, ''), 120),
    left(coalesce(p_country_code, ''), 12),
    left(coalesce(p_city, ''), 120),
    left(coalesce(p_region, ''), 120),
    left(coalesce(p_isp, ''), 160),
    left(coalesce(p_device, ''), 120),
    left(coalesce(p_browser, ''), 120),
    left(coalesce(p_timezone, ''), 80),
    left(coalesce(p_user_agent, ''), 300),
    left(coalesce(p_reason, 'Credenciales incorrectas'), 200),
    now()
  )
  ON CONFLICT (email) DO UPDATE SET
    failed_attempts = EXCLUDED.failed_attempts,
    is_locked = EXCLUDED.is_locked,
    locked_at = CASE
      WHEN EXCLUDED.is_locked AND NOT public.login_security_state.is_locked THEN now()
      WHEN EXCLUDED.is_locked THEN coalesce(public.login_security_state.locked_at, now())
      ELSE NULL
    END,
    locked_until = EXCLUDED.locked_until,
    last_attempt_at = now(),
    last_ip = coalesce(NULLIF(EXCLUDED.last_ip, ''), public.login_security_state.last_ip),
    last_country = coalesce(NULLIF(EXCLUDED.last_country, ''), public.login_security_state.last_country),
    last_country_code = coalesce(NULLIF(EXCLUDED.last_country_code, ''), public.login_security_state.last_country_code),
    last_city = coalesce(NULLIF(EXCLUDED.last_city, ''), public.login_security_state.last_city),
    last_region = coalesce(NULLIF(EXCLUDED.last_region, ''), public.login_security_state.last_region),
    last_isp = coalesce(NULLIF(EXCLUDED.last_isp, ''), public.login_security_state.last_isp),
    last_device = coalesce(NULLIF(EXCLUDED.last_device, ''), public.login_security_state.last_device),
    last_browser = coalesce(NULLIF(EXCLUDED.last_browser, ''), public.login_security_state.last_browser),
    last_timezone = coalesce(NULLIF(EXCLUDED.last_timezone, ''), public.login_security_state.last_timezone),
    last_user_agent = coalesce(NULLIF(EXCLUDED.last_user_agent, ''), public.login_security_state.last_user_agent),
    last_error_reason = EXCLUDED.last_error_reason,
    updated_at = now();

  INSERT INTO public.login_attempt_logs (
    email,
    attempted_at,
    event_type,
    attempt_number,
    ip_address,
    country,
    country_code,
    city,
    region,
    isp,
    device,
    browser,
    timezone,
    user_agent,
    error_reason
  ) VALUES (
    v_email,
    now(),
    v_event_type,
    v_new_attempts,
    NULLIF(left(coalesce(p_ip, ''), 120), ''),
    NULLIF(left(coalesce(p_country, ''), 120), ''),
    NULLIF(left(coalesce(p_country_code, ''), 12), ''),
    NULLIF(left(coalesce(p_city, ''), 120), ''),
    NULLIF(left(coalesce(p_region, ''), 120), ''),
    NULLIF(left(coalesce(p_isp, ''), 160), ''),
    NULLIF(left(coalesce(p_device, ''), 120), ''),
    NULLIF(left(coalesce(p_browser, ''), 120), ''),
    NULLIF(left(coalesce(p_timezone, ''), 80), ''),
    NULLIF(left(coalesce(p_user_agent, ''), 300), ''),
    left(coalesce(p_reason, 'Credenciales incorrectas'), 200)
  );

  RETURN QUERY SELECT v_new_locked, v_new_until, v_new_attempts;
END $$;

-- -----------------------------------------------------------------------------------------
-- 8. RPC: REGISTRAR INTENTO ADICIONAL MIENTRAS LA CUENTA YA ESTÁ BLOQUEADA
-- -----------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_blocked_login_attempt(
  user_email TEXT,
  p_ip TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_country_code TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_region TEXT DEFAULT NULL,
  p_isp TEXT DEFAULT NULL,
  p_device TEXT DEFAULT NULL,
  p_browser TEXT DEFAULT NULL,
  p_timezone TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(trim(coalesce(user_email, '')));
  v_attempts INTEGER := 3;
BEGIN
  IF v_email = '' THEN
    RETURN;
  END IF;

  UPDATE public.login_security_state
  SET failed_attempts = failed_attempts + 1,
      last_attempt_at = now(),
      last_ip = coalesce(NULLIF(left(coalesce(p_ip, ''), 120), ''), last_ip),
      last_country = coalesce(NULLIF(left(coalesce(p_country, ''), 120), ''), last_country),
      last_country_code = coalesce(NULLIF(left(coalesce(p_country_code, ''), 12), ''), last_country_code),
      last_city = coalesce(NULLIF(left(coalesce(p_city, ''), 120), ''), last_city),
      last_region = coalesce(NULLIF(left(coalesce(p_region, ''), 120), ''), last_region),
      last_isp = coalesce(NULLIF(left(coalesce(p_isp, ''), 160), ''), last_isp),
      last_device = coalesce(NULLIF(left(coalesce(p_device, ''), 120), ''), last_device),
      last_browser = coalesce(NULLIF(left(coalesce(p_browser, ''), 120), ''), last_browser),
      last_timezone = coalesce(NULLIF(left(coalesce(p_timezone, ''), 80), ''), last_timezone),
      last_user_agent = coalesce(NULLIF(left(coalesce(p_user_agent, ''), 300), ''), last_user_agent),
      last_error_reason = 'Intento mientras la cuenta estaba bloqueada',
      updated_at = now()
  WHERE email = v_email
  RETURNING failed_attempts INTO v_attempts;

  IF FOUND THEN
    INSERT INTO public.login_attempt_logs (
      email,
      attempted_at,
      event_type,
      attempt_number,
      ip_address,
      country,
      country_code,
      city,
      region,
      isp,
      device,
      browser,
      timezone,
      user_agent,
      error_reason
    ) VALUES (
      v_email,
      now(),
      'blocked_attempt',
      coalesce(v_attempts, 4),
      NULLIF(left(coalesce(p_ip, ''), 120), ''),
      NULLIF(left(coalesce(p_country, ''), 120), ''),
      NULLIF(left(coalesce(p_country_code, ''), 12), ''),
      NULLIF(left(coalesce(p_city, ''), 120), ''),
      NULLIF(left(coalesce(p_region, ''), 120), ''),
      NULLIF(left(coalesce(p_isp, ''), 160), ''),
      NULLIF(left(coalesce(p_device, ''), 120), ''),
      NULLIF(left(coalesce(p_browser, ''), 120), ''),
      NULLIF(left(coalesce(p_timezone, ''), 80), ''),
      NULLIF(left(coalesce(p_user_agent, ''), 300), ''),
      'Intento realizado mientras la cuenta estaba bloqueada'
    );
  END IF;
END $$;

-- -----------------------------------------------------------------------------------------
-- 9. RPC: REINICIAR CONTADOR AL INICIAR SESIÓN EXITOSAMENTE
-- -----------------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.reset_successful_login(TEXT);
CREATE OR REPLACE FUNCTION public.reset_successful_login(user_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(trim(coalesce(user_email, '')));
BEGIN
  IF v_email = '' THEN
    RETURN;
  END IF;

  UPDATE public.login_security_state
  SET failed_attempts = 0,
      is_locked = FALSE,
      locked_at = NULL,
      locked_until = NULL,
      updated_at = now()
  WHERE email = v_email;
END $$;

-- -----------------------------------------------------------------------------------------
-- 10. RPC SOLO ADMIN: OBTENER REPORTE COMPLETO DE BLOQUEOS E INTENTOS FALLIDOS
-- -----------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_login_lockouts_report()
RETURNS TABLE (
  email TEXT,
  failed_attempts INTEGER,
  is_locked BOOLEAN,
  locked_at TIMESTAMPTZ,
  locked_until TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  last_ip TEXT,
  last_country TEXT,
  last_country_code TEXT,
  last_city TEXT,
  last_region TEXT,
  last_isp TEXT,
  last_device TEXT,
  last_browser TEXT,
  last_timezone TEXT,
  last_user_agent TEXT,
  last_error_reason TEXT,
  unlocked_by TEXT,
  unlocked_at TIMESTAMPTZ,
  attempts JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._is_login_security_admin() THEN
    RAISE EXCEPTION 'Permiso denegado para consultar reportes de seguridad de acceso';
  END IF;

  -- Liberar primero bloqueos ya expirados
  UPDATE public.login_security_state
  SET is_locked = FALSE,
      locked_until = NULL,
      updated_at = now()
  WHERE is_locked = TRUE
    AND locked_until IS NOT NULL
    AND locked_until <= now();

  RETURN QUERY
  SELECT
    s.email,
    s.failed_attempts,
    s.is_locked,
    s.locked_at,
    s.locked_until,
    s.last_attempt_at,
    s.last_ip,
    s.last_country,
    s.last_country_code,
    s.last_city,
    s.last_region,
    s.last_isp,
    s.last_device,
    s.last_browser,
    s.last_timezone,
    s.last_user_agent,
    s.last_error_reason,
    s.unlocked_by,
    s.unlocked_at,
    coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', l.id,
            'attempted_at', l.attempted_at,
            'event_type', l.event_type,
            'attempt_number', l.attempt_number,
            'ip_address', l.ip_address,
            'country', l.country,
            'country_code', l.country_code,
            'city', l.city,
            'region', l.region,
            'isp', l.isp,
            'device', l.device,
            'browser', l.browser,
            'timezone', l.timezone,
            'error_reason', l.error_reason
          )
          ORDER BY l.attempted_at DESC
        )
        FROM (
          SELECT *
          FROM public.login_attempt_logs l2
          WHERE lower(l2.email) = lower(s.email)
          ORDER BY l2.attempted_at DESC
          LIMIT 20
        ) l
      ),
      '[]'::jsonb
    ) AS attempts
  FROM public.login_security_state s
  WHERE s.is_locked = TRUE
     OR s.failed_attempts > 0
     OR s.last_attempt_at >= now() - INTERVAL '7 days'
  ORDER BY s.is_locked DESC, s.last_attempt_at DESC NULLS LAST;
END $$;

-- -----------------------------------------------------------------------------------------
-- 11. RPC SOLO ADMIN: LEVANTAR BLOQUEO DE INTENTOS FALLIDOS
-- -----------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_unlock_user_login(
  p_email TEXT,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(trim(coalesce(p_email, '')));
  v_admin TEXT := coalesce(auth.jwt() ->> 'email', auth.uid()::text, 'Administrador');
BEGIN
  IF NOT public._is_login_security_admin() THEN
    RAISE EXCEPTION 'Permiso denegado para levantar bloqueos de acceso';
  END IF;

  IF v_email = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Correo inválido');
  END IF;

  INSERT INTO public.login_security_state (
    email,
    failed_attempts,
    is_locked,
    locked_at,
    locked_until,
    unlocked_by,
    unlocked_at,
    updated_at
  ) VALUES (
    v_email,
    0,
    FALSE,
    NULL,
    NULL,
    v_admin,
    now(),
    now()
  )
  ON CONFLICT (email) DO UPDATE SET
    failed_attempts = 0,
    is_locked = FALSE,
    locked_at = NULL,
    locked_until = NULL,
    unlocked_by = v_admin,
    unlocked_at = now(),
    updated_at = now();

  INSERT INTO public.login_attempt_logs (
    email,
    attempted_at,
    event_type,
    attempt_number,
    error_reason
  ) VALUES (
    v_email,
    now(),
    'unlocked_by_admin',
    0,
    coalesce(NULLIF(trim(coalesce(p_admin_note, '')), ''), 'Bloqueo levantado manualmente por ' || v_admin)
  );

  RETURN jsonb_build_object('ok', true, 'email', v_email, 'unlocked_by', v_admin);
END $$;

-- -----------------------------------------------------------------------------------------
-- 12. PERMISOS DE EJECUCIÓN DE RPCs
-- -----------------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public._is_login_security_admin() FROM PUBLIC;

REVOKE ALL ON FUNCTION public.check_login_status(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_login_status(TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.handle_failed_login(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_failed_login(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.record_blocked_login_attempt(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_blocked_login_attempt(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.reset_successful_login(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_successful_login(TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_login_lockouts_report() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_login_lockouts_report() TO authenticated;

REVOKE ALL ON FUNCTION public.admin_unlock_user_login(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_unlock_user_login(TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
