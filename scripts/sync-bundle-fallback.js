import fs from 'fs';
import path from 'path';

try {
  const distHtmlPath = path.resolve(process.cwd(), 'dist/index.html');
  const rootHtmlPath = path.resolve(process.cwd(), 'index.html');

  if (!fs.existsSync(distHtmlPath) || !fs.existsSync(rootHtmlPath)) {
    process.exit(0);
  }

  const distHtml = fs.readFileSync(distHtmlPath, 'utf-8');
  let rootHtml = fs.readFileSync(rootHtmlPath, 'utf-8');

  // Extraer el hash actual del script principal y css
  const jsMatch = distHtml.match(/src="(\/assets\/index-[^"]+\.js)"/);
  const cssMatch = distHtml.match(/href="(\/assets\/index-[^"]+\.css)"/);

  if (jsMatch && cssMatch) {
    const jsPath = jsMatch[1];
    const cssPath = cssMatch[1];

    // Reemplazar o asegurar la carga de contingencia en root index.html
    rootHtml = rootHtml.replace(/CURRENT_JS_BUNDLE = '[^']*'/, `CURRENT_JS_BUNDLE = '${jsPath}'`);
    rootHtml = rootHtml.replace(/CURRENT_CSS_BUNDLE = '[^']*'/, `CURRENT_CSS_BUNDLE = '${cssPath}'`);
    
    fs.writeFileSync(rootHtmlPath, rootHtml, 'utf-8');
    console.log(`[Sync] Fallback bundle sincronizado: ${jsPath} y ${cssPath}`);
  }
} catch (e) {
  console.warn('[Sync] Advertencia al sincronizar bundle:', e.message);
}
