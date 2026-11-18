import { supabase } from '../lib/supabase';

export interface DependienteItem {
  nombre: string;
  parentesco: string;
}

export interface ConoceSocorristaExtraData {
  nit: string; // Opcional (puede ser el mismo DUI o NIT de 14 dígitos o vacío)
  estado_civil: string;
  nombre_conyuge: string;
  nombre_dependientes: string;
  dependientes_detalle: DependienteItem[];
  nacionalidad: string;
  profesion_ocupacion: string;
  fecha_inicio_relacion_laboral: string;
  direccion_domicilio: string;
  cargo_publico_ultimos_5_anios: boolean | null;
  cargo_publico_periodo: string;
  cargo_publico_posicion: string;
  email_override?: string;
  direccion_override?: string;
}

export const PARENTESCOS_DEPENDIENTES_OPTIONS = [
  'Hijo(a)',
  'Cónyuge / Compañero(a)',
  'Madre',
  'Padre',
  'Hermano(a)',
  'Abuelo(a)',
  'Nieto(a)',
  'Sobrino(a)',
  'Otro familiar',
];

export const ESTADOS_CIVILES_OPTIONS = [
  'Soltero(a)',
  'Casado(a)',
  'Acompañado(a) / Unión no matrimonial',
  'Divorciado(a)',
  'Viudo(a)',
];

export const EMPTY_CONOCE_SOCORRISTA_DATA: ConoceSocorristaExtraData = {
  nit: '',
  estado_civil: '',
  nombre_conyuge: '',
  nombre_dependientes: '',
  dependientes_detalle: [],
  nacionalidad: 'Salvadoreña',
  profesion_ocupacion: '',
  fecha_inicio_relacion_laboral: '',
  direccion_domicilio: '',
  cargo_publico_ultimos_5_anios: null,
  cargo_publico_periodo: '',
  cargo_publico_posicion: '',
};

export function isNoDependentsText(text?: string | null): boolean {
  const norm = String(text || '').trim().toLowerCase();
  return (
    norm === 'ninguno' ||
    norm === 'no aplica' ||
    norm === 'ninguno / no aplica' ||
    norm === 'n/a' ||
    norm === 'sin dependientes'
  );
}

export function formatDependientesDetalleToText(items: DependienteItem[]): string {
  const valid = (items || [])
    .map((d) => ({
      nombre: String(d?.nombre || '').trim(),
      parentesco: String(d?.parentesco || '').trim(),
    }))
    .filter((d) => d.nombre !== '');

  if (valid.length === 0) return '';
  return valid
    .map((d) => (d.parentesco ? `${d.nombre} (${d.parentesco})` : d.nombre))
    .join(', ');
}

export function parseDependientesFromRow(
  rawDetalle: any,
  rawText?: string | null
): DependienteItem[] {
  if (Array.isArray(rawDetalle) && rawDetalle.length > 0) {
    return rawDetalle
      .map((item: any) => ({
        nombre: String(item?.nombre || '').trim(),
        parentesco: String(item?.parentesco || 'Hijo(a)').trim(),
      }))
      .filter((d) => d.nombre !== '');
  }

  if (typeof rawDetalle === 'string' && rawDetalle.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(rawDetalle);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item: any) => ({
            nombre: String(item?.nombre || '').trim(),
            parentesco: String(item?.parentesco || 'Hijo(a)').trim(),
          }))
          .filter((d) => d.nombre !== '');
      }
    } catch {}
  }

  const text = String(rawText || '').trim();
  if (!text || isNoDependentsText(text)) return [];

  // Parsear texto tipo "Ana Pérez (Hijo(a)), Carlos Pérez (Madre)"
  return text
    .split(/[,;\n]+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const match = chunk.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
      if (match) {
        return {
          nombre: match[1].trim(),
          parentesco: match[2].trim() || 'Hijo(a)',
        };
      }
      return {
        nombre: chunk,
        parentesco: 'Hijo(a)',
      };
    })
    .filter((d) => d.nombre !== '');
}

