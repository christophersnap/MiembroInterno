import { supabase } from './supabase';
import { getApiUrl } from './api';

export interface NoticiaVideo {
  id: string;
  titulo: string;
  url: string;
}

export interface NoticiaBannerSlide {
  id: string;
  titulo: string;
  subtitulo?: string | null;
  categoria?: string | null;
  imagen_url: string;
  contenido_html: string;
  videos: NoticiaVideo[];
  accion_click: 'landing' | 'url';
  enlace_redireccion?: string | null;
  enlace_texto?: string | null;
  activo: boolean;
  orden: number;
  autor_id?: string | null;
  autor_nombre?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface NoticiasBannerConfig {
  activo: boolean;
  intervalo_segundos: number;
  autoplay: boolean;
}

export const DEFAULT_BANNER_CONFIG: NoticiasBannerConfig = {
  activo: true,
  intervalo_segundos: 6,
  autoplay: true,
};

const LS_SLIDES_KEY = 'cv_noticias_banner_slides';
const LS_CONFIG_KEY = 'cv_noticias_banner_config';

export interface ParsedVideoInfo {
  platform: string;
  embedUrl: string | null;
  isDirectVideo: boolean;
  originalUrl: string;
}

export function parseVideoEmbedUrl(rawUrl: string): ParsedVideoInfo {
  const url = (rawUrl || '').trim();
  if (!url) {
    return { platform: 'Video', embedUrl: null, isDirectVideo: false, originalUrl: '' };
  }

  // Direct video files (.mp4, .webm, .ogg, .mov)
  if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url)) {
    return {
      platform: 'Video Directo',
      embedUrl: url,
      isDirectVideo: true,
      originalUrl: url,
    };
  }

  // YouTube (watch, youtu.be, shorts, live, embed)
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,15})/i
  );
  if (ytMatch && ytMatch[1]) {
    return {
      platform: 'YouTube',
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`,
      isDirectVideo: false,
      originalUrl: url,
    };
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      platform: 'Vimeo',
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
      isDirectVideo: false,
      originalUrl: url,
    };
  }

  // TikTok
  const tiktokMatch = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/i);
  if (tiktokMatch && tiktokMatch[1]) {
    return {
      platform: 'TikTok',
      embedUrl: `https://www.tiktok.com/embed/v2/${tiktokMatch[1]}`,
      isDirectVideo: false,
      originalUrl: url,
    };
  }

  // Facebook Watch / Video
  if (/facebook\.com\/.*\/videos\/|fb\.watch\//i.test(url)) {
    return {
      platform: 'Facebook',
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`,
      isDirectVideo: false,
      originalUrl: url,
    };
  }

  // Google Drive preview
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/i);
  if (driveMatch && driveMatch[1]) {
    return {
      platform: 'Google Drive',
      embedUrl: `https://drive.google.com/file/d/${driveMatch[1]}/preview`,
      isDirectVideo: false,
      originalUrl: url,
    };
  }

  // Generic external video platform (Instagram, X, etc.)
  let platform = 'Enlace de Video';
  if (/instagram\.com/i.test(url)) platform = 'Instagram';
  else if (/twitter\.com|x\.com/i.test(url)) platform = 'X / Twitter';
  else if (/twitch\.tv/i.test(url)) platform = 'Twitch';

  return {
    platform,
    embedUrl: null,
    isDirectVideo: false,
    originalUrl: url,
  };
}

export function sanitizeRichHtml(html: string): string {
  if (!html) return '';
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const blockedTags = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea'];
  blockedTags.forEach((tag) => {
    doc.querySelectorAll(tag).forEach((el) => el.remove());
  });

  doc.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const val = attr.value.trim();
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
      } else if ((name === 'href' || name === 'src') && /^javascript:/i.test(val)) {
        el.removeAttribute(attr.name);
      }
    });

    if (el.tagName.toLowerCase() === 'a') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
    if (el.tagName.toLowerCase() === 'img') {
      el.setAttribute('referrerPolicy', 'no-referrer');
    }
  });

  return doc.body.innerHTML;
}

