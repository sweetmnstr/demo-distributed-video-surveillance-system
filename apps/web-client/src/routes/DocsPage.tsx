export const DocsPage = (): JSX.Element => (
  <main aria-labelledby="docs-heading">
    <h1 id="docs-heading">Architecture &amp; Docs</h1>
    <section>
      <h2>Overview</h2>
      <p>
        Camera-sim publishes RTSP. Server A ingests it to fragmented MP4 and relays it over a
        video WebSocket while independently verifying each viewer&apos;s JWT (RS256) and Redis
        session. Server B authenticates users, authorizes commands (RBAC), forwards them to
        Server A over a dedicated server-to-server WebSocket, and keeps a tamper-evident log.
      </p>
    </section>
    <section>
      <h2>Technologies</h2>
      <ul>
        <li>MSE + fragmented MP4 over WebSocket — ~1s latency, clean STOP_VIDEO.</li>
        <li>WebSocket A&harr;B (no REST) — reconnect + heartbeat.</li>
        <li>JWT RS256 + Redis revocation — independent access control on Server A.</li>
        <li>HMAC-chained append-only command log — tamper evidence.</li>
      </ul>
    </section>
    <section>
      <h2>Limitations</h2>
      <ul>
        <li>Windows containers are not used; Linux compose for dev/orchestration.</li>
        <li>Bonus D TPM uses software emulation in the container.</li>
        <li>A&harr;B commands are rejected (not queued) while the link is down.</li>
      </ul>
    </section>
  </main>
);
