import React, { useState, useEffect } from 'react';
import { 
  X, Plus, Trash2, ArrowUp, ArrowDown, Copy, Settings2, Eye, 
  Check, Globe, Lock, AlertCircle, FileText, Phone, Mail, 
  IdCard, User, Users, MapPin, Award, BookOpen, Calendar, 
  CheckSquare, ListFilter, AlignLeft, Hash, Layers, CheckCircle2
} from 'lucide-react';
import { FormField, FormFieldType, Formulario } from '../../types/formulario';
import PhoneInputWithCountry from './PhoneInputWithCountry';
import { applyDuiMask } from '../../utils/phoneMasks';
import { generateSlug } from '../../utils/slugify';

interface FormBuilderModalProps {
  form: Formulario | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (savedForm: Partial<Formulario>) => Promise<void>;
  seccionalesList?: string[];
  cursosList?: string[];
}

export default function FormBuilderModal({
  form,
  isOpen,
  onClose,
  onSave,
  seccionalesList = [],
  cursosList = []
}: FormBuilderModalProps) {
  const [activeTab, setActiveTab] = useState<'editor' | 'settings' | 'preview'>('editor');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState('Cursos y Capacitaciones');
  const [requiereAutenticacion, setRequiereAutenticacion] = useState(false);
  const [activo, setActivo] = useState(true);
  const [mensajeExito, setMensajeExito] = useState('¡Muchas gracias! Tu respuesta ha sido registrada exitosamente en el sistema.');
  const [campos, setCampos] = useState<FormField[]>([]);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize data when form changes
  useEffect(() => {
    if (form) {
      setTitulo(form.titulo || '');
      setDescripcion(form.descripcion || '');
      setCategoria(form.categoria || 'Cursos y Capacitaciones');
      setRequiereAutenticacion(Boolean(form.requiere_autenticacion));
      setActivo(form.activo !== false);
      setMensajeExito(form.mensaje_exito || '¡Muchas gracias! Tu respuesta ha sido registrada exitosamente en el sistema.');
      setCampos(form.campos ? JSON.parse(JSON.stringify(form.campos)) : []);
    } else {
      setTitulo('Nuevo Formulario de Inscripción');
      setDescripcion('Por favor complete todos los datos requeridos a continuación.');
      setCategoria('Cursos y Capacitaciones');
      setRequiereAutenticacion(false);
      setActivo(true);
      setMensajeExito('¡Muchas gracias! Tu respuesta ha sido registrada exitosamente en el sistema.');
      setCampos([
        { id: `campo_${Date.now()}_1`, tipo: 'text', label: 'Nombres', placeholder: 'Tus nombres', required: true, width: '50%' },
        { id: `campo_${Date.now()}_2`, tipo: 'text', label: 'Apellidos', placeholder: 'Tus apellidos', required: true, width: '50%' },
        { id: `campo_${Date.now()}_3`, tipo: 'telefono', label: 'Teléfono / WhatsApp', placeholder: 'Número de contacto', required: true, width: '50%', help: 'Selecciona tu código de país' },
        { id: `campo_${Date.now()}_4`, tipo: 'email', label: 'Correo Electrónico', placeholder: 'ejemplo@correo.com', required: true, width: '50%' },
      ]);
    }
    setActiveTab('editor');
    setEditingFieldId(null);
  }, [form, isOpen]);

  if (!isOpen) return null;

  // Add a new field from the element palette (Fluent Forms style)
  const addField = (tipo: FormFieldType) => {
    const id = `campo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    let newField: FormField;

    switch (tipo) {
      case 'carnet':
        newField = { id, tipo, label: 'Número de Carnet Institucional', placeholder: 'Ej. CV-1024', required: false, width: '50%', help: 'Ingresa tu número de socorrista o aspirante' };
        break;
      case 'dui':
        newField = { id, tipo, label: 'Documento de Identidad (DUI)', placeholder: '00000000-0', required: true, width: '50%' };
        break;
      case 'seccional':
        newField = { id, tipo, label: 'Seccional', placeholder: 'Seleccione su seccional', required: true, width: '50%' };
        break;
      case 'rango':
        newField = { 
          id, tipo, label: 'Rango / Cargo en Cruz Verde', required: false, width: '50%',
          options: ['Aspirante / Nuevo Ingreso', 'Socorrista Activo', 'Rescatista', 'Paramédico / TEM', 'Motorista de Ambulancia', 'Guardia Activo', 'Público Externo'] 
        };
        break;
      case 'telefono':
        newField = { id, tipo, label: 'Número de Teléfono / WhatsApp', placeholder: 'Número de contacto', required: true, width: '50%', help: 'Con código de país y formato automático' };
        break;
      case 'email':
        newField = { id, tipo, label: 'Correo Electrónico', placeholder: 'correo@ejemplo.com', required: true, width: '50%' };
        break;
      case 'textarea':
        newField = { id, tipo, label: 'Comentarios / Información Adicional', placeholder: 'Escribe aquí los detalles...', required: false, width: '100%' };
        break;
      case 'select':
        newField = { id, tipo, label: 'Seleccione una opción', required: true, width: '100%', options: ['Opción 1', 'Opción 2', 'Opción 3'] };
        break;
      case 'radio':
        newField = { id, tipo, label: 'Elija una alternativa', required: true, width: '100%', options: ['Alternativa A', 'Alternativa B'] };
        break;
      case 'checkbox':
        newField = { id, tipo, label: 'Seleccione las opciones aplicables', required: false, width: '100%', options: ['Opción 1', 'Opción 2'] };
        break;
      case 'date':
        newField = { id, tipo, label: 'Fecha de Nacimiento / Fecha', required: true, width: '50%' };
        break;
      case 'number':
        newField = { id, tipo, label: 'Cantidad / Número', placeholder: '0', required: false, width: '50%' };
        break;
      case 'terminos':
        newField = { id, tipo, label: 'Acepto los términos y condiciones del evento/curso', required: true, width: '100%', help: 'Declaro que toda la información provista es verídica' };
        break;
      case 'text':
      default:
        newField = { id, tipo: 'text', label: 'Campo de Texto', placeholder: 'Ingrese su respuesta', required: false, width: '50%' };
        break;
    }

    setCampos(prev => [...prev, newField]);
    setEditingFieldId(id);
  };

  const removeField = (id: string) => {
    setCampos(prev => prev.filter(c => c.id !== id));
    if (editingFieldId === id) setEditingFieldId(null);
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= campos.length) return;
    const updated = [...campos];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIndex, 0, moved);
    setCampos(updated);
  };

  const duplicateField = (index: number) => {
    const target = campos[index];
    const copy: FormField = {
      ...JSON.parse(JSON.stringify(target)),
      id: `campo_${Date.now()}_copy`,
      label: `${target.label} (Copia)`
    };
    const updated = [...campos];
    updated.splice(index + 1, 0, copy);
    setCampos(updated);
  };

  const updateFieldProperty = (id: string, key: keyof FormField, value: any) => {
    setCampos(prev => prev.map(c => c.id === id ? { ...c, [key]: value } : c));
  };

  const handleSave = async () => {
    if (!titulo.trim()) {
      alert('Por favor ingrese un título para el formulario');
      return;
    }
    if (campos.length === 0) {
      alert('El formulario debe contener al menos un campo');
      return;
    }

    setSaving(true);
    try {
      const generatedSlug = form?.slug || generateSlug(titulo.trim());
      await onSave({
        titulo: titulo.trim(),
        slug: generatedSlug,
        descripcion: descripcion.trim(),
        categoria,
        requiere_autenticacion: requiereAutenticacion,
        activo,
        mensaje_exito: mensajeExito.trim(),
        campos
      });
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      alert('Error al guardar el formulario: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const selectedEditingField = campos.find(c => c.id === editingFieldId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col my-auto max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* ========================================================================= */}
        {/* TOP BAR / HEADER (ESTILO FLUENT FORMS)                                     */}
        {/* ========================================================================= */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-gray-50/90 border-b border-gray-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-xs flex-shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Nombre del Formulario..."
                  className="font-bold text-gray-900 text-base sm:text-lg bg-transparent border-b border-transparent hover:border-gray-300 focus:border-emerald-600 focus:outline-hidden px-1 -mx-1 transition-colors truncate"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1 font-medium">
                  {requiereAutenticacion ? (
                    <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Requiere Inicio de Sesión
                    </span>
                  ) : (
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 flex items-center gap-1">
                      <Globe className="w-3 h-3" /> Público (Cualquiera con el enlace)
                    </span>
                  )}
                </span>
                <span>•</span>
                <span>{campos.length} {campos.length === 1 ? 'campo' : 'campos'}</span>
              </div>
            </div>
          </div>

          {/* Nav Tabs */}
          <div className="flex items-center gap-1 bg-gray-200/70 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'editor' 
                  ? 'bg-white text-gray-900 shadow-2xs' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🛠️ Editor de Campos
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'settings' 
                  ? 'bg-white text-gray-900 shadow-2xs' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              ⚙️ Ajustes & Acceso
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'preview' 
                  ? 'bg-white text-gray-900 shadow-2xs' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              👁️ Vista Previa
            </button>
          </div>

          {/* Close & Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Guardando...
                </>
              ) : saveSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  ¡Guardado!
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Guardar Formulario
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200/50 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: EDITOR DE CAMPOS (PALETA FLUENT FORMS + CANVAS VISUAL)              */}
        {/* ========================================================================= */}
        {activeTab === 'editor' && (
          <div className="flex-1 overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-200">
            
            {/* PALETA LATERAL DE ELEMENTOS (DISPONIBLES PARA AGREGAR) */}
            <div className="w-full md:w-72 lg:w-80 bg-gray-50/70 p-4 overflow-y-auto custom-scrollbar flex-shrink-0 flex flex-col gap-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-emerald-700" /> Cruz Verde & Institucional
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => addField('carnet')}
                    className="flex flex-col items-center justify-center p-2.5 bg-white border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/40 rounded-xl text-center transition-all group shadow-2xs"
                  >
                    <IdCard className="w-5 h-5 text-emerald-700 group-hover:scale-110 transition-transform mb-1" />
                    <span className="text-xs font-semibold text-gray-800">Carnet CV</span>
                    <span className="text-[10px] text-gray-400">Prefijo y número</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => addField('seccional')}
                    className="flex flex-col items-center justify-center p-2.5 bg-white border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/40 rounded-xl text-center transition-all group shadow-2xs"
                  >
                    <MapPin className="w-5 h-5 text-emerald-700 group-hover:scale-110 transition-transform mb-1" />
                    <span className="text-xs font-semibold text-gray-800">Seccional</span>
                    <span className="text-[10px] text-gray-400">Seccionales oficiales</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => addField('rango')}
                    className="flex flex-col items-center justify-center p-2.5 bg-white border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/40 rounded-xl text-center transition-all group shadow-2xs"
                  >
                    <Users className="w-5 h-5 text-emerald-700 group-hover:scale-110 transition-transform mb-1" />
                    <span className="text-xs font-semibold text-gray-800">Rango / Rol</span>
                    <span className="text-[10px] text-gray-400">Socorrista, etc.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => addField('dui')}
                    className="flex flex-col items-center justify-center p-2.5 bg-white border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/40 rounded-xl text-center transition-all group shadow-2xs"
                  >
                    <IdCard className="w-5 h-5 text-emerald-700 group-hover:scale-110 transition-transform mb-1" />
                    <span className="text-xs font-semibold text-gray-800">DUI</span>
                    <span className="text-[10px] text-gray-400">Máscara 00000000-0</span>
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-blue-600" /> Contacto & Personal
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => addField('telefono')}
                    className="flex flex-col items-center justify-center p-2.5 bg-white border border-gray-200 hover:border-blue-500 hover:bg-blue-50/40 rounded-xl text-center transition-all group shadow-2xs"
                  >
                    <Phone className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform mb-1" />
                    <span className="text-xs font-semibold text-gray-800">Teléfono Int.</span>
                    <span className="text-[10px] text-gray-400">Código país + máscara</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => addField('email')}
                    className="flex flex-col items-center justify-center p-2.5 bg-white border border-gray-200 hover:border-blue-500 hover:bg-blue-50/40 rounded-xl text-center transition-all group shadow-2xs"
                  >
                    <Mail className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform mb-1" />
                    <span className="text-xs font-semibold text-gray-800">Correo Elect.</span>
                    <span className="text-[10px] text-gray-400">Formato email</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => addField('date')}
                    className="flex flex-col items-center justify-center p-2.5 bg-white border border-gray-200 hover:border-blue-500 hover:bg-blue-50/40 rounded-xl text-center transition-all group shadow-2xs"
                  >
                    <Calendar className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform mb-1" />
                    <span className="text-xs font-semibold text-gray-800">Fecha</span>
                    <span className="text-[10px] text-gray-400">Nacimiento/Evento</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => addField('text')}
                    className="flex flex-col items-center justify-center p-2.5 bg-white border border-gray-200 hover:border-blue-500 hover:bg-blue-50/40 rounded-xl text-center transition-all group shadow-2xs"
                  >
                    <User className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform mb-1" />
                    <span className="text-xs font-semibold text-gray-800">Texto Corto</span>
                    <span className="text-[10px] text-gray-400">Nombres/Apellidos</span>
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-purple-600" /> Opciones & General
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => addField('select')}
                    className="flex flex-col items-center justify-center p-2.5 bg-white border border-gray-200 hover:border-purple-500 hover:bg-purple-50/40 rounded-xl text-center transition-all group shadow-2xs"
                  >
                    <ListFilter className="w-5 h-5 text-purple-600 group-hover:scale-110 transition-transform mb-1" />
                    <span className="text-xs font-semibold text-gray-800">Menú Desplegable</span>
                    <span className="text-[10px] text-gray-400">Lista desplegable</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => addField('radio')}
                    className="flex flex-col items-center justify-center p-2.5 bg-white border border-gray-200 hover:border-purple-500 hover:bg-purple-50/40 rounded-xl text-center transition-all group shadow-2xs"
                  >
                    <CheckSquare className="w-5 h-5 text-purple-600 group-hover:scale-110 transition-transform mb-1" />
                    <span className="text-xs font-semibold text-gray-800">Opción Única</span>
                    <span className="text-[10px] text-gray-400">Radio button</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => addField('checkbox')}
                    className="flex flex-col items-center justify-center p-2.5 bg-white border border-gray-200 hover:border-purple-500 hover:bg-purple-50/40 rounded-xl text-center transition-all group shadow-2xs"
                  >
                    <CheckSquare className="w-5 h-5 text-purple-600 group-hover:scale-110 transition-transform mb-1" />
                    <span className="text-xs font-semibold text-gray-800">Casillas</span>
                    <span className="text-[10px] text-gray-400">Multi-selección</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => addField('textarea')}
                    className="flex flex-col items-center justify-center p-2.5 bg-white border border-gray-200 hover:border-purple-500 hover:bg-purple-50/40 rounded-xl text-center transition-all group shadow-2xs"
                  >
                    <AlignLeft className="w-5 h-5 text-purple-600 group-hover:scale-110 transition-transform mb-1" />
                    <span className="text-xs font-semibold text-gray-800">Párrafo</span>
                    <span className="text-[10px] text-gray-400">Área de texto libre</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => addField('number')}
                    className="flex flex-col items-center justify-center p-2.5 bg-white border border-gray-200 hover:border-purple-500 hover:bg-purple-50/40 rounded-xl text-center transition-all group shadow-2xs"
                  >
                    <Hash className="w-5 h-5 text-purple-600 group-hover:scale-110 transition-transform mb-1" />
                    <span className="text-xs font-semibold text-gray-800">Número</span>
                    <span className="text-[10px] text-gray-400">Solo números</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => addField('terminos')}
                    className="flex flex-col items-center justify-center p-2.5 bg-white border border-gray-200 hover:border-purple-500 hover:bg-purple-50/40 rounded-xl text-center transition-all group shadow-2xs"
                  >
                    <FileText className="w-5 h-5 text-purple-600 group-hover:scale-110 transition-transform mb-1" />
                    <span className="text-xs font-semibold text-gray-800">Compromiso</span>
                    <span className="text-[10px] text-gray-400">Términos Cruz Verde</span>
                  </button>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 leading-relaxed">
                💡 <strong>Consejo Fluent Forms:</strong> Haz clic en cualquier elemento para agregarlo al formulario. Puedes configurar si ocupa media columna (50%) o la fila completa (100%).
              </div>
            </div>

            {/* CANVAS CENTRAL (LISTA VISUAL DE CAMPOS DEL FORMULARIO) */}
            <div className="flex-1 p-5 overflow-y-auto custom-scrollbar bg-slate-50/40">
              <div className="max-w-3xl mx-auto space-y-4">
                
                {/* Header preview / Titular del Formulario */}
                <div className="p-5 bg-white rounded-2xl border border-gray-200 shadow-2xs">
                  <input
                    type="text"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Título del Formulario"
                    className="w-full text-xl font-bold text-gray-900 border-b border-dashed border-gray-200 hover:border-gray-400 focus:border-emerald-600 focus:outline-hidden pb-1"
                  />
                  <textarea
                    rows={2}
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Descripción o instrucciones para las personas que llenen el formulario..."
                    className="w-full mt-2 text-xs text-gray-600 border-b border-dashed border-gray-200 hover:border-gray-400 focus:border-emerald-600 focus:outline-hidden resize-none"
                  />
                </div>

                {/* Campos en el canvas */}
                {campos.length === 0 ? (
                  <div className="p-10 text-center border-2 border-dashed border-gray-300 rounded-2xl bg-white">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <h4 className="text-sm font-bold text-gray-700">El formulario no tiene campos</h4>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                      Haz clic en los elementos de la paleta izquierda para agregar Carnet, Teléfono internacional, Nombres, Seccional, etc.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {campos.map((campo, index) => {
                      const isEditing = editingFieldId === campo.id;
                      return (
                        <div
                          key={campo.id}
                          className={`group relative bg-white rounded-2xl border transition-all shadow-2xs overflow-hidden ${
                            isEditing 
                              ? 'border-emerald-500 ring-2 ring-emerald-500/20' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {/* Top bar of field card */}
                          <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50/70 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-gray-200 text-gray-700">
                                {campo.tipo}
                              </span>
                              <span className="text-xs font-semibold text-gray-800 truncate max-w-[200px]">
                                {campo.label || '(Sin etiqueta)'}
                              </span>
                              {campo.required && (
                                <span className="text-red-500 font-bold text-xs" title="Campo obligatorio">*</span>
                              )}
                              <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                {campo.width || '100%'}
                              </span>
                            </div>

                            {/* Actions: Move, Duplicate, Edit, Delete */}
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => moveField(index, 'up')}
                                title="Mover arriba"
                                className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded disabled:opacity-20"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={index === campos.length - 1}
                                onClick={() => moveField(index, 'down')}
                                title="Mover abajo"
                                className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded disabled:opacity-20"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => duplicateField(index)}
                                title="Duplicar campo"
                                className="p-1 text-gray-400 hover:text-emerald-700 hover:bg-gray-200/60 rounded"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingFieldId(isEditing ? null : campo.id)}
                                title="Configurar campo"
                                className={`p-1 rounded transition-colors ${
                                  isEditing ? 'text-emerald-700 bg-emerald-50' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200/60'
                                }`}
                              >
                                <Settings2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeField(campo.id)}
                                title="Eliminar campo"
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Field Live Mock Representation */}
                          <div className="p-4 bg-white">
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                              {campo.label}
                              {campo.required && <span className="text-red-500 ml-1">*</span>}
                            </label>

                            {campo.tipo === 'telefono' ? (
                              <PhoneInputWithCountry disabled placeholder={campo.placeholder} onChange={() => {}} />
                            ) : campo.tipo === 'textarea' ? (
                              <textarea
                                disabled
                                rows={2}
                                placeholder={campo.placeholder}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-400 resize-none cursor-not-allowed"
                              />
                            ) : campo.tipo === 'select' || campo.tipo === 'seccional' || campo.tipo === 'rango' ? (
                              <select disabled className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500 cursor-not-allowed">
                                <option>{campo.placeholder || 'Seleccione una opción...'}</option>
                                {campo.options?.map((op, i) => (
                                  <option key={i}>{op}</option>
                                ))}
                              </select>
                            ) : campo.tipo === 'radio' ? (
                              <div className="space-y-1.5">
                                {campo.options?.map((op, i) => (
                                  <label key={i} className="flex items-center gap-2 text-xs text-gray-600">
                                    <input type="radio" disabled className="text-emerald-600" />
                                    <span>{op}</span>
                                  </label>
                                ))}
                              </div>
                            ) : campo.tipo === 'checkbox' ? (
                              <div className="space-y-1.5">
                                {campo.options?.map((op, i) => (
                                  <label key={i} className="flex items-center gap-2 text-xs text-gray-600">
                                    <input type="checkbox" disabled className="rounded text-emerald-600" />
                                    <span>{op}</span>
                                  </label>
                                ))}
                              </div>
                            ) : campo.tipo === 'terminos' ? (
                              <label className="flex items-start gap-2 text-xs text-gray-600">
                                <input type="checkbox" disabled className="mt-0.5 rounded text-emerald-600" />
                                <span>{campo.label}</span>
                              </label>
                            ) : (
                              <input
                                type="text"
                                disabled
                                placeholder={campo.placeholder || 'Respuesta del usuario'}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-400 cursor-not-allowed"
                              />
                            )}

                            {campo.help && (
                              <p className="mt-1 text-[11px] text-gray-400 italic">{campo.help}</p>
                            )}
                          </div>

                          {/* INLINE FIELD SETTINGS (CUANDO SE HACE CLIC EN EDITAR) */}
                          {isEditing && (
                            <div className="p-4 bg-emerald-50/40 border-t border-emerald-100 flex flex-col gap-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                                    Etiqueta del Campo
                                  </label>
                                  <input
                                    type="text"
                                    value={campo.label}
                                    onChange={(e) => updateFieldProperty(campo.id, 'label', e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                                    Texto Placeholder
                                  </label>
                                  <input
                                    type="text"
                                    value={campo.placeholder || ''}
                                    onChange={(e) => updateFieldProperty(campo.id, 'placeholder', e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                                    Ancho en Cuadrícula
                                  </label>
                                  <select
                                    value={campo.width || '100%'}
                                    onChange={(e) => updateFieldProperty(campo.id, 'width', e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:border-emerald-600"
                                  >
                                    <option value="100%">100% (Ancho completo)</option>
                                    <option value="50%">50% (Media columna)</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                                    ¿Es Obligatorio?
                                  </label>
                                  <label className="flex items-center gap-2 mt-1 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={campo.required}
                                      onChange={(e) => updateFieldProperty(campo.id, 'required', e.target.checked)}
                                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                                    />
                                    <span className="text-xs font-semibold text-gray-700">Obligatorio (*)</span>
                                  </label>
                                </div>

                                <div>
                                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                                    Texto de Ayuda (opcional)
                                  </label>
                                  <input
                                    type="text"
                                    value={campo.help || ''}
                                    onChange={(e) => updateFieldProperty(campo.id, 'help', e.target.value)}
                                    placeholder="Instrucción pequeña bajo el campo"
                                    className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:border-emerald-600"
                                  />
                                </div>
                              </div>

                              {/* Opciones si es select, radio o checkbox */}
                              {(campo.tipo === 'select' || campo.tipo === 'radio' || campo.tipo === 'checkbox' || campo.tipo === 'rango') && (
                                <div>
                                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                                    Opciones Disponibles (una por línea)
                                  </label>
                                  <textarea
                                    rows={3}
                                    value={(campo.options || []).join('\n')}
                                    onChange={(e) => updateFieldProperty(campo.id, 'options', e.target.value.split('\n').filter(Boolean))}
                                    className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg font-mono focus:outline-hidden focus:border-emerald-600"
                                    placeholder="Opción 1&#10;Opción 2&#10;Opción 3"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: AJUSTES & ACCESO (PÚBLICO VS PRIVADO / MENSAJE ÉXITO)              */}
        {/* ========================================================================= */}
        {activeTab === 'settings' && (
          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-slate-50/50">
            <div className="max-w-2xl mx-auto space-y-6">
              
              {/* CONTROL DE ACCESO / SEGURIDAD (REQUERIDO POR EL USUARIO) */}
              <div className="p-5 bg-white rounded-2xl border border-gray-200 shadow-2xs space-y-4">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-700" /> Control de Acceso y Privacidad
                </h3>
                <p className="text-xs text-gray-500">
                  Define quién tiene permiso para ver y responder a este formulario cuando reciba el enlace de compartir.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setRequiereAutenticacion(false)}
                    className={`flex flex-col p-4 rounded-xl border text-left transition-all ${
                      !requiereAutenticacion 
                        ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20' 
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="p-2 rounded-lg bg-emerald-100 text-emerald-800">
                        <Globe className="w-5 h-5" />
                      </span>
                      {!requiereAutenticacion && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          Seleccionado
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-gray-900">🌐 Acceso Público</span>
                    <span className="text-[11px] text-gray-500 mt-1 leading-snug">
                      Cualquier persona con el enlace puede responder sin tener cuenta ni iniciar sesión. Ideal para cursos públicos y voluntariado.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRequiereAutenticacion(true)}
                    className={`flex flex-col p-4 rounded-xl border text-left transition-all ${
                      requiereAutenticacion 
                        ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20' 
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="p-2 rounded-lg bg-amber-100 text-amber-800">
                        <Lock className="w-5 h-5" />
                      </span>
                      {requiereAutenticacion && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                          Seleccionado
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-gray-900">🔒 Solo Personal Autenticado</span>
                    <span className="text-[11px] text-gray-500 mt-1 leading-snug">
                      Requiere que la persona inicie sesión con su usuario del sistema de Cruz Verde Salvadoreña para acceder al formulario.
                    </span>
                  </button>
                </div>
              </div>

              {/* CATEGORÍA Y ESTADO */}
              <div className="p-5 bg-white rounded-2xl border border-gray-200 shadow-2xs space-y-4">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-700" /> Clasificación y Estado
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Categoría</label>
                    <select
                      value={categoria}
                      onChange={(e) => setCategoria(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-xl focus:outline-hidden focus:border-emerald-600"
                    >
                      <option value="Cursos y Capacitaciones">Cursos y Capacitaciones</option>
                      <option value="Voluntariado y Aspirantes">Voluntariado y Aspirantes</option>
                      <option value="Eventos y Operativos">Eventos y Operativos</option>
                      <option value="Emergencias y Desastres">Emergencias y Desastres</option>
                      <option value="General">General</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Estado de Recepción</label>
                    <label className="flex items-center gap-3 mt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activo}
                        onChange={(e) => setActivo(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                      />
                      <span className="text-xs font-medium text-gray-800">
                        {activo ? '🟢 Formulario Activo (Acepta respuestas)' : '🔴 Formulario Inactivo (Cerrado a respuestas)'}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* MENSAJE DE ÉXITO */}
              <div className="p-5 bg-white rounded-2xl border border-gray-200 shadow-2xs space-y-3">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" /> Mensaje al Enviar Exitosamente
                </h3>
                <p className="text-xs text-gray-500">
                  Texto que verá el usuario tras registrar satisfactoriamente su formulario.
                </p>
                <textarea
                  rows={3}
                  value={mensajeExito}
                  onChange={(e) => setMensajeExito(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-xl focus:outline-hidden focus:border-emerald-600"
                />
              </div>

            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: VISTA PREVIA EN VIVO                                               */}
        {/* ========================================================================= */}
        {activeTab === 'preview' && (
          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-slate-100 flex items-center justify-center">
            <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl border border-gray-200 p-6 sm:p-8 space-y-6">
              
              <div className="border-b border-gray-100 pb-5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 mb-2">
                  {categoria}
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-gray-900 leading-tight">
                  {titulo || 'Sin título'}
                </h2>
                {descripcion && (
                  <p className="text-xs sm:text-sm text-gray-600 mt-2 leading-relaxed">
                    {descripcion}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {campos.map((campo) => {
                  const isFull = campo.width === '100%' || campo.tipo === 'textarea' || campo.tipo === 'terminos';
                  return (
                    <div key={campo.id} className={isFull ? 'sm:col-span-2' : 'sm:col-span-1'}>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        {campo.label}
                        {campo.required && <span className="text-red-500 ml-1">*</span>}
                      </label>

                      {campo.tipo === 'telefono' ? (
                        <PhoneInputWithCountry placeholder={campo.placeholder} onChange={() => {}} />
                      ) : campo.tipo === 'textarea' ? (
                        <textarea
                          rows={3}
                          placeholder={campo.placeholder}
                          className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-hidden focus:border-emerald-500"
                        />
                      ) : campo.tipo === 'select' || campo.tipo === 'seccional' || campo.tipo === 'rango' ? (
                        <select className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-hidden focus:border-emerald-500">
                          <option value="">{(campo.placeholder || 'Seleccione una opción...').replace(/ o filial/gi, '').replace(/ \/ filial/gi, '')}</option>
                          {campo.tipo === 'seccional' && seccionalesList.length > 0
                            ? seccionalesList.map((sec, i) => <option key={i} value={sec}>{sec}</option>)
                            : campo.options?.map((op, i) => <option key={i} value={op}>{op}</option>)
                          }
                        </select>
                      ) : campo.tipo === 'radio' ? (
                        <div className="space-y-2 pt-1">
                          {campo.options?.map((op, i) => (
                            <label key={i} className="flex items-center gap-2.5 text-xs text-gray-700 cursor-pointer">
                              <input type="radio" name={campo.id} className="text-emerald-600 focus:ring-emerald-500" />
                              <span>{op}</span>
                            </label>
                          ))}
                        </div>
                      ) : campo.tipo === 'checkbox' ? (
                        <div className="space-y-2 pt-1">
                          {campo.options?.map((op, i) => (
                            <label key={i} className="flex items-center gap-2.5 text-xs text-gray-700 cursor-pointer">
                              <input type="checkbox" className="rounded text-emerald-600 focus:ring-emerald-500" />
                              <span>{op}</span>
                            </label>
                          ))}
                        </div>
                      ) : campo.tipo === 'terminos' ? (
                        <label className="flex items-start gap-2.5 text-xs text-gray-700 cursor-pointer pt-1">
                          <input type="checkbox" className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500" />
                          <span>{campo.label}</span>
                        </label>
                      ) : (
                        <input
                          type={campo.tipo === 'number' ? 'number' : campo.tipo === 'date' ? 'date' : 'text'}
                          placeholder={campo.placeholder}
                          className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-hidden focus:border-emerald-500 font-sans"
                        />
                      )}

                      {campo.help && (
                        <p className="mt-1 text-[11px] text-gray-400 italic">{campo.help}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end">
                <button
                  type="button"
                  disabled
                  className="px-6 py-2.5 bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs opacity-80 cursor-not-allowed"
                >
                  Enviar Información
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function Shield(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
    </svg>
  );
}
