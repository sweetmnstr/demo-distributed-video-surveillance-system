import { NavBar } from '../components/nav/NavBar';

export const DocsPage = (): JSX.Element => (
  <div className="app">
    <NavBar links={[{ label: 'Live', to: '/' }]} />
    <main className="app-main docs" aria-labelledby="docs-heading">
      <h1 id="docs-heading" className="docs__title">
        Architecture <span className="docs__title-accent">&amp; Docs</span>
      </h1>

      <section className="docs__section">
        <h2>Overview</h2>
        <p>
          Camera-sim publishes RTSP. Server A ingests it to fragmented MP4 and relays it over a
          video WebSocket while independently verifying each viewer&apos;s JWT (RS256) and Redis
          session. Server B authenticates users, authorizes commands (RBAC), forwards them to
          Server A over a dedicated server-to-server WebSocket, and keeps a tamper-evident log.
        </p>
      </section>

      <section className="docs__section">
        <h2>Architecture</h2>
        <figure className="docs__figure" data-testid="architecture-diagram">
          <img
            src="/docs/architecture.png"
            alt="System architecture: camera-sim streams RTSP to Server A, which relays fragmented MP4 over WebSocket to the web client; Server B handles auth and forwards commands to Server A; Redis holds sessions and JTI revocation."
          />
          <figcaption>Distributed surveillance system topology.</figcaption>
        </figure>
      </section>

      <section className="docs__section">
        <h2>Technologies</h2>
        <ul>
          <li>MSE + fragmented MP4 over WebSocket — ~1s latency, clean STOP_VIDEO.</li>
          <li>WebSocket A&harr;B (no REST) — reconnect + heartbeat.</li>
          <li>JWT RS256 + Redis revocation — independent access control on Server A.</li>
          <li>HMAC-chained append-only command log — tamper evidence.</li>
        </ul>
      </section>

      <section className="docs__section">
        <h2>Setup Instructions</h2>
        <ol>
          <li>
            Install Node.js 20+ and Redis (local install or WSL2{' '}
            <code>apt-get install redis-server</code>).
          </li>
          <li>
            Install dependencies:
            <pre><code>npm install</code></pre>
          </li>
          <li>
            Generate the RS256 key pair:
            <pre><code>node scripts/setup-keys.mjs</code></pre>
            This creates <code>config/keys/private.pem</code> and{' '}
            <code>config/keys/public.pem</code>.
          </li>
          <li>
            Seed demo users:
            <pre><code>npm run seed:users --workspace @vss/server-b</code></pre>
            Creates <code>config/users.json</code> with demo accounts.
          </li>
          <li>
            Start the whole stack from the repository root:
            <pre><code>npm run start</code></pre>
            This builds every workspace and launches Server A, the camera simulator,
            Server B, and the web client together via <code>concurrently</code>.
          </li>
          <li>
            Open <code>http://127.0.0.1:5173</code> in your browser and log in with a
            demo account, e.g. <strong>operator</strong> / <strong>operator123</strong>.
          </li>
        </ol>
      </section>

      <section className="docs__section">
        <h2>Architectural Decisions</h2>
        <dl>
          <dt>Streaming technology: MSE + fMP4 over WebSocket</dt>
          <dd>
            Chosen for ~1 s latency, native browser support without plugins, and a clean
            STOP_VIDEO boundary. HLS was ruled out for latency; WebRTC for complexity.
          </dd>

          <dt>Inter-server transport: WebSocket (no REST)</dt>
          <dd>
            A persistent WS between Server B and Server A carries control commands. The
            channel auto-reconnects with exponential back-off and sends heartbeats to detect
            silent failures. REST was explicitly excluded by the assignment.
          </dd>

          <dt>Access control: JWT RS256 + Redis revocation list</dt>
          <dd>
            Server A validates tokens independently (no round-trip to Server B). Revoked
            JTIs are stored in Redis so both servers share the revocation state without
            tight coupling.
          </dd>

          <dt>Audit log: HMAC-chained append-only file</dt>
          <dd>
            Each command entry is linked to the previous entry&apos;s hash, making retrospective
            tampering detectable without a database.
          </dd>

          <dt>Monorepo: npm workspaces</dt>
          <dd>
            Single lockfile, shared <code>@vss/shared</code> package for protocol types,
            JWT helpers, and logging — eliminates copy-paste drift between servers.
          </dd>

          <dt>Cipher backend: <code>node</code> / <code>native</code> / <code>tpm</code></dt>
          <dd>
            Selected via <code>CIPHER_IMPL</code>. <strong>node</strong>: pure Node.js
            RSA-OAEP (key files on disk). <strong>native</strong>: C++ N-API addon via
            OpenSSL. <strong>tpm</strong>: on Windows, the real TPM 2.0 via the CNG
            Platform Crypto Provider (<code>MS_PLATFORM_CRYPTO_PROVIDER</code>) — RSA-2048
            key persisted inside the TPM, non-exportable, decryption in hardware
            (<code>NCryptDecrypt</code>, OAEP/SHA-256); on non-Windows or when the TPM
            is unavailable, falls back to a software-emulated sealed key automatically.
            The key name is configurable via <code>TPM_KEY_NAME</code> (default{' '}
            <code>vss-tpm-command-key</code>).
          </dd>
        </dl>
      </section>

      <section className="docs__section">
        <h2>Limitations</h2>
        <ul>
          <li>
            The <code>tpm</code> cipher backend uses the real Windows TPM 2.0 (CNG Platform
            Crypto Provider, sealed non-exportable key) on Windows; it falls back to a
            software-emulated sealed key on non-Windows or when the TPM addon is unavailable.
          </li>
          <li>A&harr;B commands are rejected (not queued) while the link is down.</li>
        </ul>
      </section>
    </main>
  </div>
);
