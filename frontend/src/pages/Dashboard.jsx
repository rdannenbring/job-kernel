
import React, { useState, useEffect, useRef } from 'react';
import './Dashboard.css';

const DASH_STORAGE_KEY = 'dashboard_state';

function loadDashState() {
    try {
        const raw = sessionStorage.getItem(DASH_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

const Dashboard = ({ apps, onStartNew, onViewApp, onStatusUpdate }) => {
    const saved = loadDashState();
    const [viewMode, setViewMode] = useState(saved.viewMode || 'kanban');
    const [draggedOverCol, setDraggedOverCol] = useState(null);
    const [searchTerm, setSearchTerm] = useState(saved.searchTerm || '');
    const [sortBy, setSortBy] = useState(saved.sortBy || 'newest');
    const [filterStatuses, setFilterStatuses] = useState(saved.filterStatuses || []);
    const [showArchived, setShowArchived] = useState(saved.showArchived || false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterRef = useRef(null);
    const [isSortOpen, setIsSortOpen] = useState(false);
    const sortRef = useRef(null);

    // Persist state to sessionStorage whenever it changes
    useEffect(() => {
        sessionStorage.setItem(DASH_STORAGE_KEY, JSON.stringify({ viewMode, searchTerm, sortBy, filterStatuses, showArchived }));
    }, [viewMode, searchTerm, sortBy, filterStatuses, showArchived]);

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

    const getStatusStyle = (status) => {
        const s = (status || '').toLowerCase();
        if (s.includes('reviewing') || s.includes('applied')) return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
        if (s.includes('interview')) return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
        if (s.includes('offer') || s.includes('accepted')) return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
        if (s.includes('reject') || s.includes('archived')) return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
        if (s.includes('saved')) return 'bg-slate-500/20 text-slate-400 border border-slate-500/30';
        if (s.includes('generated')) return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
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
                              (app.company || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterStatuses.length === 0 ? true : filterStatuses.includes(getStatusText(app.status));
        return matchesSearch && matchesFilter;
    }).sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.date_saved) - new Date(a.date_saved);
        if (sortBy === 'oldest') return new Date(a.date_saved) - new Date(b.date_saved);
        if (sortBy === 'company_asc') return (a.company || '').localeCompare(b.company || '');
        if (sortBy === 'company_desc') return (b.company || '').localeCompare(a.company || '');
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
        setSearchTerm('');
        setSortBy('newest');
    };

    const onDragStart = (e, appId) => {
        e.dataTransfer.setData('appId', appId);
    };

    const onDrop = (e, newStatus) => {
        e.preventDefault();
        setDraggedOverCol(null);
        const appId = parseInt(e.dataTransfer.getData('appId'), 10);
        if (!appId) return;
        
        const currentApp = apps.find(a => a.id === appId);
        if (currentApp && getStatusText(currentApp.status) !== newStatus) {
            onStatusUpdate(appId, newStatus);
        }
    };

    const onDragOver = (e, col) => {
        e.preventDefault();
        if (draggedOverCol !== col) {
            setDraggedOverCol(col);
        }
    };

    const onDragLeave = (e) => {
        if (!e.currentTarget.contains(e.nativeEvent.relatedTarget)) {
            setDraggedOverCol(null);
        }
    };

    return (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10 h-full">
            <header className="flex items-center justify-between px-8 py-4 border-b border-slate-200/10 glass-panel shrink-0">
                <div className="flex items-center gap-6 flex-1">
                    <h2 className="text-xl font-bold tracking-tight text-slate-100">Dashboard</h2>
                    <div className="flex items-center bg-white/5 rounded-lg p-1 border border-white/10">
                        <button onClick={() => setViewMode('kanban')} className={`px-4 py-1.5 text-sm transition-colors rounded-md ${viewMode === 'kanban' ? 'font-semibold text-white bg-primary shadow-lg shadow-primary/20' : 'font-medium text-slate-400 hover:text-slate-100'}`}>Board</button>
                        <button onClick={() => setViewMode('list')} className={`px-4 py-1.5 text-sm transition-colors rounded-md ${viewMode === 'list' ? 'font-semibold text-white bg-primary shadow-lg shadow-primary/20' : 'font-medium text-slate-400 hover:text-slate-100'}`}>List</button>
                        <button onClick={() => setViewMode('table')} className={`px-4 py-1.5 text-sm transition-colors rounded-md ${viewMode === 'table' ? 'font-semibold text-white bg-primary shadow-lg shadow-primary/20' : 'font-medium text-slate-400 hover:text-slate-100'}`}>Table</button>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative hidden sm:block">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                        <input 
                            type="text" 
                            placeholder="Search applications..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-200 w-64 placeholder:text-slate-500" 
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
                                className={`appearance-none bg-white/5 border ${filterStatuses.length > 0 ? 'border-primary/50 text-white' : 'border-white/10 text-slate-300'} hover:border-white/20 pl-10 pr-8 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer h-full flex items-center w-48 justify-between`}
                            >
                                <span className="material-symbols-outlined text-lg absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">filter_list</span>
                                <span>{filterStatuses.length === 0 ? 'All Status' : `${filterStatuses.length} Selected`}</span>
                                <span className="material-symbols-outlined text-lg text-slate-400">expand_more</span>
                            </button>
                            
                            {isFilterOpen && (
                                <div className="absolute top-11 left-0 w-56 glass-panel bg-[#0a0f18]/95 border border-white/10 rounded-xl shadow-2xl z-50 p-2 overflow-hidden flex flex-col gap-1 backdrop-blur-xl">
                                    {KANBAN_COLUMNS.map(col => {
                                        const isSelected = filterStatuses.includes(col);
                                        return (
                                            <button 
                                                key={col}
                                                onClick={() => toggleStatusFilter(col)}
                                                className={`flex items-center justify-between px-3 py-2 cursor-pointer rounded-lg text-sm font-medium transition-all ${
                                                    isSelected 
                                                        ? 'bg-primary/20 text-blue-300 hover:bg-primary/30' 
                                                        : 'hover:bg-white/5 text-slate-300'
                                                }`}
                                            >
                                                <span>{col}</span>
                                                {isSelected && (
                                                    <span className="material-symbols-outlined text-[16px] text-blue-400">check</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="relative flex items-center h-9" ref={sortRef}>
                            <button 
                                onClick={() => setIsSortOpen(!isSortOpen)}
                                className={`appearance-none bg-white/5 border ${sortBy !== 'newest' ? 'border-primary/50 text-white' : 'border-white/10 text-slate-300'} hover:border-white/20 pl-10 pr-8 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer h-full flex items-center w-48 justify-between`}
                            >
                                <span className="material-symbols-outlined text-lg absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">sort</span>
                                <span>
                                    {sortBy === 'newest' ? 'Newest' : 
                                     sortBy === 'oldest' ? 'Oldest' : 
                                     sortBy === 'company_asc' ? 'Company (A-Z)' : 
                                     'Company (Z-A)'}
                                </span>
                                <span className="material-symbols-outlined text-lg text-slate-400">expand_more</span>
                            </button>
                            
                            {isSortOpen && (
                                <div className="absolute top-11 left-0 w-48 glass-panel bg-[#0a0f18]/95 border border-white/10 rounded-xl shadow-2xl z-50 p-2 overflow-hidden flex flex-col gap-1 backdrop-blur-xl">
                                    {[
                                        { id: 'newest', label: 'Newest' },
                                        { id: 'oldest', label: 'Oldest' },
                                        { id: 'company_asc', label: 'Company (A-Z)' },
                                        { id: 'company_desc', label: 'Company (Z-A)' }
                                    ].map(option => {
                                        const isSelected = sortBy === option.id;
                                        return (
                                            <button 
                                                key={option.id}
                                                onClick={() => { setSortBy(option.id); setIsSortOpen(false); }}
                                                className={`flex items-center justify-between px-3 py-2 cursor-pointer rounded-lg text-sm font-medium transition-all ${
                                                    isSelected 
                                                        ? 'bg-primary/20 text-blue-300 hover:bg-primary/30' 
                                                        : 'hover:bg-white/5 text-slate-300'
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
                                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20'
                            }`}
                        >
                            <span className="material-symbols-outlined text-[16px]">{showArchived ? 'inventory_2' : 'archive'}</span>
                            {showArchived ? 'Archived' : 'Archive'}
                        </button>
                        <div className="text-sm text-slate-400">Showing {processedApps.length} of {apps.filter(a => showArchived ? a.is_archived === 'true' : a.is_archived !== 'true').length}</div>
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
                        {sortBy !== 'newest' && (
                            <span className="bg-white/5 border border-white/10 text-slate-200 px-3 py-1 rounded-full flex items-center gap-2 text-xs">
                                <span className="opacity-50">Sort:</span> 
                                {sortBy === 'oldest' ? 'Oldest' : sortBy === 'company_asc' ? 'Company (A-Z)' : 'Company (Z-A)'}
                                <button onClick={() => setSortBy('newest')} className="hover:text-rose-400 material-symbols-outlined text-[14px] ml-1">close</button>
                            </span>
                        )}
                        <button onClick={clearAllFilters} className="text-slate-400 hover:text-white ml-2 text-xs uppercase tracking-wider font-bold transition-colors">Clear All</button>
                    </div>
                )}
            </div>

            {apps.length === 0 ? (
                <div className="px-8 flex-1 flex flex-col items-center justify-center">
                    <div className="glass-card flex flex-col items-center justify-center p-12 rounded-2xl">
                        <div className="text-6xl mb-4">📭</div>
                        <h3 className="text-xl font-bold mb-2">No applications yet</h3>
                        <p className="text-slate-400 mb-6 text-sm">Tailor your first resume to get started!</p>
                        <button onClick={onStartNew} className="bg-primary px-6 py-2 rounded-lg font-bold">Create New Job</button>
                    </div>
                </div>
            ) : (
                <>
                {viewMode === 'kanban' && 
<div className="flex-1 overflow-x-auto p-6 pt-2" style={{ paddingBottom: '2rem' }}>
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
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <span className={`size-2 rounded-full ${colorClass}`}></span>
                            {col} <span className="text-xs font-normal ml-1 opacity-50">({appsByColumn[col].length})</span>
                        </h3>
                        <button className="text-slate-500 hover:text-slate-300"><span className="material-symbols-outlined">more_horiz</span></button>
                    </div>
                    <div className="flex flex-col gap-3 overflow-y-auto" style={{ minHeight: '400px' }}>
                        {appsByColumn[col].map(app => (
                            <div key={app.id} 
                                draggable 
                                onDragStart={(e) => onDragStart(e, app.id)} 
                                onDragEnd={() => setDraggedOverCol(null)}
                                onClick={() => onViewApp(app)}
                                className="glass-card p-4 rounded-xl flex flex-col gap-3 cursor-pointer shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
                                <div className="flex justify-between items-start">
                                    <div className="size-10 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                                        {app.company_logo
                                            ? <img src={app.company_logo} alt={app.company} style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'white', padding: '2px' }} onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'block'; }} />
                                            : null}
                                        <span className="material-symbols-outlined text-white" style={{ display: app.company_logo ? 'none' : 'block' }}>corporate_fare</span>
                                    </div>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${getStatusStyle(app.status)}`}>{getStatusText(app.status)}</span>
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-100">{app.job_title || 'Unknown Role'}</h4>
                                    <p className="text-xs text-slate-400">{app.company || 'Unknown'} • {app.location || 'Remote'}</p>
                                </div>
                                <div className="flex items-center justify-between border-t border-white/5 pt-3">
                                    <span className="text-xs font-bold text-primary">{app.salary_range && app.salary_range !== "Not Listed" ? app.salary_range : '-'}</span>
                                    <span className="text-[10px] text-slate-500">Saved {new Date(app.date_saved).toLocaleDateString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )
        })}
    </div>
</div>
}
                {viewMode === 'list' && 
<div className="flex-1 overflow-auto px-8 pb-8">
    <div className="flex flex-col gap-4">
        {processedApps.map(app => (
            <div key={app.id} onClick={() => onViewApp(app)} className="glass-card p-6 rounded-2xl flex flex-col sm:flex-row gap-6 cursor-pointer group">
                <div className="flex items-start gap-4 flex-1">
                    <div className="size-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                        {app.company_logo
                            ? <img src={app.company_logo} alt={app.company} style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'white', padding: '3px' }} onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'block'; }} />
                            : null}
                        <span className="material-symbols-outlined text-white text-xl" style={{ display: app.company_logo ? 'none' : 'block' }}>corporate_fare</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold text-slate-100 group-hover:text-primary transition-colors">{app.job_title || 'Unknown'}</h3>
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusStyle(app.status)}`}>{getStatusText(app.status)}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-400">{app.company || 'Unknown'}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                            <div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px]">payments</span><span className="font-semibold text-slate-300">{app.salary_range && app.salary_range !== "Not Listed" ? app.salary_range : '-'}</span></div>
                            <div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px]">calendar_today</span><span>{new Date(app.date_saved).toLocaleDateString()}</span></div>
                        </div>
                    </div>
                </div>
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-4 shrink-0 border-t sm:border-t-0 sm:border-l border-white/10 pt-4 sm:pt-0 sm:pl-6 text-right">
                    <button className="text-slate-500 hover:text-slate-300 transition-colors"><span className="material-symbols-outlined text-xl">more_vert</span></button>
                </div>
            </div>
        ))}
    </div>
</div>
}
                {viewMode === 'table' && 
<div className="flex-1 overflow-auto px-8 pb-8">
    <div className="glass-panel rounded-2xl overflow-hidden border border-white/10">
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className="bg-white/5 border-b border-white/10">
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Company</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Job Title</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Salary</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Date Applied</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Status</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 text-right">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
                {processedApps.map(app => (
                    <tr key={app.id} className="glass-row group cursor-pointer" onClick={() => onViewApp(app)}>
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                                    {app.company_logo
                                        ? <img src={app.company_logo} alt={app.company} style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'white', padding: '2px' }} onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'block'; }} />
                                        : null}
                                    <span className="material-symbols-outlined text-white" style={{ display: app.company_logo ? 'none' : 'block' }}>corporate_fare</span>
                                </div>
                                <span className="font-bold text-slate-100">{app.company || 'Unknown'}</span>
                            </div>
                        </td>
                        <td className="px-6 py-4"><span className="text-sm font-medium text-slate-300 group-hover:text-primary transition-colors">{app.job_title || 'Unknown'}</span></td>
                        <td className="px-6 py-4"><span className="text-sm font-bold text-primary">{app.salary_range && app.salary_range !== "Not Listed" ? app.salary_range : '-'}</span></td>
                        <td className="px-6 py-4"><span className="text-sm text-slate-400">{new Date(app.date_saved).toLocaleDateString()}</span></td>
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
