import { useState, useEffect, useCallback } from 'react'
import ProcessVisualization from '../ProcessVisualization'
import DiffViewer from '../DiffViewer'
import ResumeScoringView from '../components/JobMatch/ResumeScoringView'
import ResumePreview from '../components/JobMatch/ResumePreview'
import ResumeEditor from '../components/JobMatch/ResumeEditor'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function NewApplication({ onComplete }) {
    // Navigation State
    const [appStage, setAppStage] = useState('upload') // 'upload', 'resume_review', 'cover_letter_review'

    const [duplicateApp, setDuplicateApp] = useState(null)

    // Data State
    const [resumeFile, setResumeFile] = useState(null)
    const [jobDescription, setJobDescription] = useState('')
    const [jobUrl, setJobUrl] = useState('')
    const [inputMode, setInputMode] = useState('text')
    const [extensionMetadata, setExtensionMetadata] = useState(null)

    const [configDefaults, setConfigDefaults] = useState({})
    const [userProfile, setUserProfile] = useState(null)
    const [contextDocs, setContextDocs] = useState([]) // { file/path, isProfile: bool, selected: bool, label: string, id: string }
    const [extractedContext, setExtractedContext] = useState("")
    const [uploadingContextDoc, setUploadingContextDoc] = useState(false)

    const fetchConfigDefaults = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/config`)
            if (!res.ok) return {}
            const data = await res.json()
            setConfigDefaults(data)
            return data
        } catch (err) {
            console.error("Failed to fetch config", err)
            return {}
        }
    }, [])

    const initializeContextDocs = useCallback((data) => {
        let profileDocs = []
        if (data.long_form_resume_path) {
            profileDocs.push({
                path: data.long_form_resume_path,
                label: 'Long-Form Resume',
                isProfile: true,
                selected: true,
                id: 'long_form_profile'
            })
        }
        if (data.additional_docs) {
            profileDocs = [
                ...profileDocs,
                ...data.additional_docs.map(doc => ({
                    path: doc.path,
                    label: doc.label || doc.filename,
                    isProfile: true,
                    selected: true,
                    id: doc.path
                }))
            ]
        }
        return profileDocs
    }, [])

    const fetchProfile = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/profile`)
            if (res.ok) {
                const data = await res.json()
                setUserProfile(data)
                // Initialize context docs from profile
                setContextDocs(initializeContextDocs(data))
            }
        } catch (err) {
            console.error("Failed to fetch profile", err)
        }
    }, [initializeContextDocs])

    // Process State
    const [isProcessing, setIsProcessing] = useState(false)
    const [processingMode, setProcessingMode] = useState('resume') // 'resume' or 'cover_letter'
    const [error, setError] = useState(null)
    const [isDragging, setIsDragging] = useState(false)

    // Results State
    const [result, setResult] = useState(null) // Resume Result
    const [coverLetterResult, setCoverLetterResult] = useState(null) // Cover Letter Result
    const [coverLetterChanges, setCoverLetterChanges] = useState([]) // Track refinement history
    const [matchScoreResult, setMatchScoreResult] = useState(null) // Match Score Result

    // UI State
    const [refineInstructions, setRefineInstructions] = useState('')
    const [resumeInstructions, setResumeInstructions] = useState('')
    const [clInstructions, setClInstructions] = useState('')
    const [viewMode, setViewMode] = useState('pdf') // 'pdf', 'redline'
    const [missingInfo, setMissingInfo] = useState({ show: false, fields: [], inputs: {} })

    useEffect(() => {
        fetchProfile()
        
        // First check for extension data
        const extDataStr = sessionStorage.getItem('extensionJobData')
        if (extDataStr) {
            try {
                const extData = JSON.parse(extDataStr)
                sessionStorage.removeItem('extensionJobData') // Clear it so it only runs once
                setExtensionMetadata(extData)
                
                // Set form state based on extension
                if (extData.id) {
                    // It's an existing app, use the text mode with description we already have
                    if (extData.description) {
                        setJobDescription(extData.description)
                        setInputMode('text')
                    } else if (extData.link) {
                        setJobUrl(extData.link)
                        setInputMode('url')
                    }
                } else if (extData.link) {
                    setJobUrl(extData.link)
                    setInputMode('url')
                } else if (extData.description) {
                    setJobDescription(extData.description)
                    setInputMode('text')
                }
                
                // Start processing after a brief delay to ensure state updates
                setTimeout(() => {
                    document.getElementById('start-new-app-form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
                }, 500)
                
                return;
            } catch(e) { console.error("Ext parse error", e) }
        }

        fetchConfigDefaults()
    }, [fetchConfigDefaults, fetchProfile])

    // --- Handlers ---

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0]
        if (file && file.name.endsWith('.docx')) {
            setResumeFile(file)
            setError(null)
        } else {
            setError('Please select a .docx file')
        }
    }

    const handleDrop = (e) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files?.[0]
        if (file && file.name.endsWith('.docx')) {
            setResumeFile(file)
            setError(null)
        } else {
            setError('Please select a .docx file')
        }
    }

    const handleDragOver = (e) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = () => {
        setIsDragging(false)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        // No longer strictly need a resume file if Base Resume exists in profile
        if (!resumeFile && !userProfile?.base_resume_path) {
             return setError('Please upload a resume or set a Base Resume in your profile')
        }

        // Resolve effective defaults at submit time (in case UI didn't populate)
        const effectiveJobUrl = jobUrl?.trim() || ''

        if (inputMode === 'text' && !jobDescription.trim()) return setError('Please enter a job description')
        if (inputMode === 'url' && !effectiveJobUrl.trim()) return setError('Please enter a job URL')

        // Keep the UI in sync with what we'll send
        if (effectiveJobUrl && inputMode === 'url') setJobUrl(effectiveJobUrl)

        // CHECK DUPLICATE
        if (inputMode === 'url' && !extensionMetadata?.id) {
            try {
                const checkRes = await fetch(`${API_URL}/api/check-job-url?url=${encodeURIComponent(effectiveJobUrl)}`)
                if (checkRes.ok) {
                    const checkData = await checkRes.json()
                    if (checkData.exists) {
                        // Support new API format: { exists: true, application: {...} }
                        const appData = checkData.application || checkData
                        setDuplicateApp({
                            job_title: appData.job_title,
                            application_id: appData.id || checkData.application_id,
                        })
                        return // STOP here and wait for user choice
                    }
                }
            } catch (ignore) { console.warn("Duplicate check failed", ignore) }
        }

        startProcessing()
    }

    const startProcessing = async () => {
        setIsProcessing(true)
        setProcessingMode('resume')
        setError(null)
        setResult(null)
        setDuplicateApp(null) // clear duplicate state just in case
        setViewMode('pdf')

        try {
            const formData = new FormData()
            if (resumeFile) {
                formData.append('resume', resumeFile)
            } else if (userProfile?.base_resume_path) {
                // If no file is uploaded but a base resume exists, tell the backend to use it
                formData.append('use_base_resume', 'true')
            }

            if (inputMode === 'text') formData.append('job_description', jobDescription)
            else {
                formData.append('job_url', jobUrl?.trim() || '')
            }

            // Additional Context
            const profilePaths = contextDocs
                .filter(d => d.isProfile && d.selected)
                .map(d => d.path)
            
            if (profilePaths.length > 0) {
                formData.append('additional_context_paths', JSON.stringify(profilePaths))
            }

            const uploadedFiles = contextDocs
                .filter(d => !d.isProfile && d.selected)
                .map(d => d.file)
            
            uploadedFiles.forEach(file => {
                formData.append('additional_files', file)
            })

            formData.append('instructions', resumeInstructions)

            const response = await fetch(`${API_URL}/api/tailor-resume`, {
                method: 'POST',
                body: formData,
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.detail || 'Failed to tailor resume')
            }
            
            const data = await response.json()
            setResult(data)
            setExtractedContext(data.extracted_context || "")
            setRefineInstructions('')
            setViewMode('redline')

            // Generate Job Match Score based on the tailored resume
            setProcessingMode('resume')
            try {
                const tailoredText = data.resume_data?.full_text ? data.resume_data.full_text.join('\n') : "";
                const matchFormData = new FormData()
                matchFormData.append('tailored_resume_text', tailoredText)
                if (resumeFile) matchFormData.append('resume', resumeFile)
                else if (userProfile?.base_resume_path) matchFormData.append('use_base_resume', 'true')
                
                if (inputMode === 'text') matchFormData.append('job_description', jobDescription)
                else matchFormData.append('job_url', jobUrl?.trim() || '')
                
                const matchResponse = await fetch(`${API_URL}/api/score-job-match`, {
                    method: 'POST',
                    body: matchFormData,
                })
                if (matchResponse.ok) {
                    const matchData = await matchResponse.json()
                    setMatchScoreResult(matchData)
                }
            } catch (scoreErr) {
                console.warn('Scoring failed, continuing anyway:', scoreErr)
            }
            
            setAppStage('match_scoring')
        } catch (err) {
            setError(err.message || 'An error occurred while processing your resume')
        } finally {
            setIsProcessing(false)
        }
    }

    // ... (rest of handlers)

    const handleRefineResume = async () => {
        if (!refineInstructions.trim()) return
        setIsProcessing(true)
        setError(null)
        try {
            const response = await fetch(`${API_URL}/api/refine-resume`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    current_resume_data: result.resume_data,
                    instructions: refineInstructions,
                    original_filename: result.original_filename,
                    additional_context: extractedContext
                })
            })
            if (!response.ok) throw new Error('Refinement failed')
            const data = await response.json()
            setResult(data)
            setRefineInstructions('')
            setViewMode('redline')
        } catch (err) {
            setError(err.message)
        } finally {
            setIsProcessing(false)
        }
    }

    const handleAcceptResume = async () => {
        setIsProcessing(true)
        setProcessingMode('cover_letter')
        setError(null)
        try {
            // Prepare payload
            const resumeText = result.resume_data.full_text ? result.resume_data.full_text.join('\n') : "Unknown Resume Text"
            const jobText = inputMode === 'text' ? jobDescription : `Job URL: ${jobUrl}`

            const res = await fetch(`${API_URL}/api/generate-cover-letter`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resume_text: resumeText,
                    job_description: jobText,
                    base_filename: result.original_filename,
                    additional_context: extractedContext,
                    instructions: clInstructions
                })
            })

            if (!res.ok) throw new Error("Failed to generate cover letter")
            const data = await res.json()
            setCoverLetterResult(data)

            // Check for missing info
            if (data.missing_fields && data.missing_fields.length > 0) {
                setMissingInfo({
                    show: true,
                    fields: data.missing_fields,
                    inputs: {}
                })
            }

            setAppStage('cover_letter_review')
            setRefineInstructions('') // Clear for next stage
        } catch (e) {
            setError(e.message)
        } finally {
            setIsProcessing(false)
        }
    }

    const handleRefineCoverLetter = async (manualInstructions = null) => {
        const instructionsToUse = typeof manualInstructions === 'string' ? manualInstructions : refineInstructions
        if (!instructionsToUse?.trim()) return
        setIsProcessing(true)
        try {
            const res = await fetch(`${API_URL}/api/refine-cover-letter`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: coverLetterResult.content,
                    instructions: instructionsToUse,
                    base_filename: result.original_filename,
                    additional_context: extractedContext
                })
            })
            if (!res.ok) throw new Error("Refinement failed")
            const data = await res.json()
            setCoverLetterResult(data)

            // Track this change
            setCoverLetterChanges(prev => [...prev, `Refinement: "${instructionsToUse}"`])

            if (typeof manualInstructions !== 'string') setRefineInstructions('')
        } catch (e) {
            setError(e.message)
        } finally {
            setIsProcessing(false)
        }
    }

    const handleAcceptApplication = async () => {
        try {
            // Extract metadata if available
            const metadata = result.job_metadata || {}

            // Combine automated insights with manual refinements
            const coverLetterInsights = [
                ...(coverLetterResult?.generation_summary || []),
                ...coverLetterChanges
            ]
            const payload = {
                application_id: extensionMetadata?.id || duplicateApp?.application_id || null,
                job_title: extensionMetadata?.title || metadata.job_title || "Unknown Role",
                company: extensionMetadata?.company || metadata.company || "Unknown Company",
                job_url: extensionMetadata?.link || result.job_url || (inputMode === 'url' ? jobUrl : ""),
                apply_url: extensionMetadata?.applyLink || metadata.apply_url || "",
                job_description: extensionMetadata?.description || result.job_description || (inputMode === 'text' ? jobDescription : "No description captured"),
                match_score: matchScoreResult?.overall_score || null,
                match_details: matchScoreResult || null,
                original_resume_path: resumeFile ? resumeFile.name : (userProfile?.base_resume_path ? userProfile.base_resume_path.split('/').pop() : "Default Resume"),
                tailored_resume_path: result.files.docx.split('/').pop(),
                cover_letter_path: coverLetterResult?.files?.docx ? coverLetterResult.files.docx.split('/').pop() : "",
                resume_data: result.resume_data,
                cover_letter_text: coverLetterResult?.content || "",
                salary_range: extensionMetadata?.salaryRange || metadata.salary_range || "",
                date_posted: extensionMetadata?.datePosted || metadata.date_posted || "",
                deadline: extensionMetadata?.deadline || metadata.deadline || "",
                job_type: extensionMetadata?.jobType || metadata.job_type || "Full-time",
                location_type: extensionMetadata?.locationType || metadata.location_type || "On-site",
                location: extensionMetadata?.location || metadata.location || "",
                relocation: (extensionMetadata?.relocation !== undefined && extensionMetadata?.relocation !== null) ? extensionMetadata.relocation : (metadata.relocation !== undefined ? metadata.relocation : null),
                interest_level: extensionMetadata?.interestLevel || metadata.interest_level || null,
                remarks: extensionMetadata?.remarks || metadata.remarks || "",
                resume_changes_summary: result.change_summary || [],
                cover_letter_changes_summary: coverLetterInsights,
                status: 'Generated',
                pipeline_stage: 'generated',
                glassdoor_rating: metadata.glassdoor_rating || null,
                glassdoor_url: metadata.glassdoor_url || null,
                indeed_rating: metadata.indeed_rating || null,
                indeed_url: metadata.indeed_url || null,
                linkedin_rating: metadata.linkedin_rating || null,
                linkedin_url: metadata.linkedin_url || null,
                profile_snapshot: {
                    profile: userProfile,
                    context_docs: contextDocs.filter(d => d.selected).map(d => ({
                        label: d.label,
                        filename: d.filename || (d.file ? d.file.name : null) || d.path?.split('/').pop(),
                        path: d.path,
                        isProfile: d.isProfile
                    }))
                }
            }


            console.log("DEBUG PAYLOAD:", payload) // Debugging

            await fetch(`${API_URL}/api/save-application`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            // Notify parent that we are done
            onComplete()

            // Notify extension via custom event (caught by content script)
            window.dispatchEvent(new CustomEvent('JOB_KERNEL_APP_UPDATED', { 
                detail: { 
                    application_id: extensionMetadata?.id || duplicateApp?.application_id || payload.application_id 
                } 
            }));
        } catch (e) {
            setError("Failed to save application: " + e.message)
        }
    }

    const handleDownload = (format, isCoverLetter = false) => {
        const data = isCoverLetter ? coverLetterResult : result
        if (data?.files?.[format]) {
            window.open(`${API_URL}${data.files[format]}`, '_blank')
        }
    }

    const handleStartOver = () => {
        setResumeFile(null)
        setJobDescription('')
        setJobUrl('')
        setResult(null)
        setCoverLetterResult(null)
        setMatchScoreResult(null)
        setError(null)
        setAppStage('upload')
        setViewMode('pdf')
        setExtractedContext("")
        setRefineInstructions('')
        setResumeInstructions('')
        setClInstructions('')
        setMissingInfo({ show: false, fields: [], inputs: {} })
        setContextDocs(userProfile ? initializeContextDocs(userProfile) : [])

        setExtensionMetadata(null)
        setInputMode('text') // Reset to text mode as well for clean slate
    }

    const handleSubmitMissingInfo = () => {
        const inputs = missingInfo.inputs
        let instructions = "Please update the cover letter header/addressing with the following information:\n"
        let hasUpdates = false

        if (inputs.company_address) {
            instructions += `Company Info/Address: ${inputs.company_address}\n`
            hasUpdates = true
        }
        if (inputs.recruiter_name) {
            instructions += `Recruiter Name: ${inputs.recruiter_name}\n`
            hasUpdates = true
        }

        if (hasUpdates) {
            handleRefineCoverLetter(instructions)
        }

        setMissingInfo({ show: false, fields: [], inputs: {} })
    }

    // --- LAYOUTS ---

    // 1. Processing Visualization
    if (isProcessing) {
        return <div style={{ height: '100%', width: '100%' }}><ProcessVisualization mode={processingMode} /></div>
    }

    // Common Header Logic for Review Views
    const ReviewHeader = ({ title }) => (
        <header style={{
            height: '60px',
            padding: '0 2rem',
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--border-color-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    {title}
                </h1>
            </div>
            <button onClick={handleStartOver} className="btn-util">
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>restart_alt</span>
                Restart
            </button>
        </header>
    )

    // 2.5 Match Scoring View
    if (appStage === 'match_scoring') {
        const diffData = result?.diff_data || { original: '', tailored: '' };
        return (
            <ResumeScoringView 
                diffData={diffData} 
                scoreData={matchScoreResult || {}} 
                onPreview={() => setAppStage('resume_preview')}
                onEdit={() => setAppStage('resume_edit')}
                onFinalize={handleAcceptResume}
            />
        )
    }

    // 2.6 High Fidelity Resume Preview
    if (appStage === 'resume_preview') {
        return (
            <ResumePreview 
                pdfUrl={result?.files?.pdf ? `${API_URL}${result.files.pdf}` : null}
                onBack={() => setAppStage('match_scoring')}
                onFinalize={handleAcceptResume}
            />
        )
    }

    // 2.7 Resume Visual Editor
    if (appStage === 'resume_edit') {
        return (
            <ResumeEditor 
                pdfUrl={result?.files?.pdf ? `${API_URL}${result.files.pdf}` : null}
                resumeData={result?.resume_data}
                diffData={result?.diff_data}
                refineInstructions={refineInstructions}
                setRefineInstructions={setRefineInstructions}
                onRegenerate={handleRefineResume}
                isRegenerating={isProcessing}
                onBack={() => setAppStage('match_scoring')}
            />
        )
    }

    // 3. Cover Letter Review
    if (appStage === 'cover_letter_review' && coverLetterResult) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)' }}>
                <ReviewHeader title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '1.4rem' }}>mail</span>
                        Cover Letter Review
                    </div>
                } />

                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {/* LEFT: Preview */}
                    <div style={{ flex: 1, padding: '1rem', background: '#e5e7eb', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                        {error && (
                            <div style={{
                                position: 'absolute', top: '1rem', left: '1rem', right: '1rem', zIndex: 10,
                                background: '#fee2e2', border: '1px solid #ef4444', color: '#b91c1c',
                                padding: '1rem', borderRadius: '0.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                            }}>
                                <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: '0.4rem', fontSize: '1.2rem' }}>warning</span><strong>Error: </strong> {error}
                            </div>
                        )}

                        {/* MISSING INFO MODAL (For Cover Letter Stage) */}
                        {missingInfo.show && (
                            <div style={{
                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                background: 'rgba(0,0,0,0.85)', zIndex: 9999,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                backdropFilter: 'blur(4px)'
                            }}>
                                <div style={{
                                    background: 'var(--bg-card)', padding: '2rem', borderRadius: '1rem',
                                    border: '1px solid var(--border-color)', maxWidth: '500px', width: '90%',
                                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
                                }}>
                                    <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>help_outline</span>
                                        Missing Information
                                    </h2>
                                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                                        The AI identified some missing details. Please provide them for a complete cover letter, or skip to use generic placeholders.
                                    </p>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                                        {missingInfo.fields.includes('recruiter_name') && (
                                            <div>
                                                <label className="form-label" style={{ marginBottom: '0.5rem' }}>Recruiter Name</label>
                                                <input
                                                    className="form-input"
                                                    placeholder="e.g. Jane Doe"
                                                    value={missingInfo.inputs.recruiter_name || ''}
                                                    onChange={e => setMissingInfo(prev => ({
                                                        ...prev,
                                                        inputs: { ...prev.inputs, recruiter_name: e.target.value }
                                                    }))}
                                                />
                                            </div>
                                        )}
                                        {missingInfo.fields.includes('company_address') && (
                                            <div>
                                                <label className="form-label" style={{ marginBottom: '0.5rem' }}>Company Address</label>
                                                <input
                                                    className="form-input"
                                                    placeholder="e.g. 123 Tech Blvd, San Francisco, CA"
                                                    value={missingInfo.inputs.company_address || ''}
                                                    onChange={e => setMissingInfo(prev => ({
                                                        ...prev,
                                                        inputs: { ...prev.inputs, company_address: e.target.value }
                                                    }))}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                                        <button className="btn btn-primary" onClick={handleSubmitMissingInfo} style={{ flex: 1, justifyContent: 'center' }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', marginRight: '0.4rem' }}>auto_awesome</span>
                                            Update Letter
                                        </button>
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => setMissingInfo({ show: false, fields: [], inputs: {} })}
                                            style={{ flex: 1, justifyContent: 'center', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)' }}
                                        >
                                            Skip
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div style={{ flex: 1, background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                            <iframe
                                src={`${API_URL}${coverLetterResult.files.pdf}?t=${Date.now()}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                                style={{ width: '100%', height: '100%', border: 'none' }}
                                title="Cover Letter Preview"
                            />
                        </div>
                    </div>

                    {/* RIGHT: Sidebar */}
                    <div style={{ width: '380px', background: 'var(--bg-card)', borderLeft: '1px solid var(--border-color-card)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
                        {/* Refinement */}
                        <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid var(--border-color-card)' }}>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>edit_note</span>
                                Tweak Cover Letter
                            </h3>
                            <textarea
                                className="form-textarea"
                                placeholder="E.g., 'Make it more persuasive', 'Focus on leadership'..."
                                value={refineInstructions}
                                onChange={(e) => setRefineInstructions(e.target.value)}
                                style={{ minHeight: '80px', fontSize: '0.9rem', marginBottom: '0.75rem', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                            />
                            <button className="btn btn-primary" onClick={handleRefineCoverLetter} disabled={!refineInstructions.trim()} style={{ width: '100%', gap: '0.4rem' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>auto_awesome</span>
                                Refine
                            </button>
                        </div>

                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                            <button className="btn-util" onClick={() => handleDownload('docx', true)} style={{ gap: '0.4rem' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>download</span>
                                Download Word
                            </button>
                            <button className="btn-util" onClick={() => handleDownload('pdf', true)} style={{ gap: '0.4rem' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>picture_as_pdf</span>
                                Download PDF
                            </button>
                            <button className="btn-util" onClick={() => handleDownload('txt', true)} style={{ gap: '0.4rem' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>description</span>
                                Download Text
                            </button>
                        </div>

                        <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <button className="btn btn-primary" onClick={handleAcceptApplication} style={{ width: '100%', fontSize: '1.1rem', padding: '1rem', gap: '0.6rem' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.4rem' }}>check_circle</span>
                                Accept Application
                            </button>
                            <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Saves packet to database and returns to Dashboard</p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Legacy resume review replaced via appStage === 'match_scoring', 'resume_preview', 'resume_edit'

    // 5. Upload View (Standard)
    return (
        <div style={{ height: '100%', overflowY: 'auto', position: 'relative' }}>

            {/* DUPLICATE MODAL */}
            {duplicateApp && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.85)', zIndex: 9999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        background: 'var(--bg-card)', padding: '2rem', borderRadius: '1rem',
                        border: '1px solid var(--border-color)', maxWidth: '500px', width: '90%',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
                    }}>
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span className="material-symbols-outlined" style={{ color: '#fbbf24' }}>warning</span>
                                    Duplicate Application
                                </h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.6' }}>
                            You have already created an application for <strong>{duplicateApp.job_title}</strong>.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <button className="btn btn-primary" onClick={() => onComplete()} style={{ padding: '0.8rem', justifyContent: 'center', gap: '0.5rem' }}>
                                <span className="material-symbols-outlined">visibility</span>
                                View Existing Application
                            </button>

                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button className="btn btn-secondary" onClick={startProcessing} style={{ flex: 1, justifyContent: 'center', gap: '0.5rem' }}>
                                    <span className="material-symbols-outlined">arrow_forward</span>
                                    Proceed
                                </button>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setDuplicateApp(null)}
                                    style={{ flex: 1, justifyContent: 'center', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)' }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MISSING INFO MODAL */}
            {missingInfo.show && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.85)', zIndex: 9999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        background: 'var(--bg-card)', padding: '2rem', borderRadius: '1rem',
                        border: '1px solid var(--border-color)', maxWidth: '500px', width: '90%',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
                    }}>
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>edit_note</span>
                            Missing Information
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                            The AI identified some missing details. Please provide them for a complete cover letter, or skip to use generic placeholders.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                            {missingInfo.fields.includes('recruiter_name') && (
                                <div>
                                    <label className="form-label" style={{ marginBottom: '0.5rem' }}>Recruiter Name</label>
                                    <input
                                        className="form-input"
                                        placeholder="e.g. Jane Doe"
                                        value={missingInfo.inputs.recruiter_name || ''}
                                        onChange={e => setMissingInfo(prev => ({
                                            ...prev,
                                            inputs: { ...prev.inputs, recruiter_name: e.target.value }
                                        }))}
                                    />
                                </div>
                            )}
                            {missingInfo.fields.includes('company_address') && (
                                <div>
                                    <label className="form-label" style={{ marginBottom: '0.5rem' }}>Company Address</label>
                                    <input
                                        className="form-input"
                                        placeholder="e.g. 123 Tech Blvd, San Francisco, CA"
                                        value={missingInfo.inputs.company_address || ''}
                                        onChange={e => setMissingInfo(prev => ({
                                            ...prev,
                                            inputs: { ...prev.inputs, company_address: e.target.value }
                                        }))}
                                    />
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button className="btn btn-primary" onClick={handleSubmitMissingInfo} style={{ flex: 1, justifyContent: 'center', gap: '0.5rem' }}>
                                <span className="material-symbols-outlined">auto_awesome</span>
                                Update Letter
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setMissingInfo({ show: false, fields: [], inputs: {} })}
                                style={{ flex: 1, justifyContent: 'center', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)' }}
                            >
                                Skip
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <header className="header" style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '2.8rem', color: 'var(--primary)' }}>auto_awesome</span>
                    Resume Automator
                </h1>
                <p>Tailor your resume to any job description with AI-powered optimization</p>
            </header>
            <div className="container" style={{ maxWidth: '800px' }}>
                {error && <div className="alert alert-error"><span className="material-symbols-outlined">warning</span><span>{error}</span></div>}
                <div className="card">
                    <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>description</span>
                        Start New Application
                    </h2>
                    <form id="start-new-app-form" onSubmit={handleSubmit}>
                        {/* Target Resume */}
                        <div className="bg-white dark:bg-slate-800/50 rounded-3xl p-8 border border-slate-200/60 dark:border-slate-700/50 shadow-xl shadow-slate-200/20 dark:shadow-none mb-8">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Target Resume</h3>
                            <div 
                                className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                                    isDragging ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                }`}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                <input
                                    type="file"
                                    id="resume-upload"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={handleFileSelect}
                                    accept=".docx"
                                />
                                <div className="space-y-4">
                                    <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400">
                                        <span className="material-symbols-outlined" style={{ fontSize: '2rem' }}>upload_file</span>
                                    </div>
                                    <div>
                                        <p className="text-lg font-medium text-slate-900 dark:text-white">
                                            {resumeFile ? resumeFile.name : (userProfile?.base_resume_path ? `Using Base Resume: ${userProfile.base_resume_path.split('/').pop()}` : 'Upload your resume')}
                                        </p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                            {resumeFile ? 'Click or drag to replace' : (userProfile?.base_resume_path ? 'Click or drag to override with a different file' : 'Drag and drop your .docx resume here')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Additional AI Context Documents */}
                        <div className="bg-white dark:bg-slate-800/50 rounded-3xl p-8 border border-slate-200/60 dark:border-slate-700/50 shadow-xl shadow-slate-200/20 dark:shadow-none mb-8">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Additional AI Context Documents</h3>
                                <label className="cursor-pointer bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2">
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>add</span>
                                    Attach New
                                    <input 
                                        type="file" 
                                        className="hidden" 
                                        accept=".docx,.txt,.pdf" 
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                setContextDocs(prev => [...prev, {
                                                    file,
                                                    label: file.name,
                                                    isProfile: false,
                                                    selected: true,
                                                    id: Math.random().toString(36).substr(2, 9)
                                                }]);
                                            }
                                        }}
                                    />
                                </label>
                            </div>

                            <div className="space-y-3">
                                {contextDocs.length === 0 ? (
                                    <p className="text-sm text-slate-500 dark:text-slate-400 italic">No additional context documents selected.</p>
                                ) : (
                                    contextDocs.map((doc) => (
                                        <div key={doc.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${doc.selected ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '1.4rem' }}>description</span>
                                                </div>
                                                <span className={`font-medium ${doc.selected ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 line-through'}`}>
                                                    {doc.label} {doc.isProfile && <span className="text-[10px] uppercase tracking-wider bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded ml-2">Profile</span>}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={() => setContextDocs(prev => prev.map(d => d.id === doc.id ? {...d, selected: !d.selected} : d))}
                                                    className={`p-2 rounded-xl transition-all ${doc.selected ? 'text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                                >
                                                    {doc.selected ? (
                                                        <span className="material-symbols-outlined">check_circle</span>
                                                    ) : (
                                                        <span className="material-symbols-outlined">check_circle_outline</span>
                                                    )}
                                                </button>
                                                <button 
                                                    onClick={() => setContextDocs(prev => prev.filter(d => d.id !== doc.id))}
                                                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
                                                >
                                                    <span className="material-symbols-outlined">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* AI Generation Instructions */}
                        <div className="bg-white dark:bg-slate-800/50 rounded-3xl p-8 border border-slate-200/60 dark:border-slate-700/50 shadow-xl shadow-slate-200/20 dark:shadow-none mb-8">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6">AI Generation Preferences</h3>
                            <div className="space-y-6">
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">Resume Tailoring Instructions</label>
                                    <textarea 
                                        className="form-textarea" 
                                        style={{ minHeight: '80px', fontSize: '0.9rem' }}
                                        placeholder="e.g. 'Focus on my leadership experience', 'Emphasize my cloud architecture skills'..." 
                                        value={resumeInstructions} 
                                        onChange={(e) => setResumeInstructions(e.target.value)} 
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">Cover Letter Writing Instructions</label>
                                    <textarea 
                                        className="form-textarea" 
                                        style={{ minHeight: '80px', fontSize: '0.9rem' }}
                                        placeholder="e.g. 'Keep it under 250 words', 'Highlight my passion for sustainable energy'..." 
                                        value={clInstructions} 
                                        onChange={(e) => setClInstructions(e.target.value)} 
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Job Description</label>
                            <div className="grid grid-cols-2 gap-4 mb-2">
                                <button type="button" className={`btn ${inputMode === 'text' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setInputMode('text')} style={{ gap: '0.4rem' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>edit_note</span>
                                    Paste Text
                                </button>
                                <button type="button" className={`btn ${inputMode === 'url' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setInputMode('url')} style={{ gap: '0.4rem' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>link</span>
                                    From URL
                                </button>
                            </div>
                            {inputMode === 'text' ? (
                                <textarea className="form-textarea" placeholder="Paste job description..." value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
                            ) : (
                                <input type="url" className="form-input" placeholder="https://example.com/job" value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} onFocus={(e) => e.target.select()} />
                            )}
                            {inputMode === 'url' && jobUrl.toLowerCase().includes('linkedin.com') && (
                                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(245, 158, 11, 0.1)', padding: '0.5rem', borderRadius: '4px' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>warning</span>
                                    <span>LinkedIn blocks automated scraping. For best results, switch to <b>Paste Text</b> mode.</span>
                                </div>
                            )}
                        </div>
                        <div className="btn-group">
                            <button type="submit" className="btn btn-primary" disabled={isProcessing || (!resumeFile && !userProfile?.base_resume_path)} style={{ gap: '0.5rem', padding: '1rem 2rem', fontSize: '1.1rem' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.4rem' }}>rocket_launch</span>
                                Tailor Resume
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default NewApplication
