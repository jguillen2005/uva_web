FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY shared ./shared
COPY src ./src
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:${PORT:-4000}/health || exit 1
# SERVICE se define por contenedor en docker-compose (reportes, catalogos, solicitudes, ...)
CMD ["sh", "-c", "node src/${SERVICE}.js"]
