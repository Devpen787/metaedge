const { execSync } = require('child_process');

try {
  console.log('Running without experimental require module');
  execSync('node --no-experimental-require-module -e "require(\'@google/genai\')"', { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' } });
} catch (e) {
  console.error('Error', e.message);
}
