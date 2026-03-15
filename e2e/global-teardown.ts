import { execSync } from 'child_process';
import { existsSync, unlinkSync } from 'fs';
import path from 'path';

import { BACKEND_MARKER } from './global-setup';

const ROOT = path.resolve(__dirname, '..');

export default async function globalTeardown() {
  // Only stop services if this process started them
  if (!existsSync(BACKEND_MARKER)) return;

  unlinkSync(BACKEND_MARKER);
  console.log('\n[e2e] Stopping backend services...');
  execSync('npm run local:down', { cwd: ROOT, stdio: 'inherit' });
}
