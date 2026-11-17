import React, { useState, useMemo } from 'react';
import {
  Shield,
  Check,
  X,
  Search,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Sliders,
  HelpCircle,
  FolderDown,
  Car,
  Users,
  Sparkles,
  Megaphone,
  FileSpreadsheet,
  MapPin,
  IdCard,
  Fuel,
  FileText,
  Globe,
  Building2,
  User,
  Lock,
  Eye,
  Edit3,
  Plus,
  Copy,
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

const PERMISSION_CATEGORIES: Record<string, { label: string; icon: any; keys: string[] }> = {
  socorristas: {
    label: 'Socorristas y Méritos',
    icon: Users,
    keys: [
      'view_socorristas',
      'add_socorristas',
      'edit_socorristas',
      'subir_expediente_socorrista',
      'ver_expediente_socorrista',
      'descargar_expediente_socorrista',
      'cambiar_estado_socorrista',
      'descargar_excel_socorristas',
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
    label: 'Vehículos y Solicitudes',
    icon: Car,
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
      'edit_solicitudes_carnet',
    ],
  },
  contenido: {
    label: 'Archivos y Seccionales',
    icon: FolderDown,
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
    icon: Megaphone,
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
  admin: {
    label: 'Seguridad y Sistema',
    icon: Shield,
    keys: [
      'ver_todas_seccionales',
      'ver_personas_conectadas',
      'personalizar_colores',
      'view_soporte',
      'view_soporte_historial',
      'edit_soporte_estado',
      'view_config',
      'view_activity',
      'view_accesos',
    ],
  },
};

const SCOPED_MODULES: {
  key: ScopedModuleKey;
  label: string;
  desc: string;
  icon: any;
  viewKey: string;
  editKeys: string[];
  createKey?: string;
  historialKey?: string;
  plantillasKey?: string;
  pdfPreviewKey?: string;
}[] = [
  {
    key: 'formularios',
    label: 'Formularios',
    desc: 'Control de formularios institucionales y respuestas (sin opción de eliminar).',
    icon: FileSpreadsheet,
    viewKey: 'view_formularios',
    editKeys: ['edit_formularios', 'crear_formularios'],
  },
  {
    key: 'solicitudes_combustible',
    label: 'Solicitudes de Combustible',
    desc: 'Gestión de vales, dotación y aprobaciones (sin opción de eliminar).',
    icon: Fuel,
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
    desc: 'Requisiciones de insumos, repuestos y mantenimiento (sin opción de eliminar).',
    icon: FileText,
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
    desc: 'Control de solicitudes pendientes, observadas y completadas (sin opción de eliminar).',
    icon: IdCard,
    viewKey: 'view_solicitudes_carnet',
    editKeys: ['edit_solicitudes_carnet'],
  },
];

const SIMPLE_VIEW_EDIT_MODULES: {
  label: string;
  desc: string;
  viewKey: string;
  editKeys: string[];
}[] = [
  {
    label: 'Noticias y Ajustes de Banner (Dashboard)',
    desc: 'Ver la pestaña de Noticias y configurar slides, imágenes, editor y tiempos del banner.',
    viewKey: 'view_noticias_ajustes',
    editKeys: ['edit_noticias_banner'],
  },
  {
    label: 'Anuncios Institucionales',
    desc: 'Publicar, editar o solo leer avisos y boletines.',
    viewKey: 'view_anuncios',
    editKeys: ['edit_anuncios', 'crear_anuncios'],
  },
  {
    label: 'Archivos Descargables',
    desc: 'Subir y administrar documentos o solo descargar.',
    viewKey: 'view_archivos',
    editKeys: ['edit_archivos', 'subir_archivos'],
  },
  {
    label: 'Méritos y Premios',
    desc: 'Registrar condecoraciones y enlaces o solo consultar.',
    viewKey: 'view_meritos',
    editKeys: ['edit_meritos'],
  },
  {
    label: 'Flota de Vehículos',
    desc: 'Crear/editar vehículos y mantenimientos o solo visualizar.',
    viewKey: 'view_vehiculos',
    editKeys: ['edit_vehiculos'],
  },
  {
    label: 'Socorristas (Nivel General)',
    desc: 'Acceso base al módulo de socorristas; las seccionales específicas se configuran en la pestaña de Seccionales.',
    viewKey: 'view_socorristas',
    editKeys: ['edit_socorristas'],
  },
  {
    label: 'Seccionales',
    desc: 'Crear y modificar información de seccionales o solo consultar.',
    viewKey: 'view_seccionales',
    editKeys: ['edit_seccionales'],
  },
  {
    label: 'Directorio y Directores',
    desc: 'Editar contactos institucionales y directorio o solo lectura.',
    viewKey: 'view_directorio',
    editKeys: ['edit_directorio'],
  },
  {
    label: 'Soporte Técnico (Historial Global y Finalizar Casos)',
    desc: 'Permitir ver el historial completo de reportes de soporte de todos los usuarios, agregar notas y cambiar el estado a Finalizado.',
    viewKey: 'view_soporte_historial',
    editKeys: ['edit_soporte_estado'],
  },
];

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
      ver_personas_conectadas: false,
      view_meritos: true,
      view_anuncios: true,
      view_formularios: true,
      view_soporte: true,
    };
  };

  const baseRolePermissions = useMemo(
    () => getRolePermsMap(selectedRole),
    [selectedRole, rolePermissions, permissionLabels]
  );

  const userDefaultSeccionalId = user?.socorristas?.seccional_id ? Number(user.socorristas.seccional_id) : null;

  // Extract ONLY boolean overrides safely (preserve _module_scopes, _module_seccionales and _seccionales_socorristas separately)
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
    return {
      formularios: rawScopes.formularios || (baseRolePermissions.ver_todos_formularios ? 'global' : 'usuario'),
      solicitudes_combustible: rawScopes.solicitudes_combustible || (baseRolePermissions.ver_todas_seccionales ? 'global' : 'usuario'),
      solicitudes_compra: rawScopes.solicitudes_compra || (baseRolePermissions.ver_todas_seccionales ? 'global' : 'usuario'),
      solicitudes_carnet: rawScopes.solicitudes_carnet || (baseRolePermissions.ver_todas_seccionales ? 'global' : 'seccional'),
    };
  });

  const [moduleSeccionales, setModuleSeccionales] = useState<Record<ScopedModuleKey, number[]>>(() => {
    const rawModSeccs = user.custom_permissions?._module_seccionales || {};
    const fallbackArr = userDefaultSeccionalId ? [userDefaultSeccionalId] : [];
    const parseArr = (val: any) =>
      Array.isArray(val) ? Array.from(new Set(val.map(Number).filter((n) => !isNaN(n) && n > 0))) : fallbackArr;
    return {
      formularios: parseArr(rawModSeccs.formularios),
      solicitudes_combustible: parseArr(rawModSeccs.solicitudes_combustible),
      solicitudes_compra: parseArr(rawModSeccs.solicitudes_compra),
      solicitudes_carnet: parseArr(rawModSeccs.solicitudes_carnet),
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

  const [activeTab, setActiveTab] = useState<'alcances' | 'seccionales' | 'modulos' | 'todos'>('alcances');
  const [searchTerm, setSearchTerm] = useState('');
  const [secSearchTerm, setSecSearchTerm] = useState('');
  const [scopeSecSearch, setScopeSecSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'todos' | 'permitidos' | 'denegados' | 'personalizados'>('todos');
  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  const [isSaving, setIsSaving] = useState(false);

  // Copiar accesos desde otro usuario
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
      u.id;
    return `${name} (${u.email || 'sin correo'}) — Rol: ${u.role}`;
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

    // Construir overrides booleanos
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
      // Materializar cualquier permiso efectivo del usuario origen que difiera del rol destino actual
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

    // Copiar alcances de módulos
    const srcScopes = srcCp._module_scopes || {};
    setModuleScopes({
      formularios: srcScopes.formularios || (srcRolePerms.ver_todos_formularios ? 'global' : 'usuario'),
      solicitudes_combustible: srcScopes.solicitudes_combustible || (srcRolePerms.ver_todas_seccionales ? 'global' : 'usuario'),
      solicitudes_compra: srcScopes.solicitudes_compra || (srcRolePerms.ver_todas_seccionales ? 'global' : 'usuario'),
      solicitudes_carnet: srcScopes.solicitudes_carnet || (srcRolePerms.ver_todas_seccionales ? 'global' : 'seccional'),
    });

    // Copiar seccionales por módulo
    const srcModSeccs = srcCp._module_seccionales || {};
    const parseArr = (val: any) =>
      Array.isArray(val) ? Array.from(new Set(val.map(Number).filter((n) => !isNaN(n) && n > 0))) : [];
    setModuleSeccionales({
      formularios: parseArr(srcModSeccs.formularios),
      solicitudes_combustible: parseArr(srcModSeccs.solicitudes_combustible),
      solicitudes_compra: parseArr(srcModSeccs.solicitudes_compra),
      solicitudes_carnet: parseArr(srcModSeccs.solicitudes_carnet),
    });

    // Copiar alcances de creación
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

    // Copiar permisos por seccional (Socorristas)
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
    setCopyNotice(`Configuración de acceso copiada de "${srcName}". Ya puedes modificar cualquier permiso abajo antes de guardar.`);
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

  const getModuleAccessLevel = (viewKey: string, editKeys: string[]): 'blocked' | 'view' | 'edit' => {
    const canView = getPermissionStatus(viewKey).effectiveValue;
    const canEdit = editKeys.some((ek) => getPermissionStatus(ek).effectiveValue);
    if (!canView && !canEdit) return 'blocked';
    if (canEdit) return 'edit';
    return 'view';
  };

  const setModuleAccessLevel = (viewKey: string, editKeys: string[], level: 'blocked' | 'view' | 'edit') => {
    setCustomOverrides((prev) => {
      const copy = { ...prev };
      if (level === 'blocked') {
        copy[viewKey] = false;
        editKeys.forEach((ek) => {
          copy[ek] = false;
        });
      } else if (level === 'view') {
        copy[viewKey] = true;
        editKeys.forEach((ek) => {
          copy[ek] = false;
        });
      } else {
        copy[viewKey] = true;
        editKeys.forEach((ek) => {
          copy[ek] = true;
        });
      }
      return copy;
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
      // If granting add or edit, automatically ensure view is enabled
      if ((field === 'add' || field === 'edit') && nextVal) {
        updated.view = true;
      }
      // If disabling view, also disable add & edit
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

  const handleBulkSeccionales = (field: 'view' | 'add' | 'edit' | 'all' | 'none') => {
    setSecConfig((prev) => {
      if (field === 'none') {
        return { mode: 'custom', seccionales: {} };
      }
      const nextMap: Record<number, { view: boolean; add: boolean; edit: boolean }> = {};
      seccionales.forEach((s) => {
        const cur = prev.seccionales[s.id] || { view: false, add: false, edit: false };
        if (field === 'all') {
          nextMap[s.id] = { view: true, add: true, edit: true };
        } else {
          const allCurrentlyOn = seccionales.every((sec) => prev.seccionales[sec.id]?.[field]);
          const target = !allCurrentlyOn;
          nextMap[s.id] = {
            ...cur,
            [field]: target,
            ...(target && (field === 'add' || field === 'edit') ? { view: true } : {}),
            ...(field === 'view' && !target ? { add: false, edit: false } : {}),
          };
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

  const handleResetAllToRole = () => {
    if (confirm(`¿Restablecer todos los permisos de ${user.email} para que hereden exactamente su rol base "${user.role}"?`)) {
      setCustomOverrides({});
      setSecConfig({ mode: 'default', seccionales: {} });
      setModuleScopes({
        formularios: baseRolePermissions.ver_todos_formularios ? 'global' : 'usuario',
        solicitudes_combustible: baseRolePermissions.ver_todas_seccionales ? 'global' : 'usuario',
        solicitudes_compra: baseRolePermissions.ver_todas_seccionales ? 'global' : 'usuario',
        solicitudes_carnet: baseRolePermissions.ver_todas_seccionales ? 'global' : 'seccional',
      });
      const fallbackArr = userDefaultSeccionalId ? [userDefaultSeccionalId] : [];
      setModuleSeccionales({
        formularios: fallbackArr,
        solicitudes_combustible: fallbackArr,
        solicitudes_compra: fallbackArr,
        solicitudes_carnet: fallbackArr,
      });
      const defaultCreateScope: CreateSolicitudScope = baseRolePermissions.ver_todas_seccionales ? 'global' : 'seccional';
      setCreateScopes({
        solicitudes_combustible: defaultCreateScope,
        solicitudes_compra: defaultCreateScope,
      });
      setCreateSeccionales({
        solicitudes_combustible: userDefaultSeccionalId ?? seccionales[0]?.id ?? null,
        solicitudes_compra: userDefaultSeccionalId ?? seccionales[0]?.id ?? null,
      });
    }
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
    } else if (activeFilter === 'denegados') {
      keys = keys.filter((k) => !getPermissionStatus(k).effectiveValue);
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200/80 animate-in zoom-in-95 duration-150">
        {/* HEADER */}
        <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-3.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center border border-slate-200/60 shadow-2xs shrink-0">
              <Sliders className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-semibold text-gray-900 tracking-tight">
                  Permisos Individuales y Alcance por Seccional
                </h2>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="px-2 py-0.5 rounded-lg text-3xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 uppercase cursor-pointer outline-none focus:border-emerald-500"
                  title="Rol base asignado al usuario"
                >
                  {Array.from(new Set([...(roles || []), selectedRole])).map((r) => (
                    <option key={r} value={r}>
                      Rol: {r}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-2xs text-gray-400 truncate">
                {nombreUsuario} &bull; <span className="font-mono text-gray-500">{user.email}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* COPIAR CONFIGURACIÓN DE OTRO USUARIO */}
        {otherUsers.length > 0 && (
          <div className="px-6 py-2.5 bg-emerald-50/60 border-b border-emerald-200/60 shrink-0 space-y-1.5">
            <div className="flex flex-col md:flex-row md:items-center gap-2 justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-950 shrink-0">
                <Copy className="w-3.5 h-3.5 text-emerald-600" />
                <span>Copiar configuración de otro usuario:</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 flex-1 md:justify-end">
                <select
                  value={copySourceUserId}
                  onChange={(e) => setCopySourceUserId(e.target.value)}
                  className="flex-1 min-w-[220px] max-w-md bg-white border border-emerald-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="">-- Seleccionar usuario origen --</option>
                  {otherUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {getOtherUserLabel(u)}
                    </option>
                  ))}
                </select>
                <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-700 cursor-pointer bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                  <input
                    type="checkbox"
                    checked={copyIncludeBaseRole}
                    onChange={(e) => setCopyIncludeBaseRole(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                  />
                  <span>Incluir su rol base</span>
                </label>
                <button
                  type="button"
                  disabled={!copySourceUserId}
                  onClick={handleCopyFromUser}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1.5"
                >
                  <Copy className="w-3 h-3" />
                  Copiar aquí
                </button>
              </div>
            </div>
            {copyNotice && (
              <p className="text-[11px] font-medium text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{copyNotice}</span>
              </p>
            )}
          </div>
        )}

        {/* QUICK STATS + TOP NAVIGATION TABS */}
        <div className="px-6 py-3 bg-slate-50/80 border-b border-slate-200/70 space-y-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-3xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <Check className="w-3 h-3 mr-1 text-emerald-600" />
                {summary.allowedCount} Permitidos
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-3xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/60">
                <X className="w-3 h-3 mr-1 text-rose-600" />
                {summary.deniedCount} Bloqueados
              </span>
              {summary.overrideCount > 0 && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-3xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/60">
                  <Sparkles className="w-3 h-3 mr-1 text-amber-600" />
                  {summary.overrideCount} Excepciones
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleResetAllToRole}
                className="px-2.5 py-1 text-3xs font-semibold text-slate-600 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors inline-flex items-center cursor-pointer shadow-2xs"
              >
                <RotateCcw className="w-3 h-3 mr-1 text-slate-400" />
                Heredar de Rol
              </button>
              <button
                type="button"
                onClick={handleAllowAll}
                className="px-2.5 py-1 text-3xs font-semibold text-emerald-700 bg-white hover:bg-emerald-50 rounded-lg border border-slate-200 transition-colors inline-flex items-center cursor-pointer shadow-2xs"
              >
                <Check className="w-3 h-3 mr-1 text-emerald-600" />
                Permitir Todo
              </button>
              <button
                type="button"
                onClick={handleDenyAll}
                className="px-2.5 py-1 text-3xs font-semibold text-rose-700 bg-white hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors inline-flex items-center cursor-pointer shadow-2xs"
              >
                <X className="w-3 h-3 mr-1 text-rose-600" />
                Denegar Todo
              </button>
            </div>
          </div>

          {/* 4 Main Configuration Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('alcances')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                activeTab === 'alcances'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              Formularios y Solicitudes (Alcance)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('seccionales')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                activeTab === 'seccionales'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              Seccionales (Socorristas)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('modulos')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                activeTab === 'modulos'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              Módulos (Ver vs Editar)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('todos')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                activeTab === 'todos'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Todos los Permisos ({summary.totalCount})
            </button>
          </div>
        </div>

        {/* TAB BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 space-y-4">
          {/* TAB 1: FORMULARIOS Y SOLICITUDES CON ALCANCE */}
          {activeTab === 'alcances' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/80 text-xs text-blue-900 flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  Configura de forma individual qué módulos de <strong>Formularios</strong> y <strong>Solicitudes</strong>{' '}
                  tiene activos el usuario, si puede <strong>Solo Ver</strong> o <strong>Editar</strong> (sin permisos de
                  eliminación), y qué registros puede ver según su alcance: <strong>Global</strong>,{' '}
                  <strong>Solo su Seccional</strong> o <strong>Solo de Usuario</strong>.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SCOPED_MODULES.map((mod) => {
                  const IconComp = mod.icon;
                  const accessLevel = getModuleAccessLevel(mod.viewKey, mod.editKeys);
                  const currentScope = moduleScopes[mod.key];
                  const selectedSecIds = moduleSeccionales[mod.key] || [];
                  const canCreate = mod.createKey ? getPermissionStatus(mod.createKey).effectiveValue : null;
                  const canHistorial = mod.historialKey ? getPermissionStatus(mod.historialKey).effectiveValue : null;
                  const canPlantillas = mod.plantillasKey ? getPermissionStatus(mod.plantillasKey).effectiveValue : null;
                  const canPreviewPdf = mod.pdfPreviewKey ? getPermissionStatus(mod.pdfPreviewKey).effectiveValue : null;
                  const visibleSeccionalesForScope = scopeSecSearch.trim()
                    ? seccionales.filter((s) => s.nombre.toLowerCase().includes(scopeSecSearch.trim().toLowerCase()))
                    : seccionales;

                  return (
                    <div
                      key={mod.key}
                      className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-3.5 flex flex-col justify-between"
                    >
                      <div className="space-y-3.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center justify-center shrink-0">
                              <IconComp className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-xs font-bold text-slate-900">{mod.label}</h3>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                  Eliminar: No
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{mod.desc}</p>
                            </div>
                          </div>
                        </div>

                        {/* Nivel de Acceso: Desactivado / Solo Ver / Editar */}
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-semibold text-slate-600 block">
                            Nivel de Acción:
                          </span>
                          <div className="grid grid-cols-3 bg-slate-100 p-0.5 rounded-xl border border-slate-200/60 gap-0.5">
                            <button
                              type="button"
                              onClick={() => setModuleAccessLevel(mod.viewKey, mod.editKeys, 'blocked')}
                              className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer transition-all ${
                                accessLevel === 'blocked'
                                  ? 'bg-rose-600 text-white shadow-2xs'
                                  : 'text-slate-600 hover:bg-white/70'
                              }`}
                            >
                              <Lock className="w-3 h-3" />
                              Desactivado
                            </button>
                            <button
                              type="button"
                              onClick={() => setModuleAccessLevel(mod.viewKey, mod.editKeys, 'view')}
                              className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer transition-all ${
                                accessLevel === 'view'
                                  ? 'bg-amber-500 text-white shadow-2xs'
                                  : 'text-slate-600 hover:bg-white/70'
                              }`}
                            >
                              <Eye className="w-3 h-3" />
                              Solo Ver
                            </button>
                            <button
                              type="button"
                              onClick={() => setModuleAccessLevel(mod.viewKey, mod.editKeys, 'edit')}
                              className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer transition-all ${
                                accessLevel === 'edit'
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'text-slate-600 hover:bg-white/70'
                              }`}
                            >
                              <Edit3 className="w-3 h-3" />
                              Editar
                            </button>
                          </div>
                        </div>

                        {/* Alcance de Visibilidad: Global / Seccional / Usuario */}
                        <div className={`space-y-2 ${accessLevel === 'blocked' ? 'opacity-45 pointer-events-none' : ''}`}>
                          <span className="text-[11px] font-semibold text-slate-600 block">
                            Alcance de Registros Visibles:
                          </span>
                          <div className="grid grid-cols-3 bg-slate-100 p-0.5 rounded-xl border border-slate-200/60 gap-0.5">
                            <button
                              type="button"
                              onClick={() => setModuleScopes((prev) => ({ ...prev, [mod.key]: 'global' }))}
                              className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer transition-all ${
                                currentScope === 'global'
                                  ? 'bg-slate-900 text-white shadow-2xs'
                                  : 'text-slate-600 hover:bg-white/70'
                              }`}
                            >
                              <Globe className="w-3 h-3" />
                              Globales
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setModuleScopes((prev) => ({ ...prev, [mod.key]: 'seccional' }));
                                if ((moduleSeccionales[mod.key] || []).length === 0 && userDefaultSeccionalId) {
                                  setModuleSeccionales((prev) => ({ ...prev, [mod.key]: [userDefaultSeccionalId] }));
                                }
                              }}
                              className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer transition-all ${
                                currentScope === 'seccional'
                                  ? 'bg-slate-900 text-white shadow-2xs'
                                  : 'text-slate-600 hover:bg-white/70'
                              }`}
                            >
                              <Building2 className="w-3 h-3" />
                              Seccional
                            </button>
                            <button
                              type="button"
                              onClick={() => setModuleScopes((prev) => ({ ...prev, [mod.key]: 'usuario' }))}
                              className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer transition-all ${
                                currentScope === 'usuario'
                                  ? 'bg-slate-900 text-white shadow-2xs'
                                  : 'text-slate-600 hover:bg-white/70'
                              }`}
                            >
                              <User className="w-3 h-3" />
                              Usuario
                            </button>
                          </div>

                          {/* Checklist de Seccional(es) cuando selecciona Alcance = Seccional */}
                          {currentScope === 'seccional' && (
                            <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                                  Seccionales habilitadas ({selectedSecIds.length})
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setModuleSeccionales((prev) => ({
                                        ...prev,
                                        [mod.key]: seccionales.map((s) => s.id),
                                      }))
                                    }
                                    className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                                  >
                                    Todas
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setModuleSeccionales((prev) => ({
                                        ...prev,
                                        [mod.key]: [],
                                      }))
                                    }
                                    className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-semibold text-rose-700 hover:bg-rose-50 cursor-pointer"
                                  >
                                    Ninguna
                                  </button>
                                </div>
                              </div>

                              {seccionales.length > 6 && (
                                <div className="relative">
                                  <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-2" />
                                  <input
                                    type="text"
                                    value={scopeSecSearch}
                                    onChange={(e) => setScopeSecSearch(e.target.value)}
                                    placeholder="Filtrar seccionales..."
                                    className="w-full pl-7 pr-2.5 py-1 text-[11px] bg-white border border-slate-200 rounded-lg outline-none focus:border-emerald-500"
                                  />
                                </div>
                              )}

                              <div className="max-h-36 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 pr-1">
                                {visibleSeccionalesForScope.map((sec) => {
                                  const checked = selectedSecIds.includes(sec.id);
                                  return (
                                    <label
                                      key={sec.id}
                                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-[11px] cursor-pointer transition-colors ${
                                        checked
                                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleModuleSeccional(mod.key, sec.id)}
                                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 shrink-0"
                                      />
                                      <span className="truncate">{sec.nombre}</span>
                                    </label>
                                  );
                                })}
                              </div>

                              {selectedSecIds.length === 0 && (
                                <p className="text-[10px] text-amber-700 font-medium">
                                  Si no marcas ninguna seccional, se usará la seccional asignada al usuario.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Opciones adicionales de módulo (Crear, Botón Historial, Botón Plantillas, Previsualización PDF) */}
                      {(mod.createKey || mod.historialKey || mod.plantillasKey || mod.pdfPreviewKey) && (
                        <div className="pt-2.5 border-t border-slate-100 space-y-2">
                          {mod.createKey && (
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] text-slate-600 font-medium">
                                  ¿Puede crear nuevas solicitudes?
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setMultipleKeys([mod.createKey!], !canCreate)}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
                                    canCreate
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-slate-50 text-slate-500 border-slate-200'
                                  }`}
                                >
                                  {canCreate ? 'Sí, puede crear' : 'No puede crear'}
                                </button>
                              </div>

                              {(mod.key === 'solicitudes_combustible' || mod.key === 'solicitudes_compra') && canCreate && (
                                <div className={`p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5 ${accessLevel === 'blocked' ? 'opacity-45 pointer-events-none' : ''}`}>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-bold text-slate-800">
                                      Nivel al hacer solicitudes:
                                    </span>
                                    <span className="text-[10px] font-semibold text-slate-500">
                                      {createScopes[mod.key] === 'global' ? 'Selector habilitado' : '1 seccional fija'}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 bg-white p-0.5 rounded-xl border border-slate-200/80 gap-0.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setCreateScopes((prev) => ({
                                          ...prev,
                                          [mod.key]: 'global',
                                        }))
                                      }
                                      className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                                        createScopes[mod.key] === 'global'
                                          ? 'bg-slate-900 text-white shadow-2xs'
                                          : 'text-slate-600 hover:bg-slate-100'
                                      }`}
                                    >
                                      <Globe className="w-3 h-3" />
                                      Nivel Global
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
                                            (moduleSeccionales[cKey]?.length ? moduleSeccionales[cKey][0] : null) ||
                                            seccionales[0]?.id ||
                                            null;
                                          return { ...prev, [cKey]: fallbackSec };
                                        });
                                      }}
                                      className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                                        createScopes[mod.key] === 'seccional'
                                          ? 'bg-slate-900 text-white shadow-2xs'
                                          : 'text-slate-600 hover:bg-slate-100'
                                      }`}
                                    >
                                      <Building2 className="w-3 h-3" />
                                      Nivel Seccional
                                    </button>
                                  </div>

                                  {createScopes[mod.key] === 'global' ? (
                                    <p className="text-[10px] text-emerald-700 font-medium leading-snug">
                                      El campo de Seccional estará habilitado en el formulario para que pueda seleccionar cualquier seccional.
                                    </p>
                                  ) : (
                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-bold text-slate-700 flex items-center gap-1">
                                        <Lock className="w-3 h-3 text-amber-600" />
                                        Seccional única asignada (solo 1 seleccionable):
                                      </label>
                                      <select
                                        value={createSeccionales[mod.key] ?? ''}
                                        onChange={(e) => {
                                          const cKey = mod.key as CreateSolicitudModuleKey;
                                          const val = e.target.value ? Number(e.target.value) : null;
                                          setCreateSeccionales((prev) => ({ ...prev, [cKey]: val }));
                                        }}
                                        className="w-full px-2.5 py-1.5 text-[11px] font-semibold text-slate-900 bg-white border border-slate-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 outline-none"
                                      >
                                        <option value="">-- Seleccione una seccional --</option>
                                        {seccionales.map((sec) => (
                                          <option key={sec.id} value={sec.id}>
                                            {sec.nombre}
                                          </option>
                                        ))}
                                      </select>
                                      <p className="text-[10px] text-slate-500 leading-snug">
                                        En el formulario esta seccional quedará seleccionada automáticamente y bloqueada sin posibilidad de cambio.
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {mod.historialKey && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] text-slate-600 font-medium">
                                Botón Ver &ldquo;Historial&rdquo;:
                              </span>
                              <button
                                type="button"
                                onClick={() => setMultipleKeys([mod.historialKey!], !canHistorial)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
                                  canHistorial
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              >
                                {canHistorial ? 'Activo (Visible)' : 'Inactivo (Oculto)'}
                              </button>
                            </div>
                          )}

                          {mod.plantillasKey && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] text-slate-600 font-medium">
                                Botón &ldquo;Plantillas y Configuraciones&rdquo;:
                              </span>
                              <button
                                type="button"
                                onClick={() => setMultipleKeys([mod.plantillasKey!], !canPlantillas)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
                                  canPlantillas
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              >
                                {canPlantillas ? 'Activo (Visible)' : 'Inactivo (Oculto)'}
                              </button>
                            </div>
                          )}

                          {mod.pdfPreviewKey && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] text-slate-600 font-medium">
                                Ver Previsualización / Impresión PDF:
                              </span>
                              <button
                                type="button"
                                onClick={() => setMultipleKeys([mod.pdfPreviewKey!], !canPreviewPdf)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
                                  canPreviewPdf
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              >
                                {canPreviewPdf ? 'Activo (Visible)' : 'Inactivo (Oculto)'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: SECCIONALES INDIVIDUALES Y EXPEDIENTE DIGITAL DE SOCORRISTAS */}
          {activeTab === 'seccionales' && (
            <div className="space-y-4">
              {/* Expediente y Documentación Digital del Socorrista */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-3 shadow-xs">
                <div>
                  <h3 className="text-xs font-bold text-slate-900">
                    Expediente y Documentación Digital del Socorrista
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Define de forma individual si el usuario puede subir documentos (CV, antecedentes, solvencia), previsualizarlos en línea o descargarlos.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {[
                    {
                      key: 'subir_expediente_socorrista',
                      title: 'Subir Expediente Digital',
                      desc: 'Cargar o actualizar nuevas versiones de documentos.',
                    },
                    {
                      key: 'ver_expediente_socorrista',
                      title: 'Previsualizar en Línea',
                      desc: 'Abrir documentos PDF o imágenes dentro del sistema.',
                    },
                    {
                      key: 'descargar_expediente_socorrista',
                      title: 'Descargar Documentos',
                      desc: 'Guardar archivos del expediente en su dispositivo.',
                    },
                  ].map((item) => {
                    const st = getPermissionStatus(item.key);
                    return (
                      <div
                        key={item.key}
                        className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between gap-2.5"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-xs font-semibold text-slate-900">{item.title}</span>
                            <span
                              className={`text-[10px] font-bold ${
                                st.effectiveValue ? 'text-emerald-700' : 'text-rose-600'
                              }`}
                            >
                              {st.effectiveValue ? 'Permitido' : 'Bloqueado'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{item.desc}</p>
                        </div>

                        <div className="grid grid-cols-3 bg-white p-0.5 rounded-lg border border-slate-200/80 gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleSetOverride(item.key, 'role')}
                            className={`py-1 rounded-md text-[10px] font-semibold cursor-pointer ${
                              !st.isOverridden ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
                            }`}
                          >
                            Heredar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetOverride(item.key, 'allow')}
                            className={`py-1 rounded-md text-[10px] font-semibold cursor-pointer ${
                              st.isOverridden && st.overrideValue === true
                                ? 'bg-emerald-600 text-white'
                                : 'text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            Permitir
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetOverride(item.key, 'deny')}
                            className={`py-1 rounded-md text-[10px] font-semibold cursor-pointer ${
                              st.isOverridden && st.overrideValue === false
                                ? 'bg-rose-600 text-white'
                                : 'text-rose-700 hover:bg-rose-50'
                            }`}
                          >
                            Denegar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-3 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">Modo de Acceso a Socorristas por Seccional</h3>
                    <p className="text-[11px] text-slate-500">
                      Define si el usuario hereda su rol base, accede a todas las seccionales, o tiene permisos individuales por cada seccional.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSecConfig((prev) => ({ ...prev, mode: 'default' }))}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      secConfig.mode === 'default'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <p className="text-xs font-bold">Heredar del Rol</p>
                    <p className={`text-[11px] mt-0.5 ${secConfig.mode === 'default' ? 'text-slate-300' : 'text-slate-500'}`}>
                      Solo su seccional asignada (o todas si tiene acceso nacional).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSecConfig((prev) => ({ ...prev, mode: 'all' }))}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      secConfig.mode === 'all'
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <p className="text-xs font-bold">Todas las Seccionales</p>
                    <p className={`text-[11px] mt-0.5 ${secConfig.mode === 'all' ? 'text-emerald-100' : 'text-slate-500'}`}>
                      Acceso a ver socorristas de todas las seccionales del país.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSecConfig((prev) => ({ ...prev, mode: 'custom' }))}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      secConfig.mode === 'custom'
                        ? 'bg-blue-700 text-white border-blue-700 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <p className="text-xs font-bold">Por Seccional Individual</p>
                    <p className={`text-[11px] mt-0.5 ${secConfig.mode === 'custom' ? 'text-blue-100' : 'text-slate-500'}`}>
                      Elige exactamente en qué seccionales puede Ver, Agregar o Editar.
                    </p>
                  </button>
                </div>
              </div>

              {/* Per-seccional Matrix */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Buscar seccional..."
                      value={secSearchTerm}
                      onChange={(e) => setSecSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-none"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleBulkSeccionales('view')}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-700 cursor-pointer"
                    >
                      Alternar Ver Todas
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkSeccionales('add')}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[11px] font-semibold text-blue-700 cursor-pointer"
                    >
                      Alternar Agregar Todas
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkSeccionales('edit')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[11px] font-semibold text-emerald-700 cursor-pointer"
                    >
                      Alternar Editar Todas
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkSeccionales('none')}
                      className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-[11px] font-semibold text-rose-700 cursor-pointer"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>

                {secConfig.mode !== 'custom' && (
                  <div className="px-4 py-2 bg-amber-50 border-b border-amber-200/70 text-[11px] text-amber-900 font-medium">
                    Nota: Al marcar cualquier casilla individual abajo, el modo cambiará automáticamente a{' '}
                    <strong>Por Seccional Individual</strong>.
                  </div>
                )}

                <div className="overflow-x-auto max-h-[340px] overflow-y-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-[11px] font-bold text-slate-500 uppercase">Seccional</th>
                        <th className="px-4 py-2.5 text-center text-[11px] font-bold text-slate-500 uppercase">Ver Socorristas</th>
                        <th className="px-4 py-2.5 text-center text-[11px] font-bold text-slate-500 uppercase">Agregar Nuevos</th>
                        <th className="px-4 py-2.5 text-center text-[11px] font-bold text-slate-500 uppercase">Modificar / Editar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSeccionales.map((sec) => {
                        const perm = secConfig.seccionales[sec.id] || { view: false, add: false, edit: false };
                        return (
                          <tr key={sec.id} className="hover:bg-slate-50/70">
                            <td className="px-4 py-2.5 text-xs font-semibold text-slate-800">{sec.nombre}</td>
                            <td className="px-4 py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => toggleSeccionalPerm(sec.id, 'view')}
                                className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
                                  perm.view
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                    : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                <Eye className="w-3 h-3" />
                                {perm.view ? 'Sí' : 'No'}
                              </button>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => toggleSeccionalPerm(sec.id, 'add')}
                                className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
                                  perm.add
                                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                                    : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                <Plus className="w-3 h-3" />
                                {perm.add ? 'Sí' : 'No'}
                              </button>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => toggleSeccionalPerm(sec.id, 'edit')}
                                className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
                                  perm.edit
                                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                                    : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                <Edit3 className="w-3 h-3" />
                                {perm.edit ? 'Sí' : 'No'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MODULOS GENERALES (SOLO VER vs EDITAR) */}
          {activeTab === 'modulos' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden">
              {SIMPLE_VIEW_EDIT_MODULES.map((mod) => {
                const level = getModuleAccessLevel(mod.viewKey, mod.editKeys);
                const isCustom =
                  customOverrides[mod.viewKey] !== undefined ||
                  mod.editKeys.some((ek) => customOverrides[ek] !== undefined);

                return (
                  <div
                    key={mod.viewKey}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{mod.label}</span>
                        {isCustom && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            Personalizado
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{mod.desc}</p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 bg-slate-100 p-0.5 rounded-xl border border-slate-200/60">
                      <button
                        type="button"
                        onClick={() => setMultipleKeys([mod.viewKey, ...mod.editKeys], 'role')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                          !isCustom ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Heredar
                      </button>
                      <button
                        type="button"
                        onClick={() => setModuleAccessLevel(mod.viewKey, mod.editKeys, 'blocked')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                          isCustom && level === 'blocked'
                            ? 'bg-rose-600 text-white shadow-2xs'
                            : 'text-rose-700 hover:bg-rose-50'
                        }`}
                      >
                        Bloqueado
                      </button>
                      <button
                        type="button"
                        onClick={() => setModuleAccessLevel(mod.viewKey, mod.editKeys, 'view')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                          isCustom && level === 'view'
                            ? 'bg-amber-500 text-white shadow-2xs'
                            : 'text-amber-700 hover:bg-amber-50'
                        }`}
                      >
                        Solo Ver
                      </button>
                      <button
                        type="button"
                        onClick={() => setModuleAccessLevel(mod.viewKey, mod.editKeys, 'edit')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                          isCustom && level === 'edit'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        Ver y Editar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 4: TODOS LOS PERMISOS (DETALLADO) */}
          {activeTab === 'todos' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar permiso..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-none"
                    />
                  </div>

                  <div className="bg-slate-100 p-0.5 rounded-lg flex items-center text-3xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setActiveFilter('todos')}
                      className={`px-2 py-1 rounded-md cursor-pointer ${activeFilter === 'todos' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'}`}
                    >
                      Todos ({summary.totalCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFilter('permitidos')}
                      className={`px-2 py-1 rounded-md cursor-pointer ${activeFilter === 'permitidos' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500'}`}
                    >
                      Permitidos ({summary.allowedCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFilter('denegados')}
                      className={`px-2 py-1 rounded-md cursor-pointer ${activeFilter === 'denegados' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-500'}`}
                    >
                      Bloqueados ({summary.deniedCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFilter('personalizados')}
                      className={`px-2 py-1 rounded-md cursor-pointer ${activeFilter === 'personalizados' ? 'bg-white text-amber-800 shadow-2xs' : 'text-slate-500'}`}
                    >
                      Excepciones ({summary.overrideCount})
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1 overflow-x-auto text-3xs font-semibold pb-0.5">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('todas')}
                    className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                      selectedCategory === 'todas' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Todas las Áreas
                  </button>
                  {Object.entries(PERMISSION_CATEGORIES).map(([catKey, cat]) => {
                    const IconComponent = cat.icon;
                    return (
                      <button
                        key={catKey}
                        type="button"
                        onClick={() => setSelectedCategory(catKey)}
                        className={`px-2.5 py-1 rounded-lg inline-flex items-center gap-1 cursor-pointer ${
                          selectedCategory === catKey ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <IconComponent className="w-3 h-3" />
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {filteredKeys.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <HelpCircle className="h-8 w-8 mx-auto text-slate-300 mb-1.5" />
                  <p className="font-semibold text-xs text-slate-700">Sin permisos encontrados</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden">
                  {filteredKeys.map((key) => {
                    const label = permissionLabels[key] || key;
                    const status = getPermissionStatus(key);

                    return (
                      <div
                        key={key}
                        className="p-3.5 transition-colors hover:bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className="font-semibold text-xs text-slate-900">{label}</span>
                            {status.effectiveValue ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-3xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                <CheckCircle2 className="w-2.5 h-2.5 mr-0.5 text-emerald-600" />
                                Permitido
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-3xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/60">
                                <XCircle className="w-2.5 h-2.5 mr-0.5 text-rose-600" />
                                Bloqueado
                              </span>
                            )}
                            {status.isOverridden && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-3xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/60">
                                <Sparkles className="w-2.5 h-2.5 mr-0.5 text-amber-600" />
                                Excepción
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-3xs text-slate-400 font-mono">
                            <span>{key}</span>
                            <span>&bull;</span>
                            <span>Base ({user.role}): {status.baseValue ? 'Habilitado' : 'Desactivado'}</span>
                          </div>
                        </div>

                        <div className="shrink-0 bg-slate-100 p-0.5 rounded-xl border border-slate-200/60 flex items-center">
                          <button
                            type="button"
                            onClick={() => handleSetOverride(key, 'role')}
                            className={`px-2.5 py-1 rounded-lg text-3xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                              !status.isOverridden ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            <RotateCcw className="w-2.5 h-2.5 text-slate-400" />
                            Heredar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetOverride(key, 'allow')}
                            className={`px-2.5 py-1 rounded-lg text-3xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                              status.isOverridden && status.overrideValue === true
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            <Check className="w-2.5 h-2.5" />
                            Permitir
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetOverride(key, 'deny')}
                            className={`px-2.5 py-1 rounded-lg text-3xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                              status.isOverridden && status.overrideValue === false
                                ? 'bg-rose-600 text-white shadow-2xs'
                                : 'text-rose-700 hover:bg-rose-50'
                            }`}
                          >
                            <X className="w-2.5 h-2.5" />
                            Denegar
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

        {/* FOOTER */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200/80 flex items-center justify-between shrink-0">
          <div className="text-3xs text-slate-500">
            {summary.overrideCount > 0 || secConfig.mode !== 'default' ? (
              <span className="font-medium text-amber-800">
                Configuración personalizada activa para este usuario
              </span>
            ) : (
              <span>Usa la configuración predeterminada de su rol</span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-semibold shadow-xs transition-all inline-flex items-center cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Guardando...' : 'Guardar Permisos'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
