import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

// App installata dalla schermata Home di iOS: la classe attiva le regole di
// layout di index.css. Si usa `navigator.standalone` e non
// `display-mode: standalone`, che in `npm run dev` è falso (non c'è manifest).
if (window.navigator.standalone) document.documentElement.classList.add('ios-app')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)