import { execSync } from 'child_process';
import { existsSync, unlinkSync, readFileSync } from 'fs';
import path from 'path';

import { BACKEND_MARKER, SVC_PID_FILE } from './global-setup';

const ROOT = path.resolve(__dirname, '..');

export default async function globalTeardown() {
  // Only stop services if this process started them
  if (!existsSync(BACKEND_MARKER)) return;

  unlinkSync(BACKEND_MARKER);
  console.log('\n[e2e] Stopping backend services...');

  // Kill the dev:service process group (concurrently + SAM + ws-proxy)
  if (existsSync(SVC_PID_FILE)) {
    const pid = parseInt(readFileSync(SVC_PID_FILE, 'utf-8').trim(), 10);
    unlinkSync(SVC_PID_FILE);
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      // Process may have already exited
    }
  }

  // Stop DynamoDB Local
  execSync('podman compose down', {
    cwd: path.join(ROOT, 'service'),
    stdio: 'inherit',
  });
}
