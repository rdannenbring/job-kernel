import { useState, useEffect, useRef, useCallback } from 'react'
import './index.css'
import Sidebar from './components/Layout/Sidebar'
import Dashboard from './pages/Dashboard'
import NewApplication from './pages/NewApplication'
import ApplicationDetail from './pages/ApplicationDetail'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import Profile from './pages/Profile'
import ApplicationLifecycle from './pages/ApplicationLifecycle'
import MobileCapture from './pages/MobileCapture'
import Auth from './pages/Auth'
import ResetPassword from './pages/ResetPassword'
import Admin from './pages/Admin'
import Account from './pages/Account'
import { useAuth } from './context/AuthContext'
import NotificationToast from './components/NotificationToast'
import NotificationCenter from './components/NotificationCenter'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

// Map screen IDs <-> URL hashes
const SCREEN_TO_HASH = {
  dashboard: '#dashboard',
  new_app: '#new_app',
  detail: '#detail',
  analytics: '#analytics',
  settings: '#settings',
  profile: '#profile',
  lifecycle: '#lifecycle',
  capture: '#capture',
  admin: '#admin',
  account: '#account',
};
const HASH_TO_SCREEN = Object.fromEntries(
  Object.entries(SCREEN_TO_HASH).map(([k, v]) => [v, k])
);

function hashToScreen(hash) {
  return HASH_TO_SCREEN[hash] || 'dashboard';
}

