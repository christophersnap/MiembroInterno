import React from 'react';
import {
  Check,
  X,
  User,
  Shirt,
  Image as ImageIcon,
  Sun,
  Meh,
  Ban,
  Camera,
  Info,
} from 'lucide-react';

const GUIDE_RULES = [
  {
    icon: User,
    title: 'De frente',
    desc: 'Tipo pasaporte, con el rostro completamente visible.',
  },
  {
    icon: User,
    title: 'Peinado y cabello despejado',
    desc: 'Peinado ordenado; el cabello no debe tapar ni cubrir el rostro ni los ojos.',
  },
  {
    icon: Shirt,
    title: 'Vestimenta formal',
    desc: 'Camisa de botones blanca.',
  },
  {
    icon: ImageIcon,
    title: 'Fondo liso',
    desc: 'De un solo color, preferiblemente blanco, sin objetos ni diseños.',
  },
  {
    icon: Sun,
    title: 'Buena iluminación',
    desc: 'Luz natural o lugar bien iluminado. Sin sombras fuertes.',
  },
  {
    icon: Meh,
    title: 'Expresión neutral',
    desc: 'Sin sonreír.',
  },
  {
    icon: Ban,
    title: 'Sin accesorios',
    desc: 'No gorras, lentes oscuros o elementos que cubran el rostro.',
  },
  {
    icon: Camera,
    title: 'Foto nítida',
    desc: 'Sin filtros ni efectos.',
  },
];

function PortraitIllustration({
  variant,
}: {
  variant: 'correct' | 'shadow' | 'clutter' | 'cap' | 'sunglasses';
}) {
  const isClutter = variant === 'clutter';
  const isShadow = variant === 'shadow';
  const isCap = variant === 'cap';
  const isSunglasses = variant === 'sunglasses';

  return (
    <svg
      viewBox="0 0 120 132"
      className="w-full h-full block"
      role="img"
      aria-label={`Ejemplo de fotografía: ${variant}`}
    >
      {/* Background */}
      <rect
        width="120"
        height="132"
        rx="8"
        fill={isShadow ? '#cfd6dc' : isClutter ? '#f1ece4' : '#ffffff'}
      />

      {/* Clutter objects in background */}
      {isClutter && (
        <g opacity="0.85">
          <rect x="8" y="16" width="24" height="30" rx="2" fill="#d6c5b3" stroke="#b9a58f" strokeWidth="1.5" />
          <circle cx="98" cy="36" r="11" fill="#6ee7b7" />
          <rect x="93" y="45" width="10" height="16" rx="2" fill="#b45309" />
          <line x1="0" y1="68" x2="120" y2="68" stroke="#cbd5e1" strokeWidth="2" />
        </g>
      )}

      {/* Shadow gradient overlay on half face/bg */}
      {isShadow && (
        <defs>
          <linearGradient id="heavyShadow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(15,23,42,0.52)" />
            <stop offset="55%" stopColor="rgba(15,23,42,0.18)" />
            <stop offset="100%" stopColor="rgba(15,23,42,0)" />
          </linearGradient>
        </defs>
      )}

      {/* White collared shirt & shoulders */}
      <path
        d="M 16 132 C 18 101, 36 93, 60 93 C 84 93, 102 101, 104 132 Z"
        fill="#f8fafc"
        stroke="#cbd5e1"
        strokeWidth="1.5"
      />
      {/* Shirt collar */}
      <path d="M 46 92 L 60 112 L 74 92" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinejoin="round" />
      <line x1="60" y1="112" x2="60" y2="132" stroke="#cbd5e1" strokeWidth="1.2" />

      {/* Neck */}
      <rect x="50" y="76" width="20" height="20" rx="6" fill="#e5b798" />

      {/* Ears */}
      <ellipse cx="36" cy="54" rx="4.5" ry="7.5" fill="#dfa986" />
      <ellipse cx="84" cy="54" rx="4.5" ry="7.5" fill="#dfa986" />

      {/* Head */}
      <ellipse cx="60" cy="52" rx="23" ry="29" fill="#ecc2a6" />

      {/* Hair */}
      <path
        d="M 36 47 C 36 25, 48 18, 60 18 C 72 18, 84 25, 84 47 C 81 36, 73 30, 60 30 C 47 30, 39 36, 36 47 Z"
        fill="#1e293b"
      />

      {/* Eyebrows */}
      <path d="M 44 45 Q 49 42 54 44" fill="none" stroke="#1e293b" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M 66 44 Q 71 42 76 45" fill="none" stroke="#1e293b" strokeWidth="2.2" strokeLinecap="round" />

      {/* Eyes */}
      <circle cx="49" cy="51" r="2.4" fill="#0f172a" />
      <circle cx="71" cy="51" r="2.4" fill="#0f172a" />

      {/* Nose */}
      <path d="M 60 51 L 58 61 L 62 62" fill="none" stroke="#c89270" strokeWidth="1.6" strokeLinecap="round" />

      {/* Mouth: neutral vs smiling in clutter */}
      {isClutter ? (
        <path d="M 51 67 Q 60 75 69 67" fill="#ffffff" stroke="#a16248" strokeWidth="1.6" strokeLinecap="round" />
      ) : (
        <path d="M 53 69 Q 60 69.5 67 69" fill="none" stroke="#a16248" strokeWidth="1.8" strokeLinecap="round" />
      )}

      {/* Cap */}
      {isCap && (
        <g>
          <path d="M 34 39 C 34 18, 86 18, 86 39 Z" fill="#0f172a" />
          <path d="M 30 39 Q 60 47 90 39 Q 60 33 30 39 Z" fill="#020617" />
        </g>
      )}

      {/* Dark Sunglasses */}
      {isSunglasses && (
        <g>
          <rect x="39" y="45" width="18" height="12" rx="3.5" fill="#09090b" stroke="#334155" strokeWidth="1.2" />
          <rect x="63" y="45" width="18" height="12" rx="3.5" fill="#09090b" stroke="#334155" strokeWidth="1.2" />
          <line x1="57" y1="49" x2="63" y2="49" stroke="#09090b" strokeWidth="2.2" />
          <line x1="36" y1="49" x2="39" y2="49" stroke="#09090b" strokeWidth="1.8" />
          <line x1="81" y1="49" x2="84" y2="49" stroke="#09090b" strokeWidth="1.8" />
        </g>
      )}

      {/* Shadow overlay */}
      {isShadow && <rect width="120" height="132" rx="8" fill="url(#heavyShadow)" />}
    </svg>
  );
}

