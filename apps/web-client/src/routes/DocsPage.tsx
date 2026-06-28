import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { NavBar } from '../components/nav/NavBar';

// Initialize once at module load — calling it per-render is unnecessary and
// causes spurious re-initialization on hot reloads.
mermaid.initialize({ startOnLoad: false });

// Flowchart depicting the distributed system topology.
const DIAGRAM = `flowchart LR
  Cam[Camera-sim RTSP] -->|RTSP 1111| A[Server A]
  A -->|fMP4 over WS 2222| W[Web Client]
  W -->|login + commands WS 3002| B[Server B]
  B -->|control WS 3001 no REST| A
  B <-->|sessions| R[(Redis)]
  A <-->|jti revocation| R`;

// Exported for direct testability of the null-ref guard.
export function runMermaidEffect(el: HTMLDivElement | null): void {
  if (!el) return;
  mermaid.render('vss-diagram', DIAGRAM).then(({ svg }) => {
    if (el) el.innerHTML = svg;
  }).catch((err: unknown) => {
    console.error('[DocsPage] mermaid.render failed:', err);
  });
}

const MermaidDiagram = (): JSX.Element => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    runMermaidEffect(ref.current);
  }, []);
  return <div ref={ref} data-testid="architecture-diagram" />;
};

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
      <MermaidDiagram />
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
          Start each workspace in a separate terminal:
          <pre><code>
{`npm run start --workspace @vss/camera-sim
npm run start --workspace @vss/server-a
npm run start --workspace @vss/server-b
npm run dev   --workspace @vss/web-client`}
          </code></pre>
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
      </dl>
    </section>

    <section className="docs__section">
      <h2>Run with Docker (Windows)</h2>
      <ol>
        <li>
          Install Docker Desktop with the WSL2 backend enabled (Settings &rarr; General &rarr;
          &ldquo;Use the WSL 2 based engine&rdquo;).
        </li>
        <li>
          Start the full stack with one command:
          <pre><code>.\scripts\docker-up.ps1</code></pre>
        </li>
        <li>
          Open the web client at <code>http://127.0.0.1:8080</code>.
        </li>
      </ol>
    </section>

    <section className="docs__section">
      <h2>Limitations</h2>
      <ul>
        <li>
          Linux containers run on Windows 11 via Docker Desktop + WSL2; native Windows containers
          are intentionally not used (ffmpeg, Redis, and nginx lack reliable Windows-container images).
        </li>
        <li>Bonus D TPM uses software emulation in the container.</li>
        <li>A&harr;B commands are rejected (not queued) while the link is down.</li>
      </ul>
      </section>
    </main>
  </div>
);
