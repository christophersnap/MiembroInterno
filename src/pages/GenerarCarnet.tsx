import React, { useState, useEffect, useRef } from 'react';
import { Search, Upload, Save, Image as ImageIcon, Settings, Trash2, CheckCircle2, Plus, Type as TypeIcon, XCircle, Eye, Sliders, Shield, ChevronDown, ChevronUp, Check } from 'lucide-react';
import * as QRCode from 'qrcode';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';
import { generateSecureQrToken } from '../utils/qrSecurity';
import { getApiUrl } from '../lib/api';

import WatermarkImage from '../components/WatermarkImage';

export const VERIFICATION_FIELD_DEFINITIONS = [
  { id: 'foto', label: 'Fotografía Oficial' },
  { id: 'carnetId', label: 'Número de Carnet' },
  { id: 'nombre', label: 'Nombre Completo' },
  { id: 'cargoInstitucional', label: 'Cargo Institucional' },
  { id: 'cargoAdministrativo', label: 'Cargo Administrativo' },
  { id: 'seccional', label: 'Seccional' },
  { id: 'estado', label: 'Estado de Membresía' },
  { id: 'dui', label: 'Documento DUI' },
  { id: 'telefono', label: 'Teléfono de Contacto' },
  { id: 'email', label: 'Correo Electrónico' },
  { id: 'fechaNacimiento', label: 'Fecha de Nacimiento' },
  { id: 'fechaIngreso', label: 'Fecha de Ingreso' },
  { id: 'tipoSangre', label: 'Tipo de Sangre' },
  { id: 'motoristaAutorizado', label: 'Habilitación de Motorista' },
  { id: 'licencias', label: 'Licencias de Conducir' },
  { id: 'cursos', label: 'Cursos y Capacitaciones' },
  { id: 'carnetImagen', label: 'Fotografía del Carnet Físico' }
];

export const DEFAULT_VERIFICATION_FIELDS: Record<string, boolean> = {
  foto: true,
  carnetId: true,
  nombre: true,
  cargoInstitucional: true,
  cargoAdministrativo: true,
  seccional: true,
  estado: true,
  dui: true,
  telefono: true,
  email: true,
  fechaNacimiento: true,
  fechaIngreso: true,
  tipoSangre: true,
  motoristaAutorizado: true,
  licencias: true,
  cursos: true,
  carnetImagen: true
};

