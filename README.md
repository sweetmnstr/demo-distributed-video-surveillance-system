# Distributed Video Surveillance System

A TypeScript/Node.js prototype: an RTSP camera simulator, a video server (Server A),
an auth & management server (Server B), and a React web client. See `SOLUTION.md`
for architectural decisions.

## Demo users

| Login    | Password     | Role     |
|----------|--------------|----------|
| operator | operator123  | operator |
| admin    | admin123     | operator |
| viewer   | viewer123    | viewer   |

`operator` may START/STOP the video; `viewer` may only GET_STATUS.

## Run

1. **Install Node.js 20+** and Redis (local install or WSL2 `apt-get install redis-server`).

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Generate the RS256 key pair:**
   ```bash
   node scripts/setup-keys.mjs
   ```
   Creates `config/keys/private.pem` and `config/keys/public.pem`.

4. **Seed demo users:**
   ```bash
   npm run seed:users --workspace @vss/server-b
   ```
   Creates `config/users.json` with demo accounts.

5. **Start the whole stack from the repository root:**
   ```bash
   npm run start
   ```
   Builds every workspace and launches Server A, the camera simulator, Server B, and
   the web client together via `concurrently`.

6. Open **http://127.0.0.1:5173** and log in with a demo account (e.g. `operator` / `operator123`).

<details>
<summary>Alternative: start services in separate terminals</summary>

Server A owns the RTSP listening socket — start it first; the camera and Server B will
reconnect with backoff if started in any order.

```bash
# Terminal 1 — Server A (RTSP listener :1111, WebSocket :2222)
npm run start --workspace @vss/server-a

# Terminal 2 — Camera simulator (pushes RTSP to 127.0.0.1:1111)
npm run start --workspace @vss/camera-sim

# Terminal 3 — Server B (HTTP :3000, WebSocket :3002)
npm run start --workspace @vss/server-b

# Terminal 4 — Web client (dev server :5173)
npm run dev --workspace @vss/web-client
```

The camera loops `test.mp4` by default. Point it at another file with
`CAMERA_SOURCE=/abs/path/to/video.mp4`.

</details>

## Test

```bash
npm test                              # all unit + integration suites (100% gate)
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
