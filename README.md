# ⚡ AirMesh — Yüksek Hızlı Yerel Dosya & Medya Paylaşım Ekosistemi
### Ultra-Fast Zero-Install Local File & Media Streaming Ecosystem

[![Go Version](https://img.shields.io/badge/Go-1.22+-00ADD8?style=flat&logo=go)](https://golang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Cross--Platform-blue)](https://github.com/ahmetselmancloud/airmesh)
[![Transfer Speed](https://img.shields.io/badge/Speed-50--90%2B%20MB%2Fs-success)](#)
[![Zero-Install](https://img.shields.io/badge/Client-Zero--Install%20(Web%20Only)-orange)](#)
[![Roadmap](https://img.shields.io/badge/Roadmap-v1.1%20Planned-purple)](ROADMAP.md)

> **Sıfır İnternet Kotası • Sıfır İstemci Kurulumu • Çapraz Platform (Android, iOS, PC, Mac) • Donanım Hızında (50–90+ MB/s) Aktarım**

---

## 🌟 AirMesh Nedir? (About AirMesh)

**AirMesh**, yerel ağ (Wi-Fi veya Mobil Erişim Noktası / Hotspot) üzerinden cihazlar arasında kablo veya internet bağlantısına ihtiyaç duymadan **ultra yüksek hızda** dosya aktarımı, **kesintisiz video/ses akışı**, **klasör hiyerarşisi yönetimi**, **çevrimdışı pano/sohbet** ve **senkronize müzik dinleme** imkânı sunan bağımsız, açık kaynaklı bir yerel ekosistemdir.

Alıcı cihazlara (telefon, tablet, dizüstü bilgisayar) **hiçbir uygulama kurdurmaz**. Cihazlar yalnızca kamerayla QR kodu okutarak odaya katılır ve tarayıcı üzerinden tüm özelliklere anında erişir.

---

## 📐 Sistem Mimarisi (Architecture)

```
+-----------------------------------------------------------------------------------+
|                                HOST CİHAZ (PC / Sunucu)                           |
|  [Wi-Fi Hotspot 5GHz] <---> [Captive DNS (Port 53)] <---> [Ultra-Fast HTTP/WS]   |
+-----------------------------------------------------------------------------------+
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
         [iOS / iPhone]                                  [Android / Diğer PC]
   - Kamera ile QR Okutur                          - QR veya Wi-Fi ile Bağlanır
   - Captive Portal Anında Açılır                  - Otomatik Portal veya Tarayıcı
   - Uygulama YOK, Sıfır Kurulum                   - Uygulama YOK, Sıfır Kurulum
   - İndir / Yükle / Önizle / Sohbet              - İndir / Yükle / Önizle / Sohbet
```

---

## ✨ Öne Çıkan Yetenekler (Key Features)

### 🚀 1. Donanım Seviyesinde Yüksek Performans (Zero-Copy Transfer)
- **Kernel-Level Zero-Copy:** Diskten okunan baytlar RAM'de biriktirilmeden doğrudan ağ soketine (`io.Copy` / `sendfile`) pompalanır. CPU ve bellek tüketimi minimumda tutulur.
- **4 MB Soket Tamponları & `TCP_NODELAY`:** Gecikmeler sıfırlanır, 5 GHz Wi-Fi bağlantılarında 50–90+ MB/s aktarım hızlarına ulaşılır.
- **HTTP Range Desteği (`Accept-Ranges: bytes`):** 4K videolar veya gigabaytlarca boyutundaki filmler indirilmeden önce tarayıcıda takılmadan ileri-geri sarılarak anında izlenebilir; kesilen indirmeler kaldığı yerden devam eder.
- **Doğrudan Diske Streaming Upload:** Alıcılar dosya yüklerken bellek şişmez, 4 MB'lık akış tamponlarıyla doğrudan sunucu diskine yazılır.

### 📁 2. Tam Klasör Hiyerarşisi & Sürükle-Bırak Klasör Yükleme
- **Hiyerarşik Gezinti & Breadcrumbs:** `🏠 Ana Dizin > Klasör > Alt Klasör` şeklinde tıklanabilir ekmek kırıntısı çubuğu ile kolay gezinti.
- **Alt Klasör Oluşturma (`/api/mkdir`):** Web arayüzünden tek tıkla yeni klasörler oluşturabilme.
- **Tüm Klasörü Ağacıyla Yükleme:** `<input webkitdirectory>` ve tarayıcı sürükle-bırak `traverseFileTree` motoru sayesinde iç içe tüm klasör ağacı yapısı bozulmadan doğrudan yüklenir.
- **Canlı ZIP Akışı (`/api/zip`):** Klasörler veya seçilen dosyalar diskte geçici dosya oluşturulmadan, anlık sıkıştırma akışıyla tek tıkla `.zip` olarak indirilir.
- **Sürükle & Bırak ile Taşıma:** Dosyalar fareyle klasörlerin üzerine sürüklenip bırakılarak taşınabilir.

### 🖼️ 3. Görsel Medya Galerisi & Tam Ekran Lightbox
- **Galeri & Liste Görünümü:** Tek tuşla liste veya Instagram tarzı modern görsel grid görünümüne geçiş.
- **Tam Ekran Lightbox:** Resimleri yüksek çözünürlükte, indirmeden tam ekranda inceleme.
- **Hızlı Filtreleme Rozetleri (Filter Chips):** Canlı sayaçlı `Tümü`, `📁 Klasörler`, `🖼️ Resimler`, `🎬 Videolar`, `🎵 Sesler`, `📄 Belgeler` filtreleri.

### 🔒 4. Oda Güvenliği & PIN Koruması
- **4 Haneli PIN Kilit Ekranı:** Host istemediği kişilerin dosyalara erişmesini engelleyebilir.
- **Salt-Okunur (Read-Only) Modu:** Misafirlerin yalnızca dosya indirebilmesini, yükleme yapamamasını sağlar.
- **Dosya Silme Koruması:** Misafirlerin sunucudaki dosyaları veya klasörleri silmesini kısıtlar (Yalnızca Host silebilir).

### 💬 5. Çevrimdışı Pano & Anlık Sohbet (Offline Clipboard)
- İnternet olmadan odadaki tüm telefonlar ve bilgisayarlar arasında şifre, metin, bağlantı ve not paylaşımı.
- Linkify desteği (tıklanabilir URL'ler) ve tek tıkla panoya kopyalama (`📋`).

### 🎵 6. Senkronize Müzik Çalar (Sync Play)
- Host üzerinde seçilen bir ses dosyasını WebSocket zaman damgası senkronizasyonuyla odadaki tüm cihazlarda milisaniyelik gecikmeyle aynı anda hoparlör gibi çaldırma.

### 📡 7. Wi-Fi Hotspot Otomasyonu & Cihaz Radarı
- Windows Mobile Hotspot'u web arayüzünden tek tıkla açma/kapatma (`WinRT / PowerShell`).
- Şifresiz katılım sağlayan dinamik Wi-Fi QR Kodu (`WIFI:S:...;P:...;;`).
- Odaya bağlı cihazların IP, cihaz tipi ve katılım sürelerini gösteren canlı radar.

### 📊 8. Canlı Depolama Göstergesi & Wi-Fi Hız Testi
- **Disk Alanı Çubuğu:** Paylaşılan sürücünün boş, kullanılan ve toplam alanını renkli doluluk yüzdesiyle gösterir.
- **Dahili Hız Testi:** Yerel ağ üzerinden Ping (ms), İndirme ve Yükleme (MB/s & Mbps) hızını ölçen speedometer göstergesi.

### 🔔 9. Bildirim Sistemi & Masaüstü Entegrasyonu
- Dosya yüklendiğinde yerel Windows 10/11 Masaüstü Bildirimi ve Web Audio API ile tatlı ses efekti.
- Web arayüzünden tek tıkla paylaşılan klasörü Windows Gezgini'nde açma (`📂 Gezgin`).

---

## 🚀 Kurulum ve Çalıştırma (Getting Started)

### Seçenek 1: Hazır Scriptler ile Başlatma (Windows)
Proje kök dizininde hazır başlatıcılar yer alır:
- `AirMesh_Baslat.bat`: Terminal penceresiyle başlatır ve bağlantı IP / QR kodunu gösterir.
- `AirMesh_Arkaplanda_Baslat.vbs`: Sunucuyu tamamen sessiz ve penceresiz arka planda çalıştırır.
- `AirMesh_Durdur.bat`: Çalışan arka plan süreçlerini tek tıkla sonlandırır.

### Seçenek 2: Kaynak Koddan Derleme (Go)

```powershell
# Depoyu klonlayın
git clone https://github.com/ahmetselmancloud/airmesh.git
cd airmesh

# Bağımsız tek binary olarak derleyin
go build -o airmesh.exe main.go

# Başlatın
.\airmesh.exe -dir ./shared -port 8080
```

### Komut Satırı Parametreleri (CLI Flags)
| Parametre | Varsayılan | Açıklama |
|---|---|---|
| `-dir` | `./shared` | Paylaşılacak yerel klasör yolu |
| `-port` | `8080` | HTTP dinleme portu (Port doluysa 8081..8089'a otomatik devreder) |
| `-dns` | `true` | Captive Portal için UDP 53 DNS sunucusunu başlatır |

---

## 📱 Alıcı Cihazlar Nasıl Bağlanır? (How to Connect)

1. Alıcı cihazı (iPhone, Android, PC vb.) host cihazın Wi-Fi ağına veya host cihazın açtığı **Mobil Erişim Noktasına** bağlayın.
2. Kamera ile ekrandaki **Wi-Fi QR** veya **Bağlantı QR** kodunu okutun.
3. Açılan web arayüzünden dosyaları anında indirin, izleyin veya yükleyin!

---

## 🌐 REST API Dokümantasyonu (Endpoints)

| Endpoint | Metod | Açıklama |
|---|---|---|
| `/api/files?dir=...` | `GET` | Belirtilen alt dizindeki dosya ve klasör listesini döner |
| `/api/download?file=...&dir=...` | `GET` | Dosyayı `attachment` olarak doğrudan indirir |
| `/api/stream?file=...&dir=...` | `GET` | HTTP Range destekli video/ses/resim önizleme akışı |
| `/api/upload?name=...&dir=...` | `POST` | Doğrudan diske akışlı dosya yükleme (RAM'i şişirmez) |
| `/api/zip?files=...&dir=...` | `GET` | Dosya/klasörleri canlı olarak tek parça ZIP akışı halinde indirir |
| `/api/mkdir?name=...&dir=...` | `POST` | Güvenli alt klasör oluşturur |
| `/api/rename?old=...&new=...&dir=...` | `POST` | Dosya/klasör adını değiştirir veya klasör içine taşır |
| `/api/delete?file=...&dir=...` | `POST` | Dosyayı veya klasörü siler (`os.RemoveAll`) |
| `/api/storage` | `GET` | Sürücünün toplam, kullanılan ve boş disk alanını döner |
| `/api/auth/status` | `GET` | Oda güvenlik, PIN ve misafir izin durumunu döner |
| `/api/auth/verify` | `POST` | Misafir PIN doğrulama ve token üretimi |
| `/api/auth/config` | `POST` | Host için güvenlik ayarlarını güncelleme |
| `/api/hotspot` | `GET / POST` | Windows Mobile Hotspot durumu sorgulama ve açma/kapatma |
| `/api/radar` | `GET` | Odaya bağlı cihazların anlık listesi |
| `/api/speedtest/*` | `GET / POST` | Ping, indirme ve yükleme hız testi motoru |
| `/ws` | `GET (WS)` | Canlı sohbet, pano, bildirimler ve senkronize müzik soketi |

---

## ⌨️ Kısayollar & Kolaylıklar

- `Escape`: Açık olan tüm modalları (Lightbox, Yeniden Adlandır, Klasör, Güvenlik, QR vb.) anında kapatır.
- `Enter`: Arama ve form gönderimlerini anında onaylar.
- `Sürükle-Bırak`: Dosyaları tarayıcıya sürükleyerek yükleyin veya dosya kartını bir klasörün üstüne bırakarak içine taşıyın.

---

## 🗺️ Gelecek Yol Haritası (Roadmap)

AirMesh'in gelecek sürümlerine (v1.1 Token-Bucket ile Adil Bant Genişliği Dağıtımı, v1.2 macOS/Linux Masaüstü Entegrasyonu, v2.0 Android Host Mobil Sunucu APK vb.) ilişkin teknik hedefler ve kilometre taşları için **[ROADMAP.md](ROADMAP.md)** belgesine göz atabilirsiniz.

---

## 📄 Lisans (License)

Bu proje [MIT Lisansı](LICENSE) kapsamında açık kaynak olarak yayınlanmıştır.

Geliştirici: **Ahmet Selman** ([@ahmetselmancloud](https://github.com/ahmetselmancloud))
