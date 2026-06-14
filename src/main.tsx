import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Capture the PWA install prompt so Settings can offer "Install app".
declare global {
  interface Window {
    deferredInstallPrompt?: Event & { prompt: () => Promise<void> }
  }
}
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  window.deferredInstallPrompt = e as Window['deferredInstallPrompt']
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
