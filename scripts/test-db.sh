#!/usr/bin/env bash
# Applies the migration + seed to a throwaway local Postgres (with a stub of
# Supabase's auth schema) and runs the RLS checks. Requires PostgreSQL 15+ binaries.
set -euo pipefail
PGBIN=${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
WORK=$(mktemp -d)
chmod 755 "$WORK"
RUN=""
if [ "$(id -u)" = "0" ]; then chown postgres "$WORK"; RUN="su postgres -c"; fi
run() { if [ -n "$RUN" ]; then $RUN "$*"; else bash -c "$*"; fi; }
cp "$ROOT"/supabase/migrations/*.sql "$ROOT/supabase/seed.sql" "$ROOT"/supabase/tests/*.sql "$WORK"/ && chmod 644 "$WORK"/*.sql
run "$PGBIN/initdb -D $WORK/data -A trust >/dev/null"
run "$PGBIN/pg_ctl -D $WORK/data -o '-k $WORK -p 54331 -c listen_addresses=' -l $WORK/log start >/dev/null"
trap 'run "$PGBIN/pg_ctl -D $WORK/data stop -m fast >/dev/null"; rm -rf "$WORK"' EXIT
sleep 1
PSQL="psql -h $WORK -p 54331 -X -q -v ON_ERROR_STOP=1"
run "$PSQL -d postgres -c 'create database crave'"
run "$PSQL -d crave -f $WORK/auth_stub.sql $(ls "$ROOT"/supabase/migrations/*.sql | xargs -n1 basename | sed "s|^|-f $WORK/|" | tr '\n' ' ') -f $WORK/seed.sql"
echo "migration + seed: OK"
OUT=$(run "psql -h $WORK -p 54331 -X -A -t -d crave -f $WORK/rls_test.sql" 2>&1)
check() { echo "$OUT" | grep -q "$1" && echo "  ok   $2" || { echo "  FAIL $2"; FAILED=1; }; }
FAILED=0
check "^bob_sees_own_swipes|1$" "user sees own swipes"
check "^eve_sees_bob_swipes|0$" "user cannot see others' swipes"
check 'violates row-level security policy for table "restaurants"' "non-admin cannot write catalog"
check "only admins can change roles" "role escalation blocked"
check "^bob_profile|user|Bob$" "profile self-edit allowed, role unchanged"
check "^admin_restaurants|3$" "admin can write catalog"
check "^anon_reads_restaurants|3$" "anon can read catalog"
check "permission denied for table user_swipes" "anon cannot read user data"
check "^near_count|1$" "restaurants_near radius query"
exit $FAILED
