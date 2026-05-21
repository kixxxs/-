FROM node:22-slim
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --omit=dev
COPY server.js ./
COPY server/ ./server/
ENV PORT=3000
ENV DB_PATH=/data/artist_data.db
EXPOSE 3000
CMD ["node", "server.js"]
