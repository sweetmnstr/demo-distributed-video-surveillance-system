FROM node:20-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json jest.config.base.js ./
COPY packages/shared ./packages/shared
COPY packages/server-b ./packages/server-b
RUN npm ci
RUN npm run build --workspace @vss/shared && npm run build --workspace @vss/server-b
CMD ["node", "packages/server-b/dist/main.js"]
