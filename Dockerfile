# --- Build Stage ---
FROM node:20-slim AS builder
WORKDIR /app

# Install dependencies untuk build
RUN apt-get update && apt-get install -y python3 make g++ 

COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

# --- Production Stage ---
FROM node:20-slim
WORKDIR /app

# Install dependency Puppeteer (Chrome Headless) agar PDF generator jalan
RUN apt-get update && apt-get install -y \
    wget gnupg ca-certificates procps libxss1 \
    libgbm-dev libnss3 libatk-bridge2.0-0 libgtk-3-0 \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["npm", "run", "start:prod"]
