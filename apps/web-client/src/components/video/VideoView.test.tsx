// Unit tests for components/video/VideoView.tsx
// Mocks: ../../api/video-player — attachVideo returns a stop spy.

jest.mock('../../api/video-player', () => ({
  attachVideo: jest.fn(),
}));

import { render, act } from '@testing-library/react';
import { attachVideo } from '../../api/video-player';
import { VideoView, runAttachEffect } from './VideoView';

afterEach(() => jest.resetAllMocks());

describe('runAttachEffect', () => {
  it('returns undefined and does not call attachVideo when el is null', () => {
    const result = runAttachEffect(null, 'any-token');

    expect(result).toBeUndefined();
    expect(attachVideo).not.toHaveBeenCalled();
  });

  it('calls attachVideo and returns its cleanup when el is an HTMLVideoElement', () => {
    const stop = jest.fn();
    (attachVideo as jest.Mock).mockReturnValue(stop);
    const el = document.createElement('video');

    const result = runAttachEffect(el, 'jwt-abc');

    expect(attachVideo).toHaveBeenCalledWith(el, 'jwt-abc');
    expect(result).toBe(stop);
  });
});

describe('VideoView', () => {
  it('calls attachVideo on mount with the video element and token', () => {
    const stop = jest.fn();
    (attachVideo as jest.Mock).mockReturnValue(stop);

    render(<VideoView token="jwt-abc" />);

    expect(attachVideo).toHaveBeenCalledTimes(1);
    // First argument must be an HTMLVideoElement.
    const [videoEl, token] = (attachVideo as jest.Mock).mock.calls[0] as [HTMLVideoElement, string];
    expect(videoEl).toBeInstanceOf(HTMLVideoElement);
    expect(token).toBe('jwt-abc');
  });

  it('calls the stop function returned by attachVideo on unmount', () => {
    const stop = jest.fn();
    (attachVideo as jest.Mock).mockReturnValue(stop);

    const { unmount } = render(<VideoView token="jwt-abc" />);

    expect(stop).not.toHaveBeenCalled();
    act(() => unmount());
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('re-attaches video when the token prop changes', () => {
    const stop1 = jest.fn();
    const stop2 = jest.fn();
    (attachVideo as jest.Mock)
      .mockReturnValueOnce(stop1)
      .mockReturnValueOnce(stop2);

    const { rerender } = render(<VideoView token="token-1" />);
    expect(attachVideo).toHaveBeenCalledTimes(1);

    act(() => rerender(<VideoView token="token-2" />));

    // Old stop called, new attachVideo called.
    expect(stop1).toHaveBeenCalledTimes(1);
    expect(attachVideo).toHaveBeenCalledTimes(2);
    const [, secondToken] = (attachVideo as jest.Mock).mock.calls[1] as [HTMLVideoElement, string];
    expect(secondToken).toBe('token-2');
  });
});
