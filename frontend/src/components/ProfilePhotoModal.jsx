import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const ProfilePhotoModal = ({ isOpen, onClose, onSuccess, initialPhotoUrl, initialZoom, initialX, initialY }) => {
    const { fetchWithAuth } = useAuth();
    const [step, setStep] = useState(1); // 1 = Selection, 2 = Adjustment
    const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl || '');
    const [zoom, setZoom] = useState(initialZoom || 1.0);
    const [x, setX] = useState(initialX || 0);
    const [y, setY] = useState(initialY || 0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [dragUrl, setDragUrl] = useState('');

    const fileInputRef = useRef(null);
    const [dragging, setDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    useEffect(() => {
        if (isOpen) {
            setStep(initialPhotoUrl ? 2 : 1);
            setPhotoUrl(initialPhotoUrl || '');
            setZoom(initialZoom || 1.0);
            setX(initialX || 0);
            setY(initialY || 0);
            setError('');
        }
    }, [isOpen, initialPhotoUrl, initialZoom, initialX, initialY]);

    const handleMouseDown = (e) => {
        if (!photoUrl) return;
        e.preventDefault();
        setDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        setDragOffset({ x, y });
    };

    const handleMouseMove = (e) => {
        if (!dragging) return;
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        setX(dragOffset.x + dx);
        setY(dragOffset.y + dy);
    };

    const handleMouseUp = () => {
        setDragging(false);
    };

    const handleTouchStart = (e) => {
        if (!photoUrl) return;
        const touch = e.touches[0];
        setDragging(true);
        setDragStart({ x: touch.clientX, y: touch.clientY });
        setDragOffset({ x, y });
    };

    const handleTouchMove = (e) => {
        if (!dragging) return;
        const touch = e.touches[0];
        const dx = touch.clientX - dragStart.x;
        const dy = touch.clientY - dragStart.y;
        setX(dragOffset.x + dx);
        setY(dragOffset.y + dy);
    };

    useEffect(() => {
        if (dragging) {
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('touchend', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchend', handleMouseUp);
        };
    }, [dragging]);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        await uploadFile(file);
    };

    const uploadFile = async (file) => {
        const uploadData = new FormData();
        uploadData.append('photo', file);
        setLoading(true);
        setError('');
        try {
            const res = await fetchWithAuth(`${API_URL}/api/user/upload-photo`, {
                method: 'POST',
                body: uploadData
            });
            if (res.ok) {
                const data = await res.json();
                setPhotoUrl(data.photo_url);
                setZoom(1.0);
                setX(0);
                setY(0);
                setStep(2);
            } else {
                setError('Failed to upload image file.');
            }
        } catch (err) {
            setError('Error uploading image.');
        } finally {
            setLoading(false);
        }
    };

    const handleLinkSubmit = (e) => {
        e.preventDefault();
        if (!dragUrl.trim()) return;
        setPhotoUrl(dragUrl.trim());
        setZoom(1.0);
        setX(0);
        setY(0);
        setStep(2);
    };

    const handleApply = async () => {
        setLoading(true);
        try {
            const res = await fetchWithAuth(`${API_URL}/api/user/account`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    photo_url: photoUrl || null,
                    photo_zoom: parseFloat(zoom),
                    photo_x: parseFloat(x),
                    photo_y: parseFloat(y)
                })
            });
            if (res.ok) {
                onSuccess({
                    photo_url: photoUrl,
                    photo_zoom: zoom,
                    photo_x: x,
                    photo_y: y
                });
                onClose();
            } else {
                setError('Failed to apply profile photo changes.');
            }
        } catch (err) {
            setError('Connection error while saving photo.');
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async () => {
        setLoading(true);
        try {
            const res = await fetchWithAuth(`${API_URL}/api/user/account`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    photo_url: null,
                    photo_zoom: 1.0,
                    photo_x: 0.0,
                    photo_y: 0.0
                })
            });
            if (res.ok) {
                onSuccess({
                    photo_url: '',
                    photo_zoom: 1.0,
                    photo_x: 0,
                    photo_y: 0
                });
                onClose();
            } else {
                setError('Failed to remove profile photo.');
            }
        } catch (err) {
            setError('Connection error while removing photo.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const displayPhoto = photoUrl.startsWith('http') ? photoUrl : `${API_URL}${photoUrl}`;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 99999, transition: 'all 0.3s ease-out'
        }}>
            <div style={{
                width: '100%', maxWidth: '440px', background: 'var(--bg-card)',
                borderRadius: '16px', border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-lg)', padding: '2rem', position: 'relative'
            }}>
                
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {step === 1 ? 'Select Profile Photo' : 'Adjust Profile Photo'}
                    </h2>
                    <button 
                        onClick={onClose} 
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {error && (
                    <div style={{ padding: '0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#f87171', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                        {error}
                    </div>
                )}

                {/* Step 1: Selection */}
                {step === 1 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* Option A: File Upload */}
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                border: '2px dashed var(--border-color)',
                                borderRadius: '12px', padding: '2.5rem 1.5rem',
                                textAlign: 'center', cursor: 'pointer',
                                background: 'rgba(255, 255, 255, 0.01)',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.01)'; }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', color: 'var(--primary-light)', marginBottom: '0.5rem' }}>upload_file</span>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem' }}>Upload from Device</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>JPG, PNG, GIF, or WEBP</div>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileUpload} 
                                accept="image/*" 
                                style={{ display: 'none' }} 
                            />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border-color)' }} />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>OR</span>
                            <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border-color)' }} />
                        </div>

                        {/* Option B: Link URL */}
                        <form onSubmit={handleLinkSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Link a Public Image URL</label>
                                <input 
                                    className="form-input" 
                                    value={dragUrl}
                                    onChange={e => setDragUrl(e.target.value)}
                                    placeholder="https://example.com/profile.jpg"
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <button 
                                type="submit" 
                                className="btn btn-primary" 
                                disabled={!dragUrl.trim()}
                                style={{ width: '100%', padding: '0.6rem' }}
                            >
                                Continue with URL
                            </button>
                        </form>

                        {initialPhotoUrl && (
                            <button 
                                type="button" 
                                className="btn btn-secondary" 
                                onClick={handleRemove}
                                style={{ color: '#ef4444', width: '100%', padding: '0.6rem', marginTop: '0.5rem' }}
                            >
                                Remove Current Photo
                            </button>
                        )}
                    </div>
                )}

                {/* Step 2: Adjust & Center Viewport */}
                {step === 2 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                        {/* Circular Viewport Overlay Crop Preview */}
                        <div 
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            style={{
                                width: '200px', height: '200px', borderRadius: '50%',
                                overflow: 'hidden', position: 'relative',
                                cursor: dragging ? 'grabbing' : 'grab',
                                border: '3px solid var(--primary)',
                                boxShadow: '0 0 25px rgba(37, 106, 244, 0.35)',
                                background: '#111'
                            }}
                        >
                            {photoUrl && (
                                <img 
                                    src={displayPhoto}
                                    alt="Crop Viewport"
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        transform: `scale(${zoom}) translate(${x}px, ${y}px)`,
                                        transformOrigin: 'center center',
                                        pointerEvents: 'none'
                                    }}
                                    onError={() => setError('Failed to load image from URL.')}
                                />
                            )}
                        </div>

                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Drag inside the circle to pan • Zoom using slider below
                        </span>

                        {/* Zoom range slider */}
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                <span>Zoom Adjustment</span>
                                <span style={{ fontWeight: 600 }}>{parseFloat(zoom).toFixed(2)}x</span>
                            </div>
                            <input 
                                type="range" 
                                min="1.0" 
                                max="4.0" 
                                step="0.05" 
                                value={zoom} 
                                onChange={e => setZoom(parseFloat(e.target.value))}
                                style={{ width: '100%', accentColor: 'var(--primary)' }}
                            />
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: '0.75rem', width: '100%', marginTop: '0.5rem' }}>
                            <button 
                                type="button" 
                                className="btn btn-secondary" 
                                onClick={() => setStep(1)}
                                style={{ flex: 1 }}
                            >
                                Back / Change
                            </button>
                            <button 
                                type="button" 
                                className="btn btn-primary" 
                                onClick={handleApply}
                                disabled={loading}
                                style={{ flex: 1 }}
                            >
                                {loading ? 'Saving...' : 'Apply Photo'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProfilePhotoModal;
