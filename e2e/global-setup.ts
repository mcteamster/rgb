import http from 'http';
import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import net from 'net';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

/** Marker file written when this setup starts the backend.
 *  Lets global-teardown know whether to shut things down. */
export const BACKEND_MARKER = path.join(__dirname, '.backend-started');

/** PID of the spawned dev:service process, used by teardown to kill cleanly. */
export const SVC_PID_FILE = path.join(__dirname, '.svc-pid');

/** Parse a .env file into a key→value map, ignoring comments and blanks. */
function loadEnvFile(filePath: string): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(filePath, 'utf-8')
        .split('\n')
        .filter(line => line && !line.startsWith('#'))
        .map(line => line.split('=', 2) as [string, string])
        .filter(([k]) => k?.trim())
        .map(([k, v]) => [k.trim(), (v ?? '').trim()]),
    );
  } catch {
    return {};
  }
}

function isPortOpen(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = net.connect(port, '127.0.0.1');
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
  });
}

async function waitForPort(port: number, timeout = 120_000): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await isPortOpen(port)) return;
    await new Promise(r => setTimeout(r, 1_000));
  }
  throw new Error(`Port ${port} did not open within ${timeout / 1_000}s`);
}

/** Wait until DynamoDB Local responds to an HTTP request (not just TCP open). */
async function waitForDynamo(timeout = 60_000): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const ok = await new Promise<boolean>(resolve => {
      const req = http.get('http://localhost:8000', res => {
        res.resume();
        resolve(true);
      });
      req.once('error', () => resolve(false));
      req.setTimeout(2_000, () => { req.destroy(); resolve(false); });
    });
    if (ok) return;
    await new Promise(r => setTimeout(r, 1_000));
  }
  throw new Error('DynamoDB Local did not respond within 60s');
}

export default async function globalSetup() {
  // Allow opting out entirely (e.g. CI without SAM/Podman)
  if (process.env.SKIP_BACKEND_TESTS) {
    console.log('\n[e2e] SKIP_BACKEND_TESTS set — skipping backend startup\n');
    return;
  }

  // If all three backend ports are already open, reuse the running stack
  const [rest, ws, lambda] = await Promise.all([
    isPortOpen(3000), isPortOpen(3001), isPortOpen(3002),
  ]);

  if (rest && ws && lambda) {
    console.log('\n[e2e] Backend already running — skipping startup\n');
    return;
  }

  // Write marker so teardown knows we own the backend
  writeFileSync(BACKEND_MARKER, '');

  // Merge service/.env.local into child-process env (picks up DOCKER_HOST etc.)
  const serviceEnv = loadEnvFile(path.join(ROOT, 'service', '.env.local'));
  const childEnv = { ...process.env, ...serviceEnv };

  console.log('\n[e2e] Starting DynamoDB Local...');
  execSync('npm run local:up', { cwd: ROOT, stdio: 'inherit', env: childEnv });

  console.log('[e2e] Waiting for DynamoDB Local to be ready...');
  await waitForDynamo(60_000);

  console.log('[e2e] Seeding tables...');
  execSync('npm run seed', { cwd: ROOT, stdio: 'inherit', env: childEnv });

  console.log('[e2e] Starting backend services (SAM REST, SAM Lambda, WS proxy)...');
  const svc = spawn('npm', ['run', 'dev:service'], {
    cwd: ROOT,
    stdio: 'ignore',
    detached: true,
    env: childEnv,
  });
  svc.unref();

  // Save PID so teardown can kill the process group cleanly
  writeFileSync(SVC_PID_FILE, String(svc.pid));

  console.log('[e2e] Waiting for ports 3000 (REST), 3001 (WS), 3002 (Lambda)...');
  console.log('[e2e] Note: SAM pulls container images on first run — this can take a few minutes.\n');
  await Promise.all([
    waitForPort(3000, 180_000),
    waitForPort(3001,  30_000),
    waitForPort(3002, 180_000),
  ]);

  // Warm up the REST Lambda so the first test doesn't hit a cold start
  console.log('[e2e] Warming up REST Lambda...');
  await waitForHttp('http://localhost:3000/', 60_000);

  console.log('[e2e] All backend services ready\n');
}
