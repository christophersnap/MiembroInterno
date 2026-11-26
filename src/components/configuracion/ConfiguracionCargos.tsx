import React, { useEffect, useMemo, useState } from 'react';
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
  Lock,
  Award,
  Search,
  UserPlus,
  UserMinus,
  Users,
} from 'lucide-react';
import {
  CARGO_ASSIGN_SCOPE_OPTIONS,
  CargoAssignScope,
  CargoAssignmentRulesMap,
  DEFAULT_CARGOS_ADMINISTRATIVOS,
  DEFAULT_CARGOS_INSTITUCIONALES,
  DEFAULT_CARGOS_JDN,
  JDN_PERIODO_ACTUAL,
  JdnSlotView,
  assignJdnCargoSafe,
  getCargoAssignScope,
  loadCargosCatalog,
  loadJdnSlots,
  normalizeCargoRuleKey,
  saveCargosCatalog,
} from '../../utils/cargosCatalog';
import { logActivity } from '../../lib/logger';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import SmartStorageImage from '../common/SmartStorageImage';

interface ConfiguracionCargosProps {
  onSuccess?: (message: string) => void;
}

interface SocorristaPickerItem {
  id: number;
  nombre_completo: string;
  carnet: string;
  foto_url: string | null;
  seccional_id: number | null;
  seccional_nombre: string;
  cargo_institucional: string | null;
  estado: string | null;
}

const SCOPE_BADGE_CLASSES: Record<CargoAssignScope, string> = {
  todos: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  seccional: 'bg-sky-50 text-sky-800 border-sky-200',
  nacional: 'bg-amber-50 text-amber-800 border-amber-200',
  bloqueado: 'bg-rose-50 text-rose-800 border-rose-200',
};

