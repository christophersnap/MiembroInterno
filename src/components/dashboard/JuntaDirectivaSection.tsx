import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Settings, ShieldCheck, User, MapPin } from 'lucide-react';
import {
  DEFAULT_CARGOS_JDN,
  JDN_PERIODO_ACTUAL,
  JdnSlotView,
  loadJdnSlots,
} from '../../utils/cargosCatalog';
import { useAuth } from '../../contexts/AuthContext';
import SmartStorageImage from '../common/SmartStorageImage';

interface JuntaDirectivaSectionProps {
  preloadedSocorristas?: any[];
}

export default function JuntaDirectivaSection({ preloadedSocorristas }: JuntaDirectivaSectionProps) {
  const { role, permissions } = useAuth();
  const isAdmin = role === 'admin' || role === 'superadmin';
  const canAssignJdn = isAdmin || Boolean(permissions?.assign_jdn_cargos);
  const canOpenProfile = isAdmin || Boolean(permissions?.view_socorristas);

  const [slots, setSlots] = useState<JdnSlotView[]>(
    DEFAULT_CARGOS_JDN.map((cargo, idx) => ({
      cargo,
      orden: idx + 1,
      periodo: JDN_PERIODO_ACTUAL,
      miembro: null,
    }))
  );
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const { slots: loaded } = await loadJdnSlots(preloadedSocorristas);
      setSlots(loaded);
    } catch (err) {
      console.error('Error cargando Junta Directiva Nacional en Dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const onUpdated = () => refresh();
    window.addEventListener('jdn_updated', onUpdated);
    return () => window.removeEventListener('jdn_updated', onUpdated);
  }, [preloadedSocorristas]);

  const assignedCount = slots.filter((s) => Boolean(s.miembro)).length;
  const executiveSlots = slots.slice(0, 2); // Presidente, Vice presidente
  const boardSlots = slots.slice(2); // Tesorero .. 4to Vocal

  const renderMemberCard = (slot: JdnSlotView, featured = false) => {
    const m = slot.miembro;
    const initials = m?.nombre_completo
      ? m.nombre_completo
          .split(' ')
          .filter(Boolean)
          .slice(0, 2)
          .map((p) => p[0])
          .join('')
          .toUpperCase()
      : '';

    const cardBody = (
      <div
        className={`h-full rounded-2xl border transition-all flex items-center gap-3.5 ${
          featured
            ? m
              ? 'p-4 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/60 border-emerald-200/90 hover:border-emerald-300 shadow-2xs'
              : 'p-4 bg-slate-50/70 border-dashed border-slate-200'
            : m
            ? 'p-3.5 bg-white border-slate-200/80 hover:border-emerald-300 hover:shadow-xs'
            : 'p-3.5 bg-slate-50/50 border-dashed border-slate-200/90'
        }`}
      >
        <div
          className={`rounded-full overflow-hidden flex items-center justify-center shrink-0 border-2 ${
            featured ? 'w-14 h-14' : 'w-11 h-11'
          } ${
            m
              ? 'border-emerald-500/30 bg-emerald-100/70 text-emerald-800'
              : 'border-slate-200 bg-slate-100 text-slate-400'
          }`}
        >
          {m?.foto_url ? (
            <SmartStorageImage
              src={m.foto_url}
              alt={m.nombre_completo}
              className="w-full h-full object-cover"
            />
          ) : m ? (
            <span className={`${featured ? 'text-base' : 'text-xs'} font-extrabold`}>
              {initials || 'CV'}
            </span>
          ) : (
            <User className={featured ? 'w-6 h-6' : 'w-4 h-4'} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                featured
                  ? 'text-[10px] bg-emerald-700 text-white'
                  : 'text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200/80'
              }`}
            >
              {slot.cargo}
            </span>
          </div>

          {m ? (
            <>
              <p
                className={`font-bold text-slate-900 truncate mt-1 ${
                  featured ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'
                }`}
                title={m.nombre_completo}
              >
                {m.nombre_completo}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                {m.carnet && <span className="font-mono font-semibold text-slate-600">{m.carnet}</span>}
                <span className="inline-flex items-center gap-0.5 truncate">
                  <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span className="truncate">{m.seccional_nombre}</span>
                </span>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400 italic mt-1.5">Plaza vacante</p>
          )}
        </div>
      </div>
    );

    if (m && canOpenProfile) {
      return (
        <Link key={slot.cargo} to={`/socorristas/${m.socorrista_id}`} className="block group">
          {cardBody}
        </Link>
      );
    }

    return <div key={slot.cargo}>{cardBody}</div>;
  };

  return (
    <section className="bg-white/95 backdrop-blur-md shadow-xs border border-gray-200/80 rounded-3xl overflow-hidden">
      {/* HEADER INSTITUCIONAL */}
      <div className="px-5 sm:px-7 py-4 sm:py-5 bg-gradient-to-r from-[#062417] via-[#0b3823] to-[#0f4c30] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 shadow-inner">
            <Award className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
                Junta Directiva Nacional (JDN)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-300/35 text-[11px] font-bold text-emerald-100">
                Período {JDN_PERIODO_ACTUAL}
              </span>
            </div>
            <p className="text-xs text-emerald-100/80 mt-0.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <span>Autoridades Nacionales · Cruz Verde Salvadoreña</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <span className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs font-bold tabular-nums">
            {assignedCount} / {DEFAULT_CARGOS_JDN.length} cargos
          </span>
          {canAssignJdn && (
            <Link
              to="/configuracion?tab=cargos"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-emerald-950 hover:bg-emerald-50 text-xs font-bold transition-colors shadow-xs"
            >
              <Settings className="w-3.5 h-3.5" />
              Gestionar JDN
            </Link>
          )}
        </div>
      </div>

      {/* GRID DE INTEGRANTES */}
      <div className="p-5 sm:p-6 space-y-4">
        {loading ? (
          <div className="py-10 text-center text-xs text-slate-400">
            Cargando conformación de Junta Directiva Nacional...
          </div>
        ) : (
          <>
            {/* Presidencia y Vicepresidencia destacados */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {executiveSlots.map((slot) => renderMemberCard(slot, true))}
            </div>

            {/* Demás cargos directivos y vocalías */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {boardSlots.map((slot) => renderMemberCard(slot, false))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
