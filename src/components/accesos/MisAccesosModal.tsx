import React, { useMemo, useState } from 'react';
import {
  ShieldCheck,
  X,
  Search,
  Check,
  Users,
  Truck,
  Megaphone,
  FolderOpen,
  Settings,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface MisAccesosModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PermissionMeta {
  label: string;
  desc: string;
  category: 'Socorristas y Méritos' | 'Solicitudes y Flota' | 'Comunicación y Formularios' | 'Archivos y Red' | 'Administración';
}

const PERMISSION_DESCRIPTIONS: Record<string, PermissionMeta> = {
  // Socorristas y Méritos
  view_socorristas: {
    label: 'Padrón de Socorristas',
    desc: 'Consultar el listado de personal voluntario.',
    category: 'Socorristas y Méritos',
  },
  add_socorristas: {
    label: 'Agregar Socorristas',
    desc: 'Registrar nuevos ingresos de personal.',
    category: 'Socorristas y Méritos',
  },
  edit_socorristas: {
    label: 'Editar Fichas de Socorristas',
    desc: 'Actualizar datos personales, cargos y asignaciones.',
    category: 'Socorristas y Méritos',
  },
  subir_expediente_socorrista: {
    label: 'Subir Expediente Digital',
    desc: 'Cargar CV, antecedentes penales, solvencia policial y atestados.',
    category: 'Socorristas y Méritos',
  },
  ver_expediente_socorrista: {
    label: 'Previsualizar Expediente en Línea',
    desc: 'Abrir documentos del expediente digital dentro del sistema.',
    category: 'Socorristas y Méritos',
  },
  descargar_expediente_socorrista: {
    label: 'Descargar Expediente Digital',
    desc: 'Descargar archivos adjuntos y versiones del expediente.',
    category: 'Socorristas y Méritos',
  },
  cambiar_estado_socorrista: {
    label: 'Activar / Desactivar Socorristas',
    desc: 'Gestionar el estado operativo del personal.',
    category: 'Socorristas y Méritos',
  },
  descargar_excel_socorristas: {
    label: 'Exportación de Padrón a Excel',
    desc: 'Descargar listados y reportes del personal en hoja de cálculo.',
    category: 'Socorristas y Méritos',
  },
  view_carnet: {
    label: 'Generador de Carnet Digital',
    desc: 'Emitir credenciales institucionales digitales.',
    category: 'Socorristas y Méritos',
  },
  ver_imagenes_socorristas: {
    label: 'Visualización de Fotos y Carnets',
    desc: 'Ver fotografías de perfil y carnets generados.',
    category: 'Socorristas y Méritos',
  },
  descargar_carnet: {
    label: 'Descargar Carnet',
    desc: 'Guardar credenciales digitales en imagen o PDF.',
    category: 'Socorristas y Méritos',
  },
  view_solicitar_carnet: {
    label: 'Solicitar Carnet',
    desc: 'Enviar solicitudes de carnetización con fotografía oficial.',
    category: 'Socorristas y Méritos',
  },
  view_verificar_carnet: {
    label: 'Verificar Carnet',
    desc: 'Validar autenticidad y vigencia de credenciales.',
    category: 'Socorristas y Méritos',
  },
  view_meritos: {
    label: 'Méritos y Condecoraciones',
    desc: 'Consultar premios, misiones humanitarias y enlaces de prensa.',
    category: 'Socorristas y Méritos',
  },
  edit_meritos: {
    label: 'Registrar y Editar Méritos',
    desc: 'Crear reconocimientos, condecoraciones y anexar notas de medios.',
    category: 'Socorristas y Méritos',
  },

  // Solicitudes y Flota
  view_vehiculos: {
    label: 'Flota de Vehículos',
    desc: 'Consultar unidades operativas, ambulancias y estado mecánico.',
    category: 'Solicitudes y Flota',
  },
  edit_vehiculos: {
    label: 'Gestión de Vehículos',
    desc: 'Registrar y actualizar unidades y mantenimientos.',
    category: 'Solicitudes y Flota',
  },
  view_solicitudes_compra: {
    label: 'Solicitudes de Compra y Mantenimiento',
    desc: 'Acceso al módulo de requisiciones de bienes y repuestos.',
    category: 'Solicitudes y Flota',
  },
  crear_solicitudes_compra: {
    label: 'Crear Solicitudes de Compra',
    desc: 'Enviar nuevas solicitudes de compra y cotizaciones.',
    category: 'Solicitudes y Flota',
  },
  edit_solicitudes_compra: {
    label: 'Gestionar Solicitudes de Compra',
    desc: 'Actualizar seguimiento administrativo de compras.',
    category: 'Solicitudes y Flota',
  },
  aprobar_solicitudes_compra: {
    label: 'Autorizar Solicitudes de Compra',
    desc: 'Aprobar o denegar requisiciones de compra.',
    category: 'Solicitudes y Flota',
  },
  view_compra_historial: {
    label: 'Historial de Compras',
    desc: 'Consultar historial y estado de solicitudes de compra.',
    category: 'Solicitudes y Flota',
  },
  view_compra_plantillas: {
    label: 'Plantillas de Compra',
    desc: 'Configurar formato PDF y correos de solicitudes de compra.',
    category: 'Solicitudes y Flota',
  },
  view_solicitudes_combustible: {
    label: 'Solicitudes de Combustible',
    desc: 'Acceso al módulo de dotación de combustible.',
    category: 'Solicitudes y Flota',
  },
  crear_solicitudes_combustible: {
    label: 'Crear Solicitud de Combustible',
    desc: 'Registrar nuevos pedidos de combustible para unidades.',
    category: 'Solicitudes y Flota',
  },
  edit_solicitudes_combustible: {
    label: 'Gestionar Solicitudes de Combustible',
    desc: 'Actualizar estado y despacho de solicitudes de combustible.',
    category: 'Solicitudes y Flota',
  },
  aprobar_solicitudes_combustible: {
    label: 'Autorizar Solicitudes de Combustible',
    desc: 'Aprobar o denegar vales de combustible.',
    category: 'Solicitudes y Flota',
  },
  view_combustible_historial: {
    label: 'Historial de Combustible',
    desc: 'Consultar el historial de pedidos de combustible.',
    category: 'Solicitudes y Flota',
  },
  view_combustible_plantillas: {
    label: 'Plantillas de Combustible',
    desc: 'Configurar formato PDF y correos de combustible.',
    category: 'Solicitudes y Flota',
  },
  ver_previsualizacion_pdf: {
    label: 'Previsualización del PDF Oficial',
    desc: 'Visualizar e imprimir hojas oficiales en PDF de solicitudes.',
    category: 'Solicitudes y Flota',
  },
  view_solicitudes_carnet: {
    label: 'Solicitudes de Carnet en Gestión Logística',
    desc: 'Ver y filtrar solicitudes de carnetización por seccional y fecha.',
    category: 'Solicitudes y Flota',
  },
  edit_solicitudes_carnet: {
    label: 'Gestionar Solicitudes de Carnet',
    desc: 'Actualizar estado (pendiente, observada, completada) de carnets.',
    category: 'Solicitudes y Flota',
  },

  // Comunicación y Formularios
  view_anuncios: {
    label: 'Anuncios Institucionales',
    desc: 'Consultar comunicados y boletines oficiales.',
    category: 'Comunicación y Formularios',
  },
  crear_anuncios: {
    label: 'Publicar Anuncios',
    desc: 'Crear avisos institucionales y notificaciones.',
    category: 'Comunicación y Formularios',
  },
  edit_anuncios: {
    label: 'Editar Anuncios',
    desc: 'Modificar comunicados y banners informativos.',
    category: 'Comunicación y Formularios',
  },
  view_noticias_ajustes: {
    label: 'Sección de Noticias',
    desc: 'Acceder a la pestaña de noticias y configuración del banner.',
    category: 'Comunicación y Formularios',
  },
  edit_noticias_banner: {
    label: 'Editor del Banner Slide de Noticias',
    desc: 'Subir imágenes, redactar contenido y configurar tiempos del carrusel.',
    category: 'Comunicación y Formularios',
  },
  view_formularios: {
    label: 'Formularios e Inscripciones',
    desc: 'Consultar formularios institucionales y respuestas.',
    category: 'Comunicación y Formularios',
  },
  crear_formularios: {
    label: 'Crear Formularios',
    desc: 'Diseñar nuevos formularios institucionales.',
    category: 'Comunicación y Formularios',
  },
  edit_formularios: {
    label: 'Editar Formularios y Respuestas',
    desc: 'Actualizar formularios existentes y revisar envíos.',
    category: 'Comunicación y Formularios',
  },
  ver_todos_formularios: {
    label: 'Formularios Globales',
    desc: 'Acceso a todos los formularios registrados a nivel nacional.',
    category: 'Comunicación y Formularios',
  },

  // Archivos y Red
  view_dashboard: {
    label: 'Dashboard Institucional',
    desc: 'Acceso al panel general, noticias y métricas.',
    category: 'Archivos y Red',
  },
  view_archivos: {
    label: 'Repositorio de Archivos',
    desc: 'Ver y descargar documentos oficiales y circulares.',
    category: 'Archivos y Red',
  },
  subir_archivos: {
    label: 'Subir Archivos Institucionales',
    desc: 'Cargar documentos y formatos al repositorio.',
    category: 'Archivos y Red',
  },
  edit_archivos: {
    label: 'Administrar Archivos',
    desc: 'Editar y organizar documentos institucionales.',
    category: 'Archivos y Red',
  },
  view_cursos: {
    label: 'Academia y Cursos',
    desc: 'Gestión y consulta de capacitaciones y certificaciones.',
    category: 'Archivos y Red',
  },
  view_seccionales: {
    label: 'Seccionales',
    desc: 'Consultar directorio y datos de seccionales en el país.',
    category: 'Archivos y Red',
  },
  edit_seccionales: {
    label: 'Editar Seccionales',
    desc: 'Administrar información y autoridades de seccionales.',
    category: 'Archivos y Red',
  },
  view_directorio: {
    label: 'Directorio Telefónico',
    desc: 'Consultar contactos institucionales y líneas operativas.',
    category: 'Archivos y Red',
  },
  edit_directorio: {
    label: 'Editar Directorio Telefónico',
    desc: 'Actualizar números de contacto y responsables.',
    category: 'Archivos y Red',
  },

  // Administración
  ver_todas_seccionales: {
    label: 'Ámbito Nacional',
    desc: 'Visualizar y operar información de todas las seccionales.',
    category: 'Administración',
  },
  ver_personas_conectadas: {
    label: 'Detalle de Personas Conectadas',
    desc: 'Abrir la lista en vivo de usuarios conectados actualmente.',
    category: 'Administración',
  },
  personalizar_colores: {
    label: 'Personalización Visual',
    desc: 'Ajustar colores institucionales y apariencia del sistema.',
    category: 'Administración',
  },
  view_config: {
    label: 'Ajustes de Verificación',
    desc: 'Configurar parámetros institucionales y logotipos.',
    category: 'Administración',
  },
  view_activity: {
    label: 'Registro de Actividad',
    desc: 'Consultar la bitácora de auditoría del sistema.',
    category: 'Administración',
  },
  view_accesos: {
    label: 'Gestión de Accesos y Usuarios',
    desc: 'Administrar cuentas, roles, solicitudes y permisos.',
    category: 'Administración',
  },
};

const CATEGORY_ORDER: PermissionMeta['category'][] = [
  'Socorristas y Méritos',
  'Solicitudes y Flota',
  'Comunicación y Formularios',
  'Archivos y Red',
  'Administración',
];

const CATEGORY_ICON: Record<PermissionMeta['category'], any> = {
  'Socorristas y Méritos': Users,
  'Solicitudes y Flota': Truck,
  'Comunicación y Formularios': Megaphone,
  'Archivos y Red': FolderOpen,
  'Administración': Settings,
};

export default function MisAccesosModal({ isOpen, onClose }: MisAccesosModalProps) {
  const { user, userName, role, permissions, userSeccionalNombre } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');

  const grantedEntries = useMemo(() => {
    return Object.entries(PERMISSION_DESCRIPTIONS).filter(([key]) =>
      role === 'admin' ? true : Boolean(permissions[key])
    );
  }, [permissions, role]);

  const availableCategories = useMemo(() => {
    return CATEGORY_ORDER.filter((cat) =>
      grantedEntries.some(([, meta]) => meta.category === cat)
    );
  }, [grantedEntries]);

  const filteredEntries = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return grantedEntries.filter(([, meta]) => {
      if (selectedCategory !== 'Todas' && meta.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        meta.label.toLowerCase().includes(q) ||
        meta.desc.toLowerCase().includes(q) ||
        meta.category.toLowerCase().includes(q)
      );
    });
  }, [grantedEntries, searchTerm, selectedCategory]);

  const groupedByCategory = useMemo(() => {
    return availableCategories
      .map((cat) => ({
        category: cat,
        items: filteredEntries.filter(([, meta]) => meta.category === cat),
      }))
      .filter((group) => group.items.length > 0);
  }, [availableCategories, filteredEntries]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="bg-[#F2F2F7] rounded-[28px] shadow-2xl max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden border border-white/60 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera estilo Apple iOS Sheet */}
        <div className="px-6 pt-5 pb-4 bg-white/95 backdrop-blur-xl border-b border-slate-200/70 shrink-0 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/12 text-emerald-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold tracking-tight text-slate-900 leading-snug">
                  Mis Permisos Activos
                </h2>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {userName || user?.email} · {role === 'admin' ? 'Administrador' : role || 'Usuario'}
                  {userSeccionalNombre ? ` · ${userSeccionalNombre}` : ''}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Buscador iOS + Selector de Categorías activas */}
          <div className="space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar permiso habilitado..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-100/90 focus:bg-white text-slate-900 placeholder-slate-400 rounded-xl border border-transparent focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/15 outline-none transition-all"
              />
            </div>

            {availableCategories.length > 1 && (
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('Todas')}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                    selectedCategory === 'Todas'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todas ({grantedEntries.length})
                </button>
                {availableCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Lista Agrupada Estilo iOS Inset Grouped */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">
          {groupedByCategory.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/70 p-10 text-center">
              <p className="text-sm font-semibold text-slate-800">Sin coincidencias</p>
              <p className="text-xs text-slate-500 mt-1">
                No se encontraron permisos activos con el filtro aplicado.
              </p>
            </div>
          ) : (
            groupedByCategory.map((group) => {
              const CatIcon = CATEGORY_ICON[group.category];
              return (
                <section key={group.category} className="space-y-1.5">
                  <div className="flex items-center justify-between px-3">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <CatIcon className="w-3.5 h-3.5 text-slate-400" />
                      <span>{group.category}</span>
                    </h3>
                    <span className="text-[11px] font-medium text-slate-400 tabular-nums">
                      {group.items.length}
                    </span>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200/70 divide-y divide-slate-100 overflow-hidden shadow-2xs">
                    {group.items.map(([key, meta]) => (
                      <div
                        key={key}
                        className="px-4 py-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-slate-900 leading-snug">
                            {meta.label}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                            {meta.desc}
                          </p>
                        </div>

                        <div
                          className="w-6 h-6 rounded-full bg-emerald-500/12 text-emerald-600 flex items-center justify-center shrink-0"
                          title="Activo"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </div>

        {/* Footer limpio */}
        <div className="px-6 py-3.5 bg-white/95 backdrop-blur-xl border-t border-slate-200/70 flex items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-slate-500 tabular-nums">
            {grantedEntries.length} {grantedEntries.length === 1 ? 'función habilitada' : 'funciones habilitadas'} en tu cuenta
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