export function extractKycFromSocorrista(
  row: any,
  backupJson?: Partial<ConoceSocorristaExtraData> | null
): ConoceSocorristaExtraData {
  const b = backupJson || {};
  const pickStr = (dbVal: any, bVal: any, fallback = '') => {
    if (typeof dbVal === 'string' && dbVal.trim() !== '') return dbVal;
    if (typeof bVal === 'string' && bVal.trim() !== '') return bVal;
    return fallback;
  };

  let cargoPublico: boolean | null = null;
  if (typeof row?.cargo_publico_ultimos_5_anios === 'boolean') {
    cargoPublico = row.cargo_publico_ultimos_5_anios;
  } else if (typeof b.cargo_publico_ultimos_5_anios === 'boolean') {
    cargoPublico = b.cargo_publico_ultimos_5_anios;
  }

  const nombreDepText = pickStr(row?.nombre_dependientes, b.nombre_dependientes, '');
  const depDetalle = parseDependientesFromRow(
    row?.dependientes_detalle ?? b.dependientes_detalle,
    nombreDepText
  );

  return {
    nit: pickStr(row?.nit, b.nit, ''),
    estado_civil: pickStr(row?.estado_civil, b.estado_civil, ''),
    nombre_conyuge: pickStr(row?.nombre_conyuge, b.nombre_conyuge, ''),
    nombre_dependientes:
      nombreDepText || (depDetalle.length > 0 ? formatDependientesDetalleToText(depDetalle) : ''),
    dependientes_detalle: depDetalle,
    nacionalidad: pickStr(row?.nacionalidad, b.nacionalidad, ''),
    profesion_ocupacion: pickStr(row?.profesion_ocupacion, b.profesion_ocupacion, ''),
    fecha_inicio_relacion_laboral: pickStr(
      row?.fecha_inicio_relacion_laboral,
      b.fecha_inicio_relacion_laboral,
      ''
    ),
    direccion_domicilio: pickStr(row?.direccion_domicilio, b.direccion_domicilio, ''),
    cargo_publico_ultimos_5_anios: cargoPublico,
    cargo_publico_periodo: pickStr(row?.cargo_publico_periodo, b.cargo_publico_periodo, ''),
    cargo_publico_posicion: pickStr(row?.cargo_publico_posicion, b.cargo_publico_posicion, ''),
  };
}

export interface KycValidationResult {
  isComplete: boolean;
  missingFields: string[];
}

function getEffectiveDependientesText(merged: ConoceSocorristaExtraData): string {
  if (Array.isArray(merged.dependientes_detalle) && merged.dependientes_detalle.length > 0) {
    const formatted = formatDependientesDetalleToText(merged.dependientes_detalle);
    if (formatted) return formatted;
  }
  return String(merged.nombre_dependientes || '').trim();
}

/**
 * Valida si un registro tiene todos los campos requeridos para imprimir CVSSOCC/FORM001.
 * Nota: NIT es explícitamente OPCIONAL.
 */
