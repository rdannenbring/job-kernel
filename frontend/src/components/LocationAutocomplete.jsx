import React, { useState, useRef, useEffect, useCallback } from 'react';

const LocationAutocomplete = ({ value, onChange, style = {}, className = '' }) => {
    const [query, setQuery] = useState(value || '');
    const [suggestions, setSuggestions] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const containerRef = useRef(null);
    const debounceRef = useRef(null);

    // Sync from parent if value prop changes externally
    useEffect(() => {
        setQuery(value || '');
    }, [value]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchSuggestions = useCallback(async (text) => {
        if (!text || text.length < 3) {
            setSuggestions([]);
            setIsOpen(false);
            return;
        }
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(text)}`,
                { headers: { 'Accept-Language': 'en' } }
            );
            if (!res.ok) return;
            const data = await res.json();
            const unique = [];
            const seen = new Set();
            for (const item of data) {
                if (!seen.has(item.display_name)) {
                    seen.add(item.display_name);
                    unique.push(item);
                }
            }
            setSuggestions(unique);
            setIsOpen(unique.length > 0);
            setActiveIndex(-1);
        } catch {
            // fail silently – user can still type freeform
        }
    }, []);

    const handleChange = (e) => {
        const val = e.target.value;
        setQuery(val);
        onChange(val);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
    };

    const handleSelect = (displayName) => {
        setQuery(displayName);
        onChange(displayName);
        setIsOpen(false);
        setSuggestions([]);
    };

    const handleKeyDown = (e) => {
        if (!isOpen || suggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        } else if (e.key === 'Enter' && activeIndex >= 0) {
            e.preventDefault();
            handleSelect(suggestions[activeIndex].display_name);
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
            <input
                type="text"
                value={query}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onFocus={() => { if (suggestions.length > 0) setIsOpen(true); }}
                placeholder="Start typing a location..."
                className={className}
                style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '0.4rem',
                    color: 'var(--text-primary)',
                    width: '100%',
                    padding: '0.4rem',
                    ...style,
                }}
            />
            {isOpen && suggestions.length > 0 && (
                <ul style={{
                    position: 'absolute',
                    top: 'calc(100% + 0.5rem)',
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    background: '#1a2332',
                    border: '1px solid var(--border-color)',
                    borderRadius: '0.75rem',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
                    listStyle: 'none',
                    margin: 0,
                    padding: '0.5rem',
                    maxHeight: '240px',
                    overflowY: 'auto',
                }}>
                    {suggestions.map((s, i) => (
                        <li
                            key={s.place_id}
                            onMouseDown={() => handleSelect(s.display_name)}
                            onMouseEnter={() => setActiveIndex(i)}
                            style={{
                                padding: '0.5rem 0.75rem',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                borderRadius: '0.5rem',
                                color: i === activeIndex ? 'var(--primary)' : 'var(--text-primary)',
                                background: i === activeIndex ? 'var(--bg-tertiary)' : 'transparent',
                                fontWeight: i === activeIndex ? 500 : 400,
                                transition: 'all 0.15s',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '0.5rem',
                            }}
                        >
                            <span
                                className="material-symbols-outlined"
                                style={{ fontSize: '1rem', color: i === activeIndex ? 'var(--primary)' : 'var(--text-muted)', marginTop: '0.15rem', flexShrink: 0 }}
                            >location_on</span>
                            <span style={{ lineHeight: 1.35 }}>{s.display_name}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default LocationAutocomplete;
