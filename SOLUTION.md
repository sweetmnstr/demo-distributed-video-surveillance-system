# SOLUTION — Architectural Decisions

## Streaming (Server A → browser)
MSE + fragmented MP4 over WebSocket. ~1s latency; STOP_VIDEO stops forwarding
fragments while ffmpeg keeps running; single auth point on WS open.

**RTSP topology.** The camera simulator is the RTSP **client** and pushes its
stream; Server A is the RTSP **listener** (`-rtsp_flags listen` on the ffmpeg
input). ffmpeg's RTSP *demuxer* reliably accepts an incoming connection in listen
mode, whereas its *muxer* does not open a listening socket — so the listener role
must live on Server A. Either process can start first: the camera supervisor and
Server A's ingestor both reconnect with backoff.

**Init-segment replay.** ffmpeg emits the fMP4 initialization segment (ftyp+moov)
exactly once at stream start, but browsers connect later and would miss it, leaving
MSE unable to decode (black screen). Server A runs the byte stream through a pure
segmenter that caches the init segment and re-emits whole keyframe fragments; every
new viewer receives the cached init segment before any fragment.

## Inter-server channel (A ↔ B)
WebSocket, no REST, initiated by Server A, with capped exponential backoff,
jitter, and heartbeat. While the link is down, commands are **rejected with a
clear error, not queued** — stale video control is worse than an explicit error.

## Access control
JWT RS256: Server B signs with the private key; Server A independently verifies
with the public key and checks Redis that the `jti` is not revoked. This is real
verification, not URL hiding.

## Sessions & revocation
Redis `session:{jti}` with a 1h TTL matching the JWT. LOGOUT deletes the key, so
Server A's next check rejects the video WS.

## Tamper-evident log
Append-only `commands.log` with an HMAC-SHA256 chain (`prevHash` links entries).
A middle entry cannot be altered without recomputing the tail, and the secret is
unknown to an attacker.

## Clean Architecture & testing
Pure use-cases driven through ports, unit-tested to 100% with mocked ports; IO
adapters verified by integration tests (in-process `ws`, `ffmpeg-static`) and
Playwright E2E against the compose stack.

## Limitations
- Windows containers are not used; dev/orchestration runs on Linux containers.
  Native Windows 11 run is documented in the README.
- Bonus D real TPM (Windows PCP/CNG) does not run in a Linux container; container
  delivery uses software emulation behind the `CommandCipher` port.
- A↔B commands are rejected (not queued) while the inter-server channel is down.

## Bonus C — native addon
RSA-OAEP runs in C++ via `Napi::AsyncWorker` (off the event loop) using Node's
bundled OpenSSL headers — no external OpenSSL install. The JS wrapper is unit
-tested to 100% with a mock addon; the compiled binary is verified by a round
-trip integration test. C++-level unit tests were left optional given the small
surface and the integration coverage.

## Bonus D — TPM
A `TpmDevice` port models a sealed key: decryption runs inside the device and the
private key is non-exportable (enforced and unit-tested). The Linux container uses
a software-emulated device; the Windows PCP/CNG hardware path sits behind the same
port and is deferred to a Windows machine. The Windows device is the single
documented exception to 100% coverage on Linux, since it cannot execute there.

## Test coverage policy
All adapters and the web-client UI are tested to 100% coverage. Two categories are
excluded:

1. **Port interfaces (`ports/**`):** Type-only definitions with no executable code;
   coverage would be meaningless.

2. **Composition roots (`main.ts` in packages, `main.tsx` in web-client) and type
   declarations (`vite-env.d.ts`):** These files wire dependencies at the integration
   level and are implicitly tested by the full stack (Playwright E2E and manual
   integration tests). Composition roots themselves have no business logic — they
   bootstrap the application. Testing them in isolation would be redundant.

All business logic, use-cases, and adapters (HTTP endpoints, WebSocket handlers,
RTSP client, ffmpeg wrapper, Redis sessions, file logging) are covered by unit
and integration tests.

## Native addon round-trip test — auto-skip when binary absent
The round-trip integration test (`shared/crypto/src/__tests__/round-trip.int.test.ts`)
uses a `describeIfBuilt` helper that checks for the compiled binary (`build/Release/native_crypto.node`)
at suite startup. If the MSVC toolchain is not installed or the binary was not built,
the test is skipped gracefully with a clear message. The JS wrapper is unit-tested
to 100% with a mock addon; if the binary is present, the integration test confirms
the compiled code works end-to-end. This ensures the suite passes regardless of
toolchain availability.

## Server A video delivery — starts on by default
`Server A` initializes with `delivering: true` in its state. This means video streams
to all authenticated clients immediately on startup. The `START_VIDEO` and `STOP_VIDEO`
commands toggle the `delivering` flag; `STOP_VIDEO` stops forwarding fragments while
`ffmpeg` keeps running. This default-on behavior ensures video is flowing unless
explicitly paused by a command.

## UI command encryption — RSA-OAEP with plaintext fallback
The main screen (`MainScreen` in web-client) calls `createEncryptor()` on component
mount to fetch the server's RSA-2048 public key. All commands sent via the command
console are encrypted with RSA-OAEP before transmission via the `sendEncrypted()`
method. If the public key fetch fails, the UI logs a warning and falls back to
plaintext transmission via `send()` so that video control remains functional. The
server always receives ciphertext or plaintext uniformly, decrypts ciphertext with
the TPM-sealed private key, and processes the command normally.