export default function CarnetPhotoGuideVisual() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4 text-slate-900">
      {/* Header */}
      <div className="space-y-1.5">
        <h4 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900">
          Requisitos para fotografía de carnet
        </h4>
        <div className="w-12 h-1 rounded-full bg-emerald-600" />
      </div>

      {/* 3-Column Infographic Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left: Correct Example */}
        <div className="lg:col-span-4 rounded-xl border border-emerald-200 bg-emerald-50/40 overflow-hidden flex flex-col justify-between">
          <div className="p-3 relative flex-1 flex items-center justify-center bg-white m-2 rounded-lg border border-slate-200/80">
            <span
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs"
              aria-hidden="true"
            >
              <Check className="w-4 h-4 stroke-[3]" />
            </span>
            <div className="w-36 h-40 sm:w-40 sm:h-44">
              <PortraitIllustration variant="correct" />
            </div>
          </div>
          <div className="px-3 py-2.5 bg-emerald-50 border-t border-emerald-200/70 flex items-center justify-center gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </span>
            <span className="text-xs sm:text-sm font-extrabold text-emerald-950">
              Ejemplo correcto
            </span>
          </div>
        </div>

        {/* Center: 7 Rules Checklist */}
        <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-slate-50/50 divide-y divide-slate-200/70 flex flex-col justify-between">
          {GUIDE_RULES.map((rule) => {
            const Icon = rule.icon;
            return (
              <div key={rule.title} className="px-3 py-2 flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200/70 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 leading-tight">{rule.title}</p>
                  <p className="text-[11px] text-slate-600 leading-snug mt-0.5">{rule.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Incorrect Examples */}
        <div className="lg:col-span-4 rounded-xl border border-rose-200 bg-white overflow-hidden flex flex-col">
          <div className="px-3 py-2 bg-rose-50 border-b border-rose-200/70 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0">
              <X className="w-3.5 h-3.5 stroke-[3]" />
            </span>
            <span className="text-xs sm:text-sm font-extrabold text-rose-950">
              Ejemplos incorrectos
            </span>
          </div>

          <div className="p-3 grid grid-cols-2 gap-2.5 flex-1">
            {[
              { variant: 'shadow' as const, label: 'Con sombras' },
              { variant: 'clutter' as const, label: 'Con objetos de fondo' },
              { variant: 'cap' as const, label: 'Con gorra' },
              { variant: 'sunglasses' as const, label: 'Con lentes oscuros' },
            ].map((bad) => (
              <div key={bad.label} className="space-y-1.5">
                <div className="aspect-[10/11] rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                  <PortraitIllustration variant={bad.variant} />
                </div>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 leading-tight">
                  <span className="w-3.5 h-3.5 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0">
                    <X className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                  <span className="truncate">{bad.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Notice */}
      <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center gap-2.5 text-xs text-emerald-950">
        <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center shrink-0">
          <Info className="w-3.5 h-3.5" />
        </span>
        <p className="leading-snug">
          <strong className="font-bold text-emerald-900">Importante:</strong> El fondo debe ser completamente uniforme para facilitar su reemplazo o edición digital posteriormente.
        </p>
      </div>
    </div>
  );
}
