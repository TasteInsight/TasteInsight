#!/bin/sh
set -eu

node scripts/test-environment.cjs
: "${REDIS_PORT:?REDIS_PORT is required}"
: "${REDIS_PASSWORD:?REDIS_PASSWORD is required}"

docker rm -f tasteinsight-test-redis >/dev/null 2>&1 || true
docker run -d --name tasteinsight-test-redis \
  -p "127.0.0.1:${REDIS_PORT}:6379" \
  redis:alpine redis-server --appendonly yes --requirepass "$REDIS_PASSWORD"

pnpm run test:embedding:start
sleep 2
pnpm exec prisma migrate deploy
pnpm exec prisma generate
pnpm exec ts-node prisma/seed.ts
