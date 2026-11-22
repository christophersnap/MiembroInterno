import React, { useState, useEffect } from 'react';
import { 
  Shield, Save, Check, X, UserPlus, Trash2, Globe, 
  Building2, KeyRound, CheckCircle2, 
  AlertTriangle, Eye, Mail, Copy,
  Sliders, Database, Search, Pencil, ChevronDown, Plus
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { logActivity } from '../lib/logger';
import { useSettings } from '../contexts/SettingsContext';
import SolicitudesRegistroTab from '../components/accesos/SolicitudesRegistroTab';
import ResetPasswordModal from '../components/accesos/ResetPasswordModal';
import PermisosIndividualesModal from '../components/accesos/PermisosIndividualesModal';
import {
  generarTextoCorreoAprobacion,
  generarTextoCorreoCreacionUsuario,
  generarTextoCorreoConfirmacionEnlace,
} from '../lib/emailNotification';
import { getOfficialLoginUrl } from '../utils/appUrl';
import { getApiUrl, sendEmailNotification } from '../lib/api';
import { SQL_MIGRATION_47_TEXT } from '../utils/imageOptimizer';
import { SQL_MIGRATION_48_TEXT, SQL_MIGRATION_49_TEXT } from '../utils/conoceSocorrista';
import { SQL_MIGRATION_50_TEXT } from '../lib/soporte';
import { SQL_MIGRATION_51_TEXT } from '../utils/activityFormatter';
import { getElSalvadorIsoTimestamp } from '../utils/dateUtils';

export default function Accesos() {
  const { refreshSettings } = useSettings();
  const [activeTab, setActiveTab] = useState<'usuarios' | 'solicitudes' | 'roles' | 'ajustes'>('usuarios');
  const [loading, setLoading] = useState(true);
  
  // Usuarios state
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [seccionales, setSeccionales] = useState<any[]>([]);
  const [inactiveUserIds, setInactiveUserIds] = useState<string[]>([]);
  const [roleFilter, setRoleFilter] = useState<string>('todos');
  const [userSearch, setUserSearch] = useState<string>('');
  const [editingUserNameId, setEditingUserNameId] = useState<string | null>(null);
  const [editingUserNameValue, setEditingUserNameValue] = useState<string>('');
  
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
  const [newUserNombre, setNewUserNombre] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [passwordOption, setPasswordOption] = useState<'manual' | 'generated'>('manual');
  const [newUserRole, setNewUserRole] = useState('socorrista');
  const [copyFromUserId, setCopyFromUserId] = useState('');
  const [openPermisosAfterCreate, setOpenPermisosAfterCreate] = useState(false);
  const [newUserSendPlainEmail, setNewUserSendPlainEmail] = useState(true);
  const [newUserAutoConfirmEmail, setNewUserAutoConfirmEmail] = useState(true);
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
  const [sql31Copied, setSql31Copied] = useState(false);
  const [sql42Copied, setSql42Copied] = useState(false);
  const [sql43Copied, setSql43Copied] = useState(false);
  const [sql44Copied, setSql44Copied] = useState(false);
  const [sql45Copied, setSql45Copied] = useState(false);
  const [sql46Copied, setSql46Copied] = useState(false);
  const [sql47Copied, setSql47Copied] = useState(false);
  const [sql48Copied, setSql48Copied] = useState(false);
  const [sql49Copied, setSql49Copied] = useState(false);
  const [sql50Copied, setSql50Copied] = useState(false);
  const [sql51Copied, setSql51Copied] = useState(false);
  const [usingLegacyExposedView, setUsingLegacyExposedView] = useState(false);
  const [sendingConfirmUserId, setSendingConfirmUserId] = useState<string | null>(null);
  const [showOlderMigrations, setShowOlderMigrations] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [linkingCarnetUserId, setLinkingCarnetUserId] = useState<string | null>(null);
  const [linkingCarnetValue, setLinkingCarnetValue] = useState<string>('');
  const [selectedRoleTab, setSelectedRoleTab] = useState<string>('director');
  const [rolePermSearch, setRolePermSearch] = useState<string>('');
  const [savingRolePerms, setSavingRolePerms] = useState<boolean>(false);
  const [showCreateRoleModal, setShowCreateRoleModal] = useState<boolean>(false);
  const [newRoleName, setNewRoleName] = useState<string>('');
  const [newRoleCopyFrom, setNewRoleCopyFrom] = useState<string>('');
  const [creatingRole, setCreatingRole] = useState<boolean>(false);
  const [createRoleError, setCreateRoleError] = useState<string>('');
  const [deletingRole, setDeletingRole] = useState<boolean>(false);

  const notifyStatus = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusNotice({ type, text });
    setTimeout(() => {
      setStatusNotice((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  const hasAjustesChanges = watermarkEnabled !== originalAjustes.watermark || 
                            loginShowSolicitar !== originalAjustes.loginSolicitar || 
                            loginShowVerificar !== originalAjustes.loginVerificar;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Consultar directorio de usuarios mediante RPC protegida (Migración 46 - evita exponer auth.users en una vista pública)
      let directoryData: any[] | null = null;
      let directoryLoaded = false;

      const { data: rpcUsers, error: rpcError } = await supabase.rpc('get_usuarios_directory');
      if (!rpcError && Array.isArray(rpcUsers)) {
        directoryData = rpcUsers;
        directoryLoaded = true;
        setUsingLegacyExposedView(false);
      } else {
        // Respaldo temporal solo si aún no se ha ejecutado la Migración 46 en Supabase
        const { data: legacyViewData, error: legacyViewError } = await supabase
          .from('usuarios_view')
          .select('*');
        if (!legacyViewError && Array.isArray(legacyViewData)) {
          directoryData = legacyViewData;
          directoryLoaded = true;
          setUsingLegacyExposedView(true);
        } else {
          setUsingLegacyExposedView(false);
        }
      }

      let usersData: any[] | null = null;
      let usersError: any = null;

      const resCustom = await supabase
        .from('user_roles')
        .select(`
          id,
          role,
          socorrista_id,
          nombre_completo,
          nombre_usuario,
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
        // Fallback without custom_permissions or nombre_usuario column
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
      if (directoryLoaded && directoryData) {
        mergedUsers = mergedUsers.map(u => {
          const dirUser = directoryData!.find(v => v.id === u.id);
          const viewName =
            String(dirUser?.nombre_usuario || dirUser?.nombre_completo || '').trim() ||
            (dirUser?.primer_nombre &&
            dirUser?.email &&
            dirUser.primer_nombre !== dirUser.email.split('@')[0]
              ? `${dirUser.primer_nombre} ${dirUser.primer_apellido || ''}`.trim()
              : '');
          return {
            ...u,
            email: dirUser?.email || 'Email no disponible',
            view_nombre: viewName,
            email_confirmed_at: dirUser?.email_confirmed_at || dirUser?.confirmed_at || null,
          };
        });
      } else {
        mergedUsers = mergedUsers.map(u => ({ ...u, email: 'Ejecute Migración 46 SQL' }));
      }

      setUsuarios(mergedUsers);

      // 2. Fetch role permissions
      const { data: rolesData, error: rolesError } = await supabase
        .from('role_permissions')
        .select('*');
      
      if (!rolesError && rolesData) {
        setRolePermissions(rolesData || []);
        const loadedRoles = rolesData?.map(r => r.role) || ['admin', 'socorrista', 'instructor', 'director'];
        setRoles(loadedRoles);
        if (loadedRoles.length > 0 && !loadedRoles.includes(selectedRoleTab)) {
          setSelectedRoleTab(loadedRoles.find(r => r !== 'admin') || loadedRoles[0]);
        }
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

      // 5. Fetch solicitudes de registro (Multi-fuente garantizada)
      let combinedSolicitudes: any[] = [];
      const seenEmails = new Set<string>();

      // A. Desde tabla solicitudes_registro en Supabase
      try {
        const { data: solData, error: solError } = await supabase
          .from('solicitudes_registro')
          .select(`*, seccionales (id, nombre)`)
          .order('fecha_solicitud', { ascending: false });

        if (!solError && solData && solData.length > 0) {
          solData.forEach(s => {
            combinedSolicitudes.push(s);
            if (s.email) seenEmails.add(s.email.toLowerCase());
          });
        }
      } catch (errSol) {
        console.warn('Aviso leyendo tabla solicitudes_registro de Supabase:', errSol);
      }

      // B. Desde API backend /api/solicitudes-registro (SQLite/Servidor)
      try {
        const apiRes = await fetch(getApiUrl('/api/solicitudes-registro'));
        if (apiRes.ok) {
          const apiRows = await apiRes.json();
          if (Array.isArray(apiRows)) {
            apiRows.forEach(s => {
              if (s.email && !seenEmails.has(s.email.toLowerCase())) {
                const sec = secData?.find(x => x.id === s.seccional_id);
                combinedSolicitudes.push({
                  ...s,
                  seccionales: sec || (s.seccional_nombre ? { id: s.seccional_id, nombre: s.seccional_nombre } : undefined)
                });
                seenEmails.add(s.email.toLowerCase());
              }
            });
          }
        }
      } catch (errApi) {
        console.warn('Aviso leyendo /api/solicitudes-registro:', errApi);
      }

      // C. Desde respaldo en configuracion (clave solicitudes_registro_store)
      if (configData) {
        const storeRow = configData.find(r => r.clave === 'solicitudes_registro_store');
        if (storeRow?.valor) {
          try {
            const parsedStore = JSON.parse(storeRow.valor);
            if (Array.isArray(parsedStore)) {
              parsedStore.forEach(s => {
                if (s.email && !seenEmails.has(s.email.toLowerCase())) {
                  combinedSolicitudes.push(s);
                  seenEmails.add(s.email.toLowerCase());
                }
              });
            }
          } catch (e) {}
        }
      }

      // D. Fallback adicional: usuarios pendientes en user_roles
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
          fecha_solicitud: getElSalvadorIsoTimestamp(),
        }));

      pendingUsers.forEach(pu => {
        if (pu.email && !seenEmails.has(pu.email.toLowerCase())) {
          combinedSolicitudes.push(pu);
          seenEmails.add(pu.email.toLowerCase());
        }
      });

      // Sincronizar estados: si el usuario ya tiene un rol activo o asignado en user_roles (no pendiente ni inactivo), marcar su solicitud como aprobada
      const activeUserEmails = new Set(
        (mergedUsers || [])
          .filter((u: any) => u.email && u.role && u.role !== 'pendiente' && u.role !== 'inactivo' && u.estado !== 'pendiente' && u.estado !== 'inactivo')
          .map((u: any) => u.email.toLowerCase())
      );

      combinedSolicitudes = combinedSolicitudes.map(s => {
        if (s.email && activeUserEmails.has(s.email.toLowerCase()) && s.estado === 'pendiente') {
          return { ...s, estado: 'aprobado' };
        }
        return s;
      });

      setSolicitudes(combinedSolicitudes);

    } catch (error) {
      console.error('Error fetching accesos data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Callback para actualizar el estado de una solicitud inmediatamente en la interfaz
  const handleSolicitudProcessed = (solId: string, email: string, nuevoEstado: 'aprobado' | 'rechazado' | 'eliminado') => {
    setSolicitudes(prev => {
      if (nuevoEstado === 'eliminado') {
        return prev.filter(s => s.id !== solId && s.email?.toLowerCase() !== email?.toLowerCase());
      }
      return prev.map(s => {
        if (s.id === solId || (s.email && email && s.email.toLowerCase() === email.toLowerCase())) {
          return { ...s, estado: nuevoEstado, fecha_revision: getElSalvadorIsoTimestamp() };
        }
        return s;
      });
    });
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
        {
          nombre_usuario: getUserDisplayName(targetUser),
          usuario: targetUser.email,
          nuevo_estado: newActiveState ? 'activo' : 'inactivo',
        }
      );

      notifyStatus(`Usuario ${newActiveState ? 'activado' : 'desactivado'} con éxito.`);
    } catch (err: any) {
      console.error('Error al alternar estado activo del usuario:', err);
      notifyStatus(`Error: ${err.message}`, 'error');
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

  const getUserDisplayName = (u: any) => {
    const explicit = String(u?.nombre_usuario || u?.nombre_completo || '').trim();
    if (explicit) return explicit;
    if (u?.socorristas) {
      const full = `${u.socorristas.primer_nombre || ''} ${u.socorristas.primer_apellido || ''}`.trim();
      if (full) return full;
    }
    if (u?.view_nombre && String(u.view_nombre).trim()) {
      return String(u.view_nombre).trim();
    }
    return 'Usuario sin perfil';
  };

  const handleSaveUserName = async (targetUser: any) => {
    const trimmed = editingUserNameValue.trim();
    if (!trimmed) {
      setEditingUserNameId(null);
      return;
    }
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ nombre_usuario: trimmed, nombre_completo: trimmed })
        .eq('id', targetUser.id);

      if (error) {
        await supabase
          .from('user_roles')
          .update({ nombre_completo: trimmed })
          .eq('id', targetUser.id);
      }

      setUsuarios(prev =>
        prev.map(u =>
          u.id === targetUser.id
            ? { ...u, nombre_usuario: trimmed, nombre_completo: trimmed }
            : u
        )
      );
      await logActivity('Actualizó nombre de usuario', 'Usuario', targetUser.id, {
        nombre_usuario: trimmed,
        email: targetUser.email
      });
    } catch (err) {
      console.error('Error actualizando nombre de usuario:', err);
      notifyStatus('No se pudo guardar el nombre del usuario.', 'error');
    } finally {
      setEditingUserNameId(null);
      setEditingUserNameValue('');
    }
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
        const fullSocName = `${data.primer_nombre || ''} ${data.primer_apellido || ''}`.trim();
        if (fullSocName) {
          setNewUserNombre(fullSocName);
        }
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
    setNewUserNombre('');
    setNewUserEmail('');
    setNewUserPassword('');
    setPasswordOption('manual');
    setNewUserRole('socorrista');
    setCopyFromUserId('');
    setOpenPermisosAfterCreate(false);
    setNewUserSendPlainEmail(true);
    setNewUserAutoConfirmEmail(true);
    setNewUserRequiresPasswordReset(true);
    setShowNewUserModal(false);
    setSearchError('');
    setFormError('');
  };

  const handleCopyUserTemplateChange = (sourceId: string) => {
    setCopyFromUserId(sourceId);
    if (!sourceId) return;
    const tplUser = usuarios.find(u => u.id === sourceId);
    if (tplUser?.role && tplUser.role !== 'inactivo' && tplUser.role !== 'pendiente') {
      setNewUserRole(tplUser.role);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const trimmedNombre = newUserNombre.trim();
    if (!trimmedNombre) {
      setFormError('El nombre de usuario es requerido para poder identificarlo en la lista.');
      return;
    }
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

      // Preparar permisos copiados si seleccionó usuario plantilla
      const templateUser = copyFromUserId ? usuarios.find(u => u.id === copyFromUserId) : null;
      const copiedCustomPermissions = templateUser?.custom_permissions
        ? JSON.parse(JSON.stringify(templateUser.custom_permissions))
        : {};
      const copiedCanUploadFiles = Boolean(templateUser?.can_upload_files);

      // 1. Intentar creación directa en SQL (admin_create_user) -> evita por completo "email rate limit exceeded" de Supabase Auth
      let newUserId: string | undefined;
      let confirmedViaSql = false;
      let confirmationToken: string | null = null;
      let createdDirectSql = false;

      const { data: rpcCreateData, error: rpcCreateError } = await supabase.rpc('admin_create_user', {
        p_email: newUserEmail.trim(),
        p_password: newUserPassword,
        p_nombre_usuario: trimmedNombre,
        p_role: newUserRole,
        p_socorrista_id: socorristaId,
        p_can_upload_files: copiedCanUploadFiles,
        p_custom_permissions: copiedCustomPermissions,
        p_requires_password_reset: newUserRequiresPasswordReset,
        p_auto_confirm: newUserAutoConfirmEmail,
      });

      if (!rpcCreateError && rpcCreateData?.user_id) {
        createdDirectSql = true;
        newUserId = rpcCreateData.user_id;
        confirmedViaSql = Boolean(rpcCreateData.auto_confirmed);
        confirmationToken = rpcCreateData.confirmation_token || null;
      } else if (
        rpcCreateError &&
        !String(rpcCreateError.message || '').toLowerCase().includes('function') &&
        !String(rpcCreateError.message || '').toLowerCase().includes('does not exist') &&
        !String(rpcCreateError.code || '').includes('42883') &&
        !String(rpcCreateError.code || '').includes('PGRST202')
      ) {
        // Error real de validación (ej: correo ya existe, contraseña corta, acceso denegado)
        throw rpcCreateError;
      } else {
        // Fallback clásico si Migración 43 aún no ha sido ejecutada en Supabase
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
          email: newUserEmail.trim(),
          password: newUserPassword,
          options: {
            data: {
              full_name: trimmedNombre,
              nombre_completo: trimmedNombre,
              nombre_usuario: trimmedNombre,
            },
            emailRedirectTo: getOfficialLoginUrl(),
          }
        });

        if (authError) {
          if (String(authError.message || '').toLowerCase().includes('rate limit')) {
            throw new Error(
              'Límite de correos de Supabase alcanzado ("email rate limit exceeded"). Para crear usuarios ilimitados enviando desde ' +
              remitenteCorreo +
              ', ejecuta la Migración 43 en Supabase SQL Editor (puedes copiarla en Ajustes del Sistema -> Migraciones).'
            );
          }
          throw authError;
        }

        newUserId = authData.user?.id;
        if (!newUserId) {
          throw new Error('No se pudo obtener el ID del usuario creado. Es posible que el correo ya esté registrado.');
        }

        const insertPayload: Record<string, any> = {
          id: newUserId,
          role: newUserRole,
          activo: true,
          estado: 'activo',
          socorrista_id: socorristaId,
          nombre_completo: trimmedNombre,
          nombre_usuario: trimmedNombre,
          can_upload_files: copiedCanUploadFiles,
          custom_permissions: copiedCustomPermissions,
          requires_password_reset: newUserRequiresPasswordReset,
        };

        const { error: roleError } = await supabase
          .from('user_roles')
          .upsert(insertPayload);

        if (roleError) {
          const { error: fallbackErr } = await supabase
            .from('user_roles')
            .upsert({
              id: newUserId,
              role: newUserRole,
              activo: true,
              estado: 'activo',
              socorrista_id: socorristaId,
              nombre_completo: trimmedNombre,
              can_upload_files: copiedCanUploadFiles,
              requires_password_reset: newUserRequiresPasswordReset,
            });
          if (fallbackErr) throw fallbackErr;
        }

        confirmedViaSql = Boolean(authData.session);
        if (newUserAutoConfirmEmail && !confirmedViaSql) {
          try {
            const { data: confirmOk, error: confirmErr } = await supabase.rpc('admin_confirm_user_email', {
              target_user_id: newUserId
            });
            if (!confirmErr && confirmOk !== false) {
              confirmedViaSql = true;
            }
          } catch (confirmEx) {
            console.warn('RPC admin_confirm_user_email no disponible aún:', confirmEx);
          }
        }
      }

      if (!newUserId) {
        throw new Error('No se pudo completar la creación del usuario.');
      }

      // 2. Enviar correo de bienvenida / confirmación en TEXTO PLANO vía notificaciones@cruzverdesv.org
      let plainEmailSent = false;
      const confirmUrl = (!confirmedViaSql && confirmationToken)
        ? `${getOfficialLoginUrl()}?confirm_token=${encodeURIComponent(confirmationToken)}`
        : undefined;

      if (newUserSendPlainEmail || confirmUrl) {
        try {
          const seccionalObj = socorristaData?.seccional_id
            ? seccionales.find(s => s.id === socorristaData.seccional_id)
            : null;
          const textoCorreo = generarTextoCorreoCreacionUsuario({
            remitenteNombre,
            remitenteCorreo,
            destinatarioCorreo: newUserEmail.trim(),
            destinatarioNombre: trimmedNombre,
            rolAsignado: newUserRole,
            temporalPassword: newUserPassword,
            requiereCambioPassword: newUserRequiresPasswordReset,
            seccionalNombre: seccionalObj?.nombre,
            cuentaConfirmada: confirmedViaSql,
            confirmUrl,
            loginUrl: getOfficialLoginUrl(),
          });

          await sendEmailNotification({
            remitente: `${remitenteNombre} <${remitenteCorreo}>`,
            destinatario: newUserEmail.trim(),
            asunto: confirmUrl
              ? 'Confirmacion y datos de cuenta - Cruz Verde Salvadorena'
              : 'Creacion de cuenta - Cruz Verde Salvadorena',
            cuerpoTexto: textoCorreo,
            soloTextoPlano: true,
            tipo: 'creacion_usuario'
          });
          plainEmailSent = true;
        } catch (mailErr) {
          console.warn('No se pudo enviar correo en texto plano al crear usuario:', mailErr);
        }
      }
      
      await logActivity('Creó nuevo usuario', 'Usuario', newUserId, {
        nombre_usuario: trimmedNombre,
        email: newUserEmail.trim(),
        rol: newUserRole,
        carnet: newUserCarnet,
        copiado_de: templateUser?.email || null,
        creado_sql_directo: createdDirectSql,
        correo_plano_enviado: plainEmailSent,
      });
      
      const shouldOpenPermisos = openPermisosAfterCreate;
      const createdPreviewUser = {
        id: newUserId,
        email: newUserEmail.trim(),
        nombre_usuario: trimmedNombre,
        nombre_completo: trimmedNombre,
        role: newUserRole,
        activo: true,
        estado: 'activo',
        socorrista_id: socorristaId,
        socorristas: socorristaData || null,
        can_upload_files: copiedCanUploadFiles,
        custom_permissions: copiedCustomPermissions,
        requires_password_reset: newUserRequiresPasswordReset,
      };

      resetNewUserModal();
      await fetchData();
      if (shouldOpenPermisos) {
        setSelectedUserForPermisos(createdPreviewUser);
      } else {
        notifyStatus(
          confirmUrl && plainEmailSent
            ? `Usuario creado. Se envió el enlace de confirmación desde ${remitenteCorreo}.`
            : plainEmailSent
              ? `Usuario creado y notificación enviada desde ${remitenteCorreo}.`
              : 'Usuario creado exitosamente.'
        );
      }
      
    } catch (error: any) {
      console.error('Error creating user:', error);
      setFormError(error.message || 'Ocurrió un error al crear el usuario.');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleSendConfirmationLink = async (targetUser: any) => {
    if (!targetUser?.id || !targetUser?.email) return;
    setSendingConfirmUserId(targetUser.id);
    try {
      const { data, error } = await supabase.rpc('admin_generar_token_confirmacion', {
        target_user_id: targetUser.id,
      });

      if (error || !data?.confirmation_token) {
        // Fallback: intentar confirmar directamente con admin_confirm_user_email si Migración 43 no está aplicada
        const { data: confirmed, error: confirmErr } = await supabase.rpc('admin_confirm_user_email', {
          target_user_id: targetUser.id,
        });
        if (confirmErr || !confirmed) {
          throw new Error(
            'Para enviar enlaces de confirmación vía ' +
            remitenteCorreo +
            ', ejecuta la Migración 43 en Supabase SQL Editor (Ajustes del Sistema -> Migraciones).'
          );
        }
        await fetchData();
        notifyStatus(`El correo de ${targetUser.email} fue confirmado en la base de datos.`);
        return;
      }

      const confirmUrl = `${getOfficialLoginUrl()}?confirm_token=${encodeURIComponent(data.confirmation_token)}`;
      const texto = generarTextoCorreoConfirmacionEnlace({
        remitenteNombre,
        remitenteCorreo,
        destinatarioCorreo: targetUser.email,
        destinatarioNombre: getUserDisplayName(targetUser),
        confirmUrl,
      });

      await sendEmailNotification({
        remitente: `${remitenteNombre} <${remitenteCorreo}>`,
        destinatario: targetUser.email,
        asunto: 'Confirma tu correo electronico - Cruz Verde Salvadorena',
        cuerpoTexto: texto,
        soloTextoPlano: true,
        tipo: 'confirmacion_correo',
      });

      notifyStatus(`Enlace de confirmación enviado a ${targetUser.email}.`);
    } catch (err: any) {
      console.error('Error enviando enlace de confirmación:', err);
      notifyStatus(err.message || 'No se pudo enviar el enlace de confirmación.', 'error');
    } finally {
      setSendingConfirmUserId(null);
    }
  };

  const handleSaveLinkedCarnet = async (userId: string) => {
    const cleanCarnet = linkingCarnetValue.trim().toUpperCase();
    try {
      let socorristaId = null;
      if (cleanCarnet !== '') {
        const { data: socData, error: socError } = await supabase
          .from('socorristas')
          .select('id')
          .eq('carnet', cleanCarnet)
          .single();

        if (socError || !socData) {
          throw new Error(`No se encontró ningún socorrista con el carnet ${cleanCarnet}`);
        }
        socorristaId = socData.id;
      }

      const { error } = await supabase
        .from('user_roles')
        .update({ socorrista_id: socorristaId })
        .eq('id', userId);

      if (error) throw error;

      const targetUsrForCarnet = usuarios.find((u) => u.id === userId);
      await logActivity('Vinculó carnet a usuario', 'Usuario', userId, {
        nombre_usuario: targetUsrForCarnet ? getUserDisplayName(targetUsrForCarnet) : undefined,
        email: targetUsrForCarnet?.email,
        carnet: cleanCarnet,
      });
      setLinkingCarnetUserId(null);
      setLinkingCarnetValue('');
      fetchData();
      notifyStatus(cleanCarnet ? 'Carnet vinculado exitosamente.' : 'Vínculo de carnet removido.');
    } catch (error: any) {
      console.error('Error linking carnet:', error);
      notifyStatus(error.message || 'Error al vincular carnet.', 'error');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este usuario permanentemente? Esta acción no se puede deshacer.')) {
      return;
    }
    
    try {
      const targetUsr = usuarios.find((u) => u.id === userId);
      const { error } = await supabase.rpc('delete_user', { target_user_id: userId });
      
      if (error) {
        console.warn('RPC delete_user falló, desactivando usuario:', error);
        await supabase.from('user_roles').update({ role: 'inactivo', activo: false, estado: 'inactivo' }).eq('id', userId);
        await logActivity('Desactivó cuenta de usuario', 'Usuario', userId, {
          nombre_usuario: targetUsr ? getUserDisplayName(targetUsr) : undefined,
          usuario: targetUsr?.email,
          nuevo_estado: 'inactivo',
        });
        notifyStatus('El usuario ha sido desactivado permanentemente.');
        fetchData();
      } else {
        await logActivity('Eliminó usuario', 'Usuario', userId, {
          nombre_usuario: targetUsr ? getUserDisplayName(targetUsr) : undefined,
          email: targetUsr?.email,
          rol: targetUsr?.role,
        });
        setUsuarios(usuarios.filter(u => u.id !== userId));
        notifyStatus('Usuario eliminado correctamente.');
      }
    } catch (error: any) {
      console.error('Error deleting user:', error);
      notifyStatus('Error al intentar eliminar el usuario.', 'error');
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const targetUsr = usuarios.find((u) => u.id === userId);
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
      
      await logActivity('Cambió rol de usuario', 'Usuario', userId, {
        nombre_usuario: targetUsr ? getUserDisplayName(targetUsr) : undefined,
        email: targetUsr?.email,
        rol_anterior: targetUsr?.role,
        nuevo_rol: newRole,
      });
      notifyStatus(`Rol actualizado a ${newRole}.`);
    } catch (error) {
      console.error('Error updating role:', error);
      notifyStatus('Error al actualizar el rol.', 'error');
    }
  };

  const handleSaveCustomPermissions = async (
    targetUserId: string, 
    updatedCustomPermissions: Record<string, any>, 
    updatedCanUploadFiles: boolean,
    updatedRole?: string
  ) => {
    try {
      const targetUsr = usuarios.find((u) => u.id === targetUserId);
      const updatePayload: Record<string, any> = {
        custom_permissions: updatedCustomPermissions,
        can_upload_files: updatedCanUploadFiles,
      };
      if (updatedRole) {
        updatePayload.role = updatedRole;
        updatePayload.activo = updatedRole !== 'inactivo' && updatedRole !== 'pendiente';
        updatePayload.estado = updatedRole === 'inactivo' ? 'inactivo' : (updatedRole === 'pendiente' ? 'pendiente' : 'activo');
      }

      const { error } = await supabase
        .from('user_roles')
        .update(updatePayload)
        .eq('id', targetUserId);

      if (error) {
        console.warn('Advertencia en Supabase (la columna custom_permissions puede requerir migración 22):', error);
        const fallbackUpdate: Record<string, any> = { can_upload_files: updatedCanUploadFiles };
        if (updatedRole) {
          fallbackUpdate.role = updatedRole;
        }
        await supabase
          .from('user_roles')
          .update(fallbackUpdate)
          .eq('id', targetUserId);
      }

      setUsuarios(prev => prev.map(u => {
        if (u.id === targetUserId) {
          return {
            ...u,
            custom_permissions: updatedCustomPermissions,
            can_upload_files: updatedCanUploadFiles,
            ...(updatedRole
              ? {
                  role: updatedRole,
                  activo: updatedRole !== 'inactivo' && updatedRole !== 'pendiente',
                  estado: updatedRole === 'inactivo' ? 'inactivo' : (updatedRole === 'pendiente' ? 'pendiente' : 'activo'),
                }
              : {}),
          };
        }
        return u;
      }));

      await logActivity('Actualizó accesos individuales', 'Usuario', targetUserId, {
        nombre_usuario: targetUsr ? getUserDisplayName(targetUsr) : undefined,
        email: targetUsr?.email,
        custom_permissions: updatedCustomPermissions,
        can_upload_files: updatedCanUploadFiles,
        ...(updatedRole ? { nuevo_rol: updatedRole } : {}),
      });

      notifyStatus('Accesos del usuario guardados exitosamente.');
    } catch (err) {
      console.error('Error al guardar accesos individuales:', err);
      notifyStatus('Error al guardar los accesos del usuario.', 'error');
    }
  };

  const handleSavePermissions = async (role: string) => {
    setSavingRolePerms(true);
    try {
      const { error } = await supabase
        .from('role_permissions')
        .update({ permissions: editedPermissions })
        .eq('role', role);
      
      if (error) throw error;
      
      setRolePermissions(rolePermissions.map(rp => rp.role === role ? { ...rp, permissions: editedPermissions } : rp));
      setEditingRole(null);
      await logActivity('Actualizó permisos de rol', 'Rol', role, { rol: role, permisos: editedPermissions });
      notifyStatus(`Permisos del rol ${role} guardados.`);
    } catch (error) {
      console.error('Error updating permissions:', error);
      notifyStatus('Error al actualizar permisos del rol.', 'error');
    } finally {
      setSavingRolePerms(false);
    }
  };

  const CORE_SYSTEM_ROLES = ['admin', 'socorrista', 'director', 'instructor'];

  const normalizeRoleSlug = (raw: string): string => {
    return raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateRoleError('');

    const slug = normalizeRoleSlug(newRoleName);
    if (!slug || slug.length < 2) {
      setCreateRoleError('Ingresa un nombre válido de al menos 2 caracteres.');
      return;
    }
    if (slug === 'inactivo' || slug === 'pendiente') {
      setCreateRoleError('Ese nombre está reservado por el sistema.');
      return;
    }
    if (rolePermissions.some((rp) => rp.role.toLowerCase() === slug)) {
      setCreateRoleError(`El rol «${slug}» ya existe.`);
      return;
    }

    setCreatingRole(true);
    try {
      let basePermissions: Record<string, boolean> = {
        view_dashboard: true,
        view_directorio: true,
        view_anuncios: true,
        view_archivos: true,
        view_soporte: true,
        crear_soporte: true,
      };

      if (newRoleCopyFrom) {
        const sourceRole = rolePermissions.find((rp) => rp.role === newRoleCopyFrom);
        if (sourceRole?.permissions) {
          basePermissions = { ...sourceRole.permissions };
        }
      }

      const { data: inserted, error } = await supabase
        .from('role_permissions')
        .insert([{ role: slug, permissions: basePermissions }])
        .select()
        .single();

      if (error) {
        if (error.code === '42501' || String(error.message || '').toLowerCase().includes('policy')) {
          throw new Error(
            'No tienes permiso en Supabase para insertar roles. Ejecuta la Migración 51 en Ajustes -> Migraciones SQL.'
          );
        }
        throw error;
      }

      const newRoleRecord = inserted || { role: slug, permissions: basePermissions };
      setRolePermissions((prev) => [...prev, newRoleRecord]);
      setRoles((prev) => (prev.includes(slug) ? prev : [...prev, slug]));
      setSelectedRoleTab(slug);
      setEditingRole(null);
      setEditedPermissions({});
      setShowCreateRoleModal(false);
      setNewRoleName('');
      setNewRoleCopyFrom('');

      await logActivity('Creó nuevo rol', 'Rol', slug, {
        rol: slug,
        basado_en: newRoleCopyFrom || 'Permisos básicos',
        cantidad_permisos_activos: Object.values(basePermissions).filter(Boolean).length,
      });

      notifyStatus(`Rol «${slug}» creado correctamente. Ya puedes ajustar sus permisos.`);
    } catch (err: any) {
      console.error('Error creando rol:', err);
      setCreateRoleError(err.message || 'No se pudo crear el rol.');
    } finally {
      setCreatingRole(false);
    }
  };

  const handleDeleteCustomRole = async (roleKey: string) => {
    if (CORE_SYSTEM_ROLES.includes(roleKey)) return;
    const assignedCount = usuarios.filter((u) => u.role === roleKey).length;
    if (assignedCount > 0) {
      notifyStatus(
        `No se puede eliminar «${roleKey}» porque tiene ${assignedCount} usuario(s) asignado(s).`,
        'error'
      );
      return;
    }
    if (!window.confirm(`¿Eliminar el rol personalizado «${roleKey}»?`)) return;

    setDeletingRole(true);
    try {
      const { error } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role', roleKey);

      if (error) throw error;

      const remaining = rolePermissions.filter((rp) => rp.role !== roleKey);
      setRolePermissions(remaining);
      setRoles((prev) => prev.filter((r) => r !== roleKey));
      if (selectedRoleTab === roleKey) {
        setSelectedRoleTab(remaining[0]?.role || 'director');
      }
      if (editingRole === roleKey) {
        setEditingRole(null);
        setEditedPermissions({});
      }

      await logActivity('Eliminó rol personalizado', 'Rol', roleKey, { rol: roleKey });
      notifyStatus(`Rol «${roleKey}» eliminado.`);
    } catch (err: any) {
      console.error('Error eliminando rol:', err);
      notifyStatus(
        err.message || 'Error al eliminar el rol. Verifica haber ejecutado Migración 51.',
        'error'
      );
    } finally {
      setDeletingRole(false);
    }
  };

  const handleToggleRolePermDirect = (roleItem: any, key: string) => {
    const basePerms = editingRole === roleItem.role ? editedPermissions : (roleItem.permissions || {});
    const updated = {
      ...basePerms,
      [key]: !basePerms[key],
    };
    setEditingRole(roleItem.role);
    setEditedPermissions(updated);
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
      notifyStatus('Error al guardar configuración de correo.', 'error');
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

  const handleCopySqlMigration31 = () => {
    const sqlText = `-- =========================================================================================
-- MIGRACIÓN 31: PERMISOS GRANULARES POR SECCIONAL, ALCANCES Y SOLICITUDES DE CARNET
-- =========================================================================================
ALTER TABLE IF EXISTS public.user_roles
  ADD COLUMN IF NOT EXISTS custom_permissions JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS can_upload_files BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'activo';

ALTER TABLE IF EXISTS public.solicitudes_carnet
  ADD COLUMN IF NOT EXISTS seccional_id INTEGER REFERENCES public.seccionales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seccional_nombre TEXT,
  ADD COLUMN IF NOT EXISTS observaciones TEXT,
  ADD COLUMN IF NOT EXISTS solicitado_por TEXT,
  ADD COLUMN IF NOT EXISTS solicitado_por_email TEXT,
  ADD COLUMN IF NOT EXISTS revisado_por TEXT,
  ADD COLUMN IF NOT EXISTS fecha_revision TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
DECLARE constraint_rec RECORD;
BEGIN
  FOR constraint_rec IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.solicitudes_carnet'::regclass
      AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%estado_solicitud%'
  LOOP
    EXECUTE format('ALTER TABLE public.solicitudes_carnet DROP CONSTRAINT IF EXISTS %I', constraint_rec.conname);
  END LOOP;
END $$;

ALTER TABLE public.solicitudes_carnet
  ADD CONSTRAINT solicitudes_carnet_estado_check
  CHECK (estado_solicitud IN ('Pendiente','En revisión','Observada','Aprobada','En impresión','Lista para entrega','Completada','Rechazada'));

NOTIFY pgrst, 'reload schema';`;

    navigator.clipboard.writeText(sqlText);
    setSql31Copied(true);
    setTimeout(() => setSql31Copied(false), 3000);
  };

  const handleCopySqlMigration42 = () => {
    const sqlText = `-- =========================================================================================
-- MIGRACIÓN 42: NOMBRE DE USUARIO EN ACCESOS, CONFIRMACIÓN Y RESETEO SEGURO POR ADMIN
-- =========================================================================================
ALTER TABLE IF EXISTS public.user_roles
  ADD COLUMN IF NOT EXISTS nombre_completo TEXT,
  ADD COLUMN IF NOT EXISTS nombre_usuario TEXT;

UPDATE public.user_roles
SET
  nombre_usuario = COALESCE(NULLIF(TRIM(nombre_usuario), ''), NULLIF(TRIM(nombre_completo), '')),
  nombre_completo = COALESCE(NULLIF(TRIM(nombre_completo), ''), NULLIF(TRIM(nombre_usuario), ''))
WHERE (nombre_usuario IS NULL OR TRIM(nombre_usuario) = '' OR nombre_completo IS NULL OR TRIM(nombre_completo) = '')
  AND (nombre_usuario IS NOT NULL OR nombre_completo IS NOT NULL);

UPDATE public.user_roles ur
SET
  nombre_usuario = COALESCE(
    NULLIF(TRIM(ur.nombre_usuario), ''),
    NULLIF(TRIM(ur.nombre_completo), ''),
    NULLIF(TRIM(src.socorrista_nombre), ''),
    NULLIF(TRIM(src.meta_nombre_usuario), ''),
    NULLIF(TRIM(src.meta_nombre_completo), ''),
    NULLIF(TRIM(src.meta_full_name), '')
  ),
  nombre_completo = COALESCE(
    NULLIF(TRIM(ur.nombre_completo), ''),
    NULLIF(TRIM(ur.nombre_usuario), ''),
    NULLIF(TRIM(src.socorrista_nombre), ''),
    NULLIF(TRIM(src.meta_nombre_completo), ''),
    NULLIF(TRIM(src.meta_full_name), ''),
    NULLIF(TRIM(src.meta_nombre_usuario), '')
  )
FROM (
  SELECT
    ur_inner.id AS role_id,
    NULLIF(TRIM(COALESCE(s.primer_nombre, '') || ' ' || COALESCE(s.primer_apellido, '')), '') AS socorrista_nombre,
    au.raw_user_meta_data ->> 'nombre_usuario' AS meta_nombre_usuario,
    au.raw_user_meta_data ->> 'nombre_completo' AS meta_nombre_completo,
    au.raw_user_meta_data ->> 'full_name' AS meta_full_name
  FROM public.user_roles ur_inner
  LEFT JOIN auth.users au ON au.id = ur_inner.id
  LEFT JOIN public.socorristas s ON s.id = ur_inner.socorrista_id
) src
WHERE ur.id = src.role_id
  AND (
    ur.nombre_usuario IS NULL OR TRIM(ur.nombre_usuario) = ''
    OR ur.nombre_completo IS NULL OR TRIM(ur.nombre_completo) = ''
  );

DROP VIEW IF EXISTS public.usuarios_view CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.admin_confirm_user_email(target_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF NOT (public.is_admin() OR (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com') THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;
  UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()), updated_at = NOW() WHERE id = target_user_id;
  RETURN FOUND;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_confirm_user_email(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reset_user_password(target_user_id UUID, new_password TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions AS $$
BEGIN
  IF NOT (public.is_admin() OR (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com') THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;
  IF new_password IS NULL OR length(trim(new_password)) < 6 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres';
  END IF;
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      updated_at = NOW()
  WHERE id = target_user_id;
  RETURN FOUND;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';`;

    navigator.clipboard.writeText(sqlText);
    setSql42Copied(true);
    setTimeout(() => setSql42Copied(false), 3000);
  };

  const handleCopySqlMigration43 = () => {
    const sqlText = `-- =========================================================================================
-- MIGRACIÓN 43: CREACIÓN DE USUARIOS Y ENLACES DE CONFIRMACIÓN SIN LÍMITE DE SUPABASE
-- =========================================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE IF EXISTS public.user_roles
  ADD COLUMN IF NOT EXISTS nombre_completo TEXT,
  ADD COLUMN IF NOT EXISTS nombre_usuario TEXT;

CREATE TABLE IF NOT EXISTS public.email_confirmation_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.email_confirmation_tokens ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email TEXT,
  p_password TEXT,
  p_nombre_usuario TEXT,
  p_role TEXT DEFAULT 'socorrista',
  p_socorrista_id INTEGER DEFAULT NULL,
  p_can_upload_files BOOLEAN DEFAULT false,
  p_custom_permissions JSONB DEFAULT '{}'::jsonb,
  p_requires_password_reset BOOLEAN DEFAULT false,
  p_auto_confirm BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_email TEXT;
  v_nombre TEXT;
  v_role TEXT;
  v_user_id UUID;
  v_token TEXT := NULL;
BEGIN
  IF NOT (
    public.is_admin()
    OR (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE id = auth.uid()
        AND (role IN ('admin', 'superadmin') OR (custom_permissions ->> 'perm_accesos') = 'true')
    )
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores pueden crear usuarios.';
  END IF;

  v_email := lower(trim(COALESCE(p_email, '')));
  v_nombre := trim(COALESCE(p_nombre_usuario, ''));
  v_role := COALESCE(NULLIF(trim(p_role), ''), 'socorrista');

  IF v_email = '' OR position('@' IN v_email) = 0 THEN
    RAISE EXCEPTION 'Debe ingresar un correo electrónico válido.';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres.';
  END IF;
  IF v_nombre = '' THEN
    v_nombre := split_part(v_email, '@', 1);
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) THEN
    RAISE EXCEPTION 'Este correo electrónico ya se encuentra registrado en el sistema.';
  END IF;

  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    CASE WHEN COALESCE(p_auto_confirm, true) THEN NOW() ELSE NULL END,
    '', '', '', '',
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object('full_name', v_nombre, 'nombre_completo', v_nombre, 'nombre_usuario', v_nombre, 'socorrista_id', p_socorrista_id),
    false, NOW(), NOW()
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', COALESCE(p_auto_confirm, true), 'phone_verified', false),
    'email', v_user_id::text, NOW(), NOW(), NOW()
  );

  INSERT INTO public.user_roles (
    id, role, activo, estado, socorrista_id, nombre_completo, nombre_usuario,
    can_upload_files, custom_permissions, requires_password_reset
  ) VALUES (
    v_user_id, v_role, true, 'activo', p_socorrista_id, v_nombre, v_nombre,
    COALESCE(p_can_upload_files, false), COALESCE(p_custom_permissions, '{}'::jsonb), COALESCE(p_requires_password_reset, false)
  )
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role, activo = true, estado = 'activo', socorrista_id = EXCLUDED.socorrista_id,
    nombre_completo = EXCLUDED.nombre_completo, nombre_usuario = EXCLUDED.nombre_usuario,
    can_upload_files = EXCLUDED.can_upload_files, custom_permissions = EXCLUDED.custom_permissions,
    requires_password_reset = EXCLUDED.requires_password_reset;

  IF NOT COALESCE(p_auto_confirm, true) THEN
    v_token := encode(extensions.gen_random_bytes(24), 'hex');
    INSERT INTO public.email_confirmation_tokens (user_id, email, token)
    VALUES (v_user_id, v_email, v_token);
  END IF;

  RETURN jsonb_build_object(
    'user_id', v_user_id,
    'email', v_email,
    'auto_confirmed', COALESCE(p_auto_confirm, true),
    'confirmation_token', v_token
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_create_user(TEXT, TEXT, TEXT, TEXT, INTEGER, BOOLEAN, JSONB, BOOLEAN, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_generar_token_confirmacion(target_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions AS $$
DECLARE
  v_email TEXT;
  v_token TEXT;
BEGIN
  IF NOT (
    public.is_admin() OR (auth.jwt() ->> 'email') = 'christopher.snap@gmail.com'
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND (role IN ('admin', 'superadmin') OR (custom_permissions ->> 'perm_accesos') = 'true'))
  ) THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = target_user_id;
  IF v_email IS NULL THEN RAISE EXCEPTION 'Usuario no encontrado'; END IF;
  UPDATE public.email_confirmation_tokens SET used_at = NOW() WHERE user_id = target_user_id AND used_at IS NULL;
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  INSERT INTO public.email_confirmation_tokens (user_id, email, token) VALUES (target_user_id, v_email, v_token);
  RETURN jsonb_build_object('user_id', target_user_id, 'email', v_email, 'confirmation_token', v_token);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_generar_token_confirmacion(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirmar_cuenta_por_token(p_token TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_rec RECORD;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Token de confirmación inválido.');
  END IF;
  SELECT * INTO v_rec FROM public.email_confirmation_tokens WHERE token = trim(p_token) LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El enlace de confirmación no existe o ya no es válido.');
  END IF;
  IF v_rec.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'email', v_rec.email, 'already_confirmed', true);
  END IF;
  IF v_rec.expires_at < NOW() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El enlace de confirmación ha expirado.');
  END IF;
  UPDATE public.email_confirmation_tokens SET used_at = NOW() WHERE id = v_rec.id;
  UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()), updated_at = NOW() WHERE id = v_rec.user_id;
  UPDATE auth.identities SET identity_data = COALESCE(identity_data, '{}'::jsonb) || '{"email_verified": true}'::jsonb, updated_at = NOW() WHERE user_id = v_rec.user_id;
  RETURN jsonb_build_object('ok', true, 'email', v_rec.email, 'already_confirmed', false);
END;
$$;
GRANT EXECUTE ON FUNCTION public.confirmar_cuenta_por_token(TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';`;

    navigator.clipboard.writeText(sqlText);
    setSql43Copied(true);
    setTimeout(() => setSql43Copied(false), 3000);
  };

  const availableFilterRoles = Array.from(
    new Set([
      ...(roles || []),
      ...usuarios.map((u) => u.role).filter(Boolean),
      'inactivo',
      'pendiente',
    ])
  );

  const handleCopySqlMigration44 = () => {
    const sqlText = `-- =========================================================================================
-- MIGRACIÓN 44: VISIBILIDAD DE IMÁGENES EN SOLICITUDES DE CARNET Y STORAGE PÚBLICO
-- =========================================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('socorristas', 'socorristas', true, 52428800, NULL),
  ('archivos', 'archivos', true, 52428800, NULL),
  ('logos', 'logos', true, 52428800, NULL),
  ('plantillas', 'plantillas', true, 52428800, NULL),
  ('assets', 'assets', true, 52428800, NULL)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = NULL;

DROP POLICY IF EXISTS "Allow Public Read Objects" ON storage.objects;
CREATE POLICY "Allow Public Read Objects" ON storage.objects
  FOR SELECT
  USING (bucket_id IN ('socorristas', 'archivos', 'logos', 'plantillas', 'assets'));

DROP POLICY IF EXISTS "Allow Public Upload Objects" ON storage.objects;
CREATE POLICY "Allow Public Upload Objects" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id IN ('socorristas', 'archivos', 'logos', 'plantillas', 'assets'));

DROP POLICY IF EXISTS "Allow Public Update Objects" ON storage.objects;
CREATE POLICY "Allow Public Update Objects" ON storage.objects
  FOR UPDATE
  USING (bucket_id IN ('socorristas', 'archivos', 'logos', 'plantillas', 'assets'));

ALTER TABLE IF EXISTS public.solicitudes_carnet
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS seccional_id INTEGER REFERENCES public.seccionales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seccional_nombre TEXT,
  ADD COLUMN IF NOT EXISTS solicitado_por TEXT,
  ADD COLUMN IF NOT EXISTS solicitado_por_email TEXT,
  ADD COLUMN IF NOT EXISTS observaciones TEXT,
  ADD COLUMN IF NOT EXISTS revisado_por TEXT,
  ADD COLUMN IF NOT EXISTS fecha_revision TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lote_id TEXT,
  ADD COLUMN IF NOT EXISTS es_lote BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.solicitudes_carnet
SET foto_url = NULL
WHERE foto_url LIKE 'blob:%' OR btrim(COALESCE(foto_url, '')) = '';

UPDATE public.socorristas
SET foto_url = NULL
WHERE foto_url LIKE 'blob:%' OR btrim(COALESCE(foto_url, '')) = '';

UPDATE public.solicitudes_carnet sc
SET foto_url = s.foto_url
FROM public.socorristas s
WHERE sc.socorrista_id = s.id
  AND (sc.foto_url IS NULL OR btrim(sc.foto_url) = '')
  AND s.foto_url IS NOT NULL
  AND btrim(s.foto_url) <> ''
  AND s.foto_url NOT LIKE 'blob:%';

ALTER TABLE IF EXISTS public.solicitudes_carnet ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura solicitudes_carnet" ON public.solicitudes_carnet;
CREATE POLICY "Permitir lectura solicitudes_carnet"
  ON public.solicitudes_carnet
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Permitir crear solicitudes_carnet publico" ON public.solicitudes_carnet;
CREATE POLICY "Permitir crear solicitudes_carnet publico"
  ON public.solicitudes_carnet
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion solicitudes_carnet" ON public.solicitudes_carnet;
CREATE POLICY "Permitir actualizacion solicitudes_carnet"
  ON public.solicitudes_carnet
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Usuarios autenticados pueden ver socorristas" ON public.socorristas;
CREATE POLICY "Usuarios autenticados pueden ver socorristas"
  ON public.socorristas
  FOR SELECT
  USING (true);

NOTIFY pgrst, 'reload schema';`;

    navigator.clipboard.writeText(sqlText);
    setSql44Copied(true);
    setTimeout(() => setSql44Copied(false), 3000);
  };

  const handleCopySqlMigration45 = () => {
    const sqlText = `-- =========================================================================================
-- MIGRACIÓN 45: CONTROL DE LECTURA INDIVIDUAL POR SOLICITUD Y POR USUARIO
-- =========================================================================================
CREATE TABLE IF NOT EXISTS public.solicitudes_lecturas (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modulo TEXT NOT NULL CHECK (modulo IN ('carnet', 'combustible', 'compra')),
  solicitud_key TEXT NOT NULL,
  leido_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, modulo, solicitud_key)
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_lecturas_user_modulo
  ON public.solicitudes_lecturas (user_id, modulo);

ALTER TABLE public.solicitudes_lecturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios leen sus propias lecturas de solicitudes" ON public.solicitudes_lecturas;
CREATE POLICY "Usuarios leen sus propias lecturas de solicitudes"
  ON public.solicitudes_lecturas
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios registran sus propias lecturas de solicitudes" ON public.solicitudes_lecturas;
CREATE POLICY "Usuarios registran sus propias lecturas de solicitudes"
  ON public.solicitudes_lecturas
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios actualizan sus propias lecturas de solicitudes" ON public.solicitudes_lecturas;
CREATE POLICY "Usuarios actualizan sus propias lecturas de solicitudes"
  ON public.solicitudes_lecturas
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios eliminan sus propias lecturas de solicitudes" ON public.solicitudes_lecturas;
CREATE POLICY "Usuarios eliminan sus propias lecturas de solicitudes"
  ON public.solicitudes_lecturas
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitudes_lecturas TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.solicitudes_lecturas_id_seq TO authenticated;

NOTIFY pgrst, 'reload schema';`;

    navigator.clipboard.writeText(sqlText);
    setSql45Copied(true);
    setTimeout(() => setSql45Copied(false), 3000);
  };

  const handleCopySqlMigration46 = () => {
    const sqlText = `-- =========================================================================================
-- MIGRACIÓN 46: CORRECCIÓN CRÍTICA DE SEGURIDAD (SUPABASE SECURITY ADVISOR)
-- Solventa: "Datos de usuario expuestos a través de una vista" (usuarios_autenticados_expuestos)
-- =========================================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_views
    WHERE schemaname = 'public'
      AND viewname = 'usuarios_view'
  ) THEN
    EXECUTE 'REVOKE ALL ON public.usuarios_view FROM anon, authenticated, PUBLIC';
    EXECUTE 'DROP VIEW public.usuarios_view CASCADE';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.can_view_accesos_directory()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT := lower(COALESCE(auth.jwt() ->> 'email', ''));
  v_role TEXT;
  v_custom JSONB;
  v_role_perms JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_email = 'christopher.snap@gmail.com' THEN
    RETURN TRUE;
  END IF;

  SELECT ur.role, COALESCE(ur.custom_permissions, '{}'::jsonb)
  INTO v_role, v_custom
  FROM public.user_roles ur
  WHERE ur.id = v_uid
    AND COALESCE(ur.activo, true) = true
  LIMIT 1;

  IF v_role IN ('admin', 'superadmin') THEN
    RETURN TRUE;
  END IF;

  IF (v_custom ->> 'view_accesos') = 'true' OR (v_custom ->> 'perm_accesos') = 'true' THEN
    RETURN TRUE;
  END IF;

  IF v_role IS NOT NULL THEN
    SELECT COALESCE(rp.permissions, '{}'::jsonb)
    INTO v_role_perms
    FROM public.role_permissions rp
    WHERE rp.role = v_role
    LIMIT 1;

    IF (v_role_perms ->> 'view_accesos') = 'true' THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.can_view_accesos_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_accesos_directory() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_usuarios_directory()
RETURNS TABLE (
  id UUID,
  email TEXT,
  primer_nombre TEXT,
  primer_apellido TEXT,
  nombre_usuario TEXT,
  nombre_completo TEXT,
  role TEXT,
  activo BOOLEAN,
  estado TEXT,
  carnet TEXT,
  seccional_id INTEGER,
  created_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  email_confirmed_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.can_view_accesos_directory() THEN
    RAISE EXCEPTION 'Acceso denegado: no cuenta con permisos para consultar usuarios.';
  END IF;

  RETURN QUERY
  SELECT
    u.id::uuid AS id,
    COALESCE(u.email, '')::text AS email,
    COALESCE(
      NULLIF(TRIM(r.nombre_usuario), ''),
      NULLIF(TRIM(r.nombre_completo), ''),
      NULLIF(TRIM(s.primer_nombre), ''),
      NULLIF(TRIM(u.raw_user_meta_data ->> 'nombre_usuario'), ''),
      NULLIF(TRIM(u.raw_user_meta_data ->> 'nombre_completo'), ''),
      NULLIF(TRIM(u.raw_user_meta_data ->> 'full_name'), ''),
      split_part(COALESCE(u.email, ''), '@', 1)
    )::text AS primer_nombre,
    COALESCE(s.primer_apellido, '')::text AS primer_apellido,
    r.nombre_usuario::text AS nombre_usuario,
    r.nombre_completo::text AS nombre_completo,
    r.role::text AS role,
    COALESCE(r.activo, true)::boolean AS activo,
    COALESCE(r.estado, 'activo')::text AS estado,
    s.carnet::text AS carnet,
    s.seccional_id::integer AS seccional_id,
    u.created_at::timestamptz AS created_at,
    u.email_confirmed_at::timestamptz AS confirmed_at,
    u.email_confirmed_at::timestamptz AS email_confirmed_at,
    u.last_sign_in_at::timestamptz AS last_sign_in_at
  FROM auth.users u
  LEFT JOIN public.user_roles r ON u.id = r.id
  LEFT JOIN public.socorristas s ON r.socorrista_id = s.id
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_usuarios_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_usuarios_directory() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_directores_list()
RETURNS TABLE (
  id UUID,
  email TEXT,
  primer_nombre TEXT,
  primer_apellido TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesión requerida.';
  END IF;

  RETURN QUERY
  SELECT
    u.id::uuid AS id,
    COALESCE(u.email, '')::text AS email,
    COALESCE(
      NULLIF(TRIM(s.primer_nombre), ''),
      NULLIF(TRIM(r.nombre_usuario), ''),
      NULLIF(TRIM(r.nombre_completo), ''),
      split_part(COALESCE(u.email, ''), '@', 1)
    )::text AS primer_nombre,
    COALESCE(s.primer_apellido, '')::text AS primer_apellido
  FROM public.user_roles r
  INNER JOIN auth.users u ON u.id = r.id
  LEFT JOIN public.socorristas s ON s.id = r.socorrista_id
  WHERE r.role = 'director'
    AND COALESCE(r.activo, true) = true
  ORDER BY primer_nombre ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_directores_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_directores_list() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_find_user_id_by_email(target_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_found_id UUID;
BEGIN
  IF NOT public.can_view_accesos_directory() THEN
    RAISE EXCEPTION 'Acceso denegado.';
  END IF;

  IF target_email IS NULL OR trim(target_email) = '' THEN
    RETURN NULL;
  END IF;

  SELECT u.id
  INTO v_found_id
  FROM auth.users u
  WHERE lower(u.email) = lower(trim(target_email))
  LIMIT 1;

  RETURN v_found_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_find_user_id_by_email(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_find_user_id_by_email(TEXT) TO authenticated;

REVOKE ALL ON TABLE public.email_confirmation_tokens FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';`;

    navigator.clipboard.writeText(sqlText);
    setSql46Copied(true);
    setTimeout(() => setSql46Copied(false), 3000);
  };

  const handleCopySqlMigration47 = () => {
    navigator.clipboard.writeText(SQL_MIGRATION_47_TEXT);
    setSql47Copied(true);
    setTimeout(() => setSql47Copied(false), 3000);
  };

  const handleCopySqlMigration48 = () => {
    navigator.clipboard.writeText(SQL_MIGRATION_48_TEXT);
    setSql48Copied(true);
    setTimeout(() => setSql48Copied(false), 3000);
  };

  const handleCopySqlMigration49 = () => {
    navigator.clipboard.writeText(SQL_MIGRATION_49_TEXT);
    setSql49Copied(true);
    setTimeout(() => setSql49Copied(false), 3000);
  };

  const handleCopySqlMigration50 = () => {
    navigator.clipboard.writeText(SQL_MIGRATION_50_TEXT);
    setSql50Copied(true);
    setTimeout(() => setSql50Copied(false), 3000);
  };

  const handleCopySqlMigration51 = () => {
    navigator.clipboard.writeText(SQL_MIGRATION_51_TEXT);
    setSql51Copied(true);
    setTimeout(() => setSql51Copied(false), 3000);
  };

  const filteredUsuarios = usuarios.filter((u) => {
    const matchesRole = roleFilter === 'todos' || u.role === roleFilter;
    if (!matchesRole) return false;
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    const display = getUserDisplayName(u).toLowerCase();
    return (
      display.includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.socorristas?.carnet || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q) ||
      (u.id || '').toLowerCase().includes(q)
    );
  });

  const pendingSolicitudesCount = solicitudes.filter(s => s.estado === 'pendiente').length;

  const permissionLabels: Record<string, string> = {
    ver_todas_seccionales: 'Ver y gestionar todas las seccionales (Nivel Nacional)',
    view_dashboard: 'Ver Panel Principal',
    view_socorristas: 'Ver listado de Socorristas',
    add_socorristas: 'Registrar nuevos Socorristas',
    edit_socorristas: 'Editar perfiles de Socorristas',
    descargar_ficha_conoce_socorrista: 'Descargar / Imprimir Ficha «Conoce a tu Socorrista»',
    descargar_excel_socorristas: 'Descargar Excel de Socorristas',
    subir_expediente_socorrista: 'Subir documentos al Expediente Digital',
    ver_expediente_socorrista: 'Previsualizar en línea Expediente Digital',
    descargar_expediente_socorrista: 'Descargar documentos del Expediente Digital',
    cambiar_estado_socorrista: 'Activar o desactivar Socorristas',
    view_carnet: 'Generar Carnets',
    ver_imagenes_socorristas: 'Ver fotografías e imágenes de carnets',
    descargar_carnet: 'Descargar Carnet Digital',
    view_solicitar_carnet: 'Ver Solicitar Carnet en menú',
    view_verificar_carnet: 'Ver Verificar Carnet en menú',
    view_cursos: 'Gestionar Cursos',
    view_seccionales: 'Ver Seccionales',
    edit_seccionales: 'Crear y editar Seccionales',
    view_directorio: 'Ver Directorio Institucional',
    edit_directorio: 'Editar Directorio Institucional',
    view_vehiculos: 'Ver Flota de Vehículos',
    edit_vehiculos: 'Crear y editar Vehículos y Mantenimiento',
    view_solicitudes_compra: 'Ver Solicitudes de Compra y Mantenimiento',
    crear_solicitudes_compra: 'Crear Solicitudes de Compra',
    edit_solicitudes_compra: 'Gestionar Solicitudes de Compra',
    aprobar_solicitudes_compra: 'Aprobar o rechazar Solicitudes de Compra',
    view_compra_historial: 'Ver Historial en Solicitudes de Compra',
    view_compra_plantillas: 'Ver Plantillas en Solicitudes de Compra',
    view_solicitudes_combustible: 'Ver Solicitudes de Combustible',
    crear_solicitudes_combustible: 'Crear Solicitudes de Combustible',
    edit_solicitudes_combustible: 'Gestionar Solicitudes de Combustible',
    aprobar_solicitudes_combustible: 'Aprobar o rechazar Solicitudes de Combustible',
    view_combustible_historial: 'Ver Historial en Solicitudes de Combustible',
    view_combustible_plantillas: 'Ver Plantillas en Solicitudes de Combustible',
    ver_previsualizacion_pdf: 'Previsualizar e imprimir PDF en Solicitudes',
    view_solicitudes_carnet: 'Ver Solicitudes de Carnet en Gestión Logística',
    edit_solicitudes_carnet: 'Gestionar Solicitudes de Carnet',
    view_archivos: 'Ver y descargar Archivos Institucionales',
    subir_archivos: 'Subir Archivos Institucionales',
    edit_archivos: 'Administrar Archivos Institucionales',
    view_anuncios: 'Ver Anuncios Institucionales',
    crear_anuncios: 'Publicar Anuncios',
    edit_anuncios: 'Editar Anuncios Institucionales',
    view_noticias_ajustes: 'Ver Noticias y ajustes del Banner',
    edit_noticias_banner: 'Configurar slides del Banner de Noticias',
    view_formularios: 'Ver Formularios y respuestas',
    crear_formularios: 'Crear nuevos Formularios',
    edit_formularios: 'Editar Formularios y respuestas',
    ver_todos_formularios: 'Ver todos los Formularios (Alcance Global)',
    view_meritos: 'Ver Méritos y Reconocimientos',
    edit_meritos: 'Registrar y editar Méritos',
    personalizar_colores: 'Personalizar colores institucionales',
    view_soporte: 'Ver módulo y pestaña de Soporte',
    crear_soporte: 'Hacer / Enviar Solicitudes de Soporte',
    view_soporte_seccional: 'Ver Solicitudes de Soporte a Nivel de Seccional',
    view_soporte_historial: 'Ver Solicitudes de Soporte a Nivel Global',
    edit_soporte_estado: 'Solventar Solicitudes de Soporte (Cambiar estado y dar solución)',
    view_config: 'Configuración del Sistema',
    view_activity: 'Ver Registro de Actividad',
    ver_personas_conectadas: 'Ver lista de usuarios en línea',
    view_accesos: 'Administración de Accesos y Usuarios'
  };

  const rolePermissionGroups: { title: string; keys: string[] }[] = [
    {
      title: 'Socorristas y Ficha «Conoce a tu Socorrista»',
      keys: [
        'ver_todas_seccionales',
        'view_socorristas',
        'add_socorristas',
        'edit_socorristas',
        'descargar_ficha_conoce_socorrista',
        'descargar_excel_socorristas',
        'ver_expediente_socorrista',
        'subir_expediente_socorrista',
        'descargar_expediente_socorrista',
        'cambiar_estado_socorrista',
        'ver_imagenes_socorristas',
        'view_carnet',
        'descargar_carnet',
        'view_solicitar_carnet',
        'view_verificar_carnet',
        'view_meritos',
        'edit_meritos',
      ],
    },
    {
      title: 'Solicitudes y Flota Vehicular',
      keys: [
        'view_vehiculos',
        'edit_vehiculos',
        'view_solicitudes_combustible',
        'crear_solicitudes_combustible',
        'edit_solicitudes_combustible',
        'aprobar_solicitudes_combustible',
        'view_combustible_historial',
        'view_combustible_plantillas',
        'view_solicitudes_compra',
        'crear_solicitudes_compra',
        'edit_solicitudes_compra',
        'aprobar_solicitudes_compra',
        'view_compra_historial',
        'view_compra_plantillas',
        'ver_previsualizacion_pdf',
        'view_solicitudes_carnet',
        'edit_solicitudes_carnet',
      ],
    },
    {
      title: 'Soporte Técnico e Incidencias',
      keys: [
        'view_soporte',
        'crear_soporte',
        'view_soporte_seccional',
        'view_soporte_historial',
        'edit_soporte_estado',
      ],
    },
    {
      title: 'Comunicación y Formularios',
      keys: [
        'view_noticias_ajustes',
        'edit_noticias_banner',
        'view_anuncios',
        'crear_anuncios',
        'edit_anuncios',
        'view_formularios',
        'crear_formularios',
        'edit_formularios',
        'ver_todos_formularios',
      ],
    },
    {
      title: 'Archivos, Sedes y Directorio',
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
    {
      title: 'Seguridad y Administración',
      keys: [
        'personalizar_colores',
        'ver_personas_conectadas',
        'view_activity',
        'view_config',
        'view_accesos',
      ],
    },
  ];

  const getUserScopeSummary = (user: any) => {
    if (user.role === 'admin') {
      return {
        isGlobal: true,
        primary: 'Global · Nacional',
        secondary: 'Acceso total · Solventa soporte',
      };
    }

    const cp = user.custom_permissions || {};
    const roleMap = rolePermissions.find((r) => r.role === user.role)?.permissions || {};
    const boolOverrideCount = Object.keys(cp).filter((k) => typeof cp[k] === 'boolean').length;
    const secCfg = cp._seccionales_socorristas;
    const scopesObj = cp._module_scopes || {};

    const canResolveSoporte =
      typeof cp.edit_soporte_estado === 'boolean'
        ? cp.edit_soporte_estado
        : Boolean(roleMap.edit_soporte_estado);
    const canCreateSoporte =
      typeof cp.crear_soporte === 'boolean'
        ? cp.crear_soporte
        : roleMap.crear_soporte !== undefined
        ? Boolean(roleMap.crear_soporte)
        : true;
    const soporteScope =
      scopesObj.soporte ||
      ((typeof cp.view_soporte_historial === 'boolean'
        ? cp.view_soporte_historial
        : Boolean(roleMap.view_soporte_historial))
        ? 'global'
        : (typeof cp.view_soporte_seccional === 'boolean'
            ? cp.view_soporte_seccional
            : Boolean(roleMap.view_soporte_seccional))
        ? 'seccional'
        : 'usuario');

    const soporteTag = canResolveSoporte
      ? 'Solventa soporte'
      : soporteScope === 'global'
      ? 'Soporte global'
      : soporteScope === 'seccional'
      ? 'Soporte seccional'
      : !canCreateSoporte
      ? 'Sin crear soporte'
      : '';

    const withSoporteTag = (base: string) => (soporteTag ? `${base} · ${soporteTag}` : base);

    const effectiveGlobal =
      secCfg?.mode === 'all' ||
      (typeof cp.ver_todas_seccionales === 'boolean'
        ? cp.ver_todas_seccionales
        : Boolean(roleMap.ver_todas_seccionales));

    if (effectiveGlobal) {
      return {
        isGlobal: true,
        primary: 'Global · Nacional',
        secondary: withSoporteTag(
          boolOverrideCount > 0 ? `${boolOverrideCount} ajustes` : `Según rol ${user.role}`
        ),
      };
    }

    if (secCfg?.mode === 'custom' && secCfg?.seccionales) {
      const activeIds = Object.entries(secCfg.seccionales)
        .filter(([, val]: any) => val?.view || val?.add || val?.edit)
        .map(([id]) => Number(id));

      if (activeIds.length === 1) {
        const secName = seccionales.find((s) => s.id === activeIds[0])?.nombre || '1 seccional';
        return {
          isGlobal: false,
          primary: `Seccional · ${secName}`,
          secondary: withSoporteTag(
            boolOverrideCount > 0 ? `${boolOverrideCount} ajustes` : 'Alcance personalizado'
          ),
        };
      }
      if (activeIds.length > 1) {
        return {
          isGlobal: false,
          primary: `${activeIds.length} seccionales`,
          secondary: withSoporteTag(
            boolOverrideCount > 0 ? `${boolOverrideCount} ajustes` : 'Alcance múltiple'
          ),
        };
      }
    }

    const hasCustomModuleScopes = Object.keys(scopesObj).length > 0;
    const assignedSecName = user.socorristas?.seccionales?.nombre || 'Seccional local';

    return {
      isGlobal: false,
      primary: `Seccional · ${assignedSecName}`,
      secondary: withSoporteTag(
        boolOverrideCount > 0 || hasCustomModuleScopes
          ? `${boolOverrideCount || 1} ajustes`
          : `Según rol ${user.role}`
      ),
    };
  };

  const activeRoleObject =
    rolePermissions.find((rp) => rp.role === selectedRoleTab) || rolePermissions[0] || null;

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6 lg:p-8 space-y-4">
        <div className="h-7 w-48 bg-slate-200/70 rounded-lg animate-pulse" />
        <div className="h-11 w-full max-w-xl bg-slate-200/70 rounded-2xl animate-pulse" />
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-3">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-5">
      {/* Encabezado limpio estilo iOS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Accesos y Usuarios
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Cuentas, niveles de alcance global o seccional, roles y ajustes de seguridad
          </p>
        </div>

        {activeTab === 'usuarios' && (
          <button
            type="button"
            onClick={() => setShowNewUserModal(true)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Nuevo Usuario</span>
          </button>
        )}
      </div>

      {/* Aviso flotante limpio (reemplaza alert nativo) */}
      {statusNotice && (
        <div
          className={`px-4 py-3 rounded-2xl border text-xs font-medium flex items-center justify-between gap-3 transition-opacity ${
            statusNotice.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <span>{statusNotice.text}</span>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-current opacity-60 hover:opacity-100 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Control Segmentado Estilo Apple iOS */}
      <div className="bg-slate-200/70 p-1 rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-1 max-w-2xl">
        <button
          type="button"
          onClick={() => setActiveTab('usuarios')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
            activeTab === 'usuarios'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Usuarios ({usuarios.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('solicitudes')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
            activeTab === 'solicitudes'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Solicitudes</span>
          {pendingSolicitudesCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-600 text-white rounded-full leading-none">
              {pendingSolicitudesCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('roles')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'roles'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Roles
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ajustes')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'ajustes'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Ajustes
        </button>
      </div>

      {usingLegacyExposedView && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-rose-900">
                Corrección de seguridad pendiente (Migración 46)
              </p>
              <p className="text-xs text-rose-800 mt-0.5">
                La vista antigua <code className="font-mono">public.usuarios_view</code> sigue activa en Supabase. Ejecuta la Migración 46 en el SQL Editor para cerrarla.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopySqlMigration46}
            className="inline-flex items-center px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0"
          >
            {sql46Copied ? (
              <>
                <Check className="w-3.5 h-3.5 mr-1.5" />
                <span>SQL 46 copiado</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                <span>Copiar SQL 46</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* TAB 1: USUARIOS */}
      {activeTab === 'usuarios' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
          {/* Barra limpia de búsqueda y filtro */}
          <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative flex-1 min-w-[210px] max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Buscar por nombre, correo o carnet..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-100/80 border border-transparent focus:bg-white focus:border-slate-300 rounded-xl outline-none transition-colors"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                aria-label="Filtrar por rol"
                className="bg-slate-100/80 border border-transparent focus:bg-white focus:border-slate-300 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 outline-none cursor-pointer tabular-nums"
              >
                <option value="todos">Todos los roles ({usuarios.length})</option>
                {availableFilterRoles.map((r) => {
                  const count = usuarios.filter((u) => u.role === r).length;
                  return (
                    <option key={r} value={r}>
                      {r} ({count})
                    </option>
                  );
                })}
              </select>

              {(roleFilter !== 'todos' || userSearch.trim() !== '') && (
                <button
                  type="button"
                  onClick={() => {
                    setRoleFilter('todos');
                    setUserSearch('');
                  }}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer whitespace-nowrap shrink-0"
                >
                  Limpiar
                </button>
              )}
            </div>

            <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap shrink-0">
              {filteredUsuarios.length} de {usuarios.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left">
              <thead className="bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <tr>
                  <th className="px-5 py-3">Usuario</th>
                  <th className="px-4 py-3">Rol y Carnet</th>
                  <th className="px-4 py-3">Nivel y Alcance</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-5 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 text-xs">
                {filteredUsuarios.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                      No se encontraron usuarios con ese criterio de búsqueda.
                    </td>
                  </tr>
                ) : (
                  filteredUsuarios.map((user) => {
                    const isInactive =
                      user.role === 'inactivo' ||
                      user.activo === false ||
                      user.estado === 'inactivo' ||
                      inactiveUserIds.includes(user.id);
                    const isPending = user.role === 'pendiente' || user.estado === 'pendiente';
                    const displayName = getUserDisplayName(user);
                    const isEditingName = editingUserNameId === user.id;
                    const isLinkingCarnet = linkingCarnetUserId === user.id;
                    const scopeInfo = getUserScopeSummary(user);
                    const initials = displayName
                      .split(' ')
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((p: string) => p[0]?.toUpperCase())
                      .join('') || 'U';

                    return (
                      <tr
                        key={user.id}
                        className={`transition-colors ${
                          isInactive
                            ? 'bg-slate-50/70 opacity-75'
                            : 'hover:bg-slate-50/60'
                        }`}
                      >
                        {/* 1. Usuario */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3 min-w-[220px]">
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-semibold text-xs flex items-center justify-center shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              {isEditingName ? (
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <input
                                    type="text"
                                    value={editingUserNameValue}
                                    onChange={(e) => setEditingUserNameValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSaveUserName(user);
                                      } else if (e.key === 'Escape') {
                                        setEditingUserNameId(null);
                                      }
                                    }}
                                    autoFocus
                                    placeholder="Nombre del usuario"
                                    className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 outline-none w-44"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveUserName(user)}
                                    className="p-1 bg-slate-900 text-white rounded-md hover:bg-black cursor-pointer"
                                    title="Guardar"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingUserNameId(null)}
                                    className="p-1 bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200 cursor-pointer"
                                    title="Cancelar"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`font-semibold truncate ${
                                      displayName === 'Usuario sin perfil'
                                        ? 'text-amber-700'
                                        : 'text-slate-900'
                                    }`}
                                  >
                                    {displayName}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingUserNameId(user.id);
                                      setEditingUserNameValue(
                                        displayName === 'Usuario sin perfil' ? '' : displayName
                                      );
                                    }}
                                    className="p-0.5 text-slate-300 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
                                    title="Editar nombre"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                </div>
                              )}

                              <div className="text-slate-500 text-xs truncate">
                                {user.email}
                              </div>

                              {!user.email_confirmed_at && !user.confirmed_at && (
                                <div className="mt-0.5 text-[11px] text-amber-700 flex items-center gap-1.5">
                                  <span>Sin confirmar</span>
                                  <span aria-hidden="true">·</span>
                                  <button
                                    type="button"
                                    disabled={sendingConfirmUserId === user.id}
                                    onClick={() => handleSendConfirmationLink(user)}
                                    className="font-semibold text-slate-700 hover:text-slate-950 underline cursor-pointer disabled:opacity-50"
                                  >
                                    {sendingConfirmUserId === user.id
                                      ? 'Enviando...'
                                      : 'Enviar enlace'}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 2. Rol y Carnet */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="space-y-1">
                            <select
                              value={user.role}
                              onChange={(e) => handleRoleChange(user.id, e.target.value)}
                              className={`px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50/70 hover:bg-white focus:bg-white outline-none font-medium cursor-pointer ${
                                user.role === 'inactivo' ? 'text-rose-700' : 'text-slate-800'
                              }`}
                            >
                              {roles?.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                              {!roles?.includes('inactivo') && (
                                <option value="inactivo">inactivo</option>
                              )}
                              {!roles?.includes('pendiente') && (
                                <option value="pendiente">pendiente</option>
                              )}
                            </select>

                            {isLinkingCarnet ? (
                              <div className="flex items-center gap-1 pt-0.5">
                                <input
                                  type="text"
                                  value={linkingCarnetValue}
                                  onChange={(e) =>
                                    setLinkingCarnetValue(e.target.value.toUpperCase())
                                  }
                                  placeholder="CVS-0000-AA"
                                  className="w-28 px-2 py-0.5 text-[11px] font-mono border border-slate-300 rounded-md bg-white outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveLinkedCarnet(user.id)}
                                  className="p-1 bg-slate-900 text-white rounded-md cursor-pointer"
                                  title="Guardar carnet"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLinkingCarnetUserId(null);
                                    setLinkingCarnetValue('');
                                  }}
                                  className="p-1 bg-slate-100 text-slate-600 rounded-md cursor-pointer"
                                  title="Cancelar"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pl-0.5">
                                <span className="font-mono tabular-nums">
                                  {user.socorristas?.carnet || 'Sin carnet'}
                                </span>
                                <span aria-hidden="true">·</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLinkingCarnetUserId(user.id);
                                    setLinkingCarnetValue(user.socorristas?.carnet || '');
                                  }}
                                  className="text-slate-600 hover:text-slate-900 font-medium hover:underline cursor-pointer"
                                >
                                  {user.socorristas?.carnet ? 'Cambiar' : 'Vincular'}
                                </button>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 3. Nivel y Alcance (Clic abre editor limpio de Global vs Seccional y permisos) */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {user.role === 'admin' ? (
                            <div>
                              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                                <Globe className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>Global · Nacional</span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Acceso administrativo total
                              </p>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSelectedUserForPermisos(user)}
                              className="text-left group cursor-pointer rounded-xl px-2.5 py-1.5 -mx-2.5 hover:bg-slate-100/90 transition-colors"
                              title="Cambiar entre Nivel Global, Seccional y permisos individuales"
                            >
                              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors">
                                {scopeInfo.isGlobal ? (
                                  <Globe className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                ) : (
                                  <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                )}
                                <span>{scopeInfo.primary}</span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {scopeInfo.secondary} · <span className="underline">Configurar</span>
                              </p>
                            </button>
                          )}
                        </td>

                        {/* 4. Estado (Switch estilo iOS) */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={!isInactive}
                              onClick={() => handleToggleUserActive(user)}
                              title={isInactive ? 'Activar cuenta' : 'Desactivar cuenta'}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ${
                                isInactive
                                  ? 'bg-slate-200'
                                  : isPending
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform duration-150 ${
                                  isInactive ? 'translate-x-0' : 'translate-x-4'
                                }`}
                              />
                            </button>
                            <span
                              className={`text-xs font-medium ${
                                isInactive
                                  ? 'text-slate-400'
                                  : isPending
                                  ? 'text-amber-700'
                                  : 'text-slate-700'
                              }`}
                            >
                              {isInactive ? 'Inactivo' : isPending ? 'Pendiente' : 'Activo'}
                            </span>
                          </div>
                        </td>

                        {/* 5. Acciones limpias en una sola fila */}
                        <td className="px-5 py-3.5 whitespace-nowrap text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {user.role !== 'admin' && (
                              <button
                                type="button"
                                onClick={() => setSelectedUserForPermisos(user)}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                              >
                                <Sliders className="h-3.5 w-3.5 text-slate-600" />
                                <span>Accesos</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setSelectedUserForReset(user)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                              title="Restablecer contraseña"
                            >
                              <KeyRound className="h-3.5 w-3.5 text-slate-500" />
                              <span>Clave</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteUser(user.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                              title="Eliminar usuario"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SOLICITUDES DE REGISTRO */}
      {activeTab === 'solicitudes' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6">
          <SolicitudesRegistroTab
            solicitudes={solicitudes}
            roles={roles}
            seccionales={seccionales}
            onRefresh={fetchData}
            onSolicitudProcessed={handleSolicitudProcessed}
            remitenteNombre={remitenteNombre}
            remitenteCorreo={remitenteCorreo}
          />
        </div>
      )}

      {/* TAB 3: PERMISOS POR ROL (ESTILO iOS AGRUPADO CON SWITCHES) */}
      {activeTab === 'roles' && (
        <div className="space-y-5 max-w-4xl">
          {/* Selector segmentado de Rol + Crear Rol + Buscador + Guardar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Permisos por Rol</h3>
                <p className="text-xs text-slate-500">
                  Crea roles personalizados y define los permisos base que heredarán los usuarios asignados.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {activeRoleObject && editingRole === activeRoleObject.role && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRole(null);
                        setEditedPermissions({});
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Descartar
                    </button>
                    <button
                      type="button"
                      disabled={savingRolePerms}
                      onClick={() => handleSavePermissions(activeRoleObject.role)}
                      className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{savingRolePerms ? 'Guardando...' : `Guardar rol ${activeRoleObject.role}`}</span>
                    </button>
                  </>
                )}

                {activeRoleObject && !CORE_SYSTEM_ROLES.includes(activeRoleObject.role) && (
                  <button
                    type="button"
                    disabled={deletingRole}
                    onClick={() => handleDeleteCustomRole(activeRoleObject.role)}
                    className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                    title="Eliminar este rol personalizado"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar rol</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setCreateRoleError('');
                    setNewRoleName('');
                    setNewRoleCopyFrom('');
                    setShowCreateRoleModal(true);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nuevo Rol</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="bg-slate-100 p-1 rounded-xl flex flex-wrap gap-1">
                {rolePermissions.map((rp) => {
                  const isSelected = (activeRoleObject?.role || '') === rp.role;
                  const usersInRole = usuarios.filter((u) => u.role === rp.role).length;
                  return (
                    <button
                      key={rp.role}
                      type="button"
                      onClick={() => {
                        if (editingRole && editingRole !== rp.role) {
                          setEditingRole(null);
                          setEditedPermissions({});
                        }
                        setSelectedRoleTab(rp.role);
                      }}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span className="capitalize">{rp.role.replace(/_/g, ' ')}</span>
                      <span className="text-[11px] font-medium text-slate-400 tabular-nums">
                        {usersInRole}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="relative sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2" />
                <input
                  type="text"
                  value={rolePermSearch}
                  onChange={(e) => setRolePermSearch(e.target.value)}
                  placeholder="Filtrar permiso..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-none"
                />
              </div>
            </div>
          </div>

          {/* Modal Crear Nuevo Rol (Estilo iOS limpio) */}
          {showCreateRoleModal && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
              onClick={() => !creatingRole && setShowCreateRoleModal(false)}
            >
              <div
                className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-sm font-bold text-slate-900">Crear Nuevo Rol</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateRoleModal(false)}
                    disabled={creatingRole}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateRole} className="p-5 space-y-4">
                  {createRoleError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                      {createRoleError}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Nombre del Rol
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="Ej. Jefe de Seccional, Logística, Tesorería..."
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:border-slate-400 outline-none"
                    />
                    {newRoleName.trim() && (
                      <p className="text-[11px] text-slate-500">
                        Identificador en sistema:{' '}
                        <span className="font-mono font-semibold text-slate-800">
                          {normalizeRoleSlug(newRoleName) || '—'}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Permisos iniciales (opcional)
                    </label>
                    <select
                      value={newRoleCopyFrom}
                      onChange={(e) => setNewRoleCopyFrom(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs font-medium bg-slate-50 focus:bg-white border border-slate-200 rounded-xl outline-none cursor-pointer"
                    >
                      <option value="">Empezar con permisos básicos mínimos</option>
                      {rolePermissions.map((rp) => (
                        <option key={rp.role} value={rp.role}>
                          Copiar permisos del rol {rp.role}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500">
                      Al crearse podrás activar o desactivar cada permiso individualmente.
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={creatingRole}
                      onClick={() => setShowCreateRoleModal(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={creatingRole || !normalizeRoleSlug(newRoleName)}
                      className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{creatingRole ? 'Creando...' : 'Crear Rol'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Grupos estilo iOS Settings para el rol seleccionado */}
          {activeRoleObject && (
            <div className="space-y-5">
              {rolePermissionGroups.map((group) => {
                const q = rolePermSearch.trim().toLowerCase();
                const visibleKeys = group.keys.filter((k) => {
                  if (!permissionLabels[k]) return false;
                  if (!q) return true;
                  return (
                    permissionLabels[k].toLowerCase().includes(q) || k.toLowerCase().includes(q)
                  );
                });

                if (visibleKeys.length === 0) return null;

                return (
                  <div key={group.title} className="space-y-1.5">
                    <p className="px-1 text-xs font-semibold text-slate-500">{group.title}</p>
                    <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
                      {visibleKeys.map((permKey) => {
                        const isGranted =
                          editingRole === activeRoleObject.role
                            ? Boolean(editedPermissions[permKey])
                            : Boolean(activeRoleObject.permissions?.[permKey]);

                        return (
                          <div
                            key={permKey}
                            className="px-4 sm:px-5 py-3 flex items-center justify-between gap-4 hover:bg-slate-50/60"
                          >
                            <span className="text-xs font-medium text-slate-800">
                              {permissionLabels[permKey]}
                            </span>

                            <button
                              type="button"
                              role="switch"
                              aria-checked={isGranted}
                              onClick={() => handleToggleRolePermDirect(activeRoleObject, permKey)}
                              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ${
                                isGranted ? 'bg-emerald-500' : 'bg-slate-200'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform duration-150 ${
                                  isGranted ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: AJUSTES DEL SISTEMA */}
      {activeTab === 'ajustes' && (
        <div className="space-y-6 max-w-3xl">
          {/* Card 1: Opciones de Acceso y Pantalla de Inicio */}
          <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Pantalla de Inicio y Documentos
                  </h4>
                  <p className="text-xs text-slate-500">
                    Accesos rápidos en login y marca de agua institucional
                  </p>
                </div>
              </div>

              {ajustesSavedMessage && (
                <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Guardado</span>
                </span>
              )}
            </div>

            <div className="divide-y divide-slate-100">
              <div className="p-4 sm:px-5 flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold text-slate-900 block">
                    Marca de Agua Institucional
                  </span>
                  <span className="text-xs text-slate-500 block mt-0.5">
                    Muestra el sello oficial en el fondo de carnets y documentos
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={watermarkEnabled}
                    onChange={handleToggleWatermark}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              <div className="p-4 sm:px-5 flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold text-slate-900 block">
                    Botón «Solicitar Carnet» en Login
                  </span>
                  <span className="text-xs text-slate-500 block mt-0.5">
                    Acceso público rápido desde la pantalla de inicio de sesión
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={loginShowSolicitar}
                    onChange={handleToggleLoginSolicitar}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              <div className="p-4 sm:px-5 flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold text-slate-900 block">
                    Botón «Verificar Carnet» en Login
                  </span>
                  <span className="text-xs text-slate-500 block mt-0.5">
                    Validación pública de carnets mediante código QR
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={loginShowVerificar}
                    onChange={handleToggleLoginVerificar}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={handleSaveAjustes}
                disabled={savingAjustes || !hasAjustesChanges}
                className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Save className="w-3.5 h-3.5 mr-1.5" />
                <span>{savingAjustes ? 'Guardando...' : 'Guardar ajustes'}</span>
              </button>
            </div>
          </div>

          {/* Card 2: Remitente de Correos */}
          <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Remitente de Correos Institucionales
                  </h4>
                  <p className="text-xs text-slate-500">
                    Datos de envío para aprobaciones, altas y enlaces de acceso
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAjustesPreview(!showAjustesPreview)}
                className="inline-flex items-center px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Eye className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                <span>{showAjustesPreview ? 'Ocultar vista previa' : 'Vista previa'}</span>
              </button>
            </div>

            {emailConfigSaved && (
              <div className="mx-5 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Configuración de correos guardada.</span>
              </div>
            )}

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Nombre del remitente
                  </label>
                  <input
                    type="text"
                    value={remitenteNombre}
                    onChange={(e) => setRemitenteNombre(e.target.value)}
                    placeholder="Cruz Verde Salvadoreña"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-slate-400 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Correo institucional
                  </label>
                  <input
                    type="email"
                    value={remitenteCorreo}
                    onChange={(e) => setRemitenteCorreo(e.target.value)}
                    placeholder="notificaciones@cruzverdesv.org"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-slate-400 outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Asunto de aprobación
                </label>
                <input
                  type="text"
                  value={asuntoAprobacion}
                  onChange={(e) => setAsuntoAprobacion(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-slate-400 outline-none transition-colors"
                />
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={handleSaveEmailConfig}
                disabled={savingEmailConfig}
                className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Save className="w-3.5 h-3.5 mr-1.5" />
                <span>{savingEmailConfig ? 'Guardando...' : 'Guardar remitente'}</span>
              </button>
            </div>

            {showAjustesPreview && (
              <div className="p-5 border-t border-slate-100 bg-slate-50/60">
                <pre className="bg-white p-4 rounded-xl border border-slate-200 whitespace-pre-wrap font-mono text-xs text-slate-700 leading-relaxed">
                  {generarTextoCorreoAprobacion({
                    remitenteNombre,
                    remitenteCorreo,
                    destinatarioCorreo: 'ejemplo.usuario@cruzverdesv.org',
                    destinatarioNombre: 'Juan Carlos Pérez',
                    asunto: asuntoAprobacion,
                    seccionalNombre: 'Seccional Santa Ana',
                    rolAsignado: 'socorrista',
                    loginUrl: getOfficialLoginUrl(),
                  })}
                </pre>
              </div>
            )}
          </div>

          {/* Card 3: Migraciones SQL limpias y ordenadas */}
          <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Migraciones SQL de Supabase
                  </h4>
                  <p className="text-xs text-slate-500">
                    Scripts de actualización de base de datos listos para copiar
                  </p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {[
                {
                  num: '51',
                  title: 'Roles Personalizados, Auditoría de Sesiones y Seccionales',
                  desc: 'Habilita crear/asignar roles nuevos sin bloqueo CHECK y permisos RLS para registrar inicios de sesión en Actividad',
                  copied: sql51Copied,
                  onCopy: handleCopySqlMigration51,
                },
                {
                  num: '50',
                  title: 'Soporte: Notificaciones de Lectura, Alcance por Seccional y Permisos',
                  desc: 'Habilita lectura por solicitud en Soporte y políticas RLS de alcance seccional, creación y solución',
                  copied: sql50Copied,
                  onCopy: handleCopySqlMigration50,
                },
                {
                  num: '49',
                  title: 'Dependientes con Parentesco (CVSSOCC/FORM001) y Schema Cache',
                  desc: 'Columna dependientes_detalle JSONB y permisos de esquema en PostgREST',
                  copied: sql49Copied,
                  onCopy: handleCopySqlMigration49,
                },
                {
                  num: '48',
                  title: 'Ficha «Conoce a tu Socorrista» (CVSSOCC/FORM001)',
                  desc: 'Campos adicionales de estado civil, NIT opcional, cónyuge, profesión y PEP',
                  copied: sql48Copied,
                  onCopy: handleCopySqlMigration48,
                },
                {
                  num: '47',
                  title: 'Optimización de Imágenes WebP y Estadísticas de Storage',
                  desc: 'Soporte WebP en buckets y conteo de almacenamiento de imágenes',
                  copied: sql47Copied,
                  onCopy: handleCopySqlMigration47,
                },
                {
                  num: '46',
                  title: 'Seguridad Supabase: Cerrar Vista Expuesta de Usuarios',
                  desc: 'Elimina public.usuarios_view y habilita consulta protegida por rol',
                  copied: sql46Copied,
                  onCopy: handleCopySqlMigration46,
                },
              ].map((m) => (
                <div
                  key={m.num}
                  className="p-4 sm:px-5 flex items-center justify-between gap-3 hover:bg-slate-50/60"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 text-xs font-mono font-bold flex items-center justify-center shrink-0 tabular-nums">
                      {m.num}
                    </span>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-slate-900 block truncate">
                        {m.title}
                      </span>
                      <span className="text-xs text-slate-500 block truncate">{m.desc}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={m.onCopy}
                    className="inline-flex items-center px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {m.copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                        <span>Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        <span>Copiar SQL</span>
                      </>
                    )}
                  </button>
                </div>
              ))}

              {/* Botón para expandir migraciones anteriores sin saturar la vista */}
              <div className="px-5 py-3 bg-slate-50/60">
                <button
                  type="button"
                  onClick={() => setShowOlderMigrations((prev) => !prev)}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span>
                    {showOlderMigrations
                      ? 'Ocultar migraciones anteriores (18–45)'
                      : 'Ver migraciones anteriores (18–45)'}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-150 ${
                      showOlderMigrations ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </div>

              {showOlderMigrations &&
                [
                  {
                    num: '45',
                    title: 'Control de Lectura Individual por Solicitud',
                    desc: 'Tabla solicitudes_lecturas para conteo de no leídas por usuario',
                    copied: sql45Copied,
                    onCopy: handleCopySqlMigration45,
                  },
                  {
                    num: '44',
                    title: 'Visibilidad de Fotografías y Storage Público',
                    desc: 'Políticas públicas de lectura en buckets y fotos de solicitudes_carnet',
                    copied: sql44Copied,
                    onCopy: handleCopySqlMigration44,
                  },
                  {
                    num: '43',
                    title: 'Creación de Usuarios y Confirmación Sin Límite',
                    desc: 'Alta directa vía SQL sin límite de correos de Supabase',
                    copied: sql43Copied,
                    onCopy: handleCopySqlMigration43,
                  },
                  {
                    num: '42',
                    title: 'Nombre de Usuario y Reseteo Administrativo',
                    desc: 'Columna nombre_usuario y funciones de confirmación y clave',
                    copied: sql42Copied,
                    onCopy: handleCopySqlMigration42,
                  },
                  {
                    num: '31',
                    title: 'Permisos por Seccional y Solicitudes de Carnet',
                    desc: 'Columnas de seccional y estados extendidos en solicitudes_carnet',
                    copied: sql31Copied,
                    onCopy: handleCopySqlMigration31,
                  },
                  {
                    num: '22',
                    title: 'Permisos Individuales por Usuario',
                    desc: 'Columna custom_permissions JSONB en user_roles',
                    copied: sql22Copied,
                    onCopy: handleCopySqlMigration22,
                  },
                  {
                    num: '21',
                    title: 'Archivos Descargables y Anuncios',
                    desc: 'Tablas public.archivos y public.anuncios',
                    copied: sql21Copied,
                    onCopy: handleCopySqlMigration21,
                  },
                  {
                    num: '18',
                    title: 'Solicitudes de Registro y Estado Activo',
                    desc: 'Tabla solicitudes_registro y estado activo en user_roles',
                    copied: sqlCopied,
                    onCopy: handleCopySqlMigration,
                  },
                ].map((m) => (
                  <div
                    key={m.num}
                    className="p-4 sm:px-5 flex items-center justify-between gap-3 bg-white hover:bg-slate-50/60"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 text-xs font-mono font-semibold flex items-center justify-center shrink-0 tabular-nums">
                        {m.num}
                      </span>
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-slate-800 block truncate">
                          {m.title}
                        </span>
                        <span className="text-xs text-slate-500 block truncate">{m.desc}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={m.onCopy}
                      className="inline-flex items-center px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {m.copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                          <span>Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          <span>Copiar SQL</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

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

      {/* MODAL NUEVO USUARIO (ESTILO iOS SHEET CON SCROLL INTERNO) */}
      {showNewUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-md p-3 sm:p-5">
          <form
            onSubmit={handleCreateUser}
            className="bg-[#F2F2F7] rounded-[28px] shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden border border-slate-200/80 animate-in zoom-in-95 duration-150"
          >
            {/* Header fijo */}
            <div className="px-5 py-4 border-b border-slate-200/70 flex justify-between items-center bg-white shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Nuevo Usuario
                </h3>
                <p className="text-xs text-slate-500">
                  Alta de miembro institucional o cuenta externa
                </p>
              </div>
              <button
                type="button"
                onClick={resetNewUserModal}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cuerpo con scroll interno */}
            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 text-xs">
              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2.5 rounded-xl text-xs">
                  {formError}
                </div>
              )}

              {/* Selector de tipo */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 space-y-2">
                <label className="block text-xs font-semibold text-slate-600">
                  Tipo de cuenta
                </label>
                <div className="bg-slate-100 p-1 rounded-xl grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => setNewUserType('cruz_verde')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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
                    className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2">
                  <label className="block text-xs font-semibold text-slate-600">
                    Buscar por número de carnet
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newUserCarnet}
                      onChange={handleCarnetChange}
                      maxLength={11}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 uppercase font-mono text-xs text-slate-900 focus:bg-white outline-none"
                      placeholder="CVS-0000-AA"
                    />
                    <button
                      type="button"
                      onClick={handleSearchCarnet}
                      disabled={searchLoading || !newUserCarnet}
                      className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-xl disabled:opacity-40 transition-colors cursor-pointer shrink-0"
                    >
                      {searchLoading ? 'Buscando...' : 'Buscar'}
                    </button>
                  </div>
                  {searchError && <p className="text-xs text-rose-600">{searchError}</p>}
                </div>
              )}

              {(newUserType === 'externo' || socorristaData) && (
                <>
                  {socorristaData && (
                    <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-900">
                          {socorristaData.primer_nombre} {socorristaData.primer_apellido}
                        </p>
                        <p className="text-xs text-slate-500 font-mono">
                          Carnet {socorristaData.carnet}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSocorristaData(null)}
                        className="text-xs font-medium text-slate-500 hover:text-slate-900 underline cursor-pointer"
                      >
                        Cambiar
                      </button>
                    </div>
                  )}

                  <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
                    <div className="p-3.5 space-y-1">
                      <label className="block text-xs font-medium text-slate-600">
                        Nombre completo
                      </label>
                      <input
                        type="text"
                        required
                        value={newUserNombre}
                        onChange={(e) => setNewUserNombre(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white outline-none"
                        placeholder="Ej. Juan Pérez"
                      />
                    </div>

                    <div className="p-3.5 space-y-1">
                      <label className="block text-xs font-medium text-slate-600">
                        Correo electrónico
                      </label>
                      <input
                        type="email"
                        required
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white outline-none"
                        placeholder="usuario@cruzverdesv.org"
                      />
                    </div>

                    <div className="p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-600">Contraseña</label>
                        <div className="bg-slate-100 p-0.5 rounded-lg inline-flex gap-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setPasswordOption('generated');
                              generatePassword();
                            }}
                            className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                              passwordOption === 'generated'
                                ? 'bg-white text-slate-900 shadow-2xs'
                                : 'text-slate-600'
                            }`}
                          >
                            Automática
                          </button>
                          <button
                            type="button"
                            onClick={() => setPasswordOption('manual')}
                            className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                              passwordOption === 'manual'
                                ? 'bg-white text-slate-900 shadow-2xs'
                                : 'text-slate-600'
                            }`}
                          >
                            Manual
                          </button>
                        </div>
                      </div>

                      {passwordOption === 'manual' ? (
                        <input
                          type="password"
                          required
                          minLength={6}
                          placeholder="Mínimo 6 caracteres"
                          value={newUserPassword}
                          onChange={(e) => setNewUserPassword(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white outline-none"
                        />
                      ) : (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            readOnly
                            value={newUserPassword}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-semibold text-slate-900 outline-none"
                          />
                          <button
                            type="button"
                            onClick={generatePassword}
                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer shrink-0"
                          >
                            Otra
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-slate-600">Rol</label>
                        <select
                          value={newUserRole}
                          onChange={(e) => setNewUserRole(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none cursor-pointer"
                        >
                          {roles?.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-slate-600">
                          Copiar accesos de (opcional)
                        </label>
                        <select
                          value={copyFromUserId}
                          onChange={(e) => handleCopyUserTemplateChange(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none cursor-pointer"
                        >
                          <option value="">Según rol</option>
                          {usuarios.map((u) => (
                            <option key={u.id} value={u.id}>
                              {getUserDisplayName(u)} ({u.role})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Opciones de cuenta estilo iOS */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl divide-y divide-slate-100 overflow-hidden">
                    <label className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer">
                      <span className="text-xs text-slate-700">
                        Pedir cambio de contraseña al iniciar sesión
                      </span>
                      <input
                        type="checkbox"
                        checked={newUserRequiresPasswordReset}
                        onChange={(e) => setNewUserRequiresPasswordReset(e.target.checked)}
                        className="h-4 w-4 text-emerald-600 rounded shrink-0"
                      />
                    </label>

                    <label className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer">
                      <span className="text-xs text-slate-700">
                        Enviar credenciales por correo ({remitenteCorreo})
                      </span>
                      <input
                        type="checkbox"
                        checked={newUserSendPlainEmail}
                        onChange={(e) => setNewUserSendPlainEmail(e.target.checked)}
                        className="h-4 w-4 text-emerald-600 rounded shrink-0"
                      />
                    </label>

                    <label className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer">
                      <span className="text-xs text-slate-700">
                        Confirmar correo automáticamente al crear
                      </span>
                      <input
                        type="checkbox"
                        checked={newUserAutoConfirmEmail}
                        onChange={(e) => setNewUserAutoConfirmEmail(e.target.checked)}
                        className="h-4 w-4 text-emerald-600 rounded shrink-0"
                      />
                    </label>

                    <label className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer">
                      <span className="text-xs font-medium text-slate-800">
                        Abrir configuración de Nivel Global / Seccional al terminar
                      </span>
                      <input
                        type="checkbox"
                        checked={openPermisosAfterCreate}
                        onChange={(e) => setOpenPermisosAfterCreate(e.target.checked)}
                        className="h-4 w-4 text-emerald-600 rounded shrink-0"
                      />
                    </label>
                  </div>
                </>
              )}
            </div>

            {/* Footer fijo */}
            <div className="bg-white px-5 py-3.5 border-t border-slate-200/80 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={resetNewUserModal}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={creatingUser || !newUserType || (newUserType === 'cruz_verde' && !socorristaData)}
                className="px-5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
              >
                {creatingUser ? 'Creando...' : 'Crear Usuario'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL PERMISOS INDIVIDUALES */}
      {selectedUserForPermisos && (
        <PermisosIndividualesModal
          user={selectedUserForPermisos}
          allUsers={usuarios}
          roles={roles}
          rolePermissions={rolePermissions}
          permissionLabels={permissionLabels}
          seccionales={seccionales}
          onClose={() => setSelectedUserForPermisos(null)}
          onSave={handleSaveCustomPermissions}
        />
      )}
    </div>
  );
}
