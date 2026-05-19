# CodeQuest Canlıya Alma (Deployment) Rehberi

Bu rehber, CodeQuest projesinin baştan sona internet üzerinde tüm fonksiyonlarıyla (Python, Java, Javascript, SQL sandbox çalıştırma, yapay zeka entegrasyonu ve web arayüzü) nasıl canlıya alınacağını detaylıca açıklamaktadır.

Projenin yapısı gereği, içerisinde hem **Next.js (Arayüz ve API)** hem de kod derleme işlemlerini gerçek zamanlı (WebSocket) yapan **Execution Server (exec-server.js)** barındırmaktadır.

Bu ikili yapının ve farklı programlama dillerinin kusursuz çalışması için projeyi Docker destekleyen **Railway.app** platformunda 2 ayrı mikro-servis olarak yayınlayacağız.

---

## Ön Hazırlıklar

Bu adımlara başlamadan önce şu hesaplara sahip olduğunuzdan emin olun:
1. [GitHub](https://github.com/) hesabı (Kodları tutmak için).
2. [Railway.app](https://railway.app/) hesabı (Projeyi yayınlamak için).
3. [Supabase](https://supabase.com/) hesabı (Veritabanı için).

---

## Adım 1: Projeyi GitHub'a Yüklemek

Kodlarımızı sunucuya ulaştırmak için önce GitHub deposu (repository) oluşturmalıyız.

1. GitHub hesabınıza giriş yapın.
2. Sağ üst köşedeki **"+"** ikonuna tıklayıp **"New repository"** seçeneğini seçin.
3. Deponuza bir isim verin (Örn: `codequest`).
4. Ekstra hiçbir seçeneği (README vs.) işaretlemeden en alttaki **"Create repository"** butonuna basın.
5. Bilgisayarınızda (VS Code) projenizin klasöründe yeni bir terminal açın ve sırasıyla şu komutları çalıştırın:

```bash
git init
git add .
git commit -m "İlk yükleme ve production ayarlari eklendi"
git branch -M main
git remote add origin https://github.com/topuzmithatt/codequest.git
git push -u origin main
```

---

## Adım 2: Çevresel Değişkenleri (Environment Variables) Hazırlamak

Projemizin çalışması için `.env` dosyasındaki anahtarlara ihtiyacımız var. Yerel bilgisayarınızdaki `.env` dosyasını açın ve şu verileri bir kenara not edin:
- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GROQ_API_KEY` (veya `OPENAI_API_KEY`)

*Not: Eğer yerelde kullandığınız Supabase URL'si sadece size (localhost) aitse, Supabase üzerinden yeni bir proje oluşturup canlı veritabanı linklerini kullanmanız gerekir.*

---

## Adım 3: Render.com Üzerinde Kod Çalıştırma Motorunu (Backend) Kurmak

Sistemin "Sandbox" yani kullanıcıların yazdığı kodları derleme işini yapan arka plan sunucusunu kuracağız. Bu sunucu Docker kullandığı için Render en ideal platformdur.

1. [Render.com](https://render.com/)'a girip GitHub hesabınızla kayıt olun.
2. Sağ üstten **"New"** -> **"Web Service"** seçeneğine tıklayın.
3. **"Build and deploy from a Git repository"** seçeneğini seçin.
4. GitHub'a yüklediğiniz **`codequest`** projenizi bağlayın.
5. Ayarlar ekranında şunları doldurun:
   - **Name:** `codequest-engine` (veya istediğiniz bir isim)
   - **Region:** Frankfurt (veya size en yakın olanı)
   - **Branch:** `main`
   - **Runtime:** `Docker` (Sistem projedeki Dockerfile'ı otomatik algılar)
   - **Instance Type:** `Free` (Ücretsiz paket) seçin.
6. Alt kısımdan **"Advanced"** bölümünü açıp **"Add Environment Variable"** diyerek `.env` dosyanızdaki `GROQ_API_KEY`, `DATABASE_URL` gibi bilgileri ekleyin. (Şimdilik Socket URL eklemeyin).
7. Eğer **Start Command** sorarsa: `node exec-server.js` yazın. (Sormazsa boş bırakın).
8. **"Create Web Service"** butonuna basın.
9. Render kurulumu (Build) yapacak ve bu yaklaşık 3-5 dakika sürecektir. İşlem bitince sayfanın sol üstünde `https://codequest-xxxx.onrender.com` şeklinde bir URL belirecek. **Bu URL'yi kopyalayın.**

---

## Adım 4: Vercel Üzerinde Web Arayüzünü (Next.js) Kurmak

Şimdi kullanıcıların göreceği asıl siteyi oluşturacağız. Next.js'in yaratıcısı olan Vercel, arayüz için tamamen ücretsiz ve en hızlı seçenektir.

1. [Vercel.com](https://vercel.com/)'a gidip GitHub hesabınızla giriş yapın.
2. **"Add New"** -> **"Project"** butonuna tıklayın.
3. Kendi **`codequest`** deponuzu bulun ve **"Import"** butonuna basın.
4. Çıkan ekranda **"Environment Variables"** bölümünü genişletin.
5. Supabase bilgileri (`DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, vb.) ve Yapay Zeka API şifrenizi buraya ekleyin.
6. **ÖNEMLİ:** Buraya ekstra olarak yeni bir değişken ekleyin:
   - **Key:** `NEXT_PUBLIC_SOCKET_URL`
   - **Value:** Bir önceki adımda Render'dan kopyaladığınız Backend URL'sini yapıştırın. (Örn: `https://codequest-xxxx.onrender.com`) - *Sonunda eğik çizgi (/) olmamasına dikkat edin.*
7. **"Deploy"** butonuna basın.

---

## Adım 5: Sistem Testi ve Son Kontroller

Vercel saniyeler içerisinde projenizi derleyip size bir canlı bağlantı (Örn: `codequest.vercel.app`) sunacaktır.

1. Vercel'in verdiği linke tıklayarak siteye girin.
2. Giriş yapın veya yeni kayıt oluşturun.
3. Öğrenme rotasından herhangi bir göreve girin.
4. "Çalıştır" butonuna bastığınızda, sağ taraftaki panelde "Çalışıyor..." ibaresini ve ardından sorunsuz şekilde konsol çıktısını (Python, Java fark etmeksizin) görüyorsanız kurulum **tamamen başarılı** demektir!

### Karşılaşılabilecek Sorunlar ve Çözümleri:
* **"Terminal çalışmıyor veya hiç çıktı vermiyor":** Render'ın ücretsiz sunucuları 15 dakika kullanılmadığında uyku moduna geçer. Siteye ilk girdiğinizde sunucunun uyanması 30-50 saniye sürebilir. İlk çalıştırma denemeniz başarısız olursa 1 dakika bekleyip tekrar deneyin.
* **"Görevler yüklenmiyor":** Veritabanı URL'lerinizin Vercel tarafına doğru girilip girilmediğini kontrol edin.
* **Render Build Hatası:** Eğer Render kurulum aşamasında hata verirse, ayarlardan `Start Command` kısmını `node exec-server.js` olarak güncellediğinizden emin olun.
