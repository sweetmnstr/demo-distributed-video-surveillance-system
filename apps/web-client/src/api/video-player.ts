import { AppendQueue, emptyQueue, enqueue, onUpdateEnd } from '../lib/mse-buffer';
import { env } from '../lib/env';

const WS_URL = env.serverAWs;
const MIME = 'video/mp4; codecs="avc1.42E01E"';

// Connects the fMP4 video WS to a MediaSource/SourceBuffer using the pure
// append queue to serialize fragments. Returns a stop() to tear everything down.
export const attachVideo = (video: HTMLVideoElement, token: string): () => void => {
  const mediaSource = new MediaSource();
  video.src = URL.createObjectURL(mediaSource);
  let queue: AppendQueue = emptyQueue();
  let buffer: SourceBuffer | null = null;
  // Fragments arriving before sourceopen (including the moov init box) are held
  // here and flushed once the SourceBuffer is ready, preventing a race condition
  // that would cause MSE to silently drop the initialization segment.
  const preBuffer: Uint8Array<ArrayBuffer>[] = [];
  const socket = new WebSocket(WS_URL);
  socket.binaryType = 'arraybuffer';

  const pump = (chunk: Uint8Array<ArrayBuffer>): void => {
    if (!buffer) {
      preBuffer.push(chunk);
      return;
    }
    const step = enqueue(queue, chunk);
    queue = step.state;
    if (step.append) buffer.appendBuffer(step.append as Uint8Array<ArrayBuffer>);
  };

  mediaSource.addEventListener('sourceopen', () => {
    buffer = mediaSource.addSourceBuffer(MIME);
    buffer.addEventListener('updateend', () => {
      const step = onUpdateEnd(queue);
      queue = step.state;
      if (step.append && buffer) buffer.appendBuffer(step.append as Uint8Array<ArrayBuffer>);
    });
    // Flush fragments buffered before sourceopen fired
    for (const chunk of preBuffer.splice(0)) pump(chunk);
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
