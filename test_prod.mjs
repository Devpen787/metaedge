import { execSync } from 'child_process';
try {
  execSync('rm -rf node_modules && npm install --production', { stdio: 'inherit' });
  execSync('npm run build', { env: { ...process.env, NODE_ENV: 'production' }, stdio: 'inherit' });
} catch (e) {
  console.error(e);
}
