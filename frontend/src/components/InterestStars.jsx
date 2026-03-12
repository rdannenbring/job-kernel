import React from 'react';

const InterestStars = ({ level, onChange, size = '1.2rem' }) => {
    const weights = { 'High': 3, 'Medium': 2, 'Low': 1, 'None': 0, '': 0 };
    const currentWeight = weights[level || ''] || 0;
    
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            {[1, 2, 3].map(starWeight => (
                <span 
                    key={starWeight}
                    className="material-symbols-outlined"
                    onClick={(e) => {
                        if (onChange) {
                            e.stopPropagation();
                            const newLevel = starWeight === 3 ? 'High' : starWeight === 2 ? 'Medium' : 'Low';
                            // If clicking same star, could potentially clear it, but usually standard is to sets to that level
                            onChange(newLevel);
                        }
                    }}
                    style={{ 
                        fontSize: size, 
                        color: starWeight <= currentWeight ? '#f59e0b' : 'var(--text-muted)',
                        cursor: onChange ? 'pointer' : 'default',
                        userSelect: 'none',
                        fontVariationSettings: starWeight <= currentWeight ? "'FILL' 1" : "'FILL' 0",
                        opacity: starWeight <= currentWeight ? 1 : 0.4
                    }}
                >
                    star
                </span>
            ))}
        </div>
    );
};

export default InterestStars;
