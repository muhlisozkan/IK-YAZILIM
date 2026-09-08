-- Ayın Personeli adayları için fotoğraf (data URL olarak saklanır)
alter table eom_candidates add column if not exists photo text not null default '';
