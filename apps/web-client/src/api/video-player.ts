import { AppendQueue, emptyQueue, enqueue, onUpdateEnd } from '../lib/mse-buffer';
import { env } from '../lib/env';

const WS_URL = env.serverAWs;
// Baseline H.264 Level 3.1 (avc1.42C01F): the camera re-encodes the 1280x720
// source to Constrained Baseline, which forces Level 3.1 (3600 macroblocks/frame
// exceeds Level 3.0's 1620 limit). Declaring a lower level here makes MSE reject
// the stream and the video stays black, so the level digits must match the avcC
// the delivered init segment carries.
const MIME = 'video/mp4; codecs="avc1.42C01F"';

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

  // Server A's ingest runs continuously, so each fMP4 fragment carries an
  // ever-increasing baseMediaDecodeTime. A client that joins mid-stream (page
  // reload, or VideoView remounting on START_VIDEO) therefore buffers media far
  // ahead of currentTime=0 and would stay black forever. Snap the playhead into
  // the buffered window whenever it falls behind, which also keeps the view live.
  const seekToLiveEdge = (): void => {
    if (video.buffered.length > 0 && video.currentTime < video.buffered.start(0)) {
      video.currentTime = video.buffered.start(0);
    }
  };

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
      seekToLiveEdge();
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
