import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Installable app: keep the browser's install prompt for the "Get the app"
// section, and register the service worker in production builds.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  window.__finditInstallPrompt = e
  window.dispatchEvent(new Event('findit:installable'))
})
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
