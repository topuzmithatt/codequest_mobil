FROM node:20-bullseye

# Gerekli dilleri kur (Python, Java)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python-is-python3 \
    default-jdk \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Çalışma dizini oluştur
WORKDIR /app

# Paket dosyalarını ve prisma şemasını kopyala
COPY package*.json ./
COPY prisma ./prisma

# Bağımlılıkları yükle
RUN npm install --omit=dev

# Tüm dosyaları kopyala
COPY . .

# WebSocket sunucusunun portunu dışarı aç
EXPOSE 3001

# Başlatma komutu
CMD ["node", "exec-server.js"]
