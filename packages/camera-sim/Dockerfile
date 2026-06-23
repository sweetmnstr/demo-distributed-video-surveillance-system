FROM node:20-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json jest.config.base.js ./
COPY packages/shared ./packages/shared
COPY packages/camera-sim ./packages/camera-sim
RUN npm ci
RUN npm run build --workspace @vss/shared && npm run build --workspace @vss/camera-sim
CMD ["node", "packages/camera-sim/dist/main.js"]
