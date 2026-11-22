import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Plus,
  Download,
  Eye,
  Filter,
  Shield,
  Briefcase,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  X,
  Columns,
  Bike,
  Check,
  IdCard,
  RefreshCw,
  LayoutGrid,
  List,
  User,
  MapPin,
  Phone,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/logger';
import WatermarkImage from '../components/WatermarkImage';
import { useAuth } from '../contexts/AuthContext';
import { parseCargosSecundarios } from '../utils/cargosCatalog';
import SocorristasExcelModal, { ExcelExportPreset } from '../components/socorristas/SocorristasExcelModal';
import {
  ConoceSocorristaExtraData,
  extractKycFromSocorrista,
  validateConoceSocorrista,
} from '../utils/conoceSocorrista';

const SteeringWheelIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-label="Licencia de Vehículo"
  >
    <title>Licencia de Vehículo</title>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="2" />
    <line x1="12" y1="14" x2="12" y2="22" />
    <line x1="10.2" y1="10.7" x2="3.3" y2="6.6" />
    <line x1="13.8" y1="10.7" x2="20.7" y2="6.6" />
  </svg>
);

const UserDisabledIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.1"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="8.25" r="3.25" />
    <path d="M6.2 19a5.8 5.8 0 0 1 11.6 0" />
    <circle cx="12" cy="12" r="10" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" strokeWidth="2.3" />
  </svg>
);

type ViewMode = 'list' | 'grid';

