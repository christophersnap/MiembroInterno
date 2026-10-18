import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ClipboardList, Fuel, Plus, Search, Filter, Eye, Download, Mail, 
  CheckCircle2, Clock, XCircle, AlertCircle, RefreshCw, ChevronLeft, 
  Building2, User, FileText, Send, Calendar, Check, ExternalLink,
  DollarSign, Truck, AlertTriangle, ShieldCheck, Info, ArrowUpRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { SolicitudCombustible, CombustibleConfig, DEFAULT_COMBUSTIBLE_CONFIG } from '../types/combustible';
import { SolicitudCompra, CompraConfig, DEFAULT_COMPRA_CONFIG } from '../types/compra';
import { isSolicitudRealizadaPorUsuario } from '../utils/solicitudFilter';
import CombustiblePdfModal from '../components/combustible/CombustiblePdfModal';
import CompraPdfPreviewModal from '../components/compra/CompraPdfPreviewModal';

export type TipoSolicitudFilter = 'todas' | 'combustible' | 'compra';

export interface SolicitudUnifiedItem {
  id: string;
  originalId: number;
  tipo: 'combustible' | 'compra';
  folio: string;
  seccional_id?: number;
  seccional_nombre: string;
  solicitante: string;
  cargo: string;
  fecha: string;
  hora: string;
  fecha_completa: string;
  detalle_resumen: string;
  detalle_completo: string;
  monto_o_dotacion?: string;
  vehiculo_info?: string;
  estado: string;
  correo_enviado: boolean;
  correos_notificados?: string;
  correo_solicitante?: string;
  autorizado_por?: string;
  fecha_autorizacion?: string;
  motivo_rechazo?: string;
  rawCombustible?: SolicitudCombustible;
  rawCompra?: SolicitudCompra;
}

