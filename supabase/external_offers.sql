create table if not exists public.external_offers (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  location text not null,
  size text not null,
  price text not null default 'السعر عند التواصل',
  note text,
  source_name text not null,
  source_url text not null unique,
  checked_at date not null default current_date,
  status text not null default 'published',
  quality_score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.external_offers enable row level security;

drop policy if exists "Public can read published external offers"
on public.external_offers;

create policy "Public can read published external offers"
on public.external_offers
for select
using (status = 'published');

create index if not exists external_offers_status_checked_idx
on public.external_offers (status, checked_at desc);
