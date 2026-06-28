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

The web client persists the JWT in `localStorage` so a reload keeps the session.
This trades the previous in-memory-only hardening (unreadable by XSS) for
persistence, which is acceptable for this prototype; an expired or malformed token
is discarded on load and the `jti` remains revocable server-side via LOGOUT.

## Tamper-evident log
Append-only `commands.log` with an HMAC-SHA256 chain (`prevHash` links entries).
A middle entry cannot be altered without recomputing the tail, and the secret is
unknown to an attacker.

## Clean Architecture & testing
Pure use-cases driven through ports, unit-tested to 100% with mocked ports; IO
adapters verified by integration tests (in-process `ws`, `ffmpeg-static`) and
Playwright E2E against the compose stack.

## Camera overlay font — bundled DejaVuSans
The camera simulator overlays a timestamp on the RTSP stream via ffmpeg's
`drawtext` filter. To keep the image self-contained and avoid relying on the
host OS, **DejaVuSans.ttf v2.37** is shipped at
`packages/camera-sim/assets/DejaVuSans.ttf`. The font is released under the
permissive Bitstream Vera / Arev license (free redistribution permitted); see
`packages/camera-sim/assets/LICENSE-DejaVuSans.txt`.

`resolveFontPath()` in `font.ts` uses precedence **env override → bundled font →
Windows Arial fallback**. Now that the bundled font is present, the Arial
fallback is never reached on a clean checkout.

Source: https://sourceforge.net/projects/dejavu/files/dejavu/2.37/dejavu-fonts-ttf-2.37.tar.bz2/download

## Limitations
- A↔B commands are rejected (not queued) while the inter-server channel is down.

## Bonus C — native addon
RSA-OAEP runs in C++ via `Napi::AsyncWorker` (off the event loop) using Node's
bundled OpenSSL headers — no external OpenSSL install. The JS wrapper is unit
-tested to 100% with a mock addon; the compiled binary is verified by a round
-trip integration test. C++-level unit tests were left optional given the small
surface and the integration coverage.

## Bonus D — TPM

### TpmDevice port and software device
A `TpmDevice` port models a sealed key: decryption runs inside the device and the
private key is non-exportable (enforced and unit-tested). Non-Windows hosts use
a software-emulated device behind the same `CommandCipher` port.

### Native Windows TPM (PCP/CNG)
The `tpm` cipher backend uses a real TPM 2.0 device on Windows via the Windows CNG
Platform Crypto Provider (`MS_PLATFORM_CRYPTO_PROVIDER`). An RSA-2048 private key
is created and persisted inside the TPM under the name configured by `TPM_KEY_NAME`
(default `vss-tpm-command-key`). The key is opened if it already exists, or created
and persisted if absent — it is never auto-deleted. The key's export policy is
cleared (non-exportable); `exportPrivateKey()` throws at the TypeScript layer as
well. Decryption (OAEP/SHA-256) is performed in hardware via `NCryptDecrypt`.

**Implementation split.** A thin native addon (`packages/tpm-crypto/src/addon-tpm.cc`,
built via node-gyp / `binding.gyp`, links `ncrypt.lib`) returns raw modulus/exponent
bytes and handles `NCryptDecrypt`. All non-trivial logic — RSA modulus/exponent →
SPKI PEM encoding and device wiring — lives in TypeScript and is 100% unit-tested
with a mocked addon. The `.cc` source is excluded from coverage and verified by a
Windows-gated round-trip integration test (`tpm-round-trip.int.test.ts`) that
auto-skips on non-Windows or when the binary is absent.

**Platform selection.** `CIPHER_IMPL=tpm` automatically selects the real Windows
device on `win32`. On non-Windows, or if the TPM addon is unavailable at runtime,
the system logs a warning and falls back to the software-emulated sealed key
transparently. CI and non-Windows hosts always run the software path without any configuration
change.

**Hardware prerequisite.** The hardware round-trip requires TPM 2.0 to be enabled
in the system BIOS/UEFI. On a machine where the TPM is disabled, initialization
fails with `NTE_DEVICE_NOT_READY` and the fallback to the software device is
triggered automatically (with a warning logged). Enabling TPM 2.0 in firmware is
therefore a prerequisite for the hardware path to be exercised.

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
