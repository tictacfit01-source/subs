import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function Login() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    const value = email.trim()
    if (!value) return
    setStatus('sending')
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email: value,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setStatus('error')
      setError(error.message)
    } else {
      setStatus('sent')
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
            Tu control de suscripciones.<br />Entra con tu correo.
          </div>
        </div>

        {status === 'sent' ? (
          <div
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              borderRadius: 16,
              padding: '22px 20px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 30, marginBottom: 8 }}>✉️</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Revisa tu correo</div>
            <div style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 6, lineHeight: 1.5 }}>
              Te enviamos un enlace de acceso a <strong style={{ color: 'var(--tx)' }}>{email.trim()}</strong>. Ábrelo en este
              dispositivo para entrar.
            </div>
            <button
              onClick={() => {
                setStatus('idle')
                setError('')
              }}
              style={{
                marginTop: 16,
                background: 'transparent',
                border: 'none',
                color: 'var(--dim)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Usar otro correo
            </button>
          </div>
        ) : (
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
            <button
              type="submit"
              disabled={status === 'sending'}
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
                cursor: status === 'sending' ? 'default' : 'pointer',
                opacity: status === 'sending' ? 0.7 : 1,
                boxShadow: '0 8px 22px var(--accentSoft)',
              }}
            >
              {status === 'sending' ? 'Enviando…' : 'Enviar enlace de acceso'}
            </button>
            {status === 'error' && (
              <div style={{ marginTop: 12, fontSize: 13, color: 'var(--bad)', textAlign: 'center' }}>{error}</div>
            )}
          </form>
        )}

        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--faint)', marginTop: 24, lineHeight: 1.5 }}>
          Sin contraseñas. Recibes un enlace mágico y entras.
        </div>
      </div>
    </div>
  )
}
