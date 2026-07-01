const { execSync } = require('child_process');

try {
  console.log('Running npm install --omit=dev');
  execSync('npm install --omit=dev', { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' } });
  
  console.log('Running npm run build');
  execSync('npm run build', { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' } });
  
  console.log('Done!');
} catch (e) {
  console.error('Error', e.message);
}
