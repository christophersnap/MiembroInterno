import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

export type ModuleScope = 'usuario' | 'seccional' | 'global';
export type ScopedModuleKey =
  | 'formularios'
  | 'solicitudes_combustible'
  | 'solicitudes_compra'
  | 'solicitudes_carnet';

export interface SeccionalSocorristasPerm {
  view: boolean;
  add: boolean;
  edit: boolean;
}

export interface SeccionalesSocorristasConfig {
  mode: 'default' | 'all' | 'custom';
  seccionales: Record<number, SeccionalSocorristasPerm>;
}

const DEFAULT_MODULE_SCOPES: Record<ScopedModuleKey, ModuleScope> = {
  formularios: 'usuario',
  solicitudes_combustible: 'usuario',
  solicitudes_compra: 'usuario',
  solicitudes_carnet: 'seccional',
};

const DEFAULT_MODULE_SECCIONALES: Record<ScopedModuleKey, number[]> = {
  formularios: [],
  solicitudes_combustible: [],
  solicitudes_compra: [],
  solicitudes_carnet: [],
};

const DEFAULT_SECCIONALES_ACCESS: SeccionalesSocorristasConfig = {
  mode: 'default',
  seccionales: {},
};

interface AuthContextType {
  user: User | null;
  userName: string | null;
  role: string | null;
  socorristaId: number | null;
  permissions: Record<string, boolean>;
  customPermissions: Record<string, any>;
  moduleScopes: Record<ScopedModuleKey, ModuleScope>;
  moduleSeccionales: Record<ScopedModuleKey, number[]>;
  seccionalesSocorristasAccess: SeccionalesSocorristasConfig;
  canAddAnySocorrista: boolean;
  getModuleScope: (mod: ScopedModuleKey) => ModuleScope;
  getModuleSeccionalIds: (mod: ScopedModuleKey) => number[];
  canAccessSeccionalSocorristas: (seccionalId: number | null | undefined, action: 'view' | 'add' | 'edit') => boolean;
  getAllowedSocorristaSeccionalIds: () => number[] | 'all';
  getAddAllowedSocorristaSeccionalIds: () => number[] | 'all';
  watermarkEnabled: boolean;
  requiresPasswordReset: boolean;
  directorSeccionalId: number | null;
  userSeccionalId: number | null;
  userSeccionalNombre: string | null;
  allowSeccionalEditVehiculos: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUserPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userName: null,
  role: null,
  socorristaId: null,
  permissions: {},
  customPermissions: {},
  moduleScopes: DEFAULT_MODULE_SCOPES,
  moduleSeccionales: DEFAULT_MODULE_SECCIONALES,
  seccionalesSocorristasAccess: DEFAULT_SECCIONALES_ACCESS,
  canAddAnySocorrista: false,
  getModuleScope: () => 'usuario',
  getModuleSeccionalIds: () => [],
  canAccessSeccionalSocorristas: () => false,
  getAllowedSocorristaSeccionalIds: () => [],
  getAddAllowedSocorristaSeccionalIds: () => [],
  watermarkEnabled: true,
  requiresPasswordReset: false,
  directorSeccionalId: null,
  userSeccionalId: null,
  userSeccionalNombre: null,
  allowSeccionalEditVehiculos: false,
  loading: true,
  signOut: async () => {},
  refreshUserPermissions: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [socorristaId, setSocorristaId] = useState<number | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [customPermissions, setCustomPermissions] = useState<Record<string, any>>({});
  const [moduleScopes, setModuleScopes] = useState<Record<ScopedModuleKey, ModuleScope>>(DEFAULT_MODULE_SCOPES);
  const [moduleSeccionales, setModuleSeccionales] = useState<Record<ScopedModuleKey, number[]>>(DEFAULT_MODULE_SECCIONALES);
  const [seccionalesSocorristasAccess, setSeccionalesSocorristasAccess] = useState<SeccionalesSocorristasConfig>(DEFAULT_SECCIONALES_ACCESS);
  const [watermarkEnabled, setWatermarkEnabled] = useState<boolean>(true);
  const [requiresPasswordReset, setRequiresPasswordReset] = useState<boolean>(false);
  const [directorSeccionalId, setDirectorSeccionalId] = useState<number | null>(null);
  const [userSeccionalId, setUserSeccionalId] = useState<number | null>(null);
  const [userSeccionalNombre, setUserSeccionalNombre] = useState<string | null>(null);
  const [allowSeccionalEditVehiculos, setAllowSeccionalEditVehiculos] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 4500);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRoleAndPermissions(session.user.id);
      } else {
        clearTimeout(safetyTimer);
        setLoading(false);
      }
    }).catch(err => {
      console.error('Error getting session:', err);
      clearTimeout(safetyTimer);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRoleAndPermissions(session.user.id);
      } else {
        setUserName(null);
        setRole(null);
        setSocorristaId(null);
        setPermissions({});
        setCustomPermissions({});
        setModuleScopes(DEFAULT_MODULE_SCOPES);
        setModuleSeccionales(DEFAULT_MODULE_SECCIONALES);
        setSeccionalesSocorristasAccess(DEFAULT_SECCIONALES_ACCESS);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserRoleAndPermissions = async (userId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const isSuperAdmin = user?.email === 'christopher.snap@gmail.com';

      let roleData: any = null;
      let roleError: any = null;

      const resWithCustom = await supabase
        .from('user_roles')
        .select(`
          role, 
          socorrista_id,
          can_upload_files,
          custom_permissions,
          requires_password_reset,
          socorristas (primer_nombre, primer_apellido, seccional_id)
        `)
        .eq('id', userId)
        .single();

      if (resWithCustom.error) {
        const resFallback = await supabase
          .from('user_roles')
          .select(`
            role, 
            socorrista_id,
            can_upload_files,
            requires_password_reset,
            socorristas (primer_nombre, primer_apellido, seccional_id)
          `)
          .eq('id', userId)
          .single();
        roleData = resFallback.data;
        roleError = resFallback.error;
      } else {
        roleData = resWithCustom.data;
        roleError = resWithCustom.error;
      }

      let currentRole = 'socorrista';

      if (isSuperAdmin) {
        currentRole = 'admin';
        if (roleError || roleData?.role !== 'admin') {
          await supabase.from('user_roles').upsert({ id: userId, role: 'admin' });
        }
      } else if (!roleError && roleData) {
        currentRole = roleData.role;

        const isPending = (roleData as any).role === 'pendiente' || (roleData as any).estado === 'pendiente';
        const isInactive = (roleData as any).role === 'inactivo' || (roleData as any).activo === false || (roleData as any).estado === 'inactivo';

        if (isPending || isInactive) {
          await supabase.auth.signOut();
          setUser(null);
          setRole(null);
          setSocorristaId(null);
          setPermissions({});
          setLoading(false);
          if (isPending) {
            sessionStorage.setItem('auth_error_message', 'Su usuario está pendiente de que sea aceptado en el sistema, mientras tanto no podrá ingresar.');
          } else {
            sessionStorage.setItem('auth_error_message', 'Su cuenta está inactiva o deshabilitada. Comuníquese con el administrador del sistema.');
          }
          return;
        }
      }

      setRole(currentRole);

      let detectedSeccionalId: number | null = null;
      let detectedSeccionalNombre: string | null = null;

      if (!roleError && roleData) {
        setSocorristaId(roleData.socorrista_id);
        setRequiresPasswordReset(!!roleData.requires_password_reset);

        if (roleData.socorristas) {
          const socorrista = roleData.socorristas as any;
          setUserName(`${socorrista.primer_nombre} ${socorrista.primer_apellido}`);
          if (socorrista.seccional_id) {
            detectedSeccionalId = socorrista.seccional_id;
          }
        } else {
          setUserName(user?.email || 'Usuario');
        }
      } else {
        setSocorristaId(null);
        setUserName(user?.email || 'Usuario');
      }

      const { data: permData, error: permError } = await supabase
        .from('role_permissions')
        .select('permissions')
        .eq('role', currentRole)
        .single();

      if (currentRole === 'director') {
        const { data: secData } = await supabase
          .from('seccionales')
          .select('id, nombre')
          .eq('director_id', userId)
          .single();
        if (secData) {
          setDirectorSeccionalId(secData.id);
          detectedSeccionalId = secData.id;
          detectedSeccionalNombre = secData.nombre;
        } else {
          setDirectorSeccionalId(null);
        }
      } else {
        setDirectorSeccionalId(null);
      }

      if (!detectedSeccionalId && user?.email) {
        const emailLower = user.email.toLowerCase();
        const { data: allSecs } = await supabase.from('seccionales').select('id, nombre');
        if (allSecs) {
          for (const s of allSecs) {
            const cleanSec = s.nombre.toLowerCase().replace(/\s+/g, '');
            if (emailLower.includes(cleanSec)) {
              detectedSeccionalId = s.id;
              detectedSeccionalNombre = s.nombre;
              break;
            }
          }
        }
      }

      if (detectedSeccionalId && !detectedSeccionalNombre) {
        const { data: secNameData } = await supabase
          .from('seccionales')
          .select('nombre')
          .eq('id', detectedSeccionalId)
          .single();
        if (secNameData) {
          detectedSeccionalNombre = secNameData.nombre;
        }
      }

      setUserSeccionalId(detectedSeccionalId);
      setUserSeccionalNombre(detectedSeccionalNombre);

      let allowSecEditVeh = false;
      const { data: configData, error: configError } = await supabase
        .from('configuracion')
        .select('*');

      if (!configError && configData) {
        configData.forEach(row => {
          if (row.clave === 'watermark_enabled') {
            setWatermarkEnabled(row.valor === 'true');
          }
          if (row.clave === 'allow_seccional_edit_vehiculos') {
            allowSecEditVeh = (row.valor === 'true');
          }
        });
      }
      setAllowSeccionalEditVehiculos(allowSecEditVeh);

      const canEditVehiculosDefault = currentRole === 'admin' || allowSecEditVeh;
      const canUploadFiles = currentRole === 'admin' || !!(roleData as any)?.can_upload_files || !!permData?.permissions?.subir_archivos || !!permData?.permissions?.edit_archivos;
      const canViewAnuncios = currentRole === 'admin' || (permData?.permissions?.view_anuncios ?? true);
      const canCreateAnuncios = currentRole === 'admin' || !!permData?.permissions?.crear_anuncios || !!permData?.permissions?.edit_anuncios;
      const canViewFormularios = currentRole === 'admin' || (permData?.permissions?.view_formularios ?? true);
      const canCreateFormularios = currentRole === 'admin' || !!permData?.permissions?.crear_formularios || !!permData?.permissions?.edit_formularios;
      const canViewAllFormularios = currentRole === 'admin' || !!(roleData as any)?.can_view_all_formularios || !!permData?.permissions?.ver_todos_formularios;
      const canPersonalizarColores = currentRole === 'admin' || !!permData?.permissions?.personalizar_colores;

      let resolvedPerms: Record<string, boolean> = {};

      if (!permError && permData && permData.permissions) {
        resolvedPerms = {
          ...permData.permissions,
          ver_todas_seccionales: permData.permissions.ver_todas_seccionales ?? (currentRole === 'admin'),
          view_directorio: permData.permissions.view_directorio ?? true,
          edit_directorio: permData.permissions.edit_directorio ?? (currentRole === 'admin'),
          edit_seccionales: permData.permissions.edit_seccionales ?? (currentRole === 'admin'),
          add_socorristas: permData.permissions.add_socorristas ?? permData.permissions.edit_socorristas ?? (currentRole === 'admin'),
          ver_imagenes_socorristas: permData.permissions.ver_imagenes_socorristas ?? (currentRole === 'admin'),
          descargar_carnet: permData.permissions.descargar_carnet ?? (currentRole === 'admin'),
          cambiar_estado_socorrista: permData.permissions.cambiar_estado_socorrista ?? (currentRole === 'admin'),
          descargar_excel_socorristas: permData.permissions.descargar_excel_socorristas ?? (currentRole === 'admin'),
          view_solicitar_carnet: permData.permissions.view_solicitar_carnet ?? true,
          view_verificar_carnet: permData.permissions.view_verificar_carnet ?? true,
          view_vehiculos: permData.permissions.view_vehiculos ?? true,
          edit_vehiculos: permData.permissions.edit_vehiculos ?? canEditVehiculosDefault,
          view_solicitudes_compra: permData.permissions.view_solicitudes_compra ?? true,
          crear_solicitudes_compra: permData.permissions.crear_solicitudes_compra ?? true,
          aprobar_solicitudes_compra: permData.permissions.aprobar_solicitudes_compra ?? (currentRole === 'admin'),
          edit_solicitudes_compra: permData.permissions.edit_solicitudes_compra ?? permData.permissions.aprobar_solicitudes_compra ?? (currentRole === 'admin'),
          view_compra_historial: permData.permissions.view_compra_historial ?? true,
          view_compra_plantillas: permData.permissions.view_compra_plantillas ?? (currentRole === 'admin' || Boolean(permData.permissions.ver_todas_seccionales)),
          view_solicitudes_combustible: permData.permissions.view_solicitudes_combustible ?? true,
          crear_solicitudes_combustible: permData.permissions.crear_solicitudes_combustible ?? true,
          aprobar_solicitudes_combustible: permData.permissions.aprobar_solicitudes_combustible ?? (currentRole === 'admin'),
          edit_solicitudes_combustible: permData.permissions.edit_solicitudes_combustible ?? permData.permissions.aprobar_solicitudes_combustible ?? (currentRole === 'admin'),
          view_combustible_historial: permData.permissions.view_combustible_historial ?? true,
          view_combustible_plantillas: permData.permissions.view_combustible_plantillas ?? (currentRole === 'admin' || Boolean(permData.permissions.ver_todas_seccionales)),
          view_solicitudes_carnet: permData.permissions.view_solicitudes_carnet ?? (currentRole === 'admin'),
          edit_solicitudes_carnet: permData.permissions.edit_solicitudes_carnet ?? (currentRole === 'admin'),
          view_archivos: permData.permissions.view_archivos ?? true,
          subir_archivos: canUploadFiles,
          edit_archivos: permData.permissions.edit_archivos ?? canUploadFiles,
          view_anuncios: canViewAnuncios,
          crear_anuncios: canCreateAnuncios,
          edit_anuncios: permData.permissions.edit_anuncios ?? canCreateAnuncios,
          view_formularios: canViewFormularios,
          crear_formularios: canCreateFormularios,
          edit_formularios: permData.permissions.edit_formularios ?? canCreateFormularios,
          ver_todos_formularios: canViewAllFormularios,
          view_meritos: permData.permissions.view_meritos ?? true,
          edit_meritos: permData.permissions.edit_meritos ?? (currentRole === 'admin' || currentRole === 'director'),
          personalizar_colores: canPersonalizarColores
        };
      } else {
        if (currentRole === 'admin') {
          resolvedPerms = {
            ver_todas_seccionales: true,
            view_dashboard: true, view_socorristas: true, add_socorristas: true, edit_socorristas: true,
            view_carnet: true, view_cursos: true, view_seccionales: true, edit_seccionales: true,
            view_config: true, view_activity: true, view_accesos: true,
            view_directorio: true, edit_directorio: true, ver_imagenes_socorristas: true, descargar_carnet: true, cambiar_estado_socorrista: true, descargar_excel_socorristas: true,
            view_solicitar_carnet: true, view_verificar_carnet: true,
            view_vehiculos: true, edit_vehiculos: true,
            view_solicitudes_compra: true, crear_solicitudes_compra: true, aprobar_solicitudes_compra: true, edit_solicitudes_compra: true,
            view_compra_historial: true, view_compra_plantillas: true,
            view_solicitudes_combustible: true, crear_solicitudes_combustible: true, aprobar_solicitudes_combustible: true, edit_solicitudes_combustible: true,
            view_combustible_historial: true, view_combustible_plantillas: true,
            view_solicitudes_carnet: true, edit_solicitudes_carnet: true,
            view_archivos: true, subir_archivos: true, edit_archivos: true,
            view_anuncios: true, crear_anuncios: true, edit_anuncios: true,
            view_formularios: true, crear_formularios: true, edit_formularios: true, ver_todos_formularios: true,
            view_meritos: true, edit_meritos: true,
            personalizar_colores: true
          };
        } else if (currentRole === 'instructor') {
          resolvedPerms = {
            ver_todas_seccionales: false,
            view_dashboard: true, view_socorristas: false, add_socorristas: false, edit_socorristas: false,
            view_carnet: false, view_cursos: true, view_seccionales: false, edit_seccionales: false,
            view_config: false, view_activity: false, view_accesos: false,
            view_directorio: true, edit_directorio: false, ver_imagenes_socorristas: false, descargar_carnet: false, cambiar_estado_socorrista: false, descargar_excel_socorristas: false,
            view_solicitar_carnet: true, view_verificar_carnet: true,
            view_vehiculos: true, edit_vehiculos: canEditVehiculosDefault,
            view_solicitudes_compra: true, crear_solicitudes_compra: true, aprobar_solicitudes_compra: false, edit_solicitudes_compra: false,
            view_compra_historial: true, view_compra_plantillas: false,
            view_solicitudes_combustible: true, crear_solicitudes_combustible: true, aprobar_solicitudes_combustible: false, edit_solicitudes_combustible: false,
            view_combustible_historial: true, view_combustible_plantillas: false,
            view_solicitudes_carnet: false, edit_solicitudes_carnet: false,
            view_archivos: true, subir_archivos: canUploadFiles, edit_archivos: canUploadFiles,
            view_anuncios: true, crear_anuncios: false, edit_anuncios: false,
            view_formularios: true, crear_formularios: false, edit_formularios: false,
            view_meritos: true, edit_meritos: false,
            personalizar_colores: false
          };
        } else if (currentRole === 'director') {
          resolvedPerms = {
            ver_todas_seccionales: false,
            view_dashboard: true, view_socorristas: true, add_socorristas: false, edit_socorristas: true,
            view_carnet: false, view_cursos: false, view_seccionales: false, edit_seccionales: false,
            view_config: false, view_activity: false, view_accesos: false,
            view_directorio: true, edit_directorio: false, ver_imagenes_socorristas: true, descargar_carnet: false, cambiar_estado_socorrista: false, descargar_excel_socorristas: false,
            view_solicitar_carnet: true, view_verificar_carnet: true,
            view_vehiculos: true, edit_vehiculos: canEditVehiculosDefault,
            view_solicitudes_compra: true, crear_solicitudes_compra: true, aprobar_solicitudes_compra: false, edit_solicitudes_compra: false,
            view_compra_historial: true, view_compra_plantillas: false,
            view_solicitudes_combustible: true, crear_solicitudes_combustible: true, aprobar_solicitudes_combustible: false, edit_solicitudes_combustible: false,
            view_combustible_historial: true, view_combustible_plantillas: false,
            view_solicitudes_carnet: false, edit_solicitudes_carnet: false,
            view_archivos: true, subir_archivos: canUploadFiles, edit_archivos: canUploadFiles,
            view_anuncios: true, crear_anuncios: false, edit_anuncios: false,
            view_formularios: true, crear_formularios: false, edit_formularios: false,
            view_meritos: true, edit_meritos: true,
            personalizar_colores: false
          };
        } else {
          resolvedPerms = {
            ver_todas_seccionales: false,
            view_dashboard: true, view_socorristas: false, add_socorristas: false, edit_socorristas: false,
            view_carnet: false, view_cursos: false, view_seccionales: false, edit_seccionales: false,
            view_config: false, view_activity: false, view_accesos: false,
            view_directorio: true, edit_directorio: false, ver_imagenes_socorristas: false, descargar_carnet: false, cambiar_estado_socorrista: false, descargar_excel_socorristas: false,
            view_vehiculos: true, edit_vehiculos: canEditVehiculosDefault,
            view_solicitudes_compra: true, crear_solicitudes_compra: true, aprobar_solicitudes_compra: false, edit_solicitudes_compra: false,
            view_compra_historial: true, view_compra_plantillas: false,
            view_solicitudes_combustible: true, crear_solicitudes_combustible: true, aprobar_solicitudes_combustible: false, edit_solicitudes_combustible: false,
            view_combustible_historial: true, view_combustible_plantillas: false,
            view_solicitudes_carnet: false, edit_solicitudes_carnet: false,
            view_archivos: true, subir_archivos: canUploadFiles, edit_archivos: canUploadFiles,
            view_anuncios: true, crear_anuncios: false, edit_anuncios: false,
            view_formularios: true, crear_formularios: false, edit_formularios: false,
            view_meritos: true, edit_meritos: false,
            personalizar_colores: false
          };
        }
      }

      // Merge individual custom overrides (only boolean keys into permissions map)
      const userCustomPerms: Record<string, any> = (roleData as any)?.custom_permissions || {};
      const finalMergedPerms: Record<string, boolean> = { ...resolvedPerms };

      Object.keys(userCustomPerms).forEach(key => {
        if (typeof userCustomPerms[key] === 'boolean') {
          finalMergedPerms[key] = userCustomPerms[key];
        }
      });

      // Keep paired edit/action keys synchronized when either is explicitly overridden
      if (typeof userCustomPerms.edit_anuncios === 'boolean' && typeof userCustomPerms.crear_anuncios !== 'boolean') {
        finalMergedPerms.crear_anuncios = userCustomPerms.edit_anuncios;
      } else if (typeof userCustomPerms.crear_anuncios === 'boolean' && typeof userCustomPerms.edit_anuncios !== 'boolean') {
        finalMergedPerms.edit_anuncios = userCustomPerms.crear_anuncios;
      }

      if (typeof userCustomPerms.edit_archivos === 'boolean' && typeof userCustomPerms.subir_archivos !== 'boolean') {
        finalMergedPerms.subir_archivos = userCustomPerms.edit_archivos;
      } else if (typeof userCustomPerms.subir_archivos === 'boolean' && typeof userCustomPerms.edit_archivos !== 'boolean') {
        finalMergedPerms.edit_archivos = userCustomPerms.subir_archivos;
      }

      if (typeof userCustomPerms.edit_formularios === 'boolean' && typeof userCustomPerms.crear_formularios !== 'boolean') {
        finalMergedPerms.crear_formularios = userCustomPerms.edit_formularios;
      } else if (typeof userCustomPerms.crear_formularios === 'boolean' && typeof userCustomPerms.edit_formularios !== 'boolean') {
        finalMergedPerms.edit_formularios = userCustomPerms.crear_formularios;
      }

      if (typeof userCustomPerms.edit_solicitudes_compra === 'boolean' && typeof userCustomPerms.aprobar_solicitudes_compra !== 'boolean') {
        finalMergedPerms.aprobar_solicitudes_compra = userCustomPerms.edit_solicitudes_compra;
      }
      if (typeof userCustomPerms.edit_solicitudes_combustible === 'boolean' && typeof userCustomPerms.aprobar_solicitudes_combustible !== 'boolean') {
        finalMergedPerms.aprobar_solicitudes_combustible = userCustomPerms.edit_solicitudes_combustible;
      }

      // Special check for can_upload_files column only when no explicit override denies it
      if ((roleData as any)?.can_upload_files && userCustomPerms.subir_archivos === undefined && userCustomPerms.edit_archivos === undefined) {
        finalMergedPerms.subir_archivos = true;
        finalMergedPerms.edit_archivos = true;
      }

      // Resolve per-seccional socorristas access
      const rawSecAccess = userCustomPerms._seccionales_socorristas;
      const parsedSecAccess: SeccionalesSocorristasConfig = {
        mode: rawSecAccess?.mode === 'all' || rawSecAccess?.mode === 'custom' ? rawSecAccess.mode : 'default',
        seccionales: rawSecAccess?.seccionales && typeof rawSecAccess.seccionales === 'object' ? rawSecAccess.seccionales : {},
      };

      if (parsedSecAccess.mode === 'all') {
        finalMergedPerms.view_socorristas = true;
        finalMergedPerms.ver_todas_seccionales = true;
      } else if (parsedSecAccess.mode === 'custom') {
        const entries = Object.values(parsedSecAccess.seccionales);
        const hasAnyAccess = entries.some(e => e?.view || e?.add || e?.edit);
        if (hasAnyAccess) {
          finalMergedPerms.view_socorristas = true;
        }
        if (entries.some(e => e?.add)) {
          finalMergedPerms.add_socorristas = true;
        }
        if (entries.some(e => e?.edit)) {
          finalMergedPerms.edit_socorristas = true;
        }
      }

      // Resolve module scopes
      const rawScopes = userCustomPerms._module_scopes || {};
      const isAdmin = currentRole === 'admin';
      const resolvedScopes: Record<ScopedModuleKey, ModuleScope> = {
        formularios: isAdmin
          ? 'global'
          : (rawScopes.formularios || (finalMergedPerms.ver_todos_formularios ? 'global' : 'usuario')),
        solicitudes_combustible: isAdmin
          ? 'global'
          : (rawScopes.solicitudes_combustible || (finalMergedPerms.ver_todas_seccionales ? 'global' : 'usuario')),
        solicitudes_compra: isAdmin
          ? 'global'
          : (rawScopes.solicitudes_compra || (finalMergedPerms.ver_todas_seccionales ? 'global' : 'usuario')),
        solicitudes_carnet: isAdmin
          ? 'global'
          : (rawScopes.solicitudes_carnet || (finalMergedPerms.ver_todas_seccionales ? 'global' : 'seccional')),
      };

      if (resolvedScopes.formularios === 'global') {
        finalMergedPerms.ver_todos_formularios = true;
      }

      // Resolve per-module selected seccionales
      const rawModSeccs = userCustomPerms._module_seccionales || {};
      const defaultSecArr = detectedSeccionalId ? [Number(detectedSeccionalId)] : [];
      const parseModSecArr = (val: any): number[] => {
        if (Array.isArray(val) && val.length > 0) {
          return Array.from(new Set(val.map(Number).filter((n) => !isNaN(n) && n > 0)));
        }
        return defaultSecArr;
      };
      const resolvedModSeccs: Record<ScopedModuleKey, number[]> = {
        formularios: parseModSecArr(rawModSeccs.formularios),
        solicitudes_combustible: parseModSecArr(rawModSeccs.solicitudes_combustible),
        solicitudes_compra: parseModSecArr(rawModSeccs.solicitudes_compra),
        solicitudes_carnet: parseModSecArr(rawModSeccs.solicitudes_carnet),
      };

      setPermissions(finalMergedPerms);
      setCustomPermissions(userCustomPerms);
      setSeccionalesSocorristasAccess(parsedSecAccess);
      setModuleScopes(resolvedScopes);
      setModuleSeccionales(resolvedModSeccs);

    } catch (error) {
      console.error('Error in fetchUserRoleAndPermissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getModuleScope = (mod: ScopedModuleKey): ModuleScope => {
    if (role === 'admin') return 'global';
    return moduleScopes[mod] || 'usuario';
  };

  const getModuleSeccionalIds = (mod: ScopedModuleKey): number[] => {
    return moduleSeccionales[mod] || [];
  };

  const canAccessSeccionalSocorristas = (
    seccionalId: number | null | undefined,
    action: 'view' | 'add' | 'edit'
  ): boolean => {
    if (role === 'admin') return true;

    const { mode, seccionales } = seccionalesSocorristasAccess;
    if (mode === 'all') {
      if (action === 'view') return true;
      if (action === 'add') return Boolean(permissions.add_socorristas || permissions.edit_socorristas);
      return Boolean(permissions.edit_socorristas);
    }

    if (mode === 'custom') {
      if (!seccionalId) {
        // Check if user has this action on any seccional
        return Object.values(seccionales).some(p => Boolean(p?.[action] || (action === 'view' && (p?.add || p?.edit))));
      }
      const p = seccionales[Number(seccionalId)];
      if (!p) return false;
      if (action === 'view') return Boolean(p.view || p.add || p.edit);
      if (action === 'add') return Boolean(p.add);
      return Boolean(p.edit);
    }

    // mode === 'default'
    const hasActionPerm =
      action === 'view'
        ? Boolean(permissions.view_socorristas)
        : action === 'add'
        ? Boolean(permissions.add_socorristas || permissions.edit_socorristas)
        : Boolean(permissions.edit_socorristas);

    if (!hasActionPerm) return false;
    if (permissions.ver_todas_seccionales) return true;
    const ownSec = directorSeccionalId || userSeccionalId;
    if (!seccionalId || !ownSec) return true;
    return Number(seccionalId) === Number(ownSec);
  };

  const getAllowedSocorristaSeccionalIds = (): number[] | 'all' => {
    if (role === 'admin') return 'all';
    if (seccionalesSocorristasAccess.mode === 'all') return 'all';
    if (seccionalesSocorristasAccess.mode === 'custom') {
      return Object.entries(seccionalesSocorristasAccess.seccionales)
        .filter(([, p]) => Boolean(p?.view || p?.add || p?.edit))
        .map(([id]) => Number(id));
    }
    if (permissions.ver_todas_seccionales) return 'all';
    const ownSec = directorSeccionalId || userSeccionalId;
    return ownSec ? [Number(ownSec)] : [];
  };

  const getAddAllowedSocorristaSeccionalIds = (): number[] | 'all' => {
    if (role === 'admin') return 'all';
    if (seccionalesSocorristasAccess.mode === 'all') {
      return permissions.add_socorristas || permissions.edit_socorristas ? 'all' : [];
    }
    if (seccionalesSocorristasAccess.mode === 'custom') {
      return Object.entries(seccionalesSocorristasAccess.seccionales)
        .filter(([, p]) => Boolean(p?.add))
        .map(([id]) => Number(id));
    }
    if (!permissions.add_socorristas && !permissions.edit_socorristas) return [];
    if (permissions.ver_todas_seccionales) return 'all';
    const ownSec = directorSeccionalId || userSeccionalId;
    return ownSec ? [Number(ownSec)] : [];
  };

  const canAddAnySocorrista = (() => {
    if (role === 'admin') return true;
    const allowed = getAddAllowedSocorristaSeccionalIds();
    return allowed === 'all' || allowed.length > 0;
  })();

  const refreshUserPermissions = async () => {
    if (user?.id) {
      await fetchUserRoleAndPermissions(user.id);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      userName, 
      role, 
      socorristaId, 
      permissions, 
      customPermissions,
      moduleScopes,
      moduleSeccionales,
      seccionalesSocorristasAccess,
      canAddAnySocorrista,
      getModuleScope,
      getModuleSeccionalIds,
      canAccessSeccionalSocorristas,
      getAllowedSocorristaSeccionalIds,
      getAddAllowedSocorristaSeccionalIds,
      watermarkEnabled, 
      requiresPasswordReset, 
      directorSeccionalId, 
      userSeccionalId, 
      userSeccionalNombre, 
      allowSeccionalEditVehiculos, 
      loading, 
      signOut,
      refreshUserPermissions
    }}>
      {children}
    </AuthContext.Provider>
  );
};
