import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, ExternalLink, ChevronRight } from 'lucide-react';
import {
  calculateCountdownRemaining,
  getCountdownFontFamily,
  NoticiaCountdown,
  NoticiasCountdownConfig,
} from '../../lib/noticiasCountdown';
import { formatFechaSV, formatHoraSV } from '../../utils/dateUtils';

interface CountdownBannerSectionProps {
  countdowns: NoticiaCountdown[];
  config: NoticiasCountdownConfig;
  previewMode?: 'auto' | 'mobile';
  disableNavigation?: boolean;
}

function CountdownUnit({
  value,
  label,
  boxBg,
  digitColor,
  accentColor,
  compact,
}: {
  value: number;
  label: string;
  boxBg: string;
  digitColor: string;
  accentColor: string;
  compact: boolean;
}) {
  return (
    <div
      style={{
        backgroundColor: boxBg,
        borderColor: `${accentColor}33`,
      }}
      className={`flex flex-col items-center justify-center rounded-xl border backdrop-blur-xs shadow-2xs ${
        compact ? 'min-w-[48px] px-2 py-2' : 'min-w-[56px] sm:min-w-[66px] px-2.5 sm:px-3 py-2 sm:py-2.5'
      }`}
    >
      <span
        style={{ color: digitColor }}
        className={`font-extrabold font-mono tabular-nums leading-none tracking-tight ${
          compact ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl lg:text-[26px]'
        }`}
      >
        {String(value).padStart(2, '0')}
      </span>
      <span
        style={{ color: accentColor }}
        className="mt-1 text-[10px] font-semibold tracking-wider uppercase leading-none"
      >
        {label}
      </span>
    </div>
  );
}

