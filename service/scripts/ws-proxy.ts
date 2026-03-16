/**
 * WebSocket proxy for local development.
 *
 * SAM CLI doesn't simulate WebSocket API Gateway, so this proxy:
 *   1. Accepts WebSocket connections on port 3001
 *   2. Forwards connect/message/disconnect events to Lambda functions
 *      running in `sam local start-lambda` (port 3002)
 *   3. Handles POST /@connections/:id — the API Gateway Management API
 *      mock that Lambda calls when it wants to push data to a client
 *
 * Run via:  npm run local:ws   (or as part of npm run dev:service)
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';

const SAM_LAMBDA_PORT = process.env.SAM_LAMBDA_PORT ?? '3002';
const PROXY_PORT      = parseInt(process.env.WS_PROXY_PORT ?? '3001', 10);
const SAM_LAMBDA_BASE = `http://localhost:${SAM_LAMBDA_PORT}/2015-03-31/functions`;

// ── In-memory connection store ─────────────────────────────────────────────
// Maps connectionId → live WebSocket so the APIGW management mock can
// deliver messages without going through real API Gateway.
const connections = new Map<string, WebSocket>();

// ── Per-connection invocation queue ───────────────────────────────────────
// SAM local kills a running Lambda container when a second invocation of ANY
// function starts while the first is still in-flight.  For each WebSocket
// connection, serialise Connect → Message* → Disconnect so the containers
// are never hit concurrently from the same connection.
const connectionQueues = new Map<string, Promise<void>>();

// ── Invoke a SAM Lambda function ───────────────────────────────────────────
async function invokeLambdaRaw(functionName: string, event: object): Promise<void> {
  const url = `${SAM_LAMBDA_BASE}/${functionName}/invocations`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[Lambda] ${functionName} returned ${res.status}: ${text}`);
    }
  } catch (err) {
    console.error(`[Lambda] Failed to invoke ${functionName}:`, err);
  }
}

function invokeLambdaForConnection(connectionId: string, functionName: string, event: object): Promise<void> {
  const prev = connectionQueues.get(connectionId) ?? Promise.resolve();
  const p = prev.then(() => invokeLambdaRaw(functionName, event));
  connectionQueues.set(connectionId, p.catch(() => {}));
  return p;
}

// ── Build a mock API Gateway WebSocket event ───────────────────────────────
function wsEvent(routeKey: string, connectionId: string, body?: string) {
  return {
    requestContext: {
      connectionId,
      routeKey,
      eventType: routeKey === '$connect'    ? 'CONNECT'
               : routeKey === '$disconnect' ? 'DISCONNECT'
               : 'MESSAGE',
    },
    body: body ?? null,
    isBase64Encoded: false,
  };
}

// ── Read full body from an HTTP request ────────────────────────────────────
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end',  () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ── HTTP server (port 3001) ────────────────────────────────────────────────
// Handles the API Gateway Management API mock used by Lambda to broadcast.
// Lambda calls: POST {WEBSOCKET_ENDPOINT}/@connections/{connectionId}
const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*' });
    res.end();
    return;
  }

  const url = req.url ?? '/';
  const match = url.match(/^\/@connections\/(.+)$/);

  if (req.method === 'POST' && match) {
    const connectionId = decodeURIComponent(match[1]);
    const ws = connections.get(connectionId);

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      // 410 Gone — tells Lambda to clean up the stale connection record
      res.writeHead(410);
      res.end();
      return;
    }

    const body = await readBody(req);
    ws.send(body);
    res.writeHead(200);
    res.end();
    return;
  }

  res.writeHead(404);
  res.end();
});

// ── WebSocket server ───────────────────────────────────────────────────────
const wss = new WebSocketServer({ server });

wss.on('connection', async (ws: WebSocket) => {
  const connectionId = randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
  connections.set(connectionId, ws);
  console.log(`[WS] + ${connectionId}`);

  // Use a per-connection queue: ConnectFunction must finish before any message
  // is forwarded, and Disconnect runs after all messages have been processed.
  // This prevents concurrent Lambda container invocations for a single connection
  // which cause SAM to kill the running container (signal: killed).
  ws.on('message', async (data) => {
    const body = data.toString();
    console.log(`[WS] → ${connectionId}  ${body.slice(0, 80)}`);
    await invokeLambdaForConnection(connectionId, 'MessageFunction', wsEvent('$default', connectionId, body));
  });

  ws.on('close', async () => {
    console.log(`[WS] - ${connectionId}`);
    await invokeLambdaForConnection(connectionId, 'DisconnectFunction', wsEvent('$disconnect', connectionId));
    connectionQueues.delete(connectionId);
    connections.delete(connectionId);
  });

  await invokeLambdaForConnection(connectionId, 'ConnectFunction', wsEvent('$connect', connectionId));
});

server.listen(PROXY_PORT, () => {
  console.log(`WS proxy  →  ws://localhost:${PROXY_PORT}`);
  console.log(`            (APIGW management mock on http://localhost:${PROXY_PORT})`);
  console.log(`            (SAM Lambda endpoint: ${SAM_LAMBDA_BASE})`);
});
