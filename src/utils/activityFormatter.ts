/**
 * Formateador en lenguaje humano claro para los registros de Actividad y Auditoría.
 * Convierte eventos históricos y actuales (incluyendo JSON técnicos) en descripciones
 * legibles en español indicando claramente qué hizo el usuario y sobre qué registro.
 */

export interface ActivityLogRecord {
  id: string | number;
  user_id?: string;
  user_email?: string;
  action: string;
  entity_type?: string;
  entity_id?: string | null;
  details?: any;
  created_at: string;
  user_nombre?: string;
}

export interface FormattedDetailField {
  label: string;
  value: string;
}

export interface HumanActivityResult {
  actionLabel: string;
  entityLabel: string;
  summary: string;
  fields: FormattedDetailField[];
  category: 'sesion' | 'usuarios' | 'socorristas' | 'solicitudes' | 'seccionales' | 'sistema';
}

const EXCEL_PRESET_LABELS: Record<string, string> = {
  filtro_actual: 'Filtro actual',
  todos: 'Todo el personal',
  activos: 'Solo activos',
  inactivos: 'Solo inactivos',
  con_carnet: 'Con carnet digital',
  sin_carnet: 'Sin carnet digital',
  con_foto: 'Con fotografía',
  sin_foto: 'Sin fotografía',
  motoristas: 'Conductores autorizados',
  ficha_completa: 'Ficha Conoce a tu Socorrista completa',
  ficha_pendiente: 'Ficha Conoce a tu Socorrista pendiente',
};

const SCOPE_LABELS: Record<string, string> = {
  global: 'Nivel Global (todas las seccionales)',
  seccional: 'Por Seccional',
  usuario: 'Solo propios',
};

const FIELD_LABELS: Record<string, string> = {
  nombre_usuario: 'Usuario afectado',
  usuario: 'Usuario',
  usuario_email: 'Correo del usuario',
  email: 'Correo electrónico',
  rol: 'Rol asignado',
  nuevo_rol: 'Nuevo rol',
  rol_anterior: 'Rol anterior',
  basado_en: 'Permisos copiados de',
  cantidad_permisos_activos: 'Permisos activos',
  nombre: 'Nombre',
  nombre_completo: 'Nombre completo',
  socorrista: 'Socorrista',
  socorrista_nombre: 'Socorrista',
  carnet: 'Carnet',
  seccional: 'Seccional',
  seccional_nombre: 'Seccional',
  correo: 'Correo institucional',
  estado: 'Estado',
  estado_anterior: 'Estado anterior',
  nuevo_estado: 'Nuevo estado',
  folio: 'Folio',
  titulo: 'Título',
  asunto: 'Asunto',
  tipo: 'Tipo',
  tipo_reporte: 'Tipo de reporte',
  cantidad: 'Registros exportados',
  extendido: 'Campos extendidos',
  placa: 'Placa',
  marca: 'Marca',
  modelo: 'Modelo',
  categoria: 'Categoría',
  modulo: 'Módulo',
  metodo: 'Método de acceso',
  dispositivo: 'Dispositivo',
  navegador: 'Navegador',
  copiado_de: 'Accesos copiados de',
  correo_plano_enviado: 'Correo de notificación enviado',
  can_upload_files: 'Subir archivos institucionales',
  activado: 'Estado del ajuste',
  destinatario: 'Destinatario',
  motivo: 'Motivo',
  notas: 'Notas',
  respuesta_admin: 'Nota de resolución',
  descripcion: 'Descripción',
  curso: 'Curso',
  socorrista_id: 'ID de Socorrista',
  instructor_id: 'ID de Instructor',
  total_elementos: 'Elementos incluidos',
  monto: 'Monto',
  total: 'Total',
  galones: 'Galones',
};

const IGNORED_KEYS = new Set([
  'user_nombre',
  'creado_sql_directo',
  'custom_permissions',
  'permisos',
]);