export function validateConoceSocorrista(
  socorrista: any,
  extraOverride?: Partial<ConoceSocorristaExtraData>
): KycValidationResult {
  const merged: ConoceSocorristaExtraData = {
    ...extractKycFromSocorrista(socorrista),
    ...(extraOverride || {}),
  };

  const missing: string[] = [];

  if (
    !String(socorrista?.primer_nombre || '').trim() ||
    !String(socorrista?.primer_apellido || '').trim()
  ) {
    missing.push('Nombre completo');
  }
  if (!String(socorrista?.direccion || extraOverride?.direccion_override || '').trim()) {
    missing.push('Dirección');
  }
  if (!String(socorrista?.dui || '').trim()) {
    missing.push('DUI');
  }
  if (!String(merged.estado_civil || '').trim()) {
    missing.push('Estado civil');
  }
  if (!String(socorrista?.fecha_nacimiento || '').trim()) {
    missing.push('Fecha de nacimiento');
  }
  if (!String(socorrista?.telefono || '').trim()) {
    missing.push('Teléfono');
  }
  if (!String(merged.nombre_conyuge || '').trim()) {
    missing.push('Nombre de cónyuge');
  }

  const effectiveDep = getEffectiveDependientesText(merged);
  if (!effectiveDep) {
    missing.push('Dependientes (o marcar "Sin dependientes")');
  } else if (
    Array.isArray(merged.dependientes_detalle) &&
    merged.dependientes_detalle.some((d) => !String(d.nombre || '').trim() || !String(d.parentesco || '').trim())
  ) {
    missing.push('Nombre y parentesco de cada dependiente');
  }

  if (!String(merged.nacionalidad || '').trim()) {
    missing.push('Nacionalidad');
  }
  if (!String(merged.profesion_ocupacion || '').trim()) {
    missing.push('Profesión u ocupación');
  }
  if (!String(merged.fecha_inicio_relacion_laboral || '').trim()) {
    missing.push('Fecha de inicio laboral / ingreso');
  }
  if (!String(merged.direccion_domicilio || '').trim()) {
    missing.push('Dirección de domicilio');
  }
  if (
    merged.cargo_publico_ultimos_5_anios === null ||
    merged.cargo_publico_ultimos_5_anios === undefined
  ) {
    missing.push('Cargo público en últimos 5 años (Sí / No)');
  } else if (merged.cargo_publico_ultimos_5_anios === true) {
    if (!String(merged.cargo_publico_periodo || '').trim()) {
      missing.push('Periodo del cargo público');
    }
    if (!String(merged.cargo_publico_posicion || '').trim()) {
      missing.push('Posición del cargo público');
    }
  }

  return {
    isComplete: missing.length === 0,
    missingFields: missing,
  };
}

export function validateOnlyExtraKycFields(extra: ConoceSocorristaExtraData): KycValidationResult {
  const missing: string[] = [];

  if (!String(extra.estado_civil || '').trim()) missing.push('Estado civil');
  if (!String(extra.nombre_conyuge || '').trim()) missing.push('Nombre de cónyuge');

  const effectiveDep = getEffectiveDependientesText(extra);
  if (!effectiveDep) {
    missing.push('Dependientes');
  } else if (
    Array.isArray(extra.dependientes_detalle) &&
    extra.dependientes_detalle.some((d) => !String(d.nombre || '').trim() || !String(d.parentesco || '').trim())
  ) {
    missing.push('Nombre y parentesco de cada dependiente');
  }

  if (!String(extra.nacionalidad || '').trim()) missing.push('Nacionalidad');
  if (!String(extra.profesion_ocupacion || '').trim()) missing.push('Profesión u ocupación');
  if (!String(extra.fecha_inicio_relacion_laboral || '').trim()) {
    missing.push('Fecha de inicio de relación laboral');
  }
  if (!String(extra.direccion_domicilio || '').trim()) missing.push('Dirección de domicilio');

  if (
    extra.cargo_publico_ultimos_5_anios === null ||
    extra.cargo_publico_ultimos_5_anios === undefined
  ) {
    missing.push('Cargo público en últimos 5 años (Sí / No)');
  } else if (extra.cargo_publico_ultimos_5_anios === true) {
    if (!String(extra.cargo_publico_periodo || '').trim()) {
      missing.push('Periodo del cargo público');
    }
    if (!String(extra.cargo_publico_posicion || '').trim()) {
      missing.push('Posición del cargo público');
    }
  }

  return {
    isComplete: missing.length === 0,
    missingFields: missing,
  };
}

export async function fetchAllSocorristasKycBackupMap(): Promise<
  Record<number, Partial<ConoceSocorristaExtraData>>
