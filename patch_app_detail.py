with open('frontend/src/pages/ApplicationDetail.jsx', 'r') as f:
    content = f.read()

# We only want to remove the fetching logic and use the pre-calculated commute stats
new_commute_logic = """
        // Use precalculated commute
        if (app.id) {
            const getPrefs = async () => {
                try {
                    const profileRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/profile`);
                    const profileData = await profileRes.json();
                    setProfilePrefs(profileData?.preferences || {});
                    
                    const maxCommutePref = profileData?.preferences?.max_commute || '';
                    let maxCommuteMins = null;
                    if (maxCommutePref === '15 mins') maxCommuteMins = 15;
                    else if (maxCommutePref === '30 mins') maxCommuteMins = 30;
                    else if (maxCommutePref === '45 mins') maxCommuteMins = 45;
                    else if (maxCommutePref === '1 hour') maxCommuteMins = 60;
                    else if (maxCommutePref === '1.5 hours') maxCommuteMins = 90;
                    else if (maxCommutePref === '2 hours') maxCommuteMins = 120;
                    else if (maxCommutePref === 'Remote Only') maxCommuteMins = 0;

                    if (!app.location) {
                        setCommuteInfo({ text: 'No Location Provided' });
                        return;
                    }

                    if (app.location.toLowerCase().includes('remote') || app.location_type?.toLowerCase() === 'remote') {
                        setCommuteInfo({ text: 'Remote (No Commute)' });
                        return;
                    }

                    if (app.commute_time_mins !== undefined && app.commute_time_mins !== null) {
                        const mins = app.commute_time_mins;
                        const dist = app.commute_distance_miles;
                        const isOverLimit = maxCommuteMins !== null && mins > maxCommuteMins;
                        
                        const originParts = [];
                        if (profileData.address_line1) originParts.push(profileData.address_line1);
                        if (profileData.city) originParts.push(profileData.city);
                        if (profileData.state) originParts.push(profileData.state);
                        const originStr = originParts.join(', ');
                        const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originStr)}&destination=${encodeURIComponent(app.location)}&travelmode=driving`;
                        
                        setCommuteInfo({
                            text: `${mins} min driving (${dist || 0} mi)`,
                            isOverLimit,
                            maxMins: maxCommuteMins,
                            url: directionsUrl
                        });
                    } else {
                        setCommuteInfo({ text: 'Calculation pending...' });
                    }
                } catch(e) {
                    setCommuteInfo({ text: 'Unavailable' });
                }
            };
            getPrefs();
        }
"""
import re
content = re.sub(
    r'// Fetch Commute.*?}\s*};\s*getCommute\(\);\s*}',
    new_commute_logic.strip(),
    content,
    flags=re.DOTALL
)

with open('frontend/src/pages/ApplicationDetail.jsx', 'w') as f:
    f.write(content)
print("done")
