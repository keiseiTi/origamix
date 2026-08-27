import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app'
import '@heroui/styles'
import './main.less'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
