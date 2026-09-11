-- Doğum günü SMS'i: mevcut SMS entegrasyonu (sms_settings) üzerine iki alan.
-- Ad-soyad gönderim sırasında sistemden otomatik eklenir ("Sayın <ad soyad>, ");
-- bu alana yalnızca kutlama metni yazılır.
alter table sms_settings add column if not exists birthday_enabled boolean not null default false;
alter table sms_settings add column if not exists birthday_message_template text not null default 'doğum gününüzü kutlar, nice mutlu yıllara ulaşmanızı dileriz!';
