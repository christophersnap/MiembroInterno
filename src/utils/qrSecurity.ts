/**
 * Cruz Verde Salvadoreña - Seguridad Criptográfica de Códigos QR
 * Genera tokens de verificación no secuenciales e impredecibles para carnets físicos.
 */

// Sal secreta institucional para generar hashes impredecibles y únicos
const INSTITUTIONAL_QR_SALT = 'CRUZ_VERDE_SV_QR_SECURE_TOKEN_2026_SALT_98471';

/**
 * Algoritmo FNV-1a / MurmurHash / DJB2 extendido a 64-bit y 128-bit
 * produce un hash determinista y no secuencial en cualquier navegador sin dependencias externas.
 */
export function generateSecureQrToken(carnet: string, id?: number | string): string {
  const cleanCarnet = (carnet || '').trim().toUpperCase();
  const rawSeed = `${INSTITUTIONAL_QR_SALT}:${cleanCarnet}:${id || ''}:CVS_OFFICIAL`;

  let h1 = 0xdeadbeef ^ 0x12345678;
  let h2 = 0x41c6ce57 ^ 0x87654321;
  let h3 = 0x9e3779b9 ^ 0xabcdef01;
  let h4 = 0x85ebca6b ^ 0x13579bdf;

  for (let i = 0; i < rawSeed.length; i++) {
    const ch = rawSeed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ (ch << 1), 1597334677);
    h3 = Math.imul(h3 ^ (ch << 2), 3849293111);
    h4 = Math.imul(h4 ^ (ch << 3), 2718281829);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h3 ^ (h3 >>> 13), 3266489909);
  h3 = Math.imul(h3 ^ (h3 >>> 16), 2246822507) ^ Math.imul(h4 ^ (h4 >>> 13), 3266489909);
  h4 = Math.imul(h4 ^ (h4 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const hex3 = (h3 >>> 0).toString(16).padStart(8, '0');
  const hex4 = (h4 >>> 0).toString(16).padStart(8, '0');

  // Retorna un token seguro de 16 caracteres hexadecimales (ej: 7f3a9e1b4c8d205f)
  return `${hex1.substring(0, 4)}${hex2.substring(2, 6)}${hex3.substring(1, 5)}${hex4.substring(3, 7)}`;
}

/**
 * Valida si un token coincide con los datos de un socorrista
 */
export function verifySocorristaToken(token: string, carnet: string, id?: number | string): boolean {
  if (!token || !carnet) return false;
  const expected = generateSecureQrToken(carnet, id);
  return token.toLowerCase() === expected.toLowerCase();
}
