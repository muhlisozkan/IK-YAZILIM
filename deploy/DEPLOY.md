# 10.48.1.60 kurulum notları

## 1. Dosyaları sunucuya gönderin

Bu klasörü Ubuntu sunucuda `/opt/ik-merkezi` altına kopyalayın. Örnek:

```bash
scp -r . kullanıcı@10.48.1.60:/opt/ik-merkezi
```

## 2. Docker ile başlatın

```bash
cd /opt/ik-merkezi
docker compose up -d --build
curl -I http://127.0.0.1:8080
```

## 3. Cloudflare Tunnel

Cloudflare Zero Trust panelinden bir Tunnel oluşturun. Üretilen token ile `cloudflared` servisini sunucuya kurun veya `cloudflared-config.yml.example` dosyasını gerçek tünel UUID'si ve alan adıyla `/etc/cloudflared/config.yml` olarak düzenleyin.

Tunnel hedefi:

```text
http://127.0.0.1:8080
```

İlk aşamada yalnızca Cloudflare üzerinden erişim verin; 8080 portunu dışarıya açmayın.

> Bu mevcut sürüm statik prototiptir. Veritabanı ve gerçek kullanıcı girişi eklenmeden üretim İK verisi yüklenmemelidir.
