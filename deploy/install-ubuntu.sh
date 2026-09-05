#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/ik-merkezi"
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER" || true
fi
sudo mkdir -p "$APP_DIR"
sudo chown -R "$USER":"$USER" "$APP_DIR"
echo "Sunucu hazır. Uygulama dosyalarını $APP_DIR içine kopyalayıp şu komutları çalıştırın:"
echo "  cd $APP_DIR"
echo "  docker compose up -d --build"
echo "  curl -I http://127.0.0.1:8080"
