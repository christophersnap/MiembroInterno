import React, { useEffect, useState } from 'react';
import {
  Shield,
  Briefcase,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Check,
  X,
} from 'lucide-react';
import {
  DEFAULT_CARGOS_ADMINISTRATIVOS,
  DEFAULT_CARGOS_INSTITUCIONALES,
  loadCargosCatalog,
  saveCargosCatalog,
} from '../../utils/cargosCatalog';
import { logActivity } from '../../lib/logger';

interface ConfiguracionCargosProps {
  onSuccess?: (message: string) => void;
}

export default function ConfiguracionCargos({ onSuccess }: ConfiguracionCargosProps) {
  const [institucionales, setInstitucionales] = useState<string[]>(DEFAULT_CARGOS_INSTITUCIONALES);
  const [administrativos, setAdministrativos] = useState<string[]>(DEFAULT_CARGOS_ADMINISTRATIVOS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [newInst, setNewInst] = useState('');
  const [newAdmin, setNewAdmin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const [editingInstIdx, setEditingInstIdx] = useState<number | null>(null);
  const [editingInstVal, setEditingInstVal] = useState('');
  const [editingAdminIdx, setEditingAdminIdx] = useState<number | null>(null);
  const [editingAdminVal, setEditingAdminVal] = useState('');

  useEffect(() => {
    let active = true;
    loadCargosCatalog().then((res) => {
      if (!active) return;
      setInstitucionales(res.institucionales);
      setAdministrativos(res.administrativos);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const addItem = (type: 'inst' | 'admin') => {
    setErrorMsg(null);
    const raw = (type === 'inst' ? newInst : newAdmin).trim();
    if (!raw) return;

    const targetList = type === 'inst' ? institucionales : administrativos;
    if (targetList.some((item) => item.toLowerCase() === raw.toLowerCase())) {
      setErrorMsg(`El cargo "${raw}" ya existe en la lista.`);
      return;
    }

    if (type === 'inst') {
      setInstitucionales([...institucionales, raw]);
      setNewInst('');
    } else {
      setAdministrativos([...administrativos, raw]);
      setNewAdmin('');
    }
  };

  const moveItem = (type: 'inst' | 'admin', idx: number, dir: -1 | 1) => {
    const list = type === 'inst' ? [...institucionales] : [...administrativos];
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    [list[idx], list[target]] = [list[target], list[idx]];
    if (type === 'inst') setInstitucionales(list);
    else setAdministrativos(list);
  };

  const removeItem = (type: 'inst' | 'admin', idx: number) => {
    if (type === 'inst') {
      setInstitucionales(institucionales.filter((_, i) => i !== idx));
      if (editingInstIdx === idx) setEditingInstIdx(null);
    } else {
      setAdministrativos(administrativos.filter((_, i) => i !== idx));
      if (editingAdminIdx === idx) setEditingAdminIdx(null);
    }
  };

  const commitEdit = (type: 'inst' | 'admin', idx: number) => {
    setErrorMsg(null);
    const val = (type === 'inst' ? editingInstVal : editingAdminVal).trim();
    if (!val) return;
    const list = type === 'inst' ? [...institucionales] : [...administrativos];
    const duplicate = list.some((item, i) => i !== idx && item.toLowerCase() === val.toLowerCase());
    if (duplicate) {
      setErrorMsg(`El cargo "${val}" ya existe en la lista.`);
      return;
    }
    list[idx] = val;
    if (type === 'inst') {
      setInstitucionales(list);
      setEditingInstIdx(null);
    } else {
      setAdministrativos(list);
      setEditingAdminIdx(null);
    }
  };

  const handleSave = async () => {
    setErrorMsg(null);
    setSavedMsg(null);
    if (institucionales.length === 0) {
      setErrorMsg('Debe haber al menos un Cargo Institucional registrado.');
      return;
    }

    setSaving(true);
    try {
      await saveCargosCatalog(institucionales, administrativos);
      await logActivity('Actualizó catálogo de cargos institucionales y administrativos', 'Configuracion', 'cargos_catalog', {
        total_institucionales: institucionales.length,
        total_administrativos: administrativos.length,
      });
      const msg = 'Catálogo de Cargos Institucionales y Administrativos guardado correctamente.';
      setSavedMsg(msg);
      onSuccess?.(msg);
      setTimeout(() => setSavedMsg(null), 4000);
    } catch (err: any) {
      console.error('Error guardando catálogo de cargos:', err);
      setErrorMsg(err?.message || 'Error al guardar el catálogo en la base de datos.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center text-xs text-slate-500">
        Cargando catálogo oficial de cargos...
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in">
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-700 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Catálogo de Cargos Institucionales y Administrativos
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Estos listados se mostrarán automáticamente en el registro y edición de socorristas, y estructuran los cargos principales y secundarios del carnet.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer shrink-0"
        >
          <Save className="w-3.5 h-3.5 mr-1.5" />
          {saving ? 'Guardando...' : 'Guardar Catálogo'}
        </button>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {savedMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{savedMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* TARJETA 1: CARGOS INSTITUCIONALES */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">Cargos Institucionales ({institucionales.length})</h3>
                <p className="text-[11px] text-slate-500">Se usan como Cargo Principal o Cargos Secundarios (ej. Socorrista, APAA, TEM)</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setInstitucionales([...DEFAULT_CARGOS_INSTITUCIONALES])}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-600 cursor-pointer"
              title="Restaurar lista predeterminada"
            >
              <RotateCcw className="w-3 h-3" />
              Predeterminados
            </button>
          </div>

          <div className="p-4 border-b border-slate-100 flex gap-2">
            <input
              type="text"
              value={newInst}
              onChange={(e) => setNewInst(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addItem('inst');
                }
              }}
              placeholder="Ej. Rescatista Vertical, BREC, APAA..."
              className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 outline-none"
            />
            <button
              type="button"
              onClick={() => addItem('inst')}
              className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar
            </button>
          </div>

          <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto flex-1">
            {institucionales.map((cargo, idx) => (
              <div key={`${cargo}-${idx}`} className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50/70">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  {editingInstIdx === idx ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <input
                        type="text"
                        value={editingInstVal}
                        onChange={(e) => setEditingInstVal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitEdit('inst', idx);
                          }
                        }}
                        autoFocus
                        className="flex-1 px-2.5 py-1 text-xs border border-emerald-400 rounded-lg outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => commitEdit('inst', idx)}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingInstIdx(null)}
                        className="p-1 text-slate-400 hover:bg-slate-100 rounded-md cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-slate-800 truncate">{cargo}</span>
                  )}
                </div>

                {editingInstIdx !== idx && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveItem('inst', idx, -1)}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                      title="Subir"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === institucionales.length - 1}
                      onClick={() => moveItem('inst', idx, 1)}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                      title="Bajar"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingInstIdx(idx);
                        setEditingInstVal(cargo);
                      }}
                      className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                      title="Editar nombre"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem('inst', idx)}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* TARJETA 2: CARGOS ADMINISTRATIVOS */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <Briefcase className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">Cargos Administrativos ({administrativos.length})</h3>
                <p className="text-[11px] text-slate-500">Se muestran al asignar un cargo administrativo (ej. Tesorero, Coordinador)</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAdministrativos([...DEFAULT_CARGOS_ADMINISTRATIVOS])}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-600 cursor-pointer"
              title="Restaurar lista predeterminada"
            >
              <RotateCcw className="w-3 h-3" />
              Predeterminados
            </button>
          </div>

          <div className="p-4 border-b border-slate-100 flex gap-2">
            <input
              type="text"
              value={newAdmin}
              onChange={(e) => setNewAdmin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addItem('admin');
                }
              }}
              placeholder="Ej. Tesorero, Coordinador de Operaciones..."
              className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none"
            />
            <button
              type="button"
              onClick={() => addItem('admin')}
              className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar
            </button>
          </div>

          <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto flex-1">
            {administrativos.map((cargo, idx) => (
              <div key={`${cargo}-${idx}`} className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50/70">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  {editingAdminIdx === idx ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <input
                        type="text"
                        value={editingAdminVal}
                        onChange={(e) => setEditingAdminVal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitEdit('admin', idx);
                          }
                        }}
                        autoFocus
                        className="flex-1 px-2.5 py-1 text-xs border border-blue-400 rounded-lg outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => commitEdit('admin', idx)}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingAdminIdx(null)}
                        className="p-1 text-slate-400 hover:bg-slate-100 rounded-md cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-slate-800 truncate">{cargo}</span>
                  )}
                </div>

                {editingAdminIdx !== idx && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveItem('admin', idx, -1)}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                      title="Subir"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === administrativos.length - 1}
                      onClick={() => moveItem('admin', idx, 1)}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                      title="Bajar"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAdminIdx(idx);
                        setEditingAdminVal(cargo);
                      }}
                      className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                      title="Editar nombre"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem('admin', idx)}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {administrativos.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400">
                No hay cargos administrativos registrados.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
