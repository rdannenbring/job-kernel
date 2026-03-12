import { useState, useEffect, useRef } from 'react'
import './index.css'
import Sidebar from './components/Layout/Sidebar'
import Dashboard from './pages/Dashboard'
import NewApplication from './pages/NewApplication'
import ApplicationDetail from './pages/ApplicationDetail'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import Profile from './pages/Profile'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Map screen IDs <-> URL hashes
const SCREEN_TO_HASH = {
  dashboard: '#dashboard',
  new_app: '#new_app',
  detail: '#detail',
  analytics: '#analytics',
  settings: '#settings',
  profile: '#profile',
};
const HASH_TO_SCREEN = Object.fromEntries(
  Object.entries(SCREEN_TO_HASH).map(([k, v]) => [v, k])
);

function hashToScreen(hash) {
  return HASH_TO_SCREEN[hash] || 'dashboard';
}

function App() {
  const [currentScreen, setCurrentScreenState] = useState(() => {
    // Initialize from URL hash so a direct link/refresh lands on the right screen
    return hashToScreen(window.location.hash) || 'dashboard';
  });
  const [selectedApp, setSelectedApp] = useState(null);
  const [apps, setApps] = useState([]);
  const [uiConfigTheme, setUiConfigTheme] = useState('system');

  // Profile dirty-state ref — Profile.jsx sets window.__profileIsDirty = true/false
  const isDirtyRef = useRef(false);

  // Expose a setter so Profile can update the ref without re-renders
  useEffect(() => {
    window.__setProfileDirty = (val) => { isDirtyRef.current = val; };
    return () => { delete window.__setProfileDirty; };
  }, []);

  // Navigate to a screen, guarding dirty profile state
  const setScreen = (screen, { replace = false } = {}) => {
    // Guard: warn if leaving Profile with unsaved changes
    if (currentScreen === 'profile' && isDirtyRef.current && screen !== 'profile') {
      const ok = window.confirm('You have unsaved changes on your Profile. Leave without saving?');
      if (!ok) return;
      isDirtyRef.current = false;
    }

    const hash = SCREEN_TO_HASH[screen] || '#dashboard';
    if (replace) {
      window.history.replaceState({ screen }, '', hash);
    } else {
      window.history.pushState({ screen }, '', hash);
    }
    setCurrentScreenState(screen);
  };

  // Sync state when user presses browser Back/Forward
  useEffect(() => {
    const handlePopState = (e) => {
      const screen = e.state?.screen || hashToScreen(window.location.hash);

      // Guard: if currently on dirty Profile, ask before leaving
      if (currentScreen === 'profile' && isDirtyRef.current) {
        const ok = window.confirm('You have unsaved changes on your Profile. Leave without saving?');
        if (!ok) {
          // Re-push current entry so the URL stays on #profile
          window.history.pushState({ screen: 'profile' }, '', SCREEN_TO_HASH['profile']);
          return;
        }
        isDirtyRef.current = false;
      }
      setCurrentScreenState(screen);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentScreen]);

  // Load applications on mount or when returning to dashboard
  const loadApplications = async () => {
    try {
      const res = await fetch(`${API_URL}/api/applications`)
      const data = await res.json()
      setApps(data)
    } catch (e) {
      console.error("Failed to load apps", e)
    }
  }

  useEffect(() => {
    loadApplications()

    // Fetch config to apply UI settings
    fetch(`${API_URL}/api/config`)
      .then(res => res.json())
      .then(data => {
        if (data.ui_config) {
          if (data.ui_config.font_size) {
            document.documentElement.style.fontSize = `${data.ui_config.font_size}px`;
          }
          if (data.ui_config.theme) {
            setUiConfigTheme(data.ui_config.theme);
          }
        }
      })
      .catch(e => console.error("Failed to load global config:", e));

    // Check if a job was passed from the extension
    const params = new URLSearchParams(window.location.search);
    const processJobData = params.get('processJob');
    const viewAppId = params.get('viewApp');

    if (processJobData) {
      try {
        const decoded = JSON.parse(decodeURIComponent(atob(processJobData)));
        sessionStorage.setItem('extensionJobData', JSON.stringify(decoded));

        // Clean up URL so it doesn't persist on reload
        window.history.replaceState({}, document.title, window.location.pathname);

        // Auto-navigate to New Application screen
        setScreen('new_app', { replace: true });
      } catch (e) {
        console.error("Failed to parse processJob from URL", e);
      }
    } else if (viewAppId) {
      // Direct navigation to details
      const id = parseInt(viewAppId);
      
      // We need to fetch the app specifically if it's not already in state
      fetch(`${API_URL}/api/applications/${id}`)
        .then(res => {
          if (!res.ok) throw new Error("App not found");
          return res.json();
        })
        .then(app => {
          setSelectedApp(app);
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname + "#detail");
          setCurrentScreenState('detail');
        })
        .catch(e => {
          console.error("Failed to load app for viewAppId", e);
          // If we can't load the app, go back to dashboard
          window.history.replaceState({ screen: 'dashboard' }, '', '#dashboard');
          setCurrentScreenState('dashboard');
        });
    } else {
      // Ensure the initial hash is reflected in history so Back works from the first screen
      const initialScreen = hashToScreen(window.location.hash);
      if (initialScreen === 'detail' && !selectedApp) {
        setScreen('dashboard', { replace: true });
      } else {
        window.history.replaceState({ screen: initialScreen }, '', SCREEN_TO_HASH[initialScreen] || '#dashboard');
      }
    }
  }, [])

  // Apply and listen to theme changes
  useEffect(() => {
    const applyTheme = () => {
      let activeTheme = uiConfigTheme;
      if (!activeTheme || activeTheme === 'system') {
        activeTheme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      }
      document.documentElement.setAttribute('data-theme', activeTheme);
      document.documentElement.classList.toggle('dark', activeTheme === 'dark');
    };
    
    applyTheme();
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleChange = () => applyTheme();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [uiConfigTheme]);

  // --- Handlers ---
  const handleStartNew = () => {
    setScreen('new_app')
  }

  const handleViewApp = (app) => {
    setSelectedApp(app)
    setScreen('detail')
  }

  const handleAppComplete = () => {
    loadApplications() // Refresh list
    setScreen('dashboard')
  }

  const handleDeleteApp = (deletedId) => {
    setApps(prev => prev.filter(a => a.id !== deletedId));
    setScreen('dashboard');
  }

  const handleArchiveApp = (appId, archived) => {
    setApps(prev => prev.map(a => a.id === appId ? { ...a, is_archived: archived ? 'true' : 'false' } : a));
  }

  const handleStatusUpdate = async (appId, newStatus) => {
    // Optimistic update
    handleAppUpdate(appId, { status: newStatus });

    try {
      await fetch(`${API_URL}/api/applications/${appId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });
    } catch (e) {
      console.error("Failed to update status", e);
      loadApplications(); // revert
    }
  }

  const handleAppUpdate = (appId, updates) => {
    setApps(prev => prev.map(a => a.id === appId ? { ...a, ...updates } : a));
    if (selectedApp && selectedApp.id === appId) {
      setSelectedApp(prev => prev ? { ...prev, ...updates } : null);
    }
  }

  const handleThemeToggle = async () => {
    // Current active theme
    const activeTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = activeTheme === 'dark' ? 'light' : 'dark';
    
    // Update local state
    setUiConfigTheme(newTheme);
    
    // Persist to backend
    try {
      // First get current config
      const res = await fetch(`${API_URL}/api/config`);
      const config = await res.json();
      
      // Update only ui_config.theme
      config.ui_config = {
        ...config.ui_config,
        theme: newTheme
      };
      
      await fetch(`${API_URL}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
    } catch (e) {
      console.warn("Failed to persist theme change", e);
    }
  };

  // --- Routing ---
  const renderScreen = () => {
    switch (currentScreen) {
      case 'dashboard':
        return <Dashboard apps={apps} onStartNew={handleStartNew} onViewApp={handleViewApp} onStatusUpdate={handleStatusUpdate} onUpdate={handleAppUpdate} />
      case 'new_app':
        return <NewApplication onComplete={handleAppComplete} />
      case 'detail':
        if (!selectedApp) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '40px', height: '40px', border: '3px solid var(--bg-tertiary)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
                <p>Loading application details...</p>
              </div>
            </div>
          );
        }
        return <ApplicationDetail app={selectedApp} onBack={() => setScreen('dashboard')} onDelete={handleDeleteApp} onArchive={handleArchiveApp} onStatusUpdate={handleStatusUpdate} onUpdate={handleAppUpdate} />
      case 'analytics':
        return <Analytics />
      case 'settings':
        return <Settings theme={uiConfigTheme} onThemeChange={setUiConfigTheme} />
      case 'profile':
        return <Profile />
      default:
        return <Dashboard apps={apps} onStartNew={handleStartNew} onViewApp={handleViewApp} onStatusUpdate={handleStatusUpdate} onUpdate={handleAppUpdate} />
    }
  }

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Sidebar Navigation */}
      <Sidebar 
        currentScreen={currentScreen} 
        setScreen={setScreen} 
        theme={uiConfigTheme} 
        onThemeToggle={handleThemeToggle} 
      />

      {/* Main Content Area */}
      <main style={{ flex: 1, height: '100%', overflowY: 'auto', position: 'relative' }}>
        {renderScreen()}
      </main>
    </div>
  )
}

export default App
