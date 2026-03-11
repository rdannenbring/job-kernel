import React from 'react';

const About = () => {
    return (
        <div style={{ padding: '3rem', maxWidth: '800px' }}>
            <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>ℹ️ About Resume Automator</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Privacy-first, AI-powered job application assistant.</p>
            </header>

            <div className="card" style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>How it works</h2>
                <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                    <li style={{ marginBottom: '0.5rem' }}><strong>Tailor:</strong> We use GPT-4o to analyze your resume against a job description.</li>
                    <li style={{ marginBottom: '0.5rem' }}><strong>Refine:</strong> You review the changes and make tweaks.</li>
                    <li style={{ marginBottom: '0.5rem' }}><strong>Cover Letter:</strong> We generate a matching cover letter automatically.</li>
                    <li style={{ marginBottom: '0.5rem' }}><strong>Save:</strong> Everything is stored locally in your private database.</li>
                </ul>
            </div>

            <div className="card">
                <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Open Source</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Built with ❤️ using React, FastAPI, and Docker.</p>
            </div>
        </div>
    );
};

export default About;