function normalizeDetails(details: any): Record<string, any> {
  if (!details) return {};
  if (typeof details === 'string') {
    try {
      const parsed = JSON.parse(details);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      return { descripcion: details };
    }
  }
  if (typeof details === 'object') return details;
  return {};
}

function humanizeAction(rawAction: string, entityType?: string): string {
  const act = (rawAction || '').trim();
  const lower = act.toLowerCase();
  const ent = (entityType || '').toLowerCase();

  if (lower === 'create') {
    if (ent.includes('anuncio')) return 'Publicó un anuncio';
    if (ent.includes('noticia')) return 'Publicó una noticia';
    if (ent.includes('soporte')) return 'Creó solicitud de soporte';
    return `Creó registro en ${entityType || 'el sistema'}`;
  }
  if (lower === 'update') {
    if (ent.includes('anuncio')) return 'Actualizó un anuncio';
    if (ent.includes('noticia')) return 'Actualizó una noticia';
    if (ent.includes('soporte')) return 'Actualizó solicitud de soporte';
    return `Actualizó registro en ${entityType || 'el sistema'}`;
  }
  if (lower === 'delete') {
    if (ent.includes('anuncio')) return 'Eliminó un anuncio';
    if (ent.includes('noticia')) return 'Eliminó una noticia';
    if (ent.includes('soporte')) return 'Eliminó solicitud de soporte';
    return `Eliminó registro en ${entityType || 'el sistema'}`;
  }
  return act || 'Acción registrada';
}

function humanizeEntity(rawEntity?: string): string {
  const ent = (rawEntity || '').trim();
  const map: Record<string, string> = {
    SolicitudCompra: 'Solicitud de Compra',
    SolicitudCombustible: 'Solicitud de Combustible',
    SolicitudCarnet: 'Solicitud de Carnet',
    Configuracion: 'Configuración',
    'Noticias Banner': 'Noticias',
    Sesion: 'Sesión',
    Sesión: 'Sesión',
  };
  return map[ent] || ent || 'Sistema';
}

function classifyCategory(action: string, entityType?: string): HumanActivityResult['category'] {
  const a = (action || '').toLowerCase();
  const e = (entityType || '').toLowerCase();

  if (
    e.includes('sesi') ||
    a.includes('inició sesión') ||
    a.includes('inicio de sesión') ||
    a.includes('cerró sesión')
  ) {
    return 'sesion';
  }
  if (e.includes('usuario') || e.includes('rol') || a.includes('rol') || a.includes('usuario')) {
    return 'usuarios';
  }
  if (e.includes('socorrista') || e.includes('curso') || e.includes('mérito') || e.includes('merito')) {
    return 'socorristas';
  }
  if (e.includes('solicitud') || e.includes('soporte')) {
    return 'solicitudes';
  }
  if (e.includes('seccional') || e.includes('vehículo') || e.includes('vehiculo') || e.includes('mantenimiento')) {
    return 'seccionales';
  }
  return 'sistema';
}

function formatBoolean(val: boolean): string {
  return val ? 'Sí' : 'No';
}

