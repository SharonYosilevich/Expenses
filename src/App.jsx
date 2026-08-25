import React, { useState } from 'react'
import { useData } from './DataContext.jsx'
import Dashboard from './pages/Dashboard.jsx'
import ChartsPage from './pages/ChartsPage.jsx'
import History from './pages/History.jsx'
import Transactions from './pages/Transactions.jsx'
import Import from './pages/Import.jsx'
import Settings from './pages/Settings.jsx'
import LockScreen from './pages/LockScreen.jsx'
import Installments from './pages/Installments.jsx'

const PAGES = [
  { key: 'dashboard', label: 'דשבורד חודשי', icon: '📊' },
  { key: 'charts', label: 'גרפים', icon: '📈' },
  { key: 'history', label: 'השוואת חודשים', icon: '🗓️' },
  { key: 'transactions', label: 'כל התנועות', icon: '📋' },
  { key: 'installments', label: 'תשלומים', icon: '💳' },
  { key: 'import', label: 'ייבוא', icon: '📥' },
  { key: 'settings', label: 'הגדרות', icon: '⚙️' }
]

export default function App() {
  const { loading, settings } = useData()
  const [page, setPage] = useState('dashboard')
  const [unlocked, setUnlocked] = useState(false)

  if (loading) {
    return (
      <div className="empty-state" style={{ paddingTop: 120 }}>
        טוען נתונים...
      </div>
    )
  }

  if (settings.pinHash && !unlocked) {
    return <LockScreen pinHash={settings.pinHash} recoveryCodeHash={settings.recoveryCodeHash} onUnlock={() => setUnlocked(true)} />
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>הוצאות הבית</h1>
        {PAGES.map((p) => (
          <button
            key={p.key}
            className={'nav-item' + (page === p.key ? ' active' : '')}
            onClick={() => setPage(p.key)}
          >
            <span>{p.icon}</span>
            <span>{p.label}</span>
          </button>
        ))}
        {settings.pinHash && (
          <button
            className="nav-item"
            style={{ marginTop: 'auto', color: 'var(--text-muted)', fontSize: '0.8rem' }}
            onClick={() => setUnlocked(false)}
          >
            <span>🔒</span>
            <span>נעילה</span>
          </button>
        )}
      </aside>
      <main className="main">
        <div style={{ display: page === 'dashboard' ? 'block' : 'none' }}>
          <Dashboard />
        </div>
        <div style={{ display: page === 'charts' ? 'block' : 'none' }}>
          <ChartsPage />
        </div>
        <div style={{ display: page === 'history' ? 'block' : 'none' }}>
          <History />
        </div>
        <div style={{ display: page === 'transactions' ? 'block' : 'none' }}>
          <Transactions />
        </div>
        <div style={{ display: page === 'installments' ? 'block' : 'none' }}>
          <Installments />
        </div>
        <div style={{ display: page === 'import' ? 'block' : 'none' }}>
          <Import onDone={() => setPage('transactions')} />
        </div>
        <div style={{ display: page === 'settings' ? 'block' : 'none' }}>
          <Settings />
        </div>
      </main>
    </div>
  )
}
