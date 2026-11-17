export interface CountryPhoneOption {
  code: string;
  name: string;
  mask: string;
  placeholder: string;
}

export const COUNTRY_PHONE_CODES: CountryPhoneOption[] = [
  { code: '+503', name: 'El Salvador', mask: '####-####', placeholder: '0000-0000' },
  { code: '+502', name: 'Guatemala', mask: '####-####', placeholder: '0000-0000' },
  { code: '+504', name: 'Honduras', mask: '####-####', placeholder: '0000-0000' },
  { code: '+505', name: 'Nicaragua', mask: '####-####', placeholder: '0000-0000' },
  { code: '+506', name: 'Costa Rica', mask: '####-####', placeholder: '0000-0000' },
  { code: '+507', name: 'Panamá', mask: '####-####', placeholder: '0000-0000' },
  { code: '+1', name: 'USA / Canadá', mask: '(###) ###-####', placeholder: '(000) 000-0000' },
  { code: '+52', name: 'México', mask: '## #### ####', placeholder: '00 0000 0000' },
];

export function getCountryMask(code: string): CountryPhoneOption {
  return COUNTRY_PHONE_CODES.find((c) => c.code === code) || COUNTRY_PHONE_CODES[0];
}

export function formatPhoneWithMask(value: string, countryCode: string): string {
  const { mask } = getCountryMask(countryCode);
  const digits = (value || '').replace(/\D/g, '');
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

export function parsePhoneWithCountry(rawValue?: string | null): { countryCode: string; localNumber: string } {
  const clean = (rawValue || '').trim();
  if (!clean) {
    return { countryCode: '+503', localNumber: '' };
  }

  // Coincidir primero los códigos más largos (+503 antes que +5...)
  const sorted = [...COUNTRY_PHONE_CODES].sort((a, b) => b.code.length - a.code.length);
  for (const country of sorted) {
    if (clean.startsWith(country.code)) {
      const rest = clean.slice(country.code.length).trim();
      return {
        countryCode: country.code,
        localNumber: formatPhoneWithMask(rest, country.code),
      };
    }
  }

  return {
    countryCode: '+503',
    localNumber: formatPhoneWithMask(clean, '+503'),
  };
}

export function composePhoneWithCountry(countryCode: string, localNumber?: string | null): string {
  const cleanLocal = (localNumber || '').trim();
  const digits = cleanLocal.replace(/\D/g, '');
  if (!digits) return '';
  return `${countryCode} ${formatPhoneWithMask(cleanLocal, countryCode)}`;
}

export function toTelHref(phone?: string | null): string {
  const clean = (phone || '').trim();
  if (!clean) return '#';
  const stripped = clean.replace(/[^\d+]/g, '');
  return `tel:${stripped || clean}`;
}
