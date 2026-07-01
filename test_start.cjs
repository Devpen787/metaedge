const { execSync } = require('child_process');

try {
  console.log('Running npm run start');
  execSync('npm run start', { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production', PORT: '3000' } });
} catch (e) {
  console.error('Error', e.message);
}
