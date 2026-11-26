import React, { useEffect, useState } from 'react';
import { Shield, Briefcase, Plus, X, ArrowLeft, ArrowRight, Star, Lock } from 'lucide-react';
import {
  CargoAssignmentRulesMap,
  DEFAULT_CARGOS_ADMINISTRATIVOS,
  DEFAULT_CARGOS_INSTITUCIONALES,
  canUserAssignCargo,
  getCachedCargosCatalog,
  getCargoAssignScope,
  loadCargosCatalog,
} from '../../utils/cargosCatalog';
import { useAuth } from '../../contexts/AuthContext';

interface CargosSelectorProps {
  cargoPrincipal: string;
  cargosSecundarios: string[];
  cargoAdministrativo: string;
  onChangePrincipal: (value: string) => void;
  onChangeSecundarios: (values: string[]) => void;
  onChangeAdministrativo: (value: string) => void;
  disabledPrincipal?: boolean;
  disabledAll?: boolean;
  minorNotice?: string;
  layout?: 'horizontal-rows' | 'grid';
}

const SCOPE_HINT: Record<string, string> = {
  seccional: 'Nivel Seccional / Nacional',
  nacional: 'Solo Nivel Nacional',
  bloqueado: 'Solo Administrador',
};

export default function CargosSelector({
  cargoPrincipal,
  cargosSecundarios,
  cargoAdministrativo,
  onChangePrincipal,
  onChangeSecundarios,
  onChangeAdministrativo,
  disabledPrincipal = false,
  disabledAll = false,
  minorNotice,
  layout = 'horizontal-rows',
}: CargosSelectorProps) {
  const { role, permissions, directorSeccionalId } = useAuth();
  const initial = getCachedCargosCatalog();
  const [institucionales, setInstitucionales] = useState<string[]>(
    initial.institucionales || DEFAULT_CARGOS_INSTITUCIONALES
  );
  const [administrativos, setAdministrativos] = useState<string[]>(
    initial.administrativos || DEFAULT_CARGOS_ADMINISTRATIVOS
  );
  const [asignacionReglas, setAsignacionReglas] = useState<CargoAssignmentRulesMap>(
    initial.asignacionReglas || {}
  );

  useEffect(() => {
    let active = true;
    const refresh = () => {
      loadCargosCatalog().then((res) => {
        if (!active) return;
        setInstitucionales(res.institucionales);
        setAdministrativos(res.administrativos);
        setAsignacionReglas(res.asignacionReglas || {});
      });
    };
    refresh();
    window.addEventListener('cargos_catalog_updated', refresh);
    return () => {
      active = false;
      window.removeEventListener('cargos_catalog_updated', refresh);
    };
  }, []);

  const userCtx = { role, permissions, directorSeccionalId };

  const isCargoAllowed = (cargoName: string): boolean => {
    if (!cargoName) return true;
    return canUserAssignCargo(cargoName, asignacionReglas, userCtx);
  };

  const principalOptions = (() => {
    const list = [...institucionales];
    if (cargoPrincipal && !list.some((c) => c.toLowerCase() === cargoPrincipal.toLowerCase())) {
      list.unshift(cargoPrincipal);
    }
    return list;
  })();

  const adminOptions = (() => {
    const list = [...administrativos];
    if (cargoAdministrativo && !list.some((c) => c.toLowerCase() === cargoAdministrativo.toLowerCase())) {
      list.unshift(cargoAdministrativo);
    }
    return list;
  })();

  const availableSecondaryOptions = institucionales.filter(
    (c) =>
      c.toLowerCase() !== (cargoPrincipal || '').trim().toLowerCase() &&
      !cargosSecundarios.some((s) => s.toLowerCase() === c.toLowerCase())
  );

  const hasAnyRestrictedInst = institucionales.some((c) => !isCargoAllowed(c));
  const hasAnyRestrictedAdmin = administrativos.some((c) => !isCargoAllowed(c));
  const isCurrentPrincipalLocked = Boolean(cargoPrincipal) && !isCargoAllowed(cargoPrincipal);
  const isCurrentAdminLocked = Boolean(cargoAdministrativo) && !isCargoAllowed(cargoAdministrativo);

  const handleSelectPrincipal = (val: string) => {
    if (val && !isCargoAllowed(val) && val.toLowerCase() !== (cargoPrincipal || '').toLowerCase()) {
      return;
    }
    onChangePrincipal(val);
    if (val) {
      const filtered = cargosSecundarios.filter((s) => s.toLowerCase() !== val.toLowerCase());
      if (filtered.length !== cargosSecundarios.length) {
        onChangeSecundarios(filtered);
      }
    }
  };

  const handleSelectAdmin = (val: string) => {
    if (val && !isCargoAllowed(val) && val.toLowerCase() !== (cargoAdministrativo || '').toLowerCase()) {
      return;
    }
    onChangeAdministrativo(val);
  };

  const handleAddSecondary = (cargo: string) => {
    const clean = cargo.trim();
    if (!clean) return;
    if (!isCargoAllowed(clean)) return;
    if (clean.toLowerCase() === (cargoPrincipal || '').trim().toLowerCase()) return;
    if (cargosSecundarios.some((s) => s.toLowerCase() === clean.toLowerCase())) return;
    onChangeSecundarios([...cargosSecundarios, clean]);
  };

  const handleMoveSecondary = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= cargosSecundarios.length) return;
    const copy = [...cargosSecundarios];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    onChangeSecundarios(copy);
  };

  const handlePromoteToPrincipal = (idx: number) => {
    if (disabledPrincipal || disabledAll || isCurrentPrincipalLocked) return;
    const promoted = cargosSecundarios[idx];
    if (!promoted || !isCargoAllowed(promoted)) return;
    const rest = cargosSecundarios.filter((_, i) => i !== idx);
    if (cargoPrincipal && cargoPrincipal.trim() && cargoPrincipal.toLowerCase() !== promoted.toLowerCase()) {
      rest.unshift(cargoPrincipal);
    }
    onChangePrincipal(promoted);
    onChangeSecundarios(rest);
  };

  const renderSecondarySection = () => (
    <div className="space-y-3">
      {/* Selected secondary chips ordered */}
      {cargosSecundarios.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {cargosSecundarios.map((sec, idx) => {
            const canModifyThisChip = isCargoAllowed(sec);
            return (
              <div
                key={`${sec}-${idx}`}
                className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold shadow-2xs"
              >
                <span className="text-[10px] font-bold text-emerald-600">{idx + 1}.</span>
                <span>{sec}</span>
                {!disabledAll && (
                  <div className="inline-flex items-center gap-0.5 ml-1 border-l border-emerald-200 pl-1">
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => handleMoveSecondary(idx, -1)}
                        className="p-0.5 text-emerald-700 hover:bg-emerald-100 rounded cursor-pointer"
                        title="Mover antes"
                      >
                        <ArrowLeft className="w-3 h-3" />
                      </button>
                    )}
                    {idx < cargosSecundarios.length - 1 && (
                      <button
                        type="button"
                        onClick={() => handleMoveSecondary(idx, 1)}
                        className="p-0.5 text-emerald-700 hover:bg-emerald-100 rounded cursor-pointer"
                        title="Mover después"
                      >
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                    {!disabledPrincipal && !isCurrentPrincipalLocked && canModifyThisChip && (
                      <button
                        type="button"
                        onClick={() => handlePromoteToPrincipal(idx)}
                        className="p-0.5 text-amber-600 hover:bg-amber-100 rounded cursor-pointer"
                        title="Convertir en Cargo Principal"
                      >
                        <Star className="w-3 h-3" />
                      </button>
                    )}
                    {canModifyThisChip ? (
                      <button
                        type="button"
                        onClick={() => onChangeSecundarios(cargosSecundarios.filter((_, i) => i !== idx))}
                        className="p-0.5 text-rose-600 hover:bg-rose-100 rounded cursor-pointer"
                        title="Quitar"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    ) : (
                      <span
                        className="p-0.5 text-slate-400"
                        title="Cargo asignado por nivel superior (restringido para tu usuario)"
                      >
                        <Lock className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Quick add from catalog */}
      {!disabledAll && (
        <div className="space-y-2">
          {availableSecondaryOptions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {availableSecondaryOptions.map((opt) => {
                const allowed = isCargoAllowed(opt);
                const scope = getCargoAssignScope(opt, asignacionReglas);
                if (!allowed) {
                  return (
                    <span
                      key={opt}
                      title={`Restringido: ${SCOPE_HINT[scope] || 'Nivel superior'}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] font-medium text-slate-400 cursor-not-allowed select-none"
                    >
                      <Lock className="w-3 h-3 text-slate-400" />
                      {opt}
                    </span>
                  );
                }
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleAddSecondary(opt)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 border border-slate-200 text-[11px] font-medium text-slate-700 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-emerald-600" />
                    {opt}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 italic">
              Todas las especialidades del catálogo ya han sido agregadas.
            </p>
          )}
          <p className="text-[11px] text-slate-500">
            Las especialidades y permisos de asignación por cargo se administran en{' '}
            <strong>Configuración &gt; Cargos y Rangos</strong>.
          </p>
        </div>
      )}

      {/* Mini preview of how it displays on Carnet */}
      {(cargoPrincipal || cargosSecundarios.length > 0) && (
        <div className="p-2.5 rounded-xl bg-slate-900 text-white text-center max-w-sm shadow-2xs">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">
            Vista previa jerarquía en carnet
          </div>
          <div className="text-sm font-extrabold tracking-wide leading-tight">
            {(cargoPrincipal || 'CARGO PRINCIPAL').toUpperCase()}
          </div>
          {cargosSecundarios.length > 0 && (
            <div className="text-[11px] font-semibold text-emerald-300 mt-0.5 tracking-wide">
              {cargosSecundarios.map((s) => s.toUpperCase()).join(' | ')}
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (layout === 'grid') {
    return (
      <>
        <div className="sm:col-span-3">
          <label className="block text-sm font-medium text-gray-700 flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-primary" />
            Cargo Institucional Principal <span className="text-red-500">*</span>
          </label>
          <div className="mt-1">
            <select
              name="cargo_institucional"
              required
              value={cargoPrincipal}
              onChange={(e) => handleSelectPrincipal(e.target.value)}
              disabled={disabledPrincipal || disabledAll || isCurrentPrincipalLocked}
              className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="">Seleccione un cargo institucional...</option>
              {principalOptions.map((c) => {
                const allowed = isCargoAllowed(c);
                const isCurrent = c.toLowerCase() === (cargoPrincipal || '').toLowerCase();
                const scope = getCargoAssignScope(c, asignacionReglas);
                return (
                  <option key={c} value={c} disabled={!allowed && !isCurrent}>
                    {c}
                    {!allowed ? ` (Restringido · ${SCOPE_HINT[scope] || 'Nivel superior'})` : ''}
                  </option>
                );
              })}
            </select>
            {isCurrentPrincipalLocked && (
              <p className="mt-1 text-[11px] text-amber-700 flex items-center gap-1">
                <Lock className="w-3 h-3 shrink-0" />
                Cargo reservado para nivel superior; no modificable por tu usuario.
              </p>
            )}
            {!isCurrentPrincipalLocked && hasAnyRestrictedInst && (
              <p className="mt-1 text-[11px] text-slate-500">
                Algunos rangos están restringidos según tu nivel de usuario.
              </p>
            )}
            {minorNotice && <p className="mt-1 text-xs text-amber-700">{minorNotice}</p>}
          </div>
        </div>

        <div className="sm:col-span-3">
          <label className="block text-sm font-medium text-gray-700 flex items-center gap-1.5">
            <Briefcase className="w-4 h-4 text-gray-500" />
            Cargo Administrativo
          </label>
          <div className="mt-1">
            <select
              name="cargo_administrativo"
              value={cargoAdministrativo}
              onChange={(e) => handleSelectAdmin(e.target.value)}
              disabled={disabledAll || isCurrentAdminLocked}
              className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="">Ninguno / Sin cargo administrativo</option>
              {adminOptions.map((c) => {
                const allowed = isCargoAllowed(c);
                const isCurrent = c.toLowerCase() === (cargoAdministrativo || '').toLowerCase();
                const scope = getCargoAssignScope(c, asignacionReglas);
                return (
                  <option key={c} value={c} disabled={!allowed && !isCurrent}>
                    {c}
                    {!allowed ? ` (Restringido · ${SCOPE_HINT[scope] || 'Nivel superior'})` : ''}
                  </option>
                );
              })}
            </select>
            {isCurrentAdminLocked && (
              <p className="mt-1 text-[11px] text-amber-700 flex items-center gap-1">
                <Lock className="w-3 h-3 shrink-0" />
                Cargo administrativo asignado por nivel superior.
              </p>
            )}
            {!isCurrentAdminLocked && hasAnyRestrictedAdmin && (
              <p className="mt-1 text-[11px] text-slate-500">
                Opciones bloqueadas requieren autorización de nivel superior.
              </p>
            )}
          </div>
        </div>

        <div className="sm:col-span-6">
          <label className="block text-sm font-medium text-gray-700">
            Cargos Secundarios / Especialidades en Carnet
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Agrega y ordena especialidades (ej. APAA, Rescatista Vertical). Se mostrarán en formato pequeño debajo del Cargo Principal en el carnet.
          </p>
          {renderSecondarySection()}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">
            Cargo Institucional Principal <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-gray-500 mt-1">
            Aparecerá en tamaño destacado (grande) en el carnet. Configurado en Ajustes.
          </p>
        </div>
        <div className="mt-1 sm:mt-0 sm:col-span-2">
          <select
            name="cargo_institucional"
            required
            value={cargoPrincipal}
            onChange={(e) => handleSelectPrincipal(e.target.value)}
            disabled={disabledPrincipal || disabledAll || isCurrentPrincipalLocked}
            className="max-w-lg block w-full shadow-sm focus:ring-primary focus:border-primary sm:max-w-xs sm:text-sm border-gray-300 rounded-md border p-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">Seleccione un cargo institucional...</option>
            {principalOptions.map((c) => {
              const allowed = isCargoAllowed(c);
              const isCurrent = c.toLowerCase() === (cargoPrincipal || '').toLowerCase();
              const scope = getCargoAssignScope(c, asignacionReglas);
              return (
                <option key={c} value={c} disabled={!allowed && !isCurrent}>
                  {c}
                  {!allowed ? ` (Restringido · ${SCOPE_HINT[scope] || 'Nivel superior'})` : ''}
                </option>
              );
            })}
          </select>
          {isCurrentPrincipalLocked && (
            <p className="mt-1 text-[11px] text-amber-700 flex items-center gap-1">
              <Lock className="w-3 h-3 shrink-0" />
              Cargo reservado para nivel superior; no modificable por tu usuario.
            </p>
          )}
          {minorNotice && <p className="mt-1 text-xs text-amber-700">{minorNotice}</p>}
        </div>
      </div>

      <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">
            Cargos Secundarios / Especialidades
          </label>
          <p className="text-xs text-gray-500 mt-1">
            Opcionales (ej. APAA, BREC). Se ordenan y aparecen en tamaño pequeño debajo del cargo principal en el carnet.
          </p>
        </div>
        <div className="mt-1 sm:mt-0 sm:col-span-2">{renderSecondarySection()}</div>
      </div>

      <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2">
            Cargo Administrativo
          </label>
          <p className="text-xs text-gray-500 mt-1">
            Opciones oficiales configuradas en Ajustes &gt; Cargos y Rangos.
          </p>
        </div>
        <div className="mt-1 sm:mt-0 sm:col-span-2">
          <select
            name="cargo_administrativo"
            value={cargoAdministrativo}
            onChange={(e) => handleSelectAdmin(e.target.value)}
            disabled={disabledAll || isCurrentAdminLocked}
            className="max-w-lg block w-full shadow-sm focus:ring-primary focus:border-primary sm:max-w-xs sm:text-sm border-gray-300 rounded-md border p-2 disabled:bg-gray-100"
          >
            <option value="">Ninguno / Sin cargo administrativo</option>
            {adminOptions.map((c) => {
              const allowed = isCargoAllowed(c);
              const isCurrent = c.toLowerCase() === (cargoAdministrativo || '').toLowerCase();
              const scope = getCargoAssignScope(c, asignacionReglas);
              return (
                <option key={c} value={c} disabled={!allowed && !isCurrent}>
                  {c}
                  {!allowed ? ` (Restringido · ${SCOPE_HINT[scope] || 'Nivel superior'})` : ''}
                </option>
              );
            })}
          </select>
          {isCurrentAdminLocked && (
            <p className="mt-1 text-[11px] text-amber-700 flex items-center gap-1">
              <Lock className="w-3 h-3 shrink-0" />
              Cargo administrativo reservado para nivel superior.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
