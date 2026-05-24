import React, { useEffect, useState } from 'react';

const DURATION = 5000;

export default function UndoToast({ message, onUndo, onDismiss }) {
  const [secondsLeft, setSecondsLeft] = useState(5);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, Math.ceil((DURATION - elapsed) / 1000));
      setSecondsLeft(remaining);
      if (elapsed >= DURATION) {
        clearInterval(timer);
        onDismiss();
      }
    }, 250);
    return () => clearInterval(timer);
  }, [onDismiss]);

  const circumference = 2 * Math.PI * 13;
  const progress = secondsLeft / 5;

  return (
    <div className="k-toast">
      <div className="k-toast-prog">
        <svg width="32" height="32" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="13" stroke="rgba(255,255,255,0.15)" strokeWidth="2" fill="none" />
          <circle
            cx="16" cy="16" r="13"
            stroke="#93b8fb" strokeWidth="2" fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            strokeLinecap="round"
            transform="rotate(-90 16 16)"
            style={{ transition: 'stroke-dashoffset 0.25s linear' }}
          />
        </svg>
      </div>
      <span>{message}</span>
      <button className="k-toast-undo" onClick={onUndo}>
        <span className="material-symbols-outlined">undo</span>
        Undo
      </button>
    </div>
  );
}
