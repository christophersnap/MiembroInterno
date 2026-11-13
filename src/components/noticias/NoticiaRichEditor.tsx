import React, { useEffect, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Heading2,
  Heading3,
  Pilcrow,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Quote,
  Link as LinkIcon,
  ImagePlus,
  RemoveFormatting,
  Loader2,
  Check,
  X,
} from 'lucide-react';
import { uploadNoticiaMedia } from '../../lib/noticiasBanner';

interface NoticiaRichEditorProps {
  value: string;
  onChange: (html: string) => void;
  editorKey?: string;
}

export default function NoticiaRichEditor({
  value,
  onChange,
  editorKey = 'default',
}: NoticiaRichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedRangeRef = useRef<Range | null>(null);

  const [uploadingImg, setUploadingImg] = useState(false);
  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showImgUrlPopover, setShowImgUrlPopover] = useState(false);
  const [imgUrlInput, setImgUrlInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (editorRef.current) {
      if (editorRef.current.innerHTML !== (value || '')) {
        editorRef.current.innerHTML = value || '';
      }
    }
  }, [editorKey]);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const sel = window.getSelection();
    if (sel && savedRangeRef.current) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    }
  };

  const syncHtml = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCmd = (command: string, val?: string) => {
    restoreSelection();
    document.execCommand(command, false, val);
    saveSelection();
    syncHtml();
  };

  const insertHtmlAtCursor = (htmlSnippet: string) => {
    restoreSelection();
    if (document.queryCommandSupported && document.queryCommandSupported('insertHTML')) {
      document.execCommand('insertHTML', false, htmlSnippet);
    } else if (editorRef.current) {
      editorRef.current.innerHTML += htmlSnippet;
    }
    saveSelection();
    syncHtml();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Solo se permiten archivos de imagen (JPG, PNG, WebP).');
      return;
    }
    setErrorMsg(null);
    setUploadingImg(true);
    try {
      const url = await uploadNoticiaMedia(file, 1400);
      insertHtmlAtCursor(
        `<figure style="margin: 1rem 0;"><img src="${url}" alt="Imagen de noticia" style="max-width: 100%; height: auto; border-radius: 12px; display: block; margin: 0 auto;" /></figure><p><br/></p>`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al subir la imagen al contenido.');
    } finally {
      setUploadingImg(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmLink = () => {
    const clean = linkUrl.trim();
    if (!clean) {
      setShowLinkPopover(false);
      return;
    }
    const safeUrl = /^https?:\/\//i.test(clean) || clean.startsWith('/') ? clean : `https://${clean}`;
    execCmd('createLink', safeUrl);
    setLinkUrl('');
    setShowLinkPopover(false);
  };

  const handleConfirmImgUrl = () => {
    const clean = imgUrlInput.trim();
    if (!clean) {
      setShowImgUrlPopover(false);
      return;
    }
    insertHtmlAtCursor(
      `<figure style="margin: 1rem 0;"><img src="${clean}" alt="Imagen de noticia" style="max-width: 100%; height: auto; border-radius: 12px; display: block; margin: 0 auto;" /></figure><p><br/></p>`
    );
    setImgUrlInput('');
    setShowImgUrlPopover(false);
  };

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
      {/* Toolbar */}
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-1">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd('formatBlock', '<h2>')}
          title="Título principal"
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
        >
          <Heading2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd('formatBlock', '<h3>')}
          title="Subtítulo"
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
        >
          <Heading3 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd('formatBlock', '<p>')}
          title="Párrafo normal"
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
        >
          <Pilcrow className="w-4 h-4" />
        </button>

        <span className="w-px h-5 bg-slate-200 mx-1" />

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd('bold')}
          title="Negrita"
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd('italic')}
          title="Cursiva"
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd('underline')}
          title="Subrayado"
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
        >
          <Underline className="w-4 h-4" />
        </button>

        <span className="w-px h-5 bg-slate-200 mx-1" />

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd('insertUnorderedList')}
          title="Lista con viñetas"
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd('insertOrderedList')}
          title="Lista numerada"
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd('formatBlock', '<blockquote>')}
          title="Cita destacada"
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
        >
          <Quote className="w-4 h-4" />
        </button>

        <span className="w-px h-5 bg-slate-200 mx-1" />

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd('justifyLeft')}
          title="Alinear a la izquierda"
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd('justifyCenter')}
          title="Centrar"
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd('justifyRight')}
          title="Alinear a la derecha"
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
        >
          <AlignRight className="w-4 h-4" />
        </button>

        <span className="w-px h-5 bg-slate-200 mx-1" />

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();
          }}
          onClick={() => {
            setShowImgUrlPopover(false);
            setShowLinkPopover((v) => !v);
          }}
          title="Insertar enlace en texto seleccionado"
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
        >
          <LinkIcon className="w-4 h-4" />
        </button>

        {/* Upload inline image into article */}
        <label
          onMouseDown={() => saveSelection()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 cursor-pointer transition-colors whitespace-nowrap shrink-0"
          title="Subir imagen e insertarla dentro del cuerpo de la noticia"
        >
          {uploadingImg ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ImagePlus className="w-3.5 h-3.5" />
          )}
          <span>{uploadingImg ? 'Subiendo...' : 'Subir Imagen'}</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            disabled={uploadingImg}
            className="hidden"
          />
        </label>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();
          }}
          onClick={() => {
            setShowLinkPopover(false);
            setShowImgUrlPopover((v) => !v);
          }}
          className="px-2 py-1.5 rounded-lg text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          title="Insertar imagen por URL"
        >
          Imagen URL
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd('removeFormat')}
          title="Limpiar formato"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition-colors cursor-pointer ml-auto"
        >
          <RemoveFormatting className="w-4 h-4" />
        </button>
      </div>

      {/* Inline Popovers */}
      {showLinkPopover && (
        <div className="px-3 py-2 bg-blue-50/70 border-b border-blue-200 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-blue-900">Enlace URL:</span>
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://ejemplo.com"
            className="flex-1 min-w-[200px] px-2.5 py-1 text-xs bg-white border border-blue-200 rounded-lg outline-none focus:border-blue-500"
          />
          <button
            type="button"
            onClick={handleConfirmLink}
            className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" /> Aplicar
          </button>
          <button
            type="button"
            onClick={() => setShowLinkPopover(false)}
            className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {showImgUrlPopover && (
        <div className="px-3 py-2 bg-emerald-50/70 border-b border-emerald-200 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-emerald-900">URL de imagen:</span>
          <input
            type="url"
            value={imgUrlInput}
            onChange={(e) => setImgUrlInput(e.target.value)}
            placeholder="https://.../imagen.jpg"
            className="flex-1 min-w-[200px] px-2.5 py-1 text-xs bg-white border border-emerald-200 rounded-lg outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={handleConfirmImgUrl}
            className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" /> Insertar
          </button>
          <button
            type="button"
            onClick={() => setShowImgUrlPopover(false)}
            className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="px-3 py-1.5 bg-rose-50 border-b border-rose-200 text-xs text-rose-700 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Editable Rich Content Canvas */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={syncHtml}
        onBlur={() => {
          saveSelection();
          syncHtml();
        }}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        data-placeholder="Escribe los párrafos de la noticia, inserta encabezados, enlaces o sube imágenes directamente aquí..."
        className="min-h-[240px] max-h-[460px] overflow-y-auto p-4 text-sm text-slate-800 leading-relaxed outline-none
          empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400
          [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mt-4 [&_h2]:mb-2
          [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-900 [&_h3]:mt-3 [&_h3]:mb-1.5
          [&_p]:mb-3
          [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3
          [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-3
          [&_a]:text-emerald-700 [&_a]:underline
          [&_blockquote]:border-y [&_blockquote]:border-slate-200 [&_blockquote]:py-3 [&_blockquote]:my-4 [&_blockquote]:italic [&_blockquote]:text-slate-600
          [&_img]:rounded-xl [&_img]:max-w-full [&_img]:h-auto [&_img]:my-3 [&_img]:mx-auto"
      />
    </div>
  );
}
