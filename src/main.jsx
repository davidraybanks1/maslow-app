import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import { isNative } from './lib/native'

if (isNative()) document.documentElement.classList.add('native')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
