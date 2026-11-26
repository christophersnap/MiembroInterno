import React, { useState, useMemo } from 'react';
import {
  Check,
  X,
  Search,
  RotateCcw,
  Copy,
  ChevronDown,
} from 'lucide-react';
import {
  ModuleScope,
  ScopedModuleKey,
  CreateSolicitudModuleKey,
  CreateSolicitudScope,
  SeccionalesSocorristasConfig,
} from '../../contexts/AuthContext';

interface PermisosIndividualesModalProps {
  user: any;
  allUsers?: any[];
  roles: string[];
  rolePermissions: any[];
  permissionLabels: Record<string, string>;
  seccionales: { id: number; nombre: string }[];
  onClose: () => void;
  onSave: (
    userId: string,
    updatedCustomPermissions: Record<string, any>,
    updatedCanUploadFiles: boolean,
    updatedRole?: string
  ) => Promise<void>;
}

const PERMISSION_CATEGORIES: Record<string, { label: string; keys: string[] }> = {
  socorristas: {
    label: 'Socorristas y Conoce a tu Socorrista',
    keys: [
      'view_socorristas',
      'add_socorristas',
      'edit_socorristas',
      'descargar_ficha_conoce_socorrista',
      'descargar_excel_socorristas',
      'subir_expediente_socorrista',
      'ver_expediente_socorrista',
      'descargar_expediente_socorrista',
      'cambiar_estado_socorrista',
      'assign_jdn_cargos',
      'ver_imagenes_socorristas',
      'view_carnet',
      'descargar_carnet',
      'view_solicitar_carnet',
      'view_verificar_carnet',
      'view_meritos',
      'edit_meritos',
    ],
  },
  vehiculos: {
    label: 'Solicitudes y Vehículos',
    keys: [
      'view_vehiculos',
      'edit_vehiculos',
      'view_solicitudes_compra',
      'crear_solicitudes_compra',
      'edit_solicitudes_compra',
      'aprobar_solicitudes_compra',
      'view_compra_historial',
      'view_compra_plantillas',
      'view_solicitudes_combustible',
      'crear_solicitudes_combustible',
      'edit_solicitudes_combustible',
      'aprobar_solicitudes_combustible',
      'view_combustible_historial',
      'view_combustible_plantillas',
      'ver_previsualizacion_pdf',
      'view_solicitudes_carnet',
      'corregir_solicitudes_carnet',
      'edit_solicitudes_carnet',
    ],
  },
  contenido: {
    label: 'Archivos y Seccionales',
    keys: [
      'view_dashboard',
      'view_archivos',
      'subir_archivos',
      'edit_archivos',
      'view_cursos',
      'view_seccionales',
      'edit_seccionales',
      'view_directorio',
      'edit_directorio',
    ],
  },
  comunicacion: {
    label: 'Anuncios, Noticias y Formularios',
    keys: [
      'view_anuncios',
      'crear_anuncios',
      'edit_anuncios',
      'view_noticias_ajustes',
      'edit_noticias_banner',
      'view_formularios',
      'crear_formularios',
      'edit_formularios',
      'ver_todos_formularios',
    ],
  },
  soporte: {
    label: 'Soporte Técnico e Incidencias',
    keys: [
      'view_soporte',
      'crear_soporte',
      'view_soporte_seccional',
      'view_soporte_historial',
      'edit_soporte_estado',
    ],
  },
  admin: {
    label: 'Seguridad y Sistema',
    keys: [
      'ver_todas_seccionales',
      'ver_personas_conectadas',
      'personalizar_colores',
      'view_config',
      'view_activity',
      'view_accesos',
    ],
  },
};

const SCOPED_MODULES: {
  key: ScopedModuleKey;
  label: string;
  subtitle: string;
  viewKey: string;
  correctKey?: string;
  editKeys: string[];
  createKey?: string;
  resolveKey?: string;
  historialKey?: string;
  plantillasKey?: string;
  pdfPreviewKey?: string;
}[] = [
  {
    key: 'solicitudes_combustible',
    label: 'Solicitudes de Combustible',
    subtitle: 'Vales, dotación y autorizaciones',
    viewKey: 'view_solicitudes_combustible',
    editKeys: ['edit_solicitudes_combustible', 'aprobar_solicitudes_combustible'],
    createKey: 'crear_solicitudes_combustible',
    historialKey: 'view_combustible_historial',
    plantillasKey: 'view_combustible_plantillas',
    pdfPreviewKey: 'ver_previsualizacion_pdf',
  },
  {
    key: 'solicitudes_compra',
    label: 'Solicitudes de Compra',
    subtitle: 'Insumos, repuestos y mantenimiento',
    viewKey: 'view_solicitudes_compra',
    editKeys: ['edit_solicitudes_compra', 'aprobar_solicitudes_compra'],
    createKey: 'crear_solicitudes_compra',
    historialKey: 'view_compra_historial',
    plantillasKey: 'view_compra_plantillas',
    pdfPreviewKey: 'ver_previsualizacion_pdf',
  },
  {
    key: 'solicitudes_carnet',
    label: 'Solicitudes de Carnet',
    subtitle: 'Revisión, observaciones y corrección de emisión',
    viewKey: 'view_solicitudes_carnet',
    correctKey: 'corregir_solicitudes_carnet',
    editKeys: ['edit_solicitudes_carnet'],
  },
  {
    key: 'soporte',
    label: 'Soporte Técnico',
    subtitle: 'Crear reportes, ver por seccional y solventar solicitudes',
    viewKey: 'view_soporte',
    editKeys: ['edit_soporte_estado'],
    createKey: 'crear_soporte',
    resolveKey: 'edit_soporte_estado',
  },
  {
    key: 'formularios',
    label: 'Formularios Institucionales',
    subtitle: 'Formularios activos y respuestas',
    viewKey: 'view_formularios',
    editKeys: ['edit_formularios', 'crear_formularios'],
  },
];

const SIMPLE_VIEW_EDIT_MODULES: {
  label: string;
  desc: string;
  viewKey: string;
  editKeys: string[];
}[] = [
  {
    label: 'Socorristas (Módulo general)',
    desc: 'Ver listado o registrar y editar perfiles',
    viewKey: 'view_socorristas',
    editKeys: ['add_socorristas', 'edit_socorristas'],
  },
  {
    label: 'Carnets Digitales',
    desc: 'Generar y descargar carnets institucionales',
    viewKey: 'view_carnet',
    editKeys: ['descargar_carnet'],
  },
  {
    label: 'Noticias y Banner de Inicio',
    desc: 'Ver noticias o administrar slides del banner',
    viewKey: 'view_noticias_ajustes',
    editKeys: ['edit_noticias_banner'],
  },
  {
    label: 'Anuncios Institucionales',
    desc: 'Leer avisos o publicar y editar comunicados',
    viewKey: 'view_anuncios',
    editKeys: ['edit_anuncios', 'crear_anuncios'],
  },
  {
    label: 'Archivos Descargables',
    desc: 'Consultar documentos o subir nuevos archivos',
    viewKey: 'view_archivos',
    editKeys: ['edit_archivos', 'subir_archivos'],
  },
  {
    label: 'Flota de Vehículos',
    desc: 'Visualizar unidades o gestionar mantenimientos',
    viewKey: 'view_vehiculos',
    editKeys: ['edit_vehiculos'],
  },
  {
    label: 'Méritos y Reconocimientos',
    desc: 'Consultar distinciones o registrar nuevas',
    viewKey: 'view_meritos',
    editKeys: ['edit_meritos'],
  },
  {
    label: 'Seccionales',
    desc: 'Consultar sedes o editar información',
    viewKey: 'view_seccionales',
    editKeys: ['edit_seccionales'],
  },
  {
    label: 'Directorio Institucional',
    desc: 'Ver teléfonos o actualizar contactos',
    viewKey: 'view_directorio',
    editKeys: ['edit_directorio'],
  },
  {
    label: 'Soporte Técnico',
    desc: 'Acceder a soporte o solventar y finalizar solicitudes',
    viewKey: 'view_soporte',
    editKeys: ['edit_soporte_estado'],
  },
];

