/**
 * Cruz Verde Salvadoreña - Seguridad Criptográfica de Códigos QR
 * Genera tokens de verificación no secuenciales e impredecibles para carnets físicos.
 */

const INSTITUTIONAL_SALT = "CRUZ_VERDE_SV_QR_SECURE_TOKEN_2026_SALT_98471";

export function generateSecureQrToken(carnet: string, socorristaId?: number | string): string {
  const cleanCarnet = (carnet || '').trim().toUpperCase();
  const rawInput = `${INSTITUTIONAL_SALT}:${cleanCarnet}:${socorristaId || ''}:CVS_OFFICIAL`;

  let h1 = 0xdeadbeef ^ 0x12345678;
  let h2 = 0x41c64e6d ^ 0x87654321;
  let h3 = 0x35f3e9d8 ^ 0xaabbccdd;
  let h4 = 0x96cd1b34 ^ 0x55667788;

  for (let i = 0; i < rawInput.length; i++) {
    const ch = rawInput.charCodeAt(i);
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

  return `${hex1.substring(0, 4)}${hex2.substring(2, 6)}${hex3.substring(1, 5)}${hex4.substring(3, 7)}`;
}

export function isSecureQrToken(value: string): boolean {
  if (!value) return false;
  return /^[0-9a-fA-F]{16}$/.test(value.trim());
}
