-- Yıllık izin günleri buçuklu (yarım gün) olabilir
alter table leave_requests alter column days type numeric(5,1) using days::numeric(5,1);
