/**
 * Generador de Slugs únicos y limpios para Formularios
 * Ejemplo: "Inscripción Oficial Curso 2026" -> "inscripcion-oficial-curso-2026-a8f2"
 */
export function generateSlug(titulo: string): string {
  const cleanTitle = (titulo || 'formulario')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Elimina acentos y diacríticos
    .replace(/[^a-z0-9]+/g, '-')     // Caracteres especiales a guiones
    .replace(/(^-|-$)+/g, '')        // Quita guiones al inicio o final
    .substring(0, 48);

  const base = cleanTitle || 'formulario';
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `${base}-${randomSuffix}`;
}
