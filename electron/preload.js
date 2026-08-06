const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  loadData: () => ipcRenderer.invoke('data:load'),
  saveTransactions: (transactions) => ipcRenderer.invoke('data:saveTransactions', transactions),
  saveSettings: (settings) => ipcRenderer.invoke('data:saveSettings', settings),

  pickImportFile: () => ipcRenderer.invoke('import:pickFile'),
  parseImportFile: (filePath) => ipcRenderer.invoke('import:parseFile', filePath),

  exportBackup: () => ipcRenderer.invoke('backup:exportPrompt'),
  importBackup: () => ipcRenderer.invoke('backup:importPrompt'),
  getDataPath: () => ipcRenderer.invoke('app:getDataPath')
})
