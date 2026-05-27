import React, { useState, useEffect, useRef } from 'react';
import CustomDropdown from '../components/CustomDropdown';
import CustomMultiSelect from '../components/CustomMultiSelect';
import ProcessVisualization from '../ProcessVisualization';
import { useAuth } from '../context/AuthContext';
import ProfilePhotoModal from '../components/ProfilePhotoModal';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const InputGroup = ({ label, children, style }) => (
    <div className="form-group" style={{ ...style }}>
        <label className="form-label">{label}</label>
        {children}
    </div>
);

const Input = (props) => (
    <input
        {...props}
        className="form-input"
        style={{ fontSize: '0.95rem', ...props.style }}
    />
);

const CollapsibleSection = ({ icon, title, defaultExpanded, children, style }) => {
    const [expanded, setExpanded] = useState(defaultExpanded);

    return (
        <div style={{ marginBottom: expanded ? '3rem' : '1.5rem', transition: 'margin 0.3s ease', ...style }}>
            <h2 
                className="section-title-premium" 
                onClick={() => setExpanded(!expanded)}
                style={{ 
                    marginBottom: expanded ? '1.5rem' : '0', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    userSelect: 'none',
                    borderBottomColor: expanded ? 'var(--bg-tertiary)' : 'transparent'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {icon && <span className="material-symbols-outlined" style={{ color: 'var(--primary-light)' }}>{icon}</span>}
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
        <section className="card" style={{ padding: '1.25rem', ...style }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: expanded ? '1.5rem' : '0', cursor: 'pointer', userSelect: 'none' }} onClick={() => setExpanded(!expanded)}>
                <h3 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--primary-light)', fontWeight: 600 }}>{title}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {onAdd && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onAdd(); }}
                            className="btn-secondary"
                            title={addTitle || "Add"}
                            style={{
                                padding: '0',
                                width: '28px',
                                height: '28px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '50%',
                                border: '1px solid var(--border-color-card)'
                            }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>add</span>
                        </button>
                    )}
                    <span className="material-symbols-outlined" style={{ color: 'var(--text-muted)', fontSize: '1.2rem', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease' }}>
                        expand_more
                    </span>
                </div>
            </div>
            {expanded && (
                <div style={{ animation: 'fadeIn 0.3s ease-out', marginTop: '1.25rem' }}>
                    {children}
                </div>
            )}
        </section>
    );
};

const Profile = () => {
    const { fetchWithAuth, user: authUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [photoData, setPhotoData] = useState({
        photo_url: '',
        photo_zoom: 1.0,
        photo_x: 0,
        photo_y: 0
    });
    
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

    const [isRecalculating, setIsRecalculating] = useState(false);
    const [draggedItemIndex, setDraggedItemIndex] = useState(null);
    const [dragOverItemIndex, setDragOverItemIndex] = useState(null);

    const handleRecalculateCommutes = async () => {
        setIsRecalculating(true);
        try {
            const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api/profile/recalculate-commutes`, {
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
        recommendations: [],
        other: [],
        social_links: [],
        preferences: { max_commute: '', work_setting: '', expected_salary: '' },
        base_resume_path: null,
        long_form_resume_path: null,
        example_cover_letter_path: null,
        additional_docs: [],
    });
    const [extractedData, setExtractedData] = useState(null);
    const [selectedFields, setSelectedFields] = useState({});
    const [expandedSections, setExpandedSections] = useState({});
    const [showLinkedInModal, setShowLinkedInModal] = useState(false);
    const [linkedInTab, setLinkedInTab] = useState('extension'); // 'extension' | 'paste'
    const [linkedInPastedText, setLinkedInPastedText] = useState('');
    const [importingLinkedIn, setImportingLinkedIn] = useState(false);
    const [linkedInError, setLinkedInError] = useState('');
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

    // Example cover letter state
    const [uploadingExampleCoverLetter, setUploadingExampleCoverLetter] = useState(false);
    const exampleCoverLetterInputRef = useRef(null);

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
        const loadAccount = async () => {
            try {
                const res = await fetchWithAuth(`${API_URL}/api/auth/me`);
                if (res.ok) {
                    const data = await res.json();
                    setPhotoData({
                        photo_url: data.photo_url || '',
                        photo_zoom: data.photo_zoom || 1.0,
                        photo_x: data.photo_x || 0,
                        photo_y: data.photo_y || 0,
                    });
                }
            } catch (e) { console.error('Failed to load profile photo data', e); }
        };
        loadAccount();
        fetchProfile();
    }, []);

    const handlePhotoSuccess = (data) => {
        setPhotoData({
            photo_url: data.photo_url,
            photo_zoom: data.photo_zoom,
            photo_x: data.photo_x,
            photo_y: data.photo_y
        });
        setIsDirty(true);
    };

    const fetchProfile = async () => {
        try {
            const res = await fetchWithAuth(`${API_URL}/api/profile`);
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
                        preferences: data.preferences || { 
                            max_commute: '', 
                            work_setting: '', 
                            expected_salary: '',
                            prioritization_categories: [
                                { id: 'role_fit', label: 'Role Fit', icon: 'work' },
                                { id: 'career_growth', label: 'Growth', icon: 'trending_up' },
                                { id: 'total_comp', label: 'Compensation', icon: 'payments' },
                                { id: 'wlb', label: 'WLB', icon: 'balance' },
                                { id: 'manager_team', label: 'Team', icon: 'groups' }
                            ]
                        },
                        base_resume_path: data.base_resume_path || null,
                        long_form_resume_path: data.long_form_resume_path || null,
                        example_cover_letter_path: data.example_cover_letter_path || null,
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
            const res = await fetchWithAuth(`${API_URL}/api/profile/upload-resume`, { method: 'POST', body: fd });
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
            const res = await fetchWithAuth(`${API_URL}/api/profile/resume/${type}`, { method: 'DELETE' });
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

    const handleExampleCoverLetterUpload = async (file) => {
        if (!file) return;
        setUploadingExampleCoverLetter(true);
        const fd = new FormData();
        fd.append('document', file);
        try {
            const res = await fetchWithAuth(`${API_URL}/api/profile/upload-example-cover-letter`, { method: 'POST', body: fd });
            if (res.ok) {
                const data = await res.json();
                setFormData(prev => ({ ...prev, example_cover_letter_path: data.path }));
                showNotification(`Example cover letter saved!`, 'success');
            } else {
                showNotification('Failed to upload example cover letter.', 'error');
            }
        } catch {
            showNotification('Error uploading example cover letter.', 'error');
        } finally {
            setUploadingExampleCoverLetter(false);
        }
    };

    const handleDeleteExampleCoverLetter = async () => {
        try {
            const res = await fetchWithAuth(`${API_URL}/api/profile/example-cover-letter`, { method: 'DELETE' });
            if (res.ok) {
                setFormData(prev => ({ ...prev, example_cover_letter_path: null }));
                showNotification('Example cover letter removed.', 'info');
            }
        } catch {
            showNotification('Error removing example cover letter.', 'error');
        }
    };

    const handleExampleCoverLetterFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        await handleExampleCoverLetterUpload(file);
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
                const res = await fetchWithAuth(`${API_URL}/api/profile/upload-additional-doc`, { method: 'POST', body: fd });
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
            const res = await fetchWithAuth(`${API_URL}/api/profile/additional-doc?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
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

    const handleReorderCategories = (index, direction) => {
        setFormData(prev => {
            const categories = prev.preferences?.prioritization_categories || [
                { id: 'role_fit', label: 'Role Fit', icon: 'work' },
                { id: 'career_growth', label: 'Growth', icon: 'trending_up' },
                { id: 'total_comp', label: 'Compensation', icon: 'payments' },
                { id: 'wlb', label: 'WLB', icon: 'balance' },
                { id: 'manager_team', label: 'Team', icon: 'groups' }
            ];
            const newIndex = index + direction;
            if (newIndex < 0 || newIndex >= categories.length) return prev;
            
            const nextCategories = [...categories];
            const [moved] = nextCategories.splice(index, 1);
            nextCategories.splice(newIndex, 0, moved);
            
            return {
                ...prev,
                preferences: {
                    ...prev.preferences,
                    prioritization_categories: nextCategories
                }
            };
        });
        setIsDirty(true);
    };

    const handleDragStart = (e, index) => {
        e.currentTarget.style.transition = "none";
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", index.toString());
        
        if (e.dataTransfer.setDragImage) {
            e.dataTransfer.setDragImage(e.currentTarget, 20, 20);
        }

        setTimeout(() => {
            setDraggedItemIndex(index);
        }, 50);
    };

    const handleDragEnter = (e, index) => {
        setDragOverItemIndex(index);
    };

    const handleDragEnd = () => {
        setDraggedItemIndex(null);
        setDragOverItemIndex(null);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e, targetIndex) => {
        e.preventDefault();
        if (draggedItemIndex === null || draggedItemIndex === targetIndex) {
            setDraggedItemIndex(null);
            setDragOverItemIndex(null);
            return;
        }

        setFormData(prev => {
            const categories = [...(prev.preferences?.prioritization_categories || [
                { id: 'role_fit', label: 'Role Fit', icon: 'work' },
                { id: 'career_growth', label: 'Growth', icon: 'trending_up' },
                { id: 'total_comp', label: 'Compensation', icon: 'payments' },
                { id: 'wlb', label: 'WLB', icon: 'balance' },
                { id: 'manager_team', label: 'Team', icon: 'groups' }
            ])];
            
            const [moved] = categories.splice(draggedItemIndex, 1);
            categories.splice(targetIndex, 0, moved);
            
            return {
                ...prev,
                preferences: {
                    ...prev.preferences,
                    prioritization_categories: categories
                }
            };
        });
        setIsDirty(true);
        setDraggedItemIndex(null);
        setDragOverItemIndex(null);
    };

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
            const res = await fetchWithAuth(`${API_URL}/api/profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            // Also save the custom photo URL and adjustment offsets
            const photoRes = await fetchWithAuth(`${API_URL}/api/user/account`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    photo_url: photoData.photo_url.trim() || null,
                    photo_zoom: parseFloat(photoData.photo_zoom),
                    photo_x: parseFloat(photoData.photo_x),
                    photo_y: parseFloat(photoData.photo_y),
                })
            });

            if (res.ok && photoRes.ok) {
                showNotification('Profile and photo saved successfully!', 'success');
                setIsDirty(false);
                // Re-fetch to sync server-preserved fields (resume paths, etc.)
                await fetchProfile();
            } else {
                showNotification('Error saving profile or photo.', 'error');
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

    const applyLinkedInData = (data) => {
        const changes = {};
        let hasChanges = false;
        Object.entries(data).forEach(([key, val]) => {
            if (Array.isArray(val)) {
                if (val.length > 0) {
                    changes[key] = val;
                    hasChanges = true;
                }
            } else if (val && val !== formData[key]) {
                changes[key] = val;
                hasChanges = true;
            }
        });

        if (hasChanges) {
            setExtractedData(changes);
            const initialSelection = {};
            Object.keys(changes).forEach(k => initialSelection[k] = true);
            setSelectedFields(initialSelection);
            setShowLinkedInModal(false);
        } else {
            showNotification('No new information found on LinkedIn profile.', 'info');
        }
    };

    const handleExtensionImport = () => {
        setImportingLinkedIn(true);
        setLinkedInError('');

        // Listen for the response from the content script
        const messageHandler = (event) => {
            if (event.source !== window) return;
            if (event.data && event.data.type === 'JOB_AUTOMATOR_SCRAPE_LINKEDIN_RESPONSE') {
                window.removeEventListener('message', messageHandler);
                clearTimeout(timeout);
                
                const response = event.data.response;
                if (response && response.success) {
                    applyLinkedInData(response.data);
                } else {
                    setLinkedInError(response?.error || 'Failed to import from LinkedIn. Make sure you are logged in to LinkedIn.');
                }
                setImportingLinkedIn(false);
            }
        };

        window.addEventListener('message', messageHandler);

        // Send message to content script
        window.postMessage({ type: 'JOB_AUTOMATOR_SCRAPE_LINKEDIN' }, '*');

        // Timeout in case extension is not installed
        const timeout = setTimeout(() => {
            window.removeEventListener('message', messageHandler);
            setLinkedInError('Could not communicate with the extension. Is it installed and active on this page?');
            setImportingLinkedIn(false);
        }, 3000);
    };

    const handleLinkedInImport = async () => {
        if (linkedInTab === 'extension') {
            handleExtensionImport();
            return;
        }

        if (!linkedInPastedText.trim()) return;

        setImportingLinkedIn(true);
        setLinkedInError('');
        try {
            const res = await fetchWithAuth(`${API_URL}/api/extract-profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: linkedInPastedText })
            });

            if (res.ok) {
                const data = await res.json();
                applyLinkedInData(data);
            } else {
                setLinkedInError('Failed to parse LinkedIn text. Please try again.');
            }
        } catch (e) {
            setLinkedInError('Connection error while processing LinkedIn data.');
        } finally {
            setImportingLinkedIn(false);
        }
    };

    const runProfileScan = async (file) => {
        setScanning(true);
        const uploadData = new FormData();
        uploadData.append('resume', file);
        try {
            const res = await fetchWithAuth(`${API_URL}/api/scan-contact-info`, { method: 'POST', body: uploadData });
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
        <div ref={containerRef} className="page-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 var(--page-px) var(--page-py) var(--page-px)', position: scanning ? 'fixed' : 'relative' }}>
            {scanning && (
                <div className="modal-overlay" style={{ background: 'var(--bg-overlay)', backdropFilter: 'blur(8px)' }}>
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
                margin: '0 calc(-1 * var(--page-px)) 2rem calc(-1 * var(--page-px))',
                paddingLeft: 'var(--page-px)',
                paddingRight: 'var(--page-px)',
                borderBottom: isSticky ? '1px solid var(--border-color)' : 'none',
                transition: 'all var(--transition-base)'
            }}>
                <div>
                    <h1 style={{ fontSize: isSticky ? '1.5rem' : '2rem', marginBottom: isSticky ? 0 : '0.5rem', transition: 'all var(--transition-base)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: isSticky ? '1.8rem' : '2.4rem', color: 'var(--primary)' }}>person</span>
                        User Profile
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', display: isSticky ? 'none' : 'block' }}>Manage your contact info for cover letters.</p>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={() => setShowLinkedInModal(true)}
                        className="btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <img src="https://static.licdn.com/aero-v1/sc/h/al2o9zrvru7aqj8e1x2rzsrca" alt="LinkedIn" style={{ width: '16px', height: '16px' }} />
                        Import from LinkedIn
                    </button>

                    <button
                        onClick={() => fileInputRef.current.click()}
                        disabled={scanning}
                        className="btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
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
                        className="btn-primary"
                        style={{ padding: '0.6rem 1.5rem' }}
                    >
                        {saving ? 'Saving...' : 'Save Profile'}
                    </button>
                </div>
            </header>

            {/* Diff Modal */}
            {
                extractedData && (
                    <div className="modal-overlay" style={{ background: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }}>
                        <div style={{
                            background: 'var(--bg-card)', padding: '2.5rem', borderRadius: 'var(--radius-lg)', maxWidth: '1000px', width: '95%',
                            maxHeight: '85vh', display: 'flex', flexDirection: 'column',
                            boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-color)'
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
                                            background: selectedFields[key] ? 'var(--primary-glow)' : 'transparent',
                                            borderRadius: 'var(--radius-md)',
                                            borderBottom: '1px solid var(--border-color)',
                                            transition: 'background var(--transition-base)'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={!!selectedFields[key]}
                                                    onChange={(e) => setSelectedFields(prev => ({ ...prev, [key]: e.target.checked }))}
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
                                                borderRight: '1px solid var(--border-color)'
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
                                                                className="btn-secondary"
                                                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                                                            >
                                                                {expandedSections[key] ? 'Collapse' : 'View / Edit Entries'}
                                                            </button>
                                                        </div>

                                                        {expandedSections[key] && (
                                                            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                                {val.map((item, idx) => (
                                                                    <div key={idx} className="timeline-card" style={{ padding: '1rem', marginBottom: 0, border: '1px solid var(--border-color)' }}>
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
                                                                                className="form-input"
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
                                                                                                className="form-input"
                                                                                                value={subVal}
                                                                                                onChange={(e) => handleExtractedArrayItemChange(key, idx, subKey, e.target.value)}
                                                                                                style={{ width: '100%', padding: '0.5rem', minHeight: '60px', fontSize: '0.85rem' }}
                                                                                            />
                                                                                        ) : (
                                                                                            <input
                                                                                                className="form-input"
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
                                                        className="form-input"
                                                        style={{
                                                            width: '100%',
                                                            minHeight: '40px',
                                                            fontSize: '0.9rem',
                                                            padding: '0.5rem',
                                                            background: 'var(--bg-input)',
                                                            border: selectedFields[key] ? '1px solid var(--primary)' : '1px solid var(--border-color-input)'
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                                <button
                                    onClick={() => setExtractedData(null)}
                                    className="btn-secondary"
                                    style={{ padding: '0.6rem 1.2rem' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmUpdate}
                                    className="btn-primary"
                                    style={{ padding: '0.6rem 1.2rem' }}
                                >
                                    Update Selected
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* LinkedIn Import Modal */}
            {showLinkedInModal && (
                <div className="modal-overlay" style={{ background: 'var(--bg-overlay)', backdropFilter: 'blur(8px)' }}>
                    <div style={{
                        background: 'var(--bg-card)', padding: '2rem', borderRadius: 'var(--radius-lg)', maxWidth: '600px', width: '90%',
                        boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-color)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)' }}>Import LinkedIn Profile</h2>
                            <button onClick={() => setShowLinkedInModal(false)} className="btn-icon" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                            <button
                                onClick={() => setLinkedInTab('extension')}
                                style={{
                                    padding: '0.5rem 1rem', background: 'transparent', border: 'none', borderBottom: linkedInTab === 'extension' ? '2px solid var(--primary)' : 'none',
                                    color: linkedInTab === 'extension' ? 'var(--primary-light)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 500
                                }}
                            >
                                Import via Extension
                            </button>
                            <button
                                onClick={() => setLinkedInTab('paste')}
                                style={{
                                    padding: '0.5rem 1rem', background: 'transparent', border: 'none', borderBottom: linkedInTab === 'paste' ? '2px solid var(--primary)' : 'none',
                                    color: linkedInTab === 'paste' ? 'var(--primary-light)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 500
                                }}
                            >
                                Paste Profile Text
                            </button>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            {linkedInTab === 'extension' ? (
                                <div style={{ textAlign: 'center', padding: '1rem' }}>
                                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                                        The extension will use your active LinkedIn session to directly extract your profile details. No typing or scraping needed!
                                    </p>
                                    <div style={{
                                        padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)',
                                        fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'left'
                                    }}>
                                        <strong>Note:</strong> Ensure you are signed in to LinkedIn in another tab for this to work.
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                                        Go to your LinkedIn profile, Select All (Ctrl+A), Copy (Ctrl+C), and Paste here:
                                    </p>
                                    <textarea
                                        value={linkedInPastedText}
                                        onChange={(e) => setLinkedInPastedText(e.target.value)}
                                        placeholder="Paste your LinkedIn profile text here..."
                                        className="form-input"
                                        style={{ width: '100%', minHeight: '150px', padding: '1rem', fontSize: '0.9rem' }}
                                    />
                                </div>
                            )}
                        </div>

                        {linkedInError && (
                            <div style={{ padding: '0.75rem', background: 'var(--primary-glow)', color: 'var(--error)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', marginBottom: '1.5rem', border: '1px solid var(--error)', opacity: 0.9 }}>
                                {linkedInError}
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button
                                onClick={() => setShowLinkedInModal(false)}
                                className="btn-secondary"
                                style={{ padding: '0.6rem 1.2rem' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleLinkedInImport}
                                disabled={importingLinkedIn || (linkedInTab === 'paste' && !linkedInPastedText.trim())}
                                className="btn-primary"
                                style={{
                                    padding: '0.6rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    opacity: (importingLinkedIn || (linkedInTab === 'paste' && !linkedInPastedText.trim())) ? 0.6 : 1
                                }}
                            >
                                {importingLinkedIn ? (
                                    <>
                                        <span className="spinner-small"></span> Importing...
                                    </>
                                ) : (
                                    'Import Profile'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {
                notification && (
                    <div style={{
                        padding: '1rem', marginBottom: '1.5rem', borderRadius: 'var(--radius-md)',
                        background: notification.type === 'success' ? 'rgba(var(--primary-rgb), 0.1)' : 'var(--primary-glow)',
                        color: notification.type === 'success' ? 'var(--success)' : (notification.type === 'info' ? 'var(--info)' : 'var(--error)'),
                        border: `1px solid ${notification.type === 'success' ? 'var(--success)' : (notification.type === 'info' ? 'var(--info)' : 'var(--error)')}`,
                        opacity: 0.9
                    }}>
                        {notification.msg}
                    </div>
                )
            }


            {/* ===== RESUMES + DOCS — SINGLE ROW ===== */}
            <CollapsibleSection title="My Documents" icon={<span className="material-symbols-outlined">attach_file</span>} defaultExpanded={true}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>

                {/* ── Base Resume ── */}
                <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{ width: '30px', height: '30px', borderRadius: 'var(--radius-sm)', background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
                            <div title={fname} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.6rem', background: 'var(--primary-glow)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: 'var(--primary-light)', flexShrink: 0 }}>description</span>
                                <span onClick={() => openDocViewer(formData.base_resume_path, fname)} style={{ fontSize: '0.78rem', color: 'var(--primary-light)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', textDecoration: 'underline' }}>{short}</span>
                                <button onClick={() => handleDeleteResume('base')} title="Remove" style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0, padding: '0 2px' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>close</span>
                                </button>
                            </div>
                        );
                    })() : (
                        <div onClick={() => baseResumeInputRef.current?.click()} style={{ border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.1rem', textAlign: 'center', cursor: 'pointer', flex: 1, transition: 'all var(--transition-base)' }} className="upload-dropzone">
                            <span className="material-symbols-outlined" style={{ fontSize: '1.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem', display: 'block' }}>upload</span>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>Click to upload (.docx)</p>
                        </div>
                    )}
                    <input type="file" accept=".docx" ref={baseResumeInputRef} style={{ display: 'none' }} onChange={(e) => handleResumeFileSelect(e, 'base')} />
                </section>

                {/* ── Long-Form Resume ── */}
                <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{ width: '30px', height: '30px', borderRadius: 'var(--radius-sm)', background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: 'var(--secondary)' }}>assignment</span>
                        </div>
                        <div>
                            <h3 style={{ fontSize: '0.95rem', margin: 0, color: 'var(--secondary)', fontWeight: 600 }}>Long-Form Resume</h3>
                            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>Extended detail &amp; history</p>
                        </div>
                    </div>
                    {formData.long_form_resume_path ? (() => {
                        const fname = formData.long_form_resume_path.split('/').pop();
                        const short = fname.length > 18 ? fname.slice(0, 15) + '…' : fname;
                        return (
                            <div title={fname} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.6rem', background: 'var(--primary-glow)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: 'var(--secondary)', flexShrink: 0 }}>assignment</span>
                                <span onClick={() => openDocViewer(formData.long_form_resume_path, fname)} style={{ fontSize: '0.78rem', color: 'var(--secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', textDecoration: 'underline' }}>{short}</span>
                                <button onClick={() => handleDeleteResume('long_form')} title="Remove" style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0, padding: '0 2px' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>close</span>
                                </button>
                            </div>
                        );
                    })() : (
                        <div onClick={() => longFormResumeInputRef.current?.click()} style={{ border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.1rem', textAlign: 'center', cursor: 'pointer', flex: 1, transition: 'all var(--transition-base)' }} className="upload-dropzone">
                            <span className="material-symbols-outlined" style={{ fontSize: '1.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem', display: 'block' }}>upload</span>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>Click to upload (.docx)</p>
                        </div>
                    )}
                    <input type="file" accept=".docx" ref={longFormResumeInputRef} style={{ display: 'none' }} onChange={(e) => handleResumeFileSelect(e, 'long_form')} />
                </section>

                {/* ── Example Cover Letter ── */}
                <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{ width: '30px', height: '30px', borderRadius: 'var(--radius-sm)', background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: 'var(--info)' }}>mail</span>
                        </div>
                        <div>
                            <h3 style={{ fontSize: '0.95rem', margin: 0, color: 'var(--info)', fontWeight: 600 }}>Example Cover Letter</h3>
                            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>For tone, structure &amp; style</p>
                        </div>
                    </div>
                    {formData.example_cover_letter_path ? (() => {
                        const fname = formData.example_cover_letter_path.split('/').pop();
                        const short = fname.length > 18 ? fname.slice(0, 15) + '…' : fname;
                        return (
                            <div title={fname} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.6rem', background: 'var(--primary-glow)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: 'var(--info)', flexShrink: 0 }}>mail</span>
                                <span onClick={() => openDocViewer(formData.example_cover_letter_path, fname)} style={{ fontSize: '0.78rem', color: 'var(--info)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', textDecoration: 'underline' }}>{short}</span>
                                <button onClick={() => handleDeleteExampleCoverLetter()} title="Remove" style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0, padding: '0 2px' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>close</span>
                                </button>
                            </div>
                        );
                    })() : (
                        <div onClick={() => exampleCoverLetterInputRef.current?.click()} style={{ border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.1rem', textAlign: 'center', cursor: 'pointer', flex: 1, transition: 'all var(--transition-base)' }} className="upload-dropzone">
                            <span className="material-symbols-outlined" style={{ fontSize: '1.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem', display: 'block' }}>upload</span>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>Click to upload (.docx, .pdf)</p>
                        </div>
                    )}
                    <input type="file" accept=".docx,.pdf" ref={exampleCoverLetterInputRef} style={{ display: 'none' }} onChange={handleExampleCoverLetterFileSelect} />
                </section>

                {/* ── Additional AI Context Docs ── */}
                <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div style={{ width: '30px', height: '30px', borderRadius: 'var(--radius-sm)', background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: 'var(--accent)' }}>folder</span>
                            </div>
                            <div>
                                <h3 style={{ fontSize: '0.95rem', margin: 0, color: 'var(--accent)', fontWeight: 600 }}>AI Context Docs</h3>
                                <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>Bios, assessments, press releases…</p>
                            </div>
                        </div>
                        <button onClick={() => additionalDocsInputRef.current?.click()} disabled={uploadingAdditionalDoc} title="Add documents" style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'var(--primary-glow)', border: '1px solid var(--border-color)', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, lineHeight: 1 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>add</span>
                        </button>
                        <input type="file" multiple accept=".docx,.pdf,.txt,.doc" ref={additionalDocsInputRef} style={{ display: 'none' }} onChange={(e) => handleAdditionalDocUpload(e.target.files)} />
                    </div>

                    {formData.additional_docs.length === 0 ? (
                        <div onClick={() => additionalDocsInputRef.current?.click()} style={{ border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.1rem', textAlign: 'center', cursor: 'pointer', flex: 1, transition: 'all var(--transition-base)' }} className="upload-dropzone">
                            <span className="material-symbols-outlined" style={{ fontSize: '1.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>upload_file</span>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>No documents yet. Click to upload certifications, awards, or projects.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', overflowY: 'auto', maxHeight: '160px' }}>
                            {formData.additional_docs.map((doc, i) => {
                                const ext = doc.filename.split('.').pop().toLowerCase();
                                const short = doc.filename.length > 18 ? doc.filename.slice(0, 15) + '…' : doc.filename;
                                return (
                                    <div key={i} title={doc.filename} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.6rem', background: 'var(--primary-glow)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: 'var(--accent)', flexShrink: 0 }}>
                                            {ext === 'pdf' ? 'picture_as_pdf' : 'description'}
                                        </span>
                                        <span onClick={() => openDocViewer(doc.path, doc.filename)} style={{ fontSize: '0.78rem', color: 'var(--accent)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', textDecoration: 'underline' }}>{short}</span>
                                        <button onClick={() => handleDeleteAdditionalDoc(doc.path)} title="Remove" style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0, padding: '0 2px' }}>
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
                         <InputGroup label="Preferred Commute Types">
                             <CustomMultiSelect
                                 value={formData.preferences?.commute_types || ['Driving']}
                                 onChange={(val) => {
                                     setFormData(prev => ({...prev, preferences: {...prev.preferences, commute_types: val}}));
                                     setIsDirty(true);
                                 }}
                                 options={[
                                     { value: 'Driving', label: 'Driving' },
                                     { value: 'Public Transportation', label: 'Public Transportation' },
                                     { value: 'Bicycle', label: 'Bicycle' },
                                     { value: 'Walking', label: 'Walking' },
                                     { value: 'Flight', label: 'Flight' }
                                 ]}
                                 placeholder="Select Commute Types"
                             />
                         </InputGroup>
                        <InputGroup label="Location Type">
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
                                placeholder="Select Location Types"
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
                    
                    <div style={{ marginTop: '3rem', borderTop: '1px solid var(--border-color-card)', paddingTop: '2rem' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--primary-light)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span className="material-symbols-outlined">sort</span>
                            Prioritization Strategy
                        </h4>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                            Drag or use arrows to reorder categories. Items at the top will be weighted more heavily (up to 5x) when scoring new roles.
                        </p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {(formData.preferences?.prioritization_categories || [
                                { id: 'role_fit', label: 'Role Fit', icon: 'work' },
                                { id: 'career_growth', label: 'Growth', icon: 'trending_up' },
                                { id: 'total_comp', label: 'Compensation', icon: 'payments' },
                                { id: 'wlb', label: 'WLB', icon: 'balance' },
                                { id: 'manager_team', label: 'Team', icon: 'groups' }
                            ]).map((cat, idx, arr) => (
                                <div 
                                    key={cat.id} 
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, idx)}
                                    onDragEnter={(e) => handleDragEnter(e, idx)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, idx)}
                                    className={`draggable-item ${draggedItemIndex === idx ? 'dragging' : ''}`}
                                    style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'space-between', 
                                        padding: '0.875rem 1.25rem', 
                                        background: draggedItemIndex === idx ? 'var(--primary-glow)' : 'var(--bg-tertiary)', 
                                        borderRadius: '0.75rem', 
                                        border: dragOverItemIndex === idx && draggedItemIndex !== idx 
                                            ? '2px dashed var(--primary)' 
                                            : '1px solid var(--border-color)',
                                        transition: draggedItemIndex === idx ? 'none' : 'all 0.2s ease',
                                        cursor: draggedItemIndex === idx ? 'grabbing' : 'grab',
                                        opacity: draggedItemIndex === idx ? 0.4 : 1,
                                        position: 'relative',
                                        zIndex: draggedItemIndex === idx ? 100 : 1,
                                        userSelect: 'none'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <span className="material-symbols-outlined" style={{ color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'inherit', userSelect: 'none' }}>drag_indicator</span>
                                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary-light)', border: '1px solid var(--border-color)' }}>
                                            {idx + 1}
                                        </div>
                                        <span className="material-symbols-outlined" style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>{cat.icon}</span>
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{cat.label}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', marginRight: '1.5rem', gap: '0.5rem' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Weight:</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>{arr.length - idx}x</span>
                                        </div>
                                        <button 
                                            onClick={() => handleReorderCategories(idx, -1)}
                                            disabled={idx === 0}
                                            className="btn-secondary"
                                            style={{ padding: '4px', minWidth: '32px', height: '32px', opacity: idx === 0 ? 0.3 : 1 }}
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>expand_less</span>
                                        </button>
                                        <button 
                                            onClick={() => handleReorderCategories(idx, 1)}
                                            disabled={idx === arr.length - 1}
                                            className="btn-secondary"
                                            style={{ padding: '4px', minWidth: '32px', height: '32px', opacity: idx === arr.length - 1 ? 0.3 : 1 }}
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>expand_more</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center' }}>
                         <button 
                             onClick={handleRecalculateCommutes} 
                             disabled={isRecalculating}
                             className="btn-secondary"
                             style={{
                                 display: 'flex',
                                 alignItems: 'center',
                                 gap: '0.6rem',
                                 padding: '0.6rem 1.2rem',
                                 opacity: isRecalculating ? 0.7 : 1,
                                 cursor: isRecalculating ? 'not-allowed' : 'pointer'
                             }}
                         >
                             <span className="material-symbols-outlined" style={{ 
                                 fontSize: '1.2rem',
                                 animation: isRecalculating ? 'spin 2s linear infinite' : 'none'
                             }}>
                                 {isRecalculating ? 'sync' : 'calculate'}
                             </span>
                             {isRecalculating ? 'Refresh All Commute Calculations' : 'Refresh All Commute Calculations'}
                         </button>
                     </div>
                </section>
            </CollapsibleSection>

            {/* ===== DOCUMENT VIEWER MODAL ===== */}
            {viewingDoc && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--bg-overlay)', zIndex: 9999, display: 'flex', flexDirection: 'column', backdropFilter: 'blur(10px)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1.4rem', color: 'var(--primary-light)' }}>description</span>
                            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{viewingDoc.filename}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <a href={viewingDoc.url} download={viewingDoc.filename} className="btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', textDecoration: 'none' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>download</span>
                                Download
                            </a>
                            <button onClick={() => setViewingDoc(null)} className="btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>close</span>
                                Close
                            </button>
                        </div>
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden', background: 'var(--bg-tertiary)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <iframe
                            src={viewingDoc.url}
                            style={{ width: '100%', height: '100%', border: 'none', background: 'var(--bg-card)', maxWidth: '1000px', boxShadow: 'var(--shadow-xl)' }}
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
                            <button className="btn btn-primary" style={{ justifyContent: 'center', gap: '0.5rem' }} onClick={async () => {
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div 
                                onClick={() => setIsPhotoModalOpen(true)}
                                title="Click to edit profile photo"
                                style={{
                                    width: '80px', height: '80px', borderRadius: '50%',
                                    background: 'var(--primary)', color: 'white',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.75rem', fontWeight: 700, flexShrink: 0,
                                    overflow: 'hidden', position: 'relative',
                                    cursor: 'pointer',
                                    border: '2px solid var(--border-color)',
                                    boxShadow: 'var(--shadow-glow)',
                                    transition: 'transform 0.2s ease'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1.0)'; }}
                            >
                                {photoData.photo_url ? (
                                    <img
                                        src={photoData.photo_url.startsWith('http') ? photoData.photo_url : `${API_URL}${photoData.photo_url}`}
                                        alt="Avatar"
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            transform: `scale(${photoData.photo_zoom}) translate(${photoData.photo_x}px, ${photoData.photo_y}px)`,
                                            transformOrigin: 'center center',
                                            pointerEvents: 'none',
                                        }}
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                ) : null}
                                {(!photoData.photo_url) && (
                                    [formData.first_name?.[0], formData.last_name?.[0]].filter(Boolean).join('').toUpperCase() || authUser?.username?.[0]?.toUpperCase() || 'U'
                                )}
                                
                                {/* Hover edit overlay */}
                                <div style={{
                                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                    background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s ease',
                                    borderRadius: '50%'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.opacity = 1; }}
                                onMouseLeave={e => { e.currentTarget.style.opacity = 0; }}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.5rem', color: 'white' }}>edit</span>
                                </div>
                            </div>
                            
                            <div style={{ flex: 1, minWidth: '180px' }}>
                                <button 
                                    type="button" 
                                    className="btn btn-secondary" 
                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                    onClick={() => setIsPhotoModalOpen(true)}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>photo_camera</span>
                                    {photoData.photo_url ? 'Edit Profile Photo' : 'Add Profile Photo'}
                                </button>
                            </div>
                        </div>

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
                                style={{ minHeight: '120px', resize: 'vertical' }}
                            />
                        </InputGroup>
                    </section>

                    <section className="card">
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--primary-light)', fontWeight: 600 }}>Address</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem', fontStyle: 'italic' }}>
                            Your full address is only used to calculate commute distances and won't be included on your resume unless explicitly specified.
                        </p>
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
                                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                    <span style={{ padding: '0.8rem 1rem', color: 'var(--text-muted)', borderRight: '1px solid var(--border-color)', background: 'var(--bg-secondary)', minWidth: '45px', textAlign: 'center', fontSize: '0.9rem', fontWeight: 600 }}>in</span>
                                    <input
                                        name="linkedin_url" value={formData.linkedin_url} onChange={handleChange}
                                        className="form-input"
                                        style={{ flex: 1, padding: '0.8rem', border: 'none', background: 'transparent' }}
                                        placeholder="linkedin.com/in/..."
                                    />
                                </div>
                            </InputGroup>
                            <InputGroup label="GitHub URL" style={{ marginBottom: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                    <span style={{ padding: '0.8rem 1rem', color: 'var(--text-muted)', borderRight: '1px solid var(--border-color)', background: 'var(--bg-secondary)', minWidth: '45px', textAlign: 'center', fontSize: '0.9rem', fontWeight: 600 }}>git</span>
                                    <input
                                        name="github_url" value={formData.github_url} onChange={handleChange}
                                        className="form-input"
                                        style={{ flex: 1, padding: '0.8rem', border: 'none', background: 'transparent' }}
                                        placeholder="github.com/..."
                                    />
                                </div>
                            </InputGroup>
                            <InputGroup label="Portfolio / Website" style={{ marginBottom: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.8rem 1rem', color: 'var(--text-muted)', borderRight: '1px solid var(--border-color)', background: 'var(--bg-secondary)', minWidth: '45px', textAlign: 'center' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>language</span>
                                    </span>
                                    <input
                                        name="website_url" value={formData.website_url} onChange={handleChange}
                                        className="form-input"
                                        style={{ flex: 1, padding: '0.8rem', border: 'none', background: 'transparent' }}
                                        placeholder="https://..."
                                    />
                                </div>
                            </InputGroup>

                            {formData.social_links.map((link, i) => (
                                <InputGroup key={i} label={`Custom Link #${i + 1}`} style={{ marginBottom: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                        <input
                                            className="form-input"
                                            placeholder="Label (e.g. Twitter)"
                                            value={link.name}
                                            onChange={(e) => handleArrayItemUpdate('social_links', i, 'name', e.target.value)}
                                            style={{ width: '120px', padding: '0.8rem', border: 'none', borderRight: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
                                        />
                                        <input
                                            className="form-input"
                                            placeholder="https://..."
                                            value={link.url}
                                            onChange={(e) => handleArrayItemUpdate('social_links', i, 'url', e.target.value)}
                                            style={{ flex: 1, padding: '0.8rem', border: 'none', background: 'transparent' }}
                                        />
                                        <button onClick={() => removeArrayItem('social_links', i)} style={{ padding: '0 0.8rem', background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Remove Link">
                                            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>close</span>
                                        </button>
                                    </div>
                                </InputGroup>
                            ))}
                            <button
                                onClick={() => addArrayItem('social_links', { name: '', url: '' })}
                                className="btn-secondary"
                                style={{ marginTop: '0.5rem', alignSelf: 'flex-start', padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>add</span>
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

                    <div className="skill-badge-container" style={{ minHeight: '40px', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                        {formData.skills.length === 0 && !isAddingSkill && <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No skills added. Click + to add.</span>}
                        {formData.skills.map((skill, i) => (
                            <span key={i} className="skill-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--primary-glow)', color: 'var(--primary-light)', border: '1px solid var(--border-color)' }}>
                                {editingSkillIndex === i ? (
                                    <input
                                        autoFocus
                                        defaultValue={skill}
                                        onBlur={(e) => updateSkill(i, e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && updateSkill(i, e.target.value)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            borderBottom: '1px solid var(--primary-light)',
                                            color: 'var(--primary-light)',
                                            outline: 'none',
                                            width: `${Math.max(skill.length, 5)}ch`,
                                            fontSize: 'inherit'
                                        }}
                                    />
                                ) : (
                                    <span onClick={() => setEditingSkillIndex(i)} style={{ cursor: 'text' }}>{skill}</span>
                                )}
                                <span
                                    onClick={(e) => { e.stopPropagation(); removeArrayItem('skills', i); }}
                                    className="material-symbols-outlined"
                                    style={{ cursor: 'pointer', opacity: 0.7, fontSize: '1rem', fontWeight: 'bold' }}
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
                            <div key={i} className="timeline-card" style={{ border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '1.5rem' }}>
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
                            <div key={i} className="timeline-card" style={{ border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '1.5rem' }}>
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
                            <div key={i} className="timeline-card" style={{ border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '1.5rem' }}>
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

                {/* Recommendations Section */}
                <CollapsibleCard 
                    title="Recommendations" 
                    defaultExpanded={false}
                    onAdd={() => addArrayItem('recommendations', { text: '', recommender: '', relationship: '', url: '' })}
                    addTitle="Add Recommendation"
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {formData.recommendations.map((rec, i) => (
                            <div key={i} className="timeline-card" style={{ border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary-light)' }}>RECOMMENDATION #{i + 1}</span>
                                    <button onClick={() => removeArrayItem('recommendations', i)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }} title="Delete">
                                        <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>delete</span>
                                    </button>
                                </div>
                                <textarea className="input-premium" placeholder="Recommendation Text..." value={rec.text} onChange={(e) => handleArrayItemUpdate('recommendations', i, 'text', e.target.value)} style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', minHeight: '80px' }} />
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                                    <input className="input-premium" placeholder="Recommender Name" value={rec.recommender} onChange={(e) => handleArrayItemUpdate('recommendations', i, 'recommender', e.target.value)} style={{ padding: '0.5rem' }} />
                                    <input className="input-premium" placeholder="Relationship" value={rec.relationship} onChange={(e) => handleArrayItemUpdate('recommendations', i, 'relationship', e.target.value)} style={{ padding: '0.5rem' }} />
                                    <input className="input-premium" placeholder="LinkedIn URL" value={rec.url} onChange={(e) => handleArrayItemUpdate('recommendations', i, 'url', e.target.value)} style={{ padding: '0.5rem' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                    {formData.recommendations.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No recommendations listed.</p>}
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
                            <div key={i} className="timeline-card" style={{ border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '1.5rem' }}>
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

            <ProfilePhotoModal
                isOpen={isPhotoModalOpen}
                onClose={() => setIsPhotoModalOpen(false)}
                onSuccess={(newPhoto) => {
                    setPhotoData(newPhoto);
                }}
                initialPhotoUrl={photoData.photo_url}
                initialZoom={photoData.photo_zoom}
                initialX={photoData.photo_x}
                initialY={photoData.photo_y}
            />
        </div >
    );
};

export default Profile;
