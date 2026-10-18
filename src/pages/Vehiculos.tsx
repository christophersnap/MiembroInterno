import React, { useState, useEffect, useMemo } from 'react';
import { 
  Truck, Car, Plus, Search, Filter, AlertTriangle, CheckCircle2, Clock, 
  Wrench, ShieldAlert, Calendar, DollarSign, Eye, Trash2, Edit3, Camera, 
  FileText, Fuel, Gauge, MapPin, Anchor, Plane, ArrowUpDown, X, UploadCloud,
  FileCheck, AlertCircle, RefreshCw, Copy, Check, ExternalLink, ChevronRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logActivity } from '../lib/logger';

export interface Vehiculo {
  id: number;
  placa: string;
  tipo_placa: string;
  tipo_vehiculo: 'Terrestre' | 'Acuático' | 'Aéreo';
  carroceria: string;
  marca: string;
  modelo: string;
  anio?: number;
  vin?: string;
  numero_motor?: string;
  anio_ingreso?: number;
  seccional_id?: number;
  seccional_nombre?: string;
  donado: boolean;
  donante?: string;
  fecha_donacion?: string;
  combustible: string;
  millaje_ingreso: number;
  millaje_actual: number;
  unidad_distancia: 'km' | 'millas';
  numero_tarjeta_circulacion?: string;
  fecha_vencimiento_tarjeta?: string;
  tarjeta_circulacion_frente_url?: string;
  tarjeta_circulacion_reverso_url?: string;
  foto_vehiculo_url?: string;
  estado: 'Disponible' | 'No disponible' | 'En reparación' | 'En mantenimiento';
  notas?: string;
  created_at?: string;
}

export interface Mantenimiento {
  id: number;
  vehiculo_id: number;
  tipo: string;
  fecha: string;
  fecha_entrega?: string;
  millaje?: number;
  taller?: string;
  descripcion: string;
  costo: number;
  estado: 'Completado' | 'En proceso' | 'Programado';
  factura_url?: string;
  evidencia_url?: string;
  notas?: string;
  created_at?: string;
}

// Prefijos oficiales según Ley de Transporte Terrestre y Matrículas de El Salvador
const PREFIJOS_PLACA = [
  { value: 'CVS', label: 'CVS - Cruz Verde Salvadoreña', tipo: 'Terrestre', placeholder: '014 o 000-000' },
  { value: 'P', label: 'P - Particular', tipo: 'Terrestre', placeholder: '123-456' },
  { value: 'M', label: 'M - Motocicleta', tipo: 'Terrestre', placeholder: '123-456' },
  { value: 'C', label: 'C - Camión Pesado', tipo: 'Terrestre', placeholder: '123-456' },
  { value: 'A', label: 'A - Alquiler / Taxi', tipo: 'Terrestre', placeholder: '123-456' },
  { value: 'AB', label: 'AB - Autobús', tipo: 'Terrestre', placeholder: '123-456' },
  { value: 'MB', label: 'MB - Microbús', tipo: 'Terrestre', placeholder: '123-456' },
  { value: 'N', label: 'N - Nacional / Oficial', tipo: 'Terrestre', placeholder: '123-456' },
  { value: 'RE', label: 'RE - Remolque', tipo: 'Terrestre', placeholder: '123-456' },
  { value: 'MI', label: 'MI - Misión Internacional', tipo: 'Terrestre', placeholder: '123-456' },
  { value: 'B', label: 'B / EMB - Embarcación Acuática (AMP)', tipo: 'Acuático', placeholder: '001-234' },
  { value: 'YS', label: 'YS - Aeronave / Helicóptero (OACI)', tipo: 'Aéreo', placeholder: '001-CVS' },
  { value: 'OTRO', label: 'OTRO - Personalizado / Especial', tipo: 'Terrestre', placeholder: '000-000' },
];

const TIPOS_CARROCERIA = [
  'Ambulancia',
  'Pick Up',
  'Camioneta / SUV',
  'Sedán',
  'Microbús',
  'Camión',
  'Motocicleta',
  'Bote / Lancha',
  'Moto Acuática (Jet Ski)',
  'Helicóptero / Aeronave',
  'Otro'
];

const TIPOS_MANTENIMIENTO = [
  'Mantenimiento Preventivo',
  'Mantenimiento Correctivo',
  'Reparación Mecánica',
  'Reparación Eléctrica',
  'Cambio de Aceite y Filtros',
  'Frenos y Suspensión',
  'Llantas y Alineación',
  'Carrocería y Pintura',
  'Revisión Técnica / SERTRACEN',
  'Equipamiento Médico / Sirena',
  'Otro'
];

