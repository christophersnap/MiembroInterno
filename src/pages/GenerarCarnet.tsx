import React, { useState, useEffect, useRef } from 'react';
import { Search, Upload, Save, Image as ImageIcon, Settings, Trash2, CheckCircle2, Plus, Type as TypeIcon, XCircle, Eye } from 'lucide-react';
import * as QRCode from 'qrcode';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';
import { generateSecureQrToken } from '../utils/qrSecurity';

import WatermarkImage from '../components/WatermarkImage';

export default function GenerarCarnet() {
  const { role, watermarkEnabled, userName } = useAuth();
  const [socorristas, setSocorristas] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeccional, setFilterSeccional] = useState('Todas');
  const [filterHasPhoto, setFilterHasPhoto] = useState('Todos');
  const [filterSolicitud, setFilterSolicitud] = useState('Todos');
  const [selectedSocorrista, setSelectedSocorrista] = useState<any>(null);
  const [templateImage, setTemplateImage] = useState<HTMLImageElement | null>(null);
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

  // Verification fields state
  const [verificationFields, setVerificationFields] = useState({
    showDui: true,
    showSeccional: true,
    showCargoInst: true,
    showCargoAdmin: true,
    showFechaIngreso: true,
    showCursos: true,
    showTipoSangre: true,
    showEmail: true
  });

  // Presets, Templates, Fonts
  const [presets, setPresets] = useState<any[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<any[]>([]);
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
          .order('fecha_solicitud', { ascending: false });
        
        if (solData) {
          solData.forEach(sol => {
            if (!solicitudesMap[sol.socorrista_id]) {
              solicitudesMap[sol.socorrista_id] = sol; // Get latest
            }
          });
        }
      } catch(e) {}
      
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
            try { setVerificationFields(JSON.parse(row.valor)); } catch (e) {}
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
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setTemplateImage(img);
    img.src = url;
    setShowTemplateModal(false);
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
    templateImage, selectedSocorrista, customFontName, 
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

    // ... (rest of the photo drawing code remains the same up to text drawing)
    if (selectedSocorrista.foto_url) {
      try {
        const photo = new Image();
        photo.crossOrigin = "anonymous";
        await new Promise((resolve, reject) => {
          photo.onload = resolve;
          photo.onerror = reject;
          photo.src = selectedSocorrista.foto_url;
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controles */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">1. Plantilla de Fondo</h2>
            <div className="flex space-x-2 mb-4">
              <button 
                onClick={() => setShowTemplateModal(true)}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                <ImageIcon className="-ml-1 mr-2 h-5 w-5 text-gray-400" />
                Usar Guardada
              </button>
              <label className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-hover cursor-pointer">
                <Plus className="-ml-1 mr-2 h-5 w-5" />
                Subir Nueva
                <input type="file" className="sr-only" accept="image/*" onChange={handleTemplateUpload} />
              </label>
            </div>
            {templateImage && <p className="mt-2 text-sm text-green-600 font-medium text-center">Plantilla cargada</p>}
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
                      className={`p-3 hover:bg-gray-50 cursor-pointer flex items-center space-x-3 ${selectedSocorrista?.id === socorrista.id ? 'bg-blue-50 border-l-4 border-primary' : ''}`}
                      onClick={() => setSelectedSocorrista(socorrista)}
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
                        <p className="text-sm text-gray-500 truncate">{socorrista.carnet}</p>
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
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 shadow rounded-lg">
              <h3 className="text-sm font-medium text-yellow-800 mb-2 border-b border-yellow-200 pb-2">
                Solicitud en Proceso: {selectedSocorrista.solicitud.tipo_solicitud}
              </h3>
              <p className="text-xs text-yellow-700 mb-2">Fecha: {new Date(selectedSocorrista.solicitud.fecha_solicitud).toLocaleDateString()}</p>
              {selectedSocorrista.solicitud.motivo && (
                <p className="text-xs text-yellow-700 mb-3">Motivo: {selectedSocorrista.solicitud.motivo}</p>
              )}
              {selectedSocorrista.solicitud.foto_url && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-yellow-800 mb-2">Nueva Fotografía Solicitada:</p>
                  <div className="flex items-center space-x-4">
                    <img src={selectedSocorrista.solicitud.foto_url} alt="Recortada" className="h-16 w-16 rounded-full object-cover border border-yellow-300" />
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm('¿Aplicar esta nueva fotografía al perfil del socorrista?')) {
                          try {
                            const { error } = await supabase
                              .from('socorristas')
                              .update({ foto_url: selectedSocorrista.solicitud.foto_url })
                              .eq('id', selectedSocorrista.id);
                            if (error) throw error;
                            alert('Fotografía actualizada. Por favor vuelva a seleccionar el socorrista para actualizar la previsualización.');
                            fetchData();
                          } catch (e) {
                            alert('Error al actualizar fotografía.');
                          }
                        }
                      }}
                      className="text-xs font-medium text-white bg-yellow-600 hover:bg-yellow-700 px-3 py-1.5 rounded"
                    >
                      Aprobar Fotografía
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">3. Verificación en línea</h2>
            <div className="space-y-4">
              <p className="text-sm text-gray-500 mb-2">Selecciona qué datos se mostrarán al escanear el QR:</p>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(verificationFields).map(([key, value]) => (
                  <label key={key} className="flex items-center space-x-3 cursor-pointer">
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        className="sr-only" 
                        checked={value} 
                        onChange={() => {
                          const newFields = { ...verificationFields, [key]: !value };
                          setVerificationFields(newFields);
                          saveVerificationConfig(newFields);
                        }} 
                      />
                      <div className={`block w-8 h-5 rounded-full ${value ? 'bg-primary' : 'bg-gray-300'}`}></div>
                      <div className={`dot absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition ${value ? 'transform translate-x-3' : ''}`}></div>
                    </div>
                    <span className="text-xs font-medium text-gray-700">
                      {key === 'showDui' ? 'DUI' : 
                       key === 'showSeccional' ? 'Seccional' : 
                       key === 'showCargoInst' ? 'Cargo Inst.' : 
                       key === 'showCargoAdmin' ? 'Cargo Admin.' : 
                       key === 'showFechaIngreso' ? 'Fecha Ingreso' : 
                       key === 'showTipoSangre' ? 'Tipo Sangre' :
                       key === 'showEmail' ? 'Email' :
                       'Cursos'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
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
        <div className="lg:col-span-2 space-y-6 lg:sticky lg:top-6 self-start">
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

      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900">Plantillas Guardadas</h3>
              <button onClick={() => setShowTemplateModal(false)} className="text-gray-400 hover:text-gray-500">
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[70vh] overflow-y-auto">
              {savedTemplates.length > 0 ? savedTemplates.map(t => (
                <div 
                  key={t.id} 
                  className="group relative border border-gray-200 rounded-lg overflow-hidden hover:border-primary transition-colors cursor-pointer"
                  onClick={() => loadSavedTemplate(t.url)}
                >
                  <div className="w-full h-32 bg-gray-100 flex items-center justify-center p-2 rounded-t-lg">
                    <img 
                      src={t.url} 
                      alt={t.nombre} 
                      className="max-w-full max-h-full object-contain drop-shadow-md bg-white" 
                      crossOrigin="anonymous"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="p-2 bg-white border-t border-gray-200 flex justify-between items-center">
                    <p className="text-xs font-medium text-gray-900 truncate flex-1">{t.nombre}</p>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setPreviewTemplate(t.url); }}
                      className="ml-2 text-gray-400 hover:text-primary"
                      title="Previsualizar"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-5 transition-opacity pointer-events-none"></div>
                </div>
              )) : (
                <div className="col-span-full py-10 text-center text-gray-500">No hay plantillas guardadas</div>
              )}
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
