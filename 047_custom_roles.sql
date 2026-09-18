-- Kullanıcı ekleme ekranındaki "Yeni Rol" oluşturucusu: modül bazlı,
-- 3 seviyeli (görme/yazma/tam kontrol) izinlerle kalıcı özel roller.
create table if not exists custom_roles (
  id serial primary key,
  name text not null unique,
  permissions jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);
