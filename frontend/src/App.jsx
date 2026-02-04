import { useState, useEffect } from 'react'
import './index.css'

const API_URL = 'http://localhost:8000'

function App() {
  const [activeTab, setActiveTab] = useState('upload')
  const [resumeFile, setResumeFile] = useState(null)
  const [jobDescription, setJobDescription] = useState('')
  const [jobUrl, setJobUrl] = useState('')
  const [inputMode, setInputMode] = useState('text') // 'text' or 'url'
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [useDefaultResume, setUseDefaultResume] = useState(false)
  const [configDefaults, setConfigDefaults] = useState({})

  useEffect(() => {
    // Fetch config on mount
    fetch(`${API_URL}/api/config`)
      .then(res => res.json())
      .then(data => {
        setConfigDefaults(data)
        if (data.default_job_url) {
            setJobUrl(data.default_job_url)
            setInputMode('url')
        }
      })
      .catch(err => console.error("Failed to load config", err))
  }, [])

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file && file.name.endsWith('.docx')) {
      setResumeFile(file)
      setError(null)
    } else {
      setError('Please select a .docx file')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    
    const file = e.dataTransfer.files?.[0]
    if (file && file.name.endsWith('.docx')) {
      setResumeFile(file)
      setError(null)
    } else {
      setError('Please select a .docx file')
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!resumeFile && !useDefaultResume) {
      setError('Please upload a resume or use the default one')
      return
    }

    if (inputMode === 'text' && !jobDescription.trim()) {
      setError('Please enter a job description')
      return
    }

    if (inputMode === 'url' && !jobUrl.trim()) {
      setError('Please enter a job URL')
      return
    }

    setIsProcessing(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      
      if (useDefaultResume) {
        formData.append('use_default_resume', 'true')
      } else if (resumeFile) {
        formData.append('resume', resumeFile)
      }
      
      if (inputMode === 'text') {
        formData.append('job_description', jobDescription)
      } else {
        formData.append('job_url', jobUrl)
      }

      const response = await fetch(`${API_URL}/api/tailor-resume`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to process resume')
      }

      const data = await response.json()
      setResult(data)
      setActiveTab('download')
    } catch (err) {
      setError(err.message || 'An error occurred while processing your resume')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownload = (format) => {
    if (result?.files?.[format]) {
      window.open(`${API_URL}${result.files[format]}`, '_blank')
    }
  }

  const handleReset = () => {
    setResumeFile(null)
    setJobDescription('')
    setJobUrl('')
    setResult(null)
    setError(null)
    setActiveTab('upload')
  }

  return (
    <div className="app">
      <header className="header">
        <h1>✨ Resume Automator</h1>
        <p>Tailor your resume to any job description with AI-powered optimization</p>
      </header>

      <div className="container">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            📄 Upload & Process
          </button>
          <button
            className={`tab ${activeTab === 'download' ? 'active' : ''}`}
            onClick={() => setActiveTab('download')}
            disabled={!result}
          >
            📥 Download
          </button>
        </div>

        {error && (
          <div className="alert alert-error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="card">
            <h2 className="card-title">
              <span className="icon">📄</span>
              Tailor Your Resume
            </h2>

            <form onSubmit={handleSubmit}>
              {/* Default Resume Option */}
              {configDefaults.default_resume_path && (
                  <div className="form-group mb-4">
                      <label className="flex items-center space-x-2 cursor-pointer">
                          <input 
                              type="checkbox" 
                              checked={useDefaultResume} 
                              onChange={(e) => {
                                  setUseDefaultResume(e.target.checked)
                                  if (e.target.checked) setResumeFile(null)
                              }}
                              className="form-checkbox h-5 w-5 text-blue-600"
                          />
                          <span className="text-gray-700 font-medium">Use Default Resume for Testing</span>
                      </label>
                      <div className="text-xs text-gray-500 ml-7 mt-1">
                          path: {configDefaults.default_resume_path}
                      </div>
                  </div>
              )}

              {/* Resume Upload */}
              <div className={`form-group ${useDefaultResume ? 'opacity-50 pointer-events-none' : ''}`}>
                <label className="form-label">Upload Your Resume (.docx)</label>
                <div
                  className={`file-upload ${isDragging ? 'drag-over' : ''}`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  <div className="file-upload-icon">📎</div>
                  <div className="file-upload-text">
                    {resumeFile ? resumeFile.name : 'Drag & drop your resume here'}
                  </div>
                  <div className="file-upload-subtext">
                    or click to browse (Word .docx format only)
                  </div>
                  <input
                    type="file"
                    accept=".docx"
                    onChange={handleFileSelect}
                    disabled={useDefaultResume}
                  />
                </div>
                {resumeFile && (
                  <div className="file-selected">
                    <span>✓</span>
                    <span>{resumeFile.name} ({(resumeFile.size / 1024).toFixed(2)} KB)</span>
                  </div>
                )}
              </div>

              {/* Job Description Input Mode Toggle */}
              <div className="form-group">
                <label className="form-label">Job Description</label>
                <div className="btn-group mb-2">
                  <button
                    type="button"
                    className={`btn ${inputMode === 'text' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setInputMode('text')}
                  >
                    📝 Paste Text
                  </button>
                  <button
                    type="button"
                    className={`btn ${inputMode === 'url' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setInputMode('url')}
                  >
                    🔗 From URL
                  </button>
                </div>

                {inputMode === 'text' ? (
                  <textarea
                    className="form-textarea"
                    placeholder="Paste the job description here..."
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                  />
                ) : (
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://example.com/job-posting"
                    value={jobUrl}
                    onChange={(e) => setJobUrl(e.target.value)}
                  />
                )}
              </div>

              {/* Submit Button */}
              <div className="btn-group">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isProcessing || !resumeFile}
                >
                  {isProcessing ? (
                    <>
                      <span className="spinner"></span>
                      Processing...
                    </>
                  ) : (
                    <>
                      <span>🚀</span>
                      Tailor Resume
                    </>
                  )}
                </button>
                {(resumeFile || jobDescription || jobUrl) && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleReset}
                  >
                    Reset
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {activeTab === 'download' && result && (
          <div className="card">
            <h2 className="card-title">
              <span className="icon">✨</span>
              Resume Tailored Successfully!
            </h2>

            {result.preview && (
              <div className="alert alert-info mb-3">
                <span>ℹ️</span>
                <span>{result.preview}</span>
              </div>
            )}

            <div className="alert alert-success mb-3">
              <span>✓</span>
              <span>Your resume has been optimized for this job posting</span>
            </div>

            {/* PDF Preview Section */}
            <div className="pdf-preview-section mb-4">
              <h3 className="mb-2" style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                📋 Preview Your Tailored Resume
              </h3>
              <div className="pdf-preview-container">
                <iframe
                  src={`${API_URL}${result.files.pdf}#toolbar=0&navpanes=0&scrollbar=0`}
                  className="pdf-preview-frame"
                  title="Resume Preview"
                />
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                💡 Tip: Review your resume above before downloading
              </p>
            </div>

            <h3 className="mb-2" style={{ fontSize: '1.25rem', fontWeight: 600 }}>
              Download Formats
            </h3>

            <div className="download-grid">
              <div
                className="download-card"
                onClick={() => handleDownload('docx')}
              >
                <div className="download-card-icon">📄</div>
                <div className="download-card-title">Word Document</div>
                <div className="download-card-subtitle">.docx format</div>
              </div>

              <div
                className="download-card"
                onClick={() => handleDownload('pdf')}
              >
                <div className="download-card-icon">📑</div>
                <div className="download-card-title">PDF</div>
                <div className="download-card-subtitle">.pdf format</div>
              </div>

              <div
                className="download-card"
                onClick={() => handleDownload('txt')}
              >
                <div className="download-card-icon">📝</div>
                <div className="download-card-title">Plain Text</div>
                <div className="download-card-subtitle">.txt format</div>
              </div>
            </div>

            <div className="mt-4">
              <button
                className="btn btn-primary"
                onClick={handleReset}
              >
                <span>➕</span>
                Tailor Another Resume
              </button>
            </div>
          </div>
        )}

        {/* Info Card */}
        <div className="card mt-4">
          <h3 className="card-title">
            <span className="icon">💡</span>
            How It Works
          </h3>
          <div style={{ color: 'var(--text-secondary)', lineHeight: '1.8' }}>
            <p><strong>1. Upload:</strong> Your resume is parsed to understand its structure and content</p>
            <p><strong>2. Analysis:</strong> AI analyzes the job description to identify key requirements</p>
            <p><strong>3. Tailoring:</strong> Your resume is intelligently optimized to highlight relevant experience</p>
            <p><strong>4. Export:</strong> Download your tailored resume in Word, PDF, or text format</p>
          </div>
        </div>
      </div>

      <footer style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        <p>Resume Automator • All processing happens locally on your machine</p>
      </footer>
    </div>
  )
}

export default App
