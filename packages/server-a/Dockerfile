FROM node:20-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json jest.config.base.js ./
COPY packages/shared ./packages/shared
COPY packages/server-a ./packages/server-a
RUN npm ci
RUN npm run build --workspace @vss/shared && npm run build --workspace @vss/server-a
CMD ["node", "packages/server-a/dist/main.js"]
