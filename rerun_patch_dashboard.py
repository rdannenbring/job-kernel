import re

with open('frontend/src/pages/Dashboard.jsx', 'r') as f:
    content = f.read()

if 'const [filterSalaryPreference' not in content:
    content = content.replace(
        "const [filterNetworking, setFilterNetworking] = useState(saved.filterNetworking || false);",
        "const [filterNetworking, setFilterNetworking] = useState(saved.filterNetworking || false);\n    const [filterSalaryPreference, setFilterSalaryPreference] = useState(saved.filterSalaryPreference || []);\n    const [filterWorkSettingPreference, setFilterWorkSettingPreference] = useState(saved.filterWorkSettingPreference || []);\n    const [filterCommutePreference, setFilterCommutePreference] = useState(saved.filterCommutePreference || []);\n    const [profile, setProfile] = useState(null);"
    )

    fetch_logic = """
    useEffect(() => {
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/profile`)
            .then(res => res.json())
            .then(data => setProfile(data))
            .catch(err => console.error(err));
    }, []);

    const extractSalaryNumbers = (str) => {
        if (!str) return [];
        const normalized = str.replace(/,/g, '');
        const regex = /(\d+(?:\.\d+)?)(k)?/gi;
        let match;
        const nums = [];
        while ((match = regex.exec(normalized)) !== null) {
            let val = parseFloat(match[1]);
            if (match[2] && match[2].toLowerCase() === 'k') val *= 1000;
            else if (val < 1000 && val > 0 && str.toLowerCase().includes('k')) val *= 1000;
            else if (val < 1000 && val > 0 && !str.toLowerCase().includes('k')) val *= 2080;
            nums.push(val);
        }
        return nums;
    };
    """
    content = content.replace("const KANBAN_COLUMNS = ['Saved', 'Generated', 'Applied', 'Interviewing', 'Rejected', 'Offered', 'Accepted', 'Declined'];", fetch_logic + "\n    const KANBAN_COLUMNS = ['Saved', 'Generated', 'Applied', 'Interviewing', 'Rejected', 'Offered', 'Accepted', 'Declined'];")

    filter_logic = """
        const matchesNetworking = !filterNetworking ? true : (connectionMatches[app.company]?.length > 0);
        
        let cMatch = 'Unknown';
        if (profile?.preferences?.max_commute) {
             const maxPref = profile.preferences.max_commute;
             let limit = null;
             if (maxPref === '15 mins') limit = 15;
             else if (maxPref === '30 mins') limit = 30;
             else if (maxPref === '45 mins') limit = 45;
             else if (maxPref === '1 hour') limit = 60;
             else if (maxPref === '1.5 hours') limit = 90;
             else if (maxPref === '2 hours') limit = 120;
             else if (maxPref === 'Remote Only') limit = 0;
             
             if (limit !== null) {
                 if (app.commute_time_mins !== null && app.commute_time_mins !== undefined) {
                     cMatch = app.commute_time_mins <= limit ? 'Under Preferred Limit' : 'Over Preferred Limit';
                 }
             }
        }
        const matchesCommute = filterCommutePreference.length === 0 ? true : filterCommutePreference.includes(cMatch);
        
        let wsMatch = 'Unknown';
        if (profile?.preferences?.work_setting) {
             const userWs = profile.preferences.work_setting;
             const jobWs = app.location_type || app.location || '';
             if (userWs === 'Any' || (userWs.toLowerCase() === 'remote' && jobWs.toLowerCase() === 'hybrid') || jobWs.toLowerCase().includes(userWs.toLowerCase())) {
                 wsMatch = 'Matches Preference';
             } else {
                 wsMatch = "Doesn't Match Preference";
             }
        }
        const matchesWorkSetting = filterWorkSettingPreference.length === 0 ? true : filterWorkSettingPreference.includes(wsMatch);
        
        let salMatch = 'Unknown';
        if (profile?.preferences?.min_salary || profile?.preferences?.max_salary) {
             const jobSalaries = extractSalaryNumbers(app.salary_range);
             if (jobSalaries.length > 0) {
                  const jobMin = Math.min(...jobSalaries);
                  const jobMax = Math.max(...jobSalaries);
                  const userMin = profile.preferences.min_salary ? Number(profile.preferences.min_salary) : null;
                  const userMax = profile.preferences.max_salary ? Number(profile.preferences.max_salary) : null;
                  const mMin = userMin ? jobMax >= userMin : true;
                  const mMax = userMax ? jobMin <= userMax : true;
                  salMatch = (mMin && mMax) ? 'Matches Preference' : "Doesn't Match Preference";
             } else {
                  salMatch = "Doesn't Match Preference";
             }
        }
        const matchesSalary = filterSalaryPreference.length === 0 ? true : filterSalaryPreference.includes(salMatch);

        return matchesSearch && matchesStatus && matchesJobType && matchesLocType && matchesInterest && matchesRelocation && matchesNetworking && matchesCommute && matchesWorkSetting && matchesSalary;
    """
    content = content.replace(
        "const matchesNetworking = !filterNetworking ? true : (connectionMatches[app.company]?.length > 0);\n        \n        return matchesSearch && matchesStatus && matchesJobType && matchesLocType && matchesInterest && matchesRelocation && matchesNetworking;",
        filter_logic
    )

    toggle_ui = """
                                    <div className="flex flex-col gap-1 border-t border-slate-200 dark:border-white/10 pt-2">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 px-1">Commute Preference</div>
                                        {['Under Preferred Limit', 'Over Preferred Limit'].map(limit => {
                                            const isSelected = filterCommutePreference.includes(limit);
                                            return (
                                                <button 
                                                    key={limit}
                                                    onClick={() => setFilterCommutePreference(prev => prev.includes(limit) ? prev.filter(l => l !== limit) : [...prev, limit])}
                                                    className={`flex items-center justify-between px-3 py-1.5 cursor-pointer rounded-lg text-xs font-medium transition-all ${isSelected ? 'bg-primary/20 text-primary dark:text-blue-300 hover:bg-primary/30' : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300'}`}
                                                >
                                                    <span>{limit}</span>
                                                    {isSelected && <span className="material-symbols-outlined text-[14px]">check</span>}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="flex flex-col gap-1 border-t border-slate-200 dark:border-white/10 pt-2">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 px-1">Work Setting</div>
                                        {['Matches Preference', "Doesn't Match Preference"].map(match => {
                                            const isSelected = filterWorkSettingPreference.includes(match);
                                            return (
                                                <button 
                                                    key={match}
                                                    onClick={() => setFilterWorkSettingPreference(prev => prev.includes(match) ? prev.filter(m => m !== match) : [...prev, match])}
                                                    className={`flex items-center justify-between px-3 py-1.5 cursor-pointer rounded-lg text-xs font-medium transition-all ${isSelected ? 'bg-primary/20 text-primary dark:text-blue-300 hover:bg-primary/30' : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300'}`}
                                                >
                                                    <span>{match}</span>
                                                    {isSelected && <span className="material-symbols-outlined text-[14px]">check</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    
                                    <div className="flex flex-col gap-1 border-t border-slate-200 dark:border-white/10 pt-2">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 px-1">Salary</div>
                                        {['Matches Preference', "Doesn't Match Preference"].map(match => {
                                            const isSelected = filterSalaryPreference.includes(match);
                                            return (
                                                <button 
                                                    key={match}
                                                    onClick={() => setFilterSalaryPreference(prev => prev.includes(match) ? prev.filter(m => m !== match) : [...prev, match])}
                                                    className={`flex items-center justify-between px-3 py-1.5 cursor-pointer rounded-lg text-xs font-medium transition-all ${isSelected ? 'bg-primary/20 text-primary dark:text-blue-300 hover:bg-primary/30' : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300'}`}
                                                >
                                                    <span>{match}</span>
                                                    {isSelected && <span className="material-symbols-outlined text-[14px]">check</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
"""
    content = content.replace(
        """<div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 px-1">Networking</div>""",
        toggle_ui + """<div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 px-1">Networking</div>"""
    )
    
    with open('frontend/src/pages/Dashboard.jsx', 'w') as f:
        f.write(content)
print("done")
