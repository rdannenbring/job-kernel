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
        if (data.ui_config && data.ui_config.font_size) {
          document.documentElement.style.fontSize = `${data.ui_config.font_size}px`;
        }
      })
      .catch(e => console.error("Failed to load global config:", e));

    // Check if a job was passed from the extension
    const params = new URLSearchParams(window.location.search);
    const processJobData = params.get('processJob');

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
    } else {
      // Ensure the initial hash is reflected in history so Back works from the first screen
      const initialScreen = hashToScreen(window.location.hash);
      window.history.replaceState({ screen: initialScreen }, '', SCREEN_TO_HASH[initialScreen] || '#dashboard');
    }
  }, [])

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
    setApps(apps.map(app => app.id === appId ? { ...app, status: newStatus } : app));
    if (selectedApp && selectedApp.id === appId) {
      setSelectedApp({ ...selectedApp, status: newStatus });
    }

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

  // --- Routing ---
  const renderScreen = () => {
    switch (currentScreen) {
      case 'dashboard':
        return <Dashboard apps={apps} onStartNew={handleStartNew} onViewApp={handleViewApp} onStatusUpdate={handleStatusUpdate} />
      case 'new_app':
        return <NewApplication onComplete={handleAppComplete} />
      case 'detail':
        return <ApplicationDetail app={selectedApp} onBack={() => setScreen('dashboard')} onDelete={handleDeleteApp} onArchive={handleArchiveApp} onStatusUpdate={handleStatusUpdate} />
      case 'analytics':
        return <Analytics />
      case 'settings':
        return <Settings />
      case 'profile':
        return <Profile />
      default:
        return <Dashboard apps={apps} onStartNew={handleStartNew} onViewApp={handleViewApp} onStatusUpdate={handleStatusUpdate} />
    }
  }

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Sidebar Navigation */}
      <Sidebar currentScreen={currentScreen} setScreen={setScreen} />

      {/* Main Content Area */}
      <main style={{ flex: 1, height: '100%', overflowY: 'auto', position: 'relative' }}>
        {renderScreen()}
      </main>
    </div>
  )
}

export default App
