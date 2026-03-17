import React, { useState, useRef, useEffect } from 'react';

const CustomMultiSelect = ({ value = [], options, onChange, placeholder = "Select...", className = "" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOptions = options.filter(opt => value.includes(opt.value));
    const displayValue = selectedOptions.length > 0 ? selectedOptions.map(o => o.label).join(', ') : placeholder;

    return (
        <div className="relative flex items-center w-full" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`appearance-none bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 px-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer w-full flex items-center justify-between text-slate-700 dark:text-slate-300 ${className}`}
                style={{ textAlign: 'left' }}
            >
                <span className="truncate mr-4">{displayValue}</span>
                <span className="material-symbols-outlined text-lg text-slate-500 dark:text-slate-400 shrink-0">
                    {isOpen ? 'expand_less' : 'expand_more'}
                </span>
            </button>
            
            {isOpen && (
                <div className="absolute top-[calc(100%+0.5rem)] left-0 w-full glass-panel bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl z-50 p-2 overflow-y-auto flex flex-col gap-1 backdrop-blur-xl max-h-60" style={{ pointerEvents: 'auto' }}>
                    {options.map((opt, i) => {
                        const isSelected = value.includes(opt.value);
                        return (
                            <button
                                key={i}
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (isSelected) {
                                        onChange(value.filter(v => v !== opt.value));
                                    } else {
                                        onChange([...value, opt.value]);
                                    }
                                }}
                                className={`flex items-center justify-between px-3 py-2 cursor-pointer rounded-lg text-sm font-medium transition-all ${
                                    isSelected 
                                        ? 'bg-primary/10 dark:bg-primary/20 text-primary dark:text-blue-300 hover:bg-primary/20 dark:hover:bg-primary/30' 
                                        : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300'
                                }`}
                                style={{ textAlign: 'left', width: '100%' }}
                            >
                                <span className="truncate">{opt.label}</span>
                                {isSelected && (
                                    <span className="material-symbols-outlined text-[16px] text-primary dark:text-blue-400 shrink-0">check</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default CustomMultiSelect;
