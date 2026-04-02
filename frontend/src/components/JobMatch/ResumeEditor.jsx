import React from 'react';
import './JobMatchStyles.css';

const ResumeEditor = ({ pdfUrl, resumeData, refineInstructions, setRefineInstructions, onRegenerate, isRegenerating, onBack }) => {
    
    // Safely parse instructions incase prop is null/undefined
    const safeInstructions = typeof refineInstructions === 'string' ? refineInstructions : '';
    
    return (
        <div className="job-match-bg text-slate-200 font-sans min-h-screen overflow-hidden flex flex-col relative z-50">
            {/* Top Bar */}
            <header className="fixed top-0 w-full z-50 job-match-glass border-b border-white/10 flex justify-between items-center px-8 py-4 shadow-lg transition-all">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="flex items-center gap-2 hover:bg-white/10 p-2 rounded-xl transition-colors">
                        <span className="material-symbols-outlined text-slate-300">arrow_back</span>
                        <span className="font-bold text-slate-300">Back</span>
                    </button>
                    <span className="text-xl font-bold tracking-tight text-white">Midnight Editor</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 job-match-glass rounded-full text-sm">
                        <span className="material-symbols-outlined text-sm job-match-primary">auto_awesome</span>
                        <span className="text-slate-300 font-medium">AI Optimization Mode</span>
                    </div>
                </div>
            </header>

            <div className="flex pt-[72px] h-screen w-full">
                {/* Editor Panel (Left) */}
                <section className="w-full lg:w-1/2 p-8 overflow-y-auto job-match-scroll bg-[#0b0f18] flex flex-col h-full">
                    <div className="flex justify-between items-end mb-8">
                        <div>
                            <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">Editor</h1>
                            <p className="text-slate-400 text-sm">Refine your AI-tailored resume via instructions</p>
                        </div>
                    </div>

                    <div className="space-y-8 flex-1">
                        {/* Refinement Tool Section */}
                        <div className="job-match-glass p-6 rounded-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#256af4]/5 blur-3xl -z-10 transition-all group-hover:bg-[#256af4]/10"></div>
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-bold text-white job-match-neon flex items-center gap-2">
                                    <span className="material-symbols-outlined">edit_note</span> Prompt Tuning
                                </h2>
                            </div>
                            <div className="space-y-4">
                                <p className="text-sm text-slate-400">The underlying layout is built via Word templates. To make changes, describe exactly what you want the AI to rewrite, add, or remove, then regenerate.</p>
                                <textarea 
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl p-4 text-slate-300 text-sm focus:outline-none focus:border-[#256af4] focus:ring-1 focus:ring-[#256af4] transition-all min-h-[160px]" 
                                    placeholder="e.g. 'Shorten the summary', 'Add my experience with React to the PixelVault job', 'Make the tone more aggressive'..."
                                    value={safeInstructions}
                                    onChange={(e) => setRefineInstructions(e.target.value)}
                                />
                                <button 
                                    onClick={onRegenerate}
                                    disabled={isRegenerating || !safeInstructions.trim()}
                                    className="w-full job-match-primary-bg text-white px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                                >
                                    {isRegenerating ? <span className="material-symbols-outlined animate-spin text-lg">sync</span> : <span className="material-symbols-outlined text-lg">auto_awesome</span>}
                                    {isRegenerating ? 'Regenerating...' : 'Apply & Regenerate'}
                                </button>
                            </div>
                        </div>

                        {/* Read-only Data Section (To mimic the layout while exposing raw info) */}
                        <div className="job-match-glass p-6 rounded-2xl opacity-75">
                            <h2 className="text-lg font-bold text-white mb-4">Underlying Data Snapshot</h2>
                            <textarea 
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-slate-400 text-xs font-mono h-[300px]" 
                                readOnly
                                value={resumeData?.full_text || JSON.stringify(resumeData, null, 2)}
                            />
                        </div>
                    </div>
                </section>

                {/* Preview Panel (Right) */}
                <section className="hidden lg:flex w-1/2 p-8 flex-col items-center overflow-y-auto job-match-scroll relative bg-slate-900 border-l border-white/5">
                    <div className="absolute top-1/4 right-0 w-96 h-96 bg-[#256af4]/5 blur-[120px] rounded-full pointer-events-none"></div>
                    <div className="w-full max-w-[800px] mb-6 flex justify-between items-center px-4">
                        <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Live Document File</span>
                    </div>

                    {/* PDF Layout Mockup */}
                    <div className="w-full max-w-[800px] flex-1 bg-slate-800/50 rounded-lg overflow-hidden border border-white/10 relative shadow-2xl">
                         {pdfUrl ? (
                            <iframe 
                                src={`${pdfUrl}#toolbar=0&navpanes=0`} 
                                className="w-full h-[800px]"
                                title="Resume PDF Split"
                                style={{ background: 'white' }}
                            />
                        ) : (
                            <div className="text-slate-400 m-auto flex flex-col items-center mt-32">
                                <span className="material-symbols-outlined text-4xl mb-2">error</span>
                                <p>Preview not available right now.</p>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default ResumeEditor;