function normalizeSlide(row: any): NoticiaBannerSlide {
  let parsedVideos: NoticiaVideo[] = [];
  if (Array.isArray(row.videos)) {
    parsedVideos = row.videos;
  } else if (typeof row.videos === 'string') {
    try {
      const v = JSON.parse(row.videos);
      if (Array.isArray(v)) parsedVideos = v;
    } catch {}
  }

  return {
    id: String(row.id),
    titulo: row.titulo || '',
    subtitulo: row.subtitulo || null,
    categoria: row.categoria || 'Noticia',
    imagen_url: row.imagen_url || '',
    contenido_html: row.contenido_html || '',
    videos: parsedVideos,
    accion_click: row.accion_click === 'url' ? 'url' : 'landing',
    enlace_redireccion: row.enlace_redireccion || null,
    enlace_texto: row.enlace_texto || null,
    activo: row.activo === undefined ? true : Boolean(row.activo),
    orden: Number(row.orden ?? 0),
    autor_id: row.autor_id || null,
    autor_nombre: row.autor_nombre || 'Cruz Verde Salvadoreña',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function fetchNoticiasBannerData(includeInactive = false): Promise<{
  slides: NoticiaBannerSlide[];
  config: NoticiasBannerConfig;
  source: 'supabase' | 'api' | 'local';
}> {
  let config: NoticiasBannerConfig = { ...DEFAULT_BANNER_CONFIG };
  try {
    const localCfgRaw = localStorage.getItem(LS_CONFIG_KEY);
    if (localCfgRaw) {
      config = { ...config, ...JSON.parse(localCfgRaw) };
    }
  } catch {}

  // 1. Load config from Supabase configuracion
  try {
    const { data: cfgRows } = await supabase
      .from('configuracion')
      .select('clave, valor')
      .in('clave', ['noticias_banner_activo', 'noticias_banner_intervalo', 'noticias_banner_autoplay']);

    if (cfgRows && cfgRows.length > 0) {
      cfgRows.forEach((r) => {
        if (r.clave === 'noticias_banner_activo') config.activo = r.valor !== 'false';
        if (r.clave === 'noticias_banner_autoplay') config.autoplay = r.valor !== 'false';
        if (r.clave === 'noticias_banner_intervalo') {
          const parsed = Number(r.valor);
          if (!isNaN(parsed) && parsed >= 2 && parsed <= 120) {
            config.intervalo_segundos = parsed;
          }
        }
      });
      try {
        localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(config));
      } catch {}
    }
  } catch {
    // Fallback to API config if needed
    try {
      const cfgRes = await fetch(getApiUrl('/api/configuracion'));
      if (cfgRes.ok) {
        const cfgObj = await cfgRes.json();
        if (cfgObj.noticias_banner_activo !== undefined) {
          config.activo = cfgObj.noticias_banner_activo !== 'false';
        }
        if (cfgObj.noticias_banner_autoplay !== undefined) {
          config.autoplay = cfgObj.noticias_banner_autoplay !== 'false';
        }
        if (cfgObj.noticias_banner_intervalo !== undefined) {
          const parsed = Number(cfgObj.noticias_banner_intervalo);
          if (!isNaN(parsed) && parsed >= 2 && parsed <= 120) config.intervalo_segundos = parsed;
        }
      }
    } catch {}
  }

  // 2. Load slides from Supabase noticias_banner
  try {
    let query = supabase
      .from('noticias_banner')
      .select('*')
      .order('orden', { ascending: true })
      .order('created_at', { ascending: false });

    if (!includeInactive) {
      query = query.eq('activo', true);
    }

    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      const slides = data.map(normalizeSlide);
      if (includeInactive) {
        try {
          localStorage.setItem(LS_SLIDES_KEY, JSON.stringify(slides));
        } catch {}
      }
      return { slides, config, source: 'supabase' };
    }
  } catch {}

  // 3. Try local backend API /api/noticias-banner
  try {
    const res = await fetch(getApiUrl(`/api/noticias-banner${includeInactive ? '?all=true' : ''}`));
    if (res.ok) {
      const apiRows = await res.json();
      if (Array.isArray(apiRows)) {
        const slides = apiRows.map(normalizeSlide);
        return { slides, config, source: 'api' };
      }
    }
  } catch {}

  // 4. LocalStorage fallback
  try {
    const raw = localStorage.getItem(LS_SLIDES_KEY);
    if (raw) {
      const all = (JSON.parse(raw) as any[]).map(normalizeSlide);
      const slides = includeInactive ? all : all.filter((s) => s.activo);
      return { slides, config, source: 'local' };
    }
  } catch {}

  return { slides: [], config, source: 'local' };
}

