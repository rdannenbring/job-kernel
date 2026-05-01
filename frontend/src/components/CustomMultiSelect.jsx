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
                className={`appearance-none px-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer w-full flex items-center justify-between transition-all ${className}`}
                style={{ 
                    textAlign: 'left',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color-input)',
                    color: 'var(--text-primary)'
                }}
            >
                <span className="truncate mr-4">{displayValue}</span>
                <span className="material-symbols-outlined text-lg shrink-0" style={{ color: 'var(--text-secondary)' }}>
                    {isOpen ? 'expand_less' : 'expand_more'}
                </span>
            </button>
            
            {isOpen && (
                <div 
                    className="absolute top-[calc(100%+0.5rem)] left-0 w-full rounded-xl shadow-2xl z-50 p-2 overflow-y-auto flex flex-col gap-1 backdrop-blur-xl max-h-60" 
                    style={{ 
                        pointerEvents: 'auto',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color-card)',
                    }}
                >
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
                                className={`flex items-center justify-between px-3 py-2 cursor-pointer rounded-lg text-sm font-medium transition-all`}
                                style={{ 
                                    textAlign: 'left', 
                                    width: '100%',
                                    background: isSelected ? 'var(--primary-glow)' : 'transparent',
                                    color: isSelected ? 'var(--primary-light)' : 'var(--text-secondary)'
                                }}
                            >
                                <span className="truncate">{opt.label}</span>
                                {isSelected && (
                                    <span className="material-symbols-outlined text-[16px] shrink-0" style={{ color: 'var(--primary)' }}>check</span>
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
