export interface CountryCodeInfo {
  code: string;
  name: string;
  country: string;
  dialCode: string;
  iso: string;
  flag: string;
  format: string;
  mask: string;
  placeholder: string;
  digits: number;
}

export const COUNTRY_CODES: CountryCodeInfo[] = [
  { code: '+503', name: 'El Salvador', country: 'El Salvador', dialCode: '+503', iso: 'SV', flag: '🇸🇻', format: '####-####', mask: '####-####', placeholder: '7000-0000', digits: 8 },
  { code: '+502', name: 'Guatemala', country: 'Guatemala', dialCode: '+502', iso: 'GT', flag: '🇬🇹', format: '####-####', mask: '####-####', placeholder: '5000-0000', digits: 8 },
  { code: '+504', name: 'Honduras', country: 'Honduras', dialCode: '+504', iso: 'HN', flag: '🇭🇳', format: '####-####', mask: '####-####', placeholder: '9000-0000', digits: 8 },
  { code: '+505', name: 'Nicaragua', country: 'Nicaragua', dialCode: '+505', iso: 'NI', flag: '🇳🇮', format: '####-####', mask: '####-####', placeholder: '8000-0000', digits: 8 },
  { code: '+506', name: 'Costa Rica', country: 'Costa Rica', dialCode: '+506', iso: 'CR', flag: '🇨🇷', format: '####-####', mask: '####-####', placeholder: '8000-0000', digits: 8 },
  { code: '+507', name: 'Panamá', country: 'Panamá', dialCode: '+507', iso: 'PA', flag: '🇵🇦', format: '####-####', mask: '####-####', placeholder: '6000-0000', digits: 8 },
  { code: '+1', name: 'Estados Unidos', country: 'Estados Unidos', dialCode: '+1', iso: 'US', flag: '🇺🇸', format: '(###) ###-####', mask: '(###) ###-####', placeholder: '(555) 000-0000', digits: 10 },
  { code: '+52', name: 'México', country: 'México', dialCode: '+52', iso: 'MX', flag: '🇲🇽', format: '## ####-####', mask: '## ####-####', placeholder: '55 1234-5678', digits: 10 },
  { code: '+34', name: 'España', country: 'España', dialCode: '+34', iso: 'ES', flag: '🇪🇸', format: '### ### ###', mask: '### ### ###', placeholder: '600 000 000', digits: 9 },
  { code: '+57', name: 'Colombia', country: 'Colombia', dialCode: '+57', iso: 'CO', flag: '🇨🇴', format: '### ###-####', mask: '### ###-####', placeholder: '300 000-0000', digits: 10 }
];

export const DEFAULT_COUNTRY: CountryCodeInfo = COUNTRY_CODES[0];

export function applyPhoneMask(rawNumber: string, maskOrCountry?: string | CountryCodeInfo): string {
  if (!rawNumber) return '';
  const digits = rawNumber.replace(/\D/g, '');
  if (!digits) return '';

  let mask = '####-####';
  let maxDigits = 8;

  if (typeof maskOrCountry === 'string') {
    mask = maskOrCountry;
    maxDigits = (mask.match(/#/g) || []).length || 8;
  } else if (maskOrCountry && typeof maskOrCountry === 'object') {
    mask = maskOrCountry.mask || maskOrCountry.format || '####-####';
    maxDigits = maskOrCountry.digits || 8;
  }

  const slicedDigits = digits.slice(0, maxDigits);

  let result = '';
  let digitIndex = 0;

  for (let i = 0; i < mask.length && digitIndex < slicedDigits.length; i++) {
    if (mask[i] === '#') {
      result += slicedDigits[digitIndex];
      digitIndex++;
    } else {
      result += mask[i];
    }
  }

  return result;
}

export function applyDuiMask(rawDui: string): string {
  const digits = rawDui.replace(/\D/g, '').slice(0, 9);
  if (digits.length <= 8) return digits;
  return `${digits.slice(0, 8)}-${digits.slice(8)}`;
}