export default function Vehiculos() {
  const { permissions, role, userSeccionalId, userSeccionalNombre, allowSeccionalEditVehiculos } = useAuth();
  const isSeccionalUser = role !== 'admin' && !permissions.ver_todas_seccionales && Boolean(userSeccionalNombre || userSeccionalId);
  const canEdit = role === 'admin' || (Boolean(allowSeccionalEditVehiculos) && permissions.edit_vehiculos !== false);

  // Estados principales
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [seccionales, setSeccionales] = useState<{ id: number; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbTableMissing, setDbTableMissing] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Filtros y búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('Todos');
  const [filterSeccional, setFilterSeccional] = useState(userSeccionalNombre || 'Todas');
  const [filterCarroceria, setFilterCarroceria] = useState('Todas');
  const [filterTarjetaAlerta, setFilterTarjetaAlerta] = useState('Todas'); // 'Todas', 'Vigente', 'PorVencer', 'Vencida'
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  useEffect(() => {
    if (isSeccionalUser && userSeccionalNombre) {
      setFilterSeccional(userSeccionalNombre);
    }
  }, [isSeccionalUser, userSeccionalNombre]);

  // Modal Vehículo (Crear / Editar)
  const [showVehiculoModal, setShowVehiculoModal] = useState(false);
  const [editingVehiculo, setEditingVehiculo] = useState<Vehiculo | null>(null);
  const [savingVehiculo, setSavingVehiculo] = useState(false);
  const [vehiculoForm, setVehiculoForm] = useState({
    prefijo_placa: 'CVS',
    numero_placa: '',
    tipo_vehiculo: 'Terrestre' as 'Terrestre' | 'Acuático' | 'Aéreo',
    carroceria: 'Ambulancia',
    marca: '',
    modelo: '',
    anio: new Date().getFullYear(),
    vin: '',
    numero_motor: '',
    anio_ingreso: new Date().getFullYear(),
    seccional_id: '',
    donado: false,
    donante: '',
    fecha_donacion: '',
    combustible: 'Diésel',
    millaje_ingreso: '0',
    millaje_actual: '0',
    unidad_distancia: 'km' as 'km' | 'millas',
    numero_tarjeta_circulacion: '',
    fecha_vencimiento_tarjeta: '',
    estado: 'Disponible' as 'Disponible' | 'No disponible' | 'En reparación' | 'En mantenimiento',
    notas: ''
  });

  // Archivos del vehículo
  const [fotoVehiculoFile, setFotoVehiculoFile] = useState<File | null>(null);
  const [fotoVehiculoPreview, setFotoVehiculoPreview] = useState<string>('');
  const [tarjetaFrenteFile, setTarjetaFrenteFile] = useState<File | null>(null);
  const [tarjetaFrentePreview, setTarjetaFrentePreview] = useState<string>('');
  const [tarjetaReversoFile, setTarjetaReversoFile] = useState<File | null>(null);
  const [tarjetaReversoPreview, setTarjetaReversoPreview] = useState<string>('');

  // Modal Historial de Mantenimientos
  const [selectedVehiculoForMaint, setSelectedVehiculoForMaint] = useState<Vehiculo | null>(null);
  const [mantenimientos, setMantenimientos] = useState<Mantenimiento[]>([]);
  const [loadingMaint, setLoadingMaint] = useState(false);

  // Modal Nuevo Mantenimiento
  const [showNewMaintModal, setShowNewMaintModal] = useState(false);
  const [savingMaint, setSavingMaint] = useState(false);
  const [maintForm, setMaintForm] = useState({
    tipo: 'Mantenimiento Preventivo',
    fecha: new Date().toISOString().split('T')[0],
    fecha_entrega: '',
    millaje: '',
    taller: '',
    descripcion: '',
    costo: '0.00',
    estado: 'Completado' as 'Completado' | 'En proceso' | 'Programado',
    notas: '',
    cambiarEstadoVehiculo: true
  });
  const [facturaFile, setFacturaFile] = useState<File | null>(null);
  const [facturaPreview, setFacturaPreview] = useState<string>('');
  const [evidenciaFile, setEvidenciaFile] = useState<File | null>(null);
  const [evidenciaPreview, setEvidenciaPreview] = useState<string>('');

  // Visor de Imagen Grande
  const [imageViewerUrl, setImageViewerUrl] = useState<string | null>(null);
  const [imageViewerTitle, setImageViewerTitle] = useState<string>('');

  // Carga inicial
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Cargar Seccionales
      const { data: secData } = await supabase
        .from('seccionales')
        .select('id, nombre')
        .eq('estado', 'Activa')
        .order('nombre');
      
      const seccs = secData || [];
      setSeccionales(seccs);

      // 2. Cargar Vehículos
      const { data: vehData, error: vehError } = await supabase
        .from('vehiculos')
        .select('*')
        .order('id', { ascending: false });

      if (vehError) {
        if (vehError.code === '42P01' || vehError.message?.includes('relation "public.vehiculos" does not exist')) {
          setDbTableMissing(true);
          // Cargar desde caché local de demostración para no bloquear
          const localVeh = sessionStorage.getItem('cruz_verde_demo_vehiculos');
          if (localVeh) {
            setVehiculos(JSON.parse(localVeh));
          } else {
            // Ejemplo de demostración ilustrativo
            const demoList: Vehiculo[] = [
              {
                id: 1,
                placa: 'CVS-014',
                tipo_placa: 'CVS',
                tipo_vehiculo: 'Terrestre',
                carroceria: 'Ambulancia',
                marca: 'Toyota',
                modelo: 'Land Cruiser HZJ78',
                anio: 2021,
                vin: 'JT111JA7890123456',
                numero_motor: '1HZ-0987654',
                anio_ingreso: 2021,
                seccional_id: seccs[0]?.id,
                seccional_nombre: seccs[0]?.nombre || 'Sede Central',
                donado: true,
                donante: 'Embajada de Japón en El Salvador',
                fecha_donacion: '2021-04-15',
                combustible: 'Diésel',
                millaje_ingreso: 120,
                millaje_actual: 34500,
                unidad_distancia: 'km',
                numero_tarjeta_circulacion: 'TC-2024-99881',
                fecha_vencimiento_tarjeta: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 15 días: Por vencer
                estado: 'Disponible',
                notas: 'Unidad de soporte vital avanzado equipada para rescate y traslado.'
              },
              {
                id: 2,
                placa: 'P-584-912',
                tipo_placa: 'P',
                tipo_vehiculo: 'Terrestre',
                carroceria: 'Pick Up',
                marca: 'Nissan',
                modelo: 'Frontier 4x4 Doble Cabina',
                anio: 2019,
                vin: '3N6DD03T5KK123987',
                anio_ingreso: 2020,
                seccional_id: seccs[1]?.id || seccs[0]?.id,
                seccional_nombre: seccs[1]?.nombre || 'Santa Ana',
                donado: false,
                combustible: 'Diésel',
                millaje_ingreso: 45000,
                millaje_actual: 89200,
                unidad_distancia: 'km',
                numero_tarjeta_circulacion: 'TC-2023-45123',
                fecha_vencimiento_tarjeta: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Vencida hace 5 días
                estado: 'En mantenimiento',
                notas: 'En cambio preventivo de frenos y amortiguadores.'
              },
              {
                id: 3,
                placa: 'B-002-104',
                tipo_placa: 'B',
                tipo_vehiculo: 'Acuático',
                carroceria: 'Bote / Lancha',
                marca: 'Yamaha',
                modelo: 'Rescate Acuático 25ft',
                anio: 2022,
                vin: 'YAM-AQ-778899',
                anio_ingreso: 2022,
                seccional_id: seccs[0]?.id,
                seccional_nombre: 'Unidad de Rescate Anfibio',
                donado: true,
                donante: 'Club Rotario San Salvador',
                fecha_donacion: '2022-08-10',
                combustible: 'Gasolina Regular',
                millaje_ingreso: 0,
                millaje_actual: 450,
                unidad_distancia: 'km',
                numero_tarjeta_circulacion: 'AMP-MAT-2022-88',
                fecha_vencimiento_tarjeta: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Vigente
                estado: 'Disponible',
                notas: 'Embarcación equipada con motor fuera de borda 150HP y camillas flotantes.'
              }
            ];
            setVehiculos(demoList);
            sessionStorage.setItem('cruz_verde_demo_vehiculos', JSON.stringify(demoList));
          }
        } else {
          console.error('Error al consultar vehículos:', vehError);
        }
      } else {
        setDbTableMissing(false);
        // Asociar nombres de seccionales
        const mapped = (vehData || []).map((v: any) => {
          const sec = seccs.find(s => s.id === v.seccional_id);
          return {
            ...v,
            seccional_nombre: sec ? sec.nombre : 'Sin seccional asignada'
          };
        });
        setVehiculos(mapped);
      }
    } catch (err) {
      console.error('Error general cargando vehículos:', err);
    } finally {
      setLoading(false);
    }
  };

  // Cálculo de alerta de vencimiento de Tarjeta de Circulación (Ley salvadoreña)
  const getTarjetaStatus = (fechaVenc?: string) => {
    if (!fechaVenc) {
      return {
        code: 'SinFecha',
        badge: 'Sin fecha registrada',
        color: 'bg-gray-100 text-gray-700 border-gray-300',
        emoji: '⚪',
        daysRemaining: null,
        message: 'No se ha ingresado fecha de vencimiento'
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [year, month, day] = fechaVenc.split('-').map(Number);
    const expDate = new Date(year, month - 1, day);
    expDate.setHours(0, 0, 0, 0);

    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const daysOverdue = Math.abs(diffDays);
      return {
        code: 'Vencida',
        badge: '🚨 Vencida',
        color: 'bg-red-100 text-red-800 border-red-300',
        emoji: '🚨',
        daysRemaining: diffDays,
        message: `Venció hace ${daysOverdue} día${daysOverdue === 1 ? '' : 's'}. Infracción de tránsito aplicable.`
      };
    } else if (diffDays <= 30) {
      return {
        code: 'PorVencer',
        badge: '⚠️ Por vencer',
        color: 'bg-amber-100 text-amber-800 border-amber-300',
        emoji: '⚠️',
        daysRemaining: diffDays,
        message: `Vence en ${diffDays} día${diffDays === 1 ? '' : 's'}. Período de refrenda activo.`
      };
    } else {
      return {
        code: 'Vigente',
        badge: '🟢 Vigente',
        color: 'bg-green-100 text-green-800 border-green-300',
        emoji: '🟢',
        daysRemaining: diffDays,
        message: `Vigente por ${diffDays} días más.`
      };
    }
  };

  // Subir archivo a Supabase Storage con fallback seguro a Data URL base64
  const uploadImageFile = async (file: File, folder: string): Promise<string> => {
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const cleanFileName = `vehiculos/${folder}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

      // Intentar subir a bucket socorristas (que ya existe)
      const { error } = await supabase.storage
        .from('socorristas')
        .upload(cleanFileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (!error) {
        const { data: { publicUrl } } = supabase.storage
          .from('socorristas')
          .getPublicUrl(cleanFileName);
        return publicUrl;
      }
      console.warn('Storage upload falló, usando Data URL local:', error);
    } catch (e) {
      console.warn('Excepción al subir archivo a storage, generando fallback:', e);
    }

    // Fallback: convertir a Data URL (asegura que nunca falle el guardado para el usuario)
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target?.result as string);
      reader.readAsDataURL(file);
    });
  };

  // Filtrado de vehículos
  const filteredVehiculos = useMemo(() => {
    return vehiculos.filter(v => {
      // 1. Búsqueda por texto
      const search = searchTerm.toLowerCase().trim();
      const matchesSearch = !search || 
        v.placa.toLowerCase().includes(search) ||
        v.marca.toLowerCase().includes(search) ||
        v.modelo.toLowerCase().includes(search) ||
        (v.vin && v.vin.toLowerCase().includes(search)) ||
        (v.seccional_nombre && v.seccional_nombre.toLowerCase().includes(search)) ||
        (v.donante && v.donante.toLowerCase().includes(search));

      // 2. Filtro por Estado
      const matchesEstado = filterEstado === 'Todos' || v.estado === filterEstado;

      // 3. Filtro por Seccional
      let matchesSeccional = true;
      if (isSeccionalUser && userSeccionalNombre) {
        matchesSeccional = v.seccional_nombre === userSeccionalNombre || (userSeccionalId ? v.seccional_id === userSeccionalId : false);
      } else {
        matchesSeccional = filterSeccional === 'Todas' || 
          (filterSeccional === 'SinAsignar' ? !v.seccional_id : String(v.seccional_id) === filterSeccional);
      }

      // 4. Filtro por Carrocería
      const matchesCarroceria = filterCarroceria === 'Todas' || v.carroceria === filterCarroceria;

      // 5. Filtro por Alerta de Tarjeta de Circulación
      const tStatus = getTarjetaStatus(v.fecha_vencimiento_tarjeta);
      const matchesAlerta = filterTarjetaAlerta === 'Todas' || tStatus.code === filterTarjetaAlerta;

      return matchesSearch && matchesEstado && matchesSeccional && matchesCarroceria && matchesAlerta;
    });
  }, [vehiculos, searchTerm, filterEstado, filterSeccional, filterCarroceria, filterTarjetaAlerta]);

  // Contadores para métricas
  const stats = useMemo(() => {
    let disponibles = 0;
    let enTaller = 0;
    let porVencer = 0;
    let vencidas = 0;

    vehiculos.forEach(v => {
      if (v.estado === 'Disponible') disponibles++;
      if (v.estado === 'En reparación' || v.estado === 'En mantenimiento') enTaller++;

      const st = getTarjetaStatus(v.fecha_vencimiento_tarjeta);
      if (st.code === 'PorVencer') porVencer++;
      if (st.code === 'Vencida') vencidas++;
    });

    return {
      total: vehiculos.length,
      disponibles,
      enTaller,
      porVencer,
      vencidas
    };
  }, [vehiculos]);

  // Abrir modal de nuevo vehículo
  const handleOpenNewVehiculo = () => {
    setEditingVehiculo(null);
    setVehiculoForm({
      prefijo_placa: 'CVS',
      numero_placa: '',
      tipo_vehiculo: 'Terrestre',
      carroceria: 'Ambulancia',
      marca: '',
      modelo: '',
      anio: new Date().getFullYear(),
      vin: '',
      numero_motor: '',
      anio_ingreso: new Date().getFullYear(),
      seccional_id: seccionales[0]?.id ? String(seccionales[0].id) : '',
      donado: false,
      donante: '',
      fecha_donacion: '',
      combustible: 'Diésel',
      millaje_ingreso: '0',
      millaje_actual: '0',
      unidad_distancia: 'km',
      numero_tarjeta_circulacion: '',
      fecha_vencimiento_tarjeta: '',
      estado: 'Disponible',
      notas: ''
    });
    setFotoVehiculoFile(null);
    setFotoVehiculoPreview('');
    setTarjetaFrenteFile(null);
    setTarjetaFrentePreview('');
    setTarjetaReversoFile(null);
    setTarjetaReversoPreview('');
    setShowVehiculoModal(true);
  };

  // Abrir modal de editar vehículo
  const handleOpenEditVehiculo = (veh: Vehiculo) => {
    setEditingVehiculo(veh);

    // Separar prefijo de placa
    let prefijo = 'OTRO';
    let num = veh.placa;
    for (const p of PREFIJOS_PLACA) {
      if (p.value !== 'OTRO' && veh.placa.startsWith(`${p.value}-`)) {
        prefijo = p.value;
        num = veh.placa.substring(p.value.length + 1);
        break;
      }
    }

    setVehiculoForm({
      prefijo_placa: prefijo,
      numero_placa: num,
      tipo_vehiculo: veh.tipo_vehiculo,
      carroceria: veh.carroceria,
      marca: veh.marca,
      modelo: veh.modelo,
      anio: veh.anio || new Date().getFullYear(),
      vin: veh.vin || '',
      numero_motor: veh.numero_motor || '',
      anio_ingreso: veh.anio_ingreso || new Date().getFullYear(),
      seccional_id: veh.seccional_id ? String(veh.seccional_id) : '',
      donado: !!veh.donado,
      donante: veh.donante || '',
      fecha_donacion: veh.fecha_donacion || '',
      combustible: veh.combustible || 'Diésel',
      millaje_ingreso: String(veh.millaje_ingreso || 0),
      millaje_actual: String(veh.millaje_actual || 0),
      unidad_distancia: veh.unidad_distancia || 'km',
      numero_tarjeta_circulacion: veh.numero_tarjeta_circulacion || '',
      fecha_vencimiento_tarjeta: veh.fecha_vencimiento_tarjeta || '',
      estado: veh.estado,
      notas: veh.notas || ''
    });

    setFotoVehiculoFile(null);
    setFotoVehiculoPreview(veh.foto_vehiculo_url || '');
    setTarjetaFrenteFile(null);
    setTarjetaFrentePreview(veh.tarjeta_circulacion_frente_url || '');
    setTarjetaReversoFile(null);
    setTarjetaReversoPreview(veh.tarjeta_circulacion_reverso_url || '');
    setShowVehiculoModal(true);
  };

  // Guardar Vehículo
  const handleSaveVehiculo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehiculoForm.numero_placa.trim()) {
      alert('Por favor ingrese el número de placa del vehículo.');
      return;
    }
    if (!vehiculoForm.marca.trim() || !vehiculoForm.modelo.trim()) {
      alert('Por favor ingrese la marca y modelo del vehículo.');
      return;
    }

    setSavingVehiculo(true);
    try {
      // Armar la placa formal salvadoreña
      const placaFinal = vehiculoForm.prefijo_placa === 'OTRO' 
        ? vehiculoForm.numero_placa.trim().toUpperCase()
        : `${vehiculoForm.prefijo_placa}-${vehiculoForm.numero_placa.trim().toUpperCase()}`;

      // Subir imágenes si fueron seleccionadas
      let fotoUrl = editingVehiculo?.foto_vehiculo_url || '';
      if (fotoVehiculoFile) {
        fotoUrl = await uploadImageFile(fotoVehiculoFile, 'foto_vehiculo');
      }

      let tarjetaFrenteUrl = editingVehiculo?.tarjeta_circulacion_frente_url || '';
      if (tarjetaFrenteFile) {
        tarjetaFrenteUrl = await uploadImageFile(tarjetaFrenteFile, 'tarjeta_frente');
      }

      let tarjetaReversoUrl = editingVehiculo?.tarjeta_circulacion_reverso_url || '';
      if (tarjetaReversoFile) {
        tarjetaReversoUrl = await uploadImageFile(tarjetaReversoFile, 'tarjeta_reverso');
      }

      const payload: any = {
        placa: placaFinal,
        tipo_placa: vehiculoForm.prefijo_placa,
        tipo_vehiculo: vehiculoForm.tipo_vehiculo,
        carroceria: vehiculoForm.carroceria,
        marca: vehiculoForm.marca.trim(),
        modelo: vehiculoForm.modelo.trim(),
        anio: vehiculoForm.anio ? parseInt(String(vehiculoForm.anio), 10) : null,
        vin: vehiculoForm.vin.trim().toUpperCase() || null,
        numero_motor: vehiculoForm.numero_motor.trim().toUpperCase() || null,
        anio_ingreso: vehiculoForm.anio_ingreso ? parseInt(String(vehiculoForm.anio_ingreso), 10) : null,
        seccional_id: vehiculoForm.seccional_id ? parseInt(vehiculoForm.seccional_id, 10) : null,
        donado: vehiculoForm.donado,
        donante: vehiculoForm.donado ? vehiculoForm.donante.trim() : null,
        fecha_donacion: vehiculoForm.donado && vehiculoForm.fecha_donacion ? vehiculoForm.fecha_donacion : null,
        combustible: vehiculoForm.combustible,
        millaje_ingreso: parseFloat(vehiculoForm.millaje_ingreso) || 0,
        millaje_actual: parseFloat(vehiculoForm.millaje_actual) || parseFloat(vehiculoForm.millaje_ingreso) || 0,
        unidad_distancia: vehiculoForm.unidad_distancia,
        numero_tarjeta_circulacion: vehiculoForm.numero_tarjeta_circulacion.trim() || null,
        fecha_vencimiento_tarjeta: vehiculoForm.fecha_vencimiento_tarjeta || null,
        tarjeta_circulacion_frente_url: tarjetaFrenteUrl || null,
        tarjeta_circulacion_reverso_url: tarjetaReversoUrl || null,
        foto_vehiculo_url: fotoUrl || null,
        estado: vehiculoForm.estado,
        notas: vehiculoForm.notas.trim() || null,
        updated_at: new Date().toISOString()
      };

      if (dbTableMissing) {
        // Modo local / Fallback
        if (editingVehiculo) {
          const updated = vehiculos.map(v => v.id === editingVehiculo.id ? { 
            ...v, 
            ...payload, 
            seccional_nombre: seccionales.find(s => s.id === payload.seccional_id)?.nombre || 'Sin Seccional' 
          } : v);
          setVehiculos(updated);
          sessionStorage.setItem('cruz_verde_demo_vehiculos', JSON.stringify(updated));
        } else {
          const newId = Date.now();
          const newObj: Vehiculo = {
            id: newId,
            ...payload,
            seccional_nombre: seccionales.find(s => s.id === payload.seccional_id)?.nombre || 'Sin Seccional',
            created_at: new Date().toISOString()
          };
          const updated = [newObj, ...vehiculos];
          setVehiculos(updated);
          sessionStorage.setItem('cruz_verde_demo_vehiculos', JSON.stringify(updated));
        }
        setShowVehiculoModal(false);
        setSavingVehiculo(false);
        return;
      }

      if (editingVehiculo) {
        // Actualizar en Supabase
        const { error } = await supabase
          .from('vehiculos')
          .update(payload)
          .eq('id', editingVehiculo.id);

        if (error) throw error;
        await logActivity('Actualizó información de vehículo', 'Vehículos', editingVehiculo.id, { placa: placaFinal });
      } else {
        // Insertar en Supabase
        const { error } = await supabase
          .from('vehiculos')
          .insert([payload]);

        if (error) throw error;
        await logActivity('Registró nuevo vehículo en flota', 'Vehículos', placaFinal, { marca: payload.marca, modelo: payload.modelo });
      }

      setShowVehiculoModal(false);
      await fetchData();
    } catch (err: any) {
      console.error('Error al guardar vehículo:', err);
      alert(`Error al guardar vehículo: ${err.message || 'Error desconocido'}`);
    } finally {
      setSavingVehiculo(false);
    }
  };

  // Eliminar Vehículo
  const handleDeleteVehiculo = async (id: number, placa: string) => {
    if (!window.confirm(`¿Está seguro de eliminar el vehículo con placa "${placa}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      if (dbTableMissing) {
        const updated = vehiculos.filter(v => v.id !== id);
        setVehiculos(updated);
        sessionStorage.setItem('cruz_verde_demo_vehiculos', JSON.stringify(updated));
        return;
      }

      const { error } = await supabase
        .from('vehiculos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await logActivity('Eliminó vehículo de la flota', 'Vehículos', id, { placa });
      await fetchData();
    } catch (err: any) {
      console.error('Error al eliminar vehículo:', err);
      alert(`Error al eliminar: ${err.message}`);
    }
  };

  // Cargar Historial de Mantenimientos del Vehículo seleccionado
  const handleOpenMantenimientos = async (veh: Vehiculo) => {
    setSelectedVehiculoForMaint(veh);
    setLoadingMaint(true);
    try {
      if (dbTableMissing) {
        const localMaint = sessionStorage.getItem(`demo_maint_${veh.id}`);
        if (localMaint) {
          setMantenimientos(JSON.parse(localMaint));
        } else {
          // Registro de ejemplo para demo
          const demoM: Mantenimiento[] = [
            {
              id: 1,
              vehiculo_id: veh.id,
              tipo: 'Mantenimiento Preventivo',
              fecha: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              millaje: (veh.millaje_actual || 1000) - 2500,
              taller: 'Taller Central de Emergencias Cruz Verde',
              descripcion: 'Cambio de aceite sintético 15W40, filtro de aceite, filtro de aire y engrase general de suspensión.',
              costo: 145.50,
              estado: 'Completado'
            }
          ];
          setMantenimientos(demoM);
          sessionStorage.setItem(`demo_maint_${veh.id}`, JSON.stringify(demoM));
        }
      } else {
        const { data, error } = await supabase
          .from('vehiculo_mantenimientos')
          .select('*')
          .eq('vehiculo_id', veh.id)
          .order('fecha', { ascending: false });

        if (error) throw error;
        setMantenimientos(data || []);
      }
    } catch (err) {
      console.error('Error al cargar mantenimientos:', err);
    } finally {
      setLoadingMaint(false);
    }
  };

  // Abrir Modal de Registro de Mantenimiento
  const handleOpenNewMaint = () => {
    if (!selectedVehiculoForMaint) return;
    setMaintForm({
      tipo: 'Mantenimiento Preventivo',
      fecha: new Date().toISOString().split('T')[0],
      fecha_entrega: '',
      millaje: String(selectedVehiculoForMaint.millaje_actual || ''),
      taller: '',
      descripcion: '',
      costo: '0.00',
      estado: 'Completado',
      notas: '',
      cambiarEstadoVehiculo: true
    });
    setFacturaFile(null);
    setFacturaPreview('');
    setEvidenciaFile(null);
    setEvidenciaPreview('');
    setShowNewMaintModal(true);
  };

  // Guardar Mantenimiento / Reparación
  const handleSaveMantenimiento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehiculoForMaint) return;
    if (!maintForm.descripcion.trim()) {
      alert('Por favor describa el trabajo o reparación realizada.');
      return;
    }

    setSavingMaint(true);
    try {
      let factUrl = '';
      if (facturaFile) {
        factUrl = await uploadImageFile(facturaFile, 'factura');
      }

      let evidUrl = '';
      if (evidenciaFile) {
        evidUrl = await uploadImageFile(evidenciaFile, 'evidencia');
      }

      const inputMillaje = parseFloat(maintForm.millaje) || undefined;
      const maintPayload: any = {
        vehiculo_id: selectedVehiculoForMaint.id,
        tipo: maintForm.tipo,
        fecha: maintForm.fecha,
        fecha_entrega: maintForm.fecha_entrega || null,
        millaje: inputMillaje || null,
        taller: maintForm.taller.trim() || null,
        descripcion: maintForm.descripcion.trim(),
        costo: parseFloat(maintForm.costo) || 0,
        estado: maintForm.estado,
        factura_url: factUrl || null,
        evidencia_url: evidUrl || null,
        notas: maintForm.notas.trim() || null
      };

      // Si el millaje registrado es mayor al actual, actualizar el millaje del vehículo
      const nuevoMillajeActual = inputMillaje && inputMillaje > selectedVehiculoForMaint.millaje_actual
        ? inputMillaje
        : selectedVehiculoForMaint.millaje_actual;

      // Calcular nuevo estado del vehículo según el estado del mantenimiento si se solicitó sincronizar
      let nuevoEstadoVehiculo = selectedVehiculoForMaint.estado;
      if (maintForm.cambiarEstadoVehiculo) {
        if (maintForm.estado === 'En proceso') {
          nuevoEstadoVehiculo = maintForm.tipo.includes('Reparación') ? 'En reparación' : 'En mantenimiento';
        } else if (maintForm.estado === 'Completado') {
          nuevoEstadoVehiculo = 'Disponible';
        }
      }

      if (dbTableMissing) {
        // Fallback local
        const newM: Mantenimiento = {
          id: Date.now(),
          ...maintPayload,
          created_at: new Date().toISOString()
        };
        const updatedList = [newM, ...mantenimientos];
        setMantenimientos(updatedList);
        sessionStorage.setItem(`demo_maint_${selectedVehiculoForMaint.id}`, JSON.stringify(updatedList));

        // Actualizar vehículo en memoria
        const updatedVehs = vehiculos.map(v => v.id === selectedVehiculoForMaint.id ? {
          ...v,
          millaje_actual: nuevoMillajeActual,
          estado: nuevoEstadoVehiculo
        } : v);
        setVehiculos(updatedVehs);
        setSelectedVehiculoForMaint({
          ...selectedVehiculoForMaint,
          millaje_actual: nuevoMillajeActual,
          estado: nuevoEstadoVehiculo
        });
        sessionStorage.setItem('cruz_verde_demo_vehiculos', JSON.stringify(updatedVehs));
      } else {
        // Guardar en Supabase
        const { error: insErr } = await supabase
          .from('vehiculo_mantenimientos')
          .insert([maintPayload]);

        if (insErr) throw insErr;

        // Actualizar vehículo
        await supabase
          .from('vehiculos')
          .update({
            millaje_actual: nuevoMillajeActual,
            estado: nuevoEstadoVehiculo,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedVehiculoForMaint.id);

        await logActivity('Registró mantenimiento/reparación de vehículo', 'Mantenimiento', selectedVehiculoForMaint.id, {
          tipo: maintPayload.tipo,
          costo: maintPayload.costo
        });

        // Recargar lista de mantenimientos y flota
        await handleOpenMantenimientos(selectedVehiculoForMaint);
        await fetchData();
      }

      setShowNewMaintModal(false);
    } catch (err: any) {
      console.error('Error guardando mantenimiento:', err);
      alert(`Error al registrar mantenimiento: ${err.message || 'Error desconocido'}`);
    } finally {
      setSavingMaint(false);
    }
  };

  // Copiar SQL
  const handleCopySql = () => {
    const sqlText = `-- Ejecute este código en el SQL Editor de Supabase:
CREATE TABLE IF NOT EXISTS public.vehiculos (
  id BIGSERIAL PRIMARY KEY,
  placa TEXT NOT NULL UNIQUE,
  tipo_placa TEXT NOT NULL DEFAULT 'CVS',
  tipo_vehiculo TEXT NOT NULL DEFAULT 'Terrestre',
  carroceria TEXT NOT NULL DEFAULT 'Ambulancia',
  marca TEXT NOT NULL,
  modelo TEXT NOT NULL,
  anio INTEGER,
  vin TEXT,
  numero_motor TEXT,
  anio_ingreso INTEGER,
  seccional_id INTEGER REFERENCES public.seccionales(id) ON DELETE SET NULL,
  donado BOOLEAN DEFAULT FALSE,
  donante TEXT,
  fecha_donacion DATE,
  combustible TEXT DEFAULT 'Diésel',
  millaje_ingreso NUMERIC(12, 2) DEFAULT 0,
  millaje_actual NUMERIC(12, 2) DEFAULT 0,
  unidad_distancia TEXT DEFAULT 'km',
  numero_tarjeta_circulacion TEXT,
  fecha_vencimiento_tarjeta DATE,
  tarjeta_circulacion_frente_url TEXT,
  tarjeta_circulacion_reverso_url TEXT,
  foto_vehiculo_url TEXT,
  estado TEXT NOT NULL DEFAULT 'Disponible',
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vehiculo_mantenimientos (
  id BIGSERIAL PRIMARY KEY,
  vehiculo_id BIGINT NOT NULL REFERENCES public.vehiculos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_entrega DATE,
  millaje NUMERIC(12, 2),
  taller TEXT,
  descripcion TEXT NOT NULL,
  costo NUMERIC(12, 2) DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'Completado',
  factura_url TEXT,
  evidencia_url TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.vehiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehiculo_mantenimientos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo vehiculos" ON public.vehiculos FOR ALL USING (true);
CREATE POLICY "Permitir todo mantenimientos" ON public.vehiculo_mantenimientos FOR ALL USING (true);
NOTIFY pgrst, 'reload schema';`;

    navigator.clipboard.writeText(sqlText);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto pb-12">
      {/* Encabezado y Acción Principal */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Truck className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Gestión de Flota y Vehículos</h1>
              <p className="text-sm text-gray-500">
                Control de ambulancias, unidades de rescate, tarjetas de circulación, kilometraje e historial de mantenimientos.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {canEdit && (
            <button
              onClick={handleOpenNewVehiculo}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-primary hover:bg-blue-900 text-white font-medium text-sm shadow-sm transition-colors focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <Plus className="w-5 h-5 mr-2" />
              Agregar Vehículo
            </button>
          )}
        </div>
      </div>

      {/* Banner de Aviso de Supabase si la tabla aún no se ha corrido */}
      {dbTableMissing && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-amber-900">
                Tablas de Vehículos pendientes de ejecutar en Supabase
              </h4>
              <p className="text-xs text-amber-700 mt-0.5">
                Las tablas <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900">vehiculos</code> y <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900">vehiculo_mantenimientos</code> deben ser creadas con el script <span className="font-semibold">14_vehiculos_y_mantenimientos.sql</span> en el SQL Editor de Supabase. Mientras tanto, la interfaz está operando en modo local para que pueda interactuar.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              onClick={handleCopySql}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-md transition-colors"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
              {copiedSql ? 'Copiado' : 'Copiar SQL'}
            </button>
            <button
              onClick={fetchData}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium border border-amber-300 text-amber-800 bg-white hover:bg-amber-100 rounded-md transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Tarjetas de Métricas / Resumen Rápido */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Flota</span>
            <Truck className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">{stats.total}</p>
          <span className="text-xs text-gray-400">Unidades institucionales</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-green-700">Disponibles</span>
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-700 mt-2">{stats.disponibles}</p>
          <span className="text-xs text-green-600">En servicio activo</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">En Taller</span>
            <Wrench className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-700 mt-2">{stats.enTaller}</p>
          <span className="text-xs text-amber-600">Reparación / Mtto.</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">TC Por Vencer</span>
            <span className="text-lg">⚠️</span>
          </div>
          <p className="text-2xl font-bold text-amber-700 mt-2">{stats.porVencer}</p>
          <span className="text-xs text-amber-600">Vence en ≤30 días</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm col-span-2 md:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-red-700">TC Vencidas</span>
            <span className="text-lg">🚨</span>
          </div>
          <p className="text-2xl font-bold text-red-700 mt-2">{stats.vencidas}</p>
          <span className="text-xs text-red-600">Requiere refrenda urgente</span>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Buscador */}
          <div className="md:col-span-4 relative">
            <Search className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por placa, marca, modelo, VIN, seccional..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            />
          </div>

          {/* Filtro Estado */}
          <div className="md:col-span-2">
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="w-full py-2 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white"
            >
              <option value="Todos">Estado: Todos</option>
              <option value="Disponible">🟢 Disponible</option>
              <option value="En mantenimiento">🟡 En Mantenimiento</option>
              <option value="En reparación">🔴 En Reparación</option>
              <option value="No disponible">⚪ No Disponible</option>
            </select>
          </div>

          {/* Filtro Seccional */}
          <div className="md:col-span-2">
            {isSeccionalUser && userSeccionalNombre ? (
              <div className="w-full py-2 px-3 text-xs bg-gray-100 border border-gray-300 rounded-lg flex items-center justify-between text-gray-700 font-medium" title="Su usuario está asociado a esta seccional">
                <span className="truncate">Seccional: {userSeccionalNombre}</span>
                <span className="text-2xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">Fijada</span>
              </div>
            ) : (
              <select
                value={filterSeccional}
                onChange={(e) => setFilterSeccional(e.target.value)}
                className="w-full py-2 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white"
              >
                <option value="Todas">Seccional: Todas</option>
                {seccionales.map(s => (
                  <option key={s.id} value={String(s.id)}>{s.nombre}</option>
                ))}
                <option value="SinAsignar">Sin seccional asignada</option>
              </select>
            )}
          </div>

          {/* Filtro Carrocería */}
          <div className="md:col-span-2">
            <select
              value={filterCarroceria}
              onChange={(e) => setFilterCarroceria(e.target.value)}
              className="w-full py-2 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white"
            >
              <option value="Todas">Tipo: Todos</option>
              {TIPOS_CARROCERIA.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Filtro Alerta Tarjeta de Circulación */}
          <div className="md:col-span-2">
            <select
              value={filterTarjetaAlerta}
              onChange={(e) => setFilterTarjetaAlerta(e.target.value)}
              className="w-full py-2 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white"
            >
              <option value="Todas">Tarjeta: Todas</option>
              <option value="Vigente">🟢 Vigentes</option>
              <option value="PorVencer">⚠️ Por vencer (≤30d)</option>
              <option value="Vencida">🚨 Vencidas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Listado de Vehículos */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="mt-3 text-sm text-gray-500 font-medium">Cargando flota de vehículos...</p>
        </div>
      ) : filteredVehiculos.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200 p-8">
          <Truck className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-3 text-lg font-medium text-gray-900">No se encontraron vehículos</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || filterEstado !== 'Todos' || filterSeccional !== 'Todas' || filterCarroceria !== 'Todas' || filterTarjetaAlerta !== 'Todas'
              ? 'Intente modificar los filtros de búsqueda aplicados.'
              : 'Aún no hay vehículos registrados en la flota institucional.'}
          </p>
          {canEdit && (
            <button
              onClick={handleOpenNewVehiculo}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary hover:bg-blue-900"
            >
              <Plus className="w-4 h-4 mr-2" />
              Registrar Primer Vehículo
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVehiculos.map((v) => {
            const tarjetaSt = getTarjetaStatus(v.fecha_vencimiento_tarjeta);
            return (
              <div 
                key={v.id} 
                className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  {/* Encabezado del Card: Placa y Estado */}
                  <div className="p-4 bg-gray-50/80 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="px-2.5 py-1 bg-white border border-gray-300 rounded font-mono font-bold text-gray-900 tracking-wider text-base shadow-2xs">
                        {v.placa}
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                        {v.carroceria}
                      </span>
                    </div>

                    {/* Estado del Vehículo */}
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                      v.estado === 'Disponible' ? 'bg-green-100 text-green-800' :
                      v.estado === 'En mantenimiento' ? 'bg-amber-100 text-amber-800' :
                      v.estado === 'En reparación' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                        v.estado === 'Disponible' ? 'bg-green-600' :
                        v.estado === 'En mantenimiento' ? 'bg-amber-600' :
                        v.estado === 'En reparación' ? 'bg-red-600' :
                        'bg-gray-500'
                      }`}></span>
                      {v.estado}
                    </span>
                  </div>

                  {/* Imagen del Vehículo (si tiene) */}
                  {v.foto_vehiculo_url ? (
                    <div className="relative h-44 bg-gray-100 overflow-hidden group">
                      <img 
                        src={v.foto_vehiculo_url} 
                        alt={v.placa} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <button
                        onClick={() => {
                          setImageViewerUrl(v.foto_vehiculo_url!);
                          setImageViewerTitle(`Vehículo: ${v.placa} - ${v.marca} ${v.modelo}`);
                        }}
                        className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-md text-xs flex items-center backdrop-blur-xs transition"
                        title="Ver foto completa"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        Ver foto
                      </button>
                    </div>
                  ) : (
                    <div className="h-28 bg-gray-50 flex flex-col items-center justify-center text-gray-400 border-b border-gray-100">
                      {v.tipo_vehiculo === 'Acuático' ? (
                        <Anchor className="w-10 h-10 text-gray-300" />
                      ) : v.tipo_vehiculo === 'Aéreo' ? (
                        <Plane className="w-10 h-10 text-gray-300" />
                      ) : (
                        <Car className="w-10 h-10 text-gray-300" />
                      )}
                      <span className="text-xs mt-1 text-gray-400 font-medium">Sin foto adjunta</span>
                    </div>
                  )}

                  {/* Datos del Vehículo */}
                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">
                        {v.marca} {v.modelo} {v.anio && <span className="text-sm font-normal text-gray-500">({v.anio})</span>}
                      </h3>
                      <div className="flex items-center text-xs text-gray-600 mt-1">
                        <MapPin className="w-3.5 h-3.5 mr-1 text-primary shrink-0" />
                        <span className="font-medium truncate">{v.seccional_nombre || 'Sin seccional'}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs border-t border-gray-100 pt-2">
                      <div className="flex items-center text-gray-600">
                        <Fuel className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                        <span>{v.combustible}</span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <Gauge className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                        <span className="font-semibold text-gray-900">
                          {Number(v.millaje_actual || 0).toLocaleString()} {v.unidad_distancia}
                        </span>
                      </div>
                      {v.vin && (
                        <div className="col-span-2 text-gray-500 truncate" title={`VIN: ${v.vin}`}>
                          <span className="font-semibold text-gray-700">VIN:</span> {v.vin}
                        </div>
                      )}
                      {v.donado && (
                        <div className="col-span-2 text-blue-700 bg-blue-50 px-2 py-1 rounded text-2xs truncate">
                          🎁 Donado por: <span className="font-medium">{v.donante || 'Entidad Donante'}</span>
                        </div>
                      )}
                    </div>

                    {/* Tarjeta de Circulación y Alerta según Ley */}
                    <div className={`p-3 rounded-lg border text-xs space-y-1.5 ${tarjetaSt.color}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 font-semibold">
                          <span>{tarjetaSt.emoji}</span>
                          <span>Tarjeta de Circulación</span>
                        </div>
                        <span className="font-bold tracking-tight uppercase text-2xs">
                          {tarjetaSt.badge}
                        </span>
                      </div>

                      <div className="text-2xs opacity-90">
                        {v.fecha_vencimiento_tarjeta ? (
                          <p>
                            Vence: <span className="font-semibold">{v.fecha_vencimiento_tarjeta}</span> ({tarjetaSt.message})
                          </p>
                        ) : (
                          <p>Fecha de vencimiento pendiente de registrar</p>
                        )}
                        {v.numero_tarjeta_circulacion && (
                          <p className="mt-0.5 opacity-80">N° TC: {v.numero_tarjeta_circulacion}</p>
                        )}
                      </div>

                      {/* Fotos de Tarjeta de Circulación */}
                      {(v.tarjeta_circulacion_frente_url || v.tarjeta_circulacion_reverso_url) && (
                        <div className="flex items-center space-x-2 pt-1 border-t border-black/10">
                          {v.tarjeta_circulacion_frente_url && (
                            <button
                              type="button"
                              onClick={() => {
                                setImageViewerUrl(v.tarjeta_circulacion_frente_url!);
                                setImageViewerTitle(`Tarjeta de Circulación (FRENTE) - Placa ${v.placa}`);
                              }}
                              className="inline-flex items-center px-2 py-0.5 rounded bg-white/80 hover:bg-white text-gray-800 text-2xs font-medium border border-gray-300 transition"
                            >
                              <FileCheck className="w-3 h-3 mr-1 text-primary" />
                              Frente TC
                            </button>
                          )}
                          {v.tarjeta_circulacion_reverso_url && (
                            <button
                              type="button"
                              onClick={() => {
                                setImageViewerUrl(v.tarjeta_circulacion_reverso_url!);
                                setImageViewerTitle(`Tarjeta de Circulación (REVERSO) - Placa ${v.placa}`);
                              }}
                              className="inline-flex items-center px-2 py-0.5 rounded bg-white/80 hover:bg-white text-gray-800 text-2xs font-medium border border-gray-300 transition"
                            >
                              <FileCheck className="w-3 h-3 mr-1 text-primary" />
                              Reverso TC
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Acciones del Card */}
                <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenMantenimientos(v)}
                    className="flex-1 inline-flex items-center justify-center px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium shadow-2xs transition"
                  >
                    <Wrench className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                    Historial Mtto.
                  </button>

                  {canEdit && (
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleOpenEditVehiculo(v)}
                        className="p-1.5 text-gray-600 hover:text-primary hover:bg-white rounded border border-transparent hover:border-gray-200 transition"
                        title="Editar vehículo"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteVehiculo(v.id, v.placa)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-white rounded border border-transparent hover:border-gray-200 transition"
                        title="Eliminar vehículo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL CREAR / EDITAR VEHÍCULO */}
      {/* ========================================================================= */}
      {showVehiculoModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <Truck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {editingVehiculo ? `Editar Vehículo (${editingVehiculo.placa})` : 'Agregar Nuevo Vehículo'}
                  </h2>
                  <p className="text-xs text-gray-500">
                    Conforme a la normativa y tipos de placas de El Salvador
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowVehiculoModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveVehiculo} className="p-6 space-y-6">
              {/* Sección 1: Identificación y Placa */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center">
                  <Car className="w-4 h-4 mr-2 text-primary" />
                  1. Matrícula y Tipo de Vehículo
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Tipo de Placa según El Salvador */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Tipo de Placa (El Salvador) *
                    </label>
                    <select
                      value={vehiculoForm.prefijo_placa}
                      onChange={(e) => {
                        const val = e.target.value;
                        const prefObj = PREFIJOS_PLACA.find(p => p.value === val);
                        setVehiculoForm(prev => ({
                          ...prev,
                          prefijo_placa: val,
                          tipo_vehiculo: (prefObj?.tipo as any) || prev.tipo_vehiculo,
                          carroceria: val === 'B' ? 'Bote / Lancha' : val === 'M' ? 'Motocicleta' : prev.carroceria
                        }));
                      }}
                      className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-primary outline-none"
                    >
                      {PREFIJOS_PLACA.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Número de Placa */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Número de Placa *
                    </label>
                    <div className="flex">
                      {vehiculoForm.prefijo_placa !== 'OTRO' && (
                        <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-100 text-gray-700 text-sm font-mono font-bold">
                          {vehiculoForm.prefijo_placa}-
                        </span>
                      )}
                      <input
                        type="text"
                        required
                        placeholder={PREFIJOS_PLACA.find(p => p.value === vehiculoForm.prefijo_placa)?.placeholder || '000-000'}
                        value={vehiculoForm.numero_placa}
                        onChange={(e) => setVehiculoForm({ ...vehiculoForm, numero_placa: e.target.value })}
                        className={`w-full text-sm border border-gray-300 p-2.5 uppercase font-mono font-semibold focus:ring-2 focus:ring-primary outline-none ${
                          vehiculoForm.prefijo_placa !== 'OTRO' ? 'rounded-r-lg' : 'rounded-lg'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Tipo General */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Medio / Tipo General
                    </label>
                    <select
                      value={vehiculoForm.tipo_vehiculo}
                      onChange={(e) => setVehiculoForm({ ...vehiculoForm, tipo_vehiculo: e.target.value as any })}
                      className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-primary outline-none"
                    >
                      <option value="Terrestre">Terrestre</option>
                      <option value="Acuático">Acuático</option>
                      <option value="Aéreo">Aéreo</option>
                    </select>
                  </div>

                  {/* Carrocería */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Tipo de Carrocería / Uso *
                    </label>
                    <select
                      value={vehiculoForm.carroceria}
                      onChange={(e) => setVehiculoForm({ ...vehiculoForm, carroceria: e.target.value })}
                      className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-primary outline-none"
                    >
                      {TIPOS_CARROCERIA.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Estado Operativo */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Estado Operativo *
                    </label>
                    <select
                      value={vehiculoForm.estado}
                      onChange={(e) => setVehiculoForm({ ...vehiculoForm, estado: e.target.value as any })}
                      className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-primary outline-none font-semibold"
                    >
                      <option value="Disponible">🟢 Disponible</option>
                      <option value="En mantenimiento">🟡 En mantenimiento</option>
                      <option value="En reparación">🔴 En reparación</option>
                      <option value="No disponible">⚪ No disponible</option>
                    </select>
                  </div>

                  {/* Seccional que lo tiene en uso */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Seccional Asignada (Uso)
                    </label>
                    <select
                      value={vehiculoForm.seccional_id}
                      onChange={(e) => setVehiculoForm({ ...vehiculoForm, seccional_id: e.target.value })}
                      className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-primary outline-none"
                    >
                      <option value="">Sin seccional asignada</option>
                      {seccionales.map(s => (
                        <option key={s.id} value={String(s.id)}>{s.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Sección 2: Especificaciones Técnicas */}
              <div className="border-t border-gray-200 pt-5">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center">
                  <Gauge className="w-4 h-4 mr-2 text-primary" />
                  2. Datos Técnicos, Kilometraje y Motor
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Marca *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Toyota, Nissan, Isuzu"
                      value={vehiculoForm.marca}
                      onChange={(e) => setVehiculoForm({ ...vehiculoForm, marca: e.target.value })}
                      className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Modelo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Land Cruiser, Hilux, HiAce"
                      value={vehiculoForm.modelo}
                      onChange={(e) => setVehiculoForm({ ...vehiculoForm, modelo: e.target.value })}
                      className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Año de Fabricación</label>
                    <input
                      type="number"
                      min="1970"
                      max="2035"
                      value={vehiculoForm.anio}
                      onChange={(e) => setVehiculoForm({ ...vehiculoForm, anio: parseInt(e.target.value, 10) || new Date().getFullYear() })}
                      className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Año de Ingreso a Cruz Verde</label>
                    <input
                      type="number"
                      min="1970"
                      max="2035"
                      value={vehiculoForm.anio_ingreso}
                      onChange={(e) => setVehiculoForm({ ...vehiculoForm, anio_ingreso: parseInt(e.target.value, 10) || new Date().getFullYear() })}
                      className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Combustible</label>
                    <select
                      value={vehiculoForm.combustible}
                      onChange={(e) => setVehiculoForm({ ...vehiculoForm, combustible: e.target.value })}
                      className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-primary outline-none"
                    >
                      <option value="Diésel">Diésel</option>
                      <option value="Gasolina Regular">Gasolina Regular</option>
                      <option value="Gasolina Especial">Gasolina Especial</option>
                      <option value="Híbrido">Híbrido</option>
                      <option value="Eléctrico">Eléctrico</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Unidad de Odómetro</label>
                    <select
                      value={vehiculoForm.unidad_distancia}
                      onChange={(e) => setVehiculoForm({ ...vehiculoForm, unidad_distancia: e.target.value as any })}
                      className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-primary outline-none"
                    >
                      <option value="km">Kilómetros (km)</option>
                      <option value="millas">Millas (mi)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Millaje al Ingresar</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="0"
                      value={vehiculoForm.millaje_ingreso}
                      onChange={(e) => setVehiculoForm({ ...vehiculoForm, millaje_ingreso: e.target.value })}
                      className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Millaje Actual</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="0"
                      value={vehiculoForm.millaje_actual}
                      onChange={(e) => setVehiculoForm({ ...vehiculoForm, millaje_actual: e.target.value })}
                      className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary outline-none font-semibold text-gray-900"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Número VIN / Chasis</label>
                    <input
                      type="text"
                      placeholder="Ej. JT111JA7890123456"
                      value={vehiculoForm.vin}
                      onChange={(e) => setVehiculoForm({ ...vehiculoForm, vin: e.target.value })}
                      className="w-full text-sm border border-gray-300 rounded-lg p-2.5 uppercase font-mono focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Número de Motor</label>
                    <input
                      type="text"
                      placeholder="Ej. 1HZ-0987654"
                      value={vehiculoForm.numero_motor}
                      onChange={(e) => setVehiculoForm({ ...vehiculoForm, numero_motor: e.target.value })}
                      className="w-full text-sm border border-gray-300 rounded-lg p-2.5 uppercase font-mono focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 3: Donación */}
              <div className="border-t border-gray-200 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center">
                    <DollarSign className="w-4 h-4 mr-2 text-primary" />
                    3. Información de Donación
                  </h3>
                  <label className="inline-flex items-center cursor-pointer text-xs font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={vehiculoForm.donado}
                      onChange={(e) => setVehiculoForm({ ...vehiculoForm, donado: e.target.checked })}
                      className="rounded text-primary focus:ring-primary h-4 w-4 mr-2"
                    />
                    ¿El vehículo fue donado?
                  </label>
                </div>

                {vehiculoForm.donado && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Donado por (Entidad / Persona) *</label>
                      <input
                        type="text"
                        placeholder="Ej. Embajada de Japón, Club Rotario, Cruz Roja..."
                        value={vehiculoForm.donante}
                        onChange={(e) => setVehiculoForm({ ...vehiculoForm, donante: e.target.value })}
                        className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-primary outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Fecha de Donación</label>
                      <input
                        type="date"
                        value={vehiculoForm.fecha_donacion}
                        onChange={(e) => setVehiculoForm({ ...vehiculoForm, fecha_donacion: e.target.value })}
                        className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-primary outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Sección 4: Tarjeta de Circulación y Fotos */}
              <div className="border-t border-gray-200 pt-5">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center">
                  <FileCheck className="w-4 h-4 mr-2 text-primary" />
                  4. Tarjeta de Circulación y Alertas de Vencimiento
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Número de Tarjeta de Circulación</label>
                    <input
                      type="text"
                      placeholder="Ej. TC-2024-88990"
                      value={vehiculoForm.numero_tarjeta_circulacion}
                      onChange={(e) => setVehiculoForm({ ...vehiculoForm, numero_tarjeta_circulacion: e.target.value })}
                      className="w-full text-sm border border-gray-300 rounded-lg p-2.5 uppercase focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Fecha de Vencimiento de Tarjeta de Circulación *
                    </label>
                    <input
                      type="date"
                      value={vehiculoForm.fecha_vencimiento_tarjeta}
                      onChange={(e) => setVehiculoForm({ ...vehiculoForm, fecha_vencimiento_tarjeta: e.target.value })}
                      className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary outline-none font-semibold text-gray-900"
                    />
                    <p className="text-2xs text-gray-500 mt-1">
                      El sistema alertará automáticamente cuando falten 30 días o menos (período de refrenda SERTRACEN) o si ya venció.
                    </p>
                  </div>
                </div>

                {/* Subida de Fotos de Tarjeta de Circulación (Frente y Reverso) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Foto Frente */}
                  <div className="border border-dashed border-gray-300 rounded-xl p-3 text-center bg-gray-50 hover:bg-gray-100 transition relative">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Foto Tarjeta de Circulación (FRENTE)
                    </label>
                    {tarjetaFrentePreview ? (
                      <div className="relative h-28 mx-auto rounded overflow-hidden mb-2">
                        <img src={tarjetaFrentePreview} alt="Frente" className="w-full h-full object-contain bg-white" />
                        <button
                          type="button"
                          onClick={() => {
                            setTarjetaFrenteFile(null);
                            setTarjetaFrentePreview('');
                          }}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="py-4">
                        <Camera className="w-6 h-6 mx-auto text-gray-400 mb-1" />
                        <span className="text-xs text-gray-500">Subir foto del frente</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setTarjetaFrenteFile(file);
                          setTarjetaFrentePreview(URL.createObjectURL(file));
                        }
                      }}
                      className="text-xs w-full text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-primary file:text-white hover:file:bg-blue-900 cursor-pointer"
                    />
                  </div>

                  {/* Foto Reverso */}
                  <div className="border border-dashed border-gray-300 rounded-xl p-3 text-center bg-gray-50 hover:bg-gray-100 transition relative">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Foto Tarjeta de Circulación (REVERSO)
                    </label>
                    {tarjetaReversoPreview ? (
                      <div className="relative h-28 mx-auto rounded overflow-hidden mb-2">
                        <img src={tarjetaReversoPreview} alt="Reverso" className="w-full h-full object-contain bg-white" />
                        <button
                          type="button"
                          onClick={() => {
                            setTarjetaReversoFile(null);
                            setTarjetaReversoPreview('');
                          }}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="py-4">
                        <Camera className="w-6 h-6 mx-auto text-gray-400 mb-1" />
                        <span className="text-xs text-gray-500">Subir foto del reverso</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setTarjetaReversoFile(file);
                          setTarjetaReversoPreview(URL.createObjectURL(file));
                        }
                      }}
                      className="text-xs w-full text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-primary file:text-white hover:file:bg-blue-900 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 5: Foto del Vehículo y Notas */}
              <div className="border-t border-gray-200 pt-5">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center">
                  <Camera className="w-4 h-4 mr-2 text-primary" />
                  5. Foto Principal del Vehículo y Observaciones
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Foto Principal del Vehículo
                    </label>
                    {fotoVehiculoPreview ? (
                      <div className="relative h-32 rounded-lg overflow-hidden border border-gray-300 mb-2">
                        <img src={fotoVehiculoPreview} alt="Vehiculo" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            setFotoVehiculoFile(null);
                            setFotoVehiculoPreview('');
                          }}
                          className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="border border-dashed border-gray-300 rounded-xl p-4 text-center bg-gray-50 mb-2">
                        <Truck className="w-8 h-8 mx-auto text-gray-400 mb-1" />
                        <span className="text-xs text-gray-500">Seleccionar imagen del vehículo</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setFotoVehiculoFile(file);
                          setFotoVehiculoPreview(URL.createObjectURL(file));
                        }
                      }}
                      className="text-xs w-full text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary file:text-white hover:file:bg-blue-900 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Notas u Observaciones</label>
                    <textarea
                      rows={4}
                      placeholder="Detalles sobre equipamiento especial, estado físico, asignaciones..."
                      value={vehiculoForm.notas}
                      onChange={(e) => setVehiculoForm({ ...vehiculoForm, notas: e.target.value })}
                      className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="border-t border-gray-200 pt-5 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowVehiculoModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingVehiculo}
                  className="px-6 py-2 bg-primary hover:bg-blue-900 text-white rounded-lg text-sm font-medium transition shadow-sm disabled:opacity-50 flex items-center"
                >
                  {savingVehiculo ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar Vehículo'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL HISTORIAL DE MANTENIMIENTO Y REPARACIONES */}
      {/* ========================================================================= */}
      {selectedVehiculoForMaint && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            {/* Header del Modal */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                  <Wrench className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Historial de Reparaciones y Mantenimiento
                  </h2>
                  <p className="text-xs text-gray-500">
                    Vehículo: <span className="font-bold text-gray-800">{selectedVehiculoForMaint.placa}</span> - {selectedVehiculoForMaint.marca} {selectedVehiculoForMaint.modelo} (Odómetro Actual: {Number(selectedVehiculoForMaint.millaje_actual || 0).toLocaleString()} {selectedVehiculoForMaint.unidad_distancia})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedVehiculoForMaint(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Contenido */}
            <div className="p-6 flex-1 space-y-6">
              {/* Barra de acción: Registrar Nuevo Mantenimiento */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">Registros de Taller y Servicios</h4>
                  <p className="text-xs text-gray-500">
                    Lleve el historial de cada reparación, facturas, comprobantes y evidencia fotográfica.
                  </p>
                </div>
                {canEdit && (
                  <button
                    onClick={handleOpenNewMaint}
                    className="inline-flex items-center px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Registrar Mantenimiento / Reparación
                  </button>
                )}
              </div>

              {/* Lista de intervenciones */}
              {loadingMaint ? (
                <div className="py-12 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-xs text-gray-500 mt-2">Cargando historial de mantenimientos...</p>
                </div>
              ) : mantenimientos.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300 p-8">
                  <Wrench className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700">Sin historial de mantenimiento registrado</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Haga clic en el botón superior para agregar el primer servicio o reparación mecánica.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {mantenimientos.map((m) => (
                    <div 
                      key={m.id} 
                      className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs hover:border-gray-300 transition"
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-b border-gray-100 pb-3">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2.5 py-0.5 rounded text-xs font-semibold ${
                            m.tipo.includes('Preventivo') ? 'bg-blue-100 text-blue-800' :
                            m.tipo.includes('Reparación') ? 'bg-red-100 text-red-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {m.tipo}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-2xs font-medium ${
                            m.estado === 'Completado' ? 'bg-green-100 text-green-800' :
                            m.estado === 'En proceso' ? 'bg-amber-100 text-amber-800' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {m.estado}
                          </span>
                        </div>

                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <div className="flex items-center">
                            <Calendar className="w-3.5 h-3.5 mr-1 text-gray-400" />
                            <span>Fecha: <strong className="text-gray-700">{m.fecha}</strong></span>
                          </div>
                          {m.millaje !== undefined && m.millaje !== null && (
                            <div className="flex items-center">
                              <Gauge className="w-3.5 h-3.5 mr-1 text-gray-400" />
                              <span>Odómetro: <strong className="text-gray-700">{Number(m.millaje).toLocaleString()} {selectedVehiculoForMaint.unidad_distancia}</strong></span>
                            </div>
                          )}
                          <div className="flex items-center text-green-700 font-bold">
                            <DollarSign className="w-3.5 h-3.5 mr-0.5" />
                            <span>${Number(m.costo || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Cuerpo del Mantenimiento */}
                      <div className="mt-3 text-xs text-gray-700 space-y-2">
                        {m.taller && (
                          <p className="text-gray-500 font-medium">
                            🏢 Taller / Mecánico: <span className="text-gray-800 font-semibold">{m.taller}</span>
                          </p>
                        )}
                        <p className="bg-gray-50 p-2.5 rounded-lg border border-gray-100 leading-relaxed">
                          {m.descripcion}
                        </p>

                        {/* Fotos de Factura y Evidencia */}
                        {(m.factura_url || m.evidencia_url) && (
                          <div className="flex items-center space-x-3 pt-2">
                            {m.factura_url && (
                              <button
                                type="button"
                                onClick={() => {
                                  setImageViewerUrl(m.factura_url!);
                                  setImageViewerTitle(`Factura / Comprobante (${m.fecha}) - ${m.tipo}`);
                                }}
                                className="inline-flex items-center px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs transition"
                              >
                                <FileText className="w-3.5 h-3.5 mr-1 text-blue-600" />
                                Ver Factura
                              </button>
                            )}
                            {m.evidencia_url && (
                              <button
                                type="button"
                                onClick={() => {
                                  setImageViewerUrl(m.evidencia_url!);
                                  setImageViewerTitle(`Evidencia / Pieza Reemplazada (${m.fecha})`);
                                }}
                                className="inline-flex items-center px-2.5 py-1 rounded bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-xs transition"
                              >
                                <Camera className="w-3.5 h-3.5 mr-1 text-purple-600" />
                                Ver Evidencia / Repuesto
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={() => setSelectedVehiculoForMaint(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL REGISTRAR NUEVO MANTENIMIENTO / REPARACIÓN */}
      {/* ========================================================================= */}
      {showNewMaintModal && selectedVehiculoForMaint && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center space-x-2">
                <Wrench className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-gray-900 text-lg">
                  Registrar Reparación o Mantenimiento
                </h3>
              </div>
              <button
                onClick={() => setShowNewMaintModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMantenimiento} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tipo de Servicio *</label>
                  <select
                    value={maintForm.tipo}
                    onChange={(e) => setMaintForm({ ...maintForm, tipo: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-primary outline-none"
                  >
                    {TIPOS_MANTENIMIENTO.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Estado del Trabajo *</label>
                  <select
                    value={maintForm.estado}
                    onChange={(e) => setMaintForm({ ...maintForm, estado: e.target.value as any })}
                    className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-primary outline-none font-medium"
                  >
                    <option value="Completado">Completado</option>
                    <option value="En proceso">En proceso (Vehículo en Taller)</option>
                    <option value="Programado">Programado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Fecha de Intervención *</label>
                  <input
                    type="date"
                    required
                    value={maintForm.fecha}
                    onChange={(e) => setMaintForm({ ...maintForm, fecha: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Fecha de Entrega (Opcional)</label>
                  <input
                    type="date"
                    value={maintForm.fecha_entrega}
                    onChange={(e) => setMaintForm({ ...maintForm, fecha_entrega: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Millaje / Odómetro al Momento ({selectedVehiculoForMaint.unidad_distancia})
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder={`Actual: ${selectedVehiculoForMaint.millaje_actual}`}
                    value={maintForm.millaje}
                    onChange={(e) => setMaintForm({ ...maintForm, millaje: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary outline-none font-semibold text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Costo Total ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={maintForm.costo}
                    onChange={(e) => setMaintForm({ ...maintForm, costo: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary outline-none font-semibold text-gray-900"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Taller Mecánico / Especialista</label>
                  <input
                    type="text"
                    placeholder="Ej. Taller Central Cruz Verde, Taller Santa Tecla, Llantería..."
                    value={maintForm.taller}
                    onChange={(e) => setMaintForm({ ...maintForm, taller: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Descripción del Trabajo y Repuestos Cambiados *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Describa la falla presentada, diagnóstico, repuestos instalados y pruebas realizadas..."
                    value={maintForm.descripcion}
                    onChange={(e) => setMaintForm({ ...maintForm, descripcion: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              {/* Subida de Factura y Evidencias */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-200 pt-4">
                {/* Foto Factura */}
                <div className="border border-dashed border-gray-300 rounded-xl p-3 bg-gray-50 text-center">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Foto de Factura / Recibo</label>
                  {facturaPreview ? (
                    <div className="relative h-24 mb-2">
                      <img src={facturaPreview} alt="Factura" className="w-full h-full object-contain" />
                      <button
                        type="button"
                        onClick={() => {
                          setFacturaFile(null);
                          setFacturaPreview('');
                        }}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="py-2">
                      <FileText className="w-6 h-6 mx-auto text-gray-400 mb-1" />
                      <span className="text-2xs text-gray-500">Adjuntar comprobante</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setFacturaFile(file);
                        setFacturaPreview(URL.createObjectURL(file));
                      }
                    }}
                    className="text-xs w-full text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-2xs file:font-medium file:bg-primary file:text-white cursor-pointer"
                  />
                </div>

                {/* Foto Evidencia */}
                <div className="border border-dashed border-gray-300 rounded-xl p-3 bg-gray-50 text-center">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Foto de Evidencia / Repuesto</label>
                  {evidenciaPreview ? (
                    <div className="relative h-24 mb-2">
                      <img src={evidenciaPreview} alt="Evidencia" className="w-full h-full object-contain" />
                      <button
                        type="button"
                        onClick={() => {
                          setEvidenciaFile(null);
                          setEvidenciaPreview('');
                        }}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="py-2">
                      <Camera className="w-6 h-6 mx-auto text-gray-400 mb-1" />
                      <span className="text-2xs text-gray-500">Foto del daño o pieza cambiada</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setEvidenciaFile(file);
                        setEvidenciaPreview(URL.createObjectURL(file));
                      }
                    }}
                    className="text-xs w-full text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-2xs file:font-medium file:bg-primary file:text-white cursor-pointer"
                  />
                </div>
              </div>

              {/* Sincronización automática de estado */}
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <label className="flex items-center text-xs font-medium text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={maintForm.cambiarEstadoVehiculo}
                    onChange={(e) => setMaintForm({ ...maintForm, cambiarEstadoVehiculo: e.target.checked })}
                    className="rounded text-primary focus:ring-primary h-4 w-4 mr-2"
                  />
                  <span>
                    Actualizar automáticamente el estado del vehículo según este mantenimiento (si está 'En proceso' pasa a taller, si está 'Completado' pasa a Disponible).
                  </span>
                </label>
              </div>

              {/* Botones */}
              <div className="flex items-center justify-end space-x-3 border-t border-gray-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewMaintModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingMaint}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {savingMaint ? 'Guardando...' : 'Guardar Mantenimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISOR DE IMAGEN EN TAMAÑO COMPLETO */}
      {/* ========================================================================= */}
      {imageViewerUrl && (
        <div className="fixed inset-0 z-70 bg-black/85 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-4xl flex items-center justify-between text-white pb-3">
            <h4 className="text-sm font-semibold truncate">{imageViewerTitle}</h4>
            <div className="flex items-center space-x-2">
              <a
                href={imageViewerUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 bg-white/20 hover:bg-white/30 rounded text-xs flex items-center transition"
                title="Abrir en pestaña nueva"
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                Abrir
              </a>
              <button
                onClick={() => setImageViewerUrl(null)}
                className="p-1.5 bg-white/20 hover:bg-white/30 rounded text-xs transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="max-w-4xl max-h-[80vh] bg-black/50 rounded-xl overflow-hidden flex items-center justify-center">
            <img
              src={imageViewerUrl}
              alt="Detalle"
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
