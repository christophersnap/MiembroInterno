-- ==============================================================================
-- 14_vehiculos_y_mantenimientos.sql
-- Módulo de Gestión de Vehículos, Flota, Tarjetas de Circulación y Mantenimientos
-- Cruz Verde Salvadoreña
-- ==============================================================================

-- 1. Tabla de Vehículos
CREATE TABLE IF NOT EXISTS public.vehiculos (
  id BIGSERIAL PRIMARY KEY,
  placa TEXT NOT NULL UNIQUE,
  tipo_placa TEXT NOT NULL DEFAULT 'CVS',
  tipo_vehiculo TEXT NOT NULL DEFAULT 'Terrestre', -- 'Terrestre', 'Acuático', 'Aéreo'
  carroceria TEXT NOT NULL DEFAULT 'Ambulancia',    -- 'Ambulancia', 'Pick Up', 'Camioneta', 'SUV', 'Sedán', 'Microbús', 'Camión', 'Motocicleta', 'Bote / Lancha', 'Moto Acuática', 'Helicóptero', 'Otro'
  marca TEXT NOT NULL,
  modelo TEXT NOT NULL,
  anio INTEGER,
  vin TEXT,
  numero_motor TEXT,
  anio_ingreso INTEGER,
  seccional_id INTEGER REFERENCES public.seccionales(id) ON DELETE SET NULL,
  donado BOOLEAN DEFAULT FALSE,
  donante TEXT,
  fecha_donacion DATE,
  combustible TEXT DEFAULT 'Diésel', -- 'Diésel', 'Gasolina Regular', 'Gasolina Especial', 'Híbrido', 'Eléctrico', 'Otro'
  millaje_ingreso NUMERIC(12, 2) DEFAULT 0,
  millaje_actual NUMERIC(12, 2) DEFAULT 0,
  unidad_distancia TEXT DEFAULT 'km', -- 'km' o 'millas'
  numero_tarjeta_circulacion TEXT,
  fecha_vencimiento_tarjeta DATE,
  tarjeta_circulacion_frente_url TEXT,
  tarjeta_circulacion_reverso_url TEXT,
  foto_vehiculo_url TEXT,
  estado TEXT NOT NULL DEFAULT 'Disponible', -- 'Disponible', 'No disponible', 'En reparación', 'En mantenimiento'
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de búsqueda y rendimiento
CREATE INDEX IF NOT EXISTS idx_vehiculos_placa ON public.vehiculos(placa);
CREATE INDEX IF NOT EXISTS idx_vehiculos_seccional ON public.vehiculos(seccional_id);
CREATE INDEX IF NOT EXISTS idx_vehiculos_estado ON public.vehiculos(estado);
CREATE INDEX IF NOT EXISTS idx_vehiculos_tarjeta_vence ON public.vehiculos(fecha_vencimiento_tarjeta);

-- 2. Tabla de Mantenimientos y Reparaciones
CREATE TABLE IF NOT EXISTS public.vehiculo_mantenimientos (
  id BIGSERIAL PRIMARY KEY,
  vehiculo_id BIGINT NOT NULL REFERENCES public.vehiculos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- 'Mantenimiento Preventivo', 'Mantenimiento Correctivo', 'Reparación Mecánica', 'Reparación Eléctrica', 'Cambio de Aceite / Filtros', 'Frenos y Llantas', 'Carrocería y Pintura', 'Otro'
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_entrega DATE,
  millaje NUMERIC(12, 2),
  taller TEXT,
  descripcion TEXT NOT NULL,
  costo NUMERIC(12, 2) DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'Completado', -- 'Completado', 'En proceso', 'Programado'
  factura_url TEXT,
  evidencia_url TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mantenimientos_vehiculo ON public.vehiculo_mantenimientos(vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_mantenimientos_fecha ON public.vehiculo_mantenimientos(fecha);

-- 3. Habilitar RLS
ALTER TABLE public.vehiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehiculo_mantenimientos ENABLE ROW LEVEL SECURITY;

-- 4. Políticas permisivas para usuarios autenticados / anónimos según rol
DROP POLICY IF EXISTS "Permitir lectura vehiculos" ON public.vehiculos;
CREATE POLICY "Permitir lectura vehiculos" ON public.vehiculos
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercion vehiculos" ON public.vehiculos;
CREATE POLICY "Permitir insercion vehiculos" ON public.vehiculos
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion vehiculos" ON public.vehiculos;
CREATE POLICY "Permitir actualizacion vehiculos" ON public.vehiculos
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir eliminacion vehiculos" ON public.vehiculos;
CREATE POLICY "Permitir eliminacion vehiculos" ON public.vehiculos
  FOR DELETE USING (true);

DROP POLICY IF EXISTS "Permitir lectura mantenimientos" ON public.vehiculo_mantenimientos;
CREATE POLICY "Permitir lectura mantenimientos" ON public.vehiculo_mantenimientos
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercion mantenimientos" ON public.vehiculo_mantenimientos;
CREATE POLICY "Permitir insercion mantenimientos" ON public.vehiculo_mantenimientos
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion mantenimientos" ON public.vehiculo_mantenimientos;
CREATE POLICY "Permitir actualizacion mantenimientos" ON public.vehiculo_mantenimientos
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir eliminacion mantenimientos" ON public.vehiculo_mantenimientos;
CREATE POLICY "Permitir eliminacion mantenimientos" ON public.vehiculo_mantenimientos
  FOR DELETE USING (true);

-- 5. Recargar esquema PostgREST
NOTIFY pgrst, 'reload schema';
