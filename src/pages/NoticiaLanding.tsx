import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  Newspaper,
  PlayCircle,
  User,
  ChevronRight,
  Paperclip,
  Download,
  FileText,
} from 'lucide-react';
import {
  fetchNoticiaById,
  fetchNoticiasBannerData,
  NoticiaBannerSlide,
  parseVideoEmbedUrl,
  sanitizeRichHtml,
} from '../lib/noticiasBanner';

export default function NoticiaLanding() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [slide, setSlide] = useState<NoticiaBannerSlide | null>(null);
  const [otherSlides, setOtherSlides] = useState<NoticiaBannerSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroError, setHeroError] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setHeroError(false);
      try {
        if (!id) {
          if (mounted) {
            setSlide(null);
            setLoading(false);
          }
          return;
        }
        const [found, allData] = await Promise.all([
          fetchNoticiaById(id),
          fetchNoticiasBannerData(false),
        ]);
        if (!mounted) return;
        setSlide(found);
        setOtherSlides(
          allData.slides.filter((s) => String(s.id) !== String(id) && s.activo).slice(0, 4)
        );
      } catch (err) {
        console.error('Error cargando noticia:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-8 space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-slate-200 rounded-xl" />
        <div className="h-64 sm:h-80 w-full bg-slate-200 rounded-2xl" />
        <div className="h-8 w-3/4 bg-slate-200 rounded-lg" />
        <div className="space-y-3">
          <div className="h-4 w-full bg-slate-200 rounded" />
          <div className="h-4 w-5/6 bg-slate-200 rounded" />
          <div className="h-4 w-4/6 bg-slate-200 rounded" />
        </div>
      </div>
    );
  }

  if (!slide) {
    return (
      <div className="max-w-3xl mx-auto py-12 space-y-6">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Regresar al Dashboard
        </button>

        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3 shadow-xs">
          <Newspaper className="w-12 h-12 mx-auto text-slate-300 stroke-[1.5]" />
          <h1 className="text-lg font-bold text-slate-900">Noticia no encontrada</h1>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Esta publicación pudo haber sido desactivada o eliminada por la administración.
          </p>
        </div>
      </div>
    );
  }

  const formattedDate = slide.created_at
    ? new Date(slide.created_at).toLocaleDateString('es-SV', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const cleanHtml = sanitizeRichHtml(slide.contenido_html || '');

  return (
    <article className="max-w-4xl mx-auto pb-14 space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* Top Bar con botón Regresar */}
      <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs sm:text-sm font-semibold shadow-2xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-700" />
          <span>Regresar al Dashboard</span>
        </button>

        <span className="text-xs font-medium text-slate-500 truncate hidden sm:inline">
          Noticias Institucionales · Cruz Verde Salvadoreña
        </span>
      </div>

      {/* Editorial Header */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-widest font-semibold text-emerald-700">
          <span>{slide.categoria || 'Noticia'}</span>
          {formattedDate && (
            <>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="text-slate-500 normal-case tracking-normal font-medium inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {formattedDate}
              </span>
            </>
          )}
          {slide.autor_nombre && (
            <>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="text-slate-500 normal-case tracking-normal font-medium inline-flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {slide.autor_nombre}
              </span>
            </>
          )}
        </div>

        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight text-balance">
          {slide.titulo}
        </h1>

        {slide.subtitulo && (
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-3xl">
            {slide.subtitulo}
          </p>
        )}
      </header>

      {/* Featured Image (Imagen Completa sin recorte) */}
      <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-950/5 shadow-sm flex items-center justify-center">
        {!heroError && slide.imagen_url ? (
          <img
            src={slide.imagen_url}
            alt={slide.titulo}
            referrerPolicy="no-referrer"
            onError={() => setHeroError(true)}
            className="w-full max-h-[760px] object-contain mx-auto"
          />
        ) : (
          <div className="w-full h-56 sm:h-72 bg-gradient-to-br from-emerald-950 to-slate-900 flex flex-col items-center justify-center text-emerald-200/80">
            <Newspaper className="w-12 h-12 mb-2 stroke-[1.5]" />
            <span className="text-sm font-medium">{slide.titulo}</span>
          </div>
        )}
      </div>

      {/* Main Content Body */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-8 lg:p-10 space-y-8">
        {cleanHtml ? (
          <div
            className="max-w-3xl text-slate-800 text-base leading-[1.75]
              [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:tracking-tight
              [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-slate-900 [&_h3]:mt-5 [&_h3]:mb-2
              [&_p]:mb-4
              [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:space-y-1.5
              [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_ol]:space-y-1.5
              [&_a]:text-emerald-700 [&_a]:font-medium [&_a]:underline hover:[&_a]:text-emerald-900
              [&_blockquote]:border-y [&_blockquote]:border-slate-200 [&_blockquote]:py-4 [&_blockquote]:my-6 [&_blockquote]:text-lg [&_blockquote]:italic [&_blockquote]:text-slate-700
              [&_img]:rounded-xl [&_img]:max-w-full [&_img]:h-auto [&_img]:my-5 [&_img]:mx-auto [&_img]:border [&_img]:border-slate-200/70"
            dangerouslySetInnerHTML={{ __html: cleanHtml }}
          />
        ) : (
          !slide.videos?.length && !slide.archivos_adjuntos?.length && (
            <p className="text-sm text-slate-500 italic">
              Esta noticia no contiene texto adicional desarrollado.
            </p>
          )
        )}

        {/* Video Players Section */}
        {Array.isArray(slide.videos) && slide.videos.length > 0 && (
          <section className="pt-6 border-t border-slate-200/80 space-y-5">
            <div className="flex items-center gap-2">
              <PlayCircle className="w-5 h-5 text-emerald-700" />
              <h2 className="text-lg font-bold text-slate-900">
                {slide.videos.length === 1 ? 'Video Multimedia' : 'Videos y Multimedia'}
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {slide.videos.map((vid, idx) => {
                const parsed = parseVideoEmbedUrl(vid.url);
                return (
                  <div
                    key={vid.id || idx}
                    className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50"
                  >
                    <div className="px-4 py-2.5 bg-white border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 truncate">
                          {vid.titulo || `Video ${idx + 1}`}
                        </h3>
                        <p className="text-[11px] text-slate-500">{parsed.platform}</p>
                      </div>
                      <a
                        href={parsed.originalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 whitespace-nowrap"
                      >
                        <span>Abrir en {parsed.platform}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    {parsed.isDirectVideo && parsed.embedUrl ? (
                      <div className="aspect-video w-full bg-black">
                        <video
                          controls
                          preload="metadata"
                          src={parsed.embedUrl}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : parsed.embedUrl ? (
                      <div className="aspect-video w-full bg-black">
                        <iframe
                          src={parsed.embedUrl}
                          title={vid.titulo || `Video ${idx + 1}`}
                          className="w-full h-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      </div>
                    ) : (
                      <div className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            <PlayCircle className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">
                              {vid.titulo || 'Reproducir video en plataforma externa'}
                            </p>
                            <p className="text-xs text-slate-500 break-all line-clamp-1">
                              {parsed.originalUrl}
                            </p>
                          </div>
                        </div>
                        <a
                          href={parsed.originalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                        >
                          <span>Ver Video</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Attached Institutional Files from Archivos */}
        {Array.isArray(slide.archivos_adjuntos) && slide.archivos_adjuntos.length > 0 && (
          <section className="pt-6 border-t border-slate-200/80 space-y-4">
            <div className="flex items-center gap-2">
              <Paperclip className="w-5 h-5 text-emerald-700" />
              <h2 className="text-lg font-bold text-slate-900">
                Documentos y Archivos Adjuntos
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {slide.archivos_adjuntos.map((file, idx) => {
                const targetUrl = file.url_archivo || file.enlace_externo || '#';
                return (
                  <a
                    key={file.id || idx}
                    href={targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-emerald-50/70 hover:border-emerald-300 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-emerald-700 shrink-0 shadow-2xs">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-slate-900 truncate group-hover:text-emerald-900">
                          {file.titulo || file.nombre_archivo}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {[
                            file.categoria,
                            file.extension ? file.extension.toUpperCase() : null,
                            file.tamano_legible,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-emerald-700 group-hover:bg-emerald-700 group-hover:text-white group-hover:border-emerald-700 transition-colors shrink-0">
                      <Download className="w-3.5 h-3.5" />
                      Abrir
                    </span>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {/* Optional External Link CTA */}
        {slide.enlace_redireccion && (
          <div className="pt-4 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
            {slide.enlace_redireccion.startsWith('/') ? (
              <Link
                to={slide.enlace_redireccion}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors"
              >
                <span>{slide.enlace_texto || 'Más información'}</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            ) : (
              <a
                href={
                  /^https?:\/\//i.test(slide.enlace_redireccion)
                    ? slide.enlace_redireccion
                    : `https://${slide.enlace_redireccion}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors"
              >
                <span>{slide.enlace_texto || 'Más información'}</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Related Active Slides */}
      {otherSlides.length > 0 && (
        <section className="space-y-3 pt-2">
          <h2 className="text-sm font-bold text-slate-900">Otras noticias en portada</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {otherSlides.map((other) => (
              <Link
                key={other.id}
                to={`/noticias/ver/${other.id}`}
                className="group bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl p-3 flex items-center gap-3.5 shadow-2xs transition-all"
              >
                <div className="w-24 h-16 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200/60">
                  <img
                    src={other.imagen_banner_url || other.imagen_url}
                    alt={other.titulo}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-emerald-700">
                    {other.categoria || 'Noticia'}
                  </p>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 group-hover:text-emerald-800">
                    {other.titulo}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Bottom Return Button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Regresar al Dashboard</span>
        </button>
      </div>
    </article>
  );
}
