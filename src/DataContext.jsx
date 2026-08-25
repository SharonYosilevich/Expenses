import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const DataContext = createContext(null)

const SERIES_VARS = [
  '--series-1',
  '--series-2',
  '--series-3',
  '--series-4',
  '--series-5',
  '--series-6',
  '--series-7',
  '--series-8'
]

export function DataProvider({ children }) {
  const [transactions, setTransactions] = useState([])
  const [settings, setSettings] = useState({ categories: [], people: [], rules: [], importMappings: {} })
  const [loading, setLoading] = useState(true)
  const [clearVersion, setClearVersion] = useState(0)

  useEffect(() => {
    window.api.loadData().then((data) => {
      setTransactions(data.transactions || [])
      setSettings(data.settings || {})
      setLoading(false)
    })
  }, [])

  const persistTransactions = useCallback((next) => {
    setTransactions(next)
    window.api.saveTransactions(next)
  }, [])

  const persistSettings = useCallback((next) => {
    setSettings(next)
    window.api.saveSettings(next)
  }, [])

  const addTransactions = useCallback(
    (newOnes) => {
      persistTransactions([...transactions, ...newOnes])
    },
    [transactions, persistTransactions]
  )

  const updateTransaction = useCallback(
    (id, patch) => {
      persistTransactions(transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)))
    },
    [transactions, persistTransactions]
  )

  const deleteTransaction = useCallback(
    (id) => {
      persistTransactions(transactions.filter((t) => t.id !== id))
    },
    [transactions, persistTransactions]
  )

  const updateSettings = useCallback(
    (patch) => {
      persistSettings({ ...settings, ...patch })
    },
    [settings, persistSettings]
  )

  const categoryColorVar = useCallback(
    (category) => {
      const idx = (settings.categories || []).indexOf(category)
      if (idx === -1 || idx >= SERIES_VARS.length) return 'var(--text-muted)'
      return `var(${SERIES_VARS[idx]})`
    },
    [settings.categories]
  )

  const reloadFromBackup = useCallback((data) => {
    setTransactions(data.transactions || [])
    setSettings(data.settings || {})
  }, [])

  const clearTransactions = useCallback(() => {
    persistTransactions([])
    setClearVersion((v) => v + 1)
  }, [persistTransactions])

  const deleteTransactionsByMonth = useCallback(
    (months) => {
      const monthSet = new Set(months)
      persistTransactions(transactions.filter((t) => !monthSet.has(t.month)))
      setClearVersion((v) => v + 1)
    },
    [transactions, persistTransactions]
  )

  const deleteTransactionsByMonthAndFile = useCallback(
    (month, fileType) => {
      function guessFileType(t) {
        if (t.sourceFileType) return t.sourceFileType
        const f = t.sourceFile || ''
        if (f.includes('1029')) return 'card-1029'
        if (f.includes('5825')) return 'card-5825'
        return 'bank'
      }
      persistTransactions(
        transactions.filter((t) => {
          if (t.month !== month) return true
          return guessFileType(t) !== fileType
        })
      )
      setClearVersion((v) => v + 1)
    },
    [transactions, persistTransactions]
  )

  const value = useMemo(
    () => ({
      transactions,
      settings,
      loading,
      clearVersion,
      addTransactions,
      updateTransaction,
      deleteTransaction,
      updateSettings,
      categoryColorVar,
      reloadFromBackup,
      clearTransactions,
      deleteTransactionsByMonth,
      deleteTransactionsByMonthAndFile
    }),
    [transactions, settings, loading, clearVersion, addTransactions, updateTransaction, deleteTransaction, updateSettings, categoryColorVar, reloadFromBackup, clearTransactions, deleteTransactionsByMonth, deleteTransactionsByMonthAndFile]
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
