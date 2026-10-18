import React, { useState } from 'react';
import { 
  Save, RotateCcw, Check, Type, FileText, Mail, Image as ImageIcon, 
  Sliders, Shield, Eye, GripVertical, ChevronUp, ChevronDown, 
  AlignLeft, AlignCenter, AlignRight, CheckCircle2, Sparkles, Upload, Database
} from 'lucide-react';
import { CompraConfig, DEFAULT_COMPRA_CONFIG, DEFAULT_COMPRA_BLOCKS, CompraBlockItem } from '../../types/compra';
import CompraPdfPreviewModal from './CompraPdfPreviewModal';
import ImageUploadConfigCard from '../common/ImageUploadConfigCard';

interface CompraTemplateConfigProps {
  config: CompraConfig;
  onSave: (newConfig: CompraConfig) => Promise<void>;
  saving: boolean;
}

export default function CompraTemplateConfig({
  config: initialConfig,
  onSave,
  saving
}: CompraTemplateConfigProps) {
  const [currentConfig, setCurrentConfig] = useState<CompraConfig>(() => {
    // Asegurar que pdfBloquesOrden esté inicializado
    return {
      ...DEFAULT_COMPRA_CONFIG,
      ...initialConfig,
      pdfBloquesOrden: initialConfig?.pdfBloquesOrden?.length 
        ? initialConfig.pdfBloquesOrden 
        : DEFAULT_COMPRA_BLOCKS
    };
  });

  const [activeSubTab, setActiveSubTab] = useState<'disenador' | 'imagenes' | 'pdf' | 'textos' | 'correo'>('disenador');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Manejo de drag and drop de bloques
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const updatedBlocks = [...currentConfig.pdfBloquesOrden];
    const [movedItem] = updatedBlocks.splice(draggedIndex, 1);
    updatedBlocks.splice(targetIndex, 0, movedItem);

    setCurrentConfig({
      ...currentConfig,
      pdfBloquesOrden: updatedBlocks
    });
    setDraggedIndex(null);
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentConfig.pdfBloquesOrden.length) return;

    const updatedBlocks = [...currentConfig.pdfBloquesOrden];
    const [movedItem] = updatedBlocks.splice(index, 1);
    updatedBlocks.splice(targetIndex, 0, movedItem);

    setCurrentConfig({
      ...currentConfig,
      pdfBloquesOrden: updatedBlocks
    });
  };

  const toggleBlock = (index: number) => {
    const updatedBlocks = [...currentConfig.pdfBloquesOrden];
    updatedBlocks[index] = {
      ...updatedBlocks[index],
      enabled: !updatedBlocks[index].enabled
    };
    setCurrentConfig({
      ...currentConfig,
      pdfBloquesOrden: updatedBlocks
    });
  };

  const changeBlockAlign = (index: number, align: 'left' | 'center' | 'right') => {
    const updatedBlocks = [...currentConfig.pdfBloquesOrden];
    updatedBlocks[index] = {
      ...updatedBlocks[index],
      align
    };
    setCurrentConfig({
      ...currentConfig,
      pdfBloquesOrden: updatedBlocks
    });
  };

  const handleReset = () => {
    if (window.confirm('¿Está seguro de restablecer todos los textos, imágenes y orden de bloques a los valores predeterminados de Cruz Verde?')) {
      setCurrentConfig(DEFAULT_COMPRA_CONFIG);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await onSave(currentConfig);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in">
      
      {/* Selector de sub-secciones y acciones principales */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          
          <button
            type="button"
            onClick={() => setActiveSubTab('disenador')}
            className={`inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeSubTab === 'disenador'
                ? 'bg-primary text-white shadow-2xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Sparkles className="w-4 h-4 mr-1.5 text-amber-300" />
            Diseñador Visual y Bloques
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('imagenes')}
            className={`inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeSubTab === 'imagenes'
                ? 'bg-primary text-white shadow-2xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ImageIcon className="w-4 h-4 mr-1.5 text-emerald-400" />
            Imágenes y Logotipos (Subir / Posición)
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('pdf')}
            className={`inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeSubTab === 'pdf'
                ? 'bg-primary text-white shadow-2xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Sliders className="w-4 h-4 mr-1.5" />
            Estilo y Tipografía
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('textos')}
            className={`inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeSubTab === 'textos'
                ? 'bg-primary text-white shadow-2xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Type className="w-4 h-4 mr-1.5" />
            Editar Textos y Etiquetas PDF
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('correo')}
            className={`inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeSubTab === 'correo'
                ? 'bg-primary text-white shadow-2xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Mail className="w-4 h-4 mr-1.5" />
            Plantilla de Correo
          </button>
        </div>

        {/* Acciones: Previsualizar, Reset, Guardar */}
        <div className="flex items-center space-x-2">
          
          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer"
            title="Previsualizar documento PDF en tamaño carta completo"
          >
            <Eye className="w-4 h-4 mr-1.5" />
            Previsualizar PDF
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-medium transition cursor-pointer"
            title="Restablecer valores predeterminados"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Restablecer
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-5 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-2xs transition disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <>Guardando...</>
            ) : savedSuccess ? (
              <>
                <Check className="w-4 h-4 mr-1.5 text-emerald-300" />
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

      {/* ========================================================================= */}
      {/* SUB-PESTAÑA 1: DISEÑADOR VISUAL Y COLOCACIÓN POR ARRASTRE (DRAG & DROP)    */}
      {/* ========================================================================= */}
      {activeSubTab === 'disenador' && (
        <div className="space-y-6">
          
          {/* Banner de Instrucciones */}
          <div className="bg-linear-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Organizador Visual de Bloques y Logos para PDF
                </h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  Arrastre los bloques hacia arriba o abajo para cambiar la posición de los textos en la hoja oficial del PDF. Puede activar/ocultar elementos y definir su alineación.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPreviewModal(true)}
              className="inline-flex items-center px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-sm transition whitespace-nowrap"
            >
              <Eye className="w-4 h-4 mr-1.5" />
              Ver Previsualización Completa
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Columna Izquierda: Bloques Arrastrables (7 cols) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 p-6 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center">
                  <GripVertical className="w-4 h-4 mr-1.5 text-primary" />
                  Orden de Secciones y Textos en el Documento (Arrastre aquí)
                </h4>
                <span className="text-3xs text-gray-400 font-medium">
                  {currentConfig.pdfBloquesOrden.filter(b => b.enabled).length} de {currentConfig.pdfBloquesOrden.length} activos
                </span>
              </div>

              {/* Lista de Bloques con Soporte de Arrastre */}
              <div className="space-y-2.5">
                {currentConfig.pdfBloquesOrden.map((bloque, idx) => (
                  <div
                    key={bloque.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={() => handleDrop(idx)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all select-none ${
                      bloque.enabled 
                        ? 'bg-gray-50/80 border-gray-200 hover:border-primary/40 hover:bg-white hover:shadow-xs' 
                        : 'bg-gray-100/60 border-gray-200 opacity-60'
                    } ${draggedIndex === idx ? 'border-primary bg-primary/5 shadow-md scale-[1.01]' : ''}`}
                  >
                    {/* Handle de arrastre y datos */}
                    <div className="flex items-center space-x-3 flex-1 min-w-0 cursor-grab active:cursor-grabbing">
                      <div className="text-gray-400 hover:text-primary transition p-1">
                        <GripVertical className="w-4 h-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-gray-900 truncate">
                            {bloque.name}
                          </span>
                          <span className="text-3xs font-semibold px-2 py-0.5 rounded bg-gray-200 text-gray-700">
                            Posición #{idx + 1}
                          </span>
                        </div>
                        {bloque.description && (
                          <p className="text-3xs text-gray-500 truncate mt-0.5">
                            {bloque.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Controles de Alineación, Flechas y Activar/Desactivar */}
                    <div className="flex items-center space-x-1.5 shrink-0 pl-2">
                      
                      {/* Alineación */}
                      <div className="flex items-center bg-gray-200/70 p-0.5 rounded-lg">
                        <button
                          type="button"
                          onClick={() => changeBlockAlign(idx, 'left')}
                          className={`p-1 rounded text-xs ${bloque.align === 'left' ? 'bg-white text-primary shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-800'}`}
                          title="Alinear a la izquierda"
                        >
                          <AlignLeft className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => changeBlockAlign(idx, 'center')}
                          className={`p-1 rounded text-xs ${bloque.align === 'center' ? 'bg-white text-primary shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-800'}`}
                          title="Centrar texto"
                        >
                          <AlignCenter className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => changeBlockAlign(idx, 'right')}
                          className={`p-1 rounded text-xs ${bloque.align === 'right' ? 'bg-white text-primary shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-800'}`}
                          title="Alinear a la derecha"
                        >
                          <AlignRight className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Flechas mover arriba / abajo */}
                      <button
                        type="button"
                        onClick={() => moveBlock(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 rounded"
                        title="Subir bloque"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => moveBlock(idx, 'down')}
                        disabled={idx === currentConfig.pdfBloquesOrden.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 rounded"
                        title="Bajar bloque"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>

                      {/* Toggle de activación */}
                      <label className="relative inline-flex items-center cursor-pointer ml-1">
                        <input
                          type="checkbox"
                          checked={bloque.enabled}
                          onChange={() => toggleBlock(idx)}
                          className="sr-only peer"
                        />
                        <div className="w-7 h-4 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              {/* Acceso rápido y resumen a Gestión de Imágenes */}
              <div className="pt-4 border-t border-gray-100">
                <div className="p-4 bg-emerald-50/80 rounded-2xl border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900">
                        Gestión Individual de Imágenes y Sellos
                      </h4>
                      <p className="text-3xs text-gray-600">
                        Suba logos, sellos oficiales o cintillos y configure individualmente si van a la Izquierda, Centro, Derecha o En blanco.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('imagenes')}
                    className="inline-flex items-center px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-2xs transition cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    Configurar Imágenes
                  </button>
                </div>
              </div>
            </div>

            {/* Columna Derecha: Vista Previa en Vivo de la Hoja (5 cols) */}
            <div className="lg:col-span-5 space-y-4 sticky top-6">
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <span className="text-xs font-bold text-gray-800 flex items-center">
                    <Eye className="w-4 h-4 mr-1.5 text-primary" />
                    Vista Previa en Vivo (Hoja Carta)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPreviewModal(true)}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Ampliar pantalla completa
                  </button>
                </div>

                {/* Hoja mini escalada interactiva */}
                <div className="bg-gray-200/70 p-3 rounded-xl flex justify-center">
                  <div className="w-full bg-white shadow-md p-4 rounded-lg text-3xs border border-gray-300 space-y-2.5 max-h-[560px] overflow-y-auto">
                    
                    {/* Render dinámico de bloques en la mini hoja */}
                    {currentConfig.pdfBloquesOrden.filter(b => b.enabled).map((bloque) => {
                      const alignClass = bloque.align === 'center' ? 'text-center' : bloque.align === 'right' ? 'text-right' : 'text-left';
                      
                      return (
                        <div 
                          key={bloque.id} 
                          className={`p-2 rounded border border-dashed border-gray-300 bg-gray-50/70 ${alignClass}`}
                        >
                          <div className="font-bold text-gray-800 uppercase tracking-wider text-4xs">
                            {bloque.name}
                          </div>
                          
                          {bloque.id === 'encabezado' && (
                            <div className="mt-1 space-y-1">
                              {/* Logos con posición individual en mini hoja */}
                              <div className="flex items-center justify-between gap-1">
                                {currentConfig.pdfMostrarLogo && currentConfig.pdfLogoPosicion !== 'none' && (
                                  <div className={`flex w-full ${
                                    currentConfig.pdfLogoPosicion === 'center' ? 'justify-center' : currentConfig.pdfLogoPosicion === 'right' ? 'justify-end' : 'justify-start'
                                  }`}>
                                    {currentConfig.pdfLogoUrl ? (
                                      <img 
                                        src={currentConfig.pdfLogoUrl} 
                                        alt="Logo 1" 
                                        className="h-6 object-contain rounded-xs" 
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <div className="w-5 h-5 rounded-full border border-green-800 flex items-center justify-center font-black text-green-800 text-3xs bg-white">
                                        +
                                      </div>
                                    )}
                                  </div>
                                )}
                                {currentConfig.pdfMostrarLogoSecundario && currentConfig.pdfLogoSecundarioUrl && currentConfig.pdfLogoSecundarioPosicion !== 'none' && (
                                  <div className={`flex ${
                                    currentConfig.pdfLogoSecundarioPosicion === 'center' ? 'justify-center' : currentConfig.pdfLogoSecundarioPosicion === 'left' ? 'justify-start' : 'justify-end'
                                  }`}>
                                    <img 
                                      src={currentConfig.pdfLogoSecundarioUrl} 
                                      alt="Logo 2" 
                                      className="h-6 object-contain rounded-xs" 
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                )}
                              </div>
                              <span className="font-extrabold text-gray-900 block text-2xs">{currentConfig.pdfTitulo}</span>
                              <span className="text-3xs text-green-800 font-bold block">{currentConfig.pdfDepartamento}</span>
                            </div>
                          )}

                          {bloque.id === 'subtitulo_folio' && (
                            <div className="mt-0.5 flex justify-between items-center text-3xs">
                              <span className="bg-gray-200 px-1 py-0.5 rounded font-bold">{currentConfig.pdfSubtitulo}</span>
                              <span className="font-mono text-gray-600">FOLIO: SC-2026-0001</span>
                            </div>
                          )}

                          {bloque.id === 'firmas_sello' && (
                            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-4xs pt-1 border-t border-gray-200 items-center">
                              <div>{currentConfig.pdfFirma1Titulo}</div>
                              <div>
                                {currentConfig.pdfMostrarSelloImg && currentConfig.pdfSelloImgUrl && currentConfig.pdfSelloImgPosicion !== 'none' ? (
                                  <img 
                                    src={currentConfig.pdfSelloImgUrl} 
                                    alt="Sello" 
                                    className="h-7 mx-auto object-contain" 
                                    referrerPolicy="no-referrer"
                                  />
                                ) : currentConfig.pdfMostrarSello ? (
                                  <div className="w-6 h-6 rounded-full border border-green-800 mx-auto flex items-center justify-center font-bold text-green-800 text-3xs">
                                    +
                                  </div>
                                ) : (
                                  <span className="text-gray-400 italic">[En blanco]</span>
                                )}
                                <span className="font-bold text-green-800 block text-4xs mt-0.5">Sello</span>
                              </div>
                              <div>{currentConfig.pdfFirma2Titulo}</div>
                            </div>
                          )}

                          {bloque.id === 'pie_pagina' && (
                            <div className="mt-1 space-y-0.5">
                              {currentConfig.pdfMostrarFooterImg && currentConfig.pdfFooterImgUrl && currentConfig.pdfFooterImgPosicion !== 'none' && (
                                <div className={`flex w-full ${
                                  currentConfig.pdfFooterImgPosicion === 'center' ? 'justify-center' : currentConfig.pdfFooterImgPosicion === 'right' ? 'justify-end' : 'justify-start'
                                }`}>
                                  <img 
                                    src={currentConfig.pdfFooterImgUrl} 
                                    alt="Footer" 
                                    className="h-4 object-contain" 
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              )}
                              <div className="text-4xs text-gray-500 truncate">{currentConfig.pdfPiePagina}</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full inline-flex items-center justify-center px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Guardando...' : 'Guardar Posiciones y Plantilla'}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-PESTAÑA 2: GESTIÓN DE IMÁGENES Y SELLOS INDIVIDUALES EN HOJA           */}
      {/* ========================================================================= */}
      {activeSubTab === 'imagenes' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 space-y-6 shadow-2xs">
          <div className="border-b border-gray-100 pb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center">
                <ImageIcon className="w-5 h-5 text-emerald-600 mr-2" />
                Gestión Individual de Imágenes, Logotipos y Sellos
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Suba archivos de imagen desde su equipo o ingrese URL. Defina individualmente en qué parte de la hoja colocar cada imagen (Izquierda, Centro, Derecha) o dejar el espacio en blanco.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setShowPreviewModal(true)}
                className="inline-flex items-center px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
              >
                <Eye className="w-4 h-4 mr-1.5" />
                Previsualizar en PDF
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {/* 1. Logotipo Principal */}
            <ImageUploadConfigCard
              title="1. Logotipo Principal (Encabezado Superior)"
              subtitle="Escudo institucional o logo principal que encabeza la solicitud oficial"
              imageUrl={currentConfig.pdfLogoUrl}
              position={currentConfig.pdfLogoPosicion}
              size={currentConfig.pdfLogoSize}
              visible={currentConfig.pdfMostrarLogo}
              onImageChange={(url) => setCurrentConfig({ ...currentConfig, pdfLogoUrl: url })}
              onPositionChange={(pos) => setCurrentConfig({ ...currentConfig, pdfLogoPosicion: pos })}
              onSizeChange={(size) => setCurrentConfig({ ...currentConfig, pdfLogoSize: size })}
              onVisibilityChange={(visible) => setCurrentConfig({ ...currentConfig, pdfMostrarLogo: visible })}
              defaultPlaceholderText="Cruz Verde Salvadoreña"
              defaultLogoName="Escudo Oficial Cruz Verde"
            />

            {/* 2. Logotipo Secundario */}
            <ImageUploadConfigCard
              title="2. Logotipo Secundario / Cooperante (Encabezado)"
              subtitle="Permite colocar un segundo escudo o logo de entidad asociada a la derecha o izquierda"
              imageUrl={currentConfig.pdfLogoSecundarioUrl}
              position={currentConfig.pdfLogoSecundarioPosicion}
              size={currentConfig.pdfLogoSecundarioSize}
              visible={currentConfig.pdfMostrarLogoSecundario}
              onImageChange={(url) => setCurrentConfig({ ...currentConfig, pdfLogoSecundarioUrl: url })}
              onPositionChange={(pos) => setCurrentConfig({ ...currentConfig, pdfLogoSecundarioPosicion: pos })}
              onSizeChange={(size) => setCurrentConfig({ ...currentConfig, pdfLogoSecundarioSize: size })}
              onVisibilityChange={(visible) => setCurrentConfig({ ...currentConfig, pdfMostrarLogoSecundario: visible })}
              defaultPlaceholderText="Logo Secundario / Cooperante"
              defaultLogoName="Sin logo secundario por defecto"
            />

            {/* 3. Sello Oficial / Firmas */}
            <ImageUploadConfigCard
              title="3. Sello Oficial o Sello con Firma Digitalizada"
              subtitle="Imagen del sello húmedo institucional o estampado oficial de la seccional"
              imageUrl={currentConfig.pdfSelloImgUrl}
              position={currentConfig.pdfSelloImgPosicion}
              size={currentConfig.pdfSelloImgSize}
              visible={currentConfig.pdfMostrarSelloImg || currentConfig.pdfMostrarSello}
              onImageChange={(url) => setCurrentConfig({ 
                ...currentConfig, 
                pdfSelloImgUrl: url, 
                pdfMostrarSelloImg: Boolean(url) 
              })}
              onPositionChange={(pos) => setCurrentConfig({ ...currentConfig, pdfSelloImgPosicion: pos })}
              onSizeChange={(size) => setCurrentConfig({ ...currentConfig, pdfSelloImgSize: size })}
              onVisibilityChange={(visible) => setCurrentConfig({ 
                ...currentConfig, 
                pdfMostrarSello: visible, 
                pdfMostrarSelloImg: visible && Boolean(currentConfig.pdfSelloImgUrl) 
              })}
              defaultPlaceholderText="Sello Vector Cruz Verde Salvadoreña"
              defaultLogoName="Sello Circular Predeterminado"
            />

            {/* 4. Cintillo o Pie de Página */}
            <ImageUploadConfigCard
              title="4. Cintillo o Imagen de Pie de Página (Footer)"
              subtitle="Banda inferior con contactos, redes sociales, patrocinadores o certificaciones"
              imageUrl={currentConfig.pdfFooterImgUrl}
              position={currentConfig.pdfFooterImgPosicion}
              size={currentConfig.pdfFooterImgSize}
              visible={currentConfig.pdfMostrarFooterImg}
              onImageChange={(url) => setCurrentConfig({ ...currentConfig, pdfFooterImgUrl: url })}
              onPositionChange={(pos) => setCurrentConfig({ ...currentConfig, pdfFooterImgPosicion: pos })}
              onSizeChange={(size) => setCurrentConfig({ ...currentConfig, pdfFooterImgSize: size })}
              onVisibilityChange={(visible) => setCurrentConfig({ ...currentConfig, pdfMostrarFooterImg: visible })}
              defaultPlaceholderText="Cintillo Oficial Cruz Verde"
              defaultLogoName="Sin imagen de pie por defecto"
            />
          </div>

          {/* Información de almacenamiento SQL */}
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-gray-900">
                  Almacenamiento Persistente en Base de Datos (SQL)
                </h5>
                <p className="text-3xs text-gray-500">
                  Las imágenes subidas se guardan de forma persistente en la tabla <code className="bg-gray-200 px-1 py-0.5 rounded font-mono text-gray-800">public.configuracion</code> de Supabase.
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
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-xs transition"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Guardando...' : 'Guardar Imágenes y Posiciones'}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-PESTAÑA 3: ESTILO, LOGOS Y TIPOGRAFÍA                                 */}
      {/* ========================================================================= */}
      {activeSubTab === 'pdf' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 space-y-6 shadow-2xs">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center">
              <Sliders className="w-5 h-5 text-primary mr-2" />
              Tipografía, Marca de Agua y Estilo del Documento
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Personalice la fuente oficial, el tamaño de la letra y el membrete de control interno.
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
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none bg-white font-medium"
              >
                <option value="sans">Sans-Serif (Moderna, limpia, estándar institucional)</option>
                <option value="serif">Serif (Formal, documental, ejecutiva)</option>
                <option value="mono">Monospace (Técnica / Código)</option>
              </select>
            </div>

            {/* Tamaño de Fuente */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Escala de Tamaño de Letra:
              </label>
              <select
                value={currentConfig.pdfFontSize}
                onChange={(e) => setCurrentConfig({ ...currentConfig, pdfFontSize: e.target.value as any })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none bg-white font-medium"
              >
                <option value="small">Compacto (Ajuste para documentos con mucho texto)</option>
                <option value="normal">Estándar (Recomendado oficial - Tamaño Carta)</option>
                <option value="large">Grande (Mayor legibilidad)</option>
              </select>
            </div>

            {/* Título Institucional */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Título Institucional (Encabezado):
              </label>
              <input
                type="text"
                value={currentConfig.pdfTitulo}
                onChange={(e) => setCurrentConfig({ ...currentConfig, pdfTitulo: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none font-bold"
              />
            </div>

            {/* Departamento */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Departamento o Área Responsable:
              </label>
              <input
                type="text"
                value={currentConfig.pdfDepartamento}
                onChange={(e) => setCurrentConfig({ ...currentConfig, pdfDepartamento: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none font-semibold"
              />
            </div>

            {/* Subtítulo */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Subtítulo del Formulario:
              </label>
              <input
                type="text"
                value={currentConfig.pdfSubtitulo}
                onChange={(e) => setCurrentConfig({ ...currentConfig, pdfSubtitulo: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            {/* Pie de Página */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Pie de Página Institucional:
              </label>
              <input
                type="text"
                value={currentConfig.pdfPiePagina}
                onChange={(e) => setCurrentConfig({ ...currentConfig, pdfPiePagina: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            {/* Marca de Agua */}
            <div className="md:col-span-2 pt-2 border-t border-gray-100">
              <label className="inline-flex items-center space-x-2.5 cursor-pointer mb-3">
                <input
                  type="checkbox"
                  checked={currentConfig.pdfWatermark}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, pdfWatermark: e.target.checked })}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <span className="text-xs font-bold text-gray-800">
                  Activar Marca de Agua Diagonal en Fondo del Documento
                </span>
              </label>

              {currentConfig.pdfWatermark && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Texto de la Marca de Agua:
                    </label>
                    <input
                      type="text"
                      value={currentConfig.pdfWatermarkText}
                      onChange={(e) => setCurrentConfig({ ...currentConfig, pdfWatermarkText: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Opacidad de la Marca de Agua (0.05 a 0.20):
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="0.5"
                      value={currentConfig.pdfWatermarkOpacity}
                      onChange={(e) => setCurrentConfig({ ...currentConfig, pdfWatermarkOpacity: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-xs transition"
            >
              <Save className="w-4 h-4 mr-2" />
              Guardar Estilo y Tipografía
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-PESTAÑA 3: EDITAR TEXTOS Y ETIQUETAS PDF                              */}
      {/* ========================================================================= */}
      {activeSubTab === 'textos' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 space-y-6 shadow-2xs">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center">
              <Type className="w-5 h-5 text-primary mr-2" />
              Edición de Textos, Nombres de Campos y Firmas
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Personalice las etiquetas visibles que se imprimen en cada casilla de la hoja de solicitud.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Etiqueta Solicitante:</label>
              <input
                type="text"
                value={currentConfig.pdfLabelSolicitante}
                onChange={(e) => setCurrentConfig({ ...currentConfig, pdfLabelSolicitante: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Etiqueta Cargo:</label>
              <input
                type="text"
                value={currentConfig.pdfLabelCargo}
                onChange={(e) => setCurrentConfig({ ...currentConfig, pdfLabelCargo: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Etiqueta Seccional:</label>
              <input
                type="text"
                value={currentConfig.pdfLabelSeccional}
                onChange={(e) => setCurrentConfig({ ...currentConfig, pdfLabelSeccional: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Etiqueta Rubro / Tipo:</label>
              <input
                type="text"
                value={currentConfig.pdfLabelTipo}
                onChange={(e) => setCurrentConfig({ ...currentConfig, pdfLabelTipo: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Etiqueta Vehículo:</label>
              <input
                type="text"
                value={currentConfig.pdfLabelVehiculo}
                onChange={(e) => setCurrentConfig({ ...currentConfig, pdfLabelVehiculo: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Etiqueta Placa:</label>
              <input
                type="text"
                value={currentConfig.pdfLabelPlaca}
                onChange={(e) => setCurrentConfig({ ...currentConfig, pdfLabelPlaca: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Etiqueta Monto Estimado:</label>
              <input
                type="text"
                value={currentConfig.pdfLabelMonto}
                onChange={(e) => setCurrentConfig({ ...currentConfig, pdfLabelMonto: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Etiqueta Proveedor:</label>
              <input
                type="text"
                value={currentConfig.pdfLabelProveedor}
                onChange={(e) => setCurrentConfig({ ...currentConfig, pdfLabelProveedor: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Etiqueta Descripción:</label>
              <input
                type="text"
                value={currentConfig.pdfLabelDescripcion}
                onChange={(e) => setCurrentConfig({ ...currentConfig, pdfLabelDescripcion: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>

          {/* Bloque de Firmas */}
          <div className="pt-6 border-t border-gray-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-4 flex items-center">
              <Shield className="w-4 h-4 mr-1.5 text-primary" />
              Títulos de las Tres Firmas y Autorizaciones
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-50 p-4 rounded-xl space-y-3 border border-gray-200">
                <span className="font-bold text-xs text-gray-800">Firma 1 (Solicitante / Director):</span>
                <input
                  type="text"
                  value={currentConfig.pdfFirma1Titulo}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, pdfFirma1Titulo: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                  placeholder="Título principal"
                />
                <input
                  type="text"
                  value={currentConfig.pdfFirma1Subtitulo}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, pdfFirma1Subtitulo: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white text-gray-500"
                  placeholder="Subtítulo o aclaración"
                />
              </div>

              <div className="bg-gray-50 p-4 rounded-xl space-y-3 border border-gray-200">
                <span className="font-bold text-xs text-gray-800">Firma 2 (Autorización Administrativa):</span>
                <input
                  type="text"
                  value={currentConfig.pdfFirma2Titulo}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, pdfFirma2Titulo: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                  placeholder="Título principal"
                />
                <input
                  type="text"
                  value={currentConfig.pdfFirma2Subtitulo}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, pdfFirma2Subtitulo: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white text-gray-500"
                  placeholder="Subtítulo o aclaración"
                />
              </div>

              <div className="bg-gray-50 p-4 rounded-xl space-y-3 border border-gray-200">
                <span className="font-bold text-xs text-gray-800">Sello Oficial (Texto Superior e Inferior):</span>
                <input
                  type="text"
                  value={currentConfig.pdfSelloTextoSuperior}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, pdfSelloTextoSuperior: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                  placeholder="Texto Superior (ej. CRUZ VERDE)"
                />
                <input
                  type="text"
                  value={currentConfig.pdfSelloTextoInferior}
                  onChange={(e) => setCurrentConfig({ ...currentConfig, pdfSelloTextoInferior: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white text-gray-500"
                  placeholder="Texto Inferior (ej. EL SALVADOR, C.A.)"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-xs transition"
            >
              <Save className="w-4 h-4 mr-2" />
              Guardar Textos de Formulario
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-PESTAÑA 4: PLANTILLA Y DESTINATARIOS DE CORREO                        */}
      {/* ========================================================================= */}
      {activeSubTab === 'correo' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 space-y-6 shadow-2xs">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center">
              <Mail className="w-5 h-5 text-primary mr-2" />
              Notificaciones por Correo Electrónico
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Configure las direcciones institucionales donde se recibirán las solicitudes de compra formalizadas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Correo Destinatario Principal (Compras):</label>
              <input
                type="email"
                value={currentConfig.correoDestino}
                onChange={(e) => setCurrentConfig({ ...currentConfig, correoDestino: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Correo Remitente Institucional:</label>
              <input
                type="email"
                value={currentConfig.correoRemitente}
                onChange={(e) => setCurrentConfig({ ...currentConfig, correoRemitente: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Con Copia Por Defecto (CC):</label>
              <input
                type="text"
                value={currentConfig.correoCcDefault}
                onChange={(e) => setCurrentConfig({ ...currentConfig, correoCcDefault: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Plantilla de Asunto:</label>
              <input
                type="text"
                value={currentConfig.asuntoPlantilla}
                onChange={(e) => setCurrentConfig({ ...currentConfig, asuntoPlantilla: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono"
              />
              <span className="text-3xs text-gray-500 mt-1 block">
                Etiquetas: [FOLIO], [SECCIONAL], [DIRECTOR], [FECHA]
              </span>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-700 mb-1">Título del Mensaje:</label>
              <input
                type="text"
                value={currentConfig.correoTitulo}
                onChange={(e) => setCurrentConfig({ ...currentConfig, correoTitulo: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-700 mb-1">Subtítulo del Mensaje:</label>
              <input
                type="text"
                value={currentConfig.correoSubtitulo}
                onChange={(e) => setCurrentConfig({ ...currentConfig, correoSubtitulo: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-xs transition"
            >
              <Save className="w-4 h-4 mr-2" />
              Guardar Configuración de Correo
            </button>
          </div>
        </div>
      )}

      {/* Modal de Previsualización de PDF Completo */}
      {showPreviewModal && (
        <CompraPdfPreviewModal
          config={currentConfig}
          onClose={() => setShowPreviewModal(false)}
        />
      )}

    </div>
  );
}
