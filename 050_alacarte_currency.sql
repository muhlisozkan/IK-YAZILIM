-- Restoran bazlı para birimi (TL/USD/EUR/GBP) — oturum fiyatları ve rezervasyon
-- tutarları bu restoranın para biriminde gösterilir.
alter table alacarte_restaurants add column if not exists currency text not null default 'TRY';
