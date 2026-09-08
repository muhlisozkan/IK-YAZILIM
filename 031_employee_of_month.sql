-- Ayın Personeli (Make It Right) oylaması
-- İki kategori: idari ofis + operasyon. Her oy veren her kategoriden 1 aday seçebilir.
create table if not exists eom_periods(
  id bigserial primary key,
  title text not null,
  status text not null default 'open' check(status in ('open','closed')),
  created_by text,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists eom_candidates(
  id bigserial primary key,
  period_id bigint not null references eom_periods(id) on delete cascade,
  category text not null check(category in ('idari','operasyon')),
  employee_id bigint,
  name text not null,
  subtitle text not null default '',
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists eom_candidates_period_idx on eom_candidates(period_id, category);

create table if not exists eom_votes(
  period_id bigint not null references eom_periods(id) on delete cascade,
  category text not null check(category in ('idari','operasyon')),
  candidate_id bigint not null references eom_candidates(id) on delete cascade,
  voter_id bigint not null,
  voter_name text not null default '',
  created_at timestamptz not null default now(),
  primary key(period_id, category, voter_id)
);
create index if not exists eom_votes_candidate_idx on eom_votes(candidate_id);
