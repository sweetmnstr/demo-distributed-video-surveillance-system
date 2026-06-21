// Pushes fMP4 fragments to connected video WebSocket clients while delivery is on.
export interface VideoFanout {
  broadcast(fragment: Buffer): void;
  clientCount(): number;
}
