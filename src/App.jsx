import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './lib/supabase.js'
import Login from './auth/Login.jsx'
import SubsApp from './SubsApp.jsx'

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('subs-theme') || 'dark')
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)
  const [recovery, setRecovery] = useState(false) // true when arriving from a password-reset link

  useEffect(() => {
    localStorage.setItem('subs-theme', theme)
    // Keep the browser/PWA chrome color in sync with the active theme.
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0c0d11' : '#eceef2')
  }, [theme])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setReady(true)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  let content
  if (!isSupabaseConfigured) content = <ConfigNotice />
  else if (!ready) content = <Splash />
  else if (!session) content = <Login />
  else content = <SubsApp session={session} theme={theme} toggleTheme={toggleTheme} recovery={recovery} />

  return (
    <div className="subsapp" data-theme={theme}>
      {content}
    </div>
  )
}

function Splash() {
  return (
    <div className="frame" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  )
}

function ConfigNotice() {
  return (
    <div className="frame" style={{ alignItems: 'center', justifyContent: 'center', padding: '32px 26px', textAlign: 'center' }}>
      <div style={{ maxWidth: 340 }}>
        <div style={{ fontSize: 34, marginBottom: 12 }}>🔌</div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Falta conectar Supabase</div>
        <div style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 10, lineHeight: 1.6 }}>
          Define <code style={{ color: 'var(--accent2)' }}>VITE_SUPABASE_URL</code> y{' '}
          <code style={{ color: 'var(--accent2)' }}>VITE_SUPABASE_ANON_KEY</code> en un archivo <code style={{ color: 'var(--accent2)' }}>.env</code> y reinicia.
        </div>
      </div>
    </div>
  )
}

