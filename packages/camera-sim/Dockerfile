FROM node:20-bookworm-slim
WORKDIR /app

# ffmpeg-static's Linux build (johnvansickle 7.0.x) ships without harfbuzz, and
# FFmpeg 7.0 requires harfbuzz for the `drawtext` filter used by the timestamp
# overlay. Install Debian's ffmpeg (which includes drawtext) for this purpose.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json tsconfig.base.json jest.config.base.js ./
COPY packages/shared ./packages/shared
COPY packages/camera-sim ./packages/camera-sim
# Default camera source: camera-sim resolves CAMERA_SOURCE to /app/test.mp4 at runtime.
COPY test.mp4 ./test.mp4
RUN npm ci
# Point ffmpeg-static's resolved path at the drawtext-capable system ffmpeg so the
# existing `import ffmpegPath from 'ffmpeg-static'` works without code changes.
RUN ln -sf "$(command -v ffmpeg)" /app/node_modules/ffmpeg-static/ffmpeg
RUN npm run build --workspace @vss/shared && npm run build --workspace @vss/camera-sim
CMD ["node", "packages/camera-sim/dist/main.js"]