export default function GenerarCarnet() {
  const { role, watermarkEnabled, userName } = useAuth();
  const [socorristas, setSocorristas] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeccional, setFilterSeccional] = useState('Todas');
  const [filterHasPhoto, setFilterHasPhoto] = useState('Todos');
  const [filterSolicitud, setFilterSolicitud] = useState('Todos');
  const [selectedSocorrista, setSelectedSocorrista] = useState<any>(null);
  const [templateImage, setTemplateImage] = useState<HTMLImageElement | null>(null);
  const [currentTemplateUrl, setCurrentTemplateUrl] = useState<string | null>(null);
  const [loadedSocorristaAjustes, setLoadedSocorristaAjustes] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sortOrder, setSortOrder] = useState<'alphabetical' | 'carnet'>('alphabetical');
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Font customization state
  const [customFontName, setCustomFontName] = useState<string>('Arial');
  const [fontSizeNames, setFontSizeNames] = useState<number>(45);
  const [fontColorNames, setFontColorNames] = useState<string>('#000000');
  const [posNamesX, setPosNamesX] = useState<number>(50);
  const [posNamesY, setPosNamesY] = useState<number>(48);

  const [fontSizeLastNames, setFontSizeLastNames] = useState<number>(45);
  const [fontColorLastNames, setFontColorLastNames] = useState<string>('#000000');
  const [posLastNamesX, setPosLastNamesX] = useState<number>(50);
  const [posLastNamesY, setPosLastNamesY] = useState<number>(54);

  const [fontSizeCargo, setFontSizeCargo] = useState<number>(55);
  const [fontColorCargo, setFontColorCargo] = useState<string>('#FFFFFF');
  const [bgColorCargo, setBgColorCargo] = useState<string>('#000066');
  const [borderRadiusCargo, setBorderRadiusCargo] = useState<number>(20);
  const [posCargoX, setPosCargoX] = useState<number>(50);
  const [posCargoY, setPosCargoY] = useState<number>(57);

  const [fontSizeCargoAdmin, setFontSizeCargoAdmin] = useState<number>(30);
  const [fontColorCargoAdmin, setFontColorCargoAdmin] = useState<string>('#FFFFFF');
  const [bgColorCargoAdmin, setBgColorCargoAdmin] = useState<string>('#008000');
  const [borderRadiusCargoAdmin, setBorderRadiusCargoAdmin] = useState<number>(15);
  const [posCargoAdminX, setPosCargoAdminX] = useState<number>(50);
  const [posCargoAdminY, setPosCargoAdminY] = useState<number>(64);

  const [showBgCargo, setShowBgCargo] = useState<boolean>(true);
  const [bgCargoWidth, setBgCargoWidth] = useState<number>(75);
  const [bgCargoHeight, setBgCargoHeight] = useState<number>(80);
  
  const [showBgCargoAdmin, setShowBgCargoAdmin] = useState<boolean>(true);
  const [bgCargoAdminWidth, setBgCargoAdminWidth] = useState<number>(55);
  const [bgCargoAdminHeight, setBgCargoAdminHeight] = useState<number>(50);

  const [photoSize, setPhotoSize] = useState<number>(22);
  const [posPhotoX, setPosPhotoX] = useState<number>(50);
  const [posPhotoY, setPosPhotoY] = useState<number>(28);

  const [fontSizeSeccional, setFontSizeSeccional] = useState<number>(35);
  const [fontColorSeccional, setFontColorSeccional] = useState<string>('#008000');
  const [posSeccionalX, setPosSeccionalX] = useState<number>(18);
  const [posSeccionalY, setPosSeccionalY] = useState<number>(72);

  const [fontSizeDui, setFontSizeDui] = useState<number>(35);
  const [fontColorDui, setFontColorDui] = useState<string>('#008000');
  const [posDuiX, setPosDuiX] = useState<number>(18);
  const [posDuiY, setPosDuiY] = useState<number>(78);

  const [fontSizeCarnet, setFontSizeCarnet] = useState<number>(35);
  const [fontColorCarnet, setFontColorCarnet] = useState<string>('#008000');
  const [posCarnetX, setPosCarnetX] = useState<number>(18);
  const [posCarnetY, setPosCarnetY] = useState<number>(84);

  const [showMotorista, setShowMotorista] = useState<boolean>(true);
  const [fontSizeMotorista, setFontSizeMotorista] = useState<number>(32);
  const [fontColorMotorista, setFontColorMotorista] = useState<string>('#ffffff');
  const [posMotoristaX, setPosMotoristaX] = useState<number>(50);
  const [posMotoristaY, setPosMotoristaY] = useState<number>(88);
  const [showBgMotorista, setShowBgMotorista] = useState<boolean>(true);
  const [bgColorMotorista, setBgColorMotorista] = useState<string>('#008000');
  const [borderRadiusMotorista, setBorderRadiusMotorista] = useState<number>(8);
  const [bgMotoristaWidth, setBgMotoristaWidth] = useState<number>(55);
  const [bgMotoristaHeight, setBgMotoristaHeight] = useState<number>(48);

  // QR Code state
  const [showQR, setShowQR] = useState<boolean>(false);
  const [posQrX, setPosQrX] = useState<number>(80);
  const [posQrY, setPosQrY] = useState<number>(80);
  const [qrSize, setQrSize] = useState<number>(15);
  const [qrBaseUrl, setQrBaseUrl] = useState<string>('https://cruzverdesv.org/miembros');
  const [qrLinkFormat, setQrLinkFormat] = useState<string>('short');

  // Verification fields & mode state
  const [verificationMode, setVerificationMode] = useState<'system' | 'custom'>('system');
  const [systemVerificationFields, setSystemVerificationFields] = useState<Record<string, boolean>>(DEFAULT_VERIFICATION_FIELDS);
  const [verificationFields, setVerificationFields] = useState<Record<string, boolean>>(DEFAULT_VERIFICATION_FIELDS);

  // Presets, Templates, Fonts
  const [presets, setPresets] = useState<any[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<any[]>([]);
  const [templatesExpanded, setTemplatesExpanded] = useState<boolean>(true);
  const [previewSolicitudPhoto, setPreviewSolicitudPhoto] = useState<boolean>(false);
  const [approvingPhoto, setApprovingPhoto] = useState<boolean>(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | number | null>(null);
  const [savedFonts, setSavedFonts] = useState<any[]>([]);
  const [presetName, setPresetName] = useState('');
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showFontModal, setShowFontModal] = useState(false);

  useEffect(() => {
    fetchData();
    loadSupabaseData();
  }, []);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from('socorristas')
        .select('*, seccionales(nombre)')
        .eq('estado', 'Activo');
      
      if (error) throw error;

      let solicitudesMap: Record<number, any> = {};
      try {
        const { data: solData } = await supabase
          .from('solicitudes_carnet')
          .select('socorrista_id, fecha_solicitud, estado_solicitud, tipo_solicitud, foto_url, motivo')
          .eq('estado_solicitud', 'Pendiente')
          .order('fecha_solicitud', { ascending: false });
        
        if (solData) {
          solData.forEach(sol => {
            if (!solicitudesMap[sol.socorrista_id]) {
              solicitudesMap[sol.socorrista_id] = sol; // Get latest pendiente
            }
          });
        }
      } catch(e) {}

      // Fallback: consultar solicitudes guardadas en configuracion
      try {
        const { data: backupSols } = await supabase
          .from('configuracion')
          .select('clave, valor')
          .like('clave', 'solicitud_carnet_%');

        if (backupSols) {
          backupSols.forEach(row => {
            try {
              const sol = JSON.parse(row.valor);
              if (sol && sol.socorrista_id && sol.estado_solicitud === 'Pendiente' && !solicitudesMap[sol.socorrista_id]) {
                solicitudesMap[sol.socorrista_id] = { ...sol, backup_key: row.clave };
              }
            } catch (err) {}
          });
        }
      } catch (backupErr) {}
      
      const mappedData = (data || []).map(s => {
        let seccional_nombre = 'N/A';
        if (s.seccionales) {
          if (Array.isArray(s.seccionales)) {
            seccional_nombre = s.seccionales[0]?.nombre || 'N/A';
          } else {
            seccional_nombre = (s.seccionales as any).nombre || 'N/A';
          }
        }
        return {
          ...s,
          seccional_nombre,
          solicitud: solicitudesMap[s.id] || null
        };
      });

      // Si algún socorrista no tiene foto_url en Supabase, verificar si SQLite la tiene
      try {
        const apiRes = await fetch(getApiUrl('/api/socorristas'));
        if (apiRes.ok) {
          const apiSocorristas = await apiRes.json();
          if (Array.isArray(apiSocorristas)) {
            const apiMap = new Map(apiSocorristas.map((as: any) => [as.id, as]));
            mappedData.forEach(s => {
              const match: any = apiMap.get(s.id);
              if (match && !s.foto_url && match.foto_url) {
                s.foto_url = match.foto_url;
              }
            });
          }
        }
      } catch (apiErr) {}
      
      // Check if carnet_generado_url is missing from the first record (meaning column doesn't exist)
      if (mappedData.length > 0 && mappedData[0].carnet_generado_url === undefined) {
        try {
          const { data: logsData } = await supabase
            .from('activity_logs')
            .select('entity_id, details')
            .eq('entity_type', 'Socorrista')
            .eq('action', 'Generó carnet');
            
          if (logsData) {
            // Map logs to socorristas
            const generatedMap = new Map();
            logsData.forEach(log => {
              if (log.details && log.details.url) {
                generatedMap.set(log.entity_id, log.details.url);
              }
            });
            
            mappedData.forEach(s => {
              if (generatedMap.has(String(s.id))) {
                s.carnet_generado_url = generatedMap.get(String(s.id));
              }
            });
          }
        } catch (logErr) {
          console.error('Error fetching fallback logs:', logErr);
        }
      }
      
      setSocorristas(mappedData);
    } catch (err) {
      console.error(err);
    }
  };

  const loadSupabaseData = async () => {
    try {
      const { data: presetsData, error: presetsError } = await supabase.from('presets').select('*');
      if (presetsError) console.warn('Error loading presets:', presetsError);
      else if (presetsData) setPresets(presetsData);
    } catch (e) { console.warn(e); }

    try {
      const { data: templatesData, error: templatesError } = await supabase.from('templates').select('*');
      if (templatesError) console.warn('Error loading templates:', templatesError);
      else if (templatesData) setSavedTemplates(templatesData);
    } catch (e) { console.warn(e); }

    try {
      const { data: fontsData, error: fontsError } = await supabase.from('fonts').select('*');
      if (fontsError) console.warn('Error loading fonts:', fontsError);
      else if (fontsData) setSavedFonts(fontsData);
    } catch (e) { console.warn(e); }

    try {
      const { data: configRows } = await supabase.from('configuracion').select('clave, valor').in('clave', ['verificacion_fields', 'qr_base_url', 'qr_link_format']);
      if (configRows) {
        configRows.forEach(row => {
          if (row.clave === 'verificacion_fields' && row.valor) {
            try {
              const parsed = JSON.parse(row.valor);
              setSystemVerificationFields(parsed);
              setVerificationFields(parsed);
            } catch (e) {}
          }
          if (row.clave === 'qr_base_url' && row.valor) {
            setQrBaseUrl(row.valor);
          }
          if (row.clave === 'qr_link_format' && row.valor) {
            setQrLinkFormat(row.valor);
          }
        });
      }
    } catch (e) { console.warn(e); }

    try {
      const res = await fetch(getApiUrl('/api/configuracion'));
      if (res.ok) {
        const confObj = await res.json();
        if (confObj.verificacion_fields) {
          try {
            const parsed = typeof confObj.verificacion_fields === 'string' ? JSON.parse(confObj.verificacion_fields) : confObj.verificacion_fields;
            setSystemVerificationFields(parsed);
            setVerificationFields(parsed);
          } catch (e) {}
        }
        if (confObj.qr_base_url) setQrBaseUrl(confObj.qr_base_url);
        if (confObj.qr_link_format) setQrLinkFormat(confObj.qr_link_format);
      }
    } catch (e) {}
  };

  const saveVerificationConfig = async (fields: any) => {
    try {
      const { error } = await supabase
        .from('configuracion')
        .upsert({ clave: 'verificacion_fields', valor: JSON.stringify(fields) }, { onConflict: 'clave' });
      if (error) throw error;
    } catch (error) {
      console.error('Error saving verification config:', error);
    }
  };

  const savePreset = async (name: string) => {
    if (!name) return;
    const presetData = {
      fontSizeNames, fontColorNames, posNamesX, posNamesY,
      fontSizeLastNames, fontColorLastNames, posLastNamesX, posLastNamesY,
      fontSizeCargo, fontColorCargo, bgColorCargo, borderRadiusCargo, posCargoX, posCargoY, showBgCargo, bgCargoWidth, bgCargoHeight,
      fontSizeCargoAdmin, fontColorCargoAdmin, bgColorCargoAdmin, borderRadiusCargoAdmin, posCargoAdminX, posCargoAdminY, showBgCargoAdmin, bgCargoAdminWidth, bgCargoAdminHeight,
      fontSizeSeccional, fontColorSeccional, posSeccionalX, posSeccionalY,
      fontSizeDui, fontColorDui, posDuiX, posDuiY,
      fontSizeCarnet, fontColorCarnet, posCarnetX, posCarnetY,
      showMotorista, fontSizeMotorista, fontColorMotorista, posMotoristaX, posMotoristaY, showBgMotorista, bgColorMotorista, borderRadiusMotorista, bgMotoristaWidth, bgMotoristaHeight,
      qrSize, posQrX, posQrY,
      photoSize, posPhotoX, posPhotoY
    };

    try {
      // Fetch max ID to avoid sequence out of sync errors
      const { data: maxIdData } = await supabase
        .from('presets')
        .select('id')
        .order('id', { ascending: false })
        .limit(1);
        
      let nextId = undefined;
      if (maxIdData && maxIdData.length > 0 && typeof maxIdData[0].id === 'number') {
        nextId = maxIdData[0].id + 1;
      }

      const { data, error } = await supabase
        .from('presets')
        .insert({ ...(nextId ? { id: nextId } : {}), nombre: name, configuracion: presetData })
        .select();
      
      if (error) throw error;
      if (data) setPresets([...presets, data[0]]);
      setShowPresetModal(false);
      setPresetName('');
    } catch (error) {
      console.error('Error saving preset:', error);
      alert('Error al guardar el preset');
    }
  };

  const applyPreset = (preset: any) => {
    const config = preset.configuracion;
    setFontSizeNames(config.fontSizeNames);
    setFontColorNames(config.fontColorNames);
    setPosNamesX(config.posNamesX);
    setPosNamesY(config.posNamesY);
    setFontSizeLastNames(config.fontSizeLastNames);
    setFontColorLastNames(config.fontColorLastNames);
    setPosLastNamesX(config.posLastNamesX);
    setPosLastNamesY(config.posLastNamesY);
    setFontSizeCargo(config.fontSizeCargo);
    setFontColorCargo(config.fontColorCargo);
    setBgColorCargo(config.bgColorCargo);
    setBorderRadiusCargo(config.borderRadiusCargo);
    setPosCargoX(config.posCargoX);
    setPosCargoY(config.posCargoY);
    setShowBgCargo(config.showBgCargo);
    setBgCargoWidth(config.bgCargoWidth || 75);
    setBgCargoHeight(config.bgCargoHeight || 80);
    setFontSizeCargoAdmin(config.fontSizeCargoAdmin);
    setFontColorCargoAdmin(config.fontColorCargoAdmin);
    setBgColorCargoAdmin(config.bgColorCargoAdmin);
    setBorderRadiusCargoAdmin(config.borderRadiusCargoAdmin);
    setPosCargoAdminX(config.posCargoAdminX);
    setPosCargoAdminY(config.posCargoAdminY);
    setShowBgCargoAdmin(config.showBgCargoAdmin);
    setBgCargoAdminWidth(config.bgCargoAdminWidth || 55);
    setBgCargoAdminHeight(config.bgCargoAdminHeight || 50);
    setFontSizeSeccional(config.fontSizeSeccional || 35);
    setFontColorSeccional(config.fontColorSeccional || '#008000');
    setPosSeccionalX(config.posSeccionalX || 18);
    setPosSeccionalY(config.posSeccionalY || 72);
    setFontSizeDui(config.fontSizeDui || 35);
    setFontColorDui(config.fontColorDui || '#008000');
    setPosDuiX(config.posDuiX || 18);
    setPosDuiY(config.posDuiY || 78);
    setFontSizeCarnet(config.fontSizeCarnet || 35);
    setFontColorCarnet(config.fontColorCarnet || '#008000');
    setPosCarnetX(config.posCarnetX || 18);
    setPosCarnetY(config.posCarnetY || 84);
    setShowMotorista(config.showMotorista !== undefined ? config.showMotorista : true);
    setFontSizeMotorista(config.fontSizeMotorista || 32);
    setFontColorMotorista(config.fontColorMotorista || '#ffffff');
    setPosMotoristaX(config.posMotoristaX !== undefined ? config.posMotoristaX : 50);
    setPosMotoristaY(config.posMotoristaY !== undefined ? config.posMotoristaY : 88);
    setShowBgMotorista(config.showBgMotorista !== undefined ? config.showBgMotorista : true);
    setBgColorMotorista(config.bgColorMotorista || '#008000');
    setBorderRadiusMotorista(config.borderRadiusMotorista !== undefined ? config.borderRadiusMotorista : 8);
    setBgMotoristaWidth(config.bgMotoristaWidth || 55);
    setBgMotoristaHeight(config.bgMotoristaHeight || 48);
    setQrSize(config.qrSize);
    setPosQrX(config.posQrX);
    setPosQrY(config.posQrY);
    setPhotoSize(config.photoSize);
    setPosPhotoX(config.posPhotoX);
    setPosPhotoY(config.posPhotoY);
    setShowPresetModal(false);
  };

  // Carga y aplica todos los ajustes guardados de un carnet específico
  const applyAdjustments = (config: any) => {
    if (!config) return;
    if (config.customFontName) setCustomFontName(config.customFontName);
    if (config.fontSizeNames !== undefined) setFontSizeNames(config.fontSizeNames);
    if (config.fontColorNames) setFontColorNames(config.fontColorNames);
    if (config.posNamesX !== undefined) setPosNamesX(config.posNamesX);
    if (config.posNamesY !== undefined) setPosNamesY(config.posNamesY);

    if (config.fontSizeLastNames !== undefined) setFontSizeLastNames(config.fontSizeLastNames);
    if (config.fontColorLastNames) setFontColorLastNames(config.fontColorLastNames);
    if (config.posLastNamesX !== undefined) setPosLastNamesX(config.posLastNamesX);
    if (config.posLastNamesY !== undefined) setPosLastNamesY(config.posLastNamesY);

    if (config.fontSizeCargo !== undefined) setFontSizeCargo(config.fontSizeCargo);
    if (config.fontColorCargo) setFontColorCargo(config.fontColorCargo);
    if (config.bgColorCargo) setBgColorCargo(config.bgColorCargo);
    if (config.borderRadiusCargo !== undefined) setBorderRadiusCargo(config.borderRadiusCargo);
    if (config.posCargoX !== undefined) setPosCargoX(config.posCargoX);
    if (config.posCargoY !== undefined) setPosCargoY(config.posCargoY);
    if (config.showBgCargo !== undefined) setShowBgCargo(config.showBgCargo);
    if (config.bgCargoWidth !== undefined) setBgCargoWidth(config.bgCargoWidth);
    if (config.bgCargoHeight !== undefined) setBgCargoHeight(config.bgCargoHeight);

    if (config.fontSizeCargoAdmin !== undefined) setFontSizeCargoAdmin(config.fontSizeCargoAdmin);
    if (config.fontColorCargoAdmin) setFontColorCargoAdmin(config.fontColorCargoAdmin);
    if (config.bgColorCargoAdmin) setBgColorCargoAdmin(config.bgColorCargoAdmin);
    if (config.borderRadiusCargoAdmin !== undefined) setBorderRadiusCargoAdmin(config.borderRadiusCargoAdmin);
    if (config.posCargoAdminX !== undefined) setPosCargoAdminX(config.posCargoAdminX);
    if (config.posCargoAdminY !== undefined) setPosCargoAdminY(config.posCargoAdminY);
    if (config.showBgCargoAdmin !== undefined) setShowBgCargoAdmin(config.showBgCargoAdmin);
    if (config.bgCargoAdminWidth !== undefined) setBgCargoAdminWidth(config.bgCargoAdminWidth);
    if (config.bgCargoAdminHeight !== undefined) setBgCargoAdminHeight(config.bgCargoAdminHeight);

    if (config.fontSizeSeccional !== undefined) setFontSizeSeccional(config.fontSizeSeccional);
    if (config.fontColorSeccional) setFontColorSeccional(config.fontColorSeccional);
    if (config.posSeccionalX !== undefined) setPosSeccionalX(config.posSeccionalX);
    if (config.posSeccionalY !== undefined) setPosSeccionalY(config.posSeccionalY);

    if (config.fontSizeDui !== undefined) setFontSizeDui(config.fontSizeDui);
    if (config.fontColorDui) setFontColorDui(config.fontColorDui);
    if (config.posDuiX !== undefined) setPosDuiX(config.posDuiX);
    if (config.posDuiY !== undefined) setPosDuiY(config.posDuiY);

    if (config.fontSizeCarnet !== undefined) setFontSizeCarnet(config.fontSizeCarnet);
    if (config.fontColorCarnet) setFontColorCarnet(config.fontColorCarnet);
    if (config.posCarnetX !== undefined) setPosCarnetX(config.posCarnetX);
    if (config.posCarnetY !== undefined) setPosCarnetY(config.posCarnetY);

    if (config.showMotorista !== undefined) setShowMotorista(config.showMotorista);
    if (config.fontSizeMotorista !== undefined) setFontSizeMotorista(config.fontSizeMotorista);
    if (config.fontColorMotorista) setFontColorMotorista(config.fontColorMotorista);
    if (config.posMotoristaX !== undefined) setPosMotoristaX(config.posMotoristaX);
    if (config.posMotoristaY !== undefined) setPosMotoristaY(config.posMotoristaY);
    if (config.showBgMotorista !== undefined) setShowBgMotorista(config.showBgMotorista);
    if (config.bgColorMotorista) setBgColorMotorista(config.bgColorMotorista);
    if (config.borderRadiusMotorista !== undefined) setBorderRadiusMotorista(config.borderRadiusMotorista);
    if (config.bgMotoristaWidth !== undefined) setBgMotoristaWidth(config.bgMotoristaWidth);
    if (config.bgMotoristaHeight !== undefined) setBgMotoristaHeight(config.bgMotoristaHeight);

    if (config.qrSize !== undefined) setQrSize(config.qrSize);
    if (config.posQrX !== undefined) setPosQrX(config.posQrX);
    if (config.posQrY !== undefined) setPosQrY(config.posQrY);
    if (config.showQR !== undefined) setShowQR(config.showQR);
    if (config.photoSize !== undefined) setPhotoSize(config.photoSize);
    if (config.posPhotoX !== undefined) setPosPhotoX(config.posPhotoX);
    if (config.posPhotoY !== undefined) setPosPhotoY(config.posPhotoY);

    if (config.verificationMode) setVerificationMode(config.verificationMode);
    if (config.verificationFields) setVerificationFields(config.verificationFields);

    if (config.templateUrl) {
      setCurrentTemplateUrl(config.templateUrl);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => setTemplateImage(img);
      img.src = config.templateUrl;
    }
  };

  // Al seleccionar un socorrista, cargar todos los ajustes que se realizaron previamente a su carnet
  const handleSelectSocorrista = async (socorrista: any) => {
    setSelectedSocorrista(socorrista);
    setPreviewSolicitudPhoto(false);
    setLoadedSocorristaAjustes(false);

    let loadedConfig: any = null;

    // 1. Consultar localStorage
    try {
      const local = localStorage.getItem(`carnet_ajustes_${socorrista.id}`);
      if (local) {
        loadedConfig = JSON.parse(local);
      }
    } catch (e) {}

    // 2. Consultar SQLite del backend
    try {
      const res = await fetch(getApiUrl('/api/configuracion'));
      if (res.ok) {
        const confObj = await res.json();
        const key = `carnet_ajustes_${socorrista.id}`;
        if (confObj[key]) {
          try {
            loadedConfig = JSON.parse(confObj[key]);
          } catch (e) {}
        }
      }
    } catch (e) {}

    // 3. Fallback a Supabase
    if (!loadedConfig) {
      try {
        const { data: row } = await supabase
          .from('configuracion')
          .select('valor')
          .eq('clave', `carnet_ajustes_${socorrista.id}`)
          .maybeSingle();
        if (row?.valor) {
          try {
            loadedConfig = JSON.parse(row.valor);
          } catch (e) {}
        }
      } catch (e) {}
    }

    if (loadedConfig) {
      applyAdjustments(loadedConfig);
      setLoadedSocorristaAjustes(true);
    }
  };

  const deletePreset = async (id: string) => {
    try {
      const { error } = await supabase
        .from('presets')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setPresets(presets.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting preset:', error);
    }
  };

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => setTemplateImage(img);
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);

      // Save to Supabase
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `templates/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('assets')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('assets')
          .getPublicUrl(filePath);

        // Fetch max ID to avoid sequence out of sync errors
        const { data: maxIdData } = await supabase
          .from('templates')
          .select('id')
          .order('id', { ascending: false })
          .limit(1);
          
        let nextId = undefined;
        if (maxIdData && maxIdData.length > 0 && typeof maxIdData[0].id === 'number') {
          nextId = maxIdData[0].id + 1;
        }

        const { data, error: dbError } = await supabase
          .from('templates')
          .insert({ ...(nextId ? { id: nextId } : {}), nombre: file.name, url: publicUrl })
          .select();

        if (dbError) throw dbError;
        setCurrentTemplateUrl(publicUrl);
        if (data) setSavedTemplates([...savedTemplates, data[0]]);
      } catch (error) {
        console.error('Error uploading template:', error);
      }
    }
  };

  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fontName = file.name.split('.')[0];
      const reader = new FileReader();
      reader.onload = async (event) => {
        const fontData = event.target?.result as ArrayBuffer;
        const fontFace = new FontFace(fontName, fontData);
        try {
          const loadedFace = await fontFace.load();
          document.fonts.add(loadedFace);
          setCustomFontName(fontName);
          
          // Save to Supabase
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `fonts/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('assets')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('assets')
            .getPublicUrl(filePath);

          // Fetch max ID to avoid sequence out of sync errors
          const { data: maxIdData } = await supabase
            .from('fonts')
            .select('id')
            .order('id', { ascending: false })
            .limit(1);
            
          let nextId = undefined;
          if (maxIdData && maxIdData.length > 0 && typeof maxIdData[0].id === 'number') {
            nextId = maxIdData[0].id + 1;
          }

          const { data, error: dbError } = await supabase
            .from('fonts')
            .insert({ ...(nextId ? { id: nextId } : {}), nombre: fontName, url: publicUrl })
            .select();

          if (dbError) throw dbError;
          if (data) setSavedFonts([...savedFonts, data[0]]);
        } catch (err) {
          console.error('Error loading font:', err);
          alert('Error al cargar la fuente');
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const loadSavedTemplate = (url: string) => {
    setCurrentTemplateUrl(url);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setTemplateImage(img);
    img.src = url;
  };

  const deleteSavedTemplate = async (templateId: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Deseas eliminar esta plantilla guardada del mosaico?')) return;
    setDeletingTemplateId(templateId);
    try {
      const { error } = await supabase.from('templates').delete().eq('id', templateId);
      if (error) throw error;
      setSavedTemplates(prev => prev.filter(t => t.id !== templateId));
    } catch (err: any) {
      console.warn('Error eliminando plantilla:', err);
      setSavedTemplates(prev => prev.filter(t => t.id !== templateId));
    } finally {
      setDeletingTemplateId(null);
    }
  };

  const handleAprobarFotoSolicitud = async () => {
    if (!selectedSocorrista || !selectedSocorrista.solicitud?.foto_url) return;
    const newFoto = selectedSocorrista.solicitud.foto_url;
    
    if (!confirm(`¿Aprobar e incorporar esta nueva fotografía al perfil y carnet de ${selectedSocorrista.primer_nombre} ${selectedSocorrista.primer_apellido}?`)) return;

    setApprovingPhoto(true);
    try {
      // 1. Actualizar foto_url en socorristas (Supabase)
      const { error: supaErr } = await supabase
        .from('socorristas')
        .update({ foto_url: newFoto })
        .eq('id', selectedSocorrista.id);

      if (supaErr) console.warn('Aviso actualizando foto en Supabase:', supaErr);

      // 2. Actualizar foto_url en backend SQLite
      try {
        await fetch(getApiUrl(`/api/socorristas/${selectedSocorrista.id}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ foto_url: newFoto })
        });
      } catch (e) {}

      // 3. Marcar solicitud como 'Aprobada' en solicitudes_carnet
      try {
        await supabase
          .from('solicitudes_carnet')
          .update({ estado_solicitud: 'Aprobada' })
          .eq('socorrista_id', selectedSocorrista.id);
      } catch (e) {}

      // 4. Actualizar respaldo en configuracion si existe
      if (selectedSocorrista.solicitud.backup_key) {
        try {
          await supabase
            .from('configuracion')
            .delete()
            .eq('clave', selectedSocorrista.solicitud.backup_key);
        } catch (e) {}
      }

      // 5. Actualizar estado local inmediatamente
      const updatedSoc = {
        ...selectedSocorrista,
        foto_url: newFoto,
        solicitud: null
      };

      setSelectedSocorrista(updatedSoc);
      setPreviewSolicitudPhoto(false);

      // Actualizar en la lista de socorristas
      setSocorristas(prev => prev.map(s => s.id === updatedSoc.id ? { ...s, foto_url: newFoto, solicitud: null } : s));

      // Registrar actividad
      await logActivity('Aprobó fotografía de solicitud de carnet', 'Socorrista', selectedSocorrista.id, {
        socorrista: `${selectedSocorrista.primer_nombre} ${selectedSocorrista.primer_apellido}`,
        carnet: selectedSocorrista.carnet
      });

      alert('¡Fotografía aprobada exitosamente! Se ha asignado al perfil y carnet del socorrista.');
    } catch (err: any) {
      console.error('Error aprobando fotografía:', err);
      alert('Error al aprobar la fotografía: ' + (err.message || 'Error de conexión'));
    } finally {
      setApprovingPhoto(false);
    }
  };

  const handleRechazarSolicitudFoto = async () => {
    if (!selectedSocorrista || !selectedSocorrista.solicitud) return;
    if (!confirm('¿Deseas rechazar esta solicitud de carnet y descartar la fotografía enviada?')) return;

    try {
      // 1. Marcar como Rechazada en Supabase
      try {
        await supabase
          .from('solicitudes_carnet')
          .update({ estado_solicitud: 'Rechazada' })
          .eq('socorrista_id', selectedSocorrista.id);
      } catch (e) {}

      // 2. Eliminar respaldo en configuracion
      if (selectedSocorrista.solicitud.backup_key) {
        try {
          await supabase
            .from('configuracion')
            .delete()
            .eq('clave', selectedSocorrista.solicitud.backup_key);
        } catch (e) {}
      }

      // 3. Actualizar estado local
      const updatedSoc = {
        ...selectedSocorrista,
        solicitud: null
      };

      setSelectedSocorrista(updatedSoc);
      setPreviewSolicitudPhoto(false);
      setSocorristas(prev => prev.map(s => s.id === updatedSoc.id ? { ...s, solicitud: null } : s));

      alert('La solicitud ha sido rechazada. Se mantendrá la fotografía oficial previa del socorrista.');
    } catch (err) {
      console.error('Error rechazando solicitud:', err);
      alert('Error al rechazar solicitud.');
    }
  };

  const loadSavedFont = async (font: any) => {
    try {
      const fontFace = new FontFace(font.nombre, `url(${font.url})`);
      const loadedFace = await fontFace.load();
      document.fonts.add(loadedFace);
      setCustomFontName(font.nombre);
      setShowFontModal(false);
    } catch (error) {
      console.error('Error loading saved font:', error);
    }
  };

  useEffect(() => {
    if (templateImage && selectedSocorrista && canvasRef.current) {
      drawCarnet().catch(e => console.error('Error drawing carnet:', e));
    }
  }, [
    templateImage, selectedSocorrista, previewSolicitudPhoto, customFontName, 
    fontSizeNames, fontColorNames, posNamesX, posNamesY,
    fontSizeLastNames, fontColorLastNames, posLastNamesX, posLastNamesY,
    fontSizeCargo, fontColorCargo, bgColorCargo, borderRadiusCargo, posCargoX, posCargoY, showBgCargo, bgCargoWidth, bgCargoHeight,
    fontSizeCargoAdmin, fontColorCargoAdmin, bgColorCargoAdmin, borderRadiusCargoAdmin, posCargoAdminX, posCargoAdminY, showBgCargoAdmin, bgCargoAdminWidth, bgCargoAdminHeight,
    fontSizeSeccional, fontColorSeccional, posSeccionalX, posSeccionalY,
    fontSizeDui, fontColorDui, posDuiX, posDuiY,
    fontSizeCarnet, fontColorCarnet, posCarnetX, posCarnetY,
    showMotorista, fontSizeMotorista, fontColorMotorista, posMotoristaX, posMotoristaY, showBgMotorista, bgColorMotorista, borderRadiusMotorista, bgMotoristaWidth, bgMotoristaHeight,
    showQR, posQrX, posQrY, qrSize,
    photoSize, posPhotoX, posPhotoY
  ]);

  const drawCarnet = async (forPreview = true, forVerification = false) => {
    const canvas = canvasRef.current;
    if (!canvas || !templateImage || !selectedSocorrista) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions to match the template
    canvas.width = templateImage.width;
    canvas.height = templateImage.height;

    // Draw background
    ctx.drawImage(templateImage, 0, 0);

    // Draw photo: Usar estrictamente la foto oficial del perfil del socorrista.
    // Solo si el administrador activó expresamente la vista previa de la foto solicitada, se previsualiza esa en el carnet.
    const effectivePhotoUrl = (previewSolicitudPhoto && selectedSocorrista.solicitud?.foto_url)
      ? selectedSocorrista.solicitud.foto_url
      : (selectedSocorrista.foto_url || null);
    if (effectivePhotoUrl) {
      try {
        const photo = new Image();
        photo.crossOrigin = "anonymous";
        await new Promise((resolve, reject) => {
          photo.onload = resolve;
          photo.onerror = reject;
          photo.src = effectivePhotoUrl;
        });

        // Draw circular photo
        const centerX = canvas.width * (posPhotoX / 100);
        const centerY = canvas.height * (posPhotoY / 100);
        const radius = canvas.width * (photoSize / 100);

        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();

        const size = radius * 2;
        const imgAspect = photo.width / photo.height;
        let drawWidth = size;
        let drawHeight = size;
        let offsetX = 0;
        let offsetY = 0;

        if (imgAspect > 1) {
          drawWidth = size * imgAspect;
          offsetX = (drawWidth - size) / 2;
        } else {
          drawHeight = size / imgAspect;
          offsetY = (drawHeight - size) / 2;
        }

        ctx.drawImage(photo, centerX - radius - offsetX, centerY - radius - offsetY, drawWidth, drawHeight);
        ctx.restore();
      } catch (err) {
        console.error("Error loading socorrista photo", err);
      }
    }

    // Draw text
    ctx.textAlign = 'center';
    
    // Nombres
    ctx.fillStyle = fontColorNames;
    ctx.font = `bold ${fontSizeNames}px "${customFontName}"`;
    const nombres = `${selectedSocorrista.primer_nombre} ${selectedSocorrista.segundo_nombre || ''}`.trim();
    ctx.fillText(nombres.toUpperCase(), canvas.width * (posNamesX / 100), canvas.height * (posNamesY / 100));

    // Apellidos
    ctx.fillStyle = fontColorLastNames;
    ctx.font = `bold ${fontSizeLastNames}px "${customFontName}"`;
    const apellidos = `${selectedSocorrista.primer_apellido} ${selectedSocorrista.segundo_apellido || ''}`.trim();
    ctx.fillText(apellidos.toUpperCase(), canvas.width * (posLastNamesX / 100), canvas.height * (posLastNamesY / 100));

    // Cargo Institucional
    const isMinor = selectedSocorrista.cargo_institucional === 'Aspirante a Socorrista' || selectedSocorrista.dui === 'Menor de edad';
    
    if (!isMinor) {
      ctx.fillStyle = fontColorCargo;
      ctx.font = `bold ${fontSizeCargo}px "${customFontName}"`;
      const cargo = (selectedSocorrista.cargo_institucional || 'SOCORRISTA').toUpperCase();
      
      const boxWidth = canvas.width * (bgCargoWidth / 100);
      const boxHeight = bgCargoHeight;
      const boxY = canvas.height * (posCargoY / 100);
      const boxX = canvas.width * (posCargoX / 100);
      
      if (showBgCargo) {
        ctx.fillStyle = bgColorCargo;
        ctx.beginPath();
        ctx.roundRect(boxX - boxWidth / 2, boxY, boxWidth, boxHeight, borderRadiusCargo);
        ctx.fill();
      }
      
      ctx.fillStyle = fontColorCargo;
      ctx.textBaseline = 'middle';
      ctx.fillText(cargo, boxX, boxY + boxHeight / 2);
      ctx.textBaseline = 'alphabetic'; // reset
    }

    // Cargo Administrativo (incluye segundo cargo administrativo si existe)
    const combinedCargoAdmin = [
      selectedSocorrista.cargo_administrativo,
      selectedSocorrista.segundo_cargo_administrativo
    ].filter(Boolean).join(' - ');

    if (combinedCargoAdmin) {
      ctx.fillStyle = fontColorCargoAdmin;
      ctx.font = `bold ${fontSizeCargoAdmin}px "${customFontName}"`;
      const cargoAdmin = combinedCargoAdmin.toUpperCase();
      
      const adminBoxWidth = canvas.width * (bgCargoAdminWidth / 100);
      const adminBoxHeight = bgCargoAdminHeight;
      const adminBoxY = canvas.height * (posCargoAdminY / 100);
      const adminBoxX = canvas.width * (posCargoAdminX / 100);
      
      if (showBgCargoAdmin) {
        ctx.fillStyle = bgColorCargoAdmin;
        ctx.beginPath();
        ctx.roundRect(adminBoxX - adminBoxWidth / 2, adminBoxY, adminBoxWidth, adminBoxHeight, borderRadiusCargoAdmin);
        ctx.fill();
      }
      
      ctx.fillStyle = fontColorCargoAdmin;
      ctx.textBaseline = 'middle';
      ctx.fillText(cargoAdmin, adminBoxX, adminBoxY + adminBoxHeight / 2);
      ctx.textBaseline = 'alphabetic'; // reset
    }

    // Seccional
    ctx.textAlign = 'left';
    ctx.fillStyle = fontColorSeccional;
    ctx.font = `bold ${fontSizeSeccional}px "${customFontName}"`;
    ctx.fillText((selectedSocorrista.seccional_nombre || '').toUpperCase(), canvas.width * (posSeccionalX / 100), canvas.height * (posSeccionalY / 100));

    // DUI
    ctx.fillStyle = fontColorDui;
    ctx.font = `bold ${fontSizeDui}px "${customFontName}"`;
    ctx.fillText(selectedSocorrista.dui || 'N/A', canvas.width * (posDuiX / 100), canvas.height * (posDuiY / 100));

    // Carnet
    ctx.fillStyle = fontColorCarnet;
    ctx.font = `bold ${fontSizeCarnet}px "${customFontName}"`;
    ctx.fillText(selectedSocorrista.carnet || 'N/A', canvas.width * (posCarnetX / 100), canvas.height * (posCarnetY / 100));

    // Motorista Autorizado (Conductor Autorizado con icono de timon)
    const isAuthorized = Boolean(
      selectedSocorrista.motorista_autorizado === true ||
      selectedSocorrista.motorista_autorizado === 1 ||
      selectedSocorrista.motorista_autorizado === 'true'
    );

    if (showMotorista && (forPreview || isAuthorized)) {
      const boxWidth = canvas.width * (bgMotoristaWidth / 100);
      const boxHeight = bgMotoristaHeight;
      const boxX = canvas.width * (posMotoristaX / 100);
      const boxY = canvas.height * (posMotoristaY / 100);

      if (showBgMotorista) {
        ctx.fillStyle = bgColorMotorista;
        ctx.beginPath();
        ctx.roundRect(boxX - boxWidth / 2, boxY - boxHeight / 2, boxWidth, boxHeight, borderRadiusMotorista);
        ctx.fill();
      }

      ctx.font = `bold ${fontSizeMotorista}px "${customFontName}"`;
      ctx.textBaseline = 'middle';
      ctx.fillStyle = fontColorMotorista;

      const textToDraw = "CONDUCTOR AUTORIZADO";
      const textMetrics = ctx.measureText(textToDraw);
      const textWidth = textMetrics.width;
      const iconSize = fontSizeMotorista * 1.15;
      const gap = Math.max(8, fontSizeMotorista * 0.25);
      const totalContentWidth = iconSize + gap + textWidth;
      
      const startX = boxX - totalContentWidth / 2;
      const iconRadius = iconSize / 2;
      const iconCenterX = startX + iconRadius;
      const iconCenterY = boxY;

      // Dibujar icono de timón directamente sobre canvas
      ctx.save();
      ctx.strokeStyle = fontColorMotorista;
      ctx.lineWidth = Math.max(2, iconSize * 0.085);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Aro exterior del timón
      ctx.beginPath();
      ctx.arc(iconCenterX, iconCenterY, iconRadius * 0.88, 0, Math.PI * 2);
      ctx.stroke();

      // Núcleo central del timón
      ctx.beginPath();
      ctx.arc(iconCenterX, iconCenterY, iconRadius * 0.22, 0, Math.PI * 2);
      ctx.stroke();

      // Rayo inferior vertical
      ctx.beginPath();
      ctx.moveTo(iconCenterX, iconCenterY + iconRadius * 0.22);
      ctx.lineTo(iconCenterX, iconCenterY + iconRadius * 0.88);
      ctx.stroke();

      // Rayo superior izquierdo
      ctx.beginPath();
      ctx.moveTo(iconCenterX - iconRadius * 0.16, iconCenterY - iconRadius * 0.08);
      ctx.lineTo(iconCenterX - iconRadius * 0.76, iconCenterY - iconRadius * 0.44);
      ctx.stroke();

      // Rayo superior derecho
      ctx.beginPath();
      ctx.moveTo(iconCenterX + iconRadius * 0.16, iconCenterY - iconRadius * 0.08);
      ctx.lineTo(iconCenterX + iconRadius * 0.76, iconCenterY - iconRadius * 0.44);
      ctx.stroke();

      ctx.restore();

      // Texto de Conductor Autorizado
      ctx.textAlign = 'left';
      ctx.fillStyle = fontColorMotorista;
      ctx.fillText(textToDraw, startX + iconSize + gap, boxY);

      ctx.textBaseline = 'alphabetic'; // reset
      ctx.textAlign = 'left'; // reset
    }

    // Draw QR Code
    if (showQR) {
      try {
        // Enlace oficial y limpio para escaneo público sin login en el subdominio/subcarpeta institucional
        const baseOrigin = (qrBaseUrl && qrBaseUrl.trim() !== '') 
          ? qrBaseUrl.trim().replace(/\/$/, '') 
          : 'https://cruzverdesv.org/miembros';
        
        const pathPrefix = (qrLinkFormat === 'long') ? '/verificar' : '/v';
        // Generar token criptográfico único y no secuencial (evita adivinar otros carnets)
        const qrSecureToken = generateSecureQrToken(selectedSocorrista.carnet, selectedSocorrista.id);
        const qrUrl = `${baseOrigin}${pathPrefix}/${qrSecureToken}`;
        const toDataURL = QRCode.toDataURL || (QRCode as any).default?.toDataURL;
        if (!toDataURL) throw new Error("QRCode.toDataURL is not available");
        
        const qrDataUrl = await new Promise<string>((resolve, reject) => {
          toDataURL(qrUrl, { margin: 1, width: 400 }, (err: Error | null | undefined, url: string) => {
            if (err) reject(err);
            else resolve(url);
          });
        });

        const qrImg = new Image();
        await new Promise((resolve, reject) => {
          qrImg.onload = resolve;
          qrImg.onerror = reject;
          qrImg.src = qrDataUrl;
        });
        const size = canvas.width * (qrSize / 100);
        const qrX = canvas.width * (posQrX / 100) - size / 2;
        const qrY = canvas.height * (posQrY / 100) - size / 2;
        ctx.drawImage(qrImg, qrX, qrY, size, size);
        
        // Draw the carnet ID below the QR code
        ctx.fillStyle = '#000000';
        ctx.font = `bold ${Math.max(12, size * 0.15)}px "${customFontName}"`;
        ctx.textAlign = 'center';
        ctx.fillText(selectedSocorrista.carnet || '', qrX + size / 2, qrY + size + Math.max(12, size * 0.15));
      } catch (err) {
        console.error("Error generating QR code", err);
      }
    }

    // Draw Verification Watermark repeatedly
    if (forVerification) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = 'bold 30px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Add text shadow for better visibility
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      // Draw repetitive pattern across the whole canvas
      const stepX = 250;
      const stepY = 200;
      for (let x = -canvas.width; x < canvas.width * 2; x += stepX) {
        for (let y = -canvas.height; y < canvas.height * 2; y += stepY) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(-Math.PI / 6);
          ctx.fillText('COPIA DIGITAL NO VÁLIDA', 0, 0);
          ctx.restore();
        }
      }
      ctx.restore();
    }

    // Draw Watermark if for preview
    if (forPreview) {
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(-Math.PI / 4);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = 'bold 120px Arial';
      
      // Add text shadow for better visibility
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 5;
      ctx.shadowOffsetY = 5;
      
      ctx.fillText('PREVIEW CARNET', 0, 0);
      ctx.restore();
    }
  };

  const handleSaveCarnet = async () => {
    if (!canvasRef.current || !selectedSocorrista) return;
    
    setSaving(true);
    try {
      // Redraw without watermark for high quality save
      await drawCarnet(false, false);

      // Convert canvas to blob (high quality PNG)
      const blob = await new Promise<Blob | null>((resolve) => {
        canvasRef.current?.toBlob((b) => resolve(b), 'image/png');
      });

      if (!blob) throw new Error('Could not generate image');

      const fileName = `carnet_${selectedSocorrista.carnet}_${Date.now()}.png`;
      const filePath = `${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('socorristas')
        .upload(filePath, blob, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('socorristas')
        .getPublicUrl(filePath);

      // Update socorrista record
      const { error: updateError } = await supabase
        .from('socorristas')
        .update({ 
          carnet_generado_url: publicUrl,
          fecha_generacion_carnet: new Date().toISOString()
        })
        .eq('id', selectedSocorrista.id);

      // If it fails, try without fecha_generacion_carnet
      if (updateError) {
        console.warn('Failed to update with fecha_generacion_carnet, trying fallback:', updateError);
        const { error: fallbackError } = await supabase
          .from('socorristas')
          .update({ 
            carnet_generado_url: publicUrl
          })
          .eq('id', selectedSocorrista.id);
        
        if (fallbackError) {
          console.warn('Failed to update carnet_generado_url, column might be missing:', fallbackError);
          // Don't throw here, just continue so the history is saved and the user gets a success message
          // even if the profile won't show the carnet URL.
        }
      }

      // Add to history
      // Fetch max ID to avoid sequence out of sync errors
      const { data: maxIdData } = await supabase
        .from('historial_carnet')
        .select('id')
        .order('id', { ascending: false })
        .limit(1);
        
      let nextId = undefined;
      if (maxIdData && maxIdData.length > 0 && typeof maxIdData[0].id === 'number') {
        nextId = maxIdData[0].id + 1;
      }

      const { error: historyError } = await supabase
        .from('historial_carnet')
        .insert({
          ...(nextId ? { id: nextId } : {}),
          socorrista_id: selectedSocorrista.id,
          carnet_nuevo: selectedSocorrista.carnet,
          motivo: 'Generación de Carnet'
        });
      
      if (historyError) {
        console.error('Error saving to historial_carnet:', historyError);
      }
      
      if (selectedSocorrista.solicitud) {
        try {
          await supabase
            .from('solicitudes_carnet')
            .update({ estado_solicitud: 'Aprobada' })
            .eq('socorrista_id', selectedSocorrista.id)
            .eq('estado_solicitud', 'Pendiente');
        } catch(e) {
          console.warn('Could not update solicitud', e);
        }
      }

      // Guardar todos los ajustes específicos para este socorrista (para recargarlos al volver a seleccionarlo)
      const carnetAjustes = {
        templateUrl: currentTemplateUrl,
        customFontName,
        fontSizeNames, fontColorNames, posNamesX, posNamesY,
        fontSizeLastNames, fontColorLastNames, posLastNamesX, posLastNamesY,
        fontSizeCargo, fontColorCargo, bgColorCargo, borderRadiusCargo, posCargoX, posCargoY, showBgCargo, bgCargoWidth, bgCargoHeight,
        fontSizeCargoAdmin, fontColorCargoAdmin, bgColorCargoAdmin, borderRadiusCargoAdmin, posCargoAdminX, posCargoAdminY, showBgCargoAdmin, bgCargoAdminWidth, bgCargoAdminHeight,
        fontSizeSeccional, fontColorSeccional, posSeccionalX, posSeccionalY,
        fontSizeDui, fontColorDui, posDuiX, posDuiY,
        fontSizeCarnet, fontColorCarnet, posCarnetX, posCarnetY,
        showMotorista, fontSizeMotorista, fontColorMotorista, posMotoristaX, posMotoristaY, showBgMotorista, bgColorMotorista, borderRadiusMotorista, bgMotoristaWidth, bgMotoristaHeight,
        showQR, posQrX, posQrY, qrSize, qrBaseUrl, qrLinkFormat,
        photoSize, posPhotoX, posPhotoY,
        verificationMode,
        verificationFields
      };

      const ajustesClave = `carnet_ajustes_${selectedSocorrista.id}`;
      try {
        localStorage.setItem(ajustesClave, JSON.stringify(carnetAjustes));
      } catch (e) {}

      try {
        await fetch(getApiUrl('/api/configuracion'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [ajustesClave]: JSON.stringify(carnetAjustes) })
        });
      } catch (e) {}

      try {
        await supabase
          .from('configuracion')
          .upsert({ clave: ajustesClave, valor: JSON.stringify(carnetAjustes) }, { onConflict: 'clave' });
      } catch (e) {}

      await logActivity('Generó carnet', 'Socorrista', selectedSocorrista.id, {
        nombre: `${selectedSocorrista.primer_nombre} ${selectedSocorrista.primer_apellido}`,
        carnet: selectedSocorrista.carnet,
        url: publicUrl
      });

      alert('Carnet guardado exitosamente en el perfil del socorrista.');
      fetchData(); // Refresh list
    } catch (error: any) {
      console.error('Error saving carnet:', error);
      alert('Error al guardar el carnet: ' + (error.message || 'Error desconocido'));
    } finally {
      // Redraw with watermark again
      try {
        await drawCarnet(true);
      } catch (e) {
        console.error('Error redrawing carnet:', e);
      }
      setSaving(false);
    }
  };

  const uniqueSeccionales = Array.from(new Set(socorristas.map(s => s.seccional_nombre).filter(Boolean))).sort((a, b) => (a as string).localeCompare(b as string));

  const filteredSocorristas = socorristas.filter(s => {
    const matchesSearch = s.primer_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.primer_apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.carnet.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSeccional = filterSeccional === 'Todas' || s.seccional_nombre === filterSeccional;
    
    const matchesPhoto = filterHasPhoto === 'Todos' || 
      (filterHasPhoto === 'Con Foto' ? !!s.foto_url : !s.foto_url);

    const matchesSolicitud = filterSolicitud === 'Todos' ||
      (filterSolicitud === 'Con Solicitud' ? !!s.solicitud : !s.solicitud);

    return matchesSearch && matchesSeccional && matchesPhoto && matchesSolicitud;
  }).sort((a, b) => {
    if (sortOrder === 'alphabetical') {
      return (a.primer_nombre + a.primer_apellido).localeCompare(b.primer_nombre + b.primer_apellido);
    } else {
      return a.carnet.localeCompare(b.carnet);
    }
  });

  return (
    <div className="space-y-6 w-full mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Generador de Carnet</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Controles con scroll independiente */}
        <div className="lg:col-span-5 space-y-6 max-h-[calc(100vh-100px)] overflow-y-auto pr-2 custom-scrollbar">
          <div className="bg-white shadow rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-base font-bold text-gray-900">1. Plantilla de Fondo</h2>
                <p className="text-2xs text-gray-500">Elige el diseño oficial o sube un nuevo fondo para el carnet</p>
              </div>
              <button
                type="button"
                onClick={() => setTemplatesExpanded(!templatesExpanded)}
                className="inline-flex items-center text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
                <span>{templatesExpanded ? 'Ocultar Mosaico' : `Ver Mosaico (${savedTemplates.length})`}</span>
                {templatesExpanded ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
              </button>
            </div>

            {/* Barra de acciones rápidas */}
            <div className="flex items-center gap-2 mb-3">
              <label className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-dashed border-emerald-400 bg-emerald-50/50 hover:bg-emerald-100/60 rounded-xl text-xs font-bold text-emerald-800 transition-all cursor-pointer shadow-2xs">
                <Plus className="w-4 h-4 mr-1.5 text-emerald-600" />
                Subir Nueva Plantilla
                <input type="file" className="sr-only" accept="image/*" onChange={handleTemplateUpload} />
              </label>

              {templateImage && (
                <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-2xs text-slate-600 font-mono flex items-center shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                  {templateImage.width}×{templateImage.height}px
                </div>
              )}
            </div>

            {/* Vista Mosaico Expandible */}
            {templatesExpanded && (
              <div className="mt-2 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xs font-bold uppercase tracking-wider text-gray-400">
                    Mosaico de Plantillas ({savedTemplates.length})
                  </span>
                  <span className="text-3xs text-gray-400">Haz clic para seleccionar</span>
                </div>

                {savedTemplates.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                    {savedTemplates.map((t) => {
                      const isSelected = currentTemplateUrl === t.url;
                      return (
                        <div
                          key={t.id}
                          onClick={() => loadSavedTemplate(t.url)}
                          className={`group relative rounded-xl border-2 transition-all cursor-pointer overflow-hidden flex flex-col bg-white shadow-2xs ${
                            isSelected
                              ? 'border-emerald-600 ring-2 ring-emerald-500/30 bg-emerald-50/20'
                              : 'border-gray-200 hover:border-emerald-400 hover:shadow-xs'
                          }`}
                        >
                          <div className="w-full h-28 bg-slate-100/80 flex items-center justify-center p-1.5 relative overflow-hidden">
                            <img
                              src={t.url}
                              alt={t.nombre}
                              className="max-w-full max-h-full object-contain drop-shadow-xs"
                              crossOrigin="anonymous"
                              referrerPolicy="no-referrer"
                            />
                            {isSelected && (
                              <div className="absolute top-1.5 right-1.5 bg-emerald-600 text-white rounded-full p-1 shadow-md">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                            )}
                          </div>

                          <div className="p-2 bg-white flex items-center justify-between border-t border-gray-100">
                            <p className="text-2xs font-semibold text-gray-800 truncate flex-1" title={t.nombre}>
                              {t.nombre}
                            </p>
                            <div className="flex items-center space-x-1 shrink-0 ml-1">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setPreviewTemplate(t.url); }}
                                className="p-1 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                                title="Ver en tamaño completo"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => deleteSavedTemplate(t.id, e)}
                                disabled={deletingTemplateId === t.id}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Eliminar plantilla"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 px-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-gray-600">No hay plantillas guardadas</p>
                    <p className="text-2xs text-gray-400 mt-0.5">Usa el botón "Subir Nueva Plantilla" para agregar una.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">2. Seleccionar Socorrista</h2>
            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar por nombre o carnet..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
              />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Seccional</label>
                <select
                  value={filterSeccional}
                  onChange={(e) => setFilterSeccional(e.target.value)}
                  className="block w-full pl-2 pr-8 py-1.5 text-xs border-gray-300 focus:outline-none focus:ring-primary focus:border-primary rounded-md border"
                >
                  <option value="Todas">Todas</option>
                  {uniqueSeccionales.map((sec: any) => (
                    <option key={sec} value={sec}>{sec}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Foto</label>
                <select
                  value={filterHasPhoto}
                  onChange={(e) => setFilterHasPhoto(e.target.value)}
                  className="block w-full pl-2 pr-8 py-1.5 text-xs border-gray-300 focus:outline-none focus:ring-primary focus:border-primary rounded-md border"
                >
                  <option value="Todos">Todos</option>
                  <option value="Con Foto">Con Foto</option>
                  <option value="Sin Foto">Sin Foto</option>
                </select>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Solicitud</label>
                <select
                  value={filterSolicitud}
                  onChange={(e) => setFilterSolicitud(e.target.value)}
                  className="block w-full pl-2 pr-8 py-1.5 text-xs border-gray-300 focus:outline-none focus:ring-primary focus:border-primary rounded-md border"
                >
                  <option value="Todos">Todos</option>
                  <option value="Con Solicitud">Con Solicitud</option>
                  <option value="Sin Solicitud">Sin Solicitud</option>
                </select>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Orden</label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="block w-full pl-2 pr-8 py-1.5 text-xs border-gray-300 focus:outline-none focus:ring-primary focus:border-primary rounded-md border"
                >
                  <option value="alphabetical">Alfabético</option>
                  <option value="carnet">N° Carnet</option>
                </select>
              </div>
            </div>
            
            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md">
              {filteredSocorristas.length > 0 ? (
                <ul className="divide-y divide-gray-200">
                  {filteredSocorristas.map((socorrista) => (
                    <li 
                      key={socorrista.id} 
                      className={`p-3 hover:bg-gray-50 cursor-pointer flex items-center space-x-3 transition-colors ${selectedSocorrista?.id === socorrista.id ? 'bg-blue-50 border-l-4 border-primary' : ''}`}
                      onClick={() => handleSelectSocorrista(socorrista)}
                    >
                      <div className="flex-shrink-0 h-10 w-10">
                        {socorrista.foto_url ? (
                          <WatermarkImage src={socorrista.foto_url} alt="" className="h-10 w-10 border border-gray-200" isRounded={true} />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold">
                            {(socorrista.primer_nombre?.[0] || '') + (socorrista.primer_apellido?.[0] || '')}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {socorrista.primer_nombre} {socorrista.primer_apellido}
                          </p>
                          {socorrista.solicitud && socorrista.solicitud.estado_solicitud === 'Pendiente' && (
                            <span className="px-1.5 py-0.5 rounded flex items-center text-[10px] font-medium bg-yellow-100 text-yellow-800" title={`Solicitud de ${socorrista.solicitud.tipo_solicitud}`}>
                              Req: {new Date(socorrista.solicitud.fecha_solicitud).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <p className="text-xs text-gray-500 truncate">{socorrista.carnet}</p>
                          {loadedSocorristaAjustes && selectedSocorrista?.id === socorrista.id && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">
                              ✓ Ajustes restaurados
                            </span>
                          )}
                        </div>
                      </div>
                      {socorrista.carnet_generado_url && (
                        <div className="flex-shrink-0" title="Carnet ya generado">
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="p-4 text-sm text-gray-500 text-center">No se encontraron resultados</p>
              )}
            </div>
          </div>

          {selectedSocorrista?.solicitud && selectedSocorrista.solicitud.estado_solicitud === 'Pendiente' && (
            <div className="bg-amber-50/90 border-2 border-amber-300 p-4 shadow-sm rounded-2xl">
              <div className="flex items-center justify-between pb-2 border-b border-amber-200/80 mb-3">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                  <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                    Solicitud de Carnet: {selectedSocorrista.solicitud.tipo_solicitud}
                  </h3>
                </div>
                <span className="text-3xs text-amber-700 font-mono bg-amber-100/70 px-2 py-0.5 rounded">
                  {new Date(selectedSocorrista.solicitud.fecha_solicitud).toLocaleDateString()}
                </span>
              </div>

              {selectedSocorrista.solicitud.motivo && (
                <p className="text-xs text-amber-800 mb-3 bg-white/80 p-2.5 rounded-xl border border-amber-200">
                  <strong className="font-semibold text-amber-900">Motivo:</strong> {selectedSocorrista.solicitud.motivo}
                </p>
              )}

              {selectedSocorrista.solicitud.foto_url ? (
                <div className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-gray-900 block">Fotografía Solicitada</span>
                      <span className="text-3xs text-gray-500">Revisa la foto antes de aprobarla o asignarla</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewSolicitudPhoto(!previewSolicitudPhoto)}
                      className={`text-2xs font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                        previewSolicitudPhoto
                          ? 'bg-amber-500 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {previewSolicitudPhoto ? 'Viendo Solicitada en Carnet' : 'Ver Solicitada en Carnet'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className={`p-2.5 rounded-xl border flex flex-col items-center transition-all ${
                      !previewSolicitudPhoto ? 'bg-emerald-50/50 border-emerald-300 ring-2 ring-emerald-500/20' : 'bg-gray-50 border-gray-200'
                    }`}>
                      <span className="text-3xs font-bold uppercase text-gray-600 mb-1.5">Foto Actual de Perfil</span>
                      {selectedSocorrista.foto_url ? (
                        <img
                          src={selectedSocorrista.foto_url}
                          alt="Foto actual oficial"
                          className="w-16 h-16 rounded-full object-cover border-2 border-emerald-500 shadow-xs"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-3xs font-bold">
                          Sin foto
                        </div>
                      )}
                      <span className="text-3xs text-emerald-700 font-semibold mt-1">
                        {!previewSolicitudPhoto ? '● En uso oficial' : 'Oficial'}
                      </span>
                    </div>

                    <div className={`p-2.5 rounded-xl border flex flex-col items-center transition-all ${
                      previewSolicitudPhoto ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20' : 'bg-gray-50 border-gray-200'
                    }`}>
                      <span className="text-3xs font-bold uppercase text-amber-800 mb-1.5">Nueva Foto Solicitada</span>
                      <img
                        src={selectedSocorrista.solicitud.foto_url}
                        alt="Nueva foto solicitada"
                        className="w-16 h-16 rounded-full object-cover border-2 border-amber-500 shadow-xs"
                      />
                      <span className="text-3xs text-amber-700 font-semibold mt-1">
                        {previewSolicitudPhoto ? '● Previsualizando' : 'Pendiente de aprobar'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={approvingPhoto}
                      onClick={handleAprobarFotoSolicitud}
                      className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5 mr-1.5" />
                      {approvingPhoto ? 'Aprobando...' : 'Aprobar Foto y Asignar'}
                    </button>
                    <button
                      type="button"
                      onClick={handleRechazarSolicitudFoto}
                      className="px-3 py-2 bg-white hover:bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-amber-800">Solicitud sin nueva fotografía</span>
                  <button
                    type="button"
                    onClick={handleRechazarSolicitudFoto}
                    className="text-xs text-red-600 hover:underline font-semibold"
                  >
                    Marcar como procesada
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium text-gray-900">3. Verificación en línea</h2>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                verificationMode === 'system' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {verificationMode === 'system' ? 'Predeterminado' : 'Personalizado'}
              </span>
            </div>
            
            <p className="text-xs text-gray-500 mb-4">
              Configura los datos que se revelarán al consultar o escanear el código QR del carnet:
            </p>

            <div className="space-y-3 mb-4">
              <label 
                className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all ${
                  verificationMode === 'system' 
                    ? 'border-emerald-500 bg-emerald-50/50 shadow-sm' 
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => {
                  setVerificationMode('system');
                  setVerificationFields({ ...systemVerificationFields });
                }}
              >
                <input
                  type="radio"
                  name="verificationMode"
                  checked={verificationMode === 'system'}
                  onChange={() => {
                    setVerificationMode('system');
                    setVerificationFields({ ...systemVerificationFields });
                  }}
                  className="mt-1 h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300"
                />
                <div className="ml-3">
                  <span className="block text-sm font-medium text-gray-900">
                    Seleccionar el predeterminado del sistema
                  </span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    Utiliza la configuración global del portal definida en <strong>Configuraciones</strong>.
                  </span>
                </div>
              </label>

              <label 
                className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all ${
                  verificationMode === 'custom' 
                    ? 'border-blue-500 bg-blue-50/50 shadow-sm' 
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => setVerificationMode('custom')}
              >
                <input
                  type="radio"
                  name="verificationMode"
                  checked={verificationMode === 'custom'}
                  onChange={() => setVerificationMode('custom')}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <div className="ml-3">
                  <span className="block text-sm font-medium text-gray-900">
                    Personalizar verificación para este carnet
                  </span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    Activa o desactiva campos específicos exclusivamente para este carnet.
                  </span>
                </div>
              </label>
            </div>

            {verificationMode === 'system' ? (
              <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs text-gray-600 space-y-2">
                <div className="flex items-center justify-between text-gray-700 font-medium">
                  <span>Campos activos según configuración del sistema:</span>
                  <span className="text-[11px] text-gray-500">
                    {VERIFICATION_FIELD_DEFINITIONS.filter(def => systemVerificationFields[def.id] !== false).length} de {VERIFICATION_FIELD_DEFINITIONS.length} activos
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {VERIFICATION_FIELD_DEFINITIONS.map(def => {
                    const isActive = systemVerificationFields[def.id] !== false;
                    return (
                      <span
                        key={def.id}
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] ${
                          isActive 
                            ? 'bg-emerald-100 text-emerald-800 font-medium' 
                            : 'bg-gray-200 text-gray-400 line-through'
                        }`}
                      >
                        {def.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="border border-blue-200 bg-blue-50/30 rounded-md p-3 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-blue-100">
                  <span className="text-xs font-semibold text-gray-700">Campos visibles en QR:</span>
                  <div className="flex items-center space-x-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        const allOn: Record<string, boolean> = {};
                        VERIFICATION_FIELD_DEFINITIONS.forEach(d => { allOn[d.id] = true; });
                        setVerificationFields(allOn);
                      }}
                      className="text-primary hover:underline font-medium"
                    >
                      Marcar todos
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        const allOff: Record<string, boolean> = {};
                        VERIFICATION_FIELD_DEFINITIONS.forEach(d => { allOff[d.id] = false; });
                        setVerificationFields(allOff);
                      }}
                      className="text-gray-500 hover:underline"
                    >
                      Ninguno
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={() => setVerificationFields({ ...systemVerificationFields })}
                      className="text-gray-500 hover:underline"
                      title="Copiar configuración del sistema"
                    >
                      Restablecer
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                  {VERIFICATION_FIELD_DEFINITIONS.map(field => {
                    const isChecked = verificationFields[field.id] !== false;
                    return (
                      <label
                        key={field.id}
                        className="flex items-center space-x-2.5 p-1.5 rounded hover:bg-white cursor-pointer transition-colors"
                      >
                        <div className="relative flex-shrink-0">
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={isChecked}
                            onChange={() => {
                              const updated = {
                                ...verificationFields,
                                [field.id]: !isChecked
                              };
                              setVerificationFields(updated);
                            }}
                          />
                          <div className={`block w-7 h-4 rounded-full transition-colors ${isChecked ? 'bg-primary' : 'bg-gray-300'}`}></div>
                          <div className={`dot absolute left-0.5 top-0.5 bg-white w-3 h-3 rounded-full transition-transform ${isChecked ? 'transform translate-x-3' : ''}`}></div>
                        </div>
                        <span className={`text-xs select-none ${isChecked ? 'font-medium text-gray-800' : 'text-gray-500'}`}>
                          {field.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">4. Personalización de Texto</h2>
              <div className="flex space-x-2">
                <button 
                  onClick={() => setShowPresetModal(true)}
                  className="p-2 text-gray-400 hover:text-primary transition-colors"
                  title="Presets de Ajustes"
                >
                  <Settings className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipografía</label>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => setShowFontModal(true)}
                    className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <TypeIcon className="-ml-1 mr-2 h-4 w-4 text-gray-400" />
                    Guardadas
                  </button>
                  <label className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-hover cursor-pointer">
                    <Plus className="-ml-1 mr-2 h-4 w-4" />
                    Subir
                    <input type="file" accept=".ttf,.otf,.woff" onChange={handleFontUpload} className="sr-only" />
                  </label>
                </div>
                <p className="mt-1 text-xs text-gray-500">Fuente actual: {customFontName}</p>
              </div>
              
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Foto del Socorrista</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500">Tamaño (%)</label>
                    <input type="number" value={photoSize} onChange={e => setPhotoSize(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">Posición X (%)</label>
                    <input type="number" value={posPhotoX} onChange={e => setPosPhotoX(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">Posición Y (%)</label>
                    <input type="number" value={posPhotoY} onChange={e => setPosPhotoY(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Nombres</h3>
                <div className="grid grid-cols-2 gap-4 mb-2">
                  <div>
                    <label className="block text-xs text-gray-500">Tamaño</label>
                    <input type="number" value={fontSizeNames} onChange={e => setFontSizeNames(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">Color</label>
                    <input type="color" value={fontColorNames} onChange={e => setFontColorNames(e.target.value)} className="mt-1 block w-full h-8 border-gray-300 rounded-md shadow-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500">Posición X (%)</label>
                    <input type="number" value={posNamesX} onChange={e => setPosNamesX(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">Posición Y (%)</label>
                    <input type="number" value={posNamesY} onChange={e => setPosNamesY(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Apellidos</h3>
                <div className="grid grid-cols-2 gap-4 mb-2">
                  <div>
                    <label className="block text-xs text-gray-500">Tamaño</label>
                    <input type="number" value={fontSizeLastNames} onChange={e => setFontSizeLastNames(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">Color</label>
                    <input type="color" value={fontColorLastNames} onChange={e => setFontColorLastNames(e.target.value)} className="mt-1 block w-full h-8 border-gray-300 rounded-md shadow-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500">Posición X (%)</label>
                    <input type="number" value={posLastNamesX} onChange={e => setPosLastNamesX(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">Posición Y (%)</label>
                    <input type="number" value={posLastNamesY} onChange={e => setPosLastNamesY(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-900">Cargo Institucional</h3>
                  <label className="flex items-center cursor-pointer">
                    <span className="mr-2 text-xs text-gray-500">Fondo</span>
                    <div className="relative">
                      <input type="checkbox" className="sr-only" checked={showBgCargo} onChange={e => setShowBgCargo(e.target.checked)} />
                      <div className={`block w-8 h-5 rounded-full ${showBgCargo ? 'bg-primary' : 'bg-gray-300'}`}></div>
                      <div className={`dot absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition ${showBgCargo ? 'transform translate-x-3' : ''}`}></div>
                    </div>
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div>
                    <label className="block text-xs text-gray-500">Tamaño</label>
                    <input type="number" value={fontSizeCargo} onChange={e => setFontSizeCargo(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">Ancho Fondo (%)</label>
                    <input type="number" value={bgCargoWidth} onChange={e => setBgCargoWidth(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">Alto Fondo (px)</label>
                    <input type="number" value={bgCargoHeight} onChange={e => setBgCargoHeight(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div>
                    <label className="block text-xs text-gray-500">Color Texto</label>
                    <input type="color" value={fontColorCargo} onChange={e => setFontColorCargo(e.target.value)} className="mt-1 block w-full h-8 border-gray-300 rounded-md shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">Color Fondo</label>
                    <input type="color" value={bgColorCargo} onChange={e => setBgColorCargo(e.target.value)} disabled={!showBgCargo} className="mt-1 block w-full h-8 border-gray-300 rounded-md shadow-sm disabled:opacity-50" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">Redondez</label>
                    <input type="number" value={borderRadiusCargo} onChange={e => setBorderRadiusCargo(Number(e.target.value))} disabled={!showBgCargo} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm disabled:opacity-50" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500">Posición X (%)</label>
                    <input type="number" value={posCargoX} onChange={e => setPosCargoX(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">Posición Y (%)</label>
                    <input type="number" value={posCargoY} onChange={e => setPosCargoY(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                  </div>
                </div>
              </div>

              {selectedSocorrista?.cargo_administrativo && (
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-900">Cargo Administrativo</h3>
                    <label className="flex items-center cursor-pointer">
                      <span className="mr-2 text-xs text-gray-500">Fondo</span>
                      <div className="relative">
                        <input type="checkbox" className="sr-only" checked={showBgCargoAdmin} onChange={e => setShowBgCargoAdmin(e.target.checked)} />
                        <div className={`block w-8 h-5 rounded-full ${showBgCargoAdmin ? 'bg-primary' : 'bg-gray-300'}`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition ${showBgCargoAdmin ? 'transform translate-x-3' : ''}`}></div>
                      </div>
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div>
                      <label className="block text-xs text-gray-500">Tamaño</label>
                      <input type="number" value={fontSizeCargoAdmin} onChange={e => setFontSizeCargoAdmin(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500">Ancho Fondo (%)</label>
                      <input type="number" value={bgCargoAdminWidth} onChange={e => setBgCargoAdminWidth(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500">Alto Fondo (px)</label>
                      <input type="number" value={bgCargoAdminHeight} onChange={e => setBgCargoAdminHeight(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div>
                      <label className="block text-xs text-gray-500">Color Texto</label>
                      <input type="color" value={fontColorCargoAdmin} onChange={e => setFontColorCargoAdmin(e.target.value)} className="mt-1 block w-full h-8 border-gray-300 rounded-md shadow-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500">Color Fondo</label>
                      <input type="color" value={bgColorCargoAdmin} onChange={e => setBgColorCargoAdmin(e.target.value)} disabled={!showBgCargoAdmin} className="mt-1 block w-full h-8 border-gray-300 rounded-md shadow-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500">Redondez</label>
                      <input type="number" value={borderRadiusCargoAdmin} onChange={e => setBorderRadiusCargoAdmin(Number(e.target.value))} disabled={!showBgCargoAdmin} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm disabled:opacity-50" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500">Posición X (%)</label>
                      <input type="number" value={posCargoAdminX} onChange={e => setPosCargoAdminX(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500">Posición Y (%)</label>
                      <input type="number" value={posCargoAdminY} onChange={e => setPosCargoAdminY(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Seccional</h3>
                <div className="grid grid-cols-2 gap-4 mb-2">
                  <div>
                    <label className="block text-xs text-gray-500">Tamaño</label>
                    <input type="number" value={fontSizeSeccional} onChange={e => setFontSizeSeccional(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">Color</label>
                    <input type="color" value={fontColorSeccional} onChange={e => setFontColorSeccional(e.target.value)} className="mt-1 block w-full h-8 border-gray-300 rounded-md shadow-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500">Posición X (%)</label>
                    <input type="number" value={posSeccionalX} onChange={e => setPosSeccionalX(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">Posición Y (%)</label>
                    <input type="number" value={posSeccionalY} onChange={e => setPosSeccionalY(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">DUI</h3>
                <div className="grid grid-cols-2 gap-4 mb-2">
                  <div>
                    <label className="block text-xs text-gray-500">Tamaño</label>
                    <input type="number" value={fontSizeDui} onChange={e => setFontSizeDui(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">Color</label>
                    <input type="color" value={fontColorDui} onChange={e => setFontColorDui(e.target.value)} className="mt-1 block w-full h-8 border-gray-300 rounded-md shadow-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500">Posición X (%)</label>
                    <input type="number" value={posDuiX} onChange={e => setPosDuiX(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">Posición Y (%)</label>
                    <input type="number" value={posDuiY} onChange={e => setPosDuiY(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Carnet</h3>
                <div className="grid grid-cols-2 gap-4 mb-2">
                  <div>
                    <label className="block text-xs text-gray-500">Tamaño</label>
                    <input type="number" value={fontSizeCarnet} onChange={e => setFontSizeCarnet(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">Color</label>
                    <input type="color" value={fontColorCarnet} onChange={e => setFontColorCarnet(e.target.value)} className="mt-1 block w-full h-8 border-gray-300 rounded-md shadow-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500">Posición X (%)</label>
                    <input type="number" value={posCarnetX} onChange={e => setPosCarnetX(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">Posición Y (%)</label>
                    <input type="number" value={posCarnetY} onChange={e => setPosCarnetY(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-medium text-gray-900">Autorización Vehicular</h4>
                    <input
                      type="checkbox"
                      checked={showMotorista}
                      onChange={(e) => setShowMotorista(e.target.checked)}
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                      title="Activar o desactivar credencial"
                    />
                  </div>
                  <label className="flex items-center cursor-pointer">
                    <span className="mr-2 text-xs text-gray-500">Fondo</span>
                    <div className="relative">
                      <input type="checkbox" className="sr-only" checked={showBgMotorista} onChange={e => setShowBgMotorista(e.target.checked)} />
                      <div className={`block w-8 h-5 rounded-full ${showBgMotorista ? 'bg-primary' : 'bg-gray-300'}`}></div>
                      <div className={`dot absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition ${showBgMotorista ? 'transform translate-x-3' : ''}`}></div>
                    </div>
                  </label>
                </div>
                {selectedSocorrista && (
                  <div className="mb-2">
                    {selectedSocorrista.motorista_autorizado ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        ✓ Conductor autorizado en sistema
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                        ⓘ Modo diseño: visible en vista previa
                      </span>
                    )}
                  </div>
                )}
                {showMotorista && (
                  <>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <div>
                        <label className="block text-xs text-gray-500">Tamaño</label>
                        <input type="number" value={fontSizeMotorista} onChange={e => setFontSizeMotorista(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500">Ancho Fondo (%)</label>
                        <input type="number" value={bgMotoristaWidth} onChange={e => setBgMotoristaWidth(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500">Alto Fondo (px)</label>
                        <input type="number" value={bgMotoristaHeight} onChange={e => setBgMotoristaHeight(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <div>
                        <label className="block text-xs text-gray-500">Color Texto</label>
                        <input type="color" value={fontColorMotorista} onChange={e => setFontColorMotorista(e.target.value)} className="mt-1 block w-full h-8 border-gray-300 rounded-md shadow-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500">Color Fondo</label>
                        <input type="color" value={bgColorMotorista} onChange={e => setBgColorMotorista(e.target.value)} disabled={!showBgMotorista} className="mt-1 block w-full h-8 border-gray-300 rounded-md shadow-sm disabled:opacity-50" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500">Redondez</label>
                        <input type="number" value={borderRadiusMotorista} onChange={e => setBorderRadiusMotorista(Number(e.target.value))} disabled={!showBgMotorista} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm disabled:opacity-50" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500">Posición X (%)</label>
                        <input type="number" value={posMotoristaX} onChange={e => setPosMotoristaX(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500">Posición Y (%)</label>
                        <input type="number" value={posMotoristaY} onChange={e => setPosMotoristaY(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-900">Código QR de Verificación</h3>
                  <label className="flex items-center cursor-pointer">
                    <div className="relative">
                      <input type="checkbox" className="sr-only" checked={showQR} onChange={e => setShowQR(e.target.checked)} />
                      <div className={`block w-10 h-6 rounded-full ${showQR ? 'bg-primary' : 'bg-gray-300'}`}></div>
                      <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition ${showQR ? 'transform translate-x-4' : ''}`}></div>
                    </div>
                  </label>
                </div>
                {showQR && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500">Tamaño (%)</label>
                      <input type="number" value={qrSize} onChange={e => setQrSize(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500">Posición X (%)</label>
                      <input type="number" value={posQrX} onChange={e => setPosQrX(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500">Posición Y (%)</label>
                      <input type="number" value={posQrY} onChange={e => setPosQrY(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Vista Previa */}
        <div className="lg:col-span-7 space-y-6 lg:sticky lg:top-6 self-start">
          <div className="bg-white shadow rounded-lg p-6 flex flex-col items-center">
            <div className="flex items-center justify-between w-full mb-4">
              <h2 className="text-lg font-medium text-gray-900">5. Vista Previa y Guardar</h2>
              <button
                onClick={handleSaveCarnet}
                disabled={!templateImage || !selectedSocorrista || !selectedSocorrista.foto_url || saving}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
              >
                <Save className="-ml-1 mr-2 h-5 w-5" />
                {saving ? 'Guardando...' : 'Guardar en Perfil'}
              </button>
            </div>
            
            <div className="w-full flex justify-center bg-gray-100 rounded-lg p-4 min-h-[500px] overflow-auto">
              {!templateImage ? (
                <div className="flex flex-col items-center justify-center text-gray-500">
                  <ImageIcon className="h-16 w-16 mb-2 opacity-50" />
                  <p>Sube una plantilla para comenzar</p>
                </div>
              ) : !selectedSocorrista ? (
                <div className="flex flex-col items-center justify-center text-gray-500">
                  <Search className="h-16 w-16 mb-2 opacity-50" />
                  <p>Selecciona un socorrista</p>
                </div>
              ) : !selectedSocorrista.foto_url ? (
                <div className="flex flex-col items-center justify-center text-red-500">
                  <ImageIcon className="h-16 w-16 mb-2 opacity-50" />
                  <p className="font-medium">Falta una foto para generar carnet</p>
                  <p className="text-sm mt-2 text-gray-500">Por favor, agrega una foto en el perfil del socorrista primero.</p>
                </div>
              ) : (
                <div className="relative inline-block">
                  <canvas 
                    ref={canvasRef} 
                    className="max-w-full h-auto shadow-lg border border-gray-200"
                    style={{ maxHeight: '800px' }}
                  />
                  {watermarkEnabled && role !== 'admin' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-black bg-opacity-10 rounded-lg">
                      <div className="transform -rotate-45 text-white text-opacity-70 font-bold text-center w-[200%]">
                        <p className="text-sm sm:text-base tracking-wider uppercase drop-shadow-md">
                          Cruz Verde Salvadoreña<br/>Sistema Interno
                        </p>
                        <p className="text-xs sm:text-sm mt-1 opacity-80 drop-shadow-md">
                          Visualizado por: {userName || 'Usuario'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Modals */}
      {showPresetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900">Presets de Ajustes</h3>
              <button onClick={() => setShowPresetModal(false)} className="text-gray-400 hover:text-gray-500">
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Guardar ajustes actuales como:</label>
                <div className="flex space-x-2">
                  <input 
                    type="text" 
                    value={presetName} 
                    onChange={e => setPresetName(e.target.value)}
                    placeholder="Nombre del preset..."
                    className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
                  />
                  <button 
                    onClick={() => savePreset(presetName)}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Guardar
                  </button>
                </div>
              </div>
              
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Presets Guardados</h4>
              <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md">
                {presets.length > 0 ? presets.map(p => (
                  <li key={p.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                    <span className="text-sm font-medium text-gray-900">{p.nombre}</span>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => applyPreset(p)}
                        className="text-primary hover:text-primary-hover text-xs font-bold"
                      >
                        Aplicar
                      </button>
                      <button 
                        onClick={() => deletePreset(p.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                )) : (
                  <li className="p-4 text-sm text-gray-500 text-center">No hay presets guardados</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}


      {previewTemplate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-75 p-4" onClick={() => setPreviewTemplate(null)}>
          <div className="relative bg-white rounded-lg shadow-2xl max-w-4xl w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewTemplate(null)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 bg-white rounded-full p-1 shadow-md">
              <XCircle className="h-8 w-8" />
            </button>
            <div className="p-4">
              <div className="w-full flex items-center justify-center bg-gray-100 rounded-lg overflow-hidden p-4">
                <img src={previewTemplate} alt="Vista Previa" className="max-w-full h-auto max-h-[80vh] object-contain drop-shadow-lg bg-white" crossOrigin="anonymous" referrerPolicy="no-referrer" />
              </div>
              <div className="mt-4 flex justify-center">
                <button 
                  onClick={() => { loadSavedTemplate(previewTemplate); setPreviewTemplate(null); setShowTemplateModal(false); }}
                  className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary-hover font-medium"
                >
                  Usar esta plantilla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFontModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900">Fuentes Guardadas</h3>
              <button onClick={() => setShowFontModal(false)} className="text-gray-400 hover:text-gray-500">
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md">
                {savedFonts.length > 0 ? savedFonts.map(f => (
                  <li key={f.id} className="p-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer" onClick={() => loadSavedFont(f)}>
                    <span className="text-sm font-medium text-gray-900" style={{ fontFamily: f.nombre }}>{f.nombre}</span>
                    <span className="text-primary text-xs font-bold">Usar</span>
                  </li>
                )) : (
                  <li className="p-4 text-sm text-gray-500 text-center">No hay fuentes guardadas</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
