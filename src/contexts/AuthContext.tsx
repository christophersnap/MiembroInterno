import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  userName: string | null;
  role: string | null;
  socorristaId: number | null;
  permissions: Record<string, boolean>;
  customPermissions: Record<string, boolean>;
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
  const [customPermissions, setCustomPermissions] = useState<Record<string, boolean>>({});
  const [watermarkEnabled, setWatermarkEnabled] = useState<boolean>(true);
  const [requiresPasswordReset, setRequiresPasswordReset] = useState<boolean>(false);
  const [directorSeccionalId, setDirectorSeccionalId] = useState<number | null>(null);
  const [userSeccionalId, setUserSeccionalId] = useState<number | null>(null);
  const [userSeccionalNombre, setUserSeccionalNombre] = useState<string | null>(null);
  const [allowSeccionalEditVehiculos, setAllowSeccionalEditVehiculos] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Temporizador de seguridad: si la conexión a Supabase se retrasa o cuelga, desbloquear la interfaz
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 4500);

    // Check active sessions and sets the user
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

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRoleAndPermissions(session.user.id);
      } else {
        setUserName(null);
        setRole(null);
        setSocorristaId(null);
        setPermissions({});
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

      // Fetch role and socorrista details
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
        // Fallback without custom_permissions column if migration not applied yet
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
        // Auto-fix DB if super admin doesn't have admin role
        if (roleError || roleData?.role !== 'admin') {
          await supabase.from('user_roles').upsert({ id: userId, role: 'admin' });
        }
      } else if (!roleError && roleData) {
        currentRole = roleData.role;

        // Verificar si el usuario está pendiente de aprobación o inactivo
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
          // Fallback to email if no socorrista profile is linked
          setUserName(user?.email || 'Usuario');
        }
      } else {
        setSocorristaId(null);
        setUserName(user?.email || 'Usuario');
      }

      // Fetch permissions for the role
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

      // If user is from a seccional email (e.g. santaana@cruzverde.org.sv), match seccional
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

      // Fetch config keys for allow_seccional_edit_vehiculos and watermark
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

      const canEditVehiculos = currentRole === 'admin' || allowSecEditVeh;

      const canUploadFiles = currentRole === 'admin' || !!(roleData as any)?.can_upload_files || !!permData?.permissions?.subir_archivos;
      const canViewAnuncios = currentRole === 'admin' || (permData?.permissions?.view_anuncios ?? true);
      const canCreateAnuncios = currentRole === 'admin' || !!permData?.permissions?.crear_anuncios;
      const canViewFormularios = currentRole === 'admin' || (permData?.permissions?.view_formularios ?? true);
      const canCreateFormularios = currentRole === 'admin' || !!permData?.permissions?.crear_formularios;
      const canPersonalizarColores = currentRole === 'admin' || !!permData?.permissions?.personalizar_colores;

      let resolvedPerms: Record<string, boolean> = {};

      if (!permError && permData && permData.permissions) {
        resolvedPerms = {
          ...permData.permissions,
          ver_todas_seccionales: permData.permissions.ver_todas_seccionales ?? (currentRole === 'admin'),
          view_directorio: permData.permissions.view_directorio ?? true,
          edit_directorio: permData.permissions.edit_directorio ?? (currentRole === 'admin'),
          edit_seccionales: permData.permissions.edit_seccionales ?? (currentRole === 'admin'),
          ver_imagenes_socorristas: permData.permissions.ver_imagenes_socorristas ?? (currentRole === 'admin'),
          descargar_carnet: permData.permissions.descargar_carnet ?? (currentRole === 'admin'),
          cambiar_estado_socorrista: permData.permissions.cambiar_estado_socorrista ?? (currentRole === 'admin'),
          descargar_excel_socorristas: permData.permissions.descargar_excel_socorristas ?? (currentRole === 'admin'),
          view_solicitar_carnet: permData.permissions.view_solicitar_carnet ?? true,
          view_verificar_carnet: permData.permissions.view_verificar_carnet ?? true,
          view_vehiculos: permData.permissions.view_vehiculos ?? true,
          edit_vehiculos: canEditVehiculos,
          view_solicitudes_compra: permData.permissions.view_solicitudes_compra ?? true,
          crear_solicitudes_compra: permData.permissions.crear_solicitudes_compra ?? true,
          aprobar_solicitudes_compra: permData.permissions.aprobar_solicitudes_compra ?? (currentRole === 'admin'),
          view_solicitudes_combustible: permData.permissions.view_solicitudes_combustible ?? true,
          crear_solicitudes_combustible: permData.permissions.crear_solicitudes_combustible ?? true,
          aprobar_solicitudes_combustible: permData.permissions.aprobar_solicitudes_combustible ?? (currentRole === 'admin'),
          view_archivos: permData.permissions.view_archivos ?? true,
          subir_archivos: canUploadFiles,
          view_anuncios: canViewAnuncios,
          crear_anuncios: canCreateAnuncios,
          view_formularios: canViewFormularios,
          crear_formularios: canCreateFormularios,
          personalizar_colores: canPersonalizarColores
        };
      } else {
        // Default fallback permissions
        if (currentRole === 'admin') {
          resolvedPerms = {
            ver_todas_seccionales: true,
            view_dashboard: true, view_socorristas: true, edit_socorristas: true,
            view_carnet: true, view_cursos: true, view_seccionales: true, edit_seccionales: true,
            view_config: true, view_activity: true, view_accesos: true,
            view_directorio: true, ver_imagenes_socorristas: true, descargar_carnet: true, cambiar_estado_socorrista: true, descargar_excel_socorristas: true,
            view_solicitar_carnet: true, view_verificar_carnet: true,
            view_vehiculos: true, edit_vehiculos: true,
            view_solicitudes_compra: true, crear_solicitudes_compra: true, aprobar_solicitudes_compra: true,
            view_solicitudes_combustible: true, crear_solicitudes_combustible: true, aprobar_solicitudes_combustible: true,
            view_archivos: true, subir_archivos: true, 
            view_anuncios: true, crear_anuncios: true,
            view_formularios: true, crear_formularios: true,
            personalizar_colores: true
          };
        } else if (currentRole === 'instructor') {
          resolvedPerms = {
            ver_todas_seccionales: false,
            view_dashboard: true, view_socorristas: false, edit_socorristas: false,
            view_carnet: false, view_cursos: true, view_seccionales: false, edit_seccionales: false,
            view_config: false, view_activity: false, view_accesos: false,
            view_directorio: true, ver_imagenes_socorristas: false, descargar_carnet: false, cambiar_estado_socorrista: false, descargar_excel_socorristas: false,
            view_solicitar_carnet: true, view_verificar_carnet: true,
            view_vehiculos: true, edit_vehiculos: canEditVehiculos,
            view_solicitudes_compra: true, crear_solicitudes_compra: true, aprobar_solicitudes_compra: false,
            view_solicitudes_combustible: true, crear_solicitudes_combustible: true, aprobar_solicitudes_combustible: false,
            view_archivos: true, subir_archivos: canUploadFiles, 
            view_anuncios: true, crear_anuncios: false,
            view_formularios: true, crear_formularios: false,
            personalizar_colores: false
          };
        } else if (currentRole === 'director') {
          resolvedPerms = {
            ver_todas_seccionales: false,
            view_dashboard: true, view_socorristas: true, edit_socorristas: true,
            view_carnet: false, view_cursos: false, view_seccionales: false, edit_seccionales: false,
            view_config: false, view_activity: false, view_accesos: false,
            view_directorio: true, ver_imagenes_socorristas: true, descargar_carnet: false, cambiar_estado_socorrista: false, descargar_excel_socorristas: false,
            view_solicitar_carnet: true, view_verificar_carnet: true,
            view_vehiculos: true, edit_vehiculos: canEditVehiculos,
            view_solicitudes_compra: true, crear_solicitudes_compra: true, aprobar_solicitudes_compra: false,
            view_solicitudes_combustible: true, crear_solicitudes_combustible: true, aprobar_solicitudes_combustible: false,
            view_archivos: true, subir_archivos: canUploadFiles, 
            view_anuncios: true, crear_anuncios: false,
            view_formularios: true, crear_formularios: false,
            personalizar_colores: false
          };
        } else {
          resolvedPerms = {
            ver_todas_seccionales: false,
            view_dashboard: true, view_socorristas: false, edit_socorristas: false,
            view_carnet: false, view_cursos: false, view_seccionales: false, edit_seccionales: false,
            view_config: false, view_activity: false, view_accesos: false,
            view_directorio: true, ver_imagenes_socorristas: false, descargar_carnet: false, cambiar_estado_socorrista: false, descargar_excel_socorristas: false,
            view_vehiculos: true, edit_vehiculos: canEditVehiculos,
            view_solicitudes_compra: true, crear_solicitudes_compra: true, aprobar_solicitudes_compra: false,
            view_solicitudes_combustible: true, crear_solicitudes_combustible: true, aprobar_solicitudes_combustible: false,
            view_archivos: true, subir_archivos: canUploadFiles, 
            view_anuncios: true, crear_anuncios: false,
            view_formularios: true, crear_formularios: false,
            personalizar_colores: false
          };
        }
      }

      // Merge individual custom overrides (por individual)
      const userCustomPerms = (roleData as any)?.custom_permissions || {};
      const finalMergedPerms: Record<string, boolean> = { ...resolvedPerms };

      Object.keys(userCustomPerms).forEach(key => {
        if (userCustomPerms[key] !== undefined && userCustomPerms[key] !== null) {
          finalMergedPerms[key] = Boolean(userCustomPerms[key]);
        }
      });

      // Special check for can_upload_files column
      if ((roleData as any)?.can_upload_files) {
        finalMergedPerms.subir_archivos = true;
      }

      setPermissions(finalMergedPerms);
      setCustomPermissions(userCustomPerms);

    } catch (error) {
      console.error('Error in fetchUserRoleAndPermissions:', error);
    } finally {
      setLoading(false);
    }
  };

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
