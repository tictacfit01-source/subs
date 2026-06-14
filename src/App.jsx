import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './lib/supabase.js'
import Login from './auth/Login.jsx'
import SubsApp from './SubsApp.jsx'

const DEMO_SESSION = { user: { id: 'demo', email: 'demo@local' } }

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('subs-theme') || 'dark')
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    localStorage.setItem('subs-theme', theme)
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
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  let content
  if (!ready) content = <Splash />
  else if (!isSupabaseConfigured)
    content = <SubsApp session={DEMO_SESSION} demo theme={theme} setTheme={setTheme} toggleTheme={toggleTheme} />
  else if (!session) content = <Login />
  else content = <SubsApp session={session} theme={theme} setTheme={setTheme} toggleTheme={toggleTheme} />

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

