import React, { useEffect, useRef, useState } from 'react'

export default function CategorySelect({ value, categories, onChange, style }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  useEffect(() => {
    function onMouseDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const filtered = search.trim()
    ? categories.filter((c) => c.includes(search.trim()))
    : categories

  function select(c) {
    onChange(c)
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: '5px 7px', borderRadius: 6, border: '1px solid var(--border)',
          background: 'var(--surface-2)', fontSize: 13, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 4, whiteSpace: 'nowrap', userSelect: 'none'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{value || '—'}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 2px)', right: 0, zIndex: 200,
          background: 'var(--surface-1)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
          minWidth: 160, display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}>
          <input
            ref={inputRef}
            type="text"
            placeholder="חיפוש..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filtered.length === 1) select(filtered[0])
              if (e.key === 'Escape') { setOpen(false); setSearch('') }
            }}
            style={{
              padding: '7px 10px', border: 'none', outline: 'none',
              borderBottom: '1px solid var(--gridline)',
              background: 'var(--surface-2)', fontSize: 13, direction: 'rtl'
            }}
          />
          <div style={{ overflowY: 'auto', maxHeight: 200 }}>
            {filtered.map((c) => (
              <div
                key={c}
                onClick={() => select(c)}
                style={{
                  padding: '7px 12px', fontSize: 13, cursor: 'pointer',
                  background: c === value ? 'rgba(42,120,214,0.12)' : undefined,
                  fontWeight: c === value ? 600 : undefined,
                  direction: 'rtl'
                }}
                onMouseEnter={(e) => { if (c !== value) e.currentTarget.style.background = 'rgba(42,120,214,0.07)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = c === value ? 'rgba(42,120,214,0.12)' : '' }}
              >
                {c}
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-muted)' }}>לא נמצא</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