> {
  const map: Record<number, Partial<ConoceSocorristaExtraData>> = {};
  try {
    const { data } = await supabase
      .from('configuracion')
      .select('clave, valor')
      .like('clave', 'socorrista_kyc_%');

    if (Array.isArray(data)) {
      data.forEach((row) => {
        const idNum = Number(String(row.clave || '').replace('socorrista_kyc_', ''));
        if (!Number.isNaN(idNum) && row.valor) {
          try {
            map[idNum] = JSON.parse(row.valor);
          } catch {}
        }
      });
    }
  } catch {}
  return map;
}

export async function fetchSingleSocorristaKycBackup(
  socorristaId: number | string
): Promise<Partial<ConoceSocorristaExtraData> | null> {
  try {
    const { data } = await supabase
      .from('configuracion')
      .select('valor')
      .eq('clave', `socorrista_kyc_${socorristaId}`)
      .maybeSingle();

    if (data?.valor) {
      return typeof data.valor === 'string' ? JSON.parse(data.valor) : data.valor;
    }
  } catch {}
  return null;
}

export async function saveSocorristaKycData(
  socorristaId: number | string,
  extra: ConoceSocorristaExtraData,
  optionalBaseUpdates?: { email?: string; direccion?: string }
): Promise<{ savedInTable: boolean }> {
  const nowIso = new Date().toISOString();
  const cleanDetalle = (extra.dependientes_detalle || [])
    .map((d) => ({
      nombre: String(d?.nombre || '').trim(),
      parentesco: String(d?.parentesco || 'Hijo(a)').trim(),
    }))
    .filter((d) => d.nombre !== '');

  const syncedNombreDependientes =
    cleanDetalle.length > 0
      ? formatDependientesDetalleToText(cleanDetalle)
      : extra.nombre_dependientes?.trim() || null;

  const normalizedExtra: ConoceSocorristaExtraData = {
    ...extra,
    dependientes_detalle: cleanDetalle,
    nombre_dependientes: syncedNombreDependientes || '',
  };

  const extraCheck = validateOnlyExtraKycFields(normalizedExtra);

  const cleanPayload: Record<string, any> = {
    nit: normalizedExtra.nit?.trim() || null,
    estado_civil: normalizedExtra.estado_civil?.trim() || null,
    nombre_conyuge: normalizedExtra.nombre_conyuge?.trim() || null,
    nombre_dependientes: syncedNombreDependientes,
    dependientes_detalle: cleanDetalle,
    nacionalidad: normalizedExtra.nacionalidad?.trim() || null,
    profesion_ocupacion: normalizedExtra.profesion_ocupacion?.trim() || null,
    fecha_inicio_relacion_laboral: normalizedExtra.fecha_inicio_relacion_laboral?.trim() || null,
    direccion_domicilio: normalizedExtra.direccion_domicilio?.trim() || null,
    cargo_publico_ultimos_5_anios: normalizedExtra.cargo_publico_ultimos_5_anios,
    cargo_publico_periodo:
      normalizedExtra.cargo_publico_ultimos_5_anios === true
        ? normalizedExtra.cargo_publico_periodo?.trim() || null
        : normalizedExtra.cargo_publico_ultimos_5_anios === false
        ? 'No aplica'
        : null,
    cargo_publico_posicion:
      normalizedExtra.cargo_publico_ultimos_5_anios === true
        ? normalizedExtra.cargo_publico_posicion?.trim() || null
        : normalizedExtra.cargo_publico_ultimos_5_anios === false
        ? 'No aplica'
        : null,
    ficha_kyc_completada: extraCheck.isComplete,
    ficha_kyc_actualizada_at: nowIso,
    ...(optionalBaseUpdates?.email !== undefined ? { email: optionalBaseUpdates.email.trim() } : {}),
    ...(optionalBaseUpdates?.direccion !== undefined
      ? { direccion: optionalBaseUpdates.direccion.trim() }
      : {}),
  };

  // 1. Guardar respaldo garantizado en configuracion
  const clave = `socorrista_kyc_${socorristaId}`;
  const serialized = JSON.stringify({
    ...normalizedExtra,
    cargo_publico_periodo: cleanPayload.cargo_publico_periodo || '',
    cargo_publico_posicion: cleanPayload.cargo_publico_posicion || '',
    ficha_kyc_completada: extraCheck.isComplete,
    updated_at: nowIso,
  });

  try {
    const { data: existing } = await supabase
      .from('configuracion')
      .select('id')
      .eq('clave', clave)
      .maybeSingle();

    if (existing) {
      await supabase.from('configuracion').update({ valor: serialized }).eq('id', existing.id);
    } else {
      await supabase.from('configuracion').insert([{ clave, valor: serialized }]);
    }
  } catch (err) {
    console.warn('Respaldo configuracion KYC omitido:', err);
  }

  // 2. Guardar directamente en public.socorristas (con fallback si dependientes_detalle aún no se migró)
  try {
    const { error } = await supabase
      .from('socorristas')
      .update(cleanPayload)
      .eq('id', socorristaId);

    if (!error) {
      return { savedInTable: true };
    }

    if (
      error.code === '42703' ||
      error.code === 'PGRST204' ||
      String(error.message || '').includes('dependientes_detalle')
    ) {
      const { dependientes_detalle: _omitDetalle, ...withoutDetalle } = cleanPayload;
      const { error: retryErr } = await supabase
        .from('socorristas')
        .update(withoutDetalle)
        .eq('id', socorristaId);
      if (!retryErr) {
        return { savedInTable: true };
      }
    }

    if (
      optionalBaseUpdates &&
      (optionalBaseUpdates.email !== undefined || optionalBaseUpdates.direccion !== undefined)
    ) {
      await supabase
        .from('socorristas')
        .update({
          ...(optionalBaseUpdates.email !== undefined
            ? { email: optionalBaseUpdates.email.trim() }
            : {}),
          ...(optionalBaseUpdates.direccion !== undefined
            ? { direccion: optionalBaseUpdates.direccion.trim() }
            : {}),
        })
        .eq('id', socorristaId);
    }
  } catch {}

  return { savedInTable: false };
}