function summarizeCustomPermissions(customPerms: Record<string, any>): string {
  if (!customPerms || typeof customPerms !== 'object') return '';
  const parts: string[] = [];

  const boolKeys = Object.keys(customPerms).filter((k) => typeof customPerms[k] === 'boolean');
  const enabledCount = boolKeys.filter((k) => customPerms[k] === true).length;
  const disabledCount = boolKeys.filter((k) => customPerms[k] === false).length;

  if (enabledCount > 0 || disabledCount > 0) {
    const segs: string[] = [];
    if (enabledCount > 0) segs.push(`${enabledCount} habilitado${enabledCount === 1 ? '' : 's'}`);
    if (disabledCount > 0) segs.push(`${disabledCount} restringido${disabledCount === 1 ? '' : 's'}`);
    parts.push(`Permisos personalizados: ${segs.join(', ')}`);
  }

  const scopes = customPerms._module_scopes;
  if (scopes && typeof scopes === 'object') {
    const scopeLabels: string[] = [];
    if (scopes.soporte) scopeLabels.push(`Soporte (${SCOPE_LABELS[scopes.soporte] || scopes.soporte})`);
    if (scopes.solicitudes_compra) scopeLabels.push(`Compras (${SCOPE_LABELS[scopes.solicitudes_compra] || scopes.solicitudes_compra})`);
    if (scopes.solicitudes_combustible) scopeLabels.push(`Combustible (${SCOPE_LABELS[scopes.solicitudes_combustible] || scopes.solicitudes_combustible})`);
    if (scopes.solicitudes_carnet) scopeLabels.push(`Carnet (${SCOPE_LABELS[scopes.solicitudes_carnet] || scopes.solicitudes_carnet})`);
    if (scopes.formularios) scopeLabels.push(`Formularios (${SCOPE_LABELS[scopes.formularios] || scopes.formularios})`);
    if (scopeLabels.length > 0) {
      parts.push(`Alcances: ${scopeLabels.join(' · ')}`);
    }
  }

  const secAccess = customPerms._seccionales_socorristas;
  if (secAccess && typeof secAccess === 'object') {
    if (secAccess.mode === 'all') {
      parts.push('Personal: acceso a todas las seccionales');
    } else if (secAccess.mode === 'custom' && secAccess.seccionales) {
      const count = Object.values(secAccess.seccionales).filter(
        (v: any) => v?.view || v?.add || v?.edit
      ).length;
      if (count > 0) {
        parts.push(`Personal: ${count} seccional${count === 1 ? '' : 'es'} configurada${count === 1 ? '' : 's'}`);
      }
    }
  }

  return parts.join(' · ');
}

function formatRolePermissionsSummary(permisos: Record<string, any>): string {
  if (!permisos || typeof permisos !== 'object') return '';
  const totalActive = Object.values(permisos).filter((v) => v === true).length;
  return `${totalActive} permiso${totalActive === 1 ? '' : 's'} activo${totalActive === 1 ? '' : 's'} en el rol`;
}

