import React from 'react';
import { diffWords } from 'diff';
import './JobMatchStyles.css';

const ResumeScoringView = ({ diffData, scoreData, onPreview, onEdit, onFinalize }) => {
    // Safely extract scores
    const overallScore = scoreData?.overall_score || 0;
    const criteriaScores = scoreData?.criteria_scores || {};
    
    // Ensure coachingPlan is always an array to prevent .map crashes
    const rawCoachingPlan = scoreData?.coaching_plan || [];
    const coachingPlan = Array.isArray(rawCoachingPlan) 
        ? rawCoachingPlan 
        : (typeof rawCoachingPlan === 'string' ? [rawCoachingPlan] : []);

    const getScore = (key1, key2, key3) => {
        const check = (key) => {
            if (!key) return undefined;
            const val = criteriaScores[key];
            if (val !== undefined) return typeof val === 'object' ? (val.score || 0) : Number(val);
            return undefined;
        };
        return check(key1) ?? check(key2) ?? check(key3) ?? 0;
    };

    const criteriaList = [
        { label: 'Core Role Match', score: getScore('Core Role Fit', 'core_role'), max: 20 },
        { label: 'Experience Level', score: getScore('Experience Level', 'experience'), max: 20 },
        { label: 'Education & Certs', score: getScore('Education', 'education'), max: 20 },
        { label: 'Soft Skills', score: getScore('Soft Skills/Cultural', 'culture', 'soft_skills'), max: 20 },
        { label: 'ATS & Keywords', score: getScore('ATS Keywords', 'ats_keywords'), max: 20 },
    ];

    // Compute dimension percentages (each out of 20 typically)
    const getPercent = (score, max) => Math.round((score / max) * 100);

    const diffResult = React.useMemo(() => {
        if (!diffData?.original || !diffData?.tailored) {
            return {
                originalNodes: diffData?.original || "No original text available.",
                tailoredNodes: diffData?.tailored || "No tailored text available."
            };
        }
        const differences = diffWords(diffData.original, diffData.tailored);
        
        const originalNodes = differences.map((part, index) => {
            if (part.removed) {
                return <span key={index} className="bg-rose-500/20 text-rose-300 line-through px-0.5 rounded">{part.value}</span>;
            } else if (!part.added) {
                return <span key={index}>{part.value}</span>;
            }
            return null;
        });

        const tailoredNodes = differences.map((part, index) => {
            if (part.added) {
                return <span key={index} className="bg-emerald-500/20 text-emerald-300 font-bold px-0.5 rounded">{part.value}</span>;
            } else if (!part.removed) {
                return <span key={index}>{part.value}</span>;
            }
            return null;
        });

        return { originalNodes, tailoredNodes };
    }, [diffData]);

    return (
        <div className="job-match-bg text-slate-200 font-sans min-h-screen relative overflow-hidden py-12 px-8">
            <div className="fixed top-1/4 -right-24 w-96 h-96 bg-[#256af4]/10 rounded-full blur-[128px] pointer-events-none"></div>
            <div className="fixed bottom-0 -left-24 w-64 h-64 bg-rose-500/5 rounded-full blur-[96px] pointer-events-none"></div>

            <div className="max-w-[1400px] mx-auto relative z-10">
                {/* Header Actions */}
                <div className="flex justify-end gap-4 mb-4">
                    <button onClick={onPreview} className="job-match-glass px-6 py-3 rounded-xl flex items-center gap-2 text-slate-200 hover:bg-white/10 transition-all text-sm font-semibold border-[#256af4]/20">
                        <span className="material-symbols-outlined text-lg job-match-primary">visibility</span>
                        Preview Final
                    </button>
                    <button onClick={onEdit} className="job-match-glass px-6 py-3 rounded-xl flex items-center gap-2 text-slate-200 hover:bg-white/10 transition-all text-sm font-semibold border-[#256af4]/20">
                        <span className="material-symbols-outlined text-lg job-match-primary">edit_note</span>
                        Edit Tailored
                    </button>
                    <button onClick={onFinalize} className="job-match-primary-bg px-6 py-3 rounded-xl flex items-center gap-2 text-white hover:scale-[1.02] active:scale-95 transition-all text-sm font-semibold shadow-lg shadow-[#256af4]/20">
                        <span className="material-symbols-outlined text-lg">auto_fix_high</span>
                        Finalize Draft
                    </button>
                </div>

                <div className="grid grid-cols-12 gap-8">
                    {/* Left Column: Visual Diffing */}
                    <div className="col-span-12 lg:col-span-8 space-y-8">
                        <div>
                            <span className="text-[10px] uppercase tracking-[0.3em] job-match-primary mb-2 block font-bold">Analysis Workspace</span>
                            <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">Resume Compatibility</h1>
                            <p className="text-slate-400 max-w-xl">
                                Deep-diffing analysis between your baseline profile and the AI-optimized variant tailored for this specific role.
                            </p>
                        </div>
                        <div className="job-match-glass rounded-2xl overflow-hidden grid grid-cols-2">
                            {/* Base Header */}
                            <div className="p-4 border-b border-r border-white/5 bg-white/5">
                                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Base Resume</span>
                            </div>
                            {/* Tailored Header */}
                            <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                                <span className="text-[10px] uppercase tracking-widest font-bold job-match-primary">AI-Tailored Resume</span>
                                <span className="bg-[#256af4]/10 job-match-primary text-[10px] px-2 py-0.5 rounded border border-[#256af4]/20 font-bold">TAILORED DRAFT</span>
                            </div>
                            {/* Base Side */}
                            <div className="p-6 border-r border-white/5 bg-slate-900/20">
                                <div className="text-sm text-slate-400 whitespace-pre-wrap break-words font-mono relative">
                                    {diffResult.originalNodes}
                                </div>
                            </div>
                            {/* Tailored Side */}
                            <div className="p-6 bg-slate-900/40">
                                <div className="text-sm text-slate-200 whitespace-pre-wrap break-words font-mono relative">
                                    {diffResult.tailoredNodes}
                                </div>
                            </div>
                        </div>


                    </div>

                    {/* Right Column: Score Breakdown */}
                    <div className="col-span-12 lg:col-span-4 space-y-8">
                        {/* Score Widget */}
                        <div className="job-match-glass p-8 rounded-3xl relative overflow-hidden group">
                            <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#256af4]/20 rounded-full blur-3xl transition-transform group-hover:scale-150 duration-700"></div>
                            <div className="text-center relative z-10">
                                <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold mb-4 block">Overall Compatibility</span>
                                <div className="relative inline-flex items-center justify-center mb-6">
                                    <svg className="w-40 h-40 transform -rotate-90 overflow-visible" viewBox="0 0 160 160">
                                        <circle className="text-slate-800" cx="80" cy="80" fill="transparent" r="74" stroke="currentColor" strokeWidth="12"></circle>
                                        <circle className="text-[#256af4]" cx="80" cy="80" fill="transparent" r="74" stroke="currentColor" strokeDasharray="465" strokeDashoffset={465 - (465 * overallScore) / 100} strokeLinecap="round" strokeWidth="12" style={{ transition: 'stroke-dashoffset 1s ease-out' }}></circle>
                                    </svg>
                                    <div className="absolute flex flex-col items-center">
                                        <span className="text-5xl font-extrabold text-white job-match-neon">{overallScore}</span>
                                        <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">PERCENT</span>
                                    </div>
                                </div>
                                <div className="bg-[#256af4]/10 border border-[#256af4]/20 rounded-2xl p-4">
                                    <p className="text-xs text-slate-300 leading-relaxed italic">
                                        {overallScore >= 80 ? '"Excellent match! Your profile aligns strongly with the core requirements."' : overallScore >= 60 ? '"Good match. Some areas could be optimized for a better fit."' : '"Fair match. Significant tailoring recommended."'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Dimension Analysis */}
                        <div className="job-match-glass p-6 rounded-2xl">
                            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-6 flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">query_stats</span>
                                Dimension Analysis
                            </h3>
                            <div className="space-y-5">
                                {criteriaList.map((crit, idx) => {
                                    const pct = getPercent(crit.score, crit.max);
                                    return (
                                        <div key={idx}>
                                            <div className="flex justify-between items-center mb-1 text-[11px]">
                                                <span className="text-slate-100 font-bold">{crit.label} ({crit.max}pts)</span>
                                                <span className="job-match-primary">{crit.score}/{crit.max}</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-[#256af4] shadow-[0_0_8px_rgba(37,106,244,0.4)]" style={{ width: `${pct}%` }}></div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Job Playbook (Coaching Plan) */}
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                <span className="material-symbols-outlined job-match-primary">lightbulb</span>
                                AI Coaching Plan
                            </h2>
                            <div className="grid grid-cols-1 gap-6">
                                <div className="job-match-glass p-6 rounded-2xl">
                                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-4 flex justify-between items-center">
                                        Recommendations
                                    </h3>
                                    <div className="space-y-4">
                                        {coachingPlan.map((tip, idx) => (
                                            <div key={idx} className="flex gap-4 p-3 bg-white/5 rounded-xl border border-white/5">
                                                <span className="material-symbols-outlined text-rose-500 shrink-0">lightbulb</span>
                                                <div>
                                                    <p className="text-sm text-slate-200">
                                                        {typeof tip === 'object' ? (tip.advice || tip.suggestion || tip.text || JSON.stringify(tip)) : String(tip)}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                        {coachingPlan.length === 0 && (
                                            <p className="text-slate-500 text-sm">No specific coaching recommendations provided.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResumeScoringView;
