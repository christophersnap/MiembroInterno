import React from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { es } from 'date-fns/locale/es';
import 'react-datepicker/dist/react-datepicker.css';

// Registramos el locale en español
registerLocale('es', es);

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  name?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  maxDate?: string | Date;
}

export default function DateInput({
  value,
  onChange,
  name,
  id,
  required,
  disabled,
  placeholder = 'dd/mm/aaaa',
  className = "mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border",
  maxDate
}: DateInputProps) {
  // Convertimos el valor en string (YYYY-MM-DD) a objeto Date
  const selectedDate = value ? new Date(value + 'T00:00:00') : null;

  const handleDateChange = (date: Date | null) => {
    if (!date) {
      onChange('');
      return;
    }
    // Formateamos de vuelta a YYYY-MM-DD para guardar en el estado/BD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    onChange(`${year}-${month}-${day}`);
  };

  const parsedMaxDate = maxDate ? new Date(maxDate + 'T00:00:00') : undefined;

  return (
    <DatePicker
      selected={selectedDate}
      onChange={handleDateChange}
      dateFormat="dd/MM/yyyy"
      locale="es"
      name={name}
      id={id}
      required={required}
      disabled={disabled}
      placeholderText={placeholder}
      className={className}
      wrapperClassName="w-full"
      maxDate={parsedMaxDate}
      showMonthDropdown
      showYearDropdown
      dropdownMode="select"
      autoComplete="off"
    />
  );
}
