import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Plus, Download, Edit, Eye, Filter, MoreVertical, Shield, Briefcase, ArrowUpDown, ChevronLeft, ChevronRight, X, Columns, Car, Bike, Check, IdCard } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/logger';
import WatermarkImage from '../components/WatermarkImage';
import { useAuth } from '../contexts/AuthContext';

const SteeringWheelIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-label="Licencia de Vehículo">
    <title>Licencia de Vehículo</title>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="2" />
    <line x1="12" y1="14" x2="12" y2="22" />
    <line x1="10.2" y1="10.7" x2="3.3" y2="6.6" />
    <line x1="13.8" y1="10.7" x2="20.7" y2="6.6" />
  </svg>
);

export default function Socorristas() {
  const location = useLocation();
  const { role, permissions, directorSeccionalId, userSeccionalId, userSeccionalNombre, userName, watermarkEnabled } = useAuth();
  const [socorristas, setSocorristas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Initialize state from sessionStorage if available
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
    carnetDigital: true
  };
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('socorristas_columns');
    return saved ? { ...defaultColumns, ...JSON.parse(saved) } : defaultColumns;
  });
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

  useEffect(() => {
    localStorage.setItem('socorristas_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);
  
  const [exporting, setExporting] = useState(false);
  const [previewCarnet, setPreviewCarnet] = useState<{ url: string, name: string } | null>(null);
  
  // Pagination and Sorting state
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ 
    key: 'primer_nombre', 
    direction: 'asc' 
  });

  // Save filters to sessionStorage whenever they change
  useEffect(() => {
    sessionStorage.setItem('socorristas_searchTerm', searchTerm);
    sessionStorage.setItem('socorristas_filterEstado', filterEstado);
    sessionStorage.setItem('socorristas_filterSeccional', filterSeccional);
    sessionStorage.setItem('socorristas_filterCargoInst', filterCargoInst);
    sessionStorage.setItem('socorristas_filterCargoAdmin', filterCargoAdmin);
    sessionStorage.setItem('socorristas_filterCarnetGenerado', filterCarnetGenerado);
    sessionStorage.setItem('socorristas_showAdvancedFilters', showAdvancedFilters.toString());
  }, [searchTerm, filterEstado, filterSeccional, filterCargoInst, filterCargoAdmin, filterCarnetGenerado, showAdvancedFilters]);

  useEffect(() => {
    fetchSocorristas();
  }, []);

  const fetchSocorristas = async () => {
    try {
      setErrorMsg(null);
      let query = supabase
        .from('socorristas')
        .select(`
          *,
          seccionales (
            nombre
          )
        `);
        
      if (role === 'director' && directorSeccionalId) {
        query = query.eq('seccional_id', directorSeccionalId);
      } else if (role !== 'admin' && !permissions.ver_todas_seccionales && userSeccionalId) {
        query = query.eq('seccional_id', userSeccionalId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      const formattedData = data.map(s => ({
        ...s,
        seccional_nombre: s.seccionales?.nombre || 'N/A'
      }));
      
      setSocorristas(formattedData);
    } catch (err: any) {
      console.error("Error fetching socorristas:", err);
      setErrorMsg(err.message || JSON.stringify(err));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const dataToExport = filteredData.map(s => ({
        Carnet: s.carnet,
        'Primer Nombre': s.primer_nombre,
        'Segundo Nombre': s.segundo_nombre,
        'Primer Apellido': s.primer_apellido,
        'Segundo Apellido': s.segundo_apellido,
        Seccional: s.seccional_nombre,
        Estado: s.estado,
        'Cargo Institucional': s.cargo_institucional || 'N/A',
        'Cargo Administrativo': s.cargo_administrativo || 'N/A',
        'Segundo Cargo Administrativo': s.segundo_cargo_administrativo || 'N/A',
        Teléfono: s.telefono,
        'Fecha Ingreso': s.fecha_ingreso
      }));
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Socorristas");
      XLSX.writeFile(wb, "socorristas.xlsx");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
    } finally {
      setExporting(false);
    }
  };

  const toggleEstado = async (id: number, currentEstado: string) => {
    const newEstado = currentEstado === 'Activo' ? 'Inactivo' : 'Activo';
    try {
      const { error } = await supabase
        .from('socorristas')
        .update({ estado: newEstado })
        .eq('id', id);

      if (error) throw error;
      
      const targetSocorrista = socorristas.find(s => s.id === id);
      if (targetSocorrista) {
        await logActivity('Cambió estado', 'Socorrista', id, {
          nombre: `${targetSocorrista.primer_nombre} ${targetSocorrista.primer_apellido}`,
          estado_anterior: currentEstado,
          nuevo_estado: newEstado
        });
      }
      
      setSocorristas(socorristas.map(s => s.id === id ? { ...s, estado: newEstado } : s));
    } catch (error) {
      console.error('Error toggling estado:', error);
      alert('Error al cambiar el estado');
    }
  };

  const handleDownloadCarnet = async (url: string, carnet: string) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
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
      alert('Error al descargar el carnet');
    }
  };

  const uniqueSeccionales = Array.from(new Set(socorristas.map(s => s.seccional_nombre).filter(Boolean))).sort((a, b) => (a as string).localeCompare(b as string));
  const uniqueCargosInst = Array.from(new Set(socorristas.map(s => s.cargo_institucional).filter(Boolean))).sort((a, b) => (a as string).localeCompare(b as string));
  const uniqueCargosAdmin = Array.from(new Set([
    ...socorristas.map(s => s.cargo_administrativo),
    ...socorristas.map(s => s.segundo_cargo_administrativo)
  ].filter(Boolean))).sort((a, b) => (a as string).localeCompare(b as string));

  const isRestrictedSeccional = role !== 'admin' && !permissions.ver_todas_seccionales && Boolean(userSeccionalNombre || userSeccionalId);

  const filteredData = socorristas.filter(s => {
    const matchesSearch = (s.primer_nombre + ' ' + s.primer_apellido).toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (s.carnet && s.carnet.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesEstado = filterEstado === 'Todos' || s.estado === filterEstado;
    const matchesSeccional = isRestrictedSeccional
      ? (userSeccionalNombre ? s.seccional_nombre === userSeccionalNombre : (userSeccionalId ? s.seccional_id === userSeccionalId : true))
      : (filterSeccional === 'Todas' || s.seccional_nombre === filterSeccional);
    const matchesCargoInst = filterCargoInst === 'Todos' || s.cargo_institucional === filterCargoInst;
    const matchesCargoAdmin = filterCargoAdmin === 'Todos' || s.cargo_administrativo === filterCargoAdmin || s.segundo_cargo_administrativo === filterCargoAdmin;
    const matchesCarnetGenerado = filterCarnetGenerado === 'Todos' || 
                                  (filterCarnetGenerado === 'Generado' ? !!s.carnet_generado_url : !s.carnet_generado_url);
    
    return matchesSearch && matchesEstado && matchesSeccional && matchesCargoInst && matchesCargoAdmin && matchesCarnetGenerado;
  });

  // Sorting logic
  const sortedData = [...filteredData].sort((a, b) => {
    const aValue = (a[sortConfig.key] || '').toString().toLowerCase();
    const bValue = (b[sortConfig.key] || '').toString().toLowerCase();

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination logic
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
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-1 h-4 w-4 text-gray-400" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUpDown className="ml-1 h-4 w-4 text-primary" /> 
      : <ArrowUpDown className="ml-1 h-4 w-4 text-primary transform rotate-180" />;
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <p className="mt-4 text-gray-500 font-medium">Cargando datos del personal...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Carnet Preview Modal */}
      {previewCarnet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-75">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Vista Previa: {previewCarnet.name}</h3>
              <button onClick={() => setPreviewCarnet(null)} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 flex flex-col items-center">
              <WatermarkImage src={previewCarnet.url} alt="Carnet Digital" className="max-w-full h-auto shadow-lg border border-gray-200" isRounded={false} />
              <div className="mt-6 flex space-x-4">
                {(permissions.descargar_carnet || role === 'admin') && (
                  <button 
                    onClick={() => handleDownloadCarnet(previewCarnet.url, previewCarnet.name.replace(/\s+/g, '_'))}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    <Download className="mr-2 h-5 w-5" />
                    Descargar JPG
                  </button>
                )}
                <button 
                  onClick={() => setPreviewCarnet(null)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Personal (Socorristas)</h1>
          <p className="mt-2 text-sm text-gray-700">Lista completa de elementos registrados en la institución.</p>
        </div>
        <div className="mt-4 flex sm:mt-0 sm:ml-4 space-x-3">
          {(permissions.descargar_excel_socorristas || role === 'admin') && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
            >
              <Download className="-ml-1 mr-2 h-5 w-5 text-gray-500" />
              {exporting ? 'Exportando...' : 'Exportar Excel'}
            </button>
          )}
          {role === 'admin' && (
            <Link
              to="/socorristas/nuevo"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              <Plus className="-ml-1 mr-2 h-5 w-5" />
              Nuevo Elemento
            </Link>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700">
                <strong>Error al cargar datos:</strong> {errorMsg}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
        <div className="flex flex-col space-y-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-3 md:space-y-0 md:space-x-4">
            <div className="flex-1 min-w-0 flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="focus:ring-primary focus:border-primary block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
                  placeholder="Buscar por nombre o carnet..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className={`inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${showAdvancedFilters ? 'bg-gray-100 border-gray-400 text-gray-900' : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'}`}
                >
                  <Filter className="-ml-1 mr-2 h-5 w-5 text-gray-500" />
                  Filtros Avanzados
                </button>
                <div className="relative">
                  <button
                    onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                    className="inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                  >
                    <Columns className="-ml-1 mr-2 h-5 w-5 text-gray-500" />
                    Columnas
                  </button>
                  {showColumnDropdown && (
                    <div className="absolute z-10 w-48 mt-2 origin-top-right bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 right-0 pt-2 pb-2">
                      <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">Mostrar Columnas</div>
                      {[
                        { key: 'elemento', label: 'Elemento' },
                        { key: 'carnet', label: 'Carnet' },
                        { key: 'cargoInstitucional', label: 'Cargo Institucional' },
                        { key: 'cargoAdministrativo', label: 'Cargo Administrativo' },
                        { key: 'seccional', label: 'Seccional' },
                        { key: 'estado', label: 'Estado' },
                        { key: 'motorista', label: 'Autorización' },
                        { key: 'licencias', label: 'Licencias' },
                        { key: 'carnetDigital', label: 'Carnet Digital' }
                      ].map(col => (
                        <label key={col.key} className="flex items-center px-4 py-2 cursor-pointer hover:bg-gray-50 transition-colors">
                          <input 
                            type="checkbox" 
                            className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded" 
                            checked={visibleColumns[col.key as keyof typeof visibleColumns]} 
                            onChange={(e) => setVisibleColumns(prev => ({ ...prev, [col.key]: e.target.checked }))}
                          />
                          <span className="ml-2 text-sm text-gray-700">{col.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">Mostrar:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="block w-20 pl-3 pr-8 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md border"
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
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-gray-50 rounded-md border border-gray-200">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Estado</label>
                <select
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md border"
                  value={filterEstado}
                  onChange={(e) => setFilterEstado(e.target.value)}
                >
                  <option value="Todos">Todos</option>
                  <option value="Activo">Activos</option>
                  <option value="Inactivo">Inactivos</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Seccional {isRestrictedSeccional && <span className="text-amber-600 font-bold text-xs">(Solo tu seccional)</span>}
                </label>
                {isRestrictedSeccional ? (
                  <div className="flex items-center px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-800 font-medium">
                    <span className="truncate">{userSeccionalNombre || 'Tu Seccional'}</span>
                  </div>
                ) : (
                  <select
                    className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md border"
                    value={filterSeccional}
                    onChange={(e) => setFilterSeccional(e.target.value)}
                  >
                    <option value="Todas">Todas</option>
                    {uniqueSeccionales.map((sec: any) => (
                      <option key={sec} value={sec}>{sec}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Cargo Institucional</label>
                <select
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md border"
                  value={filterCargoInst}
                  onChange={(e) => setFilterCargoInst(e.target.value)}
                >
                  <option value="Todos">Todos</option>
                  {uniqueCargosInst.map((cargo: any) => (
                    <option key={cargo} value={cargo}>{cargo}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Cargo Administrativo</label>
                <select
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md border"
                  value={filterCargoAdmin}
                  onChange={(e) => setFilterCargoAdmin(e.target.value)}
                >
                  <option value="Todos">Todos</option>
                  {uniqueCargosAdmin.map((cargo: any) => (
                    <option key={cargo} value={cargo}>{cargo}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Carnet Generado</label>
                <select
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md border"
                  value={filterCarnetGenerado}
                  onChange={(e) => setFilterCarnetGenerado(e.target.value)}
                >
                  <option value="Todos">Todos</option>
                  <option value="Generado">Generado</option>
                  <option value="No Generado">No Generado</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-500">Cargando datos...</div>
        ) : (
          <div className="flex flex-col">
            <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
                <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {visibleColumns.elemento && (
                          <th 
                            scope="col" 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort('primer_nombre')}
                          >
                            <div className="flex items-center">
                              Elemento
                              <SortIcon column="primer_nombre" />
                            </div>
                          </th>
                        )}
                        {visibleColumns.carnet && (
                          <th 
                            scope="col" 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort('carnet')}
                          >
                            <div className="flex items-center">
                              Carnet
                              <SortIcon column="carnet" />
                            </div>
                          </th>
                        )}
                        {visibleColumns.cargoInstitucional && (
                          <th 
                            scope="col" 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort('cargo_institucional')}
                          >
                            <div className="flex items-center">
                              Cargo Institucional
                              <SortIcon column="cargo_institucional" />
                            </div>
                          </th>
                        )}
                        {visibleColumns.cargoAdministrativo && (
                          <th 
                            scope="col" 
                            className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort('cargo_administrativo')}
                          >
                            <div className="flex items-center">
                              Cargo Administrativo
                              <SortIcon column="cargo_administrativo" />
                            </div>
                          </th>
                        )}
                        {visibleColumns.seccional && (
                          <th 
                            scope="col" 
                            className="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort('seccional_nombre')}
                          >
                            <div className="flex items-center">
                              Seccional
                              <SortIcon column="seccional_nombre" />
                            </div>
                          </th>
                        )}
                        {visibleColumns.estado && (
                          <th 
                            scope="col" 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort('estado')}
                          >
                            <div className="flex items-center">
                              Estado
                              <SortIcon column="estado" />
                            </div>
                          </th>
                        )}
                        {visibleColumns.motorista && (
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Autorización
                          </th>
                        )}
                        {visibleColumns.licencias && (
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Licencias
                          </th>
                        )}
                        {visibleColumns.carnetDigital && (permissions.view_carnet || role === 'admin') && (
                          <th 
                            scope="col" 
                            className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort('carnet_generado_url')}
                          >
                            <div className="flex items-center">
                              Carnet Digital
                              <SortIcon column="carnet_generado_url" />
                            </div>
                          </th>
                        )}
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedData.map((person) => (
                        <tr key={person.id} className="hover:bg-gray-50 transition-colors">
                          {visibleColumns.elemento && (
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10">
                                  {person.foto_url ? (
                                    <img src={person.foto_url} alt="" className="h-10 w-10 border border-gray-200 rounded-full object-cover" />
                                  ) : (
                                    <div className="h-10 w-10 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 font-bold overflow-hidden">
                                       <span className="text-xs">{(person.primer_nombre?.[0] || '') + (person.primer_apellido?.[0] || '')}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900 flex items-center gap-2 flex-wrap">
                                    <span>{person.primer_nombre} {person.primer_apellido}</span>
                                    {person.carnet_generado_url && (
                                      <span 
                                        title="Carnet digital generado y registrado en sus datos"
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs shrink-0 cursor-default"
                                      >
                                        <IdCard className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span className="text-[10px]">Carnet Digital</span>
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-500">{person.telefono}</div>
                                </div>
                              </div>
                            </td>
                          )}
                          {visibleColumns.carnet && (
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-1.5">
                                <div className={`text-sm font-mono px-2 py-1 rounded inline-flex items-center gap-1.5 border ${
                                  person.carnet_generado_url 
                                    ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900 font-semibold' 
                                    : 'bg-gray-100 border-gray-200 text-gray-900'
                                }`}>
                                  {person.carnet_generado_url && (
                                    <span title="Carnet digital generado"><IdCard className="w-3.5 h-3.5 text-emerald-600 shrink-0" /></span>
                                  )}
                                  <span>{person.carnet || 'N/A'}</span>
                                </div>
                              </div>
                            </td>
                          )}
                          {visibleColumns.cargoInstitucional && (
                            <td className="px-6 py-4 whitespace-nowrap">
                              {person.cargo_institucional ? (
                                <div className="flex items-center text-sm text-gray-900">
                                  <Shield className="w-4 h-4 mr-1.5 text-primary" />
                                  {person.cargo_institucional}
                                </div>
                              ) : (
                                <span className="text-sm text-gray-400 italic">N/A</span>
                              )}
                            </td>
                          )}
                          {visibleColumns.cargoAdministrativo && (
                            <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap">
                              {person.cargo_administrativo || person.segundo_cargo_administrativo ? (
                                <div className="flex flex-col space-y-1">
                                  {person.cargo_administrativo && (
                                    <div className="flex items-center text-sm text-gray-900">
                                      <Briefcase className="w-4 h-4 mr-1.5 text-gray-500" />
                                      {person.cargo_administrativo}
                                    </div>
                                  )}
                                  {person.segundo_cargo_administrativo && (
                                    <div className="flex items-center">
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                                        <Shield className="w-3 h-3 mr-1 text-blue-600" />
                                        {person.segundo_cargo_administrativo}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-sm text-gray-400 italic">N/A</span>
                              )}
                            </td>
                          )}
                          {visibleColumns.seccional && (
                            <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{person.seccional_nombre || 'N/A'}</div>
                            </td>
                          )}
                          {visibleColumns.estado && (
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                person.estado === 'Activo' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'
                              }`}>
                                {person.estado}
                              </span>
                            </td>
                          )}
                          {visibleColumns.motorista && (
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-1">
                                {(person.licencia_vehiculo_numero || person.licencia_moto_numero) ? (
                                  person.motorista_autorizado ? (
                                    <>
                                      <Check className="h-4 w-4 text-green-600 font-bold" />
                                      <span className="text-sm text-green-700 font-medium">Conductor autorizado</span>
                                    </>
                                  ) : (
                                    <>
                                      <X className="h-4 w-4 text-red-600 font-bold" />
                                      <span className="text-sm text-red-700 font-medium">Conductor no autorizado</span>
                                    </>
                                  )
                                ) : (
                                  <span className="text-gray-400 text-sm italic">N/A</span>
                                )}
                              </div>
                            </td>
                          )}
                          {visibleColumns.licencias && (
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-2">
                                {(person.licencia_vehiculo_numero || person.licencia_moto_numero) ? (
                                  <>
                                    {person.licencia_vehiculo_numero && <span title="Licencia de Vehículo"><SteeringWheelIcon className="h-4 w-4 text-gray-600" /></span>}
                                    {person.licencia_moto_numero && <span title="Licencia de Motocicleta"><Bike className="h-4 w-4 text-gray-600" /></span>}
                                  </>
                                ) : (
                                  <span className="text-gray-400 text-sm italic">N/A</span>
                                )}
                              </div>
                            </td>
                          )}
                          {visibleColumns.carnetDigital && (permissions.view_carnet || role === 'admin') && (
                            <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                              {person.carnet_generado_url && (permissions.ver_imagenes_socorristas || role === 'admin') ? (
                                <div className="flex items-center space-x-3">
                                  <button 
                                    onClick={() => setPreviewCarnet({ url: person.carnet_generado_url, name: `${person.primer_nombre} ${person.primer_apellido}` })}
                                    className="text-primary hover:text-primary-hover text-xs font-medium flex items-center"
                                  >
                                    <Eye className="w-3.5 h-3.5 mr-1" />
                                    Ver
                                  </button>
                                  {(permissions.descargar_carnet || role === 'admin') && (
                                    <button 
                                      onClick={() => handleDownloadCarnet(person.carnet_generado_url, person.carnet)}
                                      className="text-green-600 hover:text-green-800 text-xs font-medium flex items-center"
                                    >
                                      <Download className="w-3.5 h-3.5 mr-1" />
                                      JPG
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400 italic">No disponible</span>
                              )}
                            </td>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              {(permissions.cambiar_estado_socorrista || role === 'admin') && (
                                <button
                                  onClick={() => toggleEstado(person.id, person.estado)}
                                  title={person.estado === 'Activo' ? 'Desactivar' : 'Activar'}
                                  className={`p-1.5 rounded-md ${person.estado === 'Activo' ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                                >
                                  {person.estado === 'Activo' ? <Filter className="w-4 h-4 transform rotate-180" /> : <Filter className="w-4 h-4" />}
                                </button>
                              )}
                              <Link 
                                to={`/socorristas/${person.id}`} 
                                title="Ver Perfil"
                                className="p-1.5 rounded-md text-primary hover:bg-blue-50 flex items-center space-x-1"
                              >
                                <Eye className="w-4 h-4" />
                                <span className="text-xs font-medium">Ver Perfil</span>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredData.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                            <div className="flex flex-col items-center justify-center">
                              <Search className="w-8 h-8 text-gray-300 mb-2" />
                              <p>No se encontraron socorristas con los filtros actuales.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-4">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Mostrando <span className="font-medium">{startIndex + 1}</span> a <span className="font-medium">{Math.min(startIndex + pageSize, sortedData.length)}</span> de{' '}
                      <span className="font-medium">{sortedData.length}</span> resultados
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <span className="sr-only">Anterior</span>
                        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                      </button>
                      
                      {[...Array(totalPages)].map((_, i) => (
                        <button
                          key={i + 1}
                          onClick={() => setCurrentPage(i + 1)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            currentPage === i + 1
                              ? 'z-10 bg-blue-50 border-primary text-primary'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {i + 1}
                        </button>
                      )).slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))}

                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <span className="sr-only">Siguiente</span>
                        <ChevronRight className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
