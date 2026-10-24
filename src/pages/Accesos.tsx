import React, { useState, useEffect } from 'react';
import { 
  Shield, Users, Settings, Save, Check, X, UserPlus, Trash2, Edit, Globe, 
  MapPin, Building2, Fuel, FileText, Info, KeyRound, Key, Clock, CheckCircle2, 
  XCircle, AlertTriangle, Eye, Send, Mail, UserCheck, UserX, Copy, RefreshCw, Megaphone,
  Sliders, Sparkles, Database
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { logActivity } from '../lib/logger';
import { useSettings } from '../contexts/SettingsContext';
import SolicitudesRegistroTab from '../components/accesos/SolicitudesRegistroTab';
import ResetPasswordModal from '../components/accesos/ResetPasswordModal';
import PermisosIndividualesModal from '../components/accesos/PermisosIndividualesModal';
import { generarHtmlCorreoAprobacion } from '../lib/emailNotification';
import { getOfficialLoginUrl } from '../utils/appUrl';

export default function Accesos() {
  const { refreshSettings } = useSettings();
  const [activeTab, setActiveTab] = useState<'usuarios' | 'solicitudes' | 'roles' | 'ajustes'>('usuarios');
  const [loading, setLoading] = useState(true);
  
  // Usuarios state
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [seccionales, setSeccionales] = useState<any[]>([]);
  const [inactiveUserIds, setInactiveUserIds] = useState<string[]>([]);
  
  // Solicitudes state
  const [solicitudes, setSolicitudes] = useState<any[]>([]);

  // Password Reset Modal State
  const [selectedUserForReset, setSelectedUserForReset] = useState<any | null>(null);

  // Permisos Individuales Modal State
  const [selectedUserForPermisos, setSelectedUserForPermisos] = useState<any | null>(null);

  // New User Modal State
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [newUserType, setNewUserType] = useState<'cruz_verde' | 'externo' | null>(null);
  const [newUserCarnet, setNewUserCarnet] = useState('');
  const [socorristaData, setSocorristaData] = useState<any>(null);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [passwordOption, setPasswordOption] = useState<'manual' | 'generated'>('manual');
  const [newUserRole, setNewUserRole] = useState('socorrista');
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUserRequiresPasswordReset, setNewUserRequiresPasswordReset] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [formError, setFormError] = useState('');
  
  // Roles state
  const [rolePermissions, setRolePermissions] = useState<any[]>([]);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editedPermissions, setEditedPermissions] = useState<any>({});
  
  // Ajustes de Seguridad y Notificaciones state
  const [originalAjustes, setOriginalAjustes] = useState({ watermark: true, loginSolicitar: true, loginVerificar: true });
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [loginShowSolicitar, setLoginShowSolicitar] = useState(true);
  const [loginShowVerificar, setLoginShowVerificar] = useState(true);
  const [savingAjustes, setSavingAjustes] = useState(false);
  const [ajustesSavedMessage, setAjustesSavedMessage] = useState(false);

  // Configuración de Remitente de Correo
  const [remitenteNombre, setRemitenteNombre] = useState('Cruz Verde Salvadoreña - Sistema Interno');
  const [remitenteCorreo, setRemitenteCorreo] = useState('notificaciones@cruzverdesv.org');
  const [asuntoAprobacion, setAsuntoAprobacion] = useState('¡Tu cuenta ha sido aprobada! - Cruz Verde Salvadoreña');
  const [savingEmailConfig, setSavingEmailConfig] = useState(false);
  const [emailConfigSaved, setEmailConfigSaved] = useState(false);
  const [showAjustesPreview, setShowAjustesPreview] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [sql21Copied, setSql21Copied] = useState(false);
  const [sql22Copied, setSql22Copied] = useState(false);

  const hasAjustesChanges = watermarkEnabled !== originalAjustes.watermark || 
                            loginShowSolicitar !== originalAjustes.loginSolicitar || 
                            loginShowVerificar !== originalAjustes.loginVerificar;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch users from view (if exists) and join with roles
      const { data: viewData, error: viewError } = await supabase
        .from('usuarios_view')
        .select('*');

      let usersData: any[] | null = null;
      let usersError: any = null;

      const resCustom = await supabase
        .from('user_roles')
        .select(`
          id,
          role,
          socorrista_id,
          activo,
          estado,
          can_upload_files,
          custom_permissions,
          requires_password_reset,
          socorristas (
            primer_nombre, 
            primer_apellido, 
            carnet,
            seccional_id,
            seccionales (id, nombre)
          )
        `);

      if (resCustom.error) {
        // Fallback without custom_permissions column
        const resFallback = await supabase
          .from('user_roles')
          .select(`
            id,
            role,
            socorrista_id,
            activo,
            estado,
            can_upload_files,
            requires_password_reset,
            socorristas (
              primer_nombre, 
              primer_apellido, 
              carnet,
              seccional_id,
              seccionales (id, nombre)
            )
          `);
        usersData = resFallback.data;
        usersError = resFallback.error;
      } else {
        usersData = resCustom.data;
        usersError = resCustom.error;
      }

      if (usersError) {
        console.warn('Error fetching user_roles:', usersError);
      }

      // Merge data
      let mergedUsers = usersData || [];
      if (!viewError && viewData) {
        mergedUsers = mergedUsers.map(u => {
          const viewUser = viewData.find(v => v.id === u.id);
          return { ...u, email: viewUser?.email || 'Email no disponible' };
        });
      } else {
        mergedUsers = mergedUsers.map(u => ({ ...u, email: 'Requiere vista SQL' }));
      }

      setUsuarios(mergedUsers);

      // 2. Fetch role permissions
      const { data: rolesData, error: rolesError } = await supabase
        .from('role_permissions')
        .select('*');
      
      if (!rolesError && rolesData) {
        setRolePermissions(rolesData || []);
        setRoles(rolesData?.map(r => r.role) || ['admin', 'socorrista', 'instructor', 'director']);
      } else {
        setRoles(['admin', 'socorrista', 'instructor', 'director', 'administrativo']);
      }

      // 3. Fetch seccionales
      const { data: secData } = await supabase
        .from('seccionales')
        .select('id, nombre')
        .order('nombre');
      if (secData) setSeccionales(secData);

      // 4. Fetch configuracion
      const { data: configData, error: configError } = await supabase
        .from('configuracion')
        .select('*');
      
      if (!configError && configData) {
        const newAjustes = { watermark: true, loginSolicitar: true, loginVerificar: true };
        
        configData.forEach(row => {
          if (row.clave === 'watermark_enabled') {
            const val = row.valor === 'true';
            setWatermarkEnabled(val);
            newAjustes.watermark = val;
          }
          if (row.clave === 'login_show_solicitar') {
            const val = row.valor === 'true';
            setLoginShowSolicitar(val);
            newAjustes.loginSolicitar = val;
          }
          if (row.clave === 'login_show_verificar') {
            const val = row.valor === 'true';
            setLoginShowVerificar(val);
            newAjustes.loginVerificar = val;
          }
          if (row.clave === 'email_remitente_nombre' && row.valor) {
            setRemitenteNombre(row.valor);
          }
          if (row.clave === 'email_remitente_correo' && row.valor) {
            setRemitenteCorreo(row.valor);
          }
          if (row.clave === 'email_aprobacion_asunto' && row.valor) {
            setAsuntoAprobacion(row.valor);
          }
          if (row.clave === 'inactive_user_ids' && row.valor) {
            try {
              setInactiveUserIds(JSON.parse(row.valor));
            } catch (e) {}
          }
        });
        setOriginalAjustes(newAjustes);
      }

      // 5. Fetch solicitudes de registro
      try {
        const { data: solData, error: solError } = await supabase
          .from('solicitudes_registro')
          .select(`
            *,
            seccionales (id, nombre)
          `)
          .order('fecha_solicitud', { ascending: false });

        if (!solError && solData) {
          setSolicitudes(solData);
        } else {
          // Fallback: Si la tabla no existe aún, detectar usuarios pendientes en user_roles
          const pendingUsers = (mergedUsers || [])
            .filter((u: any) => u.role === 'pendiente' || u.estado === 'pendiente')
            .map((u: any) => ({
              id: u.id,
              auth_user_id: u.id,
              nombre_completo: u.socorristas ? `${u.socorristas.primer_nombre} ${u.socorristas.primer_apellido}` : (u.email?.split('@')[0] || 'Nuevo Solicitante'),
              email: u.email || 'Email no disponible',
              carnet: u.socorristas?.carnet,
              seccional_id: u.socorristas?.seccional_id,
              seccionales: u.socorristas?.seccionales,
              tipo_usuario: 'socorrista',
              estado: 'pendiente' as const,
              fecha_solicitud: new Date().toISOString(),
            }));
          setSolicitudes(pendingUsers);
        }
      } catch (errSol) {
        console.warn('Error leyendo solicitudes_registro:', errSol);
      }

    } catch (error) {
      console.error('Error fetching accesos data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Toggle Activo / Inactivo de usuario
  const handleToggleUserActive = async (targetUser: any) => {
    const isCurrentlyInactive = targetUser.role === 'inactivo' || 
                                targetUser.activo === false || 
                                targetUser.estado === 'inactivo' || 
                                inactiveUserIds.includes(targetUser.id);
    const newActiveState = isCurrentlyInactive; // true = activar, false = desactivar

    const confirmText = newActiveState 
      ? `¿Deseas reactivar al usuario ${targetUser.email}? Podrá ingresar al sistema nuevamente.`
      : `¿Estás seguro de desactivar al usuario ${targetUser.email}? Se le bloqueará el acceso inmediatamente.`;

    if (!window.confirm(confirmText)) return;

    try {
      const newRole = newActiveState 
        ? (targetUser.role === 'inactivo' ? 'socorrista' : targetUser.role)
        : 'inactivo';

      // Actualizar en user_roles
      const { error: roleErr } = await supabase
        .from('user_roles')
        .update({
          role: newRole,
          activo: newActiveState,
          estado: newActiveState ? 'activo' : 'inactivo'
        })
        .eq('id', targetUser.id);

      if (roleErr) console.warn('Advertencia al actualizar user_roles:', roleErr);

      // Sincronizar con configuracion inactive_user_ids para forzar bloqueo en login
      let updatedInactiveList = [...inactiveUserIds];
      if (!newActiveState) {
        if (!updatedInactiveList.includes(targetUser.id)) updatedInactiveList.push(targetUser.id);
        if (targetUser.email && !updatedInactiveList.includes(targetUser.email)) updatedInactiveList.push(targetUser.email);
      } else {
        updatedInactiveList = updatedInactiveList.filter(id => id !== targetUser.id && id !== targetUser.email);
      }

      setInactiveUserIds(updatedInactiveList);
      await supabase
        .from('configuracion')
        .upsert({ clave: 'inactive_user_ids', valor: JSON.stringify(updatedInactiveList) }, { onConflict: 'clave' });

      // Actualizar estado local
      setUsuarios(usuarios.map(u => u.id === targetUser.id ? { 
        ...u, 
        role: newRole, 
        activo: newActiveState, 
        estado: newActiveState ? 'activo' : 'inactivo' 
      } : u));

      await logActivity(
        newActiveState ? 'Activó cuenta de usuario' : 'Desactivó cuenta de usuario',
        'Usuario',
        targetUser.id,
        { usuario: targetUser.email, nuevo_estado: newActiveState ? 'activo' : 'inactivo' }
      );

      alert(`Usuario ${newActiveState ? 'activado' : 'desactivado'} con éxito.`);
    } catch (err: any) {
      console.error('Error al alternar estado activo del usuario:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleCarnetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (val.startsWith('CVS')) {
      val = val.substring(3);
    }
    
    let formatted = 'CVS';
    if (val.length > 0) formatted += '-' + val.substring(0, 4);
    if (val.length > 4) formatted += '-' + val.substring(4, 6);
    
    setNewUserCarnet(formatted);
  };

  const handleSearchCarnet = async () => {
    if (!newUserCarnet) return;
    setSearchLoading(true);
    setSearchError('');
    try {
      const { data, error } = await supabase
        .from('socorristas')
        .select('*')
        .eq('carnet', newUserCarnet)
        .single();
        
      if (error || !data) {
        setSearchError('No se encontró ningún socorrista con este carnet.');
        setSocorristaData(null);
      } else {
        setSocorristaData(data);
        if (data.email) {
          setNewUserEmail(data.email);
        } else {
          setNewUserEmail('');
        }
      }
    } catch (err) {
      setSearchError('Error al buscar el carnet.');
      setSocorristaData(null);
    } finally {
      setSearchLoading(false);
    }
  };

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
    let pass = "";
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewUserPassword(pass);
    setPasswordOption('generated');
  };

  const resetNewUserModal = () => {
    setNewUserType(null);
    setNewUserCarnet('');
    setSocorristaData(null);
    setNewUserEmail('');
    setNewUserPassword('');
    setPasswordOption('manual');
    setNewUserRole('socorrista');
    setNewUserRequiresPasswordReset(true);
    setShowNewUserModal(false);
    setSearchError('');
    setFormError('');
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!newUserEmail) {
      setFormError('El correo electrónico es requerido.');
      return;
    }
    if (!newUserPassword) {
      setFormError('La contraseña es requerida.');
      return;
    }
    
    setCreatingUser(true);
    try {
      let socorristaId = null;

      if (newUserType === 'cruz_verde') {
        if (!socorristaData) {
          throw new Error('Debe buscar y seleccionar un socorrista válido.');
        }
        socorristaId = socorristaData.id;
      }

      // 1. Create user in auth.users using secondary client
      const secondarySupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL || '',
        import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        }
      );

      const { data: authData, error: authError } = await secondarySupabase.auth.signUp({
        email: newUserEmail,
        password: newUserPassword,
      });
      
      if (authError) throw authError;
      
      const newUserId = authData.user?.id;
      if (!newUserId) {
        throw new Error('No se pudo obtener el ID del usuario creado. Es posible que el correo ya esté registrado o que se requiera confirmación de correo electrónico.');
      }

      // 2. Assign role in user_roles
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ 
          id: newUserId, 
          role: newUserRole,
          activo: true,
          estado: 'activo',
          socorrista_id: socorristaId,
          requires_password_reset: newUserRequiresPasswordReset
        });
        
      if (roleError) throw roleError;
      
      await logActivity('Creó nuevo usuario', 'Usuario', newUserId, { email: newUserEmail, rol: newUserRole, carnet: newUserCarnet });
      
      resetNewUserModal();
      fetchData();
      alert('Usuario creado exitosamente');
      
    } catch (error: any) {
      console.error('Error creating user:', error);
      setFormError(error.message || 'Ocurrió un error al crear el usuario.');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleLinkCarnet = async (userId: string, currentCarnet: string) => {
    const newCarnet = prompt('Ingrese el número de carnet del socorrista para vincular a este usuario:', currentCarnet || '');
    if (newCarnet === null || newCarnet === currentCarnet) return;

    try {
      let socorristaId = null;
      if (newCarnet.trim() !== '') {
        const { data: socData, error: socError } = await supabase
          .from('socorristas')
          .select('id')
          .eq('carnet', newCarnet.trim())
          .single();
          
        if (socError || !socData) {
          throw new Error(`No se encontró ningún socorrista con el carnet: ${newCarnet}`);
        }
        socorristaId = socData.id;
      }

      const { error } = await supabase
        .from('user_roles')
        .update({ socorrista_id: socorristaId })
        .eq('id', userId);

      if (error) throw error;
      
      await logActivity('Vinculó carnet a usuario', 'Usuario', userId, { carnet: newCarnet });
      fetchData();
      alert('Carnet vinculado exitosamente');
    } catch (error: any) {
      console.error('Error linking carnet:', error);
      alert(`Error al vincular carnet: ${error.message}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este usuario permanentemente? Esta acción no se puede deshacer.')) {
      return;
    }
    
    try {
      const { error } = await supabase.rpc('delete_user', { target_user_id: userId });
      
      if (error) {
        console.warn('RPC delete_user falló, desactivando usuario:', error);
        await supabase.from('user_roles').update({ role: 'inactivo', activo: false, estado: 'inactivo' }).eq('id', userId);
        alert('El usuario ha sido desactivado permanentemente.');
        fetchData();
      } else {
        await logActivity('Eliminó usuario', 'Usuario', userId, {});
        setUsuarios(usuarios.filter(u => u.id !== userId));
        alert('Usuario eliminado correctamente');
      }
    } catch (error: any) {
      console.error('Error deleting user:', error);
      alert('Error al intentar eliminar el usuario');
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ 
          role: newRole,
          activo: newRole !== 'inactivo' && newRole !== 'pendiente',
          estado: newRole === 'inactivo' ? 'inactivo' : (newRole === 'pendiente' ? 'pendiente' : 'activo')
        })
        .eq('id', userId);
      
      if (error) throw error;
      
      setUsuarios(usuarios.map(u => u.id === userId ? { 
        ...u, 
        role: newRole, 
        activo: newRole !== 'inactivo' && newRole !== 'pendiente',
        estado: newRole === 'inactivo' ? 'inactivo' : (newRole === 'pendiente' ? 'pendiente' : 'activo')
      } : u));
      
      await logActivity('Cambió rol de usuario', 'Usuario', userId, { nuevo_rol: newRole });
      
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Error al actualizar el rol');
    }
  };

  const handleToggleCanUploadFiles = async (targetUser: any) => {
    try {
      const newValue = !targetUser.can_upload_files;
      const { error } = await supabase
        .from('user_roles')
        .update({ can_upload_files: newValue })
        .eq('id', targetUser.id);

      if (error) {
        console.warn('Error en supabase al actualizar can_upload_files:', error);
      }

      setUsuarios(usuarios.map(u => u.id === targetUser.id ? { ...u, can_upload_files: newValue } : u));
      await logActivity('Actualizó permiso de subida de archivos', 'Usuario', targetUser.id, { can_upload_files: newValue });
    } catch (err) {
      console.error('Error toggling can_upload_files:', err);
      alert('No se pudo actualizar el permiso de subida de archivos');
    }
  };

  const handleSaveCustomPermissions = async (
    targetUserId: string, 
    updatedCustomPermissions: Record<string, boolean>, 
    updatedCanUploadFiles: boolean
  ) => {
    try {
      // 1. Intentar actualizar en Supabase con custom_permissions y can_upload_files
      const { error } = await supabase
        .from('user_roles')
        .update({ 
          custom_permissions: updatedCustomPermissions,
          can_upload_files: updatedCanUploadFiles 
        })
        .eq('id', targetUserId);

      if (error) {
        console.warn('Advertencia en Supabase (la columna custom_permissions puede requerir migración 22):', error);
        // Fallback: actualizar al menos can_upload_files
        await supabase
          .from('user_roles')
          .update({ can_upload_files: updatedCanUploadFiles })
          .eq('id', targetUserId);
      }

      // 2. Actualizar estado local inmediato en usuarios
      setUsuarios(prev => prev.map(u => {
        if (u.id === targetUserId) {
          return {
            ...u,
            custom_permissions: updatedCustomPermissions,
            can_upload_files: updatedCanUploadFiles
          };
        }
        return u;
      }));

      await logActivity('Actualizó accesos individuales', 'Usuario', targetUserId, {
        custom_permissions: updatedCustomPermissions,
        can_upload_files: updatedCanUploadFiles
      });

      alert('Accesos individuales del usuario guardados exitosamente.');
    } catch (err) {
      console.error('Error al guardar accesos individuales:', err);
      alert('Error al guardar los accesos individuales del usuario.');
    }
  };

  const handleSavePermissions = async (role: string) => {
    try {
      const { error } = await supabase
        .from('role_permissions')
        .update({ permissions: editedPermissions })
        .eq('role', role);
      
      if (error) throw error;
      
      setRolePermissions(rolePermissions.map(rp => rp.role === role ? { ...rp, permissions: editedPermissions } : rp));
      setEditingRole(null);
      await logActivity('Actualizó permisos de rol', 'Rol', role, { permisos: editedPermissions });
      alert('Permisos actualizados correctamente');
      
    } catch (error) {
      console.error('Error updating permissions:', error);
      alert('Error al actualizar permisos');
    }
  };

  const startEditingRole = (roleItem: any) => {
    setEditingRole(roleItem.role);
    setEditedPermissions(roleItem.permissions);
  };

  const togglePermission = (key: string) => {
    setEditedPermissions({
      ...editedPermissions,
      [key]: !editedPermissions[key]
    });
  };

  const updateConfiguracion = async (key: string, newValue: boolean | string) => {
    try {
      const { data: existing } = await supabase.from('configuracion').select('id').eq('clave', key).maybeSingle();
      const strValue = String(newValue);
      if (existing) {
        await supabase.from('configuracion').update({ valor: strValue }).eq('id', existing.id);
      } else {
        await supabase.from('configuracion').insert({ clave: key, valor: strValue });
      }
      return true;
    } catch (error) {
      console.error(`Error updating config ${key}:`, error);
      return false;
    }
  };

  const handleToggleWatermark = () => setWatermarkEnabled(!watermarkEnabled);
  const handleToggleLoginSolicitar = () => setLoginShowSolicitar(!loginShowSolicitar);
  const handleToggleLoginVerificar = () => setLoginShowVerificar(!loginShowVerificar);

  const handleSaveAjustes = async () => {
    setSavingAjustes(true);
    let success = true;
    
    if (watermarkEnabled !== originalAjustes.watermark) {
      if (await updateConfiguracion('watermark_enabled', watermarkEnabled)) {
        await logActivity('Actualizó marca de agua', 'Configuración', 'watermark', { activado: watermarkEnabled });
      } else { success = false; }
    }
    
    if (loginShowSolicitar !== originalAjustes.loginSolicitar) {
      if (await updateConfiguracion('login_show_solicitar', loginShowSolicitar)) {
        await logActivity('Actualizó botón Solicitar Carnet en login', 'Configuración', 'login_solicitar', { activado: loginShowSolicitar });
      } else { success = false; }
    }
    
    if (loginShowVerificar !== originalAjustes.loginVerificar) {
      if (await updateConfiguracion('login_show_verificar', loginShowVerificar)) {
        await logActivity('Actualizó botón Verificar Carnet en login', 'Configuración', 'login_verificar', { activado: loginShowVerificar });
      } else { success = false; }
    }
    
    setSavingAjustes(false);
    if (success) {
      setOriginalAjustes({
        watermark: watermarkEnabled,
        loginSolicitar: loginShowSolicitar,
        loginVerificar: loginShowVerificar
      });
      await refreshSettings();
      setAjustesSavedMessage(true);
      setTimeout(() => setAjustesSavedMessage(false), 3000);
    }
  };

  const handleSaveEmailConfig = async () => {
    setSavingEmailConfig(true);
    try {
      await updateConfiguracion('email_remitente_nombre', remitenteNombre);
      await updateConfiguracion('email_remitente_correo', remitenteCorreo);
      await updateConfiguracion('email_aprobacion_asunto', asuntoAprobacion);
      
      await logActivity('Actualizó configuración de correos de notificación', 'Configuración', 'email_settings', {
        remitente: `${remitenteNombre} <${remitenteCorreo}>`,
      });

      setEmailConfigSaved(true);
      setTimeout(() => setEmailConfigSaved(false), 3500);
    } catch (err) {
      console.error('Error guardando configuración de correos:', err);
      alert('Error al guardar configuración de correo.');
    } finally {
      setSavingEmailConfig(false);
    }
  };

  const handleCopySqlMigration = () => {
    const sqlText = `-- MIGRACIÓN 18: REGISTRO DE USUARIOS Y GESTIÓN DE ACCESOS
-- Ejecutar en Supabase SQL Editor:
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'activo';
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS nombre_completo TEXT;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS telefono TEXT;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS seccional_id INTEGER REFERENCES public.seccionales(id) ON DELETE SET NULL;
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;

CREATE TABLE IF NOT EXISTS public.solicitudes_registro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_completo TEXT NOT NULL,
  email TEXT NOT NULL,
  telefono TEXT,
  seccional_id INTEGER REFERENCES public.seccionales(id) ON DELETE SET NULL,
  carnet TEXT,
  tipo_usuario TEXT DEFAULT 'socorrista',
  motivo TEXT,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
  revisado_por UUID,
  fecha_solicitud TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  fecha_revision TIMESTAMP WITH TIME ZONE,
  notas_admin TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.solicitudes_registro ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir crear solicitud de registro a cualquiera" ON public.solicitudes_registro;
CREATE POLICY "Permitir crear solicitud de registro a cualquiera" ON public.solicitudes_registro FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Admins pueden ver todas las solicitudes de registro" ON public.solicitudes_registro;
CREATE POLICY "Admins pueden ver todas las solicitudes de registro" ON public.solicitudes_registro FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins pueden actualizar solicitudes de registro" ON public.solicitudes_registro;
CREATE POLICY "Admins pueden actualizar solicitudes de registro" ON public.solicitudes_registro FOR UPDATE USING (true);`;

    navigator.clipboard.writeText(sqlText);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 3000);
  };

  const handleCopySqlMigration21 = () => {
    const sqlText = `-- ==============================================================================
-- MIGRACIÓN 21: ARCHIVOS DESCARGABLES INSTITUCIONALES Y SISTEMA DE ANUNCIOS
-- Cruz Verde Salvadoreña - Sistema Administrativo
-- ==============================================================================

-- 1. TABLA: ARCHIVOS DESCARGABLES
CREATE TABLE IF NOT EXISTS public.archivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descripcion TEXT,
  categoria TEXT DEFAULT 'General',
  nombre_archivo TEXT NOT NULL,
  url_archivo TEXT NOT NULL,
  tipo_archivo TEXT,
  extension TEXT,
  tamano_bytes BIGINT DEFAULT 0,
  tamano_legible TEXT,
  subido_por_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subido_por_nombre TEXT,
  seccional_id INTEGER REFERENCES public.seccionales(id) ON DELETE SET NULL,
  descargas_count INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  enlace_externo TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.archivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden ver archivos activos"
  ON public.archivos FOR SELECT TO authenticated
  USING (activo = true OR auth.uid() = subido_por_id OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Usuarios autorizados pueden subir archivos"
  ON public.archivos FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.id = auth.uid() AND (ur.role = 'admin' OR ur.can_upload_files = true)
    )
  );

CREATE POLICY "Admin y autor pueden modificar archivos"
  ON public.archivos FOR UPDATE TO authenticated
  USING (auth.uid() = subido_por_id OR EXISTS (SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin y autor pueden eliminar archivos"
  ON public.archivos FOR DELETE TO authenticated
  USING (auth.uid() = subido_por_id OR EXISTS (SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role = 'admin'));

-- 2. TABLA: ANUNCIOS Y NOTICIAS INSTITUCIONALES
CREATE TABLE IF NOT EXISTS public.anuncios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  contenido TEXT NOT NULL,
  tipo TEXT DEFAULT 'info',
  prioridad INTEGER DEFAULT 1,
  mostrar_cuadro_dashboard BOOLEAN DEFAULT true,
  mostrar_ticker_dashboard BOOLEAN DEFAULT true,
  activo BOOLEAN DEFAULT true,
  fecha_expiracion TIMESTAMPTZ,
  enlace_url TEXT,
  enlace_texto TEXT DEFAULT 'Más información',
  archivo_nombre TEXT,
  archivo_url TEXT,
  archivo_tamano TEXT,
  autor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  autor_nombre TEXT,
  vistas_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.anuncios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden ver anuncios"
  ON public.anuncios FOR SELECT TO authenticated
  USING (activo = true OR EXISTS (SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin y autorizados pueden crear anuncios"
  ON public.anuncios FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role = 'admin'));

-- 3. PERMISO can_upload_files EN user_roles
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS can_upload_files BOOLEAN DEFAULT false;

-- 4. ACTUALIZACIÓN DE PERMISOS
UPDATE public.role_permissions
SET permissions = jsonb_set(
  jsonb_set(
    jsonb_set(COALESCE(permissions, '{}'::jsonb), '{view_archivos}', 'true'::jsonb, true),
    '{subir_archivos}', 'true'::jsonb, true
  ),
  '{view_anuncios}', 'true'::jsonb, true
)
WHERE role = 'admin';

UPDATE public.role_permissions
SET permissions = jsonb_set(
  jsonb_set(
    jsonb_set(COALESCE(permissions, '{}'::jsonb), '{view_archivos}', 'true'::jsonb, true),
    '{subir_archivos}', 'false'::jsonb, true
  ),
  '{view_anuncios}', 'false'::jsonb, true
)
WHERE role IN ('socorrista', 'director', 'instructor', 'administrativo');`;

    navigator.clipboard.writeText(sqlText);
    setSql21Copied(true);
    setTimeout(() => setSql21Copied(false), 3000);
  };

  const handleCopySqlMigration22 = () => {
    const sqlText = `-- =========================================================================
-- MIGRACIÓN 22: PERMISOS INDIVIDUALES POR USUARIO
-- Cruz Verde Salvadoreña - Sistema Institucional
-- =========================================================================

-- 1. Agregar columna custom_permissions JSONB a public.user_roles
ALTER TABLE public.user_roles 
  ADD COLUMN IF NOT EXISTS custom_permissions JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.user_roles.custom_permissions IS 'Permisos y excepciones individuales para cada usuario del sistema, que sobreescriben la configuración de su rol';

-- 2. Asegurar que las políticas RLS permitan a los administradores actualizar user_roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_roles' AND policyname = 'Admins can update user_roles custom_permissions'
  ) THEN
    CREATE POLICY "Admins can update user_roles custom_permissions" 
      ON public.user_roles 
      FOR UPDATE 
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur 
          WHERE ur.id = auth.uid() AND ur.role = 'admin'
        ) 
        OR (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com'
      );
  END IF;
END $$;`;

    navigator.clipboard.writeText(sqlText);
    setSql22Copied(true);
    setTimeout(() => setSql22Copied(false), 3000);
  };

  const pendingSolicitudesCount = solicitudes.filter(s => s.estado === 'pendiente').length;

  const permissionLabels: Record<string, string> = {
    ver_todas_seccionales: 'Ver y Gestionar Todas las Seccionales (Nivel Nacional)',
    view_dashboard: 'Ver Dashboard',
    view_socorristas: 'Ver Lista de Socorristas',
    edit_socorristas: 'Crear/Editar Socorristas',
    cambiar_estado_socorrista: 'Activar/Desactivar Socorristas',
    descargar_excel_socorristas: 'Descargar Excel de Socorristas',
    view_carnet: 'Generar Carnets',
    ver_imagenes_socorristas: 'Ver Imágenes de Socorristas (Fotos y Carnets)',
    descargar_carnet: 'Descargar Carnet',
    view_solicitar_carnet: 'Ver Solicitar Carnet en Menú',
    view_verificar_carnet: 'Ver Verificar Carnet en Menú',
    view_cursos: 'Gestionar Cursos',
    view_seccionales: 'Ver Seccionales',
    edit_seccionales: 'Crear/Editar Seccionales',
    view_directorio: 'Ver Directorio Telefónico',
    edit_directorio: 'Editar Directorio Telefónico',
    view_vehiculos: 'Ver Flota de Vehículos',
    edit_vehiculos: 'Crear/Editar Vehículos y Mantenimiento',
    view_solicitudes_compra: 'Ver Solicitudes de Compra y Mantenimiento',
    crear_solicitudes_compra: 'Crear Solicitudes de Compra y Mantenimiento',
    aprobar_solicitudes_compra: 'Aprobar/Rechazar Solicitudes (Administración)',
    view_solicitudes_combustible: 'Ver Solicitudes de Combustible',
    crear_solicitudes_combustible: 'Crear Solicitudes de Combustible',
    aprobar_solicitudes_combustible: 'Aprobar/Rechazar Solicitudes de Combustible',
    view_archivos: 'Ver y Descargar Archivos',
    subir_archivos: 'Subir y Gestionar Archivos Institucionales',
    view_anuncios: 'Ver y Acceder a Anuncios Institucionales',
    crear_anuncios: 'Crear, Publicar y Eliminar Anuncios',
    view_formularios: 'Ver Pestaña de Formularios y Respuestas',
    crear_formularios: 'Crear y Gestionar Formularios (Fluent Forms)',
    ver_todos_formularios: 'Ver Todos los Formularios (Ignorar restricción de ver solo creados por el usuario)',
    view_meritos: 'Ver y Gestionar Méritos y Reconocimientos Institucionales',
    personalizar_colores: 'Personalizar Colores del Sistema y Marca',
    view_config: 'Ajustes de Verificación',
    view_activity: 'Ver Registro de Actividad',
    view_accesos: 'Gestión de Accesos (Admin)'
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="mt-4 text-gray-500 font-medium">Cargando datos de accesos y seguridad...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* Encabezado Estilo Apple */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Accesos y Usuarios
          </h1>
          <p className="mt-0.5 text-xs text-gray-500">
            Gestión de cuentas, solicitudes, roles institucionales y seguridad
          </p>
        </div>
      </div>

      {/* Segmented Control Estilo Apple */}
      <div className="bg-slate-200/60 p-1 rounded-2xl flex flex-wrap gap-1 border border-slate-200/80">
        <button
          onClick={() => setActiveTab('usuarios')}
          className={`flex-1 min-w-[140px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'usuarios'
              ? 'bg-white text-gray-900 shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/40'
          }`}
        >
          <span className="w-5 h-5 rounded-md bg-blue-500 text-white flex items-center justify-center shrink-0">
            <Users className="w-3 h-3" />
          </span>
          <span>Usuarios ({usuarios.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('solicitudes')}
          className={`flex-1 min-w-[140px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer relative ${
            activeTab === 'solicitudes'
              ? 'bg-white text-gray-900 shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/40'
          }`}
        >
          <span className="w-5 h-5 rounded-md bg-amber-500 text-white flex items-center justify-center shrink-0">
            <UserCheck className="w-3 h-3" />
          </span>
          <span>Solicitudes</span>
          {pendingSolicitudesCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 text-3xs font-black bg-amber-500 text-white rounded-full">
              {pendingSolicitudesCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('roles')}
          className={`flex-1 min-w-[140px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'roles'
              ? 'bg-white text-gray-900 shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/40'
          }`}
        >
          <span className="w-5 h-5 rounded-md bg-purple-500 text-white flex items-center justify-center shrink-0">
            <Shield className="w-3 h-3" />
          </span>
          <span>Permisos de Roles</span>
        </button>

        <button
          onClick={() => setActiveTab('ajustes')}
          className={`flex-1 min-w-[140px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'ajustes'
              ? 'bg-white text-gray-900 shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/40'
          }`}
        >
          <span className="w-5 h-5 rounded-md bg-slate-600 text-white flex items-center justify-center shrink-0">
            <Sliders className="w-3 h-3" />
          </span>
          <span>Ajustes del Sistema</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden p-5 sm:p-6">
          
          {/* TAB 1: USUARIOS */}
          {activeTab === 'usuarios' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1">
                <div>
                  <h3 className="text-base font-bold tracking-tight text-gray-900">Usuarios del Sistema</h3>
                  <p className="text-2xs text-gray-400">
                    Control de acceso, activación/desactivación y contraseñas
                  </p>
                </div>
                <button
                  onClick={() => setShowNewUserModal(true)}
                  className="inline-flex items-center px-3.5 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <UserPlus className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                  Nuevo Usuario Manual
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
                <table className="min-w-full divide-y divide-slate-100 text-left">
                  <thead className="bg-slate-50/80 text-3xs font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">Usuario / Correo</th>
                      <th className="px-5 py-3.5">Carnet Asociado</th>
                      <th className="px-5 py-3.5">Rol en Sistema</th>
                      <th className="px-5 py-3.5">Ámbito Seccional</th>
                      <th className="px-5 py-3.5 text-center">Accesos Individuales</th>
                      <th className="px-5 py-3.5 text-center">Subir Archivos</th>
                      <th className="px-5 py-3.5">Estado de Cuenta</th>
                      <th className="px-5 py-3.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 text-xs">
                    {usuarios.map((user) => {
                      const isInactive = user.role === 'inactivo' || 
                                         user.activo === false || 
                                         user.estado === 'inactivo' || 
                                         inactiveUserIds.includes(user.id);
                      const isPending = user.role === 'pendiente' || user.estado === 'pendiente';

                      return (
                        <tr key={user.id} className={isInactive ? 'bg-red-50/40 opacity-80' : (isPending ? 'bg-amber-50/40' : 'hover:bg-gray-50/80 transition-colors')}>
                          
                          {/* Identidad Usuario */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="font-bold text-gray-900">
                              {user.socorristas ? `${user.socorristas.primer_nombre} ${user.socorristas.primer_apellido}` : 'Usuario sin perfil'}
                            </div>
                            <div className="text-gray-500 font-mono text-2xs">{user.email}</div>
                            <div className="text-3xs text-gray-400 font-mono">{user.id}</div>
                          </td>

                          {/* Carnet */}
                          <td className="px-5 py-4 whitespace-nowrap text-gray-600">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-medium">{user.socorristas?.carnet || 'Sin Carnet'}</span>
                              <button
                                onClick={() => handleLinkCarnet(user.id, user.socorristas?.carnet || '')}
                                className="text-primary hover:text-emerald-800 text-2xs font-bold underline"
                              >
                                {user.socorristas?.carnet ? 'Cambiar' : 'Vincular'}
                              </button>
                            </div>
                          </td>

                          {/* Rol */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <select
                              value={user.role}
                              onChange={(e) => handleRoleChange(user.id, e.target.value)}
                              className={`block w-full pl-2.5 pr-8 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-primary focus:border-primary font-medium ${
                                user.role === 'inactivo' ? 'text-red-700 bg-red-50 font-bold' : ''
                              }`}
                            >
                              {roles?.map(r => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                              {!roles?.includes('inactivo') && <option value="inactivo">inactivo</option>}
                              {!roles?.includes('pendiente') && <option value="pendiente">pendiente</option>}
                            </select>
                          </td>

                          {/* Ámbito Seccional */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            {user.role === 'admin' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold bg-emerald-100 text-emerald-800">
                                <Globe className="w-3 h-3 mr-1 text-emerald-600" />
                                Nivel Nacional (Todas)
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold bg-blue-100 text-blue-800">
                                <Building2 className="w-3 h-3 mr-1 text-blue-600" />
                                {user.socorristas?.seccionales?.nombre ? user.socorristas.seccionales.nombre : 'Seccional Local'}
                              </span>
                            )}
                          </td>

                          {/* Accesos Individuales */}
                          <td className="px-5 py-4 whitespace-nowrap text-center">
                            {user.role === 'admin' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                <Shield className="w-3 h-3 mr-1 text-purple-600" />
                                Admin (Total)
                              </span>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <button
                                  onClick={() => setSelectedUserForPermisos(user)}
                                  className="inline-flex items-center px-2.5 py-1 rounded-lg text-2xs font-bold text-slate-800 bg-white hover:bg-emerald-50 border border-slate-300 hover:border-primary transition-all cursor-pointer shadow-2xs group"
                                  title="Ver a qué tiene acceso y a qué no por individual"
                                >
                                  <Sliders className="w-3.5 h-3.5 mr-1 text-primary group-hover:scale-110 transition-transform" />
                                  <span>Ver / Configurar</span>
                                </button>

                                {/* Excepciones badge */}
                                {(() => {
                                  const customCount = Object.keys(user.custom_permissions || {}).length;
                                  if (customCount > 0) {
                                    return (
                                      <span className="inline-flex items-center px-1.5 py-0.2 rounded text-3xs font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                                        <Sparkles className="w-2.5 h-2.5 mr-0.5 text-amber-600" />
                                        {customCount} {customCount === 1 ? 'excepción' : 'excepciones'}
                                      </span>
                                    );
                                  }
                                  return (
                                    <span className="text-3xs text-gray-400 font-medium">
                                      Hereda rol ({user.role})
                                    </span>
                                  );
                                })()}
                              </div>
                            )}
                          </td>

                          {/* Permiso de Subir Archivos */}
                          <td className="px-5 py-4 whitespace-nowrap text-center">
                            {user.role === 'admin' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                <Check className="w-3 h-3 mr-1 text-purple-600" />
                                Admin (Total)
                              </span>
                            ) : (
                              <button
                                onClick={() => handleToggleCanUploadFiles(user)}
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-2xs font-bold transition-all cursor-pointer border ${
                                  user.can_upload_files 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100' 
                                    : 'bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200'
                                }`}
                                title={user.can_upload_files ? "Habilitado para subir archivos (Clic para revocar)" : "Desactivado (Clic para habilitar poder subir archivos)"}
                              >
                                {user.can_upload_files ? (
                                  <>
                                    <Check className="w-3 h-3 mr-1 text-emerald-600" />
                                    Habilitado
                                  </>
                                ) : (
                                  <>
                                    <X className="w-3 h-3 mr-1 text-gray-400" />
                                    Desactivado
                                  </>
                                )}
                              </button>
                            )}
                          </td>

                          {/* Estado Activo/Inactivo */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              {isInactive ? (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-2xs font-bold bg-red-100 text-red-800 border border-red-200">
                                  <XCircle className="w-3 h-3 mr-1 text-red-600" />
                                  Inactivo (Bloqueado)
                                </span>
                              ) : isPending ? (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-2xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  <Clock className="w-3 h-3 mr-1 text-amber-600" />
                                  Pendiente
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-2xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                                  Activo
                                </span>
                              )}

                              {/* Botón de Alternar Estado */}
                              <button
                                onClick={() => handleToggleUserActive(user)}
                                className={`px-2 py-1 rounded text-2xs font-bold transition-colors cursor-pointer ${
                                  isInactive 
                                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200' 
                                    : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                                }`}
                                title={isInactive ? "Activar usuario" : "Desactivar usuario"}
                              >
                                {isInactive ? 'Activar' : 'Desactivar'}
                              </button>
                            </div>
                          </td>

                          {/* Acciones */}
                          <td className="px-5 py-4 whitespace-nowrap text-right text-xs font-medium space-x-2.5">
                            
                            {/* Ver Accesos Individuales */}
                            {user.role !== 'admin' && (
                              <button
                                onClick={() => setSelectedUserForPermisos(user)}
                                className="inline-flex items-center text-emerald-700 hover:text-emerald-950 font-semibold cursor-pointer"
                                title="Ver a qué tiene acceso y a qué no por individual"
                              >
                                <Sliders className="h-4 w-4 mr-1 text-emerald-600" />
                                <span>Accesos</span>
                              </button>
                            )}

                            {/* Restablecer Contraseña */}
                            <button
                              onClick={() => setSelectedUserForReset(user)}
                              className="inline-flex items-center text-blue-600 hover:text-blue-900 font-semibold cursor-pointer"
                              title="Restablecer o generar contraseña temporal"
                            >
                              <KeyRound className="h-4 w-4 mr-1 text-blue-600" />
                              <span>Clave</span>
                            </button>

                            {/* Eliminar */}
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-red-500 hover:text-red-700 inline-flex items-center cursor-pointer"
                              title="Eliminar usuario"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: SOLICITUDES DE REGISTRO */}
          {activeTab === 'solicitudes' && (
            <SolicitudesRegistroTab
              solicitudes={solicitudes}
              roles={roles}
              seccionales={seccionales}
              onRefresh={fetchData}
              remitenteNombre={remitenteNombre}
              remitenteCorreo={remitenteCorreo}
            />
          )}

          {/* TAB 3: ROLES Y PERMISOS */}
          {activeTab === 'roles' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-1">
                <div>
                  <h3 className="text-base font-bold tracking-tight text-gray-900">Permisos por Rol</h3>
                  <p className="text-2xs text-gray-400">
                    Define las capacidades y accesos globales de cada categoría institucional
                  </p>
                </div>
              </div>

              {/* Matriz de Permisos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {rolePermissions.map((rp) => (
                  <div key={rp.role} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
                    <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-900 block">
                          Rol: {rp.role}
                        </span>
                        <span className="text-3xs text-gray-400">
                          {rp.role === 'admin' ? 'Acceso administrativo total' : 'Acceso operativo restringido'}
                        </span>
                      </div>
                      {editingRole === rp.role ? (
                        <button
                          onClick={() => handleSavePermissions(rp.role)}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center hover:bg-emerald-700"
                        >
                          <Save className="w-3.5 h-3.5 mr-1" />
                          Guardar
                        </button>
                      ) : (
                        <button
                          onClick={() => startEditingRole(rp)}
                          className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold flex items-center hover:bg-gray-200"
                        >
                          <Edit className="w-3.5 h-3.5 mr-1" />
                          Editar
                        </button>
                      )}
                    </div>

                    <div className="mt-4 space-y-2.5 max-h-80 overflow-y-auto pr-1">
                      {Object.keys(permissionLabels).map((permKey) => {
                        const isGranted = editingRole === rp.role 
                          ? !!editedPermissions[permKey] 
                          : !!rp.permissions?.[permKey];

                        return (
                          <label key={permKey} className="flex items-center justify-between text-xs py-1 hover:bg-gray-50 px-2 rounded">
                            <span className="text-gray-700 font-medium">{permissionLabels[permKey]}</span>
                            <input
                              type="checkbox"
                              disabled={editingRole !== rp.role}
                              checked={isGranted}
                              onChange={() => togglePermission(permKey)}
                              className="rounded text-primary focus:ring-primary h-4 w-4 disabled:opacity-60"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: AJUSTES DE SEGURIDAD Y NOTIFICACIONES */}
          {activeTab === 'ajustes' && (
            <div className="space-y-6 max-w-3xl">
              
              {/* Card 1: Opciones Visuales y de Acceso en Login (iOS Switches) */}
              <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">
                        Opciones de Acceso y Pantalla de Inicio
                      </h4>
                      <p className="text-xs text-gray-500">
                        Botones públicos y visualización de marcas institucionales
                      </p>
                    </div>
                  </div>

                  {ajustesSavedMessage && (
                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-lg text-2xs font-semibold flex items-center">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      Guardado
                    </span>
                  )}
                </div>

                <div className="divide-y divide-slate-100">
                  {/* Marca de Agua */}
                  <div className="p-4 sm:px-5 flex items-center justify-between">
                    <div className="pr-4">
                      <span className="text-xs font-semibold text-gray-900 block">Marca de Agua Institucional</span>
                      <span className="text-2xs text-gray-400 block mt-0.5">Muestra el sello oficial en el fondo de carnets y documentos</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={watermarkEnabled}
                        onChange={handleToggleWatermark}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>

                  {/* Botón Solicitar Carnet en Login */}
                  <div className="p-4 sm:px-5 flex items-center justify-between">
                    <div className="pr-4">
                      <span className="text-xs font-semibold text-gray-900 block">Botón «Solicitar Carnet» en Login</span>
                      <span className="text-2xs text-gray-400 block mt-0.5">Acceso público rápido para solicitudes externas</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={loginShowSolicitar}
                        onChange={handleToggleLoginSolicitar}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>

                  {/* Botón Verificar Carnet en Login */}
                  <div className="p-4 sm:px-5 flex items-center justify-between">
                    <div className="pr-4">
                      <span className="text-xs font-semibold text-gray-900 block">Botón «Verificar Carnet» en Login</span>
                      <span className="text-2xs text-gray-400 block mt-0.5">Acceso público para validación de códigos QR</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={loginShowVerificar}
                        onChange={handleToggleLoginVerificar}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                </div>

                <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={handleSaveAjustes}
                    disabled={savingAjustes || !hasAjustesChanges}
                    className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    {savingAjustes ? 'Guardando...' : 'Guardar Ajustes'}
                  </button>
                </div>
              </div>

              {/* Card 2: Remitente de Correo para Aprobaciones */}
              <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">
                        Remitente de Correos de Aprobación
                      </h4>
                      <p className="text-xs text-gray-500">
                        Identidad en correos de activación de cuenta y contraseñas
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAjustesPreview(!showAjustesPreview)}
                    className="inline-flex items-center px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-2xs font-semibold transition-all shadow-2xs"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1 text-slate-400" />
                    {showAjustesPreview ? 'Ocultar' : 'Vista Previa'}
                  </button>
                </div>

                {emailConfigSaved && (
                  <div className="m-5 mb-0 p-3 bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-medium rounded-xl flex items-center">
                    <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600 shrink-0" />
                    Configuración de correos guardada exitosamente.
                  </div>
                )}

                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-2xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                        Nombre del Remitente
                      </label>
                      <input
                        type="text"
                        value={remitenteNombre}
                        onChange={(e) => setRemitenteNombre(e.target.value)}
                        placeholder="Cruz Verde Salvadoreña"
                        className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-2xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                        Correo Institucional
                      </label>
                      <input
                        type="email"
                        value={remitenteCorreo}
                        onChange={(e) => setRemitenteCorreo(e.target.value)}
                        placeholder="notificaciones@cruzverdesv.org"
                        className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-2xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                      Asunto de Notificación
                    </label>
                    <input
                      type="text"
                      value={asuntoAprobacion}
                      onChange={(e) => setAsuntoAprobacion(e.target.value)}
                      placeholder="¡Tu cuenta ha sido aprobada! - Cruz Verde Salvadoreña"
                      className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveEmailConfig}
                    disabled={savingEmailConfig}
                    className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    {savingEmailConfig ? 'Guardando...' : 'Guardar Notificaciones'}
                  </button>
                </div>

                {/* Vista previa desplegable */}
                {showAjustesPreview && (
                  <div className="p-5 border-t border-slate-100 bg-slate-50/60">
                    <div 
                      className="bg-white p-4 rounded-xl shadow-xs border border-slate-200"
                      dangerouslySetInnerHTML={{
                        __html: generarHtmlCorreoAprobacion({
                          remitenteNombre,
                          remitenteCorreo,
                          destinatarioCorreo: 'ejemplo.usuario@cruzverdesv.org',
                          destinatarioNombre: 'Juan Carlos Pérez',
                          asunto: asuntoAprobacion,
                          seccionalNombre: 'Seccional Santa Ana',
                          rolAsignado: 'socorrista',
                          loginUrl: getOfficialLoginUrl()
                        })
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Card 3: Migraciones de Base de Datos (Estilo Apple Grouped Inset - Sin cajas negras ruidosas) */}
              <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">
                        Migraciones de Base de Datos
                      </h4>
                      <p className="text-xs text-gray-500">
                        Scripts SQL para actualización de esquemas en Supabase
                      </p>
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {/* Migración 18 */}
                  <div className="p-4 sm:px-5 flex items-center justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 text-2xs font-mono font-bold flex items-center justify-center shrink-0">
                        18
                      </span>
                      <div>
                        <span className="text-xs font-semibold text-gray-900 block">Solicitudes de Registro y Estado Activo</span>
                        <span className="text-3xs text-gray-400">Tabla solicitudes_registro y políticas de aprobación</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopySqlMigration}
                      className="inline-flex items-center px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-2xs font-semibold text-gray-700 transition-all cursor-pointer shadow-2xs shrink-0"
                    >
                      {sqlCopied ? <><Check className="w-3 h-3 mr-1 text-emerald-600" /> ¡Copiado!</> : <><Copy className="w-3 h-3 mr-1 text-slate-400" /> Copiar SQL</>}
                    </button>
                  </div>

                  {/* Migración 21 */}
                  <div className="p-4 sm:px-5 flex items-center justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 text-2xs font-mono font-bold flex items-center justify-center shrink-0">
                        21
                      </span>
                      <div>
                        <span className="text-xs font-semibold text-gray-900 block">Archivos Descargables y Anuncios</span>
                        <span className="text-3xs text-gray-400">Tablas public.archivos, public.anuncios y permiso can_upload_files</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopySqlMigration21}
                      className="inline-flex items-center px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-2xs font-semibold text-gray-700 transition-all cursor-pointer shadow-2xs shrink-0"
                    >
                      {sql21Copied ? <><Check className="w-3 h-3 mr-1 text-emerald-600" /> ¡Copiado!</> : <><Copy className="w-3 h-3 mr-1 text-slate-400" /> Copiar SQL</>}
                    </button>
                  </div>

                  {/* Migración 22 */}
                  <div className="p-4 sm:px-5 flex items-center justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 text-2xs font-mono font-bold flex items-center justify-center shrink-0">
                        22
                      </span>
                      <div>
                        <span className="text-xs font-semibold text-gray-900 block">Permisos Individuales por Usuario</span>
                        <span className="text-3xs text-gray-400">Columna custom_permissions JSONB en user_roles</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopySqlMigration22}
                      className="inline-flex items-center px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-2xs font-semibold text-gray-700 transition-all cursor-pointer shadow-2xs shrink-0"
                    >
                      {sql22Copied ? <><Check className="w-3 h-3 mr-1 text-indigo-600" /> ¡Copiado!</> : <><Copy className="w-3 h-3 mr-1 text-slate-400" /> Copiar SQL</>}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

      {/* MODAL RESET PASSWORD */}
      {selectedUserForReset && (
        <ResetPasswordModal
          user={selectedUserForReset}
          onClose={() => setSelectedUserForReset(null)}
          onSuccess={() => {
            fetchData();
          }}
          remitenteNombre={remitenteNombre}
          remitenteCorreo={remitenteCorreo}
        />
      )}

      {/* MODAL NUEVO USUARIO MANUAL (ESTILO APPLE) */}
      {showNewUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden my-8 border border-slate-200/80 animate-in zoom-in-95 duration-150">
            
            {/* Header Apple macOS Style */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
              <div className="flex items-center space-x-3.5">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center border border-slate-200/60 shadow-2xs">
                  <UserPlus className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 tracking-tight">
                    Crear Nuevo Usuario
                  </h3>
                  <p className="text-2xs text-gray-400">Alta de cuenta institucional o externa</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={resetNewUserModal} 
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleCreateUser}>
              <div className="p-6 space-y-4">
                {formError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2.5 rounded-xl text-xs">
                    {formError}
                  </div>
                )}

                <div className="space-y-4 text-xs">
                  
                  {/* Selector Segmentado de Tipo de Usuario (Apple Style) */}
                  <div>
                    <label className="block text-3xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Tipo de Cuenta</label>
                    <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setNewUserType('cruz_verde')}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          newUserType === 'cruz_verde'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Miembro Cruz Verde
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewUserType('externo');
                          setSocorristaData(null);
                        }}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          newUserType === 'externo'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Persona Externa
                      </button>
                    </div>
                  </div>

                  {newUserType === 'cruz_verde' && !socorristaData && (
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2">
                      <label className="block text-3xs font-medium text-gray-500 uppercase tracking-wider">Número de Carnet</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newUserCarnet}
                          onChange={handleCarnetChange}
                          maxLength={11}
                          className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 uppercase font-mono text-xs text-gray-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                          placeholder="CVS-0000-AA"
                        />
                        <button
                          type="button"
                          onClick={handleSearchCarnet}
                          disabled={searchLoading || !newUserCarnet}
                          className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-xl disabled:opacity-40 transition-all cursor-pointer shrink-0 shadow-xs"
                        >
                          {searchLoading ? 'Buscando...' : 'Buscar'}
                        </button>
                      </div>
                      {searchError && <p className="text-2xs text-rose-600">{searchError}</p>}
                    </div>
                  )}

                  {(newUserType === 'externo' || socorristaData) && (
                    <>
                      {socorristaData && (
                        <div className="bg-emerald-50/80 border border-emerald-200/80 p-3.5 rounded-2xl flex items-center justify-between">
                          <div>
                            <span className="text-3xs font-medium text-emerald-800 uppercase tracking-wider block">Socorrista Vinculado</span>
                            <p className="text-xs font-semibold text-emerald-950">{socorristaData.primer_nombre} {socorristaData.primer_apellido}</p>
                            <p className="text-2xs text-emerald-700 font-mono">Carnet: {socorristaData.carnet}</p>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-3xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Validado
                          </span>
                        </div>
                      )}

                      <div>
                        <label className="block text-3xs font-medium text-gray-500 uppercase tracking-wider mb-1">Correo Electrónico</label>
                        <input
                          type="email"
                          required
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                          placeholder="usuario@cruzverdesv.org"
                        />
                      </div>

                      {/* Método de Contraseña Segmentado Apple */}
                      <div>
                        <label className="block text-3xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Contraseña de Acceso</label>
                        <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 mb-2">
                          <button
                            type="button"
                            onClick={() => {
                              setPasswordOption('generated');
                              generatePassword();
                            }}
                            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              passwordOption === 'generated'
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Automática
                          </button>
                          <button
                            type="button"
                            onClick={() => setPasswordOption('manual')}
                            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              passwordOption === 'manual'
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Manual
                          </button>
                        </div>
                        
                        {passwordOption === 'manual' ? (
                          <input
                            type="password"
                            required
                            minLength={6}
                            placeholder="Mínimo 6 caracteres"
                            value={newUserPassword}
                            onChange={(e) => setNewUserPassword(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono text-gray-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                          />
                        ) : (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              readOnly
                              value={newUserPassword}
                              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-gray-900 outline-none"
                            />
                            <button
                              type="button"
                              onClick={generatePassword}
                              className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-2xs"
                            >
                              Regenerar
                            </button>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-3xs font-medium text-gray-500 uppercase tracking-wider mb-1">Rol en el Sistema</label>
                        <select
                          value={newUserRole}
                          onChange={(e) => setNewUserRole(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-gray-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all cursor-pointer"
                        >
                          {roles?.map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>

                      {/* Inset Checkbox Apple Style */}
                      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5">
                        <label className="flex items-center space-x-2.5 cursor-pointer">
                          <input
                            id="require-password-reset"
                            type="checkbox"
                            checked={newUserRequiresPasswordReset}
                            onChange={(e) => setNewUserRequiresPasswordReset(e.target.checked)}
                            className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 rounded"
                          />
                          <span className="text-2xs text-gray-700 font-medium leading-tight">
                            Obligar a cambiar la contraseña en su primer inicio de sesión
                          </span>
                        </label>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Footer Apple Modal */}
              <div className="bg-white px-6 py-3.5 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={resetNewUserModal}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingUser || (newUserType === 'cruz_verde' && !socorristaData)}
                  className="px-5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-all disabled:opacity-40 cursor-pointer"
                >
                  {creatingUser ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PERMISOS INDIVIDUALES */}
      {selectedUserForPermisos && (
        <PermisosIndividualesModal
          user={selectedUserForPermisos}
          roles={roles}
          rolePermissions={rolePermissions}
          permissionLabels={permissionLabels}
          onClose={() => setSelectedUserForPermisos(null)}
          onSave={handleSaveCustomPermissions}
        />
      )}

    </div>
  );
}