export function formatActivityHuman(log: ActivityLogRecord): HumanActivityResult {
  const d = normalizeDetails(log.details);
  const actionLabel = humanizeAction(log.action, log.entity_type);
  const entityLabel = humanizeEntity(log.entity_type);
  const category = classifyCategory(log.action, log.entity_type);
  const actLower = (log.action || '').toLowerCase();
  const entLower = (log.entity_type || '').toLowerCase();

  let summary = '';

  // 1. Sesiones (inicio / cierre)
  if (actLower.includes('inició sesión') || actLower.includes('inicio de sesión')) {
    const bits: string[] = ['Ingresó al sistema institucional'];
    if (d.rol) bits.push(`con rol ${d.rol}`);
    const tech = [d.navegador, d.dispositivo].filter(Boolean).join(' en ');
    if (tech) bits.push(`(${tech})`);
    summary = bits.join(' ');
  } else if (actLower.includes('cerró sesión')) {
    summary = d.rol
      ? `Cerró su sesión en el sistema (rol ${d.rol})`
      : 'Cerró su sesión en el sistema';
  }
  // 2. Usuarios y Roles
  else if (actLower.includes('creó nuevo usuario')) {
    const targetName = d.nombre_usuario || d.nombre || d.email || 'nuevo usuario';
    const targetEmail = d.email && d.email !== targetName ? ` (${d.email})` : '';
    const rolTxt = d.rol ? ` con rol ${d.rol}` : '';
    const carnetTxt = d.carnet ? ` · Carnet ${d.carnet}` : '';
    const copyTxt = d.copiado_de ? ` · Permisos copiados de ${d.copiado_de}` : '';
    summary = `Agregó al usuario ${targetName}${targetEmail}${rolTxt}${carnetTxt}${copyTxt}`;
  } else if (actLower.includes('eliminó usuario')) {
    const target = d.nombre_usuario || d.email || (log.entity_id ? `ID ${log.entity_id}` : 'un usuario');
    const mail = d.email && d.nombre_usuario ? ` (${d.email})` : '';
    summary = `Eliminó la cuenta de ${target}${mail}`;
  } else if (actLower.includes('activó cuenta') || actLower.includes('desactivó cuenta')) {
    const verb = actLower.includes('desactivó') ? 'Desactivó' : 'Reactivó';
    const target = d.nombre_usuario || d.usuario || d.email || 'un usuario';
    const mail = d.usuario && d.nombre_usuario && d.usuario !== d.nombre_usuario ? ` (${d.usuario})` : '';
    summary = `${verb} el acceso del usuario ${target}${mail}`;
  } else if (actLower.includes('cambió rol de usuario')) {
    const target = d.nombre_usuario || d.email || 'el usuario seleccionado';
    const fromTxt = d.rol_anterior ? ` de ${d.rol_anterior}` : '';
    const toTxt = d.nuevo_rol ? ` a ${d.nuevo_rol}` : '';
    summary = `Cambió el rol de ${target}${fromTxt}${toTxt}`;
  } else if (actLower.includes('actualizó nombre de usuario')) {
    summary = `Cambió el nombre visible a «${d.nombre_usuario || d.nombre || ''}»${d.email ? ` (${d.email})` : ''}`;
  } else if (actLower.includes('vinculó carnet')) {
    const target = d.nombre_usuario || d.email || 'el usuario';
    summary = d.carnet
      ? `Vinculó el carnet ${d.carnet} a ${target}`
      : `Removió el carnet vinculado de ${target}`;
  } else if (actLower.includes('actualizó accesos individuales')) {
    const target = d.nombre_usuario || d.email || 'un usuario';
    const permSummary = d.custom_permissions ? summarizeCustomPermissions(d.custom_permissions) : '';
    const rolTxt = d.nuevo_rol ? `Nuevo rol: ${d.nuevo_rol}` : '';
    const extra = [rolTxt, permSummary].filter(Boolean).join(' · ');
    summary = `Actualizó los permisos individuales de ${target}${extra ? ` — ${extra}` : ''}`;
  } else if (actLower.includes('creó nuevo rol')) {
    const rolName = d.rol || log.entity_id || 'personalizado';
    const baseTxt = d.basado_en ? ` tomando como base el rol ${d.basado_en}` : '';
    summary = `Creó el nuevo rol «${rolName}»${baseTxt}`;
  } else if (actLower.includes('eliminó rol')) {
    summary = `Eliminó el rol personalizado «${d.rol || log.entity_id || ''}»`;
  } else if (actLower.includes('actualizó permisos de rol')) {
    const rolName = log.entity_id || d.rol || 'seleccionado';
    const permTxt = d.permisos ? formatRolePermissionsSummary(d.permisos) : '';
    summary = `Actualizó los permisos base del rol «${rolName}»${permTxt ? ` (${permTxt})` : ''}`;
  }
  // 3. Socorristas
  else if (actLower.includes('exportó excel')) {
    const presetLabel = EXCEL_PRESET_LABELS[d.tipo_reporte] || d.tipo_reporte || 'Listado';
    const qty = typeof d.cantidad === 'number' ? `${d.cantidad} registro${d.cantidad === 1 ? '' : 's'}` : '';
    const ext = d.extendido ? 'con datos extendidos' : 'formato estándar';
    summary = `Descargó reporte Excel de socorristas: ${presetLabel}${qty ? ` (${qty}, ${ext})` : ''}`;
  } else if (actLower.includes('creó socorrista')) {
    const who = d.nombre || d.nombre_completo || 'nuevo elemento';
    const carnet = d.carnet ? ` · Carnet ${d.carnet}` : '';
    const sec = d.seccional ? ` · Seccional ${d.seccional}` : '';
    summary = `Registró al socorrista ${who}${carnet}${sec}`;
  } else if (actLower.includes('actualizó perfil')) {
    const who = d.nombre || d.nombre_completo || (log.entity_id ? `registro #${log.entity_id}` : 'un socorrista');
    summary = `Actualizó la información del perfil de ${who}`;
  } else if (actLower.includes('cambió estado') && entLower.includes('socorrista')) {
    const who = d.nombre || `socorrista #${log.entity_id || ''}`;
    if (d.estado_anterior && d.nuevo_estado) {
      summary = `Cambió el estado de ${who} de ${d.estado_anterior} a ${d.nuevo_estado}`;
    } else {
      summary = `Actualizó el estado de ${who}`;
    }
  } else if (actLower.includes('generó carnet')) {
    const who = d.nombre || d.socorrista || (log.entity_id ? `socorrista #${log.entity_id}` : 'un elemento');
    summary = `Generó el carnet digital de ${who}${d.carnet ? ` (${d.carnet})` : ''}`;
  }
  // 4. Seccionales
  else if (entLower.includes('seccional')) {
    const verb = actLower.includes('creó') ? 'Registró la seccional' : 'Actualizó la seccional';
    const name = d.nombre || `#${log.entity_id || ''}`;
    const mail = d.correo ? ` · Correo: ${d.correo}` : '';
    summary = `${verb} ${name}${mail}`;
  }
  // 5. Soporte
  else if (entLower.includes('soporte')) {
    const folio = d.folio || log.entity_id || '';
    const est = d.estado ? ` → Estado: ${d.estado}` : '';
    const tit = d.titulo ? ` «${d.titulo}»` : '';
    summary = `Actualizó la solicitud de soporte${folio ? ` ${folio}` : ''}${tit}${est}`;
  }
  // 6. Solicitudes (Compra, Combustible, Carnet)
  else if (entLower.includes('solicitud')) {
    const folio = d.folio || log.entity_id || '';
    const sec = d.seccional || d.seccional_nombre || '';
    const est = d.estado || d.nuevo_estado || '';
    const bits = [actionLabel];
    if (folio) bits.push(`(${folio})`);
    if (sec) bits.push(`· Seccional ${sec}`);
    if (est && !actionLabel.toLowerCase().includes(String(est).toLowerCase())) {
      bits.push(`· Estado: ${est}`);
    }
    if (d.nombre || d.nombre_completo) bits.push(`· ${d.nombre || d.nombre_completo}`);
    summary = bits.join(' ');
  }
  // 7. Vehículos, Cursos, Archivos, Anuncios, Noticias, Directorio, Formularios, Configuración
  else {
    const pieces: string[] = [actionLabel];
    if (d.titulo) pieces.push(`«${d.titulo}»`);
    else if (d.nombre) pieces.push(`«${d.nombre}»`);
    else if (d.placa) pieces.push(`placa ${d.placa}`);
    else if (d.marca || d.modelo) pieces.push([d.marca, d.modelo].filter(Boolean).join(' '));
    else if (d.email) pieces.push(`(${d.email})`);

    if (typeof d.activado === 'boolean') {
      pieces.push(d.activado ? '— Activado' : '— Desactivado');
    }
    if (d.estado && !actionLabel.toLowerCase().includes(String(d.estado).toLowerCase())) {
      pieces.push(`· Estado: ${d.estado}`);
    }
    summary = pieces.join(' ');
  }

  // Construir campos estructurados legibles para el modal de detalle
  const fields: FormattedDetailField[] = [];

  Object.entries(d).forEach(([key, rawVal]) => {
    if (IGNORED_KEYS.has(key)) return;
    if (rawVal === null || rawVal === undefined || rawVal === '') return;

    const label =
      FIELD_LABELS[key] ||
      key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

    if (typeof rawVal === 'boolean') {
      fields.push({ label, value: formatBoolean(rawVal) });
    } else if (key === 'tipo_reporte' && typeof rawVal === 'string') {
      fields.push({ label, value: EXCEL_PRESET_LABELS[rawVal] || rawVal });
    } else if (Array.isArray(rawVal)) {
      if (rawVal.length > 0) {
        fields.push({
          label,
          value: rawVal.map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item))).join(', '),
        });
      }
    } else if (typeof rawVal === 'object') {
      const subText = Object.entries(rawVal)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'boolean' ? formatBoolean(v) : String(v)}`)
        .join(' · ');
      if (subText) fields.push({ label, value: subText });
    } else {
      fields.push({ label, value: String(rawVal) });
    }
  });

  if (d.custom_permissions && typeof d.custom_permissions === 'object') {
    const permText = summarizeCustomPermissions(d.custom_permissions);
    if (permText) {
      fields.push({ label: 'Resumen de accesos', value: permText });
    }
  }

  if (d.permisos && typeof d.permisos === 'object') {
    fields.push({
      label: 'Resumen de permisos del rol',
      value: formatRolePermissionsSummary(d.permisos),
    });
  }

  return {
    actionLabel,
    entityLabel,
    summary: summary || actionLabel,
    fields,
    category,
  };
}

/**
 * Detecta navegador y tipo de dispositivo en lenguaje humano para registros de inicio de sesión.
 */
export function getClientDeviceSummary(): { navegador: string; dispositivo: string } {
  if (typeof navigator === 'undefined') {
    return { navegador: 'Navegador web', dispositivo: 'Escritorio' };
  }
  const ua = navigator.userAgent || '';

  let navegador = 'Navegador web';
  if (ua.includes('Edg/')) navegador = 'Microsoft Edge';
  else if (ua.includes('OPR/') || ua.includes('Opera')) navegador = 'Opera';
  else if (ua.includes('Chrome/') && !ua.includes('Edg/')) navegador = 'Google Chrome';
  else if (ua.includes('Firefox/')) navegador = 'Mozilla Firefox';
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) navegador = 'Safari';

  let dispositivo = 'Computadora';
  if (/iPhone/i.test(ua)) dispositivo = 'iPhone';
  else if (/iPad/i.test(ua)) dispositivo = 'iPad';
  else if (/Android/i.test(ua)) {
    dispositivo = /Mobile/i.test(ua) ? 'Teléfono Android' : 'Tablet Android';
  } else if (/Macintosh|Mac OS/i.test(ua)) {
    dispositivo = 'Mac';
  } else if (/Windows/i.test(ua)) {
    dispositivo = 'Windows';
  } else if (/Linux/i.test(ua)) {
    dispositivo = 'Linux';
  }

  return { navegador, dispositivo };
}

export const SQL_MIGRATION_51_TEXT = `-- ============================================================================
-- MIGRACIÓN 51: ROLES PERSONALIZADOS, AUDITORÍA DE SESIONES Y SECCIONALES
-- Cruz Verde Salvadoreña - Sistema Institucional
-- ============================================================================

