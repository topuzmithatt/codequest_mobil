# CodeQuest

CodeQuest, başlangıç seviyesindeki yazılımcılar için tasarlanmış, oyunlaştırma tabanlı bir kod öğrenme platformudur. Kullanıcılar çeşitli programlama dillerinde (Python, JavaScript, Java, C++) pratik yapabilir, kendi projelerini oluşturabilir ve diğer kullanıcılarla etkileşim kurabilir.

## Özellikler

- **Kod Öğrenme:** Python, JavaScript, Java, C++ dillerinde interaktif dersler ve alıştırmalar.
- **Sandbox:** Tarayıcı tabanlı kod editörü ve terminal ile serbest kod yazma deneyimi.
- **Portfolyo:** Kullanıcıların kodlarını sergileyebileceği kişisel portfolyo sayfaları.
- **Profil Sistemi:** Kullanıcı profilleri, başarı rozetleri ve istatistikler.
- **Oyunlaştırma:** Görev tamamlama, seviye atlama ve sıralama sistemleri.

## Teknolojiler

- **Frontend:** Next.js 14 (App Router), React 18, Tailwind CSS.
- **Backend:** Next.js API Routes, server actions.
- **Veritabanı:** Prisma ile SQLite (gelistirme asamasinda).
- **Kimlik Doğrulama:** NextAuth.js.
- **Ek Özellikler:** CodeMirror 6 (kod editörü), Terminal组件, Kullanıcı rozetleri.

## Kurulum

1. Repoyu klonlayın:
   ```bash
   git clone https://github.com/halil-tprk/codequest-app
   cd codequest-app
   ```

2. Gerekli paketleri kurun:
   ```bash
   npm install
   ```

3. Ortam değişkenlerini yapılandırın:
   ```bash
   cp .env.example .env
   # .env dosyasindaki degiskenleri duzenleyin
   ```

4. Veritabanı şemasını oluşturun:
   ```bash
   npx prisma migrate dev
   npx prisma db push
   ```

5. Uygulamayı başlatın:
   ```bash
   npm run dev
   ```

## Kullanım

- **Geliştirme Sunucusu:** http://localhost:3000
- **Sandbox:** http://localhost:3000/sandbox
- **Örnek Kullanıcı:**
  - E-posta: [EMAIL_ADDRESS]`
  - Şifre: password123
