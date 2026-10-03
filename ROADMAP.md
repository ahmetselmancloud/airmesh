# 🗺️ AirMesh — Gelecek Yol Haritası (Product Roadmap)

Bu belge, **AirMesh** projesinin mevcut durumunu, mimari önceliklerini ve gelecek sürümler için planlanan teknik kilometre taşlarını özetlemektedir.

---

## 📌 Sürüm Özeti & İlerleme Tablosu

| Sürüm | Durum | Temel Odak |
|---|---|---|
| **v1.0.0 (Mevcut)** | ✅ **Yayında** | Sıfır kurulum, bağımsız tek binary, Go çekirdeği, Zero-Copy transfer, Captive Portal, PWA önyüzü, Windows Hotspot yönetimi, oda güvenliği. |
| **v1.1.0** | ⏳ **Planlandı** | Adil Bant Genişliği Dağıtımı (Fair Queueing / Rate Limiting), dinamik hız dengeleme, aktarım kuyruğu optimizasyonları. |
| **v1.2.0** | ⏳ **Planlandı** | Çapraz masaüstü Hotspot & DNS desteği (macOS & Linux `hostapd` / `NetworkManager` entegrasyonu), arkaplan daemon (systemd/service) desteği. |
| **v2.0.0** | 🔮 **Gelecek Vizyonu** | Bağımsız Android Host APK (Mobil Sunucu), Wi-Fi Direct (P2P) desteği, Uçtan Uca (E2EE) şifreli oda modu. |

---

## ✅ v1.0.0 — Kararlı Çekirdek & Sıfır Kurulum (Tamamlandı)

- [x] **Bağımsız Go Çekirdeği:** CGo veya harici runtime gerektirmeyen, tüm web varlıklarını (`//go:embed`) tek bir `.exe` dosyasında toplayan yapı.
- [x] **Yüksek Performanslı Ağ:** 4 MB okuma/yazma soket tamponları, `TCP_NODELAY = 1`, `io.Copy` & `sendfile` ile RAM kopyalamasız (Zero-Copy) aktarım.
- [x] **HTTP Byte-Range & Canlı Akış:** Büyük video ve ses dosyalarını indirmeden izleme ve yarıda kalan indirmeleri devam ettirebilme.
- [x] **On-the-Fly ZIP Akışı:** Dosya ve klasörleri diskte geçici dosya oluşturmadan anında sıkıştırıp akış halinde gönderme (`/api/zip`).
- [x] **Captive DNS & Portal:** Port 53 UDP captive DNS yönlendirmesi ve Apple/Android ağ yoklama (`/generate_204`, `/hotspot-detect.html`) yakalayıcıları.
- [x] **Windows Entegrasyonu:** WinRT PowerShell ile tek tıkla Hotspot yönetimi, `kernel32.dll` ile canlı disk alanı (`/api/storage`), Windows yerel bildirimleri.
- [x] **Zengin PWA Önyüzü:** Mobil uyumlu duyarlı tasarım, Açık/Koyu tema, Çoklu dosya seçimi (Batch Bar), Galeri modu, Lightbox, SyncPlay ve Çevrimdışı Pano/Sohbet.
- [x] **Oda Güvenliği:** 4 haneli PIN kodu koruması, Misafir Salt-Okunur (Read-Only) modu ve dosya silme yetkilendirmesi.

---

## 🚀 v1.1.0 — Adil Trafik & Ağ Optimizasyonları (Sıradaki Adım)

Bu sürüm, çoklu istemcili yoğun ortamlarda (örneğin aynı anda 5+ cihazın dosya indirdiği senaryolarda) ağ bant genişliğinin adil ve dengeli dağıtılmasını hedefler.

* **🎯 Adil Kuyruk Yönetimi (Fair Queueing & Token Bucket):**
  - `golang.org/x/time/rate` mekanizması ile bağlantı başına dinamik bant genişliği tavanı.
  - Örneğin toplam 80 MB/s bant genişliğinde 4 aktif alıcı varsa, her birine adil olarak ~20 MB/s ayrılması; biri bitirdiğinde hızın kalanlara anında yeniden paylaştırılması.
* **⚡ Akıllı İndirme Önceliklendirmesi (QoS):**
  - Medya akışı (`/api/stream`) ve SyncPlay müzik paketlerinin, büyük dosya indirmelerinden (`/api/download`) daha yüksek önceliğe sahip olması, böylece video veya şarkı çalarken takılma yaşanmaması.
* **📊 Gelişmiş Host Telemetrisi:**
  - Hangi IP'nin hangi hızda ne kadar veri aktardığını gösteren anlık bant genişliği monitörü widget'ı.

---

## 🖥️ v1.2.0 — Çapraz Masaüstü Genişlemesi (macOS & Linux)

AirMesh'in Windows dışındaki masaüstü platformlarında da aynı "tek tıkla çalıştır" konforuna erişmesi hedeflenmektedir.

* **🐧 Linux Hotspot Entegrasyonu:**
  - `NetworkManager` (`nmcli`) veya `hostapd` üzerinden otomatik sanal erişim noktası oluşturma ve yönetme.
* **🍏 macOS Wi-Fi Paylaşım Desteği:**
  - `networksetup` ve macOS yerel ağ paylaşım köprüsü entegrasyonu.
* **⚙️ Servis / Arkaplan Modu (Daemon):**
  - Linux `systemd` ve Windows Service olarak sistem açılışında sessizce başlama seçeneği.

---

## 🔮 v2.0.0 — Mobil Host Ekosistemi & Uçtan Uca Güvenlik

AirMesh'in yalnızca bilgisayardan telefona değil, **telefondan telefona da sıfır internet kotasıyla** dosya paylaşabilmesini sağlayacak büyük vizyon adımı.

* **📱 Bağımsız Android Host APK (Mobil Sunucu):**
  - Android telefonların doğrudan Wi-Fi Erişim Noktası (Hotspot) veya Wi-Fi Direct (P2P) oluşturarak sunucu olabilmesi.
  - Alıcı cihazların yine **hiçbir şey yüklemeden** telefonun oluşturduğu web arayüzüne bağlanarak dosya alıp gönderebilmesi.
* **🔐 Uçtan Uca Şifreleme (E2EE / AES-GCM):**
  - Şifreli oda modunda, dosyaların host diske aktarılmadan önce tarayıcı üzerinde Web Crypto API ile şifrelenip anahtara sahip istemciler tarafından çözülebilmesi.
* **🗂️ Dosya Etiketleme & Sürüm Kontrolü:**
  - Aynı isimde yüklenen dosyalar için çakışma önleyici akıllı versiyonlama (`dosya (1).png`).

---

> [!TIP]
> Bu yol haritasına dair öneri, geri bildirim veya katkıda bulunmak için lütfen [GitHub Issues](https://github.com/ahmetselmancloud/airmesh/issues) üzerinden bize ulaşın.
