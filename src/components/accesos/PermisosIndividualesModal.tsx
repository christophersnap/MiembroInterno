import React, { useState, useMemo } from 'react';
import { 
  Shield, Check, X, Search, RotateCcw,
  CheckCircle2, XCircle, Sliders, Info, HelpCircle,
  FolderDown, Car, Users, Sparkles, Megaphone, FileSpreadsheet, Palette
} from 'lucide-react';

interface PermisosIndividualesModalProps {
  user: any;
  roles: string[];
  rolePermissions: any[];
  permissionLabels: Record<string, string>;
  onClose: () => void;
  onSave: (userId: string, updatedCustomPermissions: Record<string, boolean>, updatedCanUploadFiles: boolean) => Promise<void>;
}

// Categories for clean grouping
const PERMISSION_CATEGORIES: Record<string, { label: string; icon: any; keys: string[] }> = {
  socorristas: {
    label: 'Socorristas y Méritos',
    icon: Users,
    keys: [
      'view_socorristas',
      'edit_socorristas',
      'cambiar_estado_socorrista',
      'descargar_excel_socorristas',
      'ver_imagenes_socorristas',
      'view_carnet',
      'descargar_carnet',
      'view_solicitar_carnet',
      'view_verificar_carnet',
      'view_meritos'
    ]
  },
  vehiculos: {
    label: 'Vehículos y Flota',
    icon: Car,
    keys: [
      'view_vehiculos',
      'edit_vehiculos',
      'view_solicitudes_compra',
      'crear_solicitudes_compra',
      'aprobar_solicitudes_compra',
      'view_solicitudes_combustible',
      'crear_solicitudes_combustible',
      'aprobar_solicitudes_combustible'
    ]
  },
  contenido: {
    label: 'Archivos y Seccionales',
    icon: FolderDown,
    keys: [
      'view_dashboard',
      'view_archivos',
      'subir_archivos',
      'view_cursos',
      'view_seccionales',
      'edit_seccionales',
      'view_directorio',
      'edit_directorio'
    ]
  },
  comunicacion: {
    label: 'Anuncios y Formularios',
    icon: Megaphone,
    keys: [
      'view_anuncios',
      'crear_anuncios',
      'view_formularios',
      'crear_formularios',
      'ver_todos_formularios'
    ]
  },
  admin: {
    label: 'Seguridad y Sistema',
    icon: Shield,
    keys: [
      'ver_todas_seccionales',
      'personalizar_colores',
      'view_config',
      'view_activity',
      'view_accesos'
    ]
  }
};