function App() {
  const { user, token, loading: authLoading, logout, fetchWithAuth } = useAuth();
  const [currentScreen, setCurrentScreenState] = useState(() => {
    // Initialize from URL hash so a direct link/refresh lands on the right screen
    return hashToScreen(window.location.hash) || 'dashboard';
  });
  const [selectedApp, setSelectedApp] = useState(null);
  const [notificationAnchor, setNotificationAnchor] = useState(null);
  const [apps, setApps] = useState([]);
  const [uiConfigTheme, setUiConfigTheme] = useState('system');
  const [isEnriching, setIsEnriching] = useState(false);


  // Profile dirty-state ref — Profile.jsx sets window.__profileIsDirty = true/false
  const isDirtyRef = useRef(false);

  // Expose API URL for the extension to discover
  useEffect(() => {
    let meta = document.querySelector('meta[name="jobkernel-api-url"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'jobkernel-api-url';
      document.head.appendChild(meta);
    }
    meta.content = API_URL;
    
    // Also expose App URL for complete discovery
    let appMeta = document.querySelector('meta[name="jobkernel-app-url"]');
    if (!appMeta) {
      appMeta = document.createElement('meta');
      appMeta.name = 'jobkernel-app-url';
      document.head.appendChild(appMeta);
    }
    appMeta.content = window.location.origin;
  }, []);

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
    if (!token) return;
    try {
      const res = await fetchWithAuth(`${API_URL}/api/applications`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setApps(data)
      } else {
        console.error("API returned non-array data for applications:", data)
        setApps([])
      }
    } catch (e) {
      console.error("Failed to load apps", e)
      setApps([])
    }
  }

  useEffect(() => {
    if (!token) {
      setSelectedApp(null);
    }
  }, [token]);

  // Handle URL parameters for direct navigation or job processing
  useEffect(() => {
    if (!token) return;

    const processUrlParams = async () => {
      const params = new URLSearchParams(window.location.search);
      const processJobData = params.get('processJob');
      const viewAppId = params.get('viewApp');

      if (processJobData) {
        try {
          const decoded = JSON.parse(decodeURIComponent(atob(processJobData)));
          sessionStorage.setItem('extensionJobData', JSON.stringify(decoded));

          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
          setScreen('new_app', { replace: true });
        } catch (e) {
          console.error("Failed to parse processJob from URL", e);
        }
      } else if (viewAppId) {
        const id = parseInt(viewAppId);
        try {
          const res = await fetchWithAuth(`${API_URL}/api/applications/${id}`);
          if (!res.ok) throw new Error("App not found");
          const appData = await res.json();
          
          setSelectedApp(appData);
          // Clean up URL and move to detail
          window.history.replaceState({ screen: 'detail' }, '', SCREEN_TO_HASH['detail']);
          setCurrentScreenState('detail');
        } catch (e) {
          console.error("Failed to load app for viewAppId", e);
          window.history.replaceState({ screen: 'dashboard' }, '', '#dashboard');
          setCurrentScreenState('dashboard');
        }
      } else {
        // Handle share target (Mobile Capture)
        const shareUrl = params.get('url');
        const shareText = params.get('text');
        if (shareUrl || shareText) {
          setScreen('capture', { replace: true });
        }
      }
    };

    processUrlParams();

    // Listen for hash changes to keep currentScreen in sync
    const handlePopState = (e) => {
      const screen = e.state?.screen || hashToScreen(window.location.hash);
      setCurrentScreenState(screen);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [token, window.location.search, window.location.hash]);

  // Initial data loading
  useEffect(() => {
    if (!token) return;
    loadApplications();

    fetchWithAuth(`${API_URL}/api/config`)
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
  }, [token]);

  // Foundational Auto-enrichment: if a selected app in 'Saved' stage is missing 
  // key metadata (summary or company URL), trigger enrichment immediately.
  useEffect(() => {
    if (!token || !selectedApp || selectedApp.pipeline_stage !== 'saved' || isEnriching) return;
    
    const needsEnrichment = !selectedApp.job_summary || !selectedApp.company_url;
    
    if (needsEnrichment) {
      const triggerEnrichment = async () => {
        setIsEnriching(true);
        console.log(`[AutoEnrich] Foundational metadata missing for app ${selectedApp.id}. Triggering enrichment...`);
        try {
          const res = await fetchWithAuth(`${API_URL}/api/applications/${selectedApp.id}/enrich`, {
            method: 'POST'
          });
          if (res.ok) {
            // Refresh the app data to get the new metadata
            const refreshRes = await fetchWithAuth(`${API_URL}/api/applications/${selectedApp.id}`);
            if (refreshRes.ok) {
              const updatedData = await refreshRes.json();
              handleAppUpdate(selectedApp.id, updatedData);
              console.log(`[AutoEnrich] Metadata populated for ${selectedApp.company}`);
            }
          }
        } catch (e) {
          console.error("Auto-enrichment failed in App:", e);
        } finally {
          setIsEnriching(false);
        }
      };
      triggerEnrichment();
    }
  }, [selectedApp?.id, selectedApp?.job_summary, selectedApp?.company_url, selectedApp?.pipeline_stage, token]);
  
  // Guard: if on detail/lifecycle screen but no app is selected, go back to dashboard
  useEffect(() => {
    if ((currentScreen === 'detail' || currentScreen === 'lifecycle') && !selectedApp) {
      setScreen('dashboard', { replace: true });
    }
  }, [currentScreen, selectedApp]);

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
    // Sync pipeline_stage with status labels
    const statusToStage = {
      'Saved': 'saved',
      'Generated': 'generated',
      'Applied': 'applied',
      'Interviewing': 'interviewing',
      'Rejected': 'rejected',
      'Offered': 'decision',
      'Accepted': 'accepted',
      'Declined': 'declined'
    };
    
    const newStage = statusToStage[newStatus] || 'saved';
    const updates = { status: newStatus, pipeline_stage: newStage };

    // Optimistic update
    handleAppUpdate(appId, updates);

    try {
      const res = await fetchWithAuth(`${API_URL}/api/applications/${appId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const updatedFullApp = await res.json();
        handleAppUpdate(appId, updatedFullApp);
      }
    } catch (e) {
      console.error("Failed to update status", e);
      loadApplications(); // revert on failure
    }
  }

  const handleAppUpdate = (appId, updates) => {
    setApps(prev => prev.map(a => a.id === appId ? { ...a, ...updates } : a));
    if (selectedApp && selectedApp.id === appId) {
      setSelectedApp(prev => prev ? { ...prev, ...updates } : null);
    }
  }

  const handleThemeToggle = async () => {
    // Cycle theme: system -> dark -> light -> system
    const themeCycle = {
      'system': 'dark',
      'dark': 'light',
      'light': 'system'
    };
    
    const currentTheme = uiConfigTheme || 'system';
    const newTheme = themeCycle[currentTheme] || 'dark';
    
    // Update local state
    setUiConfigTheme(newTheme);
    
    // Persist to backend
    try {
      // First get current config
      const res = await fetchWithAuth(`${API_URL}/api/config`);
      const config = await res.json();
      
      // Update only ui_config.theme
      config.ui_config = {
        ...config.ui_config,
        theme: newTheme
      };
      
      await fetchWithAuth(`${API_URL}/api/config`, {
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
      case 'detail': {
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
        const appsWithScore = apps.filter(a => a.match_score != null);
        const avgScore = appsWithScore.length > 0
            ? appsWithScore.reduce((sum, a) => sum + Number(a.match_score || 0), 0) / appsWithScore.length
            : null;
        return <ApplicationDetail 
                 app={selectedApp} 
                 isEnrichingGlobal={isEnriching}
                 onBack={() => setScreen('dashboard')} 
                 onDelete={handleDeleteApp} 
                 onArchive={handleArchiveApp} 
                 onStatusUpdate={handleStatusUpdate} 
                 onUpdate={handleAppUpdate} 
                 onViewLifecycle={() => setScreen('lifecycle')}
                 onStartFullGeneration={(appToGen, resumeInst, clInst) => {
                   sessionStorage.setItem('extensionJobData', JSON.stringify({
                     id: appToGen.id,
                     title: appToGen.job_title,
                     company: appToGen.company,
                     logo: appToGen.company_logo,
                     link: appToGen.job_url,
                     applyLink: appToGen.apply_url,
                     description: appToGen.job_description,
                     salaryRange: appToGen.salary_range,
                     datePosted: appToGen.date_posted,
                     deadline: appToGen.deadline,
                     jobType: appToGen.job_type,
                     locationType: appToGen.location_type,
                     location: appToGen.location,
                     relocation: appToGen.relocation,
                     interestLevel: appToGen.interest_level,
                     remarks: appToGen.remarks,
                     resumeInstructions: resumeInst,
                     clInstructions: clInst
                   }));
                   setScreen('new_app');
                 }} 
                 avgScore={avgScore}
               />
      }
      case 'lifecycle':
        return <ApplicationLifecycle 
          app={selectedApp} 
          isEnrichingGlobal={isEnriching} 
          onBack={() => setScreen('detail')} 
          onUpdate={handleAppUpdate}
          notificationAnchor={notificationAnchor}
          onAnchorConsumed={() => setNotificationAnchor(null)}
          onStartFullGeneration={(appToGen, resumeInst, clInst) => {
            sessionStorage.setItem('extensionJobData', JSON.stringify({
              id: appToGen.id,
              title: appToGen.job_title,
              company: appToGen.company,
              logo: appToGen.company_logo,
              link: appToGen.job_url,
              applyLink: appToGen.apply_url,
              description: appToGen.job_description,
              salaryRange: appToGen.salary_range,
              datePosted: appToGen.date_posted,
              deadline: appToGen.deadline,
              jobType: appToGen.job_type,
              locationType: appToGen.location_type,
              location: appToGen.location,
              relocation: appToGen.relocation,
              interestLevel: appToGen.interest_level,
              remarks: appToGen.remarks,
              resumeInstructions: resumeInst,
              clInstructions: clInst
            }));
            setScreen('new_app');
          }}
        />
      case 'capture':
        return <MobileCapture onSaved={loadApplications} onGoToDashboard={() => setScreen('dashboard')} />
      case 'analytics':
        return <Analytics setScreen={setScreen} />
      case 'settings':
        return <Settings theme={uiConfigTheme} onThemeChange={setUiConfigTheme} setScreen={setScreen} />
      case 'profile':
        return <Profile />
      case 'admin':
        return <Admin />
      case 'account':
        return <Account setScreen={setScreen} />
      default:
        return <Dashboard apps={apps} onStartNew={handleStartNew} onViewApp={handleViewApp} onStatusUpdate={handleStatusUpdate} onUpdate={handleAppUpdate} />
    }
  }

  // Hide sidebar on capture screen (mobile-first)
  const showSidebar = currentScreen !== 'capture';

  // ── Notification navigation handler ──────────────────────────────────────
  // Must be declared before any conditional returns (Rules of Hooks).
  const handleNotificationNavigate = useCallback(async (screen, appId, anchor) => {
    if (appId) {
      try {
        const res = await fetchWithAuth(`${API_URL}/api/applications/${appId}`);
        if (res.ok) {
          const appData = await res.json();
          setSelectedApp(appData);
        }
      } catch (e) {
        console.error('Failed to load app for notification', e);
      }
    }
    if (anchor) {
      setNotificationAnchor(anchor);
    }
    if (screen) {
      setScreen(screen);
    }
  }, [fetchWithAuth, setScreen]);

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid var(--bg-tertiary)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
          <p>Initializing Secure Session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    const isResetting = window.location.pathname === '/reset-password' || window.location.search.includes('token=');
    if (isResetting) {
      return <ResetPassword />;
    }
    return <Auth />;
  }


  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Sidebar Navigation */}
      {showSidebar && (
        <Sidebar 
          currentScreen={currentScreen} 
          setScreen={setScreen} 
          theme={uiConfigTheme} 
          onThemeToggle={handleThemeToggle} 
          user={user}
          onLogout={logout}
        />
      )}

      {/* Main Content Area */}
      <main style={{ flex: 1, height: '100%', overflowY: 'auto', position: 'relative' }}>
        {renderScreen()}
      </main>

      {/* Notification system - global overlays */}
      <NotificationToast onNavigate={handleNotificationNavigate} />
      <NotificationCenter onNavigate={handleNotificationNavigate} />
    </div>
  )
}

export default App
