import { AppendQueue, emptyQueue, enqueue, onUpdateEnd } from '../lib/mse-buffer';

const WS_URL = import.meta.env.VITE_SERVER_A_WS ?? 'ws://127.0.0.1:2222';
const MIME = 'video/mp4; codecs="avc1.42E01E"';

// Connects the fMP4 video WS to a MediaSource/SourceBuffer using the pure
// append queue to serialize fragments. Returns a stop() to tear everything down.
export const attachVideo = (video: HTMLVideoElement, token: string): () => void => {
  const mediaSource = new MediaSource();
  video.src = URL.createObjectURL(mediaSource);
  let queue: AppendQueue = emptyQueue();
  let buffer: SourceBuffer | null = null;
  const socket = new WebSocket(WS_URL);
  socket.binaryType = 'arraybuffer';

  const pump = (chunk: Uint8Array<ArrayBuffer>): void => {
    if (!buffer) return;
    const step = enqueue(queue, chunk);
    queue = step.state;
    // chunk is Uint8Array<ArrayBuffer> so step.append is safe for appendBuffer
    if (step.append) buffer.appendBuffer(step.append as Uint8Array<ArrayBuffer>);
  };

  mediaSource.addEventListener('sourceopen', () => {
    buffer = mediaSource.addSourceBuffer(MIME);
    buffer.addEventListener('updateend', () => {
      const step = onUpdateEnd(queue);
      queue = step.state;
      if (step.append && buffer) buffer.appendBuffer(step.append as Uint8Array<ArrayBuffer>);
    });
  });

  socket.addEventListener('open', () => socket.send(token));
  socket.addEventListener('message', (event) => pump(new Uint8Array(event.data as ArrayBuffer)));

  return () => {
    socket.close();
    if (mediaSource.readyState === 'open') mediaSource.endOfStream();
    URL.revokeObjectURL(video.src);
    video.src = '';
  };
};
