# Local Development

Run the full RGB stack locally — no AWS account required.

## Prerequisites

- **Node.js 22+**
- **Docker** (for DynamoDB Local)
- **AWS SAM CLI** — [install guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Build the service TypeScript
npm run build --workspace=service

# 3. Start DynamoDB Local
docker compose up -d

# 4. Create tables and seed today's daily challenge
npm run seed

# 5. Start all backend servers (REST, Lambda, WS proxy) in one terminal
npm run dev:service

# 6. Start the client in another terminal
cp client/.env.local.example client/.env.local
npm run dev:client
```

Open **http://localhost:5173**.

---

## How it works

### SAM handles the backend

[AWS SAM CLI](https://aws.amazon.com/serverless/sam/) runs the Lambda functions locally in Docker containers using the same Node.js 22 runtime as production.

| Command | Port | Purpose |
|---------|------|---------|
| `sam local start-api` | 3000 | REST API (daily challenge endpoints) |
| `sam local start-lambda` | 3002 | Lambda invocation endpoint (used by the WS proxy) |
| `ws-proxy.ts` | 3001 | WebSocket server + API Gateway Management API mock |

SAM CLI doesn't natively simulate WebSocket API Gateway, so a thin proxy (`service/scripts/ws-proxy.ts`) handles WebSocket connections and forwards connect/message/disconnect events to the Lambda functions via `sam local start-lambda`.

When Lambda wants to push data to a connected client (broadcasting), it calls `POST {WEBSOCKET_ENDPOINT}/@connections/{id}`. The proxy handles these requests at `http://localhost:3001/@connections/:id` and delivers the message directly to the live WebSocket.

### DynamoDB Local

State is stored in **DynamoDB Local** running in Docker on port `8000`. Lambda containers reach it via the `rgb-local` Docker network at `http://dynamodb-local:8000`. Data is in-memory and resets when the container restarts.

### Client

`client/.env.local` overrides production endpoints:

| Variable | Local value |
|----------|-------------|
| `VITE_DAILY_CHALLENGE_API_URL` | `http://localhost:3000` |
| `VITE_WS_LOCAL_URL` | `ws://localhost:3001` |

---

## Scripts

From the repo root:

| Command | What it does |
|---------|-------------|
| `npm run build --workspace=service` | Compile TypeScript (required before `dev:service`) |
| `npm run seed` | Create DynamoDB tables + seed today's challenge |
| `npm run dev:service` | Start REST (:3000), Lambda (:3002), and WS proxy (:3001) |
| `npm run dev:client` | Vite dev server on :5173 |

Re-run `npm run build --workspace=service` after changing any Lambda code.

---

## Daily challenge seed

The seed script creates today's challenge with a deterministic sample prompt. Re-running is safe — it skips entries that already exist.

To use a custom prompt:

```bash
aws dynamodb put-item \
  --endpoint-url http://localhost:8000 \
  --table-name rgb-daily-challenges \
  --item '{
    "challengeId": {"S": "2026-03-15"},
    "prompt":      {"S": "My Custom Prompt"},
    "validFrom":   {"S": "2026-03-15T00:00:00.000Z"},
    "validUntil":  {"S": "2026-03-16T00:00:00.000Z"},
    "totalSubmissions": {"N": "0"}
  }'
```

---

## Linux note

On Linux, `host.docker.internal` (the hostname Lambda containers use to reach the WS proxy) is not automatically available. The `docker-compose.yml` adds `extra_hosts: host.docker.internal:host-gateway` for the DynamoDB container. For SAM Lambda containers, pass the flag explicitly:

```bash
# In service/package.json local:rest and local:lambda scripts, add:
--container-host-interface 0.0.0.0
```

Or set `WEBSOCKET_ENDPOINT=http://172.17.0.1:3001` (the default Docker bridge gateway) in `template.yaml`.

---

## Limitations vs production

| Feature | Local | Production |
|---------|-------|------------|
| Multiplayer WebSocket | ✅ via SAM + WS proxy | ✅ API Gateway |
| Daily challenge REST | ✅ via SAM | ✅ API Gateway |
| Region selection | Bypassed (`VITE_WS_LOCAL_URL`) | Virgo auto-detect |
| DynamoDB TTL | Not enforced | Enforced by AWS |
| EventBridge daily scheduler | Not running | Creates challenge at UTC midnight |
| Lambda cold starts | Slow (SAM pulls Docker images) | Warm via provisioned concurrency |
| Data persistence | Resets on Docker restart | Persistent |
| HTTPS / WSS | HTTP / WS only | HTTPS / WSS |
