import React, { useEffect, useRef, useState } from 'react'

export default function CategorySelect({ value, categories, onChange, style }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
    setHighlighted(0)
  }, [open])

  useEffect(() => {
    setHighlighted(0)
  }, [search])

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

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return
    const items = listRef.current.querySelectorAll('[data-idx]')
    const el = items[highlighted]
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [highlighted])

  const filtered = search.trim()
    ? categories.filter((c) => c.includes(search.trim()))
    : categories

  function select(c) {
    onChange(c)
    setOpen(false)
    setSearch('')
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[highlighted]) select(filtered[highlighted])
    } else if (e.key === 'Escape') {
      setOpen(false)
      setSearch('')
    }
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
            onKeyDown={onKeyDown}
            style={{
              padding: '7px 10px', border: 'none', outline: 'none',
              borderBottom: '1px solid var(--gridline)',
              background: 'var(--surface-2)', fontSize: 13, direction: 'rtl'
            }}
          />
          <div ref={listRef} style={{ overflowY: 'auto', maxHeight: 200 }}>
            {filtered.map((c, i) => (
              <div
                key={c}
                data-idx={i}
                onClick={() => select(c)}
                style={{
                  padding: '7px 12px', fontSize: 13, cursor: 'pointer',
                  background: i === highlighted
                    ? 'rgba(42,120,214,0.18)'
                    : c === value ? 'rgba(42,120,214,0.08)' : undefined,
                  fontWeight: c === value ? 600 : undefined,
                  direction: 'rtl'
                }}
                onMouseEnter={() => setHighlighted(i)}
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
