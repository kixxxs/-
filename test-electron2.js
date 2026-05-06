console.log('process.type:', process.type);
console.log('process.versions.electron:', process.versions.electron);
console.log('process.versions.node:', process.versions.node);
console.log('process.resourcesPath:', process.resourcesPath);
console.log('process.execPath:', process.execPath);

try {
  const electron = require('electron');
  console.log('electron type:', typeof electron);
  if (typeof electron === 'object' && electron !== null) {
    console.log('has app:', 'app' in electron);
    console.log('has BrowserWindow:', 'BrowserWindow' in electron);
  }
} catch(e) {
  console.log('require error:', e.message);
}
