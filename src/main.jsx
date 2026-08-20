import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/variables.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/sidebar.css'
import './styles/cards.css'
import './styles/modal.css'
import './styles/admin.css'
import './styles/importexport.css'
import './styles/settings.css'
import './styles/toast.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
