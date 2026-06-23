import { useEffect, useRef } from 'react';
import { attachVideo } from '../../api/video-player';

export const VideoView = ({ token }: { token: string }): JSX.Element => {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    return attachVideo(ref.current, token);
  }, [token]);
  return <video ref={ref} autoPlay muted playsInline aria-label="Live camera" />;
};
