# Distributed Video Surveillance System

A TypeScript/Node.js prototype: an RTSP camera simulator, a video server (Server A),
an auth & management server (Server B), and a React web client. See `SOLUTION.md`
for architectural decisions.

## Prerequisites

- Node.js 20+
- Redis (local installation or WSL2)

## Setup

```bash
npm install
node scripts/setup-keys.mjs                  # RSA key pair -> config/keys/
npm run seed:users --workspace @vss/server-b # demo users -> config/users.json
```

## Demo users

| Login    | Password     | Role     |
|----------|--------------|----------|
| operator | operator123  | operator |
| admin    | admin123     | operator |
| viewer   | viewer123    | viewer   |

`operator` may START/STOP the video; `viewer` may only GET_STATUS.

## Run (Native on Windows 11, no Docker)

This is the primary way to run the system locally on Windows 11:

1. **Install Redis:**
   - Windows: [Download Redis MSI](https://github.com/microsoftarchive/redis/releases) or use WSL2 with `apt-get install redis-server`
   - Start Redis: `redis-server` (or use Windows Service if installed)

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Generate RSA keys:**
   ```bash
   node scripts/setup-keys.mjs
   ```
   This creates `config/keys/private.pem` and `config/keys/public.pem`.

4. **Seed demo users:**
   ```bash
   npm run seed:users --workspace @vss/server-b
   ```
   This creates `config/users.json` with demo accounts.

5. **Start each workspace** (in separate terminal windows). Server A owns the RTSP
   listening socket, so start it before the camera; if you start them in another
   order they will simply reconnect with backoff until both are up.
   ```bash
   # Terminal 1 - Server A (Video server: RTSP listener on 127.0.0.1:1111, WebSocket on 127.0.0.1:2222)
   npm run start --workspace @vss/server-a

   # Terminal 2 - Camera simulator (pushes RTSP to 127.0.0.1:1111)
   npm run start --workspace @vss/camera-sim

   # Terminal 3 - Server B (Auth & control, HTTP on 127.0.0.1:3000, WebSocket on 127.0.0.1:3002)
   npm run start --workspace @vss/server-b

   # Terminal 4 - Web Client (dev server on 127.0.0.1:5173)
   npm run dev --workspace @vss/web-client
   ```

   The camera loops `test.mp4` by default (re-encoded to baseline H.264). Point it
   at another file with `CAMERA_SOURCE=/abs/path/to/video.mp4`.

   Each service logs structured lines (`<timestamp> [component] LEVEL message`) so
   you can follow startup, camera/stream state, viewer connects, and commands.

6. **Access the web client:**
   - Open http://127.0.0.1:5173 in your browser
   - Login with any demo user from the table above

## Test

```bash
npm test                              # all unit + integration suites (100% gate)
npm run test:e2e --workspace @vss/e2e # Playwright critical flows (stack must be up)
```

## Run with Docker on Windows 11

The stack ships as **Linux container images** (Node 20, nginx, Redis) and runs on
Windows 11 via Docker Desktop with the WSL2 backend — no image changes required.

**Prerequisite:** [Docker Desktop](https://www.docker.com/products/docker-desktop/)
installed and set to Linux-container mode (the default with the WSL2 backend). Confirm
with `docker info | findstr OSType` — the output should be `OSType: linux`.

### Recommended: one-command path

```powershell
.\scripts\docker-up.ps1
```

This script:
1. Generates `config/keys/private.pem` and `config/keys/public.pem` if they are missing.
2. Seeds `config/users.json` with the demo users (same table as above).
3. Runs `docker compose up --build -d` and prints the service URLs.

To stop the stack:

```powershell
.\scripts\docker-down.ps1           # stop containers, keep volumes
.\scripts\docker-down.ps1 -Volumes  # stop containers and remove volumes
```

### Manual path

If you prefer to drive compose directly, prepare the host config first (the
`./config` directory is bind-mounted into the containers):

```bash
node scripts/setup-keys.mjs                  # RSA key pair -> config/keys/
npm run seed:users --workspace @vss/server-b # demo users  -> config/users.json
```

Then bring the stack up:

```bash
docker compose up --build -d
```

### URLs

| Service       | URL                                                         |
|---------------|-------------------------------------------------------------|
| Web client    | http://127.0.0.1:8080                                       |
| Server B API  | http://127.0.0.1:3000 (`/auth/login`, `/protected`, `/publicKey`) |

## Native crypto addon (Bonus C)

`@vss/native-crypto` is a C++ N-API addon (RSA-OAEP via Node's bundled OpenSSL).
Building it requires a C/C++ toolchain:

- Windows x64: Visual Studio Build Tools (MSVC) + Python 3.
- Linux/macOS: a working `gcc`/`clang` and `make`.

Enable it with `CIPHER_IMPL=native`. The addon generates its own key pair at
startup; `/publicKey` then serves the addon's public key.

In Docker, the `server-b` image installs the toolchain (`python3`, `make`, `g++`)
and compiles the addon during the build, so `CIPHER_IMPL=native` works inside the
container as well — no extra host setup required.

## TPM-backed cipher (Bonus D)

Enable with `CIPHER_IMPL=tpm`. On Linux the key is sealed in a **software-emulated
TPM**; the private key is never exported (a unit test asserts the export attempt
throws). The real Windows 11 path (Platform Crypto Provider / CNG, non-exportable
key) is deferred to a Windows machine and selected automatically on `win32`.
