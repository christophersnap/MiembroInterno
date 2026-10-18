export interface CountryCodeInfo {
  code: string;       // e.g. "+503"
  country: string;    // "El Salvador"
  iso: string;        // "SV"
  flag: string;       // "🇸🇻"
  mask: string;       // "####-####"
  digits: number;     // 8
  placeholder: string;// "7123-4567"
}

export const COUNTRY_CODES: CountryCodeInfo[] = [
  { code: '+503', country: 'El Salvador', iso: 'SV', flag: '🇸🇻', mask: '####-####', digits: 8, placeholder: '7123-4567' },
  { code: '+502', country: 'Guatemala', iso: 'GT', flag: '🇬🇹', mask: '####-####', digits: 8, placeholder: '5123-4567' },
  { code: '+504', country: 'Honduras', iso: 'HN', flag: '🇭🇳', mask: '####-####', digits: 8, placeholder: '9123-4567' },
  { code: '+505', country: 'Nicaragua', iso: 'NI', flag: '🇳🇮', mask: '####-####', digits: 8, placeholder: '8123-4567' },
  { code: '+506', country: 'Costa Rica', iso: 'CR', flag: '🇨🇷', mask: '####-####', digits: 8, placeholder: '8123-4567' },
  { code: '+507', country: 'Panamá', iso: 'PA', flag: '🇵🇦', mask: '####-####', digits: 8, placeholder: '6123-4567' },
  { code: '+1', country: 'Estados Unidos / Canadá', iso: 'US', flag: '🇺🇸', mask: '(###) ###-####', digits: 10, placeholder: '(555) 123-4567' },
  { code: '+52', country: 'México', iso: 'MX', flag: '🇲🇽', mask: '## #### ####', digits: 10, placeholder: '55 1234 5678' },
  { code: '+34', country: 'España', iso: 'ES', flag: '🇪🇸', mask: '### ## ## ##', digits: 9, placeholder: '612 34 56 78' },
  { code: '+57', country: 'Colombia', iso: 'CO', flag: '🇨🇴', mask: '### ### ####', digits: 10, placeholder: '300 123 4567' },
  { code: '+54', country: 'Argentina', iso: 'AR', flag: '🇦🇷', mask: '## #### ####', digits: 10, placeholder: '11 1234 5678' },
  { code: '+56', country: 'Chile', iso: 'CL', flag: '🇨🇱', mask: '# #### ####', digits: 9, placeholder: '9 1234 5678' },
  { code: '+51', country: 'Perú', iso: 'PE', flag: '🇵🇪', mask: '### ### ###', digits: 9, placeholder: '912 345 678' },
];

export const DEFAULT_COUNTRY = COUNTRY_CODES[0]; // El Salvador

/**
 * Aplica una máscara numérica reemplazando '#' con los dígitos ingresados
 */
export function applyPhoneMask(rawValue: string, mask: string): string {
  const digits = rawValue.replace(/\D/g, '');
  if (!digits) return '';

  let formatted = '';
  let digitIndex = 0;

  for (let i = 0; i < mask.length && digitIndex < digits.length; i++) {
    if (mask[i] === '#') {
      formatted += digits[digitIndex];
      digitIndex++;
    } else {
      formatted += mask[i];
    }
  }

  return formatted;
}

/**
 * Formatea un número de DUI salvadoreño: 00000000-0
 */
export function applyDuiMask(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, '').slice(0, 9);
  if (!digits) return '';
  if (digits.length <= 8) return digits;
  return `${digits.slice(0, 8)}-${digits.slice(8, 9)}`;
}
