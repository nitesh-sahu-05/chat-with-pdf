import { useRef, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

function DocumentIcon({ className = '' }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M7 3.75h6.25L18 8.5v11.75H7a2 2 0 0 1-2-2v-12.5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="M13 4v5h5M8.5 13h6M8.5 16.5h6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 15V4m0 0L8 8m4-4 4 4M5 14.5v3A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5v-3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <path
        d="M17 3 9.2 10.8M17 3l-5 14-2.8-6.2L3 8l14-5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  )
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function App() {
  const [file, setFile] = useState(null)
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  function handleFileChange(event) {
    const selectedFile = event.target.files?.[0]
    event.target.value = ''
    if (!selectedFile) return

    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setError('Choose a PDF file to get started.')
      return
    }

    setFile(selectedFile)
    setMessages([])
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const prompt = question.trim()

    if (!file || !prompt || isLoading) return

    setQuestion('')
    setError('')
    setIsLoading(true)
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: 'user', content: prompt },
      { id: crypto.randomUUID(), role: 'assistant', content: '', pending: true },
    ])

    const formData = new FormData()
    formData.append('pdf', file)
    formData.append('question', prompt)

    try {
      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        let message = `The server returned an error (${response.status}).`
        try {
          const details = await response.json()
          if (details.error) message = details.error
        } catch {
          // The endpoint may return a plain-text response for errors.
        }
        throw new Error(message)
      }

      const answer = (await response.text()).trim()
      if (!answer) throw new Error('The server returned an empty answer.')

      setMessages((current) =>
        current.map((item, index) =>
          index === current.length - 1
            ? { ...item, content: answer, pending: false }
            : item,
        ),
      )
    } catch (requestError) {
      const message =
        requestError instanceof TypeError
          ? 'Could not connect to the server. Check that the backend is running and try again.'
          : requestError.message

      setMessages((current) =>
        current.map((item, index) =>
          index === current.length - 1
            ? { ...item, content: message, pending: false, failed: true }
            : item,
        ),
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Pagewise home">
          <span className="brand-mark">
            <DocumentIcon />
          </span>
          <span>pagewise</span>
        </a>
        <span className="topbar-note">
          <span className="status-dot" />
          PDF question & answer workspace
        </span>
      </header>

      <main className="main-content">
        <section className="intro">
          <div className="eyebrow">A little more clarity</div>
          <h1>Get answers from your PDFs.</h1>
          <p>Upload a document, ask a question, and find what matters.</p>
        </section>

        <section className="workspace" aria-label="PDF question and answer">
          <aside className="document-panel">
            <div className="panel-heading">
              <span className="step-number">01</span>
              <div>
                <h2>Your document</h2>
                <p>Add a PDF to start a conversation.</p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              className="visually-hidden"
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleFileChange}
              aria-label="Choose a PDF file"
            />

            {file ? (
              <div className="selected-file">
                <span className="file-icon">
                  <DocumentIcon />
                </span>
                <div className="file-details">
                  <span className="file-name" title={file.name}>
                    {file.name}
                  </span>
                  <span className="file-size">{formatFileSize(file.size)}</span>
                </div>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                >
                  Change
                </button>
              </div>
            ) : (
              <button
                className="upload-area"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="upload-icon">
                  <UploadIcon />
                </span>
                <span className="upload-title">Choose a PDF</span>
                <span className="upload-subtitle">from your device</span>
              </button>
            )}
            <p className="file-hint">PDF files only</p>
          </aside>

          <section className="chat-panel" aria-label="Conversation">
            <div className="panel-heading chat-heading">
              <span className="step-number">02</span>
              <div>
                <h2>Ask anything</h2>
                <p>Your answers are grounded in the document.</p>
              </div>
            </div>

            <div className={`conversation ${messages.length ? 'has-messages' : ''}`}>
              {messages.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">
                    <DocumentIcon />
                  </span>
                  <h3>Your conversation starts here</h3>
                  <p>
                    {file
                      ? 'Ask a question about your document below.'
                      : 'Choose a PDF, then ask it a question.'}
                  </p>
                </div>
              ) : (
                <div className="message-list" aria-live="polite">
                  {messages.map((message) => (
                    <article
                      className={`message message-${message.role}${message.failed ? ' message-failed' : ''}`}
                      key={message.id}
                    >
                      <span className="message-label">
                        {message.role === 'user' ? 'You' : 'Pagewise'}
                      </span>
                      <p>
                        {message.pending ? (
                          <span className="thinking" aria-label="Thinking">
                            <i />
                            <i />
                            <i />
                          </span>
                        ) : (
                          message.content
                        )}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <form className="question-form" onSubmit={handleSubmit}>
              <label className="visually-hidden" htmlFor="question">
                Ask a question about your PDF
              </label>
              <input
                id="question"
                type="text"
                placeholder={file ? 'Ask about your document...' : 'Add a PDF to ask a question'}
                value={question}
                onChange={(event) => {
                  setQuestion(event.target.value)
                  if (error) setError('')
                }}
                disabled={!file || isLoading}
                maxLength={1000}
              />
              <button
                className="send-button"
                type="submit"
                aria-label="Send question"
                disabled={!file || !question.trim() || isLoading}
              >
                <SendIcon />
              </button>
            </form>
            {error && <p className="error-message" role="alert">{error}</p>}
            <p className="privacy-note">Answers may take a few moments to generate.</p>
          </section>
        </section>
        <footer className="footer-note">A calmer way to read the fine print.</footer>
      </main>
    </div>
  )
}

export default App
