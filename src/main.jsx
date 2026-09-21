import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/capacitor'
import * as SentryReact from '@sentry/react'
import { breadcrumbsIntegration } from '@sentry/react'
import './index.css'
import App from './App'
import { isNative } from './lib/native'

Sentry.init(
  {
    dsn: 'https://b4dcdbec714e2d382ac8d237a796037f@o4511991512432640.ingest.us.sentry.io/4511991519707136',
    environment: import.meta.env.PROD ? 'production' : 'development',
    enabled: import.meta.env.PROD,
    release: '0.1.0',
    sendDefaultPii: false,
    integrations: integrations => [
      ...integrations.filter(i => i.name !== 'Breadcrumbs' && i.name !== 'Replay'),
      breadcrumbsIntegration({ dom: false, console: false }),
    ],
    beforeBreadcrumb(breadcrumb) {
      if (['ui.click', 'ui.input', 'console'].includes(breadcrumb.category)) return null
      if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
        const url = breadcrumb.data?.url
        if (url) {
          try { breadcrumb.data = { url: new URL(url).pathname, status_code: breadcrumb.data?.status_code } }
          catch { breadcrumb.data = { status_code: breadcrumb.data?.status_code } }
        } else {
          breadcrumb.data = {}
        }
      }
      return breadcrumb
    },
    beforeSend(event) {
      if (event.request) {
        delete event.request.data
        delete event.request.query_string
      }
      delete event.extra
      return event
    },
  },
  SentryReact.init,
)

// navigator.standalone is Apple's own (non-standard, iOS-only) flag for a
// page launched from a home-screen icon; display-mode covers the same case
// on Android/other browsers that support the standard media feature.
const isStandalonePwa = () =>
  typeof window !== 'undefined' &&
  (window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches)

if (isNative()) document.documentElement.classList.add('native')
else if (isStandalonePwa()) document.documentElement.classList.add('pwa-standalone')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
