import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowUpRight, Newspaper } from 'lucide-react';
import { NoticiaBannerSlide, NoticiasBannerConfig } from '../../lib/noticiasBanner';
import { formatFechaSV } from '../../utils/dateUtils';

interface NoticiasBannerSliderProps {
  slides: NoticiaBannerSlide[];
  config: NoticiasBannerConfig;
  previewMode?: 'auto' | 'mobile';
  disableNavigation?: boolean;
}

export default function NoticiasBannerSlider({
  slides,
  config,
  previewMode = 'auto',
  disableNavigation = false,
}: NoticiasBannerSliderProps) {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const touchStartX = useRef<number | null>(null);

  const activeSlides = slides.filter((s) => s.activo);

  useEffect(() => {
    if (currentIndex >= activeSlides.length && activeSlides.length > 0) {
      setCurrentIndex(0);
    }
  }, [activeSlides.length, currentIndex]);

  useEffect(() => {
    if (!config.autoplay || isPaused || activeSlides.length <= 1) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const ms = Math.max(2, Math.min(120, Number(config.intervalo_segundos) || 6)) * 1000;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
    }, ms);

    return () => clearInterval(timer);
  }, [config.autoplay, config.intervalo_segundos, isPaused, activeSlides.length]);

  if (!config.activo || activeSlides.length === 0) {
    return null;
  }

  const safeIndex = currentIndex % activeSlides.length;
  const currentSlide = activeSlides[safeIndex];

  const goToPrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + activeSlides.length) % activeSlides.length);
  };

  const goToNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
  };

  const handleSlideClick = (slide: NoticiaBannerSlide) => {
    if (disableNavigation) return;

    if (slide.accion_click === 'url' && slide.enlace_redireccion) {
      const targetUrl = slide.enlace_redireccion.trim();
      if (targetUrl.startsWith('/')) {
        navigate(targetUrl);
        return;
      }
      // Open external link safely via an anchor click without window.open
      const anchor = document.createElement('a');
      anchor.href = /^https?:\/\//i.test(targetUrl) ? targetUrl : `https://${targetUrl}`;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      return;
    }

    navigate(`/noticias/ver/${slide.id}`);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setIsPaused(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) {
      setIsPaused(false);
      return;
    }
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 40 && activeSlides.length > 1) {
      if (delta < 0) {
        setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
      } else {
        setCurrentIndex((prev) => (prev - 1 + activeSlides.length) % activeSlides.length);
      }
    }
    touchStartX.current = null;
    setIsPaused(false);
  };

  const containerAspectClass =
    previewMode === 'mobile'
      ? 'aspect-[16/9] max-w-sm mx-auto'
      : 'aspect-[16/9] sm:aspect-[21/9] lg:aspect-[24/8] min-h-[200px] sm:min-h-[250px] max-h-[390px] w-full';

  return (
    <section
      aria-label="Banner de noticias institucionales"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`relative overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-900 shadow-sm group ${containerAspectClass}`}
    >
      {/* Slides Track */}
      <div
        className="flex h-full w-full transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ transform: `translateX(-${safeIndex * 100}%)` }}
      >
        {activeSlides.map((slide) => {
          const bannerSrc = slide.imagen_banner_url || slide.imagen_url;
          const imgFailed = failedImages[slide.id] || !bannerSrc;
          const formattedDate = slide.created_at
            ? formatFechaSV(slide.created_at, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : null;

          return (
            <div
              key={slide.id}
              role="button"
              tabIndex={0}
              onClick={() => handleSlideClick(slide)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSlideClick(slide);
                }
              }}
              className="relative w-full h-full shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              aria-label={`Abrir noticia: ${slide.titulo}`}
            >
              {!imgFailed ? (
                <img
                  src={bannerSrc}
                  alt={slide.titulo}
                  referrerPolicy="no-referrer"
                  onError={() => setFailedImages((prev) => ({ ...prev, [slide.id]: true }))}
                  className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.015]"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-emerald-950 via-slate-900 to-emerald-900 flex flex-col items-center justify-center text-emerald-200/70 p-6">
                  <Newspaper className="w-12 h-12 mb-2 stroke-[1.5]" />
                  <span className="text-xs font-medium text-emerald-100/80 text-center max-w-md truncate">
                    {slide.titulo}
                  </span>
                </div>
              )}

              {/* Contrast Scrim for WCAG AA Legibility */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

              {/* Clean Editorial Text Overlay */}
              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 md:p-8 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div className="max-w-3xl space-y-1">
                  <div className="flex items-center gap-2 text-xs font-medium text-emerald-300/95 tracking-wide">
                    <span>{slide.categoria || 'Noticia Institucional'}</span>
                    {formattedDate && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-slate-200/85 tabular-nums">{formattedDate}</span>
                      </>
                    )}
                  </div>
                  <h2 className="text-lg sm:text-2xl lg:text-3xl font-bold text-white leading-tight text-balance line-clamp-2 drop-shadow-xs">
                    {slide.titulo}
                  </h2>
                  {slide.subtitulo && (
                    <p className="text-xs sm:text-sm text-slate-200/90 line-clamp-1 sm:line-clamp-2 max-w-2xl">
                      {slide.subtitulo}
                    </p>
                  )}
                </div>

                <div className="shrink-0 hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/95 text-slate-900 text-xs font-semibold shadow-xs group-hover:bg-emerald-500 group-hover:text-white transition-colors whitespace-nowrap">
                  <span>{slide.accion_click === 'url' ? (slide.enlace_texto || 'Abrir enlace') : 'Leer noticia'}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation Arrows */}
      {activeSlides.length > 1 && (
        <>
          <button
            type="button"
            onClick={goToPrev}
            aria-label="Slide anterior"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/45 hover:bg-black/70 text-white backdrop-blur-xs flex items-center justify-center transition-opacity sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 cursor-pointer border border-white/15"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={goToNext}
            aria-label="Siguiente slide"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/45 hover:bg-black/70 text-white backdrop-blur-xs flex items-center justify-center transition-opacity sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 cursor-pointer border border-white/15"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Bottom Indicators + Numeric Index */}
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-2 bg-black/45 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-white/15">
            <span className="text-[11px] font-mono tabular-nums text-white/90">
              {safeIndex + 1} / {activeSlides.length}
            </span>
          </div>

          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
            {activeSlides.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Ir al slide ${idx + 1}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  idx === safeIndex ? 'w-6 bg-white' : 'w-2 bg-white/45 hover:bg-white/75'
                }`}
              />
            ))}
          </div>
        </>
      )}

      {/* Subtle tap hint on mobile */}
      {currentSlide && (
        <span className="sr-only">
          Toca o haz clic para ver más información sobre {currentSlide.titulo}
        </span>
      )}
    </section>
  );
}
