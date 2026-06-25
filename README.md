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

5. **Start each workspace** (in separate terminal windows):
   ```bash
   # Terminal 1 - Camera simulator (RTSP on 127.0.0.1:1111)
   npm run start --workspace @vss/camera-sim

   # Terminal 2 - Server A (Video server, WebSocket on 127.0.0.1:2222)
   npm run start --workspace @vss/server-a

   # Terminal 3 - Server B (Auth & control, HTTP on 127.0.0.1:3000, WebSocket on 127.0.0.1:3002)
   npm run start --workspace @vss/server-b

   # Terminal 4 - Web Client (dev server on 127.0.0.1:5173)
   npm run dev --workspace @vss/web-client
   ```

6. **Access the web client:**
   - Open http://127.0.0.1:5173 in your browser
   - Login with any demo user from the table above

## Test

```bash
npm test                              # all unit + integration suites (100% gate)
npm run test:e2e --workspace @vss/e2e # Playwright critical flows (stack must be up)
```

## Optional: Run with Docker Compose

If you prefer an orchestrated containerized setup:

```bash
docker compose up --build -d
# Web client:   http://127.0.0.1:8080
# Server B API: http://127.0.0.1:3000  (/auth/login, /protected, /publicKey)
```

## Native crypto addon (Bonus C)

`@vss/native-crypto` is a C++ N-API addon (RSA-OAEP via Node's bundled OpenSSL).
Building it requires a C/C++ toolchain:

- Windows x64: Visual Studio Build Tools (MSVC) + Python 3.
- Linux/macOS: a working `gcc`/`clang` and `make`.

Enable it with `CIPHER_IMPL=native`. The addon generates its own key pair at
startup; `/publicKey` then serves the addon's public key.

## TPM-backed cipher (Bonus D)

Enable with `CIPHER_IMPL=tpm`. On Linux the key is sealed in a **software-emulated
TPM**; the private key is never exported (a unit test asserts the export attempt
throws). The real Windows 11 path (Platform Crypto Provider / CNG, non-exportable
key) is deferred to a Windows machine and selected automatically on `win32`.
