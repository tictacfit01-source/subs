import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

function translateError(msg = '') {
  const m = msg.toLowerCase()
  if (m.includes('invalid login')) return 'Correo o contraseña incorrectos.'
  if (m.includes('already registered') || m.includes('already been registered')) return 'Ese correo ya tiene cuenta. Inicia sesión.'
  if (m.includes('at least')) return 'La contraseña debe tener al menos 6 caracteres.'
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'Correo no válido.'
  if (m.includes('you can only request this')) return 'Por seguridad, espera un minuto antes de volver a intentarlo.'
  return msg || 'Algo ha fallado, inténtalo de nuevo.'
}

export default function Login() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function submit(e) {
    e.preventDefault()
    const mail = email.trim()
    if (!mail || !password) return
    setStatus('loading')
    setError('')
    setNotice('')
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email: mail, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: mail, password })
        if (error) throw error
      }
      // On success, App's onAuthStateChange picks up the session and swaps screens.
    } catch (err) {
      setStatus('idle')
      setError(translateError(err.message))
    }
  }

  async function forgotPwd() {
    const mail = email.trim()
    if (!mail) {
      setError('Escribe tu correo arriba y vuelve a pulsar el enlace.')
      return
    }
    setStatus('loading')
    setError('')
    setNotice('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo: window.location.origin })
      if (error) throw error
      setNotice('Te hemos enviado un enlace para restablecer la contraseña.')
    } catch (err) {
      setError(translateError(err.message))
    } finally {
      setStatus('idle')
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '14px 15px',
    borderRadius: 14,
    border: '1px solid var(--line2)',
    background: 'var(--panel)',
    color: 'var(--tx)',
    fontSize: 15,
    outline: 'none',
  }

  const isSignup = mode === 'signup'

  return (
    <div className="frame" style={{ justifyContent: 'center', alignItems: 'center', padding: '32px 24px' }}>
      <div style={{ width: '100%', maxWidth: 340 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 17,
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 28,
              color: '#fff',
              boxShadow: '0 8px 22px var(--accentSoft)',
            }}
          >
            S
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 16 }}>Subs</div>
          <div style={{ fontSize: 14, color: 'var(--dim)', marginTop: 6, textAlign: 'center', lineHeight: 1.5 }}>
            Tu control de suscripciones.<br />
            {isSignup ? 'Crea tu cuenta para empezar.' : 'Entra con tu correo y contraseña.'}
          </div>
        </div>

        <form onSubmit={submit}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tucorreo@ejemplo.com"
            autoComplete="email"
            autoFocus
            style={inputStyle}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isSignup ? 'Contraseña (mín. 6 caracteres)' : 'Contraseña'}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            style={{ ...inputStyle, marginTop: 10 }}
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            style={{
              width: '100%',
              marginTop: 12,
              padding: 15,
              borderRadius: 14,
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 15,
              fontWeight: 700,
              cursor: status === 'loading' ? 'default' : 'pointer',
              opacity: status === 'loading' ? 0.7 : 1,
              boxShadow: '0 8px 22px var(--accentSoft)',
            }}
          >
            {status === 'loading' ? 'Un momento…' : isSignup ? 'Crear cuenta' : 'Iniciar sesión'}
          </button>
          {error && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--bad)', textAlign: 'center' }}>{error}</div>}
          {notice && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--good)', textAlign: 'center' }}>{notice}</div>}
          {!isSignup && (
            <button
              type="button"
              onClick={forgotPwd}
              disabled={status === 'loading'}
              style={{ display: 'block', margin: '14px auto 0', background: 'none', border: 'none', color: 'var(--dim)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}
            >
              ¿Has olvidado tu contraseña?
            </button>
          )}
        </form>

        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--dim)', marginTop: 20 }}>
          {isSignup ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}{' '}
          <button
            onClick={() => {
              setMode(isSignup ? 'signin' : 'signup')
              setError('')
              setNotice('')
            }}
            style={{ background: 'none', border: 'none', color: 'var(--accent2)', fontWeight: 700, cursor: 'pointer', fontSize: 13, padding: 0 }}
          >
            {isSignup ? 'Inicia sesión' : 'Regístrate'}
          </button>
        </div>
      </div>
    </div>
  )
}
