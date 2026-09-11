-- Doğum günü SMS'i: mevcut SMS entegrasyonu (sms_settings) üzerine iki alan.
-- {isim} yer tutucusu mesaj gönderiminde çalışanın adıyla değiştirilir.
alter table sms_settings add column if not exists birthday_enabled boolean not null default false;
alter table sms_settings add column if not exists birthday_message_template text not null default 'Sayın {isim}, doğum gününüzü kutlar, nice mutlu yıllara ulaşmanızı dileriz!';
