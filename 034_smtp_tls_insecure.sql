-- SMTP: TLS sertifika doğrulamasını yok sayma seçeneği
-- (kurumsal güvenlik duvarı SMTP trafiğini incelediğinde gerekebilir)
alter table smtp_settings add column if not exists tls_insecure boolean not null default false;