export default function PermisosIndividualesModal({
  user,
  rolePermissions,
  permissionLabels,
  onClose,
  onSave
}: PermisosIndividualesModalProps) {
  // Current user's base role permissions
  const baseRolePermissions = useMemo(() => {
    const found = rolePermissions.find(rp => rp.role === user.role);
    if (found && found.permissions) return found.permissions;
    
    // Default fallback base permissions if not in table
    if (user.role === 'admin') {
      const allTrue: Record<string, boolean> = {};
      Object.keys(permissionLabels).forEach(k => allTrue[k] = true);
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
      view_solicitudes_combustible: true,
      crear_solicitudes_combustible: true
    };
  }, [user.role, rolePermissions, permissionLabels]);

  // Initial custom overrides state
  const [customOverrides, setCustomOverrides] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = { ...(user.custom_permissions || {}) };
    if (user.can_upload_files && initial.subir_archivos === undefined) {
      initial.subir_archivos = true;
    }
    return initial;
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'todos' | 'permitidos' | 'denegados' | 'personalizados'>('todos');
  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  const [isSaving, setIsSaving] = useState(false);

  // Compute effective access status for each permission
  const getPermissionStatus = (key: string) => {
    const isOverridden = customOverrides[key] !== undefined && customOverrides[key] !== null;
    const baseValue = Boolean(baseRolePermissions[key]);
    const effectiveValue = isOverridden ? Boolean(customOverrides[key]) : baseValue;

    return {
      effectiveValue,
      isOverridden,
      overrideValue: customOverrides[key],
      baseValue
    };
  };

  // Set override: 'role' (remove override), 'allow' (force true), 'deny' (force false)
  const handleSetOverride = (key: string, mode: 'role' | 'allow' | 'deny') => {
    setCustomOverrides(prev => {
      const copy = { ...prev };
      if (mode === 'role') {
        delete copy[key];
      } else if (mode === 'allow') {
        copy[key] = true;
      } else if (mode === 'deny') {
        copy[key] = false;
      }
      return copy;
    });
  };

  const handleResetAllToRole = () => {
    if (confirm(`¿Restablecer todos los permisos de ${user.email} para que hereden exactamente su rol base "${user.role}"?`)) {
      setCustomOverrides({});
    }
  };

  const handleAllowAll = () => {
    const allAllowed: Record<string, boolean> = {};
    Object.keys(permissionLabels).forEach(k => {
      allAllowed[k] = true;
    });
    setCustomOverrides(allAllowed);
  };

  const handleDenyAll = () => {
    const allDenied: Record<string, boolean> = {};
    Object.keys(permissionLabels).forEach(k => {
      allDenied[k] = false;
    });
    setCustomOverrides(allDenied);
  };

  // Filtered permission keys
  const filteredKeys = useMemo(() => {
    let keys = Object.keys(permissionLabels);

    if (selectedCategory !== 'todas') {
      const categoryKeys = PERMISSION_CATEGORIES[selectedCategory]?.keys || [];
      keys = keys.filter(k => categoryKeys.includes(k));
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      keys = keys.filter(k => {
        const label = (permissionLabels[k] || '').toLowerCase();
        return label.includes(q) || k.toLowerCase().includes(q);
      });
    }

    if (activeFilter === 'permitidos') {
      keys = keys.filter(k => getPermissionStatus(k).effectiveValue);
    } else if (activeFilter === 'denegados') {
      keys = keys.filter(k => !getPermissionStatus(k).effectiveValue);
    } else if (activeFilter === 'personalizados') {
      keys = keys.filter(k => getPermissionStatus(k).isOverridden);
    }

    return keys;
  }, [permissionLabels, selectedCategory, searchTerm, activeFilter, customOverrides, baseRolePermissions]);

  // Summary counts
  const summary = useMemo(() => {
    let allowedCount = 0;
    let deniedCount = 0;
    let overrideCount = 0;

    Object.keys(permissionLabels).forEach(k => {
      const status = getPermissionStatus(k);
      if (status.effectiveValue) allowedCount++;
      else deniedCount++;
      if (status.isOverridden) overrideCount++;
    });

    return { allowedCount, deniedCount, overrideCount, totalCount: Object.keys(permissionLabels).length };
  }, [permissionLabels, customOverrides, baseRolePermissions]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const canUploadFiles = customOverrides.subir_archivos !== undefined 
        ? Boolean(customOverrides.subir_archivos) 
        : Boolean(baseRolePermissions.subir_archivos);

      await onSave(user.id, customOverrides, canUploadFiles);
      onClose();
    } catch (err) {
      console.error('Error saving user permissions:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const nombreUsuario = user.socorristas 
    ? `${user.socorristas.primer_nombre} ${user.socorristas.primer_apellido}` 
    : (user.email || 'Usuario');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200/80 animate-in zoom-in-95 duration-150">
        
        {/* HEADER APPLE macOS WINDOW STYLE */}
        <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center border border-slate-200/60 shadow-2xs">
              <Sliders className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-900 tracking-tight">Permisos Individuales de Usuario</h2>
                <span className="px-2 py-0.5 rounded-full text-3xs font-medium bg-slate-100 text-slate-700 border border-slate-200/60 uppercase">
                  Rol: {user.role}
                </span>
              </div>
              <p className="text-2xs text-gray-400">
                {nombreUsuario} &bull; <span className="font-mono text-gray-500">{user.email}</span>
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* QUICK STATS SUBHEADER */}
        <div className="px-6 py-3 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
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
              title="Quitar excepciones y heredar el rol"
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

        {/* SEARCH & CATEGORY BAR */}
        <div className="px-6 py-3 border-b border-slate-100 bg-white shrink-0 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Search Input Apple Style */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar permiso..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none placeholder-slate-400 transition-all"
              />
              {searchTerm && (
                <button 
                  type="button"
                  onClick={() => setSearchTerm('')} 
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="bg-slate-100 p-0.5 rounded-lg flex items-center text-3xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveFilter('todos')}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${activeFilter === 'todos' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Todos ({summary.totalCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('permitidos')}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${activeFilter === 'permitidos' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Permitidos ({summary.allowedCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('denegados')}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${activeFilter === 'denegados' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Bloqueados ({summary.deniedCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('personalizados')}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${activeFilter === 'personalizados' ? 'bg-white text-amber-800 shadow-2xs' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Excepciones ({summary.overrideCount})
              </button>
            </div>
          </div>

          {/* Category Pills (Apple Segmented Bar) */}
          <div className="flex items-center gap-1 overflow-x-auto text-3xs font-semibold pb-0.5">
            <button
              type="button"
              onClick={() => setSelectedCategory('todas')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                selectedCategory === 'todas'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
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
                  className={`px-2.5 py-1 rounded-lg transition-all inline-flex items-center gap-1 cursor-pointer ${
                    selectedCategory === catKey
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  <IconComponent className="w-3 h-3" />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* PERMISSIONS INSET LIST */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
          {filteredKeys.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <HelpCircle className="h-8 w-8 mx-auto text-slate-300 mb-1.5" />
              <p className="font-semibold text-xs text-slate-700">Sin permisos encontrados</p>
              <p className="text-3xs text-slate-400">Modifica el término de búsqueda o cambia de categoría.</p>
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
                    
                    {/* INFO */}
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-semibold text-xs text-slate-900">
                          {label}
                        </span>
                        
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

                    {/* 3-WAY SEGMENTED CONTROL ESTILO APPLE */}
                    <div className="shrink-0 bg-slate-100 p-0.5 rounded-xl border border-slate-200/60 flex items-center">
                      <button
                        type="button"
                        onClick={() => handleSetOverride(key, 'role')}
                        className={`px-2.5 py-1 rounded-lg text-3xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                          !status.isOverridden
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                        title="Heredar del rol base"
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
                        title="Permitir para este usuario"
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
                        title="Bloquear para este usuario"
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

        {/* FOOTER APPLE STYLE */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200/80 flex items-center justify-between shrink-0">
          <div className="text-3xs text-slate-500">
            {summary.overrideCount > 0 ? (
              <span className="font-medium text-amber-800">
                {summary.overrideCount} excepciones configuradas para este usuario
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