export function formatNitOrDuiInput(val: string): string {
  const cleaned = val.replace(/[^0-9-]/g, '');
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length <= 9 && !cleaned.includes('--')) {
    if (digits.length <= 8) return digits;
    return `${digits.slice(0, 8)}-${digits.slice(8, 9)}`;
  }
  const d = digits.slice(0, 14);
  if (d.length <= 4) return d;
  if (d.length <= 10) return `${d.slice(0, 4)}-${d.slice(4)}`;
  if (d.length <= 13) return `${d.slice(0, 4)}-${d.slice(4, 10)}-${d.slice(10)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 10)}-${d.slice(10, 13)}-${d.slice(13, 14)}`;
}

export function jpegDataUrlToLetterPdfBlob(
  jpegDataUrl: string,
  imgWidthPx: number,
  imgHeightPx: number
): Blob {
  const base64 = jpegDataUrl.split(',')[1] || '';
  const binaryStr = atob(base64);
  const jpegBytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    jpegBytes[i] = binaryStr.charCodeAt(i);
  }

  const pageWidth = 612;
  const pageHeight = 792;

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let byteLength = 0;

  const pushStr = (s: string) => {
    const arr = encoder.encode(s);
    chunks.push(arr);
    byteLength += arr.byteLength;
  };
  const pushBytes = (arr: Uint8Array) => {
    chunks.push(arr);
    byteLength += arr.byteLength;
  };
  const startObj = (id: number) => {
    offsets[id] = byteLength;
    pushStr(`${id} 0 obj\n`);
  };
  const endObj = () => {
    pushStr('\nendobj\n');
  };

  pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  startObj(1);
  pushStr('<< /Type /Catalog /Pages 2 0 R >>');
  endObj();

  startObj(2);
  pushStr('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  endObj();

  startObj(3);
  pushStr(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`
  );
  endObj();

  startObj(4);
  pushStr(
    `<< /Type /XObject /Subtype /Image /Width ${Math.round(imgWidthPx)} /Height ${Math.round(
      imgHeightPx
    )} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.byteLength} >>\nstream\n`
  );
  pushBytes(jpegBytes);
  pushStr('\nendstream');
  endObj();

  const contentStream = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ\n`;
  const contentBytes = encoder.encode(contentStream);
  startObj(5);
  pushStr(`<< /Length ${contentBytes.byteLength} >>\nstream\n`);
  pushBytes(contentBytes);
  pushStr('endstream');
  endObj();

  const xrefOffset = byteLength;
  pushStr('xref\n0 6\n0000000000 65535 f \n');
  for (let i = 1; i <= 5; i++) {
    const padded = String(offsets[i]).padStart(10, '0');
    pushStr(`${padded} 00000 n \n`);
  }

  pushStr(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return new Blob(chunks, { type: 'application/pdf' });
}

export const SQL_MIGRATION_48_TEXT = `-- =========================================================================================
-- MIGRACIÓN 48: CAMPOS ADICIONALES PARA FICHA OFICIAL "CONOCE A TU SOCORRISTA" (CVSSOCC/FORM001)
-- =========================================================================================

ALTER TABLE public.socorristas
  ADD COLUMN IF NOT EXISTS nit TEXT,
  ADD COLUMN IF NOT EXISTS estado_civil TEXT,
  ADD COLUMN IF NOT EXISTS nombre_conyuge TEXT,
  ADD COLUMN IF NOT EXISTS nombre_dependientes TEXT,
  ADD COLUMN IF NOT EXISTS dependientes_detalle JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS nacionalidad TEXT,
  ADD COLUMN IF NOT EXISTS profesion_ocupacion TEXT,
  ADD COLUMN IF NOT EXISTS fecha_inicio_relacion_laboral TEXT,
  ADD COLUMN IF NOT EXISTS direccion_domicilio TEXT,
  ADD COLUMN IF NOT EXISTS cargo_publico_ultimos_5_anios BOOLEAN,
  ADD COLUMN IF NOT EXISTS cargo_publico_periodo TEXT,
  ADD COLUMN IF NOT EXISTS cargo_publico_posicion TEXT,
  ADD COLUMN IF NOT EXISTS ficha_kyc_completada BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ficha_kyc_actualizada_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_socorristas_ficha_kyc_completada
  ON public.socorristas (ficha_kyc_completada);

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.socorristas TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.socorristas TO authenticated;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';`;

export const SQL_MIGRATION_49_TEXT = `-- =========================================================================================
-- MIGRACIÓN 49: DEPENDIENTES CON PARENTESCO (CVSSOCC/FORM001) Y ESTABILIDAD DE SCHEMA CACHE
-- =========================================================================================

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

ALTER TABLE public.socorristas
  ADD COLUMN IF NOT EXISTS nit TEXT,
  ADD COLUMN IF NOT EXISTS estado_civil TEXT,
  ADD COLUMN IF NOT EXISTS nombre_conyuge TEXT,
  ADD COLUMN IF NOT EXISTS nombre_dependientes TEXT,
  ADD COLUMN IF NOT EXISTS dependientes_detalle JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS nacionalidad TEXT,
  ADD COLUMN IF NOT EXISTS profesion_ocupacion TEXT,
  ADD COLUMN IF NOT EXISTS fecha_inicio_relacion_laboral TEXT,
  ADD COLUMN IF NOT EXISTS direccion_domicilio TEXT,
  ADD COLUMN IF NOT EXISTS cargo_publico_ultimos_5_anios BOOLEAN,
  ADD COLUMN IF NOT EXISTS cargo_publico_periodo TEXT,
  ADD COLUMN IF NOT EXISTS cargo_publico_posicion TEXT,
  ADD COLUMN IF NOT EXISTS ficha_kyc_completada BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ficha_kyc_actualizada_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_socorristas_ficha_kyc_completada
  ON public.socorristas (ficha_kyc_completada);

GRANT SELECT ON TABLE public.socorristas TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.socorristas TO authenticated;
GRANT SELECT ON TABLE public.seccionales TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';`;