export async function fetchNoticiaById(id: string): Promise<NoticiaBannerSlide | null> {
  try {
    const { data, error } = await supabase
      .from('noticias_banner')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!error && data) {
      return normalizeSlide(data);
    }
  } catch {}

  try {
    const res = await fetch(getApiUrl(`/api/noticias-banner/${encodeURIComponent(id)}`));
    if (res.ok) {
      const row = await res.json();
      if (row && row.id) return normalizeSlide(row);
    }
  } catch {}

  try {
    const raw = localStorage.getItem(LS_SLIDES_KEY);
    if (raw) {
      const found = (JSON.parse(raw) as any[]).find((s) => String(s.id) === String(id));
      if (found) return normalizeSlide(found);
    }
  } catch {}

  return null;
}

export async function saveNoticiasBannerConfig(config: NoticiasBannerConfig): Promise<void> {
  try {
    localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(config));
  } catch {}

  const entries = [
    {
      clave: 'noticias_banner_activo',
      valor: config.activo ? 'true' : 'false',
      descripcion: 'Activa o desactiva el Banner Slide de Noticias en el Dashboard',
    },
    {
      clave: 'noticias_banner_intervalo',
      valor: String(Math.max(2, Math.min(120, Math.round(config.intervalo_segundos || 6)))),
      descripcion: 'Tiempo en segundos entre transiciones automáticas del Banner Slide',
    },
    {
      clave: 'noticias_banner_autoplay',
      valor: config.autoplay ? 'true' : 'false',
      descripcion: 'Reproducción automática del carrusel de noticias en el Dashboard',
    },
  ];

  // Try Supabase upsert
  for (const row of entries) {
    try {
      const { error } = await supabase
        .from('configuracion')
        .upsert(row, { onConflict: 'clave' });
      if (error) {
        const { data: existing } = await supabase
          .from('configuracion')
          .select('id')
          .eq('clave', row.clave)
          .maybeSingle();
        if (existing) {
          await supabase.from('configuracion').update({ valor: row.valor }).eq('clave', row.clave);
        } else {
          await supabase.from('configuracion').insert([row]);
        }
      }
    } catch {}
  }

  // Also sync to backend API if available
  try {
    await fetch(getApiUrl('/api/configuracion'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        noticias_banner_activo: entries[0].valor,
        noticias_banner_intervalo: entries[1].valor,
        noticias_banner_autoplay: entries[2].valor,
      }),
    });
  } catch {}
}

export async function uploadNoticiaMedia(file: File, maxDimension = 1920): Promise<string> {
  const cleanName = `noticia_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  // 1. Try Supabase Storage bucket 'socorristas' -> folder 'noticias/'
  try {
    const { error: uploadErr } = await supabase.storage
      .from('socorristas')
      .upload(`noticias/${cleanName}`, file, { cacheControl: '3600', upsert: true });

    if (!uploadErr) {
      const { data } = supabase.storage.from('socorristas').getPublicUrl(`noticias/${cleanName}`);
      if (data?.publicUrl) {
        const accessible = await new Promise<boolean>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = data.publicUrl;
          setTimeout(() => resolve(false), 2200);
        });
        if (accessible) return data.publicUrl;
      }
    }
  } catch {}

  // 2. Try backend /api/upload-file
  try {
    const formData = new FormData();
    formData.append('archivo', file);
    const res = await fetch(getApiUrl('/api/upload-file'), {
      method: 'POST',
      body: formData,
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.url) {
        return json.url;
      }
    }
  } catch {}

  // 3. Fallback: compressed canvas DataURL so image persists offline / without storage bucket
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || '');
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(raw);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => resolve(raw);
      img.src = raw;
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo de imagen'));
    reader.readAsDataURL(file);
  });
}
