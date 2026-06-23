FROM node:20-bookworm-slim AS build
WORKDIR /app
ARG VITE_SERVER_B_HTTP
ARG VITE_SERVER_B_WS
ARG VITE_SERVER_A_WS
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/web-client ./apps/web-client
RUN npm ci
RUN npm run build --workspace @vss/shared && npm run build --workspace @vss/web-client

FROM nginx:1.27-alpine
COPY apps/web-client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web-client/dist /usr/share/nginx/html
EXPOSE 80
