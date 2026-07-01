FROM node:20-slim

WORKDIR /app

# fontconfig ayuda al renderizado de fuentes de la credencial
RUN apt-get update \
 && apt-get install -y --no-install-recommends fontconfig ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "src/main.js"]
