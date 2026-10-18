-- =========================================================================
-- MIGRACIÓN 27: CONFIGURACIÓN SMTP OFICIAL DE HOSTINGER
-- Cruz Verde Salvadoreña - Sistema Institucional de Notificaciones
-- =========================================================================

-- Esta migración establece la configuración de Hostinger como servidor SMTP
-- predeterminado para el envío de correos oficiales (Alertas, Notificaciones,
-- Solicitudes de Compra y Combustible).

-- 1. Tabla configuracion (PostgreSQL / Supabase)
-- Se asegura que los registros existan o se actualicen con los valores de Hostinger

INSERT INTO public.configuracion (clave, valor)
VALUES 
  ('smtp_host', 'smtp.hostinger.com'),
  ('smtp_port', '465'),
  ('smtp_secure', 'true'),
  ('smtp_user', 'notificaciones@cruzverdesv.org'),
  ('smtp_from', 'Cruz Verde Salvadoreña (No Responder) <notificaciones@cruzverdesv.org>'),
  ('smtp_from_name', 'Cruz Verde Salvadoreña (No Responder)'),
  ('email_remitente_global', 'notificaciones@cruzverdesv.org'),
  ('email_remitente_nombre', 'Cruz Verde Salvadoreña (No Responder)')
ON CONFLICT (clave) 
DO UPDATE SET 
  valor = EXCLUDED.valor,
  updated_at = NOW();

-- NOTA PARA CONTRASEÑA EN PRODUCCIÓN:
-- Si deseas guardar la contraseña SMTP directamente en la base de datos de Supabase, ejecuta:
-- INSERT INTO public.configuracion (clave, valor)
-- VALUES ('smtp_pass', 'TU_CONTRASEÑA_DE_HOSTINGER_AQUÍ')
-- ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = NOW();

-- 2. Versión para SQLite (cruzverde.db local)
-- INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('smtp_host', 'smtp.hostinger.com');
-- INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('smtp_port', '465');
-- INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('smtp_secure', 'true');
-- INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('smtp_user', 'notificaciones@cruzverdesv.org');
-- INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('smtp_from', 'Cruz Verde Salvadoreña (No Responder) <notificaciones@cruzverdesv.org>');
-- INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('smtp_from_name', 'Cruz Verde Salvadoreña (No Responder)');
