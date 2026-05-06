const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  dbQuery: (sql, params) => ipcRenderer.invoke('db-query', sql, params),
  dbExportAll: () => ipcRenderer.invoke('db-export-all'),
  saveAvatar: (dataUrl, name) => ipcRenderer.invoke('save-avatar', dataUrl, name),
  selectExportDir: () => ipcRenderer.invoke('select-export-dir'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  selectAndReadCSV: () => ipcRenderer.invoke('select-and-read-csv'),
  getInitData: () => ipcRenderer.invoke('get-init-data'),
  addArtist: (data) => ipcRenderer.invoke('add-artist', data),
  updateArtist: (data) => ipcRenderer.invoke('update-artist', data),
  deleteArtist: (id) => ipcRenderer.invoke('delete-artist', id),
  addContract: (data) => ipcRenderer.invoke('add-contract', data),
  updateContract: (data) => ipcRenderer.invoke('update-contract', data),
  addSalaries: (salaryList) => ipcRenderer.invoke('add-salaries', salaryList),
  addEvaluations: (evalList) => ipcRenderer.invoke('add-evaluations', evalList),
  saveArtistPhotos: (artistId, photosJson) => ipcRenderer.invoke('save-artist-photos', artistId, photosJson),
  resetAllData: () => ipcRenderer.invoke('reset-all-data'),
  isDesktop: true
});
