-- ============================================================================
-- MIGRACIÓN 52: OPTIMIZACIÓN DE ÍNDICES PARA CONSULTAS LIGERAS Y ACTIVIDAD
-- Cruz Verde Salvadoreña - Sistema Institucional
-- ============================================================================
-- Propósito:
-- 1. Acelerar las consultas de actividad por ventana temporal (3h, 6h, 12h,
--    actividad diaria y rangos históricos) evitando recorridos completos.
-- 2. Crear índices parciales únicamente sobre solicitudes activas/pendientes
--    para que las notificaciones del menú consuman una fracción mínima de CPU.
-- 3. Optimizar búsquedas por prefijo en configuracion y búsquedas por correo
--    y seccional en socorristas.
-- 4. Actualizar estadísticas del planificador (ANALYZE) sin recargar esquema.
-- ============================================================================

-- 1. Índices para public.activity_logs (consultas por período temporal y usuario)
DO $$
BEGIN
  IF to_regclass('public.activity_logs') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
      ON public.activity_logs (created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created
      ON public.activity_logs (user_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_created
      ON public.activity_logs (entity_type, created_at DESC);

    ANALYZE public.activity_logs;
  END IF;
END $$;

-- 2. Índices parciales para notificaciones de solicitudes activas (combustible, compra, carnet, soporte)
DO $$
BEGIN
  IF to_regclass('public.solicitudes_combustible') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_sol_combustible_activas_created
      ON public.solicitudes_combustible (estado, created_at DESC)
      WHERE estado IN ('Pendiente', 'En Proceso', 'En Proceso de Compra');
    ANALYZE public.solicitudes_combustible;
  END IF;

  IF to_regclass('public.solicitudes_compra') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_sol_compra_activas_created
      ON public.solicitudes_compra (estado, created_at DESC)
      WHERE estado IN ('Pendiente', 'En Proceso', 'En Proceso de Compra');
    ANALYZE public.solicitudes_compra;
  END IF;

  IF to_regclass('public.solicitudes_carnet') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_sol_carnet_activas_fecha
      ON public.solicitudes_carnet (estado_solicitud, fecha_solicitud DESC)
      WHERE estado_solicitud IN ('Pendiente', 'En revisión', 'Observada');
    ANALYZE public.solicitudes_carnet;
  END IF;

  IF to_regclass('public.soporte_tickets') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_soporte_tickets_activos_created
      ON public.soporte_tickets (estado, created_at DESC)
      WHERE estado IN ('Pendiente', 'En revisión');
    ANALYZE public.soporte_tickets;
  END IF;
END $$;

-- 3. Índices de apoyo para lecturas por usuario, configuración y socorristas
DO $$
BEGIN
  IF to_regclass('public.solicitudes_lecturas') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_solicitudes_lecturas_user_modulo
      ON public.solicitudes_lecturas (user_id, modulo);
    ANALYZE public.solicitudes_lecturas;
  END IF;

  IF to_regclass('public.configuracion') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_configuracion_clave_pattern
      ON public.configuracion (clave text_pattern_ops);
    ANALYZE public.configuracion;
  END IF;

  IF to_regclass('public.socorristas') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_socorristas_seccional_id
      ON public.socorristas (seccional_id);
    CREATE INDEX IF NOT EXISTS idx_socorristas_email
      ON public.socorristas (email);
    ANALYZE public.socorristas;
  END IF;
END $$;
