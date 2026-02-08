FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src
COPY fly.toml ./

# Crear directorio para datos (se monta volumen en /data)
RUN mkdir -p /data/uploads

EXPOSE 4000

CMD ["node", "src/index.js"]
