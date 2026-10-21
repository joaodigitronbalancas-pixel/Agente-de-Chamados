import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export interface SelectOption {
  value: number | string;
  label: string;
  subLabel?: string;
  badge?: string;
  icon?: React.ReactNode;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: number | string | undefined | null;
  onChange: (value: any, option?: SelectOption) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  label?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Selecione uma opção...',
  searchPlaceholder = 'Buscar...',
  label,
  disabled = false,
  required = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  const filteredOptions = options.filter((opt) => {
    const q = search.toLowerCase();
    const l = opt.label.toLowerCase();
    const s = (opt.subLabel || '').toLowerCase();
    const b = (opt.badge || '').toLowerCase();
    return l.includes(q) || s.includes(q) || b.includes(q);
  });

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
          {label} {required && <span className="text-cyan-400">*</span>}
        </label>
      )}

      {/* Main trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 bg-slate-900 border rounded-xl text-left text-xs flex items-center justify-between transition-colors cursor-pointer ${
          disabled
            ? 'opacity-60 cursor-not-allowed border-slate-800 text-slate-500'
            : isOpen
            ? 'border-cyan-500 ring-1 ring-cyan-500/30 text-white'
            : 'border-slate-700 hover:border-slate-600 text-slate-200'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
          {selectedOption ? (
            <>
              {selectedOption.icon}
              <span className="truncate font-medium text-white">{selectedOption.label}</span>
              {selectedOption.subLabel && (
                <span className="text-[10px] text-slate-400 truncate hidden sm:inline">
                  • {selectedOption.subLabel}
                </span>
              )}
              {selectedOption.badge && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 shrink-0 font-mono">
                  {selectedOption.badge}
                </span>
              )}
            </>
          ) : (
            <span className="text-slate-500">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl animate-fade-in max-h-72 flex flex-col">
          {/* Search Input */}
          <div className="p-2 border-b border-slate-800 bg-slate-950/70 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-7 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="overflow-y-auto divide-y divide-slate-800/40 p-1 flex-1">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                Nenhuma opção encontrada para "{search}"
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => {
                      onChange(opt.value, opt);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`w-full px-3 py-2 text-left text-xs rounded-lg flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500/15 text-cyan-200 font-semibold'
                        : 'hover:bg-slate-800/80 text-slate-300 hover:text-white'
                    }`}
                  >
                    <div className="min-w-0 flex-1 truncate">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="truncate">{opt.label}</span>
                        {opt.badge && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 border border-slate-700 font-mono">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.subLabel && (
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                          {opt.subLabel}
                        </p>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
