# One image runs every service (the command differs per container in docker-compose.yml).
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY shared ./shared
COPY gateway ./gateway
COPY services ./services
COPY scripts ./scripts
COPY --from=frontend /app/frontend/dist ./frontend/dist
RUN mkdir -p uploads/encrypted && chown -R node:node /app
USER node
EXPOSE 4000
CMD ["node", "gateway/server.js"]
