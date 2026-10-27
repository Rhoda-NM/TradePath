#!/usr/bin/env bash
set -euo pipefail
# Disposable local PostgreSQL only. No remote database URL is accepted.
tradepath_pg_bin="${TRADEPATH_PG_BIN:-/usr/lib/postgresql/16/bin}"
tradepath_test_dir=$(mktemp -d /tmp/tradepath-db.XXXXXX)
cleanup() {
  "$tradepath_pg_bin/pg_ctl" -D "$tradepath_test_dir/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$tradepath_test_dir"
}
trap cleanup EXIT
"$tradepath_pg_bin/initdb" -D "$tradepath_test_dir/data" -A trust -U postgres --no-locale >/dev/null
"$tradepath_pg_bin/pg_ctl" -D "$tradepath_test_dir/data" -l "$tradepath_test_dir/server.log" -o "-k $tradepath_test_dir -h '' -p 55439" -w start >/dev/null
psql -X -q -v ON_ERROR_STOP=1 -h "$tradepath_test_dir" -p 55439 -U postgres -f tests/database/bootstrap.sql
for migration in supabase/migrations/*.sql; do
  psql -X -q -v ON_ERROR_STOP=1 -h "$tradepath_test_dir" -p 55439 -U postgres -f "$migration"
done
psql -X -q -v ON_ERROR_STOP=1 -h "$tradepath_test_dir" -p 55439 -U postgres -f tests/database/isolation.sql
psql -X -q -v ON_ERROR_STOP=1 -h "$tradepath_test_dir" -p 55439 -U postgres -f tests/database/curriculum.sql
psql -X -q -v ON_ERROR_STOP=1 -h "$tradepath_test_dir" -p 55439 -U postgres -f tests/database/daily-remarks.sql
psql -X -q -v ON_ERROR_STOP=1 -h "$tradepath_test_dir" -p 55439 -U postgres -f tests/database/journal.sql
psql -X -q -v ON_ERROR_STOP=1 -h "$tradepath_test_dir" -p 55439 -U postgres -f tests/database/insights.sql
psql -X -q -v ON_ERROR_STOP=1 -h "$tradepath_test_dir" -p 55439 -U postgres -f tests/database/deletion.sql
