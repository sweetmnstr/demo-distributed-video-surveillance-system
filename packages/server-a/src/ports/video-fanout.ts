// Pushes fMP4 fragments to connected video WebSocket clients while delivery is on.
export interface VideoFanout {
  broadcast(fragment: Buffer): void;
  // Caches the fMP4 initialization segment (ftyp+moov) and replays it to current
  // and future clients. MSE cannot decode media fragments without it, so every
  // viewer must receive it once before any fragment.
  setInitSegment(init: Buffer): void;
  clientCount(): number;
}