export default function Socorristas() {
  const {
    role,
    permissions,
    userSeccionalId,
    userSeccionalNombre,
    userName,
    watermarkEnabled,
    canAddAnySocorrista,
    canAccessSeccionalSocorristas,
    getAllowedSocorristaSeccionalIds,
  } = useAuth();

  const [socorristas, setSocorristas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Viewport y orientación para optimizar vista en teléfono vertical, horizontal, tablet y escritorio
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  }));

  useEffect(() => {
    const updateViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);
    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
    };
  }, []);

  const isLandscape = viewport.width > viewport.height;
  const isPhonePortrait = viewport.width < 640 && !isLandscape;
  const isPhoneLandscape = isLandscape && viewport.height <= 500 && viewport.width < 1024;

  // Modo de vista (Listado vs Mosaico/Cards). En teléfono vertical se mantiene únicamente Listado.
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('socorristas_view_mode');
    return saved === 'grid' || saved === 'list' ? saved : 'list';
  });

  // Modal de confirmación para activar o inactivar un elemento
  const [confirmEstadoTarget, setConfirmEstadoTarget] = useState<{
    id: number;
    nombre: string;
    carnet: string;
    currentEstado: string;
  } | null>(null);
  const [updatingEstado, setUpdatingEstado] = useState(false);

  useEffect(() => {
    localStorage.setItem('socorristas_view_mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!confirmEstadoTarget || updatingEstado) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmEstadoTarget(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmEstadoTarget, updatingEstado]);

  // Filtros persistentes en sesión
  const [searchTerm, setSearchTerm] = useState(() => sessionStorage.getItem('socorristas_searchTerm') || '');
  const [filterEstado, setFilterEstado] = useState(() => sessionStorage.getItem('socorristas_filterEstado') || 'Todos');
  const [filterSeccional, setFilterSeccional] = useState(() => sessionStorage.getItem('socorristas_filterSeccional') || 'Todas');
  const [filterCargoInst, setFilterCargoInst] = useState(() => sessionStorage.getItem('socorristas_filterCargoInst') || 'Todos');
  const [filterCargoAdmin, setFilterCargoAdmin] = useState(() => sessionStorage.getItem('socorristas_filterCargoAdmin') || 'Todos');
  const [filterCarnetGenerado, setFilterCarnetGenerado] = useState(() => sessionStorage.getItem('socorristas_filterCarnetGenerado') || 'Todos');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(() => sessionStorage.getItem('socorristas_showAdvancedFilters') === 'true');

  const defaultColumns = {
    elemento: true,
    carnet: true,
    cargoInstitucional: true,
    cargoAdministrativo: true,
    seccional: true,
    estado: true,
    motorista: true,
    licencias: true,
    carnetDigital: true,
  };
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('socorristas_columns');
    try {
      return saved ? { ...defaultColumns, ...JSON.parse(saved) } : defaultColumns;
    } catch {
      return defaultColumns;
    }
  });
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const columnDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('socorristas_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    if (!showColumnDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (columnDropdownRef.current && !columnDropdownRef.current.contains(e.target as Node)) {
        setShowColumnDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColumnDropdown]);

  const [exporting, setExporting] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [previewCarnet, setPreviewCarnet] = useState<{ url: string; name: string } | null>(null);

  // Paginación y ordenamiento
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'primer_nombre',
    direction: 'asc',
  });

  const notifyAction = (text: string, type: 'success' | 'error' = 'success') => {
    setActionNotice({ type, text });
    setTimeout(() => {
      setActionNotice((prev) => (prev?.text === text ? null : prev));
    }, 3500);
  };

  useEffect(() => {
    sessionStorage.setItem('socorristas_searchTerm', searchTerm);
    sessionStorage.setItem('socorristas_filterEstado', filterEstado);
    sessionStorage.setItem('socorristas_filterSeccional', filterSeccional);
    sessionStorage.setItem('socorristas_filterCargoInst', filterCargoInst);
    sessionStorage.setItem('socorristas_filterCargoAdmin', filterCargoAdmin);
    sessionStorage.setItem('socorristas_filterCarnetGenerado', filterCarnetGenerado);
    sessionStorage.setItem('socorristas_showAdvancedFilters', showAdvancedFilters.toString());
  }, [
    searchTerm,
    filterEstado,
    filterSeccional,
    filterCargoInst,
    filterCargoAdmin,
    filterCarnetGenerado,
    showAdvancedFilters,
  ]);

  useEffect(() => {
    fetchSocorristas();
  }, []);

  const fetchSocorristas = async (manualRetry = false) => {
    if (manualRetry) setLoading(true);
    try {
      setErrorMsg(null);
      const allowedSeccionalIds = getAllowedSocorristaSeccionalIds();
      if (allowedSeccionalIds !== 'all' && allowedSeccionalIds.length === 0) {
        setSocorristas([]);
        setLoading(false);
        return;
      }

      const buildSocorristasQuery = (includeRelation: boolean) => {
        let q = supabase
          .from('socorristas')
          .select(includeRelation ? '*, seccionales ( nombre )' : '*');
        if (allowedSeccionalIds !== 'all') {
          q = q.in('seccional_id', allowedSeccionalIds);
        }
        return q;
      };

      let rows: any[] | null = null;
      let lastError: any = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await buildSocorristasQuery(true);
        if (!error && data) {
          rows = data;
          lastError = null;
          break;
        }
        lastError = error;
        const errMsg = String(error?.message || '').toLowerCase();
        if (error?.code === 'PGRST002' || errMsg.includes('schema cache')) {
          await new Promise((r) => setTimeout(r, 900 * (attempt + 1)));
          continue;
        }
        break;
      }

      let seccionalesMap: Record<number, string> = {};
      if (!rows) {
        const [plainSoc, plainSec] = await Promise.all([
          buildSocorristasQuery(false),
          supabase.from('seccionales').select('id, nombre'),
        ]);
        if (!plainSoc.error && plainSoc.data) {
          rows = plainSoc.data;
          lastError = null;
          (plainSec.data || []).forEach((sec: any) => {
            seccionalesMap[Number(sec.id)] = sec.nombre;
          });
        }
      }

      if (!rows) {
        throw lastError || new Error('No se pudieron cargar los registros de personal.');
      }

      const cargosBackupMap: Record<number, string[]> = {};
      const kycBackupMap: Record<number, Partial<ConoceSocorristaExtraData>> = {};
      try {
        const { data: backupRows } = await supabase
          .from('configuracion')
          .select('clave, valor')
          .or('clave.like.socorrista_cargos_%,clave.like.socorrista_kyc_%');

        if (backupRows) {
          backupRows.forEach((row) => {
            if (!row.valor) return;
            if (row.clave.startsWith('socorrista_cargos_')) {
              const idNum = Number(row.clave.replace('socorrista_cargos_', ''));
              if (!Number.isNaN(idNum)) {
                cargosBackupMap[idNum] = parseCargosSecundarios(row.valor);
              }
            } else if (row.clave.startsWith('socorrista_kyc_')) {
              const idNum = Number(row.clave.replace('socorrista_kyc_', ''));
              if (!Number.isNaN(idNum)) {
                try {
                  kycBackupMap[idNum] = JSON.parse(row.valor);
                } catch {}
              }
            }
          });
        }
      } catch {}

      const formattedData = rows.map((s) => {
        const directSecundarios = parseCargosSecundarios(s.cargos_secundarios);
        const mergedKyc = extractKycFromSocorrista(s, kycBackupMap[s.id]);
        const relNombre = Array.isArray(s.seccionales)
          ? s.seccionales[0]?.nombre
          : s.seccionales?.nombre;
        return {
          ...s,
          ...mergedKyc,
          seccional_nombre: relNombre || seccionalesMap[Number(s.seccional_id)] || 'N/A',
          cargos_secundarios:
            directSecundarios.length > 0 ? directSecundarios : cargosBackupMap[s.id] || [],
        };
      });

      setSocorristas(formattedData);
    } catch (err: any) {
      console.error('Error fetching socorristas:', err);
      const rawMessage = String(err?.message || '');
      if (rawMessage.toLowerCase().includes('schema cache')) {
        setErrorMsg(
          'La base de datos está terminando de actualizar su estructura. Presiona Reintentar en unos segundos.'
        );
      } else {
        setErrorMsg(rawMessage || 'Error al consultar la base de datos.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getDatasetByPreset = (
    preset: ExcelExportPreset,
    allAllowed: any[],
    currentFiltered: any[]
  ): any[] => {
    switch (preset) {
      case 'filtro_actual':
        return currentFiltered;
      case 'activos':
        return allAllowed.filter((s) => s.estado === 'Activo');
      case 'inactivos':
        return allAllowed.filter((s) => s.estado === 'Inactivo');
      case 'con_carnet':
        return allAllowed.filter((s) => Boolean(s.carnet_generado_url));
      case 'sin_carnet':
        return allAllowed.filter((s) => !s.carnet_generado_url);
      case 'con_foto':
        return allAllowed.filter((s) => Boolean(s.foto_url));
      case 'sin_foto':
        return allAllowed.filter((s) => !s.foto_url);
      case 'motoristas':
        return allAllowed.filter((s) => Boolean(s.motorista_autorizado));
      case 'ficha_completa':
        return allAllowed.filter((s) => validateConoceSocorrista(s).isComplete);
      case 'ficha_pendiente':
        return allAllowed.filter((s) => !validateConoceSocorrista(s).isComplete);
      case 'todos':
      default:
        return allAllowed;
    }
  };

  const handleConfirmExport = async (preset: ExcelExportPreset, includeExtendedFields: boolean) => {
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const allowedBase = socorristas.filter(
        (s) => allowedSeccionalIds === 'all' || allowedSeccionalIds.includes(Number(s.seccional_id))
      );
      const targetRows = getDatasetByPreset(preset, allowedBase, filteredData);

      const dataToExport = targetRows.map((s) => {
        const baseRow: Record<string, any> = {
          Carnet: s.carnet || '',
          'Primer Nombre': s.primer_nombre || '',
          'Segundo Nombre': s.segundo_nombre || '',
          'Primer Apellido': s.primer_apellido || '',
          'Segundo Apellido': s.segundo_apellido || '',
          Seccional: s.seccional_nombre || 'N/A',
          Estado: s.estado || '',
          'Cargo Institucional': s.cargo_institucional || 'N/A',
          'Cargos Secundarios': parseCargosSecundarios(s.cargos_secundarios).join(' | ') || 'N/A',
          'Cargo Administrativo': s.cargo_administrativo || 'N/A',
          'Segundo Cargo Administrativo': s.segundo_cargo_administrativo || 'N/A',
          Teléfono: s.telefono || '',
          'Fecha Ingreso': s.fecha_ingreso || '',
          'Carnet Digital': s.carnet_generado_url ? 'Generado' : 'Pendiente',
          Fotografía: s.foto_url ? 'Con foto' : 'Sin foto',
        };

        if (!includeExtendedFields) return baseRow;

        const kycStatus = validateConoceSocorrista(s);
        return {
          ...baseRow,
          DUI: s.dui || '',
          'NIT (Opcional)': s.nit || '',
          'Estado Civil': s.estado_civil || '',
          'Fecha Nacimiento': s.fecha_nacimiento || '',
          Sexo: s.sexo || '',
          'Tipo de Sangre': s.tipo_sangre || 'N/A',
          'Correo Electrónico': s.email || '',
          Dirección: s.direccion || '',
          'Dirección de Domicilio': s.direccion_domicilio || '',
          Nacionalidad: s.nacionalidad || '',
          'Profesión u Ocupación': s.profesion_ocupacion || '',
          'Inicio Relación Laboral': s.fecha_inicio_relacion_laboral || '',
          'Nombre de Cónyuge': s.nombre_conyuge || '',
          'Nombre de Dependientes': s.nombre_dependientes || '',
          'Cargo Público (Últimos 5 años)':
            s.cargo_publico_ultimos_5_anios === true
              ? 'Sí'
              : s.cargo_publico_ultimos_5_anios === false
              ? 'No'
              : 'Sin declarar',
          'Motorista Autorizado': s.motorista_autorizado ? 'Sí' : 'No',
          'Contacto Emergencia 1': s.contacto_emergencia_nombre || '',
          'Teléfono Emergencia 1': s.contacto_emergencia_telefono || '',
          'Ficha Conoce a tu Socorrista': kycStatus.isComplete ? 'Completa' : 'Pendiente',
        };
      });

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Socorristas');
      const todayStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `socorristas_${preset}_${todayStr}.xlsx`);

      await logActivity('Exportó Excel de Socorristas', 'Socorrista', undefined, {
        tipo_reporte: preset,
        cantidad: dataToExport.length,
        extendido: includeExtendedFields,
      });

      setShowExcelModal(false);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      notifyAction('No se pudo exportar el archivo Excel.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const requestToggleEstado = (person: any) => {
    setConfirmEstadoTarget({
      id: person.id,
      nombre:
        `${person.primer_nombre || ''} ${person.primer_apellido || ''}`.trim() || 'este elemento',
      carnet: person.carnet || '',
      currentEstado: person.estado || 'Activo',
    });
  };

  const confirmToggleEstado = async () => {
    if (!confirmEstadoTarget || updatingEstado) return;
    const { id, currentEstado } = confirmEstadoTarget;
    const newEstado = currentEstado === 'Activo' ? 'Inactivo' : 'Activo';
    setUpdatingEstado(true);
    try {
      const { error } = await supabase
        .from('socorristas')
        .update({ estado: newEstado })
        .eq('id', id);

      if (error) throw error;

      const targetSocorrista = socorristas.find((s) => s.id === id);
      if (targetSocorrista) {
        await logActivity('Cambió estado', 'Socorrista', id, {
          nombre: `${targetSocorrista.primer_nombre} ${targetSocorrista.primer_apellido}`,
          estado_anterior: currentEstado,
          nuevo_estado: newEstado,
        });
      }

      setSocorristas((prev) => prev.map((s) => (s.id === id ? { ...s, estado: newEstado } : s)));
      notifyAction(
        `${confirmEstadoTarget.nombre} fue ${newEstado === 'Activo' ? 'activado' : 'desactivado'} correctamente.`
      );
      setConfirmEstadoTarget(null);
    } catch (error) {
      console.error('Error toggling estado:', error);
      notifyAction('Error al cambiar el estado del elemento.', 'error');
    } finally {
      setUpdatingEstado(false);
    }
  };

  const handleDownloadCarnet = async (url: string, carnet: string) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);

          if (watermarkEnabled && role !== 'admin') {
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(-Math.PI / 4);
            ctx.textAlign = 'center';
            ctx.font = 'bold 36px Arial';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;

            ctx.fillText('CRUZ VERDE SALVADOREÑA', 0, -20);
            ctx.fillText('SISTEMA INTERNO', 0, 20);

            ctx.font = '16px Arial';
            ctx.fillText(`Visualizado por: ${userName || 'Usuario'}`, 0, 50);

            ctx.restore();
          }

          const jpgUrl = canvas.toDataURL('image/jpeg', 0.9);
          const link = document.createElement('a');
          link.href = jpgUrl;
          link.download = `carnet_${carnet}.jpg`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      };
      img.src = url;
    } catch (error) {
      console.error('Error downloading carnet:', error);
      notifyAction('Error al descargar el carnet digital.', 'error');
    }
  };

  const uniqueSeccionales = Array.from(
    new Set(socorristas.map((s) => s.seccional_nombre).filter(Boolean))
  ).sort((a, b) => (a as string).localeCompare(b as string));
  const uniqueCargosInst = Array.from(
    new Set(
      [
        ...socorristas.map((s) => s.cargo_institucional),
        ...socorristas.flatMap((s) => parseCargosSecundarios(s.cargos_secundarios)),
      ].filter(Boolean)
    )
  ).sort((a, b) => (a as string).localeCompare(b as string));
  const uniqueCargosAdmin = Array.from(
    new Set(
      [
        ...socorristas.map((s) => s.cargo_administrativo),
        ...socorristas.map((s) => s.segundo_cargo_administrativo),
      ].filter(Boolean)
    )
  ).sort((a, b) => (a as string).localeCompare(b as string));

  const allowedSeccionalIds = getAllowedSocorristaSeccionalIds();
  const isRestrictedSeccional =
    allowedSeccionalIds !== 'all' &&
    allowedSeccionalIds.length <= 1 &&
    Boolean(userSeccionalNombre || userSeccionalId);

  const filteredData = socorristas.filter((s) => {
    const fullName = `${s.primer_nombre || ''} ${s.segundo_nombre || ''} ${s.primer_apellido || ''} ${s.segundo_apellido || ''}`.toLowerCase();
    const matchesSearch =
      fullName.includes(searchTerm.toLowerCase()) ||
      (s.carnet && s.carnet.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesEstado = filterEstado === 'Todos' || s.estado === filterEstado;
    const matchesAllowed =
      allowedSeccionalIds === 'all' || allowedSeccionalIds.includes(Number(s.seccional_id));
    const matchesSeccional =
      matchesAllowed && (filterSeccional === 'Todas' || s.seccional_nombre === filterSeccional);
    const matchesCargoInst =
      filterCargoInst === 'Todos' ||
      s.cargo_institucional === filterCargoInst ||
      parseCargosSecundarios(s.cargos_secundarios).includes(filterCargoInst);
    const matchesCargoAdmin =
      filterCargoAdmin === 'Todos' ||
      s.cargo_administrativo === filterCargoAdmin ||
      s.segundo_cargo_administrativo === filterCargoAdmin;
    const matchesCarnetGenerado =
      filterCarnetGenerado === 'Todos' ||
      (filterCarnetGenerado === 'Generado' ? !!s.carnet_generado_url : !s.carnet_generado_url);

    return (
      matchesSearch &&
      matchesEstado &&
      matchesSeccional &&
      matchesCargoInst &&
      matchesCargoAdmin &&
      matchesCarnetGenerado
    );
  });

  const allowedVisibleSocorristas = socorristas.filter(
    (s) => allowedSeccionalIds === 'all' || allowedSeccionalIds.includes(Number(s.seccional_id))
  );

  const excelCounts: Record<ExcelExportPreset, number> = {
    filtro_actual: filteredData.length,
    todos: allowedVisibleSocorristas.length,
    activos: allowedVisibleSocorristas.filter((s) => s.estado === 'Activo').length,
    inactivos: allowedVisibleSocorristas.filter((s) => s.estado === 'Inactivo').length,
    con_carnet: allowedVisibleSocorristas.filter((s) => Boolean(s.carnet_generado_url)).length,
    sin_carnet: allowedVisibleSocorristas.filter((s) => !s.carnet_generado_url).length,
    con_foto: allowedVisibleSocorristas.filter((s) => Boolean(s.foto_url)).length,
    sin_foto: allowedVisibleSocorristas.filter((s) => !s.foto_url).length,
    motoristas: allowedVisibleSocorristas.filter((s) => Boolean(s.motorista_autorizado)).length,
    ficha_completa: allowedVisibleSocorristas.filter((s) => validateConoceSocorrista(s).isComplete)
      .length,
    ficha_pendiente: allowedVisibleSocorristas.filter((s) => !validateConoceSocorrista(s).isComplete)
      .length,
  };

  const activeFilterSummary = (() => {
    const parts: string[] = [];
    if (searchTerm.trim()) parts.push(`"${searchTerm.trim()}"`);
    if (filterEstado !== 'Todos') parts.push(filterEstado);
    if (filterSeccional !== 'Todas') parts.push(filterSeccional);
    if (filterCargoInst !== 'Todos') parts.push(filterCargoInst);
    if (filterCargoAdmin !== 'Todos') parts.push(filterCargoAdmin);
    if (filterCarnetGenerado !== 'Todos') parts.push(`Carnet: ${filterCarnetGenerado}`);
    return parts.join(' · ');
  })();

  const sortedData = [...filteredData].sort((a, b) => {
    const aValue = (a[sortConfig.key] || '').toString().toLowerCase();
    const bValue = (b[sortConfig.key] || '').toString().toLowerCase();

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = sortedData.slice(startIndex, startIndex + pageSize);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-slate-400 shrink-0" />;
    return sortConfig.direction === 'asc' ? (
      <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-primary shrink-0" />
    ) : (
      <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-primary transform rotate-180 shrink-0" />
    );
  };

  const canSeeCarnetColumn = Boolean(permissions.view_carnet || role === 'admin');
  const canSeeImages = Boolean(permissions.ver_imagenes_socorristas || role === 'admin');
  const canDownloadCarnet = Boolean(permissions.descargar_carnet || role === 'admin');

  // En teléfono vertical solo se permite Listado. En horizontal, tablet y escritorio se permite Listado y Mosaico.
  const effectiveViewMode: ViewMode = isPhonePortrait ? 'list' : viewMode;
  const useMobileCompactList = effectiveViewMode === 'list' && isPhonePortrait;

  // En teléfono horizontal en Listado mostrar exclusivamente: Elemento, Carnet, Cargo Institucional, Seccional, Estado (+ Acciones fija)
  const tableColumns = isPhoneLandscape
    ? {
        elemento: true,
        carnet: true,
        cargoInstitucional: true,
        cargoAdministrativo: false,
        seccional: true,
        estado: true,
        motorista: false,
        licencias: false,
        carnetDigital: false,
      }
    : visibleColumns;

  const visibleColCount =
    Object.entries(tableColumns).filter(([k, v]) => {
      if (!v) return false;
      if (k === 'carnetDigital' && !canSeeCarnetColumn) return false;
      return true;
    }).length + 1;

  const canToggleAny = Boolean(
    permissions.cambiar_estado_socorrista ||
      paginatedData.some((p) => canAccessSeccionalSocorristas(p.seccional_id, 'edit'))
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="mt-4 text-slate-500 font-medium text-sm">Cargando datos del personal...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 w-full">
      {/* Modal de Confirmación Activar / Desactivar Elemento */}
      {confirmEstadoTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-xs"
          onClick={() => {
            if (!updatingEstado) setConfirmEstadoTarget(null);
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden border border-slate-200/90"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-estado-title"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const willDeactivate = confirmEstadoTarget.currentEstado === 'Activo';
              return (
                <div className="p-6 text-center">
                  <div
                    className={`w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-3.5 ${
                      willDeactivate
                        ? 'bg-rose-50 text-rose-600'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    {willDeactivate ? (
                      <UserDisabledIcon className="w-6 h-6" />
                    ) : (
                      <User className="w-6 h-6" />
                    )}
                  </div>

                  <h3
                    id="confirm-estado-title"
                    className="text-base font-bold text-slate-900 tracking-tight"
                  >
                    {willDeactivate ? '¿Desactivar socorrista?' : '¿Activar socorrista?'}
                  </h3>

                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    ¿Confirmas que deseas{' '}
                    <span className="font-semibold text-slate-900">
                      {willDeactivate ? 'desactivar' : 'activar'}
                    </span>{' '}
                    a <span className="font-semibold text-slate-900">{confirmEstadoTarget.nombre}</span>
                    {confirmEstadoTarget.carnet ? (
                      <span className="text-slate-500 font-mono text-xs tabular-nums">
                        {' '}
                        ({confirmEstadoTarget.carnet})
                      </span>
                    ) : null}
                    ?
                  </p>

                  <p className="mt-1.5 text-xs text-slate-400">
                    Podrás cambiar su estado nuevamente en cualquier momento.
                  </p>

                  <div className="mt-6 grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={updatingEstado}
                      onClick={() => setConfirmEstadoTarget(null)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={updatingEstado}
                      onClick={confirmToggleEstado}
                      className={`px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap ${
                        willDeactivate
                          ? 'bg-rose-600 hover:bg-rose-700'
                          : 'bg-emerald-600 hover:bg-emerald-700'
                      }`}
                    >
                      {updatingEstado
                        ? 'Guardando...'
                        : willDeactivate
                        ? 'Sí, desactivar'
                        : 'Sí, activar'}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Carnet Preview Modal */}
      {previewCarnet && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
          onClick={() => setPreviewCarnet(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900 truncate">
                Vista Previa: {previewCarnet.name}
              </h3>
              <button
                type="button"
                onClick={() => setPreviewCarnet(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                aria-label="Cerrar vista previa"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 flex flex-col items-center">
              <WatermarkImage
                src={previewCarnet.url}
                alt="Carnet Digital"
                className="max-w-full h-auto shadow-lg border border-slate-200"
                isRounded={false}
              />
              <div className="mt-6 flex items-center gap-3">
                {canDownloadCarnet && (
                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadCarnet(previewCarnet.url, previewCarnet.name.replace(/\s+/g, '_'))
                    }
                    className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Download className="mr-1.5 h-4 w-4" />
                    <span>Descargar JPG</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewCarnet(null)}
                  className="inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-semibold rounded-xl text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Personal (Socorristas)</h1>
          <p className="mt-1 text-sm text-slate-600">
            <span className="tabular-nums font-semibold text-slate-800">{sortedData.length}</span>{' '}
            {sortedData.length === 1 ? 'elemento encontrado' : 'elementos encontrados'}
            {activeFilterSummary && (
              <>
                {' '}
                <span aria-hidden="true">·</span>{' '}
                <span className="text-slate-500">{activeFilterSummary}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {(permissions.descargar_excel_socorristas || role === 'admin') && (
            <button
              type="button"
              onClick={() => setShowExcelModal(true)}
              disabled={exporting}
              className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="-ml-0.5 mr-1.5 h-4 w-4 text-slate-500" />
              <span>{exporting ? 'Exportando...' : 'Descargar Excel'}</span>
            </button>
          )}
          {canAddAnySocorrista && (
            <Link
              to="/socorristas/nuevo"
              className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary-hover transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="-ml-0.5 mr-1.5 h-4 w-4" />
              <span>Nuevo Elemento</span>
            </Link>
          )}
        </div>
      </div>

      <SocorristasExcelModal
        isOpen={showExcelModal}
        onClose={() => setShowExcelModal(false)}
        counts={excelCounts}
        activeFilterSummary={activeFilterSummary}
        exporting={exporting}
        onConfirmExport={handleConfirmExport}
      />

      {actionNotice && (
        <div
          className={`rounded-xl border px-4 py-2.5 text-xs font-semibold flex items-center justify-between ${
            actionNotice.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <span>{actionNotice.text}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="p-1 opacity-70 hover:opacity-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-rose-900">
            <strong className="font-semibold">Error al cargar datos:</strong> {errorMsg}
          </p>
          <button
            type="button"
            onClick={() => fetchSocorristas(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-rose-100/70 border border-rose-200 text-xs font-semibold text-rose-900 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reintentar</span>
          </button>
        </div>
      )}

      {/* Contenedor Principal (Full-Width) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-5 space-y-4">
        {/* Barra de Búsqueda, Filtros y Selector Listado / Mosaico */}
        <div className="flex flex-col space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            {/* Buscador + Botones de Filtros y Columnas */}
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  className="block w-full pl-9 pr-3 py-2 text-sm bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
                  placeholder="Buscar por nombre o carnet..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              <button
                type="button"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`inline-flex items-center px-3.5 py-2 border rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  showAdvancedFilters
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-50'
                }`}
              >
                <Filter className="mr-1.5 h-3.5 w-3.5" />
                <span>Filtros</span>
              </button>

              {effectiveViewMode === 'list' && !useMobileCompactList && !isPhoneLandscape && (
                <div className="relative" ref={columnDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                    className="inline-flex items-center px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Columns className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
                    <span>Columnas</span>
                  </button>
                  {showColumnDropdown && (
                    <div className="absolute z-40 w-52 mt-2 origin-top-left sm:origin-top-right bg-white rounded-xl shadow-xl border border-slate-200 left-0 sm:left-auto sm:right-0 py-1.5">
                      <div className="px-3.5 py-2 text-xs font-semibold text-slate-500 border-b border-slate-100">
                        Columnas visibles
                      </div>
                      {[
                        { key: 'elemento', label: 'Elemento' },
                        { key: 'carnet', label: 'Carnet' },
                        { key: 'cargoInstitucional', label: 'Cargo Institucional' },
                        { key: 'cargoAdministrativo', label: 'Cargo Administrativo' },
                        { key: 'seccional', label: 'Seccional' },
                        { key: 'estado', label: 'Estado' },
                        { key: 'motorista', label: 'Autorización' },
                        { key: 'licencias', label: 'Licencias' },
                        { key: 'carnetDigital', label: 'Carnet Digital' },
                      ].map((col) => (
                        <label
                          key={col.key}
                          className="flex items-center px-3.5 py-2 cursor-pointer hover:bg-slate-50 transition-colors"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
                            checked={visibleColumns[col.key as keyof typeof visibleColumns]}
                            onChange={(e) =>
                              setVisibleColumns((prev: any) => ({
                                ...prev,
                                [col.key]: e.target.checked,
                              }))
                            }
                          />
                          <span className="ml-2.5 text-xs font-medium text-slate-700">
                            {col.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Controles Derecha: Selector Listado / Mosaico + Cantidad por página */}
            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 shrink-0">
              {/* Selector Segmentado: En teléfono vertical solo Listado; en horizontal/tablet/desktop Listado | Mosaico */}
              <div
                className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl"
                role="group"
                aria-label="Modo de visualización"
              >
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    effectiveViewMode === 'list'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Listado</span>
                </button>
                {!isPhonePortrait && (
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      effectiveViewMode === 'grid'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Mosaico</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-slate-500">Mostrar:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  aria-label="Cantidad por página"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary tabular-nums cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={500}>500</option>
                  <option value={1000}>1000</option>
                </select>
              </div>
            </div>
          </div>

          {showAdvancedFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4 bg-slate-50/80 rounded-xl border border-slate-200/80">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Estado</label>
                <select
                  className="block w-full px-3 py-2 text-xs bg-white border-slate-200 focus:outline-none focus:border-primary rounded-xl border"
                  value={filterEstado}
                  onChange={(e) => {
                    setFilterEstado(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="Todos">Todos</option>
                  <option value="Activo">Activos</option>
                  <option value="Inactivo">Inactivos</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Seccional{' '}
                  {isRestrictedSeccional && (
                    <span className="text-amber-600 font-semibold">(Solo tu seccional)</span>
                  )}
                </label>
                {isRestrictedSeccional ? (
                  <div className="flex items-center px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium">
                    <span className="truncate">{userSeccionalNombre || 'Tu Seccional'}</span>
                  </div>
                ) : (
                  <select
                    className="block w-full px-3 py-2 text-xs bg-white border-slate-200 focus:outline-none focus:border-primary rounded-xl border"
                    value={filterSeccional}
                    onChange={(e) => {
                      setFilterSeccional(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="Todas">Todas</option>
                    {uniqueSeccionales.map((sec: any) => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Cargo Institucional
                </label>
                <select
                  className="block w-full px-3 py-2 text-xs bg-white border-slate-200 focus:outline-none focus:border-primary rounded-xl border"
                  value={filterCargoInst}
                  onChange={(e) => {
                    setFilterCargoInst(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="Todos">Todos</option>
                  {uniqueCargosInst.map((cargo: any) => (
                    <option key={cargo} value={cargo}>
                      {cargo}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Cargo Administrativo
                </label>
                <select
                  className="block w-full px-3 py-2 text-xs bg-white border-slate-200 focus:outline-none focus:border-primary rounded-xl border"
                  value={filterCargoAdmin}
                  onChange={(e) => {
                    setFilterCargoAdmin(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="Todos">Todos</option>
                  {uniqueCargosAdmin.map((cargo: any) => (
                    <option key={cargo} value={cargo}>
                      {cargo}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Carnet Generado
                </label>
                <select
                  className="block w-full px-3 py-2 text-xs bg-white border-slate-200 focus:outline-none focus:border-primary rounded-xl border"
                  value={filterCarnetGenerado}
                  onChange={(e) => {
                    setFilterCarnetGenerado(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="Todos">Todos</option>
                  <option value="Generado">Generado</option>
                  <option value="No Generado">No Generado</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Estado Vacío Global */}
        {paginatedData.length === 0 ? (
          <div className="py-12 text-center text-slate-500 border border-dashed border-slate-200 rounded-xl">
            <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium">No se encontraron socorristas con los filtros actuales.</p>
          </div>
        ) : effectiveViewMode === 'grid' ? (
          /* =================================================================== */
          /* VISTA MOSAICO (CARDS RESPONSIVE SEGÚN PANTALLA Y ORIENTACIÓN)       */
          /* =================================================================== */
          <div className="space-y-3">
            {/* Micro-leyenda de acciones para Mosaico */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/70 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">Acciones:</span>
              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
                {canToggleAny && (
                  <>
                    <span className="inline-flex items-center gap-1">
                      <User className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>Activar</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <UserDisabledIcon className="w-3 h-3 text-rose-600 shrink-0" />
                      <span>Desactivar</span>
                    </span>
                  </>
                )}
                <span className="inline-flex items-center gap-1">
                  <Eye className="w-3 h-3 text-primary shrink-0" />
                  <span>Ver perfil</span>
                </span>
                {canSeeCarnetColumn && canSeeImages && (
                  <span className="inline-flex items-center gap-1">
                    <IdCard className="w-3 h-3 text-emerald-700 shrink-0" />
                    <span>Carnet</span>
                  </span>
                )}
              </div>
            </div>

            <div
              className={`grid gap-3.5 ${
                isPhoneLandscape
                  ? 'grid-cols-2'
                  : isLandscape && viewport.width < 1024
                  ? 'grid-cols-2 md:grid-cols-3'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
              }`}
            >
              {paginatedData.map((person) => {
                const secundarios = parseCargosSecundarios(person.cargos_secundarios);
                const isInactive = person.estado !== 'Activo';
                const canToggle = Boolean(
                  permissions.cambiar_estado_socorrista ||
                    canAccessSeccionalSocorristas(person.seccional_id, 'edit')
                );

                return (
                  <div
                    key={person.id}
                    className={`rounded-2xl border transition-colors flex flex-col justify-between overflow-hidden ${
                      isInactive
                        ? 'bg-slate-100/90 border-slate-200/80 hover:border-slate-300'
                        : 'bg-white border-slate-200/90 hover:border-slate-300'
                    }`}
                  >
                    <div className="p-4 space-y-3">
                      {/* Identidad */}
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 h-11 w-11">
                          {person.foto_url ? (
                            <img
                              src={person.foto_url}
                              alt={`${person.primer_nombre} ${person.primer_apellido}`}
                              className={`h-11 w-11 border border-slate-200 rounded-full object-cover ${
                                isInactive ? 'grayscale opacity-60' : ''
                              }`}
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div
                              className={`h-11 w-11 rounded-full border border-slate-200 flex items-center justify-center font-bold text-sm ${
                                isInactive
                                  ? 'bg-slate-200/80 text-slate-400'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {(person.primer_nombre?.[0] || '') + (person.primer_apellido?.[0] || '')}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3
                            className={`text-sm font-bold leading-snug truncate ${
                              isInactive ? 'text-slate-500' : 'text-slate-900'
                            }`}
                          >
                            {person.primer_nombre} {person.primer_apellido}
                          </h3>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5 flex-wrap">
                            <span
                              className={`font-mono font-semibold tabular-nums ${
                                isInactive ? 'text-slate-400' : 'text-slate-700'
                              }`}
                            >
                              {person.carnet || 'Sin carnet'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={`inline-flex items-center gap-1 font-semibold ${
                                person.estado === 'Activo' ? 'text-emerald-700' : 'text-rose-600'
                              }`}
                            >
                              {isInactive && (
                                <UserDisabledIcon className="w-3 h-3 shrink-0" />
                              )}
                              <span>{person.estado}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Datos clave */}
                      <div
                        className={`space-y-1.5 pt-2 border-t text-xs ${
                          isInactive
                            ? 'border-slate-200/70 text-slate-400'
                            : 'border-slate-100 text-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span
                            className={`truncate font-medium ${
                              isInactive ? 'text-slate-500' : 'text-slate-800'
                            }`}
                          >
                            {person.seccional_nombre || 'Sin seccional'}
                          </span>
                        </div>

                        {(person.cargo_institucional || secundarios.length > 0) && (
                          <div className="flex items-start gap-1.5">
                            <Shield
                              className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                                isInactive ? 'text-slate-400' : 'text-emerald-600'
                              }`}
                            />
                            <span
                              className={`leading-snug ${
                                isInactive ? 'text-slate-500' : 'text-slate-700'
                              }`}
                            >
                              {person.cargo_institucional || secundarios[0]}
                              {person.cargo_institucional && secundarios.length > 0
                                ? ` · ${secundarios.join(', ')}`
                                : ''}
                            </span>
                          </div>
                        )}

                        {(person.cargo_administrativo || person.segundo_cargo_administrativo) && (
                          <div className="flex items-start gap-1.5">
                            <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <span
                              className={`leading-snug truncate ${
                                isInactive ? 'text-slate-400' : 'text-slate-600'
                              }`}
                            >
                              {[person.cargo_administrativo, person.segundo_cargo_administrativo]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </div>
                        )}

                        {person.telefono && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span
                              className={`tabular-nums ${
                                isInactive ? 'text-slate-400' : 'text-slate-600'
                              }`}
                            >
                              {person.telefono}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Indicadores operativos (Licencias) */}
                      {(person.licencia_vehiculo_numero || person.licencia_moto_numero) && (
                        <div
                          className={`flex items-center gap-1.5 pt-2 border-t text-[11px] ${
                            isInactive
                              ? 'border-slate-200/70 text-slate-400'
                              : 'border-slate-100 text-slate-600'
                          }`}
                        >
                          {person.licencia_vehiculo_numero && (
                            <SteeringWheelIcon
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isInactive ? 'text-slate-400' : 'text-slate-500'
                              }`}
                            />
                          )}
                          {person.licencia_moto_numero && (
                            <Bike
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isInactive ? 'text-slate-400' : 'text-slate-500'
                              }`}
                            />
                          )}
                          <span
                            className={`truncate font-medium ${
                              isInactive
                                ? 'text-slate-400'
                                : person.motorista_autorizado
                                ? 'text-emerald-700'
                                : 'text-rose-600'
                            }`}
                          >
                            {person.motorista_autorizado ? 'Autorizado' : 'No autorizado'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Barra compacta de Acciones solo con íconos */}
                    <div
                      className={`px-3.5 py-2 border-t flex items-center justify-between gap-2 ${
                        isInactive
                          ? 'bg-slate-200/60 border-slate-200/80'
                          : 'bg-slate-50/80 border-slate-100'
                      }`}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Acciones
                      </span>

                      <div className="flex items-center gap-1">
                        {person.carnet_generado_url && canSeeCarnetColumn && canSeeImages && (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewCarnet({
                                url: person.carnet_generado_url,
                                name: `${person.primer_nombre} ${person.primer_apellido}`,
                              })
                            }
                            title="Ver carnet digital"
                            aria-label="Ver carnet digital"
                            className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                          >
                            <IdCard className="w-4 h-4" />
                          </button>
                        )}

                        {canToggle && (
                          <button
                            type="button"
                            onClick={() => requestToggleEstado(person)}
                            title={
                              person.estado === 'Activo'
                                ? 'Desactivar socorrista'
                                : 'Activar socorrista'
                            }
                            aria-label={
                              person.estado === 'Activo'
                                ? 'Desactivar socorrista'
                                : 'Activar socorrista'
                            }
                            className={`w-8 h-8 inline-flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                              person.estado === 'Activo'
                                ? 'text-rose-600 hover:bg-rose-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {person.estado === 'Activo' ? (
                              <UserDisabledIcon className="w-4 h-4" />
                            ) : (
                              <User className="w-4 h-4" />
                            )}
                          </button>
                        )}

                        <Link
                          to={`/socorristas/${person.id}`}
                          title="Ver perfil"
                          aria-label={`Ver perfil de ${person.primer_nombre} ${person.primer_apellido}`}
                          className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-primary hover:bg-emerald-50 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : useMobileCompactList ? (
          /* =================================================================== */
          /* LISTADO OPTIMIZADO PARA TELÉFONO EN VERTICAL (SOLO LISTADO)         */
          /* =================================================================== */
          <div className="space-y-2.5">
            {/* Micro-leyenda compacta de acciones en teléfono vertical */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/70 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">Acciones:</span>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {canToggleAny && (
                  <>
                    <span className="inline-flex items-center gap-1">
                      <User className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>Activar</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <UserDisabledIcon className="w-3 h-3 text-rose-600 shrink-0" />
                      <span>Desactivar</span>
                    </span>
                  </>
                )}
                <span className="inline-flex items-center gap-1">
                  <Eye className="w-3 h-3 text-primary shrink-0" />
                  <span>Perfil</span>
                </span>
                {canSeeCarnetColumn && canSeeImages && (
                  <span className="inline-flex items-center gap-1">
                    <IdCard className="w-3 h-3 text-emerald-700 shrink-0" />
                    <span>Carnet</span>
                  </span>
                )}
              </div>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden bg-white">
              {paginatedData.map((person) => {
                const secundarios = parseCargosSecundarios(person.cargos_secundarios);
                const isInactive = person.estado !== 'Activo';
                const canToggle = Boolean(
                  permissions.cambiar_estado_socorrista ||
                    canAccessSeccionalSocorristas(person.seccional_id, 'edit')
                );

                return (
                  <div
                    key={person.id}
                    className={`p-3.5 flex items-center gap-3 transition-colors ${
                      isInactive ? 'bg-slate-100/90' : 'bg-white'
                    }`}
                  >
                    <div className="flex-shrink-0 h-11 w-11">
                      {person.foto_url ? (
                        <img
                          src={person.foto_url}
                          alt={`${person.primer_nombre} ${person.primer_apellido}`}
                          className={`h-11 w-11 border border-slate-200 rounded-full object-cover ${
                            isInactive ? 'grayscale opacity-60' : ''
                          }`}
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div
                          className={`h-11 w-11 rounded-full border border-slate-200 flex items-center justify-center font-bold text-xs ${
                            isInactive
                              ? 'bg-slate-200/80 text-slate-400'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {(person.primer_nombre?.[0] || '') + (person.primer_apellido?.[0] || '')}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p
                          className={`text-sm font-bold leading-tight truncate ${
                            isInactive ? 'text-slate-500' : 'text-slate-900'
                          }`}
                        >
                          {person.primer_nombre} {person.primer_apellido}
                        </p>
                      </div>

                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 flex-wrap">
                        <span
                          className={`font-mono font-semibold tabular-nums ${
                            isInactive ? 'text-slate-400' : 'text-slate-700'
                          }`}
                        >
                          {person.carnet || 'Sin carnet'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            person.estado === 'Activo' ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {isInactive && (
                            <UserDisabledIcon className="w-3 h-3 shrink-0" />
                          )}
                          <span>{person.estado}</span>
                        </span>
                      </div>

                      <p
                        className={`mt-0.5 text-xs truncate ${
                          isInactive ? 'text-slate-400' : 'text-slate-600'
                        }`}
                      >
                        {[
                          person.seccional_nombre || 'N/A',
                          person.cargo_institucional,
                          ...secundarios,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>

                    {/* Acciones compactas solo íconos */}
                    <div
                      className={`flex items-center gap-1 shrink-0 pl-1 border-l ${
                        isInactive ? 'border-slate-200/80' : 'border-slate-100'
                      }`}
                    >
                      {person.carnet_generado_url && canSeeCarnetColumn && canSeeImages && (
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewCarnet({
                              url: person.carnet_generado_url,
                              name: `${person.primer_nombre} ${person.primer_apellido}`,
                            })
                          }
                          title="Ver carnet digital"
                          aria-label="Ver carnet digital"
                          className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                        >
                          <IdCard className="w-4 h-4" />
                        </button>
                      )}
                      {canToggle && (
                        <button
                          type="button"
                          onClick={() => requestToggleEstado(person)}
                          title={
                            person.estado === 'Activo'
                              ? 'Desactivar socorrista'
                              : 'Activar socorrista'
                          }
                          aria-label={
                            person.estado === 'Activo'
                              ? 'Desactivar socorrista'
                              : 'Activar socorrista'
                          }
                          className={`w-8 h-8 inline-flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                            person.estado === 'Activo'
                              ? 'text-rose-600 hover:bg-rose-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {person.estado === 'Activo' ? (
                            <UserDisabledIcon className="w-4 h-4" />
                          ) : (
                            <User className="w-4 h-4" />
                          )}
                        </button>
                      )}
                      <Link
                        to={`/socorristas/${person.id}`}
                        title="Ver perfil"
                        aria-label={`Ver perfil de ${person.primer_nombre} ${person.primer_apellido}`}
                        className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-primary hover:bg-emerald-50 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* =================================================================== */
          /* TABLA EXTENDIDA (Y TELÉFONO HORIZONTAL CON 5 COLUMNAS + ACCIONES)   */
          /* =================================================================== */
          <div className="relative rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="min-w-full divide-y divide-slate-200 border-separate border-spacing-0">
                <thead className="bg-slate-50">
                  <tr>
                    {tableColumns.elemento && (
                      <th
                        scope="col"
                        className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-100 border-b border-slate-200 align-bottom"
                        onClick={() => handleSort('primer_nombre')}
                      >
                        <div className="flex items-center">
                          <span>Elemento</span>
                          <SortIcon column="primer_nombre" />
                        </div>
                      </th>
                    )}
                    {tableColumns.carnet && (
                      <th
                        scope="col"
                        className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-100 border-b border-slate-200 align-bottom"
                        onClick={() => handleSort('carnet')}
                      >
                        <div className="flex items-center">
                          <span>Carnet</span>
                          <SortIcon column="carnet" />
                        </div>
                      </th>
                    )}
                    {tableColumns.cargoInstitucional && (
                      <th
                        scope="col"
                        className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-100 border-b border-slate-200 align-bottom"
                        onClick={() => handleSort('cargo_institucional')}
                      >
                        <div className="flex items-center">
                          <span>Cargo Institucional</span>
                          <SortIcon column="cargo_institucional" />
                        </div>
                      </th>
                    )}
                    {tableColumns.cargoAdministrativo && (
                      <th
                        scope="col"
                        className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-100 border-b border-slate-200 align-bottom"
                        onClick={() => handleSort('cargo_administrativo')}
                      >
                        <div className="flex items-center">
                          <span>Cargo Administrativo</span>
                          <SortIcon column="cargo_administrativo" />
                        </div>
                      </th>
                    )}
                    {tableColumns.seccional && (
                      <th
                        scope="col"
                        className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-100 border-b border-slate-200 align-bottom"
                        onClick={() => handleSort('seccional_nombre')}
                      >
                        <div className="flex items-center">
                          <span>Seccional</span>
                          <SortIcon column="seccional_nombre" />
                        </div>
                      </th>
                    )}
                    {tableColumns.estado && (
                      <th
                        scope="col"
                        className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-100 border-b border-slate-200 align-bottom"
                        onClick={() => handleSort('estado')}
                      >
                        <div className="flex items-center">
                          <span>Estado</span>
                          <SortIcon column="estado" />
                        </div>
                      </th>
                    )}
                    {tableColumns.motorista && (
                      <th
                        scope="col"
                        className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap border-b border-slate-200 align-bottom"
                      >
                        Autorización
                      </th>
                    )}
                    {tableColumns.licencias && (
                      <th
                        scope="col"
                        className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap border-b border-slate-200 align-bottom"
                      >
                        Licencias
                      </th>
                    )}
                    {tableColumns.carnetDigital && canSeeCarnetColumn && (
                      <th
                        scope="col"
                        className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-100 border-b border-slate-200 align-bottom"
                        onClick={() => handleSort('carnet_generado_url')}
                      >
                        <div className="flex items-center">
                          <span>Carnet Digital</span>
                          <SortIcon column="carnet_generado_url" />
                        </div>
                      </th>
                    )}
                    {/* Columna Acciones FIJA y compacta con micro-leyenda */}
                    <th
                      scope="col"
                      className="sticky right-0 z-20 bg-slate-50 px-2.5 py-2 text-center border-b border-l border-slate-200 shadow-[-6px_0_12px_-6px_rgba(15,23,42,0.12)] w-[92px]"
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[11px] font-semibold text-slate-700 leading-none">
                          Acciones
                        </span>
                        <div className="flex flex-col items-start gap-0.5 mt-1 text-[9.5px] leading-tight font-normal text-slate-500">
                          {canToggleAny && (
                            <>
                              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                <User className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                <span>Activar</span>
                              </span>
                              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                <UserDisabledIcon className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                                <span>Inactivar</span>
                              </span>
                            </>
                          )}
                          <span className="inline-flex items-center gap-1 whitespace-nowrap">
                            <Eye className="w-2.5 h-2.5 text-primary shrink-0" />
                            <span>Ver perfil</span>
                          </span>
                        </div>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {paginatedData.map((person) => {
                    const secundarios = parseCargosSecundarios(person.cargos_secundarios);
                    const isInactive = person.estado !== 'Activo';
                    const canToggle = Boolean(
                      permissions.cambiar_estado_socorrista ||
                        canAccessSeccionalSocorristas(person.seccional_id, 'edit')
                    );

                    return (
                      <tr
                        key={person.id}
                        className={`group transition-colors ${
                          isInactive
                            ? 'bg-slate-100/90 hover:bg-slate-200/60 text-slate-400'
                            : 'bg-white hover:bg-slate-50'
                        }`}
                      >
                        {tableColumns.elemento && (
                          <td className="px-4 py-3 whitespace-nowrap border-b border-slate-100">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-9 w-9">
                                {person.foto_url ? (
                                  <img
                                    src={person.foto_url}
                                    alt={`${person.primer_nombre} ${person.primer_apellido}`}
                                    className={`h-9 w-9 border border-slate-200 rounded-full object-cover ${
                                      isInactive ? 'grayscale opacity-60' : ''
                                    }`}
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div
                                    className={`h-9 w-9 rounded-full border border-slate-200 flex items-center justify-center font-bold text-xs ${
                                      isInactive
                                        ? 'bg-slate-200/80 text-slate-400'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {(person.primer_nombre?.[0] || '') +
                                      (person.primer_apellido?.[0] || '')}
                                  </div>
                                )}
                              </div>
                              <div className="ml-3">
                                <div
                                  className={`text-sm font-semibold flex items-center gap-1.5 ${
                                    isInactive ? 'text-slate-500' : 'text-slate-900'
                                  }`}
                                >
                                  <span>
                                    {person.primer_nombre} {person.primer_apellido}
                                  </span>
                                  {person.carnet_generado_url && (
                                    <span
                                      title="Carnet digital generado"
                                      className={`inline-flex items-center shrink-0 ${
                                        isInactive ? 'text-slate-400' : 'text-emerald-600'
                                      }`}
                                    >
                                      <IdCard className="w-3.5 h-3.5" />
                                    </span>
                                  )}
                                </div>
                                {person.telefono && !isPhoneLandscape && (
                                  <div
                                    className={`text-xs tabular-nums ${
                                      isInactive ? 'text-slate-400' : 'text-slate-500'
                                    }`}
                                  >
                                    {person.telefono}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        )}

                        {tableColumns.carnet && (
                          <td className="px-4 py-3 whitespace-nowrap border-b border-slate-100">
                            <span
                              className={`text-xs font-mono font-semibold tabular-nums ${
                                isInactive ? 'text-slate-400' : 'text-slate-800'
                              }`}
                            >
                              {person.carnet || 'Sin asignar'}
                            </span>
                          </td>
                        )}

                        {tableColumns.cargoInstitucional && (
                          <td className="px-4 py-3 whitespace-nowrap border-b border-slate-100">
                            {person.cargo_institucional || secundarios.length > 0 ? (
                              <div className="space-y-0.5">
                                {person.cargo_institucional && (
                                  <div
                                    className={`text-xs font-medium ${
                                      isInactive ? 'text-slate-500' : 'text-slate-900'
                                    }`}
                                  >
                                    {person.cargo_institucional}
                                  </div>
                                )}
                                {secundarios.length > 0 && (
                                  <div
                                    className={`text-[11px] font-medium ${
                                      isInactive ? 'text-slate-400' : 'text-emerald-700'
                                    }`}
                                  >
                                    {secundarios.join(' · ')}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">N/A</span>
                            )}
                          </td>
                        )}

                        {tableColumns.cargoAdministrativo && (
                          <td className="px-4 py-3 whitespace-nowrap border-b border-slate-100">
                            {person.cargo_administrativo || person.segundo_cargo_administrativo ? (
                              <div className="space-y-0.5">
                                {person.cargo_administrativo && (
                                  <div
                                    className={`text-xs font-medium ${
                                      isInactive ? 'text-slate-500' : 'text-slate-900'
                                    }`}
                                  >
                                    {person.cargo_administrativo}
                                  </div>
                                )}
                                {person.segundo_cargo_administrativo && (
                                  <div
                                    className={`text-[11px] font-medium ${
                                      isInactive ? 'text-slate-400' : 'text-sky-700'
                                    }`}
                                  >
                                    {person.segundo_cargo_administrativo}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">N/A</span>
                            )}
                          </td>
                        )}

                        {tableColumns.seccional && (
                          <td className="px-4 py-3 whitespace-nowrap border-b border-slate-100">
                            <span
                              className={`text-xs font-medium ${
                                isInactive ? 'text-slate-500' : 'text-slate-800'
                              }`}
                            >
                              {person.seccional_nombre || 'N/A'}
                            </span>
                          </td>
                        )}

                        {tableColumns.estado && (
                          <td className="px-4 py-3 whitespace-nowrap border-b border-slate-100">
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-semibold ${
                                person.estado === 'Activo' ? 'text-emerald-700' : 'text-rose-600'
                              }`}
                            >
                              {isInactive && (
                                <UserDisabledIcon className="w-3.5 h-3.5 shrink-0" />
                              )}
                              <span>{person.estado}</span>
                            </span>
                          </td>
                        )}

                        {tableColumns.motorista && (
                          <td className="px-4 py-3 whitespace-nowrap border-b border-slate-100">
                            {person.licencia_vehiculo_numero || person.licencia_moto_numero ? (
                              person.motorista_autorizado ? (
                                <span
                                  className={`inline-flex items-center gap-1 text-xs font-medium ${
                                    isInactive ? 'text-slate-400' : 'text-emerald-700'
                                  }`}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  <span>Autorizado</span>
                                </span>
                              ) : (
                                <span
                                  className={`inline-flex items-center gap-1 text-xs font-medium ${
                                    isInactive ? 'text-slate-400' : 'text-rose-600'
                                  }`}
                                >
                                  <X className="h-3.5 w-3.5" />
                                  <span>No autorizado</span>
                                </span>
                              )
                            ) : (
                              <span className="text-slate-400 text-xs italic">N/A</span>
                            )}
                          </td>
                        )}

                        {tableColumns.licencias && (
                          <td className="px-4 py-3 whitespace-nowrap border-b border-slate-100">
                            <div className="flex items-center gap-2">
                              {person.licencia_vehiculo_numero || person.licencia_moto_numero ? (
                                <>
                                  {person.licencia_vehiculo_numero && (
                                    <span title="Licencia de Vehículo">
                                      <SteeringWheelIcon
                                        className={`h-4 w-4 ${
                                          isInactive ? 'text-slate-400' : 'text-slate-600'
                                        }`}
                                      />
                                    </span>
                                  )}
                                  {person.licencia_moto_numero && (
                                    <span title="Licencia de Motocicleta">
                                      <Bike
                                        className={`h-4 w-4 ${
                                          isInactive ? 'text-slate-400' : 'text-slate-600'
                                        }`}
                                      />
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-slate-400 text-xs italic">N/A</span>
                              )}
                            </div>
                          </td>
                        )}

                        {tableColumns.carnetDigital && canSeeCarnetColumn && (
                          <td className="px-4 py-3 whitespace-nowrap border-b border-slate-100">
                            {person.carnet_generado_url && canSeeImages ? (
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewCarnet({
                                      url: person.carnet_generado_url,
                                      name: `${person.primer_nombre} ${person.primer_apellido}`,
                                    })
                                  }
                                  className={`text-xs font-semibold inline-flex items-center gap-1 cursor-pointer ${
                                    isInactive
                                      ? 'text-slate-500 hover:text-slate-800'
                                      : 'text-primary hover:text-primary-hover'
                                  }`}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Ver</span>
                                </button>
                                {canDownloadCarnet && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDownloadCarnet(person.carnet_generado_url, person.carnet)
                                    }
                                    className={`text-xs font-semibold inline-flex items-center gap-1 cursor-pointer ${
                                      isInactive
                                        ? 'text-slate-500 hover:text-slate-800'
                                        : 'text-emerald-700 hover:text-emerald-900'
                                    }`}
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>JPG</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">No disponible</span>
                            )}
                          </td>
                        )}

                        {/* Celda Acciones FIJA y compacta (solo íconos) */}
                        <td
                          className={`sticky right-0 z-10 px-2.5 py-2.5 whitespace-nowrap text-center border-b border-l border-slate-200/80 shadow-[-6px_0_12px_-6px_rgba(15,23,42,0.10)] transition-colors ${
                            isInactive
                              ? 'bg-slate-100 group-hover:bg-slate-200/70'
                              : 'bg-white group-hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-center gap-1">
                            {canToggle && (
                              <button
                                type="button"
                                onClick={() => requestToggleEstado(person)}
                                title={
                                  person.estado === 'Activo'
                                    ? 'Desactivar socorrista'
                                    : 'Activar socorrista'
                                }
                                aria-label={
                                  person.estado === 'Activo'
                                    ? 'Desactivar socorrista'
                                    : 'Activar socorrista'
                                }
                                className={`w-8 h-8 inline-flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                                  person.estado === 'Activo'
                                    ? 'text-rose-600 hover:bg-rose-50'
                                    : 'text-emerald-600 hover:bg-emerald-50'
                                }`}
                              >
                                {person.estado === 'Activo' ? (
                                  <UserDisabledIcon className="w-4 h-4" />
                                ) : (
                                  <User className="w-4 h-4" />
                                )}
                              </button>
                            )}
                            <Link
                              to={`/socorristas/${person.id}`}
                              title="Ver perfil"
                              aria-label={`Ver perfil de ${person.primer_nombre} ${person.primer_apellido}`}
                              className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-primary hover:bg-emerald-50 transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {paginatedData.length === 0 && (
                    <tr>
                      <td colSpan={visibleColCount} className="px-6 py-8 text-center text-slate-500">
                        No se encontraron socorristas con los filtros actuales.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="pt-3 flex items-center justify-between border-t border-slate-200">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center px-4 py-2 border border-slate-300 text-xs font-semibold rounded-xl text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              >
                Anterior
              </button>
              <span className="self-center text-xs font-medium text-slate-500 tabular-nums">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center px-4 py-2 border border-slate-300 text-xs font-semibold rounded-xl text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              >
                Siguiente
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <p className="text-xs text-slate-600 tabular-nums">
                Mostrando <span className="font-semibold text-slate-900">{startIndex + 1}</span> a{' '}
                <span className="font-semibold text-slate-900">
                  {Math.min(startIndex + pageSize, sortedData.length)}
                </span>{' '}
                de <span className="font-semibold text-slate-900">{sortedData.length}</span> resultados
              </p>
              <nav className="inline-flex rounded-xl border border-slate-200 overflow-hidden divide-x divide-slate-200" aria-label="Paginación">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="inline-flex items-center px-2.5 py-1.5 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  <span className="sr-only">Anterior</span>
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>

                {[...Array(totalPages)]
                  .map((_, i) => (
                    <button
                      type="button"
                      key={i + 1}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`inline-flex items-center px-3.5 py-1.5 text-xs font-semibold tabular-nums cursor-pointer ${
                        currentPage === i + 1
                          ? 'bg-slate-900 text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))
                  .slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))}

                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="inline-flex items-center px-2.5 py-1.5 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  <span className="sr-only">Siguiente</span>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </nav>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
