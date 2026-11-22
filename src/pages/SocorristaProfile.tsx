import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, CheckCircle, XCircle, Plus, Save, X, Crop, Camera, Shield, Award, PhoneCall, Sparkles, Phone, AlertCircle, AlertTriangle, Lock, Printer, FileCheck2, ChevronDown } from 'lucide-react';
import Cropper from 'react-easy-crop';
import { getCroppedImgResult } from '../utils/cropImage';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logActivity } from '../lib/logger';
import {
  formatFechaHoraSV,
  getElSalvadorDateString,
  getElSalvadorDateTime,
  getElSalvadorIsoTimestamp,
  parseSafeDateSV,
} from '../utils/dateUtils';
import WatermarkImage from '../components/WatermarkImage';
import DateInput from '../components/DateInput';
import DocumentosSocorristaCard from '../components/socorristas/DocumentosSocorristaCard';
import CarnetPhotoCaptureModal from '../components/common/CarnetPhotoCaptureModal';
import CargosSelector from '../components/socorristas/CargosSelector';
import SocorristaConfirmModal from '../components/socorristas/SocorristaConfirmModal';
import {
  normalizeDocumentForCompare,
  parseCargosSecundarios,
  saveSocorristaCargosSecundariosFallback,
} from '../utils/cargosCatalog';
import {
  COUNTRY_PHONE_CODES,
  composePhoneWithCountry,
  formatPhoneWithMask,
  getCountryMask,
  parsePhoneWithCountry,
  toTelHref,
} from '../utils/phoneMask';
import { optimizeImageForUpload, getExtensionFromFile } from '../utils/imageOptimizer';
import ConoceSocorristaFormFields from '../components/socorristas/ConoceSocorristaFormFields';
import ConoceSocorristaPrintModal from '../components/socorristas/ConoceSocorristaPrintModal';
import {
  ConoceSocorristaExtraData,
  EMPTY_CONOCE_SOCORRISTA_DATA,
  extractKycFromSocorrista,
  fetchSingleSocorristaKycBackup,
  isNoDependentsText,
  parseDependientesFromRow,
  saveSocorristaKycData,
  validateConoceSocorrista,
} from '../utils/conoceSocorrista';

