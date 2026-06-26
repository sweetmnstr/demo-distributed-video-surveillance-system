import { useEffect, useRef } from 'react';
import { attachVideo } from '../../api/video-player';

// Runs the attach effect for a given video element (or no-ops when null).
// Extracted so the null guard is directly testable without mocking React internals.
export function runAttachEffect(
  el: HTMLVideoElement | null,
  token: string,
): (() => void) | undefined {
  if (!el) return undefined;
  return attachVideo(el, token);
}

export const VideoView = ({ token }: { token: string }): JSX.Element => {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    return runAttachEffect(ref.current, token);
  }, [token]);
  return <video ref={ref} className="video-stream" autoPlay muted playsInline aria-label="Live camera" />;
};
