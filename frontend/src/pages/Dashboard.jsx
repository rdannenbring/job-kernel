import React, { useState, useEffect, useRef } from 'react';
import './Dashboard.css';
import InterestStars from '../components/InterestStars';
import { useAuth } from '../context/AuthContext';
import Kanban from '../components/Kanban/index.jsx';
import ListView from '../components/List/index.jsx';
import { lastActivityDate } from '../components/Kanban/stages.js';

const DASH_STORAGE_KEY = 'dashboard_state';

const getScoreColors = (score) => {
    const hue = Math.round((score / 100) * 120); // 0 → red, 120 → green
    return {
        bg: `hsla(${hue}, 75%, 40%, 0.15)`,
        border: `hsla(${hue}, 75%, 50%, 0.6)`,
        text: `hsl(${hue}, 75%, 55%)`,
    };
};

const formatCompensation = (salary, maxLength = 60) => {
    if (!salary || salary === "Not Listed") return '-';
    const s = String(salary);
    let text = s.length > maxLength ? s.substring(0, maxLength - 3) + '...' : s;
    const words = text.split(' ');
    const hyphenatedWords = words.map(word => {
        if (word.length > 12) {
            let newWord = '';
            for (let i = 0; i < word.length; i += 12) {
                newWord += word.substring(i, i + 12);
                if (i + 12 < word.length) newWord += '\u00AD';
            }
            return newWord;
        }
        return word;
    });
    return hyphenatedWords.join(' ');
};

// Build a score circle badge with above/below-average indicator
const renderScoreBadge = (score, avgScore, badgeStyle = {}) => {
    const sc = getScoreColors(score);
    let arrowEl = null;
    let tooltipText = `Match Score: ${score}`;
    if (avgScore !== null) {
        const diff = score - avgScore;
        tooltipText = `Match Score: ${score} (avg ${Math.round(avgScore)})`;
        if (Math.abs(diff) >= 1) {
            const isAbove = diff > 0;
            tooltipText = `Match Score: ${score} — ${isAbove ? '↑' : '↓'} ${Math.abs(Math.round(diff))} pts ${isAbove ? 'above' : 'below'} your avg (${Math.round(avgScore)})`;
            arrowEl = (
                <span style={{
                    position: 'absolute',
                    bottom: -1,
                    right: -1,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: isAbove ? '#10b981' : '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '8px',
                    fontWeight: 900,
                    color: 'white',
                    lineHeight: 1,
                    border: '1px solid rgba(0,0,0,0.3)',
                }}>
                    {isAbove ? '▲' : '▼'}
                </span>
            );
        }
    }
    return (
        <div
            title={tooltipText}
            style={{
                position: 'relative',
                borderRadius: '50%',
                background: sc.bg,
                border: `2px solid ${sc.border}`,
                color: sc.text,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                boxShadow: `0 0 8px ${sc.border}`,
                backdropFilter: 'blur(4px)',
                flexShrink: 0,
                ...badgeStyle,
            }}
        >
            {score}
            {arrowEl}
        </div>
    );
};

