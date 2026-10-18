# Guía de Despliegue en Hostinger con GitHub - Cruz Verde Salvadoreña

Esta guía explica detalladamente la solución al mensaje **"El sistema está demorando en cargar..."** y cómo funciona el **despliegue automático con GitHub en Hostinger**.

---

## 🔍 ¿Por qué viste el mensaje "El sistema está demorando en cargar"?

Cuando conectas tu repositorio de **GitHub en Hostinger** mediante la función de Git automático (hPanel > Avanzado > Git):

1. **Hostinger solamente descarga los archivos que existen en GitHub (`git pull`)**:
   - Hostinger en sus planes de alojamiento compartido **NO ejecuta `npm install` ni `npm run build`** en sus servidores cuando GitHub hace push.
2. **La carpeta `dist/` estaba excluida en `.gitignore`**:
   - Tradicionalmente, la carpeta compilada `dist/` no se sube a los repositorios de Git.
   - Por lo tanto, en tu servidor de Hostinger únicamente existía el código fuente (`src/main.tsx` en TypeScript) y el `index.html` sin compilar.
3. **El navegador no puede ejecutar TypeScript (`.tsx`) directamente**:
   - Cuando abres tu dominio, el servidor de Hostinger le entregaba al navegador el archivo `/src/main.tsx`.
   - Los navegadores web no entienden TypeScript nativamente sin compilar a JavaScript estándar.
   - Al no poder arrancar React, el temporizador de diagnóstico mostró la advertencia que viste.

---

## ✅ Solución Aplicada en el Código

Ya hemos preparado el proyecto para que funcione directamente con **GitHub + Hostinger**:

1. **Se incluyó `dist/` en Git (`.gitignore` actualizado)**:
   - La carpeta `dist/` compilada ahora se incluye para que suba a GitHub y Hostinger la reciba automáticamente.
2. **Se creó el archivo raíz `/.htaccess`**:
   - Si Hostinger clona el repositorio en `public_html/`, este `.htaccess` redirige automáticamente todas las peticiones a la carpeta `dist/` (incluyendo `/assets/`, `/login`, etc.).
3. **Se creó el enrutador raíz `/index.php`**:
   - Dado que Hostinger prioriza `index.php`, este archivo detecta `dist/index.html` y lo sirve inmediatamente al visitante sin demoras.
4. **Se agregó un flujo de GitHub Actions (`.github/workflows/deploy.yml`)**:
   - Si lo deseas, GitHub Actions puede compilar automáticamente en cada `git push`.

---

## 🚀 ¿Qué debes hacer ahora para que funcione?

Solo necesitas **enviar la compilación a tu repositorio de GitHub**:

### Paso Único: Compilar y hacer Push a GitHub

En tu terminal o computadora local donde tienes el proyecto:

```bash
# 1. Compilar el proyecto (genera los archivos finales en dist/)
npm run build

# 2. Agregar todos los cambios (incluyendo dist/ y los nuevos enrutadores)
git add .

# 3. Hacer commit
git commit -m "Activar despliegue automatico para Hostinger con dist"

# 4. Enviar a GitHub
git push origin main
```
*(Si tu rama principal se llama `master`, usa `git push origin master`)*.

---

### ¿Qué ocurrirá en Hostinger inmediatamente después del Push?

1. Hostinger recibirá el webhook de GitHub y ejecutará `git pull`.
2. Descargará la carpeta `dist/`, el nuevo `index.php` y el nuevo `.htaccess`.
3. Al ingresar a tu dominio, **el sistema de Cruz Verde Salvadoreña cargará inmediatamente**.

---

## 🛠️ Alternativa recomendada en Hostinger: Cambiar el "Directorio Raíz" (Document Root)

Si deseas la configuración más limpia y profesional en Hostinger:

1. Ve a tu **hPanel de Hostinger**.
2. Entra a **Sitios Web** > Selecciona tu dominio > **Tablero (Dashboard)**.
3. En la barra de búsqueda escribe **"Directorio Raíz"** o busca la sección de configuración de dominio.
4. Cambia la ruta de destino de:
   - `public_html`
   A:
   - `public_html/dist`
5. Haz clic en **Guardar**.

Al hacer esto, Hostinger servirá directamente el contenido de `dist/` de forma nativa e instantánea.
