# --- Stage 1: Build ---
FROM node:20-slim AS builder
WORKDIR /app

# Salin file definisi package dan prisma
COPY package*.json ./
COPY prisma ./prisma/

# Install semua dependencies
RUN npm install

# Salin seluruh kode sumber
COPY . .

# Generate Prisma Client & Build project NestJS
RUN npx prisma generate
RUN npm run build

# --- Stage 2: Production ---
FROM node:20-slim
WORKDIR /app

# 1. Install dependencies sistem yang SANGAT LENGKAP untuk Puppeteer/Chromium
# Tanpa library ini, browser akan gagal startup (Error: libX11 dll)
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    libgbm-dev \
    libnss3 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libasound2 \
    libcups2 \
    libdbus-1-3 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    fonts-liberation \
    --no-install-recommends

# 2. Install Google Chrome Stabil (Mesin utamanya)
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# 3. Environment Variable agar Puppeteer tahu di mana browser berada
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# 4. Salin file yang dibutuhkan untuk runtime
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
# Pastikan assets (gambar logo PDF) ikut terbawa jika ada di src/assets
COPY --from=builder /app/src/assets ./src/assets 

EXPOSE 3000

# Pastikan menggunakan start:prod
CMD ["npm", "run", "start:prod"]
