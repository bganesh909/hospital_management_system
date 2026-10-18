import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useSearchPatients } from '../../hooks/usePatients';

export interface PickedPatient {
  id: string;
  first_name: string;
  last_name: string;
  patient_number?: string;
  phone?: string | null;
}

interface PatientPickerProps {
  value: string;
  onChange: (patientId: string, patient: PickedPatient | null) => void;
  /** Label to show when a value is preset (e.g. editing an existing record) */
  selectedLabel?: string;
  error?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export const patientDisplayName = (p: PickedPatient) =>
  `${p.first_name} ${p.last_name}${p.patient_number ? ` (${p.patient_number})` : ''}`;

export function PatientPicker({
  value,
  onChange,
  selectedLabel,
  error,
  disabled,
  placeholder = 'Search patient by name, number or phone...',
}: PatientPickerProps) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(selectedLabel ?? '');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (selectedLabel) setLabel(selectedLabel);
  }, [selectedLabel]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const { data, isFetching } = useSearchPatients(debounced);
  const results: PickedPatient[] = data?.data ?? [];

  if (value) {
    return (
      <div
        className={`flex items-center justify-between w-full px-3 py-2 border rounded-lg text-sm ${
          error ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-gray-50'
        }`}
      >
        <span className="text-gray-900 truncate">{label || 'Selected patient'}</span>
        {!disabled && (
          <button
            type="button"
            onClick={() => {
              onChange('', null);
              setLabel('');
              setQuery('');
            }}
            className="ml-2 text-gray-400 hover:text-gray-600"
            aria-label="Clear patient"
          >
            <X size={16} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        value={query}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={`w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
          error ? 'border-red-300 bg-red-50' : 'border-gray-300'
        }`}
      />
      {open && debounced.length >= 2 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {isFetching && results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">Searching...</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">No patients found</p>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p.id, p);
                  setLabel(patientDisplayName(p));
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm"
              >
                <span className="font-medium text-gray-900">
                  {p.first_name} {p.last_name}
                </span>
                <span className="text-gray-500">
                  {p.patient_number ? ` · ${p.patient_number}` : ''}
                  {p.phone ? ` · ${p.phone}` : ''}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
