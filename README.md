# ⚡ AirMesh — Yüksek Hızlı Yerel Dosya & Medya Ekosistemi

> **Sıfır İnternet Kotası • Sıfır İstemci Kurulumu • Çapraz Platform (Android, iOS, PC, Mac) • 50–90+ MB/s Hız**

AirMesh, yerel ağ (Wi-Fi / Hotspot) üzerinden cihazlar arasında kablo veya internet bağlantısına ihtiyaç duymadan ultra hızlı dosya aktarımı, anlık video/ses akışı, çevrimdışı pano ve ortak müzik dinleme imkânı sunan modern bir ekosistemdir.

---

## 🎯 Temel Özellikler

- **Sıfır Kurulum (Zero-Install):** Alıcı cihazların (telefon, tablet veya bilgisayar) herhangi bir uygulama yüklemesine gerek yoktur. Yalnızca tarayıcı ile bağlanırlar.
- **Kernel-Level Zero-Copy Transfer:** Go çekirdeği sayesinde dosyalar RAM'de biriktirilmeden doğrudan diskten ağ adaptörüne (`io.Copy` / `sendfile`) pompalanır.
- **HTTP Range Desteği:** 
  - Yarıda kalan indirmeler baştan başlamak zorunda kalmaz, kaldığı bayttan devam eder.
  - 4K ve büyük videolar indirilmeden önce tarayıcıda takılmadan ileri-geri sarılarak canlı izlenebilir.
- **Doğrudan Diske Streaming Upload:** Alıcılar dosya yüklediğinde, bellek taşmasını önlemek amacıyla veriler 4 MB tamponlarla doğrudan diske yazılır.
- **WebSocket Gerçek Zamanlı Hub:**
  - Anlık oda ve cihaz keşfi (bağlı cihaz sayısı göstergesi).
  - Çevrimdışı Pano & Sohbet (şifre, not, bağlantı paylaşımı).
  - Sync Play (aynı anda odadaki tüm telefonlarda senkronize müzik çalma).
- **Captive Portal DNS (Port 53):** Apple (`captive.apple.com`) ve Android (`connectivitycheck.gstatic.com`) kontrol sorgularını otomatik yakalayıp istemciyi doğrudan web portalına yönlendirir.

---

## 🚀 Hızlı Başlangıç

### 1. Çalıştırma

Klasör içerisindeki `start.bat` dosyasına çift tıklayabilir veya PowerShell üzerinden çalıştırabilirsiniz:

```powershell
.\start.bat
```

Veya doğrudan Go komutu ile:

```powershell
go run main.go -dir ./shared -port 8080
```

### 2. Parametreler

- `-dir <yol>` : Paylaşılacak klasörü belirler (Varsayılan: `./shared`).
- `-port <sayı>` : HTTP sunucu portu (Varsayılan: `8080`).
- `-dns <true/false>` : Captive Portal DNS sunucusunu etkinleştirir/kapatır (Varsayılan: `true`).

---

## 📱 Alıcılar Nasıl Bağlanır?

1. Alıcı cihazı (iPhone, Android, PC vb.) host cihazın bağlı olduğu **aynı Wi-Fi** ağına veya host cihazın açtığı **Mobil Erişim Noktasına (Hotspot)** bağlayın.
2. Terminal ekranında listelenen IP adresini (örn: `http://192.168.1.50:8080`) alıcı cihazın tarayıcısına yazın (veya Captive Portal bildirimine dokunun).
3. Açılan web arayüzünden dosyaları anında indirin, videoları izleyin veya kendi dosyalarınızı yükleyin!

---

## 🛠️ Mimari & Teknoloji Yığını

- **Backend:** Go (Golang) — Hafif, bağımsız tek binary, goroutine eşzamanlılığı, yerleşik DNS ve WebSocket motoru.
- **Frontend:** Vanilla HTML5 + CSS + JavaScript — Go binary'sinin içine `//go:embed` ile paketlenmiş, harici internet/CDN bağımlılığı olmayan modern responsive PWA arayüzü.
- **Geliştirici:** ahmetselmancloud
