import React, { useState, useEffect, useRef } from 'react';
import './Dashboard.css';
import InterestStars from '../components/InterestStars';

const DASH_STORAGE_KEY = 'dashboard_state';

function loadDashState() {
    try {
        const raw = sessionStorage.getItem(DASH_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

const Dashboard = ({ apps, onStartNew, onViewApp, onStatusUpdate, onUpdate }) => {
    const saved = loadDashState();
    const [viewMode, setViewMode] = useState(saved.viewMode || 'kanban');
    const [draggedOverCol, setDraggedOverCol] = useState(null);
    const [searchTerm, setSearchTerm] = useState(saved.searchTerm || '');
    const [sortBy, setSortBy] = useState(saved.sortBy || 'newest');
    const [filterStatuses, setFilterStatuses] = useState(saved.filterStatuses || []);
    const [filterJobTypes, setFilterJobTypes] = useState(saved.filterJobTypes || []);
    const [filterLocationTypes, setFilterLocationTypes] = useState(saved.filterLocationTypes || []);
    const [filterInterestLevels, setFilterInterestLevels] = useState(saved.filterInterestLevels || []);
    const [filterRelocation, setFilterRelocation] = useState(saved.filterRelocation || []);
    const [showArchived, setShowArchived] = useState(saved.showArchived || false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterRef = useRef(null);
    const [isSortOpen, setIsSortOpen] = useState(false);
    const sortRef = useRef(null);
    const boardRef = useRef(null);
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
    const [dropPlaceholder, setDropPlaceholder] = useState({ column: null, index: null });
    const [draggedAppId, setDraggedAppId] = useState(null);

    // Persist state to sessionStorage whenever it changes
    useEffect(() => {
        sessionStorage.setItem(DASH_STORAGE_KEY, JSON.stringify({ 
            viewMode, searchTerm, sortBy, filterStatuses, filterJobTypes, 
            filterLocationTypes, filterInterestLevels, filterRelocation, showArchived 
        }));
    }, [viewMode, searchTerm, sortBy, filterStatuses, filterJobTypes, filterLocationTypes, filterInterestLevels, filterRelocation, showArchived]);

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

    const KANBAN_COLUMNS = ['Saved', 'Generated', 'Applied', 'Interviewing', 'Rejected', 'Offered', 'Accepted'];
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

    const getStatusText = (status) => {
        if (!status) return 'Applied';
        const s = status.toLowerCase();
        for (let col of KANBAN_COLUMNS) {
            if (s.includes(col.toLowerCase()) || (col === 'Interviewing' && s.includes('interview'))) {
                return col;
            }
        }
        return status;
    };

    const processedApps = [...apps].filter(app => {
        const archived = app.is_archived === 'true';
        if (!showArchived && archived) return false;
        if (showArchived && !archived) return false;
        const matchesSearch = (app.job_title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (app.company || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (app.location || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = filterStatuses.length === 0 ? true : filterStatuses.includes(getStatusText(app.status));
        const matchesJobType = filterJobTypes.length === 0 ? true : filterJobTypes.includes(app.job_type);
        const matchesLocType = filterLocationTypes.length === 0 ? true : filterLocationTypes.includes(app.location_type);
        const matchesInterest = filterInterestLevels.length === 0 ? true : filterInterestLevels.includes(app.interest_level);
        const matchesRelocation = filterRelocation.length === 0 ? true : filterRelocation.includes(
            (app.relocation === 'true' || app.relocation === 'True' || app.relocation === true) ? 'Covered' : 
            (app.relocation === 'false' || app.relocation === 'False' || app.relocation === false) ? 'Not Covered' : 
            'Not Provided'
        );
        
        return matchesSearch && matchesStatus && matchesJobType && matchesLocType && matchesInterest && matchesRelocation;
    }).sort((a, b) => {
        if (sortBy === 'custom') {
            return (a.kanban_order || 0) - (b.kanban_order || 0);
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
        return 0;
    });

    const columnsToShow = filterStatuses.length > 0 ? KANBAN_COLUMNS.filter(c => filterStatuses.includes(c)) : KANBAN_COLUMNS;

    const appsByColumn = columnsToShow.reduce((acc, col) => {
        acc[col] = processedApps.filter(app => getStatusText(app.status) === col);
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
        // Update local order first
        columnApps.forEach((app, index) => {
            onUpdate(app.id, { status: newStatus, kanban_order: index });
            
            // Send to backend
            fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/applications/${app.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus, kanban_order: index })
            }).catch(err => console.error("Failed to sync order", err));
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
            <header className="flex items-center justify-between px-8 py-4 border-b border-slate-200 dark:border-slate-200/10 glass-panel shrink-0">
                <div className="flex items-center gap-6 flex-1">
                    <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Dashboard</h2>
                    <div className="flex items-center bg-slate-200 dark:bg-white/5 rounded-lg p-1 border border-slate-300 dark:border-white/10">
                        <button onClick={() => setViewMode('kanban')} className={`px-4 py-1.5 text-sm transition-colors rounded-md ${viewMode === 'kanban' ? 'font-semibold text-white bg-primary shadow-lg shadow-primary/20' : 'font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'}`}>Board</button>
                        <button onClick={() => setViewMode('list')} className={`px-4 py-1.5 text-sm transition-colors rounded-md ${viewMode === 'list' ? 'font-semibold text-white bg-primary shadow-lg shadow-primary/20' : 'font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'}`}>List</button>
                        <button onClick={() => setViewMode('table')} className={`px-4 py-1.5 text-sm transition-colors rounded-md ${viewMode === 'table' ? 'font-semibold text-white bg-primary shadow-lg shadow-primary/20' : 'font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'}`}>Table</button>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative hidden sm:block">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 text-lg">search</span>
                        <input 
                            type="text" 
                            placeholder="Search applications..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-800 dark:text-slate-200 w-64 placeholder:text-slate-500 shadow-sm" 
                        />
                    </div>
                    <button className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2" onClick={onStartNew}>
                        <span className="material-symbols-outlined text-lg">add</span>
                        <span>Add Job</span>
                    </button>
                </div>
            </header>
            
            <div className="px-8 py-6 flex flex-col gap-4 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex gap-3">
                        <div className="relative flex items-center h-9" ref={filterRef}>
                            <button 
                                onClick={() => setIsFilterOpen(!isFilterOpen)}
                                className={`appearance-none bg-white dark:bg-white/5 border ${
                                    (filterStatuses.length + filterJobTypes.length + filterLocationTypes.length + filterInterestLevels.length) > 0 
                                        ? 'border-primary/50 text-slate-800 dark:text-white' 
                                        : 'border-slate-300 dark:border-white/10 text-slate-600 dark:text-slate-300'
                                } hover:border-slate-400 dark:hover:border-white/20 pl-10 pr-8 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer h-full flex items-center w-52 justify-between shadow-sm`}
                            >
                                <span className="material-symbols-outlined text-lg absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400">filter_list</span>
                                <span>{(filterStatuses.length + filterJobTypes.length + filterLocationTypes.length + filterInterestLevels.length + filterRelocation.length) === 0 
                                    ? 'Filter Jobs' 
                                    : `${filterStatuses.length + filterJobTypes.length + filterLocationTypes.length + filterInterestLevels.length + filterRelocation.length} Filtered`}</span>
                                <span className="material-symbols-outlined text-lg text-slate-500 dark:text-slate-400">expand_more</span>
                            </button>
                            
                            {isFilterOpen && (
                                <div className="absolute top-11 left-0 w-64 glass-panel bg-white dark:bg-[#0a0f18]/95 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl z-50 p-3 overflow-hidden flex flex-col gap-3 backdrop-blur-xl">
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
                            <span className="material-symbols-outlined text-[16px]">{showArchived ? 'inventory_2' : 'archive'}</span>
                            {showArchived ? 'Archived' : 'Archive'}
                        </button>
                        <div className="text-sm text-slate-500 dark:text-slate-400">Showing {processedApps.length} of {apps.filter(a => showArchived ? a.is_archived === 'true' : a.is_archived !== 'true').length}</div>
                    </div>
                </div>

                {/* Active Filters Display */}
                {(filterStatuses.length > 0 || searchTerm || sortBy !== 'newest') && (
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
                        {sortBy !== 'newest' && (
                            <span className="bg-slate-200 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-200 px-3 py-1 rounded-full flex items-center gap-2 text-xs">
                                <span className="opacity-50">Sort:</span> 
                                {sortBy === 'oldest' ? 'Oldest' : 
                                 sortBy === 'company_asc' ? 'Company (A-Z)' : 
                                 sortBy === 'company_desc' ? 'Company (Z-A)' : 
                                 sortBy === 'deadline_asc' ? 'Upcoming Deadline' :
                                 'Interest Level'}
                                <button onClick={() => setSortBy('newest')} className="hover:text-rose-400 material-symbols-outlined text-[14px] ml-1">close</button>
                            </span>
                        )}
                        <button onClick={clearAllFilters} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white ml-2 text-xs uppercase tracking-wider font-bold transition-colors">Clear All</button>
                    </div>
                )}
            </div>

            {apps.length === 0 ? (
                <div className="px-8 flex-1 flex flex-col items-center justify-center">
                    <div className="glass-card flex flex-col items-center justify-center p-12 rounded-2xl border border-slate-200 dark:border-white/10 shadow-lg">
                        <span className="material-symbols-outlined text-6xl mb-4 text-slate-300 dark:text-slate-600">inbox</span>
                        <h3 className="text-xl font-bold mb-2">No applications yet</h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm text-center">Tailor your first resume to get started!</p>
                        <button onClick={onStartNew} className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg font-bold shadow-glow transition-all">Create New Job</button>
                    </div>
                </div>
            ) : (
                <>
                {viewMode === 'kanban' && 
<div 
    ref={boardRef}
    className="flex-1 overflow-x-auto p-6 pt-2 select-none" 
    style={{ paddingBottom: '2rem', cursor: isPanning ? 'grabbing' : 'default' }}
    onMouseDown={onMouseDown}
    onMouseMove={onMouseMove}
    onMouseUp={onMouseUp}
    onMouseLeave={onMouseUp}
>
    <div className="flex gap-4 2xl:gap-6 h-full">
        {columnsToShow.map((col, idx) => {
            const colColors = [
                "bg-slate-500", "bg-amber-500", "bg-blue-500", 
                "bg-purple-500", "bg-rose-500", "bg-emerald-500", "bg-emerald-500"
            ];
            const colorClass = colColors[idx % colColors.length];
            return (
                <div key={col} 
                    className={`flex-1 min-w-[200px] max-w-[350px] flex flex-col gap-4 p-2 -mx-2 rounded-2xl transition-all duration-200 border-2 ${draggedOverCol === col ? 'border-primary/50 bg-primary/10 shadow-[0_0_30px_rgba(37,106,244,0.15)] scale-[1.01]' : 'border-transparent'}`} 
                    onDrop={(e) => onDrop(e, col)} 
                    onDragOver={(e) => onDragOver(e, col)}
                    onDragLeave={onDragLeave}
                >
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <span className={`size-2 rounded-full ${colorClass}`}></span>
                            {col} <span className="text-xs font-normal ml-1 opacity-50">({appsByColumn[col].length})</span>
                        </h3>
                        <button className="text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"><span className="material-symbols-outlined">more_horiz</span></button>
                    </div>
                    <div className="flex flex-col gap-3 overflow-y-auto" style={{ minHeight: '400px' }}>
                        {appsByColumn[col].map((app, index) => {
                            const isDragging = app.id === draggedAppId;
                            return (
                                <React.Fragment key={app.id}>
                                    {dropPlaceholder.column === col && dropPlaceholder.index === index && (
                                        <div className="w-full h-24 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 flex items-center justify-center animate-pulse transition-all duration-200 shrink-0">
                                            <div className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Drop Here</div>
                                        </div>
                                    )}
                                    <div 
                                        draggable 
                                        onDragStart={(e) => onDragStart(e, app.id)} 
                                        onDragEnd={onDragEnd}
                                        onDragOver={(e) => onCardDragOver(e, col, index)}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onDrop(e, col);
                                        }}
                                        onClick={() => onViewApp(app)}
                                        className={`glass-card p-3 rounded-xl flex flex-col gap-2 cursor-pointer shadow-sm hover:shadow-md transition-all hover:-translate-y-1 border border-slate-200/60 dark:border-white/10 active:cursor-grabbing ${isDragging ? 'invisible h-0 opacity-0 overflow-hidden py-0 my-0 border-0' : ''}`}>
                                        {!isDragging && (
                                            <>
                                            <div className="flex justify-between items-start pointer-events-none">
                                                <div className="size-8 rounded-lg bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                                                    {app.company_logo
                                                        ? <img src={app.company_logo} alt={app.company} style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'white', padding: '1px' }} onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'block'; }} />
                                                        : null}
                                                    <span className="material-symbols-outlined text-slate-400 dark:text-white text-base" style={{ display: app.company_logo ? 'none' : 'block' }}>corporate_fare</span>
                                                </div>
                                                <div className="flex flex-col gap-1 items-end">
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ml-auto ${getStatusStyle(app.status)}`}>{getStatusText(app.status)}</span>
                                                    <div className="mt-auto">
                                                        <InterestStars level={app.interest_level} size="0.9rem" />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-0.5 pointer-events-none">
                                                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight line-clamp-2">{app.job_title || 'Unknown Role'}</h4>
                                                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">{app.company || 'Unknown'}</p>
                                            </div>
                                            <div className="flex flex-col gap-1 border-t border-slate-200 dark:border-white/10 pt-2 pointer-events-none">
                                                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                                    <span className="material-symbols-outlined text-[12px]">location_on</span>
                                                    <span className="truncate">{app.location || 'Remote'}{app.location_type ? ` (${app.location_type})` : ''}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-[10px]">
                                                    <span className="font-bold text-primary">{app.salary_range && app.salary_range !== "Not Listed" ? app.salary_range : '-'}</span>
                                                    <span className="text-slate-400 dark:text-slate-500">{app.job_type || 'Full-time'}</span>
                                                </div>
                                            </div>
                                            </>
                                        )}
                                    </div>
                                </React.Fragment>
                            );
                        })}
                        {dropPlaceholder.column === col && dropPlaceholder.index === (appsByColumn[col] || []).length && (
                            <div className="w-full h-24 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 flex items-center justify-center animate-pulse transition-all duration-200 shrink-0">
                                <div className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Drop Here</div>
                            </div>
                        )}
                    </div>
                </div>
            )
        })}
    </div>
</div>
}
                {viewMode === 'list' && (
                    <div className="flex-1 overflow-auto px-8 pb-8">
                        <div className="flex flex-col gap-4">
                            {processedApps.map(app => (
                                <div key={app.id} onClick={() => onViewApp(app)} className="glass-card p-4 rounded-xl flex flex-col sm:flex-row gap-4 cursor-pointer group shadow-sm hover:shadow-md transition-all border border-slate-200/60 dark:border-white/10">
                                    <div className="flex items-start gap-4 flex-1">
                                        <div className="size-11 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                                            {app.company_logo
                                                ? <img src={app.company_logo} alt={app.company} style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'white', padding: '2px' }} onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'block'; }} />
                                                : null}
                                            <span className="material-symbols-outlined text-slate-400 dark:text-white text-lg" style={{ display: app.company_logo ? 'none' : 'block' }}>corporate_fare</span>
                                        </div>
                                        <div className="flex flex-col gap-0.5 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 group-hover:text-primary transition-colors leading-tight">{app.job_title || 'Unknown'}</h3>
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${getStatusStyle(app.status)}`}>{getStatusText(app.status)}</span>
                                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                                                    <InterestStars level={app.interest_level} size="0.9rem" />
                                                    {app.interest_level && (
                                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 capitalize">
                                                            {app.interest_level}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{app.company || 'Unknown'}</p>
                                            
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="material-symbols-outlined text-[14px]">location_on</span>
                                                    <span>{app.location || 'Remote'}{app.location_type ? ` (${app.location_type})` : ''}</span>
                                                </div>
                                                {app.job_type && (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="material-symbols-outlined text-[14px]">work</span>
                                                        <span>{app.job_type}</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-1.5">
                                                    <span className="material-symbols-outlined text-[14px]">payments</span>
                                                    <span className="font-semibold text-slate-600 dark:text-slate-200">{app.salary_range && app.salary_range !== "Not Listed" ? app.salary_range : '-'}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-slate-400">
                                                    <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                                    <span>{new Date(app.date_saved).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {viewMode === 'table' && 
<div className="flex-1 overflow-auto px-8 pb-8">
    <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-xl">
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className="bg-slate-100 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Company</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Job Title</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Location</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Salary</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Deadline</th>
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
                                        ? <img src={app.company_logo} alt={app.company} style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'white', padding: '2px' }} onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'block'; }} />
                                        : null}
                                    <span className="material-symbols-outlined text-slate-400 dark:text-white" style={{ display: app.company_logo ? 'none' : 'block' }}>corporate_fare</span>
                                </div>
                                <span className="font-bold text-slate-800 dark:text-slate-100">{app.company || 'Unknown'}</span>
                            </div>
                        </td>
                        <td className="px-6 py-4"><span className="text-sm font-medium text-slate-600 dark:text-slate-300 group-hover:text-primary transition-colors">{app.job_title || 'Unknown'}</span></td>
                        <td className="px-6 py-4">
                            <div className="text-sm font-medium text-slate-600 dark:text-slate-300">{app.location || 'Remote'}</div>
                            {app.location_type && <div className="text-[10px] text-slate-500 uppercase tracking-tight">{app.location_type}</div>}
                        </td>
                        <td className="px-6 py-4"><span className="text-sm font-bold text-primary">{app.salary_range && app.salary_range !== "Not Listed" ? app.salary_range : '-'}</span></td>
                        <td className="px-6 py-4">
                            <span className={`text-sm ${app.deadline ? 'text-rose-400 font-bold' : 'text-slate-500'}`}>
                                {app.deadline || '-'}
                            </span>
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
