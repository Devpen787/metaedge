import fs from 'fs';
const data = fs.readFileSync('screenshot.png');
console.log('Size:', data.length);
