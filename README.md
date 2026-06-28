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

## Run (Native on Windows 11)

This is the primary way to run the system locally on Windows 11:

**Fast path — one command from the repo root:**

```bash
npm run start
```

This builds every workspace and launches Server A, the camera simulator, Server B, and
the web client together (via `concurrently`). Prefer the per-terminal steps below when
you want to start, stop, or read the logs of services individually.

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

## Native crypto addon (Bonus C)

`@vss/native-crypto` is a C++ N-API addon (RSA-OAEP via Node's bundled OpenSSL).
Building it requires a C/C++ toolchain:

- Windows x64: Visual Studio Build Tools (MSVC) + Python 3.
- Linux/macOS: a working `gcc`/`clang` and `make`.

Enable it with `CIPHER_IMPL=native`. The addon generates its own key pair at
startup; `/publicKey` then serves the addon's public key.

## Windows TPM cipher backend (Bonus D)

Enable with `CIPHER_IMPL=tpm`. Server B selects the device automatically:

- **Windows (win32):** uses the real TPM 2.0 via the Windows CNG Platform Crypto
  Provider (`MS_PLATFORM_CRYPTO_PROVIDER`). An RSA-2048 key is persisted inside the
  TPM under `TPM_KEY_NAME` (default `vss-tpm-command-key`), non-exportable;
  decryption happens in hardware via `NCryptDecrypt` (OAEP/SHA-256).
- **Non-Windows or TPM unavailable:** falls back to a software-emulated sealed key
  with a warning logged. CI (Linux) always uses the software path with no extra
  configuration.

### Windows prerequisites (hardware path)

- Visual Studio Build Tools with the **Desktop development with C++** workload
- Windows 10/11 SDK (provides `ncrypt.lib`)
- node-gyp (`npm install -g node-gyp`)

Build the native addon:

```bash
npm run build:native -w @vss/tpm-crypto
```

### Configuration

| Variable       | Default               | Purpose                          |
|----------------|-----------------------|----------------------------------|
| `CIPHER_IMPL`  | `node`                | Set to `tpm` to enable TPM mode  |
| `TPM_KEY_NAME` | `vss-tpm-command-key` | Name of the persisted TPM key    |

> **BIOS/UEFI requirement:** The hardware path requires TPM 2.0 to be **enabled in
> firmware**. If the TPM is disabled, initialization fails with `NTE_DEVICE_NOT_READY`
> and the system falls back to the software device automatically (logged as a warning).

On non-Windows hosts the key is sealed in the **software-emulated TPM** device (no
native build required). The private key is never exported — `exportPrivateKey` throws
and a unit test asserts this invariant.
