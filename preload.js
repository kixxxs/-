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
  saveContractFile: (dataUrl, contractId) => ipcRenderer.invoke('save-contract-file', dataUrl, contractId),
  readContractFile: (filePath) => ipcRenderer.invoke('read-contract-file', filePath),
  addSalaries: (salaryList) => ipcRenderer.invoke('add-salaries', salaryList),
  addEvaluations: (evalList) => ipcRenderer.invoke('add-evaluations', evalList),
  saveArtistPhotos: (artistId, photosJson) => ipcRenderer.invoke('save-artist-photos', artistId, photosJson),
  resetAllData: () => ipcRenderer.invoke('reset-all-data'),
  getAnnouncements: () => ipcRenderer.invoke('get-announcements'),
  addAnnouncement: (data) => ipcRenderer.invoke('add-announcement', data),
  deleteAnnouncement: (id) => ipcRenderer.invoke('delete-announcement', id),
  readAnnouncementFile: (filePath) => ipcRenderer.invoke('read-announcement-file', filePath),
  isDesktop: true
});
