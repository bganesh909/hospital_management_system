#!/usr/bin/env bash
# Apply pending migrations and seeds, tracking what has run in schema_migrations.
#
# Usage (run from the project root):
#   ./database/migrate.sh                     # uses DATABASE_URL_SYNC (or DATABASE_URL) from env / backend-fastapi/.env
#   ./database/migrate.sh "postgresql://..."  # explicit connection URL
#   ./database/migrate.sh --baseline 013      # existing DB: mark 001..013 as applied without running them
#   ./database/migrate.sh --status            # show applied / pending files
#   ./database/migrate.sh --print-target      # show which database would be used, then exit
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASELINE=""
STATUS_ONLY=false
PRINT_TARGET=false
DB_URL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --baseline) BASELINE="$2"; shift 2 ;;
    --status) STATUS_ONLY=true; shift ;;
    --print-target) PRINT_TARGET=true; shift ;;
    *) DB_URL="$1"; shift ;;
  esac
done

read_env() {
  # Read KEY from backend-fastapi/.env without sourcing it
  local key="$1" file="$ROOT/backend-fastapi/.env"
  [[ -f "$file" ]] || return 0
  grep -E "^${key}=" "$file" | tail -1 | cut -d= -f2- | sed -E 's/^["'\'']//; s/["'\'']$//'
}

to_sync() { echo "${1/postgresql+asyncpg:\/\//postgresql://}"; }

# Same precedence as the app: explicit argument > environment variables > backend-fastapi/.env
if [[ -z "$DB_URL" ]]; then
  if [[ -n "${DATABASE_URL_SYNC:-}" ]]; then
    DB_URL="$DATABASE_URL_SYNC"
  elif [[ -n "${DATABASE_URL:-}" ]]; then
    DB_URL="$(to_sync "$DATABASE_URL")"
  elif [[ -n "$(read_env DATABASE_URL_SYNC)" ]]; then
    DB_URL="$(read_env DATABASE_URL_SYNC)"
  else
    DB_URL="$(to_sync "$(read_env DATABASE_URL)")"
  fi
fi
if [[ -z "$DB_URL" ]]; then
  echo "No database URL. Set DATABASE_URL_SYNC/DATABASE_URL (env or backend-fastapi/.env) or pass one." >&2
  exit 1
fi

# Show the target (without the password) before touching anything
echo "Target database: $(echo "$DB_URL" | sed -E 's#://([^:/@]+)(:[^@]*)?@#://\1@#')"
$PRINT_TARGET && exit 0

export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
PSQL=(psql "$DB_URL" -v ON_ERROR_STOP=1 -q -X)

"${PSQL[@]}" -c "CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
)"

is_applied() {
  [[ "$("${PSQL[@]}" -At -c "SELECT 1 FROM schema_migrations WHERE filename = '$1'")" == "1" ]]
}

mark_applied() {
  "${PSQL[@]}" -c "INSERT INTO schema_migrations (filename) VALUES ('$1') ON CONFLICT DO NOTHING"
}

if [[ -n "$BASELINE" ]]; then
  for f in "$ROOT"/database/migrations/*.sql; do
    name="migrations/$(basename "$f")"
    num="$(basename "$f" | cut -d_ -f1)"
    if [[ "$num" < "$BASELINE" || "$num" == "$BASELINE" ]]; then
      mark_applied "$name" && echo "  baselined: $name"
    fi
  done
fi

pending=0
for dir in migrations seeds; do
  for f in "$ROOT"/database/$dir/*.sql; do
    name="$dir/$(basename "$f")"
    if is_applied "$name"; then
      $STATUS_ONLY && echo "  applied:  $name"
      continue
    fi
    pending=$((pending + 1))
    if $STATUS_ONLY; then
      echo "  pending:  $name"
      continue
    fi
    echo "  applying: $name"
    "${PSQL[@]}" --single-transaction -f "$f"
    mark_applied "$name"
  done
done

if $STATUS_ONLY; then
  echo "$pending pending"
elif [[ $pending -eq 0 ]]; then
  echo "Database is up to date."
else
  echo "Applied $pending file(s)."
fi
