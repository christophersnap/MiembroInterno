import React, { useState, useRef, useEffect } from 'react';
import { 
  Save, RotateCcw, Check, Type, FileText, Mail, Image as ImageIcon, 
  Sliders, Shield, Eye, GripVertical, ChevronUp, ChevronDown, 
  AlignLeft, AlignCenter, AlignRight, Sparkles, Upload, Database 
} from 'lucide-react';
import { 
  CombustibleConfig, 
  DEFAULT_COMBUSTIBLE_CONFIG, 
  DEFAULT_COMBUSTIBLE_BLOCKS, 
  CombustibleBlockItem, 
  SolicitudCombustible 
} from '../../types/combustible';
import CombustiblePdfModal from './CombustiblePdfModal';
import ImageUploadConfigCard from '../common/ImageUploadConfigCard';
import { supabase } from '../../lib/supabase';
import { getApiUrl } from '../../lib/api';

interface CombustibleTemplateConfigProps {
  config: CombustibleConfig;
  onSave: (newConfig: CombustibleConfig) => Promise<void>;
  saving: boolean;
}

export default function CombustibleTemplateConfig({
  config: initialConfig,
  onSave,
  saving
}: CombustibleTemplateConfigProps) {
  const [currentConfig, setCurrentConfig] = useState<CombustibleConfig>(() => ({
    ...DEFAULT_COMBUSTIBLE_CONFIG,
    ...initialConfig,
    pdfBloquesOrden: (initialConfig?.pdfBloquesOrden && initialConfig.pdfBloquesOrden.length > 0)
      ? initialConfig.pdfBloquesOrden 
      : DEFAULT_COMBUSTIBLE_BLOCKS
  }));

  const isInitializedRef = useRef(false);
  useEffect(() => {
    if (initialConfig && !isInitializedRef.current) {
      isInitializedRef.current = true;
      setCurrentConfig(prev => ({
        ...prev,
        ...initialConfig,
        pdfBloquesOrden: (initialConfig.pdfBloquesOrden && initialConfig.pdfBloquesOrden.length > 0)
          ? initialConfig.pdfBloquesOrden
          : (prev.pdfBloquesOrden && prev.pdfBloquesOrden.length > 0)
          ? prev.pdfBloquesOrden
          : DEFAULT_COMBUSTIBLE_BLOCKS
      }));
    }
  }, [initialConfig]);

  const [activeSubTab, setActiveSubTab] = useState<'disenador' | 'imagenes' | 'pdf' | 'textos' | 'correo'>('disenador');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Auto-guardado inmediato en Supabase
  const handleUpdateAndAutoSave = async (partial: Partial<CombustibleConfig>) => {
    const updated = { ...currentConfig, ...partial };
    setCurrentConfig(updated);
    try {
      await onSave(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.warn('Auto-save error in CombustibleTemplateConfig:', err);
    }
  };

  // Manejo de drag and drop de bloques
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const currentBlocks = currentConfig.pdfBloquesOrden && currentConfig.pdfBloquesOrden.length > 0
      ? currentConfig.pdfBloquesOrden
      : DEFAULT_COMBUSTIBLE_BLOCKS;
    const updatedBlocks = [...currentBlocks];
    const [movedItem] = updatedBlocks.splice(draggedIndex, 1);
    updatedBlocks.splice(targetIndex, 0, movedItem);

    const updated = {
      ...currentConfig,
      pdfBloquesOrden: updatedBlocks
    };
    setCurrentConfig(updated);
    setDraggedIndex(null);
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const currentBlocks = currentConfig.pdfBloquesOrden && currentConfig.pdfBloquesOrden.length > 0
      ? currentConfig.pdfBloquesOrden
      : DEFAULT_COMBUSTIBLE_BLOCKS;
    const blocks = [...currentBlocks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;

    const temp = blocks[index];
    blocks[index] = blocks[targetIndex];
    blocks[targetIndex] = temp;

    const updated = {
      ...currentConfig,
      pdfBloquesOrden: blocks
    };
    setCurrentConfig(updated);
  };

  const toggleBlock = (id: string) => {
    const currentBlocks = currentConfig.pdfBloquesOrden && currentConfig.pdfBloquesOrden.length > 0
      ? currentConfig.pdfBloquesOrden
      : DEFAULT_COMBUSTIBLE_BLOCKS;
    const blocks = currentBlocks.map(b => 
      b.id === id ? { ...b, enabled: !b.enabled } : b
    );
    const updated = { ...currentConfig, pdfBloquesOrden: blocks };
    setCurrentConfig(updated);
  };

  const setBlockAlign = (id: string, align: 'left' | 'center' | 'right') => {
    const currentBlocks = currentConfig.pdfBloquesOrden && currentConfig.pdfBloquesOrden.length > 0
      ? currentConfig.pdfBloquesOrden
      : DEFAULT_COMBUSTIBLE_BLOCKS;
    const blocks = currentBlocks.map(b => 
      b.id === id ? { ...b, align } : b
    );
    const updated = { ...currentConfig, pdfBloquesOrden: blocks };
    setCurrentConfig(updated);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const ext = file.name.split('.').pop() || 'png';
      const cleanName = `logo_combus_header_${Date.now()}.${ext}`;

      // 1. Intentar subir al bucket 'assets' de Supabase
      let uploadRes = await supabase.storage.from('assets').upload(`combustible/${cleanName}`, file, {
        cacheControl: '3600',
        upsert: true
      });

      // 2. Si falla assets, intentar en 'socorristas'
      if (uploadRes.error) {
        uploadRes = await supabase.storage.from('socorristas').upload(`combustible/${cleanName}`, file, {
          cacheControl: '3600',
          upsert: true
        });
        if (!uploadRes.error) {
          const { data } = supabase.storage.from('socorristas').getPublicUrl(`combustible/${cleanName}`);
          if (data?.publicUrl) {
            await handleUpdateAndAutoSave({
              pdfLogoHeaderUrl: data.publicUrl,
              pdfMostrarLogoHeader: true
            });
            return;
          }
        }
      } else {
        const { data } = supabase.storage.from('assets').getPublicUrl(`combustible/${cleanName}`);
        if (data?.publicUrl) {
          await handleUpdateAndAutoSave({
            pdfLogoHeaderUrl: data.publicUrl,
            pdfMostrarLogoHeader: true
          });
          return;
        }
      }

      // 3. Fallback a API local
      const formData = new FormData();
      formData.append('archivo', file);
      const res = await fetch(getApiUrl('/api/upload-file'), {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          await handleUpdateAndAutoSave({
            pdfLogoHeaderUrl: data.url,
            pdfMostrarLogoHeader: true
          });
          return;
        }
      }
    } catch (err) {
      console.warn('Subida directa de logo falló, usando lectura base64 local:', err);
    }

    // 4. Fallback final base64
    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      await handleUpdateAndAutoSave({
        pdfLogoHeaderUrl: result,
        pdfMostrarLogoHeader: true
      });
    };
    reader.readAsDataURL(file);
  };

  const handleReset = () => {
    if (window.confirm('¿Está seguro de restablecer todos los textos y configuraciones a los valores de fábrica?')) {
      setCurrentConfig(DEFAULT_COMBUSTIBLE_CONFIG);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(currentConfig);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // Solicitud de demostración para el modal de vista previa
  const demoSolicitud: SolicitudCombustible = {
    id: 999,
    folio: 'SC-2026-DEMO',
    seccional_id: 1,
    seccional_nombre: 'Santa Anita',
    nombre_solicitante: 'Carlos Hernández',
    director_nombre: 'Ing. Salvador Alvarado',
    actividad: 'Cobertura de emergencias y traslados en turnos 24/7',
    correo_electronico: 'santaanita@cruzverdesv.org',
    telefono_solicitante: '7023-4567',
    entrego_liquidacion_anterior: true,
    estado: 'Aprobada',
    fecha_solicitud: new Date().toISOString().split('T')[0],
    hora_solicitud: '09:45 AM'
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Selector de sub-sección y Botón Previsualizar PDF */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveSubTab('disenador')}
            className={`inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              activeSubTab === 'disenador'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Sliders className="w-4 h-4 mr-1.5" />
            Diseñador Visual y Bloques
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('imagenes')}
            className={`inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'imagenes'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ImageIcon className="w-4 h-4 mr-1.5" />
            Imágenes y Logotipos
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('pdf')}
            className={`inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'pdf'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FileText className="w-4 h-4 mr-1.5" />
            Tipografía y Formato
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('textos')}
            className={`inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'textos'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Type className="w-4 h-4 mr-1.5" />
            Editar Textos y Etiquetas
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('correo')}
            className={`inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'correo'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Mail className="w-4 h-4 mr-1.5" />
            Plantilla de Correo
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            className="inline-flex items-center px-3.5 py-2 border border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg text-xs font-bold transition shadow-2xs"
            title="Previsualizar cómo se verá el PDF final con los ajustes actuales"
          >
            <Eye className="w-4 h-4 mr-1.5 text-emerald-700" />
            Previsualizar PDF
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-medium transition"
            title="Restablecer valores predeterminados"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Restablecer
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-2xs transition disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <>Guardando...</>
            ) : savedSuccess ? (
              <>
                <Check className="w-4 h-4 mr-1.5" />
                ¡Plantilla Guardada!
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-1.5" />
                Guardar Plantilla
              </>
            )}
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        {/* SUBTAB 0: DISEÑADOR VISUAL Y ORDENAMIENTO DE BLOQUES POR ARRASTRE */}
        {activeSubTab === 'disenador' && (
          <div className="space-y-6">
            
            {/* Panel de Colocación de Logo e Imágenes */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">
                      Colocación y Alineación de Logotipos e Imágenes
                    </h3>
                    <p className="text-2xs text-gray-500">
                      Suba o pegue la URL del logo de Cruz Verde y defina su posición y tamaño en el PDF.
                    </p>
                  </div>
                </div>
                <label className="flex items-center space-x-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentConfig.pdfMostrarLogoHeader}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, pdfMostrarLogoHeader: e.target.checked })}
                    className="rounded text-emerald-600"
                  />
                  <span>Mostrar Logo Header</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                <div className="md:col-span-6 space-y-2">
                  <label className="block text-2xs font-bold uppercase text-gray-700">
                    URL de la Imagen o Subir Archivo Local:
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={currentConfig.pdfLogoHeaderUrl}
                      onChange={(e) => setCurrentConfig({ ...currentConfig, pdfLogoHeaderUrl: e.target.value })}
                      placeholder="https://... o dejar vacío para el sello estándar"
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <label className="inline-flex items-center px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg cursor-pointer shrink-0 border border-gray-300 transition">
                      <Upload className="w-3.5 h-3.5 mr-1 text-gray-600" />
                      Subir
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleLogoUpload}
                      />
                    </label>
                  </div>
                </div>

                <div className="md:col-span-3 space-y-2">
                  <label className="block text-2xs font-bold uppercase text-gray-700">
                    Posición en la Hoja:
                  </label>
                  <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setCurrentConfig({ ...currentConfig, pdfLogoPosicion: 'left' })}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center ${
                        (currentConfig.pdfLogoPosicion || 'left') === 'left' ? 'bg-white shadow-2xs text-emerald-700' : 'text-gray-500'
                      }`}
                    >
                      <AlignLeft className="w-3.5 h-3.5 mr-1" /> Izq.
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentConfig({ ...currentConfig, pdfLogoPosicion: 'center' })}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center ${
                        currentConfig.pdfLogoPosicion === 'center' ? 'bg-white shadow-2xs text-emerald-700' : 'text-gray-500'
                      }`}
                    >
                      <AlignCenter className="w-3.5 h-3.5 mr-1" /> Cent.
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentConfig({ ...currentConfig, pdfLogoPosicion: 'right' })}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center ${
                        currentConfig.pdfLogoPosicion === 'right' ? 'bg-white shadow-2xs text-emerald-700' : 'text-gray-500'
                      }`}
                    >
                      <AlignRight className="w-3.5 h-3.5 mr-1" /> Der.
                    </button>
                  </div>
                </div>

                <div className="md:col-span-3 space-y-2">
                  <label className="block text-2xs font-bold uppercase text-gray-700">
                    Tamaño del Logo:
                  </label>
                  <select
                    value={currentConfig.pdfLogoSize || 'medium'}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, pdfLogoSize: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none bg-white font-medium"
                  >
                    <option value="small">Pequeño (48px / 1.2 in)</option>
                    <option value="medium">Mediano (64px / 1.6 in)</option>
                    <option value="large">Grande (80px / 2.0 in)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Organizador de Secciones por Arrastre (Drag and Drop) */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <GripVertical className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">
                      Disposición y Orden de Textos/Bloques por Arrastre
                    </h3>
                    <p className="text-2xs text-gray-500">
                      Arrastre con el mouse cada bloque hacia arriba o abajo para reordenarlo en el documento PDF final.
                    </p>
                  </div>
                </div>
                <span className="text-2xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full self-start sm:self-auto">
                  Arrastre activo
                </span>
              </div>

              <div className="space-y-2.5">
                {(currentConfig.pdfBloquesOrden && currentConfig.pdfBloquesOrden.length > 0 ? currentConfig.pdfBloquesOrden : DEFAULT_COMBUSTIBLE_BLOCKS).map((bloque, index) => (
                  <div
                    key={bloque.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={() => handleDrop(index)}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all select-none cursor-move ${
                      draggedIndex === index
                        ? 'border-emerald-500 bg-emerald-50 opacity-60'
                        : bloque.enabled
                        ? 'border-gray-200 bg-white hover:border-emerald-300 hover:shadow-xs'
                        : 'border-gray-200 bg-gray-50 opacity-60'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="text-gray-400 hover:text-gray-600">
                        <GripVertical className="w-5 h-5" />
                      </div>
                      <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs font-bold ${bloque.enabled ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                            {bloque.name}
                          </span>
                        </div>
                        {bloque.description && (
                          <p className="text-3xs text-gray-400 mt-0.5">
                            {bloque.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                      {/* Alineación */}
                      <div className="flex items-center bg-gray-100 p-0.5 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setBlockAlign(bloque.id, 'left')}
                          className={`p-1 rounded ${bloque.align === 'left' ? 'bg-white shadow-2xs text-emerald-700' : 'text-gray-400'}`}
                          title="Alinear texto a la izquierda"
                        >
                          <AlignLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setBlockAlign(bloque.id, 'center')}
                          className={`p-1 rounded ${bloque.align === 'center' ? 'bg-white shadow-2xs text-emerald-700' : 'text-gray-400'}`}
                          title="Centrar contenido"
                        >
                          <AlignCenter className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setBlockAlign(bloque.id, 'right')}
                          className={`p-1 rounded ${bloque.align === 'right' ? 'bg-white shadow-2xs text-emerald-700' : 'text-gray-400'}`}
                          title="Alinear a la derecha"
                        >
                          <AlignRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Flechas mover */}
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => moveBlock(index, 'up')}
                          className="p-1 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-30"
                          title="Subir posición"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={index === ((currentConfig.pdfBloquesOrden && currentConfig.pdfBloquesOrden.length > 0 ? currentConfig.pdfBloquesOrden : DEFAULT_COMBUSTIBLE_BLOCKS).length - 1)}
                          onClick={() => moveBlock(index, 'down')}
                          className="p-1 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-30"
                          title="Bajar posición"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Toggle On/Off */}
                      <button
                        type="button"
                        onClick={() => toggleBlock(bloque.id)}
                        className={`px-2.5 py-1 rounded-lg text-2xs font-bold transition ${
                          bloque.enabled
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                      >
                        {bloque.enabled ? 'Visible' : 'Oculto'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* SUBTAB 1: FORMATO PDF, TIPOGRAFÍA E IMÁGENES */}
        {activeSubTab === 'pdf' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 space-y-6 shadow-2xs">
            <div className="border-b border-gray-100 pb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center">
                <Sliders className="w-5 h-5 text-emerald-600 mr-2" />
                Estilo Visual del Documento PDF (Documento Oficial)
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Ajuste la fuente, escala de tamaño, código de formulario y logos institucionales.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Tipografía */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Tipografía del Documento:
                </label>
                <select
                  value={currentConfig.pdfFontFamily}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, pdfFontFamily: e.target.value as any })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-medium"
                >
                  <option value="sans">Sans-Serif (Moderna, limpia, estándar)</option>
                  <option value="serif">Serif (Institucional, formal, tradicional)</option>
                  <option value="mono">Monospace (Técnica / Código)</option>
                </select>
                <span className="text-3xs text-gray-400 mt-1 block">
                  Afecta todo el texto del documento PDF generado.
                </span>
              </div>

              {/* Tamaño de Fuente */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Tamaño de Texto General:
                </label>
                <select
                  value={currentConfig.pdfFontSize}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, pdfFontSize: e.target.value as any })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-medium"
                >
                  <option value="small">Compacto (Letra pequeña - 12px)</option>
                  <option value="normal">Estándar (Recomendado - 14px)</option>
                  <option value="large">Grande (16px)</option>
                </select>
                <span className="text-3xs text-gray-400 mt-1 block">
                  Permite ajustar la densidad de la página tamaño carta.
                </span>
              </div>

              {/* Código de Formulario */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Código de Formulario (Pie de Página):
                </label>
                <input
                  type="text"
                  value={currentConfig.pdfCodigoFormulario}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, pdfCodigoFormulario: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                  placeholder="CVSCOMBUS/FORM001"
                />
              </div>

              {/* Título Principal */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Título Institucional Encabezado:
                </label>
                <input
                  type="text"
                  value={currentConfig.pdfTitulo}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, pdfTitulo: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-semibold"
                />
              </div>

              {/* Subtítulo de la Hoja */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Subtítulo / Nombre del Formulario:
                </label>
                <input
                  type="text"
                  value={currentConfig.pdfSubtitulo}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, pdfSubtitulo: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-semibold"
                />
              </div>

              {/* Marca de Agua */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-gray-700">
                    Marca de Agua Diagonal:
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={currentConfig.pdfWatermark}
                      onChange={(e) => setCurrentConfig({ ...currentConfig, pdfWatermark: e.target.checked })}
                      className="rounded text-emerald-600"
                    />
                    <span>Habilitada</span>
                  </label>
                </div>
                <input
                  type="text"
                  disabled={!currentConfig.pdfWatermark}
                  value={currentConfig.pdfWatermarkText}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, pdfWatermarkText: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-40"
                  placeholder="CRUZ VERDE SALVADOREÑA - COMBUSTIBLE"
                />
                <div className="flex items-center space-x-2 mt-2">
                  <span className="text-3xs text-gray-500">Opacidad:</span>
                  <input
                    type="range"
                    min="0.02"
                    max="0.25"
                    step="0.01"
                    disabled={!currentConfig.pdfWatermark}
                    value={currentConfig.pdfWatermarkOpacity}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, pdfWatermarkOpacity: e.target.value })}
                    className="flex-1"
                  />
                  <span className="text-3xs font-mono font-bold text-gray-700">
                    {Math.round(Number(currentConfig.pdfWatermarkOpacity) * 100)}%
                  </span>
                </div>
              </div>

            </div>

            {/* Configuración de Imágenes y Logos */}
            <div className="pt-4 border-t border-gray-100 space-y-4">
              <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center">
                <ImageIcon className="w-4 h-4 mr-1.5 text-emerald-600" />
                Imágenes y Logotipos del Documento
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Logo Header */}
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-800">Logo Superior (Encabezado)</span>
                    <label className="flex items-center space-x-1.5 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={currentConfig.pdfMostrarLogoHeader}
                        onChange={(e) => setCurrentConfig({ ...currentConfig, pdfMostrarLogoHeader: e.target.checked })}
                        className="rounded text-emerald-600"
                      />
                      <span>Mostrar</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={currentConfig.pdfLogoHeaderUrl}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, pdfLogoHeaderUrl: e.target.value })}
                    placeholder="URL de imagen o dejar en blanco para logo estándar"
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg outline-none bg-white"
                  />
                </div>

                {/* Logo Footer */}
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-800">Logo Inferior (Pie de Página)</span>
                    <label className="flex items-center space-x-1.5 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={currentConfig.pdfMostrarLogoFooter}
                        onChange={(e) => setCurrentConfig({ ...currentConfig, pdfMostrarLogoFooter: e.target.checked })}
                        className="rounded text-emerald-600"
                      />
                      <span>Mostrar</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={currentConfig.pdfLogoFooterUrl}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, pdfLogoFooterUrl: e.target.value })}
                    placeholder="URL de imagen o dejar en blanco para emblema estándar"
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg outline-none bg-white"
                  />
                </div>

              </div>
            </div>

          </div>
        )}

        {/* SUBTAB IMÁGENES: GESTIÓN INDIVIDUAL DE IMÁGENES Y SELLOS */}
        {activeSubTab === 'imagenes' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 space-y-6 shadow-2xs">
            <div className="border-b border-gray-100 pb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center">
                  <ImageIcon className="w-5 h-5 text-emerald-600 mr-2" />
                  Gestión Individual de Imágenes, Logotipos y Sellos
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Suba archivos de imagen desde su dispositivo o ingrese URL. Defina individualmente en qué parte de la hoja colocar cada imagen (Izquierda, Centro, Derecha) o dejar el espacio en blanco.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowPreviewModal(true)}
                className="inline-flex items-center px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
              >
                <Eye className="w-4 h-4 mr-1.5" />
                Previsualizar en PDF
              </button>
            </div>

            <div className="space-y-4">
              {/* 1. Logotipo Principal */}
              <ImageUploadConfigCard
                title="1. Logotipo Principal (Encabezado Superior)"
                subtitle="Escudo oficial que encabeza la solicitud de combustible"
                imageUrl={currentConfig.pdfLogoHeaderUrl}
                position={currentConfig.pdfLogoPosicion || 'left'}
                size={currentConfig.pdfLogoSize || 'medium'}
                visible={currentConfig.pdfMostrarLogoHeader}
                onImageChange={(url) => handleUpdateAndAutoSave({ pdfLogoHeaderUrl: url, pdfMostrarLogoHeader: Boolean(url) })}
                onPositionChange={(pos) => handleUpdateAndAutoSave({ pdfLogoPosicion: pos })}
                onSizeChange={(size) => handleUpdateAndAutoSave({ pdfLogoSize: size })}
                onVisibilityChange={(visible) => handleUpdateAndAutoSave({ pdfMostrarLogoHeader: visible })}
                defaultPlaceholderText="Cruz Verde Salvadoreña"
                defaultLogoName="Escudo Oficial Cruz Verde"
              />

              {/* 2. Logotipo Secundario */}
              <ImageUploadConfigCard
                title="2. Logotipo Secundario / Cooperante (Encabezado)"
                subtitle="Segundo logotipo o distintivo para la parte superior de la hoja"
                imageUrl={currentConfig.pdfLogoSecundarioUrl}
                position={currentConfig.pdfLogoSecundarioPosicion || 'right'}
                size={currentConfig.pdfLogoSecundarioSize || 'medium'}
                visible={currentConfig.pdfMostrarLogoSecundario || false}
                onImageChange={(url) => handleUpdateAndAutoSave({ pdfLogoSecundarioUrl: url, pdfMostrarLogoSecundario: Boolean(url) })}
                onPositionChange={(pos) => handleUpdateAndAutoSave({ pdfLogoSecundarioPosicion: pos })}
                onSizeChange={(size) => handleUpdateAndAutoSave({ pdfLogoSecundarioSize: size })}
                onVisibilityChange={(visible) => handleUpdateAndAutoSave({ pdfMostrarLogoSecundario: visible })}
                defaultPlaceholderText="Logo Secundario / Cooperante"
                defaultLogoName="Sin logo secundario por defecto"
              />

              {/* 3. Sello Oficial / Firmas */}
              <ImageUploadConfigCard
                title="3. Sello Oficial o Sello con Firma Digitalizada"
                subtitle="Imagen del sello húmedo de la seccional para el pie de autorización"
                imageUrl={currentConfig.pdfSelloImgUrl}
                position={currentConfig.pdfSelloImgPosicion || 'center'}
                size={currentConfig.pdfSelloImgSize || 'medium'}
                visible={currentConfig.pdfMostrarSelloImg || false}
                onImageChange={(url) => handleUpdateAndAutoSave({ 
                  pdfSelloImgUrl: url, 
                  pdfMostrarSelloImg: Boolean(url) 
                })}
                onPositionChange={(pos) => handleUpdateAndAutoSave({ pdfSelloImgPosicion: pos })}
                onSizeChange={(size) => handleUpdateAndAutoSave({ pdfSelloImgSize: size })}
                onVisibilityChange={(visible) => handleUpdateAndAutoSave({ 
                  pdfMostrarSelloImg: visible 
                })}
                defaultPlaceholderText="Sello Cruz Verde Salvadoreña"
                defaultLogoName="Sello Oficial"
              />

              {/* 4. Cintillo o Pie de Página */}
              <ImageUploadConfigCard
                title="4. Cintillo o Imagen de Pie de Página (Footer)"
                subtitle="Banda inferior con contactos institucionales, lema o certificaciones"
                imageUrl={currentConfig.pdfLogoFooterUrl}
                position={currentConfig.pdfFooterImgPosicion || 'center'}
                size={currentConfig.pdfFooterImgSize || 'medium'}
                visible={currentConfig.pdfMostrarLogoFooter}
                onImageChange={(url) => handleUpdateAndAutoSave({ pdfLogoFooterUrl: url, pdfMostrarLogoFooter: Boolean(url) })}
                onPositionChange={(pos) => handleUpdateAndAutoSave({ pdfFooterImgPosicion: pos })}
                onSizeChange={(size) => handleUpdateAndAutoSave({ pdfFooterImgSize: size })}
                onVisibilityChange={(visible) => handleUpdateAndAutoSave({ pdfMostrarLogoFooter: visible })}
                defaultPlaceholderText="Cintillo Oficial Cruz Verde"
                defaultLogoName="Sin cintillo por defecto"
              />
            </div>

            {/* Información de almacenamiento SQL */}
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-gray-900">
                    Almacenamiento Persistente en Base de Datos (SQL)
                  </h5>
                  <p className="text-3xs text-gray-500">
                    Las imágenes se guardan de forma persistente en la tabla <code className="bg-gray-200 px-1 py-0.5 rounded font-mono text-gray-800">public.configuracion</code> de Supabase.
                  </p>
                </div>
              </div>
              <span className="text-2xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                Sincronización Automática
              </span>
            </div>

            <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setActiveSubTab('disenador')}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50 transition"
              >
                Volver al Diseñador
              </button>

              <button
                type="button"
                onClick={() => onSave(currentConfig)}
                disabled={saving}
                className="inline-flex items-center px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Guardando...' : 'Guardar Imágenes y Posiciones'}
              </button>
            </div>
          </div>
        )}

        {/* SUBTAB 2: EDICIÓN DE TODOS LOS TEXTOS Y ETIQUETAS DEL PDF */}
        {activeSubTab === 'textos' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 space-y-6 shadow-2xs">
            <div className="border-b border-gray-100 pb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center">
                <Type className="w-5 h-5 text-emerald-600 mr-2" />
                Edición de Textos y Rótulos de Campos del Documento
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Personalice cada una de las etiquetas que aparecen en el PDF oficial según requerimientos institucionales.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Etiqueta: Solicitante
                </label>
                <input
                  type="text"
                  value={currentConfig.pdfLabelSolicitante}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, pdfLabelSolicitante: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Etiqueta: Seccional
                </label>
                <input
                  type="text"
                  value={currentConfig.pdfLabelSeccional}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, pdfLabelSeccional: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Etiqueta: Director Seccional
                </label>
                <input
                  type="text"
                  value={currentConfig.pdfLabelDirector}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, pdfLabelDirector: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Etiqueta: Actividad / Eventualidad
                </label>
                <input
                  type="text"
                  value={currentConfig.pdfLabelActividad}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, pdfLabelActividad: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Etiqueta: Correo Electrónico
                </label>
                <input
                  type="text"
                  value={currentConfig.pdfLabelCorreo}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, pdfLabelCorreo: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Etiqueta: Teléfono / Contacto
                </label>
                <input
                  type="text"
                  value={currentConfig.pdfLabelContacto}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, pdfLabelContacto: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Etiqueta: Pregunta de Liquidación
                </label>
                <input
                  type="text"
                  value={currentConfig.pdfLabelLiquidacion}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, pdfLabelLiquidacion: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Etiqueta: Motivo de No Liquidación
                </label>
                <input
                  type="text"
                  value={currentConfig.pdfLabelMotivo}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, pdfLabelMotivo: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Etiqueta: Observaciones
                </label>
                <input
                  type="text"
                  value={currentConfig.pdfLabelObservaciones}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, pdfLabelObservaciones: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none"
                />
              </div>
            </div>

            {/* Textos de la Sección de Firmas */}
            <div className="pt-4 border-t border-gray-100 space-y-4">
              <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                Rótulos y Textos del Bloque de Firmas
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Título Cuadro 1: Solicitante
                  </label>
                  <input
                    type="text"
                    value={currentConfig.pdfLabelFirmaSolicitante}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, pdfLabelFirmaSolicitante: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Título Cuadro 2: Administración
                  </label>
                  <input
                    type="text"
                    value={currentConfig.pdfLabelFirmaAdmin}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, pdfLabelFirmaAdmin: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Rótulo: DUI
                  </label>
                  <input
                    type="text"
                    value={currentConfig.pdfLabelDui}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, pdfLabelDui: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Rótulo: Firma y Sello
                  </label>
                  <input
                    type="text"
                    value={currentConfig.pdfLabelFirmaSello}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, pdfLabelFirmaSello: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Rótulo: Nombre Quién Autoriza
                  </label>
                  <input
                    type="text"
                    value={currentConfig.pdfLabelAutoriza}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, pdfLabelAutoriza: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Rótulo: Fecha de Autorización
                  </label>
                  <input
                    type="text"
                    value={currentConfig.pdfLabelFechaAuto}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, pdfLabelFechaAuto: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none"
                  />
                </div>
              </div>
            </div>

          </div>
        )}

        {/* SUBTAB 3: PLANTILLA DE CORREO Y DESTINATARIOS */}
        {activeSubTab === 'correo' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 space-y-6 shadow-2xs">
            <div className="border-b border-gray-100 pb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center">
                <Mail className="w-5 h-5 text-emerald-600 mr-2" />
                Plantilla de Correo Electrónico y Destinatarios en Copia
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Configure a quiénes se les remitirá la copia automática y los textos del mensaje recibido (Imagen 2).
              </p>
            </div>

            <div className="space-y-4">
              
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Correo Principal de Destino (Control de Combustible):
                </label>
                <input
                  type="email"
                  value={currentConfig.correoDestino}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, correoDestino: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="control_combustible@cruzverdesv.org"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Correos en Copia por Defecto (CC: separados por coma):
                </label>
                <input
                  type="text"
                  value={currentConfig.correoCcDefault}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, correoCcDefault: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="presidencia@cruzverdesv.org, administracion@cruzverdesv.org"
                />
                <span className="text-3xs text-gray-400">
                  Todas las solicitudes generadas enviarán copia a estas direcciones institucionales.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Teléfono / WhatsApp de Contacto para Consultas:
                </label>
                <input
                  type="text"
                  value={currentConfig.correoContactoTelefono}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, correoContactoTelefono: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="7695-7911"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Plantilla del Asunto del Correo:
                </label>
                <input
                  type="text"
                  value={currentConfig.asuntoPlantilla}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, asuntoPlantilla: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                />
                <span className="text-3xs text-gray-400">
                  Variables disponibles: [SOLICITANTE], [SECCIONAL], [FECHA], [DIRECTOR], [FOLIO]
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Texto de Pie de Página de Contacto:
                </label>
                <textarea
                  rows={2}
                  value={currentConfig.correoFooterTexto}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, correoFooterTexto: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center space-x-2 cursor-pointer text-xs font-semibold text-gray-800">
                  <input
                    type="checkbox"
                    checked={currentConfig.enviarCopiaSolicitante}
                    onChange={(e) => setCurrentConfig({ ...currentConfig, enviarCopiaSolicitante: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Enviar copia automática de confirmación al correo del solicitante</span>
                </label>
              </div>

            </div>
          </div>
        )}

        {/* Botón flotante o inferior para guardar */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center px-8 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <>Guardando cambios...</>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Guardar Plantilla y Configuración
              </>
            )}
          </button>
        </div>

      </form>

      {/* Modal de Previsualización en Vivo de PDF */}
      {showPreviewModal && (
        <CombustiblePdfModal
          solicitud={demoSolicitud}
          config={currentConfig}
          onClose={() => setShowPreviewModal(false)}
        />
      )}
    </div>
  );
}
