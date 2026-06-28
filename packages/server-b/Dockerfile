FROM node:20-bookworm-slim
WORKDIR /app

# Install C/C++ toolchain so native-crypto's node-gyp rebuild succeeds during npm ci
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json tsconfig.base.json jest.config.base.js ./
COPY packages/shared ./packages/shared
COPY packages/native-crypto ./packages/native-crypto
COPY packages/tpm-crypto ./packages/tpm-crypto
COPY packages/server-b ./packages/server-b

RUN npm ci

RUN npm run build --workspace @vss/shared && npm run build --workspace @vss/native-crypto && npm run build --workspace @vss/tpm-crypto && npm run build --workspace @vss/server-b

CMD ["node", "packages/server-b/dist/main.js"]
