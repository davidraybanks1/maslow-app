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

if (isNative()) document.documentElement.classList.add('native')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