function loadDashState() {
    try {
        const raw = sessionStorage.getItem(DASH_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

const Dashboard = ({ apps, onStartNew, onViewApp, onStatusUpdate, onUpdate }) => {
    const { fetchWithAuth } = useAuth();
    const saved = loadDashState();
    // Default to 'kanban' if the saved view mode is 'table' (which is hidden)
    const initialViewMode = (saved.viewMode === 'table') ? 'kanban' : (saved.viewMode || 'kanban');
    const [viewMode, setViewMode] = useState(initialViewMode);
    const [draggedOverCol, setDraggedOverCol] = useState(null);
    const [searchTerm, setSearchTerm] = useState(saved.searchTerm || '');
    const [sortBy, setSortBy] = useState(saved.sortBy || 'last_activity');
    const [filterStatuses, setFilterStatuses] = useState(saved.filterStatuses || []);
    const [filterJobTypes, setFilterJobTypes] = useState(saved.filterJobTypes || []);
    const [filterLocationTypes, setFilterLocationTypes] = useState(saved.filterLocationTypes || []);
    const [filterInterestLevels, setFilterInterestLevels] = useState(saved.filterInterestLevels || []);
    const [filterRelocation, setFilterRelocation] = useState(saved.filterRelocation || []);
    const [showArchived, setShowArchived] = useState(saved.showArchived || false);
    const [showRejectedColumn, setShowRejectedColumn] = useState(saved.showRejectedColumn || false);
    const [showDeclinedColumn, setShowDeclinedColumn] = useState(saved.showDeclinedColumn || false);
    const [showWithdrawnColumn, setShowWithdrawnColumn] = useState(saved.showWithdrawnColumn || false);
    const [profilePrefs, setProfilePrefs] = useState(null);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterRef = useRef(null);
    const [isSortOpen, setIsSortOpen] = useState(false);
    const sortRef = useRef(null);
    const boardRef = useRef(null);
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
    const [dropPlaceholder, setDropPlaceholder] = useState({ column: null, index: null });
    const [draggedAppId, setDraggedAppId] = useState(null);
    const [connectionCounts, setConnectionCounts] = useState({});
    const [filterHasConnections, setFilterHasConnections] = useState(saved.filterHasConnections || false);
    const [filterMinScore, setFilterMinScore] = useState(saved.filterMinScore ?? null);

    // Persist state to sessionStorage whenever it changes
    useEffect(() => {
        sessionStorage.setItem(DASH_STORAGE_KEY, JSON.stringify({ 
            viewMode, searchTerm, sortBy, filterStatuses, filterJobTypes, 
            filterLocationTypes, filterInterestLevels, filterRelocation, showArchived,
            filterHasConnections, filterMinScore, showRejectedColumn, showDeclinedColumn, showWithdrawnColumn
        }));
    }, [viewMode, searchTerm, sortBy, filterStatuses, filterJobTypes, filterLocationTypes, filterInterestLevels, filterRelocation, showArchived, filterHasConnections, filterMinScore, showRejectedColumn, showDeclinedColumn, showWithdrawnColumn]);

    useEffect(() => {
        fetchWithAuth(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api/profile`)
            .then(res => res.json())
            .then(data => {
                if (data.preferences) {
                    try {
                        const prefs = typeof data.preferences === 'string' 
                            ? JSON.parse(data.preferences) 
                            : data.preferences;
                        setProfilePrefs(prefs);
                    } catch (e) { 
                        console.error('Error parsing profile prefs in dashboard:', e); 
                    }
                }
            })
            .catch(err => console.error('Failed to load profile for dashboard filtering', err));
    }, []);

    // Batch fetch LinkedIn connection counts for all apps
    useEffect(() => {
        if (!apps || apps.length === 0) return;
        
        const companies = [...new Set(apps.map(a => a.company).filter(Boolean))];
        if (companies.length === 0) return;

        fetchWithAuth(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api/linkedin/matches/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(companies)
        })
        .then(res => res.json())
        .then(data => {
            if (data.results) {
                const counts = {};
                Object.entries(data.results).forEach(([name, matches]) => {
                    counts[name] = matches.length;
                });
                setConnectionCounts(counts);
            }
        })
        .catch(err => console.warn("Failed to fetch batch LinkedIn connections", err));
    }, [apps]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (filterRef.current && !filterRef.current.contains(event.target)) {
                setIsFilterOpen(false);
            }
            if (sortRef.current && !sortRef.current.contains(event.target)) {
                setIsSortOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const KANBAN_COLUMNS = ['Saved', 'Generated', 'Applied', 'Interviewing', 'Decision', 'Accepted', 'Rejected', 'Declined', 'Withdrawn'];
    const TERMINAL_COLUMNS = ['Rejected', 'Declined', 'Withdrawn'];
    const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship'];
    const LOCATION_TYPES = ['On-site', 'Remote', 'Hybrid'];
    const INTEREST_LEVELS = ['High', 'Medium', 'Low'];

    const getStatusStyle = (status) => {
        const s = (status || '').toLowerCase();
        if (s.includes('reviewing') || s.includes('applied')) return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20';
        if (s.includes('interview')) return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20';
        if (s.includes('offer') || s.includes('accepted')) return 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';
        if (s.includes('reject') || s.includes('archived')) return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20';
        if (s.includes('saved')) return 'bg-slate-500/20 text-slate-600 dark:text-slate-400 border border-slate-500/30';
        if (s.includes('generated')) return 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30';
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20';
    };

    const getStatusText = (app) => {
        // Prefer pipeline_stage as the canonical field
        const stage = (app.pipeline_stage || '').toLowerCase();
        const status = (app.status || '').toLowerCase();
        const s = stage || status;
        if (!s) return 'Saved';
        if (s === 'saved' || s.includes('saved')) return 'Saved';
        if (s === 'generated' || s.includes('generated')) return 'Generated';
        if (s === 'applied' || s.includes('applied')) return 'Applied';
        if (s === 'interviewing' || s.includes('interview')) return 'Interviewing';
        if (s === 'decision' || s.includes('decision')) return 'Decision';
        if (s === 'accepted' || s.includes('accepted') || s.includes('offered')) return 'Accepted';
        if (s === 'rejected' || s.includes('reject')) return 'Rejected';
        if (s === 'declined' || s.includes('declin')) return 'Declined';
        if (s === 'withdrawn' || s.includes('withdraw') || s.includes('cancel')) return 'Withdrawn';
        return 'Saved';
    };

    // Average match score across all apps that have one
    const appsWithScore = (Array.isArray(apps) ? apps : []).filter(a => a.match_score != null);
    const avgScore = appsWithScore.length > 0
        ? appsWithScore.reduce((sum, a) => sum + Number(a.match_score || 0), 0) / appsWithScore.length
        : null;

    const processedApps = (Array.isArray(apps) ? [...apps] : []).map(app => {
        let matchJobType = null;
        let matchLocType = null;
        if (profilePrefs) {
            const userJt = profilePrefs.job_types || [];
            const jtArr = Array.isArray(userJt) ? userJt : (userJt ? [userJt] : []);
            if (jtArr.length > 0 && app.job_type && app.job_type.trim() !== '' && app.job_type.toUpperCase() !== 'N/A') {
                const matched = jtArr.some(s => app.job_type.toLowerCase().includes(s.toLowerCase()));
                matchJobType = matched ? 'green' : 'red';
            }
            
            const userWs = profilePrefs.work_setting || [];
            const wsArr = Array.isArray(userWs) ? userWs : (userWs ? [userWs] : []);
            const jobLoc = app.location_type || '';
            if (wsArr.length > 0 && jobLoc && jobLoc.trim() !== '' && jobLoc.toUpperCase() !== 'N/A') {
                const matched = wsArr.some(s => s === 'Any' || (s.toLowerCase() === 'remote' && jobLoc.toLowerCase() === 'hybrid') || jobLoc.toLowerCase().includes(s.toLowerCase()));
                matchLocType = matched ? 'green' : 'red';
            }
        }
        return { ...app, matchJobType, matchLocType };
    }).filter(app => {
        const archived = app.is_archived === true || app.is_archived === 'true';
        if (!showArchived && archived) return false;
        if (showArchived && !archived) return false;
        const lowerSearch = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm || [
            app.job_title,
            app.company,
            app.location,
            app.location_type,
            app.job_type,
            app.salary_range,
            app.job_description,
            app.remarks,
            app.resume_changes_summary,
            app.cover_letter_changes_summary,
            app.source,
        ].some(field => field && String(field).toLowerCase().includes(lowerSearch));
        
        const matchesStatus = filterStatuses.length === 0 ? true : filterStatuses.includes(getStatusText(app.status));
        const matchesJobType = filterJobTypes.length === 0 ? true : filterJobTypes.includes(app.job_type);
        const matchesLocType = filterLocationTypes.length === 0 ? true : filterLocationTypes.includes(app.location_type);
        const matchesInterest = filterInterestLevels.length === 0 ? true : filterInterestLevels.includes(app.interest_level);
        const matchesRelocation = filterRelocation.length === 0 ? true : filterRelocation.includes(
            (app.relocation === 'true' || app.relocation === 'True' || app.relocation === true) ? 'Covered' : 
            (app.relocation === 'false' || app.relocation === 'False' || app.relocation === false) ? 'Not Covered' : 
            'Not Provided'
        );
        
        const hasConnections = connectionCounts[app.company] > 0;
        const matchesHasConnections = !filterHasConnections || hasConnections;
        const matchesMinScore = filterMinScore === null || (app.match_score != null && app.match_score >= filterMinScore);

        const isDraft = app.status === 'Draft';
        if (isDraft) return false;

        return matchesSearch && matchesStatus && matchesJobType && matchesLocType && matchesInterest && matchesRelocation && matchesHasConnections && matchesMinScore;
    }).sort((a, b) => {
        if (sortBy === 'custom') {
            return (a.kanban_order || 0) - (b.kanban_order || 0);
        }
        if (sortBy === 'last_activity') {
            return lastActivityDate(b) - lastActivityDate(a);
        }
        if (sortBy === 'newest') {
            return new Date(b.date_saved) - new Date(a.date_saved);
        }
        if (sortBy === 'oldest') return new Date(a.date_saved) - new Date(b.date_saved);
        if (sortBy === 'company_asc') return (a.company || '').localeCompare(b.company || '');
        if (sortBy === 'company_desc') return (b.company || '').localeCompare(a.company || '');
        if (sortBy === 'deadline_asc') {
            if (!a.deadline) return 1;
            if (!b.deadline) return -1;
            return new Date(a.deadline) - new Date(b.deadline);
        }
        if (sortBy === 'interest_desc') {
            const weights = { 'High': 3, 'Medium': 2, 'Low': 1, '': 0 };
            return (weights[b.interest_level || ''] || 0) - (weights[a.interest_level || ''] || 0);
        }
        if (sortBy === 'score_asc') {
            if (a.match_score == null && b.match_score == null) return 0;
            if (a.match_score == null) return 1;
            if (b.match_score == null) return -1;
            return a.match_score - b.match_score;
        }
        if (sortBy === 'priority_desc') {
            const getPrio = (app) => {
                const ranking = typeof app.prioritization_ranking === 'string' 
                    ? JSON.parse(app.prioritization_ranking || '{}') 
                    : (app.prioritization_ranking || {});
                return ranking.score || 0;
            };
            return getPrio(b) - getPrio(a);
        }
        return 0;
    });

    // Always compute counts for all columns (including hidden) for toggle button badges
    const allAppsByColumn = KANBAN_COLUMNS.reduce((acc, col) => {
        acc[col] = processedApps.filter(app => getStatusText(app) === col);
        return acc;
    }, {});

    const columnsToShow = filterStatuses.length > 0
        ? KANBAN_COLUMNS.filter(c => filterStatuses.includes(c))
        : KANBAN_COLUMNS.filter(c => {
            if (c === 'Rejected' && !showRejectedColumn) return false;
            if (c === 'Declined' && !showDeclinedColumn) return false;
            if (c === 'Withdrawn' && !showWithdrawnColumn) return false;
            return true;
        });

    const appsByColumn = columnsToShow.reduce((acc, col) => {
        acc[col] = processedApps.filter(app => getStatusText(app) === col);
        return acc;
    }, {});

    const toggleStatusFilter = (status) => {
        setFilterStatuses(prev => 
            prev.includes(status) 
                ? prev.filter(s => s !== status)
                : [...prev, status]
        );
    };

    const clearAllFilters = () => {
        setFilterStatuses([]);
        setFilterJobTypes([]);
        setFilterLocationTypes([]);
        setFilterInterestLevels([]);
        setFilterRelocation([]);
        setFilterHasConnections(false);
        setFilterMinScore(null);
        setSearchTerm('');
        setSortBy('newest');
    };

    const onDragStart = (e, appId) => {
        // Set drag data
        e.dataTransfer.setData('appId', appId.toString());
        e.dataTransfer.effectAllowed = 'move';

        // Optional: Set a drag image to ensure transparency looks right
        // If we don't do this, some browsers might capture the "hidden" state
        const dragImage = e.currentTarget.cloneNode(true);
        dragImage.style.position = 'absolute';
        dragImage.style.top = '-1000px';
        dragImage.style.left = '-1000px';
        dragImage.style.width = e.currentTarget.offsetWidth + 'px';
        dragImage.style.opacity = '0.8';
        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 20, 20);
        setTimeout(() => document.body.removeChild(dragImage), 0);

        // DELAY the state update so the browser can finish initializing the drag operation
        // before the element's layout changes. This prevents the drag from being cancelled.
        setTimeout(() => {
            setDraggedAppId(appId);
        }, 0);
    };

    const onDragEnd = () => {
        setDraggedAppId(null);
        setDraggedOverCol(null);
        setDropPlaceholder({ column: null, index: null });
    };

    const updateAppOrders = async (columnApps, newStatus) => {
        // Update local order first (optimistic)
        columnApps.forEach((app, index) => {
            onUpdate(app.id, { status: newStatus, kanban_order: index });
            
            // Send to backend
            fetchWithAuth(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api/applications/${app.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus, kanban_order: index, force: true })
            })
            .then(res => res.ok ? res.json() : null)
            .then(updatedApp => {
                if (updatedApp) {
                    onUpdate(updatedApp.id, updatedApp);
                }
            })
            .catch(err => console.error("Failed to sync order", err));
        });
    };

    const onDrop = (e, newStatus) => {
        e.preventDefault();
        const appId = parseInt(e.dataTransfer.getData('appId'), 10) || draggedAppId;
        console.log("Dropping app", appId, "into", newStatus, "at index", dropPlaceholder.index);

        // Automatically switch to custom sort if we are moving things manually
        if (sortBy !== 'custom') {
            setSortBy('custom');
        }
        
        if (!appId) {
            onDragEnd();
            return;
        }
        
        const currentApp = apps.find(a => a.id === appId);
        if (!currentApp) {
            console.error("Could not find app", appId);
            onDragEnd();
            return;
        }

        // Get all apps in target column from current state
        const columnApps = (appsByColumn[newStatus] || []);
        // Remove the dragged app from its current position in this column (if it's there)
        const otherApps = columnApps.filter(a => a.id !== appId);
        
        // Use placeholder index if valid for this column
        const targetIndex = (dropPlaceholder.column === newStatus && dropPlaceholder.index !== null) 
            ? Math.min(dropPlaceholder.index, otherApps.length)
            : otherApps.length;
        
        const finalApps = [...otherApps];
        finalApps.splice(targetIndex, 0, { ...currentApp, status: newStatus });

        console.log("New order for column", newStatus, ":", finalApps.map(a => a.id));
        updateAppOrders(finalApps, newStatus);
        onDragEnd();
    };

    const onDragOver = (e, col) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (draggedOverCol !== col) {
            setDraggedOverCol(col);
        }

        // If we are over the column but not a specific card, check if we should put it at the end
        if (e.target === e.currentTarget || e.target.classList.contains('flex-col')) {
            setDropPlaceholder({ column: col, index: appsByColumn[col].length });
        }
    };

    const onCardDragOver = (e, col, index) => {
        e.preventDefault();
        e.stopPropagation();
        
        const rect = e.currentTarget.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const isAbove = e.clientY < midY;
        
        // If we are dragging card X, and we are over card Y.
        // If we are dragging within the same column:
        // the list rendered has placeholders adjusted.
        
        let newIndex = isAbove ? index : index + 1;
        
        // Adjustment: if dragging within the same column, and target index is after the current position, 
        // the index we receive from the map is "pushed" by the placeholder.
        // Actually, let's keep it simple: the index from the map IS where the card is.
        
        if (dropPlaceholder.column !== col || dropPlaceholder.index !== newIndex) {
            setDropPlaceholder({ column: col, index: newIndex });
        }
        
        if (draggedOverCol !== col) {
            setDraggedOverCol(col);
        }
    };

    const onDragLeave = (e) => {
        if (!e.currentTarget.contains(e.nativeEvent.relatedTarget)) {
            setDraggedOverCol(null);
        }
    };

    // --- Panning Handlers ---
    const onMouseDown = (e) => {
        // Only pan if clicking on empty space (not a card)
        if (e.target.closest('.glass-card') || e.target.closest('button') || e.target.closest('input')) return;
        
        setIsPanning(true);
        setPanStart({
            x: e.pageX,
            y: e.pageY,
            scrollLeft: boardRef.current.scrollLeft,
            scrollTop: boardRef.current.scrollTop
        });
    };

    const onMouseMove = (e) => {
        if (!isPanning) return;
        e.preventDefault();
        const walkX = (e.pageX - panStart.x);
        const walkY = (e.pageY - panStart.y);
        boardRef.current.scrollLeft = panStart.scrollLeft - walkX;
        boardRef.current.scrollTop = panStart.scrollTop - walkY;
    };

    const onMouseUp = () => {
        setIsPanning(false);
    };

    return (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10 h-full">
            <header className="flex items-center justify-between px-4 sm:px-6 md:px-8 py-4 border-b border-slate-200 dark:border-slate-200/10 glass-panel shrink-0">
                <div className="flex items-center gap-6 flex-1">
                    <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Dashboard</h2>
                    <div className="flex items-center bg-slate-200 dark:bg-[var(--bg-tertiary)] rounded-lg p-1 border border-slate-300 dark:border-[var(--border-color)]">
                        <button onClick={() => setViewMode('kanban')} className={`px-4 py-1.5 text-sm transition-colors rounded-md ${viewMode === 'kanban' ? 'font-semibold text-white bg-primary shadow-lg shadow-primary/20' : 'font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'}`}>Board</button>
                        <button onClick={() => setViewMode('list')} className={`px-4 py-1.5 text-sm transition-colors rounded-md ${viewMode === 'list' ? 'font-semibold text-white bg-primary shadow-lg shadow-primary/20' : 'font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'}`}>List</button>
                        {/* Table option hidden as requested, but keeping here for future removal if needed */}
                        {/* <button onClick={() => setViewMode('table')} className={`px-4 py-1.5 text-sm transition-colors rounded-md ${viewMode === 'table' ? 'font-semibold text-white bg-primary shadow-lg shadow-primary/20' : 'font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'}`}>Table</button> */}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2" onClick={onStartNew}>
                        <span className="material-symbols-outlined text-lg">add</span>
                        <span>Add Job</span>
                    </button>
                </div>
            </header>
            
            {viewMode !== 'kanban' && viewMode !== 'list' && <div className="px-4 sm:px-6 md:px-8 py-6 flex flex-col gap-4 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex gap-3 flex-wrap items-center">
                        {/* Search */}
                        <div className="relative flex items-center h-9">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 text-lg pointer-events-none">search</span>
                            <input
                                type="text"
                                placeholder="Search all job details..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className={`bg-[var(--bg-input)] border ${
                                    searchTerm ? 'border-primary/50 text-slate-800 dark:text-white' : 'border-slate-300 dark:border-[var(--border-color)] text-slate-600 dark:text-slate-300'
                                } hover:border-slate-400 dark:hover:border-white/20 rounded-lg pl-10 ${searchTerm ? 'pr-8' : 'pr-4'} py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-56 shadow-sm placeholder:text-slate-500`}
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                >
                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                </button>
                            )}
                        </div>
                        <div className="relative flex items-center h-9" ref={filterRef}>
                            <button 
                                onClick={() => setIsFilterOpen(!isFilterOpen)}
                                className={`appearance-none bg-[var(--bg-input)] border ${
                                    (filterStatuses.length + filterJobTypes.length + filterLocationTypes.length + filterInterestLevels.length) > 0 
                                        ? 'border-primary/50 text-slate-800 dark:text-white' 
                                        : 'border-slate-300 dark:border-white/10 text-slate-600 dark:text-slate-300'
                                } hover:border-slate-400 dark:hover:border-white/20 pl-10 pr-8 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer h-full flex items-center w-52 justify-between shadow-sm`}
                            >
                                <span className="material-symbols-outlined text-lg absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400">filter_list</span>
                                <span>{(filterStatuses.length + filterJobTypes.length + filterLocationTypes.length + filterInterestLevels.length + filterRelocation.length + (filterHasConnections ? 1 : 0)) === 0 
                                    ? 'Filter Jobs' 
                                    : `${filterStatuses.length + filterJobTypes.length + filterLocationTypes.length + filterInterestLevels.length + filterRelocation.length + (filterHasConnections ? 1 : 0)} Filtered`}</span>
                                <span className="material-symbols-outlined text-lg text-slate-500 dark:text-slate-400">expand_more</span>
                            </button>
                            
                            {isFilterOpen && (
                                <div className="absolute top-11 left-0 w-64 glass-panel bg-[var(--bg-card)] border border-slate-200 dark:border-[var(--border-color)] rounded-xl shadow-2xl z-50 p-3 overflow-hidden flex flex-col gap-3 backdrop-blur-xl">
                                    <div className="flex flex-col gap-1">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 px-1">Status</div>
                                        {KANBAN_COLUMNS.map(col => {
                                            const isSelected = filterStatuses.includes(col);
                                            return (
                                                <button 
                                                    key={col}
                                                    onClick={() => toggleStatusFilter(col)}
                                                    className={`flex items-center justify-between px-3 py-1.5 cursor-pointer rounded-lg text-xs font-medium transition-all ${
                                                        isSelected 
                                                            ? 'bg-primary/20 text-primary dark:text-blue-300 hover:bg-primary/30' 
                                                            : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300'
                                                    }`}
                                                >
                                                    <span>{col}</span>
                                                    {isSelected && <span className="material-symbols-outlined text-[14px]">check</span>}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="flex flex-col gap-1 border-t border-slate-200 dark:border-white/10 pt-2">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 px-1">Interest Level</div>
                                        {INTEREST_LEVELS.map(level => {
                                            const isSelected = filterInterestLevels.includes(level);
                                            return (
                                                <button 
                                                    key={level}
                                                    onClick={() => setFilterInterestLevels(prev => isSelected ? prev.filter(l => l !== level) : [...prev, level])}
                                                    className={`flex items-center justify-between px-3 py-1.5 cursor-pointer rounded-lg text-xs font-medium transition-all ${
                                                        isSelected 
                                                            ? 'bg-primary/20 text-primary dark:text-blue-300 hover:bg-primary/30' 
                                                            : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300'
                                                    }`}
                                                >
                                                    <span>{level}</span>
                                                    {isSelected && <span className="material-symbols-outlined text-[14px]">check</span>}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="flex flex-col gap-1 border-t border-slate-200 dark:border-white/10 pt-2">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 px-1">Job Type</div>
                                        {JOB_TYPES.map(type => {
                                            const isSelected = filterJobTypes.includes(type);
                                            return (
                                                <button 
                                                    key={type}
                                                    onClick={() => setFilterJobTypes(prev => isSelected ? prev.filter(t => t !== type) : [...prev, type])}
                                                    className={`flex items-center justify-between px-3 py-1.5 cursor-pointer rounded-lg text-xs font-medium transition-all ${
                                                        isSelected 
                                                            ? 'bg-primary/20 text-primary dark:text-blue-300 hover:bg-primary/30' 
                                                            : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300'
                                                    }`}
                                                >
                                                    <span>{type}</span>
                                                    {isSelected && <span className="material-symbols-outlined text-[14px]">check</span>}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="flex flex-col gap-1 border-t border-slate-200 dark:border-white/10 pt-2">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 px-1">Location Type</div>
                                        {LOCATION_TYPES.map(type => {
                                            const isSelected = filterLocationTypes.includes(type);
                                            return (
                                                <button 
                                                    key={type}
                                                    onClick={() => setFilterLocationTypes(prev => isSelected ? prev.filter(t => t !== type) : [...prev, type])}
                                                    className={`flex items-center justify-between px-3 py-1.5 cursor-pointer rounded-lg text-xs font-medium transition-all ${
                                                        isSelected 
                                                            ? 'bg-primary/20 text-primary dark:text-blue-300 hover:bg-primary/30' 
                                                            : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300'
                                                    }`}
                                                >
                                                    <span>{type}</span>
                                                    {isSelected && <span className="material-symbols-outlined text-[14px]">check</span>}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="flex flex-col gap-1 border-t border-slate-200 dark:border-white/10 pt-2">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 px-1">Relocation</div>
                                        {['Covered', 'Not Covered', 'Not Provided'].map(val => {
                                            const isSelected = filterRelocation.includes(val);
                                            return (
                                                <button 
                                                    key={val}
                                                    onClick={() => setFilterRelocation(prev => isSelected ? prev.filter(v => v !== val) : [...prev, val])}
                                                    className={`flex items-center justify-between px-3 py-1.5 cursor-pointer rounded-lg text-xs font-medium transition-all ${
                                                        isSelected 
                                                            ? 'bg-primary/20 text-primary dark:text-blue-300 hover:bg-primary/30' 
                                                            : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300'
                                                    }`}
                                                >
                                                    <span>{val}</span>
                                                    {isSelected && <span className="material-symbols-outlined text-[14px]">check</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="flex flex-col gap-1 border-t border-slate-200 dark:border-white/10 pt-2">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 px-1">Networking</div>
                                        <button 
                                            onClick={() => setFilterHasConnections(!filterHasConnections)}
                                            className={`flex items-center justify-between px-3 py-1.5 cursor-pointer rounded-lg text-xs font-medium transition-all ${
                                                filterHasConnections 
                                                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/30' 
                                                    : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-[14px]">group</span>
                                                <span>Has Connections</span>
                                            </div>
                                            {filterHasConnections && <span className="material-symbols-outlined text-[14px]">check</span>}
                                        </button>
                                    </div>
                                    <div className="flex flex-col gap-2 border-t border-slate-200 dark:border-white/10 pt-2">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Min Match Score</div>
                                        <div className="flex flex-col gap-1 px-1">
                                            {[null, 50, 60, 70, 80, 90].map(val => {
                                                const isSelected = filterMinScore === val;
                                                const label = val === null ? 'Any' : `≥ ${val}`;
                                                const colors = val !== null ? getScoreColors(val) : null;
                                                return (
                                                    <button
                                                        key={val ?? 'any'}
                                                        onClick={() => setFilterMinScore(val)}
                                                        className={`flex items-center justify-between px-3 py-1.5 cursor-pointer rounded-lg text-xs font-medium transition-all ${
                                                            isSelected
                                                                ? 'bg-primary/20 text-primary dark:text-blue-300 hover:bg-primary/30'
                                                                : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            {colors && (
                                                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors.text, display: 'inline-block', flexShrink: 0 }} />
                                                            )}
                                                            <span>{label}</span>
                                                        </div>
                                                        {isSelected && <span className="material-symbols-outlined text-[14px]">check</span>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="relative flex items-center h-9" ref={sortRef}>
                            <button 
                                onClick={() => setIsSortOpen(!isSortOpen)}
                                className={`appearance-none bg-white dark:bg-white/5 border ${sortBy !== 'newest' ? 'border-primary/50 text-slate-800 dark:text-white' : 'border-slate-300 dark:border-white/10 text-slate-600 dark:text-slate-300'} hover:border-slate-400 dark:hover:border-white/20 pl-10 pr-8 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer h-full flex items-center w-48 justify-between shadow-sm`}
                            >
                                <span className="material-symbols-outlined text-lg absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400">sort</span>
                                <span>
                                    {sortBy === 'newest' ? 'Newest' : 
                                     sortBy === 'oldest' ? 'Oldest' : 
                                     sortBy === 'company_asc' ? 'Company (A-Z)' : 
                                     sortBy === 'company_desc' ? 'Company (Z-A)' :
                                     sortBy === 'deadline_asc' ? 'Upcoming Deadline' :
                                     sortBy === 'custom' ? 'Custom' :
                                     sortBy === 'score_desc' ? 'Score: High → Low' :
                                     sortBy === 'score_asc' ? 'Score: Low → High' :
                                     'Interest Level'}
                                </span>
                                <span className="material-symbols-outlined text-lg text-slate-400">expand_more</span>
                            </button>
                            
                            {isSortOpen && (
                                <div className="absolute top-11 left-0 w-52 glass-panel bg-white dark:bg-[#0a0f18]/95 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl z-50 p-2 overflow-hidden flex flex-col gap-1 backdrop-blur-xl">
                                    {[
                                        { id: 'newest', label: 'Newest' },
                                        { id: 'oldest', label: 'Oldest' },
                                        { id: 'company_asc', label: 'Company (A-Z)' },
                                        { id: 'company_desc', label: 'Company (Z-A)' },
                                        { id: 'deadline_asc', label: 'Upcoming Deadline' },
                                        { id: 'interest_desc', label: 'Interest Level' },
                                        { id: 'score_desc', label: 'Score: High → Low' },
                                        { id: 'score_asc', label: 'Score: Low → High' },
                                        { id: 'priority_desc', label: 'Priority Score' },
                                        { id: 'custom', label: 'Custom' }
                                    ].map(option => {
                                        const isSelected = sortBy === option.id;
                                        return (
                                            <button 
                                                key={option.id}
                                                onClick={() => { setSortBy(option.id); setIsSortOpen(false); }}
                                                className={`flex items-center justify-between px-3 py-2 cursor-pointer rounded-lg text-sm font-medium transition-all ${
                                                    isSelected 
                                                        ? 'bg-primary/20 text-primary dark:text-blue-300 hover:bg-primary/30' 
                                                        : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300'
                                                }`}
                                            >
                                                <span>{option.label}</span>
                                                {isSelected && (
                                                    <span className="material-symbols-outlined text-[16px] text-blue-400">check</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {/* Terminal stage column toggles with item counts */}
                        {[
                            { key: 'Rejected',  show: showRejectedColumn,  set: setShowRejectedColumn,  activeClass: 'bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-300' },
                            { key: 'Declined',  show: showDeclinedColumn,  set: setShowDeclinedColumn,  activeClass: 'bg-orange-500/15 border-orange-500/40 text-orange-600 dark:text-orange-300' },
                            { key: 'Withdrawn', show: showWithdrawnColumn, set: setShowWithdrawnColumn, activeClass: 'bg-slate-500/15 border-slate-500/40 text-slate-600 dark:text-slate-300' },
                        ].map(({ key, show, set, activeClass }) => {
                            const count = (allAppsByColumn[key] || []).length;
                            return (
                                <button
                                    key={key}
                                    onClick={() => set(v => !v)}
                                    title={show ? `Hide ${key} column` : `Show ${key} column`}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                                        show
                                            ? activeClass
                                            : 'bg-slate-200 dark:bg-white/5 border-slate-300 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-400 dark:hover:border-white/20'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[16px]">{show ? 'visibility' : 'visibility_off'}</span>
                                    <span className="max-md:hidden">{key}</span>
                                    {count > 0 && (
                                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${show ? 'bg-white/20' : 'bg-slate-400/20 dark:bg-white/10'}`}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}

                        {/* Archived toggle */}
                        <button
                            onClick={() => setShowArchived(v => !v)}
                            title={showArchived ? 'Back to active jobs' : 'View archived jobs'}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                                showArchived
                                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-300'
                                    : 'bg-slate-200 dark:bg-white/5 border-slate-300 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-400 dark:hover:border-white/20'
                            }`}
                        >
                            <span className="material-symbols-outlined text-[16px]">{showArchived ? 'visibility' : 'visibility_off'}</span>
                            <span className="max-md:hidden">Archive</span>
                        </button>
                        <div className="text-sm text-slate-500 dark:text-slate-400">Showing {processedApps.length} of {apps.filter(a => (showArchived ? a.is_archived === 'true' || a.is_archived === true : a.is_archived !== 'true' && a.is_archived !== true) && a.status !== 'Draft').length}</div>
                    </div>
                </div>

                {/* Active Filters Display */}
                {(filterStatuses.length > 0 || filterJobTypes.length > 0 || filterLocationTypes.length > 0 || filterInterestLevels.length > 0 || filterRelocation.length > 0 || filterHasConnections || filterMinScore !== null || searchTerm || sortBy !== 'newest') && (
                    <div className="flex flex-wrap gap-2 items-center text-sm pt-2">
                        <span className="text-slate-500 mr-2 text-xs font-bold uppercase tracking-wider">Active:</span>
                        {searchTerm && (
                            <span className="bg-white/5 border border-white/10 text-slate-200 px-3 py-1 rounded-full flex items-center gap-2 text-xs">
                                <span className="opacity-50">Search:</span> {searchTerm}
                                <button onClick={() => setSearchTerm('')} className="hover:text-rose-400 material-symbols-outlined text-[14px] ml-1">close</button>
                            </span>
                        )}
                        {filterStatuses.map(status => (
                            <span key={status} className="bg-primary/10 text-blue-300 px-3 py-1 rounded-full flex items-center gap-2 border border-primary/20 text-xs font-medium">
                                {status}
                                <button onClick={() => toggleStatusFilter(status)} className="hover:text-white material-symbols-outlined text-[14px] ml-1">close</button>
                            </span>
                        ))}
                        {filterInterestLevels.map(level => (
                            <span key={level} className="bg-amber-500/10 text-amber-300 px-3 py-1 rounded-full flex items-center gap-2 border border-amber-500/20 text-xs font-medium">
                                Interest: {level}
                                <button onClick={() => setFilterInterestLevels(prev => prev.filter(l => l !== level))} className="hover:text-white material-symbols-outlined text-[14px] ml-1">close</button>
                            </span>
                        ))}
                        {filterJobTypes.map(type => (
                            <span key={type} className="bg-emerald-500/10 text-emerald-300 px-3 py-1 rounded-full flex items-center gap-2 border border-emerald-500/20 text-xs font-medium">
                                {type}
                                <button onClick={() => setFilterJobTypes(prev => prev.filter(t => t !== type))} className="hover:text-white material-symbols-outlined text-[14px] ml-1">close</button>
                            </span>
                        ))}
                        {filterLocationTypes.map(type => (
                            <span key={type} className="bg-cyan-500/10 text-cyan-300 px-3 py-1 rounded-full flex items-center gap-2 border border-cyan-500/20 text-xs font-medium">
                                {type}
                                <button onClick={() => setFilterLocationTypes(prev => prev.filter(t => t !== type))} className="hover:text-white material-symbols-outlined text-[14px] ml-1">close</button>
                            </span>
                        ))}
                        {filterRelocation.map(val => (
                            <span key={val} className="bg-purple-500/10 text-purple-300 px-3 py-1 rounded-full flex items-center gap-2 border border-purple-500/20 text-xs font-medium">
                                Relo: {val}
                                <button onClick={() => setFilterRelocation(prev => prev.filter(v => v !== val))} className="hover:text-white material-symbols-outlined text-[14px] ml-1">close</button>
                            </span>
                        ))}
                         {filterHasConnections && (
                            <span className="bg-emerald-500/10 text-emerald-300 px-3 py-1 rounded-full flex items-center gap-2 border border-emerald-500/20 text-xs font-medium">
                                <span className="material-symbols-outlined text-[14px]">group</span>
                                Networking Only
                                <button onClick={() => setFilterHasConnections(false)} className="hover:text-white material-symbols-outlined text-[14px] ml-1">close</button>
                            </span>
                        )}
                        {filterMinScore !== null && (() => {
                            const colors = getScoreColors(filterMinScore);
                            return (
                                <span style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }} className="px-3 py-1 rounded-full flex items-center gap-2 text-xs font-medium">
                                    <span className="material-symbols-outlined text-[14px]">analytics</span>
                                    Score ≥ {filterMinScore}
                                    <button onClick={() => setFilterMinScore(null)} className="hover:opacity-60 material-symbols-outlined text-[14px] ml-1">close</button>
                                </span>
                            );
                        })()}
                        {sortBy !== 'newest' && (
                            <span className="bg-slate-200 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-200 px-3 py-1 rounded-full flex items-center gap-2 text-xs">
                                <span className="opacity-50">Sort:</span> 
                                {sortBy === 'oldest' ? 'Oldest' : 
                                 sortBy === 'company_asc' ? 'Company (A-Z)' : 
                                 sortBy === 'company_desc' ? 'Company (Z-A)' : 
                                 sortBy === 'deadline_asc' ? 'Upcoming Deadline' :
                                 sortBy === 'score_desc' ? 'Score: High → Low' :
                                 sortBy === 'score_asc' ? 'Score: Low → High' :
                                 sortBy === 'priority_desc' ? 'Priority Score' :
                                 sortBy === 'custom' ? 'Custom Order' :
                                 'Interest Level'}
                                <button onClick={() => setSortBy('newest')} className="hover:text-rose-400 material-symbols-outlined text-[14px] ml-1">close</button>
                            </span>
                        )}
                        <button onClick={clearAllFilters} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white ml-2 text-xs uppercase tracking-wider font-bold transition-colors">Clear All</button>
                    </div>
                )}
            </div>}

            {apps.length === 0 ? (
                <div className="px-4 sm:px-6 md:px-8 flex-1 flex flex-col items-center justify-center">
                    <div className="glass-card flex flex-col items-center justify-center p-12 rounded-2xl border border-slate-200 dark:border-white/10 shadow-lg">
                        <span className="material-symbols-outlined text-6xl mb-4 text-slate-300 dark:text-slate-600">inbox</span>
                        <h3 className="text-xl font-bold mb-2">No applications yet</h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm text-center">Tailor your first resume to get started!</p>
                        <button onClick={onStartNew} className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg font-bold shadow-glow transition-all">Create New Job</button>
                    </div>
                </div>
            ) : (
                <>
                {viewMode === 'kanban' && (
                    <Kanban
                        apps={processedApps}
                        allAppsCount={apps.filter(a => (showArchived ? a.is_archived === 'true' || a.is_archived === true : a.is_archived !== 'true' && a.is_archived !== true) && a.status !== 'Draft').length}
                        onUpdate={onUpdate}
                        onViewApp={onViewApp}
                        onStartNew={onStartNew}
                        updateAppOrders={updateAppOrders}
                        connectionCounts={connectionCounts}
                        avgScore={avgScore}
                        sortBy={sortBy}
                        setSortBy={setSortBy}
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        filterMinScore={filterMinScore}
                        setFilterMinScore={setFilterMinScore}
                        filterHasConnections={filterHasConnections}
                        setFilterHasConnections={setFilterHasConnections}
                        onClearAllFilters={clearAllFilters}
                    />
                )}
                {viewMode === 'list' && (
                    <ListView
                        apps={processedApps}
                        onViewApp={onViewApp}
                        onUpdate={onUpdate}
                        onStartNew={onStartNew}
                    />
                )}
                {viewMode === 'table' && 
<div className="flex-1 overflow-auto px-4 sm:px-6 md:px-8 pb-8">
    <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-xl">
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className="bg-slate-100 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                    <th className="px-6 py-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Company</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Job Title</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Location</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Salary</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Deadline</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">Score</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">Priority</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">Interest</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {processedApps.map(app => (
                    <tr key={app.id} className="glass-row group cursor-pointer" onClick={() => onViewApp(app)}>
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                                    {app.company_logo
                                        ? <img src={app.company_logo} alt={app.company} style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'transparent', padding: '0' }} onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'block'; }} />
                                        : null}
                                    <span className="material-symbols-outlined text-slate-400 dark:text-white" style={{ display: app.company_logo ? 'none' : 'block' }}>corporate_fare</span>
                                </div>
                                <span className="font-bold text-slate-800 dark:text-slate-100">{app.company || 'Unknown'}</span>
                                {connectionCounts[app.company] > 0 && (
                                    <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] px-2 py-0.5 font-bold flex items-center gap-1" title={`${connectionCounts[app.company]} Connections`}>
                                        <span className="material-symbols-outlined text-[12px]">group</span>
                                        {connectionCounts[app.company]}
                                    </span>
                                )}
                            </div>
                        </td>
                        <td className="px-6 py-4"><span className="text-sm font-medium text-slate-600 dark:text-slate-300 group-hover:text-primary transition-colors">{app.job_title || 'Unknown'}</span></td>
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-1 text-sm font-medium text-slate-600 dark:text-slate-300">
                                {app.location || 'Remote'}
                                {app.matchLocType === 'green' && <span className="material-symbols-outlined text-[14px] text-emerald-500">check_circle</span>}
                                {app.matchLocType === 'red' && <span className="material-symbols-outlined text-[14px] text-rose-500">cancel</span>}
                            </div>
                            {app.location_type && <div className="text-[10px] text-slate-500 uppercase tracking-tight">{app.location_type}</div>}
                        </td>
                        <td className="px-6 py-4"><span className="text-sm font-bold text-primary text-wrap" style={{ wordBreak: 'break-word', hyphens: 'auto' }} title={app.salary_range}>{formatCompensation(app.salary_range)}</span></td>
                        <td className="px-6 py-4">
                            <span className={`text-sm ${app.deadline ? 'text-rose-400 font-bold' : 'text-slate-500'}`}>
                                {app.deadline || '-'}
                            </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                            {app.match_score != null
                                ? <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {renderScoreBadge(app.match_score, avgScore, { width: 36, height: 36, fontSize: '0.75rem' })}
                                  </div>
                                : <span className="text-slate-400 text-xs">—</span>
                            }
                        </td>
                        <td className="px-6 py-4 text-center">
                            {(() => {
                                const prio = typeof app.prioritization_ranking === 'string' 
                                    ? JSON.parse(app.prioritization_ranking || '{}') 
                                    : (app.prioritization_ranking || {});
                                if (prio.score) {
                                    return (
                                       <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                           <div style={{ 
                                               width: 36, height: 36, borderRadius: '50%', 
                                               background: 'rgba(37, 106, 244, 0.1)', 
                                               border: '2px solid rgba(37, 106, 244, 0.4)', 
                                               color: 'var(--primary)',
                                               display: 'flex', alignItems: 'center', justifyContent: 'center',
                                               fontSize: '0.75rem', fontWeight: 900
                                           }}>
                                               <span className="material-symbols-outlined" style={{ fontSize: '10px', position: 'absolute', top: -2, right: -2, background: 'var(--primary)', color: 'white', borderRadius: '50%', padding: '2px' }}>bolt</span>
                                               {prio.score}
                                           </div>
                                       </div>
                                    );
                                }
                                return <span className="text-slate-400 text-xs">—</span>;
                            })()}
                        </td>
                        <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center">
                                <InterestStars level={app.interest_level} size="0.9rem" />
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${getStatusStyle(app.status)}`}>
                                {getStatusText(app.status)}
                            </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                            <button className="text-slate-500 hover:text-slate-200" onClick={e => e.stopPropagation()}><span className="material-symbols-outlined">more_vert</span></button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
</div>
}
                </>
            )}
        </div>
    );
};

export default Dashboard;
