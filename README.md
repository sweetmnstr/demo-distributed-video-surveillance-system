# Distributed Video Surveillance System

A TypeScript/Node.js prototype: an RTSP camera simulator, a video server (Server A),
an auth & management server (Server B), and a React web client. See `SOLUTION.md`
for architectural decisions and `docs/superpowers/specs` for the full design.

## Prerequisites

- Node.js 20+
- Docker + Docker Compose (for the orchestrated run)
- (Native Windows 11 run) no Docker required; see "Native run" below

## Setup

```bash
npm install
node scripts/setup-keys.mjs                  # RSA key pair -> config/keys/
npm run seed:users --workspace @vss/server-b # demo users -> config/users.json
```

## Run with docker-compose (recommended)

```bash
docker compose up --build -d
# Web client:   http://127.0.0.1:8080
# Server B API: http://127.0.0.1:3000  (/auth/login, /protected, /publicKey)
```

## Demo users

| Login    | Password     | Role     |
|----------|--------------|----------|
| operator | operator123  | operator |
| admin    | admin123     | operator |
| viewer   | viewer123    | viewer   |

`operator` may START/STOP the video; `viewer` may only GET_STATUS.

## Test

```bash
npm test                              # all unit + integration suites (100% gate)
npm run test:e2e --workspace @vss/e2e # Playwright critical flows (stack must be up)
```

## Native run (Windows 11, no Docker)

Run a local Redis and start each workspace with the `.env.example` values
adjusted to `127.0.0.1` hosts:

```bash
npm run start --workspace @vss/camera-sim
npm run start --workspace @vss/server-a
npm run start --workspace @vss/server-b
npm run dev   --workspace @vss/web-client
```
