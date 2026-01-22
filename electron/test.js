// Test file to verify electron works
const { app } = require('electron');
console.log('App loaded:', typeof app);
console.log('whenReady exists:', typeof app.whenReady === 'function');
process.exit(0);