export default function ConfiguracionCargos({ onSuccess }: ConfiguracionCargosProps) {
  const { role, permissions } = useAuth();
  const isAdmin = role === 'admin' || role === 'superadmin';
  const canAssignJdn = isAdmin || Boolean(permissions?.assign_jdn_cargos);

  const [institucionales, setInstitucionales] = useState<string[]>(DEFAULT_CARGOS_INSTITUCIONALES);
  const [administrativos, setAdministrativos] = useState<string[]>(DEFAULT_CARGOS_ADMINISTRATIVOS);
  const [asignacionReglas, setAsignacionReglas] = useState<CargoAssignmentRulesMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [newInst, setNewInst] = useState('');
  const [newInstScope, setNewInstScope] = useState<CargoAssignScope>('todos');
  const [newAdmin, setNewAdmin] = useState('');
  const [newAdminScope, setNewAdminScope] = useState<CargoAssignScope>('seccional');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const [editingInstIdx, setEditingInstIdx] = useState<number | null>(null);
  const [editingInstVal, setEditingInstVal] = useState('');
  const [editingAdminIdx, setEditingAdminIdx] = useState<number | null>(null);
  const [editingAdminVal, setEditingAdminVal] = useState('');

  // Junta Directiva Nacional (JDN) state
  const [jdnSlots, setJdnSlots] = useState<JdnSlotView[]>(
    DEFAULT_CARGOS_JDN.map((cargo, idx) => ({
      cargo,
      orden: idx + 1,
      periodo: JDN_PERIODO_ACTUAL,
      miembro: null,
    }))
  );
  const [jdnBySocId, setJdnBySocId] = useState<Record<number, string>>({});
  const [jdnLoading, setJdnLoading] = useState(true);
  const [jdnBusyCargo, setJdnBusyCargo] = useState<string | null>(null);
  const [confirmReleaseCargo, setConfirmReleaseCargo] = useState<string | null>(null);

  // Picker modal for assigning a JDN seat
  const [pickerCargo, setPickerCargo] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerList, setPickerList] = useState<SocorristaPickerItem[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  const fetchJdnData = async () => {
    setJdnLoading(true);
    try {
      const { slots, bySocorristaId } = await loadJdnSlots();
      setJdnSlots(slots);
      setJdnBySocId(bySocorristaId);
    } catch (err) {
      console.error('Error cargando JDN:', err);
    } finally {
      setJdnLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    loadCargosCatalog().then((res) => {
      if (!active) return;
      setInstitucionales(res.institucionales);
      setAdministrativos(res.administrativos);
      setAsignacionReglas(res.asignacionReglas || {});
      setLoading(false);
    });
    fetchJdnData();

    const onJdnUpdated = () => {
      if (active) fetchJdnData();
    };
    window.addEventListener('jdn_updated', onJdnUpdated);
    return () => {
      active = false;
      window.removeEventListener('jdn_updated', onJdnUpdated);
    };
  }, []);

  const openJdnPicker = async (cargo: string) => {
    if (!canAssignJdn) return;
    setPickerCargo(cargo);
    setPickerSearch('');
    setErrorMsg(null);
    if (pickerList.length > 0) return;

    setPickerLoading(true);
    try {
      const { data, error } = await supabase
        .from('socorristas')
        .select(
          'id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, carnet, foto_url, seccional_id, cargo_institucional, estado, seccionales(nombre)'
        )
        .order('primer_nombre', { ascending: true });

      if (!error && Array.isArray(data)) {
        const mapped: SocorristaPickerItem[] = data
          .filter((s: any) => String(s.estado || 'Activo').toLowerCase() !== 'inactivo')
          .map((s: any) => ({
            id: Number(s.id),
            nombre_completo: [
              s.primer_nombre,
              s.segundo_nombre,
              s.primer_apellido,
              s.segundo_apellido,
            ]
              .filter(Boolean)
              .join(' ')
              .trim(),
            carnet: s.carnet || '',
            foto_url: s.foto_url || null,
            seccional_id: s.seccional_id ? Number(s.seccional_id) : null,
            seccional_nombre: Array.isArray(s.seccionales)
              ? s.seccionales[0]?.nombre || 'Sin seccional'
              : s.seccionales?.nombre || 'Sin seccional',
            cargo_institucional: s.cargo_institucional || null,
            estado: s.estado || 'Activo',
          }));
        setPickerList(mapped);
      }
    } catch (err) {
      console.error('Error cargando socorristas para JDN:', err);
    } finally {
      setPickerLoading(false);
    }
  };

  const filteredPickerList = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return pickerList.slice(0, 60);
    return pickerList
      .filter(
        (s) =>
          s.nombre_completo.toLowerCase().includes(q) ||
          s.carnet.toLowerCase().includes(q) ||
          s.seccional_nombre.toLowerCase().includes(q)
      )
      .slice(0, 60);
  }, [pickerList, pickerSearch]);

  const handleAssignJdnMember = async (cargo: string, soc: SocorristaPickerItem) => {
    if (!canAssignJdn) return;
    setErrorMsg(null);
    setSavedMsg(null);
    setJdnBusyCargo(cargo);
    try {
      const res = await assignJdnCargoSafe({
        cargoJdn: cargo,
        socorristaId: soc.id,
        socorristaSnapshot: {
          id: soc.id,
          nombre_completo: soc.nombre_completo,
          carnet: soc.carnet,
          foto_url: soc.foto_url,
          seccional_id: soc.seccional_id,
          seccional_nombre: soc.seccional_nombre,
          cargo_institucional: soc.cargo_institucional,
        },
        periodo: JDN_PERIODO_ACTUAL,
        replaceExisting: true,
      });

      if (!res.ok) {
        setErrorMsg(res.error || 'No se pudo asignar el cargo de Junta Directiva Nacional.');
        return;
      }

      await logActivity(`Asignó cargo JDN: ${cargo}`, 'Configuracion', String(soc.id), {
        cargo_jdn: cargo,
        periodo: JDN_PERIODO_ACTUAL,
        socorrista: soc.nombre_completo,
        carnet: soc.carnet,
      });

      await fetchJdnData();
      setPickerCargo(null);
      const msg = `${soc.nombre_completo} fue asignado(a) como ${cargo} de la Junta Directiva Nacional (${JDN_PERIODO_ACTUAL}).`;
      setSavedMsg(msg);
      onSuccess?.(msg);
      setTimeout(() => setSavedMsg(null), 4500);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error inesperado al asignar el cargo JDN.');
    } finally {
      setJdnBusyCargo(null);
    }
  };

  const handleReleaseJdnCargo = async (slot: JdnSlotView) => {
    if (!canAssignJdn || !slot.miembro) return;
    setErrorMsg(null);
    setSavedMsg(null);
    setJdnBusyCargo(slot.cargo);
    try {
      const prevName = slot.miembro.nombre_completo;
      const res = await assignJdnCargoSafe({
        cargoJdn: null,
        socorristaId: slot.miembro.socorrista_id,
        periodo: JDN_PERIODO_ACTUAL,
      });
      if (!res.ok) {
        setErrorMsg(res.error || 'No se pudo liberar el cargo JDN.');
        return;
      }

      await logActivity(`Liberó cargo JDN: ${slot.cargo}`, 'Configuracion', String(slot.miembro.socorrista_id), {
        cargo_jdn: slot.cargo,
        periodo: JDN_PERIODO_ACTUAL,
        socorrista_anterior: prevName,
      });

      setConfirmReleaseCargo(null);
      await fetchJdnData();
      const msg = `El cargo ${slot.cargo} quedó vacante.`;
      setSavedMsg(msg);
      onSuccess?.(msg);
      setTimeout(() => setSavedMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al liberar el cargo JDN.');
    } finally {
      setJdnBusyCargo(null);
    }
  };

  const setCargoRule = (cargoName: string, scope: CargoAssignScope) => {
    const key = normalizeCargoRuleKey(cargoName);
    if (!key) return;
    setAsignacionReglas((prev) => ({ ...prev, [key]: scope }));
  };

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
      setCargoRule(raw, newInstScope);
      setNewInst('');
    } else {
      setAdministrativos([...administrativos, raw]);
      setCargoRule(raw, newAdminScope);
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
    const oldKey = normalizeCargoRuleKey(list[idx]);
    const newKey = normalizeCargoRuleKey(val);
    if (oldKey && newKey && oldKey !== newKey && asignacionReglas[oldKey]) {
      setAsignacionReglas((prev) => {
        const copy = { ...prev };
        copy[newKey] = prev[oldKey];
        delete copy[oldKey];
        return copy;
      });
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
      await saveCargosCatalog(institucionales, administrativos, asignacionReglas);
      await logActivity(
        'Actualizó catálogo de cargos y reglas de asignación por nivel',
        'Configuracion',
        'cargos_catalog',
        {
          total_institucionales: institucionales.length,
          total_administrativos: administrativos.length,
          reglas_personalizadas: Object.keys(asignacionReglas).length,
        }
      );
      const msg = 'Catálogo de Cargos y permisos de asignación individual guardados correctamente.';
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

  const assignedJdnCount = jdnSlots.filter((s) => Boolean(s.miembro)).length;

  if (loading) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center text-xs text-slate-500">
        Cargando catálogo oficial de cargos...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* ENCABEZADO Y GUARDAR */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-700 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Catálogo de Cargos, Rangos y Permisos de Asignación
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Define individualmente qué nivel de usuario puede asignar cada cargo o rango (Todos, Seccional/Nacional, Solo Nacional o Solo Admin) y administra la Junta Directiva Nacional.
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
          {saving ? 'Guardando...' : 'Guardar Catálogo y Reglas'}
        </button>
      </div>

      {/* LEYENDA DE NIVELES DE ASIGNACIÓN */}
      <div className="bg-slate-50/90 border border-slate-200/80 rounded-2xl p-3.5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
        {CARGO_ASSIGN_SCOPE_OPTIONS.map((opt) => (
          <div key={opt.value} className="flex items-start gap-2 bg-white rounded-xl p-2.5 border border-slate-200/70">
            <span
              className={`px-2 py-0.5 rounded-md border text-[10px] font-bold shrink-0 mt-0.5 ${SCOPE_BADGE_CLASSES[opt.value]}`}
            >
              {opt.shortLabel}
            </span>
            <p className="text-[11px] text-slate-600 leading-snug">{opt.description}</p>
          </div>
        ))}
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

      {/* TARJETAS DE CARGOS INSTITUCIONALES Y ADMINISTRATIVOS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* TARJETA 1: CARGOS INSTITUCIONALES */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">
                  Cargos Institucionales ({institucionales.length})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Cargo Principal o Secundarios · Regla individual de asignación por rango
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setInstitucionales([...DEFAULT_CARGOS_INSTITUCIONALES])}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-600 cursor-pointer shrink-0"
              title="Restaurar lista predeterminada"
            >
              <RotateCcw className="w-3 h-3" />
              Predeterminados
            </button>
          </div>

          <div className="p-3.5 border-b border-slate-100 flex flex-col sm:flex-row gap-2">
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
            <select
              value={newInstScope}
              onChange={(e) => setNewInstScope(e.target.value as CargoAssignScope)}
              className="px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium outline-none"
              title="Quién puede asignar este cargo"
            >
              {CARGO_ASSIGN_SCOPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.shortLabel}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => addItem('inst')}
              className="inline-flex items-center justify-center gap-1 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar
            </button>
          </div>

          <div className="divide-y divide-slate-100 max-h-[430px] overflow-y-auto flex-1">
            {institucionales.map((cargo, idx) => {
              const scope = getCargoAssignScope(cargo, asignacionReglas);
              return (
                <div
                  key={`${cargo}-${idx}`}
                  className="px-4 py-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 hover:bg-slate-50/70"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center shrink-0 tabular-nums">
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
                    <div className="flex items-center gap-1.5 shrink-0">
                      <select
                        value={scope}
                        onChange={(e) => setCargoRule(cargo, e.target.value as CargoAssignScope)}
                        aria-label={`Nivel de asignación para ${cargo}`}
                        className={`px-2 py-1 rounded-lg border text-[11px] font-semibold outline-none cursor-pointer ${SCOPE_BADGE_CLASSES[scope]}`}
                      >
                        {CARGO_ASSIGN_SCOPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value} className="bg-white text-slate-800">
                            {opt.shortLabel}
                          </option>
                        ))}
                      </select>

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
              );
            })}
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
                <h3 className="text-xs font-bold text-slate-900">
                  Cargos Administrativos ({administrativos.length})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Cargos administrativos de seccional · Regla individual de asignación
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAdministrativos([...DEFAULT_CARGOS_ADMINISTRATIVOS])}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-600 cursor-pointer shrink-0"
              title="Restaurar lista predeterminada"
            >
              <RotateCcw className="w-3 h-3" />
              Predeterminados
            </button>
          </div>

          <div className="p-3.5 border-b border-slate-100 flex flex-col sm:flex-row gap-2">
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
            <select
              value={newAdminScope}
              onChange={(e) => setNewAdminScope(e.target.value as CargoAssignScope)}
              className="px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium outline-none"
              title="Quién puede asignar este cargo"
            >
              {CARGO_ASSIGN_SCOPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.shortLabel}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => addItem('admin')}
              className="inline-flex items-center justify-center gap-1 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar
            </button>
          </div>

          <div className="divide-y divide-slate-100 max-h-[430px] overflow-y-auto flex-1">
            {administrativos.map((cargo, idx) => {
              const scope = getCargoAssignScope(cargo, asignacionReglas);
              return (
                <div
                  key={`${cargo}-${idx}`}
                  className="px-4 py-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 hover:bg-slate-50/70"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center shrink-0 tabular-nums">
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
                    <div className="flex items-center gap-1.5 shrink-0">
                      <select
                        value={scope}
                        onChange={(e) => setCargoRule(cargo, e.target.value as CargoAssignScope)}
                        aria-label={`Nivel de asignación para ${cargo}`}
                        className={`px-2 py-1 rounded-lg border text-[11px] font-semibold outline-none cursor-pointer ${SCOPE_BADGE_CLASSES[scope]}`}
                      >
                        {CARGO_ASSIGN_SCOPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value} className="bg-white text-slate-800">
                            {opt.shortLabel}
                          </option>
                        ))}
                      </select>

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
              );
            })}
            {administrativos.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400">
                No hay cargos administrativos registrados.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SECCIÓN 3: JUNTA DIRECTIVA NACIONAL (JDN) — PERÍODO 2026 - 2028      */}
      {/* ===================================================================== */}
      <div className="bg-white border border-emerald-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-emerald-100 bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold tracking-tight">
                  Junta Directiva Nacional (JDN) — Cruz Verde Salvadoreña
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-emerald-400/20 border border-emerald-300/30 text-[11px] font-bold text-emerald-100">
                  Período {JDN_PERIODO_ACTUAL}
                </span>
              </div>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                Cargos oficiales únicos a nivel nacional (1 persona por cargo). Solo usuarios con el permiso <strong>Asignar cargos de Junta Directiva Nacional (JDN)</strong> en Accesos pueden asignarlos.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs font-bold tabular-nums">
              {assignedJdnCount} / {DEFAULT_CARGOS_JDN.length} asignados
            </span>
          </div>
        </div>

        {!canAssignJdn && (
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-200/80 flex items-center gap-2 text-xs text-amber-900 font-medium">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Vista de solo lectura. Solicita a un Administrador habilitar el permiso{' '}
              <strong>«Asignar cargos de Junta Directiva Nacional (JDN)»</strong> en el módulo Accesos para asignar o modificar estos cargos.
            </span>
          </div>
        )}

        {jdnLoading ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Cargando conformación actual de la Junta Directiva Nacional...
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {jdnSlots.map((slot) => {
              const isBusy = jdnBusyCargo === slot.cargo;
              const isConfirmingRelease = confirmReleaseCargo === slot.cargo;
              const miembro = slot.miembro;

              return (
                <div
                  key={slot.cargo}
                  className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-extrabold flex items-center justify-center shrink-0 tabular-nums">
                      {slot.orden}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-slate-900">
                          {slot.cargo}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          Plaza única nacional
                        </span>
                      </div>

                      {miembro ? (
                        <div className="mt-1.5 flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full overflow-hidden border border-emerald-200 bg-emerald-50 flex items-center justify-center shrink-0">
                            {miembro.foto_url ? (
                              <SmartStorageImage
                                src={miembro.foto_url}
                                alt={miembro.nombre_completo}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Users className="w-4 h-4 text-emerald-600" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-emerald-950 truncate">
                              {miembro.nombre_completo}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {miembro.carnet ? `Carnet ${miembro.carnet}` : 'Sin carnet'} ·{' '}
                              {miembro.seccional_nombre}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-slate-400 italic">
                          Vacante — Sin socorrista asignado actualmente
                        </p>
                      )}
                    </div>
                  </div>

                  {canAssignJdn && (
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {isConfirmingRelease && miembro ? (
                        <div className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-xl px-2.5 py-1.5">
                          <span className="text-[11px] font-semibold text-rose-800">
                            ¿Liberar plaza?
                          </span>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleReleaseJdnCargo(slot)}
                            className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                          >
                            Sí
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmReleaseCargo(null)}
                            className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px] font-semibold cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => openJdnPicker(slot.cargo)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            {miembro ? 'Cambiar' : 'Asignar'}
                          </button>

                          {miembro && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => setConfirmReleaseCargo(slot.cargo)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-600 hover:text-rose-700 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                              title="Liberar este cargo"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                              Liberar
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL DE SELECCIÓN DE SOCORRISTA PARA CARGO JDN */}
      {pickerCargo && canAssignJdn && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full max-h-[82vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/70">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Asignar {pickerCargo} — JDN ({JDN_PERIODO_ACTUAL})
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Solo una persona a nivel nacional puede ocupar este cargo. Si ya existe un titular, será reemplazado.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickerCargo(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Buscar socorrista por nombre, carnet o seccional..."
                  autoFocus
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {pickerLoading ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Cargando padrón de socorristas activos...
                </div>
              ) : filteredPickerList.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No se encontraron socorristas activos que coincidan con tu búsqueda.
                </div>
              ) : (
                filteredPickerList.map((soc) => {
                  const existingJdnCargo = jdnBySocId[soc.id];
                  const isSameSeat = existingJdnCargo === pickerCargo;
                  return (
                    <button
                      key={soc.id}
                      type="button"
                      disabled={isSameSeat || jdnBusyCargo === pickerCargo}
                      onClick={() => handleAssignJdnMember(pickerCargo, soc)}
                      className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-emerald-50/50 transition-colors cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center shrink-0">
                          {soc.foto_url ? (
                            <SmartStorageImage
                              src={soc.foto_url}
                              alt={soc.nombre_completo}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-bold text-slate-500">
                              {soc.nombre_completo.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {soc.nombre_completo}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {soc.carnet ? `Carnet ${soc.carnet}` : 'Sin carnet'} · {soc.seccional_nombre}
                          </p>
                          {existingJdnCargo && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-[10px] font-semibold text-amber-800">
                              {isSameSeat
                                ? 'Titular actual de este cargo'
                                : `Actualmente: ${existingJdnCargo} (se reasignará)`}
                            </span>
                          )}
                        </div>
                      </div>

                      <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold shrink-0">
                        {isSameSeat ? 'Actual' : 'Seleccionar'}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
