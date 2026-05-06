const electron = require('electron');
console.log('type:', typeof electron);
console.log('is string:', typeof electron === 'string');
if (typeof electron === 'object') {
  console.log('keys:', Object.keys(electron).slice(0, 20));
  console.log('has app:', 'app' in electron);
  console.log('app exists:', !!electron.app);
}
