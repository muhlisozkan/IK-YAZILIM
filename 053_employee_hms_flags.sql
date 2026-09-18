-- Çalışanlar düzenleme formundaki "Çalışan Takip" ve "Şoför" tikleri:
-- ilki Güvenlik > Çalışan Takipleri listesine otomatik ekler/çıkarır (geçmişi
-- silmeden, hms_records.data.trackingActive ile gizler), ikincisi Araç
-- Takipleri formundaki "Sürücü" öneri listesini bu kişilerle sınırlar.
alter table employees add column if not exists is_staff_tracked boolean not null default false;
alter table employees add column if not exists is_driver boolean not null default false;
