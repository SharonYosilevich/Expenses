import React, { useEffect, useState } from 'react'
import { useData } from '../DataContext.jsx'

export default function Settings() {
  const { settings, updateSettings, reloadFromBackup } = useData()
  const [dataPath, setDataPath] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newPerson, setNewPerson] = useState('')
  const [backupMsg, setBackupMsg] = useState('')

  useEffect(() => {
    window.api.getDataPath().then(setDataPath)
  }, [])

  function addCategory() {
    const v = newCategory.trim()
    if (!v || (settings.categories || []).includes(v)) return
    updateSettings({ categories: [...(settings.categories || []), v] })
    setNewCategory('')
  }

  function removeCategory(cat) {
    updateSettings({ categories: (settings.categories || []).filter((c) => c !== cat) })
  }

  function addPerson() {
    const v = newPerson.trim()
    if (!v || (settings.people || []).includes(v)) return
    updateSettings({ people: [...(settings.people || []), v] })
    setNewPerson('')
  }

  function removePerson(p) {
    updateSettings({ people: (settings.people || []).filter((x) => x !== p) })
  }

  function removeRule(idx) {
    const rules = [...(settings.rules || [])]
    rules.splice(idx, 1)
    updateSettings({ rules })
  }

  function removeMapping(name) {
    const next = { ...(settings.importMappings || {}) }
    delete next[name]
    updateSettings({ importMappings: next })
  }

  async function handleExportBackup() {
    const res = await window.api.exportBackup()
    if (!res.canceled) setBackupMsg('הגיבוי נשמר ב: ' + res.filePath)
  }

  async function handleImportBackup() {
    if (!confirm('שחזור מגיבוי יחליף את כל הנתונים הנוכחיים באפליקציה. להמשיך?')) return
    const res = await window.api.importBackup()
    if (!res.canceled) {
      reloadFromBackup(res.data)
      setBackupMsg('הנתונים שוחזרו בהצלחה')
    }
  }

  return (
    <div>
      <h2 className="page-title">הגדרות</h2>

      <div className="grid-2">
        <div>
          <div className="section-title">קטגוריות</div>
          <div className="card">
            <div className="tag-list" style={{ marginBottom: 12 }}>
              {(settings.categories || []).map((c) => (
                <span className="tag" key={c}>
                  {c}
                  <button onClick={() => removeCategory(c)}>✕</button>
                </span>
              ))}
            </div>
            <div className="form-row" style={{ marginBottom: 0 }}>
              <input
                type="text"
                placeholder="קטגוריה חדשה"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCategory()}
              />
              <button className="btn" onClick={addCategory}>
                הוספה
              </button>
            </div>
          </div>
        </div>

        <div>
          <div className="section-title">עבור מי</div>
          <div className="card">
            <div className="tag-list" style={{ marginBottom: 12 }}>
              {(settings.people || []).map((p) => (
                <span className="tag" key={p}>
                  {p}
                  <button onClick={() => removePerson(p)}>✕</button>
                </span>
              ))}
            </div>
            <div className="form-row" style={{ marginBottom: 0 }}>
              <input
                type="text"
                placeholder="שם חדש"
                value={newPerson}
                onChange={(e) => setNewPerson(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPerson()}
              />
              <button className="btn" onClick={addPerson}>
                הוספה
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="section-title">חוקי סיווג אוטומטי</div>
      <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
        {(settings.rules || []).length === 0 ? (
          <div className="empty-state">אין חוקים עדיין - הם נוצרים אוטומטית בזמן ייבוא כשמסמנים "הוסף כחוק"</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>מילת מפתח בתיאור</th>
                <th>סוג</th>
                <th>קטגוריה</th>
                <th>עבור מי</th>
                <th>קבוע?</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(settings.rules || []).map((r, idx) => (
                <tr key={idx}>
                  <td>{r.keyword}</td>
                  <td>{r.type === 'income' ? 'הכנסה' : 'הוצאה'}</td>
                  <td>{r.category}</td>
                  <td>{r.person}</td>
                  <td>{r.isFixed ? 'כן' : 'לא'}</td>
                  <td>
                    <button className="btn danger" onClick={() => removeRule(idx)}>
                      מחיקה
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section-title">מיפויי ייבוא שמורים</div>
      <div className="card">
        {Object.keys(settings.importMappings || {}).length === 0 ? (
          <div className="empty-state">אין עדיין מיפויים שמורים</div>
        ) : (
          <div className="tag-list">
            {Object.keys(settings.importMappings || {}).map((name) => (
              <span className="tag" key={name}>
                {name}
                <button onClick={() => removeMapping(name)}>✕</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="section-title">גיבוי ושחזור</div>
      <div className="card">
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          כל הנתונים נשמרים במחשב בלבד, בנתיב:
          <br />
          <code>{dataPath}</code>
          <br />
          גיבוי אוטומטי נשמר בכל שינוי (10 גיבויים אחרונים). מומלץ גם לייצא גיבוי ידני מדי פעם למקום בטוח.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn primary" onClick={handleExportBackup}>
            ייצוא גיבוי לקובץ
          </button>
          <button className="btn" onClick={handleImportBackup}>
            שחזור מגיבוי
          </button>
        </div>
        {backupMsg && <p style={{ color: 'var(--success)', fontSize: 13 }}>{backupMsg}</p>}
      </div>
    </div>
  )
}
