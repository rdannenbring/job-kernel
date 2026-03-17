import React, { useState, useEffect, useRef } from 'react';
import CustomDropdown from '../components/CustomDropdown';
import CustomMultiSelect from '../components/CustomMultiSelect';
import ProcessVisualization from '../ProcessVisualization';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const InputGroup = ({ label, children, style }) => (
    <div style={{ marginBottom: '1rem', ...style }}>
        <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>{label}</label>
        {children}
    </div>
);

const Input = (props) => (
    <input
        {...props}
        style={{
            width: '100%', padding: '0.6rem', borderRadius: '4px',
            border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)', fontSize: '0.95rem'
        }}
    />
);

const CollapsibleSection = ({ icon, title, defaultExpanded, children, style }) => {
    const [expanded, setExpanded] = useState(defaultExpanded);

    return (
        <div style={{ marginBottom: expanded ? '3rem' : '1.5rem', transition: 'margin 0.3s ease', ...style }}>
            <h2 
                className="section-title-premium" 
                onClick={() => setExpanded(!expanded)}
                style={{ marginBottom: expanded ? '1.5rem' : '0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {icon && <span>{icon}</span>}
                    {title}
                </div>
                <span className="material-symbols-outlined" style={{ color: 'var(--text-muted)', fontSize: '1.2rem', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease' }}>
                    expand_more
                </span>
            </h2>
            
            {expanded && (
                <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                    {children}
                </div>
            )}
        </div>
    );
};

const CollapsibleCard = ({ title, defaultExpanded = false, onAdd, addTitle, children, style }) => {
    const [expanded, setExpanded] = useState(defaultExpanded);

    return (
        <section className="card" style={style}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: expanded ? '1.5rem' : '0', cursor: 'pointer', userSelect: 'none' }} onClick={() => setExpanded(!expanded)}>
                <h3 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--primary-light)', fontWeight: 600 }}>{title}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {onAdd && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onAdd(); }}
                            className="btn-secondary"
                            title={addTitle || "Add"}
                            style={{
                                padding: '0',
                                width: '30px',
                                height: '30px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '50%',
                                lineHeight: '1'
                            }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>add</span>
                        </button>
                    )}
                    <span className="material-symbols-outlined" style={{ color: 'var(--text-muted)', fontSize: '1.2rem', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease' }}>
                        expand_more
                    </span>
                </div>
            </div>
            {expanded && (
                <div style={{ animation: 'fadeIn 0.3s ease-out', marginTop: '1rem' }}>
                    {children}
                </div>
            )}
        </section>
    );
};

const Profile = () => {
    const [loading, setLoading] = useState(true);

    const [isRecalculating, setIsRecalculating] = useState(false);

    const handleRecalculateCommutes = async () => {
        setIsRecalculating(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/profile/recalculate-commutes`, {
                method: 'POST'
            });
            if (res.ok) {
                alert("Commute recalculation started in the background!");
            } else {
                alert("Failed to start commute recalculation.");
            }
        } catch(e) {
            console.error(e);
            alert("Error starting recalculation.");
        }
        setIsRecalculating(false);
    };

    const [saving, setSaving] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [formData, setFormData] = useState({
        first_name: '', last_name: '', full_name: '',
        address_line1: '', address_line2: '', city: '', state: '', zip_code: '',
        phone_primary: '', phone_secondary: '', email: '',
        linkedin_url: '', github_url: '', website_url: '',
        job_title: '', bio: '',
        skills: [],
        experiences: [],
        educations: [],
        certificates: [],
        other: [],
        social_links: [],
        preferences: { max_commute: '', work_setting: '', expected_salary: '' },
        base_resume_path: null,
        long_form_resume_path: null,
        additional_docs: [],
    });
    const [extractedData, setExtractedData] = useState(null);
    const [selectedFields, setSelectedFields] = useState({});
    const [expandedSections, setExpandedSections] = useState({});
    const [notification, setNotification] = useState(null);
    const [isDirty, setIsDirty] = useState(false);
    const [isSticky, setIsSticky] = useState(false);

    // Resume upload state
    const [uploadingResume, setUploadingResume] = useState(false);
    const baseResumeInputRef = useRef(null);
    const longFormResumeInputRef = useRef(null);
    const pendingImportFile = useRef(null);
    const [showResumeTypeDialog, setShowResumeTypeDialog] = useState(false);
    const [showImportProfileDialog, setShowImportProfileDialog] = useState(false);
    const [pendingProfileImportFile, setPendingProfileImportFile] = useState(null);

    // Additional docs state
    const [uploadingAdditionalDoc, setUploadingAdditionalDoc] = useState(false);
    const additionalDocsInputRef = useRef(null);

    // Document viewer state
    const [viewingDoc, setViewingDoc] = useState(null); // { filename, url }

    // Navigation guard for unsaved changes (tab/window close)
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = ''; // Required for Chrome
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    // Keep App-level router in sync with our dirty state
    useEffect(() => {
        if (window.__setProfileDirty) window.__setProfileDirty(isDirty);
    }, [isDirty]);

    // Track scroll for sticky header styling
    // Track scroll for sticky header styling via explicit parent scroll listener
    // This is more robust than window.scroll or IntersectionObserver when inside a nested overflow container
    const containerRef = useRef(null);
    useEffect(() => {
        const target = document.querySelector('main') || window;
        const handleScroll = () => {
            const scrollTop = target === window ? window.scrollY : target.scrollTop;
            setIsSticky(scrollTop > 10);
        };

        target.addEventListener('scroll', handleScroll);
        // Initial check
        handleScroll();

        return () => {
            target.removeEventListener('scroll', handleScroll);
        };
    }, [loading]);
    const fileInputRef = useRef(null);
    const bioRef = useRef(null);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await fetch(`${API_URL}/api/profile`);
            if (res.ok) {
                const data = await res.json();
                if (data && Object.keys(data).length > 0) {
                    setFormData(prev => ({
                        ...prev,
                        ...data,
                        skills: data.skills || [],
                        experiences: data.experiences || [],
                        educations: data.educations || [],
                        certificates: data.certificates || [],
                        other: data.other || [],
                        social_links: data.social_links || [],
                        preferences: data.preferences || { max_commute: '', work_setting: '', expected_salary: '' },
                        base_resume_path: data.base_resume_path || null,
                        long_form_resume_path: data.long_form_resume_path || null,
                        additional_docs: data.additional_docs || [],
                    }));
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const isProfileEmpty = () =>
        !formData.first_name && !formData.last_name && !formData.email &&
        formData.skills.length === 0 && formData.experiences.length === 0;

    const handleResumeUpload = async (file, type) => {
        if (!file) return;
        setUploadingResume(true);
        const fd = new FormData();
        fd.append('resume', file);
        fd.append('resume_type', type);
        try {
            const res = await fetch(`${API_URL}/api/profile/upload-resume`, { method: 'POST', body: fd });
            if (res.ok) {
                const data = await res.json();
                const key = type === 'base' ? 'base_resume_path' : 'long_form_resume_path';
                setFormData(prev => ({ ...prev, [key]: data.path }));
                showNotification(`${type === 'base' ? 'Base' : 'Long-form'} resume saved!`, 'success');
            } else {
                showNotification('Failed to upload resume.', 'error');
            }
        } catch {
            showNotification('Error uploading resume.', 'error');
        } finally {
            setUploadingResume(false);
        }
    };

    const handleDeleteResume = async (type) => {
        try {
            const res = await fetch(`${API_URL}/api/profile/resume/${type}`, { method: 'DELETE' });
            if (res.ok) {
                const key = type === 'base' ? 'base_resume_path' : 'long_form_resume_path';
                setFormData(prev => ({ ...prev, [key]: null }));
                showNotification('Resume removed.', 'info');
            }
        } catch {
            showNotification('Error removing resume.', 'error');
        }
    };

    const handleResumeFileSelect = async (e, explicitType) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        await handleResumeUpload(file, explicitType);
        if (isProfileEmpty()) {
            setPendingProfileImportFile(file);
            setShowImportProfileDialog(true);
        }
    };

    const handleAdditionalDocUpload = async (files) => {
        if (!files || files.length === 0) return;
        setUploadingAdditionalDoc(true);
        const results = [];
        for (const file of Array.from(files)) {
            const fd = new FormData();
            fd.append('document', file);
            fd.append('label', '');
            try {
                const res = await fetch(`${API_URL}/api/profile/upload-additional-doc`, { method: 'POST', body: fd });
                if (res.ok) results.push(await res.json());
                else showNotification(`Failed to upload ${file.name}`, 'error');
            } catch { showNotification(`Error uploading ${file.name}`, 'error'); }
        }
        if (results.length > 0) {
            setFormData(prev => ({
                ...prev,
                additional_docs: [...(prev.additional_docs || []), ...results]
            }));
            showNotification(`${results.length} document${results.length > 1 ? 's' : ''} uploaded.`, 'success');
        }
        setUploadingAdditionalDoc(false);
        if (additionalDocsInputRef.current) additionalDocsInputRef.current.value = '';
    };

    const handleDeleteAdditionalDoc = async (path) => {
        try {
            const res = await fetch(`${API_URL}/api/profile/additional-doc?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
            if (res.ok) {
                setFormData(prev => ({
                    ...prev,
                    additional_docs: (prev.additional_docs || []).filter(d => d.path !== path)
                }));
                showNotification('Document removed.', 'info');
            }
        } catch { showNotification('Error removing document.', 'error'); }
    };

    const openDocViewer = (path, filename) => {
        const url = `${API_URL}/api/profile/file?path=${encodeURIComponent(path)}`;
        if (filename.endsWith('.pdf')) {
            setViewingDoc({ filename, url });
        } else {
            // For DOCX and other files, open in a new tab for download
            window.open(url, '_blank');
        }
    };

    // Auto-resize textareas
    useEffect(() => {
        const resize = (ref) => {
            if (ref.current) {
                ref.current.style.height = 'auto';
                ref.current.style.height = ref.current.scrollHeight + 'px';
            }
        };
        resize(bioRef);
    }, [formData.bio, loading]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setIsDirty(true);
    };

    const handleArrayItemUpdate = (field, index, subField, value) => {
        setFormData(prev => {
            const nextArr = [...prev[field]];
            if (subField === null) {
                nextArr[index] = value;
            } else {
                nextArr[index] = { ...nextArr[index], [subField]: value };
            }
            return { ...prev, [field]: nextArr };
        });
        setIsDirty(true);
    };

    const addArrayItem = (field, defaultObj) => {
        setFormData(prev => ({
            ...prev,
            [field]: [...prev[field], defaultObj]
        }));
        setIsDirty(true);
    };

    const removeArrayItem = (field, index) => {
        setFormData(prev => ({
            ...prev,
            [field]: prev[field].filter((_, i) => i !== index)
        }));
        setIsDirty(true);
    };

    const [newSkill, setNewSkill] = useState('');
    const [editingSkillIndex, setEditingSkillIndex] = useState(null); // Index of skill being edited
    const [isAddingSkill, setIsAddingSkill] = useState(false); // Toggle for add skill input

    const addSkill = () => {
        if (newSkill.trim()) {
            if (!formData.skills.includes(newSkill.trim())) {
                setFormData(prev => ({
                    ...prev,
                    skills: [...prev.skills, newSkill.trim()]
                }));
                setIsDirty(true);
            }
            setNewSkill('');
            setIsAddingSkill(false);
        }
    };

    const updateSkill = (index, newValue) => {
        if (!newValue.trim()) {
            removeArrayItem('skills', index); // Remove if empty
            setEditingSkillIndex(null);
            return;
        }
        setFormData(prev => {
            const nextSkills = [...prev.skills];
            nextSkills[index] = newValue.trim();
            return { ...prev, skills: nextSkills };
        });
        setIsDirty(true);
        setEditingSkillIndex(null);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (res.ok) {
                showNotification('Profile saved successfully!', 'success');
                setIsDirty(false);
                // Re-fetch to sync server-preserved fields (resume paths, etc.)
                await fetchProfile();
            } else {
                showNotification('Error saving profile.', 'error');
            }
        } catch {
            showNotification('Error saving profile.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const showNotification = (msg, type) => {
        setNotification({ msg, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const runProfileScan = async (file) => {
        setScanning(true);
        const uploadData = new FormData();
        uploadData.append('resume', file);
        try {
            const res = await fetch(`${API_URL}/api/scan-contact-info`, { method: 'POST', body: uploadData });
            if (res.ok) {
                const extracted = await res.json();
                const changes = {};
                let hasChanges = false;
                Object.entries(extracted).forEach(([key, val]) => {
                    if (Array.isArray(val)) {
                        if (val.length > 0) { changes[key] = val; hasChanges = true; }
                    } else if (val && val !== formData[key]) {
                        changes[key] = val; hasChanges = true;
                    }
                });
                if (hasChanges) {
                    setExtractedData(changes);
                    const initialSelection = {};
                    Object.keys(changes).forEach(k => initialSelection[k] = true);
                    setSelectedFields(initialSelection);
                } else {
                    showNotification('No new contact info found.', 'info');
                }
            } else {
                showNotification('Failed to extract info.', 'error');
            }
        } catch {
            showNotification('Error scanning resume.', 'error');
        } finally {
            setScanning(false);
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (fileInputRef.current) fileInputRef.current.value = '';

        // If no resumes saved, ask the user what type this file is
        if (!formData.base_resume_path && !formData.long_form_resume_path) {
            pendingImportFile.current = file;
            setShowResumeTypeDialog(true);
            return;
        }
        await runProfileScan(file);
    };

    const handleConfirmUpdate = () => {
        setFormData(prev => {
            const next = { ...prev };
            Object.entries(extractedData).forEach(([key, val]) => {
                if (selectedFields[key]) {
                    next[key] = val;
                }
            });
            return next;
        });
        setIsDirty(true);
        setExtractedData(null);
        showNotification('Profile updated with scanned data. Please save to confirm.', 'success');
    };

    const handleExtractedValueChange = (key, value) => {
        setExtractedData(prev => ({ ...prev, [key]: value }));
    };

    const handleExtractedArrayItemChange = (key, index, subKey, value) => {
        setExtractedData(prev => {
            const nextArr = [...prev[key]];
            if (subKey === null) {
                nextArr[index] = value;
            } else {
                nextArr[index] = { ...nextArr[index], [subKey]: value };
            }
            return { ...prev, [key]: nextArr };
        });
    };

    const removeExtractedArrayItem = (key, index) => {
        setExtractedData(prev => ({
            ...prev,
            [key]: prev[key].filter((_, i) => i !== index)
        }));
    };

    const toggleSection = (key) => {
        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const formatKey = (key) => {
        if (key === 'experiences') return 'Experience';
        if (key === 'educations') return 'Education';
        return key.replace(/_/g, ' ');
    };

    if (loading) return <div style={{ padding: '3rem' }}>Loading profile...</div>;

    return (
        <div ref={containerRef} style={{ padding: '3rem', maxWidth: '1200px', margin: '0 auto', position: scanning ? 'fixed' : 'relative', width: '100%' }}>
            {scanning && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(15, 23, 42, 0.9)', zIndex: 10000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(8px)'
                }}>
                    <div style={{ width: '100%', maxWidth: '800px', padding: '2rem' }}>
                        <ProcessVisualization mode="profile_import" />
                    </div>
                </div>
            )}
            <header style={{
                marginBottom: '2rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'sticky',
                top: 0,
                zIndex: 100,
                background: isSticky ? 'var(--bg-primary)' : 'transparent',
                padding: '1rem 0',
                margin: '0 -3rem 2rem -3rem', // Negative margin to stretch full width but keep content aligned if using padding
                paddingLeft: '3rem',
                paddingRight: '3rem',
                borderBottom: isSticky ? '1px solid var(--border-color)' : 'none',
                transition: 'all 0.3s ease'
            }}>
                <div>
                    <h1 style={{ fontSize: isSticky ? '1.5rem' : '2rem', marginBottom: isSticky ? 0 : '0.5rem', transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: isSticky ? '1.8rem' : '2.4rem' }}>person</span>
                        User Profile
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', display: isSticky ? 'none' : 'block' }}>Manage your contact info for cover letters.</p>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={() => fileInputRef.current.click()}
                        disabled={scanning}
                        style={{
                            padding: '0.6rem 1.2rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem'
                        }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>download</span>
                        {scanning ? 'Scanning...' : 'Import from Resume'}
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept=".docx,.pdf"
                        onChange={handleFileChange}
                    />

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            padding: '0.6rem 1.5rem', background: 'var(--primary)', border: 'none',
                            color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 500
                        }}
                    >
                        {saving ? 'Saving...' : 'Save Profile'}
                    </button>
                </div>
            </header>

            {/* Diff Modal */}
            {
                extractedData && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)',
                        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)'
                    }}>
                        <div style={{
                            background: 'var(--bg-card)', padding: '2.5rem', borderRadius: '12px', maxWidth: '1000px', width: '95%',
                            maxHeight: '85vh', display: 'flex', flexDirection: 'column',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }}>
                                <h2 style={{ marginTop: 0, fontSize: '1.8rem', color: 'var(--text-primary)' }}>Review Scanned Data</h2>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                                    We found the following updates in your resume. Review and edit the values before applying them to your profile:
                                </p>

                                <div style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: '40px 140px 1fr 1fr',
                                        fontWeight: 700,
                                        padding: '1rem',
                                        borderBottom: '2px solid var(--bg-tertiary)',
                                        color: 'var(--text-muted)',
                                        fontSize: '0.85rem',
                                        textTransform: 'uppercase',
                                        letterSpacing: '1px'
                                    }}>
                                        <span></span>
                                        <span>Field</span>
                                        <span>Current Value</span>
                                        <span>New Value (Editable)</span>
                                    </div>
                                    {Object.entries(extractedData).map(([key, val]) => (
                                        <div key={key} style={{
                                            display: 'grid',
                                            gridTemplateColumns: '40px 140px 1fr 1fr',
                                            alignItems: 'start',
                                            padding: '1rem',
                                            background: selectedFields[key] ? 'rgba(111, 76, 255, 0.05)' : 'transparent',
                                            borderRadius: '8px',
                                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                                            transition: 'background 0.2s ease'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={!!selectedFields[key]}
                                                    onChange={(e) => setSelectedFields(prev => ({ ...prev, [key]: e.target.checked }))}
                                                    style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                                                />
                                            </div>
                                            <div style={{ paddingRight: '1rem', fontWeight: 600, color: 'var(--text-primary)', paddingTop: '0.5rem', textTransform: 'capitalize' }}>
                                                {formatKey(key)}
                                            </div>
                                            <div style={{
                                                padding: '0.5rem 1rem 0.5rem 0',
                                                color: 'var(--text-muted)',
                                                fontSize: '0.9rem',
                                                wordBreak: 'break-all',
                                                fontStyle: 'italic',
                                                borderRight: '1px solid rgba(255,255,255,0.05)'
                                            }}>
                                                {Array.isArray(formData[key]) ? `${formData[key].length} entries` : (formData[key] || '(Empty)')}
                                            </div>
                                            <div style={{ paddingLeft: '1rem' }}>
                                                {Array.isArray(val) ? (
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                            <span style={{ color: 'var(--primary-light)', fontWeight: 500 }}>
                                                                {val.length} entries found
                                                            </span>
                                                            <button
                                                                onClick={() => toggleSection(key)}
                                                                style={{
                                                                    padding: '0.3rem 0.6rem',
                                                                    fontSize: '0.75rem',
                                                                    background: 'var(--bg-tertiary)',
                                                                    border: '1px solid var(--border-color)',
                                                                    color: 'var(--text-primary)',
                                                                    borderRadius: '4px',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                {expandedSections[key] ? 'Collapse' : 'View / Edit Entries'}
                                                            </button>
                                                        </div>

                                                        {expandedSections[key] && (
                                                            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                                {val.map((item, idx) => (
                                                                    <div key={idx} className="timeline-card" style={{ padding: '1rem', marginBottom: 0, border: '1px solid rgba(255,255,255,0.1)' }}>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary-light)' }}>ENTRY #{idx + 1}</span>
                                                                            <button
                                                                                onClick={() => removeExtractedArrayItem(key, idx)}
                                                                                style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.8 }}
                                                                                title="Remove Entry"
                                                                            >
                                                                                <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>delete</span>
                                                                            </button>
                                                                        </div>

                                                                        {typeof item === 'string' ? (
                                                                            <input
                                                                                className="input-premium"
                                                                                value={item}
                                                                                onChange={(e) => handleExtractedArrayItemChange(key, idx, null, e.target.value)}
                                                                                style={{ width: '100%', padding: '0.5rem' }}
                                                                            />
                                                                        ) : (
                                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                                                                {Object.entries(item).map(([subKey, subVal]) => (
                                                                                    <div key={subKey}>
                                                                                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
                                                                                            {subKey.toUpperCase()}
                                                                                        </label>
                                                                                        {subKey === 'description' ? (
                                                                                            <textarea
                                                                                                className="input-premium"
                                                                                                value={subVal}
                                                                                                onChange={(e) => handleExtractedArrayItemChange(key, idx, subKey, e.target.value)}
                                                                                                style={{ width: '100%', padding: '0.5rem', minHeight: '60px', fontSize: '0.85rem' }}
                                                                                            />
                                                                                        ) : (
                                                                                            <input
                                                                                                className="input-premium"
                                                                                                value={subVal}
                                                                                                onChange={(e) => handleExtractedArrayItemChange(key, idx, subKey, e.target.value)}
                                                                                                style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}
                                                                                            />
                                                                                        )}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <textarea
                                                        value={val}
                                                        onChange={(e) => handleExtractedValueChange(key, e.target.value)}
                                                        className="input-premium"
                                                        style={{
                                                            width: '100%',
                                                            minHeight: '40px',
                                                            fontSize: '0.9rem',
                                                            padding: '0.5rem',
                                                            background: 'rgba(255,255,255,0.03)',
                                                            border: selectedFields[key] ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)'
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                <button
                                    onClick={() => setExtractedData(null)}
                                    style={{ padding: '0.6rem 1.2rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmUpdate}
                                    style={{ padding: '0.6rem 1.2rem', background: 'var(--primary)', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                    Update Selected
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                notification && (
                    <div style={{
                        padding: '1rem', marginBottom: '1.5rem', borderRadius: '6px',
                        background: notification.type === 'success' ? 'rgba(74, 222, 128, 0.15)' : (notification.type === 'info' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(248, 113, 113, 0.15)'),
                        color: notification.type === 'success' ? '#4ade80' : (notification.type === 'info' ? '#60a5fa' : '#f87171'),
                        border: `1px solid ${notification.type === 'success' ? '#4ade80' : (notification.type === 'info' ? '#60a5fa' : '#f87171')}`
                    }}>
                        {notification.msg}
                    </div>
                )
            }


            {/* ===== RESUMES + DOCS — SINGLE ROW ===== */}
            <CollapsibleSection title="My Documents" icon={<span className="material-symbols-outlined">attach_file</span>} defaultExpanded={true}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>

                {/* ── Base Resume ── */}
                <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{ width: '30px', height: '30px', borderRadius: '7px', background: 'rgba(37,99,235,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: 'var(--primary-light)' }}>description</span>
                        </div>
                        <div>
                            <h3 style={{ fontSize: '0.95rem', margin: 0, color: 'var(--primary-light)', fontWeight: 600 }}>Base Resume</h3>
                            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>Standard, general-purpose</p>
                        </div>
                    </div>
                    {formData.base_resume_path ? (() => {
                        const fname = formData.base_resume_path.split('/').pop();
                        const short = fname.length > 18 ? fname.slice(0, 15) + '…' : fname;
                        return (
                            <div title={fname} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.6rem', background: 'rgba(37,99,235,0.07)', border: '1px solid rgba(37,99,235,0.18)', borderRadius: '6px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: 'var(--primary-light)', flexShrink: 0 }}>description</span>
                                <span onClick={() => openDocViewer(formData.base_resume_path, fname)} style={{ fontSize: '0.78rem', color: 'var(--primary-light)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', textDecoration: 'underline' }}>{short}</span>
                                <button onClick={() => handleDeleteResume('base')} title="Remove" style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0, padding: '0 2px' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>close</span>
                                </button>
                            </div>
                        );
                    })() : (
                        <div onClick={() => baseResumeInputRef.current?.click()} style={{ border: '2px dashed rgba(37,99,235,0.2)', borderRadius: '8px', padding: '1.1rem', textAlign: 'center', cursor: 'pointer', flex: 1, transition: 'border-color 0.2s, background 0.2s' }} onMouseOver={e => { e.currentTarget.style.borderColor='rgba(37,99,235,0.5)'; e.currentTarget.style.background='rgba(37,99,235,0.05)'; }} onMouseOut={e => { e.currentTarget.style.borderColor='rgba(37,99,235,0.2)'; e.currentTarget.style.background='transparent'; }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1.8rem', color: 'rgba(37,99,235,0.5)', marginBottom: '0.25rem', display: 'block' }}>upload</span>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>Click to upload (.docx)</p>
                        </div>
                    )}
                    <input type="file" accept=".docx" ref={baseResumeInputRef} style={{ display: 'none' }} onChange={(e) => handleResumeFileSelect(e, 'base')} />
                </section>

                {/* ── Long-Form Resume ── */}
                <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{ width: '30px', height: '30px', borderRadius: '7px', background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: '#a78bfa' }}>assignment</span>
                        </div>
                        <div>
                            <h3 style={{ fontSize: '0.95rem', margin: 0, color: '#a78bfa', fontWeight: 600 }}>Long-Form Resume</h3>
                            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>Extended detail &amp; history</p>
                        </div>
                    </div>
                    {formData.long_form_resume_path ? (() => {
                        const fname = formData.long_form_resume_path.split('/').pop();
                        const short = fname.length > 18 ? fname.slice(0, 15) + '…' : fname;
                        return (
                            <div title={fname} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.6rem', background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.18)', borderRadius: '6px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: '#a78bfa', flexShrink: 0 }}>assignment</span>
                                <span onClick={() => openDocViewer(formData.long_form_resume_path, fname)} style={{ fontSize: '0.78rem', color: '#a78bfa', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', textDecoration: 'underline' }}>{short}</span>
                                <button onClick={() => handleDeleteResume('long_form')} title="Remove" style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0, padding: '0 2px' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>close</span>
                                </button>
                            </div>
                        );
                    })() : (
                        <div onClick={() => longFormResumeInputRef.current?.click()} style={{ border: '2px dashed rgba(139,92,246,0.2)', borderRadius: '8px', padding: '1.1rem', textAlign: 'center', cursor: 'pointer', flex: 1, transition: 'border-color 0.2s, background 0.2s' }} onMouseOver={e => { e.currentTarget.style.borderColor='rgba(139,92,246,0.5)'; e.currentTarget.style.background='rgba(139,92,246,0.05)'; }} onMouseOut={e => { e.currentTarget.style.borderColor='rgba(139,92,246,0.2)'; e.currentTarget.style.background='transparent'; }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1.8rem', color: 'rgba(139,92,246,0.5)', marginBottom: '0.25rem', display: 'block' }}>upload</span>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>Click to upload (.docx)</p>
                        </div>
                    )}
                    <input type="file" accept=".docx" ref={longFormResumeInputRef} style={{ display: 'none' }} onChange={(e) => handleResumeFileSelect(e, 'long_form')} />
                </section>

                {/* ── Additional AI Context Docs ── */}
                <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div style={{ width: '30px', height: '30px', borderRadius: '7px', background: 'rgba(20,184,166,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: '#2dd4bf' }}>folder</span>
                            </div>
                            <div>
                                <h3 style={{ fontSize: '0.95rem', margin: 0, color: '#2dd4bf', fontWeight: 600 }}>AI Context Docs</h3>
                                <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>Bios, assessments, press releases…</p>
                            </div>
                        </div>
                        <button onClick={() => additionalDocsInputRef.current?.click()} disabled={uploadingAdditionalDoc} title="Add documents" style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(20,184,166,0.15)', border: '1px solid rgba(20,184,166,0.3)', color: '#2dd4bf', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, lineHeight: 1 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>add</span>
                        </button>
                        <input type="file" multiple accept=".docx,.pdf,.txt,.doc" ref={additionalDocsInputRef} style={{ display: 'none' }} onChange={(e) => handleAdditionalDocUpload(e.target.files)} />
                    </div>

                    {formData.additional_docs.length === 0 ? (
                        <div onClick={() => additionalDocsInputRef.current?.click()} style={{ border: '2px dashed rgba(20,184,166,0.2)', borderRadius: '8px', padding: '1.1rem', textAlign: 'center', cursor: 'pointer', flex: 1, transition: 'border-color 0.2s, background 0.2s' }} onMouseOver={e => { e.currentTarget.style.borderColor='rgba(20,184,166,0.5)'; e.currentTarget.style.background='rgba(20,184,166,0.04)'; }} onMouseOut={e => { e.currentTarget.style.borderColor='rgba(20,184,166,0.2)'; e.currentTarget.style.background='transparent'; }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1.8rem', color: 'rgba(20,184,166,0.4)', marginBottom: '0.4rem', display: 'block' }}>upload_file</span>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>No documents yet. Click to upload certifications, awards, or projects.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', overflowY: 'auto', maxHeight: '160px' }}>
                            {formData.additional_docs.map((doc, i) => {
                                const ext = doc.filename.split('.').pop().toLowerCase();
                                const short = doc.filename.length > 18 ? doc.filename.slice(0, 15) + '…' : doc.filename;
                                return (
                                    <div key={i} title={doc.filename} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.6rem', background: 'rgba(20,184,166,0.07)', border: '1px solid rgba(20,184,166,0.18)', borderRadius: '6px' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: '#2dd4bf', flexShrink: 0 }}>
                                            {ext === 'pdf' ? 'picture_as_pdf' : 'description'}
                                        </span>
                                        <span onClick={() => openDocViewer(doc.path, doc.filename)} style={{ fontSize: '0.78rem', color: '#2dd4bf', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', textDecoration: 'underline' }}>{short}</span>
                                        <button onClick={() => handleDeleteAdditionalDoc(doc.path)} title="Remove" style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0, padding: '0 2px' }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>close</span>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
                </div>
            </CollapsibleSection>

            {/* Preferences Section */}
            <CollapsibleSection title="Preferences" icon={<span className="material-symbols-outlined">settings</span>} defaultExpanded={true} style={{ position: 'relative', zIndex: 10 }}>
                <section className="card">
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: 'var(--primary-light)', fontWeight: 600 }}>Job Preferences</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                        <InputGroup label="Maximum Commute">
                            <CustomDropdown
                                value={formData.preferences?.max_commute || ''}
                                onChange={(val) => {
                                    setFormData(prev => ({...prev, preferences: {...prev.preferences, max_commute: val}}));
                                    setIsDirty(true);
                                }}
                                options={[
                                    { value: '', label: 'Select Commute' },
                                    { value: 'Remote Only', label: 'Remote Only' },
                                    { value: '15 mins', label: '15 mins' },
                                    { value: '30 mins', label: '30 mins' },
                                    { value: '45 mins', label: '45 mins' },
                                    { value: '1 hour', label: '1 hour' },
                                    { value: '1.5 hours', label: '1.5 hours' },
                                    { value: '2 hours', label: '2 hours' }
                                ]}
                            />
                        </InputGroup>
                        <InputGroup label="Work Setting">
                            <CustomMultiSelect
                                value={Array.isArray(formData.preferences?.work_setting) ? formData.preferences.work_setting : (formData.preferences?.work_setting ? [formData.preferences.work_setting] : [])}
                                onChange={(val) => {
                                    setFormData(prev => ({...prev, preferences: {...prev.preferences, work_setting: val}}));
                                    setIsDirty(true);
                                }}
                                options={[
                                    { value: 'Remote', label: 'Remote' },
                                    { value: 'Hybrid', label: 'Hybrid' },
                                    { value: 'On-site', label: 'On-site' },
                                    { value: 'Any', label: 'Any' }
                                ]}
                                placeholder="Select Settings"
                            />
                        </InputGroup>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginTop: '1.25rem' }}>
                        <InputGroup label="Job Type">
                            <CustomMultiSelect
                                value={Array.isArray(formData.preferences?.job_types) ? formData.preferences.job_types : (formData.preferences?.job_types ? [formData.preferences.job_types] : [])}
                                onChange={(val) => {
                                    setFormData(prev => ({...prev, preferences: {...prev.preferences, job_types: val}}));
                                    setIsDirty(true);
                                }}
                                options={[
                                    { value: 'Full-time', label: 'Full-time' },
                                    { value: 'Part-time', label: 'Part-time' },
                                    { value: 'Contract', label: 'Contract' },
                                    { value: 'Internship', label: 'Internship' },
                                    { value: 'Any', label: 'Any' }
                                ]}
                                placeholder="Select Job Types"
                            />
                        </InputGroup>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginTop: '1.25rem' }}>
                        <InputGroup label="Minimum Salary">
                            <Input 
                                className="input-premium" 
                                type="number"
                                name="min_salary" 
                                value={formData.preferences?.min_salary || ''} 
                                onChange={(e) => {
                                    setFormData(prev => ({...prev, preferences: {...prev.preferences, min_salary: e.target.value}}));
                                    setIsDirty(true);
                                }} 
                                placeholder="e.g. 120000" 
                            />
                        </InputGroup>
                        <InputGroup label="Maximum Salary">
                            <Input 
                                className="input-premium" 
                                type="number"
                                name="max_salary" 
                                value={formData.preferences?.max_salary || ''} 
                                onChange={(e) => {
                                    setFormData(prev => ({...prev, preferences: {...prev.preferences, max_salary: e.target.value}}));
                                    setIsDirty(true);
                                }} 
                                placeholder="e.g. 150000" 
                            />
                        </InputGroup>
                    </div>
                </section>
            </CollapsibleSection>

            {/* ===== DOCUMENT VIEWER MODAL ===== */}
            {viewingDoc && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', flexDirection: 'column', backdropFilter: 'blur(8px)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1.4rem' }}>description</span>
                            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{viewingDoc.filename}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <a href={viewingDoc.url} download={viewingDoc.filename} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.9rem', background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.3)', color: 'var(--primary-light)', borderRadius: '6px', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 500 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>download</span>
                                Download
                            </a>
                            <button onClick={() => setViewingDoc(null)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.9rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>close</span>
                                Close
                            </button>
                        </div>
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        <iframe
                            src={viewingDoc.url}
                            style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
                            title={viewingDoc.filename}
                        />
                    </div>
                </div>
            )}

            {/* ===== RESUME TYPE DIALOG ===== */}
            {showResumeTypeDialog && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
                    <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '1rem', border: '1px solid var(--border-color)', maxWidth: '500px', width: '90%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)' }}>
                        <h2 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span className="material-symbols-outlined" style={{ color: 'var(--primary-light)' }}>lightbulb</span>
                            Save as Resume?
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.6', fontSize: '0.95rem' }}>You don't have any resumes saved yet. Would you like to save this file as your <strong>Base Resume</strong> or your <strong>Long-Form Resume</strong>?</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <button className="btn btn-primary" style={{ justifyContent: 'center', gap: '0.5rem' }} onClick={async () => {
                                setShowResumeTypeDialog(false);
                                const file = pendingImportFile.current;
                                pendingImportFile.current = null;
                                await handleResumeUpload(file, 'base');
                                if (isProfileEmpty()) { setPendingProfileImportFile(file); setShowImportProfileDialog(true); }
                                else await runProfileScan(file);
                            }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>description</span>
                                Save as Base Resume &amp; Import Profile
                            </button>
                            <button className="btn btn-primary" style={{ justifyContent: 'center', background: 'rgba(139,92,246,0.8)', gap: '0.5rem' }} onClick={async () => {
                                setShowResumeTypeDialog(false);
                                const file = pendingImportFile.current;
                                pendingImportFile.current = null;
                                await handleResumeUpload(file, 'long_form');
                                if (isProfileEmpty()) { setPendingProfileImportFile(file); setShowImportProfileDialog(true); }
                                else await runProfileScan(file);
                            }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>assignment</span>
                                Save as Long-Form Resume &amp; Import Profile
                            </button>
                            <button className="btn btn-secondary" style={{ justifyContent: 'center', gap: '0.5rem' }} onClick={async () => {
                                setShowResumeTypeDialog(false);
                                const file = pendingImportFile.current;
                                pendingImportFile.current = null;
                                await runProfileScan(file);
                            }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>search</span>
                                Just Import Profile Data (Don't Save File)
                            </button>
                            <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.5rem' }} onClick={() => { setShowResumeTypeDialog(false); pendingImportFile.current = null; }}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== IMPORT PROFILE DIALOG ===== */}
            {showImportProfileDialog && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
                    <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '1rem', border: '1px solid var(--border-color)', maxWidth: '480px', width: '90%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)' }}>
                        <h2 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span className="material-symbols-outlined" style={{ color: 'var(--primary-light)' }}>download</span>
                            Import Profile Data?
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.6', fontSize: '0.95rem' }}>Your profile looks empty. Would you like the AI to scan this resume and auto-populate your profile with your name, contact info, skills, and experience?</p>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', gap: '0.4rem' }} onClick={async () => {
                                setShowImportProfileDialog(false);
                                const file = pendingProfileImportFile;
                                setPendingProfileImportFile(null);
                                await runProfileScan(file);
                            }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>auto_awesome</span>
                                Yes, Import Profile
                            </button>
                            <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setShowImportProfileDialog(false); setPendingProfileImportFile(null); }}>No Thanks</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Profile Section */}
            <CollapsibleSection title="Base Profile Information" icon={<span className="material-symbols-outlined">person</span>} defaultExpanded={true}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>

                {/* Left Column: Personal + Address */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                    <section className="card">
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: 'var(--primary-light)', fontWeight: 600 }}>Personal Info</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                            <InputGroup label="First Name">
                                <Input className="input-premium" name="first_name" value={formData.first_name} onChange={handleChange} placeholder="e.g. John" />
                            </InputGroup>
                            <InputGroup label="Last Name">
                                <Input className="input-premium" name="last_name" value={formData.last_name} onChange={handleChange} placeholder="e.g. Doe" />
                            </InputGroup>
                        </div>
                        <InputGroup label="Full Name (Display)">
                            <Input className="input-premium" name="full_name" value={formData.full_name} onChange={handleChange} placeholder="e.g. John Doe, PMP" />
                        </InputGroup>
                        <InputGroup label="Job Title / Role">
                            <Input className="input-premium" name="job_title" value={formData.job_title} onChange={handleChange} placeholder="e.g. Senior Software Engineer" />
                        </InputGroup>
                        <InputGroup label="Bio / Summary">
                            <textarea
                                ref={bioRef}
                                name="bio" value={formData.bio} onChange={handleChange}
                                placeholder="Brief professional summary..."
                                className="form-textarea input-premium"
                            />
                        </InputGroup>
                    </section>

                    <section className="card">
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: 'var(--primary-light)', fontWeight: 600 }}>Address</h3>
                        <InputGroup label="Address Line 1">
                            <Input className="input-premium" name="address_line1" value={formData.address_line1} onChange={handleChange} />
                        </InputGroup>
                        <InputGroup label="Address Line 2">
                            <Input className="input-premium" name="address_line2" value={formData.address_line2} onChange={handleChange} />
                        </InputGroup>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
                            <InputGroup label="City">
                                <Input className="input-premium" name="city" value={formData.city} onChange={handleChange} />
                            </InputGroup>
                            <InputGroup label="State">
                                <Input className="input-premium" name="state" value={formData.state} onChange={handleChange} />
                            </InputGroup>
                            <InputGroup label="Zip Code">
                                <Input className="input-premium" name="zip_code" value={formData.zip_code} onChange={handleChange} />

                            </InputGroup>
                        </div>
                        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-start' }}>
                            <button 
                                onClick={handleRecalculateCommutes} 
                                disabled={isRecalculating || loading}
                                className="btn-secondary" 
                                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                                    {isRecalculating ? 'sync' : 'directions_car'}
                                </span>
                                {isRecalculating ? 'Recalculating...' : 'Recalculate All Commutes'}
                            </button>
                        </div>
                    </section>

                </div>

                {/* Right Column: Contact + Social */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <section className="card">
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: 'var(--primary-light)', fontWeight: 600 }}>Contact Details</h3>
                        <InputGroup label="Email Address">
                            <Input className="input-premium" name="email" value={formData.email} onChange={handleChange} placeholder="john@example.com" />
                        </InputGroup>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                            <InputGroup label="Primary Phone">
                                <Input className="input-premium" name="phone_primary" value={formData.phone_primary} onChange={handleChange} placeholder="(555) 123-4567" />
                            </InputGroup>
                            <InputGroup label="Secondary Phone">
                                <Input className="input-premium" name="phone_secondary" value={formData.phone_secondary} onChange={handleChange} placeholder="Optional" />

                            </InputGroup>
                        </div>
                        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-start' }}>
                            <button 
                                onClick={handleRecalculateCommutes} 
                                disabled={isRecalculating || loading}
                                className="btn-secondary" 
                                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                                    {isRecalculating ? 'sync' : 'directions_car'}
                                </span>
                                {isRecalculating ? 'Recalculating...' : 'Recalculate All Commutes'}
                            </button>
                        </div>
                    </section>


                    <section className="card">
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: 'var(--primary-light)', fontWeight: 600 }}>Social & Links</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <InputGroup label="LinkedIn URL" style={{ marginBottom: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                    <span style={{ padding: '0.8rem 1rem', color: 'var(--text-muted)', borderRight: '1px solid var(--border-color)', background: 'var(--bg-secondary)', minWidth: '45px', textAlign: 'center' }}>in</span>
                                    <input
                                        name="linkedin_url" value={formData.linkedin_url} onChange={handleChange}
                                        className="input-premium"
                                        style={{ flex: 1, padding: '0.8rem', border: 'none', background: 'transparent' }}
                                        placeholder="linkedin.com/in/..."
                                    />
                                </div>
                            </InputGroup>
                            <InputGroup label="GitHub URL" style={{ marginBottom: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                    <span style={{ padding: '0.8rem 1rem', color: 'var(--text-muted)', borderRight: '1px solid var(--border-color)', background: 'var(--bg-secondary)', minWidth: '45px', textAlign: 'center' }}>git</span>
                                    <input
                                        name="github_url" value={formData.github_url} onChange={handleChange}
                                        className="input-premium"
                                        style={{ flex: 1, padding: '0.8rem', border: 'none', background: 'transparent' }}
                                        placeholder="github.com/..."
                                    />
                                </div>
                            </InputGroup>
                            <InputGroup label="Portfolio / Website" style={{ marginBottom: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.8rem 1rem', color: 'var(--text-muted)', borderRight: '1px solid var(--border-color)', background: 'var(--bg-secondary)', minWidth: '45px', textAlign: 'center' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>language</span>
                                    </span>
                                    <input
                                        name="website_url" value={formData.website_url} onChange={handleChange}
                                        className="input-premium"
                                        style={{ flex: 1, padding: '0.8rem', border: 'none', background: 'transparent' }}
                                        placeholder="https://..."
                                    />
                                </div>
                            </InputGroup>

                            {formData.social_links.map((link, i) => (
                                <InputGroup key={i} label={`Custom Link #${i + 1}`} style={{ marginBottom: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                        <input
                                            className="input-premium"
                                            placeholder="Label (e.g. Twitter)"
                                            value={link.name}
                                            onChange={(e) => handleArrayItemUpdate('social_links', i, 'name', e.target.value)}
                                            style={{ width: '120px', padding: '0.8rem', border: 'none', borderRight: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
                                        />
                                        <input
                                            className="input-premium"
                                            placeholder="https://..."
                                            value={link.url}
                                            onChange={(e) => handleArrayItemUpdate('social_links', i, 'url', e.target.value)}
                                            style={{ flex: 1, padding: '0.8rem', border: 'none', background: 'transparent' }}
                                        />
                                        <button onClick={() => removeArrayItem('social_links', i)} style={{ padding: '0 0.8rem', background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Remove Link">
                                            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>close</span>
                                        </button>
                                    </div>
                                </InputGroup>
                            ))}
                            <button
                                onClick={() => addArrayItem('social_links', { name: '', url: '' })}
                                className="btn-secondary"
                                style={{ marginTop: '0.5rem', alignSelf: 'flex-start', padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>add</span>
                                Add Custom Link
                            </button>
                        </div>
                    </section>
                </div>
                </div>
            </CollapsibleSection>

            {/* Resume Data Section (Skills, Experience, etc.) */}
            <CollapsibleSection title="Resume Data" icon={<span className="material-symbols-outlined">description</span>} defaultExpanded={true}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

                {/* Skills Section */}
                <CollapsibleCard 
                    title="Skills" 
                    defaultExpanded={false}
                    onAdd={() => setIsAddingSkill(true)}
                    addTitle="Add Skill"
                >

                    {isAddingSkill && (
                        <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
                            <input
                                className="input-premium"
                                autoFocus
                                value={newSkill}
                                onChange={(e) => setNewSkill(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && addSkill()}
                                onBlur={() => { if (!newSkill) setIsAddingSkill(false); }} // Close if empty on blur
                                placeholder="Type skill..."
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem', width: '200px' }}
                            />
                            <button onClick={addSkill} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>Add</button>
                        </div>
                    )}

                    <div className="skill-badge-container" style={{ minHeight: '40px', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                        {formData.skills.length === 0 && !isAddingSkill && <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No skills added. Click + to add.</span>}
                        {formData.skills.map((skill, i) => (
                            <span key={i} className="skill-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                                {editingSkillIndex === i ? (
                                    <input
                                        autoFocus
                                        defaultValue={skill}
                                        onBlur={(e) => updateSkill(i, e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && updateSkill(i, e.target.value)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            borderBottom: '1px solid white',
                                            color: 'white',
                                            outline: 'none',
                                            width: `${Math.max(skill.length, 5)}ch`
                                        }}
                                    />
                                ) : (
                                    <span onClick={() => setEditingSkillIndex(i)} style={{ cursor: 'text' }}>{skill}</span>
                                )}
                                <span
                                    onClick={(e) => { e.stopPropagation(); removeArrayItem('skills', i); }}
                                    className="material-symbols-outlined"
                                    style={{ cursor: 'pointer', opacity: 0.6, fontSize: '1.1rem', fontWeight: 'bold' }}
                                    title="Delete Skill"
                                >close</span>
                            </span>
                        ))}
                    </div>
                </CollapsibleCard>

                {/* Experience Section */}
                <CollapsibleCard 
                    title="Experience" 
                    defaultExpanded={false}
                    onAdd={() => addArrayItem('experiences', { company: '', position: '', start_date: '', end_date: '', description: '' })}
                    addTitle="Add Experience"
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {formData.experiences.map((exp, i) => (
                            <div key={i} className="timeline-card" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary-light)', textTransform: 'uppercase' }}>Experience #{i + 1}</span>
                                    <button onClick={() => removeArrayItem('experiences', i)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }} title="Delete">
                                        <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>delete</span>
                                    </button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <InputGroup label="Position">
                                        <input className="input-premium" value={exp.position} onChange={(e) => handleArrayItemUpdate('experiences', i, 'position', e.target.value)} />
                                    </InputGroup>
                                    <InputGroup label="Company">
                                        <input className="input-premium" value={exp.company} onChange={(e) => handleArrayItemUpdate('experiences', i, 'company', e.target.value)} />
                                    </InputGroup>
                                    <InputGroup label="Start Date">
                                        <input className="input-premium" value={exp.start_date} onChange={(e) => handleArrayItemUpdate('experiences', i, 'start_date', e.target.value)} />
                                    </InputGroup>
                                    <InputGroup label="End Date">
                                        <input className="input-premium" value={exp.end_date} onChange={(e) => handleArrayItemUpdate('experiences', i, 'end_date', e.target.value)} />
                                    </InputGroup>
                                </div>
                                <div style={{ marginTop: '1rem' }}>
                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>Description / Achievements</label>
                                    <textarea
                                        className="input-premium"
                                        value={exp.description}
                                        onChange={(e) => handleArrayItemUpdate('experiences', i, 'description', e.target.value)}
                                        style={{ width: '100%', minHeight: '100px', resize: 'vertical', padding: '0.8rem' }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                    {formData.experiences.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No experience listed.</p>}
                </CollapsibleCard>

                {/* Education Section */}
                <CollapsibleCard 
                    title="Education" 
                    defaultExpanded={false}
                    onAdd={() => addArrayItem('educations', { institution: '', degree: '', field_of_study: '', start_date: '', end_date: '' })}
                    addTitle="Add Education"
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {formData.educations.map((edu, i) => (
                            <div key={i} className="timeline-card" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary-light)', textTransform: 'uppercase' }}>Education #{i + 1}</span>
                                    <button onClick={() => removeArrayItem('educations', i)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }} title="Delete">
                                        <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>delete</span>
                                    </button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <InputGroup label="Institution">
                                        <input className="input-premium" value={edu.institution} onChange={(e) => handleArrayItemUpdate('educations', i, 'institution', e.target.value)} />
                                    </InputGroup>
                                    <InputGroup label="Degree">
                                        <input className="input-premium" value={edu.degree} onChange={(e) => handleArrayItemUpdate('educations', i, 'degree', e.target.value)} />
                                    </InputGroup>
                                    <InputGroup label="Field of Study">
                                        <input className="input-premium" value={edu.field_of_study} onChange={(e) => handleArrayItemUpdate('educations', i, 'field_of_study', e.target.value)} />
                                    </InputGroup>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <InputGroup label="Start Date">
                                            <input className="input-premium" value={edu.start_date} onChange={(e) => handleArrayItemUpdate('educations', i, 'start_date', e.target.value)} />
                                        </InputGroup>
                                        <InputGroup label="End Date">
                                            <input className="input-premium" value={edu.end_date} onChange={(e) => handleArrayItemUpdate('educations', i, 'end_date', e.target.value)} />
                                        </InputGroup>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {formData.educations.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No education listed.</p>}
                </CollapsibleCard>

                {/* Certificates Section */}
                <CollapsibleCard 
                    title="Certificates" 
                    defaultExpanded={false}
                    onAdd={() => addArrayItem('certificates', { name: '', issuer: '', date: '', url: '' })}
                    addTitle="Add Certificate"
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {formData.certificates.map((cert, i) => (
                            <div key={i} className="timeline-card" style={{ border: '1px solid rgba(255,255,255,0.05)', padding: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary-light)' }}>CERTIFICATE #{i + 1}</span>
                                    <button onClick={() => removeArrayItem('certificates', i)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }} title="Delete">
                                        <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>delete</span>
                                    </button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                    <input className="input-premium" placeholder="Name" value={cert.name} onChange={(e) => handleArrayItemUpdate('certificates', i, 'name', e.target.value)} style={{ padding: '0.5rem' }} />
                                    <input className="input-premium" placeholder="Issuer" value={cert.issuer} onChange={(e) => handleArrayItemUpdate('certificates', i, 'issuer', e.target.value)} style={{ padding: '0.5rem' }} />
                                    <input className="input-premium" placeholder="Date" value={cert.date} onChange={(e) => handleArrayItemUpdate('certificates', i, 'date', e.target.value)} style={{ padding: '0.5rem' }} />
                                    <input className="input-premium" placeholder="URL" value={cert.url} onChange={(e) => handleArrayItemUpdate('certificates', i, 'url', e.target.value)} style={{ padding: '0.5rem' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                    {formData.certificates.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No certificates listed.</p>}
                </CollapsibleCard>

                {/* Other Section */}
                <CollapsibleCard 
                    title="Other Information" 
                    defaultExpanded={false}
                    onAdd={() => addArrayItem('other', { title: '', content: '' })}
                    addTitle="Add Entry"
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {formData.other.map((item, i) => (
                            <div key={i} className="timeline-card" style={{ border: '1px solid rgba(255,255,255,0.05)', padding: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary-light)' }}>ENTRY #{i + 1}</span>
                                    <button onClick={() => removeArrayItem('other', i)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }} title="Delete">
                                        <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>delete</span>
                                    </button>
                                </div>
                                <input className="input-premium" placeholder="Title (e.g. Languages, Projects)" value={item.title} onChange={(e) => handleArrayItemUpdate('other', i, 'title', e.target.value)} style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }} />
                                <textarea
                                    className="input-premium"
                                    placeholder="Details..."
                                    value={item.content}
                                    onChange={(e) => handleArrayItemUpdate('other', i, 'content', e.target.value)}
                                    style={{ width: '100%', minHeight: '60px', padding: '0.5rem' }}
                                />
                            </div>
                        ))}
                    </div>
                    {formData.other.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No other information listed.</p>}
                </CollapsibleCard>

                </div>
            </CollapsibleSection>
        </div >
    );
};

export default Profile;
