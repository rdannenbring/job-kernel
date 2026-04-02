import React from 'react';

const About = () => {
    return (
        <div style={{ padding: '3rem', maxWidth: '800px' }}>
            <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '2.2rem', color: 'var(--primary)' }}>info</span>
                    About Resume Automator
                </h1>
                <p style={{ color: 'var(--text-secondary)' }}>Privacy-first, AI-powered job application assistant.</p>
            </header>

            <div className="card" style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>How it works</h2>
                <ul style={{ padding: 0, listStyle: 'none', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                    <li style={{ marginBottom: '0.85rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: 'var(--primary)', marginTop: '0.1rem' }}>auto_awesome</span>
                        <span><strong>Tailor:</strong> AI analyzes your resume against a job description to highlight the best fit.</span>
                    </li>
                    <li style={{ marginBottom: '0.85rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: 'var(--primary)', marginTop: '0.1rem' }}>edit_note</span>
                        <span><strong>Refine:</strong> Review the suggested changes and make tweaks before exporting.</span>
                    </li>
                    <li style={{ marginBottom: '0.85rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: 'var(--primary)', marginTop: '0.1rem' }}>history_edu</span>
                        <span><strong>Cover Letter:</strong> A matching cover letter is generated automatically.</span>
                    </li>
                    <li style={{ marginBottom: '0.85rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: 'var(--primary)', marginTop: '0.1rem' }}>shield</span>
                        <span><strong>Save:</strong> Everything is stored locally in your private database — nothing leaves your machine.</span>
                    </li>
                </ul>
            </div>

            <div className="card">
                <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Open Source</h2>
                <p style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    Built with <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: '#f87171' }}>favorite</span> using React, FastAPI, and Docker.
                </p>
            </div>
        </div>
    );
};

export default About;