function IosSwitch({
  checked,
  onChange,
  ariaLabel,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onChange();
      }}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
        disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
      } ${checked ? 'bg-emerald-500' : 'bg-slate-200'}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-150 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export default function PermisosIndividualesModal({
  user,
  allUsers = [],
  roles,
  rolePermissions,
  permissionLabels,
  seccionales,
  onClose,
  onSave,
}: PermisosIndividualesModalProps) {
  const [selectedRole, setSelectedRole] = useState<string>(user.role || 'socorrista');

  const getRolePermsMap = (roleName: string): Record<string, boolean> => {
    const found = rolePermissions.find((rp) => rp.role === roleName);
    if (found && found.permissions) return found.permissions;

    if (roleName === 'admin') {
      const allTrue: Record<string, boolean> = {};
      Object.keys(permissionLabels).forEach((k) => (allTrue[k] = true));
      return allTrue;
    }
    return {
      view_dashboard: true,
      view_directorio: true,
      view_solicitar_carnet: true,
      view_verificar_carnet: true,
      view_archivos: true,
      view_vehiculos: true,
      view_solicitudes_compra: true,
      crear_solicitudes_compra: true,
      view_compra_historial: true,
      view_compra_plantillas: false,
      view_solicitudes_combustible: true,
      crear_solicitudes_combustible: true,
      view_combustible_historial: true,
      view_combustible_plantillas: false,
      ver_previsualizacion_pdf: true,
      subir_expediente_socorrista: false,
      ver_expediente_socorrista: false,
      descargar_expediente_socorrista: false,
      descargar_ficha_conoce_socorrista: false,
      ver_personas_conectadas: false,
      assign_jdn_cargos: false,
      view_meritos: true,
      view_anuncios: true,
      view_formularios: true,
      view_soporte: true,
      crear_soporte: true,
      view_soporte_seccional: false,
      view_soporte_historial: false,
      edit_soporte_estado: false,
    };
  };

  const baseRolePermissions = useMemo(
    () => getRolePermsMap(selectedRole),
    [selectedRole, rolePermissions, permissionLabels]
  );

  const userDefaultSeccionalId = user?.socorristas?.seccional_id
    ? Number(user.socorristas.seccional_id)
    : null;

  const userDefaultSeccionalName = useMemo(() => {
    if (user?.socorristas?.seccionales?.nombre) return user.socorristas.seccionales.nombre;
    if (userDefaultSeccionalId) {
      return seccionales.find((s) => s.id === userDefaultSeccionalId)?.nombre || null;
    }
    return null;
  }, [user, userDefaultSeccionalId, seccionales]);

  const [customOverrides, setCustomOverrides] = useState<Record<string, boolean>>(() => {
    const raw = user.custom_permissions || {};
    const initial: Record<string, boolean> = {};
    Object.keys(raw).forEach((k) => {
      if (typeof raw[k] === 'boolean') {
        initial[k] = raw[k];
      }
    });
    if (user.can_upload_files && initial.subir_archivos === undefined) {
      initial.subir_archivos = true;
    }
    return initial;
  });

  const [moduleScopes, setModuleScopes] = useState<Record<ScopedModuleKey, ModuleScope>>(() => {
    const rawScopes = user.custom_permissions?._module_scopes || {};
    const cp = user.custom_permissions || {};
    const effSoporteGlobal =
      typeof cp.view_soporte_historial === 'boolean'
        ? cp.view_soporte_historial
        : Boolean(baseRolePermissions.view_soporte_historial);
    const effSoporteSec =
      typeof cp.view_soporte_seccional === 'boolean'
        ? cp.view_soporte_seccional
        : Boolean(baseRolePermissions.view_soporte_seccional);

    return {
      formularios:
        rawScopes.formularios || (baseRolePermissions.ver_todos_formularios ? 'global' : 'usuario'),
      solicitudes_combustible:
        rawScopes.solicitudes_combustible ||
        (baseRolePermissions.ver_todas_seccionales ? 'global' : 'usuario'),
      solicitudes_compra:
        rawScopes.solicitudes_compra ||
        (baseRolePermissions.ver_todas_seccionales ? 'global' : 'usuario'),
      solicitudes_carnet:
        rawScopes.solicitudes_carnet ||
        (baseRolePermissions.ver_todas_seccionales ? 'global' : 'seccional'),
      soporte:
        rawScopes.soporte ||
        (effSoporteGlobal ? 'global' : effSoporteSec ? 'seccional' : 'usuario'),
    };
  });

  const [moduleSeccionales, setModuleSeccionales] = useState<Record<ScopedModuleKey, number[]>>(() => {
    const rawModSeccs = user.custom_permissions?._module_seccionales || {};
    const fallbackArr = userDefaultSeccionalId ? [userDefaultSeccionalId] : [];
    const parseArr = (val: any) =>
      Array.isArray(val)
        ? Array.from(new Set(val.map(Number).filter((n) => !isNaN(n) && n > 0)))
        : fallbackArr;
    return {
      formularios: parseArr(rawModSeccs.formularios),
      solicitudes_combustible: parseArr(rawModSeccs.solicitudes_combustible),
      solicitudes_compra: parseArr(rawModSeccs.solicitudes_compra),
      solicitudes_carnet: parseArr(rawModSeccs.solicitudes_carnet),
      soporte: parseArr(rawModSeccs.soporte),
    };
  });

  const [createScopes, setCreateScopes] = useState<Record<CreateSolicitudModuleKey, CreateSolicitudScope>>(() => {
    const rawCreate = user.custom_permissions?._create_scopes || {};
    const rawVisScopes = user.custom_permissions?._module_scopes || {};
    const resolveInitial = (k: CreateSolicitudModuleKey): CreateSolicitudScope => {
      if (rawCreate[k] === 'global' || rawCreate[k] === 'seccional') return rawCreate[k];
      if (rawVisScopes[k] === 'global' || baseRolePermissions.ver_todas_seccionales) return 'global';
      return 'seccional';
    };
    return {
      solicitudes_combustible: resolveInitial('solicitudes_combustible'),
      solicitudes_compra: resolveInitial('solicitudes_compra'),
    };
  });

  const [createSeccionales, setCreateSeccionales] = useState<Record<CreateSolicitudModuleKey, number | null>>(() => {
    const rawCreateSeccs = user.custom_permissions?._create_seccionales || {};
    const resolveInitialSec = (k: CreateSolicitudModuleKey): number | null => {
      const parsed = Number(rawCreateSeccs[k]);
      if (!isNaN(parsed) && parsed > 0) return parsed;
      if (userDefaultSeccionalId) return userDefaultSeccionalId;
      return seccionales[0]?.id ?? null;
    };
    return {
      solicitudes_combustible: resolveInitialSec('solicitudes_combustible'),
      solicitudes_compra: resolveInitialSec('solicitudes_compra'),
    };
  });

  const [extraSolicitudesEnProceso, setExtraSolicitudesEnProceso] = useState<
    Record<CreateSolicitudModuleKey, number>
  >(() => {
    const raw = user.custom_permissions?._extra_solicitudes_en_proceso || {};
    const parseVal = (v: any): number => {
      if (v === undefined || v === null || v === '') return 0;
      const n = Number(v);
      if (!Number.isFinite(n)) return 0;
      if (n < 0) return -1;
      return Math.min(99, Math.floor(n));
    };
    return {
      solicitudes_combustible: parseVal(raw.solicitudes_combustible),
      solicitudes_compra: parseVal(raw.solicitudes_compra),
    };
  });

  const [secConfig, setSecConfig] = useState<SeccionalesSocorristasConfig>(() => {
    const raw = user.custom_permissions?._seccionales_socorristas;
    if (raw && (raw.mode === 'all' || raw.mode === 'custom' || raw.mode === 'default')) {
      return {
        mode: raw.mode,
        seccionales: raw.seccionales && typeof raw.seccionales === 'object' ? raw.seccionales : {},
      };
    }
    return { mode: 'default', seccionales: {} };
  });

  const [activeTab, setActiveTab] = useState<'alcances' | 'modulos' | 'todos'>('alcances');
  const [expandedScopedModule, setExpandedScopedModule] = useState<ScopedModuleKey | null>(
    'solicitudes_combustible'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [secSearchTerm, setSecSearchTerm] = useState('');
  const [scopeSecSearch, setScopeSecSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'todos' | 'permitidos' | 'personalizados'>('todos');
  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  const [isSaving, setIsSaving] = useState(false);

  // Copiar configuración de otro usuario (plegable para no saturar)
  const [showCopyBar, setShowCopyBar] = useState(false);
  const [copySourceUserId, setCopySourceUserId] = useState<string>('');
  const [copyIncludeBaseRole, setCopyIncludeBaseRole] = useState<boolean>(true);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  const otherUsers = useMemo(
    () => (allUsers || []).filter((u) => u && u.id !== user.id),
    [allUsers, user.id]
  );

  const getOtherUserLabel = (u: any) => {
    const name =
      String(u.nombre_usuario || u.nombre_completo || '').trim() ||
      (u.socorristas ? `${u.socorristas.primer_nombre} ${u.socorristas.primer_apellido}` : '') ||
      u.email ||
      'Usuario';
    return `${name} · ${u.role}`;
  };

  const handleCopyFromUser = () => {
    if (!copySourceUserId) return;
    const source = otherUsers.find((u) => u.id === copySourceUserId);
    if (!source) return;

    const srcCp = source.custom_permissions || {};
    const srcRole = source.role || 'socorrista';
    const srcRolePerms = getRolePermsMap(srcRole);
    const targetRoleForOverrides = copyIncludeBaseRole ? srcRole : selectedRole;
    const targetBasePerms = getRolePermsMap(targetRoleForOverrides);

    if (copyIncludeBaseRole) {
      setSelectedRole(srcRole);
    }

    const nextOverrides: Record<string, boolean> = {};
    if (copyIncludeBaseRole) {
      Object.keys(srcCp).forEach((k) => {
        if (typeof srcCp[k] === 'boolean') {
          nextOverrides[k] = srcCp[k];
        }
      });
      if (source.can_upload_files && nextOverrides.subir_archivos === undefined) {
        nextOverrides.subir_archivos = true;
      }
    } else {
      Object.keys(permissionLabels).forEach((k) => {
        const srcEffective =
          typeof srcCp[k] === 'boolean' ? Boolean(srcCp[k]) : Boolean(srcRolePerms[k]);
        const targetBase = Boolean(targetBasePerms[k]);
        if (srcEffective !== targetBase) {
          nextOverrides[k] = srcEffective;
        }
      });
      if (source.can_upload_files && !targetBasePerms.subir_archivos) {
        nextOverrides.subir_archivos = true;
      }
    }
    setCustomOverrides(nextOverrides);

    const srcScopes = srcCp._module_scopes || {};
    const srcSoporteGlobal =
      typeof srcCp.view_soporte_historial === 'boolean'
        ? srcCp.view_soporte_historial
        : Boolean(srcRolePerms.view_soporte_historial);
    const srcSoporteSec =
      typeof srcCp.view_soporte_seccional === 'boolean'
        ? srcCp.view_soporte_seccional
        : Boolean(srcRolePerms.view_soporte_seccional);
    setModuleScopes({
      formularios: srcScopes.formularios || (srcRolePerms.ver_todos_formularios ? 'global' : 'usuario'),
      solicitudes_combustible:
        srcScopes.solicitudes_combustible || (srcRolePerms.ver_todas_seccionales ? 'global' : 'usuario'),
      solicitudes_compra:
        srcScopes.solicitudes_compra || (srcRolePerms.ver_todas_seccionales ? 'global' : 'usuario'),
      solicitudes_carnet:
        srcScopes.solicitudes_carnet || (srcRolePerms.ver_todas_seccionales ? 'global' : 'seccional'),
      soporte:
        srcScopes.soporte || (srcSoporteGlobal ? 'global' : srcSoporteSec ? 'seccional' : 'usuario'),
    });

    const srcModSeccs = srcCp._module_seccionales || {};
    const parseArr = (val: any) =>
      Array.isArray(val)
        ? Array.from(new Set(val.map(Number).filter((n) => !isNaN(n) && n > 0)))
        : [];
    setModuleSeccionales({
      formularios: parseArr(srcModSeccs.formularios),
      solicitudes_combustible: parseArr(srcModSeccs.solicitudes_combustible),
      solicitudes_compra: parseArr(srcModSeccs.solicitudes_compra),
      solicitudes_carnet: parseArr(srcModSeccs.solicitudes_carnet),
      soporte: parseArr(srcModSeccs.soporte),
    });

    const srcCreate = srcCp._create_scopes || {};
    const resolveCreate = (k: CreateSolicitudModuleKey): CreateSolicitudScope => {
      if (srcCreate[k] === 'global' || srcCreate[k] === 'seccional') return srcCreate[k];
      if (srcScopes[k] === 'global' || srcRolePerms.ver_todas_seccionales) return 'global';
      return 'seccional';
    };
    setCreateScopes({
      solicitudes_combustible: resolveCreate('solicitudes_combustible'),
      solicitudes_compra: resolveCreate('solicitudes_compra'),
    });

    const srcCreateSeccs = srcCp._create_seccionales || {};
    const parseSingleSec = (k: CreateSolicitudModuleKey): number | null => {
      const parsed = Number(srcCreateSeccs[k]);
      if (!isNaN(parsed) && parsed > 0) return parsed;
      return userDefaultSeccionalId ?? seccionales[0]?.id ?? null;
    };
    setCreateSeccionales({
      solicitudes_combustible: parseSingleSec('solicitudes_combustible'),
      solicitudes_compra: parseSingleSec('solicitudes_compra'),
    });

    const srcExtra = srcCp._extra_solicitudes_en_proceso || {};
    const parseExtraVal = (v: any): number => {
      if (v === undefined || v === null || v === '') return 0;
      const n = Number(v);
      if (!Number.isFinite(n)) return 0;
      if (n < 0) return -1;
      return Math.min(99, Math.floor(n));
    };
    setExtraSolicitudesEnProceso({
      solicitudes_combustible: parseExtraVal(srcExtra.solicitudes_combustible),
      solicitudes_compra: parseExtraVal(srcExtra.solicitudes_compra),
    });

    const srcSecCfg = srcCp._seccionales_socorristas;
    if (srcSecCfg && (srcSecCfg.mode === 'all' || srcSecCfg.mode === 'custom' || srcSecCfg.mode === 'default')) {
      setSecConfig({
        mode: srcSecCfg.mode,
        seccionales: srcSecCfg.seccionales ? JSON.parse(JSON.stringify(srcSecCfg.seccionales)) : {},
      });
    } else {
      setSecConfig({ mode: 'default', seccionales: {} });
    }

    const srcName =
      String(source.nombre_usuario || source.nombre_completo || '').trim() ||
      (source.socorristas ? `${source.socorristas.primer_nombre} ${source.socorristas.primer_apellido}` : '') ||
      source.email;
    setCopyNotice(`Accesos copiados de ${srcName}. Revisa y guarda para aplicar.`);
  };

  const getPermissionStatus = (key: string) => {
    const isOverridden = customOverrides[key] !== undefined && customOverrides[key] !== null;
    const baseValue = Boolean(baseRolePermissions[key]);
    const effectiveValue = isOverridden ? Boolean(customOverrides[key]) : baseValue;
    return {
      effectiveValue,
      isOverridden,
      overrideValue: customOverrides[key],
      baseValue,
    };
  };

  const handleSetOverride = (key: string, mode: 'role' | 'allow' | 'deny') => {
    setCustomOverrides((prev) => {
      const copy = { ...prev };
      if (mode === 'role') delete copy[key];
      else if (mode === 'allow') copy[key] = true;
      else copy[key] = false;
      return copy;
    });
  };

  const handleToggleBooleanPerm = (key: string) => {
    const current = getPermissionStatus(key).effectiveValue;
    setCustomOverrides((prev) => ({
      ...prev,
      [key]: !current,
    }));
  };

  const setMultipleKeys = (keys: string[], value: boolean | 'role') => {
    setCustomOverrides((prev) => {
      const copy = { ...prev };
      keys.forEach((k) => {
        if (value === 'role') delete copy[k];
        else copy[k] = value;
      });
      return copy;
    });
  };

  const getModuleAccessLevel = (
    viewKey: string,
    editKeys: string[],
    correctKey?: string
  ): 'blocked' | 'view' | 'correct' | 'edit' => {
    const canView = getPermissionStatus(viewKey).effectiveValue;
    const canCorrect = correctKey ? getPermissionStatus(correctKey).effectiveValue : false;
    const canEdit = editKeys.some((ek) => getPermissionStatus(ek).effectiveValue);
    if (!canView && !canCorrect && !canEdit) return 'blocked';
    if (canEdit) return 'edit';
    if (correctKey && canCorrect) return 'correct';
    return 'view';
  };

  const setModuleAccessLevel = (
    viewKey: string,
    editKeys: string[],
    level: 'blocked' | 'view' | 'correct' | 'edit',
    correctKey?: string
  ) => {
    setCustomOverrides((prev) => {
      const copy = { ...prev };
      if (level === 'blocked') {
        copy[viewKey] = false;
        if (correctKey) copy[correctKey] = false;
        editKeys.forEach((ek) => {
          copy[ek] = false;
        });
      } else if (level === 'view') {
        copy[viewKey] = true;
        if (correctKey) copy[correctKey] = false;
        editKeys.forEach((ek) => {
          copy[ek] = false;
        });
      } else if (level === 'correct') {
        copy[viewKey] = true;
        if (correctKey) copy[correctKey] = true;
        editKeys.forEach((ek) => {
          copy[ek] = false;
        });
      } else {
        copy[viewKey] = true;
        if (correctKey) copy[correctKey] = true;
        editKeys.forEach((ek) => {
          copy[ek] = true;
        });
      }
      return copy;
    });
  };

  // Nivel rápido: Global vs Seccional vs Según Rol
  const generalScopePreset = useMemo<'global' | 'seccional' | 'rol'>(() => {
    const isAllScopesGlobal =
      moduleScopes.formularios === 'global' &&
      moduleScopes.solicitudes_combustible === 'global' &&
      moduleScopes.solicitudes_compra === 'global' &&
      moduleScopes.solicitudes_carnet === 'global' &&
      moduleScopes.soporte === 'global';

    if (
      (secConfig.mode === 'all' || getPermissionStatus('ver_todas_seccionales').effectiveValue) &&
      isAllScopesGlobal &&
      createScopes.solicitudes_combustible === 'global' &&
      createScopes.solicitudes_compra === 'global'
    ) {
      return 'global';
    }

    if (
      secConfig.mode === 'default' &&
      customOverrides.ver_todas_seccionales === undefined &&
      customOverrides.ver_todos_formularios === undefined &&
      Object.keys(customOverrides).length === 0
    ) {
      return 'rol';
    }

    return 'seccional';
  }, [secConfig.mode, moduleScopes, createScopes, customOverrides, baseRolePermissions]);

  const applyQuickGeneralScope = (preset: 'global' | 'seccional' | 'rol') => {
    if (preset === 'global') {
      setCustomOverrides((prev) => ({
        ...prev,
        ver_todas_seccionales: true,
        ver_todos_formularios: true,
        view_soporte_historial: true,
        view_soporte_seccional: false,
      }));
      setSecConfig((prev) => ({ ...prev, mode: 'all' }));
      setModuleScopes({
        formularios: 'global',
        solicitudes_combustible: 'global',
        solicitudes_compra: 'global',
        solicitudes_carnet: 'global',
        soporte: 'global',
      });
      setCreateScopes({
        solicitudes_combustible: 'global',
        solicitudes_compra: 'global',
      });
      return;
    }

    if (preset === 'seccional') {
      const defaultSec = userDefaultSeccionalId || seccionales[0]?.id || null;
      const defaultArr = defaultSec ? [defaultSec] : [];
      setCustomOverrides((prev) => ({
        ...prev,
        ver_todas_seccionales: false,
        ver_todos_formularios: false,
        view_soporte_historial: false,
        view_soporte_seccional: true,
      }));
      setSecConfig((prev) => {
        const hasAny = Object.values(prev.seccionales || {}).some((v) => v.view || v.add || v.edit);
        if (hasAny) return { ...prev, mode: 'custom' };
        return {
          mode: 'custom',
          seccionales: defaultSec ? { [defaultSec]: { view: true, add: false, edit: false } } : {},
        };
      });
      setModuleScopes({
        formularios: 'seccional',
        solicitudes_combustible: 'seccional',
        solicitudes_compra: 'seccional',
        solicitudes_carnet: 'seccional',
        soporte: 'seccional',
      });
      setModuleSeccionales((prev) => ({
        formularios: prev.formularios.length ? prev.formularios : defaultArr,
        solicitudes_combustible: prev.solicitudes_combustible.length ? prev.solicitudes_combustible : defaultArr,
        solicitudes_compra: prev.solicitudes_compra.length ? prev.solicitudes_compra : defaultArr,
        solicitudes_carnet: prev.solicitudes_carnet.length ? prev.solicitudes_carnet : defaultArr,
        soporte: prev.soporte.length ? prev.soporte : defaultArr,
      }));
      setCreateScopes({
        solicitudes_combustible: 'seccional',
        solicitudes_compra: 'seccional',
      });
      setCreateSeccionales((prev) => ({
        solicitudes_combustible: prev.solicitudes_combustible || defaultSec,
        solicitudes_compra: prev.solicitudes_compra || defaultSec,
      }));
      return;
    }

    // Restablecer a Rol
    setCustomOverrides({});
    setSecConfig({ mode: 'default', seccionales: {} });
    setModuleScopes({
      formularios: baseRolePermissions.ver_todos_formularios ? 'global' : 'usuario',
      solicitudes_combustible: baseRolePermissions.ver_todas_seccionales ? 'global' : 'usuario',
      solicitudes_compra: baseRolePermissions.ver_todas_seccionales ? 'global' : 'usuario',
      solicitudes_carnet: baseRolePermissions.ver_todas_seccionales ? 'global' : 'seccional',
      soporte: baseRolePermissions.view_soporte_historial
        ? 'global'
        : baseRolePermissions.view_soporte_seccional
        ? 'seccional'
        : 'usuario',
    });
    const fallbackArr = userDefaultSeccionalId ? [userDefaultSeccionalId] : [];
    setModuleSeccionales({
      formularios: fallbackArr,
      solicitudes_combustible: fallbackArr,
      solicitudes_compra: fallbackArr,
      solicitudes_carnet: fallbackArr,
      soporte: fallbackArr,
    });
    const defaultCreateScope: CreateSolicitudScope = baseRolePermissions.ver_todas_seccionales
      ? 'global'
      : 'seccional';
    setCreateScopes({
      solicitudes_combustible: defaultCreateScope,
      solicitudes_compra: defaultCreateScope,
    });
    setCreateSeccionales({
      solicitudes_combustible: userDefaultSeccionalId ?? seccionales[0]?.id ?? null,
      solicitudes_compra: userDefaultSeccionalId ?? seccionales[0]?.id ?? null,
    });
  };

  const toggleSeccionalPerm = (secId: number, field: 'view' | 'add' | 'edit') => {
    setSecConfig((prev) => {
      const current = prev.seccionales[secId] || { view: false, add: false, edit: false };
      const nextVal = !current[field];
      const updated = {
        ...current,
        [field]: nextVal,
      };
      if ((field === 'add' || field === 'edit') && nextVal) {
        updated.view = true;
      }
      if (field === 'view' && !nextVal) {
        updated.add = false;
        updated.edit = false;
      }
      return {
        ...prev,
        mode: 'custom',
        seccionales: {
          ...prev.seccionales,
          [secId]: updated,
        },
      };
    });
  };

  const handleBulkSeccionales = (field: 'view' | 'all' | 'none') => {
    setSecConfig((prev) => {
      if (field === 'none') {
        return { mode: 'custom', seccionales: {} };
      }
      const nextMap: Record<number, { view: boolean; add: boolean; edit: boolean }> = {};
      seccionales.forEach((s) => {
        if (field === 'all') {
          nextMap[s.id] = { view: true, add: true, edit: true };
        } else {
          const cur = prev.seccionales[s.id] || { view: false, add: false, edit: false };
          nextMap[s.id] = { ...cur, view: true };
        }
      });
      return { mode: 'custom', seccionales: nextMap };
    });
  };

  const toggleModuleSeccional = (modKey: ScopedModuleKey, secId: number) => {
    setModuleSeccionales((prev) => {
      const current = prev[modKey] || [];
      const exists = current.includes(secId);
      const next = exists ? current.filter((id) => id !== secId) : [...current, secId];
      return { ...prev, [modKey]: next };
    });
  };

  const handleAllowAll = () => {
    const allAllowed: Record<string, boolean> = {};
    Object.keys(permissionLabels).forEach((k) => {
      allAllowed[k] = true;
    });
    setCustomOverrides(allAllowed);
  };

  const handleDenyAll = () => {
    const allDenied: Record<string, boolean> = {};
    Object.keys(permissionLabels).forEach((k) => {
      allDenied[k] = false;
    });
    setCustomOverrides(allDenied);
  };

  const filteredKeys = useMemo(() => {
    let keys = Object.keys(permissionLabels);

    if (selectedCategory !== 'todas') {
      const categoryKeys = PERMISSION_CATEGORIES[selectedCategory]?.keys || [];
      keys = keys.filter((k) => categoryKeys.includes(k));
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      keys = keys.filter((k) => {
        const label = (permissionLabels[k] || '').toLowerCase();
        return label.includes(q) || k.toLowerCase().includes(q);
      });
    }

    if (activeFilter === 'permitidos') {
      keys = keys.filter((k) => getPermissionStatus(k).effectiveValue);
    } else if (activeFilter === 'personalizados') {
      keys = keys.filter((k) => getPermissionStatus(k).isOverridden);
    }

    return keys;
  }, [permissionLabels, selectedCategory, searchTerm, activeFilter, customOverrides, baseRolePermissions]);

  const filteredSeccionales = useMemo(() => {
    const q = secSearchTerm.trim().toLowerCase();
    if (!q) return seccionales;
    return seccionales.filter((s) => s.nombre.toLowerCase().includes(q));
  }, [seccionales, secSearchTerm]);

  const summary = useMemo(() => {
    let allowedCount = 0;
    let deniedCount = 0;
    let overrideCount = 0;

    Object.keys(permissionLabels).forEach((k) => {
      const status = getPermissionStatus(k);
      if (status.effectiveValue) allowedCount++;
      else deniedCount++;
      if (status.isOverridden) overrideCount++;
    });

    return {
      allowedCount,
      deniedCount,
      overrideCount,
      totalCount: Object.keys(permissionLabels).length,
    };
  }, [permissionLabels, customOverrides, baseRolePermissions]);

  const customSeccionalesSelectedCount = useMemo(
    () => Object.values(secConfig.seccionales || {}).filter((v) => v.view || v.add || v.edit).length,
    [secConfig.seccionales]
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const canUploadFiles =
        customOverrides.subir_archivos !== undefined
          ? Boolean(customOverrides.subir_archivos)
          : customOverrides.edit_archivos !== undefined
          ? Boolean(customOverrides.edit_archivos)
          : Boolean(baseRolePermissions.subir_archivos);

      const finalPayload: Record<string, any> = {
        ...customOverrides,
        _module_scopes: moduleScopes,
        _module_seccionales: moduleSeccionales,
        _create_scopes: createScopes,
        _create_seccionales: createSeccionales,
        _extra_solicitudes_en_proceso: extraSolicitudesEnProceso,
        _seccionales_socorristas: secConfig,
      };

      await onSave(
        user.id,
        finalPayload,
        canUploadFiles,
        selectedRole !== user.role ? selectedRole : undefined
      );
      onClose();
    } catch (err) {
      console.error('Error saving user permissions:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const nombreUsuario =
    String(user.nombre_usuario || user.nombre_completo || '').trim() ||
    (user.socorristas
      ? `${user.socorristas.primer_nombre} ${user.socorristas.primer_apellido}`
      : user.email || 'Usuario');

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div className="bg-[#F2F2F7] rounded-[28px] shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200/80 animate-in zoom-in-95 duration-150">
        {/* ENCABEZADO ESTILO iOS SHEET */}
        <div className="px-5 py-4 bg-white border-b border-slate-200/70 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base font-bold text-slate-900 tracking-tight truncate">
                {nombreUsuario}
              </h2>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200/80 cursor-pointer outline-none focus:border-slate-400"
                title="Rol base asignado al usuario"
              >
                {Array.from(new Set([...(roles || []), selectedRole])).map((r) => (
                  <option key={r} value={r}>
                    Rol: {r}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              <span>{user.email}</span>
              {userDefaultSeccionalName && (
                <>
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  <span>{userDefaultSeccionalName}</span>
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {otherUsers.length > 0 && (
              <button
                type="button"
                onClick={() => setShowCopyBar((prev) => !prev)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  showCopyBar
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
                }`}
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar de...</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* BARRA PLEGABLE: COPIAR DE OTRO USUARIO */}
        {showCopyBar && otherUsers.length > 0 && (
          <div className="px-5 py-3 bg-white border-b border-slate-200/70 shrink-0 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <select
                value={copySourceUserId}
                onChange={(e) => setCopySourceUserId(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-slate-400"
              >
                <option value="">Seleccionar usuario para copiar sus accesos...</option>
                {otherUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {getOtherUserLabel(u)} ({u.email})
                  </option>
                ))}
              </select>
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer px-2 py-1 whitespace-nowrap shrink-0">
                <input
                  type="checkbox"
                  checked={copyIncludeBaseRole}
                  onChange={(e) => setCopyIncludeBaseRole(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span>Incluir rol</span>
              </label>
              <button
                type="button"
                disabled={!copySourceUserId}
                onClick={handleCopyFromUser}
                className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-xl disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Aplicar copia
              </button>
            </div>
            {copyNotice && (
              <p className="text-xs text-emerald-700 font-medium">{copyNotice}</p>
            )}
          </div>
        )}

        {/* CONTROL SEGMENTADO PRINCIPAL ESTILO iOS */}
        <div className="px-5 pt-3 pb-2.5 bg-[#F2F2F7] border-b border-slate-200/60 shrink-0">
          <div className="bg-slate-200/75 p-1 rounded-xl grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('alcances')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'alcances'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Nivel y Alcance
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('modulos')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'modulos'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Módulos
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('todos')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
                activeTab === 'todos'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({summary.totalCount})
            </button>
          </div>
        </div>

        {/* CUERPO CON SCROLL INTERNO */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-4 space-y-5">
          {/* TAB 1: NIVEL Y ALCANCE */}
          {activeTab === 'alcances' && (
            <>
              {/* SECCIÓN 1: NIVEL OPERATIVO RÁPIDO (GLOBAL vs SECCIONAL) */}
              <div className="space-y-1.5">
                <p className="px-1 text-xs font-semibold text-slate-500">
                  Nivel general del usuario
                </p>
                <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 space-y-2.5">
                  <div className="bg-slate-100 p-1 rounded-xl grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={() => applyQuickGeneralScope('global')}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                        generalScopePreset === 'global'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Nivel Global
                    </button>
                    <button
                      type="button"
                      onClick={() => applyQuickGeneralScope('seccional')}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                        generalScopePreset === 'seccional'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Nivel Seccional
                    </button>
                    <button
                      type="button"
                      onClick={() => applyQuickGeneralScope('rol')}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                        generalScopePreset === 'rol'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Según su Rol
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 px-0.5">
                    {generalScopePreset === 'global'
                      ? 'Accede y gestiona información de todas las seccionales a nivel nacional.'
                      : generalScopePreset === 'rol'
                      ? `Hereda automáticamente los permisos estándar del rol ${selectedRole}.`
                      : 'Acceso delimitado a las seccionales y módulos seleccionados abajo.'}
                  </p>
                </div>
              </div>

              {/* SECCIÓN 2: SOCORRISTAS Y CONOCE A TU SOCORRISTA */}
              <div className="space-y-1.5">
                <p className="px-1 text-xs font-semibold text-slate-500">
                  Socorristas y Ficha «Conoce a tu Socorrista»
                </p>
                <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
                  {/* Alcance en Socorristas */}
                  <div className="p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Alcance en Socorristas
                        </p>
                        <p className="text-xs text-slate-500">
                          {secConfig.mode === 'all'
                            ? 'Puede ver todas las seccionales del país'
                            : secConfig.mode === 'custom'
                            ? `${customSeccionalesSelectedCount} seccional(es) habilitada(s) manualmente`
                            : 'Según el rol asignado al usuario'}
                        </p>
                      </div>

                      <div className="bg-slate-100 p-1 rounded-xl inline-flex items-center gap-1 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setSecConfig((prev) => ({ ...prev, mode: 'default' }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                            secConfig.mode === 'default'
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Según Rol
                        </button>
                        <button
                          type="button"
                          onClick={() => setSecConfig((prev) => ({ ...prev, mode: 'all' }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                            secConfig.mode === 'all'
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Global
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSecConfig((prev) => {
                              const hasAny = Object.values(prev.seccionales || {}).some(
                                (v) => v.view || v.add || v.edit
                              );
                              if (hasAny) return { ...prev, mode: 'custom' };
                              const fallbackId = userDefaultSeccionalId || seccionales[0]?.id;
                              return {
                                mode: 'custom',
                                seccionales: fallbackId
                                  ? { [fallbackId]: { view: true, add: false, edit: false } }
                                  : {},
                              };
                            });
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                            secConfig.mode === 'custom'
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Por Seccional
                        </button>
                      </div>
                    </div>

                    {/* Selector limpio de Seccionales solo cuando elige "Por Seccional" */}
                    {secConfig.mode === 'custom' && (
                      <div className="pt-2 border-t border-slate-100 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="relative flex-1 min-w-[180px] max-w-xs">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2" />
                            <input
                              type="text"
                              placeholder="Filtrar seccional..."
                              value={secSearchTerm}
                              onChange={(e) => setSecSearchTerm(e.target.value)}
                              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-none"
                            />
                          </div>
                          <div className="flex items-center gap-1.5 text-xs">
                            <button
                              type="button"
                              onClick={() => handleBulkSeccionales('view')}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer whitespace-nowrap shrink-0"
                            >
                              Ver todas
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBulkSeccionales('all')}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer whitespace-nowrap shrink-0"
                            >
                              Todo en todas
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBulkSeccionales('none')}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 text-rose-600 font-medium cursor-pointer whitespace-nowrap shrink-0"
                            >
                              Limpiar
                            </button>
                          </div>
                        </div>

                        <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 border border-slate-200/70 rounded-xl bg-slate-50/50">
                          {filteredSeccionales.map((sec) => {
                            const perm = secConfig.seccionales[sec.id] || {
                              view: false,
                              add: false,
                              edit: false,
                            };
                            return (
                              <div
                                key={sec.id}
                                className="px-3.5 py-2 flex items-center justify-between gap-3 bg-white hover:bg-slate-50/80"
                              >
                                <span className="text-xs font-medium text-slate-800 truncate">
                                  {sec.nombre}
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => toggleSeccionalPerm(sec.id, 'view')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                                      perm.view
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-slate-100 text-slate-500 hover:text-slate-800'
                                    }`}
                                  >
                                    Ver
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => toggleSeccionalPerm(sec.id, 'add')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                                      perm.add
                                        ? 'bg-slate-900 text-white'
                                        : 'bg-slate-100 text-slate-500 hover:text-slate-800'
                                    }`}
                                  >
                                    Agregar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => toggleSeccionalPerm(sec.id, 'edit')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                                      perm.edit
                                        ? 'bg-slate-900 text-white'
                                        : 'bg-slate-100 text-slate-500 hover:text-slate-800'
                                    }`}
                                  >
                                    Editar
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Ficha Conoce a tu Socorrista */}
                  <div className="px-4 py-3.5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        Descargar «Conoce a tu Socorrista»
                      </p>
                      <p className="text-xs text-slate-500">
                        Muestra el botón para descargar o imprimir la hoja CVSSOCC/FORM001 en Ver Perfil
                      </p>
                    </div>
                    <IosSwitch
                      checked={getPermissionStatus('descargar_ficha_conoce_socorrista').effectiveValue}
                      onChange={() => handleToggleBooleanPerm('descargar_ficha_conoce_socorrista')}
                      ariaLabel="Descargar ficha Conoce a tu Socorrista"
                    />
                  </div>

                  {/* Descargar Excel de Socorristas */}
                  <div className="px-4 py-3.5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        Descargar Excel de Socorristas
                      </p>
                      <p className="text-xs text-slate-500">
                        Permite exportar el padrón en formato Excel desde Socorristas
                      </p>
                    </div>
                    <IosSwitch
                      checked={getPermissionStatus('descargar_excel_socorristas').effectiveValue}
                      onChange={() => handleToggleBooleanPerm('descargar_excel_socorristas')}
                      ariaLabel="Descargar Excel de Socorristas"
                    />
                  </div>

                  {/* Asignar cargos de Junta Directiva Nacional (JDN) */}
                  <div className="px-4 py-3.5 flex items-center justify-between gap-4 bg-emerald-50/35">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        Asignar cargos de Junta Directiva Nacional (JDN)
                      </p>
                      <p className="text-xs text-slate-500">
                        Autoriza asignar, cambiar o liberar los 11 cargos únicos nacionales (Período 2026 - 2028)
                      </p>
                    </div>
                    <IosSwitch
                      checked={getPermissionStatus('assign_jdn_cargos').effectiveValue}
                      onChange={() => handleToggleBooleanPerm('assign_jdn_cargos')}
                      ariaLabel="Asignar cargos de Junta Directiva Nacional (JDN)"
                    />
                  </div>

                  {/* Expediente Digital */}
                  <div className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Expediente Digital del Socorrista
                      </p>
                      <p className="text-xs text-slate-500">
                        Documentos adjuntos en el perfil (DUI, antecedentes, atestados)
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {[
                        { key: 'ver_expediente_socorrista', label: 'Ver' },
                        { key: 'subir_expediente_socorrista', label: 'Subir' },
                        { key: 'descargar_expediente_socorrista', label: 'Descargar' },
                      ].map((item) => {
                        const active = getPermissionStatus(item.key).effectiveValue;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => handleToggleBooleanPerm(item.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                              active
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECCIÓN 3: SOLICITUDES Y FORMULARIOS */}
              <div className="space-y-1.5">
                <p className="px-1 text-xs font-semibold text-slate-500">
                  Solicitudes y Formularios
                </p>
                <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
                  {SCOPED_MODULES.map((mod) => {
                    const accessLevel = getModuleAccessLevel(
                      mod.viewKey,
                      mod.editKeys,
                      mod.correctKey
                    );
                    const currentScope = moduleScopes[mod.key];
                    const selectedSecIds = moduleSeccionales[mod.key] || [];
                    const isExpanded = expandedScopedModule === mod.key;
                    const canCorrectMod = mod.correctKey
                      ? getPermissionStatus(mod.correctKey).effectiveValue
                      : null;
                    const canCreate = mod.createKey
                      ? getPermissionStatus(mod.createKey).effectiveValue
                      : null;
                    const canResolve = mod.resolveKey
                      ? getPermissionStatus(mod.resolveKey).effectiveValue
                      : null;
                    const canHistorial = mod.historialKey
                      ? getPermissionStatus(mod.historialKey).effectiveValue
                      : null;
                    const canPlantillas = mod.plantillasKey
                      ? getPermissionStatus(mod.plantillasKey).effectiveValue
                      : null;
                    const canPreviewPdf = mod.pdfPreviewKey
                      ? getPermissionStatus(mod.pdfPreviewKey).effectiveValue
                      : null;

                    const visibleSeccionalesForScope = scopeSecSearch.trim()
                      ? seccionales.filter((s) =>
                          s.nombre.toLowerCase().includes(scopeSecSearch.trim().toLowerCase())
                        )
                      : seccionales;

                    const modeHint =
                      mod.correctKey && accessLevel !== 'blocked'
                        ? accessLevel === 'edit'
                          ? 'Gestionar'
                          : accessLevel === 'correct'
                          ? 'Ver y corregir'
                          : 'Solo ver (sin corregir)'
                        : null;

                    const scopeText =
                      accessLevel === 'blocked'
                        ? 'Oculto'
                        : currentScope === 'global'
                        ? 'Nivel Global'
                        : currentScope === 'seccional'
                        ? `Seccional (${selectedSecIds.length || 1})`
                        : 'Solo sus registros';

                    return (
                      <div key={mod.key} className="divide-y divide-slate-100">
                        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedScopedModule(isExpanded ? null : mod.key)
                            }
                            className="flex items-center justify-between sm:justify-start gap-2 text-left cursor-pointer group min-w-0"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900">
                                {mod.label}
                              </p>
                              <p className="text-xs text-slate-500 truncate">
                                {mod.subtitle}
                                {modeHint ? (
                                  <>
                                    {' · '}
                                    <span
                                      className={
                                        accessLevel === 'correct'
                                          ? 'text-amber-700 font-semibold'
                                          : accessLevel === 'view'
                                          ? 'text-slate-700 font-semibold'
                                          : 'text-emerald-700 font-semibold'
                                      }
                                    >
                                      {modeHint}
                                    </span>
                                  </>
                                ) : null}
                                {' · '}
                                <span className="text-slate-700 font-medium">{scopeText}</span>
                              </p>
                            </div>
                            <ChevronDown
                              className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-150 ${
                                isExpanded ? 'rotate-180 text-slate-700' : ''
                              }`}
                            />
                          </button>

                          <div className="bg-slate-100 p-1 rounded-xl inline-flex flex-wrap items-center gap-1 self-start sm:self-auto shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setModuleAccessLevel(
                                  mod.viewKey,
                                  mod.editKeys,
                                  'blocked',
                                  mod.correctKey
                                )
                              }
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                                accessLevel === 'blocked'
                                  ? 'bg-white text-rose-600 shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Oculto
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setModuleAccessLevel(
                                  mod.viewKey,
                                  mod.editKeys,
                                  'view',
                                  mod.correctKey
                                );
                                setExpandedScopedModule(mod.key);
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                                accessLevel === 'view'
                                  ? 'bg-white text-slate-900 shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                              title={
                                mod.correctKey
                                  ? 'Solo verá la solicitud y la observación, sin poder corregir ni cancelar'
                                  : undefined
                              }
                            >
                              Solo Ver
                            </button>
                            {mod.correctKey && (
                              <button
                                type="button"
                                onClick={() => {
                                  setModuleAccessLevel(
                                    mod.viewKey,
                                    mod.editKeys,
                                    'correct',
                                    mod.correctKey
                                  );
                                  setExpandedScopedModule(mod.key);
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                                  accessLevel === 'correct'
                                    ? 'bg-white text-amber-700 shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                                title="Podrá ver solicitudes, observaciones y corregir o cancelar las observadas"
                              >
                                Ver y Corregir
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setModuleAccessLevel(
                                  mod.viewKey,
                                  mod.editKeys,
                                  'edit',
                                  mod.correctKey
                                );
                                setExpandedScopedModule(mod.key);
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                                accessLevel === 'edit'
                                  ? 'bg-white text-emerald-700 shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              {mod.key === 'soporte' ? 'Solventar' : 'Gestionar'}
                            </button>
                          </div>
                        </div>

                        {/* Detalles limpios del módulo cuando está expandido y activo */}
                        {isExpanded && accessLevel !== 'blocked' && (
                          <div className="px-4 py-3.5 bg-slate-50/70 space-y-3">
                            {/* Alcance de lectura */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <span className="text-xs font-medium text-slate-700">
                                {mod.key === 'soporte'
                                  ? 'Solicitudes de soporte que puede ver'
                                  : 'Registros que puede ver'}
                              </span>
                              <div className="bg-slate-200/70 p-0.5 rounded-xl inline-flex items-center gap-0.5 self-start sm:self-auto">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setModuleScopes((prev) => ({ ...prev, [mod.key]: 'global' }));
                                    if (mod.key === 'soporte') {
                                      setCustomOverrides((prev) => ({
                                        ...prev,
                                        view_soporte_historial: true,
                                        view_soporte_seccional: false,
                                      }));
                                    }
                                  }}
                                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                                    currentScope === 'global'
                                      ? 'bg-white text-slate-900 shadow-2xs'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  Global
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setModuleScopes((prev) => ({ ...prev, [mod.key]: 'seccional' }));
                                    if (mod.key === 'soporte') {
                                      setCustomOverrides((prev) => ({
                                        ...prev,
                                        view_soporte_seccional: true,
                                        view_soporte_historial: false,
                                      }));
                                    }
                                    if (
                                      (moduleSeccionales[mod.key] || []).length === 0 &&
                                      userDefaultSeccionalId
                                    ) {
                                      setModuleSeccionales((prev) => ({
                                        ...prev,
                                        [mod.key]: [userDefaultSeccionalId],
                                      }));
                                    }
                                  }}
                                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                                    currentScope === 'seccional'
                                      ? 'bg-white text-slate-900 shadow-2xs'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  Por Seccional
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setModuleScopes((prev) => ({ ...prev, [mod.key]: 'usuario' }));
                                    if (mod.key === 'soporte') {
                                      setCustomOverrides((prev) => ({
                                        ...prev,
                                        view_soporte_historial: false,
                                        view_soporte_seccional: false,
                                      }));
                                    }
                                  }}
                                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                                    currentScope === 'usuario'
                                      ? 'bg-white text-slate-900 shadow-2xs'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  Solo propios
                                </button>
                              </div>
                            </div>

                            {/* Selección de seccionales visibles si eligió "Por Seccional" */}
                            {currentScope === 'seccional' && (
                              <div className="space-y-2 pt-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-slate-500 tabular-nums">
                                    Seccionales seleccionadas: {selectedSecIds.length}
                                  </span>
                                  <div className="flex items-center gap-2 text-xs">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setModuleSeccionales((prev) => ({
                                          ...prev,
                                          [mod.key]: seccionales.map((s) => s.id),
                                        }))
                                      }
                                      className="text-slate-700 hover:text-slate-950 font-medium cursor-pointer"
                                    >
                                      Todas
                                    </button>
                                    <span className="text-slate-300">·</span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setModuleSeccionales((prev) => ({
                                          ...prev,
                                          [mod.key]: [],
                                        }))
                                      }
                                      className="text-rose-600 hover:text-rose-700 font-medium cursor-pointer"
                                    >
                                      Limpiar
                                    </button>
                                  </div>
                                </div>

                                {seccionales.length > 8 && (
                                  <input
                                    type="text"
                                    value={scopeSecSearch}
                                    onChange={(e) => setScopeSecSearch(e.target.value)}
                                    placeholder="Buscar seccional..."
                                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl outline-none"
                                  />
                                )}

                                <div className="max-h-32 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                  {visibleSeccionalesForScope.map((sec) => {
                                    const checked = selectedSecIds.includes(sec.id);
                                    return (
                                      <button
                                        key={sec.id}
                                        type="button"
                                        onClick={() => toggleModuleSeccional(mod.key, sec.id)}
                                        className={`px-2.5 py-1.5 rounded-lg text-xs text-left truncate transition-colors cursor-pointer border ${
                                          checked
                                            ? 'bg-slate-900 text-white border-slate-900 font-medium'
                                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                        }`}
                                      >
                                        {sec.nombre}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Creación y alcance al crear (Combustible / Compra / Soporte) */}
                            {mod.createKey && (
                              <div className="pt-2 border-t border-slate-200/70 space-y-2.5">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <span className="text-xs font-medium text-slate-700 block">
                                      {mod.key === 'soporte'
                                        ? 'Hacer solicitudes de soporte'
                                        : 'Crear nuevas solicitudes'}
                                    </span>
                                    {mod.key === 'soporte' && (
                                      <span className="text-[11px] text-slate-500 block">
                                        Habilita enviar nuevos reportes de soporte y el botón rápido
                                      </span>
                                    )}
                                  </div>
                                  <IosSwitch
                                    checked={Boolean(canCreate)}
                                    onChange={() => setMultipleKeys([mod.createKey!], !canCreate)}
                                    ariaLabel={`Crear en ${mod.label}`}
                                  />
                                </div>

                                {(mod.key === 'solicitudes_combustible' ||
                                  mod.key === 'solicitudes_compra') &&
                                  canCreate && (
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                      <span className="text-xs font-medium text-slate-700">
                                        Nivel al crear solicitud
                                      </span>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <div className="bg-slate-200/70 p-0.5 rounded-xl inline-flex items-center gap-0.5">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setCreateScopes((prev) => ({
                                                ...prev,
                                                [mod.key]: 'global',
                                              }))
                                            }
                                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                                              createScopes[mod.key] === 'global'
                                                ? 'bg-white text-slate-900 shadow-2xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                          >
                                            Global
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const cKey = mod.key as CreateSolicitudModuleKey;
                                              setCreateScopes((prev) => ({
                                                ...prev,
                                                [cKey]: 'seccional',
                                              }));
                                              setCreateSeccionales((prev) => {
                                                if (prev[cKey]) return prev;
                                                const fallbackSec =
                                                  userDefaultSeccionalId ||
                                                  (moduleSeccionales[cKey]?.length
                                                    ? moduleSeccionales[cKey][0]
                                                    : null) ||
                                                  seccionales[0]?.id ||
                                                  null;
                                                return { ...prev, [cKey]: fallbackSec };
                                              });
                                            }}
                                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                                              createScopes[mod.key] === 'seccional'
                                                ? 'bg-white text-slate-900 shadow-2xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                          >
                                            Seccional fija
                                          </button>
                                        </div>

                                        {createScopes[mod.key] === 'seccional' && (
                                          <select
                                            value={createSeccionales[mod.key] ?? ''}
                                            onChange={(e) => {
                                              const cKey = mod.key as CreateSolicitudModuleKey;
                                              const val = e.target.value
                                                ? Number(e.target.value)
                                                : null;
                                              setCreateSeccionales((prev) => ({
                                                ...prev,
                                                [cKey]: val,
                                              }));
                                            }}
                                            className="px-2.5 py-1 text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-lg outline-none"
                                          >
                                            <option value="">Seleccionar seccional...</option>
                                            {seccionales.map((sec) => (
                                              <option key={sec.id} value={sec.id}>
                                                {sec.nombre}
                                              </option>
                                            ))}
                                          </select>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                {(mod.key === 'solicitudes_combustible' ||
                                  mod.key === 'solicitudes_compra') &&
                                  canCreate && (() => {
                                    const cKey = mod.key as CreateSolicitudModuleKey;
                                    const currentExtra = extraSolicitudesEnProceso[cKey] ?? 0;
                                    const presets: { label: string; value: number }[] = [
                                      { label: 'Ninguna', value: 0 },
                                      { label: '+1', value: 1 },
                                      { label: '+2', value: 2 },
                                      { label: '+3', value: 3 },
                                      { label: '+5', value: 5 },
                                      { label: '+7', value: 7 },
                                      { label: 'Sin límite', value: -1 },
                                    ];
                                    const summaryText =
                                      currentExtra < 0
                                        ? 'Sin límite · Puede enviar solicitudes aunque existan otras en proceso'
                                        : currentExtra === 0
                                        ? 'Ninguna adicional · Máx. 1 en proceso hasta finalizar la anterior'
                                        : `Puede realizar ${currentExtra} ${
                                            currentExtra === 1 ? 'solicitud más' : 'solicitudes más'
                                          } teniendo una activa (máx. ${currentExtra + 1} en proceso)`;

                                    return (
                                      <div className="pt-2.5 border-t border-slate-200/70 space-y-2">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                          <div className="min-w-0">
                                            <span className="text-xs font-medium text-slate-700 block">
                                              Solicitudes adicionales teniendo una en proceso
                                            </span>
                                            <span className="text-[11px] text-slate-500 block mt-0.5 tabular-nums">
                                              {summaryText}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1.5 shrink-0">
                                            <label className="text-[11px] text-slate-500 whitespace-nowrap">
                                              Cantidad:
                                            </label>
                                            <input
                                              type="number"
                                              min={0}
                                              max={99}
                                              disabled={currentExtra < 0}
                                              value={currentExtra < 0 ? '' : currentExtra}
                                              placeholder="∞"
                                              onChange={(e) => {
                                                const rawVal = e.target.value;
                                                const parsed = rawVal === '' ? 0 : Math.max(0, Math.min(99, Math.floor(Number(rawVal) || 0)));
                                                setExtraSolicitudesEnProceso((prev) => ({
                                                  ...prev,
                                                  [cKey]: parsed,
                                                }));
                                              }}
                                              className="w-16 px-2.5 py-1 text-xs font-semibold text-center tabular-nums text-slate-900 bg-white border border-slate-200 rounded-lg outline-none focus:border-slate-400 disabled:bg-slate-100 disabled:text-slate-400"
                                            />
                                          </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-1.5">
                                          {presets.map((preset) => {
                                            const active = currentExtra === preset.value;
                                            return (
                                              <button
                                                key={preset.label}
                                                type="button"
                                                onClick={() =>
                                                  setExtraSolicitudesEnProceso((prev) => ({
                                                    ...prev,
                                                    [cKey]: preset.value,
                                                  }))
                                                }
                                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
                                                  active
                                                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                                                }`}
                                              >
                                                {preset.label}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })()}
                              </div>
                            )}

                            {/* Permiso explícito para corregir solicitudes observadas (Solicitudes de Carnet) */}
                            {mod.correctKey && (
                              <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between gap-3">
                                <div>
                                  <span className="text-xs font-medium text-slate-700 block">
                                    Corregir solicitudes observadas
                                  </span>
                                  <span className="text-[11px] text-slate-500 block">
                                    {accessLevel === 'edit'
                                      ? 'Incluido automáticamente al tener acceso de Gestionar.'
                                      : 'Si está desactivado (Solo ver), verá la solicitud y la observación sin botones para corregir ni cancelar.'}
                                  </span>
                                </div>
                                <IosSwitch
                                  checked={Boolean(canCorrectMod || accessLevel === 'edit')}
                                  disabled={accessLevel === 'edit'}
                                  onChange={() =>
                                    setMultipleKeys([mod.correctKey!], !canCorrectMod)
                                  }
                                  ariaLabel="Corregir solicitudes de carnet observadas"
                                />
                              </div>
                            )}

                            {/* Permiso explícito para solventar solicitudes de soporte */}
                            {mod.resolveKey && (
                              <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between gap-3">
                                <div>
                                  <span className="text-xs font-medium text-slate-700 block">
                                    Solventar solicitudes de soporte
                                  </span>
                                  <span className="text-[11px] text-slate-500 block">
                                    Permite cambiar estado (En revisión / Finalizado) y dar respuesta
                                  </span>
                                </div>
                                <IosSwitch
                                  checked={Boolean(canResolve)}
                                  onChange={() => setMultipleKeys([mod.resolveKey!], !canResolve)}
                                  ariaLabel="Solventar solicitudes de soporte"
                                />
                              </div>
                            )}

                            {/* Botones adicionales del módulo */}
                            {(mod.historialKey || mod.plantillasKey || mod.pdfPreviewKey) && (
                              <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-medium text-slate-700">
                                  Funciones visibles
                                </span>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {mod.historialKey && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setMultipleKeys([mod.historialKey!], !canHistorial)
                                      }
                                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                                        canHistorial
                                          ? 'bg-emerald-600 text-white'
                                          : 'bg-white border border-slate-200 text-slate-600'
                                      }`}
                                    >
                                      Historial
                                    </button>
                                  )}
                                  {mod.plantillasKey && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setMultipleKeys([mod.plantillasKey!], !canPlantillas)
                                      }
                                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                                        canPlantillas
                                          ? 'bg-emerald-600 text-white'
                                          : 'bg-white border border-slate-200 text-slate-600'
                                      }`}
                                    >
                                      Plantillas
                                    </button>
                                  )}
                                  {mod.pdfPreviewKey && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setMultipleKeys([mod.pdfPreviewKey!], !canPreviewPdf)
                                      }
                                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                                        canPreviewPdf
                                          ? 'bg-emerald-600 text-white'
                                          : 'bg-white border border-slate-200 text-slate-600'
                                      }`}
                                    >
                                      Vista PDF
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* TAB 2: MÓDULOS GENERALES */}
          {activeTab === 'modulos' && (
            <div className="space-y-1.5">
              <p className="px-1 text-xs font-semibold text-slate-500">
                Nivel de acceso por módulo
              </p>
              <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
                {SIMPLE_VIEW_EDIT_MODULES.map((mod) => {
                  const level = getModuleAccessLevel(mod.viewKey, mod.editKeys);
                  const isCustom =
                    customOverrides[mod.viewKey] !== undefined ||
                    mod.editKeys.some((ek) => customOverrides[ek] !== undefined);

                  return (
                    <div
                      key={mod.viewKey}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          {mod.label}
                          {isCustom && (
                            <span className="ml-2 text-xs font-normal text-amber-700">
                              · Personalizado
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{mod.desc}</p>
                      </div>

                      <div className="bg-slate-100 p-1 rounded-xl inline-flex items-center gap-1 self-start sm:self-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => setMultipleKeys([mod.viewKey, ...mod.editKeys], 'role')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                            !isCustom
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          Rol
                        </button>
                        <button
                          type="button"
                          onClick={() => setModuleAccessLevel(mod.viewKey, mod.editKeys, 'blocked')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                            isCustom && level === 'blocked'
                              ? 'bg-white text-rose-600 shadow-2xs'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          Oculto
                        </button>
                        <button
                          type="button"
                          onClick={() => setModuleAccessLevel(mod.viewKey, mod.editKeys, 'view')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                            isCustom && level === 'view'
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          Ver
                        </button>
                        <button
                          type="button"
                          onClick={() => setModuleAccessLevel(mod.viewKey, mod.editKeys, 'edit')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                            isCustom && level === 'edit'
                              ? 'bg-white text-emerald-700 shadow-2xs'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          Editar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: TODOS LOS PERMISOS (DETALLADO) */}
          {activeTab === 'todos' && (
            <div className="space-y-3">
              <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar permiso..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-none"
                    />
                  </div>

                  <div className="bg-slate-100 p-1 rounded-xl inline-flex items-center gap-0.5 text-xs font-semibold shrink-0 tabular-nums">
                    <button
                      type="button"
                      onClick={() => setActiveFilter('todos')}
                      className={`px-2.5 py-1 rounded-lg cursor-pointer whitespace-nowrap shrink-0 ${
                        activeFilter === 'todos'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-500'
                      }`}
                    >
                      Todos ({summary.totalCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFilter('permitidos')}
                      className={`px-2.5 py-1 rounded-lg cursor-pointer whitespace-nowrap shrink-0 ${
                        activeFilter === 'permitidos'
                          ? 'bg-white text-emerald-700 shadow-2xs'
                          : 'text-slate-500'
                      }`}
                    >
                      Activos ({summary.allowedCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFilter('personalizados')}
                      className={`px-2.5 py-1 rounded-lg cursor-pointer whitespace-nowrap shrink-0 ${
                        activeFilter === 'personalizados'
                          ? 'bg-white text-amber-800 shadow-2xs'
                          : 'text-slate-500'
                      }`}
                    >
                      Ajustados ({summary.overrideCount})
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="todas">Todas las áreas</option>
                    {Object.entries(PERMISSION_CATEGORIES).map(([catKey, cat]) => (
                      <option key={catKey} value={catKey}>
                        {cat.label}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => applyQuickGeneralScope('rol')}
                      className="text-slate-600 hover:text-slate-900 font-medium inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restablecer a rol</span>
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={handleAllowAll}
                      className="text-emerald-700 hover:text-emerald-800 font-medium cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Activar todo
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={handleDenyAll}
                      className="text-rose-600 hover:text-rose-700 font-medium cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Bloquear todo
                    </button>
                  </div>
                </div>
              </div>

              {filteredKeys.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200/80 py-10 text-center text-xs text-slate-500">
                  No se encontraron permisos con ese criterio.
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
                  {filteredKeys.map((key) => {
                    const status = getPermissionStatus(key);
                    const label = permissionLabels[key] || key;

                    return (
                      <div
                        key={key}
                        className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900">{label}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {status.effectiveValue ? 'Permitido' : 'No permitido'}
                            {' · '}
                            {status.isOverridden
                              ? 'Ajuste individual'
                              : `Heredado de ${selectedRole}`}
                          </p>
                        </div>

                        <div className="bg-slate-100 p-0.5 rounded-xl inline-flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleSetOverride(key, 'role')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                              !status.isOverridden
                                ? 'bg-white text-slate-900 shadow-2xs'
                                : 'text-slate-500 hover:text-slate-900'
                            }`}
                          >
                            Rol
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetOverride(key, 'allow')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                              status.isOverridden && status.overrideValue === true
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'text-slate-500 hover:text-emerald-700'
                            }`}
                          >
                            Sí
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetOverride(key, 'deny')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                              status.isOverridden && status.overrideValue === false
                                ? 'bg-rose-600 text-white shadow-2xs'
                                : 'text-slate-500 hover:text-rose-600'
                            }`}
                          >
                            No
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* PIE FIJO ESTILO iOS */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-200/80 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 tabular-nums truncate">
            <span>{summary.allowedCount} permisos activos</span>
            {summary.overrideCount > 0 && (
              <>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span className="text-slate-700 font-medium">
                  {summary.overrideCount} personalizados
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Guardando...' : 'Guardar'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
