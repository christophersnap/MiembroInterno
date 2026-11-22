import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Save, ArrowLeft, X, Check, PhoneCall, Camera, AlertCircle, AlertTriangle, ShieldAlert, Lock, Building2, ExternalLink } from 'lucide-react';
import Cropper from 'react-easy-crop';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';
import DateInput from '../components/DateInput';
import CarnetPhotoCaptureModal from '../components/common/CarnetPhotoCaptureModal';
import CargosSelector from '../components/socorristas/CargosSelector';
import SocorristaConfirmModal from '../components/socorristas/SocorristaConfirmModal';
import {
  normalizeDocumentForCompare,
  normalizeTextForCompare,
  saveSocorristaCargosSecundariosFallback,
} from '../utils/cargosCatalog';
import {
  COUNTRY_PHONE_CODES,
  composePhoneWithCountry,
  formatPhoneWithMask,
  getCountryMask,
} from '../utils/phoneMask';
import { optimizeImageForUpload, getExtensionFromFile } from '../utils/imageOptimizer';
import { getElSalvadorDateString, getElSalvadorIsoTimestamp } from '../utils/dateUtils';
import { FileCheck2, Clock } from 'lucide-react';
import ConoceSocorristaFormFields from '../components/socorristas/ConoceSocorristaFormFields';
import {
  ConoceSocorristaExtraData,
  EMPTY_CONOCE_SOCORRISTA_DATA,
  saveSocorristaKycData,
  validateOnlyExtraKycFields,
} from '../utils/conoceSocorrista';

