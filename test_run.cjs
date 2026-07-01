const { execSync } = require('child_process');
try {
  execSync('node dist/server.cjs', { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' }});
} catch(e) {
  console.log('Error', e.message);
}
