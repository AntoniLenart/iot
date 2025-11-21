import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { loadConfig } from "../src/config.js"

async function startApp() {
  await loadConfig();     // ⬅ Load config.json BEFORE rendering App

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

startApp();