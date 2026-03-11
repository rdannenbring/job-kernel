import React, { useState, useEffect } from 'react';
import CustomDropdown from '../components/CustomDropdown';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const Settings = () => {
    const [aiConfig, setAiConfig] = useState({
        provider: 'openai',
        model: 'gpt-4o-mini',
        base_url: '',
        api_key: ''
    });
    const [uiConfig, setUiConfig] = useState({
        font_size: 14.5
    });
    const [availableModels, setAvailableModels] = useState([]);
    const [prompts, setPrompts] = useState({});
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [showModelModal, setShowModelModal] = useState(false);
    const [modelSearch, setModelSearch] = useState('');
    const [activeTab, setActiveTab] = useState('config'); // 'config' | 'prompts' | 'about'

    // ... existing useEffect ...

    const fetchModels = async () => {
        // Only fetch if we have enough info
        if (!aiConfig.provider) return;
        if (aiConfig.provider === 'openai' && !aiConfig.api_key) {
            // OpenAI might use backend env var, so we can try
        }

        try {
            setMessage('⏳ Fetching models...');
            const res = await fetch(`${API_URL}/api/fetch-models`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(aiConfig)
            });
            const data = await res.json();
            if (data.models && data.models.length > 0) {
                setAvailableModels(data.models);
                setMessage('');
                setModelSearch('');
                setShowModelModal(true);
            } else {
                setMessage('⚠️ No models found or API error.');
            }
        } catch (e) {
            console.error("Error fetching models", e);
            setMessage('❌ Failed to fetch models.');
        }
    };


    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const res = await fetch(`${API_URL}/api/config`);
            const data = await res.json();
            if (data.ai_config) {
                setAiConfig(prev => ({ ...prev, ...data.ai_config }));
            }
            if (data.ui_config) {
                setUiConfig(prev => ({ ...prev, ...data.ui_config }));
                if (data.ui_config.font_size) {
                    document.documentElement.style.fontSize = `${data.ui_config.font_size}px`;
                }
            }
            if (data.prompts) {
                setPrompts(data.prompts);
            }
        } catch (e) {
            console.error("Failed to load config", e);
        }
    };

    const saveConfig = async () => {
        setLoading(true);
        setMessage('');
        try {
            const res = await fetch(`${API_URL}/api/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ai_config: aiConfig,
                    ui_config: uiConfig,
                    prompts: prompts
                })
            });
            if (!res.ok) throw new Error('Failed to save');
            setMessage('✅ Settings saved successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (e) {
            setMessage('❌ Error saving settings: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const promptLabels = {
        analyze_job: "Analyze Job Description",
        tailor_resume: "Tailor Resume",
        refine_resume: "Refine Resume",
        extract_profile: "Extract Profile Data",
        generate_cover_letter: "Generate Cover Letter",
        refine_cover_letter: "Refine Cover Letter"
    };

    return (
        <div style={{ padding: '3rem', maxWidth: '1000px' }}>
            <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚙️ Settings</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Configure your application preferences and AI prompts.</p>
            </header>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', marginBottom: '2rem', borderBottom: '1px solid #334155' }}>
                {[
                    { id: 'config',  label: 'AI Configuration' },
                    { id: 'prompts', label: 'AI Prompts' },
                    { id: 'about',   label: 'About' },
                ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                        background: 'transparent', border: 'none', padding: '0.5rem 1.1rem', cursor: 'pointer',
                        color: activeTab === tab.id ? '#3b82f6' : '#94a3b8',
                        borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
                        fontWeight: activeTab === tab.id ? '600' : '400',
                        fontSize: '0.875rem', transition: 'color 0.15s', marginBottom: '-1px'
                    }}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'config' && (
                <>
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            🤖 AI Model Configuration
                        </h3>

                        <div className="form-group">
                            <label className="form-label">AI Provider</label>
                            <CustomDropdown
                                value={aiConfig.provider || 'openai'}
                                onChange={(val) => setAiConfig({ ...aiConfig, provider: val })}
                                options={[
                                    { value: 'openai', label: 'OpenAI (Official)' },
                                    { value: 'anthropic', label: 'Anthropic (Claude)' },
                                    { value: 'gemini', label: 'Google Gemini' },
                                    { value: 'openrouter', label: 'OpenRouter (DeepSeek, Mistral, Llama, Qwen)' },
                                    { value: 'deepseek', label: 'DeepSeek (Official)' },
                                    { value: 'mistral', label: 'Mistral AI (Official)' },
                                    { value: 'local', label: 'Local (Ollama, LM Studio)' },
                                    { value: 'custom', label: 'Custom OpenAI-Compatible' }
                                ]}
                            />
                        </div>

                        <div className="form-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label className="form-label">Model Name</label>
                                <button
                                    className="btn btn-secondary"
                                    style={{ padding: '2px 8px', fontSize: '0.8rem' }}
                                    onClick={fetchModels}
                                    disabled={!aiConfig.provider}
                                >
                                    🔄 Load Models
                                </button>
                            </div>

                            <input
                                className="form-input"
                                type="text"
                                placeholder={
                                    aiConfig.provider === 'anthropic' ? "e.g. claude-3-opus-20240229" :
                                        aiConfig.provider === 'gemini' ? "e.g. gemini-1.5-pro" :
                                            aiConfig.provider === 'openrouter' ? "e.g. mistralai/mistral-large" :
                                                aiConfig.provider.includes('local') ? "e.g. llama3, mistral" :
                                                    "e.g. gpt-4o-mini"
                                }
                                value={aiConfig.model || ''}
                                onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
                                autoComplete="off"
                            />
                        </div>

                        {(aiConfig.provider === 'local' || aiConfig.provider === 'custom' || aiConfig.provider === 'openrouter') && (
                            <div className="form-group">
                                <label className="form-label">Base URL {aiConfig.provider === 'local' ? '(Required)' : '(Optional)'}</label>
                                <input
                                    className="form-input"
                                    type="text"
                                    placeholder={
                                        aiConfig.provider === 'openrouter' ? "https://openrouter.ai/api/v1" :
                                            "e.g. http://localhost:11434/v1"
                                    }
                                    value={aiConfig.base_url || ''}
                                    onChange={(e) => setAiConfig({ ...aiConfig, base_url: e.target.value })}
                                />
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">API Key {aiConfig.provider === 'local' && '(Optional)'}</label>
                            <input
                                className="form-input"
                                type="password"
                                placeholder="sk-..."
                                value={aiConfig.api_key || ''}
                                onChange={(e) => setAiConfig({ ...aiConfig, api_key: e.target.value })}
                            />
                        </div>

                        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button className="btn btn-primary" onClick={saveConfig} disabled={loading}>
                                {loading ? 'Saving...' : 'Save Configuration'}
                            </button>
                        </div>
                    </div>

                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            🎨 Appearance
                        </h3>
                        
                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>UI Scale (Font Size)</span>
                                <span>{uiConfig.font_size}px</span>
                            </label>
                            <input
                                type="range"
                                min="12"
                                max="18"
                                step="0.5"
                                value={uiConfig.font_size}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    setUiConfig({ ...uiConfig, font_size: val });
                                    document.documentElement.style.fontSize = `${val}px`;
                                }}
                                style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--primary-light)' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                                <span>Smaller</span>
                                <span>Default</span>
                                <span>Larger</span>
                            </div>
                        </div>

                        <div className="form-group" style={{ opacity: 0.7 }}>
                            <label className="form-label">
                                Theme <span style={{ fontSize: '0.7rem', background: '#f59e0b', color: 'black', padding: '2px 6px', borderRadius: '4px', marginLeft: '0.5rem' }}>COMING SOON</span>
                            </label>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button className="btn btn-primary" disabled>Dark</button>
                                <button className="btn btn-secondary" disabled>Light</button>
                            </div>
                        </div>

                        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button className="btn btn-primary" onClick={saveConfig} disabled={loading}>
                                {loading ? 'Saving...' : 'Save Appearance'}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'prompts' && (
                <div className="card">
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        📝 AI Prompt Engineering
                    </h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2rem', background: '#0f172a', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #3b82f6' }}>
                        <strong>Note:</strong> You can use variables like <code>&#123;job_description&#125;</code> or <code>&#123;resume_data&#125;</code> in your prompts.
                        Be careful with double curly braces <code>&#123;&#123; &#125;&#125;</code> if you need to output literal braces in JSON.
                    </p>

                    {Object.keys(promptLabels).map(key => (
                        <div key={key} className="form-group" style={{ marginBottom: '2rem' }}>
                            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>{promptLabels[key]}</span>
                                <code style={{ fontSize: '0.75rem', color: '#6366f1' }}>{key}</code>
                            </label>
                            <textarea
                                className="form-input"
                                style={{
                                    minHeight: '200px',
                                    fontFamily: 'monospace',
                                    fontSize: '0.85rem',
                                    lineHeight: '1.5',
                                    resize: 'vertical'
                                }}
                                value={prompts[key] || ''}
                                onChange={(e) => setPrompts({ ...prompts, [key]: e.target.value })}
                            />
                        </div>
                    ))}

                    <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button className="btn btn-secondary" onClick={fetchConfig}>Reset to Current</button>
                        <button className="btn btn-primary" onClick={saveConfig} disabled={loading}>
                            {loading ? 'Saving...' : 'Save All Prompts'}
                        </button>
                    </div>
                </div>
            )}

            {message && <p style={{
                position: 'fixed', bottom: '2rem', right: '2rem',
                backgroundColor: message.includes('❌') ? '#ef4444' : '#10b981',
                color: 'white', padding: '1rem 2rem', borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                zIndex: 3000,
                animation: 'slideIn 0.3s ease-out'
            }}>{message}</p>}


            {activeTab === 'about' && (
                <div>
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>ℹ️ About Resume Automator</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Privacy-first, AI-powered job application assistant.</p>
                        <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>How it works</h3>
                        <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', lineHeight: '1.7', margin: 0 }}>
                            <li style={{ marginBottom: '0.4rem' }}><strong>Tailor:</strong> AI analyzes your resume against a job description to highlight the best fit.</li>
                            <li style={{ marginBottom: '0.4rem' }}><strong>Refine:</strong> Review the suggested changes and make tweaks before exporting.</li>
                            <li style={{ marginBottom: '0.4rem' }}><strong>Cover Letter:</strong> A matching cover letter is generated automatically.</li>
                            <li style={{ marginBottom: '0.4rem' }}><strong>Save:</strong> Everything is stored locally in your private database — nothing leaves your machine.</li>
                        </ul>
                    </div>
                    <div className="card">
                        <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Open Source</h3>
                        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Built with ❤️ using React, FastAPI, and Docker.</p>
                    </div>
                </div>
            )}

            {/* Model Selection Modal */}
            {showModelModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000,
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        backgroundColor: '#1e293b',
                        width: '90%',
                        maxWidth: '500px',
                        borderRadius: '12px',
                        border: '1px solid #334155',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        maxHeight: '80vh'
                    }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#f8fafc' }}>Select Model</h2>
                            <button
                                onClick={() => setShowModelModal(false)}
                                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.5rem' }}
                            >
                                &times;
                            </button>
                        </div>

                        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Search models..."
                                value={modelSearch}
                                onChange={(e) => setModelSearch(e.target.value)}
                                autoFocus
                                style={{ marginBottom: '1rem', flexShrink: 0 }}
                            />

                            <div className="hide-scrollbar" style={{
                                overflowY: 'auto',
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                                paddingRight: '4px'
                            }}>
                                {availableModels
                                    .filter(m => !modelSearch || m.toLowerCase().includes(modelSearch.toLowerCase()))
                                    .map(m => (
                                        <button
                                            key={m}
                                            onClick={() => {
                                                setAiConfig({ ...aiConfig, model: m });
                                                setShowModelModal(false);
                                            }}
                                            style={{
                                                padding: '10px 12px',
                                                textAlign: 'left',
                                                backgroundColor: aiConfig.model === m ? '#334155' : 'transparent',
                                                border: 'none',
                                                color: '#f8fafc',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontSize: '0.9rem',
                                                transition: 'all 0.2s',
                                                flexShrink: 0
                                            }}
                                            onMouseEnter={(e) => {
                                                if (aiConfig.model !== m) e.target.style.backgroundColor = 'rgba(255,255,255,0.05)';
                                            }}
                                            onMouseLeave={(e) => {
                                                if (aiConfig.model !== m) e.target.style.backgroundColor = 'transparent';
                                            }}
                                        >
                                            {m}
                                        </button>
                                    ))
                                }
                                {availableModels.filter(m => !modelSearch || m.toLowerCase().includes(modelSearch.toLowerCase())).length === 0 && (
                                    <p style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No models match your search.</p>
                                )}
                            </div>
                        </div>

                        <div style={{ padding: '1rem', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary" onClick={() => setShowModelModal(false)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