export default function NewSocorrista() {
  const navigate = useNavigate();
  const {
    role,
    loading: authLoading,
    directorSeccionalId,
    userSeccionalId,
    permissions,
    seccionalesSocorristasAccess,
    canAddAnySocorrista,
    getAddAllowedSocorristaSeccionalIds,
  } = useAuth();
  const [seccionales, setSeccionales] = useState<any[]>([]);
  const [seccionalesLoaded, setSeccionalesLoaded] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [cargosSecundarios, setCargosSecundarios] = useState<string[]>([]);
  const [duiDuplicates, setDuiDuplicates] = useState<any[]>([]);
  const [checkingDui, setCheckingDui] = useState(false);
  const [nameDuplicates, setNameDuplicates] = useState<any[]>([]);
  const [checkingNames, setCheckingNames] = useState(false);
  const [confirmHomonym, setConfirmHomonym] = useState(false);
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
  const [incluirFichaKycAhora, setIncluirFichaKycAhora] = useState(false);
  const [extraKycData, setExtraKycData] = useState<ConoceSocorristaExtraData>({
    ...EMPTY_CONOCE_SOCORRISTA_DATA,
    fecha_inicio_relacion_laboral: getElSalvadorDateString(),
  });
  const [formData, setFormData] = useState({
    primer_nombre: '',
    segundo_nombre: '',
    primer_apellido: '',
    segundo_apellido: '',
    fecha_nacimiento: '',
    telefono: '',
    direccion: '',
    contacto_emergencia_nombre: '',
    contacto_emergencia_telefono: '',
    contacto_emergencia_nombre_2: '',
    contacto_emergencia_telefono_2: '',
    seccional_id: directorSeccionalId ? directorSeccionalId.toString() : '',
    sexo: 'Masculino',
    fecha_ingreso: getElSalvadorDateString(),
    cargo_institucional: '',
    cargo_administrativo: '',
    segundo_cargo_administrativo: '',
    dui: '',
    tipo_sangre: 'N/A',
    email: '',
    motorista_autorizado: false,
    licencia_vehiculo_numero: '',
    licencia_vehiculo_clase: 'Liviana',
    licencia_vehiculo_vencimiento: '',
    licencia_moto_numero: '',
    licencia_moto_vencimiento: '',
    tiene_licencia_vehiculo: false,
    tiene_licencia_moto: false
  });
  const [esMayorDeEdad, setEsMayorDeEdad] = useState(true);
  const [tieneCarnetMinoridad, setTieneCarnetMinoridad] = useState(false);
  const [countryCode, setCountryCode] = useState('+503');
  const [emergenciaCountryCode1, setEmergenciaCountryCode1] = useState('+503');
  const [emergenciaCountryCode2, setEmergenciaCountryCode2] = useState('+503');
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  
  // Occupants of Director/Subdirector for the selected seccional
  const [seccionalOccupants, setSeccionalOccupants] = useState<{
    director: string | null;
    subdirector: string | null;
    loading: boolean;
  }>({ director: null, subdirector: null, loading: false });
  
  // Cropper state
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [showCropper, setShowCropper] = useState(false);

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

  useEffect(() => {
    if (authLoading) return;
    const fetchSeccionales = async () => {
      try {
        const { data, error } = await supabase
          .from('seccionales')
          .select('*')
          .eq('estado', 'Activa')
          .order('nombre');

        if (data) {
          const allowedIds = getAddAllowedSocorristaSeccionalIds();
          const filtered =
            allowedIds === 'all'
              ? data
              : data.filter((s: any) => allowedIds.includes(Number(s.id)));
          setSeccionales(filtered);

          setFormData((prev) => {
            if (filtered.length === 1) {
              return { ...prev, seccional_id: String(filtered[0].id) };
            }
            if (
              prev.seccional_id &&
              filtered.some((s: any) => String(s.id) === String(prev.seccional_id))
            ) {
              return prev;
            }
            return { ...prev, seccional_id: '' };
          });
        }
        if (error) console.error(error);
      } catch (err) {
        console.error('Error fetching seccionales:', err);
      } finally {
        setSeccionalesLoaded(true);
      }
    };
    fetchSeccionales();
  }, [authLoading, role, directorSeccionalId, userSeccionalId, permissions, seccionalesSocorristasAccess]);

  // Real-time duplicate check for DUI / Carnet de Minoridad across ALL seccionales
  useEffect(() => {
    const rawDui = formData.dui?.trim() || '';
    const normDui = normalizeDocumentForCompare(rawDui);
    if (!rawDui || rawDui.toLowerCase() === 'menor de edad' || normDui.length < 5) {
      setDuiDuplicates([]);
      setCheckingDui(false);
      return;
    }

    let cancelled = false;
    setCheckingDui(true);
    const timer = setTimeout(async () => {
      try {
        const digitsOnly = rawDui.replace(/\D/g, '');
        let query = supabase
          .from('socorristas')
          .select('id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, carnet, dui, estado, seccional_id, seccionales(nombre)')
          .limit(30);

        if (digitsOnly.length >= 5) {
          query = query.ilike('dui', `%${digitsOnly.slice(0, 6)}%`);
        } else {
          query = query.ilike('dui', `%${rawDui}%`);
        }

        const { data } = await query;
        if (cancelled) return;
        const matches = (data || []).filter(
          (row: any) => normalizeDocumentForCompare(row.dui) === normDui
        );
        setDuiDuplicates(matches);
      } catch (err) {
        if (!cancelled) setDuiDuplicates([]);
      } finally {
        if (!cancelled) setCheckingDui(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [formData.dui]);

  // Real-time duplicate check for Nombres + Apellidos across ALL seccionales
  useEffect(() => {
    const pn = normalizeTextForCompare(formData.primer_nombre);
    const pa = normalizeTextForCompare(formData.primer_apellido);
    const sn = normalizeTextForCompare(formData.segundo_nombre);
    const sa = normalizeTextForCompare(formData.segundo_apellido);

    setConfirmHomonym(false);

    if (pn.length < 2 || pa.length < 2) {
      setNameDuplicates([]);
      setCheckingNames(false);
      return;
    }

    let cancelled = false;
    setCheckingNames(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('socorristas')
          .select('id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, carnet, dui, estado, fecha_nacimiento, seccional_id, seccionales(nombre)')
          .ilike('primer_nombre', `%${pn}%`)
          .ilike('primer_apellido', `%${pa}%`)
          .limit(25);

        if (cancelled) return;
        const matches = (data || []).filter((row: any) => {
          const rPn = normalizeTextForCompare(row.primer_nombre);
          const rPa = normalizeTextForCompare(row.primer_apellido);
          const rSn = normalizeTextForCompare(row.segundo_nombre || '');
          const rSa = normalizeTextForCompare(row.segundo_apellido || '');

          const baseMatch = rPn === pn && rPa === pa;
          if (!baseMatch) return false;
          if (sn && rSn && sn !== rSn) return false;
          if (sa && rSa && sa !== rSa) return false;
          return true;
        });

        setNameDuplicates(matches);
      } catch {
        if (!cancelled) setNameDuplicates([]);
      } finally {
        if (!cancelled) setCheckingNames(false);
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [formData.primer_nombre, formData.segundo_nombre, formData.primer_apellido, formData.segundo_apellido]);

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

  const handleAgeChange = (esMayor: boolean) => {
    setEsMayorDeEdad(esMayor);
    if (!esMayor) {
      setFormData(prev => ({
        ...prev,
        cargo_institucional: 'Aspirante a Socorrista',
        dui: tieneCarnetMinoridad ? prev.dui : 'Menor de edad'
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        cargo_institucional: prev.cargo_institucional === 'Aspirante a Socorrista' ? '' : prev.cargo_institucional,
        dui: prev.dui === 'Menor de edad' ? '' : prev.dui
      }));
    }
  };

  const handleCarnetMinoridadChange = (tiene: boolean) => {
    setTieneCarnetMinoridad(tiene);
    if (!tiene) {
      setFormData(prev => ({ ...prev, dui: 'Menor de edad' }));
    } else {
      setFormData(prev => ({ ...prev, dui: '' }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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
    setFormData({ ...formData, [name]: value });
  };

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageToCrop(reader.result as string);
        setShowCropper(true);
      });
      reader.readAsDataURL(file);
    }
  };

  const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<Blob> => {
    const image = new Image();
    image.src = imageSrc;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('No 2d context');

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) reject(new Error('Canvas is empty'));
        else resolve(blob);
      }, 'image/jpeg');
    });
  };

  const handleCropSave = async () => {
    if (imageToCrop && croppedAreaPixels) {
      try {
        const croppedBlob = await getCroppedImg(imageToCrop, croppedAreaPixels);
        const croppedFile = new File([croppedBlob], 'photo.jpg', { type: 'image/jpeg' });
        setFoto(croppedFile);
        setFotoPreview(URL.createObjectURL(croppedBlob));
        setShowCropper(false);
      } catch (e) {
        console.error('Error cropping image:', e);
      }
    }
  };

  const generateCarnet = async (primer_nombre: string, primer_apellido: string) => {
    const { data, error } = await supabase
      .from('socorristas')
      .select('carnet');

    let maxNum = 0;
    if (data && data.length > 0) {
      for (const row of data) {
        if (row.carnet) {
          const parts = row.carnet.split('-');
          if (parts.length === 3) {
            const num = parseInt(parts[1], 10);
            if (!isNaN(num) && num > maxNum) {
              maxNum = num;
            }
          }
        }
      }
    }
    const nextNum = maxNum + 1;
    const numStr = nextNum.toString().padStart(4, '0');
    const initials = ((primer_nombre || '').charAt(0) + (primer_apellido || '').charAt(0)).toUpperCase();
    return `CVS-${numStr}-${initials}`;
  };

  // Consultar ocupantes de Director y Subdirector de la seccional elegida
  useEffect(() => {
    if (!formData.seccional_id) {
      setSeccionalOccupants({ director: null, subdirector: null, loading: false });
      return;
    }
    const checkOccupants = async () => {
      setSeccionalOccupants(prev => ({ ...prev, loading: true }));
      const targetSecId = parseInt(formData.seccional_id, 10);
      try {
        let dir: string | null = null;
        let subdir: string | null = null;

        const { data, error } = await supabase
          .from('socorristas')
          .select('id, primer_nombre, primer_apellido, segundo_cargo_administrativo')
          .eq('seccional_id', targetSecId)
          .eq('estado', 'Activo')
          .in('segundo_cargo_administrativo', ['Director de Seccional', 'Subdirector de Seccional']);

        if (!error && data) {
          data.forEach(s => {
            const fullName = `${s.primer_nombre} ${s.primer_apellido}`.trim();
            if (s.segundo_cargo_administrativo === 'Director de Seccional') {
              dir = fullName;
            } else if (s.segundo_cargo_administrativo === 'Subdirector de Seccional') {
              subdir = fullName;
            }
          });
        } else {
          // Fallback a consultar tabla seccionales si segundo_cargo_administrativo aún no está en Supabase
          const { data: secc } = await supabase
            .from('seccionales')
            .select('director, subdirector')
            .eq('id', targetSecId)
            .maybeSingle();

          if (secc) {
            dir = secc.director || null;
            subdir = secc.subdirector || null;
          }
        }

        setSeccionalOccupants({ director: dir, subdirector: subdir, loading: false });

        // Si el cargo seleccionado ya está ocupado en la nueva seccional, resetearlo
        setFormData(prev => {
          if (prev.segundo_cargo_administrativo === 'Director de Seccional' && dir) {
            return { ...prev, segundo_cargo_administrativo: '' };
          }
          if (prev.segundo_cargo_administrativo === 'Subdirector de Seccional' && subdir) {
            return { ...prev, segundo_cargo_administrativo: '' };
          }
          return prev;
        });
      } catch (err) {
        console.error('Error verificando cupos de seccional:', err);
        setSeccionalOccupants({ director: null, subdirector: null, loading: false });
      }
    };

    checkOccupants();
  }, [formData.seccional_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const requiredFields = ['primer_nombre', 'primer_apellido', 'fecha_nacimiento', 'sexo', 'dui', 'seccional_id', 'cargo_institucional'];
    const missingFields = requiredFields.filter(field => !formData[field as keyof typeof formData]);

    if (missingFields.length > 0) {
      setFormError(`Faltan campos obligatorios por completar: ${missingFields.join(', ')}.`);
      return;
    }

    const seccionalId = parseInt(formData.seccional_id, 10);
    if (isNaN(seccionalId)) {
      setFormError('La seccional seleccionada no es válida.');
      return;
    }

    // Strict check: user can only add into their permitted seccional(es)
    const allowedIds = getAddAllowedSocorristaSeccionalIds();
    if (allowedIds !== 'all' && !allowedIds.includes(seccionalId)) {
      setFormError('No tienes permisos para registrar elementos en la seccional seleccionada.');
      return;
    }

    if (nameDuplicates.length > 0 && !confirmHomonym) {
      setFormError('Se detectaron posibles coincidencias por nombre y apellido en la base de datos. Verifica el listado y marca la casilla de confirmación si es una persona distinta.');
      return;
    }

    setLoading(true);

    try {
      // Normalized duplicate check for DUI / Carnet de Minoridad across ALL seccionales
      const rawDui = formData.dui.trim();
      const normDui = normalizeDocumentForCompare(rawDui);
      if (rawDui.toLowerCase() !== 'menor de edad' && normDui) {
        const digitsOnly = rawDui.replace(/\D/g, '');
        let duiQuery = supabase
          .from('socorristas')
          .select('id, primer_nombre, primer_apellido, carnet, dui, seccionales(nombre)')
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
          setDuiDuplicates([matchedDui]);
          setFormError(
            `El documento ${rawDui} ya pertenece al elemento ${matchedDui.primer_nombre} ${matchedDui.primer_apellido} (Carnet: ${matchedDui.carnet || 'N/A'}${secNom ? `, Seccional: ${secNom}` : ''}). No se permiten registros duplicados.`
          );
          setLoading(false);
          return;
        }
      }

      if (formData.segundo_cargo_administrativo) {
        let conflictName: string | null = null;
        try {
          const { data: conflict, error: confErr } = await supabase
            .from('socorristas')
            .select('id, primer_nombre, primer_apellido')
            .eq('seccional_id', seccionalId)
            .eq('segundo_cargo_administrativo', formData.segundo_cargo_administrativo)
            .eq('estado', 'Activo')
            .limit(1);

          if (!confErr && conflict && conflict.length > 0) {
            conflictName = `${conflict[0].primer_nombre} ${conflict[0].primer_apellido}`.trim();
          } else if (confErr) {
            const { data: secc } = await supabase
              .from('seccionales')
              .select('director, subdirector')
              .eq('id', seccionalId)
              .maybeSingle();
            if (formData.segundo_cargo_administrativo === 'Director de Seccional' && secc?.director) {
              conflictName = secc.director;
            } else if (formData.segundo_cargo_administrativo === 'Subdirector de Seccional' && secc?.subdirector) {
              conflictName = secc.subdirector;
            }
          }
        } catch (err) {
          console.warn('Error verificando cupo previo:', err);
        }

        if (conflictName) {
          setFormError(`La plaza de "${formData.segundo_cargo_administrativo}" en esta seccional ya está ocupada por ${conflictName}. Solo se permite un cupo activo por seccional.`);
          setLoading(false);
          return;
        }
      }

      if (incluirFichaKycAhora) {
        const extraValidation = validateOnlyExtraKycFields(extraKycData);
        const missingAll = [...extraValidation.missingFields];
        if (!formData.direccion.trim()) {
          missingAll.unshift('Dirección principal');
        }
        if (missingAll.length > 0) {
          setFormError(
            `Elegiste completar la ficha «Conoce a tu Socorrista» en este momento. Faltan los siguientes campos requeridos: ${missingAll.join(', ')}. (Si prefieres guardarlos más adelante, selecciona "Hacerlo después").`
          );
          setLoading(false);
          return;
        }
      }

      // Todos los datos validados: abrir modal de verificación de seguridad antes de guardar
      setLoading(false);
      setShowSaveConfirmModal(true);
    } catch (error: any) {
      console.error('Error en validación previa:', error);
      setFormError(error.message || 'Error al validar los datos.');
      setLoading(false);
    }
  };

  const executeCreateSocorrista = async () => {
    setFormError(null);
    setLoading(true);
    try {
      const seccionalId = parseInt(formData.seccional_id, 10);
      if (isNaN(seccionalId)) {
        setFormError('La seccional seleccionada no es válida.');
        setShowSaveConfirmModal(false);
        setLoading(false);
        return;
      }

      let foto_url = null;
      if (foto) {
        const optimizedFoto = await optimizeImageForUpload(foto, {
          profile: 'carnet',
          modulo: 'socorristas',
          bucketId: 'socorristas',
        });
        const ext = getExtensionFromFile(optimizedFoto, 'jpg');
        const fileName = `${Date.now()}_photo.${ext}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('socorristas')
          .upload(filePath, optimizedFoto, {
            contentType: optimizedFoto.type || undefined,
          });

        if (uploadError) {
          throw new Error(`Error al subir la foto: ${uploadError.message}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('socorristas')
          .getPublicUrl(filePath);

        foto_url = publicUrl;
      }

      const cleanPrimerNombre = formData.primer_nombre.trim().toUpperCase();
      const cleanSegundoNombre = formData.segundo_nombre.trim().toUpperCase();
      const cleanPrimerApellido = formData.primer_apellido.trim().toUpperCase();
      const cleanSegundoApellido = formData.segundo_apellido.trim().toUpperCase();

      const carnet = await generateCarnet(cleanPrimerNombre, cleanPrimerApellido);

      const { data: maxIdData } = await supabase
        .from('socorristas')
        .select('id')
        .order('id', { ascending: false })
        .limit(1);

      let nextId = undefined;
      if (maxIdData && maxIdData.length > 0 && typeof maxIdData[0].id === 'number') {
        nextId = maxIdData[0].id + 1;
      }

      const { tiene_licencia_vehiculo, tiene_licencia_moto, ...restFormData } = formData;

      const cleanEmergenciaTel1 = composePhoneWithCountry(emergenciaCountryCode1, restFormData.contacto_emergencia_telefono);
      const cleanEmergenciaTel2 = composePhoneWithCountry(emergenciaCountryCode2, restFormData.contacto_emergencia_telefono_2);

      const insertData = {
        ...(nextId ? { id: nextId } : {}),
        ...restFormData,
        primer_nombre: cleanPrimerNombre,
        segundo_nombre: cleanSegundoNombre,
        primer_apellido: cleanPrimerApellido,
        segundo_apellido: cleanSegundoApellido,
        contacto_emergencia_telefono: cleanEmergenciaTel1,
        contacto_emergencia_telefono_2: cleanEmergenciaTel2,
        cargos_secundarios: cargosSecundarios,
        licencia_vehiculo_numero: tiene_licencia_vehiculo ? restFormData.licencia_vehiculo_numero : null,
        licencia_vehiculo_clase: tiene_licencia_vehiculo ? restFormData.licencia_vehiculo_clase : null,
        licencia_vehiculo_vencimiento: tiene_licencia_vehiculo && restFormData.licencia_vehiculo_vencimiento ? restFormData.licencia_vehiculo_vencimiento : null,
        licencia_moto_numero: tiene_licencia_moto ? restFormData.licencia_moto_numero : null,
        licencia_moto_vencimiento: tiene_licencia_moto && restFormData.licencia_moto_vencimiento ? restFormData.licencia_moto_vencimiento : null,
        fecha_ingreso: restFormData.fecha_ingreso || null,
        seccional_id: seccionalId,
        carnet,
        foto_url,
        estado: 'Activo'
      };

      let insertedRecord: any = null;
      const { data, error } = await supabase
        .from('socorristas')
        .insert([insertData])
        .select();

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
            ...fallbackData
          } = insertData;
          const { data: retryData, error: retryError } = await supabase
            .from('socorristas')
            .insert([fallbackData])
            .select();
          if (retryError) {
            throw new Error(`Error de base de datos: ${retryError.message} (Código: ${retryError.code})`);
          }
          insertedRecord = retryData?.[0];
        } else {
          throw new Error(`Error de base de datos: ${error.message} (Código: ${error.code})`);
        }
      } else if (data && data.length > 0) {
        insertedRecord = data[0];
      }

      if (insertedRecord && cargosSecundarios.length > 0) {
        await saveSocorristaCargosSecundariosFallback(insertedRecord.id, cargosSecundarios);
      }

      if (insertedRecord && (cleanEmergenciaTel1 || cleanEmergenciaTel2)) {
        try {
          const emergenciaData = {
            contacto_emergencia_nombre: formData.contacto_emergencia_nombre || '',
            contacto_emergencia_telefono: cleanEmergenciaTel1,
            contacto_emergencia_nombre_2: formData.contacto_emergencia_nombre_2 || '',
            contacto_emergencia_telefono_2: cleanEmergenciaTel2,
            created_at: getElSalvadorIsoTimestamp()
          };
          await supabase
            .from('configuracion')
            .upsert({ clave: `socorrista_emergencia_${insertedRecord.id}`, valor: JSON.stringify(emergenciaData) }, { onConflict: 'clave' });
        } catch (confErr) {
          console.warn('Error guardando contacto de emergencia en configuracion:', confErr);
        }
      }

      if (insertedRecord) {
        const hasAnyExtraKycInput =
          incluirFichaKycAhora ||
          Boolean(
            extraKycData.nit.trim() ||
              extraKycData.estado_civil.trim() ||
              extraKycData.nombre_conyuge.trim() ||
              extraKycData.nombre_dependientes.trim() ||
              extraKycData.profesion_ocupacion.trim() ||
              extraKycData.direccion_domicilio.trim() ||
              extraKycData.cargo_publico_ultimos_5_anios !== null
          );

        if (hasAnyExtraKycInput) {
          await saveSocorristaKycData(insertedRecord.id, extraKycData);
        }

        try {
          const fullName = `${cleanPrimerNombre} ${cleanPrimerApellido}`.trim();
          if (formData.segundo_cargo_administrativo === 'Director de Seccional') {
            await supabase.from('seccionales').update({ director: fullName }).eq('id', seccionalId);
          } else if (formData.segundo_cargo_administrativo === 'Subdirector de Seccional') {
            await supabase.from('seccionales').update({ subdirector: fullName }).eq('id', seccionalId);
          }
        } catch (seccErr) {
          console.warn('Error actualizando seccionales:', seccErr);
        }

        setSuccessMessage('Elemento agregado con éxito');
        setShowSaveConfirmModal(false);

        await logActivity('Creó socorrista', 'Socorrista', insertedRecord.id, {
          nombre: `${cleanPrimerNombre} ${cleanPrimerApellido}`,
          carnet: carnet
        });

        setTimeout(() => {
          navigate(`/socorristas/${insertedRecord.id}`);
        }, 1600);
      } else {
        throw new Error('La base de datos no devolvió el registro creado. Verifique si se guardó correctamente.');
      }
    } catch (error: any) {
      console.error('ERROR CRÍTICO EN SUBMIT:', error);
      setShowSaveConfirmModal(false);
      setFormError(error.message || 'Error al guardar el registro. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const allowedAddIds = getAddAllowedSocorristaSeccionalIds();
  const isSingleLockedSeccional = allowedAddIds !== 'all' && seccionales.length === 1;

  if (!authLoading && seccionalesLoaded && (!canAddAnySocorrista || seccionales.length === 0)) {
    return (
      <div className="max-w-xl mx-auto mt-10 bg-white rounded-2xl border border-rose-200 shadow-sm p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Sin permisos para agregar elementos</h2>
        <p className="text-sm text-slate-600">
          Tu perfil actual no cuenta con seccionales habilitadas para registrar nuevos elementos. Solicita a un administrador habilitar la seccional correspondiente en Accesos.
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
    <div className="max-w-3xl mx-auto space-y-6">
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2 animate-bounce">
          <Check className="h-5 w-5" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {showCropper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl overflow-hidden flex flex-col h-[80vh]">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-medium">Recortar Fotografía</h3>
              <button onClick={() => setShowCropper(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="relative flex-1 bg-gray-200">
              <Cropper
                image={imageToCrop || ''}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            <div className="p-4 border-t space-y-4">
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-500">Zoom</span>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCropper(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCropSave}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-hover"
                >
                  Aplicar Recorte
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">Registro de Nuevo Elemento</h1>
        </div>
      </div>

      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
        {formError && (
          <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-sm flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Revisa los datos antes de continuar</p>
                <p className="text-xs text-rose-800 mt-0.5">{formError}</p>
              </div>
            </div>
            <button type="button" onClick={() => setFormError(null)} className="text-rose-500 hover:text-rose-700 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8 divide-y divide-gray-200">
          <div className="space-y-6 sm:space-y-5">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">Información Personal</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Complete los datos del nuevo socorrista. El carnet se generará automáticamente.
              </p>
            </div>

            <div className="space-y-6 sm:space-y-5">
              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">
                  Fotografía
                </label>
                <div className="mt-1 sm:mt-0 sm:col-span-2">
                  <div className="max-w-lg flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-primary transition-colors overflow-hidden">
                    {fotoPreview ? (
                      <div className="relative group">
                        <img src={fotoPreview} alt="Preview" className="h-32 w-32 rounded-full object-cover border-2 border-primary" />
                        <button 
                          type="button"
                          onClick={() => {
                            setFoto(null);
                            setFotoPreview(null);
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2 text-center">
                        <Camera className="mx-auto h-10 w-10 text-gray-400" />
                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={() => setShowPhotoModal(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                          >
                            <Camera className="w-4 h-4" />
                            Tomar Foto (Máscara Pasaporte) o Subir Archivo
                          </button>
                        </div>
                        <p className="text-xs text-gray-500">Se mostrarán los lineamientos oficiales de fotografía antes de capturar</p>
                      </div>
                    )}
                  </div>
                  <CarnetPhotoCaptureModal
                    isOpen={showPhotoModal}
                    onClose={() => setShowPhotoModal(false)}
                    onPhotoReady={(file, previewUrl) => {
                      setFoto(file);
                      setFotoPreview(previewUrl);
                    }}
                    title="Fotografía del Nuevo Elemento"
                  />
                </div>
              </div>

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">Nombres <span className="text-red-500">*</span></label>
                <div className="mt-1 sm:mt-0 sm:col-span-2 space-y-2.5">
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2 max-w-xl">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Importante:</strong> Los campos de nombres y apellidos deben llenarse <strong>tal cual el nombre completo aparece en el DUI o Documento de Identidad</strong> (sin abreviaturas).
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" name="primer_nombre" required value={formData.primer_nombre} onChange={handleChange} placeholder="PRIMER NOMBRE" className="max-w-lg block w-full shadow-sm focus:ring-primary focus:border-primary sm:max-w-xs sm:text-sm border-gray-300 rounded-md border p-2 uppercase" />
                    <input type="text" name="segundo_nombre" value={formData.segundo_nombre} onChange={handleChange} placeholder="SEGUNDO NOMBRE" className="max-w-lg block w-full shadow-sm focus:ring-primary focus:border-primary sm:max-w-xs sm:text-sm border-gray-300 rounded-md border p-2 uppercase" />
                  </div>
                </div>
              </div>

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">Apellidos <span className="text-red-500">*</span></label>
                <div className="mt-1 sm:mt-0 sm:col-span-2 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" name="primer_apellido" required value={formData.primer_apellido} onChange={handleChange} placeholder="PRIMER APELLIDO" className="max-w-lg block w-full shadow-sm focus:ring-primary focus:border-primary sm:max-w-xs sm:text-sm border-gray-300 rounded-md border p-2 uppercase" />
                    <input type="text" name="segundo_apellido" value={formData.segundo_apellido} onChange={handleChange} placeholder="SEGUNDO APELLIDO" className="max-w-lg block w-full shadow-sm focus:ring-primary focus:border-primary sm:max-w-xs sm:text-sm border-gray-300 rounded-md border p-2 uppercase" />
                  </div>

                  {checkingNames && (
                    <p className="text-xs text-slate-500">Verificando coincidencias de nombre en todas las seccionales...</p>
                  )}

                  {nameDuplicates.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 space-y-2.5 max-w-xl">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-amber-900">
                            Posible elemento duplicado encontrado ({nameDuplicates.length} {nameDuplicates.length === 1 ? 'coincidencia' : 'coincidencias'} en el sistema)
                          </p>
                          <p className="text-[11px] text-amber-800">
                            Verifica que no esté registrado previamente en otra o la misma seccional:
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {nameDuplicates.map((m: any) => {
                          const secName = Array.isArray(m.seccionales)
                            ? m.seccionales[0]?.nombre
                            : m.seccionales?.nombre;
                          return (
                            <div
                              key={m.id}
                              className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-amber-200 text-xs"
                            >
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 truncate">
                                  {[m.primer_nombre, m.segundo_nombre, m.primer_apellido, m.segundo_apellido]
                                    .filter(Boolean)
                                    .join(' ')}
                                </p>
                                <p className="text-[11px] text-slate-600">
                                  Carnet: <span className="font-mono font-semibold">{m.carnet || 'N/A'}</span> • DUI: {m.dui || 'N/A'} • Seccional: <strong>{secName || 'N/A'}</strong> ({m.estado})
                                </p>
                              </div>
                              <Link
                                to={`/socorristas/${m.id}`}
                                target="_blank"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold text-[11px] shrink-0"
                              >
                                Ver ficha <ExternalLink className="w-3 h-3" />
                              </Link>
                            </div>
                          );
                        })}
                      </div>

                      <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={confirmHomonym}
                          onChange={(e) => setConfirmHomonym(e.target.checked)}
                          className="mt-0.5 h-4 w-4 text-amber-600 border-amber-400 rounded focus:ring-amber-500"
                        />
                        <span className="text-xs font-semibold text-amber-950">
                          Confirmo que revisé el listado y se trata de una persona distinta (homónimo).
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">Fecha de Nacimiento <span className="text-red-500">*</span></label>
                <div className="mt-1 sm:mt-0 sm:col-span-2">
                  <DateInput name="fecha_nacimiento" required maxDate={maxDateStr} value={formData.fecha_nacimiento} onChange={(val) => setFormData(p => ({...p, fecha_nacimiento: val}))} className="max-w-lg block w-full shadow-sm focus:ring-primary focus:border-primary sm:max-w-xs sm:text-sm border-gray-300 rounded-md border p-2" />
                  <p className="mt-1 text-xs text-gray-500">Mínimo 15 años de edad.</p>
                </div>
              </div>

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">Sexo <span className="text-red-500">*</span></label>
                <div className="mt-1 sm:mt-0 sm:col-span-2">
                  <select name="sexo" required value={formData.sexo} onChange={handleChange} className="max-w-lg block w-full shadow-sm focus:ring-primary focus:border-primary sm:max-w-xs sm:text-sm border-gray-300 rounded-md border p-2">
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                  </select>
                </div>
              </div>

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">Teléfono</label>
                <div className="mt-1 sm:mt-0 sm:col-span-2 flex space-x-2">
                  <select 
                    value={countryCode} 
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="block w-24 shadow-sm focus:ring-primary focus:border-primary sm:text-sm border-gray-300 rounded-md border p-2"
                  >
                    {countries.map(c => (
                      <option key={c.code} value={c.code}>{c.code} ({c.name})</option>
                    ))}
                  </select>
                  <input type="tel" name="telefono" value={formData.telefono} onChange={handleChange} placeholder={countries.find(c => c.code === countryCode)?.mask} className="max-w-lg block w-full shadow-sm focus:ring-primary focus:border-primary sm:max-w-xs sm:text-sm border-gray-300 rounded-md border p-2" />
                </div>
              </div>

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">Tipo de Sangre</label>
                <div className="mt-1 sm:mt-0 sm:col-span-2">
                  <select name="tipo_sangre" value={formData.tipo_sangre} onChange={handleChange} className="max-w-lg block w-full shadow-sm focus:ring-primary focus:border-primary sm:max-w-xs sm:text-sm border-gray-300 rounded-md border p-2">
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

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">Correo Electrónico</label>
                <div className="mt-1 sm:mt-0 sm:col-span-2">
                  <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="ejemplo@cruzverdesv.org" className="max-w-lg block w-full shadow-sm focus:ring-primary focus:border-primary sm:max-w-xs sm:text-sm border-gray-300 rounded-md border p-2" />
                </div>
              </div>

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">¿Es Motorista Autorizado?</label>
                <div className="mt-1 sm:mt-0 sm:col-span-2 flex items-center h-full">
                  <input 
                    type="checkbox" 
                    name="motorista_autorizado" 
                    checked={formData.motorista_autorizado} 
                    onChange={(e) => setFormData(prev => ({ ...prev, motorista_autorizado: e.target.checked }))} 
                    disabled={role !== 'admin' && role !== 'director' && !permissions.add_socorristas && !permissions.edit_socorristas}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded disabled:opacity-50" 
                  />
                  <span className="ml-2 text-sm text-gray-500">Marcar si tiene autorización de manejar ambulancias / vehículos institucionales.</span>
                </div>
              </div>

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">Licencias de Conducir</label>
                <div className="mt-1 sm:mt-0 sm:col-span-2 space-y-4">
                  <div>
                    <label className="flex items-center">
                      <input 
                        type="checkbox" 
                        name="tiene_licencia_vehiculo" 
                        checked={formData.tiene_licencia_vehiculo} 
                        onChange={(e) => setFormData(prev => ({ ...prev, tiene_licencia_vehiculo: e.target.checked }))} 
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded" 
                      />
                      <span className="ml-2 text-sm text-gray-700">Tiene licencia de vehículo</span>
                    </label>
                    {formData.tiene_licencia_vehiculo && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 p-4 rounded border">
                        <div>
                          <label className="block text-xs font-medium text-gray-700">Número</label>
                          <input 
                            type="text" 
                            name="licencia_vehiculo_numero" 
                            value={formData.licencia_vehiculo_numero} 
                            onChange={handleChange} 
                            placeholder="00000000-0"
                            className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700">Clase</label>
                          <select 
                            name="licencia_vehiculo_clase" 
                            value={formData.licencia_vehiculo_clase} 
                            onChange={handleChange}
                            className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
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
                            value={formData.licencia_vehiculo_vencimiento} 
                            onChange={(val) => setFormData(p => ({...p, licencia_vehiculo_vencimiento: val}))} 
                            className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border" 
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
                        checked={formData.tiene_licencia_moto} 
                        onChange={(e) => setFormData(prev => ({ ...prev, tiene_licencia_moto: e.target.checked }))} 
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded" 
                      />
                      <span className="ml-2 text-sm text-gray-700">Tiene licencia de motocicleta</span>
                    </label>
                    {formData.tiene_licencia_moto && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded border">
                        <div>
                          <label className="block text-xs font-medium text-gray-700">Número</label>
                          <input 
                            type="text" 
                            name="licencia_moto_numero" 
                            value={formData.licencia_moto_numero} 
                            onChange={handleChange} 
                            placeholder="00000000-0"
                            className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700">Vencimiento</label>
                          <DateInput 
                            name="licencia_moto_vencimiento" 
                            value={formData.licencia_moto_vencimiento} 
                            onChange={(val) => setFormData(p => ({...p, licencia_moto_vencimiento: val}))} 
                            className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border" 
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">¿Es mayor de edad?</label>
                <div className="mt-1 sm:mt-0 sm:col-span-2 flex space-x-4">
                  <button
                    type="button"
                    onClick={() => handleAgeChange(true)}
                    className={`px-4 py-2 text-sm font-medium rounded-md border ${esMayorDeEdad ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                  >
                    Mayor de edad
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAgeChange(false)}
                    className={`px-4 py-2 text-sm font-medium rounded-md border ${!esMayorDeEdad ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                  >
                    Menor de edad
                  </button>
                </div>
              </div>

              {!esMayorDeEdad && (
                <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                  <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">¿Tiene carnet de minoridad?</label>
                  <div className="mt-1 sm:mt-0 sm:col-span-2 flex space-x-4">
                    <button
                      type="button"
                      onClick={() => handleCarnetMinoridadChange(true)}
                      className={`px-4 py-2 text-sm font-medium rounded-md border ${tieneCarnetMinoridad ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                    >
                      Sí
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCarnetMinoridadChange(false)}
                      className={`px-4 py-2 text-sm font-medium rounded-md border ${!tieneCarnetMinoridad ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                    >
                      No
                    </button>
                  </div>
                </div>
              )}

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">DUI / Carnet Minoridad <span className="text-red-500">*</span></label>
                <div className="mt-1 sm:mt-0 sm:col-span-2 space-y-2.5">
                  <input
                    type="text"
                    name="dui"
                    required
                    value={formData.dui}
                    onChange={handleChange}
                    placeholder={esMayorDeEdad ? "00000000-0" : "Ingrese carnet o 'Menor de edad'"}
                    maxLength={esMayorDeEdad ? 10 : 50}
                    disabled={!esMayorDeEdad && !tieneCarnetMinoridad}
                    className={`max-w-lg block w-full shadow-sm focus:ring-primary focus:border-primary sm:max-w-xs sm:text-sm border-gray-300 rounded-md border p-2 ${(!esMayorDeEdad && !tieneCarnetMinoridad) ? 'bg-gray-100 cursor-not-allowed' : ''} ${duiDuplicates.length > 0 ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/40' : ''}`}
                  />

                  {checkingDui && (
                    <p className="text-xs text-slate-500">Verificando documento en todas las seccionales...</p>
                  )}

                  {duiDuplicates.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 space-y-2 max-w-xl">
                      <div className="flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-rose-900">
                            Documento ya registrado en la institución (registro bloqueado)
                          </p>
                          <p className="text-[11px] text-rose-800">
                            Este número de DUI o carnet de minoridad ya pertenece a un elemento existente:
                          </p>
                        </div>
                      </div>
                      {duiDuplicates.map((m: any) => {
                        const secName = Array.isArray(m.seccionales)
                          ? m.seccionales[0]?.nombre
                          : m.seccionales?.nombre;
                        return (
                          <div
                            key={m.id}
                            className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-rose-200 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate">
                                {[m.primer_nombre, m.segundo_nombre, m.primer_apellido, m.segundo_apellido]
                                  .filter(Boolean)
                                  .join(' ')}
                              </p>
                              <p className="text-[11px] text-slate-600">
                                Carnet: <span className="font-mono font-semibold">{m.carnet || 'N/A'}</span> • Seccional: <strong>{secName || 'N/A'}</strong> • Estado: {m.estado}
                              </p>
                            </div>
                            <Link
                              to={`/socorristas/${m.id}`}
                              target="_blank"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-100 hover:bg-rose-200 text-rose-900 font-semibold text-[11px] shrink-0"
                            >
                              Ver ficha <ExternalLink className="w-3 h-3" />
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">Dirección</label>
                <div className="mt-1 sm:mt-0 sm:col-span-2">
                  <textarea name="direccion" rows={3} value={formData.direccion} onChange={handleChange} className="max-w-lg shadow-sm block w-full focus:ring-primary focus:border-primary sm:text-sm border border-gray-300 rounded-md p-2" />
                </div>
              </div>

              {/* Contactos de Emergencia (Máximo 2) */}
              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <div>
                  <label className="block text-sm font-medium text-gray-900 flex items-center">
                    <PhoneCall className="w-4 h-4 mr-1 text-red-600" />
                    Contactos de Emergencia
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Hasta 2 números telefónicos de familiares o tutores para contacto rápido ante emergencias o validación en carnet.
                  </p>
                </div>
                <div className="mt-1 sm:mt-0 sm:col-span-2 space-y-4 max-w-xl">
                  {/* Contacto 1 */}
                  <div className="p-3 bg-red-50/40 rounded-xl border border-red-200/80 space-y-3">
                    <span className="text-xs font-bold text-red-700 uppercase tracking-wide block">Contacto de Emergencia 1 (Principal)</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-2xs font-medium text-gray-700 mb-1">Nombre y Parentesco</label>
                        <input
                          type="text"
                          name="contacto_emergencia_nombre"
                          value={formData.contacto_emergencia_nombre}
                          onChange={handleChange}
                          placeholder="Ej. Ana Pérez (Madre)"
                          className="w-full shadow-2xs focus:ring-primary focus:border-primary text-xs border-gray-300 rounded-lg p-2 border bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-2xs font-medium text-gray-700 mb-1">
                          Código de País y Teléfono
                        </label>
                        <div className="flex space-x-1.5">
                          <select
                            aria-label="Código de país contacto emergencia 1"
                            value={emergenciaCountryCode1}
                            onChange={(e) => {
                              const nextCode = e.target.value;
                              setEmergenciaCountryCode1(nextCode);
                              setFormData(prev => ({
                                ...prev,
                                contacto_emergencia_telefono: formatPhoneWithMask(prev.contacto_emergencia_telefono, nextCode),
                              }));
                            }}
                            className="w-24 shrink-0 shadow-2xs focus:ring-primary focus:border-primary text-xs border-gray-300 rounded-lg p-2 border bg-white font-medium"
                          >
                            {COUNTRY_PHONE_CODES.map(c => (
                              <option key={c.code} value={c.code}>{c.code} ({c.name})</option>
                            ))}
                          </select>
                          <input
                            type="tel"
                            name="contacto_emergencia_telefono"
                            value={formData.contacto_emergencia_telefono}
                            onChange={handleChange}
                            placeholder={getCountryMask(emergenciaCountryCode1).placeholder}
                            className="w-full shadow-2xs focus:ring-primary focus:border-primary text-xs font-mono border-gray-300 rounded-lg p-2 border bg-white"
                          />
                        </div>
                        <span className="text-[10px] text-gray-500 mt-1 block">
                          Formato {getCountryMask(emergenciaCountryCode1).name}: {getCountryMask(emergenciaCountryCode1).placeholder}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Contacto 2 */}
                  <div className="p-3 bg-red-50/40 rounded-xl border border-red-200/80 space-y-3">
                    <span className="text-xs font-bold text-red-700 uppercase tracking-wide block">Contacto de Emergencia 2 (Opcional)</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-2xs font-medium text-gray-700 mb-1">Nombre y Parentesco</label>
                        <input
                          type="text"
                          name="contacto_emergencia_nombre_2"
                          value={formData.contacto_emergencia_nombre_2}
                          onChange={handleChange}
                          placeholder="Ej. Roberto Gómez (Hermano)"
                          className="w-full shadow-2xs focus:ring-primary focus:border-primary text-xs border-gray-300 rounded-lg p-2 border bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-2xs font-medium text-gray-700 mb-1">
                          Código de País y Teléfono
                        </label>
                        <div className="flex space-x-1.5">
                          <select
                            aria-label="Código de país contacto emergencia 2"
                            value={emergenciaCountryCode2}
                            onChange={(e) => {
                              const nextCode = e.target.value;
                              setEmergenciaCountryCode2(nextCode);
                              setFormData(prev => ({
                                ...prev,
                                contacto_emergencia_telefono_2: formatPhoneWithMask(prev.contacto_emergencia_telefono_2, nextCode),
                              }));
                            }}
                            className="w-24 shrink-0 shadow-2xs focus:ring-primary focus:border-primary text-xs border-gray-300 rounded-lg p-2 border bg-white font-medium"
                          >
                            {COUNTRY_PHONE_CODES.map(c => (
                              <option key={c.code} value={c.code}>{c.code} ({c.name})</option>
                            ))}
                          </select>
                          <input
                            type="tel"
                            name="contacto_emergencia_telefono_2"
                            value={formData.contacto_emergencia_telefono_2}
                            onChange={handleChange}
                            placeholder={getCountryMask(emergenciaCountryCode2).placeholder}
                            className="w-full shadow-2xs focus:ring-primary focus:border-primary text-xs font-mono border-gray-300 rounded-lg p-2 border bg-white"
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

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">Seccional <span className="text-red-500">*</span></label>
                <div className="mt-1 sm:mt-0 sm:col-span-2 space-y-1.5">
                  <select
                    disabled={isSingleLockedSeccional}
                    name="seccional_id"
                    required
                    value={formData.seccional_id}
                    onChange={handleChange}
                    className="max-w-lg block w-full shadow-sm focus:ring-primary focus:border-primary sm:max-w-xs sm:text-sm border-gray-300 rounded-md border p-2 disabled:bg-gray-100 disabled:text-gray-700 disabled:cursor-not-allowed"
                  >
                    {!isSingleLockedSeccional && <option value="">Seleccione una seccional</option>}
                    {seccionales.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                  {isSingleLockedSeccional ? (
                    <p className="text-xs text-emerald-700 flex items-center gap-1 font-medium">
                      <Lock className="w-3.5 h-3.5 shrink-0" />
                      Asignada automáticamente según tu seccional autorizada en Accesos.
                    </p>
                  ) : allowedAddIds !== 'all' && seccionales.length > 1 ? (
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 shrink-0" />
                      Mostrando únicamente las {seccionales.length} seccionales donde tienes permiso para registrar elementos.
                    </p>
                  ) : null}
                </div>
              </div>

              <CargosSelector
                layout="horizontal-rows"
                cargoPrincipal={formData.cargo_institucional}
                cargosSecundarios={cargosSecundarios}
                cargoAdministrativo={formData.cargo_administrativo}
                onChangePrincipal={(val) => setFormData((prev) => ({ ...prev, cargo_institucional: val }))}
                onChangeSecundarios={setCargosSecundarios}
                onChangeAdministrativo={(val) => setFormData((prev) => ({ ...prev, cargo_administrativo: val }))}
                disabledPrincipal={!esMayorDeEdad}
                minorNotice={!esMayorDeEdad ? 'Asignado automáticamente para menores de edad' : undefined}
              />

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">Segundo Cargo Administrativo</label>
                  <p className="text-xs text-gray-500 mt-1">Dirección de Seccional (1 cupo máximo por seccional)</p>
                </div>
                <div className="mt-1 sm:mt-0 sm:col-span-2 space-y-2">
                  <select
                    name="segundo_cargo_administrativo"
                    value={formData.segundo_cargo_administrativo}
                    onChange={handleChange}
                    className="max-w-lg block w-full shadow-sm focus:ring-primary focus:border-primary sm:max-w-xs sm:text-sm border-gray-300 rounded-md border p-2"
                  >
                    <option value="">Ninguno / Sin segundo cargo</option>
                    <option value="Director de Seccional" disabled={!!seccionalOccupants.director}>
                      Director de Seccional {seccionalOccupants.director ? `(Ocupado por: ${seccionalOccupants.director})` : '(Disponible)'}
                    </option>
                    <option value="Subdirector de Seccional" disabled={!!seccionalOccupants.subdirector}>
                      Subdirector de Seccional {seccionalOccupants.subdirector ? `(Ocupado por: ${seccionalOccupants.subdirector})` : '(Disponible)'}
                    </option>
                  </select>

                  {formData.seccional_id ? (
                    <div className="flex flex-wrap gap-2 pt-1 text-xs">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded border ${seccionalOccupants.director ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-green-50 text-green-800 border-green-200'}`}>
                        {seccionalOccupants.director ? `🔒 Director: ${seccionalOccupants.director}` : '✓ Cupo Director disponible'}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded border ${seccionalOccupants.subdirector ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-green-50 text-green-800 border-green-200'}`}>
                        {seccionalOccupants.subdirector ? `🔒 Subdirector: ${seccionalOccupants.subdirector}` : '✓ Cupo Subdirector disponible'}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic">Seleccione una seccional primero para verificar cupos disponibles.</p>
                  )}
                </div>
              </div>

              <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">Fecha de Ingreso</label>
                <div className="mt-1 sm:mt-0 sm:col-span-2">
                  <DateInput
                    name="fecha_ingreso"
                    required
                    value={formData.fecha_ingreso}
                    onChange={(val) => {
                      setFormData((p) => ({ ...p, fecha_ingreso: val }));
                      setExtraKycData((prev) =>
                        !prev.fecha_inicio_relacion_laboral || prev.fecha_inicio_relacion_laboral === formData.fecha_ingreso
                          ? { ...prev, fecha_inicio_relacion_laboral: val }
                          : prev
                      );
                    }}
                    className="max-w-lg block w-full shadow-sm focus:ring-primary focus:border-primary sm:max-w-xs sm:text-sm border-gray-300 rounded-md border p-2"
                  />
                </div>
              </div>

              {/* SECCIÓN OPCIONAL / DIFERIBLE: FICHA OFICIAL CONOCE A TU SOCORRISTA (CVSSOCC/FORM001) */}
              <div className="border-t border-gray-200 pt-6">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <FileCheck2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">
                          Información Adicional — Formulario «Conoce a tu Socorrista» (CVSSOCC/FORM001)
                        </h4>
                        <p className="text-xs text-slate-600 mt-0.5">
                          ¿Deseas agregar ahora los datos adicionales requeridos para imprimir la ficha oficial <strong>CVSSOCC/FORM001</strong> o prefieres completarlos después?
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIncluirFichaKycAhora(true);
                        setFormError(null);
                        setExtraKycData((prev) => ({
                          ...prev,
                          nacionalidad: prev.nacionalidad || 'Salvadoreña',
                          fecha_inicio_relacion_laboral:
                            prev.fecha_inicio_relacion_laboral || formData.fecha_ingreso || '',
                          direccion_domicilio: prev.direccion_domicilio || formData.direccion || '',
                        }));
                      }}
                      className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                        incluirFichaKycAhora
                          ? 'border-emerald-600 bg-white ring-2 ring-emerald-500/25 shadow-xs'
                          : 'border-slate-200 bg-white/80 hover:bg-white'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          incluirFichaKycAhora
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <FileCheck2 className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Agregar información adicional en este momento
                        </span>
                        <span className="text-[11px] text-slate-500 mt-0.5 block">
                          Muestra los campos de estado civil, cónyuge, dependientes, profesión, domicilio y declaración PEP para dejar lista su hoja imprimible.
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIncluirFichaKycAhora(false);
                        setFormError(null);
                      }}
                      className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                        !incluirFichaKycAhora
                          ? 'border-slate-800 bg-white ring-2 ring-slate-800/15 shadow-xs'
                          : 'border-slate-200 bg-white/80 hover:bg-white'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          !incluirFichaKycAhora
                            ? 'bg-slate-800 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Hacerlo después (Guardar solo registro principal)
                        </span>
                        <span className="text-[11px] text-slate-500 mt-0.5 block">
                          Guarda el elemento inmediatamente. Cuando necesites imprimir su ficha «Conoce a tu Socorrista», podrás llenarla desde su perfil.
                        </span>
                      </div>
                    </button>
                  </div>

                  {incluirFichaKycAhora && (
                    <div className="pt-3 border-t border-emerald-200/80 bg-white rounded-xl p-4 border">
                      <ConoceSocorristaFormFields
                        value={extraKycData}
                        onChange={setExtraKycData}
                        dui={formData.dui}
                        direccionBase={formData.direccion}
                        fechaIngresoBase={formData.fecha_ingreso}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-5">
            <div className="flex justify-end">
              <button type="button" onClick={() => navigate(-1)} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                Cancelar
              </button>
              <button type="submit" disabled={loading} className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50">
                <Save className="-ml-1 mr-2 h-5 w-5" />
                {loading ? 'Guardando...' : 'Guardar Elemento'}
              </button>
            </div>
          </div>
        </form>
      </div>

      <SocorristaConfirmModal
        isOpen={showSaveConfirmModal}
        mode="create"
        loading={loading}
        primerNombre={formData.primer_nombre}
        segundoNombre={formData.segundo_nombre}
        primerApellido={formData.primer_apellido}
        segundoApellido={formData.segundo_apellido}
        dui={formData.dui}
        seccionalNombre={
          seccionales.find((s) => String(s.id) === String(formData.seccional_id))?.nombre || ''
        }
        cargoInstitucional={formData.cargo_institucional}
        onClose={() => setShowSaveConfirmModal(false)}
        onConfirm={executeCreateSocorrista}
      />
    </div>
  );
}

