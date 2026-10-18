ALTER TABLE public.socorristas
ADD COLUMN IF NOT EXISTS motorista_autorizado BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS licencia_vehiculo_numero TEXT,
ADD COLUMN IF NOT EXISTS licencia_vehiculo_clase TEXT,
ADD COLUMN IF NOT EXISTS licencia_vehiculo_vencimiento DATE,
ADD COLUMN IF NOT EXISTS licencia_moto_numero TEXT,
ADD COLUMN IF NOT EXISTS licencia_moto_vencimiento DATE;
