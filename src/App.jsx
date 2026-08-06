import React, { useState } from 'react'
import { useData } from './DataContext.jsx'
import Dashboard from './pages/Dashboard.jsx'
import ChartsPage from './pages/ChartsPage.jsx'
import History from './pages/History.jsx'
import Transactions from './pages/Transactions.jsx'
import Import from './pages/Import.jsx'
import Settings from './pages/Settings.jsx'

const PAGES = [
  { key: 'dashboard', label: 'דשבורד חודשי', icon: '📊' },
  { key: 'charts', label: 'גרפים', icon: '📈' },
  { key: 'history', label: 'השוואת חודשים', icon: '🗓️' },
  { key: 'transactions', label: 'כל התנועות', icon: '📋' },
  { key: 'import', label: 'ייבוא', icon: '📥' },
  { key: 'settings', label: 'הגדרות', icon: '⚙️' }
]

export default function App() {
  const { loading } = useData()
  const [page, setPage] = useState('dashboard')

  if (loading) {
    return (
      <div className="empty-state" style={{ paddingTop: 120 }}>
        טוען נתונים...
      </div>
    )
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
      </aside>
      <main className="main">
        {page === 'dashboard' && <Dashboard />}
        {page === 'charts' && <ChartsPage />}
        {page === 'history' && <History />}
        {page === 'transactions' && <Transactions />}
        {page === 'import' && <Import onDone={() => setPage('transactions')} />}
        {page === 'settings' && <Settings />}
      </main>
    </div>
  )
}