-- 1. Permitir roles personalizados en public.user_roles (eliminar CHECK fijo si existe)
DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  FOR v_constraint IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'user_roles'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS %I', v_constraint);
  END LOOP;
END $$;

-- 2. Preparar public.role_permissions para creación y administración de roles
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL UNIQUE,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.role_permissions
  ADD COLUMN IF NOT EXISTS descripcion TEXT;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_roles()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_custom JSONB;
  v_role_perms JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  IF lower(COALESCE(auth.jwt() ->> 'email', '')) = 'christopher.snap@gmail.com' THEN
    RETURN TRUE;
  END IF;

  SELECT ur.role, COALESCE(ur.custom_permissions, '{}'::jsonb)
  INTO v_role, v_custom
  FROM public.user_roles ur
  WHERE ur.id = auth.uid()
  LIMIT 1;

  IF v_role IN ('admin', 'superadmin') THEN
    RETURN TRUE;
  END IF;

  IF (v_custom ->> 'view_accesos') = 'true' OR (v_custom ->> 'can_manage_roles') = 'true' THEN
    RETURN TRUE;
  END IF;

  SELECT COALESCE(rp.permissions, '{}'::jsonb)
  INTO v_role_perms
  FROM public.role_permissions rp
  WHERE rp.role = v_role
  LIMIT 1;

  RETURN COALESCE((v_role_perms ->> 'view_accesos')::boolean, FALSE)
      OR COALESCE((v_role_perms ->> 'can_manage_roles')::boolean, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.can_manage_roles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_roles() TO authenticated;

DROP POLICY IF EXISTS "Admins can manage role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Anyone can read role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Authenticated can read role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Managers can insert role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Managers can update role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Managers can delete role permissions" ON public.role_permissions;

CREATE POLICY "Authenticated can read role permissions"
  ON public.role_permissions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can insert role permissions"
  ON public.role_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_roles());

