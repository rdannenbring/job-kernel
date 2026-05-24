import React from 'react';

export default function ScoreMini({ score, size = 28, avgScore }) {
  if (score == null) {
    return <span className="lscore-mini" style={{ width: size, height: size }} />;
  }
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(score / 100, 1);
  const color = score >= 85 ? 'var(--success)' : score >= 70 ? 'var(--primary)' : 'var(--warn)';

  return (
    <span className="lscore-mini" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth="2" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth="2"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
        />
      </svg>
      <span className="n" style={{ color, fontSize: size < 30 ? 11 : 13, fontWeight: 800 }}>{score}</span>
    </span>
  );
}
