import React, { useState, useEffect } from 'react'
import './ProcessVisualization.css'

const ProcessVisualization = ({ mode = 'resume' }) => {
    const [stage, setStage] = useState(0)
    const [progressText, setProgressText] = useState('Initializing System...')
    const [binaryStream, setBinaryStream] = useState('010101')

    // Cycle through stages
    useEffect(() => {
        const resumeTimings = [
            { stage: 0, text: 'Ingesting Document Data...', duration: 2000 },
            { stage: 1, text: 'Analyzing Formatting & Structure...', duration: 2500 },
            { stage: 2, text: 'Extracting Job Requirements...', duration: 2000 },
            { stage: 3, text: 'AI Neural Optimization...', duration: 3000 },
            { stage: 4, text: 'Synthesizing Tailored Resume...', duration: 60000 }
        ]

        const coverLetterTimings = [
            // Skip stage 0 (Ingestion) as requested
            { stage: 1, text: 'Analyzing Career Context...', duration: 2000 },
            { stage: 2, text: 'Extracting Key Themes...', duration: 2000 },
            { stage: 3, text: 'Drafting Narrative Arc...', duration: 3000 },
            { stage: 4, text: 'Synthesizing Cover Letter...', duration: 60000 }
        ]

        const timings = mode === 'cover_letter' ? coverLetterTimings : (mode === 'profile_import' ? [
            { stage: 0, text: 'Mapping Personal Identity...', duration: 2000 },
            { stage: 1, text: 'Decoding Contact Topography...', duration: 2000 },
            { stage: 2, text: 'Harvesting Career Milestones...', duration: 2500 },
            { stage: 3, text: 'Neural Skill Extraction...', duration: 2500 },
            { stage: 4, text: 'Syncing to Professional Profile...', duration: 60000 }
        ] : resumeTimings)

        let currentIndex = 0
        const runStage = () => {
            if (currentIndex >= timings.length) return
            setStage(timings[currentIndex].stage)
            setProgressText(timings[currentIndex].text)

            setTimeout(() => {
                currentIndex++
                if (currentIndex < timings.length) {
                    runStage()
                }
            }, timings[currentIndex].duration)
        }
        runStage()

        // Binary stream effect interval
        const interval = setInterval(() => {
            setBinaryStream(Math.random().toString(2).substr(2, 8))
        }, 100)

        return () => clearInterval(interval)
    }, [mode])

    // Helper: Render Text Blocks for Construction Phase
    const renderConstructionBlocks = () => {
        return Array.from({ length: 14 }).map((_, i) => (
            <div
                key={i}
                className="text-block-appear"
                style={{
                    width: `${Math.random() * 60 + 30}%`,
                    animationDelay: `${i * 0.15}s`
                }}
            />
        ))
    }

    return (
        <div className="process-visualizer">
            {/* Dark Background Particles */}
            <div className="particles-bg">
                {Array.from({ length: 50 }).map((_, i) => (
                    <div
                        key={i}
                        className="bg-dot"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            width: `${Math.random() * 4 + 1}px`,
                            height: `${Math.random() * 4 + 1}px`,
                            animationDelay: `${Math.random() * 5}s`
                        }}
                    />
                ))}
            </div>

            <div className="visual-stage-container">
                <div key={stage} className="stage-content-wrapper fade-in-scale" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                    {/* Stage 0: Ingestion (Warp Tunnel) */}
                    {stage === 0 && (
                        <div className="stage-ingestion">
                            <div className="ingestion-portal"></div>
                            <div className="doc-flying">📄</div>
                        </div>
                    )}

                    {/* Stage 1 & 2: Analysis (Laser Scan) */}
                    {(stage === 1 || stage === 2) && (
                        <div className="stage-analysis">
                            <div className="analysis-node">
                                <div className="analysis-icon-circle">
                                    📄
                                    <div className="scan-line"></div>
                                </div>
                                <div className="analysis-label">RESUME</div>
                            </div>

                            <div className="binary-stream">
                                {binaryStream}
                            </div>

                            <div className="analysis-node">
                                <div className="analysis-icon-circle">
                                    💼
                                    <div className="scan-line" style={{ animationDelay: '0.5s', animationDirection: 'reverse' }}></div>
                                </div>
                                <div className="analysis-label">JOB</div>
                            </div>
                        </div>
                    )}

                    {/* Stage 3: AI Neural Net */}
                    {stage === 3 && (
                        <div className="stage-ai">
                            <div className="brain-core">🧠</div>
                            {/* Orbiting synapses */}
                            {[0, 60, 120, 180, 240, 300].map(deg => (
                                <div
                                    key={deg}
                                    className="synapse"
                                    style={{
                                        transform: `rotate(${deg}deg) translateX(60px)`,
                                        animation: `pulseNetwork 1s infinite ${deg % 2 === 0 ? 'ease-in' : 'ease-out'}`
                                    }}
                                />
                            ))}
                        </div>
                    )}

                    {/* Stage 4: Construction (Laser Printer) */}
                    {stage === 4 && (
                        <div className="stage-construction">
                            <div className="construction-doc">
                                <div className="construction-beam"></div>
                                {/* Header simulation */}
                                <div style={{ width: '100%', height: '40px', background: '#3b82f6', marginBottom: '10px', borderRadius: '4px' }}></div>
                                {/* Body simulation */}
                                {renderConstructionBlocks()}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Status Text - High Contrast */}
            <div key={progressText} className="process-status fade-in-scale">
                {progressText}
            </div>
        </div>
    )
}

export default ProcessVisualization
