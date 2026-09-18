-- Departmanın bütçe yılına "+ Pozisyon ekle" ile sonradan eklediği satırları önceki
-- yıldan taslak olarak kopyalanan satırlardan ayırt etmek için (kırmızı yazı gösterimi,
-- kullanıcı isteği 2026-09). Pozisyon satırları artık hiçbir uçtan silinemiyor.
alter table personel_butce_giris add column if not exists manual boolean not null default false;
