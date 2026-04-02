import React from 'react';
import './JobMatchStyles.css';

const ResumePreview = ({ pdfUrl, onBack, onFinalize }) => {
    return (
        <div className="job-match-bg text-slate-200 font-sans min-h-screen overflow-hidden flex flex-col relative z-50">
            {/* Top Bar */}
            <header className="fixed top-0 w-full z-50 job-match-glass border-b border-white/10 flex justify-between items-center px-8 py-4 shadow-lg transition-all">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="flex items-center gap-2 hover:bg-white/10 p-2 rounded-xl transition-colors">
                        <span className="material-symbols-outlined text-slate-300">arrow_back</span>
                        <span className="font-bold text-slate-300">Back to Scoring</span>
                    </button>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-xl font-bold tracking-tight text-white">High-Fidelity Preview</span>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 mt-16 px-8 pb-12 overflow-y-auto relative p-8">
                {/* Atmospheric Ambient Background */}
                <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-[#256af4]/10 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
                <div className="fixed bottom-0 left-64 w-[300px] h-[300px] bg-rose-500/10 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

                <div className="max-w-[1000px] mx-auto">
                    <div className="flex justify-between items-end mb-8">
                        <div>
                            <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">Resume Preview</h1>
                            <p className="text-slate-400">Review your final document formatting</p>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={onFinalize} className="px-8 py-3 rounded-xl job-match-primary-bg text-white font-bold shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2">
                                Continue Application
                                <span className="material-symbols-outlined text-sm">arrow_forward</span>
                            </button>
                        </div>
                    </div>

                    {/* Viewer Wrapper */}
                    <div className="job-match-glass rounded-2xl overflow-hidden flex flex-col shadow-2xl" style={{ height: '75vh' }}>
                        <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-slate-900/60 backdrop-blur-md">
                            <span className="text-xs font-bold text-slate-500 tracking-widest uppercase">Document Viewer</span>
                            <div className="flex items-center gap-2">
                                <a href={pdfUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold bg-white/10 text-white hover:bg-white/20 rounded-lg transition-all uppercase tracking-widest">
                                    <span className="material-symbols-outlined text-lg">download</span>
                                    Download PDF
                                </a>
                            </div>
                        </div>

                        {/* PDF Area */}
                        <div className="flex-1 bg-slate-400/20 p-4 md:p-8 flex justify-center relative overflow-hidden">
                            {pdfUrl ? (
                                <iframe 
                                    src={`${pdfUrl}#toolbar=0&navpanes=0`} 
                                    className="w-full max-w-[850px] h-full shadow-2xl rounded"
                                    title="Resume PDF"
                                    style={{ background: 'white' }}
                                />
                            ) : (
                                <div className="text-slate-400 m-auto flex flex-col items-center">
                                    <span className="material-symbols-outlined text-4xl mb-2">error</span>
                                    <p>Preview not available right now.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ResumePreview;
