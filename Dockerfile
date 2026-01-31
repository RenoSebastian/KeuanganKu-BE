# --- Stage 1: Build ---
FROM node:20-slim AS builder
WORKDIR /app

# Salin file definisi package
COPY package*.json ./
COPY prisma ./prisma/

# Install semua dependencies (termasuk devDependencies untuk kompilasi)
RUN npm install

# Salin seluruh kode sumber
COPY . .

# Generate Prisma Client & Build project NestJS
RUN npx prisma generate
RUN npm run build

# --- Stage 2: Production ---
FROM node:20-slim
WORKDIR /app

# Install dependencies sistem untuk Puppeteer
RUN apt-get update && apt-get install -y \
    wget gnupg ca-certificates procps libxss1 \
    libgbm-dev libnss3 libatk-bridge2.0-0 libgtk-3-0 \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

# HANYA salin file yang dibutuhkan untuk runtime
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

# Pastikan menggunakan start:prod sesuai scripts di package.json
CMD ["npm", "run", "start:prod"]
