-- Nilayam V1 schema
create extension if not exists pg_trgm;

create type property_type as enum ('house', 'land');
create type submission_status as enum ('received', 'under_review', 'listed', 'sold', 'withdrawn', 'rejected');
create type listing_state as enum ('draft', 'published', 'sold', 'withdrawn');
create type visit_status as enum ('new', 'contacted', 'scheduled', 'done', 'cancelled');

create table admins (
    user_id    uuid primary key,
    email      text not null,
    created_at timestamptz not null default now()
);

-- Original seller submission. Immutable except workflow status columns.
create table submissions (
    id                  uuid primary key default gen_random_uuid(),
    ref_code            text not null unique,
    device_token_hash   text not null,
    seller_name         text not null,
    seller_phone        text not null,
    property_type       property_type not null,
    land_area_cents     numeric(10, 2) not null check (land_area_cents > 0),
    location            text not null,
    description         text not null,
    expected_price      bigint not null check (expected_price > 0),
    negotiable          boolean not null,
    documents_available text not null,
    consent_version     text not null,
    consent_at          timestamptz not null,
    ip_hash             text,
    created_at          timestamptz not null default now(),
    status              submission_status not null default 'received',
    status_note         text,
    status_updated_at   timestamptz not null default now()
);
create index submissions_device_idx on submissions (device_token_hash);
create index submissions_status_idx on submissions (status, created_at desc);

create table listings (
    id                  uuid primary key default gen_random_uuid(),
    submission_id       uuid not null unique references submissions (id),
    state               listing_state not null default 'draft',
    title               text not null,
    property_type       property_type not null,
    land_area_cents     numeric(10, 2) not null check (land_area_cents > 0),
    location            text not null,
    description         text not null,
    price               bigint not null check (price > 0),
    negotiable          boolean not null,
    documents_note      text not null default '',
    photo_ids           uuid[] not null default '{}',
    confirmed_price     bigint,
    price_confirmed_at  timestamptz,
    price_confirmation_note text,
    current_version     int not null default 0,
    published_at        timestamptz,
    sold_at             timestamptz,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);
create index listings_state_idx on listings (state);

-- Immutable published snapshots.
create table published_versions (
    id           uuid primary key default gen_random_uuid(),
    listing_id   uuid not null references listings (id),
    version      int not null,
    snapshot     jsonb not null,
    published_by uuid not null,
    published_at timestamptz not null default now(),
    search       tsvector generated always as (
        to_tsvector('simple',
            coalesce(snapshot ->> 'title', '') || ' ' ||
            coalesce(snapshot ->> 'location', '') || ' ' ||
            coalesce(snapshot ->> 'description', ''))
    ) stored,
    unique (listing_id, version)
);
create index published_versions_search_idx on published_versions using gin (search);

create table listing_photos (
    id              uuid primary key default gen_random_uuid(),
    kind            text not null check (kind in ('original', 'public')),
    submission_id   uuid references submissions (id),
    listing_id      uuid references listings (id),
    source_photo_id uuid references listing_photos (id),
    bucket          text not null,
    path            text not null,
    position        int not null default 0,
    created_at      timestamptz not null default now(),
    check ((kind = 'original' and submission_id is not null and listing_id is null)
        or (kind = 'public' and listing_id is not null and source_photo_id is not null)),
    unique (bucket, path)
);
create index listing_photos_submission_idx on listing_photos (submission_id);
create unique index listing_photos_public_src_idx on listing_photos (listing_id, source_photo_id) where kind = 'public';

create table visit_requests (
    id              uuid primary key default gen_random_uuid(),
    listing_id      uuid not null references listings (id),
    listing_version int not null,
    name            text not null,
    phone           text not null,
    preferred_time  text not null default '',
    message         text not null default '',
    status          visit_status not null default 'new',
    admin_notes     text not null default '',
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
create index visit_requests_status_idx on visit_requests (status, created_at desc);
create index visit_requests_listing_phone_idx on visit_requests (listing_id, phone);

create table audit_events (
    id        bigserial primary key,
    actor     uuid,
    action    text not null,
    entity    text not null,
    entity_id uuid,
    data      jsonb not null default '{}',
    at        timestamptz not null default now()
);

-- Immutability guards ------------------------------------------------------

create function submissions_guard() returns trigger language plpgsql as $$
declare
    mutable text[] := array['status', 'status_note', 'status_updated_at'];
begin
    if tg_op = 'DELETE' then
        raise exception 'submissions are immutable';
    end if;
    if (to_jsonb(new) - mutable) is distinct from (to_jsonb(old) - mutable) then
        raise exception 'submission original fields are immutable';
    end if;
    return new;
end $$;

create trigger submissions_immutable
    before update or delete on submissions
    for each row execute function submissions_guard();

create function reject_change() returns trigger language plpgsql as $$
begin
    raise exception '% is immutable', tg_table_name;
end $$;

create trigger published_versions_immutable
    before update or delete on published_versions
    for each row execute function reject_change();

-- Row level security: deny everything to Supabase client roles. -------------
-- The backend connects as the table owner and is the only data access path.

alter table admins             enable row level security;
alter table submissions        enable row level security;
alter table listings           enable row level security;
alter table published_versions enable row level security;
alter table listing_photos     enable row level security;
alter table visit_requests     enable row level security;
alter table audit_events       enable row level security;

do $$
begin
    if exists (select 1 from pg_roles where rolname = 'anon') then
        revoke all on all tables in schema public from anon, authenticated;
        revoke all on all sequences in schema public from anon, authenticated;
        revoke all on all functions in schema public from anon, authenticated;
        alter default privileges in schema public revoke all on tables from anon, authenticated;
        alter default privileges in schema public revoke all on sequences from anon, authenticated;
        alter default privileges in schema public revoke all on functions from anon, authenticated;
    end if;
end $$;
