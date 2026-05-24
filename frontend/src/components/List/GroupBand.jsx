import React, { useMemo } from 'react';

function median(apps) {
  const scores = apps.map(a => a.match_score).filter(s => s != null).sort((a, b) => a - b);
  if (!scores.length) return null;
  const mid = Math.floor(scores.length / 2);
  return scores.length % 2 === 0 ? Math.round((scores[mid - 1] + scores[mid]) / 2) : scores[mid];
}

export default function GroupBand({ id, label, kind, sub, icon, apps, collapsed, onToggle }) {
  const med = useMemo(() => median(apps), [apps]);

  return (
    <div
      className={`pulse-day is-${kind || 'week'}${collapsed ? ' is-collapsed' : ''}`}
      onClick={onToggle}
    >
      {icon && (
        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{icon}</span>
      )}
      <span>{label}</span>
      <span className="pulse-day-count">{apps.length}</span>
      {sub && <span className="pulse-day-sub">· {sub}</span>}
      {med != null && (
        <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.7, marginLeft: 4 }}>
          · ⌀{med}
        </span>
      )}
      <span className="pulse-day-chev">
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>expand_more</span>
      </span>
    </div>
  );
}
