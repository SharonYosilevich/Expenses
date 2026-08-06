const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const { loadData, saveData, getDataPaths } = require('./dataStore')
const { parseExcelBuffer } = require('./lib/importExcel')
const { parsePdfBuffer } = require('./lib/importPdf')

let mainWindow
let currentData = null

function getData() {
  if (!currentData) currentData = loadData()
  return currentData
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('data:load', () => getData())

ipcMain.handle('data:saveTransactions', (event, transactions) => {
  const data = getData()
  data.transactions = transactions
  saveData(data)
  return { ok: true }
})

ipcMain.handle('data:saveSettings', (event, settings) => {
  const data = getData()
  data.settings = settings
  saveData(data)
  return { ok: true }
})

ipcMain.handle('import:pickFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'בחירת קובץ לייבוא',
    properties: ['openFile'],
    filters: [
      { name: 'קבצים נתמכים', extensions: ['xlsx', 'xls', 'csv', 'pdf'] },
      { name: 'Excel', extensions: ['xlsx', 'xls', 'csv'] },
      { name: 'PDF', extensions: ['pdf'] }
    ]
  })
  if (result.canceled || !result.filePaths.length) return { canceled: true }
  return { canceled: false, filePath: result.filePaths[0] }
})

ipcMain.handle('import:parseFile', async (event, filePath) => {
  const ext = path.extname(filePath).toLowerCase()
  const buffer = fs.readFileSync(filePath)
  const fileName = path.basename(filePath)

  if (ext === '.pdf') {
    const parsed = await parsePdfBuffer(buffer)
    return { fileName, kind: 'pdf', ...parsed }
  }
  const parsed = parseExcelBuffer(buffer)
  return { fileName, kind: 'excel', ...parsed }
})

ipcMain.handle('app:getDataPath', () => getDataPaths().userData)

ipcMain.handle('backup:exportPrompt', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'ייצוא גיבוי',
    defaultPath: `גיבוי-הוצאות-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (result.canceled || !result.filePath) return { canceled: true }
  fs.writeFileSync(result.filePath, JSON.stringify(getData(), null, 2), 'utf-8')
  return { canceled: false, filePath: result.filePath }
})

ipcMain.handle('backup:importPrompt', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'שחזור מגיבוי',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (result.canceled || !result.filePaths.length) return { canceled: true }
  const raw = fs.readFileSync(result.filePaths[0], 'utf-8')
  const parsed = JSON.parse(raw)
  currentData = {
    version: parsed.version || 1,
    transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    settings: parsed.settings || getData().settings
  }
  saveData(currentData)
  return { canceled: false, data: currentData }
})
