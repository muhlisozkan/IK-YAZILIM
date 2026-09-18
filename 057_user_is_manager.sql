-- Kullanıcı bazlı "Yönetici" tiki: işaretli değilse İzin Yönetimi, Personel
-- Bütçesi ve CV Yönetimi menüleri o kullanıcıda görünmez (kullanıcı isteği 2026-09).
-- Mevcut kullanıcıların erişimi bozulmasın diye varsayılan true.
alter table app_users add column if not exists is_manager boolean not null default true;
