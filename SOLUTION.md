# SOLUTION — Architectural Decisions

## Streaming (Server A → browser)
MSE + fragmented MP4 over WebSocket. ~1s latency; STOP_VIDEO stops forwarding
fragments while ffmpeg keeps running; single auth point on WS open.

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