export default function SocorristaProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role, permissions, watermarkEnabled, userName, canAccessSeccionalSocorristas, getAllowedSocorristaSeccionalIds } = useAuth();
  const [socorrista, setSocorrista] = useState<any>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [meritosList, setMeritosList] = useState<any[]>([]);
  const [loadingMeritos, setLoadingMeritos] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
  const [showConoceModal, setShowConoceModal] = useState(false);
  const [conoceModalMode, setConoceModalMode] = useState<'auto' | 'edit'>('auto');
  const [showExtraKycDetails, setShowExtraKycDetails] = useState(false);
  const [editKycForm, setEditKycForm] = useState<ConoceSocorristaExtraData>(EMPTY_CONOCE_SOCORRISTA_DATA);

  const downloadImageWithWatermark = async (format: 'png' | 'jpeg') => {
    if (!carnetGeneradoUrl) return;
    
    // Create a toast/alert or just straight download
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (format === 'jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        ctx.drawImage(img, 0, 0);
        
        if (watermarkEnabled && role !== 'admin') {
          ctx.save();
          // Draw watermark
          ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate(-Math.PI / 4); // -45 degrees
          ctx.textAlign = 'center';
          
          // Main text
          ctx.font = 'bold 36px Arial';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          // Add drop shadow
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
          
          ctx.fillText('CRUZ VERDE SALVADOREÑA', 0, -20);
          ctx.fillText('SISTEMA INTERNO', 0, 20);
          
          // Subtext
          ctx.font = '16px Arial';
          ctx.fillText(`Visualizado por: ${userName || 'Usuario'}`, 0, 50);
          
          ctx.restore();
        }
        
        const dataUrl = canvas.toDataURL(`image/${format}`, 0.9);
        const link = document.createElement('a');
        link.download = `carnet_${socorrista.carnet}.${format === 'jpeg' ? 'jpg' : 'png'}`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    };
    img.src = carnetGeneradoUrl;
  };
  const [loading, setLoading] = useState(true);
  const [showAddCurso, setShowAddCurso] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [availableCursos, setAvailableCursos] = useState<any[]>([]);
  const [seccionales, setSeccionales] = useState<any[]>([]);
  const [editForm, setEditForm] = useState<any>({});
  const [countryCode, setCountryCode] = useState('+503');
  const [emergenciaCountryCode1, setEmergenciaCountryCode1] = useState('+503');
  const [emergenciaCountryCode2, setEmergenciaCountryCode2] = useState('+503');
  const [fotoFile, setFotoFile] = useState<File | null>(null);

  const countries = [
    { code: '+503', name: 'El Salvador', mask: '####-####' },
    { code: '+502', name: 'Guatemala', mask: '####-####' },
    { code: '+504', name: 'Honduras', mask: '####-####' },
    { code: '+505', name: 'Nicaragua', mask: '####-####' },
    { code: '+506', name: 'Costa Rica', mask: '####-####' },
    { code: '+507', name: 'Panamá', mask: '####-####' },
    { code: '+1', name: 'USA/Canada', mask: '(###) ###-####' },
    { code: '+52', name: 'México', mask: '## #### ####' },
  ];

  const currentYear = new Date().getFullYear();
  const maxYear = currentYear - 15;
  const maxDateStr = `${maxYear}-12-31`;

  const formatDUI = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 8) return digits;
    return `${digits.slice(0, 8)}-${digits.slice(8, 9)}`;
  };

  const formatPhone = (value: string, mask: string) => {
    const digits = value.replace(/\D/g, '');
    let formatted = '';
    let digitIndex = 0;
    for (let i = 0; i < mask.length && digitIndex < digits.length; i++) {
      if (mask[i] === '#') {
        formatted += digits[digitIndex];
        digitIndex++;
      } else {
        formatted += mask[i];
      }
    }
    return formatted;
  };

  const [seccionalOccupants, setSeccionalOccupants] = useState<{
    director: { id: string | number; name: string } | null;
    subdirector: { id: string | number; name: string } | null;
    loading: boolean;
  }>({ director: null, subdirector: null, loading: false });
  const [transferNotice, setTransferNotice] = useState<string | null>(null);

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    let { name, value } = e.target;

    if (
      name === 'primer_nombre' ||
      name === 'segundo_nombre' ||
      name === 'primer_apellido' ||
      name === 'segundo_apellido'
    ) {
      value = value.toUpperCase();
    }

    if (name === 'dui' || name === 'licencia_vehiculo_numero' || name === 'licencia_moto_numero') {
      value = formatDUI(value);
    }

    if (name === 'telefono') {
      value = formatPhoneWithMask(value, countryCode);
    }

    if (name === 'contacto_emergencia_telefono') {
      value = formatPhoneWithMask(value, emergenciaCountryCode1);
    }

    if (name === 'contacto_emergencia_telefono_2') {
      value = formatPhoneWithMask(value, emergenciaCountryCode2);
    }

    setFormError(null);

    if (name === 'seccional_id') {
      const isDifferent = String(value) !== String(socorrista?.seccional_id);
      if (isDifferent) {
        if (socorrista?.segundo_cargo_administrativo) {
          setTransferNotice(`Al transferir de seccional, el cargo de "${socorrista.segundo_cargo_administrativo}" se liberará y quedará disponible para la seccional anterior.`);
        } else {
          setTransferNotice(null);
        }
        setEditForm((prev: any) => ({
          ...prev,
          seccional_id: value,
          segundo_cargo_administrativo: ''
        }));
        return;
      } else {
        setTransferNotice(null);
        setEditForm((prev: any) => ({
          ...prev,
          seccional_id: value,
          segundo_cargo_administrativo: socorrista?.segundo_cargo_administrativo || ''
        }));
        return;
      }
    }

    setEditForm({ ...editForm, [name]: value });
  };
  
  // Cropper state
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [showCropper, setShowCropper] = useState(false);

  const [newCurso, setNewCurso] = useState({
    curso_id: '',
    anio: getElSalvadorDateTime().year,
    fecha_certificacion: getElSalvadorDateString(),
    fecha_vencimiento: '',
  });

  const fetchProfile = async () => {
    try {
      const { data: socData, error: socError } = await supabase
        .from('socorristas')
        .select(`
          *,
          seccionales (
            nombre
          )
        `)
        .eq('id', id)
        .single();

      if (socError) throw socError;

      const { data: cursosData, error: cursosError } = await supabase
        .from('socorrista_cursos')
        .select(`
          *,
          cursos (
            nombre
          )
        `)
        .eq('socorrista_id', id);

      if (cursosError) throw cursosError;

      // Cargar contactos de emergencia (desde socData o fallback configuracion)
      let contactoNombre = socData.contacto_emergencia_nombre || '';
      let contactoTelefono = socData.contacto_emergencia_telefono || '';
      let contactoNombre2 = socData.contacto_emergencia_nombre_2 || '';
      let contactoTelefono2 = socData.contacto_emergencia_telefono_2 || '';

      if (!contactoNombre && !contactoTelefono) {
        try {
          const { data: confRow } = await supabase
            .from('configuracion')
            .select('valor')
            .eq('clave', `socorrista_emergencia_${id}`)
            .maybeSingle();
          if (confRow && confRow.valor) {
            const parsed = JSON.parse(confRow.valor);
            contactoNombre = parsed.contacto_emergencia_nombre || '';
            contactoTelefono = parsed.contacto_emergencia_telefono || '';
            contactoNombre2 = parsed.contacto_emergencia_nombre_2 || '';
            contactoTelefono2 = parsed.contacto_emergencia_telefono_2 || '';
          }
        } catch (confErr) {
          console.warn('Fallback emergencia config:', confErr);
        }
      }

      // Cargar cargos secundarios (columna cargos_secundarios o respaldo configuracion)
      let cargosSecundariosArr = parseCargosSecundarios(socData.cargos_secundarios);
      if (cargosSecundariosArr.length === 0) {
        try {
          const { data: cargoConf } = await supabase
            .from('configuracion')
            .select('valor')
            .eq('clave', `socorrista_cargos_${id}`)
            .maybeSingle();
          if (cargoConf?.valor) {
            cargosSecundariosArr = parseCargosSecundarios(cargoConf.valor);
          }
        } catch {}
      }

      const kycBackup = id ? await fetchSingleSocorristaKycBackup(id) : null;
      const mergedKyc = extractKycFromSocorrista(socData, kycBackup);

      const formattedSocorrista = {
        ...socData,
        ...mergedKyc,
        cargos_secundarios: cargosSecundariosArr,
        contacto_emergencia_nombre: contactoNombre,
        contacto_emergencia_telefono: contactoTelefono,
        contacto_emergencia_nombre_2: contactoNombre2,
        contacto_emergencia_telefono_2: contactoTelefono2,
        seccional_nombre: Array.isArray(socData.seccionales)
          ? (socData.seccionales[0]?.nombre || 'N/A')
          : (socData.seccionales?.nombre || 'N/A'),
        cursos: (cursosData || []).map(c => ({
          ...c,
          curso_nombre: c.cursos?.nombre || 'N/A'
        }))
      };

      const parsedEm1 = parsePhoneWithCountry(contactoTelefono);
      const parsedEm2 = parsePhoneWithCountry(contactoTelefono2);
      setEmergenciaCountryCode1(parsedEm1.countryCode);
      setEmergenciaCountryCode2(parsedEm2.countryCode);

      setSocorrista(formattedSocorrista);
      setEditKycForm(mergedKyc);
      setEditForm({
        ...formattedSocorrista,
        contacto_emergencia_telefono: parsedEm1.localNumber,
        contacto_emergencia_telefono_2: parsedEm2.localNumber,
        tiene_licencia_vehiculo: !!formattedSocorrista.licencia_vehiculo_numero,
        tiene_licencia_moto: !!formattedSocorrista.licencia_moto_numero
      });

      // Cargar Méritos asignados a este socorrista
      fetchSocorristaMeritos(Number(id));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSocorristaMeritos = async (socId: number) => {
    setLoadingMeritos(true);
    try {
      let allMerits: any[] = [];
      const { data: dbData, error: dbErr } = await supabase
        .from('meritos')
        .select('*')
        .eq('activo', true)
        .order('fecha_otorgamiento', { ascending: false });

      if (!dbErr && dbData) {
        allMerits = dbData;
      } else {
        // Fallback desde configuracion sistema_meritos
        const { data: confRow } = await supabase
          .from('configuracion')
          .select('valor')
          .eq('clave', 'sistema_meritos')
          .maybeSingle();
        if (confRow && confRow.valor) {
          try {
            allMerits = JSON.parse(confRow.valor);
          } catch (e) {}
        }
      }

      // Filtrar aquellos donde este socorrista fue galardonado
      const filtered = allMerits.filter(m => {
        if (!m.socorristas_asignados || !Array.isArray(m.socorristas_asignados)) return false;
        return m.socorristas_asignados.some((a: any) => Number(a.socorrista_id) === Number(socId));
      });

      setMeritosList(filtered);
    } catch (err) {
      console.error('Error fetching meritos de socorrista:', err);
    } finally {
      setLoadingMeritos(false);
    }
  };

  const [fechaGeneracion, setFechaGeneracion] = useState<string | null>(null);
  const [carnetGeneradoUrl, setCarnetGeneradoUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
    
    const fetchAuxData = async () => {
      try {
        const { data: cData } = await supabase.from('cursos').select('*').eq('estado', 'Activo');
        if (cData) setAvailableCursos(cData);
        
        const { data: sData } = await supabase.from('seccionales').select('*').eq('estado', 'Activa').order('nombre');
        if (sData) setSeccionales(sData);
      } catch (err) {
        console.error('Error fetching aux data:', err);
      }
    };
    
    fetchAuxData();
  }, [id]);

  useEffect(() => {
    if (socorrista) {
      if (socorrista.carnet_generado_url) {
        setCarnetGeneradoUrl(socorrista.carnet_generado_url);
        if (socorrista.fecha_generacion_carnet) {
          setFechaGeneracion(socorrista.fecha_generacion_carnet);
        } else {
          // Fallback to activity_logs if column doesn't exist
          const fetchFecha = async () => {
            try {
              const { data } = await supabase
                .from('activity_logs')
                .select('created_at')
                .eq('entity_type', 'Socorrista')
                .eq('entity_id', String(id))
                .eq('action', 'Generó carnet')
                .order('created_at', { ascending: false })
                .limit(1);
              if (data && data.length > 0) {
                setFechaGeneracion(data[0].created_at);
              }
            } catch (err) {
              console.error('Error fetching fecha generacion:', err);
            }
          };
          fetchFecha();
        }
      } else {
        // Fallback to activity_logs if carnet_generado_url column doesn't exist or is empty
        const fetchFallback = async () => {
          try {
            const { data } = await supabase
              .from('activity_logs')
              .select('created_at, details')
              .eq('entity_type', 'Socorrista')
              .eq('entity_id', String(id))
              .eq('action', 'Generó carnet')
              .order('created_at', { ascending: false })
              .limit(1);
            if (data && data.length > 0) {
              setFechaGeneracion(data[0].created_at);
              if (data[0].details && data[0].details.url) {
                setCarnetGeneradoUrl(data[0].details.url);
              }
            }
          } catch (err) {
            console.error('Error fetching fallback data:', err);
          }
        };
        fetchFallback();
      }
    }
  }, [socorrista, id]);

  useEffect(() => {
    if (!editForm.seccional_id) {
      setSeccionalOccupants({ director: null, subdirector: null, loading: false });
      return;
    }

    const checkOccupants = async () => {
      setSeccionalOccupants(prev => ({ ...prev, loading: true }));
      const targetSecId = parseInt(editForm.seccional_id, 10);
      try {
        let dir: { id: string | number; name: string } | null = null;
        let subdir: { id: string | number; name: string } | null = null;

        const { data, error } = await supabase
          .from('socorristas')
          .select('id, primer_nombre, primer_apellido, segundo_cargo_administrativo')
          .eq('seccional_id', targetSecId)
          .eq('estado', 'Activo')
          .in('segundo_cargo_administrativo', ['Director de Seccional', 'Subdirector de Seccional']);

        if (!error && data) {
          data.forEach(s => {
            if (String(s.id) !== String(id)) {
              const fullName = `${s.primer_nombre} ${s.primer_apellido}`.trim();
              if (s.segundo_cargo_administrativo === 'Director de Seccional') {
                dir = { id: s.id, name: fullName };
              } else if (s.segundo_cargo_administrativo === 'Subdirector de Seccional') {
                subdir = { id: s.id, name: fullName };
              }
            }
          });
        } else {
          // Fallback a tabla seccionales si segundo_cargo_administrativo aún no está en Supabase
          const { data: secc } = await supabase
            .from('seccionales')
            .select('director, subdirector')
            .eq('id', targetSecId)
            .maybeSingle();

          if (secc) {
            const currentName = `${socorrista?.primer_nombre || ''} ${socorrista?.primer_apellido || ''}`.trim();
            if (secc.director && secc.director !== currentName) {
              dir = { id: 'secc-dir', name: secc.director };
            }
            if (secc.subdirector && secc.subdirector !== currentName) {
              subdir = { id: 'secc-subdir', name: secc.subdirector };
            }
          }
        }
        setSeccionalOccupants({ director: dir, subdirector: subdir, loading: false });
      } catch (err) {
        console.error('Error verificando cupos de seccional:', err);
        setSeccionalOccupants({ director: null, subdirector: null, loading: false });
      }
    };

    checkOccupants();
  }, [editForm.seccional_id, id, socorrista]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAccessSeccionalSocorristas(socorrista?.seccional_id, 'edit')) {
      setFormError('No tienes permiso de edición sobre los elementos de esta seccional (Acceso solo lectura).');
      return;
    }
    if (!editForm.primer_nombre?.trim() || !editForm.primer_apellido?.trim()) {
      setFormError('El Primer Nombre y Primer Apellido son obligatorios.');
      return;
    }
    setFormError(null);
    setLoading(true);

    try {
      // Normalized duplicate check for DUI across ALL seccionales
      const rawDui = (editForm.dui || '').trim();
      const normDui = normalizeDocumentForCompare(rawDui);
      if (rawDui && rawDui.toLowerCase() !== 'menor de edad' && normDui && normDui !== normalizeDocumentForCompare(socorrista?.dui || '')) {
        const digitsOnly = rawDui.replace(/\D/g, '');
        let duiQuery = supabase
          .from('socorristas')
          .select('id, primer_nombre, primer_apellido, carnet, dui, seccionales(nombre)')
          .neq('id', id)
          .limit(50);

        if (digitsOnly.length >= 5) {
          duiQuery = duiQuery.ilike('dui', `%${digitsOnly.slice(0, 6)}%`);
        } else {
          duiQuery = duiQuery.ilike('dui', `%${rawDui}%`);
        }

        const { data: existingDuiRows, error: duiError } = await duiQuery;

        if (duiError) {
          console.error('Error checking DUI:', duiError);
          setFormError('Error al verificar el número de identidad en la base de datos.');
          setLoading(false);
          return;
        }

        const matchedDui = (existingDuiRows || []).find(
          (row: any) => normalizeDocumentForCompare(row.dui) === normDui
        );

        if (matchedDui) {
          const secNom = Array.isArray((matchedDui as any).seccionales)
            ? (matchedDui as any).seccionales[0]?.nombre
            : (matchedDui as any).seccionales?.nombre;
          setFormError(
            `El documento ${rawDui} ya pertenece al elemento ${matchedDui.primer_nombre} ${matchedDui.primer_apellido} (Carnet: ${matchedDui.carnet || 'N/A'}${secNom ? `, Seccional: ${secNom}` : ''}).`
          );
          setLoading(false);
          return;
        }
      }

      const targetSeccionalId = parseInt(editForm.seccional_id, 10);

      // Validar que solo haya un Director o Subdirector en la seccional seleccionada
      if (editForm.segundo_cargo_administrativo) {
        let conflictName: string | null = null;
        try {
          const { data: conflict, error: confErr } = await supabase
            .from('socorristas')
            .select('id, primer_nombre, primer_apellido')
            .eq('seccional_id', targetSeccionalId)
            .eq('segundo_cargo_administrativo', editForm.segundo_cargo_administrativo)
            .eq('estado', 'Activo')
            .neq('id', id)
            .limit(1);

          if (!confErr && conflict && conflict.length > 0) {
            conflictName = `${conflict[0].primer_nombre} ${conflict[0].primer_apellido}`.trim();
          } else if (confErr) {
            const { data: secc } = await supabase
              .from('seccionales')
              .select('director, subdirector')
              .eq('id', targetSeccionalId)
              .maybeSingle();
            const currentName = `${socorrista?.primer_nombre || ''} ${socorrista?.primer_apellido || ''}`.trim();
            if (editForm.segundo_cargo_administrativo === 'Director de Seccional' && secc?.director && secc.director !== currentName) {
              conflictName = secc.director;
            } else if (editForm.segundo_cargo_administrativo === 'Subdirector de Seccional' && secc?.subdirector && secc.subdirector !== currentName) {
              conflictName = secc.subdirector;
            }
          }
        } catch (err) {
          console.warn('Error verificando conflicto de cupo:', err);
        }

        if (conflictName) {
          setFormError(`La plaza de "${editForm.segundo_cargo_administrativo}" en esta seccional ya está ocupada por ${conflictName}. Solo se permite un cupo activo por seccional.`);
          setLoading(false);
          return;
        }
      }

      // Validación aprobada: abrir modal de verificación de seguridad antes de guardar
      setLoading(false);
      setShowSaveConfirmModal(true);
    } catch (error: any) {
      console.error('Error en validación previa de edición:', error);
      setFormError('Error al validar los datos: ' + (error.message || 'Error desconocido'));
      setLoading(false);
    }
  };

  const executeEditSave = async () => {
    setFormError(null);
    setLoading(true);
    try {
      const targetSeccionalId = parseInt(editForm.seccional_id, 10);
      let foto_url = editForm.foto_url;
      if (fotoFile) {
        const optimizedFoto = await optimizeImageForUpload(fotoFile, {
          profile: 'carnet',
          modulo: 'socorristas',
          bucketId: 'socorristas',
        });
        const fileExt = getExtensionFromFile(optimizedFoto, 'jpg');
        const fileName = `${id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('socorristas')
          .upload(filePath, optimizedFoto, {
            upsert: true,
            contentType: optimizedFoto.type || undefined,
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('socorristas')
          .getPublicUrl(filePath);

        foto_url = publicUrl;
      }

      const cleanPrimerNombre = (editForm.primer_nombre || '').trim().toUpperCase();
      const cleanSegundoNombre = (editForm.segundo_nombre || '').trim().toUpperCase();
      const cleanPrimerApellido = (editForm.primer_apellido || '').trim().toUpperCase();
      const cleanSegundoApellido = (editForm.segundo_apellido || '').trim().toUpperCase();
      const cleanCargosSecundarios = Array.isArray(editForm.cargos_secundarios) ? editForm.cargos_secundarios : [];

      const composedEm1 = composePhoneWithCountry(emergenciaCountryCode1, editForm.contacto_emergencia_telefono);
      const composedEm2 = composePhoneWithCountry(emergenciaCountryCode2, editForm.contacto_emergencia_telefono_2);

      const updatePayload: any = {
        primer_nombre: cleanPrimerNombre,
        segundo_nombre: cleanSegundoNombre,
        primer_apellido: cleanPrimerApellido,
        segundo_apellido: cleanSegundoApellido,
        fecha_nacimiento: editForm.fecha_nacimiento,
        sexo: editForm.sexo,
        telefono: editForm.telefono,
        dui: editForm.dui,
        direccion: editForm.direccion,
        seccional_id: targetSeccionalId,
        fecha_ingreso: editForm.fecha_ingreso,
        cargo_institucional: editForm.cargo_institucional,
        cargos_secundarios: cleanCargosSecundarios,
        cargo_administrativo: editForm.cargo_administrativo,
        segundo_cargo_administrativo: editForm.segundo_cargo_administrativo || null,
        tipo_sangre: editForm.tipo_sangre,
        email: editForm.email,
        foto_url: foto_url,
        motorista_autorizado: editForm.motorista_autorizado,
        licencia_vehiculo_numero: editForm.tiene_licencia_vehiculo ? editForm.licencia_vehiculo_numero : null,
        licencia_vehiculo_clase: editForm.tiene_licencia_vehiculo ? editForm.licencia_vehiculo_clase : null,
        licencia_vehiculo_vencimiento: (editForm.tiene_licencia_vehiculo && editForm.licencia_vehiculo_vencimiento) ? editForm.licencia_vehiculo_vencimiento : null,
        licencia_moto_numero: editForm.tiene_licencia_moto ? editForm.licencia_moto_numero : null,
        licencia_moto_vencimiento: (editForm.tiene_licencia_moto && editForm.licencia_moto_vencimiento) ? editForm.licencia_moto_vencimiento : null,
        contacto_emergencia_nombre: editForm.contacto_emergencia_nombre || null,
        contacto_emergencia_telefono: composedEm1 || null,
        contacto_emergencia_nombre_2: editForm.contacto_emergencia_nombre_2 || null,
        contacto_emergencia_telefono_2: composedEm2 || null
      };

      if (id) {
        await saveSocorristaCargosSecundariosFallback(id, cleanCargosSecundarios);
        await saveSocorristaKycData(id, editKycForm);
      }

      // Guardar también siempre en configuracion como respaldo garantizado
      try {
        const emergenciaData = {
          contacto_emergencia_nombre: editForm.contacto_emergencia_nombre || '',
          contacto_emergencia_telefono: composedEm1 || '',
          contacto_emergencia_nombre_2: editForm.contacto_emergencia_nombre_2 || '',
          contacto_emergencia_telefono_2: composedEm2 || '',
          updated_at: getElSalvadorIsoTimestamp()
        };
        const { data: existingConf } = await supabase
          .from('configuracion')
          .select('id')
          .eq('clave', `socorrista_emergencia_${id}`)
          .maybeSingle();

        if (existingConf) {
          await supabase
            .from('configuracion')
            .update({ valor: JSON.stringify(emergenciaData) })
            .eq('id', existingConf.id);
        } else {
          await supabase
            .from('configuracion')
            .insert({ clave: `socorrista_emergencia_${id}`, valor: JSON.stringify(emergenciaData) });
        }
      } catch (confErr) {
        console.warn('Error guardando respaldo de contactos de emergencia en configuracion:', confErr);
      }

      const { error } = await supabase
        .from('socorristas')
        .update(updatePayload)
        .eq('id', id);

      if (error) {
        if (
          error.code === '42703' ||
          error.code === 'PGRST204' ||
          error.message?.includes('segundo_cargo_administrativo') ||
          error.message?.includes('contacto_emergencia') ||
          error.message?.includes('cargos_secundarios')
        ) {
          const {
            segundo_cargo_administrativo,
            contacto_emergencia_nombre,
            contacto_emergencia_telefono,
            contacto_emergencia_nombre_2,
            contacto_emergencia_telefono_2,
            cargos_secundarios: _ignoredSec,
            ...fallbackPayload
          } = updatePayload;
          const { error: retryError } = await supabase
            .from('socorristas')
            .update(fallbackPayload)
            .eq('id', id);
          if (retryError) throw retryError;
        } else {
          throw error;
        }
      }

      const prevSeccionalId = socorrista?.seccional_id;
      const seccionalChanged = String(prevSeccionalId) !== String(targetSeccionalId);
      const fullName = `${cleanPrimerNombre} ${cleanPrimerApellido}`.trim();

      try {
        if (seccionalChanged && prevSeccionalId) {
          if (socorrista?.segundo_cargo_administrativo === 'Director de Seccional') {
            await supabase.from('seccionales').update({ director: null }).eq('id', prevSeccionalId);
          } else if (socorrista?.segundo_cargo_administrativo === 'Subdirector de Seccional') {
            await supabase.from('seccionales').update({ subdirector: null }).eq('id', prevSeccionalId);
          }
        }

        if (editForm.segundo_cargo_administrativo === 'Director de Seccional') {
          await supabase.from('seccionales').update({ director: fullName }).eq('id', targetSeccionalId);
        } else if (editForm.segundo_cargo_administrativo === 'Subdirector de Seccional') {
          await supabase.from('seccionales').update({ subdirector: fullName }).eq('id', targetSeccionalId);
        } else if (socorrista?.segundo_cargo_administrativo && !editForm.segundo_cargo_administrativo) {
          if (socorrista.segundo_cargo_administrativo === 'Director de Seccional') {
            await supabase.from('seccionales').update({ director: null }).eq('id', targetSeccionalId);
          } else if (socorrista.segundo_cargo_administrativo === 'Subdirector de Seccional') {
            await supabase.from('seccionales').update({ subdirector: null }).eq('id', targetSeccionalId);
          }
        }
      } catch (seccErr) {
        console.warn('Error al sincronizar datos de la seccional:', seccErr);
      }

      const changes: any = {};
      if (socorrista.primer_nombre !== cleanPrimerNombre || socorrista.primer_apellido !== cleanPrimerApellido) {
        changes.nombre = `${cleanPrimerNombre} ${cleanPrimerApellido}`;
      }
      if (fotoFile) {
        changes.foto = 'Cambió fotografía';
      }

      await logActivity('Actualizó perfil', 'Socorrista', id, {
        ...changes,
        mensaje: 'Se actualizaron los datos del socorrista'
      });

      setShowSaveConfirmModal(false);
      setIsEditing(false);
      fetchProfile();
    } catch (error: any) {
      console.error(error);
      setShowSaveConfirmModal(false);
      setFormError('Error al actualizar el perfil: ' + (error.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddCurso = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Fetch max ID to avoid sequence out of sync errors
      const { data: maxIdData } = await supabase
        .from('socorrista_cursos')
        .select('id')
        .order('id', { ascending: false })
        .limit(1);
        
      let nextId = undefined;
      if (maxIdData && maxIdData.length > 0 && typeof maxIdData[0].id === 'number') {
        nextId = maxIdData[0].id + 1;
      }

      const { error } = await supabase
        .from('socorrista_cursos')
        .insert([
          {
            ...(nextId ? { id: nextId } : {}),
            socorrista_id: id,
            curso_id: newCurso.curso_id,
            anio: newCurso.anio,
            fecha_certificacion: newCurso.fecha_certificacion,
            fecha_vencimiento: newCurso.fecha_vencimiento
          }
        ]);

      if (error) throw error;

      const cursoNombre = availableCursos.find(c => c.id.toString() === newCurso.curso_id)?.nombre;
      await logActivity('Agregó curso', 'Curso', newCurso.curso_id, {
        socorrista_id: id,
        curso_nombre: cursoNombre
      });

      setShowAddCurso(false);
      fetchProfile();
    } catch (error: any) {
      console.error(error);
      alert('Error al agregar curso: ' + (error.message || 'Error desconocido'));
    }
  };

  const handleCursoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cursoId = e.target.value;
    const curso = availableCursos.find(c => c.id.toString() === cursoId);
    if (curso) {
      const certDate = parseSafeDateSV(newCurso.fecha_certificacion) || new Date();
      certDate.setMonth(certDate.getMonth() + curso.vigencia_meses);
      setNewCurso({
        ...newCurso,
        curso_id: cursoId,
        fecha_vencimiento: getElSalvadorDateString(certDate)
      });
    } else {
      setNewCurso({ ...newCurso, curso_id: cursoId });
    }
  };

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result?.toString() || null);
        setShowCropper(true);
      });
      reader.readAsDataURL(file);
    }
  };

  const handleCropSave = async () => {
    try {
      if (!imageSrc || !croppedAreaPixels) return;
      const cropped = await getCroppedImgResult(imageSrc, croppedAreaPixels);
      if (cropped?.blob) {
        const file = new File([cropped.blob], `perfil_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setFotoFile(file);
        setShowCropper(false);
      }
    } catch (e) {
      console.error(e);
      alert('Error al recortar la imagen');
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <p className="mt-4 text-gray-500 font-medium">Cargando perfil...</p>
    </div>
  );
  if (!socorrista || socorrista.error) return <div className="text-center py-10 text-red-500">Elemento no encontrado.</div>;

  const isVigente = (fecha_vencimiento: string) => {
    return new Date(fecha_vencimiento) >= new Date();
  };

  const canViewThisSocorrista = canAccessSeccionalSocorristas(socorrista?.seccional_id, 'view');
  const canEditThisSocorrista = canAccessSeccionalSocorristas(socorrista?.seccional_id, 'edit');
  const canDownloadConoceSocorrista =
    role === 'admin' || Boolean(permissions.descargar_ficha_conoce_socorrista);

  if (!canViewThisSocorrista) {
    return (
      <div className="max-w-xl mx-auto mt-10 bg-white rounded-2xl border border-rose-200 shadow-sm p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Sin permisos para ver este perfil</h2>
        <p className="text-sm text-slate-600">
          No cuentas con permiso de visualización para la seccional a la que pertenece este elemento.
        </p>
        <button
          type="button"
          onClick={() => navigate('/socorristas')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al listado de Personal
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">Perfil del Elemento</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {!isEditing ? (
            <>
              {canDownloadConoceSocorrista && (
                <button
                  type="button"
                  onClick={() => {
                    setConoceModalMode('auto');
                    setShowConoceModal(true);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-emerald-600 rounded-xl shadow-xs text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 cursor-pointer whitespace-nowrap"
                >
                  <Printer className="-ml-0.5 mr-2 h-4 w-4" />
                  Conoce a tu Socorrista
                </button>
              )}
              {canEditThisSocorrista && (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-xl shadow-xs text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary cursor-pointer whitespace-nowrap"
                >
                  <Edit className="-ml-1 mr-2 h-5 w-5 text-gray-500" />
                  Editar
                </button>
              )}
            </>
          ) : (
            <>
              <button 
                onClick={() => {
                  const p1 = parsePhoneWithCountry(socorrista?.contacto_emergencia_telefono);
                  const p2 = parsePhoneWithCountry(socorrista?.contacto_emergencia_telefono_2);
                  setEmergenciaCountryCode1(p1.countryCode);
                  setEmergenciaCountryCode2(p2.countryCode);
                  setIsEditing(false);
                  setEditKycForm(extractKycFromSocorrista(socorrista));
                  setEditForm({
                    ...socorrista,
                    contacto_emergencia_telefono: p1.localNumber,
                    contacto_emergencia_telefono_2: p2.localNumber,
                    tiene_licencia_vehiculo: !!socorrista?.licencia_vehiculo_numero,
                    tiene_licencia_moto: !!socorrista?.licencia_moto_numero,
                  });
                  setFotoFile(null);
                }}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                <X className="-ml-1 mr-2 h-5 w-5 text-gray-500" />
                Cancelar
              </button>
              <button 
                onClick={handleEditSubmit}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                <Save className="-ml-1 mr-2 h-5 w-5" />
                Guardar
              </button>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
          {formError && (
            <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-sm flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm font-medium">{formError}</p>
              </div>
              <button type="button" onClick={() => setFormError(null)} className="text-rose-500 hover:text-rose-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <form className="space-y-8 divide-y divide-gray-200">
            <div className="space-y-8 divide-y divide-gray-200">
              <div>
                <div className="flex flex-col items-center mb-8">
                  <div className="relative">
                    <div className="h-32 w-32 rounded-full overflow-hidden border-4 border-gray-200 bg-gray-100 flex items-center justify-center">
                      {fotoFile ? (
                        <img src={URL.createObjectURL(fotoFile)} alt="Preview" className="h-full w-full object-cover" />
                      ) : socorrista.foto_url ? (
                        <img src={socorrista.foto_url} alt="Current" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-gray-400 text-4xl font-bold">
                          {(socorrista.primer_nombre?.[0] || '') + (socorrista.primer_apellido?.[0] || '')}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPhotoModal(true)}
                      title="Tomar o subir fotografía con lineamientos oficiales"
                      className="absolute bottom-0 right-0 bg-primary rounded-full p-2 cursor-pointer hover:bg-primary-hover transition-colors shadow-lg"
                    >
                      <Camera className="h-5 w-5 text-white" />
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-gray-500 font-medium">
                    {socorrista.foto_url || fotoFile ? 'Cambiar fotografía (Cámara o Archivo)' : 'Agregar fotografía (Cámara o Archivo)'}
                  </p>
                  <CarnetPhotoCaptureModal
                    isOpen={showPhotoModal}
                    onClose={() => setShowPhotoModal(false)}
                    onPhotoReady={(file) => {
                      setFotoFile(file);
                    }}
                    title="Actualizar Fotografía de Elemento"
                  />
                </div>

                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Editar Información Personal</h3>
                  <p className="mt-1 text-sm text-gray-500">Actualice la información del socorrista.</p>
                  <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Importante:</strong> Los nombres y apellidos deben llenarse <strong>tal cual el nombre completo aparece en el DUI o Documento de Identidad</strong> (sin abreviaturas).
                    </span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                  <div className="sm:col-span-6">
                    <label className="block text-sm font-medium text-gray-700">Carnet (No modificable)</label>
                    <div className="mt-1">
                      <input type="text" disabled value={editForm.carnet || ''} className="shadow-sm block w-full sm:text-sm border-gray-300 rounded-md bg-gray-100 p-2 border text-gray-500" />
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Primer Nombre</label>
                    <div className="mt-1">
                      <input type="text" required value={editForm.primer_nombre || ''} name="primer_nombre" onChange={handleEditChange} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border uppercase" />
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Segundo Nombre</label>
                    <div className="mt-1">
                      <input type="text" value={editForm.segundo_nombre || ''} name="segundo_nombre" onChange={handleEditChange} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border uppercase" />
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Primer Apellido</label>
                    <div className="mt-1">
                      <input type="text" required value={editForm.primer_apellido || ''} name="primer_apellido" onChange={handleEditChange} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border uppercase" />
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Segundo Apellido</label>
                    <div className="mt-1">
                      <input type="text" value={editForm.segundo_apellido || ''} name="segundo_apellido" onChange={handleEditChange} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border uppercase" />
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Fecha de Nacimiento</label>
                    <div className="mt-1">
                      <DateInput required maxDate={maxDateStr} value={editForm.fecha_nacimiento || ''} name="fecha_nacimiento" onChange={(val) => setEditForm(p => ({...p, fecha_nacimiento: val}))} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border" />
                      <p className="mt-1 text-xs text-gray-500">Mínimo 15 años de edad.</p>
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Sexo</label>
                    <div className="mt-1">
                      <select required value={editForm.sexo || ''} name="sexo" onChange={handleEditChange} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border">
                        <option value="">Seleccione...</option>
                        <option value="Masculino">Masculino</option>
                        <option value="Femenino">Femenino</option>
                      </select>
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Tipo de Sangre</label>
                    <div className="mt-1">
                      <select value={editForm.tipo_sangre || 'N/A'} name="tipo_sangre" onChange={handleEditChange} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border">
                        <option value="N/A">N/A</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                      </select>
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
                    <div className="mt-1">
                      <input type="email" value={editForm.email || ''} name="email" onChange={handleEditChange} placeholder="ejemplo@cruzverdesv.org" className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border" />
                    </div>
                  </div>

                  <div className="sm:col-span-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Licencias de Conducir</label>
                    <div className="space-y-4">
                      <div>
                        <label className="flex items-center">
                          <input 
                            type="checkbox" 
                            name="tiene_licencia_vehiculo" 
                            checked={editForm.tiene_licencia_vehiculo || false} 
                            onChange={(e) => setEditForm(prev => ({ ...prev, tiene_licencia_vehiculo: e.target.checked }))} 
                            disabled={!canEditThisSocorrista}
                            className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded disabled:opacity-50" 
                          />
                          <span className="ml-2 text-sm text-gray-700">Tiene licencia de vehículo</span>
                        </label>
                        {editForm.tiene_licencia_vehiculo && (
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 p-4 rounded border">
                            <div>
                              <label className="block text-xs font-medium text-gray-700">Número</label>
                              <input 
                                type="text" 
                                name="licencia_vehiculo_numero" 
                                value={editForm.licencia_vehiculo_numero || ''} 
                                onChange={handleEditChange} 
                                disabled={!canEditThisSocorrista}
                                placeholder="00000000-0"
                                className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border disabled:bg-gray-100 disabled:text-gray-500" 
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700">Clase</label>
                              <select 
                                name="licencia_vehiculo_clase" 
                                value={editForm.licencia_vehiculo_clase || 'Liviana'} 
                                onChange={handleEditChange}
                                disabled={!canEditThisSocorrista}
                                className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border disabled:bg-gray-100 disabled:text-gray-500"
                              >
                                <option value="Particular">Particular</option>
                                <option value="Liviana">Liviana</option>
                                <option value="Pesada">Pesada</option>
                                <option value="Pesada T">Pesada T</option>
                                <option value="Agricola">Agrícola</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700">Vencimiento</label>
                              <DateInput 
                                name="licencia_vehiculo_vencimiento" 
                                value={editForm.licencia_vehiculo_vencimiento || ''} 
                                onChange={(val) => setEditForm(p => ({...p, licencia_vehiculo_vencimiento: val}))} 
                                disabled={!canEditThisSocorrista}
                                className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border disabled:bg-gray-100 disabled:text-gray-500" 
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="flex items-center">
                          <input 
                            type="checkbox" 
                            name="tiene_licencia_moto" 
                            checked={editForm.tiene_licencia_moto || false} 
                            onChange={(e) => setEditForm(prev => ({ ...prev, tiene_licencia_moto: e.target.checked }))} 
                            disabled={!canEditThisSocorrista}
                            className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded disabled:opacity-50" 
                          />
                          <span className="ml-2 text-sm text-gray-700">Tiene licencia de motocicleta</span>
                        </label>
                        {editForm.tiene_licencia_moto && (
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded border">
                            <div>
                              <label className="block text-xs font-medium text-gray-700">Número</label>
                              <input 
                                type="text" 
                                name="licencia_moto_numero" 
                                value={editForm.licencia_moto_numero || ''} 
                                onChange={handleEditChange} 
                                disabled={!canEditThisSocorrista}
                                placeholder="00000000-0"
                                className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border disabled:bg-gray-100 disabled:text-gray-500" 
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700">Vencimiento</label>
                              <DateInput 
                                name="licencia_moto_vencimiento" 
                                value={editForm.licencia_moto_vencimiento || ''} 
                                onChange={(val) => setEditForm(p => ({...p, licencia_moto_vencimiento: val}))} 
                                disabled={!canEditThisSocorrista}
                                className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border disabled:bg-gray-100 disabled:text-gray-500" 
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="sm:col-span-6">
                    <div className="flex items-center">
                      <input 
                        type="checkbox" 
                        name="motorista_autorizado" 
                        checked={editForm.motorista_autorizado || false} 
                        onChange={(e) => setEditForm(prev => ({ ...prev, motorista_autorizado: e.target.checked }))} 
                        disabled={!canEditThisSocorrista}
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded disabled:opacity-50" 
                      />
                      <label className="ml-2 block text-sm font-medium text-gray-700">
                        ¿Es Motorista Autorizado en la Institución?
                      </label>
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                    <div className="mt-1 flex space-x-2">
                      <select 
                        value={countryCode} 
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="block w-24 shadow-sm focus:ring-primary focus:border-primary sm:text-sm border-gray-300 rounded-md border p-2"
                      >
                        {countries.map(c => (
                          <option key={c.code} value={c.code}>{c.code}</option>
                        ))}
                      </select>
                      <input type="text" required value={editForm.telefono || ''} name="telefono" onChange={handleEditChange} placeholder={countries.find(c => c.code === countryCode)?.mask} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border" />
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">DUI</label>
                    <div className="mt-1">
                      <input type="text" value={editForm.dui || ''} name="dui" onChange={handleEditChange} placeholder="00000000-0" maxLength={10} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border" />
                    </div>
                  </div>

                  <div className="sm:col-span-6">
                    <label className="block text-sm font-medium text-gray-700">Dirección</label>
                    <div className="mt-1">
                      <input type="text" value={editForm.direccion || ''} name="direccion" onChange={handleEditChange} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border" />
                    </div>
                  </div>

                  {/* Contactos de Emergencia (Máximo 2) */}
                  <div className="sm:col-span-6 bg-red-50/50 p-4 rounded-xl border border-red-200/80">
                    <div className="flex items-center space-x-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                        <PhoneCall className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900">Contactos de Emergencia (Máximo 2)</h4>
                        <p className="text-xs text-gray-500">Aparecerán disponibles para llamada rápida en la verificación oficial del carnet.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Contacto 1 */}
                      <div className="p-3 bg-white rounded-lg border border-red-100 space-y-3">
                        <span className="text-xs font-bold text-red-700 uppercase tracking-wide block">Contacto de Emergencia 1 (Principal)</span>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Nombre Completo / Parentesco</label>
                          <input 
                            type="text" 
                            name="contacto_emergencia_nombre"
                            value={editForm.contacto_emergencia_nombre || ''} 
                            onChange={handleEditChange}
                            placeholder="Ej. María Pérez (Madre)"
                            className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-xs border-gray-300 rounded-md p-2 border"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Código de País y Teléfono</label>
                          <div className="flex space-x-1.5">
                            <select
                              aria-label="Código de país contacto emergencia 1"
                              value={emergenciaCountryCode1}
                              onChange={(e) => {
                                const nextCode = e.target.value;
                                setEmergenciaCountryCode1(nextCode);
                                setEditForm((prev: any) => ({
                                  ...prev,
                                  contacto_emergencia_telefono: formatPhoneWithMask(prev.contacto_emergencia_telefono || '', nextCode),
                                }));
                              }}
                              className="w-24 shrink-0 shadow-sm focus:ring-primary focus:border-primary sm:text-xs border-gray-300 rounded-md p-2 border bg-white font-medium"
                            >
                              {COUNTRY_PHONE_CODES.map(c => (
                                <option key={c.code} value={c.code}>{c.code} ({c.name})</option>
                              ))}
                            </select>
                            <input 
                              type="tel" 
                              name="contacto_emergencia_telefono"
                              value={editForm.contacto_emergencia_telefono || ''} 
                              onChange={handleEditChange}
                              placeholder={getCountryMask(emergenciaCountryCode1).placeholder}
                              className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-xs font-mono border-gray-300 rounded-md p-2 border"
                            />
                          </div>
                          <span className="text-[10px] text-gray-500 mt-1 block">
                            Formato {getCountryMask(emergenciaCountryCode1).name}: {getCountryMask(emergenciaCountryCode1).placeholder}
                          </span>
                        </div>
                      </div>

                      {/* Contacto 2 */}
                      <div className="p-3 bg-white rounded-lg border border-red-100 space-y-3">
                        <span className="text-xs font-bold text-red-700 uppercase tracking-wide block">Contacto de Emergencia 2 (Secundario)</span>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Nombre Completo / Parentesco</label>
                          <input 
                            type="text" 
                            name="contacto_emergencia_nombre_2"
                            value={editForm.contacto_emergencia_nombre_2 || ''} 
                            onChange={handleEditChange}
                            placeholder="Ej. Carlos Gómez (Hermano)"
                            className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-xs border-gray-300 rounded-md p-2 border"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Código de País y Teléfono</label>
                          <div className="flex space-x-1.5">
                            <select
                              aria-label="Código de país contacto emergencia 2"
                              value={emergenciaCountryCode2}
                              onChange={(e) => {
                                const nextCode = e.target.value;
                                setEmergenciaCountryCode2(nextCode);
                                setEditForm((prev: any) => ({
                                  ...prev,
                                  contacto_emergencia_telefono_2: formatPhoneWithMask(prev.contacto_emergencia_telefono_2 || '', nextCode),
                                }));
                              }}
                              className="w-24 shrink-0 shadow-sm focus:ring-primary focus:border-primary sm:text-xs border-gray-300 rounded-md p-2 border bg-white font-medium"
                            >
                              {COUNTRY_PHONE_CODES.map(c => (
                                <option key={c.code} value={c.code}>{c.code} ({c.name})</option>
                              ))}
                            </select>
                            <input 
                              type="tel" 
                              name="contacto_emergencia_telefono_2"
                              value={editForm.contacto_emergencia_telefono_2 || ''} 
                              onChange={handleEditChange}
                              placeholder={getCountryMask(emergenciaCountryCode2).placeholder}
                              className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-xs font-mono border-gray-300 rounded-md p-2 border"
                            />
                          </div>
                          <span className="text-[10px] text-gray-500 mt-1 block">
                            Formato {getCountryMask(emergenciaCountryCode2).name}: {getCountryMask(emergenciaCountryCode2).placeholder}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Información Institucional</h3>
                </div>
                <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Seccional</label>
                    <div className="mt-1">
                      {(() => {
                        const allowedIds = getAllowedSocorristaSeccionalIds();
                        const visibleSecs =
                          allowedIds === 'all'
                            ? seccionales
                            : seccionales.filter(
                                (s) =>
                                  allowedIds.includes(Number(s.id)) ||
                                  Number(s.id) === Number(socorrista?.seccional_id)
                              );
                        const canChangeSec =
                          role === 'admin' ||
                          permissions.ver_todas_seccionales ||
                          (allowedIds !== 'all' && allowedIds.length > 1);
                        return (
                          <select
                            disabled={!canChangeSec}
                            required
                            value={editForm.seccional_id || ''}
                            name="seccional_id"
                            onChange={handleEditChange}
                            className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border disabled:bg-gray-100 disabled:text-gray-500"
                          >
                            <option value="">Seleccione...</option>
                            {visibleSecs.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.nombre}
                              </option>
                            ))}
                          </select>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Fecha de Ingreso</label>
                    <div className="mt-1">
                      <DateInput required value={editForm.fecha_ingreso || ''} name="fecha_ingreso" onChange={(val) => setEditForm(p => ({...p, fecha_ingreso: val}))} className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border" />
                    </div>
                  </div>

                  <CargosSelector
                    layout="grid"
                    cargoPrincipal={editForm.cargo_institucional || ''}
                    cargosSecundarios={Array.isArray(editForm.cargos_secundarios) ? editForm.cargos_secundarios : []}
                    cargoAdministrativo={editForm.cargo_administrativo || ''}
                    onChangePrincipal={(val) => setEditForm((prev: any) => ({ ...prev, cargo_institucional: val }))}
                    onChangeSecundarios={(vals) => setEditForm((prev: any) => ({ ...prev, cargos_secundarios: vals }))}
                    onChangeAdministrativo={(val) => setEditForm((prev: any) => ({ ...prev, cargo_administrativo: val }))}
                    disabledAll={!canEditThisSocorrista}
                  />

                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Segundo Cargo Administrativo</label>
                    <p className="text-xs text-gray-500 mt-0.5">Dirección de Seccional (1 cupo por seccional)</p>
                    <div className="mt-1 space-y-2">
                      <select
                        disabled={!canEditThisSocorrista}
                        value={editForm.segundo_cargo_administrativo || ''}
                        name="segundo_cargo_administrativo"
                        onChange={handleEditChange}
                        className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border disabled:bg-gray-100 disabled:text-gray-500"
                      >
                        <option value="">Ninguno / Sin segundo cargo</option>
                        <option
                          value="Director de Seccional"
                          disabled={!!seccionalOccupants.director && String(seccionalOccupants.director.id) !== String(id)}
                        >
                          Director de Seccional {seccionalOccupants.director && String(seccionalOccupants.director.id) !== String(id) ? `(Ocupado: ${seccionalOccupants.director.name})` : '(Disponible)'}
                        </option>
                        <option
                          value="Subdirector de Seccional"
                          disabled={!!seccionalOccupants.subdirector && String(seccionalOccupants.subdirector.id) !== String(id)}
                        >
                          Subdirector de Seccional {seccionalOccupants.subdirector && String(seccionalOccupants.subdirector.id) !== String(id) ? `(Ocupado: ${seccionalOccupants.subdirector.name})` : '(Disponible)'}
                        </option>
                      </select>

                      {transferNotice && (
                        <div className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                          ⚠️ {transferNotice}
                        </div>
                      )}

                      {editForm.seccional_id && (
                        <div className="flex flex-wrap gap-1.5 pt-1 text-xs">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded border ${seccionalOccupants.director && String(seccionalOccupants.director.id) !== String(id) ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-green-50 text-green-800 border-green-200'}`}>
                            {seccionalOccupants.director && String(seccionalOccupants.director.id) !== String(id) ? `🔒 Director: ${seccionalOccupants.director.name}` : '✓ Cupo Director disponible'}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded border ${seccionalOccupants.subdirector && String(seccionalOccupants.subdirector.id) !== String(id) ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-green-50 text-green-800 border-green-200'}`}>
                            {seccionalOccupants.subdirector && String(seccionalOccupants.subdirector.id) !== String(id) ? `🔒 Subdirector: ${seccionalOccupants.subdirector.name}` : '✓ Cupo Subdirector disponible'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              <div className="pt-8">
                <div className="mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Información Adicional — Ficha «Conoce a tu Socorrista» (CVSSOCC/FORM001)
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Datos requeridos para generar e imprimir el formulario oficial CVSSOCC/FORM001. El NIT es opcional.
                  </p>
                </div>
                <ConoceSocorristaFormFields
                  value={editKycForm}
                  onChange={setEditKycForm}
                  dui={editForm.dui || ''}
                  direccionBase={editForm.direccion || ''}
                  fechaIngresoBase={editForm.fecha_ingreso || ''}
                  disabled={!canEditThisSocorrista}
                />
              </div>
            </div>
          </form>

          {showCropper && imageSrc && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
              <div className="bg-white rounded-lg w-full max-w-2xl overflow-hidden flex flex-col h-[80vh]">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Recortar Fotografía</h3>
                  <button onClick={() => setShowCropper(false)} className="text-gray-400 hover:text-gray-500">
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <div className="relative flex-1 bg-gray-900">
                  <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    cropShape="round"
                    showGrid={false}
                    onCropChange={setCrop}
                    onCropComplete={onCropComplete}
                    onZoomChange={setZoom}
                  />
                </div>
                <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
                  <div className="flex-1 mr-4">
                    <input
                      type="range"
                      value={zoom}
                      min={1}
                      max={3}
                      step={0.1}
                      aria-labelledby="Zoom"
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <button
                    onClick={handleCropSave}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                  >
                    <Crop className="-ml-1 mr-2 h-5 w-5" />
                    Aplicar Recorte
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0 h-24 w-24">
                {socorrista.foto_url ? (
                  <img src={socorrista.foto_url} alt="" className="h-24 w-24 border-4 border-gray-200 rounded-full object-cover" />
                ) : (
                  <div className="h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-2xl border-4 border-gray-200">
                    {(socorrista.primer_nombre?.[0] || '') + (socorrista.primer_apellido?.[0] || '')}
                  </div>
                )}
              </div>
              <div className="ml-6">
                <h3 className="text-2xl leading-6 font-bold text-gray-900">
                  {socorrista.primer_nombre} {socorrista.segundo_nombre} {socorrista.primer_apellido} {socorrista.segundo_apellido}
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500 font-mono text-lg">
                  Carnet: <span className="font-bold text-gray-900">{socorrista.carnet}</span>
                </p>
                <div className="mt-2 flex items-center text-sm text-gray-500">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    socorrista.estado === 'Activo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {socorrista.estado}
                  </span>
                  <span className="ml-4 text-gray-500">Seccional: {socorrista.seccional_nombre}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
            <dl className="sm:divide-y sm:divide-gray-200">
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Fecha de Nacimiento</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{socorrista.fecha_nacimiento}</dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Sexo</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{socorrista.sexo}</dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Tipo de Sangre</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 font-bold text-primary">{socorrista.tipo_sangre || 'N/A'}</dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Correo Electrónico</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{socorrista.email || 'No registrado'}</dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Licencias de Conducir</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 space-y-4">
                  {socorrista.licencia_vehiculo_numero && (
                    <div className="bg-gray-50 p-3 rounded border">
                      <p className="font-medium text-gray-900 mb-1">Vehículo ({socorrista.licencia_vehiculo_clase || 'Liviana'})</p>
                      <ul className="text-sm text-gray-600">
                        <li><span className="font-semibold">Número:</span> {socorrista.licencia_vehiculo_numero}</li>
                        <li><span className="font-semibold">Vencimiento:</span> {socorrista.licencia_vehiculo_vencimiento || 'N/A'}</li>
                      </ul>
                    </div>
                  )}
                  {socorrista.licencia_moto_numero && (
                    <div className="bg-gray-50 p-3 rounded border">
                      <p className="font-medium text-gray-900 mb-1">Motocicleta</p>
                      <ul className="text-sm text-gray-600">
                        <li><span className="font-semibold">Número:</span> {socorrista.licencia_moto_numero}</li>
                        <li><span className="font-semibold">Vencimiento:</span> {socorrista.licencia_moto_vencimiento || 'N/A'}</li>
                      </ul>
                    </div>
                  )}
                  {!socorrista.licencia_vehiculo_numero && !socorrista.licencia_moto_numero && (
                    <span className="text-gray-500 italic">No tiene licencias registradas</span>
                  )}
                </dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 border-t border-gray-200">
                <dt className="text-sm font-medium text-gray-500">Autorización Institucional</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {socorrista.motorista_autorizado ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Autorizado como Motorista
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      No autorizado
                    </span>
                  )}
                </dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Teléfono</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{socorrista.telefono}</dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">DUI</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{socorrista.dui || 'No registrado'}</dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Dirección</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{socorrista.direccion}</dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 bg-red-50/30">
                <dt className="text-sm font-medium text-gray-700 flex items-center">
                  <PhoneCall className="w-4 h-4 mr-1.5 text-red-600" />
                  Contactos de Emergencia
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {(socorrista.contacto_emergencia_telefono || socorrista.contacto_emergencia_telefono_2) ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {socorrista.contacto_emergencia_telefono && (
                        <div className="flex items-center space-x-3 bg-white p-2.5 rounded-lg border border-red-200 shadow-2xs">
                          <span className="w-6 h-6 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold shrink-0">1</span>
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-gray-900 block text-xs truncate">{socorrista.contacto_emergencia_nombre || 'Contacto Principal'}</span>
                            <a 
                              href={toTelHref(socorrista.contacto_emergencia_telefono)}
                              className="text-emerald-700 hover:text-emerald-900 font-mono font-medium inline-flex items-center text-xs mt-0.5"
                            >
                              <Phone className="w-3 h-3 mr-1 text-emerald-600 shrink-0" />
                              {socorrista.contacto_emergencia_telefono}
                            </a>
                          </div>
                        </div>
                      )}
                      {socorrista.contacto_emergencia_telefono_2 && (
                        <div className="flex items-center space-x-3 bg-white p-2.5 rounded-lg border border-red-200 shadow-2xs">
                          <span className="w-6 h-6 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold shrink-0">2</span>
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-gray-900 block text-xs truncate">{socorrista.contacto_emergencia_nombre_2 || 'Contacto Secundario'}</span>
                            <a 
                              href={toTelHref(socorrista.contacto_emergencia_telefono_2)}
                              className="text-emerald-700 hover:text-emerald-900 font-mono font-medium inline-flex items-center text-xs mt-0.5"
                            >
                              <Phone className="w-3 h-3 mr-1 text-emerald-600 shrink-0" />
                              {socorrista.contacto_emergencia_telefono_2}
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400 italic text-xs">No se han registrado contactos de emergencia aún.</span>
                  )}
                </dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Cargo Institucional</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 space-y-2">
                  <div className="font-semibold text-gray-900">{socorrista.cargo_institucional || 'N/A'}</div>
                  {Array.isArray(socorrista.cargos_secundarios) && socorrista.cargos_secundarios.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-gray-500 mr-1">Especialidades / Secundarios:</span>
                      {socorrista.cargos_secundarios.map((c: string, idx: number) => (
                        <span
                          key={`${c}-${idx}`}
                          className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Cargo Administrativo</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{socorrista.cargo_administrativo || 'N/A'}</dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Segundo Cargo Administrativo</dt>
                <dd className="mt-1 text-sm sm:mt-0 sm:col-span-2">
                  {socorrista.segundo_cargo_administrativo ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                      <Shield className="w-3.5 h-3.5 mr-1 text-blue-600" />
                      {socorrista.segundo_cargo_administrativo}
                    </span>
                  ) : (
                    <span className="text-gray-500">N/A</span>
                  )}
                </dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Fecha de Ingreso</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{socorrista.fecha_ingreso}</dd>
              </div>
              {carnetGeneradoUrl && (
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Carnet Generado</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {(permissions.ver_imagenes_socorristas || role === 'admin') ? (
                      <WatermarkImage src={carnetGeneradoUrl} alt="Carnet" className="max-w-xs shadow-md border border-gray-200" isRounded={false} />
                    ) : (
                      <span className="text-sm text-gray-500 italic">No tienes permiso para ver esta imagen.</span>
                    )}
                    {fechaGeneracion && (
                      <p className="mt-2 text-xs text-gray-500">
                        Generado el: {formatFechaHoraSV(fechaGeneracion)}
                      </p>
                    )}
                    <div className="mt-2 flex space-x-4">
                      {(permissions.descargar_carnet || role === 'admin') && (
                        <>
                          <button onClick={() => downloadImageWithWatermark('png')} className="text-primary hover:text-primary-hover text-sm font-medium">
                            Descargar PNG
                          </button>
                          <button onClick={() => downloadImageWithWatermark('jpeg')} className="text-primary hover:text-primary-hover text-sm font-medium">
                            Descargar JPG
                          </button>
                        </>
                      )}
                    </div>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}

      {/* Sección desplegable: Información Adicional — Ficha «Conoce a tu Socorrista» (CVSSOCC/FORM001) */}
      {!isEditing && (() => {
        const kycValidation = validateConoceSocorrista(socorrista);
        const extractedKyc = extractKycFromSocorrista(socorrista);
        const parsedDeps = parseDependientesFromRow(
          extractedKyc.dependientes_detalle,
          extractedKyc.nombre_dependientes
        );
        const explicitNoDeps = isNoDependentsText(extractedKyc.nombre_dependientes);

        return (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {/* Cabecera limpia con botón de Expandir */}
            <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
              <button
                type="button"
                onClick={() => setShowExtraKycDetails((prev) => !prev)}
                className="flex items-start gap-3.5 text-left group cursor-pointer flex-1 min-w-0"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    kycValidation.isComplete
                      ? 'bg-emerald-500/12 text-emerald-600'
                      : 'bg-amber-500/15 text-amber-600'
                  }`}
                >
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                      Información Adicional · Conoce a tu Socorrista
                    </h3>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span
                      className={`text-xs font-semibold tabular-nums ${
                        kycValidation.isComplete ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {kycValidation.isComplete
                        ? 'Completa'
                        : `${kycValidation.missingFields.length} ${
                            kycValidation.missingFields.length === 1 ? 'dato pendiente' : 'datos pendientes'
                          }`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {kycValidation.isComplete
                      ? 'Estado civil, dependientes, profesión, domicilio y declaración PEP registrados.'
                      : `Falta completar: ${kycValidation.missingFields.join(' · ')}.`}
                  </p>
                </div>
              </button>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowExtraKycDetails((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-800 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>{showExtraKycDetails ? 'Ocultar información' : 'Expandir información'}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${
                      showExtraKycDetails ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {canEditThisSocorrista && (
                  <button
                    type="button"
                    onClick={() => {
                      setConoceModalMode('edit');
                      setShowConoceModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Edit className="w-3.5 h-3.5 text-slate-500" />
                    <span>{kycValidation.isComplete ? 'Editar datos' : 'Completar datos'}</span>
                  </button>
                )}

                {canDownloadConoceSocorrista && (
                  <button
                    type="button"
                    onClick={() => {
                      setConoceModalMode(kycValidation.isComplete ? 'auto' : 'edit');
                      setShowConoceModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Descargar / Imprimir</span>
                  </button>
                )}
              </div>
            </div>

            {/* Panel expandido estilo iOS con toda la información adicional */}
            {showExtraKycDetails && (
              <div className="border-t border-slate-100 bg-[#F2F2F7]/70 p-4 sm:p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Grupo 1: Identificación y Datos Civiles */}
                  <div className="bg-white rounded-2xl border border-slate-200/70 divide-y divide-slate-100 overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50/70">
                      <span className="text-[11px] font-semibold text-slate-500">
                        Identificación y datos personales
                      </span>
                    </div>
                    <div className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                      <span className="text-slate-500">NIT</span>
                      <span className="font-mono font-medium text-slate-900 tabular-nums text-right">
                        {extractedKyc.nit || socorrista.dui || 'Opcional (No registrado)'}
                      </span>
                    </div>
                    <div className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                      <span className="text-slate-500">Estado civil</span>
                      <span className="font-medium text-slate-900 text-right">
                        {extractedKyc.estado_civil || <span className="text-slate-400">Pendiente</span>}
                      </span>
                    </div>
                    <div className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                      <span className="text-slate-500">Cónyuge / Compañero(a)</span>
                      <span className="font-medium text-slate-900 text-right">
                        {extractedKyc.nombre_conyuge || <span className="text-slate-400">Pendiente</span>}
                      </span>
                    </div>
                    <div className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                      <span className="text-slate-500">Nacionalidad</span>
                      <span className="font-medium text-slate-900 text-right">
                        {extractedKyc.nacionalidad || <span className="text-slate-400">Pendiente</span>}
                      </span>
                    </div>
                  </div>

                  {/* Grupo 2: Actividad Laboral y Domicilio */}
                  <div className="bg-white rounded-2xl border border-slate-200/70 divide-y divide-slate-100 overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50/70">
                      <span className="text-[11px] font-semibold text-slate-500">
                        Ocupación, domicilio y cargo público
                      </span>
                    </div>
                    <div className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                      <span className="text-slate-500">Profesión u oficio</span>
                      <span className="font-medium text-slate-900 text-right">
                        {extractedKyc.profesion_ocupacion || <span className="text-slate-400">Pendiente</span>}
                      </span>
                    </div>
                    <div className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                      <span className="text-slate-500">Inicio relación laboral</span>
                      <span className="font-mono font-medium text-slate-900 tabular-nums text-right">
                        {extractedKyc.fecha_inicio_relacion_laboral ||
                          socorrista.fecha_ingreso || <span className="text-slate-400 font-sans">Pendiente</span>}
                      </span>
                    </div>
                    <div className="px-4 py-3 flex items-start justify-between gap-4 text-xs">
                      <span className="text-slate-500 shrink-0">Domicilio en ficha</span>
                      <span className="font-medium text-slate-900 text-right">
                        {extractedKyc.direccion_domicilio ||
                          socorrista.direccion || <span className="text-slate-400">Pendiente</span>}
                      </span>
                    </div>
                    <div className="px-4 py-3 flex items-start justify-between gap-4 text-xs">
                      <span className="text-slate-500 shrink-0">Cargo público (últimos 5 años)</span>
                      <div className="text-right">
                        {extractedKyc.cargo_publico_ultimos_5_anios === null ? (
                          <span className="text-slate-400 font-medium">Pendiente</span>
                        ) : extractedKyc.cargo_publico_ultimos_5_anios ? (
                          <div className="space-y-0.5">
                            <span className="font-semibold text-amber-800">Sí desempeñó cargo público</span>
                            <p className="text-[11px] text-slate-600">
                              {extractedKyc.cargo_publico_posicion || 'Cargo no especificado'}
                              {extractedKyc.cargo_publico_periodo
                                ? ` · ${extractedKyc.cargo_publico_periodo}`
                                : ''}
                            </p>
                          </div>
                        ) : (
                          <span className="font-medium text-slate-900">No</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Grupo 3: Dependientes con Parentesco */}
                <div className="bg-white rounded-2xl border border-slate-200/70 overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500">
                      Dependientes registrados
                    </span>
                    <span className="text-[11px] font-medium text-slate-400 tabular-nums">
                      {explicitNoDeps
                        ? 'Sin dependientes'
                        : parsedDeps.length > 0
                        ? `${parsedDeps.length} ${parsedDeps.length === 1 ? 'dependiente' : 'dependientes'}`
                        : 'Pendiente'}
                    </span>
                  </div>

                  {explicitNoDeps ? (
                    <div className="px-4 py-3 text-xs text-slate-600">
                      Sin dependientes declarados (No aplica).
                    </div>
                  ) : parsedDeps.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {parsedDeps.map((dep, idx) => (
                        <div
                          key={`${dep.nombre}-${idx}`}
                          className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs"
                        >
                          <span className="font-medium text-slate-900">{dep.nombre}</span>
                          <span className="text-slate-500 shrink-0">{dep.parentesco}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-3 text-xs text-slate-400">
                      Aún no se han registrado dependientes para este elemento.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Cursos Section */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Cursos y Certificaciones</h3>
          {role !== 'socorrista' && canEditThisSocorrista && (
            <button 
              onClick={() => setShowAddCurso(!showAddCurso)}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
              <Plus className="-ml-0.5 mr-1 h-4 w-4" />
              {showAddCurso ? 'Cancelar' : 'Agregar Curso'}
            </button>
          )}
        </div>

        {showAddCurso && (
          <div className="px-4 py-5 sm:p-6 border-b border-gray-200 bg-gray-50">
            <form onSubmit={handleAddCurso} className="space-y-4">
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-4">
                <div className="sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700">Curso</label>
                  <select required value={newCurso.curso_id} onChange={handleCursoChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md border">
                    <option value="">Seleccione...</option>
                    {availableCursos.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700">Año</label>
                  <input type="number" required value={newCurso.anio} onChange={e => setNewCurso({...newCurso, anio: parseInt(e.target.value)})} className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md border p-2" />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700">Fecha Certificación</label>
                  <DateInput required value={newCurso.fecha_certificacion} onChange={val => {
                    if (!val) {
                      setNewCurso({...newCurso, fecha_certificacion: '', fecha_vencimiento: ''});
                      return;
                    }
                    const certDate = new Date(val + 'T00:00:00');
                    const curso = availableCursos.find(c => c.id.toString() === newCurso.curso_id);
                    if (curso) {
                      certDate.setMonth(certDate.getMonth() + curso.vigencia_meses);
                      const y = certDate.getFullYear();
                      const m = String(certDate.getMonth() + 1).padStart(2, '0');
                      const d = String(certDate.getDate()).padStart(2, '0');
                      setNewCurso({...newCurso, fecha_certificacion: val, fecha_vencimiento: `${y}-${m}-${d}`});
                    } else {
                      setNewCurso({...newCurso, fecha_certificacion: val});
                    }
                  }} className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md border p-2" />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700">Fecha Vencimiento</label>
                  <DateInput required value={newCurso.fecha_vencimiento} onChange={val => setNewCurso({...newCurso, fecha_vencimiento: val})} className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md border p-2" />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="px-4 py-5 sm:p-6">
          {socorrista.cursos && socorrista.cursos.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Curso</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Año</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Certificación</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vencimiento</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {socorrista.cursos.map((curso: any) => {
                    const vigente = isVigente(curso.fecha_vencimiento);
                    return (
                      <tr key={curso.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{curso.curso_nombre}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{curso.anio}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{curso.fecha_certificacion}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{curso.fecha_vencimiento}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {vigente ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle className="-ml-0.5 mr-1.5 h-4 w-4 text-green-600" />
                              Vigente
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <XCircle className="-ml-0.5 mr-1.5 h-4 w-4 text-red-600" />
                              Vencida
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">No hay cursos registrados para este elemento.</p>
          )}
        </div>
      </div>

      {/* Sección de Méritos, Premios y Reconocimientos */}
      <div className="bg-white shadow sm:rounded-lg overflow-hidden border border-slate-200/80">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center border-b border-gray-200 bg-linear-to-r from-amber-500/10 via-yellow-500/5 to-transparent">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg leading-6 font-bold text-gray-900">Méritos, Premios y Condecoraciones</h3>
              <p className="text-xs text-gray-500">Distinciones institucionales, misiones humanitarias y reconocimientos oficiales</p>
            </div>
          </div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-600" />
            {meritosList.length} {meritosList.length === 1 ? 'Reconocimiento' : 'Reconocimientos'}
          </span>
        </div>

        <div className="p-4 sm:p-6">
          {loadingMeritos ? (
            <div className="py-6 text-center text-xs text-gray-500">Cargando condecoraciones...</div>
          ) : meritosList.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {meritosList.map(merito => {
                const asignacion = (merito.socorristas_asignados || []).find((a: any) => Number(a.socorrista_id) === Number(id));
                return (
                  <div 
                    key={merito.id} 
                    className="p-4 rounded-xl border border-amber-200/90 bg-linear-to-br from-amber-50/50 via-white to-yellow-50/30 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-2xs font-bold bg-amber-500 text-white shadow-2xs">
                          {merito.categoria || 'Honor al Mérito'}
                        </span>
                        <span className="text-xs font-semibold text-gray-500">
                          {asignacion?.fecha_asignacion || merito.fecha_otorgamiento || 'Condecorado'}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-gray-950 mb-1">{merito.titulo}</h4>
                      {merito.descripcion && (
                        <p className="text-xs text-gray-700 leading-relaxed mb-3">{merito.descripcion}</p>
                      )}
                      {asignacion?.observaciones && (
                        <div className="p-2 rounded bg-amber-100/60 text-amber-900 text-2xs mb-2">
                          <strong>Mención especial:</strong> {asignacion.observaciones}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-amber-100/80 flex items-center justify-between text-2xs text-gray-500">
                      <span>Otorgado por: <strong className="text-gray-800">{merito.institucion_otorgante || 'Cruz Verde Salvadoreña'}</strong></span>
                      {merito.numero_acuerdo && (
                        <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-200">
                          Acuerdo: {merito.numero_acuerdo}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
              <Award className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">Sin méritos o condecoraciones registradas</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Los méritos otorgados desde el módulo de Operaciones &gt; Méritos y Premios aparecerán reflejados aquí automáticamente.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sección de Documentos Oficiales Versionados (CV, Antecedentes Penales, Policiales, Solvencias) */}
      <DocumentosSocorristaCard 
        socorristaId={Number(id)} 
        socorristaNombre={`${socorrista.primer_nombre} ${socorrista.primer_apellido}`} 
      />

      <SocorristaConfirmModal
        isOpen={showSaveConfirmModal}
        mode="edit"
        loading={loading}
        primerNombre={editForm.primer_nombre || ''}
        segundoNombre={editForm.segundo_nombre || ''}
        primerApellido={editForm.primer_apellido || ''}
        segundoApellido={editForm.segundo_apellido || ''}
        dui={editForm.dui || ''}
        seccionalNombre={
          seccionales.find((s) => String(s.id) === String(editForm.seccional_id))?.nombre ||
          socorrista?.seccional_nombre ||
          ''
        }
        cargoInstitucional={editForm.cargo_institucional || ''}
        onClose={() => setShowSaveConfirmModal(false)}
        onConfirm={executeEditSave}
      />

      <ConoceSocorristaPrintModal
        isOpen={showConoceModal}
        onClose={() => setShowConoceModal(false)}
        socorrista={socorrista}
        canEdit={canEditThisSocorrista}
        canPrint={canDownloadConoceSocorrista}
        initialMode={conoceModalMode}
        onSavedKyc={(updatedExtra, baseUpdates) => {
          setEditKycForm(updatedExtra);
          setSocorrista((prev: any) =>
            prev
              ? {
                  ...prev,
                  ...updatedExtra,
                  ...(baseUpdates?.direccion !== undefined ? { direccion: baseUpdates.direccion } : {}),
                  ...(baseUpdates?.email !== undefined ? { email: baseUpdates.email } : {}),
                }
              : prev
          );
          setEditForm((prev: any) => ({
            ...prev,
            ...updatedExtra,
            ...(baseUpdates?.direccion !== undefined ? { direccion: baseUpdates.direccion } : {}),
            ...(baseUpdates?.email !== undefined ? { email: baseUpdates.email } : {}),
          }));
        }}
      />

    </div>
  );
}
