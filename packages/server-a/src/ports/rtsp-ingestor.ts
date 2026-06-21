// Long-running ffmpeg RTSP->fMP4 ingest. Emits fragments via the callback.
export interface RtspIngestor {
  start(onFragment: (chunk: Buffer) => void): void;
  stop(): void;
}
