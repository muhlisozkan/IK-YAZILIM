-- A La Carte Rezervasyon: Konsiyerj departmanının kapalı devre kullandığı,
-- diğer modüllerden bağımsız restoran/oturum + rezervasyon kayıt modülü.
-- Erişim yalnızca "Yeni Rol" oluşturucusundaki 'alacarte' modül izniyle (veya
-- Sistem yöneticisi) verilir — bkz. api/server.js alacarteAccess().
create table if not exists alacarte_restaurants (
  id serial primary key,
  name text not null,
  description text not null default '',
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists alacarte_sessions (
  id serial primary key,
  restaurant_id int not null references alacarte_restaurants(id) on delete cascade,
  name text not null,
  days_of_week smallint[] not null default '{1,2,3,4,5,6,7}',
  start_time text not null,
  end_time text not null,
  capacity int not null default 0,
  price_adult numeric(10,2) not null default 0,
  price_child numeric(10,2) not null default 0,
  child_min_age int not null default 7,
  child_max_age int not null default 11,
  accepts_children boolean not null default true,
  min_party int not null default 0,
  max_party int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Günlük Excel yüklemesiyle her seferinde baştan doldurulan misafir listesi
-- (rezervasyon formunda hızlı seçim için). Rezervasyon kaydı kendi ad/oda/telefon
-- bilgisini ayrıca sakladığı için (denormalize) misafir silinse de geçmiş kayıt bozulmaz.
create table if not exists alacarte_guests (
  id serial primary key,
  name text not null,
  room_no text not null default '',
  guest_type text not null default 'inhouse',
  phone text not null default '',
  imported_at timestamptz not null default now()
);
create index if not exists alacarte_guests_name_idx on alacarte_guests (lower(name));

create table if not exists alacarte_reservations (
  id serial primary key,
  restaurant_id int not null references alacarte_restaurants(id),
  session_id int references alacarte_sessions(id) on delete set null,
  guest_id int references alacarte_guests(id) on delete set null,
  guest_name text not null,
  room_no text not null default '',
  phone text not null default '',
  guest_type text not null default '',
  adult_count int not null default 1,
  child_count int not null default 0,
  infant_count int not null default 0,
  reservation_date date not null,
  reservation_time text not null,
  amount numeric(10,2) not null default 0,
  status text not null default 'Onaylandı',
  arrived boolean not null default false,
  note text not null default '',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists alacarte_reservations_date_idx on alacarte_reservations (reservation_date);
