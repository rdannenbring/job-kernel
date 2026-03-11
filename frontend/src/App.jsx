import { useState, useEffect } from 'react'
import './index.css'
import Sidebar from './components/Layout/Sidebar'
import Dashboard from './pages/Dashboard'
import NewApplication from './pages/NewApplication'
import ApplicationDetail from './pages/ApplicationDetail'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import Profile from './pages/Profile'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function App() {
  const [currentScreen, setCurrentScreen] = useState('dashboard') // dashboard, new_app, detail, analytics, settings, profile
  const [selectedApp, setSelectedApp] = useState(null)
  const [apps, setApps] = useState([])

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
        setCurrentScreen('new_app');
      } catch (e) {
        console.error("Failed to parse processJob from URL", e);
      }
    }
  }, [])

  // --- Handlers ---
  const handleStartNew = () => {
    setCurrentScreen('new_app')
  }

  const handleViewApp = (app) => {
    setSelectedApp(app)
    setCurrentScreen('detail')
  }

  const handleAppComplete = () => {
    loadApplications() // Refresh list
    setCurrentScreen('dashboard')
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
        return <ApplicationDetail app={selectedApp} onBack={() => setCurrentScreen('dashboard')} onStatusUpdate={handleStatusUpdate} />
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
      <Sidebar currentScreen={currentScreen} setScreen={setCurrentScreen} />

      {/* Main Content Area */}
      <main style={{ flex: 1, height: '100%', overflowY: 'auto', position: 'relative' }}>
        {renderScreen()}
      </main>
    </div>
  )
}

export default App
