import re

with open('frontend/src/pages/Profile.jsx', 'r') as f:
    content = f.read()

func = """
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
"""

if 'const [isRecalculating' not in content:
    content = content.replace("const [loading, setLoading] = useState(true);", "const [loading, setLoading] = useState(true);\n" + func)

btn = """
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
"""

content = content.replace("                            </InputGroup>\n                        </div>\n                    </section>", btn)

with open('frontend/src/pages/Profile.jsx', 'w') as f:
    f.write(content)
print("done")
