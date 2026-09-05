# İK Merkezi

Tarayıcıda çalışan, yerel veriyi `localStorage` içinde tutan İK MVP uygulaması.

## Dahil olan modüller

- Genel bakış: çalışan, aktiflik, izin ve ücret özetleri
- Çalışanlar: ekleme, arama, departman filtresi ve silme
- İzin yönetimi: izin talebi, gün hesabı ve onay akışı
- Ücret hesaplama: brüt-net demo hesaplama ve fazla mesai
- Masraf yönetimi: kategori, fiş/fatura, onay ve ödeme takibi
- Avans yönetimi: talep, onay, ödeme ve bordro mahsup takibi
- Raporlar: departman bazında kadro ve ücret özeti, yazdırma/PDF
- Rol entegrasyonu: role göre menü, kayıt ve onay işlemi görünürlüğü

## Formüller

İzin süresi: `Bitiş tarihi − Başlangıç tarihi + 1`

Yıllık izin kuralı (uygulamadaki bilgilendirme): 1–5 yıl kıdem 14 gün, 5–15 yıl 20 gün, 15 yıl üzeri 26 gün.

Ücret hesaplama demosu:

```text
Günlük brüt = Aylık brüt / 30
Fazla mesai = Günlük brüt / 7,5 × katsayı × saat
SGK işçi payı = Brüt × %14
İşsizlik payı = Brüt × %1
Gelir vergisi = (Brüt − SGK − işsizlik) × %15
Tahmini net = Brüt − SGK − işsizlik − gelir vergisi + fazla mesai
```

> Bordro oranları ve izin hesapları üretime alınmadan önce güncel mevzuata, çalışanın durumuna ve mali müşavir kontrolüne göre parametrik hale getirilmelidir. Bu sürüm bordro beyannamesi yerine ürün prototipidir.

## Çalıştırma

Dosyaları herhangi bir statik web sunucusundan servis edin veya doğrudan `index.html` dosyasını tarayıcıda açın. Üretim kullanımında veritabanı, kimlik doğrulama, KVKK kayıtları, yedekleme ve rol bazlı sunucu yetkilendirmesi eklenmelidir.

Docker kurulumu PostgreSQL, Express API ve nginx web katmanlarını birlikte başlatır. Mevcut bir veritabanına Masraf ve Avans tablolarını eklemek için yeniden oluşturma yerine `api/migrations/001_expenses_advances.sql` migration dosyasını uygulayın; bu dosya tekrar çalıştırılabilir ve mevcut tabloları/verileri silmez.
