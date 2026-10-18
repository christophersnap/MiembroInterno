import React, { useState } from 'react';
import { 
  Shield, Check, X, CheckCircle2, XCircle, Search, 
  HelpCircle, User, Info, FolderDown, Car, Users, Sparkles
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface MisAccesosModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PERMISSION_DESCRIPTIONS: Record<string, { label: string; desc: string; category: string }> = {
  view_dashboard: { label: 'Panel Institucional (Dashboard)', desc: 'Acceso a estadísticas, noticias y anuncios.', category: 'Contenido' },
  view_archivos: { label: 'Descarga de Archivos', desc: 'Ver y descargar documentos oficiales y formatos.', category: 'Contenido' },
  subir_archivos: { label: 'Subir Archivos Institucionales', desc: 'Cargar nuevos documentos y circulares al repositorio.', category: 'Contenido' },
  view_anuncios: { label: 'Ver Anuncios Institucionales', desc: 'Acceso a consultar comunicados, boletines y noticias del sistema.', category: 'Comunicación' },
  crear_anuncios: { label: 'Publicar y Gestionar Anuncios', desc: 'Crear avisos, alertas urgentes y banners con archivos adjuntos.', category: 'Comunicación' },
  view_formularios: { label: 'Ver Formularios e Inscripciones', desc: 'Consultar formularios activos, enlaces y lista de respuestas.', category: 'Operaciones' },
  crear_formularios: { label: 'Crear Formularios (Fluent Forms)', desc: 'Diseñar formularios con campos institucionales y control de acceso.', category: 'Operaciones' },
  view_socorristas: { label: 'Padrón de Socorristas', desc: 'Consultar el listado de personal voluntario.', category: 'Socorristas' },
  edit_socorristas: { label: 'Edición de Socorristas', desc: 'Modificar fichas, datos personales y cargos.', category: 'Socorristas' },
  cambiar_estado_socorrista: { label: 'Activar/Desactivar Socorristas', desc: 'Gestionar el estado activo/inactivo del personal.', category: 'Socorristas' },
  descargar_excel_socorristas: { label: 'Exportación a Excel', desc: 'Descargar reportes del personal en hoja de cálculo.', category: 'Socorristas' },
  view_carnet: { label: 'Generación de Carnet Digital', desc: 'Generar credenciales institucionales digitales.', category: 'Socorristas' },
  ver_imagenes_socorristas: { label: 'Visualización de Carnets y Fotos', desc: 'Ver carnets generados y fotografías.', category: 'Socorristas' },
  descargar_carnet: { label: 'Descargar Carnet', desc: 'Descargar archivos de imagen de credenciales.', category: 'Socorristas' },
  view_vehiculos: { label: 'Flota de Vehículos', desc: 'Consultar vehículos institucionales y ambulancias.', category: 'Vehículos' },
  edit_vehiculos: { label: 'Edición de Vehículos', desc: 'Registrar y modificar vehículos y mantenimientos.', category: 'Vehículos' },
  view_solicitudes_compra: { label: 'Solicitudes de Compra', desc: 'Consultar solicitudes de compras y refacciones.', category: 'Vehículos' },
  crear_solicitudes_compra: { label: 'Crear Solicitudes de Compra', desc: 'Enviar nuevas solicitudes de compra para aprobación.', category: 'Vehículos' },
  aprobar_solicitudes_compra: { label: 'Aprobación de Compras', desc: 'Autorizar o denegar compras institucionales.', category: 'Vehículos' },
  view_solicitudes_combustible: { label: 'Solicitudes de Combustible', desc: 'Ver pedidos de combustible para unidades.', category: 'Vehículos' },
  crear_solicitudes_combustible: { label: 'Crear Pedido de Combustible', desc: 'Solicitar vales y despacho de combustible.', category: 'Vehículos' },
  aprobar_solicitudes_combustible: { label: 'Aprobación de Combustible', desc: 'Autorizar vales y combustible.', category: 'Vehículos' },
  view_directorio: { label: 'Directorio Telefónico', desc: 'Consultar contactos institucionales y de emergencia.', category: 'General' },
  edit_directorio: { label: 'Edición de Directorio', desc: 'Modificar contactos institucionales.', category: 'General' },
  view_cursos: { label: 'Academia y Cursos', desc: 'Gestión de capacitaciones y cursos de socorrismo.', category: 'General' },
  view_seccionales: { label: 'Ver Seccionales', desc: 'Consultar información de las seccionales.', category: 'General' },
  edit_seccionales: { label: 'Edición de Seccionales', desc: 'Administrar seccionales del país.', category: 'General' },
  ver_todas_seccionales: { label: 'Ámbito Nacional', desc: 'Acceso a nivel nacional para todas las seccionales.', category: 'Administración' },
  personalizar_colores: { label: 'Personalización de Colores', desc: 'Modificar paleta visual, tonos de botones y apariencia de marca.', category: 'Administración' },
  view_config: { label: 'Ajustes de Verificación', desc: 'Configurar parámetros y logotipos institucionales.', category: 'Administración' },
  view_accesos: { label: 'Gestión de Usuarios y Accesos', desc: 'Administrar cuentas, contraseñas y permisos.', category: 'Administración' },
  view_activity: { label: 'Registro de Actividad (Auditoría)', desc: 'Ver historial de cambios en el sistema.', category: 'Administración' }
};

export default function MisAccesosModal({ isOpen, onClose }: MisAccesosModalProps) {
  const { user, userName, role, permissions, customPermissions, userSeccionalNombre } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'todos' | 'habilitados' | 'restringidos' | 'excepciones'>('todos');

  if (!isOpen) return null;

  const permissionEntries = Object.entries(PERMISSION_DESCRIPTIONS);

  const totalExcepciones = Object.keys(customPermissions || {}).length;
  const totalHabilitados = permissionEntries.filter(([k]) => Boolean(permissions[k])).length;
  const totalRestringidos = permissionEntries.length - totalHabilitados;

  const filteredEntries = permissionEntries.filter(([key, meta]) => {
    const isGranted = Boolean(permissions[key]);
    const hasOverride = customPermissions && key in customPermissions;
    
    if (filter === 'habilitados' && !isGranted) return false;
    if (filter === 'restringidos' && isGranted) return false;
    if (filter === 'excepciones' && !hasOverride) return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return meta.label.toLowerCase().includes(q) || 
             meta.desc.toLowerCase().includes(q) || 
             meta.category.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* HEADER */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-primary text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md">
              <Shield className="h-6 w-6 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">Mis Accesos y Permisos</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                {userName || user?.email} &bull; <span className="font-semibold text-emerald-300 uppercase">{role === 'admin' ? 'Administrador' : role}</span>
                {userSeccionalNombre && ` (${userSeccionalNombre})`}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* SUMMARY BAR */}
        <div className="px-6 py-3 bg-slate-50 border-b border-gray-200 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-2xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                {totalHabilitados} Módulos Habilitados
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-2xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                <XCircle className="w-3.5 h-3.5 mr-1 text-slate-500" />
                {totalRestringidos} No Habilitados
              </span>
              {totalExcepciones > 0 && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-2xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-600" />
                  {totalExcepciones} {totalExcepciones === 1 ? 'Excepción personal' : 'Excepciones personales'}
                </span>
              )}
            </div>
            <div className="text-2xs text-gray-500">
              Permisos individuales sobreescriben la configuración de tu rol.
            </div>
          </div>
        </div>

        {/* SEARCH & FILTER */}
        <div className="px-6 py-2.5 border-b border-gray-200 bg-white shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar función o módulo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1 text-xs border border-gray-300 rounded-lg focus:ring-primary focus:border-primary placeholder-gray-400"
            />
          </div>

          <div className="flex items-center gap-1 text-2xs bg-gray-100 p-0.5 rounded-md self-end sm:self-auto flex-wrap">
            <button
              onClick={() => setFilter('todos')}
              className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-all ${filter === 'todos' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500'}`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilter('habilitados')}
              className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-all ${filter === 'habilitados' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-gray-500'}`}
            >
              Habilitados ({totalHabilitados})
            </button>
            <button
              onClick={() => setFilter('restringidos')}
              className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-all ${filter === 'restringidos' ? 'bg-white text-rose-700 shadow-2xs' : 'text-gray-500'}`}
            >
              Restringidos ({totalRestringidos})
            </button>
            {totalExcepciones > 0 && (
              <button
                onClick={() => setFilter('excepciones')}
                className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-all ${filter === 'excepciones' ? 'bg-white text-amber-800 shadow-2xs' : 'text-amber-700'}`}
              >
                Excepciones ({totalExcepciones})
              </button>
            )}
          </div>
        </div>

        {/* ACCESS LIST */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2.5">
          {filteredEntries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <HelpCircle className="h-8 w-8 mx-auto text-gray-300 mb-1" />
              <p className="font-semibold text-xs">No se encontraron funciones con ese criterio</p>
            </div>
          ) : (
            filteredEntries.map(([key, meta]) => {
              const isGranted = Boolean(permissions[key]);
              const hasIndividualOverride = customPermissions && key in customPermissions;
              const overrideValue = hasIndividualOverride ? customPermissions[key] : null;

              return (
                <div 
                  key={key}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                    hasIndividualOverride
                      ? (overrideValue ? 'bg-amber-50/50 border-amber-300' : 'bg-rose-50/40 border-rose-200')
                      : (isGranted 
                          ? 'bg-emerald-50/40 border-emerald-200' 
                          : 'bg-gray-50/70 border-gray-200 opacity-75')
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-gray-900">{meta.label}</span>
                      <span className="text-3xs px-1.5 py-0.2 rounded font-medium bg-gray-200 text-gray-700">
                        {meta.category}
                      </span>
                      {hasIndividualOverride && (
                        <span className="text-3xs px-1.5 py-0.2 rounded font-bold bg-amber-200 text-amber-900 flex items-center gap-0.5">
                          <Sparkles className="w-2.5 h-2.5 text-amber-700" />
                          Excepción Individual
                        </span>
                      )}
                    </div>
                    <p className="text-2xs text-gray-500 mt-0.5">{meta.desc}</p>
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5">
                    {hasIndividualOverride ? (
                      overrideValue ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                          <Check className="w-3 h-3 mr-1 text-emerald-600" />
                          Habilitado (Personal)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs">
                          <X className="w-3 h-3 mr-1 text-rose-600" />
                          Bloqueado (Personal)
                        </span>
                      )
                    ) : (
                      isGranted ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <Check className="w-3 h-3 mr-1 text-emerald-600" />
                          Habilitado (Rol)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-medium bg-gray-200 text-gray-600 border border-gray-300">
                          <X className="w-3 h-3 mr-1 text-gray-400" />
                          No disponible (Rol)
                        </span>
                      )
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 text-2xs text-gray-500">
            <Info className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>Si requieres acceso a funciones adicionales, contacta a un administrador.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer self-end sm:self-auto"
          >
            Entendido
          </button>
        </div>

      </div>
    </div>
  );
}
