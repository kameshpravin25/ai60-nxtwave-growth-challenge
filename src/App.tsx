import { lazy, Suspense } from 'react'
import { AppProvider } from './lib/state'
import { usePath } from './lib/router'
import Landing from './pages/Landing'
import RegisterModal from './components/RegisterModal'
import LiveToasts from './components/LiveToasts'
import TourButton from './components/TourButton'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Plan = lazy(() => import('./pages/Plan'))
const Live = lazy(() => import('./pages/Live'))
const Host = lazy(() => import('./pages/Host'))
const Submit = lazy(() => import('./pages/Submit'))
const Verify = lazy(() => import('./pages/Verify'))
const WhatsApp = lazy(() => import('./pages/WhatsApp'))
const Captain = lazy(() => import('./pages/Captain'))
const Tour = lazy(() => import('./pages/Tour'))

function Routes() {
  const path = usePath().replace(/\/+$/, '') || '/'
  const param = (prefix: string) => decodeURIComponent(path.slice(prefix.length))

  if (path === '/dashboard') return <Dashboard />
  if (path === '/plan') return <Plan />
  if (path === '/live') return <Live />
  if (path === '/host') return <Host />
  if (path === '/submit') return <Submit />
  if (path.startsWith('/verify/')) return <Verify token={param('/verify/')} />
  if (path === '/whatsapp') return <WhatsApp />
  if (path.startsWith('/captain/')) return <Captain code={param('/captain/').toUpperCase()} />
  if (path === '/tour') return <Tour />
  return (
    <>
      <Landing />
      <LiveToasts />
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Suspense fallback={<div className="page-loading">Loading…</div>}>
        <Routes />
      </Suspense>
      <RegisterModal />
      <TourButton />
    </AppProvider>
  )
}
