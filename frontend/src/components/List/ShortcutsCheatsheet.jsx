import React from 'react';

const SHORTCUTS = [
  { keys: ['j'],    label: 'Next row' },
  { keys: ['k'],    label: 'Previous row' },
  { keys: ['↵'],    label: 'Open selected' },
  { keys: ['x'],    label: 'Toggle select' },
  { keys: ['e'],    label: 'Inline edit stage' },
  { keys: ['/'],    label: 'Focus search' },
  { keys: ['g', 'a'], label: 'Jump to · Active' },
  { keys: ['g', 'n'], label: 'Jump to · Needs action' },
  { keys: ['g', 'i'], label: 'Jump to · Interviewing' },
  { keys: ['g', 'r'], label: 'Jump to · Closed' },
  { keys: ['⌘', 'A'], label: 'Select all visible' },
  { keys: ['?'],    label: 'Show this sheet' },
];

export default function ShortcutsCheatsheet({ onClose }) {
  return (
    <div className="l-overlay" onClick={onClose}>
      <div className="l-modal l-modal-wide" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, padding: '0 4px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--primary)' }}>keyboard</span>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--txt)' }}>Keyboard shortcuts</h3>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--txt-dim)', fontWeight: 700 }}>List view</span>
        </div>
        <div className="cheat">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="cheat-row">
              <span>{s.label}</span>
              <span className="cheat-keys">
                {s.keys.map((k, j) => <span key={j} className="cheat-key">{k}</span>)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
