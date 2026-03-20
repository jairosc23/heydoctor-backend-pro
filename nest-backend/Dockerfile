# Build stage - TypeScript compiled INSIDE container
FROM node:20-alpine AS builder

WORKDIR /app

ENV npm_config_legacy_peer_deps=true

COPY package*.json ./
RUN npm install

COPY . .

RUN rm -rf dist
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV npm_config_legacy_peer_deps=true

COPY package*.json .npmrc* ./
RUN npm install --omit=dev --ignore-scripts

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main.js"]
