import React, { useEffect, useRef, useState } from 'react'

const SALT = 'expenses-app-2026'

export async function hashPin(pin) {
  const encoder = new TextEncoder()
  const data = encoder.encode(SALT + pin)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const PAD = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['⌫', '0', '✓']
]

export default function LockScreen({ pinHash, recoveryCodeHash, onUnlock }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [showRecovery, setShowRecovery] = useState(false)
  const [recoveryVal, setRecoveryVal] = useState('')
  const pinRef = useRef('')
  useEffect(() => { pinRef.current = pin }, [pin])

  // Keyboard support — digits, Backspace, Enter
  useEffect(() => {
    async function onKeyDown(e) {
      if (showRecovery) return
      if (e.key >= '0' && e.key <= '9') {
        const cur = pinRef.current
        if (cur.length >= 8) return
        const next = cur + e.key
        setPin(next)
        setError(false)
        pinRef.current = next
        if (next.length === 4) {
          const hash = await hashPin(next)
          if (hash === pinHash || (recoveryCodeHash && hash === recoveryCodeHash)) { onUnlock() }
          else { setShaking(true); setError(true); setTimeout(() => { setShaking(false); setPin(''); pinRef.current = ''; setError(false) }, 800) }
        }
      } else if (e.key === 'Backspace') {
        setPin((p) => { const n = p.slice(0, -1); pinRef.current = n; return n })
        setError(false)
      } else if (e.key === 'Enter') {
        const cur = pinRef.current
        if (cur.length >= 4) {
          const hash = await hashPin(cur)
          if (hash === pinHash || (recoveryCodeHash && hash === recoveryCodeHash)) { onUnlock() }
          else { setShaking(true); setError(true); setTimeout(() => { setShaking(false); setPin(''); pinRef.current = ''; setError(false) }, 800) }
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showRecovery, pinHash, recoveryCodeHash, onUnlock])

  async function tryUnlock(code) {
    const hash = await hashPin(code)
    if (hash === pinHash || (recoveryCodeHash && hash === recoveryCodeHash)) {
      onUnlock()
    } else {
      setShaking(true)
      setError(true)
      setTimeout(() => { setShaking(false); setPin(''); setRecoveryVal(''); setError(false) }, 800)
    }
  }

  async function handleKey(k) {
    if (k === '⌫') { setPin((p) => p.slice(0, -1)); setError(false); return }
    if (k === '✓') { if (pin.length >= 4) await tryUnlock(pin); return }
    if (pin.length >= 8) return
    const next = pin + k
    setPin(next)
    setError(false)
    if (next.length === 4) await tryUnlock(next)
  }

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--page)', gap: 24
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: 8 }}>🏠</div>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>הוצאות הבית</h1>
        <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>הכניסי קוד PIN להמשך</p>
      </div>

      {!showRecovery ? (
        <>
          {/* dots */}
          <div style={{ display: 'flex', gap: 14, animation: shaking ? 'shake 0.4s' : 'none' }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{
                width: 14, height: 14, borderRadius: '50%',
                background: i < pin.length ? (error ? 'var(--critical)' : 'var(--series-1)') : 'var(--gridline)',
                transition: 'background 0.15s'
              }} />
            ))}
          </div>

          {error && <p style={{ color: 'var(--critical)', fontSize: 13, margin: 0 }}>קוד שגוי, נסי שוב</p>}

          {/* numpad */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 64px)', gap: 10 }}>
            {PAD.flat().map((k) => (
              <button key={k} onClick={() => handleKey(k)} style={{
                height: 64, borderRadius: 12,
                border: '1px solid var(--border)',
                background: k === '✓' ? 'var(--series-1)' : 'var(--surface-1)',
                color: k === '✓' ? 'white' : 'var(--text-primary)',
                fontSize: k === '⌫' || k === '✓' ? '1.25rem' : '1.5rem',
                fontWeight: 600, cursor: 'pointer'
              }}>{k}</button>
            ))}
          </div>

          {recoveryCodeHash && (
            <button onClick={() => { setShowRecovery(true); setError(false) }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
              שכחתי PIN — כניסה עם קוד גיבוי
            </button>
          )}
        </>
      ) : (
        <>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>הכניסי את קוד הגיבוי שהגדרת</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="password"
              autoFocus
              placeholder="קוד גיבוי"
              value={recoveryVal}
              onChange={(e) => { setRecoveryVal(e.target.value); setError(false) }}
              onKeyDown={(e) => { if (e.key === 'Enter' && recoveryVal.trim()) tryUnlock(recoveryVal.trim()) }}
              style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${error ? 'var(--critical)' : 'var(--border)'}`, background: 'var(--surface-2)', fontSize: 15, width: 200 }}
            />
            <button className="btn primary" onClick={() => tryUnlock(recoveryVal.trim())} disabled={!recoveryVal.trim()}>כניסה</button>
          </div>
          {error && <p style={{ color: 'var(--critical)', fontSize: 13, margin: 0 }}>קוד גיבוי שגוי</p>}
          <button onClick={() => { setShowRecovery(false); setError(false) }}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
            חזרה ל-PIN
          </button>
        </>
      )}

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0) }
          20% { transform: translateX(-8px) }
          40% { transform: translateX(8px) }
          60% { transform: translateX(-6px) }
          80% { transform: translateX(6px) }
        }
      `}</style>
    </div>
  )
}
