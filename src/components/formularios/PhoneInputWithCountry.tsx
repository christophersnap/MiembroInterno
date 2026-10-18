import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { COUNTRY_CODES, CountryCodeInfo, DEFAULT_COUNTRY, applyPhoneMask } from '../../utils/phoneMasks';

interface PhoneInputWithCountryProps {
  value?: string;
  onChange: (val: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  hasError?: boolean;
}

export default function PhoneInputWithCountry({
  value = '',
  onChange,
  required = false,
  disabled = false,
  placeholder,
  className = '',
  hasError = false,
}: PhoneInputWithCountryProps) {
  // Parse initial value to extract country code if available
  const [selectedCountry, setSelectedCountry] = useState<CountryCodeInfo>(() => {
    if (value) {
      const matched = COUNTRY_CODES.find(c => value.startsWith(c.code));
      if (matched) return matched;
    }
    return DEFAULT_COUNTRY;
  });

  const [localNumber, setLocalNumber] = useState<string>(() => {
    if (value && value.startsWith(selectedCountry.code)) {
      const rest = value.slice(selectedCountry.code.length).trim();
      return applyPhoneMask(rest, selectedCountry.mask);
    }
    return value ? applyPhoneMask(value, selectedCountry.mask) : '';
  });

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleCountrySelect = (country: CountryCodeInfo) => {
    setSelectedCountry(country);
    setIsOpen(false);
    setSearch('');
    // Re-mask current digits with new country mask
    const digitsOnly = localNumber.replace(/\D/g, '').slice(0, country.digits);
    const reformatted = applyPhoneMask(digitsOnly, country.mask);
    setLocalNumber(reformatted);
    if (reformatted) {
      onChange(`${country.code} ${reformatted}`);
    } else {
      onChange('');
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawDigits = e.target.value.replace(/\D/g, '').slice(0, selectedCountry.digits);
    const masked = applyPhoneMask(rawDigits, selectedCountry.mask);
    setLocalNumber(masked);
    if (masked) {
      onChange(`${selectedCountry.code} ${masked}`);
    } else {
      onChange('');
    }
  };

  const filteredCountries = COUNTRY_CODES.filter(c => 
    c.country.toLowerCase().includes(search.toLowerCase()) || 
    c.code.includes(search) || 
    c.iso.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={`relative flex rounded-xl shadow-xs transition-all ${className}`}>
      {/* Selector de País / Código */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-1.5 px-3 py-2.5 h-full bg-gray-50 hover:bg-gray-100 border border-r-0 rounded-l-xl text-sm font-medium text-gray-700 transition-colors focus:outline-hidden ${
            hasError ? 'border-red-300 bg-red-50/30' : 'border-gray-300'
          }`}
          title={`${selectedCountry.country} (${selectedCountry.code})`}
        >
          <span className="text-lg leading-none">{selectedCountry.flag}</span>
          <span className="text-xs font-semibold text-gray-800">{selectedCountry.code}</span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute left-0 top-full mt-1.5 w-72 max-h-72 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Buscador de países */}
            <div className="p-2 border-b border-gray-100 bg-gray-50/50">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Buscar país o código..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-gray-800"
                />
              </div>
            </div>

            {/* Lista de países */}
            <div className="overflow-y-auto flex-1 p-1 custom-scrollbar">
              {filteredCountries.length === 0 ? (
                <div className="p-3 text-xs text-center text-gray-400">No se encontraron países</div>
              ) : (
                filteredCountries.map((c) => {
                  const isSelected = c.code === selectedCountry.code && c.iso === selectedCountry.iso;
                  return (
                    <button
                      key={c.iso}
                      type="button"
                      onClick={() => handleCountrySelect(c)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 text-left rounded-lg text-xs transition-colors ${
                        isSelected 
                          ? 'bg-emerald-50 text-emerald-900 font-semibold' 
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span className="text-base">{c.flag}</span>
                        <span className="truncate">{c.country}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                          {c.code}
                        </span>
                        <span className="text-[10px] text-gray-400">{c.mask}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input de dígitos con máscara */}
      <input
        type="tel"
        inputMode="numeric"
        disabled={disabled}
        required={required}
        value={localNumber}
        onChange={handleNumberChange}
        placeholder={placeholder || selectedCountry.placeholder}
        className={`flex-1 min-w-0 px-3.5 py-2.5 bg-white border rounded-r-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono tracking-wide ${
          hasError ? 'border-red-300 bg-red-50/20 ring-1 ring-red-400' : 'border-gray-300'
        }`}
      />
    </div>
  );
}
