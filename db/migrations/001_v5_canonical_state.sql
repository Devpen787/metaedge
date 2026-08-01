begin;

create schema if not exists metaedge;

create table if not exists metaedge.state_commits (
  revision bigint primary key,
  committed_at timestamptz not null default clock_timestamp(),
  state_hash text not null check (state_hash ~ '^[0-9a-f]{64}$'),
  state_bytes bigint not null check (state_bytes >= 0),
  writer_id text not null check (length(writer_id) between 1 and 128),
  changed_keys text[] not null default '{}',
  deleted_keys text[] not null default '{}'
);

create table if not exists metaedge.state_meta (
  id smallint primary key check (id = 1),
  schema_version integer not null check (schema_version = 5),
  revision bigint not null references metaedge.state_commits(revision),
  state_hash text not null check (state_hash ~ '^[0-9a-f]{64}$'),
  state_bytes bigint not null check (state_bytes >= 0),
  updated_at timestamptz not null default clock_timestamp()
);

create table if not exists metaedge.state_segments (
  segment_key text primary key check (length(segment_key) between 1 and 128),
  value jsonb not null,
  value_hash text not null check (value_hash ~ '^[0-9a-f]{64}$'),
  value_bytes bigint not null check (value_bytes >= 0),
  last_revision bigint not null references metaedge.state_commits(revision),
  updated_at timestamptz not null default clock_timestamp()
);

commit;
