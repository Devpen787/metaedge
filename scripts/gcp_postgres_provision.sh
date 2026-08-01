#!/usr/bin/env bash
set -euo pipefail

metaedge_db="${METAEDGE_POSTGRES_DATABASE:-metaedge}"
metaedge_role="${METAEDGE_POSTGRES_ROLE:-metaedge_app}"
metaedge_secret_file="${METAEDGE_POSTGRES_SECRET_FILE:-$HOME/.config/metaedge/postgres.env}"
metaedge_repo="${METAEDGE_REPO_DIR:-$(pwd)}"

[[ "$metaedge_db" =~ ^[a-z][a-z0-9_]{0,62}$ ]] || { echo "invalid database name" >&2; exit 1; }
[[ "$metaedge_role" =~ ^[a-z][a-z0-9_]{0,62}$ ]] || { echo "invalid role name" >&2; exit 1; }
test -f "$metaedge_repo/db/migrations/001_v5_canonical_state.sql"

if ! command -v psql >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq postgresql postgresql-client
fi

metaedge_pg_version="$(pg_config --version | awk '{print $2}' | cut -d. -f1)"
metaedge_pg_conf_dir="/etc/postgresql/$metaedge_pg_version/main/conf.d"
sudo mkdir -p "$metaedge_pg_conf_dir"
sudo tee "$metaedge_pg_conf_dir/metaedge-low-memory.conf" >/dev/null <<'CONF'
shared_buffers = 64MB
effective_cache_size = 256MB
maintenance_work_mem = 32MB
work_mem = 1MB
max_connections = 20
idle_in_transaction_session_timeout = 30000
statement_timeout = 15000
lock_timeout = 5000
log_lock_waits = on
deadlock_timeout = 1000
CONF
sudo systemctl restart postgresql

mkdir -p "$(dirname "$metaedge_secret_file")"
if [ -f "$metaedge_secret_file" ]; then
  # shellcheck disable=SC1090
  source "$metaedge_secret_file"
  metaedge_password="${METAEDGE_POSTGRES_PASSWORD:?secret file missing password}"
else
  metaedge_password="$(head -c 96 /dev/urandom | tr -dc 'A-Za-z0-9' | head -c 48)"
  umask 077
  {
    echo "METAEDGE_POSTGRES_PASSWORD=$metaedge_password"
    echo "DATABASE_URL=postgresql://$metaedge_role:$metaedge_password@127.0.0.1:5432/$metaedge_db"
  } > "$metaedge_secret_file"
fi
chmod 600 "$metaedge_secret_file"

sudo -u postgres psql --set=ON_ERROR_STOP=1 --set=app_role="$metaedge_role" \
  --set=app_password="$metaedge_password" --set=app_db="$metaedge_db" postgres <<'SQL'
select format('create role %I login password %L nosuperuser nocreatedb nocreaterole noinherit connection limit 4',
  :'app_role', :'app_password')
where not exists (select 1 from pg_roles where rolname = :'app_role') \gexec
select format('alter role %I password %L connection limit 4', :'app_role', :'app_password') \gexec
select format('alter role %I set statement_timeout = %L', :'app_role', '60s') \gexec
select format('alter role %I set lock_timeout = %L', :'app_role', '5s') \gexec
select format('alter role %I set idle_in_transaction_session_timeout = %L', :'app_role', '30s') \gexec
select format('create database %I owner postgres', :'app_db')
where not exists (select 1 from pg_database where datname = :'app_db') \gexec
select format('grant connect on database %I to %I', :'app_db', :'app_role') \gexec
SQL

sudo -u postgres psql --set=ON_ERROR_STOP=1 -d "$metaedge_db" \
  -f "$metaedge_repo/db/migrations/001_v5_canonical_state.sql" >/dev/null
sudo -u postgres psql --set=ON_ERROR_STOP=1 --set=app_role="$metaedge_role" -d "$metaedge_db" <<'SQL'
revoke create on schema public from public;
revoke all on schema metaedge from public;
revoke all on all tables in schema metaedge from public;
select format('grant usage on schema metaedge to %I', :'app_role') \gexec
select format('grant select, insert, update on metaedge.state_meta to %I', :'app_role') \gexec
select format('grant select, insert, update, delete on metaedge.state_segments to %I', :'app_role') \gexec
select format('grant select, insert on metaedge.state_commits to %I', :'app_role') \gexec
SQL

pg_isready -h 127.0.0.1 -p 5432 >/dev/null
echo "PostgreSQL ready: database=$metaedge_db role=$metaedge_role schema=metaedge secret_file=$metaedge_secret_file"