CREATE POLICY "Managers can update role permissions"
  ON public.role_permissions
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_roles())
  WITH CHECK (public.can_manage_roles());

CREATE POLICY "Managers can delete role permissions"
  ON public.role_permissions
  FOR DELETE
  TO authenticated
  USING (
    public.can_manage_roles()
    AND role NOT IN ('admin', 'socorrista', 'director', 'instructor')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.role_permissions TO authenticated;

-- 3. Asegurar tabla, índices y RLS de public.activity_logs para sesiones y acciones
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  user_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS user_email TEXT,
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id TEXT,
  ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
  ON public.activity_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_created
  ON public.activity_logs (entity_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id
  ON public.activity_logs (user_id);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_activity_logs()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_custom JSONB;
  v_role_perms JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  IF lower(COALESCE(auth.jwt() ->> 'email', '')) = 'christopher.snap@gmail.com' THEN
    RETURN TRUE;
  END IF;

  SELECT ur.role, COALESCE(ur.custom_permissions, '{}'::jsonb)
  INTO v_role, v_custom
  FROM public.user_roles ur
  WHERE ur.id = auth.uid()
  LIMIT 1;

  IF v_role IN ('admin', 'superadmin') THEN
    RETURN TRUE;
  END IF;

  IF v_custom ? 'view_activity' THEN
    RETURN COALESCE((v_custom ->> 'view_activity')::boolean, FALSE);
  END IF;

  SELECT COALESCE(rp.permissions, '{}'::jsonb)
  INTO v_role_perms
  FROM public.role_permissions rp
  WHERE rp.role = v_role
  LIMIT 1;

  RETURN COALESCE((v_role_perms ->> 'view_activity')::boolean, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.can_view_activity_logs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_activity_logs() TO authenticated;

DROP POLICY IF EXISTS "Users can insert own activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Authenticated users can insert activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Admins can read activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Authorized users can read activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.activity_logs;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.activity_logs;

CREATE POLICY "Authenticated users can insert activity logs"
  ON public.activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Authorized users can read activity logs"
  ON public.activity_logs
  FOR SELECT
  TO authenticated
  USING (public.can_view_activity_logs() OR user_id = auth.uid());

GRANT SELECT, INSERT ON TABLE public.activity_logs TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 4. Verificar columnas de contacto y ubicación en public.seccionales
ALTER TABLE IF EXISTS public.seccionales
  ADD COLUMN IF NOT EXISTS correo TEXT,
  ADD COLUMN IF NOT EXISTS google_maps_url TEXT,
  ADD COLUMN IF NOT EXISTS waze_url TEXT;

NOTIFY pgrst, 'reload schema';`;
