import React, { useMemo } from 'react';
import { diffWords } from 'diff';

const DiffViewer = ({ original, tailored }) => {
    const diff = useMemo(() => {
        if (!original || !tailored) return [];
        return diffWords(original, tailored);
    }, [original, tailored]);

    return (
        <div className="diff-viewer-container" style={{ 
            padding: '1.5rem', 
            background: '#f8fafc', 
            borderRadius: '0.5rem', 
            border: '1px solid #e2e8f0',
            maxHeight: '600px',
            overflowY: 'auto',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '0.9rem',
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap'
        }}>
            {diff.map((part, index) => {
                const color = part.added ? '#166534' : part.removed ? '#991b1b' : '#334155';
                const bg = part.added ? '#dcfce7' : part.removed ? '#fee2e2' : 'transparent';
                const decoration = part.removed ? 'line-through' : 'none';
                const weight = part.added ? 'bold' : 'normal';

                return (
                    <span 
                        key={index} 
                        style={{ 
                            color, 
                            backgroundColor: bg, 
                            textDecoration: decoration,
                            fontWeight: weight
                        }}
                    >
                        {part.value}
                    </span>
                );
            })}
        </div>
    );
};

export default DiffViewer;