function CountdownCard({
  item,
  nowMs,
  compactLayout,
  forceMobile,
  disableNavigation,
}: {
  item: NoticiaCountdown;
  nowMs: number;
  compactLayout: boolean;
  forceMobile: boolean;
  disableNavigation?: boolean;
}) {
  const [imgErr, setImgErr] = useState(false);
  const [logoErr, setLogoErr] = useState(false);

  useEffect(() => {
    setImgErr(false);
  }, [item.imagen_url]);

  useEffect(() => {
    setLogoErr(false);
  }, [item.logo_url]);

  const remaining = calculateCountdownRemaining(
    item.fecha_objetivo,
    item.mostrar_meses,
    nowMs
  );

  const fontFamily = getCountdownFontFamily(item.tipografia);
  const backgroundStyle = item.usar_gradiente
    ? `linear-gradient(135deg, ${item.color_fondo || '#064e3b'} 0%, ${item.color_fondo_secundario || '#0f172a'} 100%)`
    : item.color_fondo || '#064e3b';

  const targetDateObj = new Date(item.fecha_objetivo);
  const hasValidDate = !isNaN(targetDateObj.getTime());

  const dateFormatted = hasValidDate
    ? formatFechaSV(targetDateObj, {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';
  const timeFormatted = hasValidDate
    ? formatHoraSV(targetDateObj, {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const titleSizeClass =
    item.tamano_titulo === 'lg'
      ? compactLayout || forceMobile
        ? 'text-xl sm:text-2xl'
        : 'text-2xl sm:text-3xl'
      : item.tamano_titulo === 'sm'
      ? 'text-base sm:text-lg'
      : compactLayout || forceMobile
      ? 'text-lg sm:text-xl'
      : 'text-xl sm:text-2xl';

  const hasImage = Boolean(item.imagen_url) && !imgErr;
  const hasLogo = Boolean(item.logo_url) && !logoErr;

  // Alineación de Logo y Texto según posicion_logo
  const logoAlignClass =
    item.posicion_logo === 'centro'
      ? 'items-center text-center'
      : item.posicion_logo === 'derecha'
      ? 'items-end text-right'
      : 'items-start text-left';

  const infoHeaderJustify =
    item.posicion_logo === 'centro'
      ? 'justify-center'
      : item.posicion_logo === 'derecha'
      ? 'flex-row-reverse justify-start'
      : 'justify-start';

  // Posición del bloque de conteo (cuando está apilado o centrado vs laterales)
  const countdownAlignClass =
    item.posicion_conteo === 'izquierda'
      ? 'justify-start'
      : item.posicion_conteo === 'centro'
      ? 'justify-center'
      : 'justify-end';

  // Determinar si el layout interno es de una columna (móvil o 2-en-fila compacto o todo centrado)
  const isStackedCard = forceMobile || compactLayout;

  // Orden visual en escritorio (cuando es ancho completo) según posiciones elegidas
  const imageOrderDesktop =
    item.posicion_imagen === 'izquierda'
      ? 'md:order-1'
      : item.posicion_imagen === 'centro'
      ? 'md:order-2'
      : 'md:order-3';

  const countdownOrderDesktop =
    item.posicion_conteo === 'izquierda'
      ? 'md:order-1'
      : item.posicion_conteo === 'centro'
      ? 'md:order-2'
      : 'md:order-3';

  // Info ocupa el espacio complementario o centro
  const infoOrderDesktop =
    item.posicion_conteo === 'izquierda' && item.posicion_imagen !== 'derecha'
      ? 'md:order-2'
      : item.posicion_imagen === 'centro'
      ? 'md:order-1'
      : item.posicion_conteo === 'centro'
      ? 'md:order-1'
      : 'md:order-2';

  const imageBlock = hasImage ? (
    <div
      className={`shrink-0 overflow-hidden rounded-xl border ${
        isStackedCard
          ? item.posicion_imagen === 'centro'
            ? 'w-full h-36 sm:h-40'
            : 'w-28 h-24 sm:w-36 sm:h-28'
          : item.posicion_imagen === 'centro'
          ? 'w-full md:w-56 h-36 md:h-32'
          : 'w-full md:w-44 lg:w-52 h-36 md:h-32'
      } ${!isStackedCard ? imageOrderDesktop : ''}`}
      style={{ borderColor: `${item.color_acento}33` }}
    >
      <img
        src={item.imagen_url!}
        alt={item.nombre_evento}
        referrerPolicy="no-referrer"
        onError={() => setImgErr(true)}
        className="w-full h-full object-cover object-center"
      />
    </div>
  ) : null;

  const infoBlock = (
    <div
      className={`flex-1 min-w-0 flex flex-col gap-2 ${logoAlignClass} ${
        !isStackedCard ? infoOrderDesktop : ''
      }`}
    >
      {/* Cabecera Logo + Etiqueta superior */}
      <div className={`flex flex-wrap items-center gap-2.5 w-full ${infoHeaderJustify}`}>
        {hasLogo && (
          <img
            src={item.logo_url!}
            alt={`Logo ${item.nombre_evento}`}
            referrerPolicy="no-referrer"
            onError={() => setLogoErr(true)}
            className="h-9 sm:h-11 w-auto max-w-[120px] object-contain rounded-lg bg-white/10 p-1 shrink-0"
          />
        )}
        {item.etiqueta_superior && (
          <span
            style={{ color: item.color_acento }}
            className="text-xs font-bold tracking-wide uppercase"
          >
            {item.etiqueta_superior}
          </span>
        )}
      </div>

      {/* Nombre del evento */}
      <h3
        style={{ color: item.color_texto }}
        className={`font-extrabold tracking-tight leading-tight text-balance w-full ${titleSizeClass}`}
      >
        {item.nombre_evento}
      </h3>

      {item.subtitulo && (
        <p
          style={{ color: item.color_texto, opacity: 0.85 }}
          className="text-xs sm:text-sm leading-snug line-clamp-2 max-w-2xl"
        >
          {item.subtitulo}
        </p>
      )}

      {/* Fecha y hora exacta del evento (Día, Mes, Año y Hora) */}
      {hasValidDate && (
        <div
          style={{ color: item.color_texto, opacity: 0.82 }}
          className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium w-full ${
            item.posicion_logo === 'centro'
              ? 'justify-center'
              : item.posicion_logo === 'derecha'
              ? 'justify-end'
              : 'justify-start'
          }`}
        >
          <span className="inline-flex items-center gap-1 capitalize">
            <Calendar className="w-3.5 h-3.5 shrink-0" style={{ color: item.color_acento }} />
            {dateFormatted}
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: item.color_acento }} />
            {timeFormatted}
          </span>
        </div>
      )}

      {/* Enlace opcional */}
      {item.enlace_url && !disableNavigation && (
        <div className="pt-1">
          {item.enlace_url.startsWith('/') ? (
            <Link
              to={item.enlace_url}
              style={{
                color: item.color_acento,
                borderColor: `${item.color_acento}55`,
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold hover:bg-white/10 transition-colors"
            >
              <span>{item.enlace_texto || 'Ver más detalles'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <a
              href={
                /^https?:\/\//i.test(item.enlace_url)
                  ? item.enlace_url
                  : `https://${item.enlace_url}`
              }
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: item.color_acento,
                borderColor: `${item.color_acento}55`,
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold hover:bg-white/10 transition-colors"
            >
              <span>{item.enlace_texto || 'Ver más detalles'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}
    </div>
  );

  const countdownUnits = remaining.finished ? (
    <div
      style={{
        backgroundColor: item.color_caja_tiempo,
        borderColor: `${item.color_acento}55`,
        color: item.color_texto_tiempo,
      }}
      className="px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-bold tracking-wide"
    >
      {item.texto_finalizado || '¡El evento ha comenzado!'}
    </div>
  ) : (
    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
      {item.mostrar_meses && (
        <CountdownUnit
          value={remaining.months}
          label={remaining.months === 1 ? 'Mes' : 'Meses'}
          boxBg={item.color_caja_tiempo}
          digitColor={item.color_texto_tiempo}
          accentColor={item.color_acento}
          compact={isStackedCard}
        />
      )}
      <CountdownUnit
        value={remaining.days}
        label={remaining.days === 1 ? 'Día' : 'Días'}
        boxBg={item.color_caja_tiempo}
        digitColor={item.color_texto_tiempo}
        accentColor={item.color_acento}
        compact={isStackedCard}
      />
      <CountdownUnit
        value={remaining.hours}
        label="Hrs"
        boxBg={item.color_caja_tiempo}
        digitColor={item.color_texto_tiempo}
        accentColor={item.color_acento}
        compact={isStackedCard}
      />
      <CountdownUnit
        value={remaining.minutes}
        label="Min"
        boxBg={item.color_caja_tiempo}
        digitColor={item.color_texto_tiempo}
        accentColor={item.color_acento}
        compact={isStackedCard}
      />
      <CountdownUnit
        value={remaining.seconds}
        label="Seg"
        boxBg={item.color_caja_tiempo}
        digitColor={item.color_texto_tiempo}
        accentColor={item.color_acento}
        compact={isStackedCard}
      />
    </div>
  );

  const countdownBlock = (
    <div
      className={`shrink-0 flex flex-col gap-1.5 ${
        isStackedCard ? 'w-full' : countdownOrderDesktop
      } ${
        item.posicion_conteo === 'izquierda'
          ? 'items-start'
          : item.posicion_conteo === 'centro'
          ? 'items-center'
          : isStackedCard
          ? 'items-start sm:items-end'
          : 'items-start md:items-end'
      }`}
    >
      <div className={`flex flex-wrap w-full ${countdownAlignClass}`}>
        {countdownUnits}
      </div>
    </div>
  );

  // En tarjetas compactas (2 columnas o móvil), respetar orden izquierda/centro/derecha para imagen y conteo
  if (isStackedCard) {
    return (
      <div
        style={{
          background: backgroundStyle,
          fontFamily,
          borderColor: `${item.color_acento}33`,
        }}
        className="rounded-2xl border p-4 sm:p-5 shadow-xs flex flex-col justify-between gap-4 overflow-hidden transition-all"
      >
        {/* Fila superior: Imagen (izq/centro/der) + Info */}
        {hasImage && item.posicion_imagen === 'centro' ? (
          <div className="flex flex-col gap-3">
            {imageBlock}
            {infoBlock}
          </div>
        ) : (
          <div
            className={`flex flex-col sm:flex-row gap-3.5 items-stretch ${
              item.posicion_imagen === 'derecha' ? 'sm:flex-row-reverse' : ''
            }`}
          >
            {imageBlock}
            {infoBlock}
          </div>
        )}

        {/* Fila inferior: Reloj Countdown alineado según posicion_conteo */}
        <div
          className="pt-3 border-t flex flex-wrap items-center"
          style={{ borderColor: `${item.color_acento}24` }}
        >
          {countdownBlock}
        </div>
      </div>
    );
  }

  // Banner ancho completo (1 evento activo o modo 'stack')
  return (
    <div
      style={{
        background: backgroundStyle,
        fontFamily,
        borderColor: `${item.color_acento}33`,
      }}
      className="rounded-2xl border p-5 sm:p-6 shadow-xs overflow-hidden transition-all"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
        {imageBlock}
        {infoBlock}
        {countdownBlock}
      </div>
    </div>
  );
}

export default function CountdownBannerSection({
  countdowns,
  config,
  previewMode = 'auto',
  disableNavigation = false,
}: CountdownBannerSectionProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  const activeItems = countdowns.filter((c) => c.activo);

  useEffect(() => {
    if (!config.activo || activeItems.length === 0) return;
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [config.activo, activeItems.length]);

  if (!config.activo || activeItems.length === 0) {
    return null;
  }

  const forceMobile = previewMode === 'mobile';
  const useTwoColGrid = !forceMobile && config.layout === 'grid' && activeItems.length >= 2;

  return (
    <section
      aria-label="Contadores de próximos eventos institucionales"
      className={
        forceMobile
          ? 'max-w-[390px] mx-auto w-full space-y-3'
          : useTwoColGrid
          ? 'grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-stretch'
          : 'space-y-4'
      }
    >
      {activeItems.map((item) => (
        <CountdownCard
          key={item.id}
          item={item}
          nowMs={nowMs}
          compactLayout={useTwoColGrid}
          forceMobile={forceMobile}
          disableNavigation={disableNavigation}
        />
      ))}
    </section>
  );
}
