import { execSync } from 'child_process';
try {
  execSync('npm run build', { env: { ...process.env, NODE_ENV: 'production' }, stdio: 'inherit' });
} catch (e) {
  console.error(e);
}
