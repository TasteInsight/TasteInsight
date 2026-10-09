#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL must point to a separate test database}"
: "${REDIS_PORT:?REDIS_PORT is required}"
: "${REDIS_PASSWORD:?REDIS_PASSWORD is required}"

test_db_name=$(node -p 'new URL(process.env.DATABASE_URL).pathname.slice(1)')
case "$test_db_name" in
  *_test) ;;
  *)
    echo "Refusing to seed database '$test_db_name': its name must end in _test" >&2
    exit 1
    ;;
esac

docker rm -f tasteinsight-test-redis >/dev/null 2>&1 || true
docker run -d --name tasteinsight-test-redis \
  -p "127.0.0.1:${REDIS_PORT}:6379" \
  redis:alpine redis-server --appendonly yes --requirepass "$REDIS_PASSWORD"

pnpm run test:embedding:start
sleep 2
pnpm exec prisma migrate deploy
pnpm exec prisma generate
pnpm exec ts-node prisma/seed.ts
