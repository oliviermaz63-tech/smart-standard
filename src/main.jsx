import "./index.css";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import FeedbackHost from './components/FeedbackHost.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <FeedbackHost />
  </StrictMode>,
)