export default function Solicitudes() {
  const navigate = useNavigate();
  const { user, userName, role, userSeccionalId, userSeccionalNombre, permissions } = useAuth();
  
  const isAdmin = role === 'admin';
  const hasNivelNacional = isAdmin || Boolean(permissions.ver_todas_seccionales);
  const isRestrictedSeccional = !hasNivelNacional && Boolean(userSeccionalNombre || userSeccionalId);

  // Estados de datos
  const [solicitudes, setSolicitudes] = useState<SolicitudUnifiedItem[]>([]);
  const [seccionales, setSeccionales] = useState<{ id: number; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [tipoFiltro, setTipoFiltro] = useState<TipoSolicitudFilter>('todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('Todos');
  const [filterSeccional, setFilterSeccional] = useState(isRestrictedSeccional && userSeccionalNombre ? userSeccionalNombre : 'Todas');

  // Modales
  const [detailItem, setDetailItem] = useState<SolicitudUnifiedItem | null>(null);
  const [emailInfoItem, setEmailInfoItem] = useState<SolicitudUnifiedItem | null>(null);
  const [pdfCombustibleItem, setPdfCombustibleItem] = useState<SolicitudCombustible | null>(null);
  const [pdfCompraItem, setPdfCompraItem] = useState<SolicitudCompra | null>(null);

  // Configuraciones de PDF
  const [combustibleConfig, setCombustibleConfig] = useState<CombustibleConfig>(DEFAULT_COMBUSTIBLE_CONFIG);
  const [compraConfig, setCompraConfig] = useState<CompraConfig>(DEFAULT_COMPRA_CONFIG);

  // 1. Cargar datos
  const fetchAllData = async () => {
    setLoading(true);
    try {
      // Cargar configuraciones guardadas de localStorage si existen
      const localCombConf = localStorage.getItem('cruz_verde_combustible_config');
      if (localCombConf) {
        try { setCombustibleConfig(JSON.parse(localCombConf)); } catch (e) {}
      }
      const localCompraConf = localStorage.getItem('cruz_verde_compra_config');
      if (localCompraConf) {
        try { setCompraConfig(JSON.parse(localCompraConf)); } catch (e) {}
      }

      // A. Seccionales
      const { data: secData } = await supabase
        .from('seccionales')
        .select('id, nombre')
        .order('nombre');
      
      const loadedSeccs = secData || [];
      setSeccionales(loadedSeccs);

      // B. Solicitudes de Combustible
      let combustibleList: SolicitudCombustible[] = [];
      try {
        let combQuery = supabase
          .from('solicitudes_combustible')
          .select('*')
          .order('created_at', { ascending: false });

        if (isRestrictedSeccional && userSeccionalNombre) {
          combQuery = combQuery.ilike('seccional_nombre', `%${userSeccionalNombre}%`);
        }

        const { data: cData, error: cErr } = await combQuery;
        if (cErr) throw cErr;
        combustibleList = cData || [];
      } catch (err) {
        // Fallback local storage
        const localComb = sessionStorage.getItem('cruz_verde_solicitudes_combustible');
        if (localComb) {
          try { combustibleList = JSON.parse(localComb); } catch (e) {}
        } else {
          // Demo inicial
          combustibleList = [{
            id: 1,
            folio: 'COMB-2026-0042',
            seccional_id: 1,
            seccional_nombre: userSeccionalNombre || 'Aguilares',
            director_nombre: '(AGUILARES) - JOSUE ARMANDO RAMOS URRUTIA',
            correo_electronico: 'aguilares@cruzverdesv.org',
            actividad: 'Cobertura de emergencias en turno regular',
            entrego_liquidacion_anterior: true,
            motivo_no_liquidacion: '',
            nombre_solicitante: userName && userName !== 'Usuario' ? userName : 'Socorrista de Guardia',
            telefono_solicitante: '7000-0000',
            observaciones: 'Dotación mensual para ambulancia y unidad de rescate.',
            fecha_solicitud: '2026-09-09',
            hora_solicitud: '19:35:00',
            fecha_envio_completa: '2026-09-09 19:35:00',
            estado: 'Pendiente',
            correo_enviado: true,
            correos_notificados: 'control_combustible@cruzverdesv.org',
            created_at: new Date().toISOString()
          }];
        }
      }

      // C. Solicitudes de Compra y Mantenimiento
      let compraList: SolicitudCompra[] = [];
      try {
        let compQuery = supabase
          .from('solicitudes_compra')
          .select('*')
          .order('created_at', { ascending: false });

        if (isRestrictedSeccional && userSeccionalNombre) {
          compQuery = compQuery.ilike('seccional_nombre', `%${userSeccionalNombre}%`);
        }

        const { data: pData, error: pErr } = await compQuery;
        if (pErr) throw pErr;
        compraList = pData || [];
      } catch (err) {
        // Fallback local storage
        const localComp = sessionStorage.getItem('cruz_verde_solicitudes_compra');
        if (localComp) {
          try { compraList = JSON.parse(localComp); } catch (e) {}
        } else {
          // Demo inicial
          compraList = [{
            id: 1,
            folio: 'SC-2026-0001',
            seccional_id: 1,
            seccional_nombre: userSeccionalNombre || 'Santa Ana',
            solicitado_por: 'Daniel Martinez',
            cargo: 'Director Seccional',
            user_email: user?.email || 'santaana@cruzverdesv.org',
            tipo_solicitud: 'Repuestos para Vehículo',
            es_para_vehiculo: true,
            vehiculo_placa: 'CVS-014',
            vehiculo_descripcion: 'Toyota Land Cruiser HZJ78 (Ambulancia)',
            descripcion: 'Repuestos para mantenimiento preventivo: pastillas de freno y cambio de aceite de motor.',
            monto_estimado: 145.50,
            proveedor_sugerido: 'Auto Repuestos El Salvador',
            prioridad: 'Urgente',
            lugar_fecha: 'Santa Ana, 15 de agosto de 2026 (10:30)',
            fecha_solicitud: '2026-08-15',
            hora_solicitud: '10:30:00',
            estado: 'Aprobada',
            correo_enviado: true,
            correos_notificados: 'administracion@cruzverdesv.org, presidencia@cruzverdesv.org, santaana@cruzverdesv.org',
            created_at: new Date().toISOString()
          }];
        }
      }

      // Unificar datos
      const unified: SolicitudUnifiedItem[] = [];

      // Mapear combustible
      combustibleList.forEach(c => {
        unified.push({
          id: `comb-${c.id}`,
          originalId: c.id,
          tipo: 'combustible',
          folio: c.folio,
          seccional_id: c.seccional_id,
          seccional_nombre: c.seccional_nombre,
          solicitante: c.nombre_solicitante,
          cargo: 'Director Seccional',
          fecha: c.fecha_solicitud || (c.created_at ? c.created_at.split('T')[0] : '2026-09-09'),
          hora: c.hora_solicitud || '12:00:00',
          fecha_completa: c.fecha_envio_completa || `${c.fecha_solicitud || ''} ${c.hora_solicitud || ''}`,
          detalle_resumen: c.actividad,
          detalle_completo: `Actividad: ${c.actividad}. Liquidación anterior: ${c.entrego_liquidacion_anterior ? 'Sí entregada' : `No entregada (${c.motivo_no_liquidacion || 'Sin motivo'})`}. Observaciones: ${c.observaciones || 'Ninguna'}.`,
          monto_o_dotacion: 'Dotación Combustible',
          vehiculo_info: 'Unidades de Emergencia / Flota',
          estado: c.estado,
          correo_enviado: Boolean(c.correo_enviado),
          correos_notificados: c.correos_notificados,
          correo_solicitante: c.correo_electronico,
          autorizado_por: c.autorizado_por,
          fecha_autorizacion: c.fecha_autorizacion,
          motivo_rechazo: c.motivo_rechazo,
          rawCombustible: c
        });
      });

      // Mapear compra
      compraList.forEach(p => {
        unified.push({
          id: `compra-${p.id}`,
          originalId: p.id,
          tipo: 'compra',
          folio: p.folio,
          seccional_id: p.seccional_id,
          seccional_nombre: p.seccional_nombre,
          solicitante: p.solicitado_por,
          cargo: p.cargo,
          fecha: p.fecha_solicitud || (p.created_at ? p.created_at.split('T')[0] : '2026-08-15'),
          hora: p.hora_solicitud || '10:00:00',
          fecha_completa: p.lugar_fecha || `${p.fecha_solicitud || ''} ${p.hora_solicitud || ''}`,
          detalle_resumen: p.tipo_solicitud,
          detalle_completo: p.descripcion,
          monto_o_dotacion: p.monto_estimado ? `$${p.monto_estimado.toFixed(2)}` : 'Cotización pendiente',
          vehiculo_info: p.es_para_vehiculo ? `${p.vehiculo_placa || 'Placa s/n'} - ${p.vehiculo_descripcion || 'Vehículo'}` : undefined,
          estado: p.estado,
          correo_enviado: Boolean(p.correo_enviado),
          correos_notificados: p.correos_notificados,
          correo_solicitante: p.user_email,
          autorizado_por: p.autorizado_por,
          fecha_autorizacion: p.fecha_autorizacion,
          motivo_rechazo: p.motivo_rechazo,
          rawCompra: p
        });
      });

      // Ordenar por fecha descendente
      unified.sort((a, b) => {
        const dateA = new Date(`${a.fecha}T${a.hora || '00:00:00'}`).getTime();
        const dateB = new Date(`${b.fecha}T${b.hora || '00:00:00'}`).getTime();
        return dateB - dateA;
      });

      // Si el usuario no es admin, solo podrá ver en la tabla las solicitudes que ha realizado
      if (!isAdmin) {
        const soloDelUsuario = unified.filter(item => isSolicitudRealizadaPorUsuario(item, user, userName));
        setSolicitudes(soloDelUsuario);
      } else {
        setSolicitudes(unified);
      }

    } catch (err) {
      console.error('Error cargando solicitudes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [userSeccionalNombre, userSeccionalId, role, user?.id, user?.email, userName]);

  // Filtrado de solicitudes
  const filteredSolicitudes = useMemo(() => {
    return solicitudes.filter(item => {
      // 0. Si el usuario NO es admin, solo podrá ver las solicitudes que ha realizado
      if (!isAdmin && !isSolicitudRealizadaPorUsuario(item, user, userName)) {
        return false;
      }

      // 1. Tipo
      if (tipoFiltro !== 'todas' && item.tipo !== tipoFiltro) {
        return false;
      }

      // 2. Seccional (Solo aplicable si es admin)
      if (isAdmin) {
        if (isRestrictedSeccional && userSeccionalNombre) {
          if (!item.seccional_nombre.toLowerCase().includes(userSeccionalNombre.toLowerCase())) {
            return false;
          }
        } else if (filterSeccional !== 'Todas') {
          if (item.seccional_nombre !== filterSeccional) {
            return false;
          }
        }
      }

      // 3. Estado
      if (filterEstado !== 'Todos') {
        if (item.estado !== filterEstado) {
          return false;
        }
      }

      // 4. Búsqueda por texto
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesFolio = item.folio.toLowerCase().includes(query);
        const matchesSolicitante = item.solicitante.toLowerCase().includes(query);
        const matchesSeccional = item.seccional_nombre.toLowerCase().includes(query);
        const matchesDetalle = item.detalle_resumen.toLowerCase().includes(query) || item.detalle_completo.toLowerCase().includes(query);
        const matchesVehiculo = item.vehiculo_info ? item.vehiculo_info.toLowerCase().includes(query) : false;

        if (!matchesFolio && !matchesSolicitante && !matchesSeccional && !matchesDetalle && !matchesVehiculo) {
          return false;
        }
      }

      return true;
    });
  }, [solicitudes, tipoFiltro, filterSeccional, filterEstado, searchTerm, isRestrictedSeccional, userSeccionalNombre, isAdmin, user, userName]);

  // Manejar apertura de PDF
  const handleOpenPdf = (item: SolicitudUnifiedItem) => {
    if (item.tipo === 'combustible' && item.rawCombustible) {
      setPdfCombustibleItem(item.rawCombustible);
    } else if (item.tipo === 'compra' && item.rawCompra) {
      setPdfCompraItem(item.rawCompra);
    }
  };

  // Contadores por tipo
  const countCombustible = useMemo(() => solicitudes.filter(s => s.tipo === 'combustible').length, [solicitudes]);
  const countCompra = useMemo(() => solicitudes.filter(s => s.tipo === 'compra').length, [solicitudes]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* Encabezado Principal */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-primary text-white rounded-2xl shadow-sm">
            <ClipboardList className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                {isAdmin ? 'Página Central de Solicitudes' : 'Mis Solicitudes Realizadas'}
              </h1>
              {!isAdmin ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <User className="w-3 h-3 mr-1 text-emerald-600" />
                  {userName && userName !== 'Usuario' ? userName : (user?.email || 'Mis Solicitudes')}
                </span>
              ) : (
                isRestrictedSeccional && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                    <Building2 className="w-3 h-3 mr-1" />
                    {userSeccionalNombre || 'Tu Seccional'}
                  </span>
                )
              )}
            </div>
            <p className="text-xs md:text-sm text-gray-500 mt-0.5">
              {isAdmin
                ? 'Historial unificado de solicitudes de compra, mantenimiento y dotación de combustible, con registro de correos y PDF oficial.'
                : 'Historial exclusivo de las solicitudes que tú has realizado. Consulta el estado de aprobación y descarga los comprobantes en PDF.'
              }
            </p>
          </div>
        </div>

        {/* Botones de Acción Rápida para Nuevas Solicitudes */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => navigate('/solicitudes-combustible')}
            className="inline-flex items-center px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Fuel className="w-4 h-4 mr-1.5" />
            + Nueva Solicitud de Combustible
          </button>

          <button
            onClick={() => navigate('/solicitudes-compra')}
            className="inline-flex items-center px-4 py-2.5 bg-primary hover:bg-blue-900 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <FileText className="w-4 h-4 mr-1.5" />
            + Nueva Solicitud de Compra
          </button>

          <button
            onClick={fetchAllData}
            title="Recargar datos"
            className="p-2.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl transition shadow-2xs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tarjetas de Resumen Rápido / Pestañas de Tipo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        
        {/* Todas */}
        <button
          onClick={() => setTipoFiltro('todas')}
          className={`p-4 rounded-xl border text-left transition ${
            tipoFiltro === 'todas'
              ? 'bg-white border-primary ring-2 ring-primary/20 shadow-sm'
              : 'bg-gray-50/70 hover:bg-white border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              {isAdmin ? 'Todas las Solicitudes' : 'Mis Solicitudes'}
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-800">
              {solicitudes.length}
            </span>
          </div>
          <p className="text-2xl font-black text-gray-900 mt-2">
            {solicitudes.length}
          </p>
          <span className="text-xs text-gray-500 mt-1 block">
            {isAdmin ? 'Compra, Mantenimiento y Combustible' : 'Realizadas por ti en el sistema'}
          </span>
        </button>

        {/* Combustible */}
        <button
          onClick={() => setTipoFiltro('combustible')}
          className={`p-4 rounded-xl border text-left transition ${
            tipoFiltro === 'combustible'
              ? 'bg-emerald-50/50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
              : 'bg-gray-50/70 hover:bg-white border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 flex items-center">
              <Fuel className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              {isAdmin ? 'Combustible' : 'Mis Solicitudes de Combustible'}
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {countCombustible}
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-900 mt-2">
            {countCombustible}
          </p>
          <span className="text-xs text-emerald-700 mt-1 block">
            Dotación y liquidación de combustible
          </span>
        </button>

        {/* Compra */}
        <button
          onClick={() => setTipoFiltro('compra')}
          className={`p-4 rounded-xl border text-left transition ${
            tipoFiltro === 'compra'
              ? 'bg-blue-50/50 border-primary ring-2 ring-primary/20 shadow-sm'
              : 'bg-gray-50/70 hover:bg-white border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center">
              <FileText className="w-3.5 h-3.5 mr-1 text-primary" />
              {isAdmin ? 'Compras y Mantenimiento' : 'Mis Solicitudes de Compra'}
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              {countCompra}
            </span>
          </div>
          <p className="text-2xl font-black text-primary mt-2">
            {countCompra}
          </p>
          <span className="text-xs text-blue-700 mt-1 block">
            Repuestos, suministros y servicios
          </span>
        </button>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
          
          {/* Buscador */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por folio, solicitante, seccional, detalle, vehículo..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            />
          </div>

          {/* Filtro Tipo */}
          <div className="md:col-span-2">
            <select
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value as TipoSolicitudFilter)}
              className="w-full py-2 px-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white font-medium"
            >
              <option value="todas">Tipo: Todos</option>
              <option value="combustible">⛽ Combustible</option>
              <option value="compra">🛒 Compra / Mant.</option>
            </select>
          </div>

          {/* Filtro Estado */}
          <div className="md:col-span-2">
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="w-full py-2 px-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white font-medium"
            >
              <option value="Todos">Estado: Todos</option>
              <option value="Pendiente">🟡 Pendiente</option>
              <option value="Aprobada">🟢 Aprobada</option>
              <option value="Rechazada">🔴 Rechazada</option>
              <option value="En Proceso">🔵 En Proceso</option>
            </select>
          </div>

          {/* Filtro Seccional o Indicador de Vista Personal */}
          <div className="md:col-span-3">
            {!isAdmin ? (
              <div className="w-full py-2 px-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-emerald-900 text-xs font-medium">
                <span className="truncate flex items-center">
                  <User className="w-3.5 h-3.5 mr-1.5 text-emerald-600 shrink-0" />
                  Solo mis solicitudes
                </span>
                <span className="text-2xs bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold shrink-0">Activo</span>
              </div>
            ) : isRestrictedSeccional ? (
              <div className="w-full py-2 px-3 bg-gray-100 border border-gray-300 rounded-lg flex items-center justify-between text-gray-700 font-medium">
                <span className="truncate">Seccional: {userSeccionalNombre}</span>
                <span className="text-2xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">Fijada</span>
              </div>
            ) : (
              <select
                value={filterSeccional}
                onChange={(e) => setFilterSeccional(e.target.value)}
                className="w-full py-2 px-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white font-medium"
              >
                <option value="Todas">Seccional: Todas las seccionales</option>
                {seccionales.map(s => (
                  <option key={s.id} value={s.nombre}>{s.nombre}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Badges de filtros activos */}
        {(searchTerm || filterEstado !== 'Todos' || filterSeccional !== 'Todas' || tipoFiltro !== 'todas') && (
          <div className="flex items-center justify-between pt-1 border-t border-gray-100 text-2xs text-gray-500">
            <span className="font-medium">
              Mostrando {filteredSolicitudes.length} de {solicitudes.length} solicitudes encontradas
            </span>
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterEstado('Todos');
                if (!isRestrictedSeccional) setFilterSeccional('Todas');
                setTipoFiltro('todas');
              }}
              className="text-primary hover:underline font-bold"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Tabla de Solicitudes */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto"></div>
            <p className="mt-3 text-xs text-gray-500 font-medium">Cargando solicitudes unificadas...</p>
          </div>
        ) : filteredSolicitudes.length === 0 ? (
          <div className="py-16 text-center text-gray-500 space-y-3">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto" />
            <p className="text-sm font-bold text-gray-700">
              {!isAdmin 
                ? 'No has realizado ninguna solicitud todavía'
                : 'No se encontraron solicitudes registradas'
              }
            </p>
            <p className="text-xs text-gray-400 max-w-md mx-auto">
              {searchTerm || filterEstado !== 'Todos' || (isAdmin && filterSeccional !== 'Todas')
                ? 'Pruebe a cambiar los términos de búsqueda o los filtros aplicados.'
                : !isAdmin
                ? 'Las solicitudes de combustible o compra que tú envíes se listarán automáticamente en esta tabla con su estado y copia PDF.'
                : 'Puede registrar una nueva solicitud utilizando los botones superiores.'}
            </p>
            {!isAdmin && (
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => navigate('/solicitudes-combustible')}
                  className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                >
                  <Fuel className="w-4 h-4 mr-1.5" />
                  + Nueva Solicitud de Combustible
                </button>
                <button
                  onClick={() => navigate('/solicitudes-compra')}
                  className="inline-flex items-center px-4 py-2 bg-primary hover:bg-blue-900 text-white rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                >
                  <FileText className="w-4 h-4 mr-1.5" />
                  + Nueva Solicitud de Compra
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50 border-b border-gray-200 uppercase text-2xs font-bold text-gray-700 tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Folio / Tipo</th>
                  <th className="px-4 py-3.5">Seccional</th>
                  <th className="px-4 py-3.5">Solicitante</th>
                  <th className="px-4 py-3.5">Fecha</th>
                  <th className="px-4 py-3.5">Requerimiento</th>
                  <th className="px-4 py-3.5">Estado</th>
                  <th className="px-4 py-3.5 text-center">Envío Correo y PDF</th>
                  <th className="px-4 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSolicitudes.map((item) => {
                  const isCombustible = item.tipo === 'combustible';

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                      
                      {/* Folio y Tipo */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-2xs font-bold ${
                              isCombustible
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {isCombustible ? (
                              <>
                                <Fuel className="w-3 h-3 mr-1" />
                                Combustible
                              </>
                            ) : (
                              <>
                                <FileText className="w-3 h-3 mr-1" />
                                Compra
                              </>
                            )}
                          </span>
                          <span className="font-mono font-bold text-gray-900">
                            {item.folio}
                          </span>
                        </div>
                      </td>

                      {/* Seccional */}
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-800">
                        <div className="flex items-center space-x-1.5">
                          <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span>{item.seccional_nombre}</span>
                        </div>
                      </td>

                      {/* Solicitante */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold text-gray-900">{item.solicitante}</div>
                        <div className="text-2xs text-gray-500">{item.cargo}</div>
                      </td>

                      {/* Fecha */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center space-x-1 text-gray-800 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span>{item.fecha}</span>
                        </div>
                        <div className="text-2xs text-gray-400">{item.hora}</div>
                      </td>

                      {/* Requerimiento */}
                      <td className="px-4 py-3 max-w-xs truncate">
                        <div className="font-medium text-gray-900 truncate">
                          {item.detalle_resumen}
                        </div>
                        {item.vehiculo_info && (
                          <div className="text-2xs text-blue-700 flex items-center space-x-1 truncate mt-0.5">
                            <Truck className="w-3 h-3 shrink-0" />
                            <span className="truncate">{item.vehiculo_info}</span>
                          </div>
                        )}
                        {item.monto_o_dotacion && (
                          <div className="text-2xs text-gray-500 mt-0.5">
                            {item.monto_o_dotacion}
                          </div>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-2xs font-bold ${
                            item.estado === 'Aprobada'
                              ? 'bg-green-100 text-green-800'
                              : item.estado === 'Pendiente'
                              ? 'bg-amber-100 text-amber-800'
                              : item.estado === 'Rechazada'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {item.estado === 'Aprobada' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                          {item.estado === 'Pendiente' && <Clock className="w-3 h-3 mr-1" />}
                          {item.estado === 'Rechazada' && <XCircle className="w-3 h-3 mr-1" />}
                          {item.estado}
                        </span>
                      </td>

                      {/* Envío Correo y Copia PDF */}
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {item.correo_enviado ? (
                          <button
                            onClick={() => setEmailInfoItem(item)}
                            className="inline-flex items-center px-2.5 py-1 rounded-lg text-2xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition cursor-pointer"
                            title="Haga clic para ver los correos a los que se envió"
                          >
                            <Mail className="w-3 h-3 mr-1 text-emerald-600" />
                            Notificado (Ver)
                          </button>
                        ) : (
                          <span className="text-2xs text-gray-400 italic">
                            No notificado
                          </span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3 whitespace-nowrap text-right space-x-1.5">
                        
                        {/* Ver más detalles */}
                        <button
                          onClick={() => setDetailItem(item)}
                          className="inline-flex items-center p-1.5 text-gray-600 hover:text-primary hover:bg-gray-100 rounded-lg transition"
                          title="Ver más detalles de la solicitud"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Ver correos notificados */}
                        <button
                          onClick={() => setEmailInfoItem(item)}
                          className="inline-flex items-center p-1.5 text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                          title="Ver a qué correos se envió la información y la copia de PDF"
                        >
                          <Mail className="w-4 h-4" />
                        </button>

                        {/* Descargar / Ver PDF */}
                        <button
                          onClick={() => handleOpenPdf(item)}
                          className="inline-flex items-center px-2.5 py-1 bg-gray-900 hover:bg-black text-white rounded-lg text-2xs font-bold transition shadow-2xs cursor-pointer"
                          title="Abrir y descargar documento oficial en PDF"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          PDF
                        </button>

                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: VER MÁS DETALLES DE LA SOLICITUD                 */}
      {/* ========================================================= */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200">
            
            {/* Header del Modal */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/70 rounded-t-2xl">
              <div className="flex items-center space-x-2.5">
                <span
                  className={`p-2 rounded-xl text-white ${
                    detailItem.tipo === 'combustible' ? 'bg-emerald-600' : 'bg-primary'
                  }`}
                >
                  {detailItem.tipo === 'combustible' ? <Fuel className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                </span>
                <div>
                  <h3 className="text-base font-black text-gray-900">
                    Detalle de Solicitud ({detailItem.folio})
                  </h3>
                  <p className="text-xs text-gray-500">
                    {detailItem.tipo === 'combustible' ? 'Dotación de Combustible Institucional' : 'Compra y Mantenimiento'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setDetailItem(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg transition"
              >
                ✕
              </button>
            </div>

            {/* Contenido del Detalle */}
            <div className="p-6 space-y-4 text-xs">
              
              {/* Bloque Principal */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div>
                  <span className="text-gray-400 block uppercase font-bold text-2xs">Folio Único</span>
                  <span className="font-mono font-bold text-gray-900 text-sm">{detailItem.folio}</span>
                </div>
                <div>
                  <span className="text-gray-400 block uppercase font-bold text-2xs">Seccional</span>
                  <span className="font-semibold text-gray-900">{detailItem.seccional_nombre}</span>
                </div>
                <div>
                  <span className="text-gray-400 block uppercase font-bold text-2xs">Estado</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold mt-0.5 ${
                      detailItem.estado === 'Aprobada'
                        ? 'bg-green-100 text-green-800'
                        : detailItem.estado === 'Pendiente'
                        ? 'bg-amber-100 text-amber-800'
                        : detailItem.estado === 'Rechazada'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {detailItem.estado}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block uppercase font-bold text-2xs">Solicitado por</span>
                  <span className="font-medium text-gray-800">{detailItem.solicitante}</span>
                </div>
                <div>
                  <span className="text-gray-400 block uppercase font-bold text-2xs">Cargo</span>
                  <span className="text-gray-700">{detailItem.cargo}</span>
                </div>
                <div>
                  <span className="text-gray-400 block uppercase font-bold text-2xs">Fecha y Hora</span>
                  <span className="text-gray-700">{detailItem.fecha} ({detailItem.hora})</span>
                </div>
              </div>

              {/* Información de Requerimiento */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-2">
                <span className="text-xs font-bold text-gray-800 uppercase tracking-wider block">
                  Descripción del Requerimiento
                </span>
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {detailItem.detalle_completo}
                </p>

                {detailItem.vehiculo_info && (
                  <div className="pt-2 border-t border-gray-100 flex items-center space-x-2 text-primary font-medium">
                    <Truck className="w-4 h-4" />
                    <span>Vehículo / Unidad asignada: {detailItem.vehiculo_info}</span>
                  </div>
                )}

                {detailItem.monto_o_dotacion && (
                  <div className="pt-1 text-gray-600 font-semibold">
                    Presupuesto / Concepto: {detailItem.monto_o_dotacion}
                  </div>
                )}
              </div>

              {/* Autorización / Rechazo si aplica */}
              {detailItem.autorizado_por && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3.5 text-green-900">
                  <div className="flex items-center space-x-2 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span>Autorizado formalmente</span>
                  </div>
                  <p className="mt-1 text-2xs text-green-800">
                    Aprobado por: <span className="font-semibold">{detailItem.autorizado_por}</span> {detailItem.fecha_autorizacion ? `el ${new Date(detailItem.fecha_autorizacion).toLocaleDateString()}` : ''}
                  </p>
                </div>
              )}

              {detailItem.motivo_rechazo && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-red-900">
                  <div className="flex items-center space-x-2 font-bold">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span>Motivo de Rechazo</span>
                  </div>
                  <p className="mt-1 text-2xs text-red-800">
                    {detailItem.motivo_rechazo}
                  </p>
                </div>
              )}

            </div>

            {/* Footer con Acciones */}
            <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-b-2xl">
              <button
                onClick={() => {
                  setDetailItem(null);
                  setEmailInfoItem(detailItem);
                }}
                className="inline-flex items-center px-3.5 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition"
              >
                <Mail className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                Ver Correos Enviados y Copias
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setDetailItem(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition"
                >
                  Cerrar
                </button>

                <button
                  onClick={() => {
                    handleOpenPdf(detailItem);
                    setDetailItem(null);
                  }}
                  className="inline-flex items-center px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-lg text-xs font-bold transition shadow-xs"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Descargar / Imprimir PDF
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: A QUÉ CORREOS SE LES ENVIÓ LA INFORMACIÓN Y PDF  */}
      {/* ========================================================= */}
      {emailInfoItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-gray-200 overflow-hidden">
            
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-emerald-50/60">
              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 bg-emerald-600 text-white rounded-xl">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">
                    Historial de Notificación y Envío de Correos
                  </h3>
                  <p className="text-xs text-emerald-800 font-medium">
                    Folio: <span className="font-mono font-bold">{emailInfoItem.folio}</span> • {emailInfoItem.seccional_nombre}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setEmailInfoItem(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg transition"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              
              {/* Estado de envío */}
              <div className="flex items-center justify-between p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold text-emerald-900 block">
                      {emailInfoItem.correo_enviado ? 'Correos Emitidos con Éxito' : 'Pendiente de Notificación'}
                    </span>
                    <span className="text-2xs text-emerald-700">
                      Copia digital en formato PDF oficial adjuntada automáticamente.
                    </span>
                  </div>
                </div>
                <span className="text-2xs font-mono font-bold bg-white text-emerald-800 px-2 py-1 rounded-md border border-emerald-300">
                  {emailInfoItem.fecha} {emailInfoItem.hora}
                </span>
              </div>

              {/* Lista Desglosada de Destinatarios */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-800 uppercase tracking-wider block">
                  Destinatarios y Copias Notificadas (CC)
                </span>

                <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden bg-white">
                  
                  {/* Correo del Solicitante con copia */}
                  {emailInfoItem.correo_solicitante && (
                    <div className="p-3 flex items-start justify-between bg-blue-50/40">
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-gray-900">{emailInfoItem.correo_solicitante}</span>
                          <span className="text-2xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                            Copia al Solicitante
                          </span>
                        </div>
                        <p className="text-2xs text-gray-500 mt-0.5">
                          Acuse de recibo y copia de PDF para {emailInfoItem.solicitante} ({emailInfoItem.seccional_nombre})
                        </p>
                      </div>
                      <Check className="w-4 h-4 text-emerald-600 mt-1 shrink-0" />
                    </div>
                  )}

                  {/* Correos adicionales notificados */}
                  {emailInfoItem.correos_notificados ? (
                    emailInfoItem.correos_notificados.split(',').map((c, idx) => {
                      const trimmed = c.trim();
                      if (!trimmed || trimmed === emailInfoItem.correo_solicitante) return null;
                      
                      const isAdminDest = trimmed.includes('administracion') || trimmed.includes('combustible');
                      const isPresidencia = trimmed.includes('presidencia');

                      return (
                        <div key={idx} className="p-3 flex items-start justify-between hover:bg-gray-50 transition">
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <span className="font-bold text-gray-900">{trimmed}</span>
                              <span className="text-2xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-bold">
                                {isAdminDest ? 'Revisión y Control' : isPresidencia ? 'Copia Institucional (CC)' : 'Destinatario'}
                              </span>
                            </div>
                            <p className="text-2xs text-gray-400 mt-0.5">
                              Notificación instantánea con archivo PDF descargable
                            </p>
                          </div>
                          <Check className="w-4 h-4 text-emerald-600 mt-1 shrink-0" />
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-3 text-gray-500 italic">
                      No se registraron correos adicionales en el envío.
                    </div>
                  )}

                </div>
              </div>

              {/* Asunto y plantilla utilizada */}
              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 space-y-1.5 text-2xs">
                <span className="font-bold text-gray-700 block">Asunto Registrado:</span>
                <p className="font-mono text-gray-800 bg-white p-2 rounded border border-gray-200">
                  {emailInfoItem.tipo === 'combustible'
                    ? `Solicitud de Combustible [${emailInfoItem.folio}] - ${emailInfoItem.seccional_nombre} - ${emailInfoItem.solicitante} - ${emailInfoItem.fecha}`
                    : `Solicitud de Compra [${emailInfoItem.folio}] - ${emailInfoItem.seccional_nombre} - ${emailInfoItem.solicitante} - ${emailInfoItem.fecha}`}
                </p>
              </div>

            </div>

            <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50 rounded-b-2xl">
              <button
                onClick={() => {
                  handleOpenPdf(emailInfoItem);
                  setEmailInfoItem(null);
                }}
                className="inline-flex items-center px-3.5 py-2 bg-gray-900 hover:bg-black text-white rounded-lg text-xs font-bold transition"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Descargar Copia de PDF
              </button>

              <button
                onClick={() => setEmailInfoItem(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs font-semibold transition"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: PDF DE COMBUSTIBLE                               */}
      {/* ========================================================= */}
      {pdfCombustibleItem && (
        <CombustiblePdfModal
          solicitud={pdfCombustibleItem}
          config={combustibleConfig}
          onClose={() => setPdfCombustibleItem(null)}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL 4: PDF DE COMPRA Y MANTENIMIENTO                    */}
      {/* ========================================================= */}
      {pdfCompraItem && (
        <CompraPdfPreviewModal
          solicitud={pdfCompraItem}
          config={compraConfig}
          onClose={() => setPdfCompraItem(null)}
        />
      )}

    </div>
  );
}
